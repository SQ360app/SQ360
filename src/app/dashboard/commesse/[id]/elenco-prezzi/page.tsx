'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'
import { Loader2, Plus, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt  = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const TIPI_ANALISI = [
  { value: 'materiali',          label: 'Materiali',       color: '#3b82f6' },
  { value: 'nolo_esterno',       label: 'Nolo esterno',    color: '#8b5cf6' },
  { value: 'subappalto',         label: 'Subappalto',      color: '#f59e0b' },
  { value: 'manodopera_esterna', label: 'Manod. esterna',  color: '#10b981' },
  { value: 'manodopera_interna', label: 'Manod. impresa',  color: '#6b7280' },
  { value: 'mezzi_interni',      label: 'Mezzi impresa',   color: '#64748b' },
  { value: 'utile_impresa',      label: 'Utile impresa',   color: '#34d399' },
]

interface EP {
  id: string; commessa_id: string; codice: string; descrizione: string
  um: string; prezzo_unitario: number; fonte: string
  prezzario_riferimento?: string; anno_prezzario?: string
  approvato_da?: string; data_approvazione?: string
  variante_id?: string; note?: string
}
interface VoceC {
  id: string; codice: string; descrizione: string; um: string
  quantita: number; prezzo_unitario: number; importo: number
  wbs_id?: string; wbs_label?: string
}
interface AnalisiP {
  id: string; commessa_id: string; codice_tariffa: string
  tipo: string; descrizione?: string; importo_unitario: number; percentuale: number
}
interface Variante { id: string; numero: number; descrizione: string; stato: string }

function FonteBadge({ fonte, varNum }: { fonte: string; varNum?: number }) {
  if (fonte === 'prezzario')    return <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 3, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8' }}>Prezzario</span>
  if (fonte === 'prezzo_nuovo') return <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 3, fontWeight: 700, background: '#fff7ed', color: '#c2410c' }}>Prezzo Nuovo ★</span>
  if (fonte === 'variante')     return <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 3, fontWeight: 700, background: '#f0fdf4', color: '#065f46' }}>Variante{varNum ? ` n.${varNum}` : ''} ●</span>
  return <span style={{ fontSize: 9, color: '#6b7280' }}>{fonte}</span>
}

