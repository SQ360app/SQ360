'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getAziendaId } from '@/lib/supabase'
import { Search, Plus, Upload, Sparkles, X, Save, CheckCircle, AlertCircle, ArrowRight, FileText, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'

interface Gara {
  id: string; codice_gara: string; nome: string; committente: string
  importo_base: number; data_scadenza: string; stato: string
  criterio_aggiudicazione: string; provincia: string; categoria_prevalente: string
  cig?: string; cup?: string; tipo_committente?: string; data_pubblicazione?: string
  link_bando?: string; note?: string; commessa_id?: string
  ribasso_offerto?: number; punteggio_tecnico?: number; punteggio_economico?: number
}

interface Miglioria {
  id: string; gara_id: string; categoria: string; descrizione: string
  costo_stimato: number; punteggio_tecnico_stimato: number
  note?: string; offerta: boolean; fase: string
}

interface FormGara {
  nome: string; committente: string; cig: string; cup: string
  importo_base: number; categoria_prevalente: string; provincia: string
  tipo_committente: string; data_scadenza: string; data_pubblicazione: string
  criterio_aggiudicazione: string; link_bando: string; note: string; codice_gara: string
}

const STATI_GARA = ['IN_ANALISI','DA_PRESENTARE','PRESENTATA','AGGIUDICATA','NON_AGGIUDICATA','RINUNCIATA']
const STATO_COLOR: Record<string,string> = {
  IN_ANALISI:'#6b7280', DA_PRESENTARE:'#f59e0b', PRESENTATA:'#3b82f6',
  AGGIUDICATA:'#10b981', NON_AGGIUDICATA:'#ef4444', RINUNCIATA:'#94a3b8'
}
const PROVINCE_IT = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OG','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']

const CATEGORIE_MIGLIORIA = [
  { value: 'tecnica',     label: 'Tecnica',      color: '#3b82f6' },
  { value: 'temporale',  label: 'Temporale',    color: '#8b5cf6' },
  { value: 'qualitativa',label: 'Qualitativa',  color: '#10b981' },
  { value: 'ambientale', label: 'Ambientale',   color: '#059669' },
  { value: 'sociale',    label: 'Sociale',      color: '#f59e0b' },
]

const CHECKLIST_ITEMS = [
  { key: 'domanda',       label: 'Domanda di partecipazione',          critico: true  },
  { key: 'dgue',          label: 'DGUE (Documento Gara Unico Europeo)', critico: true  },
  { key: 'offerta_eco',   label: 'Offerta economica (ribasso %)',       critico: true  },
  { key: 'offerta_tec',   label: 'Offerta tecnica (se OEPV)',           critico: false },
  { key: 'cauzione',      label: 'Cauzione provvisoria 2%',            critico: true  },
  { key: 'passoe',        label: 'PassOE ANAC',                        critico: true  },
  { key: 'antimafia',     label: 'Dichiarazioni antimafia',            critico: true  },
  { key: 'banca',         label: 'Riferimenti bancari',                critico: false },
]

type ChecklistData = Record<string, { completato: boolean; note: string }>

function getChecklist(garaId: string): ChecklistData {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('checklist-' + garaId) || '{}') } catch { return {} }
}
function saveChecklist(garaId: string, data: ChecklistData) {
  localStorage.setItem('checklist-' + garaId, JSON.stringify(data))
}

function fmt(n: number) { return (n||0).toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:0}) }
function fmt2(n: number) { return (n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}) }

const FORM_VUOTO: FormGara = {
  nome:'', committente:'', cig:'', cup:'', importo_base:0,
  categoria_prevalente:'OG1', provincia:'NA', tipo_committente:'P',
  data_scadenza:'', data_pubblicazione: new Date().toISOString().slice(0,10),
  criterio_aggiudicazione:'OEP', link_bando:'', note:'', codice_gara:''
}

type Step = 'UPLOAD' | 'AI_LOADING' | 'FORM'

function generaCodiceGara(anno: number, prog: number) {
  return `G${String(anno).slice(-2)}.${String(prog).padStart(4,'0')}`
}

