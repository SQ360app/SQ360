'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'
import { FileText, AlertTriangle, CheckCircle2, Clock, Loader2, ChevronDown, ChevronRight, Shield, Plus, Upload } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('it-IT') : '—'
const daysDiff = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)

const TIPI_CONTRATTO = [
  { value: 'subappalto',     label: 'Subappalto' },
  { value: 'subaffidamento', label: 'Subaffidamento' },
  { value: 'nolo_caldo',     label: 'Nolo a caldo' },
]

const STATI_WORKFLOW = [
  { value: 'bozza',                 label: 'Bozza',           color: '#6b7280', bg: '#f3f4f6', icon: '📝' },
  { value: 'attesa_autorizzazione', label: 'Attesa SA',        color: '#d97706', bg: '#fffbeb', icon: '⏳' },
  { value: 'autorizzato',           label: 'Autorizzato SA',   color: '#3b82f6', bg: '#eff6ff', icon: '✅' },
  { value: 'in_esecuzione',         label: 'In esecuzione',    color: '#059669', bg: '#f0fdf4', icon: '🔨' },
  { value: 'completato',            label: 'Completato',       color: '#7c3aed', bg: '#f5f3ff', icon: '🏁' },
  { value: 'sospeso',               label: 'Sospeso',          color: '#dc2626', bg: '#fef2f2', icon: '⏸' },
]
const STATI_ALIAS: Record<string, string> = {
  'BOZZA': 'bozza', 'IN_FIRMA': 'attesa_autorizzazione', 'ATTIVO': 'in_esecuzione',
  'SOSPESO': 'sospeso', 'CONCLUSO': 'completato', 'RESCISSO': 'sospeso',
}
const getStato = (raw: string) => {
  const n = STATI_ALIAS[raw] || raw
  return STATI_WORKFLOW.find(s => s.value === n) || { value: raw, label: raw, color: '#6b7280', bg: '#f3f4f6', icon: '?' }
}
function getNextSteps(stato: string): { value: string; label: string; color: string }[] {
  switch (STATI_ALIAS[stato] || stato) {
    case 'bozza':                 return [{ value: 'attesa_autorizzazione', label: 'Invia a SA',     color: '#d97706' }]
    case 'attesa_autorizzazione': return [{ value: 'autorizzato',           label: 'Autorizzato SA', color: '#3b82f6' }]
    case 'autorizzato':           return [{ value: 'in_esecuzione',         label: 'Avvia lavori',   color: '#059669' }]
    case 'in_esecuzione':         return [{ value: 'completato',            label: 'Completa',       color: '#7c3aed' }]
    default:                      return []
  }
}

const DOCUMENTI_DEF = [
  { tipo: 'contratto_firmato', label: 'Contratto firmato',        critico: true,  hasScadenza: false, hasExtra: false, isIban: false },
  { tipo: 'durc',              label: 'DURC subappaltatore',      critico: true,  hasScadenza: true,  hasExtra: false, isIban: false },
  { tipo: 'soa',               label: 'SOA adeguata',             critico: true,  hasScadenza: false, hasExtra: true,  isIban: false },
  { tipo: 'dvr',               label: 'DVR subappaltatore',       critico: true,  hasScadenza: false, hasExtra: false, isIban: false },
  { tipo: 'pos',               label: 'POS cantiere specifico',   critico: true,  hasScadenza: false, hasExtra: false, isIban: false },
  { tipo: 'notifica_sa',       label: 'Notifica preliminare SA',  critico: false, hasScadenza: false, hasExtra: false, isIban: false },
  { tipo: 'conto_corrente',    label: 'Conto corrente L.136/2010',critico: true,  hasScadenza: false, hasExtra: false, isIban: true  },
]

interface ContrattoSub {
  id: string; commessa_id: string; fornitore_id?: string
  fornitore?: { ragione_sociale: string; piva?: string }
  tipo?: string; oggetto?: string; importo_netto: number; ritenuta_pct: number
  data_stipula?: string; data_inizio?: string; data_fine_prevista?: string; durc_scadenza?: string
  stato: string; percentuale_subappalto?: number; cat_soa?: string; note?: string
  durc_ok?: boolean; comunicazione_sa?: boolean; antimafia_ok?: boolean; pos_approvato?: boolean
}
interface DocumentoSub {
  id: string; contratto_sub_id: string; tipo: string
  url?: string; nome_file?: string; data_scadenza?: string; extra?: Record<string, string>
}
interface LavoratoreSub {
  id: string; contratto_sub_id: string; nome: string; cognome: string; cf: string
  unilav_url?: string; unilav_data?: string
  idoneita_url?: string; idoneita_scadenza?: string
  formazione_url?: string; formazione_scadenza?: string
  patente_punti?: number
}
interface PagamentoSub {
  id: string; contratto_sub_id: string; data_pagamento: string
  importo_lordo: number; ritenuta_pct: number; importo_netto: number
  note?: string; tipo: string
}

