'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Loader2, Save, ChevronDown, ChevronRight } from 'lucide-react'

const fmt = (n: number) => (n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})

const CANALI = [
  {value:'SUBAPPALTO',     label:'Subappalto',        color:'#7c3aed'},
  {value:'SUBAFFIDAMENTO', label:'Subaffidamento',    color:'#2563eb'},
  {value:'ACQUISTO_DIRETTO',label:'Acquisto diretto', color:'#059669'},
  {value:'LAVORO_PROPRIO', label:'Lavoro proprio',    color:'#d97706'},
]
const COMP = [{value:'TOTALE',label:'Totale'},{value:'MAT',label:'Materiali'},{value:'MAN',label:'Manodopera'},{value:'NOL',label:'Noli'},{value:'CUSTOM',label:'Custom'}]

interface Ass { id:string;componente:string;tipo_canale:string;importo_previsto:number;fornitore_id?:string;stato:string;isNew?:boolean }
interface Voce { id:string;codice_tariffa?:string;codice?:string;descrizione:string;um:string;quantita:number;importo:number;soggetta_ribasso?:boolean;assegnazioni:Ass[];commessa_id?:string }

function VoceRow({voce,fornitori,onRefresh}:{voce:Voce;fornitori:any[];onRefresh:()=>void}) {
  const [open,setOpen]=useState(false)
  const [ass,setAss]=useState<Ass[]>(voce.assegnazioni||[])
  const [saving,setSaving]=useState(false)
  const totA=ass.reduce((s,a)=>s+(a.importo_previsto||0),0)
  const margine=voce.importo-totA
  const mPct=voce.importo>0?(margine/voce.importo*100):0
  const mCol=margine<0?'#dc2626':mPct<5?'#d97706':'#059669'

  async function save(){
    setSaving(true)
    for(const a of ass){
      if(a.isNew){
        await supabase.from('voce_assegnazione').insert({voce_computo_id:voce.id,commessa_id:voce.commessa_id,componente:a.componente,tipo_canale:a.tipo_canale,importo_previsto:a.importo_previsto,fornitore_id:a.fornitore_id||null,stato:'DA_AVVIARE'})
      } else {
        await supabase.from('voce_assegnazione').update({componente:a.componente,tipo_canale:a.tipo_canale,importo_previsto:a.importo_previsto,fornitore_id:a.fornitore_id||null}).eq('id',a.id)
      }
    }
    setSaving(false);onRefresh()
  }

  async function del(aid:string){
    if(!ass.find(a=>a.id===aid)?.isNew) await supabase.from('voce_assegnazione').delete().eq('id',aid)
    setAss(p=>p.filter(a=>a.id!==aid))
  }

  return (
    <div style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden',marginBottom:4}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',cursor:'pointer',background:open?'#f9fafb':'#fff'}}>
        {open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
        <span style={{fontFamily:'monospace',fontSize:11,color:'#9ca3af',minWidth:80}}>{voce.codice_tariffa||voce.codice||'-'}</span>
        <span style={{flex:1,fontSize:13}}>{voce.descrizione}</span>
        {!voce.soggetta_ribasso&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:'#fee2e2',color:'#dc2626'}}>PSC</span>}
        <span style={{fontSize:13,minWidth:120,textAlign:'right'}}>EUR {fmt(voce.importo)}</span>
        <span style={{fontSize:13,minWidth:100,textAlign:'right'}}>EUR {fmt(totA)}</span>
        <span style={{fontSize:12,fontWeight:600,minWidth:80,textAlign:'right',color:mCol}}>{mPct.toFixed(1)}%</span>
        <span style={{fontSize:11,color:'#6b7280',minWidth:60,textAlign:'right'}}>{ass.length} assegn.</span>
      </div>
      {open&&(
        <div style={{borderTop:'1px solid #f3f4f6',padding:'0 14px 12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'130px 160px 120px 1fr 80px',gap:6,padding:'6px 0 2px',fontSize:11,color:'#9ca3af',fontWeight:600}}>
            <span>Componente</span><span>Canale</span><span>Importo</span><span>Fornitore (opz.)</span><span></span>
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
                <option value="">-- da assegnare in RDO --</option>
                {fornitori.map((f:any)=><option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select>
              {(a.stato==='DA_AVVIARE'||a.isNew)&&<button onClick={()=>del(a.id)} style={{padding:'3px 6px',fontSize:11,border:'1px solid #fca5a5',borderRadius:4,background:'#fff',color:'#dc2626',cursor:'pointer'}}><Trash2 size={11}/></button>}
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6,paddingTop:6,borderTop:'1px solid #f3f4f6'}}>
            <button onClick={()=>setAss(p=>[...p,{id:'new_'+Date.now(),componente:'TOTALE',tipo_canale:'SUBAPPALTO',importo_previsto:Math.max(0,voce.importo-totA),stato:'DA_AVVIARE',isNew:true}])} style={{fontSize:12,color:'#2563eb',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Plus size={12}/>Aggiungi assegnazione</button>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              {margine<0&&<span style={{fontSize:11,color:'#dc2626'}}>Sforamento EUR {fmt(Math.abs(margine))}</span>}
              {margine>0&&<span style={{fontSize:11,color:'#059669'}}>Margine: EUR {fmt(margine)} ({mPct.toFixed(1)}%)</span>}
              <button onClick={save} disabled={saving} style={{padding:'3px 10px',fontSize:12,background:'#2563eb',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
                {saving?<Loader2 size={11} className="animate-spin"/>:<Save size={11}/>} Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AssegnazioneVociPage() {
  const {id}=useParams() as {id:string}
  const [voci,setVoci]=useState<Voce[]>([])
  const [fornitori,setFornitori]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [filtro,setFiltro]=useState<'TUTTE'|'NON_ASS'|'PARZIALI'>('TUTTE')

  async function load(){
    setLoading(true)
    const {data:cm}=await supabase.from('computo_metrico').select('id').eq('commessa_id',id).eq('tipo_uso','AGGIUDICATA').maybeSingle()
    const computoId=cm?.id
    const [vcRes,assRes,fornRes]=await Promise.all([
      computoId
        ? supabase.from('voci_computo').select('*').eq('computo_id',computoId).order('capitolo').order('codice')
        : supabase.from('voci_computo').select('*').eq('commessa_id',id).order('ordine'),
      supabase.from('voce_assegnazione').select('*').eq('commessa_id',id),
      supabase.from('professionisti_fornitori').select('id,ragione_sociale').order('ragione_sociale'),
    ])
    const assMap:Record<string,Ass[]>={}
    for(const a of (assRes.data||[])){
      if(!assMap[a.voce_computo_id]) assMap[a.voce_computo_id]=[]
      assMap[a.voce_computo_id].push({...a})
    }
    const voceList=(vcRes.data||[]).map((v:any)=>({...v,commessa_id:id,codice_tariffa:v.codice_tariffa||v.codice,assegnazioni:assMap[v.id]||[]}))
    setVoci(voceList);setFornitori(fornRes.data||[]);setLoading(false)
  }

  useEffect(()=>{load()},[id])

  const totC=voci.reduce((s,v)=>s+v.importo,0)
  const totA=voci.reduce((s,v)=>s+(v.assegnazioni?.reduce((ss,a)=>ss+(a.importo_previsto||0),0)||0),0)
  const totM=totC-totA
  const mPct=totC>0?(totM/totC*100):0

  const vf=voci.filter(v=>{
    if(filtro==='NON_ASS') return !v.assegnazioni?.length
    if(filtro==='PARZIALI') return v.assegnazioni?.length>0&&v.assegnazioni.reduce((s,a)=>s+(a.importo_previsto||0),0)<v.importo
    return true
  })

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200,gap:8,fontSize:14,color:'#9ca3af'}}><Loader2 size={16} className="animate-spin"/>Caricamento {voci.length} voci...</div>

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {l:'Importo contratto',v:'EUR '+fmt(totC)},
          {l:'Costi assegnati',v:'EUR '+fmt(totA)},
          {l:'Margine previsto',v:'EUR '+fmt(totM)+' ('+mPct.toFixed(1)+'%)',c:mPct<0?'#dc2626':mPct<5?'#d97706':'#059669'},
          {l:'Non assegnate',v:voci.filter(v=>!v.assegnazioni?.length).length+' / '+voci.length},
        ].map(({l,v,c},i)=>(
          <div key={i} style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:12}}>
            <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>{l}</div>
            <div style={{fontSize:15,fontWeight:600,color:c||'#111827'}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {(['TUTTE','NON_ASS','PARZIALI'] as const).map(f=>(
          <button key={f} onClick={()=>setFiltro(f)} style={{padding:'4px 12px',fontSize:12,borderRadius:6,border:'1px solid',borderColor:filtro===f?'#2563eb':'#e5e7eb',background:filtro===f?'#2563eb':'#fff',color:filtro===f?'#fff':'#374151',cursor:'pointer'}}>
            {f==='TUTTE'?'Tutte':f==='NON_ASS'?'Non assegnate':'Parziali'}
          </button>
        ))}
        <span style={{fontSize:12,color:'#6b7280',marginLeft:8,alignSelf:'center'}}>{vf.length} voci</span>
      </div>
      {vf.length===0
        ?<div style={{textAlign:'center',padding:'40px',color:'#9ca3af',fontSize:14}}>Nessuna voce</div>
        :vf.map(voce=><VoceRow key={voce.id} voce={voce} fornitori={fornitori} onRefresh={load}/>)
      }
    </div>
  )
}
