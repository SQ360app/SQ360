'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Upload, Plus, Search, FileText, Trash2, Edit2, Save, X,
  ShoppingCart, CheckSquare, Square, AlertTriangle, Printer, Calculator
} from 'lucide-react'

interface Misura {
  id?: string
  voce_id?: string
  posizione: number
  nota: string
  nr_expr: string
  a_expr: string
  b_expr: string
  h_expr: string
  q_parziale: number
  is_titolo: boolean
}

interface VoceComputo {
  id: string; capitolo: string; codice: string; codice_prezzario: string
  descrizione: string; um: string; quantita: number; prezzo_unitario: number
  importo: number; pct_manodopera: number; pct_materiali: number; pct_noli: number
  tipo_costo: string[]; note_approvvigionamento: string
}

interface Computo { id: string; tipo_uso: string; fonte: string; data_import: string }

interface FormVoce {
  capitolo: string; codice: string; codice_prezzario: string; descrizione: string
  um: string; quantita: number; prezzo_unitario: number
  pct_manodopera: number; pct_materiali: number; pct_noli: number
  tipo_costo: string[]; note_approvvigionamento: string
}

const TIPI_COSTO = [
  { id: 'INT', label: 'Interno',     color: '#10b981' },
  { id: 'SUB', label: 'Subappalto',  color: '#8b5cf6' },
  { id: 'ACQ', label: 'Acquisto',    color: '#3b82f6' },
  { id: 'NC',  label: 'Nolo Caldo',  color: '#f59e0b' },
  { id: 'NF',  label: 'Nolo Freddo', color: '#64748b' },
]

const UM_LIST = ['mc','mq','ml','kg','t','nr','corpo','lt','ora','gg','%','kW','kWh']

function fmt(n: number, dec = 2) { return (n||0).toLocaleString('it-IT',{minimumFractionDigits:dec,maximumFractionDigits:dec}) }
function fmtQ(n: number) { return fmt(n,3) }

const FORM_VUOTO: FormVoce = {
  capitolo:'',codice:'',codice_prezzario:'',descrizione:'',um:'mc',
  quantita:0,prezzo_unitario:0,pct_manodopera:0,pct_materiali:0,pct_noli:0,
  tipo_costo:['INT'],note_approvvigionamento:''
}

function evalExpr(s: string): number {
  if (!s||!s.trim()) return 0
  try {
    const clean=s.trim().replace(/,/g,'.')
    if (/^[\d\s\+\-\*\/\.\(\)]+$/.test(clean)) {
      // eslint-disable-next-line no-eval
      const r=eval(clean)
      return typeof r==='number'&&isFinite(r)?Math.round(r*1000)/1000:0
    }
  } catch { /* skip */ }
  return 0
}

function calcolaQparz(m: Misura): number {
  if (m.is_titolo) return 0
  const nr=evalExpr(m.nr_expr)||1
  const a=evalExpr(m.a_expr),b=evalExpr(m.b_expr),h=evalExpr(m.h_expr)
  const vals=[a,b,h].filter(v=>v!==0)
  if(vals.length===0) return 0
  return Math.round(nr*vals.reduce((p,v)=>p*v,1)*1000)/1000
}

interface FoglioMisureProps {
  voceId:string;voceInfo:{codice:string;descrizione:string;um:string}
  onClose:()=>void;onSaved:(q:number,i:number)=>void
}

