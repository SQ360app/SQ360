'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Settings, Loader2, Check, X, ChevronRight, ChevronDown, AlertTriangle, Eye, EyeOff } from 'lucide-react'

const fmt = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtQty = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const TIPO_ACQ: Record<string, { label: string; bg: string; color: string }> = {
  INT: { label: 'INT', bg: '#ede9fe', color: '#4338ca' },
  SUB: { label: 'SUB', bg: '#dbeafe', color: '#1e40af' },
  ACQ: { label: 'ACQ', bg: '#dcfce7', color: '#166534' },
  NC:  { label: 'NC',  bg: '#f3f4f6', color: '#6b7280' },
  NF:  { label: 'NF',  bg: '#f9fafb', color: '#9ca3af' },
}

const TIPO_VOCE: Record<string, { label: string; bg: string; color: string }> = {
  LAVORO:   { label: 'LAV', bg: '#f3f4f6', color: '#374151' },
  SIC:      { label: 'SIC', bg: '#fee2e2', color: '#991b1b' },
  SIC_SPCL: { label: 'SIC.S', bg: '#fee2e2', color: '#b91c1c' },
  MDO:      { label: 'MDO', bg: '#ffedd5', color: '#c2410c' },
  NR:       { label: 'NR',  bg: '#f3f4f6', color: '#6b7280' },
  ECONOMIA: { label: 'ECO', bg: '#fef9c3', color: '#713f12' },
}

interface Voce {
  id: string
  codice: string
  codice_prezzario?: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  capitolo?: string
  sottocapitolo?: string
  voce_capitolo?: string
  tipo_voce?: string
  tipo_assegnazione?: string
  wbs_nodo_id?: string
  soggetta_ribasso?: boolean
  pct_manodopera?: number
  avanzamento_pct?: number
  ordine_albero?: number
}

interface CtxMenu { x: number; y: number; vociIds: string[]; totale: number }

// Nodo corrente del pannello: null = tutto visibile
type PanelNode = { tipo: 'cap' | 'sub' | 'wbs'; valore: string } | null

