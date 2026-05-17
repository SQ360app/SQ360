'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'
import SalInserimento from './SalInserimento'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number | undefined | null, d = 2) =>
  n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'
const fiq = (n: number) =>
  Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: 3 })
const pct = (a: number, b: number) => b > 0 ? Math.min(100, (a / b) * 100) : 0
const pctColor = (p: number) =>
  p === 0 ? 'var(--t4)' : p < 50 ? '#f59e0b' : p < 100 ? '#3b82f6' : '#10b981'

const STATI = ['bozza','emesso','approvato','fatturato','pagato']
const SC: Record<string,string> = {
  bozza:'#f59e0b', emesso:'#3b82f6', approvato:'#8b5cf6', fatturato:'#14b8a6', pagato:'#10b981'
}


interface SAL {
  id: string; commessa_id: string; azienda_id?: string
  numero: number; codice: string; data_emissione: string; metodo?: string
  importo_certificato: number; importo_cumulativo?: number
  ritenuta_garanzia: number; importo_netto: number; stato: string; note?: string
  pdf_dl_url?: string; pdf_certificato_url?: string
}
interface VoceComputo {
  id: string; codice: string; descrizione: string; um: string
  quantita: number; prezzo_unitario: number; importo: number; capitolo: string
  wbs_id?: string
  _isVariante?: boolean; _varianteNumero?: number
  _tipoModifica?: 'aggiunta' | 'modifica_quantita' | 'soppressione'
}
interface Commessa { id: string; nome: string; importo_contrattuale: number }
interface VoceAvanzamento {
  id: string; codice: string; descrizione: string; um: string; capitolo: string; wbs_id?: string
  quantita_contratto: number; prezzo_unitario: number
  qtPerSal: Record<string, number>
  certificato_cumulativo: number; percentuale: number; residuo: number
}

