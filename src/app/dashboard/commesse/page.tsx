'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Search, ArrowRight, Upload, Sparkles, MapPin, X, Save, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react'

// ─── TIPI ────────────────────────────────────────────────────────────────────

interface Commessa {
  id: string
  codice: string
  nome: string
  committente: string
  stato: string
  importo_aggiudicato: number
  avanzamento_pct: number
  n_sal_attivi: number
  provincia: string
}

// Figure professionali complete di un appalto pubblico
const FIGURE_TEMPLATE = {
  // Committente / Stazione Appaltante
  rup_nome: '', rup_email: '', rup_telefono: '',
  dl_nome: '', dl_email: '', dl_telefono: '',
  direttore_operativo_nome: '', direttore_operativo_email: '',
  ispettore_cantiere_nome: '', ispettore_cantiere_email: '',
  csp_nome: '', csp_email: '',   // Coordinatore Sicurezza Progettazione
  cse_nome: '', cse_email: '',   // Coordinatore Sicurezza Esecuzione
  collaudatore_nome: '', collaudatore_email: '',
  collaudatore_statico_nome: '', collaudatore_statico_email: '',
  // Impresa
  rc_nome: '', rc_email: '', rc_telefono: '',     // Responsabile Commessa
  direttore_tecnico_nome: '', direttore_tecnico_email: '',
  capocantiere_nome: '', capocantiere_telefono: '',
  rspp_nome: '', rspp_email: '',
  preposto_nome: '', preposto_telefono: '',
  responsabile_qualita_nome: '', responsabile_qualita_email: '',
}

const STATI = ['IN_ESECUZIONE', 'AGGIUDICATA', 'COLLAUDO', 'SOSPESA', 'CHIUSA']
const PROVINCE_IT = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OG','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']

function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

const STATO_COLOR: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6', COLLAUDO: '#8b5cf6',
  SOSPESA: '#ef4444', CHIUSA: '#64748b'
}

// Genera codice commessa: AA.PRV.CAT.NNN
function generaCodice(anno: number, provincia: string, categoria: string, progressivo: number) {
  const aa = String(anno).slice(-2)
  const prv = (provincia || 'XX').toUpperCase().slice(0, 3)
  const cat = (categoria || 'GE').toUpperCase().slice(0, 2)
  const nnn = String(progressivo).padStart(3, '0')
  return `${aa}.${prv}.${cat}.${nnn}`
}

type Step = 'UPLOAD' | 'AI_LOADING' | 'FORM' | 'FIGURE'

