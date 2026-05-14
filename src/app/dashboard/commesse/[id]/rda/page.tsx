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
  voci_ids?: string[]
}
interface VoceComputo { id: string; descrizione: string; um?: string; quantita?: number }

interface Fornitore {
  id: string; ragione_sociale?: string; nome?: string; cognome?: string
  categoria_soa?: string; specializzazione?: string
  pec?: string; email?: string; telefono?: string
  ordine_professionale?: string; numero_iscrizione?: string
}

function FornitoreCard({ nome }: { nome: string }) {
  const [data, setData] = React.useState<Fornitore | null>(null)
  React.useEffect(() => {
    supabase.from('professionisti_fornitori')
      .select('*').or('ragione_sociale.eq.' + nome + ',nome.eq.' + nome)
      .limit(1).single()
      .then(({ data: d }) => { if (d) setData(d) })
  }, [nome])
  if (!data) return <p style={{ color:'var(--t3)', fontSize:13 }}>Caricamento...</p>
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13 }}>
      <p style={{ fontSize:16, fontWeight:700 }}>{data.ragione_sociale || (data.nome + ' ' + (data.cognome || ''))}</p>
      {data.specializzazione && <p style={{ color:'var(--t3)' }}>{data.specializzazione}</p>}
      {data.pec && <p>PEC: <a href={'mailto:'+data.pec} style={{ color:'var(--accent)' }}>{data.pec}</a></p>}
      {data.email && <p>Email: <a href={'mailto:'+data.email} style={{ color:'var(--accent)' }}>{data.email}</a></p>}
      {data.telefono && <p>Tel: {data.telefono}</p>}
      {data.categoria_soa && <p>SOA: {data.categoria_soa}</p>}
      {data.ordine_professionale && <p>Ordine: {data.ordine_professionale} n. {data.numero_iscrizione}</p>}
    </div>
  )
}


