'use client'
import { useState } from 'react'

const DATI = [
  {id:'1',codice:'26.PNA.RS.001',alias:'Scuola Media Viale Mazzini',stato:'IN_ESECUZIONE',tipo:'Pubblica',cat:'Ristrutturazione',comune:'Napoli',importo:3200000,cig:'A12345678B',fine:'2026-09-30'},
  {id:'2',codice:'26.PRM.NC.002',alias:'Residenziale Via Caracciolo',stato:'AGGIUDICATA',tipo:'Privata',cat:'Nuova Costruzione',comune:'Roma',importo:1850000,cig:'',fine:'2027-03-15'},
  {id:'3',codice:'26.PCE.IF.003',alias:'Asse Viario Provinciale Lotto 2',stato:'IN_ESECUZIONE',tipo:'Pubblica',cat:'Infrastrutture',comune:'Caserta',importo:8900000,cig:'B98765432C',fine:'2026-12-31'},
  {id:'4',codice:'26.VNA.DR.004',alias:'Demo+Ricostruzione Via Toledo 44',stato:'COLLAUDO',tipo:'Privata',cat:'Demo+Ricostr.',comune:'Napoli',importo:650000,cig:'',fine:'2026-04-15'},
  {id:'5',codice:'26.ANA.MS.005',alias:'Accordo Quadro Manut. ATC',stato:'IN_ESECUZIONE',tipo:'Accordo Quadro',cat:'Manut. Straord.',comune:'Napoli',importo:5000000,cig:'C11223344D',fine:'2027-12-31'},
  {id:'6',codice:'26.PSA.RE.006',alias:'Restauro Palazzo Storico Salerno',stato:'ACQUISITA',tipo:'Pubblica',cat:'Restauro',comune:'Salerno',importo:2100000,cig:'',fine:'2027-06-30'},
]
const ST: Record<string,{label:string,cls:string}> = {
  IN_ESECUZIONE:{label:'In esecuzione',cls:'b-green'},
  AGGIUDICATA:{label:'Aggiudicata',cls:'b-blue'},
  ACQUISITA:{label:'Acquisita',cls:'b-gray'},
  COLLAUDO:{label:'Collaudo',cls:'b-yellow'},
  SOSPESA:{label:'Sospesa',cls:'b-red'},
}
const fe=(n:number)=>n>=1e6?'€'+(n/1e6).toFixed(2)+'M':n>=1e3?'€'+Math.round(n/1e3)+'k':'€'+n
const fd=(d:string)=>new Date(d).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})

