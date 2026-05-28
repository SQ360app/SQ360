'use client'
import React, { useState, useEffect, use } from 'react'
import { supabase, getAziendaId } from '@/lib/supabase'
import { Plus, Loader2, FileText } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('it-IT') : '—'

const STATI = [
  { value: 'proposta',        label: 'Proposta',        color: '#6b7280', bg: '#f3f4f6' },
  { value: 'in_negoziazione', label: 'In negoziazione', color: '#d97706', bg: '#fef3c7' },
  { value: 'concordato',      label: 'Concordato',      color: '#059669', bg: '#d1fae5' },
  { value: 'inserito_ep',     label: 'Inserito in EP',  color: '#2563eb', bg: '#eff6ff' },
]

interface NP {
  id: string; commessa_id: string; azienda_id: string
  codice?: string; descrizione: string; um?: string
  pu_proposto?: number; pu_concordato?: number; stato: string
  variante_id?: string; ordine_servizio_id?: string
  note?: string; data_proposta?: string; data_concordamento?: string
  concordato_da?: string
}
interface Variante { id: string; numero: number; descrizione: string }
interface OS { id: string; numero: number; oggetto: string }

function StatoBadge({ stato }: { stato: string }) {
  const s = STATI.find(x => x.value === stato) || STATI[0]
  return <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
}