export default function GarePage() {
  const router = useRouter()
  const [gare,        setGare]        = useState<Gara[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filtroStato, setFiltroStato] = useState('TUTTI')
  const [showNuova,   setShowNuova]   = useState(false)
  const [step,        setStep]        = useState<Step>('UPLOAD')
  const [aiStatus,    setAiStatus]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [form,        setForm]        = useState<FormGara>({ ...FORM_VUOTO })
  const fileRef = useRef<HTMLInputElement>(null)

  // Accordion state
  const [garaEspansa,  setGaraEspansa]  = useState<string | null>(null)
  const [garaTab,      setGaraTab]      = useState<Record<string, string>>({})
  const [migliorie,    setMigliorie]    = useState<Record<string, Miglioria[]>>({})
  const [checklist,    setChecklist]    = useState<Record<string, ChecklistData>>({})
  const [simRibasso,   setSimRibasso]   = useState<Record<string, string>>({})
  const [creatingComm, setCreatingComm] = useState<string | null>(null)

  // Form miglioria
  const [miglFormId, setMiglFormId]   = useState<string | null>(null)
  const [fmCat,      setFmCat]        = useState('tecnica')
  const [fmDesc,     setFmDesc]       = useState('')
  const [fmCosto,    setFmCosto]      = useState('')
  const [fmPunti,    setFmPunti]      = useState('')
  const [fmNote,     setFmNote]       = useState('')

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const aziendaId = await getAziendaId()
    const { data } = await supabase.from('gare')
      .select('id,codice_gara,nome,committente,importo_base,data_scadenza,stato,criterio_aggiudicazione,provincia,categoria_prevalente,cig,cup,tipo_committente,data_pubblicazione,link_bando,note,commessa_id,ribasso_offerto,punteggio_tecnico,punteggio_economico')
      .eq('azienda_id', aziendaId)
      .order('data_scadenza', { ascending: true })
    if (data) setGare(data as Gara[])
    setLoading(false)
  }

  async function caricaMigliorie(garaId: string) {
    const { data } = await supabase.from('migliorie').select('*').eq('gara_id', garaId).order('created_at')
    setMigliorie(prev => ({ ...prev, [garaId]: (data || []) as Miglioria[] }))
  }

  function handleExpand(garaId: string) {
    if (garaEspansa === garaId) { setGaraEspansa(null); return }
    setGaraEspansa(garaId)
    if (!garaTab[garaId]) setGaraTab(prev => ({ ...prev, [garaId]: 'dati' }))
    if (!migliorie[garaId]) caricaMigliorie(garaId)
    if (!checklist[garaId]) setChecklist(prev => ({ ...prev, [garaId]: getChecklist(garaId) }))
  }

  function toggleChecklist(garaId: string, key: string) {
    const cl = checklist[garaId] || {}
    const item = cl[key] || { completato: false, note: '' }
    const updated = { ...cl, [key]: { ...item, completato: !item.completato } }
    setChecklist(prev => ({ ...prev, [garaId]: updated }))
    saveChecklist(garaId, updated)
  }

  function setF(k: keyof FormGara, v: string | number) { setForm(p => ({ ...p, [k]: v })) }

  async function aggiungiMiglioria(garaId: string) {
    if (!fmDesc.trim()) return
    const aziendaId = await getAziendaId()
    const { data } = await supabase.from('migliorie').insert({
      gara_id: garaId, azienda_id: aziendaId || null,
      categoria: fmCat, descrizione: fmDesc.trim(),
      costo_stimato: parseFloat(fmCosto) || 0,
      punteggio_tecnico_stimato: parseFloat(fmPunti) || 0,
      note: fmNote || null, offerta: false, fase: 'gara',
    }).select().single()
    if (data) setMigliorie(prev => ({ ...prev, [garaId]: [...(prev[garaId] || []), data as Miglioria] }))
    setMiglFormId(null); setFmDesc(''); setFmCosto(''); setFmPunti(''); setFmNote('')
  }

  async function toggleOfferta(garaId: string, miglId: string, val: boolean) {
    await supabase.from('migliorie').update({ offerta: val }).eq('id', miglId)
    setMigliorie(prev => ({ ...prev, [garaId]: (prev[garaId] || []).map(m => m.id === miglId ? { ...m, offerta: val } : m) }))
  }

  async function eliminaMiglioria(garaId: string, miglId: string) {
    await supabase.from('migliorie').delete().eq('id', miglId)
    setMigliorie(prev => ({ ...prev, [garaId]: (prev[garaId] || []).filter(m => m.id !== miglId) }))
  }

  async function creaCommessa(gara: Gara) {
    setCreatingComm(gara.id)
    const aziendaId = await getAziendaId()
    const { count } = await supabase.from('commesse').select('*', { count: 'exact', head: true }).eq('azienda_id', aziendaId || '')
    const anno = new Date().getFullYear()
    const codice = `C${String(anno).slice(-2)}.${String((count || 0) + 1).padStart(4, '0')}`
    const { data: nuova } = await supabase.from('commesse').insert({
      azienda_id: aziendaId || null, codice,
      nome: gara.nome, committente: gara.committente,
      importo_contratto: gara.importo_base,
      cig: gara.cig || null, cup: gara.cup || null,
      stato: 'AGGIUDICATA', provincia: gara.provincia || null,
    }).select().single()
    if (nuova) {
      await supabase.from('gare').update({ commessa_id: nuova.id }).eq('id', gara.id)
      await supabase.from('migliorie').update({ commessa_id: nuova.id }).eq('gara_id', gara.id).eq('offerta', true)
      setCreatingComm(null)
      router.push(`/dashboard/commesse/${nuova.id}/anagrafica`)
    } else { setCreatingComm(null) }
  }

  async function handleFileImport(file: File) {
    setStep('AI_LOADING'); setAiStatus('Lettura bando di gara...')
    try {
      const testo = await file.text()
      setAiStatus('AI estrae i dati dal bando...')
      const res  = await fetch('/api/ai-estrai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testo: testo.slice(0,8000), tipo: 'gara' }) })
      const json = await res.json() as { ok: boolean; dati?: Record<string,string> }
      if (json.ok && json.dati) {
        const d = json.dati
        const codice = generaCodiceGara(new Date().getFullYear(), gare.length + 1)
        setForm(p => ({ ...p, codice_gara: codice, nome: d.nome||p.nome, committente: d.committente||p.committente, cig: d.cig||p.cig, cup: d.cup||p.cup, importo_base: parseFloat(d.importo_base||'0')||p.importo_base, categoria_prevalente: d.categoria_prevalente||p.categoria_prevalente, provincia: d.provincia||p.provincia, tipo_committente: d.tipo_committente||p.tipo_committente, data_scadenza: d.data_scadenza||p.data_scadenza, criterio_aggiudicazione: d.criterio_aggiudicazione||p.criterio_aggiudicazione, note: d.note||p.note }))
        setAiStatus('✅ Dati estratti — verifica e modifica il codice gara se necessario')
      } else { setAiStatus('⚠️ Estrazione parziale — integra i dati mancanti') }
    } catch { setAiStatus('❌ Errore — inserisci i dati manualmente') }
    setStep('FORM')
  }

  async function creaGara() {
    if (!form.nome) return
    setSaving(true)
    const { data: ut } = await supabase.auth.getUser()
    const { data: utData } = await supabase.from('utenti').select('azienda_id').eq('id', ut.user?.id || '').single()
    const codice = form.codice_gara || generaCodiceGara(new Date().getFullYear(), gare.length + 1)
    const { data } = await supabase.from('gare').insert([{
      azienda_id: utData?.azienda_id, codice_gara: codice,
      nome: form.nome, committente: form.committente,
      cig: form.cig||null, cup: form.cup||null, importo_base: form.importo_base,
      categoria_prevalente: form.categoria_prevalente, provincia: form.provincia,
      tipo_committente: form.tipo_committente,
      data_scadenza: form.data_scadenza||null, data_pubblicazione: form.data_pubblicazione||null,
      criterio_aggiudicazione: form.criterio_aggiudicazione,
      link_bando: form.link_bando||null, note: form.note||null, stato: 'IN_ANALISI',
    }]).select().single()
    setSaving(false)
    if (data) { setShowNuova(false); await carica() }
  }

  function apriNuova() {
    setStep('UPLOAD'); setAiStatus('')
    setForm({ ...FORM_VUOTO, codice_gara: generaCodiceGara(new Date().getFullYear(), gare.length + 1) })
    setShowNuova(true)
  }

  const filtrate = gare.filter(g => {
    const ms = filtroStato === 'TUTTI' || g.stato === filtroStato
    const mq = !search || [g.nome, g.codice_gara, g.committente].some(x => x?.toLowerCase().includes(search.toLowerCase()))
    return ms && mq
  })

  const totale           = gare.reduce((s,g) => s + (g.importo_base||0), 0)
  const aggiudicate      = gare.filter(g => g.stato==='AGGIUDICATA').length
  const scadenzaProssima = gare.filter(g => g.stato==='DA_PRESENTARE' && g.data_scadenza && Math.ceil((new Date(g.data_scadenza).getTime()-Date.now())/86400000)<=14).length

  const inp: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:7, padding:'8px 10px', color:'#1e293b', fontSize:13 }
  const lbl: React.CSSProperties = { fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }

  return (
    <div style={{ padding:'22px 28px', background:'var(--bg)', minHeight:'100%' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, color:'var(--t1)', margin:0 }}>Analisi Gare</h1>
          <p style={{ fontSize:12, color:'var(--t3)', marginTop:3 }}>
            {gare.length} gare monitorate · € {fmt(totale)} totale importi
            {scadenzaProssima > 0 && <span style={{ color:'#ef4444', marginLeft:10 }}>⚠ {scadenzaProssima} scadono entro 14gg</span>}
          </p>
        </div>
        <button onClick={apriNuova} className="btn-primary" style={{ fontSize:13 }}>
          <Plus size={14} /> Nuova gara
        </button>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
        {[
          { label:'Totale gare',    val: String(gare.length),   color:'#6b7280' },
          { label:'Da presentare',  val: String(gare.filter(g=>g.stato==='DA_PRESENTARE').length), color:'#f59e0b' },
          { label:'Aggiudicate',    val: String(aggiudicate),   color:'#10b981' },
          { label:'Tasso successo', val: gare.filter(g=>['AGGIUDICATA','NON_AGGIUDICATA'].includes(g.stato)).length > 0 ? `${Math.round((aggiudicate/gare.filter(g=>['AGGIUDICATA','NON_AGGIUDICATA'].includes(g.stato)).length)*100)}%` : '—', color:'#3b82f6' },
        ].map((k,i) => (
          <div key={i} className="kpi-card" style={{ borderLeft:`3px solid ${k.color}`, padding:'10px 14px' }}>
            <div style={{ fontSize:9, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:240 }}>
          <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--t3)' }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca per nome, codice, committente..."
            style={{ width:'100%', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:9, padding:'9px 12px 9px 34px', fontSize:13, color:'var(--t1)', boxSizing:'border-box' }} />
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {['TUTTI',...STATI_GARA].map(s => (
            <button key={s} onClick={()=>setFiltroStato(s)} style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:10, fontWeight:600, cursor:'pointer', background:filtroStato===s?(STATO_COLOR[s]||'var(--accent)'):'var(--panel)', color:filtroStato===s?'white':'var(--t3)', whiteSpace:'nowrap' }}>
              {s==='TUTTI'?'Tutte':s.replace('_',' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Lista gare */}
      <div className="card" style={{ overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:48, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : filtrate.length === 0 ? (
          <div style={{ padding:'60px 32px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            <FileText size={36} color="var(--t4)" style={{ marginBottom:12 }} />
            <div>{gare.length === 0 ? 'Nessuna gara monitorata — importa il primo bando' : 'Nessuna gara con questo filtro'}</div>
          </div>
        ) : filtrate.map((g, i) => {
          const col    = STATO_COLOR[g.stato] || '#6b7280'
          const gg     = g.data_scadenza ? Math.ceil((new Date(g.data_scadenza).getTime()-Date.now())/86400000) : null
          const urgente= gg !== null && gg >= 0 && gg <= 14
          const isExp  = garaEspansa === g.id
          const curTab = garaTab[g.id] || 'dati'
          const mgl    = migliorie[g.id] || []
          const cl     = checklist[g.id] || {}
          const clDone = CHECKLIST_ITEMS.filter(item => cl[item.key]?.completato).length

          return (
            <div key={g.id} style={{ borderBottom: i < filtrate.length-1 || isExp ? '1px solid var(--border)' : 'none' }}>

              {/* Riga gara */}
              <div style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 20px', cursor:'pointer', transition:'background 0.12s', background: isExp ? 'var(--accent-light)' : 'transparent' }}
                onClick={() => handleExpand(g.id)}
                onMouseEnter={e=>{ if (!isExp) e.currentTarget.style.background='var(--accent-light)' }}
                onMouseLeave={e=>{ if (!isExp) e.currentTarget.style.background='transparent' }}>
                {isExp ? <ChevronDown size={14} color="var(--t3)" style={{ flexShrink:0 }} /> : <ChevronRight size={14} color="var(--t3)" style={{ flexShrink:0 }} />}
                <div style={{ width:4, height:44, borderRadius:2, background:col, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color:'var(--accent)' }}>{g.codice_gara}</span>
                    <span style={{ fontSize:10, fontWeight:600, color:col, background:`${col}15`, borderRadius:5, padding:'1px 6px', border:`1px solid ${col}25` }}>{g.stato.replace('_',' ')}</span>
                    {urgente && <span style={{ fontSize:10, color:'#ef4444', fontWeight:700 }}>⚠ {gg}gg</span>}
                    {clDone > 0 && <span style={{ fontSize:9, color:'#059669', fontWeight:600 }}>✓ {clDone}/8 docs</span>}
                    {mgl.filter(m=>m.offerta).length > 0 && <span style={{ fontSize:9, color:'#7c3aed', fontWeight:600 }}>★ {mgl.filter(m=>m.offerta).length} migliorie</span>}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }} className="truncate">{g.nome}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{g.committente} · {g.provincia}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', fontFamily:'var(--font-mono)' }}>€ {fmt(g.importo_base)}</div>
                  {g.data_scadenza && <div style={{ fontSize:10, color: urgente?'#ef4444':'var(--t3)', fontFamily:'var(--font-mono)', marginTop:2 }}>Scad: {g.data_scadenza}</div>}
                </div>
              </div>

              {/* ACCORDION DETTAGLIO */}
              {isExp && (
                <div style={{ background:'#f8fafc', borderTop:'1px solid #e2e8f0' }}>

                  {/* Tab bar */}
                  <div style={{ display:'flex', gap:0, borderBottom:'1px solid #e2e8f0', padding:'0 20px', background:'#fff' }}>
                    {[
                      { key:'dati',       label:'📋 Dati gara' },
                      { key:'checklist',  label:`☑️ Checklist offerta (${clDone}/8)` },
                      { key:'migliorie',  label:`★ Migliorie (${mgl.length})` },
                    ].map(t => (
                      <button key={t.key} onClick={e => { e.stopPropagation(); setGaraTab(prev => ({ ...prev, [g.id]: t.key })) }}
                        style={{ padding:'8px 16px', fontSize:12, border:'none', cursor:'pointer', fontWeight: curTab===t.key ? 700 : 400, borderBottom: curTab===t.key ? '2px solid #3b82f6' : '2px solid transparent', background:'transparent', color: curTab===t.key ? '#1d4ed8' : '#6b7280', whiteSpace:'nowrap' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ padding:20 }} onClick={e => e.stopPropagation()}>

                    {/* ── TAB 1: DATI GARA ── */}
                    {curTab === 'dati' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, fontSize:12 }}>
                          {[
                            ['Codice gara', g.codice_gara],
                            ['Criterio', g.criterio_aggiudicazione === 'OEP' ? 'Offerta economicamente più vantaggiosa' : 'Minor prezzo'],
                            ['Categoria', g.categoria_prevalente || '—'],
                            ['Provincia', g.provincia || '—'],
                            ['CIG', g.cig || '—'],
                            ['CUP', g.cup || '—'],
                            ['Tipo committente', g.tipo_committente === 'P' ? 'Pubblico' : 'Privato'],
                            ['Data pubblicazione', g.data_pubblicazione || '—'],
                            ['Data scadenza offerta', g.data_scadenza || '—'],
                            ['Importo base d\'asta', '€ ' + fmt2(g.importo_base)],
                            ['Ribasso offerto', g.ribasso_offerto != null ? g.ribasso_offerto + '%' : '—'],
                            ['Punteggio tecnico', g.punteggio_tecnico != null ? String(g.punteggio_tecnico) : '—'],
                          ].map(([l, v]) => (
                            <div key={String(l)} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, padding:'6px 10px' }}>
                              <p style={{ fontSize:9, color:'#9ca3af', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'.04em' }}>{l}</p>
                              <p style={{ fontSize:12, margin:0, fontWeight:500, fontFamily: String(l).includes('CIG')||String(l).includes('CUP')||String(l).includes('Codice') ? 'monospace' : 'inherit' }}>{String(v)}</p>
                            </div>
                          ))}
                        </div>
                        {g.note && <div style={{ padding:'8px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, fontSize:12, color:'#92400e' }}>{g.note}</div>}
                        {g.link_bando && (
                          <a href={g.link_bando} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize:12, color:'#1d4ed8', display:'inline-flex', alignItems:'center', gap:4 }}>
                            🔗 Apri bando / piattaforma ↗
                          </a>
                        )}
                        {g.commessa_id ? (
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:12, color:'#059669', fontWeight:600 }}>✅ Commessa creata</span>
                            <button onClick={() => router.push(`/dashboard/commesse/${g.commessa_id}/anagrafica`)}
                              style={{ fontSize:11, padding:'4px 12px', background:'#059669', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }}>
                              Vai alla commessa →
                            </button>
                          </div>
                        ) : g.stato === 'AGGIUDICATA' && (
                          <button onClick={() => creaCommessa(g)} disabled={creatingComm === g.id}
                            style={{ fontSize:12, padding:'8px 18px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, display:'inline-flex', alignItems:'center', gap:6, alignSelf:'flex-start' }}>
                            {creatingComm === g.id ? '⏳ Creazione...' : '🏆 Crea commessa'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── TAB 2: CHECKLIST OFFERTA ── */}
                    {curTab === 'checklist' && (
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {/* Barra progresso */}
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ width: `${(clDone/8)*100}%`, height:'100%', background: clDone === 8 ? '#059669' : clDone >= 5 ? '#d97706' : '#6b7280', borderRadius:3, transition:'width .3s' }} />
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color: clDone === 8 ? '#059669' : '#374151', flexShrink:0 }}>{clDone}/8</span>
                          {clDone === 8 && <span style={{ fontSize:11, color:'#059669', fontWeight:700 }}>✅ Offerta completa</span>}
                        </div>
                        {CHECKLIST_ITEMS.map(item => {
                          const done = cl[item.key]?.completato || false
                          return (
                            <div key={item.key}
                              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, cursor:'pointer', background: done ? '#f0fdf4' : '#fff', border: '1px solid ' + (done ? '#bbf7d0' : '#e5e7eb') }}
                              onClick={() => toggleChecklist(g.id, item.key)}>
                              <div style={{ width:20, height:20, borderRadius:4, border:'2px solid ' + (done ? '#059669' : '#d1d5db'), background: done ? '#059669' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                {done && <span style={{ color:'#fff', fontSize:13, lineHeight:1 }}>✓</span>}
                              </div>
                              <span style={{ fontSize:13, color: done ? '#065f46' : '#374151', fontWeight: done ? 600 : 400, flex:1 }}>{item.label}</span>
                              {item.critico && !done && <span style={{ fontSize:9, color:'#dc2626', fontWeight:700, flexShrink:0 }}>CRITICO</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* ── TAB 3: MIGLIORIE PROPOSTE ── */}
                    {curTab === 'migliorie' && (() => {
                      const miglOfferte    = mgl.filter(m => m.offerta)
                      const costoTot       = mgl.reduce((s,m) => s + (m.costo_stimato||0), 0)
                      const costoOfferto   = miglOfferte.reduce((s,m) => s + (m.costo_stimato||0), 0)
                      const puntiTot       = miglOfferte.reduce((s,m) => s + (m.punteggio_tecnico_stimato||0), 0)
                      const ribasso        = parseFloat(simRibasso[g.id] || '0') || 0
                      const importoOfferta = g.importo_base * (1 - ribasso / 100)
                      const margine        = importoOfferta > 0 ? ((importoOfferta - costoOfferto) / importoOfferta) * 100 : 0
                      const margColor      = margine >= 15 ? '#059669' : margine >= 5 ? '#d97706' : margine >= 0 ? '#dc2626' : '#991b1b'
                      return (
                        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                          {/* KPI migliorie */}
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                            {[
                              { l:'Migliorie valutate', v: String(mgl.length), c:'#6b7280' },
                              { l:'Offerte',            v: String(miglOfferte.length), c:'#7c3aed' },
                              { l:'Costo totale',       v:'€ ' + fmt2(costoTot), c:'#dc2626' },
                            ].map(k => (
                              <div key={k.l} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px' }}>
                                <p style={{ fontSize:9, color:'#6b7280', margin:'0 0 2px', textTransform:'uppercase' }}>{k.l}</p>
                                <p style={{ fontSize:15, fontWeight:700, margin:0, color:k.c }}>{k.v}</p>
                              </div>
                            ))}
                          </div>

                          {/* Lista migliorie */}
                          {mgl.map(m => {
                            const cat = CATEGORIE_MIGLIORIA.find(c => c.value === m.categoria)
                            return (
                              <div key={m.id} style={{ padding:'10px 14px', background: m.offerta ? '#f5f3ff' : '#fff', border:'1px solid ' + (m.offerta ? '#ddd6fe' : '#e5e7eb'), borderRadius:10 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                                  <span style={{ fontSize:9, padding:'1px 7px', borderRadius:3, fontWeight:700, background: (cat?.color||'#6b7280') + '18', color: cat?.color||'#6b7280' }}>{cat?.label||m.categoria}</span>
                                  <span style={{ flex:1, fontSize:12, fontWeight:600, color:'#374151' }}>{m.descrizione}</span>
                                  <button onClick={() => toggleOfferta(g.id, m.id, !m.offerta)}
                                    style={{ fontSize:11, padding:'3px 10px', background: m.offerta ? '#7c3aed' : '#f3f4f6', color: m.offerta ? '#fff' : '#6b7280', border:'none', borderRadius:5, cursor:'pointer', fontWeight:600, flexShrink:0 }}>
                                    {m.offerta ? '★ Offerta' : '○ Offri'}
                                  </button>
                                  <button onClick={() => eliminaMiglioria(g.id, m.id)} style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'#dc2626', padding:0, flexShrink:0 }}>🗑</button>
                                </div>
                                <div style={{ display:'flex', gap:12, fontSize:11, color:'#6b7280' }}>
                                  <span>Costo: <strong style={{ color:'#dc2626' }}>€ {fmt2(m.costo_stimato)}</strong></span>
                                  {m.punteggio_tecnico_stimato > 0 && <span>Punti tecnici: <strong style={{ color:'#7c3aed' }}>+{m.punteggio_tecnico_stimato}</strong></span>}
                                  {m.note && <span style={{ fontStyle:'italic' }}>{m.note}</span>}
                                </div>
                              </div>
                            )
                          })}

                          {/* Form aggiungi miglioria */}
                          {miglFormId !== g.id ? (
                            <button onClick={() => setMiglFormId(g.id)}
                              style={{ fontSize:11, padding:'6px 14px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:6, cursor:'pointer', fontWeight:600, alignSelf:'flex-start' }}>
                              + Aggiungi miglioria
                            </button>
                          ) : (
                            <div style={{ padding:12, background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:8, display:'flex', flexDirection:'column', gap:8 }}>
                              <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 90px 80px', gap:8 }}>
                                <div>
                                  <label style={{ fontSize:9, color:'#6b7280', display:'block', marginBottom:2 }}>Categoria</label>
                                  <select value={fmCat} onChange={e => setFmCat(e.target.value)} style={{ fontSize:11, border:'1px solid #d1d5db', borderRadius:5, padding:'4px 6px', width:'100%' }}>
                                    {CATEGORIE_MIGLIORIA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize:9, color:'#6b7280', display:'block', marginBottom:2 }}>Descrizione *</label>
                                  <input value={fmDesc} onChange={e => setFmDesc(e.target.value)} style={{ fontSize:11, border:'1px solid #d1d5db', borderRadius:5, padding:'4px 6px', width:'100%', boxSizing:'border-box' }} />
                                </div>
                                <div>
                                  <label style={{ fontSize:9, color:'#6b7280', display:'block', marginBottom:2 }}>Costo stimato €</label>
                                  <input type="number" value={fmCosto} onChange={e => setFmCosto(e.target.value)} style={{ fontSize:11, border:'1px solid #d1d5db', borderRadius:5, padding:'4px 6px', width:'100%', textAlign:'right', boxSizing:'border-box' }} />
                                </div>
                                <div>
                                  <label style={{ fontSize:9, color:'#6b7280', display:'block', marginBottom:2 }}>Punti tecnici</label>
                                  <input type="number" value={fmPunti} onChange={e => setFmPunti(e.target.value)} style={{ fontSize:11, border:'1px solid #d1d5db', borderRadius:5, padding:'4px 6px', width:'100%', textAlign:'right', boxSizing:'border-box' }} />
                                </div>
                              </div>
                              <input value={fmNote} onChange={e => setFmNote(e.target.value)} placeholder="Note opzionali"
                                style={{ fontSize:11, border:'1px solid #d1d5db', borderRadius:5, padding:'4px 6px' }} />
                              <div style={{ display:'flex', gap:6 }}>
                                <button onClick={() => aggiungiMiglioria(g.id)} style={{ fontSize:11, padding:'4px 14px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontWeight:600 }}>Aggiungi</button>
                                <button onClick={() => setMiglFormId(null)} style={{ fontSize:11, padding:'4px 10px', background:'none', border:'1px solid #d1d5db', borderRadius:5, cursor:'pointer' }}>Annulla</button>
                              </div>
                            </div>
                          )}

                          {/* Simulatore */}
                          <div style={{ padding:14, background:'#fff', border:'2px solid #e5e7eb', borderRadius:10, marginTop:4 }}>
                            <p style={{ fontSize:11, fontWeight:700, color:'#374151', margin:'0 0 10px', textTransform:'uppercase', letterSpacing:'.04em' }}>📊 Simulatore margine offerta</p>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                              <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12 }}>
                                <div style={{ display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ color:'#6b7280' }}>Importo base d'asta</span>
                                  <span style={{ fontFamily:'monospace', fontWeight:600 }}>€ {fmt2(g.importo_base)}</span>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                                  <span style={{ color:'#6b7280' }}>Ribasso proposto</span>
                                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                    <input type="number" min="0" max="50" step="0.1" value={simRibasso[g.id] || ''}
                                      onChange={e => setSimRibasso(prev => ({ ...prev, [g.id]: e.target.value }))}
                                      style={{ width:60, fontSize:11, border:'1px solid #d1d5db', borderRadius:4, padding:'2px 6px', textAlign:'right' }}
                                    /> %
                                  </div>
                                </div>
                                <div style={{ display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ color:'#6b7280' }}>Importo offerta</span>
                                  <span style={{ fontFamily:'monospace', fontWeight:700 }}>€ {fmt2(importoOfferta)}</span>
                                </div>
                                <div style={{ display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ color:'#dc2626' }}>− Costo migliorie offerte</span>
                                  <span style={{ fontFamily:'monospace', color:'#dc2626', fontWeight:600 }}>− € {fmt2(costoOfferto)}</span>
                                </div>
                                <div style={{ display:'flex', justifyContent:'space-between', paddingTop:6, borderTop:'1px solid #e5e7eb', fontWeight:700, fontSize:13 }}>
                                  <span style={{ color: margColor }}>Margine stimato</span>
                                  <span style={{ fontFamily:'monospace', color: margColor }}>€ {fmt2(importoOfferta - costoOfferto)} ({margine.toFixed(1)}%)</span>
                                </div>
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12 }}>
                                <div style={{ display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ color:'#7c3aed' }}>Migliorie offerte</span>
                                  <span style={{ fontWeight:600 }}>{miglOfferte.length}</span>
                                </div>
                                <div style={{ display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ color:'#7c3aed' }}>Punteggio tecnico stimato</span>
                                  <span style={{ fontFamily:'monospace', fontWeight:700, color:'#7c3aed' }}>+{puntiTot} pt</span>
                                </div>
                                {miglOfferte.length > 0 && (
                                  <div style={{ marginTop:4 }}>
                                    {miglOfferte.map(m => (
                                      <div key={m.id} style={{ fontSize:10, color:'#6b7280', padding:'1px 0' }}>
                                        • {m.descrizione.slice(0,40)} — € {fmt2(m.costo_stimato)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* MODAL NUOVA GARA */}
      {showNuova && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: step==='FORM' ? 680 : 480 }}>

            {step === 'UPLOAD' && (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                  <div>
                    <h2 style={{ fontSize:18, fontWeight:800, color:'#1e293b', margin:0 }}>Nuova Gara</h2>
                    <p style={{ fontSize:12, color:'#64748b', marginTop:3 }}>Importa il bando oppure inserisci manualmente</p>
                  </div>
                  <button onClick={()=>setShowNuova(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:8, cursor:'pointer' }}><X size={15} color="#64748b" /></button>
                </div>
                <div onClick={()=>fileRef.current?.click()} style={{ border:'2px dashed #e2e8f0', borderRadius:14, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:'#f8fafc', marginBottom:16 }}>
                  <div style={{ width:52, height:52, borderRadius:14, background:'rgba(59,130,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}><Upload size={24} color="#3b82f6" /></div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:6 }}>Importa bando di gara</div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>PDF, DOCX, TXT — Disciplinare, Avviso, Determina</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:11, color:'#3b82f6', fontWeight:600 }}><Sparkles size={13} /> AI estrae dati, importo, CIG, scadenza in automatico</div>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFileImport(f) }} />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ flex:1, height:1, background:'#e2e8f0' }} /><span style={{ fontSize:11, color:'#94a3b8' }}>oppure</span><div style={{ flex:1, height:1, background:'#e2e8f0' }} />
                </div>
                <button onClick={()=>setStep('FORM')} className="btn-secondary" style={{ width:'100%', justifyContent:'center' }}>Inserisci dati manualmente</button>
              </>
            )}

            {step === 'AI_LOADING' && (
              <div style={{ textAlign:'center', padding:'48px 24px' }}>
                <div style={{ width:56, height:56, borderRadius:16, background:'rgba(59,130,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}><TrendingUp size={28} color="#3b82f6" /></div>
                <div style={{ fontSize:16, fontWeight:700, color:'#1e293b', marginBottom:8 }}>AI analizza il bando</div>
                <div style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>{aiStatus}</div>
                <div className="spinner" style={{ margin:'0 auto' }} />
              </div>
            )}

            {step === 'FORM' && (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                  <div>
                    <h2 style={{ fontSize:18, fontWeight:800, color:'#1e293b', margin:0 }}>Dati gara</h2>
                    {aiStatus && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, fontSize:11, color: aiStatus.startsWith('✅')?'#10b981':aiStatus.startsWith('⚠')?'#f59e0b':'#64748b' }}>
                        {aiStatus.startsWith('✅') ? <CheckCircle size={12} /> : aiStatus.startsWith('⚠') ? <AlertCircle size={12} /> : null}
                        {aiStatus}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setShowNuova(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:8, cursor:'pointer' }}><X size={15} color="#64748b" /></button>
                </div>
                <div style={{ maxHeight:'60vh', overflowY:'auto', paddingRight:4 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div><label style={lbl}>Codice gara *</label><input value={form.codice_gara} onChange={e=>setF('codice_gara',e.target.value)} style={{ ...inp, fontFamily:'monospace', fontWeight:700 }} /><div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>Modificabile prima della conferma</div></div>
                    <div><label style={lbl}>Criterio aggiudicazione</label><select value={form.criterio_aggiudicazione} onChange={e=>setF('criterio_aggiudicazione',e.target.value)} style={{ ...inp, width:'100%' }}><option value="OEP">Offerta economicamente più vantaggiosa</option><option value="MPR">Minor prezzo</option></select></div>
                    <div style={{ gridColumn:'span 2' }}><label style={lbl}>Nome / Oggetto gara *</label><input value={form.nome} onChange={e=>setF('nome',e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>Committente / Stazione appaltante</label><input value={form.committente} onChange={e=>setF('committente',e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>Tipo committente</label><select value={form.tipo_committente} onChange={e=>setF('tipo_committente',e.target.value)} style={{ ...inp, width:'100%' }}><option value="P">Pubblico</option><option value="PR">Privato</option></select></div>
                    <div><label style={lbl}>CIG</label><input value={form.cig} onChange={e=>setF('cig',e.target.value)} style={{ ...inp, fontFamily:'monospace' }} /></div>
                    <div><label style={lbl}>CUP</label><input value={form.cup} onChange={e=>setF('cup',e.target.value)} style={{ ...inp, fontFamily:'monospace' }} /></div>
                    <div><label style={lbl}>Importo base d&apos;asta (€)</label><input type="number" min={0} step={0.01} value={form.importo_base||''} onChange={e=>setF('importo_base',parseFloat(e.target.value)||0)} style={{ ...inp, fontFamily:'monospace' }} /></div>
                    <div><label style={lbl}>Categoria prevalente</label><input value={form.categoria_prevalente} onChange={e=>setF('categoria_prevalente',e.target.value)} placeholder="es. OG1, OG3..." style={inp} /></div>
                    <div><label style={lbl}>Provincia</label><select value={form.provincia} onChange={e=>setF('provincia',e.target.value)} style={{ ...inp, width:'100%' }}>{PROVINCE_IT.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                    <div><label style={lbl}>Data pubblicazione</label><input type="date" value={form.data_pubblicazione} onChange={e=>setF('data_pubblicazione',e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>Data scadenza offerta</label><input type="date" value={form.data_scadenza} onChange={e=>setF('data_scadenza',e.target.value)} style={inp} /></div>
                    <div style={{ gridColumn:'span 2' }}><label style={lbl}>Link bando / piattaforma</label><input value={form.link_bando} onChange={e=>setF('link_bando',e.target.value)} placeholder="https://..." style={inp} /></div>
                    <div style={{ gridColumn:'span 2' }}><label style={lbl}>Note / Analisi preliminare</label><textarea value={form.note} onChange={e=>setF('note',e.target.value)} rows={3} style={{ ...inp, resize:'vertical', width:'100%' }} /></div>
                  </div>
                </div>
                <div style={{ marginTop:20, display:'flex', justifyContent:'space-between' }}>
                  <button onClick={()=>setStep('UPLOAD')} className="btn-secondary" style={{ fontSize:12 }}>← Importa bando</button>
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={()=>setShowNuova(false)} className="btn-secondary">Annulla</button>
                    <button onClick={creaGara} disabled={saving||!form.nome} className="btn-primary"><Save size={14} /> {saving?'Salvataggio...':'Crea gara'}</button>
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