export default function ComputoPage() {
  const { id } = useParams() as { id: string }
  const [voci, setVoci] = useState<Voce[]>([])
  const [commessa, setCommessa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedCap, setExpandedCap] = useState<Set<string>>(new Set())
  const [expandedSub, setExpandedSub] = useState<Set<string>>(new Set())
  const [nodoCorrente, setNodoCorrente] = useState<PanelNode>(null)
  const [panelVisible, setPanelVisible] = useState(true)
  const [panelTab, setPanelTab] = useState<'cap' | 'wbs'>('cap')
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [showRibassoModal, setShowRibassoModal] = useState(false)
  const [ribasso, setRibasso] = useState(0)
  const lastClickRef = useRef<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Step 1: trova il computo_metrico
      const { data: cm } = await supabase
        .from('computo_metrico')
        .select('id')
        .eq('commessa_id', id)
        .single()

      // Step 2: carica voci
      const { data: v } = cm
        ? await supabase
            .from('voci_computo')
            .select('id,codice,codice_prezzario,descrizione,um,quantita,prezzo_unitario,importo,capitolo,sottocapitolo,voce_capitolo,tipo_voce,tipo_assegnazione,wbs_nodo_id,soggetta_ribasso,pct_manodopera,avanzamento_pct,ordine_albero')
            .eq('computo_id', cm.id)
            .order('ordine_albero', { ascending: true })
            .order('capitolo', { ascending: true })
            .order('sottocapitolo', { ascending: true })
        : { data: [] }

      // Step 3: carica commessa
      const { data: c } = await supabase
        .from('commesse')
        .select('id,nome,importo_contratto,ribasso_pct,importo_sic_psc,pct_sic_pos')
        .eq('id', id)
        .single()

      const safeVoci: Voce[] = (v as Voce[]) || []
      setVoci(safeVoci)
      setCommessa(c)
      setRibasso(Number(c?.ribasso_pct) || 0)

      // Espandi tutti i capitoli di default
      const caps = new Set<string>()
      const subs = new Set<string>()
      safeVoci.forEach(vo => {
        if (vo.capitolo) caps.add(vo.capitolo)
        if (vo.capitolo && vo.sottocapitolo) subs.add(vo.capitolo + '|' + vo.sottocapitolo)
      })
      setExpandedCap(caps)
      setExpandedSub(subs)
    } catch (e) {
      console.error('Load error:', e)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Filtra voci in base al nodo corrente
  const vociFiltrate: Voce[] = nodoCorrente
    ? voci.filter(v => {
        if (nodoCorrente.tipo === 'cap') return v.capitolo === nodoCorrente.valore
        if (nodoCorrente.tipo === 'sub') return nodoCorrente.valore === (v.capitolo + '|' + v.sottocapitolo)
        if (nodoCorrente.tipo === 'wbs') return v.wbs_nodo_id === nodoCorrente.valore
        return true
      })
    : voci

  // Albero capitoli da voci filtrate
  const treeMap: Record<string, Record<string, Voce[]>> = {}
  vociFiltrate.forEach(v => {
    const cap = v.capitolo || '(Senza capitolo)'
    const sub = v.sottocapitolo || ''
    if (!treeMap[cap]) treeMap[cap] = {}
    if (!treeMap[cap][sub]) treeMap[cap][sub] = []
    treeMap[cap][sub].push(v)
  })

  // Raggruppamento WBS per sidebar
  const wbsMap: Record<string, { label: string; voci: Voce[]; totale: number }> = {}
  voci.forEach(v => {
    const key = v.wbs_nodo_id || '__nessuna__'
    if (!wbsMap[key]) wbsMap[key] = { label: key === '__nessuna__' ? '— nessuna WBS' : key, voci: [], totale: 0 }
    wbsMap[key].voci.push(v)
    wbsMap[key].totale += v.importo || 0
  })

  // Totali
  const totSoggetti = voci.filter(v => v.soggetta_ribasso !== false && v.tipo_voce !== 'SIC' && v.tipo_voce !== 'SIC_SPCL').reduce((s, v) => s + (v.importo || 0), 0)
  const totSic = voci.filter(v => v.tipo_voce === 'SIC' || v.tipo_voce === 'SIC_SPCL').reduce((s, v) => s + (v.importo || 0), 0)
  const totMdo = voci.filter(v => v.tipo_voce === 'MDO').reduce((s, v) => s + (v.importo || 0), 0)
  const baseAsta = totSoggetti + totSic + totMdo
  const ribassoEur = totSoggetti * (ribasso / 100)
  const contratto = totSoggetti - ribassoEur + totSic + totMdo

  const voceNoWbs = voci.filter(v => !v.wbs_nodo_id).length
  const voceNoTipo = voci.filter(v => !v.tipo_assegnazione).length

  // Selezione voci
  function handleClick(voceId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const ns = new Set(selected)
    if (e.ctrlKey || e.metaKey) {
      ns.has(voceId) ? ns.delete(voceId) : ns.add(voceId)
    } else if (e.shiftKey && lastClickRef.current) {
      const flat = vociFiltrate.map(v => v.id)
      const a = flat.indexOf(lastClickRef.current)
      const b = flat.indexOf(voceId)
      const lo = Math.min(a, b), hi = Math.max(a, b)
      for (let i = lo; i <= hi; i++) ns.add(flat[i])
    } else {
      ns.clear(); ns.add(voceId)
    }
    lastClickRef.current = voceId
    setSelected(ns)
  }

  function selCapitolo(capName: string) {
    const ids = voci.filter(v => v.capitolo === capName).map(v => v.id)
    setSelected(new Set(ids))
  }

  function openCtx(e: React.MouseEvent, voceId?: string) {
    e.preventDefault()
    const selIds = voceId && !selected.has(voceId) ? [voceId] : Array.from(selected)
    if (voceId && !selected.has(voceId)) setSelected(new Set([voceId]))
    const tot = voci.filter(v => selIds.includes(v.id)).reduce((s, v) => s + (v.importo || 0), 0)
    const rect = editorRef.current?.getBoundingClientRect()
    const x = Math.min((rect ? e.clientX - rect.left : e.clientX), (rect?.width || 800) - 275)
    const y = Math.min((rect ? e.clientY - rect.top : e.clientY), (rect?.height || 600) - 380)
    setCtxMenu({ x: Math.max(0, x), y: Math.max(0, y), vociIds: selIds, totale: tot })
  }

  async function batchAssign(field: string, value: string) {
    setCtxMenu(null)
    if (selected.size === 0) return
    await supabase.from('voci_computo').update({ [field]: value || null }).in('id', Array.from(selected))
    load()
  }

  function setNodo(n: PanelNode) {
    // Toggle: stesso nodo = deseleziona (mostra tutto)
    if (nodoCorrente && n &&
        nodoCorrente.tipo === n.tipo &&
        nodoCorrente.valore === n.valore) {
      setNodoCorrente(null)
    } else {
      setNodoCorrente(n)
    }
  }

  async function saveRibasso() {
    await supabase.from('commesse').update({ ribasso_pct: ribasso }).eq('id', id)
    setShowRibassoModal(false)
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8, color: '#9ca3af' }}>
      <Loader2 size={20} className="animate-spin" />
      Caricamento computo ({voci.length} voci)...
    </div>
  )

  // ---------- RENDER ----------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', overflow: 'hidden' }} onClick={() => setCtxMenu(null)}>

      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => setPanelVisible(v => !v)} title={panelVisible ? 'Nascondi pannello struttura' : 'Mostra pannello struttura'}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: panelVisible ? '#eff6ff' : '#fff', color: panelVisible ? '#2563eb' : '#6b7280', cursor: 'pointer' }}>
          {panelVisible ? <Eye size={12} /> : <EyeOff size={12} />}
          {panelVisible ? 'Struttura' : 'Struttura'}
        </button>

        {nodoCorrente && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 11, color: '#1e40af' }}>
            <span>Filtro attivo: <strong>{nodoCorrente.tipo === 'wbs' ? 'WBS ' : ''}{nodoCorrente.valore.replace('|', ' › ')}</strong></span>
            <button onClick={() => setNodoCorrente(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
              <X size={12} />
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {voceNoWbs > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6, border: '1px solid #fcd34d', cursor: 'pointer' }}
            title="Clicca per vedere le voci senza WBS">
            ⚠ {voceNoWbs} senza WBS
          </span>
        )}
        {voceNoTipo > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6, border: '1px solid #fcd34d' }}>
            ⚠ {voceNoTipo} senza tipo
          </span>
        )}

        <button onClick={() => setShowRibassoModal(true)}
          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: ribasso > 0 ? '#eff6ff' : '#fff', color: ribasso > 0 ? '#1e40af' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Settings size={12} /> {ribasso > 0 ? 'Ribasso ' + ribasso.toFixed(2) + '%' : 'Config. ribasso'}
        </button>
      </div>

      {/* BARRA SELEZIONE */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 11, color: '#1e40af', flexShrink: 0 }}>
          <Check size={12} />
          <strong>{selected.size} voci</strong>
          <span style={{ color: '#93c5fd' }}>·</span>
          <span>EUR {fmt(voci.filter(v => selected.has(v.id)).reduce((s, v) => s + (v.importo || 0), 0))}</span>
          <div style={{ flex: 1 }} />
          <button onClick={e => { e.stopPropagation(); openCtx(e) }}
            style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #93c5fd', borderRadius: 6, background: '#fff', color: '#1e40af', cursor: 'pointer' }}>
            Crea RDA →
          </button>
          <button onClick={e => { e.stopPropagation(); openCtx(e) }}
            style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #93c5fd', borderRadius: 6, background: '#fff', color: '#1e40af', cursor: 'pointer' }}>
            Azioni ▾
          </button>
          <button onClick={() => setSelected(new Set())}
            style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#6b7280', cursor: 'pointer' }}>
            × Deseleziona
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* PANNELLO STRUTTURA — nascondibile, con tab Capitoli/WBS */}
        {panelVisible && (
          <div style={{ width: 210, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#f9fafb', flexShrink: 0, overflow: 'hidden' }}>

            {/* Tab switcher */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              {(['cap', 'wbs'] as const).map(t => (
                <button key={t} onClick={() => setPanelTab(t)}
                  style={{ flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: panelTab === t ? 600 : 400, border: 'none', borderBottom: panelTab === t ? '2px solid #2563eb' : '2px solid transparent', background: 'transparent', color: panelTab === t ? '#2563eb' : '#6b7280', cursor: 'pointer' }}>
                  {t === 'cap' ? 'Capitoli' : 'WBS'}
                </button>
              ))}
            </div>

            <div style={{ overflowY: 'auto', flex: 1, fontSize: 11 }}>

              {/* "Tutto" sempre visibile */}
              <div onClick={() => setNodoCorrente(null)}
                style={{ padding: '6px 10px', cursor: 'pointer', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: !nodoCorrente ? '#dbeafe' : 'transparent',
                  color: !nodoCorrente ? '#1e40af' : '#374151',
                  borderBottom: '1px solid #e5e7eb' }}>
                <span>Tutto il computo</span>
                <span style={{ fontSize: 10, color: '#6b7280' }}>{voci.length}</span>
              </div>

              {panelTab === 'cap' && (
                <>
                  {Object.entries(treeMap).map(([capName, subMap]) => {
                    const capTot = Object.values(subMap).flat().reduce((s, v) => s + (v.importo || 0), 0)
                    const isCapCurrent = nodoCorrente?.tipo === 'cap' && nodoCorrente.valore === capName
                    const isCapExp = expandedCap.has(capName)
                    return (
                      <div key={capName}>
                        {/* Header capitolo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', cursor: 'pointer', borderTop: '1px solid #e5e7eb',
                          background: isCapCurrent ? '#dbeafe' : '#f3f4f6',
                          color: isCapCurrent ? '#1e40af' : '#374151', fontWeight: 500 }}>
                          <span style={{ fontSize: 9, color: '#9ca3af', cursor: 'pointer' }}
                            onClick={e => { e.stopPropagation(); const ns = new Set(expandedCap); ns.has(capName) ? ns.delete(capName) : ns.add(capName); setExpandedCap(ns) }}>
                            {isCapExp ? '▼' : '▶'}
                          </span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            onClick={() => setNodo({ tipo: 'cap', valore: capName })}>
                            {capName}
                          </span>
                          <span style={{ fontSize: 9, color: '#6b7280', flexShrink: 0 }}>
                            {fmt(capTot).split(',')[0]}
                          </span>
                        </div>
                        {/* Sottocapitoli */}
                        {isCapExp && Object.entries(subMap).filter(([s]) => s).map(([subName, sv]) => {
                          const subKey = capName + '|' + subName
                          const isSubCurrent = nodoCorrente?.tipo === 'sub' && nodoCorrente.valore === subKey
                          return (
                            <div key={subName} onClick={() => setNodo({ tipo: 'sub', valore: subKey })}
                              style={{ padding: '4px 8px 4px 22px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                                background: isSubCurrent ? '#eff6ff' : 'transparent',
                                color: isSubCurrent ? '#2563eb' : '#6b7280', borderTop: '1px solid #f3f4f6' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{subName}</span>
                              <span style={{ fontSize: 9, flexShrink: 0 }}>{sv.length}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                  {/* Sicurezza e MDO in sidebar */}
                  {totSic > 0 && (
                    <div style={{ margin: '8px 8px 0', padding: '6px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#991b1b' }}>Sicurezza PSC</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626' }}>EUR {fmt(totSic)}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>non soggetta a ribasso</div>
                    </div>
                  )}
                  {totMdo > 0 && (
                    <div style={{ margin: '6px 8px 8px', padding: '6px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#166534' }}>Manodopera MDO</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>EUR {fmt(totMdo)}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af' }}>non soggetta a ribasso</div>
                    </div>
                  )}
                </>
              )}

              {panelTab === 'wbs' && (
                <>
                  {Object.entries(wbsMap).filter(([k]) => k !== '__nessuna__').map(([key, w]) => {
                    const isWbsCurrent = nodoCorrente?.tipo === 'wbs' && nodoCorrente.valore === key
                    return (
                      <div key={key} onClick={() => setNodo({ tipo: 'wbs', valore: key })}
                        style={{ padding: '6px 10px', cursor: 'pointer', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: isWbsCurrent ? '#dbeafe' : 'transparent',
                          color: isWbsCurrent ? '#1e40af' : '#374151' }}>
                        <div>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{w.label}</div>
                          <div style={{ fontSize: 9, color: '#6b7280' }}>{w.voci.length} voci</div>
                        </div>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>{fmt(w.totale).split(',')[0]}</span>
                      </div>
                    )
                  })}
                  {wbsMap['__nessuna__'] && (
                    <div onClick={() => setNodo({ tipo: 'wbs', valore: '__nessuna__' })}
                      style={{ padding: '6px 10px', cursor: 'pointer', borderTop: '1px solid #e5e7eb', background: '#fef2f2', color: '#dc2626' }}>
                      <div style={{ fontWeight: 500 }}>⚠ Nessuna WBS</div>
                      <div style={{ fontSize: 9 }}>{wbsMap['__nessuna__'].voci.length} voci non assegnate</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* EDITOR COMPUTO */}
        <div ref={editorRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}
          onClick={() => setCtxMenu(null)}>

          {/* HEADER COLONNE */}
          <div style={{ display: 'grid', gridTemplateColumns: '20px 70px minmax(200px,1fr) 36px 80px 78px 90px 62px 44px 56px', padding: '5px 8px', background: '#f3f4f6', borderBottom: '2px solid #d1d5db', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, zIndex: 10, gap: 4 }}>
            <span />
            <span>Codice</span>
            <span>Descrizione voce</span>
            <span style={{ textAlign: 'center' }}>UM</span>
            <span style={{ textAlign: 'right' }}>Quantità</span>
            <span style={{ textAlign: 'right' }}>P.U. €</span>
            <span style={{ textAlign: 'right' }}>Importo €</span>
            <span style={{ textAlign: 'center' }}>WBS</span>
            <span style={{ textAlign: 'center' }}>Tipo</span>
            <span style={{ textAlign: 'center' }}>Avanz.</span>
          </div>

          {/* ALBERO CAPITOLI */}
          {Object.entries(treeMap).length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9ca3af' }}>
              <AlertTriangle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>Nessuna voce trovata{nodoCorrente ? ' per questo filtro' : ''}</p>
            </div>
          ) : Object.entries(treeMap).map(([capName, subMap]) => {
            const capTot = Object.values(subMap).flat().reduce((s, v) => s + (v.importo || 0), 0)
            const isCapExp = expandedCap.has(capName)
            const capVociCount = Object.values(subMap).flat().length
            return (
              <div key={capName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                {/* HEADER CAPITOLO */}
                <div style={{ display: 'grid', gridTemplateColumns: '20px 70px minmax(200px,1fr) 36px 80px 78px 90px 62px 44px 56px', gap: 4, padding: '6px 8px', background: '#eef2ff', cursor: 'pointer', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#6b7280', userSelect: 'none' }}
                    onClick={() => { const ns = new Set(expandedCap); ns.has(capName) ? ns.delete(capName) : ns.add(capName); setExpandedCap(ns) }}>
                    {isCapExp ? '▼' : '▶'}
                  </span>
                  <span onClick={() => selCapitolo(capName)} style={{ cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: 12, height: 12, accentColor: '#2563eb' }}
                      checked={voci.filter(v => v.capitolo === capName).every(v => selected.has(v.id)) && voci.filter(v => v.capitolo === capName).length > 0}
                      onChange={() => selCapitolo(capName)}
                      onClick={e => e.stopPropagation()} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1e3a8a' }}
                    onClick={() => setNodo({ tipo: 'cap', valore: capName })}>
                    {capName}
                  </span>
                  <span />
                  <span />
                  <span />
                  <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1e3a8a' }}>
                    {fmt(capTot)}
                  </span>
                  <span />
                  <span style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 9, padding: '1px 4px', background: '#c7d2fe', color: '#3730a3', borderRadius: 3 }}>
                      {capVociCount}
                    </span>
                  </span>
                  <span />
                </div>

                {isCapExp && Object.entries(subMap).map(([subName, sv]) => {
                  const subKey = capName + '|' + subName
                  const subTot = sv.reduce((s, v) => s + (v.importo || 0), 0)
                  const isSubExp = expandedSub.has(subKey) || !subName
                  return (
                    <div key={subName || '_nosub'}>
                      {/* SOTTOCAPITOLO */}
                      {subName && (
                        <div onClick={() => { const ns = new Set(expandedSub); ns.has(subKey) ? ns.delete(subKey) : ns.add(subKey); setExpandedSub(ns) }}
                          style={{ display: 'grid', gridTemplateColumns: '20px 70px minmax(200px,1fr) 36px 80px 78px 90px 62px 44px 56px', gap: 4, padding: '4px 8px 4px 20px', background: '#f8faff', cursor: 'pointer', alignItems: 'center', borderTop: '1px solid #e5e7eb' }}>
                          <span style={{ fontSize: 9, color: '#9ca3af' }}>{isSubExp ? '▼' : '▶'}</span>
                          <span />
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}
                            onClick={e => { e.stopPropagation(); setNodo({ tipo: 'sub', valore: subKey }) }}>
                            {subName}
                          </span>
                          <span />
                          <span />
                          <span />
                          <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#4b5563' }}>{fmt(subTot)}</span>
                          <span />
                          <span style={{ textAlign: 'center', fontSize: 9, color: '#9ca3af' }}>{sv.length}</span>
                          <span />
                        </div>
                      )}

                      {/* VOCI */}
                      {isSubExp && sv.map(v => {
                        const isSel = selected.has(v.id)
                        const acq = TIPO_ACQ[v.tipo_assegnazione || '']
                        const tvo = TIPO_VOCE[v.tipo_voce || 'LAVORO']
                        const isSic = v.tipo_voce === 'SIC' || v.tipo_voce === 'SIC_SPCL'
                        const avanz = v.avanzamento_pct || 0
                        const indent = subName ? '28px' : '16px'
                        return (
                          <div key={v.id}
                            onClick={e => handleClick(v.id, e)}
                            onContextMenu={e => openCtx(e, v.id)}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '20px 70px minmax(200px,1fr) 36px 80px 78px 90px 62px 44px 56px',
                              gap: 4,
                              padding: '5px 8px 5px ' + indent,
                              borderTop: '1px solid #f3f4f6',
                              background: isSel ? '#dbeafe' : isSic ? '#fff5f5' : '#fff',
                              borderLeft: isSel ? '3px solid #2563eb' : isSic ? '3px solid #fca5a5' : '3px solid transparent',
                              cursor: 'pointer',
                              transition: 'background 0.08s',
                              alignItems: 'start',
                            }}>

                            {/* Checkbox */}
                            <span style={{ paddingTop: 2 }}>
                              <input type="checkbox" checked={isSel} onChange={() => {}}
                                onClick={e => { e.stopPropagation(); const ns = new Set(selected); ns.has(v.id) ? ns.delete(v.id) : ns.add(v.id); setSelected(ns) }}
                                style={{ width: 12, height: 12, accentColor: '#2563eb', cursor: 'pointer' }} />
                            </span>

                            {/* Codice */}
                            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280', paddingTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {v.codice || v.codice_prezzario || '—'}
                            </span>

                            {/* DESCRIZIONE COMPLETA — mai troncata, va a capo */}
                            <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.5, paddingRight: 6 }}>
                              <div>{v.descrizione}</div>
                              {isSic && (
                                <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10, padding: '1px 5px', background: '#fee2e2', color: '#991b1b', borderRadius: 3 }}>
                                  SIC — non soggetta a ribasso
                                </span>
                              )}
                              {v.pct_manodopera && v.pct_manodopera > 0 && (
                                <span style={{ display: 'inline-block', marginTop: 3, marginLeft: 4, fontSize: 10, color: '#6b7280' }}>
                                  MDO: {v.pct_manodopera}%
                                </span>
                              )}
                            </div>

                            {/* UM */}
                            <span style={{ fontSize: 11, textAlign: 'center', color: '#6b7280', paddingTop: 2 }}>{v.um}</span>

                            {/* Quantità */}
                            <span style={{ fontSize: 11, textAlign: 'right', color: '#374151', paddingTop: 2, fontFamily: 'tabular-nums' }}>{fmtQty(v.quantita)}</span>

                            {/* P.U. */}
                            <span style={{ fontSize: 11, textAlign: 'right', color: '#374151', paddingTop: 2, fontFamily: 'tabular-nums' }}>{fmt(v.prezzo_unitario)}</span>

                            {/* Importo */}
                            <span style={{ fontSize: 12, textAlign: 'right', fontWeight: 600, color: isSic ? '#dc2626' : '#111827', paddingTop: 2, fontFamily: 'tabular-nums' }}>
                              {fmt(v.importo)}
                            </span>

                            {/* WBS */}
                            <span style={{ textAlign: 'center', paddingTop: 2 }}>
                              {v.wbs_nodo_id ? (
                                <span style={{ fontSize: 9, padding: '2px 4px', background: '#fef9c3', color: '#713f12', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', display: 'block', textOverflow: 'ellipsis', maxWidth: 58 }}>
                                  WBS ✓
                                </span>
                              ) : (
                                <span style={{ fontSize: 9, padding: '2px 4px', background: '#fee2e2', color: '#991b1b', borderRadius: 3 }}>⚠</span>
                              )}
                            </span>

                            {/* Tipo acquisto */}
                            <span style={{ textAlign: 'center', paddingTop: 2 }}>
                              {acq ? (
                                <span style={{ fontSize: 9, padding: '2px 4px', background: acq.bg, color: acq.color, borderRadius: 3 }}>{acq.label}</span>
                              ) : (
                                <span style={{ fontSize: 9, padding: '2px 4px', background: '#fee2e2', color: '#991b1b', borderRadius: 3 }}>—</span>
                              )}
                            </span>

                            {/* Avanzamento */}
                            <span style={{ paddingTop: 4 }}>
                              <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                                <div style={{ height: '100%', width: avanz + '%', background: avanz >= 100 ? '#059669' : avanz > 0 ? '#2563eb' : 'transparent', borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 9, color: avanz > 0 ? '#2563eb' : '#d1d5db' }}>{avanz}%</span>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* MENU CONTESTUALE */}
          {ctxMenu && (
            <div style={{ position: 'absolute', top: ctxMenu.y, left: ctxMenu.x, zIndex: 1000, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', width: 268, overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}>

              <div style={{ padding: '8px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 11, color: '#1e40af', fontWeight: 600 }}>
                {ctxMenu.vociIds.length} {ctxMenu.vociIds.length === 1 ? 'voce' : 'voci'} · EUR {fmt(ctxMenu.totale)}
              </div>

              {/* CREA DOCUMENTI */}
              <div style={{ borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>
                <div style={{ padding: '2px 12px 4px', fontSize: 10, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Crea documenti</div>
                {[
                  { label: 'Crea RDA — ' + ctxMenu.vociIds.length + ' voci → 1 RDA', note: '', primary: true },
                  { label: 'Crea RDO con richiesta docs', note: '→ 1 RDO', primary: true },
                  { label: 'Crea ODA diretto', note: '', primary: false },
                ].map(({ label, note, primary }) => (
                  <div key={label} onClick={() => setCtxMenu(null)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: primary ? '#1e40af' : '#374151', fontWeight: primary ? 500 : 400 }}
                    onMouseOver={e => (e.currentTarget.style.background = '#f8faff')}
                    onMouseOut={e => (e.currentTarget.style.background = '')}>
                    <span>{label}</span>
                    {note && <span style={{ fontSize: 10, color: '#9ca3af' }}>{note}</span>}
                  </div>
                ))}
              </div>

              {/* ASSEGNA */}
              <div style={{ borderBottom: '1px solid #f3f4f6', padding: '6px 12px' }}>
                <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Assegna a tutte le voci</div>

                {/* Cambia capitolo */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 3 }}>📁 Cambia capitolo</label>
                  <input placeholder="es. STRUTTURE, INFISSI..."
                    onKeyDown={e => { if (e.key === 'Enter') batchAssign('capitolo', (e.target as HTMLInputElement).value) }}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', boxSizing: 'border-box' }} />
                </div>

                {/* Tipo acquisto */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 3 }}>🏷 Tipo acquisto</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Object.entries(TIPO_ACQ).map(([k, b]) => (
                      <button key={k} onClick={() => batchAssign('tipo_assegnazione', k)}
                        style={{ fontSize: 10, padding: '3px 7px', border: '1px solid ' + b.color, borderRadius: 4, background: b.bg, color: b.color, cursor: 'pointer' }}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flag sicurezza */}
                <div>
                  <label style={{ fontSize: 11, color: '#374151', display: 'block', marginBottom: 3 }}>🔒 Tipo voce</label>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {Object.entries(TIPO_VOCE).map(([k, b]) => (
                      <button key={k} onClick={() => batchAssign('tipo_voce', k)}
                        style={{ fontSize: 10, padding: '2px 6px', border: '1px solid ' + b.color, borderRadius: 4, background: b.bg, color: b.color, cursor: 'pointer' }}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* GESTIONE */}
              <div style={{ padding: '4px 0' }}>
                {[
                  { icon: '📊', label: 'Esporta selezione Excel' },
                  { icon: '🖨', label: 'Stampa voci selezionate' },
                ].map(({ icon, label }) => (
                  <div key={label} onClick={() => setCtxMenu(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#374151' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseOut={e => (e.currentTarget.style.background = '')}>
                    <span style={{ fontSize: 14 }}>{icon}</span>{label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER TOTALI */}
      <div style={{ borderTop: '2px solid #d1d5db', background: '#f8faff', padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 11 }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>Lavori (soggetti a ribasso)</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>EUR {fmt(totSoggetti)}</div>
          {ribasso > 0 && <div style={{ color: '#dc2626', fontSize: 11 }}>− {ribasso.toFixed(2)}% = EUR {fmt(ribassoEur)}</div>}
          {totSic > 0 && <div style={{ color: '#991b1b', fontSize: 10 }}>+ Sic.: EUR {fmt(totSic)}</div>}
          {totMdo > 0 && <div style={{ color: '#166534', fontSize: 10 }}>+ MDO: EUR {fmt(totMdo)}</div>}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11 }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>Base d'asta</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>EUR {fmt(baseAsta)}</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>{voci.length} voci · {vociFiltrate.length !== voci.length ? vociFiltrate.length + ' visibili' : ''}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>Importo contratto</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#059669' }}>EUR {fmt(contratto)}</div>
          {ribasso > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>dopo ribasso {ribasso.toFixed(2)}%</div>}
        </div>
      </div>

      {/* MODAL RIBASSO */}
      {showRibassoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
          onClick={() => setShowRibassoModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>Configurazione ribasso</h3>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ribasso d'asta offerto (%)</label>
            <input type="number" step="0.001" min="0" max="100" value={ribasso}
              onChange={e => setRibasso(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', boxSizing: 'border-box', marginBottom: 12 }} />
            <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
              <div>Lavori soggetti: EUR {fmt(totSoggetti)}</div>
              <div style={{ color: '#dc2626' }}>Ribasso {ribasso.toFixed(3)}%: − EUR {fmt(totSoggetti * ribasso / 100)}</div>
              <div style={{ fontWeight: 600, marginTop: 4, color: '#059669' }}>Contratto lavori: EUR {fmt(totSoggetti * (1 - ribasso / 100))}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRibassoModal(false)}
                style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Annulla
              </button>
              <button onClick={saveRibasso}
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