export default function ElencoPrezziPage({ params: pp }: { params: Promise<{ id: string }> }) {
  const { id } = use(pp)
  const router = useRouter()

  const [ep,          setEp]          = useState<EP[]>([])
  const [voci,        setVoci]        = useState<VoceC[]>([])
  const [analisi,     setAnalisi]     = useState<AnalisiP[]>([])
  const [varianti,    setVarianti]    = useState<Variante[]>([])
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [syncCount,   setSyncCount]   = useState(0)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [filterFonte, setFilterFonte] = useState('tutte')
  const [analisiExp,  setAnalisiExp]  = useState<Record<string, boolean>>({})
  const [editBuf,     setEditBuf]     = useState<Record<string, string>>({})
  const [analisiEdit, setAnalisiEdit] = useState<Record<string, string>>({})
  const [modalOpen,   setModalOpen]   = useState(false)

  // Form nuovo prezzo
  const [fCodice,   setFCodice]   = useState('')
  const [fDesc,     setFDesc]     = useState('')
  const [fUm,       setFUm]       = useState('')
  const [fPu,       setFPu]       = useState('')
  const [fFonte,    setFFonte]    = useState('prezzo_nuovo')
  const [fNote,     setFNote]     = useState('')
  const [fVariante, setFVariante] = useState('')
  const [modalErr,  setModalErr]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: computo } = await supabase.from('computo_metrico').select('id').eq('commessa_id', id).single()
    const computoId = computo?.id || null

    const [{ data: epData }, { data: vData }, { data: aData }, { data: vVar }] = await Promise.all([
      supabase.from('elenco_prezzi').select('*').eq('commessa_id', id).order('codice'),
      computoId
        ? supabase.from('voci_computo').select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,wbs_id,wbs_label').eq('computo_id', computoId).order('codice')
        : Promise.resolve({ data: [] }),
      supabase.from('analisi_prezzi_tariffa').select('*').eq('commessa_id', id),
      supabase.from('varianti').select('id,numero,descrizione,stato').eq('commessa_id', id).eq('stato', 'esecutiva'),
    ])

    const epList  = (epData  || []) as EP[]
    const vList   = (vData   || []) as VoceC[]
    const aList   = (aData   || []) as AnalisiP[]
    const varList = (vVar    || []) as Variante[]

    setEp(epList); setVoci(vList); setAnalisi(aList); setVarianti(varList)

    // Sync automatico
    const codiciEP = new Set(epList.map(p => p.codice))
    const byCode: Record<string, VoceC> = {}
    for (const v of vList) { if (!byCode[v.codice]) byCode[v.codice] = v }
    const toInsert = Object.values(byCode).filter(v => !codiciEP.has(v.codice))
    if (toInsert.length > 0) {
      setSyncing(true)
      const aziendaId = await getAziendaId()
      await supabase.from('elenco_prezzi').insert(
        toInsert.map(v => ({
          commessa_id: id, azienda_id: aziendaId || null,
          codice: v.codice, descrizione: v.descrizione,
          um: v.um, prezzo_unitario: v.prezzo_unitario, fonte: 'prezzario',
        }))
      )
      setSyncCount(toInsert.length)
      // Ricarica EP dopo sync
      const { data: epNew } = await supabase.from('elenco_prezzi').select('*').eq('commessa_id', id).order('codice')
      setEp((epNew || []) as EP[])
      setSyncing(false)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Handlers analisi ──────────────────────────────────────────────────────

  const aggiungiAnalisi = async (codice: string, tipo: string) => {
    const aziendaId = await getAziendaId()
    const { data } = await supabase.from('analisi_prezzi_tariffa').insert({
      commessa_id: id, azienda_id: aziendaId || null,
      codice_tariffa: codice, tipo, importo_unitario: 0, percentuale: 0,
    }).select().single()
    if (data) setAnalisi(prev => [...prev, data as AnalisiP])
  }

  const eliminaAnalisi = async (analisiId: string) => {
    await supabase.from('analisi_prezzi_tariffa').delete().eq('id', analisiId)
    setAnalisi(prev => prev.filter(a => a.id !== analisiId))
  }

  const aggiornaAnalisi = async (a: AnalisiP, field: 'importo_unitario' | 'percentuale', rawVal: string, pu: number) => {
    const val = parseFloat(rawVal) || 0
    let newIu = a.importo_unitario, newPct = a.percentuale
    if (field === 'importo_unitario') {
      newIu  = val
      newPct = pu > 0 ? Math.round((val / pu) * 10000) / 100 : 0
    } else {
      newPct = val
      newIu  = Math.round(pu * val / 100 * 100) / 100
    }
    await supabase.from('analisi_prezzi_tariffa').update({ importo_unitario: newIu, percentuale: newPct }).eq('id', a.id)
    setAnalisi(prev => prev.map(x => x.id === a.id ? { ...x, importo_unitario: newIu, percentuale: newPct } : x))
    setAnalisiEdit(prev => { const n = { ...prev }; delete n[a.id + '_iu']; delete n[a.id + '_pct']; return n })
  }

  const copiaAnalisi = async (codiceSource: string, codiceDest: string) => {
    const fonti = analisi.filter(a => a.codice_tariffa === codiceSource)
    if (!fonti.length) return
    const aziendaId = await getAziendaId()
    await supabase.from('analisi_prezzi_tariffa').delete().eq('commessa_id', id).eq('codice_tariffa', codiceDest)
    await supabase.from('analisi_prezzi_tariffa').insert(
      fonti.map(f => ({ commessa_id: id, azienda_id: aziendaId || null, codice_tariffa: codiceDest, tipo: f.tipo, descrizione: f.descrizione, importo_unitario: f.importo_unitario, percentuale: f.percentuale }))
    )
    const { data } = await supabase.from('analisi_prezzi_tariffa').select('*').eq('commessa_id', id)
    if (data) setAnalisi(data as AnalisiP[])
  }

  // ── Handlers EP ───────────────────────────────────────────────────────────

  const aggiornaCampo = async (epId: string, campo: string, val: string) => {
    const payload: Record<string, string | number> = { [campo]: val }
    if (campo === 'prezzo_unitario') payload[campo] = parseFloat(val) || 0
    await supabase.from('elenco_prezzi').update(payload).eq('id', epId)
    setEp(prev => prev.map(p => p.id === epId ? { ...p, [campo]: payload[campo] } : p))
    setEditBuf(prev => { const n = { ...prev }; delete n[epId + '_' + campo]; return n })
  }

  const handleSaveNuovo = async () => {
    if (!fCodice.trim() || !fDesc.trim() || !fPu) { setModalErr('Codice, descrizione e P.U. obbligatori'); return }
    const aziendaId = await getAziendaId()
    const { error } = await supabase.from('elenco_prezzi').insert({
      commessa_id: id, azienda_id: aziendaId || null,
      codice: fCodice.trim(), descrizione: fDesc.trim(),
      um: fUm || 'nr', prezzo_unitario: parseFloat(fPu) || 0,
      fonte: fFonte, variante_id: fVariante || null, note: fNote || null,
    })
    if (error) { setModalErr(error.message); return }
    setModalOpen(false)
    setFCodice(''); setFDesc(''); setFUm(''); setFPu(''); setFNote(''); setFVariante('')
    await load()
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const vocePerCodice: Record<string, VoceC[]> = {}
  for (const v of voci) { if (!vocePerCodice[v.codice]) vocePerCodice[v.codice] = []; vocePerCodice[v.codice].push(v) }

  const analisiPerCodice: Record<string, AnalisiP[]> = {}
  for (const a of analisi) { if (!analisiPerCodice[a.codice_tariffa]) analisiPerCodice[a.codice_tariffa] = []; analisiPerCodice[a.codice_tariffa].push(a) }

  function getAnalisiStatus(codice: string, pu: number) {
    const av = analisiPerCodice[codice] || []
    if (!av.length) return { icon: '○', color: '#9ca3af', label: 'Nessuna', margine: null, totale: 0 }
    const totale = av.reduce((s, a) => s + (a.importo_unitario || 0), 0)
    const margine = pu > 0 ? ((pu - totale) / pu) * 100 : 0
    if (Math.abs(totale - pu) < 0.01) return { icon: '✅', color: '#059669', label: `${margine.toFixed(1)}% marg.`, margine, totale }
    return { icon: '⚠️', color: '#d97706', label: 'Parziale', margine, totale }
  }

  const filteredEP = ep.filter(p => {
    if (filterFonte === 'prezzario')    return p.fonte === 'prezzario'
    if (filterFonte === 'prezzo_nuovo') return p.fonte === 'prezzo_nuovo'
    if (filterFonte === 'variante')     return p.fonte === 'variante'
    if (filterFonte === 'con_analisi')  return (analisiPerCodice[p.codice] || []).length > 0
    if (filterFonte === 'senza_analisi') return (analisiPerCodice[p.codice] || []).length === 0
    return true
  })

  const nConAnalisi  = ep.filter(p => (analisiPerCodice[p.codice] || []).length > 0).length
  const nSenzaAnalisi = ep.length - nConAnalisi

  const allCodici = [...new Set(analisi.filter(a => a.codice_tariffa !== (ep.find(p => p.id === expanded)?.codice)).map(a => a.codice_tariffa))]

  const inputSt: React.CSSProperties = { fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', boxSizing: 'border-box' }
  const [copiaSource, setCopiaSource] = useState('')

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Banner sync */}
      {(syncing || syncCount > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
          {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
          {syncing ? 'Sincronizzazione tariffe dal computo...' : `✓ ${syncCount} tariffe sincronizzate automaticamente dal computo`}
          {!syncing && <button onClick={() => setSyncCount(0)} style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>}
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        {[
          { l: 'Totale tariffe',   v: String(ep.length),                                  c: '#111827', alert: false },
          { l: 'Da prezzario',     v: String(ep.filter(p => p.fonte === 'prezzario').length),    c: '#1d4ed8', alert: false },
          { l: 'Prezzi nuovi',     v: String(ep.filter(p => p.fonte === 'prezzo_nuovo').length), c: '#c2410c', alert: false },
          { l: 'Da variante',      v: String(ep.filter(p => p.fonte === 'variante').length),     c: '#065f46', alert: false },
          { l: 'Con analisi',      v: String(nConAnalisi),                                c: '#059669', alert: false },
          { l: 'Senza analisi',    v: String(nSenzaAnalisi),                              c: nSenzaAnalisi > 0 ? '#d97706' : '#059669', alert: nSenzaAnalisi > 0 },
        ].map(item => (
          <div key={item.l} style={{ background: item.alert ? '#fffbeb' : '#f9fafb', border: '1px solid ' + (item.alert ? '#fde68a' : '#e5e7eb'), borderRadius: 8, padding: '8px 12px' }}>
            <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px' }}>{item.l}</p>
            <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: item.c }}>{item.v}</p>
          </div>
        ))}
      </div>

      {/* Header + filtri */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Elenco Prezzi</h2>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Tariffe contrattuali · popolazione automatica dal computo · analisi prezzi per tariffa</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={15} /> Nuovo prezzo
        </button>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { key: 'tutte',         label: `Tutte (${ep.length})` },
          { key: 'prezzario',     label: `Da prezzario (${ep.filter(p => p.fonte === 'prezzario').length})` },
          { key: 'prezzo_nuovo',  label: `Prezzi nuovi (${ep.filter(p => p.fonte === 'prezzo_nuovo').length})` },
          { key: 'variante',      label: `Da variante (${ep.filter(p => p.fonte === 'variante').length})` },
          { key: 'con_analisi',   label: `Con analisi (${nConAnalisi})` },
          { key: 'senza_analisi', label: `Senza analisi (${nSenzaAnalisi})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterFonte(f.key)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: filterFonte === f.key ? 700 : 400, background: filterFonte === f.key ? '#2563eb' : '#f3f4f6', color: filterFonte === f.key ? '#fff' : '#6b7280' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header tabella */}
          <div style={{ display: 'grid', gridTemplateColumns: '20px 100px 1fr 50px 90px 100px 90px 60px', gap: 8, padding: '6px 14px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            <div />
            <div>Codice</div><div>Descrizione</div><div>UM</div><div style={{ textAlign: 'right' }}>P.U.</div>
            <div>Fonte</div><div>Analisi</div><div style={{ textAlign: 'center' }}>Voci</div>
          </div>

          {filteredEP.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nessuna tariffa trovata</div>
          )}

          {filteredEP.map(p => {
            const isExp    = expanded === p.id
            const as       = getAnalisiStatus(p.codice, p.prezzo_unitario)
            const nVoci    = (vocePerCodice[p.codice] || []).length
            const varLink  = varianti.find(v => v.id === p.variante_id)
            const av       = analisiPerCodice[p.codice] || []
            const tipiInBase = new Set(av.map(a => a.tipo))
            const analisiExpanded = analisiExp[p.codice] || false

            return (
              <div key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>

                {/* Riga principale */}
                <div onClick={() => setExpanded(isExp ? null : p.id)}
                  style={{ display: 'grid', gridTemplateColumns: '20px 100px 1fr 50px 90px 100px 90px 60px', gap: 8, padding: '8px 14px', cursor: 'pointer', background: isExp ? '#f0f9ff' : '#fff', alignItems: 'center' }}>
                  <div>{isExp ? <ChevronDown size={12} style={{ color: '#9ca3af' }} /> : <ChevronRight size={12} style={{ color: '#9ca3af' }} />}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#1d4ed8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.codice}</div>
                  <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4', fontSize: 12, cursor: 'help', color: '#374151' }} title={p.descrizione}>{p.descrizione}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{p.um}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{fmt(p.prezzo_unitario)}</div>
                  <div><FonteBadge fonte={p.fonte} varNum={varLink?.numero} /></div>
                  <div>
                    <span style={{ fontSize: 10, color: as.color, fontWeight: 600 }}>{as.icon} {as.label}</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/commesse/${id}/computo`) }}
                      title="Vai al computo filtrato per questa tariffa"
                      style={{ fontSize: 10, padding: '1px 8px', background: nVoci > 0 ? '#eff6ff' : '#f3f4f6', color: nVoci > 0 ? '#1d4ed8' : '#9ca3af', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                      {nVoci}
                    </button>
                  </div>
                </div>

                {/* Dettaglio espanso */}
                {isExp && (
                  <div style={{ borderTop: '1px solid #bfdbfe', background: '#f8fafc', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* SEZIONE 1 — Dati tariffa */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Dati tariffa</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 70px 110px', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Codice</label>
                          <input value={editBuf[p.id + '_codice'] ?? p.codice} style={{ ...inputSt, width: '100%', fontFamily: 'monospace' }}
                            onChange={e => setEditBuf(prev => ({ ...prev, [p.id + '_codice']: e.target.value }))}
                            onBlur={() => aggiornaCampo(p.id, 'codice', editBuf[p.id + '_codice'] ?? p.codice)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Descrizione</label>
                          <input value={editBuf[p.id + '_desc'] ?? p.descrizione} style={{ ...inputSt, width: '100%' }}
                            onChange={e => setEditBuf(prev => ({ ...prev, [p.id + '_desc']: e.target.value }))}
                            onBlur={() => aggiornaCampo(p.id, 'descrizione', editBuf[p.id + '_desc'] ?? p.descrizione)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>UM</label>
                          <input value={editBuf[p.id + '_um'] ?? p.um} style={{ ...inputSt, width: '100%' }}
                            onChange={e => setEditBuf(prev => ({ ...prev, [p.id + '_um']: e.target.value }))}
                            onBlur={() => aggiornaCampo(p.id, 'um', editBuf[p.id + '_um'] ?? p.um)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>P.U. (dal computo)</label>
                          <input readOnly value={fmt(p.prezzo_unitario)} style={{ ...inputSt, width: '100%', textAlign: 'right', background: '#f3f4f6', color: '#6b7280', cursor: 'default' }} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 10, marginTop: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Fonte</label>
                          <select value={p.fonte} style={{ ...inputSt, width: '100%' }}
                            onChange={e => aggiornaCampo(p.id, 'fonte', e.target.value)}>
                            <option value="prezzario">Prezzario</option>
                            <option value="prezzo_nuovo">Prezzo Nuovo</option>
                            <option value="variante">Da Variante</option>
                          </select>
                        </div>
                        {p.fonte === 'prezzario' && (
                          <>
                            <div>
                              <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Prezzario riferimento</label>
                              <input value={editBuf[p.id + '_pref'] ?? (p.prezzario_riferimento || '')} placeholder="es. DEI, Regione Lombardia..."
                                style={{ ...inputSt, width: '100%' }}
                                onChange={e => setEditBuf(prev => ({ ...prev, [p.id + '_pref']: e.target.value }))}
                                onBlur={() => aggiornaCampo(p.id, 'prezzario_riferimento', editBuf[p.id + '_pref'] ?? (p.prezzario_riferimento || ''))} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Anno</label>
                              <input value={editBuf[p.id + '_anno'] ?? (p.anno_prezzario || '')} placeholder="2024"
                                style={{ ...inputSt, width: '100%' }}
                                onChange={e => setEditBuf(prev => ({ ...prev, [p.id + '_anno']: e.target.value }))}
                                onBlur={() => aggiornaCampo(p.id, 'anno_prezzario', editBuf[p.id + '_anno'] ?? (p.anno_prezzario || ''))} />
                            </div>
                          </>
                        )}
                        {p.fonte === 'prezzo_nuovo' && (
                          <>
                            <div>
                              <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Approvato da</label>
                              <input value={editBuf[p.id + '_appr'] ?? (p.approvato_da || '')} placeholder="DL, RUP, SA..."
                                style={{ ...inputSt, width: '100%' }}
                                onChange={e => setEditBuf(prev => ({ ...prev, [p.id + '_appr']: e.target.value }))}
                                onBlur={() => aggiornaCampo(p.id, 'approvato_da', editBuf[p.id + '_appr'] ?? (p.approvato_da || ''))} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Data approvazione</label>
                              <input type="date" value={editBuf[p.id + '_data_appr'] ?? (p.data_approvazione || '')}
                                style={{ ...inputSt, width: '100%' }}
                                onChange={e => setEditBuf(prev => ({ ...prev, [p.id + '_data_appr']: e.target.value }))}
                                onBlur={() => aggiornaCampo(p.id, 'data_approvazione', editBuf[p.id + '_data_appr'] ?? (p.data_approvazione || ''))} />
                            </div>
                          </>
                        )}
                        {p.fonte === 'variante' && (
                          <div>
                            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Variante collegata</label>
                            <select value={p.variante_id || ''} style={{ ...inputSt, width: '100%' }}
                              onChange={e => aggiornaCampo(p.id, 'variante_id', e.target.value)}>
                              <option value="">— Nessuna —</option>
                              {varianti.map(v => <option key={v.id} value={v.id}>Var. {v.numero} — {v.descrizione?.slice(0, 50)}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SEZIONE 2 — Analisi del prezzo */}
                    <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em' }}>Analisi del prezzo — {p.codice}</span>
                        {av.length > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#92400e', fontWeight: 700 }}>Totale € {fmt(av.reduce((s, a) => s + a.importo_unitario, 0))}</span>}
                        {/* Copia da altra tariffa */}
                        {allCodici.length > 0 && (
                          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 9, color: '#78350f' }}>📋 Copia da:</span>
                            <select value={copiaSource} onChange={e => setCopiaSource(e.target.value)}
                              style={{ fontSize: 9, border: '1px solid #fcd34d', borderRadius: 3, padding: '1px 4px', background: '#fffbeb' }}>
                              <option value="">scegli tariffa...</option>
                              {allCodici.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {copiaSource && (
                              <button onClick={() => { copiaAnalisi(copiaSource, p.codice); setCopiaSource('') }}
                                style={{ fontSize: 9, padding: '1px 7px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
                                Copia
                              </button>
                            )}
                          </span>
                        )}
                        <button onClick={() => setAnalisiExp(prev => ({ ...prev, [p.codice]: !analisiExpanded }))}
                          style={{ fontSize: 9, padding: '1px 7px', background: analisiExpanded ? '#fde68a' : '#fffbeb', border: '1px solid #fcd34d', borderRadius: 3, cursor: 'pointer', color: '#78350f', fontWeight: 600, marginLeft: allCodici.length > 0 ? 0 : 'auto' }}>
                          {analisiExpanded ? '▼ Nascondi' : '✏️ Modifica'}
                        </button>
                      </div>

                      {/* Collapsed: pills */}
                      {!analisiExpanded && av.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, padding: '6px 14px', flexWrap: 'wrap' }}>
                          {av.map(a => {
                            const tc = TIPI_ANALISI.find(t => t.value === a.tipo)
                            return (
                              <span key={a.id} style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: tc?.color || '#9ca3af', flexShrink: 0 }} />
                                <span style={{ color: tc?.color, fontWeight: 600 }}>{tc?.label}</span>
                                <span style={{ fontFamily: 'monospace', color: '#374151' }}>€ {fmt(a.importo_unitario)}</span>
                              </span>
                            )
                          })}
                        </div>
                      )}
                      {!analisiExpanded && av.length === 0 && (
                        <div style={{ padding: '6px 14px', fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>Nessuna analisi — clicca "Modifica" per aggiungere componenti di costo</div>
                      )}

                      {/* Expanded: tabella editabile */}
                      {analisiExpanded && (
                        <>
                          {av.length > 0 && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                              <thead>
                                <tr>
                                  <th style={{ padding: '3px 8px', textAlign: 'left', background: '#fffbeb', color: '#78350f', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', borderBottom: '1px solid #fde68a', width: 130 }}>Componente</th>
                                  <th style={{ padding: '3px 8px', textAlign: 'right', background: '#fffbeb', color: '#78350f', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', borderBottom: '1px solid #fde68a', width: 90 }}>€/um</th>
                                  <th style={{ padding: '3px 8px', textAlign: 'right', background: '#fffbeb', color: '#78350f', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', borderBottom: '1px solid #fde68a', width: 60 }}>%</th>
                                  <th style={{ padding: '3px 8px', background: '#fffbeb', borderBottom: '1px solid #fde68a', width: 36 }} />
                                </tr>
                              </thead>
                              <tbody>
                                {av.map(a => {
                                  const tc     = TIPI_ANALISI.find(t => t.value === a.tipo)
                                  const keyIu  = a.id + '_iu'; const keyPct = a.id + '_pct'
                                  const iu     = analisiEdit[keyIu]  ?? String(a.importo_unitario)
                                  const pctV   = analisiEdit[keyPct] ?? String(a.percentuale)
                                  return (
                                    <tr key={a.id} style={{ borderBottom: '1px solid #fef3c7' }}>
                                      <td style={{ padding: '4px 8px' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: tc?.color }}>
                                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tc?.color || '#9ca3af', flexShrink: 0 }} />
                                          {tc?.label || a.tipo}
                                        </span>
                                      </td>
                                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                        <input value={iu} className="cmp-analisi-inp"
                                          style={{ border: '1px solid #fcd34d', borderRadius: 2, padding: '2px 5px', fontSize: 10, fontFamily: 'monospace', background: '#fffde7', outline: 'none', textAlign: 'right', width: 80 }}
                                          onChange={e => setAnalisiEdit(prev => ({ ...prev, [keyIu]: e.target.value }))}
                                          onBlur={() => aggiornaAnalisi(a, 'importo_unitario', iu, p.prezzo_unitario)} />
                                      </td>
                                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                                        <input value={pctV}
                                          style={{ border: '1px solid #fcd34d', borderRadius: 2, padding: '2px 5px', fontSize: 10, fontFamily: 'monospace', background: '#fffde7', outline: 'none', textAlign: 'right', width: 60 }}
                                          onChange={e => setAnalisiEdit(prev => ({ ...prev, [keyPct]: e.target.value }))}
                                          onBlur={() => aggiornaAnalisi(a, 'percentuale', pctV, p.prezzo_unitario)} />
                                      </td>
                                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                        <button onClick={() => eliminaAnalisi(a.id)} style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>🗑</button>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                          <div style={{ padding: '6px 14px', display: 'flex', gap: 5, flexWrap: 'wrap', borderTop: av.length > 0 ? '1px solid #fde68a' : 'none' }}>
                            {TIPI_ANALISI.filter(t => !tipiInBase.has(t.value)).map(t => (
                              <button key={t.value} onClick={() => aggiungiAnalisi(p.codice, t.value)}
                                style={{ fontSize: 9, padding: '2px 7px', background: t.color + '18', color: t.color, border: '1px solid ' + t.color + '40', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                + {t.label}
                              </button>
                            ))}
                            {tipiInBase.size === TIPI_ANALISI.length && <span style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic' }}>Tutti i componenti presenti</span>}
                          </div>

                          {/* Quadro margine */}
                          {av.length > 0 && (() => {
                            const totAv = av.reduce((s, a) => s + (a.importo_unitario || 0), 0)
                            const marg  = p.prezzo_unitario > 0 ? ((p.prezzo_unitario - totAv) / p.prezzo_unitario) * 100 : 0
                            const mColor = marg >= 15 ? '#059669' : marg >= 5 ? '#d97706' : marg >= 0 ? '#dc2626' : '#991b1b'
                            return (
                              <div style={{ display: 'flex', gap: 16, padding: '6px 14px', borderTop: '1px solid #fde68a', background: '#fffde7', fontSize: 10 }}>
                                <span style={{ color: '#6b7280' }}>Costo previsto: <strong style={{ fontFamily: 'monospace' }}>€ {fmt(totAv)}</strong></span>
                                <span style={{ color: '#6b7280' }}>P.U. contratto: <strong style={{ fontFamily: 'monospace' }}>€ {fmt(p.prezzo_unitario)}</strong></span>
                                <span style={{ color: mColor, fontWeight: 700 }}>Margine: € {fmt(p.prezzo_unitario - totAv)} ({marg.toFixed(1)}%)</span>
                              </div>
                            )
                          })()}
                        </>
                      )}
                    </div>

                    {/* SEZIONE 3 — Voci del computo */}
                    {(vocePerCodice[p.codice] || []).length > 0 && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          Voci del computo con tariffa {p.codice} ({(vocePerCodice[p.codice] || []).length})
                        </p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                              {['WBS', 'Descrizione voce', 'Quantità', 'Importo'].map(h => (
                                <th key={h} style={{ padding: '4px 8px', textAlign: ['Quantità', 'Importo'].includes(h) ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(vocePerCodice[p.codice] || []).map(v => (
                              <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 10, color: '#7c3aed' }}>{v.wbs_id || '—'}</td>
                                <td style={{ padding: '4px 8px', color: '#374151', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.descrizione}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{Number(v.quantita).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {p.um}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>€ {fmt(v.importo)}</td>
                              </tr>
                            ))}
                            <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                              <td colSpan={3} style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#6b7280', textAlign: 'right' }}>TOTALE TARIFFA</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
                                € {fmt((vocePerCodice[p.codice] || []).reduce((s, v) => s + (v.importo || 0), 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuovo prezzo */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Nuovo prezzo</h2>

            <div style={{ display: 'flex', gap: 6 }}>
              {[{ v: 'prezzo_nuovo', l: 'Prezzo Nuovo ★' }, { v: 'variante', l: 'Da Variante ●' }, { v: 'prezzario', l: 'Prezzario' }].map(t => (
                <button key={t.v} onClick={() => setFFonte(t.v)}
                  style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: fFonte === t.v ? '2px solid #2563eb' : '1px solid #e5e7eb', background: fFonte === t.v ? '#eff6ff' : '#fff', color: fFonte === t.v ? '#1d4ed8' : '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: fFonte === t.v ? 700 : 400 }}>
                  {t.l}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 60px 100px', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Codice *</label>
                <input value={fCodice} onChange={e => setFCodice(e.target.value)} style={{ ...inputSt, width: '100%', fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Descrizione *</label>
                <input value={fDesc} onChange={e => setFDesc(e.target.value)} style={{ ...inputSt, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>UM</label>
                <input value={fUm} onChange={e => setFUm(e.target.value)} placeholder="mc" style={{ ...inputSt, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Prezzo unitario € *</label>
                <input type="number" step="0.01" value={fPu} onChange={e => setFPu(e.target.value)} style={{ ...inputSt, width: '100%', textAlign: 'right' }} />
              </div>
            </div>

            {fFonte === 'variante' && varianti.length > 0 && (
              <div>
                <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Variante collegata</label>
                <select value={fVariante} onChange={e => setFVariante(e.target.value)} style={{ ...inputSt, width: '100%' }}>
                  <option value="">— Seleziona —</option>
                  {varianti.map(v => <option key={v.id} value={v.id}>Var. {v.numero} — {v.descrizione}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Giustificazione / Note</label>
              <textarea value={fNote} onChange={e => setFNote(e.target.value)} rows={2}
                style={{ ...inputSt, width: '100%', resize: 'none' }} />
            </div>

            {modalErr && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{modalErr}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setModalOpen(false); setModalErr('') }}
                style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                Annulla
              </button>
              <button onClick={handleSaveNuovo}
                style={{ flex: 2, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Crea prezzo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