export default function ContrattiPage({ params: pp }: { params: Promise<{ id: string }> }) {
  const { id } = use(pp)

  const [contratti, setContratti]           = useState<ContrattoSub[]>([])
  const [fornitori, setFornitori]           = useState<{ id: string; ragione_sociale: string }[]>([])
  const [importoContratto, setImportoContratto] = useState(0)
  const [commessaInfo, setCommessaInfo]     = useState<{ codice: string; nome: string; committente?: string; importo_contratto?: number } | null>(null)
  const [loading, setLoading]               = useState(true)
  const [pdfLoading, setPdfLoading]         = useState<string | null>(null)
  const [expanded, setExpanded]             = useState<string | null>(null)
  const [saving, setSaving]                 = useState(false)
  const [activeTab, setActiveTab]           = useState<Record<string, string>>({})
  const [documenti, setDocumenti]           = useState<Record<string, DocumentoSub[]>>({})
  const [lavoratori, setLavoratori]         = useState<Record<string, LavoratoreSub[]>>({})
  const [pagamenti, setPagamenti]           = useState<Record<string, PagamentoSub[]>>({})

  // Modal nuovo contratto
  const [modalOpen, setModalOpen] = useState(false)
  const [fFornitore, setFFornitore] = useState('')
  const [fTipo, setFTipo]         = useState('subappalto')
  const [fOggetto, setFOggetto]   = useState('')
  const [fImporto, setFImporto]   = useState('')
  const [fDataStipula, setFDataStipula] = useState('')
  const [fDataInizio, setFDataInizio]   = useState('')
  const [fPctSub, setFPctSub]     = useState('')
  const [fCatSOA, setFCatSOA]     = useState('')
  const [fNote, setFNote]         = useState('')
  const [modalErr, setModalErr]   = useState('')

  // Form lavoratore
  const [lavFormId, setLavFormId] = useState<string | null>(null)
  const [fLNome, setFLNome]       = useState('')
  const [fLCognome, setFLCognome] = useState('')
  const [fLCF, setFLCF]           = useState('')
  const [fLPatente, setFLPatente] = useState('')

  // Form pagamento
  const [pagFormId, setPagFormId] = useState<string | null>(null)
  const [fPData, setFPData]       = useState(new Date().toISOString().slice(0, 10))
  const [fPLordo, setFPLordo]     = useState('')
  const [fPNote, setFPNote]       = useState('')

  // Upload / doc extra
  const [uploading, setUploading]   = useState<string | null>(null)
  const [docExtra, setDocExtra]     = useState<Record<string, string>>({})
  const [ibanInput, setIbanInput]   = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: f }, { data: comm }] = await Promise.all([
      supabase.from('contratti_sub')
        .select('*, fornitore:professionisti_fornitori(ragione_sociale, piva)')
        .eq('commessa_id', id).order('created_at', { ascending: false }),
      supabase.from('professionisti_fornitori').select('id,ragione_sociale').order('ragione_sociale'),
      supabase.from('commesse').select('importo_contratto,codice,nome,committente').eq('id', id).single(),
    ])
    setContratti((c || []) as ContrattoSub[])
    setFornitori(f || [])
    setImportoContratto((comm as any)?.importo_contratto || 0)
    setCommessaInfo(comm ? { codice: (comm as any).codice || '', nome: (comm as any).nome || '', committente: (comm as any).committente, importo_contratto: (comm as any).importo_contratto } : null)

    if (c && c.length > 0) {
      const ids = c.map((x: any) => x.id)
      const [{ data: docs }, { data: lavs }, { data: pags }] = await Promise.all([
        supabase.from('documenti_contratto_sub').select('*').in('contratto_sub_id', ids),
        supabase.from('lavoratori_sub').select('*').in('contratto_sub_id', ids),
        supabase.from('pagamenti_sub').select('*').in('contratto_sub_id', ids).order('data_pagamento'),
      ])
      const dMap: Record<string, DocumentoSub[]> = {}
      const lMap: Record<string, LavoratoreSub[]> = {}
      const pMap: Record<string, PagamentoSub[]> = {}
      for (const d of (docs || [])) { if (!dMap[d.contratto_sub_id]) dMap[d.contratto_sub_id] = []; dMap[d.contratto_sub_id].push(d) }
      for (const l of (lavs || [])) { if (!lMap[l.contratto_sub_id]) lMap[l.contratto_sub_id] = []; lMap[l.contratto_sub_id].push(l) }
      for (const p of (pags || [])) { if (!pMap[p.contratto_sub_id]) pMap[p.contratto_sub_id] = []; pMap[p.contratto_sub_id].push(p) }
      setDocumenti(dMap); setLavoratori(lMap); setPagamenti(pMap)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!fOggetto.trim() || !fImporto) { setModalErr('Oggetto e importo obbligatori'); return }
    setSaving(true)
    const aziendaId = await getAziendaId()
    const { error } = await supabase.from('contratti_sub').insert({
      commessa_id: id, azienda_id: aziendaId || null,
      fornitore_id: fFornitore || null, tipo: fTipo,
      oggetto: fOggetto.trim(), importo_netto: parseFloat(fImporto) || 0,
      ritenuta_pct: 5, stato: 'bozza',
      data_stipula: fDataStipula || null, data_inizio: fDataInizio || null,
      percentuale_subappalto: parseFloat(fPctSub) || null,
      cat_soa: fCatSOA || null, note: fNote || null,
    })
    if (error) { setModalErr(error.message); setSaving(false); return }
    setSaving(false); setModalOpen(false)
    setFFornitore(''); setFOggetto(''); setFImporto(''); setFDataStipula('')
    setFDataInizio(''); setFPctSub(''); setFCatSOA(''); setFNote('')
    await load()
  }

  async function cambiaStato(cid: string, nuovoStato: string) {
    setSaving(true)
    await supabase.from('contratti_sub').update({ stato: nuovoStato }).eq('id', cid)
    setSaving(false); load()
  }

  async function toggleCheck(cid: string, campo: string, val: boolean) {
    await supabase.from('contratti_sub').update({ [campo]: val }).eq('id', cid)
    load()
  }

  async function uploadDoc(contrattoId: string, tipo: string, file: File, extra?: Record<string, string>, scadenza?: string) {
    setUploading(tipo + '_' + contrattoId)
    const aziendaId = await getAziendaId()
    const path = `${aziendaId}/contratti-sub/${contrattoId}/${tipo}.pdf`
    const { error: upErr } = await supabase.storage.from('documenti').upload(path, file, { upsert: true })
    if (upErr) { setUploading(null); return }
    const { data: pub } = supabase.storage.from('documenti').getPublicUrl(path)
    const url = pub?.publicUrl || path
    const existing = (documenti[contrattoId] || []).find(d => d.tipo === tipo)
    if (existing) {
      await supabase.from('documenti_contratto_sub').update({ url, nome_file: file.name, data_scadenza: scadenza || null, extra: extra || null }).eq('id', existing.id)
    } else {
      await supabase.from('documenti_contratto_sub').insert({ contratto_sub_id: contrattoId, commessa_id: id, tipo, url, nome_file: file.name, data_scadenza: scadenza || null, extra: extra || null })
    }
    setUploading(null); await load()
  }

  async function saveIban(contrattoId: string, iban: string) {
    const existing = (documenti[contrattoId] || []).find(d => d.tipo === 'conto_corrente')
    if (existing) {
      await supabase.from('documenti_contratto_sub').update({ extra: { iban } }).eq('id', existing.id)
    } else {
      await supabase.from('documenti_contratto_sub').insert({ contratto_sub_id: contrattoId, commessa_id: id, tipo: 'conto_corrente', extra: { iban } })
    }
    await load()
  }

  async function aggiungiLavoratore(contrattoId: string) {
    if (!fLNome.trim() || !fLCognome.trim()) return
    const aziendaId = await getAziendaId()
    await supabase.from('lavoratori_sub').insert({
      contratto_sub_id: contrattoId, commessa_id: id, azienda_id: aziendaId || null,
      nome: fLNome.trim(), cognome: fLCognome.trim(), cf: fLCF.trim(),
      patente_punti: parseInt(fLPatente) || null,
    })
    setLavFormId(null); setFLNome(''); setFLCognome(''); setFLCF(''); setFLPatente('')
    await load()
  }

  async function eliminaLavoratore(lavId: string) {
    await supabase.from('lavoratori_sub').delete().eq('id', lavId); await load()
  }

  async function aggiungiPagamento(contrattoId: string) {
    if (!fPLordo || !fPData) return
    const aziendaId = await getAziendaId()
    const lordo = parseFloat(fPLordo) || 0
    await supabase.from('pagamenti_sub').insert({
      contratto_sub_id: contrattoId, commessa_id: id, azienda_id: aziendaId || null,
      data_pagamento: fPData, importo_lordo: lordo, ritenuta_pct: 5,
      importo_netto: Math.round(lordo * 0.95 * 100) / 100,
      note: fPNote || null, tipo: 'pagamento',
    })
    setPagFormId(null); setFPLordo(''); setFPNote(''); await load()
  }

  async function svincolaRitenuta(contrattoId: string) {
    const aziendaId = await getAziendaId()
    const pags = pagamenti[contrattoId] || []
    const totRit = pags.filter(p => p.tipo === 'pagamento').reduce((s, p) => s + p.importo_lordo * (p.ritenuta_pct / 100), 0)
    if (totRit <= 0) return
    await supabase.from('pagamenti_sub').insert({
      contratto_sub_id: contrattoId, commessa_id: id, azienda_id: aziendaId || null,
      data_pagamento: new Date().toISOString().slice(0, 10),
      importo_lordo: totRit, ritenuta_pct: 0, importo_netto: totRit,
      note: 'Svincolo ritenuta di garanzia a collaudo', tipo: 'svincolo_ritenuta',
    })
    await load()
  }

  async function generaPdfContratto(c: ContrattoSub) {
    setPdfLoading(c.id)
    try {
      const lavs = (lavoratori[c.id] || []).map(l => ({ nome: l.nome, cognome: l.cognome, cf: l.cf }))
      const { ContrattoSubDocument } = await import('@/components/pdf/ContrattoSubDocument')
      const { pdf } = await import('@react-pdf/renderer')
      const React = await import('react')
      const blob = await pdf(
        React.createElement(ContrattoSubDocument, {
          contratto: { tipo: c.tipo, oggetto: c.oggetto, importo_netto: c.importo_netto, ritenuta_pct: c.ritenuta_pct, data_stipula: c.data_stipula, data_inizio: c.data_inizio, data_fine_prevista: c.data_fine_prevista, percentuale_subappalto: c.percentuale_subappalto, cat_soa: c.cat_soa, note: c.note },
          fornitore: { ragione_sociale: c.fornitore?.ragione_sociale || 'Fornitore non assegnato', piva: c.fornitore?.piva },
          commessa: { codice: commessaInfo?.codice || '', nome: commessaInfo?.nome || '', committente: commessaInfo?.committente, importo_contratto: commessaInfo?.importo_contratto },
          lavoratori: lavs,
        }) as any
      ).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch { console.error('Errore PDF contratto') }
    setPdfLoading(null)
  }

  function getChecklistStatus(contrattoId: string) {
    const docs = documenti[contrattoId] || []
    const presenti = new Set(docs.map(d => d.tipo))
    const cc = docs.find(d => d.tipo === 'conto_corrente')
    if (cc && !cc.extra?.iban) presenti.delete('conto_corrente')
    const mancanoC = DOCUMENTI_DEF.filter(d => d.critico && !presenti.has(d.tipo))
    const mancanoS = DOCUMENTI_DEF.filter(d => !d.critico && !presenti.has(d.tipo))
    if (mancanoC.length === 0 && mancanoS.length === 0) return { color: '#059669', label: '✅ Checklist completa', blockAvvio: false }
    if (mancanoC.length > 0) return { color: '#dc2626', label: `❌ ${mancanoC.length} doc critici mancanti`, blockAvvio: true }
    return { color: '#d97706', label: `⚠️ ${mancanoS.length} doc secondari mancanti`, blockAvvio: false }
  }

  // KPI
  const totale    = contratti.filter(c => !['sospeso', 'RESCISSO'].includes(c.stato)).reduce((s, c) => s + (c.importo_netto || 0), 0)
  const attivi    = contratti.filter(c => ['in_esecuzione', 'autorizzato', 'ATTIVO'].includes(c.stato)).length
  const ritenute  = Object.values(pagamenti).flat().filter(p => p.tipo === 'pagamento').reduce((s, p) => s + p.importo_lordo * (p.ritenuta_pct / 100), 0)
  const durcAlert = contratti.filter(c => c.durc_scadenza && daysDiff(c.durc_scadenza) < 30).length

  const inputSt: React.CSSProperties = { width: '100%', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', boxSizing: 'border-box' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { l: 'Contratti attivi',   v: String(attivi),                    c: '#059669', alert: false },
          { l: 'Valore impegnato',   v: '€ ' + fmt(totale),                c: '#2563eb', alert: false },
          { l: 'Ritenute accumulate',v: '€ ' + fmt(ritenute),              c: '#7c3aed', alert: false },
          { l: durcAlert > 0 ? 'ALERT DURC' : 'DURC ok', v: durcAlert > 0 ? durcAlert + ' contratti' : 'Tutti validi', c: durcAlert > 0 ? '#dc2626' : '#059669', alert: durcAlert > 0 },
        ].map(item => (
          <div key={item.l} style={{ background: item.alert ? '#fef2f2' : '#f9fafb', border: '1px solid ' + (item.alert ? '#fca5a5' : '#e5e7eb'), borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: item.alert ? '#dc2626' : '#6b7280', margin: '0 0 4px' }}>{item.l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: item.c }}>{item.v}</p>
          </div>
        ))}
      </div>

      {/* Banner normativo */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
        <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span><strong>D.Lgs. 36/2023 art. 119:</strong> Comunicazione SA almeno 5gg prima dell&apos;inizio lavori. Ritenuta 5% svincolata a collaudo. DURC obbligatorio per ogni SAL. Limite subappalto 40% importo contrattuale.</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Contratti di Subappalto</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Creati direttamente o da ODA · Workflow D.Lgs. 36/2023</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> Nuovo contratto
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
        </div>
      )}
      {!loading && contratti.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '2px dashed #e5e7eb' }}>
          <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Nessun contratto sub — crea direttamente o da ODA Subappalto</p>
        </div>
      )}

      {/* Lista contratti */}
      {!loading && contratti.map(c => {
        const si         = getStato(c.stato)
        const isExp      = expanded === c.id
        const durcDays   = c.durc_scadenza ? daysDiff(c.durc_scadenza) : null
        const isDurcAlert= durcDays !== null && durcDays < 30
        const check      = getChecklistStatus(c.id)
        const pags       = pagamenti[c.id] || []
        const totPagato  = pags.filter(p => p.tipo === 'pagamento').reduce((s, p) => s + (p.importo_netto || 0), 0)
        const totRitSub  = pags.filter(p => p.tipo === 'pagamento').reduce((s, p) => s + p.importo_lordo * (p.ritenuta_pct / 100), 0)
        const nextSteps  = getNextSteps(c.stato)
        const currentTab = activeTab[c.id] || 'dettagli'

        return (
          <div key={c.id} style={{ border: isDurcAlert ? '2px solid #fca5a5' : '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

            {/* Header card */}
            <div onClick={() => setExpanded(isExp ? null : c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
              {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
              <span style={{ fontSize: 16, flexShrink: 0 }}>{si.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.fornitore?.ragione_sociale || 'Fornitore non assegnato'}
                  </p>
                  {isDurcAlert && (
                    <span style={{ fontSize: 10, padding: '2px 6px', background: '#fee2e2', color: '#dc2626', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
                      DURC {durcDays !== null && durcDays <= 0 ? 'SCADUTO' : `scade ${durcDays}gg`}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                  {c.oggetto || 'Contratto subappalto'}{c.data_stipula ? ` · stipulato ${fmtDate(c.data_stipula)}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>€ {fmt(c.importo_netto || 0)}</span>
                <span style={{ fontSize: 10, color: '#7c3aed' }}>pagato € {fmt(totPagato)}</span>
              </div>
              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 600, background: si.bg, color: si.color, flexShrink: 0 }}>{si.label}</span>
              <span style={{ fontSize: 10, color: check.color, fontWeight: 600, flexShrink: 0 }}>{check.label}</span>
            </div>

            {/* Dettaglio */}
            {isExp && (
              <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
                  {[
                    { key: 'dettagli',   label: '📋 Dettagli' },
                    { key: 'documenti',  label: `📁 Documenti` },
                    { key: 'lavoratori', label: `👷 Lavoratori (${(lavoratori[c.id] || []).length})` },
                    { key: 'pagamenti',  label: `💶 Pagamenti (${pags.length})` },
                  ].map(t => (
                    <button key={t.key} onClick={e => { e.stopPropagation(); setActiveTab(prev => ({ ...prev, [c.id]: t.key })) }}
                      style={{ padding: '8px 16px', fontSize: 12, border: 'none', cursor: 'pointer',
                        fontWeight: currentTab === t.key ? 700 : 400,
                        background: currentTab === t.key ? '#eff6ff' : 'transparent',
                        color: currentTab === t.key ? '#1d4ed8' : '#6b7280',
                        borderBottom: currentTab === t.key ? '2px solid #2563eb' : '2px solid transparent' }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* TAB DETTAGLI */}
                  {currentTab === 'dettagli' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, fontSize: 12 }}>
                        {[
                          ['Importo netto', '€ ' + fmt(c.importo_netto || 0)],
                          ['Ritenuta 5%', '€ ' + fmt((c.importo_netto || 0) * 0.05)],
                          ['Da liquidare', '€ ' + fmt((c.importo_netto || 0) * 0.95)],
                          ['Tipo', TIPI_CONTRATTO.find(t => t.value === c.tipo)?.label || c.tipo || '—'],
                          ['Data stipula', fmtDate(c.data_stipula)],
                          ['Inizio lavori', fmtDate(c.data_inizio)],
                          ['Fine prevista', fmtDate(c.data_fine_prevista)],
                          ['DURC scadenza', fmtDate(c.durc_scadenza)],
                          ['% subappalto', c.percentuale_subappalto ? c.percentuale_subappalto + '%' : '—'],
                          ['Cat. SOA', c.cat_soa || '—'],
                          ['P.IVA fornitore', c.fornitore?.piva || '—'],
                          ['Pagato totale', '€ ' + fmt(totPagato)],
                        ].map(([l, v]) => (
                          <div key={String(l)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>
                            <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>{l}</p>
                            <p style={{ fontSize: 12, margin: 0, fontWeight: 500 }}>{String(v)}</p>
                          </div>
                        ))}
                      </div>

                      {c.note && <p style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', margin: 0 }}>Note: {c.note}</p>}

                      {/* Checklist conformità */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Shield size={13} /> Conformità D.Lgs. 36/2023
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {[
                            { label: 'DURC in corso di validità', campo: 'durc_ok' },
                            { label: 'Comunicazione SA eseguita', campo: 'comunicazione_sa' },
                            { label: 'Antimafia verificata',       campo: 'antimafia_ok' },
                            { label: 'POS trasmesso e approvato', campo: 'pos_approvato' },
                          ].map(item => (
                            <div key={item.campo} onClick={() => toggleCheck(c.id, item.campo, !(c as any)[item.campo])}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                                background: (c as any)[item.campo] ? '#f0fdf4' : '#fef2f2',
                                border: '1px solid ' + ((c as any)[item.campo] ? '#bbf7d0' : '#fecaca') }}>
                              {(c as any)[item.campo]
                                ? <CheckCircle2 size={14} style={{ color: '#059669', flexShrink: 0 }} />
                                : <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />}
                              <span style={{ fontSize: 12, color: (c as any)[item.campo] ? '#065f46' : '#991b1b' }}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Workflow */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>Avanza stato →</span>
                        {nextSteps.map(ns => {
                          const blocked = ns.value === 'in_esecuzione' && check.blockAvvio
                          return (
                            <button key={ns.value} disabled={saving || blocked} onClick={() => cambiaStato(c.id, ns.value)}
                              title={blocked ? 'Completa i documenti critici prima di avviare i lavori' : undefined}
                              style={{ fontSize: 11, padding: '4px 12px', background: blocked ? '#f3f4f6' : ns.color, color: blocked ? '#9ca3af' : '#fff', border: 'none', borderRadius: 6, cursor: blocked ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                              {ns.label}
                            </button>
                          )
                        })}
                        {!['sospeso', 'completato', 'RESCISSO', 'CONCLUSO'].includes(c.stato) && (
                          <button disabled={saving} onClick={() => cambiaStato(c.id, 'sospeso')}
                            style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, cursor: 'pointer' }}>
                            ⏸ Sospendi
                          </button>
                        )}
                        {(STATI_ALIAS[c.stato] || c.stato) === 'sospeso' && (
                          <button disabled={saving} onClick={() => cambiaStato(c.id, 'autorizzato')}
                            style={{ fontSize: 11, padding: '4px 12px', background: '#059669', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            ▶ Riprendi
                          </button>
                        )}
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600, background: si.bg, color: si.color }}>{si.icon} {si.label}</span>
                        <button disabled={pdfLoading === c.id} onClick={() => generaPdfContratto(c)}
                          style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 12px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, opacity: pdfLoading === c.id ? 0.6 : 1 }}>
                          {pdfLoading === c.id ? '...' : '📄 Contratto PDF'}
                        </button>
                      </div>
                    </>
                  )}

                  {/* TAB DOCUMENTI */}
                  {currentTab === 'documenti' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                        Documenti obbligatori per l&apos;autorizzazione al subappalto.
                        <span style={{ marginLeft: 8, fontWeight: 700, color: check.color }}>{check.label}</span>
                      </p>
                      {DOCUMENTI_DEF.map(def => {
                        const doc        = (documenti[c.id] || []).find(d => d.tipo === def.tipo)
                        const isPresente = def.isIban ? !!doc?.extra?.iban : !!doc?.url
                        const isUp       = uploading === def.tipo + '_' + c.id
                        return (
                          <div key={def.tipo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                            background: isPresente ? '#f0fdf4' : (def.critico ? '#fef2f2' : '#fffbeb'),
                            border: '1px solid ' + (isPresente ? '#bbf7d0' : (def.critico ? '#fecaca' : '#fde68a')),
                            borderRadius: 8 }}>
                            {isPresente
                              ? <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                              : def.critico
                              ? <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                              : <Clock size={16} style={{ color: '#d97706', flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: '#374151' }}>
                                {def.label} {def.critico && <span style={{ fontSize: 9, color: '#dc2626' }}>*critico</span>}
                              </p>
                              {doc?.nome_file && <p style={{ fontSize: 10, color: '#6b7280', margin: '1px 0 0' }}>{doc.nome_file}</p>}
                              {doc?.data_scadenza && (() => {
                                const dd = daysDiff(doc.data_scadenza)
                                return <p style={{ fontSize: 10, color: dd < 30 ? '#dc2626' : '#6b7280', margin: '1px 0 0', fontWeight: dd < 30 ? 700 : 400 }}>Scad. {fmtDate(doc.data_scadenza)}{dd < 30 ? ` ⚠️ tra ${dd}gg` : ''}</p>
                              })()}
                              {def.hasExtra && doc?.extra && <p style={{ fontSize: 10, color: '#6b7280', margin: '1px 0 0' }}>Cat. {doc.extra.categoria || '—'} Cl. {doc.extra.classifica || '—'}</p>}
                              {def.isIban && doc?.extra?.iban && <p style={{ fontSize: 10, color: '#374151', margin: '1px 0 0', fontFamily: 'monospace' }}>{doc.extra.iban}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                              {doc?.url && (
                                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: 10, padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, textDecoration: 'none', border: '1px solid #bfdbfe' }}>
                                  Apri
                                </a>
                              )}
                              {def.hasScadenza && (
                                <input type="date" value={docExtra[c.id + '_' + def.tipo + '_scad'] || doc?.data_scadenza || ''}
                                  onChange={e => setDocExtra(prev => ({ ...prev, [c.id + '_' + def.tipo + '_scad']: e.target.value }))}
                                  style={{ fontSize: 10, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }} />
                              )}
                              {def.hasExtra && (
                                <>
                                  <input placeholder="Cat." value={docExtra[c.id + '_' + def.tipo + '_cat'] || doc?.extra?.categoria || ''}
                                    onChange={e => setDocExtra(prev => ({ ...prev, [c.id + '_' + def.tipo + '_cat']: e.target.value }))}
                                    style={{ width: 50, fontSize: 10, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }} />
                                  <input placeholder="Cl." value={docExtra[c.id + '_' + def.tipo + '_cl'] || doc?.extra?.classifica || ''}
                                    onChange={e => setDocExtra(prev => ({ ...prev, [c.id + '_' + def.tipo + '_cl']: e.target.value }))}
                                    style={{ width: 40, fontSize: 10, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }} />
                                </>
                              )}
                              {def.isIban ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <input placeholder="IT00 X000 ..." value={ibanInput[c.id] || doc?.extra?.iban || ''}
                                    onChange={e => setIbanInput(prev => ({ ...prev, [c.id]: e.target.value }))}
                                    style={{ width: 190, fontSize: 10, border: '1px solid #d1d5db', borderRadius: 4, padding: '3px 6px', fontFamily: 'monospace' }} />
                                  <button onClick={() => saveIban(c.id, ibanInput[c.id] || '')}
                                    style={{ fontSize: 10, padding: '3px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                                    Salva
                                  </button>
                                </div>
                              ) : (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 8px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 4, cursor: 'pointer' }}>
                                  {isUp ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={11} />}
                                  {isPresente ? 'Sostituisci' : 'Upload PDF'}
                                  <input type="file" accept=".pdf,.PDF" style={{ display: 'none' }}
                                    onChange={async e => {
                                      const file = e.target.files?.[0]; if (!file) return
                                      const extra = def.hasExtra ? { categoria: docExtra[c.id + '_' + def.tipo + '_cat'] || '', classifica: docExtra[c.id + '_' + def.tipo + '_cl'] || '' } : undefined
                                      const scad  = def.hasScadenza ? (docExtra[c.id + '_' + def.tipo + '_scad'] || undefined) : undefined
                                      await uploadDoc(c.id, def.tipo, file, extra, scad)
                                      e.target.value = ''
                                    }} />
                                </label>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* TAB LAVORATORI */}
                  {currentTab === 'lavoratori' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Lavoratori del subappaltatore in cantiere</span>
                        {lavFormId !== c.id && (
                          <button onClick={() => setLavFormId(c.id)}
                            style={{ fontSize: 11, padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            + Aggiungi lavoratore
                          </button>
                        )}
                      </div>
                      {(lavoratori[c.id] || []).map(lav => {
                        const docs30 = [
                          lav.idoneita_scadenza  && daysDiff(lav.idoneita_scadenza)  < 30,
                          lav.formazione_scadenza && daysDiff(lav.formazione_scadenza) < 30,
                        ].some(Boolean)
                        return (
                          <div key={lav.id} style={{ padding: '10px 14px', background: docs30 ? '#fffbeb' : '#fff', border: '1px solid ' + (docs30 ? '#fde68a' : '#e5e7eb'), borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{lav.cognome} {lav.nome}</span>
                              {lav.cf && <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>{lav.cf}</span>}
                              {lav.patente_punti != null && (
                                <span style={{ fontSize: 10, padding: '1px 6px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 4, fontWeight: 600 }}>
                                  Crediti: {lav.patente_punti} pt
                                </span>
                              )}
                              {docs30 && <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>⚠️ Documenti in scadenza</span>}
                              <button onClick={() => eliminaLavoratore(lav.id)} style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>🗑</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 8 }}>
                              {[
                                { label: 'UNILAV',               url: lav.unilav_url,      scad: lav.unilav_data },
                                { label: 'Idoneità sanitaria',   url: lav.idoneita_url,    scad: lav.idoneita_scadenza },
                                { label: 'Formazione sicurezza', url: lav.formazione_url,  scad: lav.formazione_scadenza },
                              ].map(d => {
                                const isAlert = d.scad && daysDiff(d.scad) < 30
                                return (
                                  <div key={d.label} style={{ padding: '6px 8px', background: d.url ? '#f0fdf4' : '#f9fafb', border: '1px solid ' + (d.url ? '#bbf7d0' : '#e5e7eb'), borderRadius: 6 }}>
                                    <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px', fontWeight: 600 }}>{d.label}</p>
                                    {d.url
                                      ? <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#1d4ed8' }}>Documento ↗</a>
                                      : <span style={{ fontSize: 10, color: '#9ca3af' }}>Non caricato</span>}
                                    {d.scad && <p style={{ fontSize: 10, color: isAlert ? '#dc2626' : '#6b7280', margin: '2px 0 0', fontWeight: isAlert ? 700 : 400 }}>{fmtDate(d.scad)}{isAlert ? ' ⚠️' : ''}</p>}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                      {lavFormId === c.id && (
                        <div style={{ padding: 12, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#0c4a6e' }}>Nuovo lavoratore</span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 8 }}>
                            <input value={fLNome}    onChange={e => setFLNome(e.target.value)}    placeholder="Nome *"          style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px' }} />
                            <input value={fLCognome} onChange={e => setFLCognome(e.target.value)} placeholder="Cognome *"       style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px' }} />
                            <input value={fLCF}      onChange={e => setFLCF(e.target.value)}      placeholder="Cod. fiscale"    style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontFamily: 'monospace' }} />
                            <input type="number" value={fLPatente} onChange={e => setFLPatente(e.target.value)} placeholder="Punti" style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => aggiungiLavoratore(c.id)} style={{ fontSize: 11, padding: '4px 14px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Aggiungi</button>
                            <button onClick={() => setLavFormId(null)} style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>Annulla</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB PAGAMENTI */}
                  {currentTab === 'pagamenti' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        {[
                          { l: 'Totale pagato (netto)', v: '€ ' + fmt(totPagato),  c: '#059669' },
                          { l: 'Ritenute accumulate',   v: '€ ' + fmt(totRitSub),  c: '#7c3aed' },
                          { l: 'Residuo da pagare',     v: '€ ' + fmt(Math.max(0, (c.importo_netto || 0) * 0.95 - totPagato)), c: '#d97706' },
                        ].map(item => (
                          <div key={item.l} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                            <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px' }}>{item.l}</p>
                            <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: item.c }}>{item.v}</p>
                          </div>
                        ))}
                      </div>
                      {pags.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                              {['Data', 'Lordo', 'Ritenuta', 'Netto', 'Tipo', 'Note'].map(h => (
                                <th key={h} style={{ padding: '4px 8px', textAlign: ['Lordo','Ritenuta','Netto'].includes(h) ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pags.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: p.tipo === 'svincolo_ritenuta' ? '#f0fdf4' : 'transparent' }}>
                                <td style={{ padding: '5px 8px' }}>{fmtDate(p.data_pagamento)}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace' }}>€ {fmt(p.importo_lordo)}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#7c3aed' }}>€ {fmt(p.importo_lordo * (p.ritenuta_pct / 100))}</td>
                                <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>€ {fmt(p.importo_netto)}</td>
                                <td style={{ padding: '5px 8px' }}>
                                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 600, background: p.tipo === 'svincolo_ritenuta' ? '#dcfce7' : '#eff6ff', color: p.tipo === 'svincolo_ritenuta' ? '#065f46' : '#1d4ed8' }}>
                                    {p.tipo === 'svincolo_ritenuta' ? 'Svincolo ritenuta' : 'Pagamento SAL'}
                                  </span>
                                </td>
                                <td style={{ padding: '5px 8px', color: '#6b7280', fontStyle: 'italic' }}>{p.note || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {pagFormId !== c.id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setPagFormId(c.id); setFPData(new Date().toISOString().slice(0, 10)) }}
                            style={{ fontSize: 11, padding: '4px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            + Registra pagamento
                          </button>
                          {(STATI_ALIAS[c.stato] || c.stato) === 'completato' && !pags.some(p => p.tipo === 'svincolo_ritenuta') && totRitSub > 0 && (
                            <button onClick={() => svincolaRitenuta(c.id)}
                              style={{ fontSize: 11, padding: '4px 12px', background: '#f0fdf4', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                              🔓 Svincola ritenuta (€ {fmt(totRitSub)})
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>Nuovo pagamento</span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div>
                              <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Data</label>
                              <input type="date" value={fPData} onChange={e => setFPData(e.target.value)} style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Importo lordo SAL € *</label>
                              <input type="number" step="0.01" value={fPLordo} onChange={e => setFPLordo(e.target.value)} placeholder="0.00"
                                style={{ width: 130, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', textAlign: 'right' }} />
                            </div>
                            {fPLordo && (
                              <div style={{ fontSize: 11, color: '#6b7280' }}>
                                <p style={{ margin: 0 }}>Ritenuta 5%: <strong>€ {fmt(parseFloat(fPLordo) * 0.05)}</strong></p>
                                <p style={{ margin: 0 }}>Netto: <strong>€ {fmt(parseFloat(fPLordo) * 0.95)}</strong></p>
                              </div>
                            )}
                            <div>
                              <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Note</label>
                              <input value={fPNote} onChange={e => setFPNote(e.target.value)} placeholder="SAL n.X..."
                                style={{ width: 160, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => aggiungiPagamento(c.id)} style={{ fontSize: 11, padding: '4px 14px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Registra</button>
                            <button onClick={() => setPagFormId(null)} style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>Annulla</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Modal nuovo contratto */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Nuovo Contratto di Subappalto</h2>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Tipo contratto *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {TIPI_CONTRATTO.map(t => (
                  <button key={t.value} onClick={() => setFTipo(t.value)}
                    style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: fTipo === t.value ? '2px solid #2563eb' : '1px solid #e5e7eb', background: fTipo === t.value ? '#eff6ff' : '#fff', color: fTipo === t.value ? '#1d4ed8' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: fTipo === t.value ? 700 : 400 }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore</label>
              <select value={fFornitore} onChange={e => setFFornitore(e.target.value)} style={inputSt}>
                <option value="">— Seleziona fornitore —</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto *</label>
              <input value={fOggetto} onChange={e => setFOggetto(e.target.value)} placeholder="Lavorazioni subappaltate" style={inputSt} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo netto € *</label>
                <input type="number" step="0.01" value={fImporto} onChange={e => setFImporto(e.target.value)} style={{ ...inputSt, textAlign: 'right' }} />
                {fImporto && importoContratto > 0 && (() => {
                  const pct = (parseFloat(fImporto) / importoContratto) * 100
                  return pct > 40
                    ? <p style={{ fontSize: 10, color: '#dc2626', margin: '4px 0 0', fontWeight: 600 }}>⚠️ Supera limite 40% — {pct.toFixed(1)}% del contratto</p>
                    : <p style={{ fontSize: 10, color: '#059669', margin: '4px 0 0' }}>{pct.toFixed(1)}% del contratto ✓</p>
                })()}
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>% subappalto dichiarata (max 40%)</label>
                <input type="number" min="0" max="40" step="0.1" value={fPctSub} onChange={e => setFPctSub(e.target.value)} style={{ ...inputSt, textAlign: 'right' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data stipula</label>
                <input type="date" value={fDataStipula} onChange={e => setFDataStipula(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data inizio prevista</label>
                <input type="date" value={fDataInizio} onChange={e => setFDataInizio(e.target.value)} style={inputSt} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Categoria SOA richiesta</label>
              <input value={fCatSOA} onChange={e => setFCatSOA(e.target.value)} placeholder="es. OG1 classifica III" style={inputSt} />
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note</label>
              <textarea value={fNote} onChange={e => setFNote(e.target.value)} rows={2} style={{ ...inputSt, resize: 'none' }} />
            </div>

            {modalErr && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{modalErr}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setModalOpen(false); setModalErr('') }}
                style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving && <Loader2 size={13} />} Crea Contratto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
