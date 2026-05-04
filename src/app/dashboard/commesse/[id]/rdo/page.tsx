'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

const STATI_RDO = ['bozza','inviata','risposta_ricevuta','comparativa','aggiudicata','annullata']
const STATO_COLOR: Record<string,string> = {
  bozza:'#f59e0b', inviata:'#3b82f6', risposta_ricevuta:'#8b5cf6', comparativa:'#f97316', aggiudicata:'#10b981', annullata:'#6b7280'
}

interface RDO {
  id: string; rda_id?: string; commessa_id: string; codice: string
  fornitore: string; email_fornitore: string
  data_invio: string; data_scadenza: string
  importo_offerta: number; stato: string; note: string
  pdf_url?: string
}

interface RDA {
  id: string; codice: string; oggetto: string; tipo: string; stato: string
}

interface Fornitore {
  id: string; ragione_sociale?: string; nome?: string; cognome?: string
  email?: string; pec?: string; categoria_soa?: string
}

const S = {
  page:  { minHeight:'100%', background:'var(--bg)', padding:16, display:'flex', flexDirection:'column' as const, gap:12 },
  card:  { background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' } as React.CSSProperties,
  hdr:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg)' },
  hl:    { fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase' as const, letterSpacing:'0.04em' },
  th:    { padding:'7px 10px', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const, background:'var(--bg)', borderBottom:'1px solid var(--border)', textAlign:'left' as const, whiteSpace:'nowrap' as const },
  td:    { padding:'10px 10px', fontSize:12, color:'var(--t2)', borderBottom:'1px solid var(--border)' },
  inp:   { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, outline:'none', background:'var(--panel)', color:'var(--t1)' },
  row:   (cols: number) => ({ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:12 }),
  lbl:   { fontSize:11, fontWeight:600, color:'var(--t2)', marginBottom:4, display:'block' },
  btn:   (c: string) => ({ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:c, color:'#fff' }),
}

export default function RDOPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [rdoList, setRdoList] = useState<RDO[]>([])
  const [rdaList, setRdaList] = useState<RDA[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editRdo, setEditRdo] = useState<Partial<RDO> | null>(null)
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [fSearch, setFSearch] = useState('')
  const [fResults, setFResults] = useState<Fornitore[]>([])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: rdo }, { data: rda }] = await Promise.all([
      supabase.from('rdo').select('*').eq('commessa_id', id).order('created_at', { ascending: false }),
      supabase.from('rda').select('id,codice,oggetto,tipo,stato').eq('commessa_id', id).in('stato', ['approvata','inviata'])
    ])
    setRdoList((rdo as RDO[]) || [])
    setRdaList((rda as RDA[]) || [])
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  useEffect(() => {
    if (!fSearch || fSearch.length < 2) { setFResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('professionisti_fornitori')
        .select('id,ragione_sociale,nome,cognome,email,pec,categoria_soa')
        .or(`ragione_sociale.ilike.%${fSearch}%,nome.ilike.%${fSearch}%,cognome.ilike.%${fSearch}%`)
        .limit(8)
      setFResults((data as Fornitore[]) || [])
    }, 300)
    return () => clearTimeout(t)
  }, [fSearch])

  const fLabel = (f: Fornitore) => f.ragione_sociale || `${f.nome||''} ${f.cognome||''}`.trim()

  const salva = async () => {
    if (!editRdo?.fornitore) { showToast('Inserisci almeno un fornitore'); return }
    setSaving(true)
    try {
      const codice = 'RDO-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*1000).toString().padStart(3,'0')
      const payload = {
        commessa_id: id,
        rda_id: editRdo.rda_id || null,
        codice: editRdo.id ? (editRdo.codice||codice) : codice,
        fornitore: editRdo.fornitore || '',
        email_fornitore: editRdo.email_fornitore || '',
        data_invio: editRdo.data_invio || null,
        data_scadenza: editRdo.data_scadenza || null,
        importo_offerta: editRdo.importo_offerta || 0,
        stato: editRdo.stato || 'bozza',
        note: editRdo.note || '',
      }
      if (editRdo.id) {
        await supabase.from('rdo').update(payload).eq('id', editRdo.id)
        showToast('RDO aggiornata')
      } else {
        await supabase.from('rdo').insert(payload)
        showToast('RDO creata')
      }
      setForm(false); setEditRdo(null); carica()
    } finally { setSaving(false) }
  }

  const cambiaStato = async (rdo: RDO, stato: string) => {
    await supabase.from('rdo').update({ stato }).eq('id', rdo.id)
    showToast(`RDO → ${stato}`); carica()
  }

  const rdoFiltrate = rdoList.filter(r => filtroStato === 'tutti' || r.stato === filtroStato)

  // Quadro comparativo: raggruppa RDO per rda_id
  const compareGroups = rdoList.reduce((acc, r) => {
    const key = r.rda_id || 'standalone'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {} as Record<string, RDO[]>)

  const bestOffer = (group: RDO[]) => {
    const withOffer = group.filter(r => r.importo_offerta > 0)
    if (!withOffer.length) return null
    return withOffer.reduce((min, r) => r.importo_offerta < min.importo_offerta ? r : min)
  }

  return (
    <div style={S.page} className="fade-in">

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
        {STATI_RDO.map(s => (
          <div key={s} style={{ ...S.card, padding:'10px 14px', cursor:'pointer', outline: filtroStato===s ? '2px solid var(--accent)' : 'none' }}
            onClick={() => setFiltroStato(filtroStato===s ? 'tutti' : s)}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:STATO_COLOR[s], marginBottom:6 }} />
            <p style={{ fontSize:17, fontWeight:800, color:'var(--t1)' }}>{rdoList.filter(r=>r.stato===s).length}</p>
            <p style={{ fontSize:9, color:'var(--t3)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.03em' }}>{s}</p>
          </div>
        ))}
      </div>

      {/* Quadro comparativo offerte */}
      {Object.keys(compareGroups).length > 0 && (
        <div style={S.card}>
          <div style={S.hdr}>
            <span style={S.hl}>Quadro comparativo offerte</span>
          </div>
          <div style={{ padding:12 }}>
            {Object.entries(compareGroups).map(([rdaId, group]) => {
              const rda = rdaList.find(r => r.id === rdaId)
              const best = bestOffer(group)
              return (
                <div key={rdaId} style={{ marginBottom:16 }}>
                  <p style={{ fontSize:12, fontWeight:700, color:'var(--t1)', marginBottom:8, padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                    {rda ? `${rda.codice} — ${rda.oggetto}` : 'Richiesta standalone'}
                  </p>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
                    {group.map(r => (
                      <div key={r.id} style={{
                        padding:'10px 14px', borderRadius:8, border:`2px solid ${r.id===best?.id ? 'var(--success)' : 'var(--border)'}`,
                        background: r.id===best?.id ? 'rgba(16,185,129,0.06)' : 'var(--bg)',
                        minWidth:180, position:'relative' as const
                      }}>
                        {r.id===best?.id && <span style={{ position:'absolute', top:6, right:6, fontSize:9, fontWeight:700, color:'var(--success)' }}>✓ BEST</span>}
                        <p style={{ fontWeight:700, fontSize:12 }}>{r.fornitore}</p>
                        <p style={{ fontSize:16, fontWeight:800, color:'var(--t1)', margin:'4px 0', fontVariantNumeric:'tabular-nums' }}>
                          {r.importo_offerta ? `€ ${fi(r.importo_offerta)}` : '—'}
                        </p>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:STATO_COLOR[r.stato]||'#ccc', display:'inline-block', marginRight:4 }} />
                        <span style={{ fontSize:10, color:'var(--t3)' }}>{r.stato}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista RDO */}
      <div style={S.card}>
        <div style={S.hdr}>
          <span style={S.hl}>Richieste d'Offerta</span>
          <button className="btn-primary" style={{ fontSize:12, padding:'8px 14px' }}
            onClick={() => { setEditRdo({ stato:'bozza', importo_offerta:0 }); setFSearch(''); setForm(true) }}>
            + Nuova RDO
          </button>
        </div>

        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
        ) : rdoFiltrate.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--t3)', fontSize:13 }}>Nessuna RDO trovata</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Codice','Fornitore','Email','RDA collegata','Scadenza','Offerta (€)','Stato',''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rdoFiltrate.map(r => {
                const rda = rdaList.find(x => x.id === r.rda_id)
                return (
                  <tr key={r.id}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>{r.codice}</td>
                    <td style={{ ...S.td, fontWeight:600 }}>{r.fornitore}</td>
                    <td style={{ ...S.td, fontSize:11 }}>{r.email_fornitore || '—'}</td>
                    <td style={{ ...S.td, fontSize:11 }}>{rda ? `${rda.codice}` : '—'}</td>
                    <td style={{ ...S.td, fontSize:11 }}>{r.data_scadenza || '—'}</td>
                    <td style={{ ...S.td, textAlign:'right' as const, fontWeight:700, fontVariantNumeric:'tabular-nums' as const }}>
                      {r.importo_offerta ? fi(r.importo_offerta) : '—'}
                    </td>
                    <td style={S.td}>
                      <select value={r.stato} onChange={e=>cambiaStato(r, e.target.value)}
                        style={{ padding:'3px 6px', borderRadius:6, border:`1px solid ${STATO_COLOR[r.stato]||'#ccc'}44`, background:(STATO_COLOR[r.stato]||'#ccc')+'22', color:STATO_COLOR[r.stato]||'#666', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        {STATI_RDO.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={S.td}>
                      <button style={{ ...S.btn('#3b82f6'), padding:'4px 10px', fontSize:11 }}
                        onClick={() => { setEditRdo(r); setFSearch(r.fornitore||''); setForm(true) }}>✎</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {form && editRdo && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget){setForm(false);setEditRdo(null)} }}>
          <div className="modal-box" style={{ maxWidth:560, width:'92%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>{editRdo.id ? 'Modifica RDO' : 'Nuova Richiesta d'Offerta'}</h3>
              <button onClick={()=>{setForm(false);setEditRdo(null)}} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {rdaList.length > 0 && (
                <div>
                  <label style={S.lbl}>Collega a RDA</label>
                  <select style={S.inp} value={editRdo.rda_id||''} onChange={e=>setEditRdo({...editRdo, rda_id:e.target.value||undefined})}>
                    <option value="">— Nessuna RDA collegata —</option>
                    {rdaList.map(r => <option key={r.id} value={r.id}>{r.codice} — {r.oggetto}</option>)}
                  </select>
                </div>
              )}
              {/* Fornitore con ricerca live */}
              <div style={{ position:'relative' }}>
                <label style={S.lbl}>Fornitore *</label>
                <input style={S.inp} value={fSearch} onChange={e=>{setFSearch(e.target.value); setEditRdo({...editRdo, fornitore:e.target.value})}} placeholder="Cerca fornitore nel DB..." />
                {fResults.length > 0 && (
                  <div style={{ position:'absolute', zIndex:100, width:'100%', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'var(--shadow-md)', maxHeight:200, overflowY:'auto' as const }}>
                    {fResults.map(f => (
                      <div key={f.id} style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, borderBottom:'1px solid var(--border)' }}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='')}
                        onClick={() => {
                          const email = f.pec || f.email || ''
                          setEditRdo({...editRdo, fornitore:fLabel(f), email_fornitore:email})
                          setFSearch(fLabel(f)); setFResults([])
                        }}>
                        <span style={{ fontWeight:600 }}>{fLabel(f)}</span>
                        {(f.pec||f.email) && <span style={{ fontSize:10, color:'var(--t3)', marginLeft:8 }}>{f.pec||f.email}</span>}
                        {f.categoria_soa && <span style={{ fontSize:10, color:'var(--accent)', marginLeft:8 }}>SOA: {f.categoria_soa}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={S.lbl}>Email fornitore</label>
                <input type="email" style={S.inp} value={editRdo.email_fornitore||''} onChange={e=>setEditRdo({...editRdo, email_fornitore:e.target.value})} />
              </div>
              <div style={S.row(2)}>
                <div>
                  <label style={S.lbl}>Data invio</label>
                  <input type="date" style={S.inp} value={editRdo.data_invio||''} onChange={e=>setEditRdo({...editRdo, data_invio:e.target.value})} />
                </div>
                <div>
                  <label style={S.lbl}>Data scadenza offerta</label>
                  <input type="date" style={S.inp} value={editRdo.data_scadenza||''} onChange={e=>setEditRdo({...editRdo, data_scadenza:e.target.value})} />
                </div>
              </div>
              <div>
                <label style={S.lbl}>Importo offerta ricevuta (€)</label>
                <input type="number" step="0.01" style={S.inp} value={editRdo.importo_offerta||''} onChange={e=>setEditRdo({...editRdo, importo_offerta:parseFloat(e.target.value)||0})} placeholder="0,00" />
              </div>
              <div>
                <label style={S.lbl}>Stato</label>
                <select style={S.inp} value={editRdo.stato||'bozza'} onChange={e=>setEditRdo({...editRdo, stato:e.target.value})}>
                  {STATI_RDO.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Note</label>
                <textarea style={{ ...S.inp, resize:'vertical' as const, minHeight:60 }} value={editRdo.note||''} onChange={e=>setEditRdo({...editRdo, note:e.target.value})} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button style={S.btn('#6b7280')} onClick={()=>{setForm(false);setEditRdo(null)}}>Annulla</button>
                <button style={S.btn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : 'Salva RDO'}</button>
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
