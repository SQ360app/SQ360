'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { supabase, getAziendaId } from '@/lib/supabase'
import { scritturaVerificata } from '@/lib/scritture'
import { FlowThread } from '@/components/FlowThread'
import { EmailPreviewModal } from '@/components/EmailPreviewModal'
import { saveEmailLog } from '@/lib/emailLog'
import { emailRdoInvito } from '@/lib/emailTemplates'
import { fetchConToken } from '@/lib/authFetch'

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

const STATI_RDO = ['bozza','inviata','ricevuta','comparativa','aggiudicata','annullata']
const STATO_COLOR: Record<string,string> = {
  bozza:'#f59e0b', inviata:'#3b82f6', ricevuta:'#8b5cf6', risposta_ricevuta:'#8b5cf6',
  comparativa:'#f97316', aggiudicata:'#10b981', annullata:'#6b7280'
}

const TIPI_AFFIDAMENTO = [
  { value: 'fornitore_materiali', label: 'Fornitura materiali', emoji: '🏭' },
  { value: 'nolo_freddo',         label: 'Nolo a freddo',       emoji: '🚜' },
  { value: 'nolo_caldo',          label: 'Nolo a caldo',        emoji: '🚧' },
  { value: 'posa_opera',          label: 'Solo posa in opera',  emoji: '🔧' },
  { value: 'fornitura_posa',      label: 'Fornitura con posa',  emoji: '📦' },
  { value: 'subappalto',          label: 'Subappalto',          emoji: '🏗️' },
  { value: 'subaffidamento',      label: 'Subaffidamento',      emoji: '📋' },
  { value: 'lavoratore_autonomo', label: 'Lavoratore autonomo', emoji: '👷' },
]
const TIPI_CON_MANODOPERA = ['nolo_caldo','posa_opera','fornitura_posa','subappalto','subaffidamento']

