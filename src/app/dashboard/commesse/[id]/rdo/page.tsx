'use client'
import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, Send, Check, Brain } from 'lucide-react'

const fmt=(n:number)=>(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function RDOPage(){
  const {id}=useParams() as {id:string}
  const searchParams=useSearchParams()
  const router=useRouter()
  const rdaIdPreset=searchParams.get('rda')
  const [rdo,setRdo]=useState<any[]>([])
  const [fornitori,setFornitori]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(!!rdaIdPreset)
  const [form,setForm]=useState({oggetto:'',data_scadenza:'',rda_id:rdaIdPreset||''})
  const [fornSel,setFornSel]=useState<string[]>([])
  const [saving,setSaving]=useState(false)
  const [aiLoading,setAiLoading]=useState<string|null>(null)

  async function load(){
    setLoading(true)
    const [{data:rd},{data:fd}]=await Promise.all([
      supabase.from('rdo').select('*,rdo_offerte(*)').eq('commessa_id',id).order('created_at',{ascending:false}),
      supabase.from('fornitori').select('id,ragione_sociale,tipo').order('ragione_sociale')
    ])
    setRdo(rd||[]);setFornitori(fd||[]);setLoading(false)
  }
  useEffect(()=>{load()},[id])

  async function createRDO(){
    setSaving(true)
    const numero=`RDO-${new Date().getFullYear()}-${String(rdo.length+1).padStart(3,'0')}`
    const {data:newRdo}=await supabase.from('rdo').insert({commessa_id:id,numero,oggetto:form.oggetto,
      data_scadenza:form.data_scadenza||null,rda_id:form.rda_id||null,stato:'BOZZA'}).select().single()
    if(newRdo&&fornSel.length>0){
      await supabase.from('rdo_offerte').insert(fornSel.map(fid=>({rdo_id:newRdo.id,fornitore_id:fid})))
      await supabase.from('rdo').update({stato:'INVIATA'}).eq('id',newRdo.id)
    }
    setSaving(false);setShowForm(false);setForm({oggetto:'',data_scadenza:'',rda_id:''});setFornSel([]);load()
  }

  async function accettaOfferta(rdoId:string,offertaId:string,fornId:string){
    await supabase.from('rdo_offerte').update({accettata:true}).eq('id',offertaId)
    await supabase.from('rdo_offerte').update({accettata:false}).eq('rdo_id',rdoId).neq('id',offertaId)
    await supabase.from('rdo').update({stato:'CHIUSA'}).eq('id',rdoId)
    router.push(`/dashboard/commesse/${id}/oda?rdo=${rdoId}&fornitore=${fornId}`)
  }

  async function aiLeggiOfferta(offertaId:string,url:string){
    if(!url){alert('Nessun allegato caricato per questa offerta');return}
    setAiLoading(offertaId)
    try{
      const res=await fetch('/api/ai-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,tipo:'preventivo_fornitore'})})
      const data=await res.json()
      if(data.importo){
        await supabase.from('rdo_offerte').update({ai_estratto_importo:data.importo,ai_estratto_note:data.note,ai_data_estrazione:new Date().toISOString()}).eq('id',offertaId)
        load()
      }
    }catch(e){console.error(e)}
    setAiLoading(null)
  }

  if(loading)return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200,gap:8,color:'#9ca3af'}}><Loader2 size={16}/>Caricamento...</div>
  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[{l:'Totale RDO',v:rdo.length},{l:'In attesa offerte',v:rdo.filter(r=>r.stato==='INVIATA').length},{l:'Offerte ricevute',v:rdo.filter(r=>r.stato==='OFFERTE_RICEVUTE').length},{l:'Chiuse',v:rdo.filter(r=>r.stato==='CHIUSA').length}].map((k,i)=>(
          <div key={i} style={{background:'#f9fafb',border:'1px solid #f3f4f6',borderRadius:8,padding:12}}>
            <div style={{fontSize:11,color:'#9ca3af',marginBottom:4}}>{k.l}</div>
            <div style={{fontSize:16,fontWeight:600,color:'#374151'}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:'7px 16px',fontSize:13,background:'#2563eb',color:'white',border:'none',borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><Plus size={14}/>Nuova RDO</button>
      </div>
      {showForm&&(
        <div style={{border:'1px solid #e5e7eb',borderRadius:8,padding:16,marginBottom:16,background:'#f9fafb'}}>
          <h3 style={{margin:'0 0 12px',fontSize:14,fontWeight:600}}>Nuova Richiesta di Offerta</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div style={{gridColumn:'1/-1'}}><label style={{fontSize:12,color:'#6b7280',display:'block',marginBottom:4}}>Oggetto *</label>
              <input value={form.oggetto} onChange={e=>setForm(p=>({...p,oggetto:e.target.value}))} placeholder="Descrizione richiesta..." style={{width:'100%',padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13}}/></div>
            <div><label style={{fontSize:12,color:'#6b7280',display:'block',marginBottom:4}}>Scadenza offerte</label>
              <input type="date" value={form.data_scadenza} onChange={e=>setForm(p=>({...p,data_scadenza:e.target.value}))} style={{width:'100%',padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13}}/></div>
          </div>
          <div><label style={{fontSize:12,color:'#6b7280',display:'block',marginBottom:8}}>Seleziona fornitori da contattare</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {fornitori.map(f=>(
                <label key={f.id} style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer',padding:'4px 8px',border:'1px solid',borderColor:fornSel.includes(f.id)?'#2563eb':'#e5e7eb',borderRadius:6,background:fornSel.includes(f.id)?'#eff6ff':'white'}}>
                  <input type="checkbox" checked={fornSel.includes(f.id)} onChange={e=>{if(e.target.checked)setFornSel(p=>[...p,f.id]);else setFornSel(p=>p.filter(x=>x!==f.id))}} style={{margin:0}}/>
                  {f.ragione_sociale}
                </label>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
            <button onClick={()=>setShowForm(false)} style={{padding:'6px 14px',fontSize:13,border:'1px solid #e5e7eb',borderRadius:6,background:'white',cursor:'pointer'}}>Annulla</button>
            <button onClick={createRDO} disabled={saving||!form.oggetto} style={{padding:'6px 14px',fontSize:13,background:'#2563eb',color:'white',border:'none',borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:!form.oggetto?0.5:1}}>
              <Send size={13}/>{saving?'...':'Crea e invia RDO'}
            </button>
          </div>
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {rdo.length===0?<div style={{textAlign:'center',padding:32,color:'#9ca3af',border:'1px solid #f3f4f6',borderRadius:8}}>Nessuna RDO creata</div>:
        rdo.map(r=>(
          <div key={r.id} style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'#f9fafb',borderBottom:'1px solid #f3f4f6'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontFamily:'monospace',fontSize:12,color:'#6b7280'}}>{r.numero}</span>
                <span style={{fontSize:13,fontWeight:500}}>{r.oggetto}</span>
              </div>
              <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:r.stato==='CHIUSA'?'#d1fae5':r.stato==='INVIATA'?'#fef3c7':'#f3f4f6',color:r.stato==='CHIUSA'?'#059669':r.stato==='INVIATA'?'#d97706':'#9ca3af',fontWeight:600}}>
                {r.stato}
              </span>
            </div>
            {(r.rdo_offerte||[]).length>0&&(
              <div style={{padding:'0 14px 12px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 140px 140px 100px',gap:6,padding:'8px 0 4px',fontSize:11,color:'#9ca3af',fontWeight:600}}>
                  <span>Fornitore</span><span style={{textAlign:'right'}}>Offerta ricevuta</span><span style={{textAlign:'right'}}>AI estratto</span><span></span>
                </div>
                {r.rdo_offerte.map((off:any)=>{
                  const forn=fornitori.find(f=>f.id===off.fornitore_id)
                  return(
                    <div key={off.id} style={{display:'grid',gridTemplateColumns:'1fr 140px 140px 100px',gap:6,alignItems:'center',padding:'4px 0',borderBottom:'1px solid #f9fafb'}}>
                      <span style={{fontSize:13}}>{forn?.ragione_sociale||'—'}</span>
                      <span style={{fontSize:13,textAlign:'right'}}>{off.importo_offerta?'€ '+fmt(off.importo_offerta):'—'}</span>
                      <span style={{fontSize:13,textAlign:'right',color:'#7c3aed'}}>{off.ai_estratto_importo?'€ '+fmt(off.ai_estratto_importo):'—'}</span>
                      <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                        {off.allegato_url&&<button onClick={()=>aiLeggiOfferta(off.id,off.allegato_url)} style={{padding:'2px 6px',fontSize:11,border:'1px solid #7c3aed',borderRadius:4,background:'white',color:'#7c3aed',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
                          {aiLoading===off.id?<Loader2 size={10}/>:<Brain size={10}/>}AI
                        </button>}
                        {!off.accettata&&r.stato!=='CHIUSA'&&off.importo_offerta&&<button onClick={()=>accettaOfferta(r.id,off.id,off.fornitore_id)} style={{padding:'2px 6px',fontSize:11,border:'1px solid #059669',borderRadius:4,background:'#059669',color:'white',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Check size={10}/>Accetta</button>}
                        {off.accettata&&<span style={{fontSize:11,color:'#059669',fontWeight:600}}>✓ Accettata</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
