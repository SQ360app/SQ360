'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

const STATI_DAM = ['bozza','inviata_dl','approvata','rifiutata','integrazione']
const STATO_COLOR: Record<string,string> = {
  bozza:'#f59e0b', inviata_dl:'#3b82f6', approvata:'#10b981', rifiutata:'#ef4444', integrazione:'#8b5cf6'
}
const STATO_LBL: Record<string,string> = {
  bozza:'Bozza', inviata_dl:'Inviata DL', approvata:'Approvata', rifiutata:'Rifiutata', integrazione:'Integrazione richiesta'
}

interface DAM {
  id: string; codice: string; commessa_id: string; revisione: number
  materiale: string; descrizione: string; quantita: number; um: string
  marca_modello: string; norma_riferimento: string; classe_prestazionale: string
  cam_compliant: boolean; campione_richiesto: boolean; campione_inviato: boolean
  scheda_tecnica: boolean; dichiarazione_prestazione: boolean; certificato_ce: boolean
  stato: string; dl_nome: string; dl_email: string
  note_dl: string; note_interne: string
  data_emissione: string; data_invio_dl: string; data_risposta_dl: string
  motivo_rifiuto: string; fornitore_id: string; rdo_id?: string
}

interface Fornitore {
  id: string; ragione_sociale?: string; nome?: string; cognome?: string
}

