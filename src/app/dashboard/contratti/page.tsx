'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, X, CheckCircle, AlertCircle, AlertTriangle, FileText } from 'lucide-react'
import { supabase, getAziendaId } from '@/lib/supabase'

type TipoContratto = 'SUBAPPALTO' | 'SUBAFFIDAMENTO' | 'NOLO' | 'FORNITURA'
type StatoContratto = 'BOZZA' | 'FIRMATO' | 'IN_ESECUZIONE' | 'SOSPESO' | 'CONCLUSO' | 'RESCISSO'

interface VoceContratto {
  id: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
}

interface Contratto {
  id: string
  codice: string
  tipo: TipoContratto
  commessa_id: string
  fornitore_id: string
  oggetto: string
  importo_contrattuale: number
  importo_contabilizzato: number
  importo_pagato: number
  ritenuta_garanzia_pct: number
  ritenuta_acconto_pct: number
  data_stipula: string
  data_inizio: string
  data_fine: string
  stato: StatoContratto
  categoria_soa: string
  cig_subappalto: string
  autorizzazione_sa: boolean
  data_autorizzazione: string
  sal_emessi: number
  note: string
  voci_contratto?: VoceContratto[]
}

const TIPO_META: Record<TipoContratto, { label: string; color: string }> = {
  SUBAPPALTO: { label: 'Subappalto', color: '#8b5cf6' },
  SUBAFFIDAMENTO: { label: 'Subaffidamento', color: '#3b82f6' },
  NOLO: { label: 'Nolo a caldo', color: '#f59e0b' },
  FORNITURA: { label: 'Fornitura', color: '#10b981' },
}

const STATO_META: Record<StatoContratto, { label: string; color: string }> = {
  BOZZA: { label: 'Bozza', color: '#6b7280' },
  FIRMATO: { label: 'Firmato', color: '#3b82f6' },
  IN_ESECUZIONE: { label: 'In esecuzione', color: '#10b981' },
  SOSPESO: { label: 'Sospeso', color: '#f59e0b' },
  CONCLUSO: { label: 'Concluso', color: '#10b981' },
  RESCISSO: { label: 'Rescisso', color: '#ef4444' },
}

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const FORM_VUOTO = {
  tipo: 'SUBAPPALTO' as TipoContratto,
  oggetto: '', importo_contrattuale: 0,
  ritenuta_garanzia_pct: 5, ritenuta_acconto_pct: 4,
  data_stipula: '', data_inizio: '', data_fine: '',
  stato: 'BOZZA' as StatoContratto,
  categoria_soa: '', cig_subappalto: '',
  autorizzazione_sa: false, note: '',
}

