'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi documento ──────────────────────────────────────────────────────────

const TIPI_DOC: { categoria: string; tipi: string[] }[] = [
  { categoria: 'Azienda / Impresa',  tipi: ['DURC','SOA','Visura camerale','Polizza RC','Polizza CAR','Polizza fidejussione','DUVRI'] },
  { categoria: 'Lavoratori',         tipi: ['UNILAV','Idoneità sanitaria','Attestato formazione 16h','Attestato formazione 8h','Attestato formazione 4h','Patente a crediti','Documento identità'] },
  { categoria: 'Cantiere',           tipi: ['DVR','POS','PSC','PIMUS','Notifica preliminare','Piano smaltimento rifiuti'] },
  { categoria: 'Mezzi',              tipi: ['Revisione mezzo','Assicurazione mezzo','Libretto immatricolazione','Omologazione mezzo'] },
]
const SOGGETTO_TIPI = ['azienda','lavoratore','subappaltatore','mezzo']

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface DocSicurezza {
  id: string; commessa_id: string; azienda_id?: string
  tipo: string; numero_documento?: string
  soggetto?: string; soggetto_tipo?: string
  data_emissione?: string; data_scadenza?: string
  note?: string; created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const oggi = new Date(); oggi.setHours(0,0,0,0)
const tra30 = new Date(oggi); tra30.setDate(tra30.getDate() + 30)

function statoDoc(d: DocSicurezza): 'scaduto' | 'in_scadenza' | 'valido' | 'nessuna' {
  if (!d.data_scadenza) return 'nessuna'
  const sc = new Date(d.data_scadenza); sc.setHours(0,0,0,0)
  if (sc < oggi) return 'scaduto'
  if (sc <= tra30) return 'in_scadenza'
  return 'valido'
}

const STATO_CFG = {
  scaduto:     { label: 'Scaduto',       bg: '#fef2f2', border: '#fecaca', color: '#dc2626', dot: '#dc2626' },
  in_scadenza: { label: 'In scadenza',   bg: '#fffbeb', border: '#fde68a', color: '#d97706', dot: '#f59e0b' },
  valido:      { label: 'Valido',        bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', dot: '#22c55e' },
  nessuna:     { label: 'Nessuna scad.', bg: '#f8fafc', border: '#e2e8f0', color: '#64748b', dot: '#94a3b8' },
}

function ggAllaScadenza(d: DocSicurezza): number | null {
  if (!d.data_scadenza) return null
  const sc = new Date(d.data_scadenza); sc.setHours(0,0,0,0)
  return Math.round((sc.getTime() - oggi.getTime()) / 86400000)
}

const fmtData = (s?: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—'

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100%', background: 'var(--bg)', padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12 },
  card: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  hdr:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  th:   { padding: '7px 12px', fontSize: 10, fontWeight: 700 as const, color: 'var(--t3)', textTransform: 'uppercase' as const, background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, whiteSpace: 'nowrap' as const },
  td:   { padding: '10px 12px', fontSize: 12, color: 'var(--t2)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' as const },
  inp:  { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, outline: 'none', background: 'var(--panel)', color: 'var(--t1)' },
  lbl:  { fontSize: 11, fontWeight: 600 as const, color: 'var(--t2)', marginBottom: 4, display: 'block' },
  btn:  (c: string): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: c, color: '#fff' }),
}

// ─── Componente principale ───────────────────────────────────────────────────

