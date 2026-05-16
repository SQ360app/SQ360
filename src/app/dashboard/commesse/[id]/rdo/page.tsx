'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

const STATI_RDO = ['bozza','inviata','risposta_ricevuta','comparativa','aggiudicata','annullata']
const STATO_COLOR: Record<string,string> = {
  bozza:'#f59e0b', inviata:'#3b82f6', risposta_ricevuta:'#8b5cf6',
  comparativa:'#f97316', aggiudicata:'#10b981', annullata:'#6b7280'
}

interface RDO {
  id: string; rda_id?: string; commessa_id: string; codice: string
  fornitore: string; email_fornitore: string
  data_invio: string; data_scadenza: string
  importo_offerta: number; trasporto?: number; stato: string; note: string
  rdo_gruppo_id?: string; oggetto?: string
  pagamento_giorni?: number; anticipo_pct?: number; disponibilita?: string
  offerta_voci?: any[]
}

interface RDA {
  id: string; codice: string; oggetto: string; tipo: string; stato: string
}

interface Fornitore {
  id: string; ragione_sociale?: string; nome?: string; cognome?: string
  email?: string; pec?: string; categoria_soa?: string
}

const styleInp = { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, outline:'none', background:'var(--panel)', color:'var(--t1)' } as React.CSSProperties
const styleLbl = { fontSize:11, fontWeight:600 as const, color:'var(--t2)', marginBottom:4, display:'block' }
const styleBtn = (c: string): React.CSSProperties => ({ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:c, color:'#fff' })
const styleTh = { padding:'7px 10px', fontSize:10, fontWeight:700 as const, color:'var(--t3)', textTransform:'uppercase' as const, background:'var(--bg)', borderBottom:'1px solid var(--border)', textAlign:'left' as const, whiteSpace:'nowrap' as const }
const styleTd = { padding:'10px 10px', fontSize:12, color:'var(--t2)', borderBottom:'1px solid var(--border)' }


function FlowThreadRDO({ rdoId, rdaId, supabase: sb }: { rdoId: string; rdaId?: string; supabase: any }) {
  const [rda, setRda] = React.useState<{codice:string;stato:string}|null>(null)
  const [oda, setOda] = React.useState<{numero:string;stato:string}|null>(null)
  React.useEffect(() => {
    if (rdaId) sb.from('rda').select('codice,stato').eq('id', rdaId).single().then(({ data }: any) => data && setRda(data))
    sb.from('oda').select('numero,stato').eq('rdo_id', rdoId).limit(1).then(({ data }: any) => data?.[0] && setOda(data[0]))
  }, [rdoId, rdaId])
  if (!rda && !oda) return null
  const C: Record<string,string> = { bozza:'#f59e0b',approvata:'#3b82f6',inviata:'#8b5cf6',aggiudicata:'#10b981',EVASO:'#10b981',EMESSO:'#3b82f6',BOZZA:'#f59e0b' }
  return (
    <div style={{ display:'flex',alignItems:'center',gap:4,marginTop:3,flexWrap:'wrap' as const }}>
      {rda&&<span style={{ fontSize:10,padding:'1px 5px',borderRadius:4,background:(C[rda.stato]||'#6b7280')+'20',color:C[rda.stato]||'#6b7280',fontWeight:600 }}>📋 {rda.codice?.slice(0,12)}</span>}
      {rda&&<span style={{ color:'var(--t4)',fontSize:10 }}>→</span>}
      {oda&&<><span style={{ color:'var(--t4)',fontSize:10 }}>→</span><span style={{ fontSize:10,padding:'1px 5px',borderRadius:4,background:(C[oda.stato]||'#6b7280')+'20',color:C[oda.stato]||'#6b7280',fontWeight:600 }}>📦 {oda.numero||'ODA'}</span></>}
    </div>
  )
}