export default function ContrattiPage() {
  const [contratti, setContratti] = useState<Contratto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoContratto | 'TUTTI'>('TUTTI')
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contratti')
      .select('*, voci_contratto(*)')
      .order('created_at', { ascending: false })
    if (!error && data) setContratti(data)
    setLoading(false)
  }

  function setF(field: string, val: unknown) { setForm(prev => ({ ...prev, [field]: val })) }

  const filtered = contratti.filter(c => {
    const matchSearch = !search || c.codice?.toLowerCase().includes(search.toLowerCase()) || c.oggetto?.toLowerCase().includes(search.toLowerCase())
    const matchTipo = filtroTipo === 'TUTTI' || c.tipo === filtroTipo
    return matchSearch && matchTipo
  })

  const contrattoSelezionato = contratti.find(c => c.id === selected) ?? null
  const alertSA = contratti.filter(c => c.tipo === 'SUBAPPALTO' && !c.autorizzazione_sa && c.stato !== 'BOZZA' && c.stato !== 'CONCLUSO')
  const totaleContrattuale = filtered.reduce((s, c) => s + (c.importo_contrattuale || 0), 0)
  const totaleContabilizzato = filtered.reduce((s, c) => s + (c.importo_contabilizzato || 0), 0)
  const totalePagato = filtered.reduce((s, c) => s + (c.importo_pagato || 0), 0)

  async function salva() {
    if (!form.oggetto.trim()) { setErrore('Oggetto obbligatorio'); return }
    setSaving(true); setErrore('')
    const aziendaId = await getAziendaId()
    const anno = new Date().getFullYear()
    const codice = `CTR-${anno}-${String(contratti.length + 1).padStart(3, '0')}`
    const { data, error } = await supabase
      .from('contratti')
      .insert([{ ...form, codice, azienda_id: aziendaId, importo_contabilizzato: 0, importo_pagato: 0, sal_emessi: 0 }])
      .select().single()
    if (error) { setErrore('Errore: ' + error.message); setSaving(false); return }
    setContratti(prev => [data, ...prev])
    setSaving(false); setShowForm(false); setForm({ ...FORM_VUOTO })
  }

  const inp = { width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }
  const lbl = { fontSize: 10, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Contratti Subappalto</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>D.Lgs. 36/2023 · Subappalto, Subaffidamento, Nolo, Fornitura</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={16} /> Nuovo Contratto
        </button>
      </div>

      {alertSA.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={15} color="#ef4444" />
          <span style={{ fontSize: 13, color: '#fca5a5' }}><strong>{alertSA.length} subappalti</strong> senza autorizzazione SA: {alertSA.map(c => c.codice).join(', ')}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Totale contrattuale', val: `€ ${fmt(totaleContrattuale)}`, color: '#3b82f6' },
          { label: 'Contabilizzato', val: `€ ${fmt(totaleContabilizzato)}`, color: '#f59e0b' },
          { label: 'Pagato', val: `€ ${fmt(totalePagato)}`, color: '#10b981' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca codice, oggetto..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroTipo('TUTTI')} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroTipo === 'TUTTI' ? 'var(--accent)' : 'var(--panel)', color: filtroTipo === 'TUTTI' ? 'white' : 'var(--t2)' }}>Tutti</button>
          {(Object.keys(TIPO_META) as TipoContratto[]).map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroTipo === t ? TIPO_META[t].color : 'var(--panel)', color: filtroTipo === t ? 'white' : 'var(--t2)' }}>{TIPO_META[t].label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>Caricamento dal database...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: contrattoSelezionato ? '420px 1fr' : '1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => {
              const tm = TIPO_META[c.tipo]
              const sm = STATO_META[c.stato]
              const isSelected = selected === c.id
              const avanzamento = c.importo_contrattuale > 0 ? (c.importo_contabilizzato / c.importo_contrattuale) * 100 : 0
              return (
                <div key={c.id} onClick={() => setSelected(c.id === selected ? null : c.id)}
                  style={{ background: 'var(--panel)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>{c.codice}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: tm.color, background: `${tm.color}15`, border: `1px solid ${tm.color}30`, borderRadius: 5, padding: '2px 7px' }}>{tm.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: sm.color, background: `${sm.color}15`, border: `1px solid ${sm.color}30`, borderRadius: 5, padding: '2px 7px' }}>{sm.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 2 }}>{c.oggetto?.slice(0, 80)}{(c.oggetto?.length || 0) > 80 ? '...' : ''}</div>
                      {c.tipo === 'SUBAPPALTO' && !c.autorizzazione_sa && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠ No autoriz. SA</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(c.importo_contrattuale || 0)}</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>Contabilizzato</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: tm.color }}>{avanzamento.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(avanzamento, 100)}%`, height: '100%', background: tm.color, borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)' }}>
                    <span>Stipula: {c.data_stipula || '—'}</span>
                    <span>Fine: {c.data_fine || '—'}</span>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && !loading && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12 }}>
                Nessun contratto. Clicca &quot;Nuovo Contratto&quot; per crearne uno.
              </div>
            )}
          </div>

          {contrattoSelezionato && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', marginBottom: 3 }}>{contrattoSelezionato.codice}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{TIPO_META[contrattoSelezionato.tipo].label}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}><X size={14} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Oggetto</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{contrattoSelezionato.oggetto}</div>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Quadro Economico</div>
                  {[
                    { label: 'Importo contrattuale', val: contrattoSelezionato.importo_contrattuale || 0, color: 'var(--t1)' },
                    { label: 'Contabilizzato (SAL)', val: contrattoSelezionato.importo_contabilizzato || 0, color: '#f59e0b' },
                    { label: `Ritenuta garanzia (${contrattoSelezionato.ritenuta_garanzia_pct}%)`, val: -((contrattoSelezionato.importo_contabilizzato || 0) * (contrattoSelezionato.ritenuta_garanzia_pct || 0) / 100), color: '#f59e0b' },
                    { label: 'Pagato', val: contrattoSelezionato.importo_pagato || 0, color: '#10b981' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: r.color }}>{r.val < 0 ? '− ' : ''}€ {fmt(Math.abs(r.val))}</span>
                    </div>
                  ))}
                </div>
                {contrattoSelezionato.tipo === 'SUBAPPALTO' && (
                  <div style={{ background: contrattoSelezionato.autorizzazione_sa ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${contrattoSelezionato.autorizzazione_sa ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Compliance D.Lgs. 36/2023</div>
                    {[
                      { label: 'Autorizzazione SA', ok: contrattoSelezionato.autorizzazione_sa },
                      { label: 'CIG Subappalto', ok: !!contrattoSelezionato.cig_subappalto },
                      { label: 'Categoria SOA', ok: !!contrattoSelezionato.categoria_soa },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {r.ok ? <CheckCircle size={13} color="#10b981" /> : <AlertCircle size={13} color="#ef4444" />}
                        <span style={{ fontSize: 12, color: r.ok ? 'var(--t2)' : '#fca5a5' }}>{r.label}</span>
                      </div>
                    ))}
                    {contrattoSelezionato.cig_subappalto && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--t3)' }}>CIG: <strong style={{ fontFamily: 'var(--font-mono)' }}>{contrattoSelezionato.cig_subappalto}</strong></div>
                    )}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Stipula', val: contrattoSelezionato.data_stipula },
                    { label: 'Inizio', val: contrattoSelezionato.data_inizio },
                    { label: 'Fine', val: contrattoSelezionato.data_fine },
                    { label: 'SAL emessi', val: String(contrattoSelezionato.sal_emessi || 0) },
                  ].map(r => (
                    <div key={r.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>{r.label}</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t1)' }}>{r.val || '—'}</div>
                    </div>
                  ))}
                </div>
                {(contrattoSelezionato.voci_contratto ?? []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Voci contratto ({contrattoSelezionato.voci_contratto?.length})</div>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 350 }}>
                        <thead>
                          <tr style={{ background: 'rgba(59,130,246,0.05)' }}>
                            {['Descrizione', 'U.M.', 'Q.tà', 'Importo'].map(h => (
                              <th key={h} style={{ padding: '7px 10px', fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {contrattoSelezionato.voci_contratto?.map(voce => (
                            <tr key={voce.id} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--t1)' }}>{voce.descrizione}</td>
                              <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>{voce.um}</td>
                              <td style={{ padding: '7px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t2)' }}>{voce.quantita}</td>
                              <td style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 700, color: 'var(--t1)' }}>€ {fmt(voce.importo || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer', justifyContent: 'center' }}>
                  <FileText size={13} /> Genera contratto PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, width: '100%', maxWidth: 680, padding: '28px 32px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Nuovo Contratto</h2>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>
            {errore && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' }}>{errore}</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(Object.keys(TIPO_META) as TipoContratto[]).map(t => (
                <button key={t} onClick={() => setF('tipo', t)} style={{ padding: '8px 14px', borderRadius: 8, border: `2px solid ${form.tipo === t ? TIPO_META[t].color : '#e2e8f0'}`, background: form.tipo === t ? `${TIPO_META[t].color}15` : '#f8fafc', color: form.tipo === t ? TIPO_META[t].color : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{TIPO_META[t].label}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Oggetto *</label><textarea value={form.oggetto} onChange={e => setF('oggetto', e.target.value)} placeholder="Descrizione oggetto contratto..." style={{ ...inp, resize: 'vertical', minHeight: 70 }} /></div>
              <div><label style={lbl}>Importo contrattuale (€)</label><input type="number" value={form.importo_contrattuale} onChange={e => setF('importo_contrattuale', +e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Ritenuta garanzia (%)</label><input type="number" value={form.ritenuta_garanzia_pct} onChange={e => setF('ritenuta_garanzia_pct', +e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Ritenuta acconto (%)</label><input type="number" value={form.ritenuta_acconto_pct} onChange={e => setF('ritenuta_acconto_pct', +e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Categoria SOA</label><input value={form.categoria_soa} onChange={e => setF('categoria_soa', e.target.value)} placeholder="OG1 cl.II" style={inp} /></div>
              <div><label style={lbl}>CIG Subappalto</label><input value={form.cig_subappalto} onChange={e => setF('cig_subappalto', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
              <div><label style={lbl}>Data stipula</label><input type="date" value={form.data_stipula} onChange={e => setF('data_stipula', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Data inizio</label><input type="date" value={form.data_inizio} onChange={e => setF('data_inizio', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Data fine</label><input type="date" value={form.data_fine} onChange={e => setF('data_fine', e.target.value)} style={inp} /></div>
              <div>
                <label style={lbl}>Stato</label>
                <select value={form.stato} onChange={e => setF('stato', e.target.value as StatoContratto)} style={{ ...inp, width: '100%' }}>
                  {(Object.keys(STATO_META) as StatoContratto[]).map(s => <option key={s} value={s}>{STATO_META[s].label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="autorizzazione_sa" checked={form.autorizzazione_sa} onChange={e => setF('autorizzazione_sa', e.target.checked)} style={{ cursor: 'pointer' }} />
                <label htmlFor="autorizzazione_sa" style={{ fontSize: 13, color: '#1e293b', cursor: 'pointer' }}>Autorizzazione Stazione Appaltante ottenuta</label>
              </div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Note</label><input value={form.note} onChange={e => setF('note', e.target.value)} style={inp} /></div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#3b82f6', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvataggio...' : '✓ Crea contratto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
