'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Search, ArrowRight, Upload, Sparkles, MapPin, X, Save, CheckCircle, AlertCircle, ChevronDown, AlertTriangle } from 'lucide-react'

interface Commessa {
  id: string
  codice: string
  nome: string
  committente: string
  stato: string
  importo_aggiudicato: number
  avanzamento_pct: number
}

interface FormCommessa {
  codice: string; nome: string; committente: string; cig: string; cup: string
  importo_base: number; importo_aggiudicato: number; ribasso_pct: number; oneri_sicurezza: number
  provincia: string; categoria: string; tipo_committente: string; stato: string
  indirizzo_cantiere: string; citta_cantiere: string; lat: string; lng: string
  data_aggiudicazione: string; data_fine_contrattuale: string; durata_giorni: number; note: string
  rup_nome: string; rup_email: string; rup_telefono: string
  dl_nome: string; dl_email: string; dl_telefono: string
  direttore_operativo_nome: string; direttore_operativo_email: string
  ispettore_cantiere_nome: string; ispettore_cantiere_email: string
  csp_nome: string; csp_email: string; cse_nome: string; cse_email: string
  collaudatore_nome: string; collaudatore_email: string
  collaudatore_statico_nome: string; collaudatore_statico_email: string
  rc_nome: string; rc_email: string; rc_telefono: string
  direttore_tecnico_nome: string; direttore_tecnico_email: string
  capocantiere_nome: string; capocantiere_telefono: string
  rspp_nome: string; rspp_email: string
  preposto_nome: string; preposto_telefono: string
  responsabile_qualita_nome: string; responsabile_qualita_email: string
}

const PROVINCE_IT = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OG','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']
const STATI = ['IN_ESECUZIONE','AGGIUDICATA','COLLAUDO','SOSPESA','CHIUSA']
const STATO_COLOR: Record<string, string> = { IN_ESECUZIONE:'#10b981', AGGIUDICATA:'#3b82f6', COLLAUDO:'#8b5cf6', SOSPESA:'#ef4444', CHIUSA:'#64748b' }
const AZIENDA_ID = 'f5ddf460-715a-495e-997a-0246ea73326b'

const FORM_VUOTO: FormCommessa = {
  codice:'', nome:'', committente:'', cig:'', cup:'',
  importo_base:0, importo_aggiudicato:0, ribasso_pct:0, oneri_sicurezza:0,
  provincia:'NA', categoria:'GE', tipo_committente:'P', stato:'AGGIUDICATA',
  indirizzo_cantiere:'', citta_cantiere:'', lat:'', lng:'',
  data_aggiudicazione: new Date().toISOString().slice(0,10),
  data_fine_contrattuale:'', durata_giorni:365, note:'',
  rup_nome:'', rup_email:'', rup_telefono:'',
  dl_nome:'', dl_email:'', dl_telefono:'',
  direttore_operativo_nome:'', direttore_operativo_email:'',
  ispettore_cantiere_nome:'', ispettore_cantiere_email:'',
  csp_nome:'', csp_email:'', cse_nome:'', cse_email:'',
  collaudatore_nome:'', collaudatore_email:'',
  collaudatore_statico_nome:'', collaudatore_statico_email:'',
  rc_nome:'', rc_email:'', rc_telefono:'',
  direttore_tecnico_nome:'', direttore_tecnico_email:'',
  capocantiere_nome:'', capocantiere_telefono:'',
  rspp_nome:'', rspp_email:'',
  preposto_nome:'', preposto_telefono:'',
  responsabile_qualita_nome:'', responsabile_qualita_email:'',
}

function fmt(n: number) { return (n||0).toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:0}) }
function generaCodice(prov: string, cat: string, prog: number) {
  const aa = String(new Date().getFullYear()).slice(-2)
  return `${aa}.${(prov||'NA').toUpperCase().slice(0,3)}.${(cat||'GE').toUpperCase().slice(0,2)}.${String(prog).padStart(3,'0')}`
}

type Step = 'UPLOAD' | 'AI_LOADING' | 'FORM'

