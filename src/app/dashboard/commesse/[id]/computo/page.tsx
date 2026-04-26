'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ChevronRight, ChevronDown, Plus, Settings, AlertTriangle,
  FileText, Loader2, Check, MoreHorizontal, X, Filter
} from 'lucide-react'

const fmt = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtQty = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const TIPO_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  INT: { label: 'INT', bg: '#f5f3ff', color: '#4338ca' },
  SUB: { label: 'SUB', bg: '#eff6ff', color: '#1e40af' },
  ACQ: { label: 'ACQ', bg: '#f0fdf4', color: '#166534' },
  NC:  { label: 'NC',  bg: '#f9fafb', color: '#6b7280' },
  NF:  { label: 'NF',  bg: '#fafafa', color: '#9ca3af' },
}

const TIPO_VOCE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  LAVORO:   { label: 'Lavoro', bg: '#f3f4f6', color: '#374151' },
  SIC:      { label: 'SIC',   bg: '#fef2f2', color: '#991b1b' },
  SIC_SPCL: { label: 'SIC.S', bg: '#fef2f2', color: '#b91c1c' },
  MDO:      { label: 'MDO',   bg: '#fff7ed', color: '#c2410c' },
  NR:       { label: 'NR',    bg: '#fafafa', color: '#6b7280' },
  ECONOMIA: { label: 'Econ.', bg: '#fefce8', color: '#713f12' },
}

interface VoceComputo {
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
  pct_sicurezza?: number
  avanzamento_pct?: number
  categoria_og_os?: string
  tipo_lavoro?: string
  ordine_albero?: number
}

interface Capitolo {
  nome: string
  sottocapitoli: Record<string, { nome: string; voci: VoceComputo[] }>
  totale: number
}

interface CtxMenu {
  x: number; y: number
  voci: string[]
  totale: number
}

