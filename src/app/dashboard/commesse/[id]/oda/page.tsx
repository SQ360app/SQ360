'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase, getAziendaId } from '@/lib/supabase'
import { Plus, FileText, Loader2, ChevronDown, ChevronRight, Package, Wrench, Truck, ShoppingCart, Receipt } from 'lucide-react'
import { emailOdaCreato } from '@/lib/emailTemplates'
import { DEFAULT_WBS_FLAT } from '@/lib/wbs'
import { loadWbs } from '@/lib/wbsLoader'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TIPI_ODA = [
  { value: 'materiali',   label: 'Acquisto Materiali',  color: '#3b82f6', bg: '#dbeafe', ritenuta: 0 },
  { value: 'nolo_freddo', label: 'Nolo a Freddo',       color: '#8b5cf6', bg: '#ede9fe', ritenuta: 0 },
  { value: 'nolo_caldo',  label: 'Nolo a Caldo',        color: '#7c3aed', bg: '#ddd6fe', ritenuta: 0 },
  { value: 'subappalto',  label: 'Subappalto',          color: '#f59e0b', bg: '#fef3c7', ritenuta: 5 },
  { value: 'manodopera',  label: 'Manodopera Esterna',  color: '#10b981', bg: '#d1fae5', ritenuta: 0 },
  { value: 'servizio',    label: 'Servizio/Consulenza', color: '#6b7280', bg: '#f3f4f6', ritenuta: 0 },
]

const STATI: Record<string, { label: string; color: string }> = {
  EMESSO:     { label: 'Emesso',      color: '#3b82f6' },
  CONFERMATO: { label: 'Confermato',  color: '#6366f1' },
  PARZ_EVASO: { label: 'Parz. evaso', color: '#f59e0b' },
  EVASO:      { label: 'Evaso',       color: '#10b981' },
  ANNULLATO:  { label: 'Annullato',   color: '#ef4444' },
}

const STATI_CONSEGNA: Record<string, { label: string; color: string; next?: string }> = {
  in_attesa:   { label: '⏳ In attesa',   color: '#6b7280', next: 'confermato' },
  confermato:  { label: '✓ Confermato',  color: '#3b82f6', next: 'in_consegna' },
  in_consegna: { label: '🚚 In consegna', color: '#f59e0b', next: 'consegnato' },
  consegnato:  { label: '✅ Consegnato',  color: '#10b981', next: undefined },
}


function VociRdaSection({ rdoId, supabase }: { rdoId?: string; supabase: any }) {
  const [voci,setVoci]=useState<any[]>([])
  const [loading,setLoading]=useState(false)
  const [open,setOpen]=useState(false)
  const carica=async()=>{
    if(!rdoId||voci.length>0)return;setLoading(true)
    const{data:rdo}=await supabase.from('rdo').select('rda_id').eq('id',rdoId).single()
    if(rdo?.rda_id){
      const{data:rda}=await supabase.from('rda').select('voci_ids').eq('id',rdo.rda_id).single()
      if(rda?.voci_ids?.length){
        const{data:v}=await supabase.from('voci_computo').select('id,descrizione,um,quantita').in('id',rda.voci_ids)
        setVoci(v||[])
      }
    }
    setLoading(false)
  }
  if(!rdoId)return null
  return(
    <div style={{marginTop:8}}>
      <button onClick={()=>{setOpen(!open);if(!open)carica()}} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid var(--accent)',background:'none',cursor:'pointer',color:'var(--accent)',fontWeight:600}}>
        {open?'▼':'▶'} Voci computo {voci.length>0&&`(${voci.length})`}
      </button>
      {open&&<div style={{marginTop:6,background:'var(--bg)',borderRadius:8,border:'1px solid var(--border)',overflow:'hidden',maxHeight:180,overflowY:'auto' as const}}>
        {loading?<p style={{fontSize:11,color:'var(--t3)',padding:'8px',margin:0}}>...</p>
        :voci.length===0?<p style={{fontSize:11,color:'var(--t3)',padding:'8px',margin:0,fontStyle:'italic'}}>Nessuna voce</p>
        :<table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><tbody>{voci.map(v=><tr key={v.id}>
          <td style={{padding:'4px 6px',borderBottom:'1px solid var(--border)',color:'var(--t1)'}}>{v.descrizione?.slice(0,80)}</td>
          <td style={{padding:'4px 6px',borderBottom:'1px solid var(--border)',color:'var(--t2)',whiteSpace:'nowrap' as const}}>{v.um||'—'}</td>
          <td style={{padding:'4px 6px',borderBottom:'1px solid var(--border)',color:'var(--t2)'}}>{v.quantita!=null?Number(v.quantita).toLocaleString('it-IT'):'—'}</td>
        </tr>)}</tbody></table>}
      </div>}
    </div>
  )
}

