'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── WBS FLAT ────────────────────────────────────────────────────────────────
const WBS_FLAT: [string, string][] = [
  ['F01','FASE PRELIMINARE'],['F01.01','Apertura commessa'],
  ['F02','PROGETTAZIONE'],['F02.01','Progett. architettonica'],['F02.02','Strutturale'],['F02.03','Impianti'],
  ['F03','APPROVVIGIONAMENTI'],['F03.01','Materiali strutturali'],['F03.02','Finiture'],['F03.03','Noleggi'],['F03.04','Contratti sub'],
  ['F04','CANTIERE'],['F04.01','Opere preliminari'],['F04.02','Demolizioni'],['F04.03','Scavi'],
  ['F04.04','Fondazioni'],['F04.05','Struttura in elevazione'],['F04.06','Solaio e copertura'],
  ['F04.07','Tamponamenti'],['F04.08','Intonaci'],['F04.09','Massetti e pavimenti'],
  ['F04.10','Serramenti'],['F04.11','Tinteggiature'],
  ['F05','IMPIANTI'],['F05.01','Impianto elettrico'],['F05.02','Idro-sanitario'],['F05.03','Termico'],
  ['F06','OPERE ESTERNE'],['F06.01','Pavimentazioni esterne'],['F06.02','Recinzioni'],
  ['F07','SICUREZZA'],['F07.01','DPI'],['F07.02','Apprestamenti'],
  ['F08','GESTIONE ECONOMICA'],['F08.01','Controllo budget'],['F08.02','Fatturazione'],
]
const WBS_MAP = Object.fromEntries(WBS_FLAT)
const WBS_ROOTS = WBS_FLAT.filter(([c]) => !c.includes('.')).map(([c]) => c)
const WBS_CHILDREN = (parent: string) => WBS_FLAT.filter(([c]) => {
  const p = c.split('.')
  if (p.length === 1) return false
  p.pop()
  return p.join('.') === parent
}).map(([c]) => c)

