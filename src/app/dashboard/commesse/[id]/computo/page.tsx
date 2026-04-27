'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronRight, ChevronDown, Settings, AlertTriangle, Loader2, Check, Plus, X } from 'lucide-react'

const fmt = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtQ = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const TIPO_BADGE: Record<string, { bg: string; color: string }> = {
  INT: { bg: '#f5f3ff', color: '#4338ca' },
  SUB: { bg: '#eff6ff', color: '#1e40af' },
  ACQ: { bg: '#f0fdf4', color: '#166534' },
  NC:  { bg: '#f9fafb', color: '#6b7280' },
  NF:  { bg: '#fafafa', color: '#9ca3af' },
}

const TIPO_VOCE_INFO: Record<string, { label: string; bg: string; color: string; noRibasso: boolean }> = {
  LAVORO:   { label: 'Lavoro',  bg: '#f3f4f6', color: '#374151', noRibasso: false },
  SIC:      { label: 'SIC',     bg: '#fef2f2', color: '#991b1b', noRibasso: true },
  SIC_SPCL: { label: 'SIC.S',   bg: '#fef2f2', color: '#b91c1c', noRibasso: true },
  MDO:      { label: 'MDO',     bg: '#fff7ed', color: '#c2410c', noRibasso: true },
  NR:       { label: 'NR',      bg: '#fafafa', color: '#6b7280', noRibasso: true },
  ECONOMIA: { label: 'Econ.',   bg: '#fefce8', color: '#713f12', noRibasso: false },
}

interface Voce {
  id: string; codice: string; codice_prezzario?: string; descrizione: string
  um: string; quantita: number; prezzo_unitario: number; importo: number
  capitolo?: string; tipo_voce?: string; tipo_assegnazione?: string
  wbs_nodo_id?: string; soggetta_ribasso?: boolean
  pct_manodopera?: number; avanzamento_pct?: number
}

interface Misurazione {
  id: string; voce_computo_id: string; descrizione?: string
  parti_uguali?: number; lunghezza?: number; larghezza?: number; altezza_peso?: number
  formula?: string; quantita_calc?: number; is_negativo?: boolean; ordine: number
}

interface WbsNodo {
  id: string; codice: string; nome: string; parent_id?: string
  livello: number; ordine: number; importo_tot?: number; n_voci?: number
}

interface CtxMenu { x: number; y: number; ids: string[]; totale: number }