export default function SicurezzaPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [docs, setDocs] = useState<DocSicurezza[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editDoc, setEditDoc] = useState<Partial<DocSicurezza> | null>(null)
  const [filtroTipo, setFiltroTipo] = useState('tutti')
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('documenti_sicurezza')
      .select('*')
      .eq('commessa_id', id)
      .order('data_scadenza', { ascending: true })
    setDocs((data as DocSicurezza[]) || [])
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  // ─── AI estrazione ──────────────────────────────────────────────────────────

  const estraiConAI = async (file: File) => {
    setAiLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/ai-sicurezza', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok && json.dati) {
        const d = json.dati
        setEditDoc({
          tipo: d.tipo || '',
          numero_documento: d.numero_documento || '',
          soggetto: d.soggetto || '',
          soggetto_tipo: d.soggetto_tipo || 'azienda',
          data_emissione: d.data_emissione || '',
          data_scadenza: d.data_scadenza || '',
          note: d.note || '',
        })
        setForm(true)
        showToast('✓ Documento riconosciuto con AI — verifica i dati')
      } else {
        showToast('⚠ ' + (json.errore || 'Errore estrazione AI'))
      }
    } catch { showToast('⚠ Errore di rete') }
    finally { setAiLoading(false) }
  }

  // ─── Salva ──────────────────────────────────────────────────────────────────

  const salva = async () => {
    if (!editDoc?.tipo) { showToast('Seleziona il tipo documento'); return }
    setSaving(true)
    try {
      const aziendaId = await getAziendaId()
      const payload = {
        commessa_id: id,
        azienda_id: aziendaId || null,
        tipo: editDoc.tipo,
        numero_documento: editDoc.numero_documento || null,
        soggetto: editDoc.soggetto || null,
        soggetto_tipo: editDoc.soggetto_tipo || null,
        data_emissione: editDoc.data_emissione || null,
        data_scadenza: editDoc.data_scadenza || null,
        note: editDoc.note || null,
      }
      if (editDoc.id) {
        await supabase.from('documenti_sicurezza').update(payload).eq('id', editDoc.id)
        showToast('✓ Documento aggiornato')
      } else {
        await supabase.from('documenti_sicurezza').insert(payload)
        showToast('✓ Documento salvato')
      }
      setForm(false); setEditDoc(null); carica()
    } finally { setSaving(false) }
  }

  const elimina = async (doc: DocSicurezza) => {
    if (!window.confirm(`Eliminare "${doc.tipo}" di ${doc.soggetto || 'N/D'}?`)) return
    await supabase.from('documenti_sicurezza').delete().eq('id', doc.id)
    showToast('Documento eliminato'); carica()
  }

  // ─── Filtri e KPI ───────────────────────────────────────────────────────────

  const docsFiltrati = docs.filter(d => {
    if (filtroTipo !== 'tutti' && d.tipo !== filtroTipo) return false
    if (filtroStato !== 'tutti' && statoDoc(d) !== filtroStato) return false
    return true
  })

  const scaduti    = docs.filter(d => statoDoc(d) === 'scaduto').length
  const inScadenza = docs.filter(d => statoDoc(d) === 'in_scadenza').length
  const validi     = docs.filter(d => statoDoc(d) === 'valido').length
  const alertDocs  = docs.filter(d => statoDoc(d) === 'scaduto' || statoDoc(d) === 'in_scadenza')
    .sort((a, b) => (a.data_scadenza || '').localeCompare(b.data_scadenza || ''))

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={s.page} className="fade-in">

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { l: 'Documenti totali', v: docs.length, bg: 'var(--panel)', border: 'var(--border)', c: 'var(--t1)' },
          { l: 'Validi', v: validi, bg: '#f0fdf4', border: '#bbf7d0', c: '#16a34a' },
          { l: 'In scadenza ≤30gg', v: inScadenza, bg: inScadenza > 0 ? '#fffbeb' : 'var(--panel)', border: inScadenza > 0 ? '#fde68a' : 'var(--border)', c: inScadenza > 0 ? '#d97706' : 'var(--t3)' },
          { l: 'Scaduti', v: scaduti, bg: scaduti > 0 ? '#fef2f2' : 'var(--panel)', border: scaduti > 0 ? '#fecaca' : 'var(--border)', c: scaduti > 0 ? '#dc2626' : 'var(--t3)' },
        ].map(({ l, v, bg, border, c }, i) => (
          <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: c, margin: 0 }}>{v}</p>
            <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{l}</p>
          </div>
        ))}
      </div>

      {/* Alert banner scadenze */}
      {alertDocs.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚠ {alertDocs.length} documento{alertDocs.length > 1 ? 'i' : ''} {scaduti > 0 ? 'scaduto/i o ' : ''}in scadenza
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {alertDocs.slice(0, 8).map(d => {
              const gg = ggAllaScadenza(d)
              const cfg = STATO_CFG[statoDoc(d)]
              return (
                <span key={d.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 600 }}>
                  {d.tipo} {d.soggetto ? `(${d.soggetto})` : ''} — {gg !== null && gg < 0 ? `scaduto ${Math.abs(gg)}gg fa` : gg === 0 ? 'scade oggi' : `${gg}gg`}
                </span>
              )
            })}
            {alertDocs.length > 8 && <span style={{ fontSize: 11, color: '#9ca3af' }}>+{alertDocs.length - 8} altri</span>}
          </div>
        </div>
      )}

      {/* Tabella documenti */}
      <div style={s.card}>
        <div style={s.hdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Documenti di Sicurezza
            </span>
            {/* Filtri */}
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--t2)', cursor: 'pointer' }}>
              <option value="tutti">Tutti i tipi</option>
              {TIPI_DOC.map(g => (
                <optgroup key={g.categoria} label={g.categoria}>
                  {g.tipi.map(t => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
            <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--t2)', cursor: 'pointer' }}>
              <option value="tutti">Tutti gli stati</option>
              <option value="scaduto">Scaduti</option>
              <option value="in_scadenza">In scadenza</option>
              <option value="valido">Validi</option>
              <option value="nessuna">Senza scadenza</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...s.btn('#7c3aed'), padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
              {aiLoading ? '⏳ Analisi AI...' : '🤖 Carica con AI'}
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) estraiConAI(f) }} />
            </label>
            <button style={s.btn('var(--accent)')}
              onClick={() => { setEditDoc({ soggetto_tipo: 'azienda' }); setForm(true) }}>
              + Nuovo documento
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
        ) : docsFiltrati.length === 0 ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--t3)' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🦺</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>Nessun documento di sicurezza</p>
            <p style={{ fontSize: 13 }}>Carica un documento con AI oppure aggiungilo manualmente</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Stato','Tipo','N° Documento','Soggetto','Emissione','Scadenza','Giorni',''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {docsFiltrati.map(d => {
                  const stato = statoDoc(d)
                  const cfg = STATO_CFG[stato]
                  const gg = ggAllaScadenza(d)
                  return (
                    <tr key={d.id} style={{ background: cfg.bg }}
                      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.97)')}
                      onMouseLeave={e => (e.currentTarget.style.filter = '')}>
                      <td style={{ ...s.td, paddingLeft: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: cfg.color }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontWeight: 600, color: 'var(--t1)' }}>{d.tipo}</td>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)' }}>{d.numero_documento || '—'}</td>
                      <td style={{ ...s.td }}>
                        <span style={{ fontWeight: 500 }}>{d.soggetto || '—'}</span>
                        {d.soggetto_tipo && <span style={{ display: 'block', fontSize: 10, color: 'var(--t3)' }}>{d.soggetto_tipo}</span>}
                      </td>
                      <td style={{ ...s.td, fontSize: 11 }}>{fmtData(d.data_emissione)}</td>
                      <td style={{ ...s.td, fontSize: 11, fontWeight: stato !== 'nessuna' ? 600 : 400, color: cfg.color }}>
                        {fmtData(d.data_scadenza)}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700, color: cfg.color, fontVariantNumeric: 'tabular-nums' as const }}>
                        {gg === null ? '—' : gg < 0 ? `−${Math.abs(gg)}` : gg === 0 ? 'oggi' : `+${gg}`}
                      </td>
                      <td style={{ ...s.td, whiteSpace: 'nowrap' as const }}>
                        <button style={{ ...s.btn('#3b82f6'), padding: '3px 10px', fontSize: 11 }}
                          onClick={() => { setEditDoc(d); setForm(true) }}>✎</button>
                        <button style={{ ...s.btn('#ef4444'), padding: '3px 10px', fontSize: 11, marginLeft: 4 }}
                          onClick={() => elimina(d)}>✕</button>
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
      {form && editDoc !== null && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setForm(false); setEditDoc(null) } }}>
          <div className="modal-box" style={{ maxWidth: 600, width: '94%', maxHeight: '90vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, position: 'sticky' as const, top: 0, background: 'var(--panel)', zIndex: 1, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                {editDoc.id ? 'Modifica documento' : 'Nuovo documento di sicurezza'}
              </h3>
              <button onClick={() => { setForm(false); setEditDoc(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Tipo documento */}
              <div>
                <label style={s.lbl}>Tipo documento *</label>
                <select style={s.inp} value={editDoc.tipo || ''} onChange={e => setEditDoc({ ...editDoc, tipo: e.target.value })}>
                  <option value="">— Seleziona tipo —</option>
                  {TIPI_DOC.map(g => (
                    <optgroup key={g.categoria} label={g.categoria}>
                      {g.tipi.map(t => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Numero documento */}
              <div>
                <label style={s.lbl}>Numero / Protocollo</label>
                <input style={s.inp} value={editDoc.numero_documento || ''}
                  onChange={e => setEditDoc({ ...editDoc, numero_documento: e.target.value })}
                  placeholder="Es. INPS-2025-001234" />
              </div>

              {/* Soggetto */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Soggetto (azienda / lavoratore / mezzo)</label>
                  <input style={s.inp} value={editDoc.soggetto || ''}
                    onChange={e => setEditDoc({ ...editDoc, soggetto: e.target.value })}
                    placeholder="Es. Edil Rossi Srl, Mario Rossi, Gru Liebherr LTM-1050" />
                </div>
                <div>
                  <label style={s.lbl}>Tipo soggetto</label>
                  <select style={s.inp} value={editDoc.soggetto_tipo || 'azienda'} onChange={e => setEditDoc({ ...editDoc, soggetto_tipo: e.target.value })}>
                    {SOGGETTO_TIPI.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Data emissione</label>
                  <input type="date" style={s.inp} value={editDoc.data_emissione || ''}
                    onChange={e => setEditDoc({ ...editDoc, data_emissione: e.target.value })} />
                </div>
                <div>
                  <label style={s.lbl}>Data scadenza</label>
                  <input type="date" style={s.inp} value={editDoc.data_scadenza || ''}
                    onChange={e => setEditDoc({ ...editDoc, data_scadenza: e.target.value })} />
                  {editDoc.data_scadenza && (() => {
                    const tmp: DocSicurezza = { ...editDoc, tipo: editDoc.tipo || '', id: editDoc.id || '', commessa_id: id, created_at: '' }
                    const stato = statoDoc(tmp)
                    const gg = ggAllaScadenza(tmp)
                    const cfg = STATO_CFG[stato]
                    return (
                      <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600, marginTop: 3, display: 'block' }}>
                        {stato === 'scaduto' ? `Scaduto ${Math.abs(gg!)}gg fa` : stato === 'in_scadenza' ? `⚠ Scade in ${gg} giorni` : `✓ Valido — ${gg} giorni rimanenti`}
                      </span>
                    )
                  })()}
                </div>
              </div>

              {/* Note */}
              <div>
                <label style={s.lbl}>Note</label>
                <textarea style={{ ...s.inp, resize: 'vertical' as const, minHeight: 60 }} value={editDoc.note || ''}
                  onChange={e => setEditDoc({ ...editDoc, note: e.target.value })} />
              </div>

              {/* Carica con AI direttamente dal form */}
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--t3)', flex: 1 }}>Hai il documento? Caricalo e l&apos;AI compilerà i campi automaticamente.</span>
                <label style={{ ...s.btn('#7c3aed'), padding: '6px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 11, whiteSpace: 'nowrap' as const }}>
                  {aiLoading ? '⏳...' : '🤖 Carica file'}
                  <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) estraiConAI(f) }} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)', position: 'sticky' as const, bottom: 0, background: 'var(--panel)' }}>
                <button style={s.btn('#6b7280')} onClick={() => { setForm(false); setEditDoc(null) }}>Annulla</button>
                <button style={s.btn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : 'Salva documento'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#14532d', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, zIndex: 1000, boxShadow: 'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