// ─── Tipi ────────────────────────────────────────────────────────────────────
interface VoceDB {
  id: string; codice: string; descrizione: string; um: string
  quantita: number; prezzo_unitario: number; importo: number
  capitolo: string; categoria: string; note?: string
  wbs_id?: string; wbs_label?: string
  _isVariante?: boolean
  _tipoModifica?: 'aggiunta' | 'modifica_quantita' | 'soppressione'
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const V3_CSS = `
.cmp-root{display:flex;height:100%;overflow:hidden;background:#f4f5f7;font-family:'Segoe UI',system-ui,sans-serif;font-size:11px;user-select:none}
.cmp-sb{background:#fff;border-right:1px solid rgba(0,0,0,.12);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;transition:width .18s}
.cmp-logo{padding:7px 10px;background:#14532d;display:flex;align-items:center;gap:8px;flex-shrink:0}
.cmp-logo-txt{color:#fff;font-size:12px;font-weight:700;white-space:nowrap}
.cmp-logo-sub{font-size:9px;color:#86efac;white-space:nowrap}
.cmp-collapse{margin-left:auto;background:none;border:none;color:#86efac;font-size:13px;cursor:pointer;padding:2px 5px;border-radius:3px}
.cmp-collapse:hover{color:#fff;background:rgba(255,255,255,.15)}
.cmp-stabs{display:flex;border-bottom:2px solid #4ade80;flex-shrink:0}
.cmp-stab{flex:1;padding:7px 3px;font-size:10px;font-weight:700;border:none;cursor:pointer;background:transparent;color:#6b7280;transition:all .15s}
.cmp-stab.on{background:#14532d;color:#fff}
.cmp-stab:hover:not(.on){background:#f0fdf4;color:#14532d}
.cmp-sbody{flex:1;overflow-y:auto;overflow-x:hidden}
.cmp-sbody::-webkit-scrollbar{width:4px}.cmp-sbody::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}
.cmp-sfoot{padding:7px 10px;background:#14532d;flex-shrink:0}
.cmp-sft{display:flex;justify-content:space-between;color:#bbf7d0;font-size:12px;font-weight:600}
.cmp-sfs{font-size:9px;color:#6ee7b7;margin-top:2px}
.cmp-resizer{width:5px;background:transparent;cursor:col-resize;flex-shrink:0;transition:background .15s}
.cmp-resizer:hover,.cmp-resizer.active{background:rgba(74,222,128,.6)}
.cmp-cat-tb{display:flex;align-items:center;gap:5px;padding:4px 6px;background:#f0fdf4;border-bottom:1px solid #bbf7d0;flex-shrink:0}
.cmp-cat-all{font-size:10px;padding:2px 9px;border:none;border-radius:3px;cursor:pointer;font-weight:700;background:#4ade80;color:#14532d}
.cmp-cat-info{font-size:9px;color:#065f46;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmp-tnode{display:flex;align-items:center;min-height:23px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,.05);transition:background .1s}
.cmp-tnode:hover{background:#f9fafb}
.cmp-tnode.flt{background:#14532d!important}
.cmp-tarr{width:16px;flex-shrink:0;font-size:9px;text-align:center;opacity:.6}
.cmp-tlb{flex:1;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 3px;color:#111}
.cmp-tcnt{width:26px;flex-shrink:0;font-size:9px;text-align:right;opacity:.55}
.cmp-ttot{width:70px;flex-shrink:0;font-size:9px;text-align:right;font-weight:600;padding-right:5px;color:#065f46}
.cmp-tnode.flt .cmp-tlb,.cmp-tnode.flt .cmp-tcnt,.cmp-tnode.flt .cmp-ttot{color:#fff!important;opacity:1}
.cmp-t-sc{padding-left:4px;font-weight:700;background:rgba(0,0,0,.03)}
.cmp-t-c{padding-left:14px}
.cmp-wbs-hdr{display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:#f9fafb;border-bottom:1px solid rgba(0,0,0,.1);flex-shrink:0}
.cmp-wbs-hdr-t{font-size:9px;font-weight:700;color:#6b7280;letter-spacing:.4px;text-transform:uppercase}
.cmp-wbs-kpi{display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #4ade80;flex-shrink:0}
.cmp-wkpi{padding:4px 6px;text-align:center;background:#f0fdf4;border-right:1px solid #bbf7d0}
.cmp-wkpi:last-child{border-right:none}
.cmp-wkpi-v{font-size:11px;font-weight:700;color:#14532d;display:block}
.cmp-wkpi-l{font-size:8px;color:#6b7280;display:block}
.cmp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.cmp-tbar{display:flex;align-items:center;gap:5px;padding:4px 10px;background:#fff;border-bottom:1px solid rgba(0,0,0,.1);flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.06);flex-wrap:wrap}
.cmp-tbtn{font-size:10px;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-weight:600;background:#374151}
.cmp-tbtn.green{background:#14532d}
.cmp-hint{font-size:9px;color:#9ca3af;font-style:italic;white-space:nowrap}
.cmp-vbar{display:flex;align-items:center;gap:5px;padding:3px 10px;background:#f9fafb;border-bottom:1px solid rgba(0,0,0,.08);flex-shrink:0}
.cmp-vbl{color:#6b7280;font-size:10px;white-space:nowrap}
.cmp-vtab{font-size:10px;padding:2px 8px;background:transparent;border:1px solid rgba(0,0,0,.15);border-radius:10px;cursor:pointer;color:#6b7280}
.cmp-vtab.on{background:#14532d;color:#fff;border-color:#14532d}
.cmp-vcnt{color:#9ca3af;margin-left:auto;font-size:9px;white-space:nowrap}
.cmp-tscroll{flex:1;overflow:auto}
.cmp-tscroll::-webkit-scrollbar{width:6px;height:6px}.cmp-tscroll::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
table.cmp-t{width:100%;border-collapse:collapse}
table.cmp-t thead{position:sticky;top:0;z-index:10;background:#4ade80}
table.cmp-t th{padding:3px 5px;font-size:9px;font-weight:700;background:#4ade80;color:#14532d;border-right:1px solid #16a34a;text-align:center;white-space:nowrap}
table.cmp-t th.thl{text-align:left;padding-left:6px}
table.cmp-t td{padding:2px 4px;vertical-align:middle;border-right:1px solid #e5e7eb;border-bottom:1px solid #f3f4f6}
.cmp-hsc td{background:#1e5631;padding:4px 10px;font-weight:700;font-size:11px;color:#fff;letter-spacing:.4px;border-bottom:2px solid #4ade80}
.cmp-hsc.var td{background:#1e3a5f;border-bottom-color:#3b82f6}
.cmp-hca td{background:#166534;padding:3px 10px 3px 20px;font-weight:600;font-size:11px;color:#d1fae5}
.cmp-rvo{cursor:pointer}
.cmp-rvo:hover td{background:#d1fae5}
.cmp-rvo.sel td{background:#bfdbfe!important;font-weight:600}
.cmp-rmi{background:#f9fafb;cursor:default}
.cmp-rmi:hover td{background:#f0fdf4}
.cmp-rsom td{background:#ecfdf5;color:#065f46;border-top:1px solid #6ee7b7;border-bottom:2px solid #6ee7b7}
.cmp-mono{font-family:monospace;font-size:10px}
.cmp-wbadge{display:inline-block;font-size:8px;padding:1px 4px;border-radius:2px;margin-left:4px;font-weight:700;border:1px solid}
.cmp-wbadge.set{background:#dbeafe;color:#1e40af;border-color:#93c5fd}
.cmp-wbadge.unset{background:#fef3c7;color:#92400e;border-color:#fcd34d}
.cmp-edt{display:block;text-align:right;cursor:default;font-size:10px;min-height:14px;color:#374151}
.cmp-wbs-pi{padding:5px 8px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(0,0,0,.05)}
.cmp-wbs-pi:hover{background:#f0fdf4}
.cmp-wbs-pi .wbs-code{font-family:monospace;font-size:9px;color:#6b7280;width:48px;flex-shrink:0}
.cmp-toast{position:fixed;bottom:20px;right:20px;background:#14532d;color:#fff;padding:10px 16px;border-radius:8px;font-size:11px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:1000;opacity:0;transition:opacity .3s;pointer-events:none}
.cmp-toast.show{opacity:1}
.sal-inp-cell{width:78px;border:1.5px solid #3b82f6;border-radius:3px;padding:2px 5px;font-size:11px;font-family:monospace;background:#eff6ff;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,.15);color:#1e40af;text-align:right;display:block}
.sal-inp-cell:focus{border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(29,78,216,.2)}
.sal-inp-cell:disabled{background:#f9fafb;border-color:#e5e7eb;color:#d1d5db;cursor:not-allowed}
`

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? ''
const f3 = (n: number) => n?.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? ''

// ─── Props ────────────────────────────────────────────────────────────────────
interface SalGridProps {
  commessaId: string
  salId: string
  salNumero: number
  salPrecedenti: Array<{ id: string; numero: number; stato: string }>
  qtPerSal: Record<string, Record<string, number>>
  qtCumulative: Record<string, number>
  qtInput: Record<string, number>
  onQtChange: (voceId: string, val: number) => void
  onSalva: () => void
  onAnnulla: () => void
  pdfDlUrl?: string
  onUploadPdf: (file: File) => void
  saving?: boolean
}

// ─── Colori stato SAL ────────────────────────────────────────────────────────
const SC: Record<string, string> = { bozza:'#f59e0b', emesso:'#3b82f6', approvato:'#8b5cf6', fatturato:'#14b8a6', pagato:'#10b981' }

// ─── Componente ───────────────────────────────────────────────────────────────
export default function SalGrid(props: SalGridProps) {
  const [voci, setVoci] = useState<VoceDB[]>([])
  const [caricamento, setCaricamento] = useState(true)

  const [stab, setStab]       = useState<'cat' | 'wbs'>('cat')
  const [sbHidden, setSbHidden] = useState(false)
  const [sbWidth, setSbWidth]   = useState(270)
  const [catFilter, setCatFilter] = useState<{ sc: string | null; c: string | null }>({ sc: null, c: null })
  const [catExp, setCatExp]     = useState<Record<string, boolean>>({})
  const [wbsExp, setWbsExp]     = useState<Record<string, boolean>>({})
  const [wbsSel, setWbsSel]     = useState<string | null>(null)
  const [sel, setSel]           = useState<string | null>(null)
  const [toast, setToast]       = useState('')

  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined') return parseInt(localStorage.getItem('computo-font-size') || '11')
    return 11
  })
  const changeFontSize = (delta: number) => {
    setFontSize(prev => {
      const next = Math.min(13, Math.max(9, prev + delta))
      localStorage.setItem('computo-font-size', String(next))
      return next
    })
  }

  const toastRef = useRef<NodeJS.Timeout | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2800)
  }

  // ─── Carica voci da DB ─────────────────────────────────────────────────────
  const caricaVoci = useCallback(async () => {
    if (!props.commessaId) return
    setCaricamento(true)
    try {
      const { data: computo } = await supabase
        .from('computo_metrico').select('id').eq('commessa_id', props.commessaId).single()
      if (!computo) { setCaricamento(false); return }

      const [{ data: v }, { data: vociVarRaw }] = await Promise.all([
        supabase.from('voci_computo')
          .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,capitolo,categoria,note,wbs_id,wbs_label')
          .eq('computo_id', computo.id).order('capitolo').order('codice'),
        supabase.from('voci_variante')
          .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,tipo_modifica,variante:varianti(numero,stato)')
          .eq('commessa_id', props.commessaId),
      ])

      const vociEsecutive: VoceDB[] = ((vociVarRaw || []) as any[])
        .filter(vv => (vv.variante as any)?.stato === 'esecutiva')
        .map(vv => ({
          id: vv.id, codice: vv.codice || '', descrizione: vv.descrizione || '',
          um: vv.um || '', quantita: vv.quantita || 0,
          prezzo_unitario: vv.prezzo_unitario || 0, importo: vv.importo || 0,
          capitolo: `VARIANTE ESECUTIVA N.${(vv.variante as any)?.numero ?? '?'}`,
          categoria: `VARIANTE ESECUTIVA N.${(vv.variante as any)?.numero ?? '?'}`,
          note: vv.note, wbs_id: vv.wbs_id, wbs_label: vv.wbs_label,
          _isVariante: true, _tipoModifica: vv.tipo_modifica,
        }))

      setVoci([...(v as VoceDB[] || []), ...vociEsecutive])
    } finally { setCaricamento(false) }
  }, [props.commessaId])

  useEffect(() => { caricaVoci() }, [caricaVoci])

  // ─── Valori derivati ───────────────────────────────────────────────────────
  const importoPeriodo = voci.reduce((s, v) => s + (props.qtInput[v.id] || 0) * v.prezzo_unitario, 0)
  const cumulPrec      = voci.reduce((s, v) => s + (props.qtCumulative[v.id] || 0) * v.prezzo_unitario, 0)

  const catTree = (() => {
    const scMap: Record<string, { n: number; tot: number; cats: Record<string, { n: number; tot: number }> }> = {}
    voci.forEach(v => {
      const sc = v.capitolo || 'Generale'; const c = v.categoria || sc
      if (!scMap[sc]) scMap[sc] = { n: 0, tot: 0, cats: {} }
      scMap[sc].n++; scMap[sc].tot += v.importo || 0
      if (!scMap[sc].cats[c]) scMap[sc].cats[c] = { n: 0, tot: 0 }
      scMap[sc].cats[c].n++; scMap[sc].cats[c].tot += v.importo || 0
    })
    return Object.entries(scMap).map(([sc, d]) => ({
      id: sc, lb: sc, n: d.n, tot: d.tot,
      ch: Object.entries(d.cats).map(([c, cd]) => ({ id: c, lb: c, n: cd.n, tot: cd.tot }))
    }))
  })()

  const wbsBudget = (code: string): number => {
    const ch = WBS_CHILDREN(code)
    return voci.filter(v => v.wbs_id === code).reduce((s, v) => s + v.importo, 0) + ch.reduce((s, c) => s + wbsBudget(c), 0)
  }
  const wbsCount = (code: string): number => {
    const ch = WBS_CHILDREN(code)
    return voci.filter(v => v.wbs_id === code).length + ch.reduce((s, c) => s + wbsCount(c), 0)
  }

  const vociFiltrate = voci.filter(v => {
    if (wbsSel) return v.wbs_id === wbsSel
    if (catFilter.c) return v.categoria === catFilter.c || v.capitolo === catFilter.c
    if (catFilter.sc) return v.capitolo === catFilter.sc
    return true
  })

  // ─── Resizer ───────────────────────────────────────────────────────────────
  const resizerRef = useRef<HTMLDivElement>(null)
  const rDrag = useRef(false); const rStartX = useRef(0); const rStartW = useRef(sbWidth)
  useEffect(() => {
    const mm = (e: MouseEvent) => { if (!rDrag.current) return; setSbWidth(Math.max(180, Math.min(500, rStartW.current + (e.clientX - rStartX.current)))) }
    const mu = () => { rDrag.current = false; resizerRef.current?.classList.remove('active') }
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu)
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu) }
  }, [])
  const onResizerDown = (e: React.MouseEvent) => { rDrag.current = true; rStartX.current = e.clientX; rStartW.current = sbWidth; resizerRef.current?.classList.add('active'); e.preventDefault() }

  // ─── WBS Tree ──────────────────────────────────────────────────────────────
  const renderWBSNode = (code: string, lvl: number): React.ReactNode => {
    const ch = WBS_CHILDREN(code)
    const cnt = wbsCount(code); const bgt = wbsBudget(code); const isSel = wbsSel === code
    return (
      <div key={code}>
        <div className={`cmp-tnode${isSel ? ' flt' : ''}`} style={{ paddingLeft: 4 + lvl * 12 }}
          onClick={() => { setWbsSel(isSel ? null : code); if (ch.length) setWbsExp(p => ({ ...p, [code]: !p[code] })) }}>
          <span className="cmp-tarr">{ch.length ? (wbsExp[code] ? '▼' : '▶') : ''}</span>
          <span className="cmp-tlb" title={WBS_MAP[code]}>{code} {WBS_MAP[code]}</span>
          {cnt > 0 && <span className="cmp-tcnt">({cnt})</span>}
          {bgt > 0 && <span className="cmp-ttot">{fi(bgt, 0)}</span>}
        </div>
        {wbsExp[code] && ch.map(c => renderWBSNode(c, lvl + 1))}
      </div>
    )
  }

  // ─── Righe tabella ─────────────────────────────────────────────────────────
  type Row =
    | { type: 'hsc'; id: string; lb: string; isVar: boolean }
    | { type: 'hca'; id: string; lb: string }
    | { type: 'vo'; v: VoceDB }
    | { type: 'mi'; v: VoceDB }
    | { type: 'som'; v: VoceDB }

  const tableRows: Row[] = (() => {
    const rows: Row[] = []
    let lastSC = '', lastC = ''
    for (const v of vociFiltrate) {
      const isVar = !!v._isVariante
      if (v.capitolo !== lastSC) {
        rows.push({ type: 'hsc', id: v.capitolo, lb: v.capitolo, isVar })
        lastSC = v.capitolo; lastC = ''
      }
      if (v.categoria && v.categoria !== v.capitolo && v.categoria !== lastC) {
        rows.push({ type: 'hca', id: v.categoria, lb: v.categoria })
        lastC = v.categoria
      }
      rows.push({ type: 'vo', v })
      rows.push({ type: 'mi', v })
      rows.push({ type: 'som', v })
    }
    return rows
  })()

  const voceIdx = (v: VoceDB) => voci.indexOf(v) + 1

  // totalCols = Nr(1)+Tariffa(1)+Des(1)+4dims+Qta(1)+PU(1)+Tot(1) + N_sal+Cumul+Input+Residuo
  //           = 10 + salPrecedenti.length + 3
  // Nota: in riga 'vo' Tot è vuoto; in 'som' è pieno — colonna c'è sempre
  const totalCols = 10 + props.salPrecedenti.length + 3

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: V3_CSS }} />
      <style>{`table.cmp-t tbody td { font-size: ${fontSize}px !important; }`}</style>
      <div className="cmp-root" style={{ height: 'calc(100vh - 280px)' }}>

        {/* SIDEBAR */}
        {!sbHidden && (
          <div className="cmp-sb" style={{ width: sbWidth, minWidth: sbWidth }}>
            <div className="cmp-logo">
              <span className="cmp-logo-txt">📋 SAL N.{props.salNumero}</span>
              <span className="cmp-logo-sub">{vociFiltrate.length} voci</span>
              <button className="cmp-collapse" onClick={() => setSbHidden(true)}>◀</button>
            </div>
            <div className="cmp-stabs">
              {(['cat', 'wbs'] as const).map(k => (
                <button key={k} className={`cmp-stab${stab === k ? ' on' : ''}`} onClick={() => setStab(k)}>
                  {k === 'cat' ? '🏷 Categorie' : '📐 WBS'}
                </button>
              ))}
            </div>
            <div className="cmp-wbs-kpi">
              <div className="cmp-wkpi">
                <span className="cmp-wkpi-v">€ {fi(importoPeriodo, 0)}</span>
                <span className="cmp-wkpi-l">Periodo</span>
              </div>
              <div className="cmp-wkpi">
                <span className="cmp-wkpi-v">€ {fi(cumulPrec, 0)}</span>
                <span className="cmp-wkpi-l">Cumulat. prec.</span>
              </div>
            </div>
            <div className="cmp-sbody">
              {stab === 'cat' ? (
                <>
                  <div className="cmp-cat-tb">
                    <button className="cmp-cat-all" onClick={() => setCatFilter({ sc: null, c: null })}>Tutto</button>
                    <span className="cmp-cat-info">{catFilter.c || catFilter.sc || 'Nessun filtro'}</span>
                  </div>
                  {catTree.map(sc => {
                    const isFlt = catFilter.sc === sc.id && !catFilter.c
                    return (
                      <div key={sc.id}>
                        <div className={`cmp-tnode cmp-t-sc${isFlt ? ' flt' : ''}`}
                          onClick={() => { setCatFilter(isFlt ? { sc: null, c: null } : { sc: sc.id, c: null }); setCatExp(p => ({ ...p, [sc.id]: !p[sc.id] })) }}>
                          <span className="cmp-tarr">{sc.ch.length ? (catExp[sc.id] ? '▼' : '▶') : ''}</span>
                          <span className="cmp-tlb" title={sc.lb}>{sc.lb}</span>
                          <span className="cmp-tcnt">({sc.n})</span>
                          <span className="cmp-ttot">{fi(sc.tot, 0)}</span>
                        </div>
                        {catExp[sc.id] && sc.ch.map(c => {
                          const isCFlt = catFilter.c === c.id
                          return (
                            <div key={c.id} className={`cmp-tnode cmp-t-c${isCFlt ? ' flt' : ''}`}
                              onClick={e => { e.stopPropagation(); setCatFilter(isCFlt ? { sc: sc.id, c: null } : { sc: sc.id, c: c.id }) }}>
                              <span className="cmp-tarr" />
                              <span className="cmp-tlb">{c.lb}</span>
                              <span className="cmp-tcnt">({c.n})</span>
                              <span className="cmp-ttot">{fi(c.tot, 0)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </>
              ) : (
                <>
                  <div className="cmp-wbs-hdr">
                    <span className="cmp-wbs-hdr-t">Struttura WBS</span>
                    {wbsSel && <button style={{ fontSize: 9, padding: '1px 6px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }} onClick={() => setWbsSel(null)}>✕ tutto</button>}
                  </div>
                  {WBS_ROOTS.map(c => renderWBSNode(c, 0))}
                </>
              )}
            </div>
            <div className="cmp-sfoot">
              <div className="cmp-sft"><span>Periodo SAL</span><span>€ {fi(importoPeriodo)}</span></div>
              {(wbsSel || catFilter.sc) ? (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '5px 0' }} />
                  <div className="cmp-sft" style={{ fontSize: 11 }}>
                    <span>{vociFiltrate.length} voci filtrate</span>
                  </div>
                  <div className="cmp-sfs">{wbsSel ? `WBS: ${wbsSel}` : catFilter.c || catFilter.sc}</div>
                </>
              ) : (
                <div className="cmp-sfs">computo + varianti esecutive · read-only</div>
              )}
            </div>
          </div>
        )}

        {!sbHidden && <div ref={resizerRef} className="cmp-resizer" onMouseDown={onResizerDown} />}

        {/* MAIN */}
        <div className="cmp-main">

          {/* TOOLBAR */}
          <div className="cmp-tbar">
            {sbHidden && <button className="cmp-tbtn green" onClick={() => setSbHidden(false)}>▶</button>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
              {wbsSel ? (
                <><span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>📐 {wbsSel} {WBS_MAP[wbsSel]}</span>
                  <button style={{ fontSize: 9, padding: '1px 6px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }} onClick={() => setWbsSel(null)}>✕</button></>
              ) : catFilter.sc ? (
                <><span style={{ fontWeight: 700, color: '#14532d', fontSize: 11 }}>{catFilter.sc}</span>
                  <button style={{ fontSize: 9, padding: '1px 6px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }} onClick={() => setCatFilter({ sc: null, c: null })}>✕</button></>
              ) : <span style={{ fontSize: 10, color: '#9ca3af' }}>click su riga per dettaglio · inserisci quantità nella colonna "Questo SAL"</span>}
            </div>
            <button className="cmp-tbtn" style={{ opacity: fontSize <= 9 ? 0.4 : 1 }} onClick={() => changeFontSize(-1)} disabled={fontSize <= 9}>A-</button>
            <span style={{ fontSize: 10, color: '#6b7280', minWidth: 26, textAlign: 'center' }}>{fontSize}px</span>
            <button className="cmp-tbtn" style={{ opacity: fontSize >= 13 ? 0.4 : 1 }} onClick={() => changeFontSize(1)} disabled={fontSize >= 13}>A+</button>
            <label style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: '#4b5563', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              📎 PDF DL
              <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) props.onUploadPdf(f) }} />
            </label>
            {props.pdfDlUrl && (
              <a href={props.pdfDlUrl} target="_blank" rel="noopener" style={{ fontSize: 10, color: '#1d4ed8', textDecoration: 'none', padding: '3px 6px', background: '#eff6ff', borderRadius: 4 }}>📄 PDF</a>
            )}
            <button className="cmp-tbtn" onClick={props.onAnnulla}>✕ Annulla</button>
            <button className="cmp-tbtn green" onClick={props.onSalva} disabled={props.saving}>
              {props.saving ? '⏳...' : '💾 Salva SAL'}
            </button>
          </div>

          {/* VISTA BAR */}
          <div className="cmp-vbar">
            <span className="cmp-vbl">Filtro:</span>
            <button className={`cmp-vtab${!wbsSel && !catFilter.sc ? ' on' : ''}`} onClick={() => { setWbsSel(null); setCatFilter({ sc: null, c: null }) }}>Tutto</button>
            <span className="cmp-vcnt">{vociFiltrate.length} voci · €{fi(importoPeriodo, 0)} periodo</span>
          </div>

          {/* TABELLA */}
          {caricamento ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#6b7280' }}>
              <span style={{ width: 20, height: 20, border: '2px solid #d1d5db', borderTopColor: '#14532d', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
              Caricamento voci computo...
            </div>
          ) : voci.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#9ca3af' }}>
              <div style={{ fontSize: 40 }}>📄</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>Nessun computo importato</p>
              <p style={{ fontSize: 12 }}>Importa un file XPWE dalla sezione Computo prima di inserire un SAL.</p>
            </div>
          ) : (
            <div className="cmp-tscroll" onClick={() => setSel(null)}>
              <table className="cmp-t" style={{ tableLayout: 'auto' }}>
                <colgroup>
                  <col style={{ width: 34 }} /><col style={{ width: 90 }} /><col />
                  <col style={{ width: 46 }} /><col style={{ width: 46 }} /><col style={{ width: 46 }} /><col style={{ width: 46 }} />
                  <col style={{ width: 66 }} />
                  <col style={{ width: 66 }} /><col style={{ width: 78 }} />
                  {props.salPrecedenti.map(s => <col key={s.id} style={{ width: 52 }} />)}
                  <col style={{ width: 60 }} /><col style={{ width: 82 }} /><col style={{ width: 66 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>Nr</th>
                    <th rowSpan={2}>Tariffa</th>
                    <th rowSpan={2} className="thl">DESIGNAZIONE dei LAVORI / WBS</th>
                    <th colSpan={4}>DIMENSIONI</th>
                    <th rowSpan={2}>Quantità</th>
                    <th colSpan={2}>IMPORTI</th>
                    <th colSpan={props.salPrecedenti.length + 3} style={{ background: '#1e3a5f', color: '#93c5fd' }}>SAL PERIODO</th>
                  </tr>
                  <tr>
                    {['par.ug.', 'lung.', 'larg.', 'H/peso'].map(t => <th key={t}>{t}</th>)}
                    {['unit.[1]', 'TOTALE'].map(t => <th key={t}>{t}</th>)}
                    {props.salPrecedenti.map(s => (
                      <th key={s.id} style={{ background: '#1e3a5f', color: SC[s.stato] || '#93c5fd', fontSize: 8 }}>N.{s.numero}</th>
                    ))}
                    <th style={{ background: '#1e3a5f', color: '#60a5fa' }}>Cumul.</th>
                    <th style={{ background: '#1e3a5f', color: '#4ade80' }}>Questo SAL</th>
                    <th style={{ background: '#1e3a5f', color: '#fbbf24' }}>Residuo</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    if (row.type === 'hsc') {
                      return (
                        <tr key={`hsc_${i}`} className={`cmp-hsc${row.isVar ? ' var' : ''}`}>
                          <td colSpan={totalCols}>▸ {row.lb}</td>
                        </tr>
                      )
                    }
                    if (row.type === 'hca') {
                      return <tr key={`hca_${i}`} className="cmp-hca"><td colSpan={totalCols}>{row.lb}</td></tr>
                    }

                    if (row.type === 'vo') {
                      const v = row.v
                      const isSel = sel === v.id
                      const isSoppressione = v._tipoModifica === 'soppressione'
                      const idx = voceIdx(v)
                      const hasWBS = !!v.wbs_id
                      const qtCorr = isSoppressione ? 0 : (props.qtInput[v.id] || 0)
                      const qtPrec = props.qtCumulative[v.id] || 0
                      const residuo = v.quantita - qtPrec - qtCorr
                      return (
                        <tr key={v.id}
                          className={`cmp-rvo${isSel ? ' sel' : ''}${isSoppressione ? '' : ''}`}
                          onClick={e => { e.stopPropagation(); setSel(prev => prev === v.id ? null : v.id) }}>
                          <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700 }}>{idx}</td>
                          <td style={{ fontSize: 10, color: '#1d4ed8', fontFamily: 'monospace' }}>{v.codice}</td>
                          <td style={{ fontSize: 10, maxWidth: 0 }}>
                            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', textDecoration: isSoppressione ? 'line-through' : 'none', opacity: isSoppressione ? 0.5 : 1 }}>{v.descrizione}</span>
                            <span className={`cmp-wbadge ${hasWBS ? 'set' : 'unset'}`} title={hasWBS ? `WBS: ${v.wbs_id} ${v.wbs_label || ''}` : 'WBS non assegnato'}>
                              {hasWBS ? `📐 ${v.wbs_id}` : '—WBS'}
                            </span>
                            {v._isVariante && (
                              <span style={{ fontSize: 8, background: '#1e3a5f', color: '#93c5fd', padding: '1px 5px', borderRadius: 3, marginLeft: 4, fontWeight: 700 }}>🔵 Var.</span>
                            )}
                          </td>
                          <td /><td /><td /><td />
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{f3(v.quantita)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>{fi(v.prezzo_unitario)}</td>
                          <td />
                          {props.salPrecedenti.map(sal => {
                            const q = props.qtPerSal[v.id]?.[sal.id] || 0
                            return (
                              <td key={sal.id} style={{ textAlign: 'right', fontFamily: 'monospace', color: q > 0 ? (SC[sal.stato] || '#374151') : '#e5e7eb' }}>
                                {q > 0 ? f3(q) : '—'}
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: qtPrec > 0 ? '#374151' : '#d1d5db', fontWeight: qtPrec > 0 ? 600 : 400 }}>
                            {qtPrec > 0 ? f3(qtPrec) : '—'}
                          </td>
                          <td style={{ padding: '1px 3px' }} onClick={e => e.stopPropagation()}>
                            {!isSoppressione ? (
                              <input
                                type="number"
                                className="sal-inp-cell"
                                value={props.qtInput[v.id] > 0 ? props.qtInput[v.id] : ''}
                                onChange={e => props.onQtChange(v.id, parseFloat(e.target.value) || 0)}
                                min={0}
                                step="any"
                                placeholder="0"
                              />
                            ) : <span style={{ fontSize: 10, color: '#d1d5db', textAlign: 'center', display: 'block' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: residuo < 0 ? 700 : 400, color: residuo < 0 ? '#dc2626' : residuo === 0 ? '#9ca3af' : '#374151' }}>
                            {f3(residuo)}
                          </td>
                        </tr>
                      )
                    }

                    if (row.type === 'mi') {
                      const v = row.v; const isSel = sel === v.id
                      return (
                        <tr key={`mi_${v.id}`} className={`cmp-rmi${isSel ? ' sel' : ''}`}>
                          <td /><td />
                          <td style={{ paddingLeft: 28, color: '#6b7280', fontSize: 10, fontStyle: 'italic' }}>
                            {v.note?.split('>').pop()?.trim() || 'misura da XPWE'}
                          </td>
                          <td><span className="cmp-edt">1</span></td>
                          <td><span className="cmp-edt cmp-mono">{f3(v.quantita)}</span></td>
                          <td /><td />
                          <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 10, fontFamily: 'monospace' }}>{f3(v.quantita)}</td>
                          <td /><td />
                          {props.salPrecedenti.map(s => <td key={s.id} />)}
                          <td /><td /><td />
                        </tr>
                      )
                    }

                    if (row.type === 'som') {
                      const v = row.v; const isSel = sel === v.id
                      const qtPrec = props.qtCumulative[v.id] || 0
                      const qtCorr = v._tipoModifica === 'soppressione' ? 0 : (props.qtInput[v.id] || 0)
                      const residuo = v.quantita - qtPrec - qtCorr
                      return (
                        <React.Fragment key={`som_${v.id}`}>
                          <tr className="cmp-rsom">
                            <td colSpan={3} style={{ textAlign: 'right', paddingRight: 6, fontWeight: 700, fontSize: 10 }}>SOMMANO {v.um}</td>
                            <td colSpan={4} />
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{f3(v.quantita)}</td>
                            <td style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>{fi(v.prezzo_unitario)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{fi(v.importo)}</td>
                            {props.salPrecedenti.map(s => <td key={s.id} />)}
                            <td /><td /><td />
                          </tr>
                          {isSel && (
                            <tr>
                              <td colSpan={totalCols} style={{ padding: 0 }}>
                                <div style={{ background: '#f0f9ff', borderTop: '2px solid #38bdf8', padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontFamily: 'monospace', color: '#1d4ed8', fontWeight: 700 }}>{v.codice}</span>
                                    <span style={{ fontSize: 11, color: '#374151' }}>{v.descrizione}</span>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px 16px', marginBottom: 8 }}>
                                    <div>
                                      <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>Contratto</div>
                                      <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{f3(v.quantita)} {v.um}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>Certificato cumulativo</div>
                                      <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{f3(qtPrec)} {v.um}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>Questo SAL</div>
                                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{f3(qtCorr)} {v.um}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>Residuo</div>
                                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: residuo < 0 ? '#dc2626' : residuo === 0 ? '#6b7280' : '#059669' }}>
                                        {f3(residuo)} {v.um}
                                      </div>
                                    </div>
                                  </div>
                                  <button onClick={() => setSel(null)} style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(0,0,0,.08)', border: 'none', borderRadius: 3, cursor: 'pointer', color: '#374151' }}>✕ Chiudi</button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    }
                    return null
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TOAST */}
        <div className={`cmp-toast${toast ? ' show' : ''}`}>{toast}</div>
      </div>
    </>
  )
}
