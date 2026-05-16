'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number | undefined | null, d = 2) =>
  n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

function durcInfo(scadenza?: string | null): { valido: boolean; label: string; gg: number } {
  if (!scadenza) return { valido: false, label: 'Non disponibile', gg: -999 }
  const gg = Math.ceil((new Date(scadenza).getTime() - Date.now()) / 86400000)
  if (gg < 0) return { valido: false, label: `Scaduto ${Math.abs(gg)}gg fa`, gg }
  if (gg <= 30) return { valido: true, label: `Scade in ${gg}gg ⚠`, gg }
  return { valido: true, label: `Valido fino ${scadenza}`, gg }
}

interface ContrattoSub {
  id: string
  importo: number
  stato: string
  note?: string
  fornitore: { id: string; ragione_sociale?: string; nome?: string; cognome?: string; durc_scadenza?: string } | null
}

interface SalPassivo {
  id: string; commessa_id: string; contratto_sub_id: string; fornitore_id: string
  numero: number; data_emissione: string; al_giorno: string
  percentuale_avanzamento: number; importo_contratto: number
  importo_lordo: number; ritenuta_garanzia_pct: number; ritenuta_garanzia: number
  importo_netto: number; durc_ok: boolean; stato: string; note?: string
}

const STATI_SAL = ['ricevuto','in_verifica','autorizzato','pagato','sospeso']
const SC: Record<string,string> = {
  ricevuto:'#6b7280', in_verifica:'#f59e0b', autorizzato:'#3b82f6', pagato:'#10b981', sospeso:'#ef4444'
}

