'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, getAziendaId } from '@/lib/supabase'
import { Plus, Search, ArrowRight, Upload, FileText, Sparkles, X, AlertCircle, CheckCircle } from 'lucide-react'

interface Commessa {
  id: string
  codice: string
  nome: string
  committente: string
  stato: string
  importo_aggiudicato: number
  data_fine_contrattuale: string
  avanzamento_pct: number
  n_sal_attivi: number
  importo_incassato: number
  azienda_id: string
}

const STATO_COLOR: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6', COLLAUDO: '#8b5cf6',
  SOSPESA: '#ef4444', CHIUSA: '#374151', ACQUISITA: '#6b7280'
}

const PROVINCE = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']
const TIPI_COMMITTENTE = [{ v: 'P', l: 'Pubblico' }, { v: 'V', l: 'Privato' }, { v: 'M', l: 'Misto PPP' }, { v: 'A', l: 'Accordo Quadro' }, { v: 'S', l: 'Subappalto' }, { v: 'C', l: 'Concessione' }]
const CATEGORIE_OPERA = [{ v: 'RS', l: 'Ristrutturazione' }, { v: 'NC', l: 'Nuova Costruzione' }, { v: 'DR', l: 'Demo + Ricostruzione' }, { v: 'MS', l: 'Man. Straordinaria' }, { v: 'MO', l: 'Man. Ordinaria' }, { v: 'IF', l: 'Infrastrutture' }, { v: 'RE', l: 'Restauro' }, { v: 'IP', l: 'Impianti' }, { v: 'UR', l: 'Urbanizzazione' }, { v: 'BO', l: 'Bonifica' }]

function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

const FORM_VUOTO = {
  anno: new Date().getFullYear(), tipo_committente: 'P', provincia: 'NA', categoria: 'NC',
  nome: '', committente: '', piva_committente: '', cig: '', cup: '',
  importo_base: 0, ribasso_pct: 0, oneri_sicurezza: 0,
  data_aggiudicazione: '', data_inizio: '', data_fine_contrattuale: '', durata_gg: 0,
  dl_nome: '', dl_email: '', dl_telefono: '', rup_nome: '', rup_email: '',
  stato: 'AGGIUDICATA', note: ''
}

