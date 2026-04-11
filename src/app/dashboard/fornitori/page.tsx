'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Upload, Sparkles, X, Save, CheckCircle, AlertCircle, AlertTriangle, Edit2, Phone, Mail } from 'lucide-react'

interface Fornitore {
  id: string; ragione_sociale: string; partita_iva: string
  categoria_soa: string; classifica_soa: string
  email: string; telefono: string; citta: string; provincia: string
  durc_scadenza: string; tipo: string; codice_fornitore: string
}

interface FormFornitore {
  codice_fornitore: string; ragione_sociale: string; partita_iva: string
  codice_fiscale: string; pec: string; email: string; telefono: string
  indirizzo: string; citta: string; provincia: string; cap: string
  codice_sdi: string; categoria_soa: string; classifica_soa: string
  codice_ateco: string; tipo: string
  durc_scadenza: string; soa_scadenza: string; note: string
}

const PROVINCE_IT = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OG','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']
const TIPI = ['SUBAPPALTATORE','FORNITORE_MATERIALI','NOLO','PROFESSIONISTA','LABORATORIO','ALTRO']

function durcInfo(scadenza?: string): { valido: boolean; label: string; color: string } {
  if (!scadenza) return { valido: false, label: 'Non disponibile', color: '#6b7280' }
  const gg = Math.ceil((new Date(scadenza).getTime() - Date.now()) / 86400000)
  if (gg < 0) return { valido: false, label: `Scaduto ${Math.abs(gg)}gg fa`, color: '#ef4444' }
  if (gg <= 30) return { valido: true, label: `Scade in ${gg}gg`, color: '#f59e0b' }
  return { valido: true, label: `Valido`, color: '#10b981' }
}

function generaCodiceForn(prog: number) {
  return `F${String(new Date().getFullYear()).slice(-2)}.${String(prog).padStart(4,'0')}`
}

const FORM_VUOTO: FormFornitore = {
  codice_fornitore:'', ragione_sociale:'', partita_iva:'', codice_fiscale:'',
  pec:'', email:'', telefono:'', indirizzo:'', citta:'', provincia:'NA',
  cap:'', codice_sdi:'', categoria_soa:'', classifica_soa:'',
  codice_ateco:'', tipo:'SUBAPPALTATORE',
  durc_scadenza:'', soa_scadenza:'', note:''
}

type Step = 'UPLOAD' | 'AI_LOADING' | 'FORM'

