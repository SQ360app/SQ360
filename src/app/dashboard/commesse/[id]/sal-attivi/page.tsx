'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

const STATI_SAL = ['bozza','emesso','approvato','fatturato','pagato']
const STATO_COLOR: Record<string,string> = {
  bozza:'#f59e0b', emesso:'#3b82f6', approvato:'#8b5cf6', fatturato:'#14b8a6', pagato:'#10b981'
}

interface SALAttivo {
  id: string; commessa_id: string; codice: string; numero: number
  data_inizio: string; data_fine: string
  importo_lavori: number; importo_sicurezza: number; importo_totale: number
  importo_precedenti: number; importo_netto: number
  ritenuta_garanzia: number; anticipazione_da_scompute: number
  importo_certificato: number
  stato: string; note: string
  approvato_da?: string; data_approvazione?: string
  numero_fattura?: string; data_fattura?: string; data_pagamento?: string
}

interface Commessa {
  id: string; nome: string
  importo_contrattuale: number; ribasso_pct: number; oneri_sicurezza: number
}

const styleObj = {
  page:  { minHeight:'100%', background:'var(--bg)', padding:16, display:'flex', flexDirection:'column' as const, gap:12 },
  card:  { background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' } as React.CSSProperties,
  hdr:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg)' },
  hl:    { fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase' as const, letterSpacing:'0.04em' },
  kgrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid var(--border)' } as React.CSSProperties,
  kcell: (last: boolean) => ({ padding:'14px 16px', borderRight: last ? 'none' : '1px solid var(--border)' } as React.CSSProperties),
  klbl:  { fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase' as const, letterSpacing:'0.04em', marginBottom:6 },
  kval:  { fontSize:18, fontWeight:700, color:'var(--t1)', fontVariantNumeric:'tabular-nums' as const },
  ksub:  { fontSize:11, color:'var(--t3)', marginTop:3 },
  th:    { padding:'7px 10px', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const, background:'var(--bg)', borderBottom:'1px solid var(--border)', textAlign:'left' as const, whiteSpace:'nowrap' as const },
  td:    { padding:'10px 10px', fontSize:12, color:'var(--t2)', borderBottom:'1px solid var(--border)' },
  inp:   { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, outline:'none', background:'var(--panel)', color:'var(--t1)' },
  row:   (cols: number) => ({ display:'grid', gridTemplateColumns:'repeat('+cols+',1fr)', gap:12 }),
  lbl:   { fontSize:11, fontWeight:600, color:'var(--t2)', marginBottom:4, display:'block' },
  btn:   (c: string) => ({ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:c, color:'#fff' }),
  prog:  { height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' as const, marginTop:6 },
}

export default function SALAttiviPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [salList, setSalList] = useState<SALAttivo[]>([])
  const [commessa, setCommessa] = useState<Partial<Commessa>>({})
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editSal, setEditSal] = useState<Partial<SALAttivo> | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: sal }, { data: comm }] = await Promise.all([
      supabase.from('sal_attivi').select('*').eq('commessa_id', id).order('numero'),
      supabase.from('commesse').select('id,nome,importo_contrattuale,ribasso_pct,oneri_sicurezza').eq('id', id).single()
    ])
    setSalList((sal as SALAttivo[]) || [])
    if (comm) setCommessa(comm)
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  // Ricalcola importi automaticamente
  const ricalcola = (sal: Partial<SALAttivo>) => {
    const lav = sal.importo_lavori || 0
    const sic = sal.importo_sicurezza || 0
    const tot = lav + sic
    const prec = sal.importo_precedenti || 0
    const netto = tot - prec
    const rit = parseFloat((netto * 0.05).toFixed(2))  // 5% ritenuta
    const cert = parseFloat((netto - rit - (sal.anticipazione_da_scompute || 0)).toFixed(2))
    return { ...sal, importo_totale: tot, importo_netto: netto, ritenuta_garanzia: rit, importo_certificato: cert }
  }

  const apriNuovo = () => {
    const numero = salList.length + 1
    const prec = salList.filter(s => s.stato !== 'annullato').reduce((sum, s) => sum + (s.importo_totale || 0), 0)
    setEditSal(ricalcola({
      numero, stato: 'bozza',
      importo_lavori: 0, importo_sicurezza: 0,
      importo_precedenti: prec, anticipazione_da_scompute: 0,
    }))
    setForm(true)
  }

  const salva = async () => {
    if (!editSal) return
    setSaving(true)
    try {
      const payload = {
        commessa_id: id,
        numero: editSal.numero || 1,
        codice: `SAL-A-${String(editSal.numero || 1).padStart(3,'0')}`,
        data_inizio: editSal.data_inizio || null,
        data_fine: editSal.data_fine || null,
        importo_lavori: editSal.importo_lavori || 0,
        importo_sicurezza: editSal.importo_sicurezza || 0,
        importo_totale: editSal.importo_totale || 0,
        importo_precedenti: editSal.importo_precedenti || 0,
        importo_netto: editSal.importo_netto || 0,
        ritenuta_garanzia: editSal.ritenuta_garanzia || 0,
        anticipazione_da_scompute: editSal.anticipazione_da_scompute || 0,
        importo_certificato: editSal.importo_certificato || 0,
        stato: editSal.stato || 'bozza',
        note: editSal.note || '',
      }
      if (editSal.id) {
        await supabase.from('sal_attivi').update(payload).eq('id', editSal.id)
        showToast('SAL aggiornato')
      } else {
        await supabase.from('sal_attivi').insert(payload)
        showToast(`SAL n.${payload.numero} creato`)
      }
      setForm(false); setEditSal(null); carica()
    } finally { setSaving(false) }
  }

  const cambiaStato = async (sal: SALAttivo, stato: string) => {
    await supabase.from('sal_attivi').update({ stato }).eq('id', sal.id)
    showToast(`SAL ${sal.codice} → ${stato}`); carica()
  }

  // KPI
  const contratto = commessa.importo_contrattuale || 0
  const certificato = salList.reduce((s, x) => s + (x.importo_totale || 0), 0)
  const nettoPagato = salList.filter(s => s.stato === 'pagato').reduce((s, x) => s + (x.importo_certificato || 0), 0)
  const avanzPct = contratto > 0 ? (certificato / contratto) * 100 : 0

  return (
    <div style={(styleObj as any).page as React.CSSProperties} className="fade-in">

      {/* KPI */}
      <div style={(styleObj as any).card as React.CSSProperties}>
        <div style={(styleObj as any).hdr as React.CSSProperties}>
          <span style={(styleObj as any).hl as React.CSSProperties}>Quadro SAL — Attivi verso committente</span>
          <button className="btn-primary" style={{ fontSize:12, padding:'8px 14px' }} onClick={apriNuovo}>+ Nuovo SAL</button>
        </div>
        <div style={(styleObj as any).kgrid as React.CSSProperties}>
          <div style={(styleObj as any).kcell(false)}>
            <p style={(styleObj as any).klbl as React.CSSProperties}>Importo contratto</p>
            <p style={(styleObj as any).kval as React.CSSProperties}>€ {fi(contratto)}</p>
            <div style={(styleObj as any).prog as React.CSSProperties}><div style={{ height:'100%', background:'var(--accent)', width:'100%', borderRadius:3 }} /></div>
          </div>
          <div style={(styleObj as any).kcell(false)}>
            <p style={(styleObj as any).klbl as React.CSSProperties}>Certificato cumulato</p>
            <p style={{ ...(styleObj as any).kval, color:'var(--accent)' }}>€ {fi(certificato)}</p>
            <div style={(styleObj as any).prog as React.CSSProperties}><div style={{ height:'100%', background:'var(--accent)', width:`${Math.min(avanzPct,100)}%`, borderRadius:3 }} /></div>
            <p style={(styleObj as any).ksub as React.CSSProperties}>{avanzPct.toFixed(1)}% del contratto</p>
          </div>
          <div style={(styleObj as any).kcell(false)}>
            <p style={(styleObj as any).klbl as React.CSSProperties}>Netto liquidato</p>
            <p style={{ ...(styleObj as any).kval, color:'var(--success)' }}>€ {fi(nettoPagato)}</p>
            <p style={(styleObj as any).ksub as React.CSSProperties}>SAL in stato "pagato"</p>
          </div>
          <div style={(styleObj as any).kcell(true)}>
            <p style={(styleObj as any).klbl as React.CSSProperties}>Residuo contratto</p>
            <p style={{ ...(styleObj as any).kval, color:'var(--warning)' }}>€ {fi(contratto - certificato)}</p>
            <p style={(styleObj as any).ksub as React.CSSProperties}>{(100 - avanzPct).toFixed(1)}% da certificare</p>
          </div>
        </div>
      </div>

      {/* Lista SAL */}
      <div style={(styleObj as any).card as React.CSSProperties}>
        <div style={(styleObj as any).hdr as React.CSSProperties}>
          <span style={(styleObj as any).hl as React.CSSProperties}>{salList.length} SAL emessi</span>
        </div>
        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
        ) : salList.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--t3)' }}>
            <p style={{ fontSize:14, fontWeight:600 }}>Nessun SAL emesso</p>
            <p style={{ fontSize:12, marginTop:8 }}>Crea il primo SAL con il pulsante in alto</p>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['N°','Codice','Periodo','Importo lavori','Importo sicurezza','Importo totale','Precedenti','Netto','Ritenuta','Certificato','Stato',''].map(h => (
                  <th key={h} style={(styleObj as any).th as React.CSSProperties}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salList.map(sal => (
                <tr key={sal.id}
                  onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <td style={{ ...(styleObj as any).td, fontWeight:700, textAlign:'center' as const }}>{sal.numero}</td>
                  <td style={{ ...(styleObj as any).td, fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>{sal.codice}</td>
                  <td style={{ ...(styleObj as any).td, fontSize:11 }}>{sal.data_inizio && sal.data_fine ? `${sal.data_inizio} → ${sal.data_fine}` : '—'}</td>
                  <td style={{ ...(styleObj as any).td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const }}>{fi(sal.importo_lavori)}</td>
                  <td style={{ ...(styleObj as any).td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const }}>{fi(sal.importo_sicurezza)}</td>
                  <td style={{ ...(styleObj as any).td, textAlign:'right' as const, fontWeight:700, fontVariantNumeric:'tabular-nums' as const }}>{fi(sal.importo_totale)}</td>
                  <td style={{ ...(styleObj as any).td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const, color:'var(--t3)' }}>{fi(sal.importo_precedenti)}</td>
                  <td style={{ ...(styleObj as any).td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const }}>{fi(sal.importo_netto)}</td>
                  <td style={{ ...(styleObj as any).td, textAlign:'right' as const, color:'var(--danger)', fontVariantNumeric:'tabular-nums' as const }}>({fi(sal.ritenuta_garanzia)})</td>
                  <td style={{ ...(styleObj as any).td, textAlign:'right' as const, fontWeight:700, color:'var(--success)', fontVariantNumeric:'tabular-nums' as const }}>{fi(sal.importo_certificato)}</td>
                  <td style={(styleObj as any).td as React.CSSProperties}>
                    <select value={sal.stato} onChange={e=>cambiaStato(sal, e.target.value)}
                      style={{ padding:'3px 6px', borderRadius:6, border:`1px solid ${STATO_COLOR[sal.stato]||'#ccc'}44`, background:(STATO_COLOR[sal.stato]||'#ccc')+'22', color:STATO_COLOR[sal.stato]||'#666', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                      {STATI_SAL.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={(styleObj as any).td as React.CSSProperties}>
                    <button style={{ ...(styleObj as any).btn('#3b82f6'), padding:'4px 10px', fontSize:11 }}
                      onClick={() => { setEditSal(sal); setForm(true) }}>✎</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal form SAL */}
      {form && editSal && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget){setForm(false);setEditSal(null)} }}>
          <div className="modal-box" style={{ maxWidth:640, width:'92%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>SAL n.{editSal.numero} — {editSal.id ? 'Modifica' : 'Nuovo'}</h3>
              <button onClick={()=>{setForm(false);setEditSal(null)}} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={(styleObj as any).row(2)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Data inizio periodo</label>
                  <input type="date" style={(styleObj as any).inp as React.CSSProperties} value={editSal.data_inizio||''} onChange={e=>setEditSal({...editSal, data_inizio:e.target.value})} />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Data fine periodo</label>
                  <input type="date" style={(styleObj as any).inp as React.CSSProperties} value={editSal.data_fine||''} onChange={e=>setEditSal({...editSal, data_fine:e.target.value})} />
                </div>
              </div>
              <div style={(styleObj as any).row(2)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Importo lavori (€)</label>
                  <input type="number" step="0.01" style={(styleObj as any).inp as React.CSSProperties} value={editSal.importo_lavori||0}
                    onChange={e=>setEditSal(ricalcola({...editSal, importo_lavori:parseFloat(e.target.value)||0}))} />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Importo sicurezza (€)</label>
                  <input type="number" step="0.01" style={(styleObj as any).inp as React.CSSProperties} value={editSal.importo_sicurezza||0}
                    onChange={e=>setEditSal(ricalcola({...editSal, importo_sicurezza:parseFloat(e.target.value)||0}))} />
                </div>
              </div>
              <div style={(styleObj as any).row(2)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Importi precedenti SAL (€)</label>
                  <input type="number" step="0.01" style={(styleObj as any).inp as React.CSSProperties} value={editSal.importo_precedenti||0}
                    onChange={e=>setEditSal(ricalcola({...editSal, importo_precedenti:parseFloat(e.target.value)||0}))} />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Anticipazione da scomputare (€)</label>
                  <input type="number" step="0.01" style={(styleObj as any).inp as React.CSSProperties} value={editSal.anticipazione_da_scompute||0}
                    onChange={e=>setEditSal(ricalcola({...editSal, anticipazione_da_scompute:parseFloat(e.target.value)||0}))} />
                </div>
              </div>

              {/* Quadro riepilogativo auto-calcolato */}
              <div style={{ background:'var(--bg)', borderRadius:8, padding:12, border:'1px solid var(--border)' }}>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--t3)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.04em' }}>Riepilogo automatico</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:12 }}>
                  {[
                    ['Importo totale SAL', editSal.importo_totale||0, 'var(--t1)'],
                    ['Importi precedenti', -(editSal.importo_precedenti||0), 'var(--t3)'],
                    ['Importo netto', editSal.importo_netto||0, 'var(--accent)'],
                    ['Ritenuta garanzia (5%)', -(editSal.ritenuta_garanzia||0), 'var(--danger)'],
                    ['Anticipazione', -(editSal.anticipazione_da_scompute||0), 'var(--t3)'],
                    ['Importo certificato', editSal.importo_certificato||0, 'var(--success)'],
                  ].map(([lb, val, col]) => (
                    <><span style={{ color:'var(--t3)' }}>{lb as string}:</span><span style={{ textAlign:'right', fontWeight:700, color:col as string, fontVariantNumeric:'tabular-nums' }}>€ {fi(val as number)}</span></>
                  ))}
                </div>
              </div>

              <div style={(styleObj as any).row(2)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Stato</label>
                  <select style={(styleObj as any).inp as React.CSSProperties} value={editSal.stato||'bozza'} onChange={e=>setEditSal({...editSal, stato:e.target.value})}>
                    {STATI_SAL.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Note</label>
                  <input style={(styleObj as any).inp as React.CSSProperties} value={editSal.note||''} onChange={e=>setEditSal({...editSal, note:e.target.value})} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button style={(styleObj as any).btn('#6b7280')} onClick={()=>{setForm(false);setEditSal(null)}}>Annulla</button>
                <button style={(styleObj as any).btn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : 'Salva SAL'}</button>
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
