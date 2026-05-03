'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi ──────────────────────────────────────────────────────────────────
interface VoceDB {
  id: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  capitolo: string
  categoria: string
  note?: string
}

interface RDAItem {
  id: string
  voci_ids: string[]
  wbs_id: string
  tipo: string
  oggetto: string
  qta: number
  stato: string
  fornitore?: string
}

// ─── CSS del v3.html (iniettato inline) ────────────────────────────────────
const V3_CSS = `
.cmp-root{display:flex;height:100%;overflow:hidden;background:#f4f5f7;font-family:'Segoe UI',system-ui,sans-serif;font-size:11px;user-select:none}
.cmp-sb{background:#fff;border-right:1px solid rgba(0,0,0,.12);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;transition:width .18s}
.cmp-sb.hidden{width:0!important;min-width:0!important;border:none}
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
/* RESIZER */
.cmp-resizer{width:5px;background:transparent;cursor:col-resize;flex-shrink:0;transition:background .15s}
.cmp-resizer:hover,.cmp-resizer.active{background:rgba(74,222,128,.6)}
/* CAT TREE */
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
/* WBS TREE */
.cmp-wbs-hdr{display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:#f9fafb;border-bottom:1px solid rgba(0,0,0,.1);flex-shrink:0}
.cmp-wbs-hdr-t{font-size:9px;font-weight:700;color:#6b7280;letter-spacing:.4px;text-transform:uppercase}
.cmp-wbs-kpi{display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #4ade80;flex-shrink:0}
.cmp-wkpi{padding:4px 6px;text-align:center;background:#f0fdf4;border-right:1px solid #bbf7d0}
.cmp-wkpi:last-child{border-right:none}
.cmp-wkpi-v{font-size:11px;font-weight:700;color:#14532d;display:block}
.cmp-wkpi-l{font-size:8px;color:#6b7280;display:block}
/* MAIN */
.cmp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.cmp-tbar{display:flex;align-items:center;gap:5px;padding:4px 10px;background:#fff;border-bottom:1px solid rgba(0,0,0,.1);flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.cmp-tbtn{font-size:10px;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-weight:600;background:#374151}
.cmp-tbtn.blue{background:#1d4ed8}
.cmp-tbtn.green{background:#14532d}
.cmp-tbc{display:flex;align-items:center;gap:4px;font-size:10px;flex:1;min-width:0;overflow:hidden}
.cmp-bcl{color:#6b7280;font-size:10px;white-space:nowrap}
.cmp-bcp{font-weight:700;color:#14532d;white-space:nowrap}
.cmp-bcsep{color:#9ca3af;font-size:9px}
.cmp-bcclear{font-size:10px;padding:1px 6px;background:transparent;border:1px solid rgba(220,38,38,.4);border-radius:3px;cursor:pointer;color:#dc2626;font-weight:600}
.cmp-hint{font-size:9px;color:#9ca3af;font-style:italic;white-space:nowrap}
/* MULTI BAR */
.cmp-mbar{display:flex;align-items:center;gap:8px;padding:5px 12px;background:#1e3a5f;flex-shrink:0;border-bottom:2px solid #3b82f6}
.cmp-mbar-n{font-size:12px;font-weight:700;color:#93c5fd}
.cmp-mbar-l{font-size:10px;color:#bfdbfe;flex:1}
.cmp-mbtn{font-size:10px;padding:3px 9px;border:none;border-radius:4px;cursor:pointer;font-weight:700}
.cmp-mbtn-rda{background:#2563eb;color:#fff}
.cmp-mbtn-clr{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25)}
/* VISTA BAR */
.cmp-vbar{display:flex;align-items:center;gap:5px;padding:3px 10px;background:#f9fafb;border-bottom:1px solid rgba(0,0,0,.08);flex-shrink:0}
.cmp-vbl{color:#6b7280;font-size:10px;white-space:nowrap}
.cmp-vtab{font-size:10px;padding:2px 8px;background:transparent;border:1px solid rgba(0,0,0,.15);border-radius:10px;cursor:pointer;color:#6b7280}
.cmp-vtab.on{background:#14532d;color:#fff;border-color:#14532d}
.cmp-vcnt{color:#9ca3af;margin-left:auto;font-size:9px;white-space:nowrap}
/* IMPORT ZONE */
.cmp-imp-zone{border:2px dashed #d1d5db;border-radius:8px;padding:12px 16px;text-align:center;background:#f9fafb;cursor:pointer;transition:all .15s;margin:8px}
.cmp-imp-zone.over{border-color:#3b82f6;background:#eff6ff}
.cmp-imp-zone:hover{border-color:#9ca3af}
/* TABLE */
.cmp-tscroll{flex:1;overflow:auto}
.cmp-tscroll::-webkit-scrollbar{width:6px;height:6px}.cmp-tscroll::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
table.cmp-t{width:100%;border-collapse:collapse;table-layout:fixed}
col.cc1{width:26px}col.cc2{width:34px}col.cc3{width:96px}col.cc4{width:auto}
col.cc5,col.cc6,col.cc7,col.cc8{width:58px}
col.cc9{width:70px}col.cc10{width:72px}col.cc11{width:86px}
col.cc12,col.cc13,col.cc14{width:38px}col.cc15{width:46px}
table.cmp-t th{padding:3px;font-size:10px;font-weight:700;background:#4ade80;color:#14532d;border-right:1px solid #16a34a;text-align:center;white-space:nowrap;position:sticky;top:0;z-index:10}
table.cmp-t th.thl{text-align:left;padding-left:6px}
table.cmp-t th.th2{top:23px}
table.cmp-t td{padding:2px 3px;vertical-align:top;border-right:1px solid #e5e7eb;border-bottom:1px solid #f3f4f6}
/* HEADER ROWS */
.cmp-hsc td{background:#1e5631;padding:4px 10px;font-weight:700;font-size:11px;color:#fff;letter-spacing:.4px;border-bottom:2px solid #4ade80}
.cmp-hca td{background:#166534;padding:3px 10px 3px 20px;font-weight:600;font-size:11px;color:#d1fae5}
/* VOCE ROW */
.cmp-rvo{cursor:pointer}
.cmp-rvo:hover td{background:#f0fff4}
.cmp-rvo.sel td{background:#dcfce7!important}
.cmp-rvo.msel td{background:#eff6ff!important}
/* MISURA */
.cmp-rmi{background:#f9fafb;cursor:default}
.cmp-rmi:hover td{background:#f0fdf4}
.cmp-rmi.neg td{background:#fff0f0}
/* SOMMANO */
.cmp-rsom td{background:#ecfdf5;color:#065f46;border-top:1px solid #6ee7b7;border-bottom:2px solid #6ee7b7}
/* FLUSSO */
.cmp-fi{text-align:center;font-size:13px;cursor:pointer;padding:0}
.cmp-fi-ok{color:#16a34a}
.cmp-fi-bozza{color:#f59e0b}
.cmp-fi-no{color:#d1d5db}
.cmp-fi-rdo{color:#2563eb}
.cmp-fi-oda{color:#7c3aed}
.cmp-sal{font-size:9px;font-weight:700;text-align:center}
.cmp-sal-0{color:#d1d5db}.cmp-sal-low{color:#f59e0b}.cmp-sal-hi{color:#16a34a}.cmp-sal-done{color:#7c3aed}
/* VARIE */
.cmp-des-first{font-weight:700;font-size:10px}
.cmp-des-rest{color:#4b5563;font-size:10px;line-height:1.4}
.cmp-mono{font-family:monospace;font-size:10px}
.cmp-ckb{width:13px;height:13px;cursor:pointer;accent-color:#2563eb;display:block;margin:0 auto}
.cmp-wbadge{display:inline-block;font-size:8px;padding:1px 4px;border-radius:2px;margin-left:4px;background:#dbeafe;color:#1e40af;font-weight:700;border:1px solid #93c5fd}
.cmp-edt{display:block;text-align:right;cursor:default;font-size:10px;min-height:14px;color:#374151}
.cmp-edt.empty{color:#d1d5db}
/* TOTALE BAR */
.cmp-totbar{padding:8px 14px;background:#1e3a5f;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-top:2px solid #3b82f6}
.cmp-totbar-l{font-size:11px;font-weight:700;color:#bfdbfe}
.cmp-totbar-v{font-size:16px;font-weight:800;color:#4ade80;font-family:monospace}
/* TOAST */
.cmp-toast{position:fixed;bottom:20px;right:20px;background:#14532d;color:#fff;padding:10px 16px;border-radius:8px;font-size:11px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:1000;opacity:0;transition:opacity .3s;pointer-events:none}
.cmp-toast.show{opacity:1}
/* CONTEXT MENU */
.cmp-ctx{position:fixed;z-index:999;background:#fff;border:1px solid rgba(0,0,0,.2);border-radius:8px;min-width:200px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.15)}
.cmp-ctxh{padding:4px 12px;font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;background:#f9fafb;border-bottom:1px solid rgba(0,0,0,.08)}
.cmp-ctxi{padding:7px 14px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:8px}
.cmp-ctxi:hover{background:#f0fdf4}
.cmp-ctxi.acc{color:#1d4ed8;font-weight:600}
.cmp-ctxi.del{color:#dc2626}
.cmp-ctxi.del:hover{background:#fef2f2}
.cmp-ctxsep{border-top:1px solid rgba(0,0,0,.08)}
`

