'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

const STATI_DDT = ['ricevuto', 'verificato', 'contestato', 'archiviato']
const STATO_COLOR: Record<string, string> = {
  ricevuto: '#3b82f6', verificato: '#10b981', contestato: '#ef4444', archiviato: '#6b7280',
}

interface VoceDDT { descrizione: string; um: string; quantita: number; prezzo_unitario: number }
interface DDT {
  id: string; codice: string; commessa_id: string
  numero_ddt: string; data_ddt: string; data_ricezione: string
  fornitore_id?: string; fornitore_nome?: string; oda_id?: string
  voci: VoceDDT[]; stato: string; note: string
}
interface Fornitore { id: string; ragione_sociale?: string; nome?: string; cognome?: string }
interface ODA { id: string; numero: string; oggetto: string }

const s = {
  page:  { minHeight: '100%', background: 'var(--bg)', padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12 },
  card:  { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  hdr:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  th:    { padding: '7px 10px', fontSize: 10, fontWeight: 700 as const, color: 'var(--t3)', textTransform: 'uppercase' as const, background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, whiteSpace: 'nowrap' as const },
  td:    { padding: '9px 10px', fontSize: 12, color: 'var(--t2)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' as const },
  inp:   { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, outline: 'none', background: 'var(--panel)', color: 'var(--t1)' },
  lbl:   { fontSize: 11, fontWeight: 600 as const, color: 'var(--t2)', marginBottom: 4, display: 'block' },
  btn:   (c: string): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: c, color: '#fff' }),
}