export default function CommessePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [commesse, setCommesse] = useState<Commessa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('TUTTI')
  const [showModal, setShowModal] = useState(searchParams.get('new') === 'true')
  const [modalMode, setModalMode] = useState<'scelta' | 'manuale' | 'import'>('scelta')
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState('')
  const [saved, setSaved] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<Partial<typeof FORM_VUOTO> | null>(null)

  useEffect(() => { carica() }, [])

  async function carica() {
    const { data } = await supabase.from('v_commesse_kpi').select('*').order('stato').order('created_at', { ascending: false })
    if (data) setCommesse(data)
    setLoading(false)
  }

  function setF(f: string, v: unknown) { setForm(p => ({ ...p, [f]: v })) }

  const a2 = String(form.anno).slice(2)
  const codicePreview = `${a2}.${form.tipo_committente}${form.provincia}.${form.categoria}.XXX`
  const importoAgg = form.importo_base * (1 - form.ribasso_pct / 100)

  const filtrate = commesse.filter(c => {
    const ms = !search || c.nome?.toLowerCase().includes(search.toLowerCase()) || c.codice?.includes(search) || c.committente?.toLowerCase().includes(search.toLowerCase())
    const mf = filtroStato === 'TUTTI' || c.stato === filtroStato
    return ms && mf
  })

  async function analizzaFile(file: File) {
    setAiLoading(true)
    try {
      const testo = await file.text().catch(() => '')
      const response = await fetch('/api/ai-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'COMMESSA', testo, nomeFile: file.name })
      })
      const result = await response.json()
      if (result.dati) {
        setAiResult(result.dati)
        setForm(prev => ({ ...prev, ...result.dati }))
        setModalMode('manuale')
      }
    } catch (e) { console.error(e) }
    setAiLoading(false)
  }

  async function salva() {
    if (!form.nome.trim()) { setErrore('Nome commessa obbligatorio'); return }
    if (!form.committente.trim()) { setErrore('Committente obbligatorio'); return }
    setSaving(true); setErrore('')
    const aziendaId = await getAziendaId()
    const prog = commesse.filter(c => {
      const a = String(c.codice || '').split('.')?.[0]
      return a === String(form.anno).slice(2)
    }).length + 1
    const codice = `${a2}.${form.tipo_committente}${form.provincia}.${form.categoria}.${String(prog).padStart(3, '0')}`
    const { data, error } = await supabase.from('commesse').insert([{
      ...form, codice, progressivo: prog,
      importo_aggiudicato: importoAgg,
      sal_emessi_attivi: 0, sal_emessi_passivi: 0, avanzamento_pct: 0,
      azienda_id: aziendaId
    }]).select().single()
    if (error) { setErrore('Errore: ' + error.message); setSaving(false); return }
    setSaving(false); setSaved(true); setShowModal(false)
    setForm({ ...FORM_VUOTO }); setAiResult(null); setModalMode('scelta')
    await carica()
    if (data) router.push(`/dashboard/commesse/${data.id}`)
  }

  const inp = { width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', color: '#1e293b', fontSize: 13 }
  const lbl = { fontSize: 10, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '28px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Commesse</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>
            {commesse.filter(c => c.stato !== 'CHIUSA').length} commesse attive · Portafoglio: € {fmt(commesse.filter(c => c.stato !== 'CHIUSA').reduce((s, c) => s + (c.importo_aggiudicato || 0), 0))}
          </p>
        </div>
        <button onClick={() => { setShowModal(true); setModalMode('scelta') }} className="btn-primary">
          <Plus size={15} /> Nuova Commessa
        </button>
      </div>

      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <CheckCircle size={15} color="#10b981" />
          <span style={{ fontSize: 13, color: '#10b981' }}>Commessa creata! Reindirizzamento in corso...</span>
        </div>
      )}

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome, codice, committente, CIG..." style={{ ...inp, paddingLeft: 36, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['TUTTI', 'IN_ESECUZIONE', 'AGGIUDICATA', 'COLLAUDO', 'SOSPESA', 'CHIUSA'].map(s => (
            <button key={s} onClick={() => setFiltroStato(s)} style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filtroStato === s ? (STATO_COLOR[s] || 'var(--accent)') : 'var(--panel)',
              color: filtroStato === s ? 'white' : 'var(--t3)'
            }}>{s === 'TUTTI' ? 'Tutte' : s.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtrate.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)' }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Nessuna commessa trovata</div>
              <button onClick={() => { setShowModal(true); setModalMode('scelta') }} className="btn-primary" style={{ margin: '0 auto' }}>
                <Plus size={14} /> Crea la prima commessa
              </button>
            </div>
          ) : (
            filtrate.map((c, i) => {
              const col = STATO_COLOR[c.stato] || '#6b7280'
              const giorniFine = c.data_fine_contrattuale ? Math.ceil((new Date(c.data_fine_contrattuale).getTime() - Date.now()) / 86400000) : null
              return (
                <div key={c.id}
                  onClick={() => router.push(`/dashboard/commesse/${c.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderBottom: i < filtrate.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 4, height: 48, borderRadius: 2, background: col, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '2px 8px' }}>{c.codice}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: col, background: `${col}15`, border: `1px solid ${col}30`, borderRadius: 5, padding: '2px 8px' }}>{c.stato.replace('_',' ')}</span>
                      {giorniFine !== null && giorniFine <= 30 && giorniFine >= 0 && (
                        <span style={{ fontSize: 10, color: giorniFine <= 7 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>⚠ {giorniFine}gg</span>
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }} className="truncate">{c.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{c.committente}</div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', maxWidth: 200 }}>
                        <div style={{ width: `${c.avanzamento_pct || 0}%`, height: '100%', background: col, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>{c.avanzamento_pct || 0}%</span>
                      {c.data_fine_contrattuale && <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>Fine: {c.data_fine_contrattuale}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(c.importo_aggiudicato)}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>SAL: {c.n_sal_attivi || 0} · Incassato: € {fmt(c.importo_incassato)}</div>
                  </div>
                  <ArrowRight size={16} color="var(--t4)" style={{ flexShrink: 0 }} />
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ═══ MODAL NUOVA COMMESSA ═══════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: modalMode === 'manuale' ? 900 : 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                {modalMode === 'scelta' ? 'Nuova Commessa' : modalMode === 'import' ? 'Importa documento' : 'Dati commessa'}
              </h2>
              <button onClick={() => { setShowModal(false); setModalMode('scelta'); setAiResult(null); setErrore('') }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>

            {/* ─── SCELTA FLOW ─── */}
            {modalMode === 'scelta' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  {
                    icon: '🏆', title: 'Commessa aggiudicata', subtitle: 'Inserisci manualmente i dati di una commessa già vinta',
                    color: '#3b82f6', action: () => setModalMode('manuale')
                  },
                  {
                    icon: '🤖', title: 'Importa da documento', subtitle: 'Carica un contratto o capitolato — AI estrae i dati automaticamente',
                    color: '#8b5cf6', action: () => setModalMode('import')
                  },
                ].map(opt => (
                  <button key={opt.title} onClick={opt.action} style={{
                    padding: '24px 20px', borderRadius: 12,
                    border: `2px solid ${opt.color}30`, background: `${opt.color}06`,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>{opt.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{opt.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{opt.subtitle}</div>
                  </button>
                ))}
              </div>
            )}

            {/* ─── IMPORT AI ─── */}
            {modalMode === 'import' && (
              <div>
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 40, textAlign: 'center', marginBottom: 20 }}>
                  {aiLoading ? (
                    <div>
                      <div className="spinner" style={{ margin: '0 auto 12px', width: 28, height: 28 }} />
                      <div style={{ fontSize: 14, color: '#64748b' }}>AI sta analizzando il documento...</div>
                    </div>
                  ) : (
                    <>
                      <Sparkles size={32} color="#8b5cf6" style={{ marginBottom: 12 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>Carica contratto o capitolato</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>PDF, Word · AI estrae automaticamente: CIG, CUP, importo, date, DL, RUP...</div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 9, background: '#8b5cf6', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        <Upload size={14} /> Seleziona file
                        <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) analizzaFile(f) }} />
                      </label>
                    </>
                  )}
                </div>
                {aiResult && (
                  <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', marginBottom: 8 }}>✅ AI ha estratto questi dati:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {Object.entries(aiResult).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 11 }}>
                          <span style={{ color: '#64748b' }}>{k}: </span>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setModalMode('manuale')} className="btn-primary" style={{ marginTop: 12, fontSize: 12 }}>
                      Continua → Verifica e salva
                    </button>
                  </div>
                )}
                <button onClick={() => setModalMode('scelta')} className="btn-secondary" style={{ width: '100%' }}>← Indietro</button>
              </div>
            )}

            {/* ─── FORM MANUALE ─── */}
            {modalMode === 'manuale' && (
              <div>
                {errore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                    <AlertCircle size={14} color="#ef4444" /><span style={{ fontSize: 13, color: '#ef4444' }}>{errore}</span>
                  </div>
                )}

                {aiResult && (
                  <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, marginBottom: 16 }}>
                    <Sparkles size={14} color="#8b5cf6" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12, color: '#64748b' }}>Dati pre-compilati dall&apos;AI. Verifica e correggi se necessario.</div>
                  </div>
                )}

                {/* Codifica */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12 }}>📌 Codifica automatica</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                    <div><label style={lbl}>Anno</label><input type="number" value={form.anno} onChange={e => setF('anno', +e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>Tipo comm.</label>
                      <select value={form.tipo_committente} onChange={e => setF('tipo_committente', e.target.value)} style={{ ...inp, width: '100%' }}>
                        {TIPI_COMMITTENTE.map(t => <option key={t.v} value={t.v}>{t.v} — {t.l}</option>)}
                      </select></div>
                    <div><label style={lbl}>Provincia</label>
                      <select value={form.provincia} onChange={e => setF('provincia', e.target.value)} style={{ ...inp, width: '100%' }}>
                        {PROVINCE.map(p => <option key={p}>{p}</option>)}
                      </select></div>
                    <div><label style={lbl}>Categoria</label>
                      <select value={form.categoria} onChange={e => setF('categoria', e.target.value)} style={{ ...inp, width: '100%' }}>
                        {CATEGORIE_OPERA.map(c => <option key={c.v} value={c.v}>{c.v} — {c.l}</option>)}
                      </select></div>
                  </div>
                  <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Codice generato: </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{codicePreview}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Nome commessa *</label><input value={form.nome} onChange={e => setF('nome', e.target.value)} placeholder="es. Scuola Media Viale Mazzini" style={inp} /></div>
                  <div><label style={lbl}>Committente *</label><input value={form.committente} onChange={e => setF('committente', e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>P.IVA committente</label><input value={form.piva_committente} onChange={e => setF('piva_committente', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
                  <div><label style={lbl}>CIG</label><input value={form.cig} onChange={e => setF('cig', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
                  <div><label style={lbl}>CUP</label><input value={form.cup} onChange={e => setF('cup', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
                  <div><label style={lbl}>Importo base asta (€)</label><input type="number" value={form.importo_base} onChange={e => setF('importo_base', +e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
                  <div><label style={lbl}>Ribasso offerto (%)</label><input type="number" step="0.001" value={form.ribasso_pct} onChange={e => setF('ribasso_pct', +e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
                  <div><label style={lbl}>Oneri sicurezza (€)</label><input type="number" value={form.oneri_sicurezza} onChange={e => setF('oneri_sicurezza', +e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', width: '100%' }}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>IMPORTO AGGIUDICATO</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>€ {fmt(importoAgg)}</div>
                    </div>
                  </div>
                  <div><label style={lbl}>Data aggiudicazione</label><input type="date" value={form.data_aggiudicazione} onChange={e => setF('data_aggiudicazione', e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Data fine contrattuale</label><input type="date" value={form.data_fine_contrattuale} onChange={e => setF('data_fine_contrattuale', e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Nome DL</label><input value={form.dl_nome} onChange={e => setF('dl_nome', e.target.value)} placeholder="Ing. Mario Rossi" style={inp} /></div>
                  <div><label style={lbl}>Email DL</label><input value={form.dl_email} onChange={e => setF('dl_email', e.target.value)} style={inp} /></div>
                </div>
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <button onClick={() => setModalMode('scelta')} className="btn-secondary">← Indietro</button>
                  <button onClick={salva} disabled={saving} className="btn-primary">
                    {saving ? 'Creazione...' : '✓ Crea commessa e apri'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