function FoglioMisure({voceId,voceInfo,onClose,onSaved}:FoglioMisureProps) {
  const [misure,setMisure]=useState<Misura[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [contextMenu,setContextMenu]=useState<{x:number;y:number;idx:number}|null>(null)
  const [prezzoUnit,setPrezzoUnit]=useState(0)

  useEffect(()=>{
    caricaMisure()
    const h=()=>setContextMenu(null)
    document.addEventListener('click',h)
    return ()=>document.removeEventListener('click',h)
  },[voceId])

  async function caricaMisure() {
    setLoading(true)
    const [{data:md},{data:vd}]=await Promise.all([
      supabase.from('misure_voce').select('*').eq('voce_id',voceId).order('posizione'),
      supabase.from('voci_computo').select('prezzo_unitario').eq('id',voceId).single()
    ])
    if(vd) setPrezzoUnit(Number((vd as Record<string,unknown>).prezzo_unitario)||0)
    if(md&&md.length>0){
      setMisure((md as Record<string,unknown>[]).map((r,i)=>({
        id:String(r.id),voce_id:voceId,posizione:i,
        nota:String(r.nota||''),
        nr_expr:String(r.nr_expr||r.nr||''),
        a_expr:String(r.a_expr||r.a||''),
        b_expr:String(r.b_expr||r.b||''),
        h_expr:String(r.h_expr||r.h||''),
        q_parziale:Number(r.q_parziale)||0,
        is_titolo:Boolean(r.is_titolo)
      })))
    } else {
      setMisure([
        {posizione:0,nota:'',nr_expr:'',a_expr:'',b_expr:'',h_expr:'',q_parziale:0,is_titolo:true},
        {posizione:1,nota:'',nr_expr:'',a_expr:'',b_expr:'',h_expr:'',q_parziale:0,is_titolo:false}
      ])
    }
    setLoading(false)
  }

  function aggiorna(idx:number,field:keyof Misura,val:string|boolean){
    setMisure(prev=>prev.map((m,i)=>{
      if(i!==idx) return m
      const u={...m,[field]:val}
      if(!u.is_titolo) u.q_parziale=calcolaQparz(u)
      return u
    }))
  }

  function inserisciRiga(idx:number,titolo=false){
    setMisure(prev=>{
      const n:Misura={posizione:idx+1,nota:'',nr_expr:'',a_expr:'',b_expr:'',h_expr:'',q_parziale:0,is_titolo:titolo}
      const a=[...prev];a.splice(idx+1,0,n)
      return a.map((m,i)=>({...m,posizione:i}))
    })
    setContextMenu(null)
  }

  function eliminaRiga(idx:number){
    setMisure(prev=>prev.filter((_,i)=>i!==idx).map((m,i)=>({...m,posizione:i})))
    setContextMenu(null)
  }

  function convertiTitolo(idx:number){
    setMisure(prev=>prev.map((m,i)=>i===idx?{...m,is_titolo:!m.is_titolo,nr_expr:'',a_expr:'',b_expr:'',h_expr:'',q_parziale:0}:m))
    setContextMenu(null)
  }

  const totM=misure.reduce((s,m)=>s+(m.is_titolo?0:calcolaQparz(m)),0)

  function hkd(e:React.KeyboardEvent,ri:number,cn:string){
    const cols=['nota','nr_expr','a_expr','b_expr','h_expr']
    const ci=cols.indexOf(cn)
    if(e.key==='Tab'){e.preventDefault();let nc=e.shiftKey?ci-1:ci+1,nr=ri;if(nc<0){nc=cols.length-1;nr--}if(nc>=cols.length){nc=0;nr++}if(nr>=misure.length)inserisciRiga(misure.length-1)}
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();inserisciRiga(ri)}
    if(e.key==='Delete'&&e.ctrlKey){e.preventDefault();eliminaRiga(ri)}
  }

  async function salva(){
    setSaving(true)
    try{
      await supabase.from('misure_voce').delete().eq('voce_id',voceId)
      if(misure.length>0){
        await supabase.from('misure_voce').insert(misure.map((m,i)=>({
          voce_id:voceId,posizione:i,nota:m.nota.slice(0,300),
          nr_expr:m.nr_expr,a_expr:m.a_expr,b_expr:m.b_expr,h_expr:m.h_expr,
          q_parziale:m.is_titolo?0:calcolaQparz(m),is_titolo:m.is_titolo,
          nr:evalExpr(m.nr_expr)||0,a:evalExpr(m.a_expr)||0,b:evalExpr(m.b_expr)||0,h:evalExpr(m.h_expr)||0
        })))
      }
      const qt=Math.round(totM*1000)/1000
      const ni=Math.round(qt*prezzoUnit*100)/100
      await supabase.from('voci_computo').update({quantita:qt,importo:ni}).eq('id',voceId)
      onSaved(qt,ni)
    }finally{setSaving(false)}
  }

  const f3=(n:number)=>n===0?'':n.toLocaleString('it-IT',{minimumFractionDigits:3,maximumFractionDigits:3})
  const cs=(t:boolean,al:'left'|'right'='right'):React.CSSProperties=>({padding:0,borderBottom:'1px solid #d1d5db',borderRight:'1px solid #e5e7eb',background:t?'#eff6ff':'white',textAlign:al})
  const is=(t:boolean,al:'left'|'right'='right'):React.CSSProperties=>({width:'100%',border:'none',outline:'none',background:'transparent',padding:'5px 6px',fontSize:12,fontFamily:al==='right'?'monospace':'inherit',textAlign:al,color:t?'#1e40af':'#1e293b',fontWeight:t?600:400,fontStyle:t?'italic':'normal'})

  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal-box" style={{maxWidth:860,padding:0,overflow:'hidden'}}>
        <div style={{padding:'12px 18px',background:'#1e3a5f',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:'white',fontFamily:'monospace'}}>{voceInfo.codice} — Foglio Misure</div>
            <div style={{fontSize:11,color:'#94c5f8',marginTop:2,maxWidth:650,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{voceInfo.descrizione}</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',color:'white',fontSize:16}}>✕</button>
        </div>
        <div style={{padding:'5px 16px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',fontSize:10,color:'#64748b',display:'flex',gap:16}}>
          <span><kbd style={{background:'#e2e8f0',borderRadius:3,padding:'1px 5px',fontSize:10}}>Tab</kbd> naviga</span>
          <span><kbd style={{background:'#e2e8f0',borderRadius:3,padding:'1px 5px',fontSize:10}}>Enter</kbd> nuova riga</span>
          <span><kbd style={{background:'#e2e8f0',borderRadius:3,padding:'1px 5px',fontSize:10}}>Ctrl+Canc</kbd> elimina</span>
          <span>🖱️ Tasto destro → menu</span>
          <span style={{color:'#3b82f6'}}>💡 Nelle celle: <strong>14+16+3</strong> calcola automaticamente</span>
        </div>
        {loading?<div style={{padding:32,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}}/></div>:(
          <div style={{overflowX:'auto',maxHeight:'58vh',overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:720}}>
              <thead style={{position:'sticky',top:0,zIndex:2}}>
                <tr style={{background:'#1e3a5f'}}>
                  {[{l:'N°',w:36},{l:'NOTA / POSIZIONE',w:undefined},{l:'NR',w:72},{l:'A (Lunghezza)',w:140},{l:'B (Larghezza)',w:90},{l:'H / Peso',w:90},{l:'Q. PARZIALE',w:105}].map((h,i)=>(
                    <th key={i} style={{padding:'7px 8px',fontSize:9,fontWeight:700,color:'#94c5f8',textTransform:'uppercase',textAlign:i>=2?'right':'left',width:h.w,borderRight:'1px solid rgba(255,255,255,0.1)',whiteSpace:'nowrap'}}>{h.l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {misure.map((m,idx)=>(
                  <tr key={idx} onContextMenu={e=>{e.preventDefault();setContextMenu({x:e.clientX,y:e.clientY,idx})}}
                    style={{background:m.is_titolo?'#eff6ff':idx%2===0?'white':'#fafafa'}}>
                    <td style={{...cs(m.is_titolo,'right'),width:36,padding:'0 6px',fontSize:10,color:'#94a3b8',fontFamily:'monospace'}}>{idx+1}</td>
                    <td style={cs(m.is_titolo,'left')}><input value={m.nota} onChange={e=>aggiorna(idx,'nota',e.target.value)} onKeyDown={e=>hkd(e,idx,'nota')} placeholder={m.is_titolo?'Titolo sezione...':'Note / posizione'} style={is(m.is_titolo,'left')}/></td>
                    <td style={cs(m.is_titolo)}>{!m.is_titolo&&<input value={m.nr_expr} onChange={e=>aggiorna(idx,'nr_expr',e.target.value)} onKeyDown={e=>hkd(e,idx,'nr_expr')} style={is(false)}/>}</td>
                    <td style={cs(m.is_titolo)}>{!m.is_titolo&&<input value={m.a_expr} onChange={e=>aggiorna(idx,'a_expr',e.target.value)} onKeyDown={e=>hkd(e,idx,'a_expr')} placeholder="es. 14+16+3" style={is(false)}/>}</td>
                    <td style={cs(m.is_titolo)}>{!m.is_titolo&&<input value={m.b_expr} onChange={e=>aggiorna(idx,'b_expr',e.target.value)} onKeyDown={e=>hkd(e,idx,'b_expr')} style={is(false)}/>}</td>
                    <td style={cs(m.is_titolo)}>{!m.is_titolo&&<input value={m.h_expr} onChange={e=>aggiorna(idx,'h_expr',e.target.value)} onKeyDown={e=>hkd(e,idx,'h_expr')} style={is(false)}/>}</td>
                    <td style={{...cs(m.is_titolo),paddingRight:8,fontSize:12,fontFamily:'monospace',fontWeight:600,color:m.is_titolo?'transparent':'#1e3a5f'}}>{!m.is_titolo&&f3(calcolaQparz(m))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{position:'sticky',bottom:0}}>
                <tr style={{background:'#1e3a5f',borderTop:'2px solid #0f2441'}}>
                  <td colSpan={5} style={{padding:'9px 12px',fontSize:11,fontWeight:700,color:'#94c5f8'}}>QUANTITÀ TOTALE</td>
                  <td colSpan={2} style={{padding:'9px 10px',fontSize:20,fontWeight:900,color:'white',fontFamily:'monospace',textAlign:'right'}}>
                    {totM.toLocaleString('it-IT',{minimumFractionDigits:3,maximumFractionDigits:3})} {voceInfo.um}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div style={{padding:'10px 16px',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8fafc'}}>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>inserisciRiga(misure.length-1,false)} style={{padding:'6px 12px',borderRadius:6,border:'1px dashed #94a3b8',background:'white',fontSize:11,cursor:'pointer',color:'#334155'}}>+ Riga misura</button>
            <button onClick={()=>inserisciRiga(misure.length-1,true)} style={{padding:'6px 12px',borderRadius:6,border:'1px dashed #3b82f6',background:'#eff6ff',fontSize:11,cursor:'pointer',color:'#1e40af'}}>+ Riga titolo</button>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={onClose} style={{padding:'7px 16px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer'}}>Annulla</button>
            <button onClick={salva} disabled={saving} style={{padding:'7px 20px',borderRadius:7,border:'none',background:'#1e3a5f',color:'white',fontSize:12,fontWeight:700,cursor:'pointer'}}>
              💾 {saving?'Salvataggio...':'Salva misure'}
            </button>
          </div>
        </div>
        {contextMenu&&(
          <div style={{position:'fixed',top:contextMenu.y,left:contextMenu.x,background:'white',border:'1px solid #d1d5db',borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',zIndex:9999,minWidth:210,padding:'4px 0'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'3px 10px 6px',fontSize:9,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',borderBottom:'1px solid #f1f5f9'}}>Riga {contextMenu.idx+1}</div>
            {[
              {label:'↓ Inserisci riga misura',action:()=>inserisciRiga(contextMenu.idx,false)},
              {label:'↓ Inserisci riga titolo',action:()=>inserisciRiga(contextMenu.idx,true)},
              {label:misure[contextMenu.idx]?.is_titolo?'↔ Converti in misura':'↔ Converti in titolo',action:()=>convertiTitolo(contextMenu.idx)},
              {label:'🗑 Elimina riga',action:()=>eliminaRiga(contextMenu.idx),danger:true},
            ].map((item,i)=>(
              <button key={i} onClick={item.action} style={{display:'block',width:'100%',padding:'8px 14px',border:'none',background:'none',cursor:'pointer',textAlign:'left',fontSize:12,color:(item as {danger?:boolean}).danger?'#ef4444':'#1e293b'}}
                onMouseEnter={e=>(e.currentTarget.style.background=(item as {danger?:boolean}).danger?'#fef2f2':'#f8fafc')}
                onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ComputoPage() {
  const {id:commessaId}=useParams() as {id:string}
  const [computo,setComputo]=useState<Computo|null>(null)
  const [voci,setVoci]=useState<VoceComputo[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filtroCapitolo,setFiltroCapitolo]=useState('TUTTI')
  const [showImport,setShowImport]=useState(false)
  const [showForm,setShowForm]=useState(false)
  const [showMisure,setShowMisure]=useState<string|null>(null)
  const [showRdo,setShowRdo]=useState(false)
  const [showDescr,setShowDescr]=useState<string|null>(null)
  const [form,setForm]=useState<FormVoce>({...FORM_VUOTO})
  const [editingId,setEditingId]=useState<string|null>(null)
  const [saving,setSaving]=useState(false)
  const [importing,setImporting]=useState(false)
  const [importMsg,setImportMsg]=useState('')
  const [importErr,setImportErr]=useState('')
  const fileRef=useRef<HTMLInputElement>(null)
  const [selezionate,setSelezionate]=useState<Set<string>>(new Set())

  useEffect(()=>{carica()},[commessaId])

  async function carica(){
    setLoading(true)
    const {data:comp}=await supabase.from('computo_metrico').select('*').eq('commessa_id',commessaId).eq('tipo_uso','AGGIUDICATA').single()
    if(comp){
      setComputo(comp)
      const {data:v}=await supabase.from('voci_computo').select('*').eq('computo_id',comp.id).order('capitolo').order('codice')
      if(v) setVoci(v as VoceComputo[])
    }
    setLoading(false)
  }

  async function getOrCreateComputoId():Promise<string|null>{
    if(computo?.id) return computo.id
    const {data}=await supabase.from('computo_metrico').insert([{commessa_id:commessaId,tipo_uso:'AGGIUDICATA',fonte:'MANUALE',data_import:new Date().toISOString().slice(0,10)}]).select().single()
    if(data){setComputo(data as Computo);return data.id as string}
    return null
  }

  async function handleFileImport(file:File){
    setImporting(true);setImportMsg('Analisi file...');setImportErr('')
    try{
      const isXpwe=/\.(xpwe|xml)$/i.test(file.name)
      const computoId=await getOrCreateComputoId()
      if(!computoId){setImportErr('Errore creazione computo');setImporting(false);return}
      if(isXpwe){
        setImportMsg('Lettura Primus XPWE...')
        const fd=new FormData();fd.append('file',file)
        const res=await fetch('/api/xpwe-parse',{method:'POST',body:fd})
        const json=await res.json() as {ok:boolean;voci?:Array<Record<string,unknown>>;errore?:string;totale?:number;totale_misure?:number}
        if(!json.ok||!json.voci){setImportErr('Errore XPWE: '+(json.errore||'formato non riconosciuto'));setImporting(false);return}
        setImportMsg('Trovate '+json.voci.length+' voci ('+(json.totale_misure||0)+' righe misura). Salvataggio...')
        let tot=0
        const voceIdMap:Array<{voceId:string;misure:Array<Record<string,unknown>>}>=[]
        for(let i=0;i<json.voci.length;i+=50){
          const chunk=json.voci.slice(i,i+50)
          const rows=chunk.map((v:Record<string,unknown>)=>({
            computo_id:computoId,
            capitolo:String(v.capitolo||'Importato').slice(0,500),
            codice:String(v.codice||'').slice(0,100),
            codice_prezzario:String(v.codice||'').slice(0,100),
            descrizione:String(v.descrizione||'').slice(0,5000),
            um:String(v.um||'nr').slice(0,20),
            quantita:Number(v.quantita)||0,
            prezzo_unitario:Number(v.prezzo_unitario)||0,
            importo:Number(v.importo)||0,
            pct_manodopera:Number(v.pct_manodopera)||0,
            pct_materiali:Number(v.pct_materiali)||0,
            pct_noli:Number(v.pct_noli)||0,
            tipo_costo:['INT'],selezionata:true
          }))
          const {data:sv,error}=await supabase.from('voci_computo').insert(rows).select('id')
          if(error){setImportErr('Errore DB: '+error.message);setImporting(false);return}
          if(sv){sv.forEach((s:{id:string},idx:number)=>{
            const mv=Array.isArray(chunk[idx]?.misure)?chunk[idx].misure as Array<Record<string,unknown>>:[]
            if(mv.length>0) voceIdMap.push({voceId:s.id,misure:mv})
          })}
          tot+=chunk.length
          setImportMsg('Salvate '+tot+'/'+json.voci.length+' voci...')
        }
        if(voceIdMap.length>0){
          setImportMsg('Salvataggio righe di misura...')
          const mr:Array<Record<string,unknown>>=[]
          for(const {voceId,misure} of voceIdMap){
            misure.forEach((m:Record<string,unknown>,idx:number)=>{
              mr.push({voce_id:voceId,posizione:idx,nota:String(m.nota||'').slice(0,300),
                nr_expr:String(m.nr_expr||''),a_expr:String(m.a_expr||''),
                b_expr:String(m.b_expr||''),h_expr:String(m.h_expr||''),
                q_parziale:Number(m.q_parziale)||0,is_titolo:Boolean(m.is_titolo),
                nr:0,a:0,b:0,h:0})
            })
          }
          for(let i=0;i<mr.length;i+=200){await supabase.from('misure_voce').insert(mr.slice(i,i+200))}
        }
        setImportMsg('✅ '+tot+' voci con '+voceIdMap.reduce((s,x)=>s+x.misure.length,0)+' righe misura importate!')
        await carica()
      } else {
        const txt=await file.text()
        const lines=txt.split('\n').filter(l=>l.trim())
        if(lines.length<2){setImportErr('File vuoto');setImporting(false);return}
        const sep=txt.includes(';')?';':','
        const hdr=lines[0].split(sep).map(h=>h.trim().toLowerCase().replace(/[^a-z0-9_]/g,''))
        const get=(vals:string[],n:string)=>{const i=hdr.findIndex(h=>h.includes(n));return i>=0?vals[i]||'':''}
        const rows:Record<string,unknown>[]=[]
        for(let i=1;i<lines.length;i++){
          const vals=lines[i].split(sep).map(v=>v.trim().replace(/^"|"$/g,''))
          if(!vals.some(v=>v)) continue
          const q=parseFloat(get(vals,'quant')||get(vals,'qta')||'0')||0
          const p=parseFloat(get(vals,'prezz')||get(vals,'pu')||get(vals,'prezzo')||'0')||0
          rows.push({computo_id:computoId,capitolo:(get(vals,'cap')||'Importato').slice(0,500),codice:(get(vals,'codice')||'CSV'+String(i).padStart(3,'0')).slice(0,100),codice_prezzario:'',descrizione:(get(vals,'descriz')||get(vals,'desc')||vals[0]||'').slice(0,5000),um:(get(vals,'um')||'nr').slice(0,20),quantita:q,prezzo_unitario:p,importo:q*p,pct_manodopera:0,pct_materiali:0,pct_noli:0,tipo_costo:['INT'],selezionata:true})
        }
        if(!rows.length){setImportErr('Nessuna voce trovata');setImporting(false);return}
        let tot=0
        for(let i=0;i<rows.length;i+=100){
          const {error}=await supabase.from('voci_computo').insert(rows.slice(i,i+100))
          if(error){setImportErr('Errore DB: '+error.message);setImporting(false);return}
          tot+=Math.min(100,rows.length-i)
          setImportMsg('Salvate '+tot+'/'+rows.length+'...')
        }
        setImportMsg('✅ Importate '+tot+' voci!')
        await carica()
      }
    }catch(e){setImportErr('Errore: '+String(e))}
    setImporting(false)
    setTimeout(()=>{setShowImport(false);setImportMsg('');setImportErr('')},3500)
  }

  async function salvaVoce(){
    if(!form.descrizione.trim()) return
    setSaving(true)
    const computoId=await getOrCreateComputoId()
    if(!computoId){setSaving(false);return}
    const payload={...form,importo:form.quantita*form.prezzo_unitario,computo_id:computoId,selezionata:true}
    if(editingId){
      const {data}=await supabase.from('voci_computo').update(payload).eq('id',editingId).select().single()
      if(data) setVoci(prev=>prev.map(v=>v.id===editingId?(data as VoceComputo):v))
      setEditingId(null)
    } else {
      const {data}=await supabase.from('voci_computo').insert([payload]).select().single()
      if(data) setVoci(prev=>[...prev,data as VoceComputo])
    }
    setSaving(false);setShowForm(false);setForm({...FORM_VUOTO})
  }

  async function eliminaVoce(id:string){
    if(!confirm('Eliminare questa voce?')) return
    await supabase.from('voci_computo').delete().eq('id',id)
    setVoci(prev=>prev.filter(v=>v.id!==id))
    setSelezionate(prev=>{const s=new Set(prev);s.delete(id);return s})
  }

  async function eliminaTutte(){
    if(!computo?.id||!confirm('Svuotare TUTTO il computo?')) return
    await supabase.from('voci_computo').delete().eq('computo_id',computo.id)
    setVoci([]);setSelezionate(new Set())
  }

  async function aggiornaTipo(id:string,tipo:string){
    const voce=voci.find(v=>v.id===id)
    if(!voce) return
    const cur=voce.tipo_costo||['INT']
    const newT=cur.includes(tipo)?(cur.filter(t=>t!==tipo).length>0?cur.filter(t=>t!==tipo):['INT']):[...cur,tipo]
    const {data}=await supabase.from('voci_computo').update({tipo_costo:newT}).eq('id',id).select().single()
    if(data) setVoci(prev=>prev.map(v=>v.id===id?{...v,tipo_costo:newT}:v))
  }

  function iniziaModifica(voce:VoceComputo){
    setForm({capitolo:voce.capitolo||'',codice:voce.codice||'',codice_prezzario:voce.codice_prezzario||'',descrizione:voce.descrizione,um:voce.um||'mc',quantita:voce.quantita,prezzo_unitario:voce.prezzo_unitario,pct_manodopera:voce.pct_manodopera||0,pct_materiali:voce.pct_materiali||0,pct_noli:voce.pct_noli||0,tipo_costo:voce.tipo_costo||['INT'],note_approvvigionamento:voce.note_approvvigionamento||''})
    setEditingId(voce.id);setShowForm(true)
  }

  const capitoli=[...new Set(voci.map(v=>v.capitolo||'Generale'))].sort()
  const vociFiltrate=voci.filter(v=>{
    const mc=filtroCapitolo==='TUTTI'||(v.capitolo||'Generale')===filtroCapitolo
    const ms=!search||v.descrizione?.toLowerCase().includes(search.toLowerCase())||v.codice?.toLowerCase().includes(search.toLowerCase())
    return mc&&ms
  })
  const capitoliFiltrati=[...new Set(vociFiltrate.map(v=>v.capitolo||'Generale'))].sort()
  const totale=voci.reduce((s,v)=>s+(v.importo||0),0)
  const totManodopera=voci.reduce((s,v)=>s+(v.importo||0)*(v.pct_manodopera||0)/100,0)
  const totMateriali=voci.reduce((s,v)=>s+(v.importo||0)*(v.pct_materiali||0)/100,0)
  const totNoli=voci.reduce((s,v)=>s+(v.importo||0)*(v.pct_noli||0)/100,0)
  const totSel=voci.filter(v=>selezionate.has(v.id)).reduce((s,v)=>s+(v.importo||0),0)
  let progressivo=0

  const inp:React.CSSProperties={width:'100%',boxSizing:'border-box' as const,background:'#fff',border:'1px solid #e2e8f0',borderRadius:7,padding:'7px 10px',color:'#1e293b',fontSize:13}
  const lbl:React.CSSProperties={fontSize:10,color:'#64748b',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.05em',display:'block',marginBottom:3}
  const thS:React.CSSProperties={padding:'7px 10px',fontSize:9,fontWeight:700,color:'#64748b',textTransform:'uppercase' as const,letterSpacing:'0.05em',textAlign:'left' as const,whiteSpace:'nowrap' as const,borderBottom:'2px solid var(--border)',background:'#f8fafc'}

  return (
    <div style={{padding:'20px 24px',background:'var(--bg)',minHeight:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:800,color:'var(--t1)',margin:0}}>Computo Metrico Estimativo</h2>
          <p style={{fontSize:12,color:'var(--t3)',marginTop:3}}>
            {voci.length} voci · {capitoli.length} capitoli · <strong>€ {fmt(totale)}</strong>
            {selezionate.size>0&&<span style={{color:'#8b5cf6',marginLeft:8}}>· {selezionate.size} sel. € {fmt(totSel)}</span>}
          </p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {selezionate.size>0&&<button onClick={()=>setShowRdo(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:'none',background:'#8b5cf6',color:'white',fontSize:12,fontWeight:700,cursor:'pointer'}}><ShoppingCart size={13}/> RDO ({selezionate.size})</button>}
          <button onClick={()=>window.print()} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--panel)',color:'var(--t2)',fontSize:12,cursor:'pointer'}}><Printer size={13}/> Stampa</button>
          {voci.length>0&&<button onClick={eliminaTutte} style={{padding:'8px 12px',borderRadius:8,border:'1px solid #fecaca',background:'#fef2f2',color:'#ef4444',fontSize:11,cursor:'pointer'}}>🗑 Svuota</button>}
          <button onClick={()=>setShowImport(true)} className="btn-secondary" style={{fontSize:12}}><Upload size={13}/> Importa</button>
          <button onClick={()=>{setShowForm(true);setEditingId(null);setForm({...FORM_VUOTO})}} className="btn-primary" style={{fontSize:12}}><Plus size={13}/> Nuova voce</button>
        </div>
      </div>
      {voci.length>0&&(
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{position:'relative',flex:1,minWidth:220}}>
            <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--t4)'}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca codice o descrizione..." style={{width:'100%',background:'var(--panel)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px 8px 30px',fontSize:12,color:'var(--t1)',boxSizing:'border-box' as const}}/>
          </div>
          <select value={filtroCapitolo} onChange={e=>setFiltroCapitolo(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--panel)',fontSize:12,color:'var(--t1)',cursor:'pointer'}}>
            <option value="TUTTI">Tutti i capitoli ({capitoli.length})</option>
            {capitoli.map(c=><option key={c} value={c}>{c.length>50?c.slice(0,50)+'…':c}</option>)}
          </select>
          {selezionate.size>0&&<button onClick={()=>setSelezionate(new Set())} style={{padding:'8px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--panel)',fontSize:11,color:'var(--t3)',cursor:'pointer'}}>✕ Deseleziona</button>}
        </div>
      )}
      {loading?<div style={{textAlign:'center',padding:48}}><div className="spinner" style={{margin:'0 auto'}}/></div>
      :voci.length===0?(
        <div style={{textAlign:'center',padding:'60px 32px',background:'var(--panel)',border:'2px dashed var(--border)',borderRadius:16}}>
          <FileText size={40} color="var(--t4)" style={{marginBottom:14}}/>
          <h3 style={{fontSize:16,fontWeight:700,color:'var(--t2)',margin:'0 0 8px'}}>Computo vuoto</h3>
          <p style={{fontSize:13,color:'var(--t3)',marginBottom:20}}>Importa da Primus XPWE o inserisci le voci manualmente</p>
          <div style={{display:'flex',gap:10,justifyContent:'center'}}>
            <button onClick={()=>setShowImport(true)} className="btn-secondary"><Upload size={14}/> Importa XPWE / CSV</button>
            <button onClick={()=>setShowForm(true)} className="btn-primary"><Plus size={14}/> Inserisci manualmente</button>
          </div>
        </div>
      ):(
        <div style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:1100}}>
              <thead>
                <tr>
                  <th style={{...thS,width:36,textAlign:'center' as const}}></th>
                  <th style={{...thS,width:40,textAlign:'center' as const}}>N°</th>
                  <th style={{...thS,width:100}}>Codice</th>
                  <th style={{...thS}}>Descrizione lavori</th>
                  <th style={{...thS,width:55,textAlign:'center' as const}}>U.M.</th>
                  <th style={{...thS,width:90,textAlign:'right' as const}}>Quantità</th>
                  <th style={{...thS,width:100,textAlign:'right' as const}}>P.U. (€)</th>
                  <th style={{...thS,width:110,textAlign:'right' as const}}>Importo (€)</th>
                  <th style={{...thS,width:45,textAlign:'center' as const}}>Man%</th>
                  <th style={{...thS,width:45,textAlign:'center' as const}}>Mat%</th>
                  <th style={{...thS,width:45,textAlign:'center' as const}}>Nol%</th>
                  <th style={{...thS,width:130,textAlign:'center' as const}}>Tipo costo</th>
                  <th style={{...thS,width:85}}></th>
                </tr>
              </thead>
              <tbody>
                {capitoliFiltrati.map(cap=>{
                  const vociCap=vociFiltrate.filter(v=>(v.capitolo||'Generale')===cap)
                  const totaleCap=vociCap.reduce((s,v)=>s+(v.importo||0),0)
                  const tutteSel=vociCap.length>0&&vociCap.every(v=>selezionate.has(v.id))
                  return [
                    <tr key={'cap-'+cap} style={{background:'#1e3a5f'}}>
                      <td style={{padding:'8px 10px',textAlign:'center' as const}}>
                        <button onClick={()=>{const ids=vociCap.map(v=>v.id);setSelezionate(prev=>{const s=new Set(prev);ids.forEach(id=>tutteSel?s.delete(id):s.add(id));return s})}} style={{background:'none',border:'none',cursor:'pointer',color:tutteSel?'#a78bfa':'#94a3b8',display:'flex',alignItems:'center'}}>{tutteSel?<CheckSquare size={13}/>:<Square size={13}/>}</button>
                      </td>
                      <td colSpan={11} style={{padding:'8px 12px'}}>
                        <span style={{fontSize:11,fontWeight:800,color:'#ffffff',textTransform:'uppercase' as const,letterSpacing:'0.08em'}}>{cap}</span>
                        <span style={{fontSize:10,color:'#94a3b8',marginLeft:12}}>{vociCap.length} voci</span>
                      </td>
                      <td style={{padding:'8px 12px',textAlign:'right' as const}}>
                        <span style={{fontSize:12,fontWeight:800,color:'#60a5fa',fontFamily:'var(--font-mono)'}}>€ {fmt(totaleCap)}</span>
                      </td>
                    </tr>,
                    ...vociCap.map(voce=>{
                      progressivo++
                      const isSel=selezionate.has(voce.id)
                      return (
                        <tr key={voce.id} style={{borderBottom:'1px solid var(--border)',background:isSel?'rgba(139,92,246,0.04)':'transparent'}}>
                          <td style={{padding:'6px 10px',textAlign:'center' as const}}>
                            <button onClick={()=>{const s=new Set(selezionate);s.has(voce.id)?s.delete(voce.id):s.add(voce.id);setSelezionate(s)}} style={{background:'none',border:'none',cursor:'pointer',color:isSel?'#8b5cf6':'var(--t4)',display:'flex',alignItems:'center'}}>{isSel?<CheckSquare size={13}/>:<Square size={13}/>}</button>
                          </td>
                          <td style={{padding:'6px 8px',fontSize:10,color:'var(--t4)',textAlign:'center' as const,fontFamily:'var(--font-mono)'}}>{progressivo}</td>
                          <td style={{padding:'6px 10px',fontSize:11,fontFamily:'var(--font-mono)',color:'var(--t3)',whiteSpace:'nowrap' as const}}>{voce.codice||'—'}</td>
                          <td style={{padding:'6px 10px',fontSize:12,color:'var(--t1)',lineHeight:1.45,maxWidth:400}}>
                            <div style={{cursor:'pointer'}} onClick={()=>setShowDescr(showDescr===voce.id?null:voce.id)}>
                              {showDescr===voce.id?<div style={{whiteSpace:'pre-wrap' as const,fontSize:12,lineHeight:1.5}}>{voce.descrizione}</div>:<div style={{overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as const}}>{voce.descrizione}</div>}
                            </div>
                          </td>
                          <td style={{padding:'6px 10px',fontSize:11,color:'var(--t3)',textAlign:'center' as const}}>{voce.um}</td>
                          <td style={{padding:'6px 10px',fontSize:11,fontFamily:'var(--font-mono)',textAlign:'right' as const,color:'var(--accent)',cursor:'pointer',textDecoration:'underline dotted'}} onClick={()=>setShowMisure(voce.id)} title="Apri foglio misure">
                            {fmtQ(voce.quantita)}
                          </td>
                          <td style={{padding:'6px 10px',fontSize:12,fontFamily:'var(--font-mono)',textAlign:'right' as const,color:'var(--t2)'}}>{fmt(voce.prezzo_unitario)}</td>
                          <td style={{padding:'6px 10px',fontSize:13,fontFamily:'var(--font-mono)',textAlign:'right' as const,fontWeight:700,color:'var(--t1)'}}>{fmt(voce.importo)}</td>
                          <td style={{padding:'6px 6px',fontSize:10,textAlign:'center' as const,color:'#10b981'}}>{voce.pct_manodopera||0}%</td>
                          <td style={{padding:'6px 6px',fontSize:10,textAlign:'center' as const,color:'#3b82f6'}}>{voce.pct_materiali||0}%</td>
                          <td style={{padding:'6px 6px',fontSize:10,textAlign:'center' as const,color:'#f59e0b'}}>{voce.pct_noli||0}%</td>
                          <td style={{padding:'6px 8px'}}>
                            <div style={{display:'flex',gap:2,flexWrap:'wrap',justifyContent:'center'}}>
                              {TIPI_COSTO.map(t=>{const on=(voce.tipo_costo||['INT']).includes(t.id);return <button key={t.id} onClick={()=>aggiornaTipo(voce.id,t.id)} title={t.label} style={{padding:'2px 5px',borderRadius:4,border:'1px solid '+(on?t.color:'var(--border)'),background:on?(t.color+'22'):'transparent',color:on?t.color:'var(--t4)',fontSize:9,fontWeight:700,cursor:'pointer'}}>{t.id}</button>})}
                            </div>
                          </td>
                          <td style={{padding:'6px 8px',whiteSpace:'nowrap' as const}}>
                            <div style={{display:'flex',gap:3}}>
                              <button onClick={()=>setShowMisure(voce.id)} title="Foglio misure" style={{background:'none',border:'1px solid var(--border)',borderRadius:5,padding:'3px 6px',cursor:'pointer',color:'var(--accent)',display:'flex',alignItems:'center'}}><Calculator size={10}/></button>
                              <button onClick={()=>iniziaModifica(voce)} title="Modifica" style={{background:'none',border:'1px solid var(--border)',borderRadius:5,padding:'3px 6px',cursor:'pointer',color:'var(--t3)',display:'flex',alignItems:'center'}}><Edit2 size={10}/></button>
                              <button onClick={()=>eliminaVoce(voce.id)} title="Elimina" style={{background:'none',border:'1px solid rgba(239,68,68,0.2)',borderRadius:5,padding:'3px 6px',cursor:'pointer',color:'#ef4444',display:'flex',alignItems:'center'}}><Trash2 size={10}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    }),
                    <tr key={'tot-'+cap} style={{background:'rgba(30,58,95,0.06)',borderTop:'2px solid rgba(30,58,95,0.15)',borderBottom:'3px solid rgba(30,58,95,0.2)'}}>
                      <td colSpan={7} style={{padding:'7px 12px',fontSize:11,fontWeight:700,color:'#1e3a5f'}}>Totale — {cap.length>60?cap.slice(0,60)+'…':cap}</td>
                      <td style={{padding:'7px 10px',fontSize:14,fontFamily:'var(--font-mono)',fontWeight:800,color:'#1e3a5f',textAlign:'right' as const}}>{fmt(totaleCap)}</td>
                      <td colSpan={5}/>
                    </tr>
                  ]
                })}
              </tbody>
            </table>
          </div>
          <div style={{borderTop:'3px solid var(--border)',background:'#f8fafc',padding:'16px 24px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 2fr',gap:16,alignItems:'end'}}>
              {[
                {label:'Incid. Manodopera',val:'€ '+fmt(totManodopera),sub:(totale>0?(totManodopera/totale*100):0).toFixed(1)+'%',color:'#10b981'},
                {label:'Incid. Materiali',val:'€ '+fmt(totMateriali),sub:(totale>0?(totMateriali/totale*100):0).toFixed(1)+'%',color:'#3b82f6'},
                {label:'Incid. Noli',val:'€ '+fmt(totNoli),sub:(totale>0?(totNoli/totale*100):0).toFixed(1)+'%',color:'#f59e0b'},
                {label:'N° Voci / Capitoli',val:voci.length+' / '+capitoli.length,sub:'voci importate',color:'#8b5cf6'},
              ].map((k,i)=>(
                <div key={i} style={{background:'white',borderRadius:8,padding:'10px 14px',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:9,color:'var(--t4)',textTransform:'uppercase' as const,marginBottom:4,letterSpacing:'0.06em'}}>{k.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:k.color,fontFamily:'var(--font-mono)'}}>{k.val}</div>
                  <div style={{fontSize:10,color:'var(--t3)',marginTop:2}}>{k.sub}</div>
                </div>
              ))}
              <div style={{background:'#1e3a5f',borderRadius:10,padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13,fontWeight:700,color:'#94c5f8'}}>TOTALE COMPUTO</span>
                <span style={{fontSize:26,fontWeight:900,color:'#ffffff',fontFamily:'var(--font-mono)'}}>€ {fmt(totale)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMisure&&(()=>{
        const voce=voci.find(v=>v.id===showMisure)
        if(!voce) return null
        return <FoglioMisure voceId={showMisure} voceInfo={{codice:voce.codice,descrizione:voce.descrizione,um:voce.um}} onClose={()=>setShowMisure(null)} onSaved={(q,i)=>{setVoci(prev=>prev.map(v=>v.id===showMisure?{...v,quantita:q,importo:i}:v));setShowMisure(null)}}/>
      })()}

      {showImport&&(
        <div className="modal-overlay"><div className="modal-box" style={{maxWidth:520}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div><h2 style={{fontSize:18,fontWeight:800,color:'#1e293b',margin:0}}>Importa Computo</h2><p style={{fontSize:11,color:'#64748b',marginTop:3}}>Primus XPWE · CSV</p></div>
            <button onClick={()=>{setShowImport(false);setImportMsg('');setImportErr('')}} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:8,cursor:'pointer'}}><X size={15} color="#64748b"/></button>
          </div>
          {importErr&&<div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#ef4444',display:'flex',gap:8}}><AlertTriangle size={14} style={{flexShrink:0}}/>{importErr}</div>}
          {importing?<div style={{textAlign:'center',padding:'32px 0'}}><div className="spinner" style={{margin:'0 auto 14px'}}/><div style={{fontSize:13,color:'#64748b'}}>{importMsg}</div></div>
          :importMsg.startsWith('✅')?<div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:10,padding:20,textAlign:'center',color:'#10b981',fontSize:14,fontWeight:700}}>{importMsg}</div>
          :(<>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {[{icon:'🏗',t:'Primus XPWE',s:'.xpwe / .xml',c:'#6366f1'},{icon:'📊',t:'CSV / TXT',s:'separatore ; o ,',c:'#10b981'}].map((b,i)=>(
                <div key={i} onClick={()=>fileRef.current?.click()} style={{border:'2px dashed '+b.c+'50',borderRadius:10,padding:'20px 14px',textAlign:'center',cursor:'pointer',background:b.c+'08'}}>
                  <div style={{fontSize:28,marginBottom:6}}>{b.icon}</div>
                  <div style={{fontSize:13,fontWeight:700,color:b.c}}>{b.t}</div>
                  <div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>{b.s}</div>
                </div>
              ))}
            </div>
            <div onClick={()=>fileRef.current?.click()} style={{border:'2px dashed var(--border)',borderRadius:10,padding:18,textAlign:'center',cursor:'pointer',background:'var(--bg)'}}>
              <Upload size={20} color="var(--t4)" style={{marginBottom:6}}/><div style={{fontSize:12,fontWeight:600,color:'var(--t2)'}}>Clicca o trascina il file</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xpwe,.xml" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f){handleFileImport(f);e.target.value=''}}}/>
          </>)}
        </div></div>
      )}

      {showRdo&&(
        <div className="modal-overlay"><div className="modal-box" style={{maxWidth:500}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div><h2 style={{fontSize:18,fontWeight:800,color:'#1e293b',margin:0}}>Richiesta d'Offerta</h2><p style={{fontSize:11,color:'#64748b',marginTop:3}}>{selezionate.size} voci · € {fmt(totSel)}</p></div>
            <button onClick={()=>setShowRdo(false)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:8,cursor:'pointer'}}><X size={15} color="#64748b"/></button>
          </div>
          <div style={{background:'#f8fafc',borderRadius:10,padding:16,fontSize:12,color:'#64748b',textAlign:'center'}}>
            <div style={{fontSize:20,marginBottom:8}}>🚀</div>
            <div style={{fontWeight:700,color:'#334155',marginBottom:6}}>Modulo RDO — In sviluppo</div>
          </div>
          <div style={{marginTop:16,display:'flex',justifyContent:'flex-end'}}><button onClick={()=>setShowRdo(false)} className="btn-secondary">Chiudi</button></div>
        </div></div>
      )}

      {showForm&&(
        <div className="modal-overlay"><div className="modal-box" style={{maxWidth:680}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
            <h2 style={{fontSize:18,fontWeight:800,color:'#1e293b',margin:0}}>{editingId?'Modifica voce':'Nuova voce'}</h2>
            <button onClick={()=>{setShowForm(false);setEditingId(null)}} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:8,cursor:'pointer'}}><X size={15} color="#64748b"/></button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxHeight:'70vh',overflowY:'auto',paddingRight:2}}>
            <div><label style={lbl}>Capitolo</label><input value={form.capitolo} onChange={e=>setForm(p=>({...p,capitolo:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Codice tariffa</label><input value={form.codice} onChange={e=>setForm(p=>({...p,codice:e.target.value}))} style={{...inp,fontFamily:'monospace'}}/></div>
            <div><label style={lbl}>U.M.</label><select value={form.um} onChange={e=>setForm(p=>({...p,um:e.target.value}))} style={{...inp,width:'100%'}}>{UM_LIST.map(u=><option key={u}>{u}</option>)}</select></div>
            <div><label style={lbl}>Prezzo unitario (€)</label><input type="number" step="0.01" value={form.prezzo_unitario||''} onChange={e=>setForm(p=>({...p,prezzo_unitario:parseFloat(e.target.value)||0}))} style={{...inp,fontFamily:'monospace'}}/></div>
            <div style={{gridColumn:'span 2'}}><label style={lbl}>Descrizione *</label><textarea value={form.descrizione} onChange={e=>setForm(p=>({...p,descrizione:e.target.value}))} rows={4} style={{...inp,resize:'vertical',minHeight:80,width:'100%'}}/></div>
            <div><label style={lbl}>Quantità</label><input type="number" step="0.001" value={form.quantita||''} onChange={e=>setForm(p=>({...p,quantita:parseFloat(e.target.value)||0}))} style={{...inp,fontFamily:'monospace'}}/></div>
            <div style={{display:'flex',flexDirection:'column' as const,justifyContent:'flex-end'}}>
              <div style={{background:'rgba(30,58,95,0.06)',border:'1px solid rgba(30,58,95,0.15)',borderRadius:9,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:'#1e3a5f'}}>Importo</span>
                <span style={{fontSize:18,fontWeight:900,color:'#1e3a5f',fontFamily:'monospace'}}>€ {fmt(form.quantita*form.prezzo_unitario)}</span>
              </div>
            </div>
            <div style={{gridColumn:'span 2'}}>
              <label style={lbl}>Tipo costo</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                {TIPI_COSTO.map(t=>{const on=form.tipo_costo.includes(t.id);return <button key={t.id} type="button" onClick={()=>{const cur=form.tipo_costo;const newT=cur.includes(t.id)?(cur.filter(x=>x!==t.id).length>0?cur.filter(x=>x!==t.id):['INT']):[...cur,t.id];setForm(p=>({...p,tipo_costo:newT}))}} style={{display:'flex',flexDirection:'column' as const,alignItems:'center',padding:'8px 16px',borderRadius:8,border:'2px solid '+(on?t.color:'var(--border)'),background:on?(t.color+'15'):'var(--bg)',cursor:'pointer'}}><span style={{fontSize:14,fontWeight:800,color:on?t.color:'var(--t3)'}}>{t.id}</span><span style={{fontSize:9,color:on?(t.color+'cc'):'var(--t4)'}}>{t.label}</span></button>})}
              </div>
            </div>
          </div>
          <div style={{marginTop:18,display:'flex',justifyContent:'flex-end',gap:10}}>
            <button onClick={()=>{setShowForm(false);setEditingId(null)}} className="btn-secondary">Annulla</button>
            <button onClick={salvaVoce} disabled={saving||!form.descrizione.trim()} className="btn-primary"><Save size={14}/>{saving?'Salvataggio...':editingId?'Aggiorna':'Aggiungi voce'}</button>
          </div>
        </div></div>
      )}
    </div>
  )
}
