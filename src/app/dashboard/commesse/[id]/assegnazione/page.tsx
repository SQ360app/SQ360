'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, TrendingUp, TrendingDown, Loader2, Save } from 'lucide-react'

const fmt = (n: number) => (n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})
const CANALI = [
  {value:'SUBAPPALTO',label:'Subappalto',color:'#7c3aed'},
  {value:'SUBAFFIDAMENTO',label:'Subaffidamento',color:'#2563eb'},
  {value:'ACQUISTO_DIRETTO',label:'Acquisto diretto',color:'#059669'},
  {value:'LAVORO_PROPRIO',label:'Lavoro proprio',color:'#d97706'},
]
const COMP = [{value:'TOTALE',label:'Totale'},{value:'MAT',label:'Materiali'},{value:'MAN',label:'Manodopera'},{value:'NOL',label:'Noli'},{value:'CUSTOM',label:'Custom'}]

interface Ass { id:string;componente:string;tipo_canale:string;importo_previsto:number;fornitore_id?:string;stato:string;isNew?:boolean }
interface Voce { id:string;codice_tariffa:string;descrizione:string;um:string;quantita:number;prezzo_unitario:number;importo:number;soggetta_ribasso:boolean;assegnazioni:Ass[] }

function VoceRow({voce,fornitori,onRefresh}:{voce:Voce;fornitori:any[];onRefresh:()=>void}) {
  const [open,setOpen]=useState(false)
  const [ass,setAss]=useState<Ass[]>(voce.assegnazioni)
  const [saving,setSaving]=useState(false)
  const totA=ass.reduce((s,a)=>s+(a.importo_previsto||0),0)
  const margine=voce.importo-totA
  const mPct=voce.importo>0?(margine/voce.importo*100):0
  const mCol=margine<0?'#dc2626':mPct<5?'#d97706':'#059669'

  function add(){setAss(p=>[...p,{id:'new_'+Date.now(),componente:'TOTALE',tipo_canale:'SUBAPPALTO',importo_previsto:Math.max(0,voce.importo-totA),stato:'DA_AVVIARE',isNew:true}])}
  async function save(){
    setSaving(true)
    for(const a of ass){
      const pct=voce.importo>0?parseFloat(((a.importo_previsto/voce.importo)*100).toFixed(2)):0
      const p={voce_computo_id:voce.id,componente:a.componente,tipo_canale:a.tipo_canale,importo_previsto:a.importo_previsto,percentuale_voce:pct,fornitore_id:a.fornitore_id||null,stato:a.stato}
      if(a.isNew||a.id.startsWith('new_'))await supabase.from('voce_assegnazione').insert(p)
      else await supabase.from('voce_assegnazione').update(p).eq('id',a.id)
    }
    setSaving(false);onRefresh()
  }
  async function del(id:string){
    if(!id.startsWith('new_'))await supabase.from('voce_assegnazione').delete().eq('id',id)
    setAss(p=>p.filter(a=>a.id!==id))
  }
  return (
    <div style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden',marginBottom:8}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',cursor:'pointer',background:open?'#f9fafb':'white'}}>
        <span style={{fontSize:11,color:'#9ca3af',fontFamily:'monospace',minWidth:80}}>{voce.codice_tariffa}</span>
        <span style={{flex:1,fontSize:13}}>{voce.descrizione}</span>
        {!voce.soggetta_ribasso&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:'#fee2e2',color:'#dc2626',fontWeight:600}}>PSC</span>}
        <span style={{fontSize:13,minWidth:120,textAlign:'right'}}>€ {fmt(voce.importo)}</span>
        <span style={{fontSize:13,minWidth:100,textAlign:'right'}}>€ {fmt(totA)}</span>
        <span style={{fontSize:12,fontWeight:600,minWidth:80,textAlign:'right',color:mCol}}>{mPct.toFixed(1)}%</span>
      </div>
      {open&&(
        <div style={{borderTop:'1px solid #f3f4f6',padding:'0 14px 12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'130px 160px 120px 1fr 80px',gap:6,padding:'6px 0 2px',fontSize:11,color:'#9ca3af',fontWeight:600}}>
            <span>Componente</span><span>Canale</span><span>Importo €</span><span>Fornitore (opz.)</span><span></span>
          </div>
          {ass.map(a=>(
            <div key={a.id} style={{display:'grid',gridTemplateColumns:'130px 160px 120px 1fr 80px',gap:6,marginBottom:4,alignItems:'center'}}>
              <select value={a.componente} onChange={e=>setAss(p=>p.map(x=>x.id===a.id?{...x,componente:e.target.value}:x))} style={{fontSize:12,padding:'3px 5px',border:'1px solid #e5e7eb',borderRadius:4}} disabled={a.stato!=='DA_AVVIARE'&&!a.isNew}>
                {COMP.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select value={a.tipo_canale} onChange={e=>setAss(p=>p.map(x=>x.id===a.id?{...x,tipo_canale:e.target.value}:x))} style={{fontSize:12,padding:'3px 5px',border:'1px solid #e5e7eb',borderRadius:4}} disabled={a.stato!=='DA_AVVIARE'&&!a.isNew}>
                {CANALI.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="number" step="0.01" value={a.importo_previsto} onChange={e=>setAss(p=>p.map(x=>x.id===a.id?{...x,importo_previsto:parseFloat(e.target.value)||0}:x))} style={{fontSize:12,padding:'3px 5px',border:'1px solid #e5e7eb',borderRadius:4,textAlign:'right'}} disabled={a.stato!=='DA_AVVIARE'&&!a.isNew}/>
              <select value={a.fornitore_id||''} onChange={e=>setAss(p=>p.map(x=>x.id===a.id?{...x,fornitore_id:e.target.value||undefined}:x))} style={{fontSize:12,padding:'3px 5px',border:'1px solid #e5e7eb',borderRadius:4}}>
                <option value="">— da RDO —</option>
                {fornitori.map(f=><option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select>
              {(a.stato==='DA_AVVIARE'||a.isNew)&&<button onClick={()=>del(a.id)} style={{padding:'3px 6px',fontSize:11,border:'1px solid #fca5a5',borderRadius:4,background:'#fff',color:'#dc2626',cursor:'pointer'}}><Trash2 size={11}/></button>}
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6,paddingTop:6,borderTop:'1px solid #f3f4f6'}}>
            <button onClick={add} style={{fontSize:12,color:'#2563eb',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Plus size={12}/>Aggiungi</button>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              {margine>0&&<span style={{fontSize:11,color:'#059669',display:'flex',alignItems:'center',gap:3}}><TrendingUp size={12}/>€ {fmt(margine)} ({mPct.toFixed(1)}%)</span>}
              {margine<0&&<span style={{fontSize:11,color:'#dc2626',display:'flex',alignItems:'center',gap:3}}><TrendingDown size={12}/>Sforamento: € {fmt(Math.abs(margine))}</span>}
              <button onClick={save} disabled={saving} style={{padding:'3px 10px',fontSize:12,background:'#2563eb',color:'white',border:'none',borderRadius:5,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
                {saving?<Loader2 size={11}/>:<Save size={11}/>}Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AssegnazionePage() {
  const {id}=useParams() as {id:string}
  const [voci,setVoci]=useState<Voce[]>([])
  const [fornitori,setFornitori]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [filtro,setFiltro]=useState<'TUTTE'|'NON_ASS'|'PARZIALI'>('TUTTE')

  async function load(){
    setLoading(true)
    const [{data:vd},{data:fd}]=await Promise.all([
      supabase.from('voci_computo').select('*,voce_assegnazione(*)').eq('commessa_id',id).order('ordine'),
      supabase.from('fornitori').select('id,ragione_sociale').order('ragione_sociale')
    ])
    setVoci((vd||[]).map((v:any)=>({...v,assegnazioni:v.voce_assegnazione||[]})))
    setFornitori(fd||[]);setLoading(false)
  }
  useEffect(()=>{load()},[id])

  const totC=voci.reduce((s,v)=>s+v.importo,0)
  const totA=voci.reduce((s,v)=>s+(v.assegnazioni?.reduce((ss,a)=>ss+a.importo_previsto,0)||0),0)
  const totM=totC-totA;const mPct=totC>0?(totM/totC*100):0

  const vf=voci.filter(v=>{
    const ta=v.assegnazioni?.reduce((s,a)=>s+a.importo_previsto,0)||0
    if(filtro==='NON_ASS')return!v.assegnazioni?.length
    if(filtro==='PARZIALI')return v.assegnazioni?.length>0&&ta<v.importo
    return true
  })

  if(loading)return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200,gap:8,fontSize:14,color:'#9ca3af'}}><Loader2 size={16}/>Caricamento...</div>
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[{l:'Importo contratto',v:'€ '+fmt(totC),c:'#374151'},{l:'Costi assegnati',v:'€ '+fmt(totA),c:'#374151'},{l:'Margine previsto',v:'€ '+fmt(totM)+' ('+mPct.toFixed(1)+'%)',c:mPct<0?'#dc2626':mPct<5?'#d97706':'#059669'},{l:'Non assegnate',v:voci.filter(v=>!v.assegnazioni?.length).length+' / '+voci.length,c:'#374151'}].map((k,i)=>(
          <div key={i} style={{background:'#f9fafb',border:'1px solid #f3f4f6',borderRadius:8,padding:12}}>
            <div style={{fontSize:11,color:'#9ca3af',marginBottom:4}}>{k.l}</div>
            <div style={{fontSize:15,fontWeight:600,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {(['TUTTE','NON_ASS','PARZIALI'] as const).map(f=>(
          <button key={f} onClick={()=>setFiltro(f)} style={{padding:'5px 12px',fontSize:12,borderRadius:6,border:'1px solid',cursor:'pointer',borderColor:filtro===f?'#2563eb':'#e5e7eb',background:filtro===f?'#2563eb':'white',color:filtro===f?'white':'#374151'}}>
            {f==='TUTTE'?'Tutte':f==='NON_ASS'?'Non assegnate':'Parziali'}
          </button>
        ))}
      </div>
      {vf.map(v=><VoceRow key={v.id} voce={v} fornitori={fornitori} onRefresh={load}/>)}
    </div>
  )
}