function VociRdaSection({ rdaId, supabase: sb }: { rdaId: string; supabase: any }) {
  const [voci, setVoci] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const carica = async () => {
    if (voci.length > 0) return; setLoading(true)
    const { data: rda } = await sb.from('rda').select('voci_ids').eq('id', rdaId).single()
    if (rda?.voci_ids?.length) {
      const { data: v } = await sb.from('voci_computo').select('id,descrizione,um,quantita').in('id', rda.voci_ids)
      setVoci(v || [])
    }
    setLoading(false)
  }
  if (!rdaId) return null
  return (
    <div style={{ marginTop:4 }}>
      <button onClick={()=>{ setOpen(!open); if(!open) carica() }} style={{ fontSize:10,padding:'1px 6px',borderRadius:4,border:'1px solid var(--border)',background:'none',cursor:'pointer',color:'var(--t3)' }}>
        {open?'▼':'▶'} Voci {voci.length>0&&`(${voci.length})`}
      </button>
      {open&&<div style={{ marginTop:4,background:'var(--bg)',borderRadius:6,border:'1px solid var(--border)',overflow:'hidden',maxHeight:160,overflowY:'auto' as const }}>
        {loading?<p style={{fontSize:10,color:'var(--t3)',padding:'6px',margin:0}}>...</p>
        :voci.length===0?<p style={{fontSize:10,color:'var(--t3)',padding:'6px',margin:0,fontStyle:'italic'}}>Nessuna voce</p>
        :<table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
          <tbody>{voci.map(v=><tr key={v.id}>
            <td style={{padding:'3px 6px',borderBottom:'1px solid var(--border)',color:'var(--t1)'}}>{v.descrizione?.slice(0,70)}</td>
            <td style={{padding:'3px 6px',borderBottom:'1px solid var(--border)',color:'var(--t2)',whiteSpace:'nowrap' as const}}>{v.um||'—'}</td>
            <td style={{padding:'3px 6px',borderBottom:'1px solid var(--border)',color:'var(--t2)'}}>{v.quantita!=null?Number(v.quantita).toLocaleString('it-IT'):'—'}</td>
          </tr>)}</tbody>
        </table>}
      </div>}
    </div>
  )
}


function simScore(a: string, b: string): number {
  const wa = a.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  const wb = b.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  if (!wa.length || !wb.length) return 0
  const matches = wa.filter(w => wb.some(x => x.includes(w) || w.includes(x)))
  return Math.round((matches.length / Math.max(wa.length, wb.length)) * 100)
}


