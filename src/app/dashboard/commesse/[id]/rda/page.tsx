'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

const STATI = ['bozza','approvata','inviata','chiusa','annullata']
const TIPI  = ['MAT','MAN','NOL','SUB','MIX']

const STATO_COLOR: Record<string,string> = {
  bozza:'#f59e0b', approvata:'#3b82f6', inviata:'#8b5cf6', chiusa:'#10b981', annullata:'#ef4444'
}

interface RDA {
  id: string; codice: string; commessa_id: string
  tipo: string; oggetto: string; qta_stimata: number; um: string
  data_necessita: string; stato: string; fornitore_sugg: string
  note: string; created_at: string; wbs_id?: string
}

interface Fornitore {
  id: string; ragione_sociale?: string; nome?: string; cognome?: string
  categoria_soa?: string; specializzazione?: string
}

export default function RDAPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [rdaList, setRdaList] = useState<RDA[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editRda, setEditRda] = useState<Partial<RDA> | null>(null)
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [filtroTipo, setFiltroTipo] = useState('tutti')
  const [search, setSearch] = useState('')
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [fSearch, setFSearch] = useState('')
  const [fResults, setFResults] = useState<Fornitore[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('rda').select('*').eq('commessa_id', id).order('created_at', { ascending: false })
    setRdaList((data as RDA[]) || [])
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  // Ricerca fornitori live
  useEffect(() => {
    if (!fSearch || fSearch.length < 2) { setFResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('professionisti_fornitori')
        .select('id,ragione_sociale,nome,cognome,categoria_soa,specializzazione')
        .or(`ragione_sociale.ilike.%${fSearch}%,nome.ilike.%${fSearch}%,cognome.ilike.%${fSearch}%`)
        .limit(8)
      setFResults((data as Fornitore[]) || [])
    }, 300)
    return () => clearTimeout(t)
  }, [fSearch])

  const salva = async () => {
    if (!editRda?.oggetto || !editRda?.tipo) { showToast('Compila oggetto e tipo'); return }
    setSaving(true)
    try {
      const payload = {
        commessa_id: id,
        tipo: editRda.tipo || 'MAT',
        oggetto: editRda.oggetto || '',
        qta_stimata: editRda.qta_stimata || 1,
        um: editRda.um || 'nr',
        data_necessita: editRda.data_necessita || null,
        stato: editRda.stato || 'bozza',
        fornitore_sugg: editRda.fornitore_sugg || '',
        note: editRda.note || '',
        wbs_id: editRda.wbs_id || null,
      }
      if (editRda.id) {
        await supabase.from('rda').update(payload).eq('id', editRda.id)
        showToast('RDA aggiornata')
      } else {
        const codice = 'RDA-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*1000).toString().padStart(3,'0')
        await supabase.from('rda').insert({ ...payload, codice })
        showToast('RDA creata')
      }
      setForm(false); setEditRda(null); carica()
    } finally { setSaving(false) }
  }

  const cambiaStato = async (rda: RDA, nuovoStato: string) => {
    await supabase.from('rda').update({ stato: nuovoStato }).eq('id', rda.id)
    showToast(`Stato → ${nuovoStato}`)
    carica()
  }

  const elimina = async (rda: RDA) => {
    if (!confirm(`Eliminare RDA ${rda.codice}?`)) return
    await supabase.from('rda').delete().eq('id', rda.id)
    showToast('RDA eliminata'); carica()
  }

  const rdaFiltrate = rdaList.filter(r => {
    if (filtroStato !== 'tutti' && r.stato !== filtroStato) return false
    if (filtroTipo  !== 'tutti' && r.tipo  !== filtroTipo)  return false
    if (search && !r.oggetto?.toLowerCase().includes(search.toLowerCase()) &&
        !r.codice?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const kpi = TIPI.map(t => ({
    tipo: t,
    n: rdaList.filter(r => r.tipo === t).length,
    tot: 0
  }))

  const fLabel = (f: Fornitore) => f.ragione_sociale || `${f.nome || ''} ${f.cognome || ''}`.trim() || '—'

  const styleObj = {
    page: { minHeight:'100%', background:'var(--bg)', padding:16, display:'flex', flexDirection:'column' as const, gap:12 },
    card: { background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' } as React.CSSProperties,
    hdr:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg)' },
    hl:   { fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase' as const, letterSpacing:'0.04em' },
    th:   { padding:'7px 10px', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const, background:'var(--bg)', borderBottom:'1px solid var(--border)', textAlign:'left' as const, whiteSpace:'nowrap' as const },
    td:   { padding:'10px 10px', fontSize:12, color:'var(--t2)', borderBottom:'1px solid var(--border)' },
    badge:(c:string) => ({ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:700, background:c+'22', color:c, border:`1px solid ${c}44` }),
    inp:  { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, outline:'none', background:'var(--panel)', color:'var(--t1)' },
    row:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
    lbl:  { fontSize:11, fontWeight:600, color:'var(--t2)', marginBottom:4, display:'block' },
    btn:  (c:string) => ({ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:c, color:'#fff' }),
  }

  return (
    <div style={(styleObj as any).page as React.CSSProperties} className="fade-in">

      {/* KPI bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
        {kpi.map(k => (
          <div key={k.tipo} style={{ ...(styleObj as any).card, padding:'12px 16px', cursor:'pointer', outline: filtroTipo===k.tipo ? '2px solid var(--accent)' : 'none' }}
            onClick={() => setFiltroTipo(filtroTipo===k.tipo ? 'tutti' : k.tipo)}>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const }}>{k.tipo}</p>
            <p style={{ fontSize:20, fontWeight:800, color:'var(--t1)', marginTop:4 }}>{k.n}</p>
            <p style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>richieste</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={(styleObj as any).card as React.CSSProperties}>
        <div style={(styleObj as any).hdr as React.CSSProperties}>
          <span style={(styleObj as any).hl as React.CSSProperties}>Richieste di Acquisto</span>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca..." style={{ ...(styleObj as any).inp, width:180 }} />
            <select value={filtroStato} onChange={e=>setFiltroStato(e.target.value)} style={{ ...(styleObj as any).inp, width:120 }}>
              <option value="tutti">Tutti gli stati</option>
              {STATI.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn-primary" style={{ fontSize:12, padding:'8px 14px', whiteSpace:'nowrap' as const }}
              onClick={() => { setEditRda({ tipo:'MAT', stato:'bozza', qta_stimata:1, um:'nr' }); setForm(true) }}>
              + Nuova RDA
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
        ) : rdaFiltrate.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--t3)', fontSize:13 }}>Nessuna RDA trovata</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Codice','Tipo','Oggetto','Data necessità','Fornitore sugg.','Stato','Azioni'].map(h => (
                    <th key={h} style={(styleObj as any).th as React.CSSProperties}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rdaFiltrate.map(r => (
                  <tr key={r.id} style={{ transition:'background .1s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{ ...(styleObj as any).td, fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>{r.codice}</td>
                    <td style={(styleObj as any).td as React.CSSProperties}><span style={(styleObj as any).badge('#3b82f6')}>{r.tipo}</span></td>
                    <td style={{ ...(styleObj as any).td, maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{r.oggetto}</td>
                    <td style={{ ...(styleObj as any).td, fontSize:11 }}>{r.data_necessita || '—'}</td>
                    <td style={{ ...(styleObj as any).td, fontSize:11 }}>{r.fornitore_sugg || '—'}</td>
                    <td style={(styleObj as any).td as React.CSSProperties}>
                      <select value={r.stato}
                        onChange={e => cambiaStato(r, e.target.value)}
                        style={{ padding:'3px 6px', borderRadius:6, border:`1px solid ${STATO_COLOR[r.stato] || '#ccc'}44`, background:(STATO_COLOR[r.stato]||'#ccc')+'22', color:STATO_COLOR[r.stato]||'#666', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        {STATI.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={(styleObj as any).td as React.CSSProperties}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button style={{ ...(styleObj as any).btn('#3b82f6'), padding:'4px 10px', fontSize:11 }}
                          onClick={() => { setEditRda(r); setFSearch(r.fornitore_sugg||''); setForm(true) }}>✎</button>
                        {r.stato === 'bozza' && (
                          <button style={{ ...(styleObj as any).btn('#ef4444'), padding:'4px 10px', fontSize:11 }}
                            onClick={() => elimina(r)}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal form */}
      {form && editRda && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget){setForm(false);setEditRda(null)} }}>
          <div className="modal-box" style={{ maxWidth:560, width:'90%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{editRda.id ? 'Modifica RDA' : 'Nuova Richiesta di Acquisto'}</h3>
              <button onClick={() => { setForm(false); setEditRda(null) }} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={(styleObj as any).lbl as React.CSSProperties}>Oggetto *</label>
                <input style={(styleObj as any).inp as React.CSSProperties} value={editRda.oggetto||''} onChange={e=>setEditRda({...editRda, oggetto:e.target.value})} placeholder="Descrivi la richiesta..." />
              </div>
              <div style={(styleObj as any).row as React.CSSProperties}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Tipo *</label>
                  <select style={(styleObj as any).inp as React.CSSProperties} value={editRda.tipo||'MAT'} onChange={e=>setEditRda({...editRda, tipo:e.target.value})}>
                    {TIPI.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Stato</label>
                  <select style={(styleObj as any).inp as React.CSSProperties} value={editRda.stato||'bozza'} onChange={e=>setEditRda({...editRda, stato:e.target.value})}>
                    {STATI.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={(styleObj as any).row as React.CSSProperties}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Quantità stimata</label>
                  <input type="number" style={(styleObj as any).inp as React.CSSProperties} value={editRda.qta_stimata||1} onChange={e=>setEditRda({...editRda, qta_stimata:parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>UM</label>
                  <input style={(styleObj as any).inp as React.CSSProperties} value={editRda.um||'nr'} onChange={e=>setEditRda({...editRda, um:e.target.value})} placeholder="nr, kg, mc..." />
                </div>
              </div>
              <div>
                <label style={(styleObj as any).lbl as React.CSSProperties}>Data necessità</label>
                <input type="date" style={(styleObj as any).inp as React.CSSProperties} value={editRda.data_necessita||''} onChange={e=>setEditRda({...editRda, data_necessita:e.target.value})} />
              </div>
              <div style={{ position:'relative' }}>
                <label style={(styleObj as any).lbl as React.CSSProperties}>Fornitore suggerito</label>
                <input style={(styleObj as any).inp as React.CSSProperties} value={fSearch} onChange={e=>{setFSearch(e.target.value); setEditRda({...editRda, fornitore_sugg:e.target.value})}} placeholder="Cerca per nome o ragione sociale..." />
                {fResults.length > 0 && (
                  <div style={{ position:'absolute', zIndex:100, width:'100%', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'var(--shadow-md)', maxHeight:200, overflowY:'auto' as const }}>
                    {fResults.map(f => (
                      <div key={f.id} style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, borderBottom:'1px solid var(--border)' }}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='')}
                        onClick={() => { setEditRda({...editRda, fornitore_sugg:fLabel(f)}); setFSearch(fLabel(f)); setFResults([]) }}>
                        <span style={{ fontWeight:600 }}>{fLabel(f)}</span>
                        {f.categoria_soa && <span style={{ fontSize:10, color:'var(--t3)', marginLeft:8 }}>SOA: {f.categoria_soa}</span>}
                        {f.specializzazione && <span style={{ fontSize:10, color:'var(--t3)', marginLeft:8 }}>{f.specializzazione}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={(styleObj as any).lbl as React.CSSProperties}>Note</label>
                <textarea style={{ ...(styleObj as any).inp, resize:'vertical' as const, minHeight:60 }} value={editRda.note||''} onChange={e=>setEditRda({...editRda, note:e.target.value})} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button style={(styleObj as any).btn('#6b7280')} onClick={() => { setForm(false); setEditRda(null) }}>Annulla</button>
                <button style={(styleObj as any).btn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : 'Salva'}</button>
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