export default function ComputoPage() {
  const { id } = useParams() as { id: string }
  const [voci, setVoci] = useState<VoceComputo[]>([])
  const [commessa, setCommessa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [filterCapitolo, setFilterCapitolo] = useState<string | null>(null)
  const [showRibassoModal, setShowRibassoModal] = useState(false)
  const [ribasso, setRibasso] = useState(0)
  const lastClickedRef = useRef<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('voci_computo')
        .select('*')
        .eq('computo_id', (await supabase.from('computo_metrico').select('id').eq('commessa_id', id).single()).data?.id)
        .order('ordine_albero', { ascending: true })
        .order('capitolo', { ascending: true })
        .order('sottocapitolo', { ascending: true }),
      supabase.from('commesse').select('*').eq('id', id).single()
    ])
    setVoci(v || [])
    setCommessa(c)
    setRibasso(c?.ribasso_pct || 0)
    // Espandi tutti i capitoli di default
    const caps = new Set<string>()
    ;(v || []).forEach((vo: VoceComputo) => {
      if (vo.capitolo) caps.add('cap_' + vo.capitolo)
      if (vo.capitolo && vo.sottocapitolo) caps.add('sub_' + vo.capitolo + '_' + vo.sottocapitolo)
    })
    setExpanded(caps)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Raggruppa voci in albero
  const tree: Record<string, Capitolo> = {}
  const vociFiltered = filterCapitolo
    ? voci.filter(v => v.capitolo === filterCapitolo)
    : voci

  vociFiltered.forEach(v => {
    const cap = v.capitolo || '(Senza capitolo)'
    const sub = v.sottocapitolo || ''
    if (!tree[cap]) tree[cap] = { nome: cap, sottocapitoli: {}, totale: 0 }
    if (!tree[cap].sottocapitoli[sub]) tree[cap].sottocapitoli[sub] = { nome: sub, voci: [] }
    tree[cap].sottocapitoli[sub].voci.push(v)
    tree[cap].totale += v.importo || 0
  })

  // Totali
  const totaleBase = voci.filter(v => v.soggetta_ribasso !== false).reduce((s, v) => s + (v.importo || 0), 0)
  const totaleSic = voci.filter(v => v.tipo_voce === 'SIC' || v.tipo_voce === 'SIC_SPCL').reduce((s, v) => s + (v.importo || 0), 0)
  const totaleMdo = voci.filter(v => v.tipo_voce === 'MDO').reduce((s, v) => s + (v.importo || 0), 0)
  const totaleNR = voci.filter(v => v.soggetta_ribasso === false && v.tipo_voce !== 'SIC' && v.tipo_voce !== 'SIC_SPCL' && v.tipo_voce !== 'MDO').reduce((s, v) => s + (v.importo || 0), 0)
  const baseAsta = totaleBase + totaleSic + totaleMdo + totaleNR
  const ribassoEuro = totaleBase * (ribasso / 100)
  const contratto = totaleBase - ribassoEuro + totaleSic + totaleMdo + totaleNR + (commessa?.importo_sic_psc || 0)

  // Voci non assegnate
  const voceNoWbs = voci.filter(v => !v.wbs_nodo_id).length
  const voceNoTipo = voci.filter(v => !v.tipo_assegnazione).length

  // Selezione
  function toggleSelect(voceId: string, e: React.MouseEvent) {
    const newSel = new Set(selected)
    if (e.ctrlKey || e.metaKey) {
      if (newSel.has(voceId)) newSel.delete(voceId)
      else newSel.add(voceId)
    } else if (e.shiftKey && lastClickedRef.current) {
      const flat = vociFiltered.map(v => v.id)
      const from = flat.indexOf(lastClickedRef.current)
      const to = flat.indexOf(voceId)
      const start = Math.min(from, to)
      const end = Math.max(from, to)
      for (let i = start; i <= end; i++) newSel.add(flat[i])
    } else {
      newSel.clear()
      newSel.add(voceId)
    }
    lastClickedRef.current = voceId
    setSelected(newSel)
  }

  function toggleCapitolo(key: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  function selectCapitolo(capName: string, e: React.MouseEvent) {
    e.stopPropagation()
    const ids = voci.filter(v => v.capitolo === capName).map(v => v.id)
    setSelected(new Set(ids))
  }

  function onCtxMenu(e: React.MouseEvent, voceId?: string) {
    e.preventDefault()
    const vociSel = voceId && !selected.has(voceId) ? [voceId] : Array.from(selected)
    if (voceId && !selected.has(voceId)) setSelected(new Set([voceId]))
    const tot = voci.filter(v => vociSel.includes(v.id)).reduce((s, v) => s + (v.importo || 0), 0)
    const rect = editorRef.current?.getBoundingClientRect()
    const rx = rect ? e.clientX - rect.left : e.clientX
    const ry = rect ? e.clientY - rect.top : e.clientY
    setCtxMenu({ x: Math.min(rx, (rect?.width || 800) - 270), y: Math.min(ry, (rect?.height || 600) - 420), voci: vociSel, totale: tot })
  }

  async function batchAssign(field: string, value: string) {
    setCtxMenu(null)
    const ids = Array.from(selected)
    await supabase.from('voci_computo').update({ [field]: value }).in('id', ids)
    load()
  }

  async function saveRibasso() {
    await supabase.from('commesse').update({ ribasso_pct: ribasso }).eq('id', id)
    setShowRibassoModal(false)
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8, color: '#9ca3af' }}>
      <Loader2 size={20} className="animate-spin" /> Caricamento computo...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - 120px)', overflow: 'hidden' }}>

      {/* BARRA SUPERIORE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Computo metrico</span>
        <div style={{ flex: 1 }} />
        {/* Alert voci non assegnate */}
        {voceNoWbs > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6, border: '1px solid #fcd34d' }}>
            ⚠ {voceNoWbs} voci senza WBS
          </span>
        )}
        {voceNoTipo > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6, border: '1px solid #fcd34d' }}>
            ⚠ {voceNoTipo} senza tipo
          </span>
        )}
        <button onClick={() => setShowRibassoModal(true)}
          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: ribasso > 0 ? '#eff6ff' : '#fff', color: ribasso > 0 ? '#1e40af' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Settings size={12} />
          {ribasso > 0 ? 'Ribasso ' + ribasso.toFixed(2) + '%' : 'Configura ribasso'}
        </button>
      </div>

      {/* BARRA SELEZIONE MULTIPLA */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 11, color: '#1e40af', flexShrink: 0 }}>
          <Check size={13} />
          <span style={{ fontWeight: 600 }}>{selected.size} voci selezionate</span>
          <span style={{ color: '#93c5fd' }}>·</span>
          <span>EUR {fmt(voci.filter(v => selected.has(v.id)).reduce((s, v) => s + (v.importo || 0), 0))}</span>
          <span style={{ color: '#93c5fd' }}>·</span>
          <span>{((voci.filter(v => selected.has(v.id)).reduce((s, v) => s + (v.importo || 0), 0) / baseAsta) * 100).toFixed(1)}%</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setCtxMenu({ x: 12, y: 50, voci: Array.from(selected), totale: voci.filter(v => selected.has(v.id)).reduce((s, v) => s + (v.importo || 0), 0) })}
            style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #93c5fd', borderRadius: 6, background: '#fff', color: '#1e40af', cursor: 'pointer' }}>
            Crea RDA →
          </button>
          <button onClick={() => setCtxMenu({ x: 12, y: 50, voci: Array.from(selected), totale: 0 })}
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

        {/* PANNELLO STRUTTURA SINISTRA */}
        <div style={{ width: 200, borderRight: '1px solid #e5e7eb', overflowY: 'auto', background: '#f9fafb', flexShrink: 0, fontSize: 11 }}>
          <div style={{ padding: '8px 10px', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>
            Struttura
          </div>
          <div
            onClick={() => setFilterCapitolo(null)}
            style={{ padding: '6px 10px', cursor: 'pointer', background: !filterCapitolo ? '#e0e7ff' : 'transparent', fontWeight: 500, color: !filterCapitolo ? '#3730a3' : '#374151', display: 'flex', justifyContent: 'space-between' }}>
            <span>Tutto il computo</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>{voci.length}</span>
          </div>

          {Object.entries(tree).map(([capName, cap]) => (
            <div key={capName}>
              <div
                onClick={() => setFilterCapitolo(filterCapitolo === capName ? null : capName)}
                style={{ padding: '5px 10px', cursor: 'pointer', background: filterCapitolo === capName ? '#eff6ff' : 'transparent', fontWeight: 500, color: filterCapitolo === capName ? '#1e40af' : '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{capName}</span>
                <span style={{ fontSize: 10, color: '#6b7280', flexShrink: 0 }}>€{fmt(cap.totale).split(',')[0]}</span>
              </div>
              {Object.entries(cap.sottocapitoli).filter(([s]) => s).map(([subName]) => (
                <div key={subName}
                  style={{ padding: '4px 10px 4px 20px', cursor: 'pointer', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{subName}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Sezione sicurezza */}
          {(commessa?.importo_sic_psc > 0 || totaleSic > 0) && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>SICUREZZA PSC</div>
              <div style={{ fontSize: 10, color: '#dc2626' }}>Non soggetta a ribasso</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', marginTop: 2 }}>EUR {fmt(totaleSic + (commessa?.importo_sic_psc || 0))}</div>
            </div>
          )}
          {totaleMdo > 0 && (
            <div style={{ padding: '6px 10px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#166534', marginBottom: 2 }}>MANODOPERA MDO</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>EUR {fmt(totaleMdo)}</div>
            </div>
          )}
        </div>

        {/* EDITOR COMPUTO */}
        <div ref={editorRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
          onContextMenu={e => { if (selected.size === 0) e.preventDefault() }}
          onClick={() => setCtxMenu(null)}>

          {/* HEADER COLONNE */}
          <div style={{ display: 'grid', gridTemplateColumns: '24px 60px 1fr 40px 70px 70px 90px 80px 60px 70px', gap: 0, padding: '5px 8px', background: '#f3f4f6', borderBottom: '2px solid #e5e7eb', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, zIndex: 10 }}>
            <span></span>
            <span>Codice</span>
            <span>Descrizione</span>
            <span style={{ textAlign: 'center' }}>UM</span>
            <span style={{ textAlign: 'right' }}>Quantità</span>
            <span style={{ textAlign: 'right' }}>P.U. €</span>
            <span style={{ textAlign: 'right' }}>Importo €</span>
            <span style={{ textAlign: 'center' }}>WBS</span>
            <span style={{ textAlign: 'center' }}>Tipo</span>
            <span style={{ textAlign: 'center' }}>Avanz.</span>
          </div>

          {/* ALBERO VOCI */}
          {Object.entries(tree).map(([capName, cap]) => {
            const capKey = 'cap_' + capName
            const isCapOpen = expanded.has(capKey)
            return (
              <div key={capName} style={{ borderBottom: '1px solid #e5e7eb' }}>
                {/* HEADER CAPITOLO */}
                <div
                  onClick={() => toggleCapitolo(capKey)}
                  style={{ display: 'grid', gridTemplateColumns: '24px 60px 1fr 40px 70px 70px 90px 80px 60px 70px', gap: 0, padding: '7px 8px', background: '#f8faff', cursor: 'pointer', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 11 }}>{isCapOpen ? '▼' : '▶'}</span>
                  <span>
                    <input type="checkbox" style={{ width: 13, height: 13, accentColor: '#2563eb' }}
                      onChange={e => { e.stopPropagation(); selectCapitolo(capName, e as any) }}
                      onClick={e => e.stopPropagation()} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1e3a8a' }}>{capName}</span>
                  <span></span><span></span><span></span>
                  <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1e3a8a' }}>EUR {fmt(cap.totale)}</span>
                  <span></span>
                  <span style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 9, padding: '1px 5px', background: '#e0e7ff', color: '#3730a3', borderRadius: 3 }}>
                      {Object.values(cap.sottocapitoli).reduce((s, sub) => s + sub.voci.length, 0)} voci
                    </span>
                  </span>
                  <span></span>
                </div>

                {isCapOpen && Object.entries(cap.sottocapitoli).map(([subName, sub]) => {
                  const subKey = 'sub_' + capName + '_' + subName
                  const isSubOpen = expanded.has(subKey)
                  const subTot = sub.voci.reduce((s, v) => s + (v.importo || 0), 0)
                  return (
                    <div key={subName}>
                      {/* SOTTOCAPITOLO */}
                      {subName && (
                        <div onClick={() => toggleCapitolo(subKey)}
                          style={{ display: 'grid', gridTemplateColumns: '24px 60px 1fr 40px 70px 70px 90px 80px 60px 70px', gap: 0, padding: '5px 8px 5px 20px', background: '#fafbff', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{isSubOpen ? '▼' : '▶'}</span>
                          <span></span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{subName}</span>
                          <span></span><span></span><span></span>
                          <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#4b5563' }}>EUR {fmt(subTot)}</span>
                          <span></span><span></span><span></span>
                        </div>
                      )}

                      {/* VOCI */}
                      {(!subName || isSubOpen) && sub.voci.map(v => {
                        const isSel = selected.has(v.id)
                        const tipo = TIPO_BADGE[v.tipo_assegnazione || '']
                        const tipoVoce = TIPO_VOCE_BADGE[v.tipo_voce || 'LAVORO']
                        const hasSic = v.tipo_voce === 'SIC' || v.tipo_voce === 'SIC_SPCL'
                        const avanz = v.avanzamento_pct || 0
                        return (
                          <div key={v.id}>
                            <div
                              onClick={e => toggleSelect(v.id, e)}
                              onContextMenu={e => onCtxMenu(e, v.id)}
                              style={{
                                display: 'grid', gridTemplateColumns: '24px 60px 1fr 40px 70px 70px 90px 80px 60px 70px', gap: 0,
                                padding: '5px 8px 5px ' + (subName ? '28px' : '16px'),
                                background: isSel ? '#eff6ff' : hasSic ? '#fff5f5' : '#fff',
                                borderLeft: isSel ? '3px solid #2563eb' : hasSic ? '3px solid #fecaca' : '3px solid transparent',
                                borderBottom: '1px solid #f3f4f6',
                                cursor: 'pointer',
                                transition: 'background 0.1s',
                              }}>
                              <span>
                                <input type="checkbox" checked={isSel} onChange={() => {}}
                                  onClick={e => { e.stopPropagation(); const ns = new Set(selected); if(ns.has(v.id)) ns.delete(v.id); else ns.add(v.id); setSelected(ns) }}
                                  style={{ width: 13, height: 13, accentColor: '#2563eb', cursor: 'pointer' }} />
                              </span>

                              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280', paddingTop: 1 }}>
                                {v.codice || v.codice_prezzario || '—'}
                              </span>

                              {/* DESCRIZIONE — completa, visibile */}
                              <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.4, paddingRight: 8 }}>
                                <div style={{ fontWeight: 400 }}>{v.descrizione}</div>
                                {hasSic && (
                                  <span style={{ fontSize: 10, padding: '1px 5px', background: '#fee2e2', color: '#991b1b', borderRadius: 3, marginTop: 2, display: 'inline-block' }}>
                                    SIC — non soggetta a ribasso
                                  </span>
                                )}
                                {v.pct_manodopera && v.pct_manodopera > 0 && (
                                  <span style={{ fontSize: 10, color: '#6b7280', marginTop: 2, display: 'inline-block', marginLeft: 4 }}>
                                    MDO: {v.pct_manodopera}%
                                  </span>
                                )}
                              </div>

                              <span style={{ fontSize: 11, textAlign: 'center', color: '#6b7280' }}>{v.um}</span>
                              <span style={{ fontSize: 11, textAlign: 'right', color: '#374151' }}>{fmtQty(v.quantita)}</span>
                              <span style={{ fontSize: 11, textAlign: 'right', color: '#374151' }}>{fmt(v.prezzo_unitario)}</span>
                              <span style={{ fontSize: 12, textAlign: 'right', fontWeight: 600, color: hasSic ? '#dc2626' : '#111827' }}>
                                {fmt(v.importo)}
                              </span>

                              {/* WBS badge */}
                              <span style={{ textAlign: 'center' }}>
                                {v.wbs_nodo_id ? (
                                  <span style={{ fontSize: 9, padding: '2px 5px', background: '#fefce8', color: '#713f12', borderRadius: 3, cursor: 'pointer' }}>WBS</span>
                                ) : (
                                  <span style={{ fontSize: 9, padding: '2px 5px', background: '#fef2f2', color: '#991b1b', borderRadius: 3, cursor: 'pointer' }}>
                                    ⚠ WBS
                                  </span>
                                )}
                              </span>

                              {/* Tipo acquisto badge */}
                              <span style={{ textAlign: 'center' }}>
                                {tipo ? (
                                  <span style={{ fontSize: 9, padding: '2px 5px', background: tipo.bg, color: tipo.color, borderRadius: 3 }}>{tipo.label}</span>
                                ) : (
                                  <span style={{ fontSize: 9, padding: '2px 5px', background: '#fef2f2', color: '#991b1b', borderRadius: 3 }}>NC</span>
                                )}
                              </span>

                              {/* Avanzamento */}
                              <span style={{ textAlign: 'center' }}>
                                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden', margin: '0 4px' }}>
                                  <div style={{ height: '100%', width: avanz + '%', background: avanz >= 100 ? '#059669' : avanz > 0 ? '#2563eb' : '#e5e7eb', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 9, color: avanz > 0 ? '#2563eb' : '#9ca3af' }}>{avanz}%</span>
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* MENU CONTESTUALE TASTO DESTRO */}
          {ctxMenu && (
            <div onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}
              style={{ position: 'absolute', top: ctxMenu.y, left: ctxMenu.x, zIndex: 1000, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', width: 265, overflow: 'hidden' }}>

              {/* Header selezione */}
              <div style={{ padding: '8px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 11, color: '#1e40af', fontWeight: 600 }}>
                {ctxMenu.voci.length} {ctxMenu.voci.length === 1 ? 'voce selezionata' : 'voci selezionate'}
                {ctxMenu.totale > 0 && <span style={{ fontWeight: 400 }}> · EUR {fmt(ctxMenu.totale)}</span>}
              </div>

              {/* CREA DOCUMENTI */}
              <div style={{ borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>
                <div style={{ padding: '2px 12px 4px', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Crea documenti</div>
                {[
                  { icon: '📋', label: 'Crea RDA per le ' + ctxMenu.voci.length + ' voci', sub: '→ 1 sola RDA', primary: true },
                  { icon: '📤', label: 'Crea RDO con richiesta docs', sub: '→ 1 RDO', primary: true },
                  { icon: '📦', label: 'Crea ODA diretto', sub: '(lavori privati)' },
                ].map(({ icon, label, sub, primary }) => (
                  <div key={label} onClick={() => setCtxMenu(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', color: primary ? '#1e40af' : '#374151' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#f8faff')}
                    onMouseOut={e => (e.currentTarget.style.background = '')}>
                    <span style={{ fontSize: 14, width: 18 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: primary ? 500 : 400 }}>{label}</div>
                    </div>
                    {sub && <span style={{ fontSize: 10, color: '#9ca3af' }}>{sub}</span>}
                  </div>
                ))}
              </div>

              {/* ASSEGNA A TUTTE */}
              <div style={{ borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>
                <div style={{ padding: '2px 12px 4px', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assegna a tutte</div>

                {/* WBS */}
                <div style={{ padding: '4px 12px', fontSize: 12, color: '#374151' }}>
                  <div style={{ marginBottom: 4, fontWeight: 500, display: 'flex', gap: 6 }}>
                    <span>🏗</span> Cambia WBS
                  </div>
                  <select onChange={e => batchAssign('wbs_nodo_id', e.target.value)} onClick={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px' }}>
                    <option value="">— seleziona nodo WBS —</option>
                    <option value="f01">F01 Strutture</option>
                    <option value="f01_01">F01.01 Fondazioni</option>
                    <option value="f01_02">F01.02 Elevazione</option>
                    <option value="f02">F02 Infissi</option>
                    <option value="f03">F03 Impianti</option>
                    <option value="f04">F04 Finiture</option>
                  </select>
                </div>

                {/* Categoria */}
                <div style={{ padding: '4px 12px 6px', fontSize: 12, color: '#374151' }}>
                  <div style={{ marginBottom: 4, fontWeight: 500, display: 'flex', gap: 6 }}>
                    <span>📁</span> Cambia capitolo
                  </div>
                  <input placeholder="es. STRUTTURE, INFISSI..."
                    onKeyDown={e => { if (e.key === 'Enter') batchAssign('capitolo', (e.target as HTMLInputElement).value) }}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', boxSizing: 'border-box' }} />
                </div>

                {/* Tipo acquisto */}
                <div style={{ display: 'flex', gap: 4, padding: '4px 12px 6px' }}>
                  <span style={{ fontSize: 12, color: '#374151', flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}><span>🏷</span> Tipo:</span>
                  {['INT','SUB','ACQ','NC','NF'].map(t => {
                    const b = TIPO_BADGE[t]
                    return (
                      <button key={t} onClick={() => batchAssign('tipo_assegnazione', t)}
                        style={{ fontSize: 10, padding: '3px 7px', border: '1px solid ' + b.color, borderRadius: 4, background: b.bg, color: b.color, cursor: 'pointer' }}>
                        {b.label}
                      </button>
                    )
                  })}
                </div>

                {/* Flag sicurezza */}
                <div style={{ display: 'flex', gap: 4, padding: '0 12px 6px' }}>
                  <span style={{ fontSize: 12, color: '#374151', flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}><span>🔒</span> Sicurezza:</span>
                  {['LAVORO','SIC','SIC_SPCL','MDO'].map(t => {
                    const b = TIPO_VOCE_BADGE[t]
                    return (
                      <button key={t} onClick={() => batchAssign('tipo_voce', t)}
                        style={{ fontSize: 10, padding: '3px 5px', border: '1px solid ' + b.color, borderRadius: 4, background: b.bg, color: b.color, cursor: 'pointer' }}>
                        {b.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* GESTIONE */}
              <div style={{ padding: '4px 0' }}>
                <div style={{ padding: '2px 12px 4px', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gestione</div>
                {[
                  { icon: '📊', label: 'Esporta selezione Excel' },
                  { icon: '🖨', label: 'Stampa voci selezionate' },
                ].map(({ icon, label }) => (
                  <div key={label} onClick={() => setCtxMenu(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#374151' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseOut={e => (e.currentTarget.style.background = '')}>
                    <span style={{ fontSize: 14, width: 18 }}>{icon}</span>
                    {label}
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* FOOTER FISSO CON TOTALI */}
      <div style={{ borderTop: '2px solid #e5e7eb', background: '#f8faff', padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 11 }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 3 }}>Lavori soggetti a ribasso</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>EUR {fmt(totaleBase)}</div>
          {ribasso > 0 && <div style={{ color: '#dc2626', fontSize: 11 }}>- {ribasso}% = EUR {fmt(ribassoEuro)}</div>}
          {totaleSic > 0 && <div style={{ color: '#dc2626', fontSize: 10, marginTop: 2 }}>+ Sic. PSC: EUR {fmt(totaleSic)} (no ribasso)</div>}
          {totaleMdo > 0 && <div style={{ color: '#059669', fontSize: 10 }}>+ MDO: EUR {fmt(totaleMdo)} (no ribasso)</div>}
        </div>
        <div style={{ fontSize: 11, textAlign: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 3 }}>Base d'asta totale</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>EUR {fmt(baseAsta)}</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>{voci.length} voci di computo</div>
        </div>
        <div style={{ fontSize: 11, textAlign: 'right' }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 3 }}>Importo contratto</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#059669' }}>EUR {fmt(contratto)}</div>
          {ribasso > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>Dopo ribasso {ribasso.toFixed(2)}%</div>}
        </div>
      </div>

      {/* MODAL RIBASSO */}
      {showRibassoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Configurazione commessa</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ribasso d'asta offerto (%)</label>
              <input type="number" step="0.001" min="0" max="100" value={ribasso}
                onChange={e => setRibasso(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
              <div>Base d'asta: EUR {fmt(totaleBase)}</div>
              <div style={{ color: '#dc2626' }}>Ribasso {ribasso.toFixed(3)}%: - EUR {fmt(totaleBase * ribasso / 100)}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>Contratto lavori: EUR {fmt(totaleBase * (1 - ribasso/100))}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRibassoModal(false)}
                style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Annulla
              </button>
              <button onClick={saveRibasso}
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
