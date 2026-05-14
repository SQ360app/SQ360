'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

const STATI_FATTURA = ['ricevuta', 'verificata', 'approvata', 'pagata', 'contestata']
const STATO_COLOR: Record<string, string> = {
  ricevuta: '#3b82f6', verificata: '#8b5cf6', approvata: '#f97316', pagata: '#10b981', contestata: '#ef4444',
}

interface Fattura {
  id: string; codice: string; commessa_id: string
  numero_fattura: string; data_fattura: string; data_scadenza: string
  fornitore_id?: string; fornitore_nome?: string; oda_id?: string
  imponibile: number; iva_pct: number; importo_iva: number; totale: number
  stato: string; note: string
}
interface Fornitore { id: string; ragione_sociale?: string; nome?: string; cognome?: string }
interface ODA { id: string; numero: string; oggetto: string }

const s = {
  page: { minHeight: '100%', background: 'var(--bg)', padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12 },
  card: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  hdr:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  th:   { padding: '7px 10px', fontSize: 10, fontWeight: 700 as const, color: 'var(--t3)', textTransform: 'uppercase' as const, background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, whiteSpace: 'nowrap' as const },
  td:   { padding: '9px 10px', fontSize: 12, color: 'var(--t2)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' as const },
  inp:  { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, outline: 'none', background: 'var(--panel)', color: 'var(--t1)' },
  lbl:  { fontSize: 11, fontWeight: 600 as const, color: 'var(--t2)', marginBottom: 4, display: 'block' },
  btn:  (c: string): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: c, color: '#fff' }),
}