export default function CommessePage() {
  const router = useRouter()
  const [commesse, setCommesse] = useState<Commessa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('TUTTI')
  const [showNuova, setShowNuova] = useState(false)
  const [step, setStep] = useState<Step>('UPLOAD')
  const [aiMsg, setAiMsg] = useState('')
  const [aiOk, setAiOk] = useState<boolean|null>(null)
  const [saving, setSaving] = useState(false)
  const [erroreInsert, setErroreInsert] = useState('')
  const [showFigure, setShowFigure] = useState(false)
  const [sezFigure, setSezFigure] = useState<'sa'|'impresa'>('sa')
  const [form, setForm] = useState<FormCommessa>({...FORM_VUOTO})
  const fileRef = useRef<HTMLInputElement>(null)
  const [deleteId, setDeleteId] = useState<string|null>(null)
  const [deleteStep, setDeleteStep] = useState(0)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data } = await supabase
      .from('v_commesse_kpi')
      .select('id,codice,nome,committente,stato,importo_aggiudicato,avanzamento_pct')
      .order('stato')
    if (data) setCommesse(data as Commessa[])
    setLoading(false)
  }

  function setStr(k: keyof FormCommessa, v: string) { setForm(p => ({...p, [k]: v})) }
  function setNum(k: keyof FormCommessa, v: number) { setForm(p => ({...p, [k]: v})) }

  async function geocodifica() {
    if (!form.indirizzo_cantiere || !form.citta_cantiere) return
    try {
      const q = encodeURIComponent(`${form.indirizzo_cantiere}, ${form.citta_cantiere}, Italia`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`)
      const data = await res.json() as Array<{lat:string;lon:string}>
      if (data[0]) { setStr('lat', data[0].lat); setStr('lng', data[0].lon) }
    } catch { /* silenzioso */ }
  }

  // ── AI IMPORT CONTRATTO (PDF, DOCX, TXT) ──────────────────────────────────
  async function handleFileImport(file: File) {
    setStep('AI_LOADING'); setAiMsg('Analisi documento...'); setAiOk(null)
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type.includes('officedocument')

      setAiMsg(isPdf ? '📄 AI legge il PDF...' : isDocx ? '📝 Analisi DOCX...' : '🔍 AI estrae i dati...')

      const fd = new FormData()
      if (isPdf || isDocx) {
        fd.append('file', file)
      } else {
        const testo = await file.text()
        fd.append('testo', testo.slice(0, 9000))
      }

      const res = await fetch('/api/ai-import-contratto', { method: 'POST', body: fd })
      const json = await res.json() as { ok: boolean; dati?: Record<string, unknown>; errore?: string }

      if (json.ok && json.dati) {
        const d = json.dati
        const s = (v: unknown) => typeof v === 'string' ? v : ''
        const n = (v: unknown) => parseFloat(String(v || '0')) || 0
        const prov = (s(d.provincia) || 'NA').toUpperCase().slice(0, 2)
        const cat = (s(d.categoria_prevalente) || 'GE').toUpperCase().slice(0, 2)
        const durataGg = parseInt(String(d.durata_gg || d.durata_giorni || '365')) || 365

        setForm(p => ({
          ...p,
          codice: generaCodice(prov, cat, commesse.length + 1),
          nome: s(d.nome) || p.nome,
          committente: s(d.committente) || p.committente,
          cig: s(d.cig) || p.cig,
          cup: s(d.cup) || p.cup,
          importo_base: n(d.importo_base) || p.importo_base,
          importo_aggiudicato: n(d.importo_aggiudicato) || n(d.importo_base) || p.importo_aggiudicato,
          ribasso_pct: n(d.ribasso_pct) || p.ribasso_pct,
          oneri_sicurezza: n(d.oneri_sicurezza) || p.oneri_sicurezza,
          provincia: prov,
          categoria: cat,
          data_aggiudicazione: s(d.data_aggiudicazione) || p.data_aggiudicazione,
          durata_giorni: durataGg,
          indirizzo_cantiere: s(d.indirizzo_cantiere) || p.indirizzo_cantiere,
          citta_cantiere: s(d.citta_cantiere) || p.citta_cantiere,
          rup_nome: s(d.rup_nome) || p.rup_nome,
          rup_email: s(d.rup_email) || p.rup_email,
          rup_telefono: s(d.rup_telefono) || p.rup_telefono,
          dl_nome: s(d.dl_nome) || p.dl_nome,
          dl_email: s(d.dl_email) || p.dl_email,
          dl_telefono: s(d.dl_telefono) || p.dl_telefono,
          csp_nome: s(d.csp_nome) || p.csp_nome,
          cse_nome: s(d.cse_nome) || p.cse_nome,
          note: s(d.note) || p.note,
        }))
        setAiOk(true)
        setAiMsg('✅ Dati estratti — verifica e integra i campi mancanti')
      } else {
        setAiOk(false)
        setAiMsg(`⚠️ ${json.errore || 'Estrazione parziale'} — compila manualmente i campi`)
      }
    } catch (e) {
      setAiOk(false)
      setAiMsg(`❌ ${String(e)} — inserisci i dati manualmente`)
    }
    setStep('FORM')
  }

  async function creaCommessa() {
    if (!form.nome.trim() || !form.committente.trim()) return
    setSaving(true); setErroreInsert('')
    try {
      let aziendaId = AZIENDA_ID
      try {
        const { data: ut } = await supabase.auth.getUser()
        if (ut.user?.id) {
          const { data: utData } = await supabase.from('utenti').select('azienda_id').eq('id', ut.user.id).single()
          if (utData?.azienda_id) aziendaId = utData.azienda_id
        }
      } catch { /* fallback */ }

      const progressivo = commesse.length + 1
      const { data, error } = await supabase.from('commesse').insert([{
        azienda_id: aziendaId,
        codice: form.codice || generaCodice(form.provincia, form.categoria, progressivo),
        anno: new Date().getFullYear(),
        progressivo,
        nome: form.nome.trim(),
        committente: form.committente.trim(),
        cig: form.cig || null,
        cup: form.cup || null,
        importo_base: form.importo_base || 0,
        importo_aggiudicato: form.importo_aggiudicato || form.importo_base || 0,
        ribasso_pct: form.ribasso_pct || 0,
        oneri_sicurezza: form.oneri_sicurezza || 0,
        provincia: form.provincia || 'NA',
        categoria: form.categoria || 'GE',
        tipo_committente: form.tipo_committente || 'P',
        stato: form.stato || 'AGGIUDICATA',
        data_aggiudicazione: form.data_aggiudicazione || null,
        data_fine_contrattuale: form.data_fine_contrattuale || null,
        durata_gg: form.durata_giorni || 365,
        rup_nome: form.rup_nome || null,
        rup_email: form.rup_email || null,
        dl_nome: form.dl_nome || null,
        dl_email: form.dl_email || null,
        csp_nome: form.csp_nome || null,
        cse_nome: form.cse_nome || null,
        note: form.note || null,
      }]).select('id,codice').single()

      if (error) { setErroreInsert(`Errore DB: ${error.message} [${error.code}]`); return }
      if (!data) { setErroreInsert('Errore: nessun dato ricevuto — riprova'); return }

      setShowNuova(false)
      await carica()
      router.push(`/dashboard/commesse/${data.id}`)
    } catch (err) {
      setErroreInsert(`Errore imprevisto: ${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function eliminaCommessa(id: string) {
    const { error } = await supabase.from('commesse').delete().eq('id', id)
    if (!error) { setDeleteId(null); setDeleteStep(0); await carica() }
    else alert('Errore eliminazione: ' + error.message)
  }

  function apriNuova() {
    setStep('UPLOAD'); setAiMsg(''); setAiOk(null); setErroreInsert('')
    setForm({...FORM_VUOTO, codice: generaCodice('NA','GE',commesse.length+1)})
    setShowNuova(true)
  }

  const filtrate = commesse.filter(c => {
    const ms = filtroStato === 'TUTTI' || c.stato === filtroStato
    const mq = !search || [c.nome,c.codice,c.committente].some(x => x?.toLowerCase().includes(search.toLowerCase()))
    return ms && mq
  })

  const portafoglio = commesse.filter(c=>c.stato!=='CHIUSA').reduce((s,c)=>s+(c.importo_aggiudicato||0),0)

  const inp: React.CSSProperties = { width:'100%', boxSizing:'border-box' as const, background:'#fff', border:'1px solid #e2e8f0', borderRadius:7, padding:'8px 10px', color:'#1e293b', fontSize:13 }
  const lbl: React.CSSProperties = { fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:4 }
  const si: React.CSSProperties = { ...inp, padding:'6px 8px', fontSize:12 }
  const sl: React.CSSProperties = { ...lbl, fontSize:9 }

  const figSA: Array<{k:keyof FormCommessa;l:string}> = [
    {k:'rup_nome',l:'RUP — Nome'},{k:'rup_email',l:'RUP — Email'},{k:'rup_telefono',l:'RUP — Tel.'},
    {k:'dl_nome',l:'DL — Nome'},{k:'dl_email',l:'DL — Email'},{k:'dl_telefono',l:'DL — Tel.'},
    {k:'direttore_operativo_nome',l:'Dir. Operativo'},{k:'direttore_operativo_email',l:'Dir. Op. Email'},
    {k:'ispettore_cantiere_nome',l:'Ispettore'},{k:'ispettore_cantiere_email',l:'Ispettore Email'},
    {k:'csp_nome',l:'CSP — Nome'},{k:'csp_email',l:'CSP — Email'},
    {k:'cse_nome',l:'CSE — Nome'},{k:'cse_email',l:'CSE — Email'},
    {k:'collaudatore_nome',l:'Collaudatore'},{k:'collaudatore_email',l:'Coll. Email'},
    {k:'collaudatore_statico_nome',l:'Coll. Statico'},{k:'collaudatore_statico_email',l:'Coll. Stat. Email'},
  ]

  const figI: Array<{k:keyof FormCommessa;l:string}> = [
    {k:'rc_nome',l:'Resp. Commessa'},{k:'rc_email',l:'RC — Email'},{k:'rc_telefono',l:'RC — Tel.'},
    {k:'direttore_tecnico_nome',l:'Dir. Tecnico'},{k:'direttore_tecnico_email',l:'Dir. Tec. Email'},
    {k:'capocantiere_nome',l:'Capocantiere'},{k:'capocantiere_telefono',l:'Capo — Tel.'},
    {k:'rspp_nome',l:'RSPP — Nome'},{k:'rspp_email',l:'RSPP — Email'},
    {k:'preposto_nome',l:'Preposto'},{k:'preposto_telefono',l:'Preposto — Tel.'},
    {k:'responsabile_qualita_nome',l:'Resp. Qualità'},{k:'responsabile_qualita_email',l:'RQ — Email'},
  ]

  return (
    <div style={{padding:'22px 28px',background:'var(--bg)',minHeight:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:'var(--t1)',margin:0}}>Commesse</h1>
          <p style={{fontSize:12,color:'var(--t3)',marginTop:3}}>{commesse.filter(c=>c.stato!=='CHIUSA').length} attive · Portafoglio: € {fmt(portafoglio)}</p>
        </div>
        <button onClick={apriNuova} className="btn-primary">+ Nuova commessa</button>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:240}}>
          <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--t3)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca nome, codice, committente..."
            style={{width:'100%',background:'var(--panel)',border:'1px solid var(--border)',borderRadius:9,padding:'9px 12px 9px 34px',fontSize:13,color:'var(--t1)',boxSizing:'border-box' as const}}/>
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {['TUTTI',...STATI].map(s=>(
            <button key={s} onClick={()=>setFiltroStato(s)} style={{padding:'7px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:11,fontWeight:600,cursor:'pointer',background:filtroStato===s?(STATO_COLOR[s]||'var(--accent)'):'var(--panel)',color:filtroStato===s?'white':'var(--t3)',whiteSpace:'nowrap' as const}}>
              {s==='TUTTI'?'Tutte':s.replace('_',' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:48,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}}/></div>
        ) : filtrate.length===0 ? (
          <div style={{padding:'60px 32px',textAlign:'center',color:'var(--t3)',fontSize:13}}>
            {commesse.length===0?'Nessuna commessa — clicca "+ Nuova commessa"':'Nessun risultato'}
          </div>
        ) : filtrate.map((c,i)=>{
          const col=STATO_COLOR[c.stato]||'#6b7280'
          return (
            <div key={c.id} onClick={()=>router.push(`/dashboard/commesse/${c.id}`)}
              style={{display:'flex',alignItems:'center',gap:14,padding:'13px 20px',borderBottom:i<filtrate.length-1?'1px solid var(--border)':'none',cursor:'pointer',transition:'background 0.12s'}}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <div style={{width:4,height:44,borderRadius:2,background:col,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700,color:'var(--accent)'}}>{c.codice}</span>
                  <span style={{fontSize:10,fontWeight:600,color:col,background:`${col}15`,borderRadius:5,padding:'1px 6px'}}>{c.stato.replace('_',' ')}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--t1)'}} className="truncate">{c.nome}</div>
                <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{c.committente}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:80,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{width:`${c.avanzamento_pct||0}%`,height:'100%',background:col}}/>
                </div>
                <span style={{fontSize:10,color:'var(--t3)',width:28}}>{c.avanzamento_pct||0}%</span>
              </div>
              <div style={{fontSize:14,fontWeight:800,color:'var(--t1)',fontFamily:'var(--font-mono)',flexShrink:0}}>€ {fmt(c.importo_aggiudicato)}</div>
              <button onClick={e=>{e.stopPropagation();setDeleteId(c.id);setDeleteStep(1)}}
                style={{background:'none',border:'none',cursor:'pointer',padding:'4px 6px',borderRadius:6,color:'#ef4444',opacity:0.6}} title="Elimina">🗑</button>
              <ArrowRight size={14} color="var(--t4)"/>
            </div>
          )
        })}
      </div>

      {/* MODAL DELETE */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box" style={{maxWidth:420,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>{deleteStep===1?'🗑':'⚠️'}</div>
            {deleteStep===1 && <>
              <h2 style={{fontSize:17,fontWeight:800,color:'#1e293b',marginBottom:8}}>Elimina commessa?</h2>
              <p style={{fontSize:13,color:'#64748b',marginBottom:20}}>L'operazione è irreversibile. Tutti i dati verranno eliminati.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={()=>{setDeleteId(null);setDeleteStep(0)}} className="btn-secondary">Annulla</button>
                <button onClick={()=>setDeleteStep(2)} style={{background:'#ef4444',color:'white',border:'none',borderRadius:8,padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>Sì, elimina</button>
              </div>
            </>}
            {deleteStep===2 && <>
              <h2 style={{fontSize:17,fontWeight:800,color:'#ef4444',marginBottom:8}}>Conferma eliminazione</h2>
              <p style={{fontSize:13,color:'#64748b',marginBottom:20}}>Sei sicuro? Questa azione non può essere annullata.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={()=>{setDeleteId(null);setDeleteStep(0)}} className="btn-secondary">Annulla</button>
                <button onClick={()=>eliminaCommessa(deleteId)} style={{background:'#dc2626',color:'white',border:'none',borderRadius:8,padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>ELIMINA DEFINITIVAMENTE</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* MODAL NUOVA COMMESSA */}
      {showNuova && (
        <div className="modal-overlay">
          <div className="modal-box" style={{maxWidth:step==='FORM'?780:480}}>

            {step==='UPLOAD' && <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div><h2 style={{fontSize:18,fontWeight:800,color:'#1e293b',margin:0}}>Nuova Commessa</h2><p style={{fontSize:12,color:'#64748b',marginTop:3}}>Importa documento o inserisci manualmente</p></div>
                <button onClick={()=>setShowNuova(false)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:8,cursor:'pointer'}}><X size={15} color="#64748b"/></button>
              </div>
              <div onClick={()=>fileRef.current?.click()} style={{border:'2px dashed #e2e8f0',borderRadius:14,padding:'40px 24px',textAlign:'center',cursor:'pointer',background:'#f8fafc',marginBottom:16}}>
                <div style={{width:52,height:52,borderRadius:14,background:'rgba(59,130,246,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}><Upload size={24} color="#3b82f6"/></div>
                <div style={{fontSize:15,fontWeight:700,color:'#1e293b',marginBottom:6}}>Importa documento</div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:6}}>PDF, TXT, DOCX — Contratto, Capitolato, Determina</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontSize:11,color:'#3b82f6',fontWeight:600}}><Sparkles size={13}/> AI compila i campi in automatico</div>
                <input ref={fileRef} type="file" accept=".txt,.doc,.docx,.pdf" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFileImport(f)}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}><div style={{flex:1,height:1,background:'#e2e8f0'}}/><span style={{fontSize:11,color:'#94a3b8'}}>oppure</span><div style={{flex:1,height:1,background:'#e2e8f0'}}/></div>
              <button onClick={()=>setStep('FORM')} className="btn-secondary" style={{width:'100%',justifyContent:'center'}}>Inserisci dati manualmente</button>
            </>}

            {step==='AI_LOADING' && (
              <div style={{textAlign:'center',padding:'48px 24px'}}>
                <div style={{width:56,height:56,borderRadius:16,background:'rgba(59,130,246,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><Sparkles size={28} color="#3b82f6"/></div>
                <div style={{fontSize:16,fontWeight:700,color:'#1e293b',marginBottom:8}}>AI analizza il documento</div>
                <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>{aiMsg}</div>
                <div className="spinner" style={{margin:'0 auto'}}/>
              </div>
            )}

            {step==='FORM' && <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:800,color:'#1e293b',margin:0}}>Dati commessa</h2>
                  {aiMsg && <div style={{display:'flex',alignItems:'center',gap:6,marginTop:5,fontSize:11,color:aiOk===true?'#10b981':'#f59e0b'}}>{aiOk===true?<CheckCircle size={12}/>:<AlertCircle size={12}/>}{aiMsg}</div>}
                </div>
                <button onClick={()=>setShowNuova(false)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:8,cursor:'pointer',flexShrink:0}}><X size={15} color="#64748b"/></button>
              </div>

              {erroreInsert && (
                <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#ef4444',display:'flex',gap:8}}>
                  <AlertTriangle size={14} style={{flexShrink:0,marginTop:1}}/>{erroreInsert}
                </div>
              )}

              <div style={{maxHeight:'62vh',overflowY:'auto',paddingRight:4}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <label style={lbl}>Codice *</label>
                    <div style={{display:'flex',gap:6}}>
                      <input value={form.codice} onChange={e=>setStr('codice',e.target.value)} style={{...inp,fontFamily:'monospace',fontWeight:700,flex:1}}/>
                      <button onClick={()=>setStr('codice',generaCodice(form.provincia,form.categoria,commesse.length+1))} style={{padding:'8px 10px',borderRadius:7,border:'1px solid var(--border)',background:'var(--bg)',cursor:'pointer',color:'var(--accent)'}}>↺</button>
                    </div>
                  </div>
                  <div><label style={lbl}>Stato</label><select value={form.stato} onChange={e=>setStr('stato',e.target.value)} style={{...inp,width:'100%'}}>{STATI.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></div>
                  <div style={{gridColumn:'span 2'}}><label style={lbl}>Nome / Oggetto lavori *</label><input value={form.nome} onChange={e=>setStr('nome',e.target.value)} placeholder="es. Riqualificazione Scuola Media Viale Mazzini" style={inp}/></div>
                  <div><label style={lbl}>Committente *</label><input value={form.committente} onChange={e=>setStr('committente',e.target.value)} placeholder="es. Comune di Napoli" style={inp}/></div>
                  <div><label style={lbl}>Tipo committente</label><select value={form.tipo_committente} onChange={e=>setStr('tipo_committente',e.target.value)} style={{...inp,width:'100%'}}><option value="P">Pubblico</option><option value="PR">Privato</option><option value="M">Misto</option></select></div>
                  <div><label style={lbl}>CIG</label><input value={form.cig} onChange={e=>setStr('cig',e.target.value)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>CUP</label><input value={form.cup} onChange={e=>setStr('cup',e.target.value)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Importo base (€)</label><input type="number" min={0} value={form.importo_base||''} onChange={e=>setNum('importo_base',parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Importo aggiudicato (€)</label><input type="number" min={0} value={form.importo_aggiudicato||''} onChange={e=>setNum('importo_aggiudicato',parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Ribasso %</label><input type="number" min={0} max={100} step={0.001} value={form.ribasso_pct||''} onChange={e=>setNum('ribasso_pct',parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Oneri sicurezza (€)</label><input type="number" min={0} value={form.oneri_sicurezza||''} onChange={e=>setNum('oneri_sicurezza',parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Provincia</label><select value={form.provincia} onChange={e=>setStr('provincia',e.target.value)} style={{...inp,width:'100%'}}>{PROVINCE_IT.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                  <div><label style={lbl}>Categoria</label><select value={form.categoria} onChange={e=>setStr('categoria',e.target.value)} style={{...inp,width:'100%'}}>{[['GE','Generale'],['RS','Ristrutturazione'],['NR','Nuova Realizzazione'],['ML','Manutenzione'],['SI','Impianti'],['ST','Strade'],['ID','Idraulica'],['EL','Elettrico']].map(([v,l])=><option key={v} value={v}>{v} — {l}</option>)}</select></div>
                  <div><label style={lbl}>Data aggiudicazione</label><input type="date" value={form.data_aggiudicazione} onChange={e=>setStr('data_aggiudicazione',e.target.value)} style={inp}/></div>
                  <div><label style={lbl}>Fine lavori</label><input type="date" value={form.data_fine_contrattuale} onChange={e=>setStr('data_fine_contrattuale',e.target.value)} style={inp}/></div>
                  <div style={{gridColumn:'span 2',paddingTop:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#334155',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><MapPin size={13} color="#3b82f6"/> Localizzazione cantiere</div>
                  </div>
                  <div style={{gridColumn:'span 2'}}><label style={lbl}>Indirizzo cantiere</label><input value={form.indirizzo_cantiere} onChange={e=>setStr('indirizzo_cantiere',e.target.value)} placeholder="Via Roma 1" style={inp}/></div>
                  <div><label style={lbl}>Città</label><input value={form.citta_cantiere} onChange={e=>setStr('citta_cantiere',e.target.value)} style={inp}/></div>
                  <div>
                    <label style={{...lbl,display:'flex',justifyContent:'space-between'}}>Coordinate <button onClick={geocodifica} style={{fontSize:9,color:'#3b82f6',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>📍 Calcola</button></label>
                    <div style={{display:'flex',gap:6}}>
                      <input value={form.lat} onChange={e=>setStr('lat',e.target.value)} placeholder="Lat" style={{...inp,fontFamily:'monospace'}}/>
                      <input value={form.lng} onChange={e=>setStr('lng',e.target.value)} placeholder="Lng" style={{...inp,fontFamily:'monospace'}}/>
                    </div>
                  </div>
                  <div style={{gridColumn:'span 2'}}><label style={lbl}>Note</label><textarea value={form.note} onChange={e=>setStr('note',e.target.value)} rows={2} style={{...inp,resize:'vertical',width:'100%'}}/></div>

                  <div style={{gridColumn:'span 2',marginTop:8}}>
                    <button onClick={()=>setShowFigure(!showFigure)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:showFigure?'rgba(59,130,246,0.06)':'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,color:'#334155'}}>
                      <span>👷 Figure professionali</span><ChevronDown size={14} style={{transform:showFigure?'rotate(180deg)':'none',transition:'0.2s'}}/>
                    </button>
                    {showFigure && (
                      <div style={{border:'1px solid #e2e8f0',borderRadius:10,marginTop:4,overflow:'hidden'}}>
                        <button onClick={()=>setSezFigure('sa')} style={{width:'100%',display:'flex',justifyContent:'space-between',padding:'9px 14px',background:sezFigure==='sa'?'rgba(59,130,246,0.06)':'#f8fafc',border:'none',borderBottom:'1px solid #e2e8f0',cursor:'pointer',fontSize:11,fontWeight:700,color:'#334155'}}>
                          🏛 Stazione Appaltante <ChevronDown size={12}/>
                        </button>
                        {sezFigure==='sa' && (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:'12px 14px',background:'#fafafa'}}>
                            {figSA.map(({k,l})=><div key={k}><label style={sl}>{l}</label><input value={String(form[k]||'')} onChange={e=>setStr(k,e.target.value)} style={si}/></div>)}
                          </div>
                        )}
                        <button onClick={()=>setSezFigure('impresa')} style={{width:'100%',display:'flex',justifyContent:'space-between',padding:'9px 14px',background:sezFigure==='impresa'?'rgba(59,130,246,0.06)':'#f8fafc',border:'none',borderTop:'1px solid #e2e8f0',cursor:'pointer',fontSize:11,fontWeight:700,color:'#334155'}}>
                          🏗 Impresa Esecutrice <ChevronDown size={12}/>
                        </button>
                        {sezFigure==='impresa' && (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:'12px 14px',background:'#fafafa'}}>
                            {figI.map(({k,l})=><div key={k}><label style={sl}>{l}</label><input value={String(form[k]||'')} onChange={e=>setStr(k,e.target.value)} style={si}/></div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{marginTop:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <button onClick={()=>setStep('UPLOAD')} className="btn-secondary" style={{fontSize:12}}>← Documento</button>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <button onClick={()=>setShowNuova(false)} className="btn-secondary">Annulla</button>
                  <button onClick={creaCommessa} disabled={saving||!form.nome.trim()||!form.committente.trim()} className="btn-primary" style={{opacity:(!form.nome.trim()||!form.committente.trim())?0.5:1}}>
                    <Save size={14}/>{saving?'Creazione...':'Crea commessa'}
                  </button>
                </div>
              </div>
              {(!form.nome.trim()||!form.committente.trim()) && (
                <div style={{textAlign:'center',marginTop:8,fontSize:11,color:'#94a3b8'}}>Compila <strong>Nome lavori</strong> e <strong>Committente</strong></div>
              )}
            </>}
          </div>
        </div>
      )}
    </div>
  )
}