const S = {
  card: { background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' } as React.CSSProperties,
  hdr:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg)' } as React.CSSProperties,
  hl:   { fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase' as const, letterSpacing:'0.04em' },
  th:   { padding:'7px 10px', fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase' as const, background:'var(--bg)', borderBottom:'1px solid var(--border)', textAlign:'left' as const, whiteSpace:'nowrap' as const },
  td:   { padding:'8px 10px', fontSize:12, color:'var(--t2)', borderBottom:'1px solid var(--border)' },
  inp:  { width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, outline:'none', background:'var(--panel)', color:'var(--t1)' } as React.CSSProperties,
  lbl:  { fontSize:11, fontWeight:600, color:'var(--t2)', marginBottom:4, display:'block' } as React.CSSProperties,
  btn:  (c: string): React.CSSProperties => ({ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:c, color:'#fff' }),
}

export default function SALAttiviPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)

  const [salList, setSalList]   = useState<SAL[]>([])
  const [commessa, setCommessa] = useState<Partial<Commessa>>({})
  const [loading, setLoading]   = useState(true)
  const [fase, setFase]         = useState<'lista' | 'form' | 'voci' | 'xpwe'>('lista')
  const [formSal, setFormSal]   = useState({ dataEmissione: new Date().toISOString().slice(0,10), metodo: 'manuale' as 'manuale'|'xpwe', note: '' })
  const [salAttivo, setSalAttivo] = useState<SAL | null>(null)

  // Voci grid
  const [vociComputo, setVociComputo] = useState<VoceComputo[]>([])
  const [qtInput, setQtInput]         = useState<Record<string, string>>({})
  const [qtPrecedente, setQtPrecedente] = useState<Record<string, number>>({})
  const [vociLoading, setVociLoading] = useState(false)

  // XPWE import
  const [xpwePreview, setXpwePreview]   = useState<any[]>([])
  const [xpweLoading, setXpweLoading]   = useState(false)

  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState('')
  const [pdfDlFile, setPdfDlFile] = useState<File | null>(null)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  // Vista computo parallelo
  const [vociAvanzamento, setVociAvanzamento] = useState<VoceAvanzamento[]>([])
  const [avanzamentoLoading, setAvanzamentoLoading] = useState(false)
  const [avanzamentoOpen, setAvanzamentoOpen] = useState(true)

  const [qtPerSalPrec, setQtPerSalPrec] = useState<Record<string, Record<string, number>>>({})

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const caricaAvanzamento = async (salListData: SAL[]) => {
    setAvanzamentoLoading(true)
    const { data: computo } = await supabase.from('computo_metrico').select('id').eq('commessa_id', id).single()
    if (!computo) { setAvanzamentoLoading(false); return }
    const salIds = salListData.map(s => s.id)
    const [{ data: voci }, { data: svAll }] = await Promise.all([
      supabase.from('voci_computo')
        .select('id,codice,descrizione,um,quantita,prezzo_unitario,capitolo,wbs_id')
        .eq('computo_id', computo.id)
        .order('capitolo').order('codice'),
      salIds.length > 0
        ? supabase.from('sal_voci').select('voce_computo_id,quantita_periodo,sal_id').in('sal_id', salIds)
        : Promise.resolve({ data: [] as any[] })
    ])
    const qtMap: Record<string, Record<string, number>> = {}
    for (const sv of ((svAll as any[]) || [])) {
      if (!qtMap[sv.voce_computo_id]) qtMap[sv.voce_computo_id] = {}
      qtMap[sv.voce_computo_id][sv.sal_id] = (qtMap[sv.voce_computo_id][sv.sal_id] || 0) + (sv.quantita_periodo || 0)
    }
    setVociAvanzamento((voci || []).map((v: any): VoceAvanzamento => {
      const qtPerSal = qtMap[v.id] || {}
      const cumulativo = Object.values(qtPerSal).reduce((s, q) => s + (q as number), 0)
      return {
        id: v.id, codice: v.codice, descrizione: v.descrizione, um: v.um,
        capitolo: v.capitolo, wbs_id: v.wbs_id,
        quantita_contratto: v.quantita, prezzo_unitario: v.prezzo_unitario,
        qtPerSal,
        certificato_cumulativo: cumulativo,
        percentuale: v.quantita > 0 ? Math.min(100, (cumulativo / v.quantita) * 100) : 0,
        residuo: v.quantita - cumulativo,
      }
    }))
    setAvanzamentoLoading(false)
  }

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: sal }, { data: comm }] = await Promise.all([
      supabase.from('sal').select('*').eq('commessa_id', id).order('numero'),
      supabase.from('commesse').select('id,nome,importo_contrattuale').eq('id', id).single()
    ])
    const salListData = (sal as SAL[]) || []
    setSalList(salListData)
    if (comm) setCommessa(comm as Commessa)
    setLoading(false)
    caricaAvanzamento(salListData)
  }, [id])

  useEffect(() => { carica() }, [carica])

  const caricaVociGrid = async (salIdEsclude?: string, preloadSalId?: string) => {
    setVociLoading(true)
    const { data: computo } = await supabase.from('computo_metrico').select('id').eq('commessa_id', id).single()
    if (!computo) { setVociLoading(false); return }

    const salIds = salList.map(s => s.id).filter(sid => sid !== salIdEsclude)

    const [{ data: voci }, { data: salVociPrec }, { data: vociVarRaw }, preloadRes] = await Promise.all([
      supabase.from('voci_computo')
        .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,capitolo,wbs_id')
        .eq('computo_id', computo.id)
        .order('capitolo').order('codice'),
      salIds.length > 0
        ? supabase.from('sal_voci').select('voce_computo_id,quantita_periodo,sal_id').in('sal_id', salIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('voci_variante')
        .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,tipo_modifica,variante:varianti(numero,stato)')
        .eq('commessa_id', id),
      preloadSalId
        ? supabase.from('sal_voci').select('voce_computo_id,quantita_periodo').eq('sal_id', preloadSalId)
        : Promise.resolve({ data: [] })
    ])

    const qtPrec: Record<string, number> = {}
    const qtPerSal: Record<string, Record<string, number>> = {}
    for (const sv of (salVociPrec || [])) {
      qtPrec[sv.voce_computo_id] = (qtPrec[sv.voce_computo_id] || 0) + (sv.quantita_periodo || 0)
      if (!qtPerSal[sv.voce_computo_id]) qtPerSal[sv.voce_computo_id] = {}
      qtPerSal[sv.voce_computo_id][sv.sal_id] = (qtPerSal[sv.voce_computo_id][sv.sal_id] || 0) + (sv.quantita_periodo || 0)
    }
    setQtPerSalPrec(qtPerSal)

    const vociEsecutive: VoceComputo[] = ((vociVarRaw || []) as any[])
      .filter(v => (v.variante as any)?.stato === 'esecutiva')
      .map(v => ({
        id: v.id, codice: v.codice, descrizione: v.descrizione, um: v.um,
        quantita: v.quantita, prezzo_unitario: v.prezzo_unitario, importo: v.importo,
        capitolo: `Variante n.${(v.variante as any)?.numero ?? '?'}`,
        _isVariante: true,
        _varianteNumero: (v.variante as any)?.numero,
        _tipoModifica: v.tipo_modifica,
      }))

    const tutteVoci = [...(voci as VoceComputo[] || []), ...vociEsecutive]
    setVociComputo(tutteVoci)
    setQtPrecedente(qtPrec)

    const init: Record<string, string> = {}
    for (const v of tutteVoci) { init[v.id] = '' }
    if (preloadSalId) {
      for (const sv of ((preloadRes as any).data || [])) {
        if (sv.voce_computo_id in init) init[sv.voce_computo_id] = String(sv.quantita_periodo || '')
      }
    }
    setQtInput(init)
    setVociLoading(false)
  }

  const generaPdfSal = async (sal: SAL) => {
    setPdfLoading(sal.id)
    try {
      const [{ data: svList }, { data: comm }] = await Promise.all([
        supabase.from('sal_voci').select('voce_computo_id,quantita_periodo').eq('sal_id', sal.id),
        supabase.from('commesse').select('codice,nome,committente,importo_contrattuale').eq('id', id).single()
      ])
      const vcIds = (svList || []).map((sv: any) => sv.voce_computo_id).filter(Boolean)
      const { data: vcList } = vcIds.length > 0
        ? await supabase.from('voci_computo').select('id,codice,descrizione,um,prezzo_unitario').in('id', vcIds)
        : { data: [] as any[] }
      const vcMap = new Map((vcList || []).map((vc: any) => [vc.id, vc]))
      const voci = (svList || [])
        .filter((sv: any) => (sv.quantita_periodo || 0) > 0)
        .map((sv: any) => {
          const vc = vcMap.get(sv.voce_computo_id) as any
          const qt = sv.quantita_periodo || 0
          const pu = vc?.prezzo_unitario || 0
          return { codice: vc?.codice || '', descrizione: vc?.descrizione || '', um: vc?.um || '', quantita_periodo: qt, prezzo_unitario: pu, importo_periodo: qt * pu }
        })
      const { SalDocument } = await import('@/components/pdf/SalDocument')
      const { pdf } = await import('@react-pdf/renderer')
      const blob = await pdf(
        React.createElement(SalDocument, {
          sal,
          commessa: { codice: (comm as any)?.codice || '', nome: (comm as any)?.nome || '', committente: (comm as any)?.committente, importo_contratto: (comm as any)?.importo_contrattuale },
          voci,
        }) as any
      ).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch { showToast('Errore generazione PDF') }
    setPdfLoading(null)
  }

  const riaperturaBozza = async (sal: SAL) => {
    setSalAttivo(sal)
    setXpwePreview([])
    await caricaVociGrid(sal.id, sal.id)
    setFase('voci')
  }

  const caricaCertificato = async (sal: SAL) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.pdf'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const aziendaId = await getAziendaId()
      const path = `${aziendaId}/sal/${id}/SAL-${sal.numero}-certificato.pdf`
      const { data: up } = await supabase.storage.from('documenti').upload(path, file, { upsert: true })
      if (up) {
        const { data: pub } = supabase.storage.from('documenti').getPublicUrl(path)
        await supabase.from('sal').update({ pdf_certificato_url: pub.publicUrl }).eq('id', sal.id)
        showToast('✓ Certificato RUP caricato'); carica()
      } else {
        showToast('Errore upload certificato')
      }
    }
    input.click()
  }

  const avvia = async () => {
    setSaving(true)
    const numero = salList.length > 0 ? Math.max(...salList.map(s => s.numero)) + 1 : 1
    const aziendaId = await getAziendaId()
    const { data: nuovoSal, error } = await supabase.from('sal').insert({
      commessa_id: id, azienda_id: aziendaId,
      numero, codice: `SAL-A-${String(numero).padStart(3,'0')}`,
      data_emissione: formSal.dataEmissione, metodo: formSal.metodo,
      stato: 'bozza', note: formSal.note,
      importo_certificato: 0, importo_cumulativo: 0, ritenuta_garanzia: 0, importo_netto: 0,
    }).select().single()
    if (error || !nuovoSal) { setSaving(false); showToast('Errore creazione SAL'); return }
    if (pdfDlFile) {
      const path = `${aziendaId}/sal/${id}/SAL-${numero}-DL.pdf`
      const { data: up } = await supabase.storage.from('documenti').upload(path, pdfDlFile, { upsert: true })
      if (up) {
        const { data: pub } = supabase.storage.from('documenti').getPublicUrl(path)
        await supabase.from('sal').update({ pdf_dl_url: pub.publicUrl }).eq('id', nuovoSal.id)
      }
      setPdfDlFile(null)
    }
    setSalAttivo(nuovoSal as SAL)
    setSaving(false)
    if (formSal.metodo === 'manuale') {
      await caricaVociGrid(nuovoSal.id)
      setFase('voci')
    } else {
      setFase('xpwe')
    }
  }

  const salvaVoci = async () => {
    if (!salAttivo) return
    setSaving(true)
    await supabase.from('sal_voci').delete().eq('sal_id', salAttivo.id)
    const vociDaSalvare = vociComputo
      .filter(v => parseFloat(qtInput[v.id] || '0') > 0 && v._tipoModifica !== 'soppressione')
      .map(v => {
        const qt = parseFloat(qtInput[v.id] || '0')
        return { sal_id: salAttivo.id, voce_computo_id: v.id, quantita_periodo: qt, wbs_id: v.wbs_id ?? null }
      })
    if (vociDaSalvare.length > 0) await supabase.from('sal_voci').insert(vociDaSalvare)
    const certPeriodo = importoPeriodo
    const cumulPrec   = salList.filter(s => s.id !== salAttivo.id).reduce((s, s2) => s + (s2.importo_certificato || 0), 0)
    const ritenuta    = parseFloat((certPeriodo * 0.05).toFixed(2))
    const netto       = parseFloat((certPeriodo - ritenuta).toFixed(2))
    await supabase.from('sal').update({
      importo_certificato: parseFloat(certPeriodo.toFixed(2)),
      importo_cumulativo:  parseFloat((cumulPrec + certPeriodo).toFixed(2)),
      ritenuta_garanzia: ritenuta, importo_netto: netto,
    }).eq('id', salAttivo.id)
    setSaving(false)
    showToast(`✓ ${salAttivo.codice} salvato — ${vociDaSalvare.length} voci`)
    await carica(); setFase('lista')
  }

  const importaXpwe = async (file: File) => {
    if (!salAttivo) return
    setXpweLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('sal_id', salAttivo.id); fd.append('commessa_id', id)
      const res  = await fetch('/api/xpwe-parse-sal', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok) setXpwePreview(data.matched || [])
      else showToast('Errore: ' + data.error)
    } catch { showToast('Errore rete') }
    setXpweLoading(false)
  }

  const confermaXpwe = async () => {
    if (!salAttivo) return
    setSaving(true)
    const vociDaSalvare = xpwePreview.filter(v => v.voce_computo_id).map(v => ({
      sal_id: salAttivo.id, voce_computo_id: v.voce_computo_id,
      quantita_periodo: v.quantita_xpwe || 0,
    }))
    if (vociDaSalvare.length > 0) await supabase.from('sal_voci').insert(vociDaSalvare)
    const certPeriodo = xpweTotale
    const cumulPrec   = salList.filter(s => s.id !== salAttivo.id).reduce((s, s2) => s + (s2.importo_certificato || 0), 0)
    const ritenuta    = parseFloat((certPeriodo * 0.05).toFixed(2))
    await supabase.from('sal').update({
      importo_certificato: parseFloat(certPeriodo.toFixed(2)),
      importo_cumulativo:  parseFloat((cumulPrec + certPeriodo).toFixed(2)),
      ritenuta_garanzia: ritenuta, importo_netto: parseFloat((certPeriodo - ritenuta).toFixed(2)),
    }).eq('id', salAttivo.id)
    setSaving(false)
    showToast(`✓ ${vociDaSalvare.length} voci XPWE importate`)
    await carica(); setFase('lista')
  }

  const annullaEliminaSal = async () => {
    if (!salAttivo) { setFase('lista'); return }
    if (!window.confirm('Annullare il SAL? Il record verrà eliminato.')) return
    await supabase.from('sal_voci').delete().eq('sal_id', salAttivo.id)
    await supabase.from('sal').delete().eq('id', salAttivo.id)
    setSalAttivo(null); setFase('lista'); await carica()
  }

  const cambiaStato = async (sal: SAL, stato: string) => {
    await supabase.from('sal').update({ stato }).eq('id', sal.id)
    showToast(`${sal.codice} → ${stato}`); carica()
  }

  const handleUploadPdf = async (file: File) => {
    if (!salAttivo) return
    const aziendaId = await getAziendaId()
    const path = `${aziendaId}/sal/${id}/SAL-${salAttivo.numero}-DL.pdf`
    const { data: up } = await supabase.storage.from('documenti').upload(path, file, { upsert: true })
    if (up) {
      const { data: pub } = supabase.storage.from('documenti').getPublicUrl(path)
      await supabase.from('sal').update({ pdf_dl_url: pub.publicUrl }).eq('id', salAttivo.id)
      setSalAttivo(prev => prev ? { ...prev, pdf_dl_url: pub.publicUrl } : prev)
      showToast('✓ PDF DL caricato')
    } else { showToast('Errore upload PDF') }
  }

  // KPI
  const contratto   = commessa.importo_contrattuale || 0
  const certTotale  = salList.reduce((s, x) => s + (x.importo_certificato || 0), 0)
  const pagato      = salList.filter(s => s.stato === 'pagato').reduce((s, x) => s + (x.importo_netto || 0), 0)
  const avanzPct    = pct(certTotale, contratto)

  // Quadro economico voci (live)
  const importoPeriodo  = vociComputo.reduce((s, v) => s + (parseFloat(qtInput[v.id] || '0') || 0) * v.prezzo_unitario, 0)
  const cumulPrec       = salList.filter(s => !salAttivo || s.id !== salAttivo.id).reduce((s, s2) => s + (s2.importo_certificato || 0), 0)
  const ritenuta5       = parseFloat((importoPeriodo * 0.05).toFixed(2))
  const nettoSal        = parseFloat((importoPeriodo - ritenuta5).toFixed(2))

  // XPWE totale
  const xpweTotale = xpwePreview.filter(v => v.voce_computo_id).reduce((s,v) => s + (v.quantita_xpwe||0)*(v.prezzo_unitario||0), 0)

  return (
    <div style={{ minHeight:'100%', background:'var(--bg)', padding:16, display:'flex', flexDirection:'column', gap:12 }} className="fade-in">

      {/* ── KPI ── */}
      <div style={S.card}>
        <div style={S.hdr}>
          <span style={S.hl}>SAL Attivi — verso committente</span>
          {fase === 'lista' ? (
            <button className="btn-primary" style={{ fontSize:12, padding:'8px 14px' }}
              onClick={() => { setFormSal({ dataEmissione: new Date().toISOString().slice(0,10), metodo:'manuale', note:'' }); setSalAttivo(null); setXpwePreview([]); setFase('form') }}>
              + Nuovo SAL
            </button>
          ) : (
            <button style={S.btn('#6b7280')} onClick={annullaEliminaSal}>← Torna alla lista</button>
          )}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}>
          {[
            { l:'Importo contratto',     v:`€ ${fi(contratto)}`,              prog:100,        color:'var(--accent)' },
            { l:'Certificato cumulato',  v:`€ ${fi(certTotale)}`,             prog:avanzPct,   color:'var(--accent)', sub:`${avanzPct.toFixed(1)}%` },
            { l:'Netto liquidato',       v:`€ ${fi(pagato)}`,                 color:'#10b981', sub:'SAL in stato "pagato"' },
            { l:'Residuo da certificare',v:`€ ${fi(contratto - certTotale)}`, color:'#f59e0b', sub:`${(100-avanzPct).toFixed(1)}%` },
          ].map((k, i) => (
            <div key={i} style={{ padding:'14px 16px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <p style={{ fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>{k.l}</p>
              <p style={{ fontSize:18, fontWeight:700, color:k.color, fontVariantNumeric:'tabular-nums' }}>{k.v}</p>
              {k.prog !== undefined && <div style={{ height:4, borderRadius:2, background:'var(--border)', overflow:'hidden', marginTop:6 }}><div style={{ height:'100%', background:k.color, width:`${Math.min(k.prog,100)}%`, borderRadius:2 }} /></div>}
              {k.sub && <p style={{ fontSize:10, color:'var(--t3)', marginTop:4 }}>{k.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── AVANZAMENTO COMPUTO PARALLELO ── */}
      {fase === 'lista' && (
        <div style={S.card}>
          <div style={{ ...S.hdr, cursor:'pointer', userSelect:'none' }} onClick={() => setAvanzamentoOpen(o => !o)}>
            <span style={S.hl}>📊 Avanzamento voci — computo parallelo</span>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {vociAvanzamento.length > 0 && !avanzamentoLoading && (
                <span style={{ fontSize:11, color:'var(--t3)' }}>{vociAvanzamento.length} voci · {salList.length} SAL</span>
              )}
              <span style={{ fontSize:14, color:'var(--t3)', transition:'transform 0.2s', display:'inline-block', transform: avanzamentoOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
            </div>
          </div>
          {avanzamentoOpen && (
            avanzamentoLoading ? (
              <div style={{ padding:32, textAlign:'center' }}><span className="spinner" /></div>
            ) : vociAvanzamento.length === 0 ? (
              <div style={{ padding:28, textAlign:'center', color:'var(--t3)', fontSize:12 }}>
                Nessun computo importato — importa un file XPWE dalla sezione Computo per vedere l'avanzamento.
              </div>
            ) : (
              <div style={{ overflowX:'auto', maxHeight:440, overflowY:'auto' }}>
                <table style={{ borderCollapse:'collapse', whiteSpace:'nowrap' as const, width:'100%' }}>
                  <thead>
                    <tr>
                      {(['Tariffa','Descrizione','UM','Qt.Contratto','Cert.Cumul.','%','Residuo',
                        ...salList.map(s => `N.${s.numero}`)
                      ]).map((h, i) => (
                        <th key={i} style={{
                          ...S.th, position:'sticky' as const, top:0, zIndex:5,
                          width: i === 0 ? 80 : i === 1 ? 200 : i === 2 ? 34 : i >= 7 ? 56 : 78,
                          background: i >= 7 ? '#0d1525' : 'var(--bg)',
                          color: i >= 7 ? (SC[salList[i-7]?.stato] || 'var(--t3)') : 'var(--t3)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows: React.ReactNode[] = []
                      let lastCap = ''
                      for (const v of vociAvanzamento) {
                        if (v.capitolo !== lastCap) {
                          rows.push(
                            <tr key={`cap_${v.capitolo}`}>
                              <td colSpan={7 + salList.length} style={{ padding:'5px 10px', background:'#166534', color:'#d1fae5', fontWeight:700, fontSize:10, letterSpacing:'0.04em', textTransform:'uppercase' as const }}>
                                ▸ {v.capitolo}
                              </td>
                            </tr>
                          )
                          lastCap = v.capitolo
                        }
                        const pc   = v.percentuale
                        const pcC  = pctColor(pc)
                        const res  = v.residuo
                        rows.push(
                          <tr key={v.id}
                            style={{ background: pc >= 100 ? 'rgba(16,185,129,0.04)' : 'transparent' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                            onMouseLeave={e => (e.currentTarget.style.background = pc >= 100 ? 'rgba(16,185,129,0.04)' : 'transparent')}>

                            {/* Tariffa */}
                            <td style={{ ...S.td, fontFamily:'monospace', fontSize:10, color:'var(--accent)', width:80 }}>
                              {v.codice?.slice(0,12)}
                            </td>

                            {/* Descrizione */}
                            <td style={{ ...S.td, fontSize:10, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }} title={v.descrizione}>
                              {v.descrizione}
                            </td>

                            {/* UM */}
                            <td style={{ ...S.td, fontSize:10, textAlign:'center' as const, width:34 }}>{v.um}</td>

                            {/* Qt.Contratto */}
                            <td style={{ ...S.td, textAlign:'right' as const, fontSize:10, fontVariantNumeric:'tabular-nums', width:78 }}>
                              {fiq(v.quantita_contratto)}
                            </td>

                            {/* Certificato cumulativo */}
                            <td style={{ ...S.td, textAlign:'right' as const, fontSize:10, fontVariantNumeric:'tabular-nums', fontWeight: v.certificato_cumulativo > 0 ? 700 : 400, color: v.certificato_cumulativo > 0 ? pcC : 'var(--t4)', width:78 }}>
                              {v.certificato_cumulativo > 0 ? fiq(v.certificato_cumulativo) : '—'}
                            </td>

                            {/* % con barra */}
                            <td style={{ ...S.td, width:78, padding:'6px 8px' }}>
                              {pc > 0 ? (
                                <div>
                                  <div style={{ height:3, borderRadius:2, background:'var(--border)', overflow:'hidden', marginBottom:2 }}>
                                    <div style={{ height:'100%', background:pcC, width:`${pc}%`, borderRadius:2, transition:'width 0.3s' }} />
                                  </div>
                                  <span style={{ fontSize:10, color:pcC, fontWeight:700 }}>{pc.toFixed(0)}%</span>
                                </div>
                              ) : <span style={{ fontSize:10, color:'var(--t4)' }}>—</span>}
                            </td>

                            {/* Residuo */}
                            <td style={{ ...S.td, textAlign:'right' as const, fontSize:10, fontVariantNumeric:'tabular-nums', width:78, color: res < 0 ? '#ef4444' : res === 0 ? 'var(--t3)' : 'var(--t2)', fontWeight: res < 0 ? 700 : 400 }}>
                              {res === 0 ? <span style={{ color:'#10b981' }}>✓</span> : fiq(res)}
                            </td>

                            {/* Colonne SAL dinamiche */}
                            {salList.map(sal => {
                              const qtSal = v.qtPerSal[sal.id] || 0
                              return (
                                <td key={sal.id} style={{ ...S.td, textAlign:'right' as const, fontSize:9, fontVariantNumeric:'tabular-nums', width:56, color: qtSal > 0 ? (SC[sal.stato] || 'var(--t2)') : 'var(--t4)' }}>
                                  {qtSal > 0 ? fiq(qtSal) : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      }
                      return rows
                    })()}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* ── STEP 1: FORM ── */}
      {fase === 'form' && (
        <div style={S.card}>
          <div style={S.hdr}><span style={S.hl}>Nuovo SAL — Dati base</span></div>
          <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={S.lbl}>Data emissione SAL</label>
                <input type="date" style={S.inp} value={formSal.dataEmissione} onChange={e => setFormSal(p => ({...p, dataEmissione:e.target.value}))} />
              </div>
              <div>
                <label style={S.lbl}>N. SAL (automatico)</label>
                <input style={{...S.inp, background:'var(--bg)', color:'var(--t3)', cursor:'default'}} readOnly
                  value={`SAL n. ${salList.length > 0 ? Math.max(...salList.map(s=>s.numero))+1 : 1}`} />
              </div>
            </div>
            <div>
              <label style={S.lbl}>Metodo inserimento voci</label>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                {(['manuale','xpwe'] as const).map(m => (
                  <label key={m} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'12px 16px', borderRadius:8, flex:1, fontSize:13, fontWeight:600, border:`2px solid ${formSal.metodo===m ? 'var(--accent)' : 'var(--border)'}`, background: formSal.metodo===m ? 'rgba(79,142,247,0.06)' : 'var(--panel)', color: formSal.metodo===m ? 'var(--accent)' : 'var(--t2)' }}>
                    <input type="radio" value={m} checked={formSal.metodo===m} onChange={() => setFormSal(p=>({...p,metodo:m}))} style={{ accentColor:'var(--accent)' }} />
                    {m === 'manuale' ? '✏ Manuale per voce' : '📥 Import XPWE da DL'}
                  </label>
                ))}
              </div>
              <p style={{ fontSize:11, color:'var(--t3)', marginTop:6 }}>
                {formSal.metodo === 'manuale'
                  ? 'Inserisci manualmente le quantità per ogni voce del computo contrattuale.'
                  : 'Carica il file XPWE fornito dalla DL. Le voci vengono abbinate automaticamente al computo di contratto.'}
              </p>
            </div>
            <div>
              <label style={S.lbl}>Note</label>
              <input style={S.inp} value={formSal.note} placeholder="Descrizione del periodo, annotazioni..." onChange={e => setFormSal(p=>({...p,note:e.target.value}))} />
            </div>
            <div>
              <label style={S.lbl}>PDF SAL dalla DL (opzionale)</label>
              <input type="file" accept=".pdf" style={{...S.inp, cursor:'pointer'}}
                onChange={e => setPdfDlFile(e.target.files?.[0] || null)} />
              {pdfDlFile && <p style={{ fontSize:11, color:'var(--accent)', marginTop:4 }}>📄 {pdfDlFile.name}</p>}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:8 }}>
              <button style={S.btn('#6b7280')} onClick={() => setFase('lista')}>Annulla</button>
              <button style={S.btn('var(--accent)')} onClick={avvia} disabled={saving}>{saving ? '...' : 'Avanti →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2a: VOCI MANUALE ── */}
      {fase === 'voci' && salAttivo && vociLoading && (
        <div style={S.card}><div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div></div>
      )}
      {fase === 'voci' && salAttivo && !vociLoading && (
        <SalInserimento
          voci={vociComputo}
          salNumero={salAttivo.numero}
          salPrecedenti={salList.filter(s => s.id !== salAttivo.id).map(s => ({ id: s.id, numero: s.numero, stato: s.stato, data_emissione: s.data_emissione }))}
          qtPerSal={qtPerSalPrec}
          qtCumulative={qtPrecedente}
          qtInput={qtInput}
          onQtChange={(vid, val) => setQtInput(prev => ({ ...prev, [vid]: val }))}
          onSalva={salvaVoci}
          onAnnulla={annullaEliminaSal}
          onUploadPdf={handleUploadPdf}
          pdfDlUrl={salAttivo.pdf_dl_url}
          saving={saving}
        />
      )}

      {/* ── STEP 2b: XPWE ── */}
      {fase === 'xpwe' && salAttivo && (
        <div style={S.card}>
          <div style={S.hdr}><span style={S.hl}>{salAttivo.codice} — Import XPWE dalla DL</span></div>
          <div style={{ padding:20 }}>
            {xpwePreview.length === 0 ? (
              <div style={{ border:'2px dashed var(--border)', borderRadius:10, padding:'40px', textAlign:'center' }}>
                <input type="file" accept=".xpwe,.pwe,.xml" id="xpwe-sal-inp" style={{ display:'none' }}
                  onChange={e => { const f=e.target.files?.[0]; if(f) importaXpwe(f) }} />
                <label htmlFor="xpwe-sal-inp" style={{ cursor:'pointer', fontSize:13, color:'var(--accent)', fontWeight:600, display:'block' }}>
                  {xpweLoading ? '⏳ Analisi XPWE in corso...' : '📂 Seleziona file XPWE fornito dalla DL'}
                </label>
                <p style={{ fontSize:11, color:'var(--t3)', marginTop:8 }}>Formati accettati: .xpwe, .pwe, .xml (PriMus ACCA)</p>
                <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Le voci vengono abbinate per codice tariffa al computo di contratto.</p>
              </div>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, padding:'10px 14px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <span style={{ fontSize:12 }}>
                    <b style={{ color:'#10b981' }}>{xpwePreview.filter(v=>v.voce_computo_id).length}</b> abbinate ·
                    <b style={{ color:'#ef4444', marginLeft:4 }}>{xpwePreview.filter(v=>!v.voce_computo_id).length}</b> non trovate ·
                    totale <b>{xpwePreview.length}</b> voci XPWE
                  </span>
                  <span style={{ marginLeft:'auto', fontWeight:700, color:'var(--accent)' }}>€ {fi(xpweTotale)}</span>
                </div>
                <div style={{ overflowX:'auto', maxHeight:380, overflowY:'auto', borderRadius:8, border:'1px solid var(--border)', marginBottom:16 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>{['Codice','Descrizione','UM','Qtà XPWE','P.U.','Importo','Match'].map(h=><th key={h} style={{...S.th, position:'sticky' as const, top:0, zIndex:5}}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {xpwePreview.map((v,i) => (
                        <tr key={i} style={{ background: !v.voce_computo_id ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                          <td style={{...S.td, fontFamily:'monospace', fontSize:10}}>{v.codice}</td>
                          <td style={{...S.td, fontSize:10, maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const}} title={v.descrizione}>{v.descrizione}</td>
                          <td style={{...S.td, fontSize:10, textAlign:'center' as const}}>{v.um}</td>
                          <td style={{...S.td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums', fontSize:11, fontWeight:600}}>{v.quantita_xpwe?.toLocaleString('it-IT',{maximumFractionDigits:3})}</td>
                          <td style={{...S.td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums', fontSize:10}}>{fi(v.prezzo_unitario)}</td>
                          <td style={{...S.td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums', fontSize:11, fontWeight:700, color:'var(--accent)'}}>{fi((v.quantita_xpwe||0)*(v.prezzo_unitario||0))}</td>
                          <td style={{...S.td, textAlign:'center' as const}}>
                            {v.voce_computo_id
                              ? <span style={{ fontSize:10, color:'#10b981', fontWeight:700 }}>✓ abbinata</span>
                              : <span style={{ fontSize:10, color:'#ef4444' }}>✗ non trovata</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button style={S.btn('#6b7280')} onClick={() => setXpwePreview([])}>← Ricarica</button>
                  <button style={S.btn('var(--accent)')} onClick={confermaXpwe} disabled={saving || !xpwePreview.some(v=>v.voce_computo_id)}>
                    {saving ? '...' : `✓ Conferma (${xpwePreview.filter(v=>v.voce_computo_id).length} voci)`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── LISTA SAL ── */}
      {fase === 'lista' && (
        <div style={S.card}>
          <div style={S.hdr}><span style={S.hl}>{salList.length} SAL emessi</span></div>
          {loading ? (
            <div style={{ padding:40, textAlign:'center' }}><span className="spinner" /></div>
          ) : salList.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--t3)' }}>
              <p style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Nessun SAL emesso</p>
              <p style={{ fontSize:12 }}>Crea il primo SAL con il pulsante "+ Nuovo SAL"</p>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['N°','Codice','Data','Metodo','Certificato','Cumulativo','Netto','Ritenuta','Stato',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {salList.map(sal => (
                  <tr key={sal.id}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{...S.td, fontWeight:800, textAlign:'center' as const, fontSize:14, color:'var(--t1)'}}>{sal.numero}</td>
                    <td style={{...S.td, fontFamily:'monospace', fontSize:11, color:'var(--accent)'}}>{sal.codice}</td>
                    <td style={{...S.td, fontSize:11}}>{sal.data_emissione || '—'}</td>
                    <td style={{...S.td, fontSize:10}}><span style={{ padding:'1px 6px', borderRadius:4, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--t3)' }}>{sal.metodo || 'manuale'}</span></td>
                    <td style={{...S.td, textAlign:'right' as const, fontWeight:700, fontVariantNumeric:'tabular-nums', color:'var(--accent)'}}>€ {fi(sal.importo_certificato)}</td>
                    <td style={{...S.td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums', color:'var(--t3)'}}>€ {fi(sal.importo_cumulativo)}</td>
                    <td style={{...S.td, textAlign:'right' as const, fontWeight:700, fontVariantNumeric:'tabular-nums', color:'#10b981'}}>€ {fi(sal.importo_netto)}</td>
                    <td style={{...S.td, textAlign:'right' as const, fontVariantNumeric:'tabular-nums', color:'#ef4444', fontSize:11}}>(€ {fi(sal.ritenuta_garanzia)})</td>
                    <td style={S.td}>
                      <select value={sal.stato} onChange={e=>cambiaStato(sal,e.target.value)}
                        style={{ padding:'3px 6px', borderRadius:6, border:`1px solid ${SC[sal.stato]||'#ccc'}44`, background:(SC[sal.stato]||'#ccc')+'22', color:SC[sal.stato]||'#666', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        {STATI.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={S.td}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const, alignItems:'center' }}>
                        {sal.stato === 'bozza' && (
                          <button style={{...S.btn('#f59e0b'), fontSize:11, padding:'4px 10px'}} onClick={() => riaperturaBozza(sal)}>✏️ Modifica</button>
                        )}
                        <button style={{...S.btn('#1e3a5f'), fontSize:11, padding:'4px 10px'}}
                          onClick={() => generaPdfSal(sal)} disabled={pdfLoading === sal.id}>
                          {pdfLoading === sal.id ? '...' : '📄 PDF'}
                        </button>
                        <button style={{...S.btn('#0d9488'), fontSize:11, padding:'4px 10px'}} onClick={() => {
                          const base = window.location.pathname.replace('/sal-attivi','/fatturazione')
                          window.location.href = base + '?' + new URLSearchParams({ importo: String((sal.importo_netto||0).toFixed(2)), note: sal.codice })
                        }}>📄 Fattura</button>
                        {sal.pdf_dl_url && (
                          <a href={sal.pdf_dl_url} target="_blank" rel="noreferrer"
                            style={{ fontSize:11, color:'var(--accent)', padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', textDecoration:'none' }}>
                            📄 PDF DL
                          </a>
                        )}
                        {sal.stato === 'emesso' && !sal.pdf_certificato_url && (
                          <button style={{...S.btn('#8b5cf6'), fontSize:11, padding:'4px 10px'}} onClick={() => caricaCertificato(sal)}>📎 Cert.</button>
                        )}
                        {sal.pdf_certificato_url && (
                          <a href={sal.pdf_certificato_url} target="_blank" rel="noreferrer"
                            style={{ fontSize:11, color:'#14b8a6', padding:'4px 8px', borderRadius:6, border:'1px solid #14b8a644', textDecoration:'none' }}>
                            📋 Cert. RUP
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