const S = {
  card:  { background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' } as React.CSSProperties,
  hdr:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg)' } as React.CSSProperties,
  hl:    { fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase' as const, letterSpacing:'0.04em' },
  th:    { padding:'7px 10px', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const, background:'var(--bg)', borderBottom:'1px solid var(--border)', textAlign:'left' as const, whiteSpace:'nowrap' as const },
  td:    { padding:'8px 10px', fontSize:12, color:'var(--t2)', borderBottom:'1px solid var(--border)' },
  inp:   { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, outline:'none', background:'var(--panel)', color:'var(--t1)' } as React.CSSProperties,
  lbl:   { fontSize:11, fontWeight:600, color:'var(--t2)', marginBottom:4, display:'block' } as React.CSSProperties,
  btn:   (c: string): React.CSSProperties => ({ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:c, color:'#fff' }),
}

const fNome = (c: ContrattoSub) =>
  c.fornitore?.ragione_sociale || `${c.fornitore?.nome || ''} ${c.fornitore?.cognome || ''}`.trim() || '—'

export default function SALPassiviPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)

  const [contratti, setContratti]       = useState<ContrattoSub[]>([])
  const [salPassivi, setSalPassivi]     = useState<SalPassivo[]>([])
  const [loading, setLoading]           = useState(true)
  const [modalContratto, setModalContratto] = useState<ContrattoSub | null>(null)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [toast, setToast]               = useState('')

  const [form, setForm] = useState({
    percentuale_avanzamento: 0,
    ritenuta_pct: 5,
    data_emissione: new Date().toISOString().slice(0,10),
    al_giorno: new Date().toISOString().slice(0,10),
    note: '',
  })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: ctr }, { data: sal }] = await Promise.all([
      supabase.from('contratti_sub')
        .select('id,importo,stato,note,fornitore:professionisti_fornitori(id,ragione_sociale,nome,cognome,durc_scadenza)')
        .eq('commessa_id', id),
      supabase.from('sal_passivi')
        .select('*')
        .eq('commessa_id', id)
        .order('contratto_sub_id').order('numero')
    ])
    // Supabase restituisce fornitore come array dal join, normalizziamo
    const ctrNorm = (ctr || []).map((c: any) => ({
      ...c,
      fornitore: Array.isArray(c.fornitore) ? (c.fornitore[0] ?? null) : c.fornitore,
    })) as ContrattoSub[]
    setContratti(ctrNorm)
    setSalPassivi((sal as SalPassivo[]) || [])
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  const apriNuovoSal = (ctr: ContrattoSub) => {
    const salDelContratto = salPassivi.filter(s => s.contratto_sub_id === ctr.id)
    const pctPrecedente = salDelContratto.reduce((max, s) => Math.max(max, s.percentuale_avanzamento || 0), 0)
    setForm({
      percentuale_avanzamento: pctPrecedente,
      ritenuta_pct: 5,
      data_emissione: new Date().toISOString().slice(0,10),
      al_giorno: new Date().toISOString().slice(0,10),
      note: '',
    })
    setModalContratto(ctr)
  }

  const creaSal = async () => {
    if (!modalContratto) return
    const durc = durcInfo(modalContratto.fornitore?.durc_scadenza)
    if (!durc.valido) {
      const ok = window.confirm(`⚠ DURC non valido: ${durc.label}\nVuoi registrare il SAL comunque? Il pagamento rimarrà bloccato.`)
      if (!ok) return
    }
    setSaving(true)
    const aziendaId = await getAziendaId()
    const salDelContratto = salPassivi.filter(s => s.contratto_sub_id === modalContratto.id)
    const numero = salDelContratto.length + 1
    const importoContratto = modalContratto.importo || 0
    const importoLordo = parseFloat((importoContratto * form.percentuale_avanzamento / 100).toFixed(2))

    // Deduci quanto già pagato nei SAL precedenti di questo contratto
    const gia_certificato = salDelContratto.reduce((s, sal) => s + (sal.importo_lordo || 0), 0)
    const importoPeriodo = Math.max(0, parseFloat((importoLordo - gia_certificato).toFixed(2)))
    const ritenuta = parseFloat((importoPeriodo * form.ritenuta_pct / 100).toFixed(2))
    const netto = parseFloat((importoPeriodo - ritenuta).toFixed(2))

    const { error } = await supabase.from('sal_passivi').insert({
      commessa_id: id,
      azienda_id: aziendaId,
      contratto_sub_id: modalContratto.id,
      fornitore_id: modalContratto.fornitore?.id || null,
      numero,
      data_emissione: form.data_emissione,
      al_giorno: form.al_giorno,
      percentuale_avanzamento: form.percentuale_avanzamento,
      importo_contratto: importoContratto,
      importo_lordo: importoPeriodo,
      ritenuta_garanzia_pct: form.ritenuta_pct,
      ritenuta_garanzia: ritenuta,
      importo_netto: netto,
      durc_ok: durc.valido,
      stato: 'ricevuto',
      note: form.note,
    })
    setSaving(false)
    if (error) { showToast('Errore: ' + error.message); return }
    showToast(`✓ SAL ${numero} registrato`)
    setModalContratto(null)
    setExpanded(modalContratto.id)
    await carica()
  }

  const cambiaStato = async (sal: SalPassivo, stato: string) => {
    await supabase.from('sal_passivi').update({ stato }).eq('id', sal.id)
    setSalPassivi(prev => prev.map(s => s.id === sal.id ? {...s, stato} : s))
    showToast(`SAL ${sal.numero} → ${stato}`)
  }

  const autorizza = async (sal: SalPassivo, ctr: ContrattoSub) => {
    const durc = durcInfo(ctr.fornitore?.durc_scadenza)
    if (!durc.valido) { showToast('⚠ DURC non valido — pagamento bloccato'); return }
    await cambiaStato(sal, 'autorizzato')
    showToast(`✓ Pagamento autorizzato — € ${fi(sal.importo_netto)}`)
  }

  // KPI globali
  const totaleLordo  = salPassivi.reduce((s,x) => s + (x.importo_lordo || 0), 0)
  const totaleNetto  = salPassivi.reduce((s,x) => s + (x.importo_netto || 0), 0)
  const totalePagato = salPassivi.filter(x=>x.stato==='pagato').reduce((s,x) => s + (x.importo_netto || 0), 0)
  const daAutorizzare = salPassivi.filter(x=>['ricevuto','in_verifica'].includes(x.stato)).length

  // Calcolo live nel form
  const importoContratto = modalContratto?.importo || 0
  const salPrec          = salPassivi.filter(s => s.contratto_sub_id === modalContratto?.id)
  const giaCertificato   = salPrec.reduce((s,sal) => s + (sal.importo_lordo || 0), 0)
  const importoLordoCalc = parseFloat((importoContratto * form.percentuale_avanzamento / 100).toFixed(2))
  const importoPeriodoCalc = Math.max(0, parseFloat((importoLordoCalc - giaCertificato).toFixed(2)))
  const ritenutaCalc     = parseFloat((importoPeriodoCalc * form.ritenuta_pct / 100).toFixed(2))
  const nettoCalc        = parseFloat((importoPeriodoCalc - ritenutaCalc).toFixed(2))

  return (
    <div style={{ minHeight:'100%', background:'var(--bg)', padding:16, display:'flex', flexDirection:'column', gap:12 }} className="fade-in">

      {/* ── KPI ── */}
      <div style={S.card}>
        <div style={S.hdr}>
          <span style={S.hl}>SAL Passivi — verso subappaltatori</span>
          {daAutorizzare > 0 && <span style={{ fontSize:11, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:6, padding:'3px 10px' }}>⚠ {daAutorizzare} da verificare</span>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}>
          {[
            { l:'Contratti sub', v:`${contratti.length}`, sub:'attivi sulla commessa', color:'var(--t1)' },
            { l:'Totale lordo', v:`€ ${fi(totaleLordo)}`, color:'#3b82f6' },
            { l:'Totale netto', v:`€ ${fi(totaleNetto)}`, color:'#8b5cf6' },
            { l:'Pagato', v:`€ ${fi(totalePagato)}`, sub:`Da pagare: € ${fi(totaleNetto - totalePagato)}`, color:'#10b981' },
          ].map((k, i) => (
            <div key={i} style={{ padding:'14px 16px', borderRight: i<3?'1px solid var(--border)':'none' }}>
              <p style={{ fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>{k.l}</p>
              <p style={{ fontSize:18, fontWeight:700, color:k.color, fontVariantNumeric:'tabular-nums' }}>{k.v}</p>
              {k.sub && <p style={{ fontSize:10, color:'var(--t3)', marginTop:4 }}>{k.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── LISTA CONTRATTI SUB ── */}
      {loading ? (
        <div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
      ) : contratti.length === 0 ? (
        <div style={{ ...S.card, padding:40, textAlign:'center', color:'var(--t3)' } as React.CSSProperties}>
          <p style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Nessun contratto sub per questa commessa</p>
          <p style={{ fontSize:12 }}>Aggiungi prima i subappaltatori nella sezione Contratti.</p>
        </div>
      ) : (
        contratti.map(ctr => {
          const durc      = durcInfo(ctr.fornitore?.durc_scadenza)
          const salCtr    = salPassivi.filter(s => s.contratto_sub_id === ctr.id)
          const pctUltimo = salCtr.length > 0 ? Math.max(...salCtr.map(s=>s.percentuale_avanzamento||0)) : 0
          const nettoTot  = salCtr.reduce((s,x)=>s+(x.importo_netto||0),0)
          const isOpen    = expanded === ctr.id

          return (
            <div key={ctr.id} style={S.card}>
              {/* Header contratto */}
              <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                <button onClick={() => setExpanded(isOpen ? null : ctr.id)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t3)', fontSize:16, padding:4, flexShrink:0 }}>
                  {isOpen ? '▼' : '▶'}
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{fNome(ctr)}</span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, border:'1px solid var(--border)', color:'var(--t3)', fontWeight:600 }}>
                      {ctr.stato || 'attivo'}
                    </span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6,
                      background: durc.valido ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${durc.valido?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.25)'}`,
                      color: durc.valido ? '#10b981' : '#ef4444', fontWeight:600 }}>
                      {durc.valido ? '✓' : '⚠'} DURC: {durc.label}
                    </span>
                  </div>
                  <p style={{ fontSize:11, color:'var(--t3)' }}>
                    Contratto: <b style={{ color:'var(--t2)' }}>€ {fi(ctr.importo)}</b>
                    {salCtr.length > 0 && <> · Avanzamento: <b style={{ color:'var(--accent)' }}>{pctUltimo.toFixed(1)}%</b> · Netto emesso: <b style={{ color:'#10b981' }}>€ {fi(nettoTot)}</b></>}
                    {salCtr.length === 0 && <> · <i>Nessun SAL registrato</i></>}
                  </p>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  {pctUltimo > 0 && (
                    <div style={{ width:80 }}>
                      <div style={{ height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(pctUltimo,100)}%`, background:'var(--accent)', borderRadius:3 }} />
                      </div>
                      <p style={{ fontSize:9, color:'var(--t3)', textAlign:'right', marginTop:2 }}>{pctUltimo.toFixed(0)}%</p>
                    </div>
                  )}
                  <button style={S.btn('var(--accent)')} onClick={() => apriNuovoSal(ctr)}>
                    + SAL
                  </button>
                </div>
              </div>

              {/* Lista SAL espansa */}
              {isOpen && salCtr.length > 0 && (
                <div style={{ borderTop:'1px solid var(--border)' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>{['N°','Data','Al giorno','% Avanz.','Lordo periodo','Ritenuta','Netto','DURC','Stato',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {salCtr.map(sal => {
                        const durcSal = durcInfo(ctr.fornitore?.durc_scadenza)
                        return (
                          <tr key={sal.id}
                            onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                            onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                            <td style={{...S.td, fontWeight:700, textAlign:'center' as const}}>{sal.numero}</td>
                            <td style={{...S.td, fontSize:11}}>{sal.data_emissione}</td>
                            <td style={{...S.td, fontSize:11}}>{sal.al_giorno}</td>
                            <td style={{...S.td, textAlign:'center' as const, fontWeight:700, color:'var(--accent)'}}>{sal.percentuale_avanzamento?.toFixed(1)}%</td>
                            <td style={{...S.td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums', fontWeight:600}}>€ {fi(sal.importo_lordo)}</td>
                            <td style={{...S.td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums', color:'#ef4444', fontSize:11}}>(€ {fi(sal.ritenuta_garanzia)})</td>
                            <td style={{...S.td, textAlign:'right' as const, fontWeight:700, fontVariantNumeric:'tabular-nums', color:'#10b981'}}>€ {fi(sal.importo_netto)}</td>
                            <td style={{...S.td, textAlign:'center' as const}}>
                              <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, fontWeight:700, background:durcSal.valido?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)', color:durcSal.valido?'#10b981':'#ef4444' }}>
                                {durcSal.valido ? '✓' : '✗'}
                              </span>
                            </td>
                            <td style={S.td}>
                              <select value={sal.stato} onChange={e=>cambiaStato(sal,e.target.value)}
                                style={{ padding:'3px 6px', borderRadius:6, border:`1px solid ${SC[sal.stato]||'#ccc'}44`, background:(SC[sal.stato]||'#ccc')+'22', color:SC[sal.stato]||'#666', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                {STATI_SAL.map(s=><option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={S.td}>
                              {sal.stato === 'ricevuto' && (
                                <button style={{...S.btn('#f59e0b'), fontSize:11, padding:'4px 10px'}} onClick={()=>cambiaStato(sal,'in_verifica')}>🔍 Verifica</button>
                              )}
                              {sal.stato === 'in_verifica' && (
                                <button style={{...S.btn(durcSal.valido?'#3b82f6':'#9ca3af'), fontSize:11, padding:'4px 10px'}}
                                  onClick={() => autorizza(sal, ctr)} title={!durcSal.valido?'DURC non valido':undefined}>
                                  🔒 Autorizza
                                </button>
                              )}
                              {sal.stato === 'autorizzato' && (
                                <button style={{...S.btn('#10b981'), fontSize:11, padding:'4px 10px'}} onClick={()=>cambiaStato(sal,'pagato')}>€ Pagato</button>
                              )}
                              {sal.stato === 'pagato' && (
                                <span style={{ fontSize:11, color:'#10b981', fontWeight:700 }}>✓ Pagato</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {isOpen && salCtr.length === 0 && (
                <div style={{ padding:'20px', textAlign:'center', color:'var(--t3)', fontSize:12, borderTop:'1px solid var(--border)' }}>
                  Nessun SAL registrato per questo subappaltatore.
                </div>
              )}
            </div>
          )
        })
      )}

      {/* ── MODAL NUOVO SAL PASSIVO ── */}
      {modalContratto && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setModalContratto(null) }}>
          <div className="modal-box" style={{ maxWidth:540, width:'94%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div>
                <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>Nuovo SAL — {fNome(modalContratto)}</h3>
                <p style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>
                  SAL n. {salPassivi.filter(s=>s.contratto_sub_id===modalContratto.id).length+1} · Contratto: € {fi(modalContratto.importo)}
                </p>
              </div>
              <button onClick={() => setModalContratto(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>×</button>
            </div>

            {/* Badge DURC */}
            {(() => {
              const d = durcInfo(modalContratto.fornitore?.durc_scadenza)
              return (
                <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:8, border:`1px solid ${d.valido?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.4)'}`, background:d.valido?'rgba(16,185,129,0.06)':'rgba(239,68,68,0.06)', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14 }}>{d.valido ? '✓' : '⚠'}</span>
                  <div>
                    <p style={{ fontSize:12, fontWeight:700, color:d.valido?'#10b981':'#ef4444', margin:0 }}>DURC: {d.label}</p>
                    {!d.valido && <p style={{ fontSize:11, color:'#ef4444', margin:'2px 0 0' }}>Il pagamento sarà bloccato fino a DURC valido.</p>}
                  </div>
                </div>
              )
            })()}

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={S.lbl}>Data emissione SAL</label>
                  <input type="date" style={S.inp} value={form.data_emissione} onChange={e=>setForm(p=>({...p, data_emissione:e.target.value}))} />
                </div>
                <div>
                  <label style={S.lbl}>Al giorno</label>
                  <input type="date" style={S.inp} value={form.al_giorno} onChange={e=>setForm(p=>({...p, al_giorno:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
                <div>
                  <label style={S.lbl}>% Avanzamento lavori certificata</label>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input type="range" min={0} max={100} step={0.5} value={form.percentuale_avanzamento}
                      onChange={e=>setForm(p=>({...p, percentuale_avanzamento:parseFloat(e.target.value)||0}))}
                      style={{ flex:1, accentColor:'var(--accent)' }} />
                    <input type="number" min={0} max={100} step={0.1}
                      style={{ ...S.inp, width:72, textAlign:'right' as const, fontFamily:'monospace' }}
                      value={form.percentuale_avanzamento}
                      onChange={e=>setForm(p=>({...p, percentuale_avanzamento:parseFloat(e.target.value)||0}))} />
                    <span style={{ fontSize:12, fontWeight:700 }}>%</span>
                  </div>
                </div>
                <div>
                  <label style={S.lbl}>Ritenuta garanzia %</label>
                  <input type="number" min={0} max={20} step={0.5} style={S.inp} value={form.ritenuta_pct}
                    onChange={e=>setForm(p=>({...p, ritenuta_pct:parseFloat(e.target.value)||0}))} />
                </div>
              </div>

              {/* Quadro calcolo */}
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
                <p style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:10 }}>Calcolo automatico</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                  {[
                    { l:`Importo contratto (${form.percentuale_avanzamento.toFixed(1)}%)`, v:importoLordoCalc, c:'var(--t1)' },
                    { l:'Già certificato SAL prec.', v:-giaCertificato, c:'var(--t3)' },
                    { l:'Importo periodo', v:importoPeriodoCalc, c:'var(--accent)', bold:true },
                    { l:`Ritenuta garanzia ${form.ritenuta_pct}%`, v:-ritenutaCalc, c:'#ef4444' },
                    { l:'Netto da pagare', v:nettoCalc, c:'#10b981', bold:true },
                  ].map((k, i) => (
                    <React.Fragment key={i}>
                      <span style={{ color:'var(--t3)' }}>{k.l}:</span>
                      <span style={{ textAlign:'right' as const, fontWeight:k.bold?700:400, color:k.c, fontVariantNumeric:'tabular-nums' }}>
                        {k.v < 0 ? `(€ ${fi(Math.abs(k.v))})` : `€ ${fi(k.v)}`}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div>
                <label style={S.lbl}>Note</label>
                <input style={S.inp} value={form.note} placeholder="Prestazioni, periodo, annotazioni..." onChange={e=>setForm(p=>({...p,note:e.target.value}))} />
              </div>

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8 }}>
                <button style={S.btn('#6b7280')} onClick={() => setModalContratto(null)}>Annulla</button>
                <button style={S.btn('var(--accent)')} onClick={creaSal} disabled={saving || importoPeriodoCalc <= 0}>
                  {saving ? '...' : `✓ Registra SAL — € ${fi(nettoCalc)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#14532d', color:'#fff', padding:'10px 18px', borderRadius:10, fontSize:12, fontWeight:700, zIndex:1000, boxShadow:'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