// ─── WBS statico (dall'app) ────────────────────────────────────────────────
const WBS_FLAT = [
  ['F01','FASE PRELIMINARE'],['F01.01','Apertura commessa e setup'],
  ['F02','PROGETTAZIONE'],['F02.01','Progettazione architettonica'],['F02.02','Strutturale'],['F02.03','Impianti'],
  ['F03','APPROVVIGIONAMENTI'],['F03.01','Materiali strutturali'],['F03.02','Finiture'],['F03.03','Noleggi'],['F03.04','Contratti sub'],
  ['F04','CANTIERE — LAVORAZIONI'],['F04.01','Opere preliminari'],['F04.02','Demolizioni'],['F04.03','Scavi'],
  ['F04.04','Fondazioni'],['F04.05','Struttura in elevazione'],['F04.06','Solaio e copertura'],
  ['F04.07','Tamponamenti'],['F04.08','Intonaci'],['F04.09','Massetti e pavimenti'],
  ['F04.10','Serramenti'],['F04.11','Tinteggiature'],
  ['F05','IMPIANTI'],['F05.01','Impianto elettrico'],['F05.02','Idro-sanitario'],['F05.03','Termico'],
  ['F06','OPERE ESTERNE'],['F06.01','Pavimentazioni esterne'],['F06.02','Recinzioni'],
  ['F07','SICUREZZA'],['F07.01','DPI'],['F07.02','Apprestamenti'],
  ['F08','GESTIONE ECONOMICA'],['F08.01','Controllo budget'],['F08.02','Fatturazione'],
]