export default function CommessePage(){
  const [search,setSearch]=useState('')
  const [filtro,setFiltro]=useState('TUTTI')
  const [modal,setModal]=useState(false)

  const lista=DATI.filter(c=>{
    const ms=!search||c.alias.toLowerCase().includes(search.toLowerCase())||c.codice.includes(search)||c.comune.toLowerCase().includes(search.toLowerCase())
    const mf=filtro==='TUTTI'||c.stato===filtro
    return ms&&mf
  })

  return(
    <div>
      <div className="header">
        <div>
          <div className="header-bread">SQ360 / Commesse</div>
          <div className="header-title">Commesse</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Nuova Commessa</button>
      </div>
      <div className="content fade-in">
        <div className="filters">
          <div className="search-wrap">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="search-inp" placeholder="Cerca commessa, comune, codice..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {['TUTTI','IN_ESECUZIONE','AGGIUDICATA','COLLAUDO','ACQUISITA'].map(s=>(
            <button key={s} className={`filter-btn ${filtro===s?'filter-on':'filter-off'}`} onClick={()=>setFiltro(s)}>
              {s==='TUTTI'?'Tutte':ST[s]?.label??s}
            </button>
          ))}
        </div>
        <div className="card" style={{overflow:'hidden'}}>
          <table className="tbl">
            <thead><tr><th>Codice</th><th>Commessa</th><th>Tipo / Categoria</th><th>Comune</th><th>Stato</th><th>Importo</th><th>Fine lavori</th><th>CIG</th></tr></thead>
            <tbody>
              {lista.map(c=>{
                const st=ST[c.stato]??{label:c.stato,cls:'b-gray'}
                return(
                  <tr key={c.id}>
                    <td><span className="tbl code">{c.codice}</span></td>
                    <td className="bold">{c.alias}</td>
                    <td style={{fontSize:12,color:'#64748B'}}>{c.tipo} · {c.cat}</td>
                    <td style={{fontSize:12}}>📍 {c.comune}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td className="mono">{fe(c.importo)}</td>
                    <td style={{fontSize:12}}>{fd(c.fine)}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'#94A3B8'}}>{c.cig||'—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="modal">
            <div className="modal-head">
              <div><h2 style={{fontSize:15,fontWeight:700}}>Nuova Commessa</h2><p style={{fontSize:11,color:'#94A3B8',marginTop:2}}>Il codice viene generato automaticamente</p></div>
              <button className="btn btn-ghost" style={{padding:6}} onClick={()=>setModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="row3">
                <div><label className="label">TIPO COMMITTENTE *</label><select className="sel"><option>Pubblica</option><option>Privata</option><option>Mista PPP</option><option>Accordo Quadro</option></select></div>
                <div><label className="label">CATEGORIA OPERA *</label><select className="sel"><option>Ristrutturazione</option><option>Nuova Costruzione</option><option>Demo+Ricostruzione</option><option>Manut. Straord.</option><option>Infrastrutture</option><option>Restauro</option></select></div>
                <div><label className="label">PROVINCIA *</label><select className="sel"><option>NA</option><option>CE</option><option>SA</option><option>AV</option><option>BN</option><option>RM</option><option>MI</option></select></div>
              </div>
              <div style={{background:'#E6F3EC',border:'1px solid #C3E2CF',borderRadius:8,padding:'9px 13px',marginBottom:13}}>
                <span style={{fontSize:11,color:'#1B6E42',fontWeight:600}}>Codice automatico: </span>
                <span style={{fontFamily:'monospace',fontSize:13,color:'#0D3E25',fontWeight:700}}>26.PNA.RS.XXX</span>
              </div>
              <div className="field"><label className="label">NOME COMMESSA *</label><input className="inp" placeholder="es. Scuola Media Viale Mazzini"/></div>
              <div className="row2">
                <div><label className="label">COMMITTENTE / STAZIONE APPALTANTE</label><input className="inp" placeholder="Comune di Napoli"/></div>
                <div><label className="label">P.IVA COMMITTENTE</label><input className="inp" placeholder="80014890633"/></div>
              </div>
              <div className="row2">
                <div><label className="label">CIG</label><input className="inp" placeholder="A12345678B"/></div>
                <div><label className="label">CUP</label><input className="inp" placeholder="J51H22000010007"/></div>
              </div>
              <div className="row3">
                <div><label className="label">IMPORTO BASE ASTA (€)</label><input className="inp" type="number" placeholder="0.00"/></div>
                <div><label className="label">RIBASSO OFFERTO (%)</label><input className="inp" type="number" placeholder="0.000"/></div>
                <div><label className="label">ONERI SICUREZZA (€)</label><input className="inp" type="number" placeholder="0.00"/></div>
              </div>
              <div className="row3">
                <div><label className="label">DATA AGGIUDICAZIONE</label><input className="inp" type="date"/></div>
                <div><label className="label">DATA INIZIO LAVORI</label><input className="inp" type="date"/></div>
                <div><label className="label">DURATA (giorni)</label><input className="inp" type="number" placeholder="365"/></div>
              </div>
              <div className="row2">
                <div><label className="label">INDIRIZZO CANTIERE</label><input className="inp" placeholder="Via Roma 1"/></div>
                <div><label className="label">COMUNE</label><input className="inp" placeholder="Napoli"/></div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={()=>setModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={()=>setModal(false)}>+ Crea Commessa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