interface RDO {
  id: string; rda_id?: string; commessa_id: string; codice: string
  fornitore: string; email_fornitore: string
  data_invio: string; data_scadenza: string
  importo_offerta: number; trasporto?: number; stato: string; note: string
  rdo_gruppo_id?: string; oggetto?: string
  pagamento_giorni?: number; anticipo_pct?: number; disponibilita?: string
  offerta_voci?: any[]
  tipo_affidamento?: string
  pct_manodopera?: number
  richiede_sam?: boolean
  token_offerta?: string
  email_inviata?: boolean
  email_inviata_at?: string
  email_destinatario?: string
  wbs_ref?: string
  note_tecniche?: string
  specifiche?: string
  condizioni_particolari?: string
  offerta_pdf_url?: string
  revisione?: number
  doc_padre_id?: string
  is_vigente?: boolean
  motivo_rev?: string
  revised_at?: string
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
    sb.from('oda').select('numero:codice,stato').eq('rdo_id', rdoId).limit(1).then(({ data }: any) => data?.[0] && setOda(data[0]))
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
      const res = await fetchConToken('/api/rdo-extract-offerta', { method: 'POST', body: fd })
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
    // Scrittura verificata: "importata" solo se la riga è stata davvero aggiornata.
    // stato: valori ammessi da rdo_stato_check → bozza, inviata, ricevuta, accettata, rifiutata
    const esito = await scritturaVerificata(supabase.from('rdo').update({
      offerta_voci: result.voci || [],
      importo_offerta: result.importo_totale || 0,
      stato: 'ricevuta',
      data_risposta: new Date().toISOString().slice(0, 10),
    }).eq('id', rdo.id).select('id'))
    setSaving(false)
    if (!esito.ok) { alert('⚠ Offerta non salvata: ' + esito.errore); return }
    alert(`✓ Offerta di ${rdo.fornitore} importata: EUR ${Number(result.importo_totale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`)
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
  const [commessa, setCommessa] = useState<{sam_obbligatoria:boolean;tipo_committente:string;importo_contrattuale:number}|null>(null)
  const [prossimoPasso, setProssimoPasso] = useState<RDO | null>(null)
  const [inviaRdo, setInviaRdo] = useState<RDO | null>(null)
  const [emailCompose, setEmailCompose] = useState<RDO | null>(null)
  const [revModal, setRevModal] = useState<{doc: RDO; motivo: string} | null>(null)
  const [storicoOpen, setStoricoOpen] = useState<Record<string,boolean>>({})
  const [allRdo, setAllRdo] = useState<RDO[]>([])
  const [aziendaDoc, setAziendaDoc] = useState<any>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), msg.startsWith('⚠') ? 7000 : 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: rdo }, { data: rda }, { data: comm }] = await Promise.all([
      supabase.from('rdo').select('*').eq('commessa_id', id).order('created_at', { ascending: false }),
      supabase.from('rda').select('id,codice,oggetto,tipo,stato').eq('commessa_id', id).in('stato', ['approvata','inviata']),
      supabase.from('commesse').select('sam_obbligatoria,tipo_committente,importo_contrattuale').eq('id', id).single(),
    ])
    const allRdoData = (rdo as RDO[]) || []
    setAllRdo(allRdoData)
    setRdoList(allRdoData.filter(r => r.is_vigente !== false))
    setRdaList((rda as RDA[]) || [])
    if (comm) setCommessa(comm as any)
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  useEffect(() => {
    getAziendaId().then(async azId => {
      if (!azId) return
      const { data } = await supabase.from('azienda').select('logo_url,carta_intestata_header_url,carta_intestata_footer_url').eq('id', azId).single()
      setAziendaDoc(data || null)
    })
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().catch(() => {})
    }
    const channel = (supabase as any).channel(`rdo-live-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rdo', filter: `commessa_id=eq.${id}` },
        (payload: any) => {
          const rec = payload.new
          const old = payload.old || {}
          if (rec.stato === 'ricevuta' && old.stato !== 'ricevuta') {
            setToast(`📬 Offerta ricevuta da ${rec.fornitore}`)
            setTimeout(() => setToast(''), 4000)
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('SQ360 — Nuova offerta ricevuta', {
                body: `${rec.fornitore} ha inviato la propria offerta`,
                icon: '/icons/icon-192.png',
              })
            }
            carica()
          }
        }
      )
      .subscribe()
    return () => { (supabase as any).removeChannel(channel) }
  }, [id, carica])

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

  const generaPdf = async (rdo: RDO) => {
    showToast('⏳ Generando PDF...')
    try {
      const { data: com } = await supabase.from('commesse').select('codice,nome,committente,cig,cup').eq('id', id).single()
      let voci: { descrizione: string; um: string; quantita: number }[] = []
      if (rdo.rda_id) {
        const { data: rda } = await supabase.from('rda').select('voci_ids').eq('id', rdo.rda_id).single()
        if ((rda as any)?.voci_ids?.length) {
          const { data: v } = await supabase.from('voci_computo').select('descrizione,um,quantita').in('id', (rda as any).voci_ids)
          voci = (v as any[]) || []
        }
      }
      const portalUrl = rdo.token_offerta ? `${window.location.origin}/offerta/${rdo.token_offerta}` : undefined
      const [pdfrMod, docMod] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/RdoDocument'),
      ])
      const element = React.createElement(docMod.RdoDocument, {
        rdo: { codice: rdo.codice, oggetto: rdo.oggetto, fornitore: rdo.fornitore, email_fornitore: rdo.email_fornitore, data_scadenza: rdo.data_scadenza, note: rdo.note, token_offerta: rdo.token_offerta, wbs_ref: rdo.wbs_ref },
        commessa: { codice: (com as any)?.codice || '', nome: (com as any)?.nome || '', committente: (com as any)?.committente, cig: (com as any)?.cig, cup: (com as any)?.cup },
        voci,
        aziendaDoc,
        portalUrl,
      })
      const blob = await pdfrMod.pdf(element as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${rdo.codice}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      showToast('✓ PDF scaricato')
    } catch (e: any) {
      showToast('Errore PDF: ' + e.message)
    }
  }

  const fLabel = (f: Fornitore) => f.ragione_sociale || ((f.nome || '') + ' ' + (f.cognome || '')).trim()

  const salva = async () => {
    if (!editRdo?.fornitore) { showToast('Inserisci almeno un fornitore'); return }
    setSaving(true)
    try {
      const aziendaId = await getAziendaId() || null
      const defaultSam = commessa?.sam_obbligatoria || commessa?.tipo_committente === 'pubblico' || false
      const payload = {
        commessa_id: id,
        azienda_id: aziendaId,
        rda_id: editRdo.rda_id || null,
        fornitore: editRdo.fornitore || '',
        email_fornitore: editRdo.email_fornitore || '',
        data_invio: editRdo.data_invio || null,
        data_scadenza: editRdo.data_scadenza || null,
        importo_offerta: editRdo.importo_offerta || 0,
        stato: editRdo.stato || 'bozza',
        note: editRdo.note || '',
        tipo_affidamento: editRdo.tipo_affidamento || null,
        pct_manodopera: editRdo.pct_manodopera != null ? editRdo.pct_manodopera : null,
        richiede_sam: editRdo.richiede_sam ?? defaultSam,
        wbs_ref: editRdo.wbs_ref || null,
        note_tecniche: editRdo.note_tecniche || null,
        specifiche: editRdo.specifiche || null,
        condizioni_particolari: editRdo.condizioni_particolari || null,
      }
      if (editRdo.id) {
        { const esito = await scritturaVerificata(supabase.from('rdo').update({ ...payload, codice: editRdo.codice || '' }).eq('id', editRdo.id).select('id')); if (!esito.ok) { showToast('⚠ RDO non salvata: ' + esito.errore); return } }
        showToast('RDO aggiornata')
      } else {
        const anno = new Date().getFullYear().toString().slice(2)
        const { data: rdoCodici } = await supabase.from('rdo').select('codice').eq('commessa_id', id).like('codice', `RDO-${anno}-%`)
        let maxNum = 0
        rdoCodici?.forEach((r: any) => { const n = parseInt(r.codice?.split('-')?.[2] || '0'); if (!isNaN(n) && n > maxNum) maxNum = n })
        const codice = `RDO-${anno}-${String(maxNum + 1).padStart(3, '0')}`
        { const esito = await scritturaVerificata(supabase.from('rdo').insert({ ...payload, codice }).select('id')); if (!esito.ok) { showToast('⚠ RDO non salvata: ' + esito.errore); return } }
        showToast('RDO creata')
      }
      setForm(false); setEditRdo(null); carica()
    } finally { setSaving(false) }
  }

  const cambiaStato = async (rdo: RDO, stato: string) => {
    const update: any = { stato }
    if (stato === 'inviata' && !rdo.token_offerta) update.token_offerta = crypto.randomUUID()
    { const esito = await scritturaVerificata(supabase.from('rdo').update(update).eq('id', rdo.id).select('id')); if (!esito.ok) { showToast('⚠ RDO non aggiornata: ' + esito.errore); return } }
    showToast('RDO aggiornata'); carica()
  }

  // Anteprima: stesso modello usato dal server per l'invio (/api/email, tipo rdo_invito)
  const buildRdoHtml = (r: RDO, messaggio = '') => emailRdoInvito({
    fornitore: r.fornitore, codice: r.codice, oggetto: r.oggetto,
    dataScadenza: r.data_scadenza, note: r.note,
    portalUrl: r.token_offerta ? `${window.location.origin}/offerta/${r.token_offerta}` : null,
    messaggio,
  }).html

  const inviaEmailRdo = async (r: RDO, params: { to: string[]; cc: string[]; subject: string; messaggio: string }) => {
    // Mittente fisso e HTML generato dal server dalla RDO (letta con i permessi dell'utente)
    const res = await fetchConToken('/api/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'rdo_invito', rdo_id: r.id, to: params.to, cc: params.cc, oggetto: params.subject, messaggio: params.messaggio }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok || !result.ok) { showToast('⚠ Email non inviata: ' + (result.error || 'errore')); return }
    await supabase.from('rdo').update({ email_inviata: true, email_inviata_at: new Date().toISOString(), email_destinatario: result.to?.[0] || params.to[0] }).eq('id', r.id)
    const aziendaId = await getAziendaId()
    if (aziendaId) {
      saveEmailLog({
        azienda_id: aziendaId, commessa_id: id, tipo_doc: 'rdo',
        doc_id: r.id, doc_codice: r.codice, mittente: result.mittente,
        destinatari: result.to || params.to, cc: result.cc || params.cc, oggetto: result.subject || params.subject, html: result.html,
        resend_id: result?.id,
      })
    }
    showToast('✓ Email inviata a ' + params.to.join(', '))
    carica()
    setEmailCompose(null)
  }

  const aggiudicaGruppo = async (vincitrice: RDO, gruppoId: string) => {
    const gruppo = rdoList.filter(r => r.rdo_gruppo_id === gruppoId)
    { const esito = await scritturaVerificata(supabase.from('rdo').update({ stato: 'aggiudicata' }).eq('id', vincitrice.id).select('id')); if (!esito.ok) { showToast('⚠ Aggiudicazione non salvata: ' + esito.errore); return } }
    const altriIds = gruppo.filter(r => r.id !== vincitrice.id).map(r => r.id)
    if (altriIds.length) await supabase.from('rdo').update({ stato: 'annullata' }).in('id', altriIds)
    showToast(`✓ Aggiudicata a ${vincitrice.fornitore}`)
    await carica()
    setProssimoPasso(vincitrice)
  }

  const buildSamUrl = (r: RDO) => {
    const base = window.location.pathname.replace('/rdo', '/dam')
    const params = new URLSearchParams({ rdo_id: r.id, fornitore: r.fornitore || '', importo: String(r.importo_offerta || 0), rda_id: r.rda_id || '', wbs_ref: r.wbs_ref || '' })
    return base + '?' + params.toString()
  }

  const buildOdaUrl = (r: RDO) => {
    const base = window.location.pathname.replace('/rdo', '/oda')
    const params = new URLSearchParams({ rdo_id: r.id, importo: String(r.importo_offerta || 0), fornitore: r.fornitore || '', richiede_sam: '0', wbs_ref: r.wbs_ref || '' })
    return base + '?' + params.toString()
  }

  const displayCodice = (r: RDO) => r.revisione ? `${r.codice} REV.${r.revisione}` : r.codice
  const getStorico = (rdoId: string): RDO[] => {
    const chain: RDO[] = []
    let current = allRdo.find(r => r.id === rdoId)
    while (current?.doc_padre_id) {
      const parent = allRdo.find(r => r.id === current!.doc_padre_id)
      if (!parent) break
      chain.push(parent)
      current = parent
    }
    return chain
  }
  const creaRevisioneRdo = async (rdo: RDO, motivo: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    const aziendaId = await getAziendaId()
    const { error } = await supabase.from('rdo').insert({
      commessa_id: rdo.commessa_id, azienda_id: aziendaId || null,
      rda_id: rdo.rda_id, rdo_gruppo_id: rdo.rdo_gruppo_id,
      codice: `${rdo.codice}-R${(rdo.revisione || 0) + 1}`, fornitore: rdo.fornitore,
      email_fornitore: rdo.email_fornitore, oggetto: rdo.oggetto,
      data_scadenza: rdo.data_scadenza, note: rdo.note,
      tipo_affidamento: rdo.tipo_affidamento, pct_manodopera: rdo.pct_manodopera,
      richiede_sam: rdo.richiede_sam, wbs_ref: rdo.wbs_ref,
      token_offerta: crypto.randomUUID(), stato: 'bozza',
      revisione: (rdo.revisione || 0) + 1,
      doc_padre_id: rdo.id, is_vigente: true,
      motivo_rev: motivo || null,
      revised_by: user?.id || null,
      revised_at: new Date().toISOString(),
    })
    if (error) { showToast('Errore: ' + error.message); return }
    await supabase.from('rdo').update({ is_vigente: false }).eq('id', rdo.id)
    showToast('✅ Revisione RDO creata')
    setRevModal(null); carica()
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
            onClick={() => {
            const defaultSam = commessa?.sam_obbligatoria || commessa?.tipo_committente === 'pubblico' || false
            setEditRdo({ stato:'bozza', importo_offerta:0, richiede_sam: defaultSam })
            setFSearch(''); setForm(true)
          }}>
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
                  const storico = getStorico(r.id)
                  return (
                    <React.Fragment key={r.id}>
                    <tr
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <td style={{ ...styleTd, fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>
                        {displayCodice(r)}
                        {r.email_inviata && (
                          <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'#10b98120', color:'#10b981', fontWeight:600, display:'inline-block', marginLeft:4 }}>✓ email</span>
                        )}
                        <FlowThread rdoId={r.id} rdaId={r.rda_id} richiedeSam={r.richiede_sam} />
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
                        <span style={{ padding:'2px 8px', borderRadius:6, background:(STATO_COLOR[r.stato] || '#ccc') + '22', color: STATO_COLOR[r.stato] || '#666', fontSize:11, fontWeight:700, display:'inline-block' }}>
                          {r.stato}
                        </span>
                      </td>
                      <td style={{ ...styleTd, whiteSpace:'nowrap' }}>
                        {!['aggiudicata','annullata'].includes(r.stato) && (
                          <button style={styleBtn('#3b82f6')} onClick={() => { setEditRdo(r); setFSearch(r.fornitore || ''); setForm(true) }}>
                            Modifica
                          </button>
                        )}
                        {!['aggiudicata','annullata'].includes(r.stato) && (
                          <button style={{...styleBtn('#dc2626'),fontSize:11,marginLeft:4}} onClick={() => {
                            if (!window.confirm(`Annullare la RDO ${r.codice}?`)) return
                            if (!window.confirm('Conferma: la RDO verrà marcata come ANNULLATA.')) return
                            cambiaStato(r, 'annullata')
                          }}>✕ Annulla</button>
                        )}
                        <button style={{...styleBtn('#475569'),fontSize:11,marginLeft:4}} onClick={() => generaPdf(r)}>📄 PDF</button>
                        {r.stato === 'inviata' && (
                          <button style={{...styleBtn('#7c3aed'),fontSize:11,marginLeft:4}} onClick={() => setInviaRdo(r)}>📤 Invia</button>
                        )}
                        {r.stato === 'inviata' && (
                          <button style={{...styleBtn('#6366f1'),fontSize:11,marginLeft:4}} onClick={() => setPdfRdo(r)}>📎 Preventivo</button>
                        )}
                        {r.offerta_pdf_url && (
                          <a href={r.offerta_pdf_url} target="_blank" rel="noopener noreferrer"
                            style={{...styleBtn('#0ea5e9'),fontSize:11,marginLeft:4,textDecoration:'none',display:'inline-block'}}>
                            📄 PDF offerta
                          </a>
                        )}
                        {r.stato === 'aggiudicata' && (
                          <button style={{...styleBtn('#0d9488'),fontSize:11,marginLeft:4}} onClick={() => window.location.href = buildSamUrl(r)}>📋 SAM</button>
                        )}
                        {r.stato === 'aggiudicata' && !r.richiede_sam && (
                          <button style={{...styleBtn('#10b981'),fontSize:11,marginLeft:4}} onClick={() => setProssimoPasso(r)}>✅ ODA →</button>
                        )}
                        {!['annullata'].includes(r.stato) && (
                          <button style={{...styleBtn('#6d28d9'),fontSize:11,marginLeft:4}} onClick={() => setRevModal({doc: r, motivo: ''})} title="Crea revisione">📝</button>
                        )}
                        {storico.length > 0 && (
                          <button style={{...styleBtn('#6b7280'),fontSize:11,marginLeft:4}} onClick={() => setStoricoOpen(prev => ({...prev, [r.id]: !prev[r.id]}))} title="Storico revisioni">📜 {storico.length}</button>
                        )}
                      </td>
                    </tr>
                    {storico.length > 0 && storicoOpen[r.id] && (
                      <tr>
                        <td colSpan={8} style={{ padding:0, background:'#f5f3ff', borderBottom:'2px solid #ddd6fe' }}>
                          <div style={{ padding:'8px 16px' }}>
                            <p style={{ fontSize:10, fontWeight:700, color:'#6d28d9', textTransform:'uppercase' as const, letterSpacing:'.04em', margin:'0 0 6px' }}>Storico revisioni</p>
                            {storico.map(h => (
                              <div key={h.id} style={{ display:'flex', gap:10, alignItems:'center', padding:'5px 0', borderBottom:'1px solid #ede9fe', fontSize:11 }}>
                                <span style={{ fontFamily:'monospace', color:'#7c3aed', minWidth:160 }}>{displayCodice(h)}</span>
                                <span style={{ padding:'2px 7px', borderRadius:4, background:(STATO_COLOR[h.stato]||'#ccc')+'22', color:STATO_COLOR[h.stato]||'#666', fontSize:10, fontWeight:700 }}>{h.stato}</span>
                                {h.motivo_rev && <span style={{ color:'var(--t3)', fontStyle:'italic' }}>"{h.motivo_rev}"</span>}
                                <span style={{ color:'var(--t4)', marginLeft:'auto', fontSize:10 }}>
                                  {h.revised_at ? new Date(h.revised_at).toLocaleDateString('it-IT') : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
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
              {/* Banner subappalto automatico */}
              {(() => {
                const ta = editRdo?.tipo_affidamento
                const pctMan = editRdo?.pct_manodopera || 0
                const imp = editRdo?.importo_offerta || 0
                const impCommessa = commessa?.importo_contrattuale || 0
                const soglia2pct = impCommessa > 0 && imp > impCommessa * 0.02
                const soglia100k = imp > 100000
                const isSubBanner = ta && !['fornitore_materiali','nolo_freddo'].includes(ta) && pctMan > 50 && (soglia2pct || soglia100k)
                if (!isSubBanner) return null
                return (
                  <div style={{ padding:'10px 14px', background:'#7c3aed18', border:'1px solid #7c3aed44', borderRadius:8, fontSize:12, color:'#7c3aed' }}>
                    ⚠️ <b>Soglie D.Lgs. 36/2023 art.119 superate</b> — classificato automaticamente <b>SUBAPPALTO</b>
                    {editRdo?.tipo_affidamento !== 'subappalto' && (
                      <button style={{ marginLeft:10, fontSize:11, padding:'2px 8px', borderRadius:4, background:'#7c3aed', color:'#fff', border:'none', cursor:'pointer' }}
                        onClick={() => setEditRdo({ ...editRdo!, tipo_affidamento: 'subappalto' })}>
                        Imposta subappalto
                      </button>
                    )}
                  </div>
                )
              })()}

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
                <label style={styleLbl}>Tipo affidamento</label>
                <select style={styleInp} value={editRdo.tipo_affidamento || ''} onChange={e => setEditRdo({ ...editRdo, tipo_affidamento: e.target.value || undefined })}>
                  <option value="">— Non specificato —</option>
                  {TIPI_AFFIDAMENTO.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
              {editRdo.tipo_affidamento && TIPI_CON_MANODOPERA.includes(editRdo.tipo_affidamento) && (
                <div>
                  <label style={styleLbl}>% incidenza manodopera (0–100)</label>
                  <input type="number" min="0" max="100" style={styleInp}
                    value={editRdo.pct_manodopera ?? ''}
                    onChange={e => setEditRdo({ ...editRdo, pct_manodopera: parseFloat(e.target.value) || 0 })}
                    placeholder="es. 60" />
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
                <div>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--t1)' }}>📋 Richiedi approvazione SAM</span>
                  <p style={{ fontSize:10, color:'var(--t3)', margin:'2px 0 0' }}>
                    {commessa?.tipo_committente === 'pubblico' ? 'Obbligatoria (appalto pubblico)' : commessa?.sam_obbligatoria ? 'Obbligatoria per questa commessa' : 'Opzionale per commessa privata'}
                  </p>
                </div>
                <button onClick={() => setEditRdo({ ...editRdo, richiede_sam: !editRdo.richiede_sam })}
                  style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', position:'relative', background: editRdo.richiede_sam ? 'var(--accent)' : 'var(--border)', transition:'background 0.2s', flexShrink:0 }}>
                  <span style={{ position:'absolute', top:3, width:18, height:18, borderRadius:9, background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.2)', transition:'left 0.2s', left: editRdo.richiede_sam ? 23 : 3 }} />
                </button>
              </div>
              <div>
                <label style={styleLbl}>WBS / Area di riferimento</label>
                <input style={styleInp} value={editRdo.wbs_ref || ''} onChange={e => setEditRdo({ ...editRdo, wbs_ref: e.target.value })} placeholder="es. 01.02 — Struttura" />
              </div>
              <div>
                <label style={styleLbl}>Note</label>
                <textarea style={{ ...styleInp, resize:'vertical', minHeight:60 }} value={editRdo.note || ''} onChange={e => setEditRdo({ ...editRdo, note: e.target.value })} />
              </div>
              <div>
                <label style={styleLbl}>Note tecniche / Capitolato</label>
                <textarea style={{ ...styleInp, resize:'vertical', minHeight:60 }} value={editRdo.note_tecniche || ''} onChange={e => setEditRdo({ ...editRdo, note_tecniche: e.target.value })} placeholder="Specifiche tecniche richieste, riferimenti normativi, norme UNI..." />
              </div>
              <div>
                <label style={styleLbl}>Specifiche materiali</label>
                <textarea style={{ ...styleInp, resize:'vertical', minHeight:60 }} value={editRdo.specifiche || ''} onChange={e => setEditRdo({ ...editRdo, specifiche: e.target.value })} placeholder="Marca, modello, certificazioni, dimensioni, classe..." />
              </div>
              <div>
                <label style={styleLbl}>Condizioni particolari</label>
                <textarea style={{ ...styleInp, resize:'vertical', minHeight:60 }} value={editRdo.condizioni_particolari || ''} onChange={e => setEditRdo({ ...editRdo, condizioni_particolari: e.target.value })} placeholder="Modalità consegna, accesso cantiere, tempi massimi..." />
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

      {/* Modal prossimo passo post-aggiudicazione */}
      {prossimoPasso && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setProssimoPasso(null) }}>
          <div className="modal-box" style={{ maxWidth:480, width:'92%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>✓ Aggiudicata — {prossimoPasso.fornitore}</h3>
              <button onClick={() => setProssimoPasso(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>×</button>
            </div>
            <p style={{ fontSize:12, color:'var(--t3)', marginBottom:16 }}>Scegli il passo successivo per procedere con l&apos;acquisto:</p>

            {/* SAM — sempre visibile */}
            <button style={{ ...styleBtn('#0d9488'), width:'100%', marginBottom:10, textAlign:'left' as const, padding:'12px 16px', fontSize:13 }}
              onClick={() => { setProssimoPasso(null); window.location.href = buildSamUrl(prossimoPasso) }}>
              <div style={{ fontWeight:700 }}>📋 Crea SAM / Scheda Approvazione Materiali</div>
              <div style={{ fontSize:10, opacity:0.85, marginTop:2, fontWeight:400 }}>Invia alla Direzione Lavori per approvazione prima dell&apos;ODA</div>
            </button>

            {/* ODA diretto — solo se richiede_sam = false */}
            {!prossimoPasso.richiede_sam ? (
              <div>
                <div style={{ padding:'8px 12px', background:'#fef3c720', border:'1px solid #f59e0b44', borderRadius:8, fontSize:11, color:'#92400e', marginBottom:10 }}>
                  ⚠️ <b>SAM non richiesta</b> per questa commessa — buona norma coinvolgere il DL prima di emettere l&apos;ordine.
                </div>
                <button style={{ ...styleBtn('#10b981'), width:'100%', textAlign:'left' as const, padding:'12px 16px', fontSize:13 }}
                  onClick={() => { setProssimoPasso(null); window.location.href = buildOdaUrl(prossimoPasso) }}>
                  <div style={{ fontWeight:700 }}>✅ Genera ODA direttamente</div>
                  <div style={{ fontSize:10, opacity:0.85, marginTop:2, fontWeight:400 }}>Salta SAM ed emetti subito l&apos;ordine di acquisto</div>
                </button>
              </div>
            ) : (
              <div style={{ padding:'10px 14px', background:'#ef444410', border:'1px solid #ef444440', borderRadius:8, fontSize:12, color:'#ef4444' }}>
                ⛔ SAM obbligatoria per questa commessa — l&apos;ODA sarà disponibile dopo l&apos;approvazione SAM.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal invia ai fornitori */}
      {inviaRdo && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setInviaRdo(null) }}>
          <div className="modal-box" style={{ maxWidth:520, width:'92%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ fontSize:14, fontWeight:700 }}>📤 Invia ai fornitori — {inviaRdo.fornitore}</h3>
              <button onClick={() => setInviaRdo(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>×</button>
            </div>

            {inviaRdo.token_offerta ? (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* URL portale */}
                <div>
                  <label style={styleLbl}>Link portale offerte</label>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <code style={{ flex:1, fontSize:10, padding:'8px 10px', background:'var(--bg)', borderRadius:6, border:'1px solid var(--border)', color:'var(--accent)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                      {`${window.location.origin}/offerta/${inviaRdo.token_offerta}`}
                    </code>
                    <button style={styleBtn('#475569')} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/offerta/${inviaRdo.token_offerta}`); showToast('Link copiato!') }}>📋 Copia</button>
                    <button style={styleBtn('#3b82f6')} onClick={() => window.open(`/offerta/${inviaRdo.token_offerta}`, '_blank')}>🌐 Apri</button>
                  </div>
                </div>

                {/* QR code */}
                <div style={{ display:'flex', justifyContent:'center', padding:'8px 0' }}>
                  <div style={{ textAlign:'center' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${window.location.origin}/offerta/${inviaRdo.token_offerta}`)}`}
                      alt="QR portale"
                      style={{ borderRadius:8, border:'1px solid var(--border)', display:'block' }} />
                    <p style={{ fontSize:9, color:'var(--t3)', margin:'4px 0 0' }}>Scansiona per accedere al portale</p>
                  </div>
                </div>

                {/* Email */}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                  <label style={styleLbl}>Invia per email</label>
                  <button style={{ ...styleBtn('#10b981'), width:'100%' }}
                    onClick={() => { setInviaRdo(null); setEmailCompose(inviaRdo) }}>
                    📧 Componi email →
                  </button>
                  {inviaRdo.email_inviata && (
                    <p style={{ fontSize:11, color:'#10b981', marginTop:8 }}>
                      ✓ Email già inviata a <b>{inviaRdo.email_destinatario}</b>
                      {inviaRdo.email_inviata_at && ` il ${new Date(inviaRdo.email_inviata_at).toLocaleString('it-IT')}`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding:'14px', background:'#fef3c720', border:'1px solid #fcd34d44', borderRadius:8, fontSize:12, color:'#92400e' }}>
                ⚠️ Per generare il link, porta lo stato RDO a <b>inviata</b> tramite il menu a tendina nella lista.
              </div>
            )}
          </div>
        </div>
      )}

      {revModal && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setRevModal(null) }}>
          <div className="modal-box" style={{ maxWidth:420, width:'90%' }}>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>📝 Crea revisione RDO</h3>
            <p style={{ fontSize:12, color:'var(--t3)', marginBottom:14 }}>
              {displayCodice(revModal.doc)} → <strong>REV.{(revModal.doc.revisione||0)+1}</strong>
            </p>
            <div>
              <label style={styleLbl}>Motivo revisione (opzionale)</label>
              <textarea style={{ ...styleInp, resize:'vertical' as const, minHeight:70 }}
                value={revModal.motivo} onChange={e => setRevModal({...revModal, motivo:e.target.value})}
                placeholder="es. Aggiornamento importo, cambio fornitore..." />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
              <button style={styleBtn('#6b7280')} onClick={() => setRevModal(null)}>Annulla</button>
              <button style={styleBtn('#6d28d9')} onClick={() => creaRevisioneRdo(revModal.doc, revModal.motivo)}>
                Crea revisione →
              </button>
            </div>
          </div>
        </div>
      )}

      {emailCompose && (
        <EmailPreviewModal
          defaultTo={[emailCompose.email_fornitore || '']}
          defaultSubject={`Richiesta d'offerta ${emailCompose.codice}${emailCompose.oggetto ? ' — ' + emailCompose.oggetto : ''}`}
          anteprima={msg => buildRdoHtml(emailCompose, msg)}
          onSend={params => inviaEmailRdo(emailCompose, params)}
          onClose={() => setEmailCompose(null)}
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
