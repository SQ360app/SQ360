'use client'

import React, { useState, useEffect, useRef } from 'react'

// ─── WBS (copiato da computo/page.tsx) ───────────────────────────────────────
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
  const p = c.split('.'); if (p.length === 1) return false; p.pop(); return p.join('.') === parent
}).map(([c]) => c)

// ─── Tipi ─────────────────────────────────────────────────────────────────────
export interface VoceComputoItem {
  id: string; codice: string; descrizione: string; um: string
  quantita: number; prezzo_unitario: number; importo: number
  capitolo: string; categoria?: string; wbs_id?: string; wbs_label?: string
  _isVariante?: boolean; _tipoModifica?: 'aggiunta' | 'modifica_quantita' | 'soppressione'
}
export interface SalPrecedente { id: string; numero: number; stato: string; data_emissione: string }

export interface SalInserimentoProps {
  voci: VoceComputoItem[]
  salNumero: number
  salPrecedenti: SalPrecedente[]
  qtPerSal: Record<string, Record<string, number>>  // voceId → salId → qty
  qtCumulative: Record<string, number>               // voceId → totale SAL precedenti
  qtInput: Record<string, string>                    // voceId → val stringa corrente
  onQtChange: (voceId: string, val: string) => void
  onSalva: () => void
  onAnnulla: () => void
  onUploadPdf: (file: File) => void
  pdfDlUrl?: string
  saving?: boolean
}

// ─── CSS (V3_CSS da computo + aggiunte SAL) ───────────────────────────────────
const CSS = `
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
.cmp-rvo{cursor:pointer}
.cmp-rvo:hover td{background:#d1fae5}
.cmp-rvo.active td{background:#bfdbfe}
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
.cmp-wbadge{display:inline-block;font-size:8px;padding:1px 4px;border-radius:2px;margin-left:4px;font-weight:700;border:1px solid}
.cmp-wbadge.set{background:#dbeafe;color:#1e40af;border-color:#93c5fd}
.cmp-wbadge.unset{background:#fef3c7;color:#92400e;border-color:#fcd34d}
.cmp-wbs-pi{padding:5px 8px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(0,0,0,.05)}
.cmp-wbs-pi:hover{background:#f0fdf4}
.cmp-wbs-pi .wbs-code{font-family:monospace;font-size:9px;color:#6b7280;width:48px;flex-shrink:0}
.sal-inp-cell{width:82px;border:1.5px solid #3b82f6;border-radius:3px;padding:2px 5px;font-size:11px;font-family:monospace;background:#eff6ff;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,.15);color:#1e40af;text-align:right;display:block}
.sal-inp-cell:focus{border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(29,78,216,.2)}
.sal-inp-cell:disabled{background:#f9fafb;border-color:#e5e7eb;color:#d1d5db;cursor:not-allowed}
.sal-pct-bar{height:3px;border-radius:2px;overflow:hidden;background:#e5e7eb;margin-bottom:2px}
.sal-pct-fill{height:100%;border-radius:2px;transition:width .3s}
.sal-row-act td{background:rgba(16,185,129,.05)!important}
.sal-row-sup{opacity:.4}
`

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fi = (n: number, d = 2) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })
const f3 = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const pctColor = (p: number) => p === 0 ? '#d1d5db' : p < 50 ? '#f59e0b' : p < 100 ? '#3b82f6' : '#10b981'
const SC: Record<string, string> = { bozza:'#f59e0b', emesso:'#3b82f6', approvato:'#8b5cf6', fatturato:'#14b8a6', pagato:'#10b981' }