// ─── FlowThread Inline ─────────────────────────────────────────────────────
function FlowThreadInline({ rdaId, supabase, commessaId }: { rdaId: string; supabase: any; commessaId: string }) {
  const [rdos, setRdos] = React.useState<{id:string;codice:string;stato:string}[]>([])
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    supabase.from('rdo').select('id,codice,stato').eq('rda_id', rdaId).then(({ data }: any) => {
      setRdos(data || [])
      setLoaded(true)
    })
  }, [rdaId])

  if (!loaded || rdos.length === 0) return null

  const COLORI: Record<string,string> = {
    bozza:'#f59e0b', inviata:'#8b5cf6', risposta_ricevuta:'#6366f1',
    comparativa:'#f97316', aggiudicata:'#10b981', annullata:'#ef4444'
  }

  return (
    <div style={{ margin:'8px 16px', padding:'10px 12px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:6 }}>
        Flusso documentale
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' as const }}>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--accent)', padding:'2px 8px', background:'var(--accent-light)', borderRadius:4 }}>
          📋 Questa RDA
        </span>
        {rdos.map((rdo, i) => (
          <React.Fragment key={rdo.id}>
            <span style={{ color:'var(--t4)', fontSize:12 }}>→</span>
            <span style={{
              fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:4,
              background: (COLORI[rdo.stato] || '#6b7280') + '20',
              color: COLORI[rdo.stato] || '#6b7280',
              border: '1px solid ' + (COLORI[rdo.stato] || '#6b7280') + '44'
            }}>
              📤 {rdo.codice?.slice(0,14)} · {rdo.stato}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
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
  const [modRapida, setModRapida] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wizardRdo, setWizardRdo] = useState<RDA | null>(null)
  const [wizardTipo, setWizardTipo] = useState('MAT')
  const [wizardNote, setWizardNote] = useState('')
  const [toast, setToast] = useState('')
  const [viewFornitore, setViewFornitore] = useState<string | null>(null)
  const [detailRda, setDetailRda] = useState<RDA | null>(null)
  const [vociRda, setVociRda] = useState<VoceComputo[]>([])
  const [loadingVoci, setLoadingVoci] = useState(false)
  const [generandoRdo, setGenerandoRdo] = useState(false)

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

  const caricaVoci = async (r: RDA) => {
    setDetailRda(r); setVociRda([])
    if (!r.voci_ids?.length) return
    setLoadingVoci(true)
    const { data } = await supabase.from('voci_computo')
      .select('id,descrizione,um,quantita').in('id', r.voci_ids)
    setVociRda((data as VoceComputo[]) || [])
    setLoadingVoci(false)
  }
  const generaRDO = (r: RDA) => { setWizardRdo(r); setWizardTipo(r.tipo||'MAT'); setWizardNote('') }
  const creaRDO = async () => {
    if(!wizardRdo) return; setGenerandoRdo(true)
    const codice='RDO-'+id.slice(0,8).toUpperCase()+'-'+Date.now().toString().slice(-4)
    const {error}=await supabase.from('rdo').insert({commessa_id:id,rda_id:wizardRdo.id,rda_ids:[wizardRdo.id],codice,tipo:wizardTipo,oggetto:wizardRdo.oggetto,note:wizardNote,stato:'bozza',importo_offerta:0})
    if(error){showToast('Errore: '+error.message)}
    else{await supabase.from('rda').update({stato:'inviata'}).eq('id',wizardRdo.id);showToast('✅ RDO creata — vai alla tab RDO');setWizardRdo(null);carica()}
    setGenerandoRdo(false)
  }
  const elimina = async (rda: RDA) => {
    if (!window.confirm(`Eliminare la RDA ${rda.codice}?`)) return
    if (!window.confirm(`Conferma definitiva: la RDA "${rda.codice}" verrà eliminata permanentemente.`)) return
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
              onClick={() => { setEditRda({ tipo:'MAT', stato:'bozza', qta_stimata:1, um:'nr' }); setModRapida(false); setForm(true) }}>
              + Nuova RDA
            </button>
            <button className="btn-secondary" style={{ fontSize:12, padding:'8px 10px', whiteSpace:'nowrap' as const, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--t2)' }}
              onClick={() => { setEditRda({ tipo:'MAT', stato:'bozza', qta_stimata:1, um:'nr' }); setModRapida(true); setForm(true) }}>
              ⚡ Rapida
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
                  <tr key={r.id} style={{ transition:'background .1s', cursor:'pointer' }}
                    onClick={() => caricaVoci(r)}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{ ...(styleObj as any).td, fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>{r.codice}</td>
                    <td style={(styleObj as any).td as React.CSSProperties}><span style={(styleObj as any).badge('#3b82f6')}>{r.tipo}</span></td>
                    <td style={{ ...(styleObj as any).td, maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{r.oggetto}</td>
                    <td style={{ ...(styleObj as any).td, fontSize:11 }}>{r.data_necessita || '—'}</td>
                    <td style={{ ...(styleObj as any).td, fontSize:11 }}>
  {r.fornitore_sugg
    ? <button onClick={e => { e.stopPropagation(); setViewFornitore(r.fornitore_sugg) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', textDecoration:'underline', fontSize:11, padding:0 }}>{r.fornitore_sugg}</button>
    : '—'}
</td>
                    <td style={{ ...(styleObj as any).td, fontSize:11 }} onClick={e => e.stopPropagation()}>
  {r.stato === 'approvata' ? (
    <button onClick={() => generaRDO(r)} disabled={generandoRdo}
      style={{ padding:'4px 10px', borderRadius:6, background:'#3b82f6', color:'#fff', border:'none', cursor:'pointer', fontSize:10, fontWeight:700, whiteSpace:'nowrap' as const }}>
      📋 Genera RDO
    </button>
  ) : r.stato === 'bozza' ? (
    <button onClick={async e => { e.stopPropagation(); await supabase.from('rda').update({stato:'approvata'}).eq('id',r.id); carica() }}
      style={{ padding:'4px 10px', borderRadius:6, background:'#10b981', color:'#fff', border:'none', cursor:'pointer', fontSize:10, fontWeight:700, whiteSpace:'nowrap' as const }}>
      ✅ Approva
    </button>
  ) : (
    <span style={{ fontSize:10, color:'var(--t3)' }}>
      {r.stato === 'inviata' ? '🔵 RDO in corso' : r.stato === 'chiusa' ? '✅ Chiusa' : ''}
    </span>
  )}
</td>
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
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{editRda.id ? 'Modifica RDA' : modRapida ? '⚡ RDA Rapida (Cantiere)' : 'Nuova Richiesta di Acquisto'}</h3>
              <button onClick={() => { setForm(false); setEditRda(null) }} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Toggle modalità */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background: modRapida ? '#fef9c3' : 'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
                <button onClick={() => setModRapida(!modRapida)} style={{ padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:700, border:'none', cursor:'pointer', background: modRapida ? '#eab308' : 'var(--border)', color: modRapida ? '#fff' : 'var(--t2)' }}>
                  {modRapida ? '⚡ Rapida (Cantiere)' : '📋 Completa (Ufficio)'}
                </button>
                <span style={{ fontSize:11, color:'var(--t3)' }}>
                  {modRapida ? 'Solo i campi essenziali. I dettagli si aggiungono in ufficio.' : 'Tutti i campi disponibili.'}
                </span>
              </div>
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
              {!modRapida && <div style={{ position:'relative' }}>
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
             </div>}
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

      {detailRda && (
        <div className="modal-overlay" onClick={() => setDetailRda(null)}>
          <div style={{ position:'fixed', top:0, right:0, width:520, maxWidth:'95vw', height:'100vh', background:'var(--panel)', borderLeft:'1px solid var(--border)', zIndex:300, display:'flex', flexDirection:'column', boxShadow:'-4px 0 20px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg)' }}>
              <div>
                <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>{detailRda.codice}</h3>
                <p style={{ fontSize:11, color:'var(--t3)', margin:0 }}>{detailRda.tipo} · {detailRda.wbs_id || 'WBS non specificato'}</p>
              </div>
              <button onClick={() => setDetailRda(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'var(--bg)', borderRadius:10, padding:12, border:'1px solid var(--border)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[['Tipo',detailRda.tipo],['Stato',detailRda.stato],['Data necessità',detailRda.data_necessita||'—'],['Fornitore sugg.',detailRda.fornitore_sugg||'—']].map(([l,v]) => (
                    <div key={l}><p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase' as const, margin:0 }}>{l}</p><p style={{ fontSize:13, margin:'2px 0 0' }}>{v}</p></div>
                  ))}
                </div>
                <div style={{ marginTop:8 }}>
                  <p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase' as const, margin:0 }}>Oggetto</p>
                  <p style={{ fontSize:13, margin:'2px 0 0' }}>{detailRda.oggetto}</p>
                </div>
                {detailRda.note && <div style={{ marginTop:8 }}><p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase' as const, margin:0 }}>Note</p><p style={{ fontSize:12, color:'var(--t2)', margin:'2px 0 0' }}>{detailRda.note}</p></div>}
              </div>
              <div style={{ background:'var(--bg)', borderRadius:10, padding:12, border:'1px solid var(--border)' }}>
                <h4 style={{ fontSize:12, fontWeight:700, marginBottom:10, color:'var(--t2)', margin:'0 0 10px' }}>
                  Voci computo incluse {vociRda.length > 0 && <span style={{ color:'var(--t3)', fontWeight:400 }}>({vociRda.length})</span>}
                </h4>
                {loadingVoci ? <p style={{ fontSize:12, color:'var(--t3)' }}>Caricamento...</p>
                : vociRda.length === 0 ? <p style={{ fontSize:12, color:'var(--t3)', fontStyle:'italic' }}>Nessuna voce di computo collegata.</p>
                : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead><tr>{['Descrizione','U.M.','Qtà'].map(h=><th key={h} style={{ padding:'6px 8px', textAlign:'left' as const, fontWeight:700, color:'var(--t3)', borderBottom:'1px solid var(--border)', fontSize:10 }}>{h}</th>)}</tr></thead>
                    <tbody>{vociRda.map(v=><tr key={v.id}><td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', color:'var(--t1)', lineHeight:1.4 }}>{v.descrizione}</td><td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', color:'var(--t2)', whiteSpace:'nowrap' as const }}>{v.um||'—'}</td><td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', color:'var(--t2)' }}>{v.quantita!=null?Number(v.quantita).toLocaleString('it-IT'):'—'}</td></tr>)}</tbody>
                  </table>}
              </div>
            </div>

              {/* FlowThread — flusso documentale */}
              {detailRda.stato !== 'bozza' && (
                <FlowThreadInline rdaId={detailRda.id} supabase={supabase} commessaId={id} />
              )}
            <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
              {detailRda.stato === 'approvata' && <button onClick={() => generaRDO(detailRda)} disabled={generandoRdo} style={{ flex:1, padding:'10px', background:'#3b82f6', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>{generandoRdo ? 'Creazione...' : '📋 Genera RDO'}</button>}
              {detailRda.stato === 'bozza' && <button onClick={async () => { await supabase.from('rda').update({stato:'approvata'}).eq('id',detailRda.id); showToast('RDA approvata'); setDetailRda({...detailRda,stato:'approvata'}); carica() }} style={{ flex:1, padding:'10px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>✅ Approva RDA</button>}
              {['inviata','chiusa'].includes(detailRda.stato) && <p style={{ flex:1, fontSize:12, color:'var(--t3)', textAlign:'center' as const, padding:'10px', margin:0 }}>{detailRda.stato === 'inviata' ? '🔵 RDO in corso' : '✅ Acquisizione completata'}</p>}
              <button onClick={() => setDetailRda(null)} style={{ padding:'10px 16px', border:'1px solid var(--border)', borderRadius:8, background:'none', cursor:'pointer', fontSize:12 }}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
      {viewFornitore && (
        <div className="modal-overlay" onClick={() => setViewFornitore(null)}>
          <div className="modal-box" style={{ maxWidth:480, width:'92%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>Anagrafica Fornitore</h3>
              <button onClick={() => setViewFornitore(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <FornitoreCard nome={viewFornitore} />
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#14532d', color:'#fff', padding:'10px 18px', borderRadius:10, fontSize:12, fontWeight:700, zIndex:1000, boxShadow:'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}

      {wizardRdo&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>!generandoRdo&&setWizardRdo(null)}>
          <div style={{background:'var(--panel)',borderRadius:16,padding:24,width:460,maxWidth:'92vw',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:'0 0 4px',fontSize:15,fontWeight:700}}>Genera RDO da {wizardRdo.codice}</h3>
            <p style={{margin:'0 0 12px',fontSize:12,color:'var(--t3)'}}>{wizardRdo.oggetto}</p>
            {wizardRdo.voci_ids?.length?<div style={{marginBottom:12,padding:'6px 10px',background:'var(--bg)',borderRadius:6,fontSize:11,color:'var(--t2)'}}>📋 {wizardRdo.voci_ids.length} voci computo collegate</div>:null}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--t3)',marginBottom:6}}>TIPO RDO</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap' as const}}>
                {['MAT','SUB','NOL','MAN','MIX'].map(t=>(
                  <button key={t} onClick={()=>setWizardTipo(t)} style={{padding:'6px 12px',borderRadius:8,border:'2px solid',cursor:'pointer',fontSize:11,fontWeight:700,borderColor:wizardTipo===t?'var(--accent)':'var(--border)',background:wizardTipo===t?'var(--accent-light)':'none',color:wizardTipo===t?'var(--accent)':'var(--t2)'}}>
                    {t==='MAT'?'Materiale':t==='SUB'?'Subappalto':t==='NOL'?'Nolo':t==='MAN'?'Manodopera':'Misto'}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={wizardNote} onChange={e=>setWizardNote(e.target.value)} placeholder="Note / specifiche tecniche..." style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid var(--border)',fontSize:12,resize:'vertical' as const,minHeight:50,outline:'none',background:'var(--panel)',color:'var(--t1)',boxSizing:'border-box' as const,marginBottom:12}}/>
            <div style={{padding:'8px 10px',background:'#eff6ff',borderRadius:6,fontSize:11,color:'#1e40af',marginBottom:14}}>💡 Puoi generare più RDO dalla stessa RDA per fornitori o tipi diversi</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setWizardRdo(null)} disabled={generandoRdo} style={{padding:'8px 16px',borderRadius:8,border:'1px solid var(--border)',background:'none',cursor:'pointer',fontSize:12}}>Annulla</button>
              <button onClick={creaRDO} disabled={generandoRdo} style={{padding:'8px 20px',borderRadius:8,border:'none',background:'var(--accent)',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700}}>{generandoRdo?'Creazione...':'📤 Crea RDO'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