const styleObj = {
  page:  { minHeight:'100%', background:'var(--bg)', padding:16, display:'flex', flexDirection:'column' as const, gap:12 },
  card:  { background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' } as React.CSSProperties,
  hdr:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg)' },
  hl:    { fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase' as const, letterSpacing:'0.04em' },
  th:    { padding:'7px 10px', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const, background:'var(--bg)', borderBottom:'1px solid var(--border)', textAlign:'left' as const, whiteSpace:'nowrap' as const },
  td:    { padding:'9px 10px', fontSize:12, color:'var(--t2)', borderBottom:'1px solid var(--border)', verticalAlign:'top' as const },
  inp:   { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, outline:'none', background:'var(--panel)', color:'var(--t1)' },
  row:   (cols: number) => ({ display:'grid', gridTemplateColumns:'repeat('+cols+',1fr)', gap:12 }),
  lbl:   { fontSize:11, fontWeight:600, color:'var(--t2)', marginBottom:4, display:'block' },
  btn:   (c: string) => ({ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:c, color:'#fff' }),
  chkRow:{ display:'flex', alignItems:'center', gap:8, padding:'6px 0' },
}

const CheckIcon = ({ ok }: { ok: boolean }) => (
  <span style={{ fontSize:14, color: ok ? 'var(--success)' : 'var(--border)' }}>{ok ? '✓' : '○'}</span>
)

export default function DAMPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const searchParams = useSearchParams()
  const [damList, setDamList] = useState<DAM[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editDam, setEditDam] = useState<Partial<DAM> | null>(null)
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [fSearch, setFSearch] = useState('')
  const [fResults, setFResults] = useState<Fornitore[]>([])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('dam').select('*').eq('commessa_id', id).order('created_at', { ascending: false })
    setDamList((data as DAM[]) || [])
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  useEffect(() => {
    if (!fSearch || fSearch.length < 2) { setFResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('professionisti_fornitori')
        .select('id,ragione_sociale,nome,cognome')
        .or(`ragione_sociale.ilike.%${fSearch}%,nome.ilike.%${fSearch}%,cognome.ilike.%${fSearch}%`)
        .limit(6)
      setFResults((data as Fornitore[]) || [])
    }, 300)
    return () => clearTimeout(t)
  }, [fSearch])

  useEffect(() => {
    const rdoId = searchParams.get('rdo_id')
    const fornitore = searchParams.get('fornitore')
    const importo = searchParams.get('importo')
    const rdaId = searchParams.get('rda_id')
    if (!rdoId) return
    const prefill = async () => {
      const dam: Partial<DAM> = {
        stato: 'bozza', revisione: 0, quantita: 1, um: 'nr',
        rdo_id: rdoId,
        note_interne: importo ? `Offerta aggiudicata: EUR ${Number(importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '',
      }
      if (rdaId) {
        const { data: rda } = await supabase.from('rda').select('oggetto').eq('id', rdaId).single()
        if (rda?.oggetto) dam.materiale = rda.oggetto
      }
      if (fornitore) {
        const { data: f } = await supabase.from('professionisti_fornitori')
          .select('id,ragione_sociale,nome,cognome').eq('ragione_sociale', fornitore).limit(1)
        if (f?.[0]) { dam.fornitore_id = f[0].id; setFSearch(f[0].ragione_sociale || '') }
      }
      setEditDam(dam)
      setForm(true)
    }
    prefill()
  }, [searchParams])

  const fLabel = (f: Fornitore) => f.ragione_sociale || `${f.nome||''} ${f.cognome||''}`.trim()

  const salva = async () => {
    if (!editDam?.materiale) { showToast('Inserisci il materiale'); return }
    setSaving(true)
    try {
      const nextRev = editDam.revisione || 0
      const aziendaId = await getAziendaId()
      const payload = {
        commessa_id: id,
        azienda_id: aziendaId || null,
        revisione: nextRev,
        materiale: editDam.materiale || '',
        descrizione: editDam.descrizione || '',
        quantita: editDam.quantita || 0,
        um: editDam.um || 'nr',
        marca_modello: editDam.marca_modello || '',
        norma_riferimento: editDam.norma_riferimento || '',
        classe_prestazionale: editDam.classe_prestazionale || '',
        cam_compliant: editDam.cam_compliant || false,
        campione_richiesto: editDam.campione_richiesto || false,
        campione_inviato: editDam.campione_inviato || false,
        scheda_tecnica: editDam.scheda_tecnica || false,
        dichiarazione_prestazione: editDam.dichiarazione_prestazione || false,
        certificato_ce: editDam.certificato_ce || false,
        stato: editDam.stato || 'bozza',
        dl_nome: editDam.dl_nome || '',
        dl_email: editDam.dl_email || '',
        note_dl: editDam.note_dl || '',
        note_interne: editDam.note_interne || '',
        data_emissione: editDam.data_emissione || new Date().toISOString().split('T')[0],
        motivo_rifiuto: editDam.motivo_rifiuto || '',
        fornitore_id: editDam.fornitore_id || null,
        rdo_id: editDam.rdo_id || null,
      }
      if (editDam.id) {
        await supabase.from('dam').update(payload).eq('id', editDam.id)
        showToast('DAM aggiornata')
      } else {
        const codice = 'DAM-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*1000).toString().padStart(3,'0')
        await supabase.from('dam').insert({ ...payload, codice })
        showToast('DAM creata')
      }
      setForm(false); setEditDam(null); carica()
    } finally { setSaving(false) }
  }

  const cambiaStato = async (dam: DAM, stato: string) => {
    await supabase.from('dam').update({ stato }).eq('id', dam.id)
    showToast(`DAM ${dam.codice} → ${STATO_LBL[stato]}`); carica()
  }

  const damFiltrate = damList.filter(d => {
    if (filtroStato !== 'tutti' && d.stato !== filtroStato) return false
    if (search && !d.materiale?.toLowerCase().includes(search.toLowerCase()) && !d.codice?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // KPI
  const kpi = STATI_DAM.map(s => ({ stato: s, n: damList.filter(d => d.stato === s).length }))

  const DocCheck = ({ label, val, key_ }: { label: string; val: boolean; key_: keyof DAM }) => (
    <div style={(styleObj as any).chkRow as React.CSSProperties}>
      <input type="checkbox" checked={val} onChange={e=>setEditDam(prev=>({...prev!, [key_]:e.target.checked}))}
        style={{ width:15, height:15, accentColor:'var(--accent)', cursor:'pointer', flexShrink:0 }} />
      <span style={{ fontSize:12, color:'var(--t2)' }}>{label}</span>
    </div>
  )

  return (
    <div style={(styleObj as any).page as React.CSSProperties} className="fade-in">

      {/* KPI stati */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
        {kpi.map(k => (
          <div key={k.stato} style={{ ...(styleObj as any).card, padding:'12px 16px', cursor:'pointer', outline: filtroStato===k.stato ? '2px solid var(--accent)' : 'none' }}
            onClick={() => setFiltroStato(filtroStato===k.stato ? 'tutti' : k.stato)}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:STATO_COLOR[k.stato], marginBottom:8 }} />
            <p style={{ fontSize:20, fontWeight:800, color:'var(--t1)' }}>{k.n}</p>
            <p style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>{STATO_LBL[k.stato]}</p>
          </div>
        ))}
      </div>

      {/* Lista DAM */}
      <div style={(styleObj as any).card as React.CSSProperties}>
        <div style={(styleObj as any).hdr as React.CSSProperties}>
          <span style={(styleObj as any).hl as React.CSSProperties}>Dossier Accettazione Materiali</span>
          <div style={{ display:'flex', gap:8 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca materiale..." style={{ ...(styleObj as any).inp, width:200 }} />
            <button className="btn-primary" style={{ fontSize:12, padding:'8px 14px', whiteSpace:'nowrap' as const }}
              onClick={() => { setEditDam({ stato:'bozza', revisione:0, quantita:1, um:'nr' }); setFSearch(''); setForm(true) }}>
              + Nuova DAM
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
        ) : damFiltrate.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--t3)', fontSize:13 }}>Nessuna DAM trovata</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Codice','Materiale','Qty / UM','Marca / Modello','Norma','Documenti','Stato',''].map(h => (
                    <th key={h} style={(styleObj as any).th as React.CSSProperties}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {damFiltrate.map(d => (
                  <tr key={d.id}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{ ...(styleObj as any).td, fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>
                      {d.codice}<br/>
                      <span style={{ fontSize:10, color:'var(--t4)' }}>Rev.{d.revisione}</span>
                    </td>
                    <td style={(styleObj as any).td as React.CSSProperties}>
                      <p style={{ fontWeight:700, fontSize:12 }}>{d.materiale}</p>
                      {d.descrizione && <p style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{d.descrizione.slice(0,80)}</p>}
                    </td>
                    <td style={{ ...(styleObj as any).td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const }}>
                      {fi(d.quantita)}<br/><span style={{ fontSize:10, color:'var(--t3)' }}>{d.um}</span>
                    </td>
                    <td style={{ ...(styleObj as any).td, fontSize:11 }}>{d.marca_modello || '—'}</td>
                    <td style={{ ...(styleObj as any).td, fontSize:11 }}>{d.norma_riferimento || '—'}</td>
                    <td style={(styleObj as any).td as React.CSSProperties}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
                        {[
                          ['ST', d.scheda_tecnica],
                          ['DoP', d.dichiarazione_prestazione],
                          ['CE', d.certificato_ce],
                          ['CAM', d.cam_compliant],
                        ].map(([lb, ok]) => (
                          <span key={lb as string} style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:3,
                            background: ok ? 'rgba(16,185,129,0.15)' : 'var(--bg)',
                            color: ok ? 'var(--success)' : 'var(--t4)',
                            border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'var(--border)'}` }}>
                            {lb as string}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={(styleObj as any).td as React.CSSProperties}>
                      <select value={d.stato} onChange={e=>cambiaStato(d, e.target.value)}
                        style={{ padding:'3px 6px', borderRadius:6, border:`1px solid ${STATO_COLOR[d.stato]||'#ccc'}44`, background:(STATO_COLOR[d.stato]||'#ccc')+'22', color:STATO_COLOR[d.stato]||'#666', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        {STATI_DAM.map(s => <option key={s} value={s}>{STATO_LBL[s]}</option>)}
                      </select>
                    </td>
                    <td style={(styleObj as any).td as React.CSSProperties}>
                      <button style={{ ...(styleObj as any).btn('#3b82f6'), padding:'4px 10px', fontSize:11 }}
                        onClick={() => { setEditDam(d); setFSearch(''); setForm(true) }}>✎</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {form && editDam && (
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget){setForm(false);setEditDam(null)} }}>
          <div className="modal-box" style={{ maxWidth:700, width:'94%', maxHeight:'90vh', overflowY:'auto' as const }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16, position:'sticky' as const, top:0, background:'var(--panel)', zIndex:1, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>DAM — {editDam.id ? `Modifica ${editDam.codice}` : 'Nuova Scheda'}</h3>
              <button onClick={()=>{setForm(false);setEditDam(null)}} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Sezione materiale */}
              <p style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Materiale</p>
              <div>
                <label style={(styleObj as any).lbl as React.CSSProperties}>Materiale / Voce di lavorazione *</label>
                <input style={(styleObj as any).inp as React.CSSProperties} value={editDam.materiale||''} onChange={e=>setEditDam({...editDam, materiale:e.target.value})} placeholder="Es. Acciaio B450C, Calcestruzzo C25/30..." />
              </div>
              <div>
                <label style={(styleObj as any).lbl as React.CSSProperties}>Descrizione estesa</label>
                <textarea style={{ ...(styleObj as any).inp, resize:'vertical' as const, minHeight:60 }} value={editDam.descrizione||''} onChange={e=>setEditDam({...editDam, descrizione:e.target.value})} />
              </div>
              <div style={(styleObj as any).row(3)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Quantità</label>
                  <input type="number" step="0.01" style={(styleObj as any).inp as React.CSSProperties} value={editDam.quantita||0} onChange={e=>setEditDam({...editDam, quantita:parseFloat(e.target.value)||0})} />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>UM</label>
                  <input style={(styleObj as any).inp as React.CSSProperties} value={editDam.um||'nr'} onChange={e=>setEditDam({...editDam, um:e.target.value})} />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Revisione</label>
                  <input type="number" style={(styleObj as any).inp as React.CSSProperties} value={editDam.revisione||0} onChange={e=>setEditDam({...editDam, revisione:parseInt(e.target.value)||0})} />
                </div>
              </div>
              <div style={(styleObj as any).row(2)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Marca / Modello</label>
                  <input style={(styleObj as any).inp as React.CSSProperties} value={editDam.marca_modello||''} onChange={e=>setEditDam({...editDam, marca_modello:e.target.value})} placeholder="Es. Ferriere Nord, BetonBasalt..." />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Norma di riferimento</label>
                  <input style={(styleObj as any).inp as React.CSSProperties} value={editDam.norma_riferimento||''} onChange={e=>setEditDam({...editDam, norma_riferimento:e.target.value})} placeholder="Es. EN 10025, UNI EN 206..." />
                </div>
              </div>
              <div style={(styleObj as any).row(2)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Classe prestazionale</label>
                  <input style={(styleObj as any).inp as React.CSSProperties} value={editDam.classe_prestazionale||''} onChange={e=>setEditDam({...editDam, classe_prestazionale:e.target.value})} />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Data emissione</label>
                  <input type="date" style={(styleObj as any).inp as React.CSSProperties} value={editDam.data_emissione||''} onChange={e=>setEditDam({...editDam, data_emissione:e.target.value})} />
                </div>
              </div>

              {/* Checklist documenti */}
              <p style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.04em', marginTop:4 }}>Documenti allegati</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, background:'var(--bg)', borderRadius:8, padding:12, border:'1px solid var(--border)' }}>
                <DocCheck label="Scheda tecnica" val={editDam.scheda_tecnica||false} key_="scheda_tecnica" />
                <DocCheck label="Dichiarazione di prestazione (DoP)" val={editDam.dichiarazione_prestazione||false} key_="dichiarazione_prestazione" />
                <DocCheck label="Certificato CE" val={editDam.certificato_ce||false} key_="certificato_ce" />
                <DocCheck label="Conformità CAM" val={editDam.cam_compliant||false} key_="cam_compliant" />
                <DocCheck label="Campione richiesto" val={editDam.campione_richiesto||false} key_="campione_richiesto" />
                <DocCheck label="Campione inviato" val={editDam.campione_inviato||false} key_="campione_inviato" />
              </div>

              {/* Fornitore */}
              <p style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.04em', marginTop:4 }}>Fornitore</p>
              <div style={{ position:'relative' }}>
                <label style={(styleObj as any).lbl as React.CSSProperties}>Fornitore aggiudicatario</label>
                <input style={(styleObj as any).inp as React.CSSProperties} value={fSearch}
                  onChange={e => { setFSearch(e.target.value) }}
                  placeholder="Cerca fornitore nel database..." />
                {fResults.length > 0 && (
                  <div style={{ position:'absolute', zIndex:100, width:'100%', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,.12)', maxHeight:180, overflowY:'auto' as const }}>
                    {fResults.map(f => (
                      <div key={f.id}
                        style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, borderBottom:'1px solid var(--border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                        onClick={() => { setEditDam({...editDam!, fornitore_id: f.id}); setFSearch(fLabel(f)); setFResults([]) }}>
                        <span style={{ fontWeight:600 }}>{fLabel(f)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {editDam?.fornitore_id && <span style={{ fontSize:10, color:'var(--success)', marginTop:3, display:'block' }}>✓ Fornitore selezionato</span>}
              </div>

              {/* DL */}
              <p style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.04em', marginTop:4 }}>Direzione Lavori</p>
              <div style={(styleObj as any).row(2)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Nome DL</label>
                  <input style={(styleObj as any).inp as React.CSSProperties} value={editDam.dl_nome||''} onChange={e=>setEditDam({...editDam, dl_nome:e.target.value})} />
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Email DL</label>
                  <input type="email" style={(styleObj as any).inp as React.CSSProperties} value={editDam.dl_email||''} onChange={e=>setEditDam({...editDam, dl_email:e.target.value})} />
                </div>
              </div>
              <div style={(styleObj as any).row(2)}>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Stato</label>
                  <select style={(styleObj as any).inp as React.CSSProperties} value={editDam.stato||'bozza'} onChange={e=>setEditDam({...editDam, stato:e.target.value})}>
                    {STATI_DAM.map(s => <option key={s} value={s}>{STATO_LBL[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Note DL</label>
                  <input style={(styleObj as any).inp as React.CSSProperties} value={editDam.note_dl||''} onChange={e=>setEditDam({...editDam, note_dl:e.target.value})} />
                </div>
              </div>
              {editDam.stato === 'rifiutata' && (
                <div>
                  <label style={(styleObj as any).lbl as React.CSSProperties}>Motivo rifiuto</label>
                  <textarea style={{ ...(styleObj as any).inp, resize:'vertical' as const, minHeight:60 }} value={editDam.motivo_rifiuto||''} onChange={e=>setEditDam({...editDam, motivo_rifiuto:e.target.value})} />
                </div>
              )}
              <div>
                <label style={(styleObj as any).lbl as React.CSSProperties}>Note interne</label>
                <textarea style={{ ...(styleObj as any).inp, resize:'vertical' as const, minHeight:50 }} value={editDam.note_interne||''} onChange={e=>setEditDam({...editDam, note_interne:e.target.value})} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8, position:'sticky' as const, bottom:0, background:'var(--panel)', paddingTop:12, borderTop:'1px solid var(--border)' }}>
                <button style={(styleObj as any).btn('#6b7280')} onClick={()=>{setForm(false);setEditDam(null)}}>Annulla</button>
                <button style={(styleObj as any).btn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : 'Salva DAM'}</button>
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