function buildWBS(flat: string[][]) {
  const map: Record<string, { id: string; code: string; lb: string; lvl: number; ch: { id: string; code: string; lb: string; lvl: number; ch: unknown[] }[] }> = {}
  const roots: typeof map[string][] = []
  flat.forEach(([c, lb]) => { map[c] = { id: c, code: c, lb, lvl: (c.match(/\./g) || []).length + 1, ch: [] } })
  flat.forEach(([c]) => {
    const p = c.split('.')
    if (p.length === 1) roots.push(map[c])
    else { p.pop(); const pid = p.join('.'); if (map[pid]) map[pid].ch.push(map[c] as never) }
  })
  return { roots, map }
}
const { roots: WBS_ROOTS, map: WBS_MAP } = buildWBS(WBS_FLAT)

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? ''
const f3 = (n: number) => n?.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? ''

// ─── Componente principale ─────────────────────────────────────────────────
export default function ComputoPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)

  const [voci, setVoci] = useState<VoceDB[]>([])
  const [rdaList, setRdaList] = useState<RDAItem[]>([])
  const [totale, setTotale] = useState(0)
  const [caricamento, setCaricamento] = useState(true)
  const [importando, setImportando] = useState(false)
  const [risultatoImport, setRisultatoImport] = useState<{ ok?: boolean; tariffe?: number; voci?: number; importo_totale?: number; error?: string } | null>(null)

  const [stab, setStab] = useState<'cat' | 'wbs'>('cat')
  const [sbHidden, setSbHidden] = useState(false)
  const [sbWidth, setSbWidth] = useState(270)
  const [catFilter, setCatFilter] = useState<{ sc: string | null; c: string | null }>({ sc: null, c: null })
  const [catExp, setCatExp] = useState<Record<string, boolean>>({})
  const [wbsExp, setWbsExp] = useState<Record<string, boolean>>({ F04: true })
  const [wbsSel, setWbsSel] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set())
  const [vista, setVista] = useState<'tutto' | 'varianti'>('tutto')
  const [ctx, setCtx] = useState<{ x: number; y: number; id: string; t: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState('')
  const toastRef = useRef<NodeJS.Timeout | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2800)
  }

  // ─── Carica dati ──────────────────────────────────────────────────────────

  const caricaDati = useCallback(async () => {
    if (!id) return
    setCaricamento(true)
    try {
      const { data: computo } = await supabase.from('computo_metrico').select('id').eq('commessa_id', id).single()
      if (!computo) { setCaricamento(false); return }

      const { data: v } = await supabase
        .from('voci_computo')
        .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,capitolo,categoria,note')
        .eq('computo_id', computo.id)
        .order('capitolo').order('codice')

      if (v) {
        setVoci(v)
        setTotale(v.reduce((s, x) => s + (x.importo || 0), 0))
      }

      // Carica RDA
      const { data: rda } = await supabase.from('rda').select('*').eq('commessa_id', id)
      if (rda) setRdaList(rda as RDAItem[])
    } finally { setCaricamento(false) }
  }, [id])

  useEffect(() => { caricaDati() }, [caricaDati])

  // ─── Import XPWE ──────────────────────────────────────────────────────────

  const importaFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xpwe', 'pwe', 'xml'].includes(ext || '')) {
      setRisultatoImport({ error: 'Formato non supportato. Usa .xpwe da Primus ACCA.' }); return
    }
    setImportando(true); setRisultatoImport(null)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('commessa_id', id)
      const res = await fetch('/api/xpwe-parse', { method: 'POST', body: fd })
      const data = await res.json()
      setRisultatoImport(data)
      if (data.ok) { await caricaDati(); showToast(`✓ Importate ${data.voci} voci · € ${fi(data.importo_totale)}`) }
    } catch { setRisultatoImport({ error: 'Errore di rete' }) }
    finally { setImportando(false) }
  }

  // ─── Categorie dinamiche dai dati ─────────────────────────────────────────

  const catTree = (() => {
    const scMap: Record<string, { n: number; tot: number; cats: Record<string, { n: number; tot: number }> }> = {}
    voci.forEach(v => {
      const sc = v.capitolo || 'Generale'
      const c = v.categoria || sc
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

  // ─── Voci filtrate ────────────────────────────────────────────────────────

  const vociFiltrate = voci.filter(v => {
    if (catFilter.c) return v.categoria === catFilter.c || v.capitolo === catFilter.c
    if (catFilter.sc) return v.capitolo === catFilter.sc
    return true
  })

  // RDA flusso per voce
  const rdaByVoce = (vid: string) => rdaList.find(r => r.voci_ids?.includes(vid))

  // ─── Resizer ──────────────────────────────────────────────────────────────

  const resizerRef = useRef<HTMLDivElement>(null)
  const rDrag = useRef(false)
  const rStartX = useRef(0)
  const rStartW = useRef(sbWidth)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!rDrag.current) return
      const w = Math.max(180, Math.min(500, rStartW.current + (e.clientX - rStartX.current)))
      setSbWidth(w)
    }
    const onMouseUp = () => { rDrag.current = false; resizerRef.current?.classList.remove('active') }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
  }, [])

  const onResizerMouseDown = (e: React.MouseEvent) => {
    rDrag.current = true; rStartX.current = e.clientX; rStartW.current = sbWidth
    resizerRef.current?.classList.add('active'); e.preventDefault()
  }

  // ─── Context menu ────────────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ctx && !(e.target as Element).closest('.cmp-ctx')) setCtx(null) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [ctx])

  // ─── WBS tree ────────────────────────────────────────────────────────────

  const renderWBSNode = (node: typeof WBS_MAP[string], lvl: number): React.ReactNode => {
    const isSel = wbsSel === node.id
    const bgt = voci.filter(v => v.note?.includes(node.id) || v.capitolo?.includes(node.id)).reduce((s, v) => s + v.importo, 0)
    const indent = lvl * 12
    return (
      <div key={node.id}>
        <div
          className={`cmp-tnode${isSel ? ' flt' : ''}`}
          style={{ paddingLeft: 4 + indent }}
          onClick={() => { setWbsSel(wbsSel === node.id ? null : node.id); if (node.ch.length) setWbsExp(p => ({ ...p, [node.id]: !p[node.id] })) }}
        >
          <span className="cmp-tarr">{(node.ch as unknown[]).length ? (wbsExp[node.id] ? '▼' : '▶') : ''}</span>
          <span className="cmp-tlb" title={node.lb}>{node.code} {node.lb}</span>
          {bgt > 0 && <span className="cmp-ttot">{fi(bgt, 0)}</span>}
        </div>
        {wbsExp[node.id] && (node.ch as typeof WBS_MAP[string][]).map(ch => renderWBSNode(ch, lvl + 1))}
      </div>
    )
  }

  // ─── Cat tree ─────────────────────────────────────────────────────────────

  const renderCatTree = () => catTree.map(sc => {
    const isSCFlt = catFilter.sc === sc.id && !catFilter.c
    return (
      <div key={sc.id}>
        <div className={`cmp-tnode cmp-t-sc${isSCFlt ? ' flt' : ''}`}
          onClick={() => { setCatFilter(isSCFlt ? { sc: null, c: null } : { sc: sc.id, c: null }); setCatExp(p => ({ ...p, [sc.id]: !p[sc.id] })) }}>
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
              <span className="cmp-tlb" title={c.lb}>{c.lb}</span>
              <span className="cmp-tcnt">({c.n})</span>
              <span className="cmp-ttot">{fi(c.tot, 0)}</span>
            </div>
          )
        })}
      </div>
    )
  })

  // ─── Flusso icona ────────────────────────────────────────────────────────

  const fIcon = (stato: string, tipo: string) => {
    if (!stato) return { ico: '○', cls: 'cmp-fi-no' }
    if (stato === 'bozza') return { ico: tipo === 'rda' ? '⚡' : '●', cls: 'cmp-fi-bozza' }
    if (stato === 'ok') return { ico: '✓', cls: tipo === 'rda' ? 'cmp-fi-ok' : tipo === 'rdo' ? 'cmp-fi-rdo' : 'cmp-fi-oda' }
    return { ico: '○', cls: 'cmp-fi-no' }
  }

  // ─── Genera RDA per voci selezionate ──────────────────────────────────────

  const generaRDA = async () => {
    const selectedVoci = Array.from(multiSel)
    if (!selectedVoci.length) { showToast('Seleziona almeno una voce'); return }
    try {
      const { data, error } = await supabase.from('rda').insert({
        commessa_id: id,
        voci_ids: selectedVoci,
        stato: 'bozza',
        tipo: 'MAT',
        oggetto: `RDA da computo (${selectedVoci.length} voci)`,
        qta: 1,
      }).select().single()
      if (error) throw error
      setRdaList(prev => [...prev, data as RDAItem])
      setMultiSel(new Set())
      showToast(`⚡ RDA ${data.id.slice(-6)} creata — ${selectedVoci.length} voci`)
    } catch (e) { showToast('Errore creazione RDA') }
  }

  // ─── Raggruppa per capitolo/categoria ────────────────────────────────────

  type RowType =
    | { type: 'hsc'; id: string; lb: string }
    | { type: 'hca'; id: string; lb: string }
    | { type: 'vo'; v: VoceDB }
    | { type: 'mi'; v: VoceDB }  // singola misura ridotta
    | { type: 'som'; v: VoceDB }

  const tableRows: RowType[] = (() => {
    const rows: RowType[] = []
    let lastSC = '', lastC = ''
    for (const v of vociFiltrate) {
      if (v.capitolo !== lastSC) {
        rows.push({ type: 'hsc', id: v.capitolo, lb: v.capitolo })
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: V3_CSS }} />
      <div className="cmp-root" style={{ height: '100%' }}>

        {/* ── SIDEBAR ── */}
        {!sbHidden && (
          <div className="cmp-sb" style={{ width: sbWidth, minWidth: sbWidth }}>
            {/* Logo */}
            <div className="cmp-logo">
              <span className="cmp-logo-txt">📐 Computo</span>
              <span className="cmp-logo-sub">{vociFiltrate.length} voci</span>
              <button className="cmp-collapse" onClick={() => setSbHidden(true)} title="Nascondi">◀</button>
            </div>

            {/* Tab WBS / Categorie */}
            <div className="cmp-stabs">
              {(['cat', 'wbs'] as const).map(k => (
                <button key={k} className={`cmp-stab${stab === k ? ' on' : ''}`} onClick={() => setStab(k)}>
                  {k === 'cat' ? '🏷 Categorie' : '📐 WBS'}
                </button>
              ))}
            </div>

            {/* KPI */}
            <div className="cmp-wbs-kpi">
              <div className="cmp-wkpi">
                <span className="cmp-wkpi-v">{fi(totale, 0)} €</span>
                <span className="cmp-wkpi-l">Totale lista</span>
              </div>
              <div className="cmp-wkpi">
                <span className="cmp-wkpi-v">{voci.length}</span>
                <span className="cmp-wkpi-l">Voci totali</span>
              </div>
            </div>

            <div className="cmp-sbody">
              {stab === 'cat' ? (
                <>
                  <div className="cmp-cat-tb">
                    <button className="cmp-cat-all" onClick={() => setCatFilter({ sc: null, c: null })}>Tutto</button>
                    <span className="cmp-cat-info">
                      {catFilter.c || catFilter.sc || 'Nessun filtro attivo'}
                    </span>
                  </div>
                  {renderCatTree()}
                </>
              ) : (
                <>
                  <div className="cmp-wbs-hdr">
                    <span className="cmp-wbs-hdr-t">Struttura WBS</span>
                    {wbsSel && (
                      <button style={{ fontSize: 9, padding: '1px 6px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
                        onClick={() => setWbsSel(null)}>✕ tutto</button>
                    )}
                  </div>
                  {WBS_ROOTS.map(n => renderWBSNode(n, 0))}
                </>
              )}
            </div>

            {/* Footer totale */}
            <div className="cmp-sfoot">
              <div className="cmp-sft">
                <span>Totale computo</span>
                <span>{fi(totale)} €</span>
              </div>
              <div className="cmp-sfs">IVA esclusa · prezzi contrattuali</div>
            </div>
          </div>
        )}

        {/* RESIZER */}
        {!sbHidden && (
          <div ref={resizerRef} className="cmp-resizer" onMouseDown={onResizerMouseDown} />
        )}

        {/* ── MAIN ── */}
        <div className="cmp-main">

          {/* TOOLBAR */}
          <div className="cmp-tbar">
            {sbHidden && (
              <button className="cmp-tbtn green" onClick={() => setSbHidden(false)}>▶</button>
            )}
            <div className="cmp-tbc">
              {catFilter.sc || catFilter.c ? (
                <>
                  {catFilter.sc && <span className="cmp-bcp">{catFilter.sc}</span>}
                  {catFilter.c && <><span className="cmp-bcsep"> › </span><span className="cmp-bcp">{catFilter.c}</span></>}
                  <button className="cmp-bcclear" onClick={() => setCatFilter({ sc: null, c: null })}>✕ tutto</button>
                </>
              ) : <span className="cmp-bcl">Tutto il computo</span>}
            </div>

            {/* Import XPWE */}
            <label
              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: '#1d4ed8', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) importaFile(f) }}
            >
              {importando ? '⏳' : '📥'} {importando ? 'Importazione...' : 'Importa XPWE'}
              <input type="file" accept=".xpwe,.pwe,.xml" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) importaFile(f) }} />
            </label>

            <span className="cmp-hint">✎ doppio click per modificare</span>
          </div>

          {/* RISULTATO IMPORT */}
          {risultatoImport && (
            <div style={{ padding: '5px 10px', background: risultatoImport.ok ? '#dcfce7' : '#fef2f2', borderBottom: '1px solid', borderColor: risultatoImport.ok ? '#86efac' : '#fca5a5', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {risultatoImport.ok
                ? <><span style={{ color: '#166534' }}>✓ Importazione completata: {risultatoImport.tariffe} tariffe · {risultatoImport.voci} voci · € {fi(risultatoImport.importo_totale || 0)}</span></>
                : <><span style={{ color: '#991b1b' }}>⚠ {risultatoImport.error}</span></>
              }
              <button onClick={() => setRisultatoImport(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
          )}

          {/* MULTI-SELECT BAR */}
          {multiSel.size > 0 && (
            <div className="cmp-mbar">
              <span className="cmp-mbar-n">{multiSel.size}</span>
              <span className="cmp-mbar-l"> voci selezionate</span>
              <button className="cmp-mbtn cmp-mbtn-rda" onClick={generaRDA}>⚡ Genera RDA</button>
              <button className="cmp-mbtn cmp-mbtn-clr" onClick={() => setMultiSel(new Set())}>✕ Deseleziona</button>
            </div>
          )}

          {/* VISTA BAR */}
          <div className="cmp-vbar">
            <span className="cmp-vbl">Vista:</span>
            {(['tutto', 'varianti'] as const).map(k => (
              <button key={k} className={`cmp-vtab${vista === k ? ' on' : ''}`} onClick={() => setVista(k)}>
                {k === 'tutto' ? 'Tutto' : 'Varianti'}
              </button>
            ))}
            <span className="cmp-vcnt">{vociFiltrate.length} voci{multiSel.size > 0 ? ` · ${multiSel.size} sel.` : ''}</span>
          </div>

          {/* TABELLA */}
          {caricamento ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#6b7280' }}>
              <span style={{ width: 20, height: 20, border: '2px solid #d1d5db', borderTopColor: '#14532d', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
              Caricamento voci...
            </div>
          ) : voci.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#9ca3af' }}>
              <div style={{ fontSize: 40 }}>📄</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>Nessun computo importato</p>
              <p style={{ fontSize: 11 }}>Usa il pulsante "Importa XPWE" in alto a destra</p>
              <label style={{ padding: '8px 20px', background: '#14532d', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                📥 Seleziona file XPWE
                <input type="file" accept=".xpwe,.pwe,.xml" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) importaFile(f) }} />
              </label>
            </div>
          ) : (
            <div className="cmp-tscroll" onClick={() => setCtx(null)}>
              <table className="cmp-t">
                <colgroup>
                  <col className="cc1" /><col className="cc2" /><col className="cc3" /><col className="cc4" />
                  <col className="cc5" /><col className="cc6" /><col className="cc7" /><col className="cc8" />
                  <col className="cc9" /><col className="cc10" /><col className="cc11" />
                  <col className="cc12" /><col className="cc13" /><col className="cc14" /><col className="cc15" />
                </colgroup>
                <thead>
                  <tr>
                    {/* checkbox */}
                    <th rowSpan={2}>
                      <input type="checkbox" className="cmp-ckb"
                        checked={vociFiltrate.length > 0 && vociFiltrate.every(v => multiSel.has(v.id))}
                        onChange={e => {
                          if (e.target.checked) setMultiSel(new Set(vociFiltrate.map(v => v.id)))
                          else setMultiSel(new Set())
                        }} />
                    </th>
                    <th rowSpan={2}>Nr</th>
                    <th rowSpan={2}>Tariffa</th>
                    <th rowSpan={2} className="thl">DESIGNAZIONE dei LAVORI</th>
                    <th colSpan={4} style={{ borderBottom: '1px solid #16a34a' }}>DIMENSIONI</th>
                    <th rowSpan={2}>Quantità</th>
                    <th colSpan={2} style={{ borderBottom: '1px solid #16a34a' }}>IMPORTI</th>
                    <th colSpan={4} style={{ background: '#1e3a5f', color: '#93c5fd', borderBottom: '1px solid #2563eb' }}>FLUSSO COMMESSA</th>
                  </tr>
                  <tr>
                    {['par.ug.', 'lung.', 'larg.', 'H/peso'].map(t => <th key={t} className="th2">{t}</th>)}
                    {['unit.[1]', 'TOTALE'].map(t => <th key={t} className="th2">{t}</th>)}
                    {[['RDA', '#93c5fd'], ['RDO', '#60a5fa'], ['ODA', '#a78bfa'], ['SAL%', '#34d399']].map(([t, c]) => (
                      <th key={t} className="th2" style={{ background: '#1e3a5f', color: c, borderBottom: '1px solid #2563eb' }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => {
                    if (row.type === 'hsc') {
                      return (
                        <tr key={`hsc_${i}`} className="cmp-hsc">
                          <td colSpan={15}>▸ {row.lb}</td>
                        </tr>
                      )
                    }
                    if (row.type === 'hca') {
                      return (
                        <tr key={`hca_${i}`} className="cmp-hca">
                          <td colSpan={15}>{row.lb}</td>
                        </tr>
                      )
                    }
                    if (row.type === 'vo') {
                      const v = row.v
                      const isSel = sel === v.id
                      const isMSel = multiSel.has(v.id)
                      const rda = rdaByVoce(v.id)
                      const rdaSt = rda?.stato || ''
                      const idx = voci.indexOf(v) + 1

                      return (
                        <tr key={v.id}
                          className={`cmp-rvo${isSel ? ' sel' : ''}${isMSel ? ' msel' : ''}`}
                          onClick={() => setSel(v.id)}
                          onContextMenu={e => {
                            e.preventDefault()
                            setCtx({ x: e.clientX, y: e.clientY, id: v.id, t: 'vo' })
                          }}
                        >
                          {/* 1 checkbox */}
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <input type="checkbox" className="cmp-ckb" checked={isMSel}
                              onChange={e => {
                                e.stopPropagation()
                                setMultiSel(prev => { const n = new Set(prev); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n })
                              }} />
                          </td>
                          {/* 2 nr */}
                          <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700 }}>{idx}</td>
                          {/* 3 tariffa */}
                          <td style={{ fontSize: 10, color: '#1d4ed8', fontFamily: 'monospace' }}>{v.codice}</td>
                          {/* 4 designazione */}
                          <td style={{ fontSize: 10, maxWidth: 0 }}>
                            {(() => {
                              const dot = v.descrizione?.indexOf('.') ?? -1
                              const first = dot > 0 ? v.descrizione.slice(0, dot + 1) : v.descrizione?.slice(0, 60)
                              const rest = dot > 0 ? v.descrizione.slice(dot + 1, 200) : ''
                              return <>
                                <span className="cmp-des-first">{first}</span>
                                {rest && <span className="cmp-des-rest">{rest}</span>}
                                <span className="cmp-wbadge">{v.note?.split('>')[0]?.trim() || '— WBS'}</span>
                              </>
                            })()}
                          </td>
                          {/* 5-8 dim vuote su voce */}
                          <td /><td /><td /><td />
                          {/* 9 qty vuota (mostrata su SOMMANO) */}
                          <td />
                          {/* 10 PU */}
                          <td style={{ textAlign: 'right', fontSize: 10, fontFamily: 'monospace' }}>{fi(v.prezzo_unitario)}</td>
                          {/* 11 tot vuoto (mostrato su SOMMANO) */}
                          <td />
                          {/* 12-14 flusso RDA/RDO/ODA */}
                          {(['rda', 'rdo', 'oda'] as const).map(tipo => {
                            const st = tipo === 'rda' ? rdaSt : ''
                            const fi2 = fIcon(st, tipo)
                            return (
                              <td key={tipo} className="cmp-fi">
                                <span className={fi2.cls} style={{ cursor: 'pointer' }}
                                  onClick={e => { e.stopPropagation(); showToast(`${tipo.toUpperCase()}: ${st || 'non avviato'}`) }}>
                                  {fi2.ico}
                                </span>
                              </td>
                            )
                          })}
                          {/* 15 SAL% */}
                          <td style={{ textAlign: 'center' }}>
                            <span className="cmp-sal cmp-sal-0">—</span>
                          </td>
                        </tr>
                      )
                    }
                    if (row.type === 'mi') {
                      const v = row.v
                      const isSel = sel === v.id
                      return (
                        <tr key={`mi_${v.id}`} className={`cmp-rmi${isSel ? ' sel' : ''}`}>
                          <td /><td />
                          <td />
                          <td style={{ paddingLeft: 28, color: '#6b7280', fontSize: 10, fontStyle: 'italic' }}>
                            {v.note?.split('>').pop()?.trim() || 'misura da XPWE'}
                          </td>
                          {/* pU = 1, lung = qty, larg/hP vuoti */}
                          <td><span className="cmp-edt">1</span></td>
                          <td><span className="cmp-edt cmp-mono">{f3(v.quantita)}</span></td>
                          <td /><td />
                          {/* q parziale */}
                          <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 10, fontFamily: 'monospace' }}>
                            {f3(v.quantita)}
                          </td>
                          <td /><td />
                          <td /><td /><td /><td />
                        </tr>
                      )
                    }
                    if (row.type === 'som') {
                      const v = row.v
                      return (
                        <tr key={`som_${v.id}`} className="cmp-rsom">
                          <td colSpan={4} style={{ textAlign: 'right', paddingRight: 6, fontWeight: 700, fontSize: 10 }}>
                            SOMMANO {v.um}
                          </td>
                          <td colSpan={4} />
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>
                            {f3(v.quantita)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>{fi(v.prezzo_unitario)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>
                            {fi(v.importo)}
                          </td>
                          <td /><td /><td /><td />
                        </tr>
                      )
                    }
                    return null
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TOTALE BAR */}
          {voci.length > 0 && (
            <div className="cmp-totbar">
              <div>
                <div className="cmp-totbar-l">TOTALE COMPUTO DI LISTA</div>
                <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{vociFiltrate.length} voci · IVA esclusa</div>
              </div>
              <div className="cmp-totbar-v">€ {fi(vociFiltrate.reduce((s, v) => s + v.importo, 0))}</div>
            </div>
          )}
        </div>

        {/* CONTEXT MENU */}
        {ctx && (
          <div className="cmp-ctx" style={{ left: ctx.x, top: ctx.y }} onClick={e => e.stopPropagation()}>
            <div className="cmp-ctxh">Voce EP</div>
            <div className="cmp-ctxi acc" onClick={() => {
              setMultiSel(new Set([ctx.id])); setCtx(null)
              showToast('Voce selezionata — usa "Genera RDA"')
            }}>⚡ Genera RDA da voce</div>
            <div className="cmp-ctxi" onClick={() => { setCtx(null); showToast('Variante — prossimo sprint') }}>△ Aggiungi variante</div>
            <div className="cmp-ctxsep" />
            <div className="cmp-ctxi" onClick={() => {
              navigator.clipboard.writeText(voci.find(v => v.id === ctx.id)?.codice || '')
              setCtx(null); showToast('Codice copiato')
            }}>📋 Copia codice tariffa</div>
          </div>
        )}

        {/* TOAST */}
        <div className={`cmp-toast${toast ? ' show' : ''}`}>{toast}</div>
      </div>
    </>
  )
}