export default function CommessePage() {
  const router = useRouter()
  const [commesse, setCommesse] = useState<Commessa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('TUTTI')
  const [showNuova, setShowNuova] = useState(false)
  const [step, setStep] = useState<Step>('UPLOAD')
  const [aiStatus, setAiStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [showFigure, setShowFigure] = useState(false)
  const [sezioneAperta, setSezioneAperta] = useState<string>('committente')
  const fileRef = useRef<HTMLInputElement>(null)

  // Form dati commessa
  const [form, setForm] = useState({
    codice: '', nome: '', committente: '', cig: '', cup: '',
    importo_base: 0, importo_aggiudicato: 0, ribasso_pct: 0,
    oneri_sicurezza: 0, provincia: 'NA', categoria: 'GE',
    tipo_committente: 'P', stato: 'AGGIUDICATA',
    indirizzo_cantiere: '', citta_cantiere: '', cap_cantiere: '',
    lat: '', lng: '',
    data_aggiudicazione: new Date().toISOString().slice(0, 10),
    data_fine_contrattuale: '',
    durata_giorni: 365, note: '',
    ...FIGURE_TEMPLATE
  })

  useEffect(() => { carica() }, [])

  const carica = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('v_commesse_kpi')
      .select('id,codice,nome,committente,stato,importo_aggiudicato,avanzamento_pct,n_sal_attivi')
      .order('stato')
    if (data) setCommesse(data as Commessa[])
    setLoading(false)
  }, [])

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  // Ricalcola codice quando cambiano i campi chiave
  function aggiornaCodice() {
    const anno = new Date().getFullYear()
    const prog = (commesse.length || 0) + 1
    const codice = generaCodice(anno, form.provincia, form.categoria, prog)
    setF('codice', codice)
  }

  // Geocoding indirizzo → coordinate
  async function geocodifica() {
    const addr = `${form.indirizzo_cantiere}, ${form.citta_cantiere}, Italia`
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`)
      const data = await res.json()
      if (data[0]) {
        setF('lat', data[0].lat)
        setF('lng', data[0].lon)
      }
    } catch { /* geocoding fallback silenzioso */ }
  }

  // Importa documento e chiedi all'AI
  async function handleFileImport(file: File) {
    setStep('AI_LOADING')
    setAiStatus('Lettura documento...')
    try {
      const testo = await file.text()
      setAiStatus('AI analizza il documento...')
      const res = await fetch('/api/ai-estrai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testo.slice(0, 8000), tipo: 'commessa' })
      })
      const { ok, dati } = await res.json()
      if (ok && dati) {
        const anno = new Date().getFullYear()
        const prog = (commesse.length || 0) + 1
        const prov = dati.provincia || 'NA'
        const cat = dati.categoria_prevalente?.slice(0, 2) || 'GE'
        const codiceAI = generaCodice(anno, prov, cat, prog)
        setForm(p => ({
          ...p,
          codice: codiceAI,
          nome: dati.nome || '',
          committente: dati.committente || '',
          cig: dati.cig || '',
          cup: dati.cup || '',
          importo_base: parseFloat(dati.importo_base) || 0,
          importo_aggiudicato: parseFloat(dati.importo_aggiudicato) || 0,
          ribasso_pct: parseFloat(dati.ribasso_pct) || 0,
          oneri_sicurezza: parseFloat(dati.oneri_sicurezza) || 0,
          provincia: prov,
          categoria: cat,
          tipo_committente: dati.tipo_committente || 'P',
          data_aggiudicazione: dati.data_aggiudicazione || p.data_aggiudicazione,
          durata_giorni: parseInt(dati.durata_giorni) || 365,
          indirizzo_cantiere: dati.indirizzo_cantiere || '',
          citta_cantiere: dati.citta_cantiere || '',
          rup_nome: dati.rup_nome || '',
          rup_email: dati.rup_email || '',
          dl_nome: dati.dl_nome || '',
          dl_email: dati.dl_email || '',
          note: dati.note || '',
        }))
        setAiStatus('✅ Dati estratti — verifica e integra prima di confermare')
      } else {
        setAiStatus('⚠️ Estrazione parziale — compila i campi mancanti')
      }
    } catch {
      setAiStatus('❌ Errore lettura — inserisci i dati manualmente')
    }
    setStep('FORM')
  }

  async function creaCommessa() {
    if (!form.nome || !form.committente) return
    setSaving(true)

    // Geocodifica se non ci sono già le coordinate
    if (form.indirizzo_cantiere && !form.lat) await geocodifica()

    const { data: azienda } = await supabase.from('utenti')
      .select('azienda_id').eq('id', (await supabase.auth.getUser()).data.user?.id || '').single()
    const aziendaId = azienda?.azienda_id

    const { data } = await supabase.from('commesse').insert([{
      azienda_id: aziendaId,
      codice: form.codice,
      anno: new Date().getFullYear(),
      nome: form.nome,
      committente: form.committente,
      cig: form.cig || null,
      cup: form.cup || null,
      importo_base: form.importo_base || 0,
      importo_aggiudicato: form.importo_aggiudicato || form.importo_base,
      ribasso_pct: form.ribasso_pct || 0,
      oneri_sicurezza: form.oneri_sicurezza || 0,
      provincia: form.provincia,
      categoria: form.categoria,
      tipo_committente: form.tipo_committente,
      stato: form.stato,
      indirizzo_cantiere: form.indirizzo_cantiere || null,
      citta_cantiere: form.citta_cantiere || null,
      cap_cantiere: form.cap_cantiere || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      data_aggiudicazione: form.data_aggiudicazione,
      data_fine_contrattuale: form.data_fine_contrattuale || null,
      durata_giorni: form.durata_giorni,
      rup_nome: form.rup_nome || null,
      rup_email: form.rup_email || null,
      dl_nome: form.dl_nome || null,
      dl_email: form.dl_email || null,
      rc_nome: form.rc_nome || null,
      rc_email: form.rc_email || null,
      capocantiere_nome: form.capocantiere_nome || null,
      cse_nome: form.cse_nome || null,
      cse_email: form.cse_email || null,
      note: form.note || null,
    }]).select().single()

    setSaving(false)
    if (data) {
      setShowNuova(false)
      await carica()
      router.push(`/dashboard/commesse/${data.id}`)
    }
  }

  function apriNuova() {
    setStep('UPLOAD')
    setAiStatus('')
    const anno = new Date().getFullYear()
    const prog = (commesse.length || 0) + 1
    setForm(p => ({ ...p, codice: generaCodice(anno, 'NA', 'GE', prog) }))
    setShowNuova(true)
  }

  const filtrate = commesse.filter(c => {
    const matchStato = filtroStato === 'TUTTI' || c.stato === filtroStato
    const matchSearch = !search || c.nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.codice?.toLowerCase().includes(search.toLowerCase()) ||
      c.committente?.toLowerCase().includes(search.toLowerCase())
    return matchStato && matchSearch
  })

  const portafoglio = commesse.filter(c => c.stato !== 'CHIUSA').reduce((s, c) => s + (c.importo_aggiudicato || 0), 0)

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', color: '#1e293b', fontSize: 13 }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }
  const sezBtn = (k: string): React.CSSProperties => ({ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: sezioneAperta === k ? 'rgba(59,130,246,0.06)' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 2 })

  return (
    <div style={{ padding: '22px 28px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Commesse</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
            {commesse.filter(c => c.stato !== 'CHIUSA').length} commesse attive · Portafoglio: € {fmt(portafoglio)}
          </p>
        </div>
        <button onClick={apriNuova} className="btn-primary" style={{ fontSize: 13 }}>
          + Nuova commessa
        </button>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, codice, committente, CIG..."
            style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px 9px 34px', fontSize: 13, color: 'var(--t1)', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {['TUTTI', ...STATI].map(s => (
            <button key={s} onClick={() => setFiltroStato(s)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroStato === s ? (STATO_COLOR[s] || 'var(--accent)') : 'var(--panel)', color: filtroStato === s ? 'white' : 'var(--t3)', whiteSpace: 'nowrap' }}>
              {s === 'TUTTI' ? 'Tutte' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Lista commesse */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtrate.length === 0 ? (
          <div style={{ padding: '60px 32px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            {commesse.length === 0 ? 'Nessuna commessa · Clicca "+ Nuova commessa" per iniziare' : 'Nessuna commessa con questo filtro'}
          </div>
        ) : filtrate.map((c, i) => {
          const col = STATO_COLOR[c.stato] || '#6b7280'
          return (
            <div key={c.id} onClick={() => router.push(`/dashboard/commesse/${c.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < filtrate.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 4, height: 44, borderRadius: 2, background: col, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{c.codice}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: col, background: `${col}15`, borderRadius: 5, padding: '1px 6px', border: `1px solid ${col}25` }}>{c.stato.replace('_', ' ')}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }} className="truncate">{c.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{c.committente}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${c.avanzamento_pct || 0}%`, height: '100%', background: col }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--t3)', width: 28 }}>{c.avanzamento_pct || 0}%</span>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(c.importo_aggiudicato)}</div>
              </div>
              <ArrowRight size={14} color="var(--t4)" />
            </div>
          )
        })}
      </div>

      {/* MODAL NUOVA COMMESSA */}
      {showNuova && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: step === 'UPLOAD' || step === 'AI_LOADING' ? 480 : 760 }}>

            {/* STEP 1: Upload documento */}
            {step === 'UPLOAD' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Nuova Commessa</h2>
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Importa il documento o procedi manualmente</p>
                  </div>
                  <button onClick={() => setShowNuova(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
                </div>

                {/* Zona upload */}
                <div onClick={() => fileRef.current?.click()}
                  style={{ border: '2px dashed #e2e8f0', borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Upload size={24} color="#3b82f6" />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                    Importa documento di aggiudicazione
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>PDF, DOCX, TXT — Contratto, Capitolato, Determina</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                    <Sparkles size={13} /> AI legge il documento e compila i campi in automatico
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileImport(f) }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>oppure</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>

                <button onClick={() => setStep('FORM')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  Inserisci dati manualmente
                </button>
              </>
            )}

            {/* STEP AI loading */}
            {step === 'AI_LOADING' && (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Sparkles size={28} color="#3b82f6" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>AI analizza il documento</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{aiStatus}</div>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            )}

            {/* STEP 2: Form dati + revisione */}
            {step === 'FORM' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Dati commessa</h2>
                    {aiStatus && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: aiStatus.startsWith('✅') ? '#10b981' : aiStatus.startsWith('⚠') ? '#f59e0b' : '#64748b' }}>
                        {aiStatus.startsWith('✅') ? <CheckCircle size={12} /> : aiStatus.startsWith('⚠') ? <AlertCircle size={12} /> : null}
                        {aiStatus}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowNuova(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
                </div>

                <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                    {/* Codice commessa */}
                    <div>
                      <label style={lbl}>Codice commessa *</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input value={form.codice} onChange={e => setF('codice', e.target.value)} style={{ ...inp, fontFamily: 'monospace', fontWeight: 700, flex: 1 }} />
                        <button onClick={aggiornaCodice} title="Rigenera" style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap' }}>↺ Rigenera</button>
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Formato: AA.PRV.CAT.NNN — modificabile</div>
                    </div>

                    <div>
                      <label style={lbl}>Stato</label>
                      <select value={form.stato} onChange={e => setF('stato', e.target.value)} style={{ ...inp, width: '100%' }}>
                        {STATI.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={lbl}>Nome / Oggetto dei lavori *</label>
                      <input value={form.nome} onChange={e => setF('nome', e.target.value)} placeholder="es. Riqualificazione Scuola Media..." style={inp} />
                    </div>

                    <div>
                      <label style={lbl}>Committente *</label>
                      <input value={form.committente} onChange={e => setF('committente', e.target.value)} placeholder="es. Comune di Napoli" style={inp} />
                    </div>

                    <div>
                      <label style={lbl}>Tipo committente</label>
                      <select value={form.tipo_committente} onChange={e => setF('tipo_committente', e.target.value)} style={{ ...inp, width: '100%' }}>
                        <option value="P">Pubblico</option>
                        <option value="PR">Privato</option>
                        <option value="M">Misto</option>
                      </select>
                    </div>

                    <div>
                      <label style={lbl}>CIG</label>
                      <input value={form.cig} onChange={e => setF('cig', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={lbl}>CUP</label>
                      <input value={form.cup} onChange={e => setF('cup', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={lbl}>Importo base d&apos;asta (€)</label>
                      <input type="number" min={0} step={0.01} value={form.importo_base || ''} onChange={e => setF('importo_base', parseFloat(e.target.value) || 0)} style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={lbl}>Importo aggiudicato (€)</label>
                      <input type="number" min={0} step={0.01} value={form.importo_aggiudicato || ''} onChange={e => setF('importo_aggiudicato', parseFloat(e.target.value) || 0)} style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={lbl}>Ribasso %</label>
                      <input type="number" min={0} max={100} step={0.001} value={form.ribasso_pct || ''} onChange={e => setF('ribasso_pct', parseFloat(e.target.value) || 0)} style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={lbl}>Oneri sicurezza (€)</label>
                      <input type="number" min={0} step={0.01} value={form.oneri_sicurezza || ''} onChange={e => setF('oneri_sicurezza', parseFloat(e.target.value) || 0)} style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={lbl}>Provincia</label>
                      <select value={form.provincia} onChange={e => setF('provincia', e.target.value)} style={{ ...inp, width: '100%' }}>
                        {PROVINCE_IT.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={lbl}>Categoria lavori</label>
                      <select value={form.categoria} onChange={e => setF('categoria', e.target.value)} style={{ ...inp, width: '100%' }}>
                        {[['GE','Generale'],['RS','Ristrutturazione'],['NR','Nuova Realizzazione'],['ML','Manutenzione'],['SI','Impianti'],['ST','Strade'],['VS','Verde pubblico'],['ID','Idraulica'],['EL','Elettrico']].map(([v, l]) => <option key={v} value={v}>{v} — {l}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={lbl}>Data aggiudicazione</label>
                      <input type="date" value={form.data_aggiudicazione} onChange={e => setF('data_aggiudicazione', e.target.value)} style={inp} />
                    </div>

                    <div>
                      <label style={lbl}>Fine lavori contrattuale</label>
                      <input type="date" value={form.data_fine_contrattuale} onChange={e => setF('data_fine_contrattuale', e.target.value)} style={inp} />
                    </div>

                    {/* INDIRIZZO CANTIERE + COORDINATE */}
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', margin: '8px 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={13} color="#3b82f6" /> Localizzazione cantiere (per CantierePulse)
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={lbl}>Indirizzo cantiere</label>
                      <input value={form.indirizzo_cantiere} onChange={e => setF('indirizzo_cantiere', e.target.value)} placeholder="es. Via Roma 1" style={inp} />
                    </div>

                    <div>
                      <label style={lbl}>Città cantiere</label>
                      <input value={form.citta_cantiere} onChange={e => setF('citta_cantiere', e.target.value)} placeholder="es. Napoli" style={inp} />
                    </div>

                    <div>
                      <label style={lbl}>CAP</label>
                      <input value={form.cap_cantiere} onChange={e => setF('cap_cantiere', e.target.value)} placeholder="80100" style={inp} />
                    </div>

                    <div>
                      <label style={lbl}>Latitudine</label>
                      <input value={form.lat} onChange={e => setF('lat', e.target.value)} placeholder="es. 40.8518" style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>

                    <div>
                      <label style={{ ...lbl, display: 'flex', justifyContent: 'space-between' }}>
                        Longitudine
                        <button onClick={geocodifica} style={{ fontSize: 9, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>📍 Calcola da indirizzo</button>
                      </label>
                      <input value={form.lng} onChange={e => setF('lng', e.target.value)} placeholder="es. 14.2681" style={{ ...inp, fontFamily: 'monospace' }} />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={lbl}>Note</label>
                      <textarea value={form.note} onChange={e => setF('note', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', width: '100%' }} />
                    </div>

                    {/* FIGURE PROFESSIONALI (collassabile) */}
                    <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                      <button onClick={() => setShowFigure(!showFigure)} style={sezBtn('figure')}>
                        <span>👷 Figure professionali dell&apos;appalto</span>
                        <ChevronDown size={14} style={{ transform: showFigure ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                      </button>

                      {showFigure && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}>

                          {/* Sezione Committente */}
                          <button onClick={() => setSezioneAperta(sezioneAperta === 'committente' ? '' : 'committente')} style={sezBtn('committente')}>
                            <span>🏛 Stazione Appaltante</span>
                            <ChevronDown size={12} />
                          </button>
                          {sezioneAperta === 'committente' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '12px 14px', background: '#fafafa' }}>
                              {[
                                { k: 'rup_nome', l: 'RUP — Nome' }, { k: 'rup_email', l: 'RUP — Email' }, { k: 'rup_telefono', l: 'RUP — Tel.' },
                                { k: 'dl_nome', l: 'DL — Nome' }, { k: 'dl_email', l: 'DL — Email' }, { k: 'dl_telefono', l: 'DL — Tel.' },
                                { k: 'direttore_operativo_nome', l: 'Dir. Operativo — Nome' }, { k: 'direttore_operativo_email', l: 'Dir. Operativo — Email' }, { k: '', l: '' },
                                { k: 'ispettore_cantiere_nome', l: 'Ispettore — Nome' }, { k: 'ispettore_cantiere_email', l: 'Ispettore — Email' }, { k: '', l: '' },
                                { k: 'csp_nome', l: 'CSP — Nome' }, { k: 'csp_email', l: 'CSP — Email' }, { k: '', l: '' },
                                { k: 'cse_nome', l: 'CSE — Nome' }, { k: 'cse_email', l: 'CSE — Email' }, { k: '', l: '' },
                                { k: 'collaudatore_nome', l: 'Collaudatore T.A.' }, { k: 'collaudatore_email', l: 'Collaudatore — Email' }, { k: '', l: '' },
                                { k: 'collaudatore_statico_nome', l: 'Collaudatore Statico' }, { k: 'collaudatore_statico_email', l: 'Coll. Statico — Email' }, { k: '', l: '' },
                              ].map(({ k, l }, i) => k ? (
                                <div key={i}>
                                  <label style={{ ...lbl, fontSize: 9 }}>{l}</label>
                                  <input value={(form as Record<string, string>)[k] || ''} onChange={e => setF(k as keyof typeof form, e.target.value as never)} style={{ ...inp, padding: '6px 8px', fontSize: 12 }} />
                                </div>
                              ) : <div key={i} />)}
                            </div>
                          )}

                          {/* Sezione Impresa */}
                          <button onClick={() => setSezioneAperta(sezioneAperta === 'impresa' ? '' : 'impresa')} style={{ ...sezBtn('impresa'), borderTop: '1px solid #e2e8f0' }}>
                            <span>🏗 Impresa Esecutrice</span>
                            <ChevronDown size={12} />
                          </button>
                          {sezioneAperta === 'impresa' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '12px 14px', background: '#fafafa' }}>
                              {[
                                { k: 'rc_nome', l: 'Resp. Commessa — Nome' }, { k: 'rc_email', l: 'RC — Email' }, { k: 'rc_telefono', l: 'RC — Tel.' },
                                { k: 'direttore_tecnico_nome', l: 'Dir. Tecnico — Nome' }, { k: 'direttore_tecnico_email', l: 'Dir. Tecnico — Email' }, { k: '', l: '' },
                                { k: 'capocantiere_nome', l: 'Capocantiere — Nome' }, { k: 'capocantiere_telefono', l: 'Capocantiere — Tel.' }, { k: '', l: '' },
                                { k: 'rspp_nome', l: 'RSPP — Nome' }, { k: 'rspp_email', l: 'RSPP — Email' }, { k: '', l: '' },
                                { k: 'preposto_nome', l: 'Preposto — Nome' }, { k: 'preposto_telefono', l: 'Preposto — Tel.' }, { k: '', l: '' },
                                { k: 'responsabile_qualita_nome', l: 'Resp. Qualità — Nome' }, { k: 'responsabile_qualita_email', l: 'RQ — Email' }, { k: '', l: '' },
                              ].map(({ k, l }, i) => k ? (
                                <div key={i}>
                                  <label style={{ ...lbl, fontSize: 9 }}>{l}</label>
                                  <input value={(form as Record<string, string>)[k] || ''} onChange={e => setF(k as keyof typeof form, e.target.value as never)} style={{ ...inp, padding: '6px 8px', fontSize: 12 }} />
                                </div>
                              ) : <div key={i} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => setStep('UPLOAD')} className="btn-secondary" style={{ fontSize: 12 }}>
                    ← Importa documento
                  </button>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowNuova(false)} className="btn-secondary">Annulla</button>
                    <button onClick={creaCommessa} disabled={saving || !form.nome || !form.committente} className="btn-primary">
                      <Save size={14} /> {saving ? 'Creazione...' : 'Crea commessa'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
