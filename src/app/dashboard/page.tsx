import Link from 'next/link'

const COMMESSE = [
  { codice:'26.PNA.RS.001', alias:'Scuola Media Viale Mazzini', stato:'IN_ESECUZIONE', importo:3200000, comune:'Napoli', fine:'2026-09-30' },
  { codice:'26.PRM.NC.002', alias:'Residenziale Via Caracciolo', stato:'AGGIUDICATA', importo:1850000, comune:'Roma', fine:'2027-03-15' },
  { codice:'26.PCE.IF.003', alias:'Asse Viario Provinciale L2', stato:'IN_ESECUZIONE', importo:8900000, comune:'Caserta', fine:'2026-12-31' },
  { codice:'26.VNA.DR.004', alias:'Demo+Ricostruzione Via Toledo 44', stato:'COLLAUDO', importo:650000, comune:'Napoli', fine:'2026-04-15' },
  { codice:'26.ANA.MS.005', alias:'Accordo Quadro Manut. ATC', stato:'IN_ESECUZIONE', importo:5000000, comune:'Napoli', fine:'2027-12-31' },
]

const SCADENZE = [
  { tipo:'DURC', titolo:'DURC Edil Campania S.r.l.', data:'2026-04-15', urgente:true },
  { tipo:'SOA', titolo:'SOA OG2 Classe III — rinnovo', data:'2026-04-22', urgente:true },
  { tipo:'SAL', titolo:'SAL 3° — Scuola Viale Mazzini', data:'2026-04-30', urgente:false },
  { tipo:'PATENTE', titolo:'Patente Crediti — aggiornamento', data:'2026-05-10', urgente:false },
  { tipo:'POLIZZA', titolo:'Polizza RC — rinnovo', data:'2026-05-20', urgente:false },
]

const STATO_CFG: Record<string,{label:string,cls:string}> = {
  IN_ESECUZIONE:{label:'In esecuzione',cls:'b-green'},
  AGGIUDICATA:{label:'Aggiudicata',cls:'b-blue'},
  ACQUISITA:{label:'Acquisita',cls:'b-gray'},
  COLLAUDO:{label:'Collaudo',cls:'b-yellow'},
  SOSPESA:{label:'Sospesa',cls:'b-red'},
}

function fe(n:number){return n>=1e6?'€'+(n/1e6).toFixed(2)+'M':n>=1e3?'€'+Math.round(n/1e3)+'k':'€'+n}
function fd(d:string){return new Date(d).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})}
function dg(d:string){return Math.ceil((new Date(d).getTime()-Date.now())/(864e5))}

export default function Dashboard() {
  return (
    <div>
      <div className="header">
        <div>
          <div className="header-bread">SQ360</div>
          <div className="header-title">Dashboard</div>
        </div>
      </div>
      <div className="content fade-in">
        <div className="alert alert-red">
          <span>⚠</span>
          <span><strong>3 alert compliance</strong> richiedono attenzione — DURC in scadenza e SOA da rinnovare.</span>
          <Link href="/dashboard/scadenzario" style={{marginLeft:'auto',fontWeight:700,color:'#B91C1C',textDecoration:'none',whiteSpace:'nowrap'}}>Vedi →</Link>
        </div>

        <div className="kpi-grid">
          {[
            {label:'Commesse attive',value:'12',color:'#1B6E42'},
            {label:'Portafoglio',value:'€48.7M',color:'#1D4ED8'},
            {label:'Contratti sub',value:'31',color:'#7C3AED'},
            {label:'Fornitori attivi',value:'87',color:'#0EA5E9'},
            {label:'Scadenze urgenti',value:'5',color:'#B91C1C'},
          ].map(k=>(
            <div key={k.label} className="kpi">
              <div className="kpi-val" style={{color:k.color}}>{k.value}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:18}}>
          <div>
            <div className="card" style={{overflow:'hidden'}}>
              <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #EDEBE6'}}>
                <h3 style={{fontSize:13,fontWeight:700}}>Commesse in corso</h3>
                <Link href="/dashboard/commesse" style={{fontSize:12,color:'#1B6E42',fontWeight:700,textDecoration:'none'}}>Vedi tutte →</Link>
              </div>
              <table className="tbl">
                <thead><tr><th>Codice</th><th>Commessa</th><th>Stato</th><th>Importo</th><th>Fine lavori</th></tr></thead>
                <tbody>
                  {COMMESSE.map(c=>{
                    const st=STATO_CFG[c.stato]??{label:c.stato,cls:'b-gray'}
                    const gg=dg(c.fine)
                    return(
                      <tr key={c.codice}>
                        <td><span className="tbl code">{c.codice}</span></td>
                        <td className="bold">{c.alias}</td>
                        <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                        <td className="mono">{fe(c.importo)}</td>
                        <td style={{fontSize:12}}>
                          {fd(c.fine)}
                          {gg<30&&gg>0&&<span className="badge b-yellow" style={{marginLeft:6,fontSize:9}}>{gg}gg</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="card card-pad">
              <h3 style={{fontSize:13,fontWeight:700,marginBottom:14}}>Prossime scadenze</h3>
              {SCADENZE.map((s,i)=>{
                const d=dg(s.data)
                return(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 11px',borderRadius:8,background:s.urgente?'#FEF2F2':'#F7F6F2',border:`1px solid ${s.urgente?'#FECACA':'#EDEBE6'}`,marginBottom:7}}>
                    <div style={{width:38,height:38,borderRadius:8,flexShrink:0,background:s.urgente?'#FEE2E2':'#E6F3EC',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:13,fontWeight:900,color:s.urgente?'#B91C1C':'#1B6E42',lineHeight:1}}>{d}</span>
                      <span style={{fontSize:8,color:s.urgente?'#EF4444':'#1B6E42',fontWeight:600}}>gg</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.titolo}</div>
                      <div style={{fontSize:10,color:'#94A3B8',marginTop:2}}><span className={`badge ${s.urgente?'b-red':'b-gray'}`} style={{fontSize:9,padding:'0 5px'}}>{s.tipo}</span> {fd(s.data)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="card card-pad" style={{marginTop:14}}>
              <h3 style={{fontSize:13,fontWeight:700,marginBottom:12}}>Compliance aziendale</h3>
              {[
                {label:'DURC Aziendale',ok:true,scad:'2026-07-31'},
                {label:'SOA OG1 Classe V',ok:true,scad:'2027-09-30'},
                {label:'SOA OG2 Classe III',ok:false,scad:'2026-05-15'},
                {label:'Patente Crediti',ok:true,scad:'2027-01-01'},
              ].map(r=>(
                <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                  <span style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                    <span className={`dot ${r.ok?'dot-green':'dot-red'}`}/>
                    {r.label}
                  </span>
                  <span style={{fontSize:11,color:'#94A3B8'}}>{fd(r.scad)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
