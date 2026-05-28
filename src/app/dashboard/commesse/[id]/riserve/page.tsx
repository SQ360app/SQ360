'use client'
import React, { useState, useEffect, use } from 'react'
import { supabase, getAziendaId } from '@/lib/supabase'
import { Plus, Loader2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('it-IT') : '—'
const daysLeft = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null

const STATI = [
  { value: 'iscritta',      label: 'Iscritta',      color: '#6b7280', bg: '#f3f4f6' },
  { value: 'in_discussione',label: 'In discussione', color: '#d97706', bg: '#fef3c7' },
  { value: 'accettata',     label: 'Accettata',      color: '#059669', bg: '#d1fae5' },
  { value: 'respinta',      label: 'Respinta',       color: '#dc2626', bg: '#fef2f2' },
  { value: 'arbitrato',     label: 'Arbitrato',      color: '#7c3aed', bg: '#f5f3ff' },
]

const NEXT_STATO: Record<string, { value: string; label: string }[]> = {
  iscritta:       [{ value: 'in_discussione', label: '→ In discussione' }],
  in_discussione: [{ value: 'accettata', label: '✓ Accettata' }, { value: 'respinta', label: '✕ Respinta' }, { value: 'arbitrato', label: '⚖ Arbitrato' }],
  accettata:      [],
  respinta:       [{ value: 'arbitrato', label: '⚖ Arbitrato' }],
  arbitrato:      [],
}

interface Riserva {
  id: string; commessa_id: string; azienda_id: string
  numero?: number; descrizione: string; importo_richiesto?: number
  importo_riconosciuto?: number; riferimento_normativo?: string
  iscrizione_su: string; sal_numero?: number; ordine_servizio_id?: string
  stato: string; data_iscrizione?: string; data_scadenza_risposta?: string
  data_chiusura?: string; note?: string
}
interface OS { id: string; numero: number; oggetto: string }

function StatoBadge({ stato }: { stato: string }) {
  const s = STATI.find(x => x.value === stato) || STATI[0]
  return <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
}

export default function RiservePage({ params: pp }: { params: Promise<{ id: string }> }) {
  const { id } = use(pp)
  const [list,      setList]      = useState<Riserva[]>([])
  const [ordini,    setOrdini]    = useState<OS[]>([])
  const [loading,   setLoading]   = useState(true)
  const [aziendaId, setAziendaId] = useState('')
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  // form
  const [fDesc,     setFDesc]     = useState('')
  const [fImporto,  setFImporto]  = useState('')
  const [fNorm,     setFNorm]     = useState('')
  const [fSu,       setFSu]       = useState<'sal' | 'os'>('sal')
  const [fSalNum,   setFSalNum]   = useState('')
  const [fOsId,     setFOsId]     = useState('')
  const [fScadenza, setFScadenza] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]
  })
  const [fNote, setFNote] = useState('')

  async function carica() {
    setLoading(true)
    const db = supabase as any
    const [rRes, osRes] = await Promise.all([
      db.from('riserve').select('*').eq('commessa_id', id).order('numero', { ascending: true }),
      db.from('ordini_servizio').select('id,numero,oggetto').eq('commessa_id', id).order('numero'),
    ])
    setList(rRes.data || [])
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
    const { data: maxRes } = await db.from('riserve').select('numero').eq('commessa_id', id).order('numero', { ascending: false }).limit(1)
    const numero = ((maxRes?.[0]?.numero) || 0) + 1
    const { error } = await db.from('riserve').insert({
      commessa_id: id, azienda_id: aziendaId, numero,
      descrizione: fDesc.trim(),
      importo_richiesto: fImporto ? parseFloat(fImporto) : null,
      riferimento_normativo: fNorm.trim() || null,
      iscrizione_su: fSu,
      sal_numero: fSu === 'sal' && fSalNum ? parseInt(fSalNum) : null,
      ordine_servizio_id: fSu === 'os' && fOsId ? fOsId : null,
      data_scadenza_risposta: fScadenza || null,
      note: fNote.trim() || null,
      stato: 'iscritta',
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setModalOpen(false)
    setFDesc(''); setFImporto(''); setFNorm(''); setFSu('sal'); setFSalNum(''); setFOsId(''); setFNote('')
    const d = new Date(); d.setDate(d.getDate() + 30); setFScadenza(d.toISOString().split('T')[0])
    await carica()
  }

  async function cambiaStato(r: Riserva, nuovoStato: string) {
    const db = supabase as any
    const extra: Record<string, unknown> = {}
    if (['accettata', 'respinta', 'arbitrato'].includes(nuovoStato)) extra.data_chiusura = new Date().toISOString().split('T')[0]
    await db.from('riserve').update({ stato: nuovoStato, ...extra }).eq('id', r.id)
    await carica()
  }

  async function aggiornaRiconosciuto(r: Riserva, val: string) {
    const db = supabase as any
    await db.from('riserve').update({ importo_riconosciuto: parseFloat(val) || null }).eq('id', r.id)
    await carica()
  }

  const totaleRiserve      = list.length
  const importoTotale      = list.reduce((s, r) => s + (r.importo_richiesto || 0), 0)
  const importoRiconosciuto = list.reduce((s, r) => s + (r.importo_riconosciuto || 0), 0)
  const inScadenza30       = list.filter(r => { const g = daysLeft(r.data_scadenza_risposta); return g != null && g >= 0 && g <= 30 && r.stato === 'iscritta' }).length
  const urgenti7           = list.filter(r => { const g = daysLeft(r.data_scadenza_risposta); return g != null && g >= 0 && g <= 7 && r.stato === 'iscritta' })

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000 }}>

      {/* Alert urgenti */}
      {urgenti7.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>Scadenza risposta entro 7 giorni</div>
            <div style={{ fontSize: 12, color: '#991b1b', marginTop: 2 }}>
              {urgenti7.map(r => `Riserva n.${r.numero}: scade ${fmtDate(r.data_scadenza_risposta)}`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Totale riserve',       value: totaleRiserve,                        color: '#1d4ed8', bg: '#eff6ff', fmt: false },
          { label: 'Importo richiesto',    value: importoTotale,                        color: '#dc2626', bg: '#fef2f2', fmt: true  },
          { label: 'Importo riconosciuto', value: importoRiconosciuto,                  color: '#059669', bg: '#d1fae5', fmt: true  },
          { label: 'In scadenza ≤30gg',    value: inScadenza30,                         color: '#d97706', bg: '#fef3c7', fmt: false },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, background: k.bg, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: k.fmt ? 16 : 22, fontWeight: 800, color: k.color }}>
              {k.fmt ? `€ ${fmt(k.value as number)}` : k.value}
            </div>
            <div style={{ fontSize: 11, color: k.color, opacity: 0.8 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Riserve</h2>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#dc2626', border: 'none', borderRadius: 8, padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Iscivi riserva
        </button>
      </div>

      {/* Lista accordion */}
      {list.length === 0 ? (
        <div style={{ background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', padding: '48px 32px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          Nessuna riserva iscritta — clicca "+ Iscivi riserva" per aggiungerne una
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(r => {
            const isOpen  = expanded === r.id
            const giorni  = daysLeft(r.data_scadenza_risposta)
            const urgente = giorni != null && giorni <= 7 && giorni >= 0 && r.stato === 'iscritta'
            const osRef   = ordini.find(o => o.id === r.ordine_servizio_id)
            const nextArr = NEXT_STATO[r.stato] || []
            return (
              <div key={r.id} style={{ border: `1px solid ${urgente ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
                {/* Riga collassata */}
                <div
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
                >
                  {isOpen ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
                  <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f3f4f6', padding: '1px 7px', borderRadius: 4, color: '#6b7280', flexShrink: 0 }}>
                    n.{r.numero}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descrizione}</span>
                  {r.importo_richiesto != null && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>€ {fmt(r.importo_richiesto)}</span>
                  )}
                  {urgente && (
                    <span style={{ fontSize: 10, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '1px 7px', flexShrink: 0 }}>
                      ⚠ {giorni}gg
                    </span>
                  )}
                  <StatoBadge stato={r.stato} />
                  {r.data_scadenza_risposta && r.stato === 'iscritta' && (
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>Scad. {fmtDate(r.data_scadenza_risposta)}</span>
                  )}
                </div>

                {/* Dettaglio espanso */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '16px 20px', background: '#fafafa' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Data iscrizione</div>
                        <div style={{ fontSize: 13 }}>{fmtDate(r.data_iscrizione)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Iscritta su</div>
                        <div style={{ fontSize: 13 }}>
                          {r.iscrizione_su === 'sal' ? `SAL n.${r.sal_numero || '?'}` : osRef ? `OS n.${osRef.numero} — ${osRef.oggetto}` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Rif. normativo</div>
                        <div style={{ fontSize: 13 }}>{r.riferimento_normativo || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Importo richiesto</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{r.importo_richiesto != null ? `€ ${fmt(r.importo_richiesto)}` : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Importo riconosciuto</div>
                        <input
                          type="number"
                          defaultValue={r.importo_riconosciuto ?? ''}
                          onBlur={e => aggiornaRiconosciuto(r, e.target.value)}
                          placeholder="€ 0,00"
                          disabled={r.stato === 'respinta'}
                          style={{ fontSize: 13, padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: 6, width: 130, color: '#059669', fontWeight: 700 }}
                        />
                      </div>
                      {r.data_chiusura && (
                        <div>
                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Data chiusura</div>
                          <div style={{ fontSize: 13 }}>{fmtDate(r.data_chiusura)}</div>
                        </div>
                      )}
                    </div>
                    {r.note && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, fontStyle: 'italic' }}>{r.note}</div>
                    )}
                    {nextArr.length > 0 && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {nextArr.map(nx => (
                          <button key={nx.value} onClick={() => cambiaStato(r, nx.value)} style={{ fontSize: 12, padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
                            {nx.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* SQL reminder */}
      <div style={{ marginTop: 24, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
        ⚠️ Tabella <code>riserve</code> richiesta su Supabase — vedi CLAUDE.md per SQL
      </div>

      {/* Modal nuova riserva */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Iscivi Riserva</h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{err}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Descrizione *</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Importo richiesto (€)</label>
                  <input type="number" value={fImporto} onChange={e => setFImporto(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Scadenza risposta</label>
                  <input type="date" value={fScadenza} onChange={e => setFScadenza(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Riferimento normativo</label>
                <input value={fNorm} onChange={e => setFNorm(e.target.value)} placeholder="es. Art. 205 D.Lgs. 50/2016" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Iscritta su</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {(['sal', 'os'] as const).map(v => (
                    <button key={v} onClick={() => setFSu(v)} style={{ flex: 1, padding: '7px', border: `1px solid ${fSu === v ? '#1d4ed8' : '#d1d5db'}`, borderRadius: 8, background: fSu === v ? '#eff6ff' : '#fff', color: fSu === v ? '#1d4ed8' : '#374151', fontSize: 12, fontWeight: fSu === v ? 600 : 400, cursor: 'pointer' }}>
                      {v === 'sal' ? 'SAL' : 'Ordine di Servizio'}
                    </button>
                  ))}
                </div>
                {fSu === 'sal' && (
                  <input type="number" value={fSalNum} onChange={e => setFSalNum(e.target.value)} placeholder="Numero SAL" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                )}
                {fSu === 'os' && (
                  <select value={fOsId} onChange={e => setFOsId(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                    <option value="">— seleziona OS —</option>
                    {ordini.map(o => <option key={o.id} value={o.id}>OS n.{o.numero} — {o.oggetto}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 5 }}>Note</label>
                <textarea value={fNote} onChange={e => setFNote(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '9px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ padding: '9px 18px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Salvo…' : '📝 Iscivi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