export default function DDTPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [ddtList, setDdtList] = useState<DDT[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editDdt, setEditDdt] = useState<Partial<DDT> | null>(null)
  const [odaList, setOdaList] = useState<ODA[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [fSearch, setFSearch] = useState('')
  const [fResults, setFResults] = useState<Fornitore[]>([])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: ddt }, { data: oda }] = await Promise.all([
      supabase.from('ddt').select('*').eq('commessa_id', id).order('created_at', { ascending: false }),
      supabase.from('oda').select('id,numero,oggetto').eq('commessa_id', id).neq('stato', 'ANNULLATO'),
    ])
    setDdtList((ddt as DDT[]) || [])
    setOdaList((oda as ODA[]) || [])
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  useEffect(() => {
    if (!fSearch || fSearch.length < 2) { setFResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('professionisti_fornitori')
        .select('id,ragione_sociale,nome,cognome')
        .or(`ragione_sociale.ilike.%${fSearch}%,nome.ilike.%${fSearch}%`)
        .limit(6)
      setFResults((data as Fornitore[]) || [])
    }, 300)
    return () => clearTimeout(t)
  }, [fSearch])

  const fLabel = (f: Fornitore) => f.ragione_sociale || `${f.nome || ''} ${f.cognome || ''}`.trim()

  const scansionaDDT = async (file: File) => {
    setAiLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/ai-ddt', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok && json.dati) {
        const d = json.dati
        setEditDdt({
          stato: 'ricevuto',
          numero_ddt: d.numero_ddt || '',
          data_ddt: d.data_ddt || new Date().toISOString().split('T')[0],
          data_ricezione: new Date().toISOString().split('T')[0],
          fornitore_nome: d.fornitore || '',
          voci: Array.isArray(d.voci) ? d.voci : [],
          note: d.note || '',
        })
        if (d.fornitore) setFSearch(d.fornitore)
        setForm(true)
        showToast('✓ DDT estratto con AI — verifica i dati')
      } else {
        showToast('⚠ ' + (json.errore || 'Errore estrazione AI'))
      }
    } catch { showToast('⚠ Errore di rete') }
    finally { setAiLoading(false) }
  }

  const salva = async () => {
    if (!editDdt?.numero_ddt) { showToast('Inserisci il numero DDT'); return }
    setSaving(true)
    try {
      const codice = 'DDT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const payload = {
        commessa_id: id,
        codice: editDdt.id ? editDdt.codice : codice,
        numero_ddt: editDdt.numero_ddt || '',
        data_ddt: editDdt.data_ddt || null,
        data_ricezione: editDdt.data_ricezione || new Date().toISOString().split('T')[0],
        fornitore_id: editDdt.fornitore_id || null,
        fornitore_nome: editDdt.fornitore_nome || '',
        oda_id: editDdt.oda_id || null,
        voci: editDdt.voci || [],
        stato: editDdt.stato || 'ricevuto',
        note: editDdt.note || '',
      }
      if (editDdt.id) {
        await supabase.from('ddt').update(payload).eq('id', editDdt.id)
        showToast('DDT aggiornato')
      } else {
        await supabase.from('ddt').insert(payload)
        showToast('✓ DDT salvato')
      }
      setForm(false); setEditDdt(null); setFSearch(''); carica()
    } finally { setSaving(false) }
  }

  const cambiaStato = async (ddt: DDT, stato: string) => {
    await supabase.from('ddt').update({ stato }).eq('id', ddt.id)
    showToast(`DDT → ${stato}`); carica()
  }

  const totVoci = (voci: VoceDDT[]) =>
    (voci || []).reduce((s, v) => s + (v.quantita || 0) * (v.prezzo_unitario || 0), 0)

  return (
    <div style={s.page} className="fade-in">
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {[
          ['Totale DDT', String(ddtList.length)],
          ['Da verificare', String(ddtList.filter(d => d.stato === 'ricevuto').length)],
          ['Contestati', String(ddtList.filter(d => d.stato === 'contestato').length)],
          ['Archiviati', String(ddtList.filter(d => d.stato === 'archiviato').length)],
        ].map(([l, v], i) => (
          <div key={i} style={{ ...s.card, padding: '12px 16px' }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>{v}</p>
            <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{l}</p>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.hdr}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Documenti di Trasporto (DDT)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...s.btn('#7c3aed'), padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
              {aiLoading ? '⏳ Scansione AI...' : '📷 Scansiona DDT'}
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) scansionaDDT(f) }} />
            </label>
            <button style={s.btn('var(--accent)')}
              onClick={() => { setEditDdt({ stato: 'ricevuto', voci: [], data_ricezione: new Date().toISOString().split('T')[0] }); setFSearch(''); setForm(true) }}>
              + Nuovo DDT
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
        ) : ddtList.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>🚛</p>
            <p>Nessun DDT — carica una foto con <strong>Scansiona DDT</strong> per importare con AI</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Codice', 'DDT n°', 'Data DDT', 'Ricezione', 'Fornitore', 'ODA', 'Voci / Importo', 'Stato', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {ddtList.map(d => {
                  const oda = odaList.find(o => o.id === d.oda_id)
                  const tot = totVoci(d.voci)
                  return (
                    <tr key={d.id}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)' }}>{d.codice}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{d.numero_ddt || '—'}</td>
                      <td style={{ ...s.td, fontSize: 11 }}>{d.data_ddt || '—'}</td>
                      <td style={{ ...s.td, fontSize: 11 }}>{d.data_ricezione || '—'}</td>
                      <td style={{ ...s.td, fontSize: 11 }}>{d.fornitore_nome || '—'}</td>
                      <td style={{ ...s.td, fontSize: 11 }}>{oda ? oda.numero : '—'}</td>
                      <td style={{ ...s.td, fontSize: 11 }}>
                        {d.voci?.length || 0} voci
                        {tot > 0 && <><br /><span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>{fi(tot)} €</span></>}
                      </td>
                      <td style={s.td}>
                        <select value={d.stato} onChange={e => cambiaStato(d, e.target.value)}
                          style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${STATO_COLOR[d.stato] || '#ccc'}44`, background: `${STATO_COLOR[d.stato] || '#ccc'}22`, color: STATO_COLOR[d.stato] || '#666', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {STATI_DDT.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td style={s.td}>
                        <button style={{ ...s.btn('#3b82f6'), padding: '4px 10px', fontSize: 11 }}
                          onClick={() => { setEditDdt(d); setFSearch(d.fornitore_nome || ''); setForm(true) }}>✎</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal form */}
      {form && editDdt && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setForm(false); setEditDdt(null) } }}>
          <div className="modal-box" style={{ maxWidth: 700, width: '94%', maxHeight: '90vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, position: 'sticky' as const, top: 0, background: 'var(--panel)', zIndex: 1, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>DDT — {editDdt.id ? 'Modifica' : 'Nuovo'}</h3>
              <button onClick={() => { setForm(false); setEditDdt(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Numero DDT *</label>
                  <input style={s.inp} value={editDdt.numero_ddt || ''} onChange={e => setEditDdt({ ...editDdt, numero_ddt: e.target.value })} placeholder="Es. 000123" />
                </div>
                <div>
                  <label style={s.lbl}>Data DDT</label>
                  <input type="date" style={s.inp} value={editDdt.data_ddt || ''} onChange={e => setEditDdt({ ...editDdt, data_ddt: e.target.value })} />
                </div>
                <div>
                  <label style={s.lbl}>Data ricezione</label>
                  <input type="date" style={s.inp} value={editDdt.data_ricezione || ''} onChange={e => setEditDdt({ ...editDdt, data_ricezione: e.target.value })} />
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <label style={s.lbl}>Fornitore</label>
                <input style={s.inp} value={fSearch}
                  onChange={e => { setFSearch(e.target.value); setEditDdt({ ...editDdt, fornitore_nome: e.target.value }) }}
                  placeholder="Cerca fornitore nel database..." />
                {fResults.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 100, width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 180, overflowY: 'auto' as const }}>
                    {fResults.map(f => (
                      <div key={f.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                        onClick={() => { setEditDdt({ ...editDdt, fornitore_id: f.id, fornitore_nome: fLabel(f) }); setFSearch(fLabel(f)); setFResults([]) }}>
                        <span style={{ fontWeight: 600 }}>{fLabel(f)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={s.lbl}>ODA collegata</label>
                <select style={s.inp} value={editDdt.oda_id || ''} onChange={e => setEditDdt({ ...editDdt, oda_id: e.target.value || undefined })}>
                  <option value="">— Nessuna ODA —</option>
                  {odaList.map(o => <option key={o.id} value={o.id}>{o.numero} — {o.oggetto}</option>)}
                </select>
              </div>

              {/* Voci */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={s.lbl}>Voci / Materiali</label>
                  <button style={{ ...s.btn('#14532d'), padding: '3px 10px', fontSize: 11 }}
                    onClick={() => setEditDdt({ ...editDdt, voci: [...(editDdt.voci || []), { descrizione: '', um: 'nr', quantita: 1, prezzo_unitario: 0 }] })}>
                    + Riga
                  </button>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>{['Descrizione', 'U.M.', 'Qtà', 'Prezzo €', ''].map(h => <th key={h} style={{ ...s.th, padding: '5px 8px' }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(editDdt.voci || []).length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center', color: 'var(--t3)', fontStyle: 'italic', fontSize: 11 }}>Nessuna voce — usa "+ Riga" o "Scansiona DDT" per importare</td></tr>
                      ) : (editDdt.voci || []).map((v, i) => (
                        <tr key={i}>
                          <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--border)' }}>
                            <input style={{ ...s.inp, padding: '4px 6px' }} value={v.descrizione}
                              onChange={e => { const vv = [...(editDdt.voci || [])]; vv[i] = { ...v, descrizione: e.target.value }; setEditDdt({ ...editDdt, voci: vv }) }} />
                          </td>
                          <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--border)', width: 56 }}>
                            <input style={{ ...s.inp, padding: '4px 6px' }} value={v.um}
                              onChange={e => { const vv = [...(editDdt.voci || [])]; vv[i] = { ...v, um: e.target.value }; setEditDdt({ ...editDdt, voci: vv }) }} />
                          </td>
                          <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--border)', width: 72 }}>
                            <input type="number" step="0.001" style={{ ...s.inp, padding: '4px 6px', textAlign: 'right' }} value={v.quantita}
                              onChange={e => { const vv = [...(editDdt.voci || [])]; vv[i] = { ...v, quantita: parseFloat(e.target.value) || 0 }; setEditDdt({ ...editDdt, voci: vv }) }} />
                          </td>
                          <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--border)', width: 84 }}>
                            <input type="number" step="0.01" style={{ ...s.inp, padding: '4px 6px', textAlign: 'right' }} value={v.prezzo_unitario}
                              onChange={e => { const vv = [...(editDdt.voci || [])]; vv[i] = { ...v, prezzo_unitario: parseFloat(e.target.value) || 0 }; setEditDdt({ ...editDdt, voci: vv }) }} />
                          </td>
                          <td style={{ padding: '3px 4px', borderBottom: '1px solid var(--border)', width: 28, textAlign: 'center' }}>
                            <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                              onClick={() => { const vv = (editDdt.voci || []).filter((_, j) => j !== i); setEditDdt({ ...editDdt, voci: vv }) }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Stato</label>
                  <select style={s.inp} value={editDdt.stato || 'ricevuto'} onChange={e => setEditDdt({ ...editDdt, stato: e.target.value })}>
                    {STATI_DDT.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.lbl}>Note</label>
                  <input style={s.inp} value={editDdt.note || ''} onChange={e => setEditDdt({ ...editDdt, note: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8, position: 'sticky' as const, bottom: 0, background: 'var(--panel)', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button style={s.btn('#6b7280')} onClick={() => { setForm(false); setEditDdt(null) }}>Annulla</button>
                <button style={s.btn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : 'Salva DDT'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#14532d', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, zIndex: 1000, boxShadow: 'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