export default function ODAPage() {
  const params = useParams()
  const commessaId = params.id as string
  const searchParams = useSearchParams()
  const [oda, setOda] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tipo, setTipo] = useState('materiali')
  const [oggetto, setOggetto] = useState('')
  const [fornitoreId, setFornitoreId] = useState('')
  const [rdoId, setRdoId] = useState('')
  const [importoNetto, setImportoNetto] = useState('')
  const [ivaPct, setIvaPct] = useState('22')
  const [ritenuta, setRitenuta] = useState('0')
  const [condPag, setCondPag] = useState('')
  const [dataConsegna, setDataConsegna] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [cigCommessa, setCigCommessa] = useState<string>('')
  const [aziendaDoc, setAziendaDoc] = useState<any>({})
  const [odaPagina, setOdaPagina] = useState(0)
  const [odaHasMore, setOdaHasMore] = useState(false)
  const ODA_LIMIT = 50
  const [damId, setDamId] = useState('')
  const [richiedeSam, setRichiedeSam] = useState(false)
  const [wbsRef, setWbsRef] = useState('')
  const [revModal, setRevModal] = useState<{doc: any; motivo: string} | null>(null)
  const [odaStorico, setOdaStorico] = useState<Record<string, any[]>>({})
  const [storicoOpen, setStoricoOpen] = useState<Record<string,boolean>>({})
  const [wbsFlat, setWbsFlat] = useState(DEFAULT_WBS_FLAT)

  const importoNum = parseFloat(importoNetto) || 0
  const totale = importoNum * (1 + parseFloat(ivaPct) / 100)
  const ritenutaImporto = importoNum * parseFloat(ritenuta) / 100

  async function load(pagina = 0) {
    setLoading(true)
    const [{ data }, { data: forn }, { data: comm }] = await Promise.all([
      // oda.codice è il numero documento (es. ODA-2026-001) → esposto come `numero`.
      // oda.fornitore è una colonna di TESTO (nome): il join usa un alias diverso
      // per non collidere, poi viene rimappato su `fornitore` (oggetto) qui sotto.
      supabase.from('oda').select('*, numero:codice, fornitore_rel:professionisti_fornitori(id,ragione_sociale)')
        .eq('commessa_id', commessaId).order('created_at', { ascending: false })
        .range(pagina * ODA_LIMIT, (pagina + 1) * ODA_LIMIT - 1),
      supabase.from('professionisti_fornitori').select('id, ragione_sociale, nome, cognome').order('id', { ascending: true }),
      supabase.from('commesse').select('cig').eq('id', commessaId).maybeSingle(),
    ])
    if ((comm as any)?.cig) setCigCommessa((comm as any).cig)
    const lista = ((data || []) as any[]).map(o => ({
      ...o,
      fornitore_nome: o.fornitore,
      fornitore: o.fornitore_rel ?? (o.fornitore ? { id: o.fornitore_id, ragione_sociale: o.fornitore } : null),
    }))
    setOda(prev => pagina === 0 ? lista : [...prev, ...lista])
    setOdaHasMore(lista.length === ODA_LIMIT)
    setFornitori(forn || [])
    const azId = await getAziendaId()
    if (azId) {
      const { data: az } = await (supabase as any).from('azienda').select('logo_url,carta_intestata_header_url,carta_intestata_footer_url').eq('id', azId).single()
      setAziendaDoc((az as any) || {})
    }
    setLoading(false)
  }

  useEffect(() => { load(0) }, [commessaId])
  useEffect(() => {
    if (!commessaId) return
    getAziendaId().then(aziendaId => {
      if (aziendaId) loadWbs(supabase, commessaId, aziendaId).then(setWbsFlat)
    })
  }, [commessaId])
  useEffect(() => { setRitenuta(String(TIPI_ODA.find(x => x.value === tipo)?.ritenuta || 0)) }, [tipo])
  useEffect(() => {
    const rdo = searchParams.get('rdo_id')
    const imp = searchParams.get('importo')
    const forn = searchParams.get('fornitore')
    const fornId = searchParams.get('fornitore_id')
    const damIdParam = searchParams.get('dam_id')
    const richiedeSamParam = searchParams.get('richiede_sam')
    if (!rdo && !damIdParam) return
    if (rdo) setRdoId(rdo)
    if (imp) setImportoNetto(imp)
    if (damIdParam) setDamId(damIdParam)
    if (richiedeSamParam === '1') setRichiedeSam(true)
    if (fornId) {
      setFornitoreId(fornId)
    } else if (forn && fornitori.length > 0) {
      const match = fornitori.find((f: any) => f.ragione_sociale === forn)
      if (match) setFornitoreId(match.id)
    }
    setModalOpen(true)
  }, [searchParams, fornitori])

  async function handleSave() {
    if (!oggetto.trim() || importoNum <= 0 || !fornitoreId) { setErr('Compila tutti i campi obbligatori'); return }
    const damObbligatorio = rdoId && (richiedeSam || tipo === 'subappalto')
    if (damObbligatorio && !damId) {
      setErr('⛔ SAM non approvata. Torna alla RDO e completa l\'approvazione materiali prima di emettere l\'ODA.')
      return
    }
    setSaving(true)
    const aziendaId = await getAziendaId()
    const { count } = await supabase.from('oda').select('*', { count: 'exact', head: true }).eq('commessa_id', commessaId)
    const numero = `ODA-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
    // oda.fornitore (testo) è obbligatorio nel DB: nome del fornitore scelto
    const fSel: any = fornitori.find((f: any) => f.id === fornitoreId)
    const nomeFornitore = fSel ? (fSel.ragione_sociale || [fSel.nome, fSel.cognome].filter(Boolean).join(' ')) : ''
    const { data: odaData, error } = await supabase.from('oda').insert({
      commessa_id: commessaId, azienda_id: aziendaId || null,
      codice: numero, fornitore: nomeFornitore || '—',
      tipo, tipo_oda: tipo, oggetto: oggetto.trim(),
      fornitore_id: fornitoreId, importo_netto: importoNum, iva_pct: parseFloat(ivaPct),
      ritenuta_pct: parseFloat(ritenuta), condizioni_pagamento: condPag || null,
      data_consegna_prevista: dataConsegna || null, note: note || null, stato: 'EMESSO',
      rdo_id: rdoId || null, cig_riferimento: cigCommessa || null,
      dam_id: damId || null,
      richiede_sam: richiedeSam || false,
      is_subappalto: tipo === 'subappalto',
      wbs_ref: wbsRef || null,
    }).select().single()
    if (error) { setErr(error.message); setSaving(false); return }
    if (tipo === 'subappalto' && odaData) {
      const { data: cs } = await supabase.from('contratti_sub').insert({
        commessa_id: commessaId, azienda_id: aziendaId || null,
        fornitore_id: fornitoreId, importo_netto: importoNum,
        ritenuta_pct: parseFloat(ritenuta), stato: 'BOZZA'
      }).select().single()
      if (cs) await supabase.from('oda').update({ contratto_sub_id: cs.id }).eq('id', odaData.id)
    }
    const fornitoreNome = fornitori.find((f: any) => f.id === fornitoreId)?.ragione_sociale || ''
    const emailData = { numero: odaData?.codice || numero, oggetto: oggetto.trim(), fornitore: fornitoreNome, importo: importoNum }
    setSaving(false); setModalOpen(false)
    setOggetto(''); setFornitoreId(''); setImportoNetto(''); setNote('')
    await load()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return
      const { data: commessa } = await supabase.from('commesse').select('codice,nome').eq('id', commessaId).single()
      const { subject, html } = emailOdaCreato({
        codiceOda: emailData.numero,
        oggetto: emailData.oggetto,
        fornitore: emailData.fornitore,
        importo: fmt(emailData.importo),
        commessa: commessa ? `${commessa.codice} — ${commessa.nome}` : '',
      })
      fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: user.email, subject, html }) }).catch(() => {})
    })
  }

  async function downloadPdf(o: any) {
    setPdfLoading(o.id)
    try {
      const { data: commessa } = await supabase.from('commesse').select('codice,nome,committente,cig,cup').eq('id', commessaId).single()
      const [pdfrMod, docMod] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/OdaDocument'),
      ])
      const element = React.createElement(docMod.OdaDocument, {
        oda: o,
        commessa: { codice: (commessa as any)?.codice || '', nome: (commessa as any)?.nome || '', committente: (commessa as any)?.committente, cig: (commessa as any)?.cig || o.cig_riferimento || '', cup: (commessa as any)?.cup || '' },
        fornitore: o.fornitore,
        aziendaDoc,
      })
      const blob = await pdfrMod.pdf(element as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${o.numero || 'ODA'}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } finally { setPdfLoading(null) }
  }

  async function cambiaStato(id: string, stato: string) {
    await supabase.from('oda').update({ stato }).eq('id', id)
    await load()
  }

  async function cambiaConsegna(id: string, stato_consegna: string) {
    await supabase.from('oda').update({ stato_consegna }).eq('id', id)
    await load()
  }

  const odaVigente = oda.filter((o: any) => o.is_vigente !== false)
  const totImpegnato = odaVigente.filter((o: any) => o.stato !== 'ANNULLATO').reduce((s: number, o: any) => s + o.importo_netto, 0)
  const totRitenute = odaVigente.filter((o: any) => o.stato !== 'ANNULLATO').reduce((s: number, o: any) => s + (o.ritenuta_importo || 0), 0)

  const displayCodiceOda = (o: any) => o.revisione ? `${o.numero} REV.${o.revisione}` : o.numero
  const creaRevisioneOda = async (o: any, motivo: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    const aziendaId = await getAziendaId()
    const { count } = await supabase.from('oda').select('*', { count: 'exact', head: true }).eq('commessa_id', commessaId)
    const numero = `ODA-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
    const { error } = await (supabase as any).from('oda').insert({
      commessa_id: o.commessa_id, azienda_id: aziendaId || null,
      codice: numero, fornitore: o.fornitore_nome || o.fornitore?.ragione_sociale || '—',
      tipo: o.tipo, tipo_oda: o.tipo_oda || o.tipo,
      oggetto: o.oggetto, fornitore_id: o.fornitore_id,
      importo_netto: o.importo_netto, iva_pct: o.iva_pct,
      ritenuta_pct: o.ritenuta_pct, condizioni_pagamento: o.condizioni_pagamento,
      data_consegna_prevista: o.data_consegna_prevista, note: o.note,
      rdo_id: o.rdo_id, dam_id: o.dam_id, cig_riferimento: o.cig_riferimento,
      wbs_ref: o.wbs_ref, stato: 'EMESSO',
      revisione: (o.revisione || 0) + 1,
      doc_padre_id: o.id, is_vigente: true,
      motivo_rev: motivo || null,
      revised_by: user?.id || null,
      revised_at: new Date().toISOString(),
    })
    if (error) { alert('Errore revisione: ' + error.message); return }
    await (supabase as any).from('oda').update({ is_vigente: false }).eq('id', o.id)
    setRevModal(null); await load(0)
  }
  const loadStoricoOda = async (odaId: string, docPadreId?: string) => {
    if (!docPadreId) return
    const chain: any[] = []
    let currentId: string | undefined = docPadreId
    while (currentId) {
      const { data } = await (supabase as any).from('oda').select('*').eq('id', currentId).maybeSingle()
      if (!data) break
      chain.push(data)
      currentId = data.doc_padre_id
    }
    setOdaStorico(prev => ({...prev, [odaId]: chain}))
  }

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
    <div style={styleObj.page as React.CSSProperties} className="fade-in">

      {/* KPI bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
        {[
          ['ODA emessi',          String(odaVigente.filter((o: any) => o.stato !== 'ANNULLATO').length), 'ordini vigenti'],
          ['Costi impegnati',     '€ ' + fmt(totImpegnato),             'totale netto'],
          ['Ritenute accumulate', '€ ' + fmt(totRitenute),              'da svincolare'],
          ['Da pagare netto',     '€ ' + fmt(totImpegnato - totRitenute), 'importo residuo'],
        ].map(([l, v, sub]) => (
          <div key={l as string} style={{ ...styleObj.card, padding:'12px 16px' }}>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const }}>{l}</p>
            <p style={{ fontSize:20, fontWeight:800, color:'var(--t1)', marginTop:4 }}>{v}</p>
            <p style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Alert WBS */}
      {(() => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const senza = odaVigente.filter((o: any) => !o.wbs_ref && o.created_at < sevenDaysAgo && o.stato !== 'ANNULLATO')
        if (senza.length === 0) return null
        return (
          <div style={{ padding:'10px 16px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:10, fontSize:12, color:'#92400e', display:'flex', alignItems:'center', gap:8 }}>
            ⚠️ <b>{senza.length} ODA</b> senza WBS da più di 7 giorni — assegna per completare il tracking costi
          </div>
        )
      })()}

      {/* Lista */}
      <div style={styleObj.card as React.CSSProperties}>
        <div style={styleObj.hdr as React.CSSProperties}>
          <div>
            <span style={styleObj.hl as React.CSSProperties}>Ordini di Acquisto</span>
            <p style={{ fontSize:11, color:'var(--t3)', margin:'2px 0 0' }}>Subappalto → contratto sub automatico · SAM → usa flusso RDO per approvazione DL</p>
          </div>
          <button className="btn-primary" style={{ fontSize:12, padding:'8px 14px', whiteSpace:'nowrap' as const }}
            onClick={() => setModalOpen(true)}>
            + Nuovo ODA
          </button>
        </div>

        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
        ) : oda.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--t3)', fontSize:13 }}>Nessun ordine emesso</div>
        ) : (
          <div>
            {odaVigente.map((o: any) => {
              const td = TIPI_ODA.find(x => x.value === (o.tipo_oda || o.tipo))
              const statoColor = STATI[o.stato]?.color || '#6b7280'
              const consColor  = STATI_CONSEGNA[o.stato_consegna || 'in_attesa']?.color || '#6b7280'
              return (
                <div key={o.id} style={{ borderBottom:'1px solid var(--border)' }}>

                  {/* Riga collassata */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', cursor:'pointer', transition:'background .1s' }}
                    onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {expanded === o.id
                      ? <ChevronDown size={14} color="var(--t3)" style={{ flexShrink:0 }} />
                      : <ChevronRight size={14} color="var(--t3)" style={{ flexShrink:0 }} />}
                    <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--accent)', width:128, flexShrink:0 }}>
                      {displayCodiceOda(o)}
                    </span>
                    {td && (
                      <span style={{ flexShrink:0, fontSize:10, padding:'2px 8px', borderRadius:4, fontWeight:600, color:td.color, background:td.bg, border:`1px solid ${td.color}44` }}>
                        {td.label}
                      </span>
                    )}
                    <span style={{ flex:1, fontSize:12, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                      {o.oggetto}
                    </span>
                    <span style={{ fontSize:11, color:'var(--t3)', flexShrink:0, marginRight:4 }}>
                      {o.fornitore?.ragione_sociale || '—'}
                    </span>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--t1)', width:110, textAlign:'right' as const, flexShrink:0 }}>
                      € {fmt(o.importo_netto)}
                    </span>
                    <span style={styleObj.badge(consColor)}>
                      {STATI_CONSEGNA[o.stato_consegna || 'in_attesa']?.label}
                    </span>
                    <span style={styleObj.badge(statoColor)}>
                      {STATI[o.stato]?.label || o.stato}
                    </span>
                  </div>

                  {/* Pannello espanso */}
                  {expanded === o.id && (
                    <div style={{ borderTop:'1px solid var(--border)', background:'var(--bg)', padding:'14px 16px' }}>

                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
                        {[['Data', o.data_emissione], ['Consegna', o.data_consegna_prevista || '—'], ['Pagamento', o.condizioni_pagamento || '—']].map(([l, v]) => (
                          <div key={l as string}>
                            <p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase' as const, margin:'0 0 2px' }}>{l}</p>
                            <p style={{ fontSize:12, color:'var(--t1)', margin:0 }}>{v}</p>
                          </div>
                        ))}
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
                        <div>
                          <p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase' as const, margin:'0 0 2px' }}>Totale + IVA</p>
                          <p style={{ fontSize:12, color:'var(--t1)', margin:0 }}>€ {fmt(o.importo_netto * (1 + o.iva_pct / 100))}</p>
                        </div>
                        <div>
                          <p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase' as const, margin:'0 0 2px' }}>Ritenuta {o.ritenuta_pct}%</p>
                          <p style={{ fontSize:12, color:'#7c3aed', margin:0 }}>€ {fmt(o.ritenuta_importo || 0)}</p>
                        </div>
                        <div>
                          <p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase' as const, margin:'0 0 2px' }}>Da pagare</p>
                          <p style={{ fontSize:12, fontWeight:700, color:'var(--t1)', margin:0 }}>€ {fmt(o.importo_netto - (o.ritenuta_importo || 0))}</p>
                        </div>
                      </div>

                      {/* Badge contratto/SAM */}
                      {(o.contratto_sub_id || o.dam_id) && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const, marginBottom:10 }}>
                          {o.contratto_sub_id && <span style={styleObj.badge('#7c3aed')}>✓ Contratto sub generato</span>}
                          {o.dam_id           && <span style={styleObj.badge('#10b981')}>✓ SAM generato</span>}
                        </div>
                      )}

                      {/* Cambio stato consegna */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' as const, marginBottom:8 }}>
                        <span style={{ fontSize:11, color:'var(--t3)' }}>Consegna →</span>
                        {Object.entries(STATI_CONSEGNA).filter(([k]) => k !== (o.stato_consegna || 'in_attesa')).map(([k, v]) => (
                          <button key={k} onClick={() => cambiaConsegna(o.id, k)}
                            style={{ padding:'3px 10px', borderRadius:6, background:`${v.color}18`, color:v.color, border:`1px solid ${v.color}44`, cursor:'pointer', fontSize:10, fontWeight:600 }}>
                            {v.label}
                          </button>
                        ))}
                      </div>

                      {/* Cambio stato ODA */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' as const, marginBottom:8 }}>
                        <span style={{ fontSize:11, color:'var(--t3)' }}>Stato →</span>
                        {['CONFERMATO','PARZ_EVASO','EVASO'].filter(s => s !== o.stato).map(s => (
                          <button key={s} onClick={() => cambiaStato(o.id, s)}
                            style={{ padding:'3px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--t2)', cursor:'pointer', fontSize:10, fontWeight:600 }}>
                            {STATI[s]?.label}
                          </button>
                        ))}
                        <button onClick={() => {
                          if (!window.confirm(`Annullare l'ODA ${o.numero}? Operazione non reversibile.`)) return
                          cambiaStato(o.id, 'ANNULLATO')
                        }} style={{ padding:'3px 10px', borderRadius:6, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', cursor:'pointer', fontSize:10, fontWeight:600, marginLeft:'auto' }}>
                          Annulla
                        </button>
                        <button onClick={() => downloadPdf(o)} disabled={pdfLoading === o.id}
                          style={{ padding:'3px 10px', borderRadius:6, border:'1px solid #bfdbfe', background:'#eff6ff', color:'#2563eb', cursor:'pointer', fontSize:10, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                          {pdfLoading === o.id ? '⏳' : '🖨️'} PDF
                        </button>
                      </div>

                      <VociRdaSection rdoId={o.rdo_id} supabase={supabase} />

                      {o.wbs_ref && (
                        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--t3)', marginTop:8 }}>
                          <span style={{ fontWeight:600 }}>WBS:</span>
                          <span style={{ fontFamily:'monospace', background:'var(--panel)', border:'1px solid var(--border)', padding:'1px 8px', borderRadius:4 }}>{o.wbs_ref}</span>
                        </div>
                      )}

                      {/* Revisioni */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                        {o.stato !== 'ANNULLATO' && (
                          <button onClick={() => setRevModal({doc: o, motivo: ''})}
                            style={{ ...(styleObj as any).btn('#6d28d9'), padding:'3px 10px', fontSize:10 }}>
                            📝 Revisiona
                          </button>
                        )}
                        {o.doc_padre_id && (
                          <button onClick={() => {
                            const isOpen = !!storicoOpen[o.id]
                            setStoricoOpen(prev => ({...prev, [o.id]: !isOpen}))
                            if (!isOpen && !odaStorico[o.id]) loadStoricoOda(o.id, o.doc_padre_id)
                          }} style={{ ...(styleObj as any).btn('#6b7280'), padding:'3px 10px', fontSize:10 }}>
                            📜 Storico
                          </button>
                        )}
                      </div>

                      {storicoOpen[o.id] && odaStorico[o.id] && (
                        <div style={{ background:'#f5f3ff', borderRadius:8, padding:'10px 14px', marginTop:8 }}>
                          <p style={{ fontSize:10, fontWeight:700, color:'#6d28d9', textTransform:'uppercase' as const, letterSpacing:'.04em', margin:'0 0 8px' }}>Storico revisioni</p>
                          {odaStorico[o.id].map((h: any) => (
                            <div key={h.id} style={{ display:'flex', gap:10, alignItems:'center', padding:'5px 0', borderBottom:'1px solid #ede9fe', fontSize:11 }}>
                              <span style={{ fontFamily:'monospace', color:'#7c3aed', minWidth:140 }}>{displayCodiceOda(h)}</span>
                              <span style={styleObj.badge(STATI[h.stato]?.color || '#6b7280')}>{STATI[h.stato]?.label || h.stato}</span>
                              {h.motivo_rev && <span style={{ color:'var(--t3)', fontStyle:'italic' }}>"{h.motivo_rev}"</span>}
                              <span style={{ color:'var(--t4)', marginLeft:'auto', fontSize:10 }}>{h.revised_at ? new Date(h.revised_at).toLocaleDateString('it-IT') : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {odaHasMore && (
              <div style={{ textAlign:'center', padding:'12px', borderTop:'1px solid var(--border)' }}>
                <button disabled={loading}
                  onClick={() => { const p = odaPagina + 1; setOdaPagina(p); load(p) }}
                  style={{ padding:'7px 20px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--t2)', fontSize:12, cursor:'pointer' }}>
                  {loading ? 'Caricamento…' : 'Carica altri ODA'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal form Nuovo ODA */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget){ setModalOpen(false) } }}>
          <div className="modal-box" style={{ maxWidth:540, width:'90%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>Nuovo ODA</h3>
              <button onClick={() => setModalOpen(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Tipo ODA */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {TIPI_ODA.map(t => (
                  <button key={t.value} onClick={() => setTipo(t.value)}
                    style={{ padding:'8px 4px', borderRadius:8, border: tipo === t.value ? `2px solid ${t.color}` : '1px solid var(--border)', background: tipo === t.value ? t.bg : 'var(--panel)', color: tipo === t.value ? t.color : 'var(--t3)', fontSize:11, cursor:'pointer', fontWeight: tipo === t.value ? 700 : 400, textAlign:'center' as const }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {tipo === 'subappalto' && (
                <div style={{ padding:'8px 12px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:8, fontSize:11, color:'#92400e' }}>
                  → Genera contratto sub automatico (D.Lgs. 36/2023)
                </div>
              )}

              {damId && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#15803d' }}>✅ SAM approvata</span>
                  <span style={{ fontSize:11, color:'#16a34a', fontFamily:'monospace' }}>{damId.slice(0,8)}…</span>
                </div>
              )}

              {rdoId && richiedeSam && !damId && (
                <div style={{ padding:'8px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, fontSize:11, color:'#dc2626', fontWeight:600 }}>
                  ⛔ SAM obbligatoria — approva prima dalla RDO
                </div>
              )}

              <div>
                <label style={styleObj.lbl as React.CSSProperties}>Oggetto *</label>
                <input value={oggetto} onChange={e => setOggetto(e.target.value)}
                  style={styleObj.inp as React.CSSProperties} />
              </div>

              <div>
                <label style={styleObj.lbl as React.CSSProperties}>Fornitore *</label>
                <select value={fornitoreId} onChange={e => setFornitoreId(e.target.value)}
                  style={styleObj.inp as React.CSSProperties}>
                  <option value="">Seleziona...</option>
                  {fornitori.map((f: any) => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
                </select>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <div>
                  <label style={styleObj.lbl as React.CSSProperties}>Importo netto €</label>
                  <input type="number" step="0.01" value={importoNetto} onChange={e => setImportoNetto(e.target.value)}
                    style={{ ...(styleObj as any).inp, textAlign:'right' }} />
                </div>
                <div>
                  <label style={styleObj.lbl as React.CSSProperties}>IVA %</label>
                  <select value={ivaPct} onChange={e => setIvaPct(e.target.value)}
                    style={styleObj.inp as React.CSSProperties}>
                    <option value="22">22%</option>
                    <option value="10">10%</option>
                    <option value="4">4%</option>
                    <option value="0">0%</option>
                  </select>
                </div>
                <div>
                  <label style={styleObj.lbl as React.CSSProperties}>Ritenuta %</label>
                  <input type="number" value={ritenuta} onChange={e => setRitenuta(e.target.value)}
                    style={{ ...(styleObj as any).inp, textAlign:'right' }} />
                </div>
              </div>

              {/* Quadro importi */}
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t2)', marginBottom:4 }}>
                  <span>Totale + IVA</span>
                  <span style={{ fontWeight:600 }}>€ {fmt(totale)}</span>
                </div>
                {ritenutaImporto > 0 && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#7c3aed', marginBottom:4 }}>
                      <span>Ritenuta {ritenuta}%</span>
                      <span>- € {fmt(ritenutaImporto)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:'var(--t1)', borderTop:'1px solid var(--border)', paddingTop:6, marginTop:4 }}>
                      <span>Da pagare</span>
                      <span>€ {fmt(importoNum - ritenutaImporto)}</span>
                    </div>
                  </>
                )}
              </div>

              <div style={styleObj.row as React.CSSProperties}>
                <div>
                  <label style={styleObj.lbl as React.CSSProperties}>Condizioni pagamento</label>
                  <input value={condPag} onChange={e => setCondPag(e.target.value)} placeholder="30 gg. data fattura"
                    style={styleObj.inp as React.CSSProperties} />
                </div>
                <div>
                  <label style={styleObj.lbl as React.CSSProperties}>Consegna prevista</label>
                  <input type="date" value={dataConsegna} onChange={e => setDataConsegna(e.target.value)}
                    style={styleObj.inp as React.CSSProperties} />
                </div>
              </div>

              {cigCommessa && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8 }}>
                  <span style={{ fontSize:11, color:'var(--t3)' }}>CIG (L. 136/2010):</span>
                  <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, color:'var(--t1)', background:'var(--panel)', border:'1px solid var(--border)', padding:'1px 8px', borderRadius:4 }}>{cigCommessa}</span>
                  <span style={{ fontSize:10, color:'var(--t4)', fontStyle:'italic' }}>propagato automaticamente</span>
                </div>
              )}

              <div>
                <label style={styleObj.lbl as React.CSSProperties}>WBS / Area di riferimento</label>
                <select value={wbsRef} onChange={e => setWbsRef(e.target.value)}
                  style={styleObj.inp as React.CSSProperties}>
                  <option value="">— Nessuna WBS —</option>
                  {wbsFlat.map(([code, label]) => <option key={code} value={code}>{code} — {label}</option>)}
                </select>
              </div>

              <div>
                <label style={styleObj.lbl as React.CSSProperties}>Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  style={{ ...(styleObj as any).inp, resize:'vertical' as const, minHeight:60 }} />
              </div>

              {err && <p style={{ fontSize:11, color:'#ef4444', margin:0 }}>{err}</p>}

              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button style={(styleObj as any).btn('#6b7280')} onClick={() => setModalOpen(false)}>Annulla</button>
                <button style={(styleObj as any).btn('var(--accent)')} onClick={handleSave} disabled={saving}>
                  {saving ? '...' : 'Crea ODA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal revisione */}
      {revModal && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) setRevModal(null) }}>
          <div className="modal-box" style={{ maxWidth:420, width:'90%' }}>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>📝 Crea revisione ODA</h3>
            <p style={{ fontSize:12, color:'var(--t3)', marginBottom:14 }}>
              {displayCodiceOda(revModal.doc)} → <strong>REV.{(revModal.doc.revisione||0)+1}</strong>
            </p>
            <div>
              <label style={styleObj.lbl as React.CSSProperties}>Motivo revisione (opzionale)</label>
              <textarea value={revModal.motivo} onChange={e => setRevModal({...revModal, motivo:e.target.value})}
                rows={3} placeholder="es. Aggiornamento importo, cambio condizioni..."
                style={{ ...(styleObj as any).inp, resize:'vertical' as const, minHeight:70 }} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
              <button style={(styleObj as any).btn('#6b7280')} onClick={() => setRevModal(null)}>Annulla</button>
              <button style={(styleObj as any).btn('#6d28d9')} onClick={() => creaRevisioneOda(revModal.doc, revModal.motivo)}>
                Crea revisione →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