export default function NuoviPrezziPage({ params: pp }: { params: Promise<{ id: string }> }) {
  const { id } = use(pp)
  const [list,       setList]       = useState<NP[]>([])
  const [varianti,   setVarianti]   = useState<Variante[]>([])
  const [ordini,     setOrdini]     = useState<OS[]>([])
  const [loading,    setLoading]    = useState(true)
  const [aziendaId,  setAziendaId]  = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')

  // form
  const [fDesc,      setFDesc]      = useState('')
  const [fUm,        setFUm]        = useState('')
  const [fPu,        setFPu]        = useState('')
  const [fVarId,     setFVarId]     = useState('')
  const [fOsId,      setFOsId]      = useState('')
  const [fNote,      setFNote]      = useState('')

  async function carica() {
    setLoading(true)
    const db = supabase as any
    const [npRes, varRes, osRes] = await Promise.all([
      db.from('nuovi_prezzi').select('*').eq('commessa_id', id).order('created_at', { ascending: true }),
      db.from('varianti').select('id,numero,descrizione').eq('commessa_id', id).order('numero'),
      db.from('ordini_servizio').select('id,numero,oggetto').eq('commessa_id', id).order('numero'),
    ])
    setList(npRes.data || [])
    setVarianti(varRes.data || [])
    setOrdini(osRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    getAziendaId().then(az => { setAziendaId(az); carica() })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function salva() {
    if (!fDesc.trim()) { setErr('Descrizione obbligatoria'); return }
    setSaving(true); setErr('')
    const db = supabase as any
    const { error } = await db.from('nuovi_prezzi').insert({
      commessa_id: id, azienda_id: aziendaId,
      descrizione: fDesc.trim(),
      um: fUm.trim() || null,
      pu_proposto: fPu ? parseFloat(fPu) : null,
      variante_id: fVarId || null,
      ordine_servizio_id: fOsId || null,
      note: fNote.trim() || null,
      stato: 'proposta',
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setModalOpen(false); setFDesc(''); setFUm(''); setFPu(''); setFVarId(''); setFOsId(''); setFNote('')
    await carica()
  }

  async function cambiaStato(np: NP, nuovoStato: string) {
    const db = supabase as any
    const extra: Record<string, unknown> = {}
    if (nuovoStato === 'concordato') extra.data_concordamento = new Date().toISOString().split('T')[0]
    await db.from('nuovi_prezzi').update({ stato: nuovoStato, ...extra }).eq('id', np.id)
    await carica()
  }

  async function aggiornaConcordato(np: NP, field: 'pu_concordato' | 'concordato_da', val: string) {
    const db = supabase as any
    await db.from('nuovi_prezzi').update({ [field]: field === 'pu_concordato' ? parseFloat(val) || null : val || null }).eq('id', np.id)
    await carica()
  }

  async function inserisciInEP(np: NP) {
    if (!window.confirm('Creare voce in Elenco Prezzi con fonte "Concordato DL"?')) return
    const db = supabase as any
    const { data: existing } = await db.from('elenco_prezzi').select('codice').eq('commessa_id', id).like('codice', 'NP/%')
    const nums = (existing || []).map((r: any) => parseInt(r.codice.replace('NP/', ''), 10)).filter((n: number) => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    const codice = np.codice || `NP/${String(next).padStart(3, '0')}`
    const { error } = await db.from('elenco_prezzi').insert({
      commessa_id: id, azienda_id: aziendaId,
      codice, descrizione: np.descrizione,
      um: np.um || '', prezzo_unitario: np.pu_concordato || 0,
      fonte: 'concordato_dl', manuale: true,
    })
    if (error) { alert('Errore EP: ' + error.message); return }
    await db.from('nuovi_prezzi').update({ stato: 'inserito_ep', codice }).eq('id', np.id)
    await carica()
  }

  async function generaVerbale(np: NP) {
    const [{ Document, Page, Text, View, StyleSheet, pdf }] = await Promise.all([import('@react-pdf/renderer')])
    const S = StyleSheet.create({
      page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica' },
      h1: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
      sub: { fontSize: 9, textAlign: 'center', color: '#6b7280', marginBottom: 28 },
      box: { border: '1pt solid #d1d5db', borderRadius: 4, padding: 12, marginBottom: 12 },
      label: { fontSize: 8, color: '#6b7280', marginBottom: 2 },
      val: { fontSize: 11, marginBottom: 0 },
      row: { flexDirection: 'row' as const, gap: 16 },
      col: { flex: 1 },
      firme: { marginTop: 40, flexDirection: 'row' as const, justifyContent: 'space-between' },
      firmaCol: { width: '45%' },
      firmaLine: { borderTop: '1pt solid #374151', paddingTop: 6, fontSize: 9, color: '#374151' },
    })
    const doc = React.createElement(Document, null,
      React.createElement(Page, { size: 'A4', style: S.page },
        React.createElement(Text, { style: S.h1 }, 'VERBALE DI CONCORDAMENTO NUOVO PREZZO'),
        React.createElement(Text, { style: S.sub }, `ai sensi dell'art. 8 D.M. 49/2018`),
        React.createElement(View, { style: S.box },
          React.createElement(Text, { style: S.label }, 'DESCRIZIONE'),
          React.createElement(Text, { style: S.val }, np.descrizione),
        ),
        React.createElement(View, { style: { ...S.box, ...S.row } },
          React.createElement(View, { style: S.col },
            React.createElement(Text, { style: S.label }, 'UNITÀ DI MISURA'),
            React.createElement(Text, { style: S.val }, np.um || '—'),
          ),
          React.createElement(View, { style: S.col },
            React.createElement(Text, { style: S.label }, 'PREZZO UNITARIO PROPOSTO'),
            React.createElement(Text, { style: S.val }, np.pu_proposto != null ? `€ ${fmt(np.pu_proposto)}` : '—'),
          ),
          React.createElement(View, { style: S.col },
            React.createElement(Text, { style: S.label }, 'PREZZO UNITARIO CONCORDATO'),
            React.createElement(Text, { style: S.val }, np.pu_concordato != null ? `€ ${fmt(np.pu_concordato)}` : '—'),
          ),
        ),
        React.createElement(View, { style: { ...S.box, ...S.row } },
          React.createElement(View, { style: S.col },
            React.createElement(Text, { style: S.label }, 'DATA CONCORDAMENTO'),
            React.createElement(Text, { style: S.val }, fmtDate(np.data_concordamento)),
          ),
          React.createElement(View, { style: S.col },
            React.createElement(Text, { style: S.label }, 'CONCORDATO DA'),
            React.createElement(Text, { style: S.val }, np.concordato_da || '—'),
          ),
        ),
        np.note ? React.createElement(View, { style: S.box },
          React.createElement(Text, { style: S.label }, 'NOTE'),
          React.createElement(Text, { style: S.val }, np.note),
        ) : React.createElement(View, null),
        React.createElement(View, { style: S.firme },
          React.createElement(View, { style: S.firmaCol },
            React.createElement(View, { style: S.firmaLine },
              React.createElement(Text, null, 'Direttore dei Lavori'),
            ),
          ),
          React.createElement(View, { style: S.firmaCol },
            React.createElement(View, { style: S.firmaLine },
              React.createElement(Text, null, "L'Impresa"),
            ),
          ),
        ),
      )
    )
    const blob = await pdf(doc as any).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Verbale-NP-${np.codice || np.id.slice(0, 8)}.pdf`
    a.click(); URL.revokeObjectURL(url)
  }

  const totale      = list.length
  const concordati  = list.filter(x => x.stato === 'concordato' || x.stato === 'inserito_ep').length
  const inProposta  = list.filter(x => x.stato === 'proposta' || x.stato === 'in_negoziazione').length

  const NEXT_STATO: Record<string, { value: string; label: string } | null> = {
    proposta:        { value: 'in_negoziazione', label: '→ In negoziazione' },
    in_negoziazione: { value: 'concordato',      label: '✓ Concordato' },
    concordato:      null,
    inserito_ep:     null,
  }

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>

      {/* KPI */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Totale NP',   value: totale,     color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Concordati',  value: concordati,  color: '#059669', bg: '#d1fae5' },
          { label: 'In proposta', value: inProposta,  color: '#d97706', bg: '#fef3c7' },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, background: k.bg, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: k.color, opacity: 0.8 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nuovi Prezzi</h2>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1d4ed8', border: 'none', borderRadius: 8, padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Nuovo prezzo
        </button>
      </div>

      {/* Tabella */}
      {list.length === 0 ? (
        <div style={{ background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', padding: '48px 32px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          Nessun nuovo prezzo — clicca "+ Nuovo prezzo" per aggiungerne uno
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Codice', 'Descrizione', 'UM', 'PU Proposto', 'PU Concordato', 'Stato', 'Collegamento', ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(np => {
                const varRef = varianti.find(v => v.id === np.variante_id)
                const osRef  = ordini.find(o => o.id === np.ordine_servizio_id)
                const next   = NEXT_STATO[np.stato]
                return (
                  <tr key={np.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>{np.codice || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, maxWidth: 280 }}>
                      <div style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{np.descrizione}</div>
                      {np.stato === 'concordato' && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                          <input
                            defaultValue={np.concordato_da || ''}
                            onBlur={e => aggiornaConcordato(np, 'concordato_da', e.target.value)}
                            placeholder="Concordato da..."
                            style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 4, width: 140 }}
                          />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{np.um || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>{np.pu_proposto != null ? `€ ${fmt(np.pu_proposto)}` : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>
                      {np.stato === 'concordato' || np.stato === 'inserito_ep' ? (
                        <input
                          type="number"
                          defaultValue={np.pu_concordato ?? ''}
                          onBlur={e => aggiornaConcordato(np, 'pu_concordato', e.target.value)}
                          style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 4, width: 90, textAlign: 'right' }}
                          disabled={np.stato === 'inserito_ep'}
                        />
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}><StatoBadge stato={np.stato} /></td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280' }}>
                      {varRef && <span>Var. n.{varRef.numero}</span>}
                      {osRef  && <span>OS n.{osRef.numero}</span>}
                      {!varRef && !osRef && '—'}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {next && (
                          <button onClick={() => cambiaStato(np, next.value)} style={{ fontSize: 11, padding: '3px 9px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                            {next.label}
                          </button>
                        )}
                        {np.stato === 'concordato' && (
                          <>
                            <button onClick={() => generaVerbale(np)} title="Genera PDF verbale" style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#374151' }}>
                              <FileText size={11} /> Verbale
                            </button>
                            <button onClick={() => inserisciInEP(np)} style={{ fontSize: 11, padding: '3px 9px', border: '1px solid #059669', borderRadius: 6, background: '#d1fae5', cursor: 'pointer', color: '#065f46', fontWeight: 600 }}>
                              → EP
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SQL reminder */}
      <div style={{ marginTop: 24, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
        ⚠️ Tabella <code>nuovi_prezzi</code> richiesta su Supabase — vedi CLAUDE.md per SQL
      </div>

      {/* Modal nuovo NP */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Nuovo Prezzo</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{err}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Descrizione *</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Unità di misura</label>
                  <input value={fUm} onChange={e => setFUm(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>PU proposto (€)</label>
                  <input type="number" value={fPu} onChange={e => setFPu(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Collega a Variante</label>
                  <select value={fVarId} onChange={e => { setFVarId(e.target.value); if (e.target.value) setFOsId('') }} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                    <option value="">— nessuna —</option>
                    {varianti.map(v => <option key={v.id} value={v.id}>Var. n.{v.numero} — {v.descrizione}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Collega a Ordine Servizio</label>
                  <select value={fOsId} onChange={e => { setFOsId(e.target.value); if (e.target.value) setFVarId('') }} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                    <option value="">— nessuno —</option>
                    {ordini.map(o => <option key={o.id} value={o.id}>OS n.{o.numero} — {o.oggetto}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Note</label>
                <textarea value={fNote} onChange={e => setFNote(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '9px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ padding: '9px 18px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Salvo…' : '💾 Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