export default function ComputoPage() {
  const { id } = useParams() as { id: string }
  const [voci, setVoci] = useState<Voce[]>([])
  const [commessa, setCommessa] = useState<any>(null)
  const [wbsNodi, setWbsNodi] = useState<WbsNodo[]>([])
  const [misurazioni, setMisurazioni] = useState<Record<string, Misurazione[]>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set())
  const [expandedVoci, setExpandedVoci] = useState<Set<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [filterWbs, setFilterWbs] = useState<string | null>(null)
  const [showRibasso, setShowRibasso] = useState(false)
  const [ribasso, setRibasso] = useState(0)
  const [saving, setSaving] = useState<string | null>(null)
  const lastSel = useRef<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const loadVoci = useCallback(async () => {
    setLoading(true)
    const { data: cm } = await supabase.from('computo_metrico')
      .select('id').eq('commessa_id', id).single()
    if (!cm) { setLoading(false); return }

    const [{ data: v }, { data: c }, { data: w }] = await Promise.all([
      supabase.from('voci_computo').select(
        'id,codice,codice_prezzario,descrizione,um,quantita,prezzo_unitario,importo,' +
        'capitolo,tipo_voce,tipo_assegnazione,wbs_nodo_id,soggetta_ribasso,pct_manodopera,avanzamento_pct'
      ).eq('computo_id', cm.id).order('capitolo').order('ordine_albero'),
      supabase.from('commesse').select('*').eq('id', id).single(),
      supabase.from('wbs_nodi').select('*').eq('commessa_id', id).order('livello').order('ordine'),
    ])
    setVoci(v || [])
    setCommessa(c)
    setWbsNodi(w || [])
    setRibasso(c?.ribasso_pct || 0)
    // Espandi tutte le SuperCategorie di default
    const caps = new Set<string>()
    ;(w || []).filter((n: WbsNodo) => n.livello === 1).forEach((n: WbsNodo) => caps.add(n.id))
    setExpandedCaps(caps)
    setLoading(false)
  }, [id])

  useEffect(() => { loadVoci() }, [loadVoci])

  // Carica misurazioni per una voce al click
  async function loadMisurazioni(voceId: string) {
    if (misurazioni[voceId]) return
    const { data } = await supabase.from('voci_computo_misurazioni')
      .select('*').eq('voce_computo_id', voceId).order('ordine')
    setMisurazioni(prev => ({ ...prev, [voceId]: data || [] }))
  }

  function toggleVoceExpand(voceId: string) {
    setExpandedVoci(prev => {
      const n = new Set(prev)
      if (n.has(voceId)) { n.delete(voceId) } 
      else { n.add(voceId); loadMisurazioni(voceId) }
      return n
    })
  }

  // Tree WBS
  const superCats = wbsNodi.filter(n => n.livello === 1)
  const subCats = (parentId: string) => wbsNodi.filter(n => n.livello === 2 && n.parent_id === parentId)

  // Filtra voci
  const vociFiltrate = filterWbs
    ? voci.filter(v => {
        const nodo = wbsNodi.find(n => n.id === filterWbs)
        if (!nodo) return false
        if (nodo.livello === 1) {
          const figli = wbsNodi.filter(n => n.parent_id === filterWbs).map(n => n.id)
          return figli.includes(v.wbs_nodo_id || '')
        }
        return v.wbs_nodo_id === filterWbs
      })
    : voci

  // Raggruppa per capitolo path
  const tree: Record<string, { superNome: string; subNome: string; voci: Voce[] }> = {}
  vociFiltrate.forEach(v => {
    const path = v.capitolo || '(Senza capitolo)'
    if (!tree[path]) {
      const parts = path.split(' > ')
      tree[path] = { superNome: parts[0] || path, subNome: parts[1] || '', voci: [] }
    }
    tree[path].voci.push(v)
  })

  // SuperCategorie raggruppate
  const superGroups: Record<string, { subGroups: Record<string, Voce[]>; totale: number }> = {}
  Object.entries(tree).forEach(([path, { superNome, subNome, voci: vs }]) => {
    if (!superGroups[superNome]) superGroups[superNome] = { subGroups: {}, totale: 0 }
    superGroups[superNome].subGroups[subNome || ''] = vs
    superGroups[superNome].totale += vs.reduce((s, v) => s + (v.importo || 0), 0)
  })

  // Totali
  const tot = voci.reduce((s, v) => s + (v.importo || 0), 0)
  const totRibasso = voci.filter(v => v.soggetta_ribasso !== false && !TIPO_VOCE_INFO[v.tipo_voce || 'LAVORO']?.noRibasso).reduce((s, v) => s + (v.importo || 0), 0)
  const totNoRib = tot - totRibasso
  const ribEuro = totRibasso * ribasso / 100
  const contratto = tot - ribEuro

  // Selezione
  function toggleSel(voceId: string, e: React.MouseEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    const newSel = new Set(selected)
    if (e.ctrlKey || e.metaKey) {
      if (newSel.has(voceId)) newSel.delete(voceId); else newSel.add(voceId)
    } else if (e.shiftKey && lastSel.current) {
      const flat = vociFiltrate.map(v => v.id)
      const a = flat.indexOf(lastSel.current), b = flat.indexOf(voceId)
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) newSel.add(flat[i])
    } else {
      newSel.clear(); newSel.add(voceId)
    }
    lastSel.current = voceId
    setSelected(newSel)
  }

  function selAll(ids: string[], e: React.MouseEvent) {
    e.stopPropagation()
    const newSel = new Set(selected)
    const allSel = ids.every(id => newSel.has(id))
    if (allSel) ids.forEach(id => newSel.delete(id))
    else ids.forEach(id => newSel.add(id))
    setSelected(newSel)
  }

  function onCtxMenu(e: React.MouseEvent, voceId?: string) {
    e.preventDefault()
    let ids = Array.from(selected)
    if (voceId && !selected.has(voceId)) {
      ids = [voceId]
      setSelected(new Set([voceId]))
    }
    if (ids.length === 0 && voceId) ids = [voceId]
    const tot = voci.filter(v => ids.includes(v.id)).reduce((s, v) => s + (v.importo || 0), 0)
    const rect = editorRef.current?.getBoundingClientRect()
    const rx = Math.min((rect ? e.clientX - rect.left : e.clientX), (rect?.width || 800) - 285)
    const ry = Math.min((rect ? e.clientY - rect.top : e.clientY), (rect?.height || 600) - 440)
    setCtxMenu({ x: Math.max(0, rx), y: Math.max(0, ry), ids, totale: tot })
  }

  async function batchUpdate(field: string, value: string | boolean | null) {
    const ids = ctxMenu?.ids || Array.from(selected)
    if (ids.length === 0) return
    setSaving(field)
    setCtxMenu(null)
    const { error } = await supabase.from('voci_computo')
      .update({ [field]: value }).in('id', ids)
    if (error) console.error('batchUpdate error:', error)
    setSaving(null)
    loadVoci()
  }

  async function aggiornaCapitolo(ids: string[], nuovoCapitolo: string) {
    if (!nuovoCapitolo.trim()) return
    setSaving('capitolo')
    setCtxMenu(null)
    await supabase.from('voci_computo')
      .update({ capitolo: nuovoCapitolo.trim() }).in('id', ids)
    setSaving(null)
    loadVoci()
  }

  async function saveRibasso() {
    await supabase.from('commesse').update({ ribasso_pct: ribasso }).eq('id', id)
    setShowRibasso(false)
    loadVoci()
  }

  async function addMisurazione(voceId: string) {
    const ord = (misurazioni[voceId] || []).length
    const { data } = await supabase.from('voci_computo_misurazioni')
      .insert({ voce_computo_id: voceId, parti_uguali: 1, lunghezza: 0, larghezza: 0, altezza_peso: 0, quantita_calc: 0, ordine: ord })
      .select().single()
    if (data) setMisurazioni(prev => ({ ...prev, [voceId]: [...(prev[voceId] || []), data] }))
  }

  async function updateMisurazione(misId: string, voceId: string, field: string, value: number | string) {
    await supabase.from('voci_computo_misurazioni').update({ [field]: value }).eq('id', misId)
    // Ricalcola quantità voce
    const rows = misurazioni[voceId] || []
    const updated = rows.map(r => r.id === misId ? { ...r, [field]: value } : r)
    const totQty = updated.reduce((s, r) => {
      const q = (r.parti_uguali || 1) * (r.lunghezza || 0) * (r.larghezza || 1) * (r.altezza_peso || 1)
      return s + (r.is_negativo ? -q : q)
    }, 0)
    await supabase.from('voci_computo').update({ quantita: totQty }).eq('id', voceId)
    setMisurazioni(prev => ({ ...prev, [voceId]: updated }))
    loadVoci()
  }

  async function deleteMisurazione(misId: string, voceId: string) {
    await supabase.from('voci_computo_misurazioni').delete().eq('id', misId)
    setMisurazioni(prev => ({ ...prev, [voceId]: (prev[voceId] || []).filter(r => r.id !== misId) }))
  }

  const voceNoWbs = voci.filter(v => !v.wbs_nodo_id).length
  const voceNoTipo = voci.filter(v => !v.tipo_assegnazione).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8, color: '#9ca3af' }}>
      <Loader2 size={20} className="animate-spin" /> Caricamento 815 voci...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>

      {/* BARRA TOP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, flexWrap: 'wrap' }}>
        {voceNoWbs > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6 }}>
            ⚠ {voceNoWbs} senza WBS
          </span>
        )}
        {voceNoTipo > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6 }}>
            ⚠ {voceNoTipo} senza tipo
          </span>
        )}
        <div style={{ flex: 1 }} />
        {saving && <span style={{ fontSize: 11, color: '#2563eb' }}>Salvataggio {saving}...</span>}
        <button onClick={() => setShowRibasso(true)}
          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: ribasso > 0 ? '#eff6ff' : '#fff', color: ribasso > 0 ? '#1e40af' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Settings size={12} /> {ribasso > 0 ? 'Ribasso ' + ribasso.toFixed(3) + '%' : 'Configura ribasso'}
        </button>
      </div>

      {/* BARRA SELEZIONE */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 11, color: '#1e40af', flexShrink: 0 }}>
          <Check size={12} />
          <span style={{ fontWeight: 600 }}>{selected.size} {selected.size === 1 ? 'voce' : 'voci'}</span>
          <span>· EUR {fmt(voci.filter(v => selected.has(v.id)).reduce((s, v) => s + (v.importo || 0), 0))}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setCtxMenu({ x: 12, y: 45, ids: Array.from(selected), totale: voci.filter(v => selected.has(v.id)).reduce((s, v) => s + (v.importo || 0), 0) })}
            style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #93c5fd', borderRadius: 6, background: '#fff', color: '#1e40af', cursor: 'pointer' }}>
            Crea RDA →
          </button>
          <button onClick={() => setCtxMenu({ x: 12, y: 45, ids: Array.from(selected), totale: 0 })}
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

        {/* PANNELLO STRUTTURA — come Toolbox Struttura di Primus */}
        <div style={{ width: 210, borderRight: '1px solid #e5e7eb', overflowY: 'auto', background: '#f9fafb', flexShrink: 0 }}>
          <div style={{ padding: '7px 10px', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>
            Struttura WBS
          </div>

          {/* Tutto il computo */}
          <div onClick={() => setFilterWbs(null)}
            style={{ padding: '6px 10px', cursor: 'pointer', background: !filterWbs ? '#e0e7ff' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 500, fontSize: 12, color: !filterWbs ? '#3730a3' : '#374151' }}>
            <span>Tutto il computo</span>
            <span style={{ fontSize: 10, color: !filterWbs ? '#6366f1' : '#9ca3af' }}>{voci.length}</span>
          </div>

          {superCats.map(sup => (
            <div key={sup.id}>
              {/* SuperCategoria */}
              <div
                onClick={() => {
                  setFilterWbs(filterWbs === sup.id ? null : sup.id)
                  setExpandedCaps(prev => { const n = new Set(prev); n.has(sup.id) ? n.delete(sup.id) : n.add(sup.id); return n })
                }}
                style={{ padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid #e5e7eb', background: filterWbs === sup.id ? '#eff6ff' : 'transparent' }}>
                <span style={{ fontSize: 10, color: '#9ca3af', width: 10 }}>{expandedCaps.has(sup.id) ? '▼' : '▶'}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: filterWbs === sup.id ? '#1e40af' : '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sup.nome}
                </span>
              </div>

              {/* SubCategorie */}
              {expandedCaps.has(sup.id) && subCats(sup.id).map(sub => (
                <div key={sub.id} onClick={() => setFilterWbs(filterWbs === sub.id ? null : sub.id)}
                  style={{ padding: '4px 10px 4px 22px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: filterWbs === sub.id ? '#eff6ff' : 'transparent' }}>
                  <span style={{ fontSize: 11, color: filterWbs === sub.id ? '#1e40af' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {sub.nome}
                  </span>
                  <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{sub.n_voci}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Sicurezza PSC se presente */}
          {voci.some(v => v.tipo_voce === 'SIC' || v.tipo_voce === 'SIC_SPCL') && (
            <div style={{ margin: '8px', padding: '6px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#991b1b', marginBottom: 2 }}>SIC / PSC</div>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                EUR {fmt(voci.filter(v => v.tipo_voce === 'SIC' || v.tipo_voce === 'SIC_SPCL').reduce((s, v) => s + (v.importo || 0), 0))}
              </div>
              <div style={{ fontSize: 10, color: '#991b1b' }}>non sogg. ribasso</div>
            </div>
          )}
        </div>

        {/* EDITOR PRINCIPALE */}
        <div ref={editorRef} style={{ flex: 1, overflowY: 'auto', position: 'relative', background: '#fff' }}
          onClick={() => setCtxMenu(null)}>

          {/* INTESTAZIONI COLONNE — stile Primus */}
          <div style={{ display: 'grid', gridTemplateColumns: '22px 70px 1fr 38px 72px 68px 90px 74px 52px 58px', gap: 0, padding: '5px 8px', background: '#f3f4f6', borderBottom: '2px solid #d1d5db', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, zIndex: 10 }}>
            <span></span>
            <span>Tariffa</span>
            <span>Descrizione voce</span>
            <span>UM</span>
            <span style={{ textAlign: 'right' }}>Quantità</span>
            <span style={{ textAlign: 'right' }}>P.U.</span>
            <span style={{ textAlign: 'right' }}>Importo</span>
            <span style={{ textAlign: 'center' }}>WBS</span>
            <span style={{ textAlign: 'center' }}>Tipo</span>
            <span style={{ textAlign: 'center' }}>Avanz.</span>
          </div>

          {/* ALBERO VOCI — come Primus: SuperCat > SubCat > Voci */}
          {Object.entries(superGroups).map(([superNome, { subGroups, totale: superTot }]) => {
            const superKey = 'S_' + superNome
            const isOpen = expandedCaps.has(superKey)
            const allIds = Object.values(subGroups).flat().map(v => v.id)
            const allSel = allIds.length > 0 && allIds.every(id => selected.has(id))
            return (
              <div key={superNome} style={{ borderBottom: '1px solid #e5e7eb' }}>

                {/* HEADER SUPERCATEGORIA */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', background: '#eef2ff', cursor: 'pointer', borderBottom: '1px solid #c7d2fe' }}
                  onClick={() => setExpandedCaps(prev => { const n = new Set(prev); n.has(superKey) ? n.delete(superKey) : n.add(superKey); return n })}>
                  <span style={{ fontSize: 12, color: '#6366f1' }}>{isOpen ? '▼' : '▶'}</span>
                  <input type="checkbox" checked={allSel} onChange={() => {}}
                    onClick={e => selAll(allIds, e)}
                    style={{ width: 13, height: 13, accentColor: '#4f46e5', cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', flex: 1 }}>{superNome}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e1b4b' }}>EUR {fmt(superTot)}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', background: '#c7d2fe', color: '#1e1b4b', borderRadius: 3 }}>
                    {allIds.length} voci
                  </span>
                </div>

                {isOpen && Object.entries(subGroups).map(([subNome, subVoci]) => {
                  const subKey = 'sub_' + superNome + '_' + subNome
                  const isSubOpen = !expandedCaps.has('_CLOSED_' + subKey)
                  const subTot = subVoci.reduce((s, v) => s + (v.importo || 0), 0)
                  const subIds = subVoci.map(v => v.id)
                  const subAllSel = subIds.length > 0 && subIds.every(id => selected.has(id))
                  return (
                    <div key={subNome}>
                      {/* HEADER SOTTOCATEGORIA */}
                      {subNome && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 18px', background: '#f8faff', cursor: 'pointer', borderBottom: '1px solid #e0e7ff' }}
                          onClick={() => setExpandedCaps(prev => { const n = new Set(prev); const k = '_CLOSED_' + subKey; n.has(k) ? n.delete(k) : n.add(k); return n })}>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{isSubOpen ? '▼' : '▶'}</span>
                          <input type="checkbox" checked={subAllSel} onChange={() => {}}
                            onClick={e => selAll(subIds, e)}
                            style={{ width: 12, height: 12, accentColor: '#3b82f6', cursor: 'pointer' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', flex: 1 }}>{subNome}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>EUR {fmt(subTot)}</span>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{subIds.length} voci</span>
                        </div>
                      )}

                      {/* VOCI */}
                      {isSubOpen && subVoci.map(v => {
                        const isSel = selected.has(v.id)
                        const isMisOpen = expandedVoci.has(v.id)
                        const tipoV = TIPO_VOCE_INFO[v.tipo_voce || 'LAVORO']
                        const tipoA = TIPO_BADGE[v.tipo_assegnazione || '']
                        const avanz = v.avanzamento_pct || 0
                        const hasMis = (misurazioni[v.id] || []).length > 0
                        return (
                          <div key={v.id}>
                            {/* RIGA VOCE */}
                            <div
                              onClick={e => toggleSel(v.id, e)}
                              onContextMenu={e => onCtxMenu(e, v.id)}
                              style={{
                                display: 'grid', gridTemplateColumns: '22px 70px 1fr 38px 72px 68px 90px 74px 52px 58px', gap: 0,
                                padding: '5px 8px 5px ' + (subNome ? '26px' : '14px'),
                                background: isSel ? '#eff6ff' : tipoV.noRibasso ? '#fef9f9' : '#fff',
                                borderLeft: isSel ? '3px solid #3b82f6' : tipoV.noRibasso ? '3px solid #fecaca' : '3px solid transparent',
                                borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.08s',
                              }}>
                              <span>
                                <input type="checkbox" checked={isSel} onChange={() => {}}
                                  onClick={e => { e.stopPropagation(); const ns = new Set(selected); ns.has(v.id) ? ns.delete(v.id) : ns.add(v.id); setSelected(ns) }}
                                  style={{ width: 12, height: 12, accentColor: '#3b82f6', cursor: 'pointer' }} />
                              </span>

                              {/* TARIFFA — click espande misurazioni come Primus */}
                              <span onClick={e => { e.stopPropagation(); toggleVoceExpand(v.id) }}
                                style={{ fontFamily: 'monospace', fontSize: 10, color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline', paddingTop: 1 }}
                                title="Clicca per espandere le misurazioni">
                                {isMisOpen ? '▼' : '▶'} {v.codice || v.codice_prezzario || '—'}
                              </span>

                              {/* DESCRIZIONE COMPLETA — mai troncata */}
                              <div style={{ fontSize: 11, color: '#1e293b', lineHeight: 1.5, paddingRight: 6 }}>
                                <div>{v.descrizione}</div>
                                <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                  {tipoV.noRibasso && (
                                    <span style={{ fontSize: 9, padding: '1px 4px', background: tipoV.bg, color: tipoV.color, borderRadius: 2 }}>
                                      {tipoV.label} · non sogg. ribasso
                                    </span>
                                  )}
                                  {v.pct_manodopera && v.pct_manodopera > 0 && (
                                    <span style={{ fontSize: 9, color: '#78716c' }}>MDO: {v.pct_manodopera}%</span>
                                  )}
                                </div>
                              </div>

                              <span style={{ fontSize: 11, textAlign: 'center', color: '#64748b', paddingTop: 1 }}>{v.um}</span>
                              <span style={{ fontSize: 11, textAlign: 'right', color: '#475569', paddingTop: 1 }}>{fmtQ(v.quantita)}</span>
                              <span style={{ fontSize: 11, textAlign: 'right', color: '#475569', paddingTop: 1 }}>{fmt(v.prezzo_unitario)}</span>
                              <span style={{ fontSize: 12, textAlign: 'right', fontWeight: 600, color: tipoV.noRibasso ? '#dc2626' : '#0f172a', paddingTop: 1 }}>
                                {fmt(v.importo)}
                              </span>

                              {/* WBS — click inline */}
                              <span style={{ textAlign: 'center' }}>
                                {v.wbs_nodo_id ? (
                                  <span style={{ fontSize: 9, padding: '2px 4px', background: '#fefce8', color: '#713f12', borderRadius: 2, cursor: 'pointer' }}
                                    onClick={e => { e.stopPropagation(); onCtxMenu(e, v.id) }}>
                                    {wbsNodi.find(n => n.id === v.wbs_nodo_id)?.codice || 'WBS'}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 9, padding: '2px 4px', background: '#fef2f2', color: '#991b1b', borderRadius: 2, cursor: 'pointer' }}
                                    onClick={e => { e.stopPropagation(); onCtxMenu(e, v.id) }}>⚠ WBS</span>
                                )}
                              </span>

                              {/* TIPO — click cambia */}
                              <span style={{ textAlign: 'center' }}>
                                {tipoA ? (
                                  <span style={{ fontSize: 9, padding: '2px 4px', background: tipoA.bg, color: tipoA.color, borderRadius: 2, cursor: 'pointer' }}
                                    onClick={e => { e.stopPropagation(); onCtxMenu(e, v.id) }}>
                                    {v.tipo_assegnazione}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 9, padding: '2px 4px', background: '#fef2f2', color: '#991b1b', borderRadius: 2, cursor: 'pointer' }}
                                    onClick={e => { e.stopPropagation(); onCtxMenu(e, v.id) }}>NC</span>
                                )}
                              </span>

                              {/* AVANZAMENTO */}
                              <span>
                                <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, margin: '2px 4px 0' }}>
                                  <div style={{ height: '100%', width: avanz + '%', background: avanz >= 100 ? '#16a34a' : avanz > 0 ? '#3b82f6' : '#e2e8f0', borderRadius: 2 }} />
                                </div>
                                <div style={{ fontSize: 9, textAlign: 'center', color: avanz > 0 ? '#3b82f6' : '#9ca3af' }}>{avanz}%</div>
                              </span>
                            </div>

                            {/* RIGHI MISURAZIONI — espandibili come Primus */}
                            {isMisOpen && (
                              <div style={{ background: '#fafcff', borderBottom: '1px solid #e0e7ff', paddingLeft: subNome ? 26 : 14 }}>
                                {/* Header misurazioni */}
                                <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 52px 62px 58px 58px 80px 36px', gap: 0, padding: '3px 8px', background: '#e0e7ff', fontSize: 9, fontWeight: 600, color: '#4338ca', textTransform: 'uppercase' }}>
                                  <span></span>
                                  <span>Descrizione</span>
                                  <span style={{ textAlign: 'center' }}>P.U.</span>
                                  <span style={{ textAlign: 'right' }}>Lunghezza</span>
                                  <span style={{ textAlign: 'right' }}>Larghezza</span>
                                  <span style={{ textAlign: 'right' }}>H/Peso</span>
                                  <span style={{ textAlign: 'right' }}>= Quantità</span>
                                  <span></span>
                                </div>
                                {(misurazioni[v.id] || []).map(m => (
                                  <div key={m.id}
                                    style={{ display: 'grid', gridTemplateColumns: '24px 1fr 52px 62px 58px 58px 80px 36px', gap: 0, padding: '3px 8px', borderBottom: '1px solid #e8edf8' }}>
                                    <span style={{ fontSize: 10, color: m.is_negativo ? '#dc2626' : '#64748b', textAlign: 'center' }}>
                                      {m.is_negativo ? '−' : ''}
                                    </span>
                                    <input
                                      defaultValue={m.descrizione || ''}
                                      onBlur={e => updateMisurazione(m.id, v.id, 'descrizione', e.target.value)}
                                      placeholder="es. Piano terra"
                                      style={{ fontSize: 11, border: 'none', background: 'transparent', color: '#334155', outline: 'none', width: '100%' }} />
                                    {['lunghezza', 'larghezza', 'altezza_peso'].map(field => (
                                      <input key={field}
                                        type="number" step="0.001"
                                        defaultValue={String((m as any)[field] || 0)}
                                        onBlur={e => updateMisurazione(m.id, v.id, field, parseFloat(e.target.value) || 0)}
                                        style={{ fontSize: 11, border: 'none', background: 'transparent', textAlign: 'right', color: '#334155', outline: 'none', width: '100%' }} />
                                    ))}
                                    <span style={{ fontSize: 11, textAlign: 'right', color: '#1e293b', fontWeight: 500, paddingRight: 4 }}>
                                      {fmtQ((m.parti_uguali || 1) * (m.lunghezza || 0) * (m.larghezza || 1) * (m.altezza_peso || 1))}
                                    </span>
                                    <button onClick={() => deleteMisurazione(m.id, v.id)}
                                      style={{ fontSize: 10, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                                  </div>
                                ))}
                                {/* Riga TOTALE + pulsante aggiungi */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderTop: '1px solid #c7d2fe' }}>
                                  <button onClick={() => addMisurazione(v.id)}
                                    style={{ fontSize: 10, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Plus size={11} /> Aggiungi riga
                                  </button>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>
                                    Totale: {fmtQ(v.quantita)} {v.um}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* MENU CONTESTUALE TASTO DESTRO — salva DAVVERO */}
          {ctxMenu && (
            <div onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}
              style={{ position: 'absolute', top: ctxMenu.y, left: ctxMenu.x, zIndex: 1000, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', width: 280, overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '8px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 11, fontWeight: 600, color: '#1e40af' }}>
                {ctxMenu.ids.length} {ctxMenu.ids.length === 1 ? 'voce' : 'voci'}
                {ctxMenu.totale > 0 && <span style={{ fontWeight: 400 }}> · EUR {fmt(ctxMenu.totale)}</span>}
              </div>

              {/* CREA DOCUMENTI */}
              <div style={{ borderBottom: '1px solid #f1f5f9', padding: '4px 0' }}>
                <div style={{ padding: '2px 12px 3px', fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Crea documenti</div>
                {[
                  { label: 'Crea RDA per ' + ctxMenu.ids.length + ' voci', hint: '→ 1 sola RDA', primary: true },
                  { label: 'Crea RDO con richiesta docs', hint: '→ 1 RDO', primary: true },
                ].map(({ label, hint, primary }) => (
                  <div key={label} onClick={() => setCtxMenu(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: primary ? '#1e40af' : '#374151' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#f8faff')}
                    onMouseOut={e => (e.currentTarget.style.background = '')}>
                    <span style={{ flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{hint}</span>
                  </div>
                ))}
              </div>

              {/* ASSEGNA WBS */}
              <div style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 12px' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Assegna WBS</div>
                <select
                  onChange={e => { if (e.target.value) batchUpdate('wbs_nodo_id', e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', background: '#fff', cursor: 'pointer' }}>
                  <option value="">— seleziona nodo WBS —</option>
                  {superCats.map(sup => (
                    <optgroup key={sup.id} label={sup.nome}>
                      {subCats(sup.id).map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.nome} ({sub.n_voci} voci)</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* CAMBIA CAPITOLO */}
              <div style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 12px' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Cambia capitolo</div>
                <input
                  placeholder="SuperCat > SubCat (premi Invio)"
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { if (e.key === 'Enter') aggiornaCapitolo(ctxMenu.ids, (e.target as HTMLInputElement).value) }}
                  style={{ width: '100%', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', boxSizing: 'border-box' }} />
              </div>

              {/* TIPO ACQUISTO */}
              <div style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 12px' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tipo acquisto</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['INT', 'SUB', 'ACQ', 'NC', 'NF'] as const).map(t => {
                    const b = TIPO_BADGE[t]
                    return (
                      <button key={t} onClick={() => batchUpdate('tipo_assegnazione', t)}
                        style={{ flex: 1, fontSize: 11, padding: '4px 0', border: '1px solid ' + b.color, borderRadius: 4, background: b.bg, color: b.color, cursor: 'pointer', fontWeight: 600 }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* FLAG SICUREZZA */}
              <div style={{ borderBottom: '1px solid #f1f5f9', padding: '6px 12px' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tipo lavorazione / sicurezza</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {(['LAVORO', 'SIC', 'SIC_SPCL', 'MDO', 'NR'] as const).map(t => {
                    const b = TIPO_VOCE_INFO[t]
                    return (
                      <button key={t} onClick={() => batchUpdate('tipo_voce', t)}
                        style={{ fontSize: 10, padding: '3px 6px', border: '1px solid ' + b.color, borderRadius: 4, background: b.bg, color: b.color, cursor: 'pointer' }}>
                        {b.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* CHIUDI */}
              <div style={{ padding: '4px 0' }}>
                <div onClick={() => setCtxMenu(null)}
                  style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseOut={e => (e.currentTarget.style.background = '')}>
                  Chiudi menu
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER FISSO TOTALI */}
      <div style={{ borderTop: '2px solid #e5e7eb', background: '#f8faff', padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 11 }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>Lavori sogg. ribasso</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>EUR {fmt(totRibasso)}</div>
          {ribasso > 0 && <div style={{ color: '#dc2626', fontSize: 11 }}>- {ribasso}% = EUR {fmt(ribEuro)}</div>}
          {totNoRib > 0 && <div style={{ color: '#dc2626', fontSize: 10, marginTop: 1 }}>+ Non sogg.: EUR {fmt(totNoRib)}</div>}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11 }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>Base d'asta totale</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>EUR {fmt(tot)}</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>{voci.length} voci</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>Importo contratto</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#15803d' }}>EUR {fmt(contratto)}</div>
          {ribasso > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>Dopo ribasso {ribasso.toFixed(3)}%</div>}
        </div>
      </div>

      {/* MODAL RIBASSO — facoltativo, non 5% fisso */}
      {showRibasso && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Configurazione ribasso</h3>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>
              Inserisci il ribasso offerto in gara. Le voci SIC, MDO, NR non vengono ribassate.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>
                Ribasso d'asta offerto (%)
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>— lascia 0 per nessun ribasso</span>
              </label>
              <input type="number" step="0.001" min="0" max="100" value={ribasso}
                onChange={e => setRibasso(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', fontSize: 15, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', boxSizing: 'border-box' }} />
            </div>
            {ribasso > 0 && (
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
                <div>Lavori soggetti: EUR {fmt(totRibasso)}</div>
                <div style={{ color: '#dc2626' }}>Ribasso {ribasso.toFixed(3)}%: - EUR {fmt(totRibasso * ribasso / 100)}</div>
                <div style={{ fontWeight: 600, color: '#15803d', marginTop: 4 }}>
                  Contratto: EUR {fmt(totRibasso * (1 - ribasso / 100) + totNoRib)}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRibasso(false)}
                style={{ padding: '8px 18px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Annulla
              </button>
              <button onClick={saveRibasso}
                style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