export default function FatturePage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [fatture, setFatture] = useState<Fattura[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editFattura, setEditFattura] = useState<Partial<Fattura> | null>(null)
  const [odaList, setOdaList] = useState<ODA[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [fSearch, setFSearch] = useState('')
  const [fResults, setFResults] = useState<Fornitore[]>([])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: fp }, { data: oda }] = await Promise.all([
      supabase.from('fatture_passive').select('*').eq('commessa_id', id).order('data_fattura', { ascending: false }),
      supabase.from('oda').select('id,numero,oggetto').eq('commessa_id', id).neq('stato', 'ANNULLATO'),
    ])
    setFatture((fp as Fattura[]) || [])
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

  const estraiDaFile = async (file: File) => {
    setAiLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/ai-fattura', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok && json.dati) {
        const d = json.dati
        const imponibile = Number(d.imponibile) || 0
        const ivaPct = Number(d.iva_pct) || 22
        const importoIva = Number(d.importo_iva) || imponibile * ivaPct / 100
        setEditFattura({
          stato: 'ricevuta',
          numero_fattura: d.numero_fattura || '',
          data_fattura: d.data_fattura || new Date().toISOString().split('T')[0],
          data_scadenza: d.data_scadenza || '',
          fornitore_nome: d.fornitore || '',
          imponibile, iva_pct: ivaPct, importo_iva: importoIva,
          totale: Number(d.totale) || imponibile + importoIva,
          note: d.note || '',
        })
        if (d.fornitore) setFSearch(d.fornitore)
        setForm(true)
        showToast('✓ Fattura estratta con AI — verifica i dati')
      } else {
        showToast('⚠ ' + (json.errore || 'Errore estrazione AI'))
      }
    } catch { showToast('⚠ Errore di rete') }
    finally { setAiLoading(false) }
  }

  const salva = async () => {
    if (!editFattura?.numero_fattura) { showToast('Inserisci il numero fattura'); return }
    setSaving(true)
    try {
      const codice = 'FP-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      const imponibile = editFattura.imponibile || 0
      const ivaPct = editFattura.iva_pct ?? 22
      const importoIva = imponibile * ivaPct / 100
      const payload = {
        commessa_id: id,
        azienda_id: await getAziendaId() || null,
        codice: editFattura.id ? editFattura.codice : codice,
        numero_fattura: editFattura.numero_fattura || '',
        data_fattura: editFattura.data_fattura || null,
        data_scadenza: editFattura.data_scadenza || null,
        fornitore_id: editFattura.fornitore_id || null,
        fornitore_nome: editFattura.fornitore_nome || '',
        oda_id: editFattura.oda_id || null,
        imponibile, iva_pct: ivaPct, importo_iva: importoIva,
        totale: imponibile + importoIva,
        stato: editFattura.stato || 'ricevuta',
        note: editFattura.note || '',
      }
      if (editFattura.id) {
        await supabase.from('fatture_passive').update(payload).eq('id', editFattura.id)
        showToast('Fattura aggiornata')
      } else {
        await supabase.from('fatture_passive').insert(payload)
        showToast('✓ Fattura registrata')
      }
      setForm(false); setEditFattura(null); setFSearch(''); carica()
    } finally { setSaving(false) }
  }

  const cambiaStato = async (f: Fattura, stato: string) => {
    await supabase.from('fatture_passive').update({ stato }).eq('id', f.id)
    showToast(`Fattura → ${stato}`); carica()
  }

  const oggi = new Date()
  const totDaPagare = fatture.filter(f => !['pagata', 'contestata'].includes(f.stato)).reduce((s, f) => s + (f.totale || 0), 0)
  const totPagato = fatture.filter(f => f.stato === 'pagata').reduce((s, f) => s + (f.totale || 0), 0)
  const totScadute = fatture.filter(f => f.stato !== 'pagata' && f.data_scadenza && new Date(f.data_scadenza) < oggi).length

  const imponibile = editFattura?.imponibile || 0
  const ivaPct = editFattura?.iva_pct ?? 22
  const totaleCalcolato = imponibile * (1 + ivaPct / 100)

  return (
    <div style={s.page} className="fade-in">
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {[
          ['Fatture totali', String(fatture.length), false],
          ['Da pagare', fi(totDaPagare) + ' €', false],
          ['Pagate', fi(totPagato) + ' €', false],
          ['Scadute', String(totScadute), totScadute > 0],
        ].map(([l, v, warn], i) => (
          <div key={i} style={{ ...s.card, padding: '12px 16px', background: warn ? '#fef2f2' : undefined }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: warn ? '#dc2626' : 'var(--t1)' }}>{v as string}</p>
            <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{l as string}</p>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.hdr}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Fatture Passive
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...s.btn('#7c3aed'), padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
              {aiLoading ? '⏳ Estrazione AI...' : '📄 Estrai da file'}
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) estraiDaFile(f) }} />
            </label>
            <button style={s.btn('var(--accent)')}
              onClick={() => { setEditFattura({ stato: 'ricevuta', iva_pct: 22 }); setFSearch(''); setForm(true) }}>
              + Nuova Fattura
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
        ) : fatture.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>🧾</p>
            <p>Nessuna fattura — carica un PDF/foto con <strong>Estrai da file</strong> per importare con AI</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['N° Fattura', 'Data', 'Scadenza', 'Fornitore', 'ODA', 'Imponibile', 'IVA%', 'Totale', 'Stato', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {fatture.map(f => {
                  const oda = odaList.find(o => o.id === f.oda_id)
                  const scaduta = f.stato !== 'pagata' && f.data_scadenza && new Date(f.data_scadenza) < oggi
                  return (
                    <tr key={f.id}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ ...s.td, fontWeight: 600, fontFamily: 'monospace', fontSize: 11 }}>{f.numero_fattura}</td>
                      <td style={{ ...s.td, fontSize: 11 }}>{f.data_fattura || '—'}</td>
                      <td style={{ ...s.td, fontSize: 11, color: scaduta ? '#dc2626' : undefined, fontWeight: scaduta ? 700 : undefined }}>
                        {f.data_scadenza || '—'}{scaduta ? ' ⚠' : ''}
                      </td>
                      <td style={{ ...s.td, fontSize: 11 }}>{f.fornitore_nome || '—'}</td>
                      <td style={{ ...s.td, fontSize: 11 }}>{oda ? oda.numero : '—'}</td>
                      <td style={{ ...s.td, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }}>{fi(f.imponibile)}</td>
                      <td style={{ ...s.td, textAlign: 'center' as const, fontSize: 11 }}>{f.iva_pct}%</td>
                      <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700, fontVariantNumeric: 'tabular-nums' as const }}>{fi(f.totale)}</td>
                      <td style={s.td}>
                        <select value={f.stato} onChange={e => cambiaStato(f, e.target.value)}
                          style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${STATO_COLOR[f.stato] || '#ccc'}44`, background: `${STATO_COLOR[f.stato] || '#ccc'}22`, color: STATO_COLOR[f.stato] || '#666', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {STATI_FATTURA.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td style={s.td}>
                        <button style={{ ...s.btn('#3b82f6'), padding: '4px 10px', fontSize: 11 }}
                          onClick={() => { setEditFattura(f); setFSearch(f.fornitore_nome || ''); setForm(true) }}>✎</button>
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
      {form && editFattura && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setForm(false); setEditFattura(null) } }}>
          <div className="modal-box" style={{ maxWidth: 600, width: '94%', maxHeight: '90vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, position: 'sticky' as const, top: 0, background: 'var(--panel)', zIndex: 1, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Fattura Passiva — {editFattura.id ? 'Modifica' : 'Nuova'}</h3>
              <button onClick={() => { setForm(false); setEditFattura(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Numero fattura *</label>
                  <input style={s.inp} value={editFattura.numero_fattura || ''} onChange={e => setEditFattura({ ...editFattura, numero_fattura: e.target.value })} placeholder="Es. 2025/0042" />
                </div>
                <div>
                  <label style={s.lbl}>Data fattura</label>
                  <input type="date" style={s.inp} value={editFattura.data_fattura || ''} onChange={e => setEditFattura({ ...editFattura, data_fattura: e.target.value })} />
                </div>
                <div>
                  <label style={s.lbl}>Scadenza</label>
                  <input type="date" style={s.inp} value={editFattura.data_scadenza || ''} onChange={e => setEditFattura({ ...editFattura, data_scadenza: e.target.value })} />
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <label style={s.lbl}>Fornitore</label>
                <input style={s.inp} value={fSearch}
                  onChange={e => { setFSearch(e.target.value); setEditFattura({ ...editFattura, fornitore_nome: e.target.value }) }}
                  placeholder="Cerca fornitore nel database..." />
                {fResults.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 100, width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 180, overflowY: 'auto' as const }}>
                    {fResults.map(f => (
                      <div key={f.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                        onClick={() => { setEditFattura({ ...editFattura, fornitore_id: f.id, fornitore_nome: fLabel(f) }); setFSearch(fLabel(f)); setFResults([]) }}>
                        <span style={{ fontWeight: 600 }}>{fLabel(f)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={s.lbl}>ODA collegata</label>
                <select style={s.inp} value={editFattura.oda_id || ''} onChange={e => setEditFattura({ ...editFattura, oda_id: e.target.value || undefined })}>
                  <option value="">— Nessuna ODA —</option>
                  {odaList.map(o => <option key={o.id} value={o.id}>{o.numero} — {o.oggetto}</option>)}
                </select>
              </div>

              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Importi</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Imponibile €</label>
                  <input type="number" step="0.01" style={{ ...s.inp, textAlign: 'right' as const }} value={editFattura.imponibile || ''} onChange={e => setEditFattura({ ...editFattura, imponibile: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={s.lbl}>IVA %</label>
                  <select style={s.inp} value={editFattura.iva_pct ?? 22} onChange={e => setEditFattura({ ...editFattura, iva_pct: parseInt(e.target.value) })}>
                    {[0, 4, 10, 22].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.lbl}>Totale (calcolato)</label>
                  <div style={{ ...s.inp, background: 'var(--bg)', textAlign: 'right' as const, color: 'var(--accent)', fontWeight: 700, lineHeight: '1.6' }}>
                    {fi(totaleCalcolato)} €
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Stato</label>
                  <select style={s.inp} value={editFattura.stato || 'ricevuta'} onChange={e => setEditFattura({ ...editFattura, stato: e.target.value })}>
                    {STATI_FATTURA.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.lbl}>Note</label>
                  <input style={s.inp} value={editFattura.note || ''} onChange={e => setEditFattura({ ...editFattura, note: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8, position: 'sticky' as const, bottom: 0, background: 'var(--panel)', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button style={s.btn('#6b7280')} onClick={() => { setForm(false); setEditFattura(null) }}>Annulla</button>
                <button style={s.btn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : 'Salva Fattura'}</button>
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