function PdfUploadModal({ rdo, onClose, onSaved }: { rdo: RDO; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [vociRda, setVociRda] = useState<any[]>([])

  useEffect(() => {
    if (!rdo.rda_id) return
    supabase.from('rda').select('voci_ids').eq('id', rdo.rda_id).single().then(async ({ data }: any) => {
      if (data?.voci_ids?.length) {
        const { data: v } = await supabase.from('voci_computo').select('id,descrizione,um,quantita').in('id', data.voci_ids)
        setVociRda(v || [])
      }
    })
  }, [rdo.rda_id])

  const caricaPdf = async () => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('rdo_id', rdo.id)
      fd.append('voci_rda', JSON.stringify(vociRda))
      const res = await fetch('/api/rdo-extract-offerta', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Errore API')
      setResult(json.data)
    } catch (e: any) {
      alert('Errore estrazione: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const conferma = async () => {
    if (!result) return
    setSaving(true)
    await supabase.from('rdo').update({
      offerta_voci: result.voci || [],
      importo_offerta: result.importo_totale || 0,
      stato: 'risposta_ricevuta',
      data_risposta: new Date().toISOString().slice(0, 10),
    }).eq('id', rdo.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 800, width: '96%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>📎 Preventivo PDF — {rdo.fornitore}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>×</button>
        </div>

        {!result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '24px', textAlign: 'center' }}>
              <input type="file" accept=".pdf" id="pdf-input" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <label htmlFor="pdf-input" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                {file ? `📄 ${file.name} (${Math.round(file.size / 1024)} KB)` : '📂 Scegli file PDF'}
              </label>
              {file && <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Clicca "Estrai con AI" per analizzare il preventivo</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={styleBtn('#6b7280')} onClick={onClose}>Annulla</button>
              <button style={styleBtn('var(--accent)')} onClick={caricaPdf} disabled={!file || loading}>
                {loading ? '⏳ Estrazione AI in corso...' : '🤖 Estrai con AI'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              {result.ragione_sociale && <span style={{ fontSize: 11, color: 'var(--t2)' }}><b>Fornitore:</b> {result.ragione_sociale}</span>}
              {result.data_preventivo && <span style={{ fontSize: 11, color: 'var(--t2)' }}><b>Data:</b> {result.data_preventivo}</span>}
              {result.importo_totale != null && <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Totale: EUR {fi(Number(result.importo_totale))}</span>}
              {result.condizioni_pagamento && <span style={{ fontSize: 11, color: 'var(--t2)' }}><b>Pagamento:</b> {result.condizioni_pagamento}</span>}
            </div>

            <div style={{ overflowX: 'auto', marginBottom: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={styleTh}>Voce RDA collegata</th>
                    <th style={styleTh}>Descrizione estratta dal PDF</th>
                    <th style={styleTh}>U.M.</th>
                    <th style={{ ...styleTh, textAlign: 'right' as const }}>Qtà</th>
                    <th style={{ ...styleTh, textAlign: 'right' as const }}>P.U.</th>
                    <th style={{ ...styleTh, textAlign: 'right' as const }}>Importo</th>
                    <th style={{ ...styleTh, textAlign: 'center' as const }}>Simil.</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.voci || []).map((v: any, i: number) => {
                    const best = vociRda.reduce((b: any, r: any) => {
                      const s = simScore(v.descrizione || '', r.descrizione || '')
                      return s > (b?.score || 0) ? { ...r, score: s } : b
                    }, null as any)
                    const score = best?.score || 0
                    return (
                      <tr key={i}>
                        <td style={{ ...styleTd, fontSize: 10, color: 'var(--t3)', maxWidth: 180 }}>{best ? best.descrizione?.slice(0, 55) : <i>—</i>}</td>
                        <td style={{ ...styleTd, maxWidth: 220 }}>{(v.descrizione || '').slice(0, 70)}</td>
                        <td style={styleTd}>{v.unita_misura || v.um || '—'}</td>
                        <td style={{ ...styleTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.quantita != null ? Number(v.quantita).toLocaleString('it-IT') : '—'}</td>
                        <td style={{ ...styleTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.prezzo_unitario != null ? fi(Number(v.prezzo_unitario)) : '—'}</td>
                        <td style={{ ...styleTd, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v.importo != null ? fi(Number(v.importo)) : '—'}</td>
                        <td style={{ ...styleTd, textAlign: 'center' }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                            background: score > 70 ? '#10b98120' : score > 40 ? '#f59e0b20' : '#6b728020',
                            color: score > 70 ? '#10b981' : score > 40 ? '#f59e0b' : '#6b7280' }}>
                            {score}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {result.note && <p style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic', marginBottom: 12 }}>Note: {result.note}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={styleBtn('#6b7280')} onClick={() => setResult(null)}>← Ricarica PDF</button>
              <button style={styleBtn('#10b981')} onClick={conferma} disabled={saving}>
                {saving ? '...' : '✓ Conferma importazione'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
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
  const [pdfRdo, setPdfRdo] = useState<RDO | null>(null)

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
        .or('ragione_sociale.ilike.%' + fSearch + '%,nome.ilike.%' + fSearch + '%,cognome.ilike.%' + fSearch + '%')
        .limit(8)
      setFResults((data as Fornitore[]) || [])
    }, 300)
    return () => clearTimeout(t)
  }, [fSearch])

  const generaPdf = async (rdo: any) => {
    const { data: com } = await supabase.from('commesse').select('codice,nome,committente').eq('id', id).single()
    let voci: any[] = []
    if (rdo.rda_id) {
      const { data: rda } = await supabase.from('rda').select('voci_ids').eq('id', rdo.rda_id).single()
      if (rda?.voci_ids?.length) {
        const { data: v } = await supabase.from('voci_computo').select('descrizione,um,quantita').in('id', rda.voci_ids)
        voci = v || []
      }
    }
    const rows = voci.map((v,i) => `<tr><td>${i+1}</td><td>${v.descrizione}</td><td>${v.um||'—'}</td><td>${v.quantita!=null?Number(v.quantita).toLocaleString('it-IT'):'—'}</td></tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>RDO ${rdo.codice}</title>
<style>body{font-family:Arial;font-size:12px;margin:40px}table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border:1px solid #ccc;text-align:left}th{background:#f5f5f5}.firma{margin-top:40px;display:flex;gap:30px}.fbox{flex:1;border-top:1px solid #333;padding-top:8px;font-size:11px;color:#555}</style>
</head><body>
<div style="border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:18px">
  <div style="font-size:10px;color:#777;text-transform:uppercase">Richiesta di Offerta</div>
  <h1 style="font-size:18px;margin:4px 0">${rdo.codice}</h1>
  ${com ? `<div><b>Commessa:</b> ${com.codice} — ${com.nome}</div>` : ''}
  ${com?.committente ? `<div><b>Committente:</b> ${com.committente}</div>` : ''}
</div>
<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px">
  <span><b>Oggetto:</b> ${rdo.oggetto||'—'}</span>
  ${rdo.fornitore ? `<span><b>A:</b> ${rdo.fornitore}</span>` : ''}
  ${rdo.data_scadenza ? `<span><b>Scadenza:</b> ${rdo.data_scadenza}</span>` : ''}
</div>
${rdo.note ? `<p><b>Note:</b> ${rdo.note}</p>` : ''}
${rows ? `<h3>Lavorazioni / Forniture</h3><table><thead><tr><th>#</th><th>Descrizione</th><th>U.M.</th><th>Quantità</th></tr></thead><tbody>${rows}</tbody></table>` : '<p style="color:#777;font-style:italic">Nessuna voce collegata.</p>'}
<p style="margin-top:16px;font-size:11px;color:#666">Formulare offerta con prezzi unitari IVA esclusa.</p>
<div class="firma"><div class="fbox">Firma Fornitore</div><div class="fbox">Prezzo offerto €</div><div class="fbox">Note</div></div>
</body></html>`
    const w = window.open('','_blank')
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400)}
  }

  const fLabel = (f: Fornitore) => f.ragione_sociale || ((f.nome || '') + ' ' + (f.cognome || '')).trim()

  const salva = async () => {
    if (!editRdo?.fornitore) { showToast('Inserisci almeno un fornitore'); return }
    setSaving(true)
    try {
      const codice = 'RDO-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*1000).toString().padStart(3,'0')
      const payload = {
        commessa_id: id,
        azienda_id: await getAziendaId() || null,
        rda_id: editRdo.rda_id || null,
        codice: editRdo.id ? (editRdo.codice || codice) : codice,
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
    showToast('RDO aggiornata'); carica()
  }

  const aggiudicaGruppo = async (vincitrice: RDO, gruppoId: string) => {
    const gruppo = rdoList.filter(r => r.rdo_gruppo_id === gruppoId)
    await supabase.from('rdo').update({ stato: 'aggiudicata' }).eq('id', vincitrice.id)
    const altriIds = gruppo.filter(r => r.id !== vincitrice.id).map(r => r.id)
    if (altriIds.length) await supabase.from('rdo').update({ stato: 'annullata' }).in('id', altriIds)
    showToast(`✓ Aggiudicata a ${vincitrice.fornitore}`)
    await carica()
    const base = window.location.pathname.replace('/rdo', '/dam')
    const params = new URLSearchParams({
      rdo_id: vincitrice.id,
      fornitore: vincitrice.fornitore || '',
      importo: String(vincitrice.importo_offerta || 0),
      rda_id: vincitrice.rda_id || ''
    })
    window.location.href = base + '?' + params.toString()
  }

  const rdoFiltrate = rdoList.filter(r => filtroStato === 'tutti' || r.stato === filtroStato)

  // Raggruppa per rdo_gruppo_id (solo RDO con gruppo)
  const gruppiComparativi = rdoList.reduce((acc: Record<string, RDO[]>, r) => {
    if (!r.rdo_gruppo_id) return acc
    if (!acc[r.rdo_gruppo_id]) acc[r.rdo_gruppo_id] = []
    acc[r.rdo_gruppo_id].push(r)
    return acc
  }, {})

  return (
    <div style={{ minHeight:'100%', background:'var(--bg)', padding:16, display:'flex', flexDirection:'column', gap:12 }} className="fade-in">

      {/* KPI stati */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
        {STATI_RDO.map(s => (
          <div key={s}
            style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px', cursor:'pointer', boxShadow:'var(--shadow-sm)', outline: filtroStato === s ? '2px solid var(--accent)' : 'none' }}
            onClick={() => setFiltroStato(filtroStato === s ? 'tutti' : s)}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: STATO_COLOR[s] || '#ccc', marginBottom:6 }} />
            <p style={{ fontSize:17, fontWeight:800, color:'var(--t1)' }}>{rdoList.filter(r => r.stato === s).length}</p>
            <p style={{ fontSize:9, color:'var(--t3)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.03em' }}>{s}</p>
          </div>
        ))}
      </div>

      {/* Comparativa gare */}
      {Object.keys(gruppiComparativi).length > 0 && (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
          <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Comparativa gare</span>
            <span style={{ fontSize:10, color:'var(--t3)', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'1px 6px' }}>
              {Object.keys(gruppiComparativi).length} gara{Object.keys(gruppiComparativi).length > 1 ? 'e' : ''}
            </span>
          </div>
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:20 }}>
            {Object.entries(gruppiComparativi).map(([gruppoId, gruppo]) => {
              const rda = rdaList.find(r => r.id === gruppo[0]?.rda_id)
              const offertaRicevuta = gruppo.filter(r => r.importo_offerta > 0).length
              const totali = gruppo.map(r => (r.importo_offerta || 0) + (r.trasporto || 0))
              const minTotale = Math.min(...totali.filter(t => t > 0))

              return (
                <div key={gruppoId}>
                  {/* Intestazione gruppo */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:'var(--t1)', margin:0 }}>
                        {gruppo[0]?.oggetto || (rda ? rda.oggetto : 'Gara senza oggetto')}
                      </p>
                      <p style={{ fontSize:10, color:'var(--t3)', margin:'2px 0 0' }}>
                        {rda && <span style={{ marginRight:10 }}>📋 {rda.codice}</span>}
                        {gruppo[0]?.data_scadenza && <span style={{ marginRight:10 }}>⏱ Scadenza: {gruppo[0].data_scadenza}</span>}
                        <span style={{ color: offertaRicevuta > 0 ? '#10b981' : 'var(--t3)' }}>
                          {offertaRicevuta}/{gruppo.length} offerte ricevute
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Tabella comparativa */}
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ ...styleTh, width:160 }}>Voce</th>
                          {gruppo.map(r => (
                            <th key={r.id} style={{ ...styleTh, textAlign:'center' as const, minWidth:160 }}>
                              <div style={{ fontWeight:700, color:'var(--t1)', fontSize:11 }}>{r.fornitore}</div>
                              <div style={{ fontSize:9, marginTop:2 }}>
                                <span style={{ padding:'1px 5px', borderRadius:3, background:(STATO_COLOR[r.stato]||'#6b7280')+'22', color:STATO_COLOR[r.stato]||'#6b7280', fontWeight:700 }}>
                                  {r.stato}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Riga importo offerta */}
                        <tr>
                          <td style={{ ...styleTd, fontWeight:600, fontSize:11, color:'var(--t3)' }}>Importo offerta</td>
                          {gruppo.map(r => {
                            const isMinOfferta = r.importo_offerta > 0 && r.importo_offerta === Math.min(...gruppo.filter(x => x.importo_offerta > 0).map(x => x.importo_offerta))
                            return (
                              <td key={r.id} style={{ ...styleTd, textAlign:'right', fontVariantNumeric:'tabular-nums', fontWeight:600, background: isMinOfferta ? '#10b98110' : 'transparent' }}>
                                {r.importo_offerta > 0 ? <span style={{ color: isMinOfferta ? '#10b981' : 'var(--t1)' }}>EUR {fi(r.importo_offerta)}</span> : <span style={{ color:'var(--t4)' }}>—</span>}
                              </td>
                            )
                          })}
                        </tr>
                        {/* Riga trasporto */}
                        <tr>
                          <td style={{ ...styleTd, fontWeight:600, fontSize:11, color:'var(--t3)' }}>Trasporto</td>
                          {gruppo.map(r => (
                            <td key={r.id} style={{ ...styleTd, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                              {r.trasporto != null && r.trasporto > 0 ? `EUR ${fi(r.trasporto)}` : <span style={{ color:'var(--t4)' }}>—</span>}
                            </td>
                          ))}
                        </tr>
                        {/* Riga TOTALE */}
                        <tr style={{ background:'var(--bg)' }}>
                          <td style={{ ...styleTd, fontWeight:800, fontSize:12, color:'var(--t1)' }}>TOTALE</td>
                          {gruppo.map((r, i) => {
                            const tot = (r.importo_offerta || 0) + (r.trasporto || 0)
                            const isMin = tot > 0 && tot === minTotale
                            return (
                              <td key={r.id} style={{ ...styleTd, textAlign:'right', fontWeight:800, fontSize:13, fontVariantNumeric:'tabular-nums', background: isMin ? '#10b98118' : 'transparent', borderLeft: isMin ? '2px solid #10b981' : 'none' }}>
                                {tot > 0 ? <span style={{ color: isMin ? '#10b981' : 'var(--t1)' }}>EUR {fi(tot)}{isMin && <span style={{ fontSize:9, marginLeft:4, fontWeight:700 }}>▼ BEST</span>}</span> : <span style={{ color:'var(--t4)' }}>—</span>}
                              </td>
                            )
                          })}
                        </tr>
                        {/* Riga pagamento */}
                        <tr>
                          <td style={{ ...styleTd, fontWeight:600, fontSize:11, color:'var(--t3)' }}>Pagamento (gg)</td>
                          {gruppo.map(r => (
                            <td key={r.id} style={{ ...styleTd, textAlign:'center' }}>
                              {r.pagamento_giorni != null ? `${r.pagamento_giorni} gg` : <span style={{ color:'var(--t4)' }}>—</span>}
                            </td>
                          ))}
                        </tr>
                        {/* Riga anticipo */}
                        <tr>
                          <td style={{ ...styleTd, fontWeight:600, fontSize:11, color:'var(--t3)' }}>Anticipo %</td>
                          {gruppo.map(r => (
                            <td key={r.id} style={{ ...styleTd, textAlign:'center' }}>
                              {r.anticipo_pct != null ? `${r.anticipo_pct}%` : <span style={{ color:'var(--t4)' }}>—</span>}
                            </td>
                          ))}
                        </tr>
                        {/* Riga disponibilità */}
                        <tr>
                          <td style={{ ...styleTd, fontWeight:600, fontSize:11, color:'var(--t3)' }}>Disponibilità</td>
                          {gruppo.map(r => (
                            <td key={r.id} style={{ ...styleTd, textAlign:'center', fontSize:11 }}>
                              {r.disponibilita || <span style={{ color:'var(--t4)' }}>—</span>}
                            </td>
                          ))}
                        </tr>
                        {/* Riga azioni */}
                        <tr>
                          <td style={{ ...styleTd, fontWeight:600, fontSize:11, color:'var(--t3)' }}>Azione</td>
                          {gruppo.map(r => (
                            <td key={r.id} style={{ ...styleTd, textAlign:'center' }}>
                              {r.stato === 'aggiudicata' ? (
                                <span style={{ fontSize:10, fontWeight:700, color:'#10b981' }}>✓ Aggiudicata</span>
                              ) : r.stato === 'annullata' ? (
                                <span style={{ fontSize:10, color:'var(--t4)' }}>Annullata</span>
                              ) : (
                                <button
                                  onClick={() => aggiudicaGruppo(r, gruppoId)}
                                  style={{ padding:'5px 12px', background:'#10b981', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                  ⭐ Aggiudica
                                </button>
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista RDO */}
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg)' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Richieste d&apos;Offerta</span>
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
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Codice','Fornitore','Email','RDA collegata','Scadenza','Offerta (EUR)','Stato',''].map(h => (
                    <th key={h} style={styleTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rdoFiltrate.map(r => {
                  const rda = rdaList.find(x => x.id === r.rda_id)
                  return (
                    <tr key={r.id}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <td style={{ ...styleTd, fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>
                        {r.codice}
                        <FlowThreadRDO rdoId={r.id} rdaId={r.rda_id} supabase={supabase} />
                        <VociRdaSection rdaId={r.rda_id || ''} supabase={supabase} />
                      </td>
                      <td style={{ ...styleTd, fontWeight:600 }}>{r.fornitore}</td>
                      <td style={{ ...styleTd, fontSize:11 }}>{r.email_fornitore || '—'}</td>
                      <td style={{ ...styleTd, fontSize:11 }}>{rda ? rda.codice : '—'}</td>
                      <td style={{ ...styleTd, fontSize:11 }}>{r.data_scadenza || '—'}</td>
                      <td style={{ ...styleTd, textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>
                        {r.importo_offerta ? fi(r.importo_offerta) : '—'}
                      </td>
                      <td style={styleTd}>
                        <select value={r.stato} onChange={e => cambiaStato(r, e.target.value)}
                          style={{ padding:'3px 6px', borderRadius:6, border:'1px solid ' + (STATO_COLOR[r.stato] || '#ccc') + '44', background:(STATO_COLOR[r.stato] || '#ccc') + '22', color: STATO_COLOR[r.stato] || '#666', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          {STATI_RDO.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ ...styleTd, whiteSpace:'nowrap' }}>
                        <button style={styleBtn('#3b82f6')} onClick={() => { setEditRdo(r); setFSearch(r.fornitore || ''); setForm(true) }}>
                          Modifica
                        </button>
                        <button style={{...styleBtn('#475569'),fontSize:11,marginLeft:4}} onClick={() => generaPdf(r)}>📄 PDF</button>
                        {r.stato === 'inviata' && (
                          <button style={{...styleBtn('#7c3aed'),fontSize:11,marginLeft:4}} onClick={() => setPdfRdo(r)}>📎 Preventivo</button>
                        )}
                        {r.stato === 'aggiudicata' && (
                          <button style={{...styleBtn('#10b981'),fontSize:11,marginLeft:4}} onClick={() => {
                            const base = window.location.pathname.replace('/rdo','/oda')
                            const params = new URLSearchParams({ rdo_id: r.id, importo: String(r.importo_offerta||0), fornitore: r.fornitore||'' })
                            window.location.href = base + '?' + params.toString()
                          }}>✅ Genera ODA</button>
                        )}
                        {r.stato === 'aggiudicata' && (
                          <button style={{...styleBtn('#0d9488'),fontSize:11,marginLeft:4}} onClick={() => {
                            const base = window.location.pathname.replace('/rdo','/dam')
                            const params = new URLSearchParams({ rdo_id: r.id, fornitore: r.fornitore||'', importo: String(r.importo_offerta||0), rda_id: r.rda_id||'' })
                            window.location.href = base + '?' + params.toString()
                          }}>📋 Crea DAM</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nuova/modifica RDO */}
      {form && editRdo && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setForm(false); setEditRdo(null) } }}>
          <div className="modal-box" style={{ maxWidth:560, width:'92%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>{editRdo.id ? 'Modifica RDO' : 'Nuova Richiesta d\'Offerta'}</h3>
              <button onClick={() => { setForm(false); setEditRdo(null) }} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {rdaList.length > 0 && (
                <div>
                  <label style={styleLbl}>Collega a RDA</label>
                  <select style={styleInp} value={editRdo.rda_id || ''} onChange={e => setEditRdo({ ...editRdo, rda_id: e.target.value || undefined })}>
                    <option value="">— Nessuna RDA collegata —</option>
                    {rdaList.map(r => <option key={r.id} value={r.id}>{r.codice} — {r.oggetto}</option>)}
                  </select>
                </div>
              )}
              <div style={{ position:'relative' }}>
                <label style={styleLbl}>Fornitore *</label>
                <input style={styleInp} value={fSearch}
                  onChange={e => { setFSearch(e.target.value); setEditRdo({ ...editRdo, fornitore: e.target.value }) }}
                  placeholder="Cerca fornitore nel DB..." />
                {fResults.length > 0 && (
                  <div style={{ position:'absolute', zIndex:100, width:'100%', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'var(--shadow-md)', maxHeight:200, overflowY:'auto' }}>
                    {fResults.map(f => (
                      <div key={f.id}
                        style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, borderBottom:'1px solid var(--border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                        onClick={() => {
                          const email = f.pec || f.email || ''
                          setEditRdo({ ...editRdo, fornitore: fLabel(f), email_fornitore: email })
                          setFSearch(fLabel(f)); setFResults([])
                        }}>
                        <span style={{ fontWeight:600 }}>{fLabel(f)}</span>
                        {(f.pec || f.email) && <span style={{ fontSize:10, color:'var(--t3)', marginLeft:8 }}>{f.pec || f.email}</span>}
                        {f.categoria_soa && <span style={{ fontSize:10, color:'var(--accent)', marginLeft:8 }}>SOA: {f.categoria_soa}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={styleLbl}>Email fornitore</label>
                <input type="email" style={styleInp} value={editRdo.email_fornitore || ''} onChange={e => setEditRdo({ ...editRdo, email_fornitore: e.target.value })} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={styleLbl}>Data invio</label>
                  <input type="date" style={styleInp} value={editRdo.data_invio || ''} onChange={e => setEditRdo({ ...editRdo, data_invio: e.target.value })} />
                </div>
                <div>
                  <label style={styleLbl}>Data scadenza</label>
                  <input type="date" style={styleInp} value={editRdo.data_scadenza || ''} onChange={e => setEditRdo({ ...editRdo, data_scadenza: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={styleLbl}>Importo offerta ricevuta (EUR)</label>
                <input type="number" step="0.01" style={styleInp} value={editRdo.importo_offerta || ''} onChange={e => setEditRdo({ ...editRdo, importo_offerta: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={styleLbl}>Stato</label>
                <select style={styleInp} value={editRdo.stato || 'bozza'} onChange={e => setEditRdo({ ...editRdo, stato: e.target.value })}>
                  {STATI_RDO.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={styleLbl}>Note</label>
                <textarea style={{ ...styleInp, resize:'vertical', minHeight:60 }} value={editRdo.note || ''} onChange={e => setEditRdo({ ...editRdo, note: e.target.value })} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                <button style={styleBtn('#6b7280')} onClick={() => { setForm(false); setEditRdo(null) }}>Annulla</button>
                <button style={styleBtn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : 'Salva RDO'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal upload PDF preventivo */}
      {pdfRdo && (
        <PdfUploadModal
          rdo={pdfRdo}
          onClose={() => setPdfRdo(null)}
          onSaved={() => { setPdfRdo(null); carica() }}
        />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'#14532d', color:'#fff', padding:'10px 18px', borderRadius:10, fontSize:12, fontWeight:700, zIndex:1000, boxShadow:'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