// ─── Componente ───────────────────────────────────────────────────────────────
export default function SalInserimento({
  voci, salNumero, salPrecedenti,
  qtPerSal, qtCumulative, qtInput,
  onQtChange, onSalva, onAnnulla, onUploadPdf,
  pdfDlUrl, saving = false,
}: SalInserimentoProps) {

  const [stab, setStab]       = useState<'cat' | 'wbs'>('cat')
  const [sbHidden, setSbHidden] = useState(false)
  const [sbWidth, setSbWidth]   = useState(270)
  const [catFilter, setCatFilter] = useState<{ sc: string | null; c: string | null }>({ sc: null, c: null })
  const [catExp, setCatExp]     = useState<Record<string, boolean>>({})
  const [wbsExp, setWbsExp]     = useState<Record<string, boolean>>({})
  const [wbsSel, setWbsSel]     = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined') return parseInt(localStorage.getItem('sal-font-size') || '11')
    return 11
  })

  const changeFontSize = (delta: number) => setFontSize(prev => {
    const next = Math.min(13, Math.max(9, prev + delta))
    localStorage.setItem('sal-font-size', String(next))
    return next
  })

  // ─── Albero categorie ─────────────────────────────────────────────────────
  const catTree = (() => {
    const m: Record<string, { n: number; tot: number; cats: Record<string, { n: number; tot: number }> }> = {}
    voci.forEach(v => {
      const sc = v.capitolo || 'Generale'; const c = v.categoria || sc
      if (!m[sc]) m[sc] = { n: 0, tot: 0, cats: {} }
      m[sc].n++; m[sc].tot += v.importo || 0
      if (!m[sc].cats[c]) m[sc].cats[c] = { n: 0, tot: 0 }
      m[sc].cats[c].n++; m[sc].cats[c].tot += v.importo || 0
    })
    return Object.entries(m).map(([sc, d]) => ({
      id: sc, lb: sc, n: d.n, tot: d.tot,
      ch: Object.entries(d.cats).map(([c, cd]) => ({ id: c, lb: c, n: cd.n, tot: cd.tot }))
    }))
  })()

  // ─── WBS helpers ──────────────────────────────────────────────────────────
  const wbsBudget = (code: string): number =>
    voci.filter(v => v.wbs_id === code).reduce((s, v) => s + v.importo, 0) +
    WBS_CHILDREN(code).reduce((s, c) => s + wbsBudget(c), 0)
  const wbsCount = (code: string): number =>
    voci.filter(v => v.wbs_id === code).length +
    WBS_CHILDREN(code).reduce((s, c) => s + wbsCount(c), 0)

  // ─── Filtro voci ──────────────────────────────────────────────────────────
  const vociFiltrate = voci.filter(v => {
    if (wbsSel) return v.wbs_id === wbsSel
    if (catFilter.c) return v.categoria === catFilter.c || v.capitolo === catFilter.c
    if (catFilter.sc) return v.capitolo === catFilter.sc
    return true
  })

  // ─── Righe tabella (hsc + hca + vo; no mi/som) ───────────────────────────
  type Row = { type: 'hsc'; id: string; lb: string; isVar: boolean }
           | { type: 'hca'; id: string; lb: string }
           | { type: 'vo'; v: VoceComputoItem; idx: number }
  const tableRows: Row[] = (() => {
    const rows: Row[] = []; let lastSC = ''; let lastC = ''; let idx = 0
    for (const v of vociFiltrate) {
      if (v.capitolo !== lastSC) {
        rows.push({ type: 'hsc', id: v.capitolo, lb: v.capitolo, isVar: !!v._isVariante })
        lastSC = v.capitolo; lastC = ''
      }
      if (v.categoria && v.categoria !== v.capitolo && v.categoria !== lastC) {
        rows.push({ type: 'hca', id: v.categoria, lb: v.categoria })
        lastC = v.categoria
      }
      idx++
      rows.push({ type: 'vo', v, idx })
    }
    return rows
  })()

  // ─── WBS sidebar node ─────────────────────────────────────────────────────
  const renderWBSNode = (code: string, lvl: number): React.ReactNode => {
    const ch = WBS_CHILDREN(code); const cnt = wbsCount(code); const bgt = wbsBudget(code)
    const isSel = wbsSel === code
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

  // ─── Resizer ──────────────────────────────────────────────────────────────
  const resizerRef = useRef<HTMLDivElement>(null)
  const rDrag = useRef(false); const rStartX = useRef(0); const rStartW = useRef(sbWidth)
  useEffect(() => {
    const mm = (e: MouseEvent) => { if (!rDrag.current) return; setSbWidth(Math.max(180, Math.min(500, rStartW.current + (e.clientX - rStartX.current)))) }
    const mu = () => { rDrag.current = false; resizerRef.current?.classList.remove('active') }
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu)
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu) }
  }, [])
  const onResizerDown = (e: React.MouseEvent) => { rDrag.current = true; rStartX.current = e.clientX; rStartW.current = sbWidth; resizerRef.current?.classList.add('active'); e.preventDefault() }

  // ─── KPI live ─────────────────────────────────────────────────────────────
  const importoPeriodo = voci.reduce((s, v) => s + (parseFloat(qtInput[v.id] || '0') || 0) * v.prezzo_unitario, 0)
  const cumulPrec      = voci.reduce((s, v) => s + (qtCumulative[v.id] || 0) * v.prezzo_unitario, 0)
  const ritenuta5      = parseFloat((importoPeriodo * 0.05).toFixed(2))
  const nettoSal       = parseFloat((importoPeriodo - ritenuta5).toFixed(2))

  const nCols = 5 + salPrecedenti.length + 3  // Nr+Tar+Des+UM+QtContr + prevSals + Cumul+Input+Residuo

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <style>{`table.cmp-t tbody td { font-size: ${fontSize}px !important; }`}</style>
      <div className="cmp-root" style={{ height: 'calc(100vh - 260px)' }}>

        {/* SIDEBAR */}
        {!sbHidden && (
          <div className="cmp-sb" style={{ width: sbWidth, minWidth: sbWidth }}>
            <div className="cmp-logo">
              <span className="cmp-logo-txt">📋 SAL N.{salNumero}</span>
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
              <div className="cmp-sft"><span>Periodo</span><span>{fi(importoPeriodo)} €</span></div>
              <div className="cmp-sft" style={{ marginTop: 3 }}><span>Cumulativo</span><span>{fi(cumulPrec + importoPeriodo)} €</span></div>
              <div className="cmp-sft" style={{ marginTop: 3 }}><span>Ritenuta 5%</span><span style={{ color: '#fca5a5' }}>(€ {fi(ritenuta5)})</span></div>
              <div style={{ height: 1, background: 'rgba(255,255,255,.2)', margin: '5px 0' }} />
              <div className="cmp-sft">
                <span style={{ fontWeight: 800, fontSize: 13 }}>NETTO</span>
                <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 14 }}>{fi(nettoSal)} €</span>
              </div>
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
              ) : (
                <span className="cmp-hint">SAL N.{salNumero} — clicca sull&apos;input per inserire la quantità · {salPrecedenti.length} SAL precedenti</span>
              )}
            </div>
            <button className="cmp-tbtn" style={{ opacity: fontSize <= 9 ? 0.4 : 1 }} onClick={() => changeFontSize(-1)} disabled={fontSize <= 9}>A-</button>
            <span style={{ fontSize: 10, color: '#6b7280', minWidth: 26, textAlign: 'center' }}>{fontSize}px</span>
            <button className="cmp-tbtn" style={{ opacity: fontSize >= 13 ? 0.4 : 1 }} onClick={() => changeFontSize(1)} disabled={fontSize >= 13}>A+</button>
            <label style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', background: pdfDlUrl ? '#059669' : '#374151', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
              title={pdfDlUrl ? 'PDF DL caricato — clicca per sostituire' : 'Carica PDF dalla DL'}>
              {pdfDlUrl ? '📄 PDF ✓' : '📎 PDF DL'}
              <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { onUploadPdf(f); e.target.value = '' } }} />
            </label>
            {pdfDlUrl && (
              <a href={pdfDlUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: '#d1fae5', color: '#065f46', textDecoration: 'none', fontWeight: 600 }}>↗</a>
            )}
            <button className="cmp-tbtn" style={{ background: '#6b7280' }} onClick={onAnnulla}>✕ Annulla</button>
            <button className="cmp-tbtn green"
              style={{ background: importoPeriodo > 0 ? '#14532d' : '#9ca3af', cursor: importoPeriodo > 0 ? 'pointer' : 'default' }}
              disabled={saving || importoPeriodo === 0} onClick={onSalva}>
              {saving ? '...' : `💾 Salva — € ${fi(importoPeriodo, 0)}`}
            </button>
          </div>

          {/* VISTA BAR */}
          <div className="cmp-vbar">
            <span className="cmp-vbl">Filtro:</span>
            <button className={`cmp-vtab${!wbsSel && !catFilter.sc ? ' on' : ''}`} onClick={() => { setWbsSel(null); setCatFilter({ sc: null, c: null }) }}>Tutto</button>
            <span className="cmp-vcnt">{vociFiltrate.length} / {voci.length} voci</span>
          </div>

          {/* TABELLA */}
          {voci.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#9ca3af' }}>
              <div style={{ fontSize: 36 }}>📄</div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Nessun computo importato</p>
              <p style={{ fontSize: 11 }}>Importa un file XPWE nella sezione Computo prima di creare un SAL.</p>
            </div>
          ) : (
            <div className="cmp-tscroll">
              <table className="cmp-t" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: 28 }}>Nr</th>
                    <th rowSpan={2} style={{ width: 78 }}>Tariffa</th>
                    <th rowSpan={2} className="thl" style={{ minWidth: 200 }}>DESIGNAZIONE dei LAVORI / WBS</th>
                    <th rowSpan={2} style={{ width: 30 }}>UM</th>
                    <th rowSpan={2} style={{ width: 64 }}>Qt.<br/>Contr.</th>
                    {salPrecedenti.length > 0 && (
                      <th colSpan={salPrecedenti.length} style={{ background: '#374151', color: '#d1d5db', borderColor: '#374151' }}>
                        SAL PRECEDENTI (read-only)
                      </th>
                    )}
                    <th rowSpan={2} style={{ width: 64, background: '#374151', color: '#d1d5db', borderColor: '#374151' }}>Cumul.<br/>Prec.</th>
                    <th rowSpan={2} style={{ width: 90, background: '#1e3a5f', color: '#93c5fd', borderColor: '#1e3a5f' }}>Questo SAL<br/><span style={{ fontSize: 8, fontWeight: 400, color: '#60a5fa' }}>→ inserisci qtà</span></th>
                    <th rowSpan={2} style={{ width: 100 }}>Residuo / %</th>
                  </tr>
                  <tr>
                    {salPrecedenti.map(s => (
                      <th key={s.id}
                        style={{ width: 52, background: (SC[s.stato] || '#666') + '28', color: SC[s.stato] || '#666', borderColor: (SC[s.stato] || '#666') + '55', fontSize: 8 }}
                        title={`${s.data_emissione}`}>
                        N.{s.numero}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    if (row.type === 'hsc')
                      return <tr key={`hsc_${i}`} className={`cmp-hsc${row.isVar ? ' var' : ''}`}><td colSpan={nCols}>▸ {row.lb}</td></tr>
                    if (row.type === 'hca')
                      return <tr key={`hca_${i}`} className="cmp-hca"><td colSpan={nCols}>{row.lb}</td></tr>
                    if (row.type === 'vo') {
                      const { v, idx } = row
                      const isSoppressione = v._tipoModifica === 'soppressione'
                      const qtCorr  = isSoppressione ? 0 : (parseFloat(qtInput[v.id] || '0') || 0)
                      const qtPrec  = qtCumulative[v.id] || 0
                      const residuo = v.quantita - qtPrec - qtCorr
                      const pctTot  = v.quantita > 0 ? Math.min(100, ((qtPrec + qtCorr) / v.quantita) * 100) : 0
                      const pColor  = pctColor(pctTot)
                      const hasWBS  = !!v.wbs_id
                      return (
                        <tr key={v.id} className={`cmp-rvo${qtCorr > 0 ? ' sal-row-act' : ''}${isSoppressione ? ' sal-row-sup' : ''}`}>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx}</td>
                          <td style={{ color: '#1d4ed8', fontFamily: 'monospace', fontSize: 10 }}>{v.codice}</td>
                          <td style={{ maxWidth: 0 }}>
                            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', textDecoration: isSoppressione ? 'line-through' : 'none' }}>{v.descrizione}</span>
                            <span className={`cmp-wbadge ${hasWBS ? 'set' : 'unset'}`} title={hasWBS ? `WBS: ${v.wbs_id} ${v.wbs_label || ''}` : 'WBS non assegnato'}>
                              {hasWBS ? `📐 ${v.wbs_id}` : '—WBS'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{v.um}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{f3(v.quantita)}</td>
                          {salPrecedenti.map(sal => {
                            const q = qtPerSal[v.id]?.[sal.id] || 0
                            return (
                              <td key={sal.id} style={{ textAlign: 'right', fontFamily: 'monospace', color: q > 0 ? (SC[sal.stato] || '#374151') : '#d1d5db' }}>
                                {q > 0 ? f3(q) : '—'}
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: qtPrec > 0 ? '#374151' : '#d1d5db', fontWeight: qtPrec > 0 ? 600 : 400 }}>
                            {qtPrec > 0 ? f3(qtPrec) : '—'}
                          </td>
                          <td style={{ padding: '1px 2px' }}>
                            {isSoppressione
                              ? <span style={{ display: 'block', textAlign: 'center', color: '#d1d5db', fontSize: 10 }}>—</span>
                              : <input type="number" step="any" min="0" placeholder="0"
                                  className="sal-inp-cell"
                                  value={qtInput[v.id] ?? ''}
                                  onChange={e => onQtChange(v.id, e.target.value)}
                                  onClick={e => e.stopPropagation()} />
                            }
                          </td>
                          <td style={{ padding: '2px 5px', minWidth: 90 }}>
                            {isSoppressione ? (
                              <span style={{ color: '#d1d5db', fontSize: 9 }}>soppressa</span>
                            ) : (
                              <>
                                <div className="sal-pct-bar"><div className="sal-pct-fill" style={{ width: `${pctTot}%`, background: pColor }} /></div>
                                <span style={{ fontSize: 9, fontFamily: 'monospace', color: residuo < 0 ? '#ef4444' : residuo === 0 ? '#10b981' : '#6b7280', fontWeight: residuo <= 0 ? 700 : 400 }}>
                                  {residuo < 0
                                    ? `⚠ supera +${f3(Math.abs(residuo))}`
                                    : residuo === 0
                                    ? '✓ completato'
                                    : `${f3(residuo)} · ${pctTot.toFixed(0)}%`}
                                </span>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    }
                    return null
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