export default function FornitoriPage() {
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TUTTI')
  const [showNuovo, setShowNuovo] = useState(false)
  const [step, setStep] = useState<Step>('UPLOAD')
  const [aiStatus, setAiStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormFornitore>({ ...FORM_VUOTO })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data } = await supabase.from('fornitori')
      .select('id,codice_fornitore,ragione_sociale,partita_iva,categoria_soa,classifica_soa,email,telefono,citta,provincia,durc_scadenza,tipo')
      .order('ragione_sociale')
    if (data) setFornitori(data as Fornitore[])
    setLoading(false)
  }

  function setF(k: keyof FormFornitore, v: string) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function handleFileImport(file: File) {
    setStep('AI_LOADING')
    setAiStatus('Lettura documento...')
    try {
      const testo = await file.text()
      setAiStatus('AI estrae i dati aziendali...')
      const res = await fetch('/api/ai-estrai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testo.slice(0, 8000), tipo: 'fornitore' })
      })
      const json = await res.json() as { ok: boolean; dati?: Record<string, string> }
      if (json.ok && json.dati) {
        const d = json.dati
        const codice = generaCodiceForn(fornitori.length + 1)
        setForm(p => ({
          ...p,
          codice_fornitore: codice,
          ragione_sociale: d.ragione_sociale || p.ragione_sociale,
          partita_iva: d.partita_iva || p.partita_iva,
          codice_fiscale: d.codice_fiscale || p.codice_fiscale,
          pec: d.pec || p.pec,
          email: d.email || p.email,
          telefono: d.telefono || p.telefono,
          indirizzo: d.indirizzo || p.indirizzo,
          citta: d.citta || p.citta,
          provincia: d.provincia || p.provincia,
          cap: d.cap || p.cap,
          codice_sdi: d.codice_sdi || p.codice_sdi,
          categoria_soa: d.categoria_soa || p.categoria_soa,
          classifica_soa: d.classifica_soa || p.classifica_soa,
          codice_ateco: d.codice_ateco || p.codice_ateco,
          note: d.note || p.note,
        }))
        setAiStatus('✅ Dati estratti — verifica e modifica prima di confermare')
      } else {
        setAiStatus('⚠️ Estrazione parziale — integra i dati mancanti')
      }
    } catch {
      setAiStatus('❌ Errore — inserisci i dati manualmente')
    }
    setStep('FORM')
  }

  async function creaFornitore() {
    if (!form.ragione_sociale) return
    setSaving(true)
    const { data: ut } = await supabase.auth.getUser()
    const { data: utData } = await supabase.from('utenti').select('azienda_id').eq('id', ut.user?.id || '').single()
    const codice = form.codice_fornitore || generaCodiceForn(fornitori.length + 1)
    await supabase.from('fornitori').insert([{
      azienda_id: utData?.azienda_id,
      codice_fornitore: codice,
      ragione_sociale: form.ragione_sociale,
      partita_iva: form.partita_iva || null,
      codice_fiscale: form.codice_fiscale || null,
      pec: form.pec || null,
      email: form.email || null,
      telefono: form.telefono || null,
      indirizzo: form.indirizzo || null,
      citta: form.citta || null,
      provincia: form.provincia || null,
      cap: form.cap || null,
      codice_sdi: form.codice_sdi || null,
      categoria_soa: form.categoria_soa || null,
      classifica_soa: form.classifica_soa || null,
      codice_ateco: form.codice_ateco || null,
      tipo: form.tipo,
      durc_scadenza: form.durc_scadenza || null,
      soa_scadenza: form.soa_scadenza || null,
      note: form.note || null,
    }])
    setSaving(false)
    setShowNuovo(false)
    await carica()
  }

  function apriNuovo() {
    setStep('UPLOAD'); setAiStatus('')
    setForm({ ...FORM_VUOTO, codice_fornitore: generaCodiceForn(fornitori.length + 1) })
    setShowNuovo(true)
  }

  const filtrati = fornitori.filter(f => {
    const mt = filtroTipo === 'TUTTI' || f.tipo === filtroTipo
    const mq = !search || [f.ragione_sociale, f.partita_iva, f.codice_fornitore].some(x => x?.toLowerCase().includes(search.toLowerCase()))
    return mt && mq
  })

  const durcScaduti = fornitori.filter(f => !durcInfo(f.durc_scadenza).valido).length
  const durcOk = fornitori.filter(f => durcInfo(f.durc_scadenza).valido).length

  const inp: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #e2e8f0', borderRadius:7, padding:'8px 10px', color:'#1e293b', fontSize:13 }
  const lbl: React.CSSProperties = { fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }

  return (
    <div style={{ padding:'22px 28px', background:'var(--bg)', minHeight:'100%' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, color:'var(--t1)', margin:0 }}>Fornitori & Subappaltatori</h1>
          <p style={{ fontSize:12, color:'var(--t3)', marginTop:3 }}>
            {fornitori.length} fornitori · DURC ok: {durcOk}
            {durcScaduti > 0 && <span style={{ color:'#ef4444', marginLeft:10 }}>⚠ {durcScaduti} DURC scaduti</span>}
          </p>
        </div>
        <button onClick={apriNuovo} className="btn-primary" style={{ fontSize:13 }}>
          <Plus size={14} /> Nuovo fornitore
        </button>
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
        {[
          { label:'Totale', val: String(fornitori.length), color:'#6b7280' },
          { label:'Subappaltatori', val: String(fornitori.filter(f=>f.tipo==='SUBAPPALTATORE').length), color:'#3b82f6' },
          { label:'DURC validi', val: String(durcOk), color:'#10b981' },
          { label:'DURC scaduti', val: String(durcScaduti), color: durcScaduti > 0 ? '#ef4444' : '#6b7280' },
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
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca per ragione sociale, P.IVA..."
            style={{ width:'100%', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:9, padding:'9px 12px 9px 34px', fontSize:13, color:'var(--t1)', boxSizing:'border-box' }} />
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {['TUTTI',...TIPI].map(t => (
            <button key={t} onClick={()=>setFiltroTipo(t)} style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:10, fontWeight:600, cursor:'pointer', background:filtroTipo===t?'var(--accent)':'var(--panel)', color:filtroTipo===t?'white':'var(--t3)', whiteSpace:'nowrap' }}>
              {t==='TUTTI'?'Tutti':t.replace('_',' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="card" style={{ overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:48, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : filtrati.length === 0 ? (
          <div style={{ padding:'60px 32px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {fornitori.length === 0 ? 'Nessun fornitore — inserisci il primo' : 'Nessun fornitore con questo filtro'}
          </div>
        ) : filtrati.map((f, i) => {
          const durc = durcInfo(f.durc_scadenza)
          return (
            <div key={f.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 20px', borderBottom:i<filtrati.length-1?'1px solid var(--border)':'none', transition:'background 0.12s' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--panel-hover)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {/* DURC indicator */}
              <div style={{ width:8, height:8, borderRadius:'50%', background:durc.color, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:'var(--accent)' }}>{f.codice_fornitore}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--t3)', background:'var(--bg)', borderRadius:5, padding:'1px 6px', border:'1px solid var(--border)' }}>{f.tipo?.replace('_',' ')}</span>
                  {!durc.valido && <span style={{ fontSize:9, color:'#ef4444', display:'flex', alignItems:'center', gap:2 }}><AlertTriangle size={9} /> {durc.label}</span>}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }} className="truncate">{f.ragione_sociale}</div>
                <div style={{ display:'flex', gap:12, marginTop:2 }}>
                  {f.partita_iva && <span style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--font-mono)' }}>P.IVA {f.partita_iva}</span>}
                  {f.citta && <span style={{ fontSize:10, color:'var(--t3)' }}>{f.citta} ({f.provincia})</span>}
                  {f.categoria_soa && <span style={{ fontSize:10, color:'#3b82f6', fontWeight:600 }}>SOA {f.categoria_soa} cl.{f.classifica_soa}</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:10, flexShrink:0 }}>
                {f.telefono && (
                  <a href={`tel:${f.telefono}`} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--t3)', textDecoration:'none' }} onClick={e=>e.stopPropagation()}>
                    <Phone size={12} /> {f.telefono}
                  </a>
                )}
                {f.email && (
                  <a href={`mailto:${f.email}`} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--t3)', textDecoration:'none' }} onClick={e=>e.stopPropagation()}>
                    <Mail size={12} />
                  </a>
                )}
                <div style={{ fontSize:10, fontWeight:600, color:durc.color, background:`${durc.color}15`, borderRadius:6, padding:'3px 8px', border:`1px solid ${durc.color}30` }}>
                  DURC {durc.label}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL NUOVO FORNITORE */}
      {showNuovo && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: step === 'FORM' ? 700 : 480 }}>

            {step === 'UPLOAD' && (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                  <div>
                    <h2 style={{ fontSize:18, fontWeight:800, color:'#1e293b', margin:0 }}>Nuovo Fornitore</h2>
                    <p style={{ fontSize:12, color:'#64748b', marginTop:3 }}>Importa documento oppure inserisci manualmente</p>
                  </div>
                  <button onClick={()=>setShowNuovo(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:8, cursor:'pointer' }}><X size={15} color="#64748b" /></button>
                </div>
                <div onClick={()=>fileRef.current?.click()} style={{ border:'2px dashed #e2e8f0', borderRadius:14, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:'#f8fafc', marginBottom:16 }}>
                  <div style={{ width:52, height:52, borderRadius:14, background:'rgba(59,130,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                    <Upload size={24} color="#3b82f6" />
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:6 }}>Importa documento fornitore</div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>Visura camerale, DURC, Fattura, Contratto</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:11, color:'#3b82f6', fontWeight:600 }}>
                    <Sparkles size={13} /> AI estrae P.IVA, ragione sociale, SOA, ATECO
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display:'none' }}
                    onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFileImport(f) }} />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
                  <span style={{ fontSize:11, color:'#94a3b8' }}>oppure</span>
                  <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
                </div>
                <button onClick={()=>setStep('FORM')} className="btn-secondary" style={{ width:'100%', justifyContent:'center' }}>Inserisci dati manualmente</button>
              </>
            )}

            {step === 'AI_LOADING' && (
              <div style={{ textAlign:'center', padding:'48px 24px' }}>
                <Sparkles size={28} color="#3b82f6" style={{ marginBottom:16 }} />
                <div style={{ fontSize:16, fontWeight:700, color:'#1e293b', marginBottom:8 }}>AI analizza il documento</div>
                <div style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>{aiStatus}</div>
                <div className="spinner" style={{ margin:'0 auto' }} />
              </div>
            )}

            {step === 'FORM' && (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                  <div>
                    <h2 style={{ fontSize:18, fontWeight:800, color:'#1e293b', margin:0 }}>Dati fornitore</h2>
                    {aiStatus && (
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, fontSize:11, color: aiStatus.startsWith('✅')?'#10b981':aiStatus.startsWith('⚠')?'#f59e0b':'#64748b' }}>
                        {aiStatus.startsWith('✅') ? <CheckCircle size={12} /> : aiStatus.startsWith('⚠') ? <AlertCircle size={12} /> : null}
                        {aiStatus}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setShowNuovo(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:8, cursor:'pointer' }}><X size={15} color="#64748b" /></button>
                </div>
                <div style={{ maxHeight:'60vh', overflowY:'auto', paddingRight:4 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={lbl}>Codice fornitore</label>
                      <input value={form.codice_fornitore} onChange={e=>setF('codice_fornitore',e.target.value)} style={{ ...inp, fontFamily:'monospace', fontWeight:700 }} />
                      <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>Modificabile prima della conferma</div>
                    </div>
                    <div>
                      <label style={lbl}>Tipo</label>
                      <select value={form.tipo} onChange={e=>setF('tipo',e.target.value)} style={{ ...inp, width:'100%' }}>
                        {TIPI.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn:'span 2' }}>
                      <label style={lbl}>Ragione sociale *</label>
                      <input value={form.ragione_sociale} onChange={e=>setF('ragione_sociale',e.target.value)} style={inp} />
                    </div>
                    <div><label style={lbl}>Partita IVA</label><input value={form.partita_iva} onChange={e=>setF('partita_iva',e.target.value)} style={{ ...inp, fontFamily:'monospace' }} /></div>
                    <div><label style={lbl}>Codice fiscale</label><input value={form.codice_fiscale} onChange={e=>setF('codice_fiscale',e.target.value)} style={{ ...inp, fontFamily:'monospace' }} /></div>
                    <div><label style={lbl}>PEC</label><input value={form.pec} onChange={e=>setF('pec',e.target.value)} type="email" style={inp} /></div>
                    <div><label style={lbl}>Email</label><input value={form.email} onChange={e=>setF('email',e.target.value)} type="email" style={inp} /></div>
                    <div><label style={lbl}>Telefono</label><input value={form.telefono} onChange={e=>setF('telefono',e.target.value)} type="tel" style={inp} /></div>
                    <div><label style={lbl}>Codice SDI</label><input value={form.codice_sdi} onChange={e=>setF('codice_sdi',e.target.value)} style={{ ...inp, fontFamily:'monospace' }} /></div>
                    <div style={{ gridColumn:'span 2' }}><label style={lbl}>Indirizzo</label><input value={form.indirizzo} onChange={e=>setF('indirizzo',e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>Città</label><input value={form.citta} onChange={e=>setF('citta',e.target.value)} style={inp} /></div>
                    <div>
                      <label style={lbl}>Provincia</label>
                      <select value={form.provincia} onChange={e=>setF('provincia',e.target.value)} style={{ ...inp, width:'100%' }}>
                        {PROVINCE_IT.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div><label style={lbl}>CAP</label><input value={form.cap} onChange={e=>setF('cap',e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>ATECO</label><input value={form.codice_ateco} onChange={e=>setF('codice_ateco',e.target.value)} placeholder="41.20.00" style={{ ...inp, fontFamily:'monospace' }} /></div>

                    {/* SOA */}
                    <div style={{ gridColumn:'span 2', background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:9, padding:'12px 14px' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#334155', marginBottom:10 }}>🏗 Qualificazione SOA</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                        <div><label style={lbl}>Categoria SOA</label><input value={form.categoria_soa} onChange={e=>setF('categoria_soa',e.target.value)} placeholder="OG1, OG3..." style={inp} /></div>
                        <div><label style={lbl}>Classifica SOA</label><input value={form.classifica_soa} onChange={e=>setF('classifica_soa',e.target.value)} placeholder="I, II, III..." style={inp} /></div>
                        <div><label style={lbl}>Scadenza SOA</label><input type="date" value={form.soa_scadenza} onChange={e=>setF('soa_scadenza',e.target.value)} style={inp} /></div>
                      </div>
                    </div>

                    {/* DURC */}
                    <div>
                      <label style={lbl}>Scadenza DURC</label>
                      <input type="date" value={form.durc_scadenza} onChange={e=>setF('durc_scadenza',e.target.value)} style={inp} />
                      {form.durc_scadenza && (
                        <div style={{ marginTop:4, fontSize:10, color:durcInfo(form.durc_scadenza).color, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                          <CheckCircle size={10} /> {durcInfo(form.durc_scadenza).label}
                        </div>
                      )}
                    </div>
                    <div><label style={lbl}>Note</label><textarea value={form.note} onChange={e=>setF('note',e.target.value)} rows={2} style={{ ...inp, resize:'vertical', width:'100%' }} /></div>
                  </div>
                </div>
                <div style={{ marginTop:20, display:'flex', justifyContent:'space-between' }}>
                  <button onClick={()=>setStep('UPLOAD')} className="btn-secondary" style={{ fontSize:12 }}>← Importa documento</button>
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={()=>setShowNuovo(false)} className="btn-secondary">Annulla</button>
                    <button onClick={creaFornitore} disabled={saving||!form.ragione_sociale} className="btn-primary">
                      <Save size={14} /> {saving?'Salvataggio...':'Salva fornitore'}
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
