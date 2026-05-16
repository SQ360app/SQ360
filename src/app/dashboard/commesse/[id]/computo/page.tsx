'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── WBS FLAT (codice → label) ──────────────────────────────────────────────
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

// ─── Tipi ───────────────────────────────────────────────────────────────────
interface VoceDB {
  id: string; codice: string; descrizione: string; um: string
  quantita: number; prezzo_unitario: number; importo: number
  capitolo: string; categoria: string; note?: string
  wbs_id?: string; wbs_label?: string
}
interface RDADB { id: string; voci_ids?: string[]; stato?: string; tipo?: string; wbs_id?: string }

// ─── CSS ────────────────────────────────────────────────────────────────────
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
.cmp-tbar{display:flex;align-items:center;gap:5px;padding:4px 10px;background:#fff;border-bottom:1px solid rgba(0,0,0,.1);flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.cmp-tbtn{font-size:10px;padding:3px 8px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-weight:600;background:#374151}
.cmp-tbtn.blue{background:#1d4ed8}
.cmp-tbtn.green{background:#14532d}
.cmp-hint{font-size:9px;color:#9ca3af;font-style:italic;white-space:nowrap}
.cmp-mbar{display:flex;align-items:center;gap:8px;padding:5px 12px;background:#1e3a5f;flex-shrink:0;border-bottom:2px solid #3b82f6}
.cmp-mbar-n{font-size:12px;font-weight:700;color:#93c5fd}
.cmp-mbar-l{font-size:10px;color:#bfdbfe}
.cmp-mbtn{font-size:10px;padding:3px 9px;border:none;border-radius:4px;cursor:pointer;font-weight:700}
.cmp-mbtn-rda{background:#2563eb;color:#fff}
.cmp-mbtn-wbs{background:#7c3aed;color:#fff}
.cmp-mbtn-clr{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25)}
.cmp-vbar{display:flex;align-items:center;gap:5px;padding:3px 10px;background:#f9fafb;border-bottom:1px solid rgba(0,0,0,.08);flex-shrink:0}
.cmp-vbl{color:#6b7280;font-size:10px;white-space:nowrap}
.cmp-vtab{font-size:10px;padding:2px 8px;background:transparent;border:1px solid rgba(0,0,0,.15);border-radius:10px;cursor:pointer;color:#6b7280}
.cmp-vtab.on{background:#14532d;color:#fff;border-color:#14532d}
.cmp-vcnt{color:#9ca3af;margin-left:auto;font-size:9px;white-space:nowrap}
.cmp-tscroll{flex:1;overflow:auto}
.cmp-tscroll::-webkit-scrollbar{width:6px;height:6px}.cmp-tscroll::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
table.cmp-t{width:100%;border-collapse:collapse;table-layout:fixed}
col.cc2{width:34px}col.cc3{width:96px}col.cc4{width:auto}
col.cc5,col.cc6,col.cc7,col.cc8{width:52px}
col.cc9{width:66px}col.cc10{width:68px}col.cc11{width:82px}
col.cc12,col.cc13,col.cc14{width:36px}col.cc15{width:44px}
table.cmp-t th{padding:3px;font-size:10px;font-weight:700;background:#4ade80;color:#14532d;border-right:1px solid #16a34a;text-align:center;white-space:nowrap;position:sticky;top:0;z-index:10}
table.cmp-t th.thl{text-align:left;padding-left:6px}
table.cmp-t th.th2{top:23px;padding-top:2px;padding-bottom:2px}
table.cmp-t thead tr:first-child th{border-bottom:none}
table.cmp-t thead tr:empty{display:none}
table.cmp-t td{padding:2px 3px;vertical-align:top;border-right:1px solid #e5e7eb;border-bottom:1px solid #f3f4f6}
.cmp-hsc td{background:#1e5631;padding:4px 10px;font-weight:700;font-size:11px;color:#fff;letter-spacing:.4px;border-bottom:2px solid #4ade80}
.cmp-hca td{background:#166534;padding:3px 10px 3px 20px;font-weight:600;font-size:11px;color:#d1fae5}
.cmp-rvo{cursor:pointer}
.cmp-rvo:hover td{background:#d1fae5}
.cmp-rvo.sel td{background:#bfdbfe!important;font-weight:600}
.cmp-rvo.msel td{background:#c7d2fe!important;font-weight:600}
.cmp-rmi{background:#f9fafb;cursor:default}
.cmp-rmi:hover td{background:#f0fdf4}
.cmp-rsom td{background:#ecfdf5;color:#065f46;border-top:1px solid #6ee7b7;border-bottom:2px solid #6ee7b7}
.cmp-fi{text-align:center;font-size:13px;cursor:pointer;padding:0}
.cmp-fi-ok{color:#16a34a}.cmp-fi-bozza{color:#f59e0b}.cmp-fi-no{color:#d1d5db}.cmp-fi-rdo{color:#2563eb}.cmp-fi-oda{color:#7c3aed}
.cmp-sal{font-size:9px;font-weight:700;text-align:center}
.cmp-sal-0{color:#d1d5db}.cmp-sal-low{color:#f59e0b}.cmp-sal-hi{color:#16a34a}.cmp-sal-done{color:#7c3aed}
.cmp-des-first{font-weight:400;font-size:10px}
.cmp-des-rest{color:#4b5563;font-size:10px;line-height:1.4}
.cmp-mono{font-family:monospace;font-size:10px}
.cmp-wbadge{display:inline-block;font-size:8px;padding:1px 4px;border-radius:2px;margin-left:4px;font-weight:700;border:1px solid;cursor:pointer;transition:all .1s}
.cmp-wbadge.set{background:#dbeafe;color:#1e40af;border-color:#93c5fd}
.cmp-wbadge.unset{background:#fef3c7;color:#92400e;border-color:#fcd34d}
.cmp-wbadge:hover{opacity:.75}
.cmp-edt{display:block;text-align:right;cursor:default;font-size:10px;min-height:14px;color:#374151}
.cmp-wbs-picker{position:fixed;z-index:200;background:#fff;border:1px solid rgba(0,0,0,.2);border-radius:10px;min-width:260px;max-height:340px;overflow-y:auto;box-shadow:0 8px 28px rgba(0,0,0,.18)}
.cmp-wbs-picker-hdr{padding:6px 10px;background:#14532d;color:#fff;font-size:10px;font-weight:700;border-radius:9px 9px 0 0;display:flex;align-items:center;gap:6px}
.cmp-wbs-picker-clr{margin-left:auto;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:10px;border-radius:3px;cursor:pointer;padding:1px 6px}
.cmp-wbs-pi{padding:5px 8px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(0,0,0,.05)}
.cmp-wbs-pi:hover{background:#f0fdf4}
.cmp-wbs-pi.active{background:#dcfce7;font-weight:700}
.cmp-wbs-pi .wbs-code{font-family:monospace;font-size:9px;color:#6b7280;width:48px;flex-shrink:0}

.cmp-toast{position:fixed;bottom:20px;right:20px;background:#14532d;color:#fff;padding:10px 16px;border-radius:8px;font-size:11px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:1000;opacity:0;transition:opacity .3s;pointer-events:none}
.cmp-toast.show{opacity:1}
.cmp-ctx{position:fixed;z-index:999;background:#fff;border:1px solid rgba(0,0,0,.2);border-radius:8px;min-width:210px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.15)}
.cmp-ctxh{padding:4px 12px;font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;background:#f9fafb;border-bottom:1px solid rgba(0,0,0,.08)}
.cmp-ctxi{padding:7px 14px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:8px}
.cmp-ctxi:hover{background:#f0fdf4}
.cmp-ctxi.acc{color:#1d4ed8;font-weight:600}
.cmp-ctxi.danger{color:#dc2626}
.cmp-ctxsep{border-top:1px solid rgba(0,0,0,.08)}
td.cmp-td-edit{cursor:cell}
td.cmp-td-edit:hover{outline:1px dashed #9ca3af;outline-offset:-2px}
.cmp-inp-cell{width:100%;border:1px solid #3b82f6;border-radius:2px;padding:1px 4px;font-size:10px;font-family:monospace;background:#eff6ff;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,.2);color:#1e40af;text-align:right}
`

const fi = (n: number, d = 2) => n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? ''
const f3 = (n: number) => n?.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? ''

export default function ComputoPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)

  const [voci, setVoci] = useState<VoceDB[]>([])
  const [rdaList, setRdaList] = useState<RDADB[]>([])
  const [totale, setTotale] = useState(0)
  const [caricamento, setCaricamento] = useState(true)
  const [importando, setImportando] = useState(false)
  const [risultatoImport, setRisultatoImport] = useState<{ ok?: boolean; tariffe?: number; voci?: number; importo_totale?: number; error?: string } | null>(null)
  const [computoId, setComputoId] = useState<string | null>(null)

  const [stab, setStab] = useState<'cat' | 'wbs'>('cat')
  const [sbHidden, setSbHidden] = useState(false)
  const [sbWidth, setSbWidth] = useState(270)
  const [catFilter, setCatFilter] = useState<{ sc: string | null; c: string | null }>({ sc: null, c: null })
  const [catExp, setCatExp] = useState<Record<string, boolean>>({})
  const [wbsExp, setWbsExp] = useState<Record<string, boolean>>({})
  const [wbsSel, setWbsSel] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set())
  const [ctx, setCtx] = useState<{ x: number; y: number; id: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState('')
  const [wbsPicker, setWbsPicker] = useState<{ voceId: string; x: number; y: number } | null>(null)
  const [bulkWbsPicker, setBulkWbsPicker] = useState(false)

  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('computo-font-size')
      return saved ? parseInt(saved) : 11
    }
    return 11
  })
  const changeFontSize = (delta: number) => {
    setFontSize(prev => {
      const next = Math.min(13, Math.max(9, prev + delta))
      localStorage.setItem('computo-font-size', String(next))
      return next
    })
  }

  const toastRef   = useRef<NodeJS.Timeout | null>(null)
  const lastSelRef = useRef<string | null>(null)
  const editingRef = useRef<HTMLInputElement>(null)
  const [editingCell, setEditingCell] = useState<{ voceId: string; field: 'quantita' | 'prezzo_unitario' } | null>(null)
  const [editingVal,  setEditingVal]  = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2800)
  }

  // ─── Carica dati ─────────────────────────────────────────────────────────

  const caricaDati = useCallback(async () => {
    if (!id) return
    setCaricamento(true)
    try {
      const { data: computo } = await supabase.from('computo_metrico').select('id').eq('commessa_id', id).single()
      if (!computo) { setCaricamento(false); return }
      setComputoId(computo.id)

      const { data: v } = await supabase
        .from('voci_computo')
        .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,capitolo,categoria,note,wbs_id,wbs_label')
        .eq('computo_id', computo.id)
        .order('capitolo').order('codice')

      if (v) { setVoci(v); setTotale(v.reduce((s, x) => s + (x.importo || 0), 0)) }

      const { data: rda } = await supabase.from('rda').select('id,wbs_id,stato,tipo').eq('commessa_id', id)
      if (rda) setRdaList(rda as RDADB[])
    } finally { setCaricamento(false) }
  }, [id])

  useEffect(() => { caricaDati() }, [caricaDati])

  // ─── Assegna WBS a singola voce ──────────────────────────────────────────

  const assegnaWBSVoce = async (voceId: string, wbsId: string | null) => {
    const wbsLabel = wbsId ? `${wbsId} ${WBS_MAP[wbsId] || ''}` : null
    await supabase.from('voci_computo').update({ wbs_id: wbsId, wbs_label: wbsLabel }).eq('id', voceId)
    setVoci(prev => prev.map(v => v.id === voceId ? { ...v, wbs_id: wbsId || undefined, wbs_label: wbsLabel || undefined } : v))
    setWbsPicker(null)
    showToast(wbsId ? `✓ WBS: ${wbsId} assegnato` : 'WBS rimosso')
  }

  // ─── Assegna WBS in bulk ─────────────────────────────────────────────────

  const assegnaWBSBulk = async (wbsId: string) => {
    const ids = Array.from(multiSel)
    const wbsLabel = `${wbsId} ${WBS_MAP[wbsId] || ''}`
    await supabase.from('voci_computo').update({ wbs_id: wbsId, wbs_label: wbsLabel }).in('id', ids)
    setVoci(prev => prev.map(v => multiSel.has(v.id) ? { ...v, wbs_id: wbsId, wbs_label: wbsLabel } : v))
    setBulkWbsPicker(false)
    showToast(`✓ WBS ${wbsId} → ${ids.length} voci`)
  }

  // ─── Import XPWE ────────────────────────────────────────────────────────

  const importaFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xpwe', 'pwe', 'xml'].includes(ext || '')) { setRisultatoImport({ error: 'Formato non supportato.' }); return }
    setImportando(true); setRisultatoImport(null)
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('commessa_id', id)
      const res = await fetch('/api/xpwe-parse', { method: 'POST', body: fd })
      const data = await res.json()
      setRisultatoImport(data)
      if (data.ok) { await caricaDati(); showToast(`✓ ${data.voci} voci importate`) }
    } catch { setRisultatoImport({ error: 'Errore di rete' }) }
    finally { setImportando(false) }
  }

  // ─── Genera RDA da selezione ────────────────────────────────────────────

  const generaRDA = async () => {
    const ids = Array.from(multiSel)
    if (!ids.length) { showToast('Seleziona almeno una voce'); return }
    const senzaWBS = ids.filter(vid => !voci.find(v => v.id === vid)?.wbs_id)
    if (senzaWBS.length > 0) {
      showToast(`⚠ ${senzaWBS.length} voci senza nodo WBS — assegna WBS prima di generare RDA`)
      setMultiSel(new Set(senzaWBS))
      return
    }
    const wbsGroups: Record<string, string[]> = {}
    ids.forEach(vid => {
      const v = voci.find(x => x.id === vid)
      const key = v?.wbs_id || 'nessun_wbs'
      if (!wbsGroups[key]) wbsGroups[key] = []
      wbsGroups[key].push(vid)
    })
    const aziendaId = await getAziendaId()
    let created = 0
    for (const [wbsId, voceIds] of Object.entries(wbsGroups)) {
      const codice = 'RDA-' + Date.now().toString(36).toUpperCase() + '-' + created
      await supabase.from('rda').insert({
        commessa_id: id, azienda_id: aziendaId || null,
        codice, stato: 'bozza', tipo: 'MAT', qta_stimata: 1, um: 'nr',
        oggetto: `RDA da computo (${voceIds.length} voci)`,
        voci_ids: voceIds,
        wbs_id: wbsId !== 'nessun_wbs' ? wbsId : null,
        wbs_label: wbsId !== 'nessun_wbs' ? WBS_MAP[wbsId] : null,
      })
      created++
    }
    await caricaDati()
    setMultiSel(new Set())
    showToast(`⚡ ${created} RDA create per ${ids.length} voci`)
  }

  // ─── Duplica voce ────────────────────────────────────────────────────────

  const duplicaVoce = async (voceId: string) => {
    const voce = voci.find(v => v.id === voceId)
    if (!voce || !computoId) return
    await supabase.from('voci_computo').insert({
      computo_id: computoId,
      codice: voce.codice + '_C',
      descrizione: voce.descrizione,
      um: voce.um,
      quantita: voce.quantita,
      prezzo_unitario: voce.prezzo_unitario,
      importo: voce.importo,
      capitolo: voce.capitolo,
      categoria: voce.categoria,
      note: voce.note || null,
      wbs_id: voce.wbs_id || null,
      wbs_label: voce.wbs_label || null,
    })
    await caricaDati()
    showToast('✓ Voce duplicata')
  }

  // ─── Elimina bulk ────────────────────────────────────────────────────────

  const eliminaBulk = async () => {
    const ids = Array.from(multiSel)
    if (!ids.length) return
    await supabase.from('voci_computo').delete().in('id', ids)
    await caricaDati()
    setMultiSel(new Set())
    showToast(`🗑 ${ids.length} voci eliminate`)
  }

  // ─── Categorie dinamiche ─────────────────────────────────────────────────

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
    const children = WBS_CHILDREN(code)
    const direct = voci.filter(v => v.wbs_id === code).reduce((s, v) => s + v.importo, 0)
    const childSum = children.reduce((s, c) => s + wbsBudget(c), 0)
    return direct + childSum
  }
  const wbsCount = (code: string): number => {
    const children = WBS_CHILDREN(code)
    const direct = voci.filter(v => v.wbs_id === code).length
    return direct + children.reduce((s, c) => s + wbsCount(c), 0)
  }

  const vociFiltrate = voci.filter(v => {
    if (wbsSel) return v.wbs_id === wbsSel
    if (catFilter.c) return v.categoria === catFilter.c || v.capitolo === catFilter.c
    if (catFilter.sc) return v.capitolo === catFilter.sc
    return true
  })

  const voceNoWBS = voci.filter(v => !v.wbs_id).length

  // ─── Resizer ─────────────────────────────────────────────────────────────

  const resizerRef = useRef<HTMLDivElement>(null)
  const rDrag = useRef(false); const rStartX = useRef(0); const rStartW = useRef(sbWidth)
  useEffect(() => {
    const mm = (e: MouseEvent) => { if (!rDrag.current) return; setSbWidth(Math.max(180, Math.min(500, rStartW.current + (e.clientX - rStartX.current)))) }
    const mu = () => { rDrag.current = false; resizerRef.current?.classList.remove('active') }
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu)
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu) }
  }, [])
  const onResizerDown = (e: React.MouseEvent) => { rDrag.current = true; rStartX.current = e.clientX; rStartW.current = sbWidth; resizerRef.current?.classList.add('active'); e.preventDefault() }

  useEffect(() => {
    const h = () => { setCtx(null) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  // ─── WBS Tree sidebar ────────────────────────────────────────────────────

  const renderWBSNode = (code: string, lvl: number): React.ReactNode => {
    const ch = WBS_CHILDREN(code)
    const cnt = wbsCount(code)
    const bgt = wbsBudget(code)
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

  // ─── Flusso icone ────────────────────────────────────────────────────────

  const rdaByVoce = (vid: string) => rdaList.find(r => Array.isArray((r as any).voci_ids) && (r as any).voci_ids.includes(vid))

  // ─── Righe tabella ───────────────────────────────────────────────────────

  type Row =
    | { type: 'hsc'; id: string; lb: string }
    | { type: 'hca'; id: string; lb: string }
    | { type: 'vo'; v: VoceDB }
    | { type: 'mi'; v: VoceDB }
    | { type: 'som'; v: VoceDB }

  const tableRows: Row[] = (() => {
    const rows: Row[] = []
    let lastSC = '', lastC = ''
    for (const v of vociFiltrate) {
      if (v.capitolo !== lastSC) { rows.push({ type: 'hsc', id: v.capitolo, lb: v.capitolo }); lastSC = v.capitolo; lastC = '' }
      if (v.categoria && v.categoria !== v.capitolo && v.categoria !== lastC) { rows.push({ type: 'hca', id: v.categoria, lb: v.categoria }); lastC = v.categoria }
      rows.push({ type: 'vo', v }); rows.push({ type: 'mi', v }); rows.push({ type: 'som', v })
    }
    return rows
  })()

  const voceIdx = (v: VoceDB) => voci.indexOf(v) + 1

  // ─── Importo selezione corrente ───────────────────────────────────────────

  const selImporto = voci.filter(v => multiSel.has(v.id)).reduce((s, v) => s + (v.importo || 0), 0)

  // ─── Click handler Primus-style ───────────────────────────────────────────

  const handleRowClick = (e: React.MouseEvent, voceId: string) => {
    if (e.shiftKey && lastSelRef.current) {
      const visIds = vociFiltrate.map(x => x.id)
      const fromIdx = visIds.indexOf(lastSelRef.current)
      const toIdx = visIds.indexOf(voceId)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [s, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        const range = visIds.slice(s, end + 1)
        setMultiSel(prev => new Set([...prev, ...range]))
      }
    } else if (e.ctrlKey || e.metaKey) {
      setMultiSel(prev => {
        const n = new Set(prev)
        if (n.has(voceId)) n.delete(voceId); else n.add(voceId)
        return n
      })
    } else {
      setMultiSel(prev => prev.size === 1 && prev.has(voceId) ? new Set() : new Set([voceId]))
    }
    lastSelRef.current = voceId
    setSel(voceId)
  }

  // ─── Editing inline ──────────────────────────────────────────────────────

  useEffect(() => {
    if (editingCell) { editingRef.current?.focus(); editingRef.current?.select() }
  }, [editingCell])

  const saveEdit = async () => {
    if (!editingCell) return
    const { voceId, field } = editingCell
    const val = parseFloat(editingVal) || 0
    const voce = voci.find(v => v.id === voceId)
    if (!voce) { setEditingCell(null); return }
    const newQ = field === 'quantita' ? val : voce.quantita
    const newP = field === 'prezzo_unitario' ? val : voce.prezzo_unitario
    const newImporto = parseFloat((newQ * newP).toFixed(2))
    await supabase.from('voci_computo').update({ [field]: val, importo: newImporto }).eq('id', voceId)
    setVoci(prev => prev.map(v => v.id === voceId ? { ...v, [field]: val, importo: newImporto } : v))
    setTotale(prev => parseFloat((prev - voce.importo + newImporto).toFixed(2)))
    setEditingCell(null)
    showToast(`✓ ${field === 'quantita' ? 'Quantità' : 'Prezzo'} aggiornato`)
  }

  // ─── WBS Picker popup ─────────────────────────────────────────────────────

  const WbsPicker = ({ voceId, x, y, currentWbs }: { voceId: string; x: number; y: number; currentWbs?: string }) => (
    <div className="cmp-wbs-picker" style={{ left: x, top: y }} onClick={e => e.stopPropagation()}>
      <div className="cmp-wbs-picker-hdr">
        📐 Assegna nodo WBS
        {currentWbs && <button className="cmp-wbs-picker-clr" onClick={() => assegnaWBSVoce(voceId, null)}>✕ Rimuovi</button>}
      </div>
      {WBS_FLAT.map(([code, label]) => {
        const indent = (code.match(/\./g) || []).length
        return (
          <div key={code} className={`cmp-wbs-pi${currentWbs === code ? ' active' : ''}`}
            style={{ paddingLeft: 8 + indent * 12 }}
            onClick={() => assegnaWBSVoce(voceId, code)}>
            <span className="wbs-code">{code}</span>
            <span>{label}</span>
          </div>
        )
      })}
    </div>
  )

  // ─── Bulk WBS picker modal ────────────────────────────────────────────────

  const BulkWbsModal = () => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => setBulkWbsPicker(false)}>
      <div style={{ background: '#fff', borderRadius: 12, width: 320, maxHeight: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '10px 14px', background: '#14532d', color: '#fff', fontSize: 12, fontWeight: 700 }}>
          📐 Assegna WBS a {multiSel.size} voci
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {WBS_FLAT.map(([code, label]) => {
            const indent = (code.match(/\./g) || []).length
            return (
              <div key={code} className="cmp-wbs-pi" style={{ paddingLeft: 8 + indent * 14 }}
                onClick={() => assegnaWBSBulk(code)}>
                <span className="wbs-code">{code}</span>
                <span style={{ fontSize: 11 }}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ─── Render principale ───────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: V3_CSS }} />
      <style>{`table.cmp-t tbody td { font-size: ${fontSize}px !important; }`}</style>
      <div className="cmp-root" style={{ height: 'calc(100vh - 145px)' }}>

        {/* SIDEBAR */}
        {!sbHidden && (
          <div className="cmp-sb" style={{ width: sbWidth, minWidth: sbWidth }}>
            <div className="cmp-logo">
              <span className="cmp-logo-txt">📐 Computo</span>
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
                <span className="cmp-wkpi-v">{fi(totale, 0)} €</span>
                <span className="cmp-wkpi-l">Totale lista</span>
              </div>
              <div className="cmp-wkpi" style={{ background: voceNoWBS > 0 ? '#fffbeb' : undefined }}>
                <span className="cmp-wkpi-v" style={{ color: voceNoWBS > 0 ? '#d97706' : '#14532d' }}>{voceNoWBS}</span>
                <span className="cmp-wkpi-l" style={{ color: voceNoWBS > 0 ? '#92400e' : undefined }}>senza WBS</span>
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
              <div className="cmp-sft"><span>Totale computo</span><span>{fi(totale)} €</span></div>
              {(wbsSel || catFilter.sc) ? (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '5px 0' }} />
                  <div className="cmp-sft" style={{ fontSize: 11 }}>
                    <span>{vociFiltrate.length} voci filtrate</span>
                    <span style={{ color: '#4ade80', fontWeight: 800 }}>{fi(vociFiltrate.reduce((s, v) => s + v.importo, 0))} €</span>
                  </div>
                  <div className="cmp-sfs">{wbsSel ? `WBS: ${wbsSel}` : catFilter.c || catFilter.sc}</div>
                </>
              ) : (
                <div className="cmp-sfs">IVA esclusa · prezzi contrattuali</div>
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
              ) : <span style={{ fontSize: 10, color: '#9ca3af' }}>Tutto il computo · click riga per selezionare · Ctrl+click multipla · Shift+click range</span>}
            </div>
            <button className="cmp-tbtn" style={{ fontSize: 11, padding: '3px 8px', opacity: fontSize <= 9 ? 0.4 : 1 }} onClick={() => changeFontSize(-1)} disabled={fontSize <= 9} title="Riduci testo">A-</button>
            <span style={{ fontSize: 10, color: '#6b7280', minWidth: 26, textAlign: 'center' }}>{fontSize}px</span>
            <button className="cmp-tbtn" style={{ fontSize: 12, padding: '3px 8px', opacity: fontSize >= 13 ? 0.4 : 1 }} onClick={() => changeFontSize(1)} disabled={fontSize >= 13} title="Aumenta testo">A+</button>
            <label style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: '#1d4ed8', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              {importando ? '⏳ Import...' : '📥 Importa XPWE'}
              <input type="file" accept=".xpwe,.pwe,.xml" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importaFile(f) }} />
            </label>
          </div>

          {/* IMPORT RESULT */}
          {risultatoImport && (
            <div style={{ padding: '5px 10px', background: risultatoImport.ok ? '#dcfce7' : '#fef2f2', borderBottom: '1px solid', borderColor: risultatoImport.ok ? '#86efac' : '#fca5a5', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {risultatoImport.ok
                ? <span style={{ color: '#166534' }}>✓ {risultatoImport.tariffe} tariffe · {risultatoImport.voci} voci · € {fi(risultatoImport.importo_totale || 0)}</span>
                : <span style={{ color: '#991b1b' }}>⚠ {risultatoImport.error}</span>}
              <button onClick={() => setRisultatoImport(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
          )}

          {/* MULTI-SELECT BAR */}
          {multiSel.size > 0 && (
            <div className="cmp-mbar">
              <span className="cmp-mbar-n">{multiSel.size}</span>
              <span className="cmp-mbar-l"> voci sel. — {fi(selImporto, 0)} €</span>
              <button className="cmp-mbtn cmp-mbtn-wbs" onClick={() => setBulkWbsPicker(true)}>📐 WBS</button>
              <button className="cmp-mbtn cmp-mbtn-rda" onClick={generaRDA}>⚡ RDA</button>
              <button onClick={eliminaBulk} style={{ fontSize: 10, padding: '3px 9px', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, background: '#dc2626', color: '#fff' }}>🗑 Elimina</button>
              <button className="cmp-mbtn cmp-mbtn-clr" onClick={() => { setMultiSel(new Set()); lastSelRef.current = null }}>✕</button>
            </div>
          )}

          {/* VISTA BAR */}
          <div className="cmp-vbar">
            <span className="cmp-vbl">Filtro:</span>
            <button className={`cmp-vtab${!wbsSel && !catFilter.sc ? ' on' : ''}`} onClick={() => { setWbsSel(null); setCatFilter({ sc: null, c: null }) }}>Tutto</button>
            {voceNoWBS > 0 && (
              <button className="cmp-vtab" style={{ color: '#d97706', borderColor: '#fcd34d' }}
                onClick={() => setWbsSel('__no_wbs__' as string)}>
                ⚠ Senza WBS ({voceNoWBS})
              </button>
            )}
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
              <label style={{ padding: '8px 20px', background: '#14532d', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                📥 Seleziona file XPWE
                <input type="file" accept=".xpwe,.pwe,.xml" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importaFile(f) }} />
              </label>
            </div>
          ) : (
            <div className="cmp-tscroll" onClick={() => setCtx(null)}>
              <table className="cmp-t">
                <colgroup>
                  <col className="cc2" /><col className="cc3" /><col className="cc4" />
                  <col className="cc5" /><col className="cc6" /><col className="cc7" /><col className="cc8" />
                  <col className="cc9" /><col className="cc10" /><col className="cc11" />
                  <col className="cc12" /><col className="cc13" /><col className="cc14" /><col className="cc15" />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>Nr</th>
                    <th rowSpan={2}>Tariffa</th>
                    <th rowSpan={2} className="thl">DESIGNAZIONE dei LAVORI / WBS</th>
                    <th colSpan={4} style={{ borderBottom: '1px solid #16a34a' }}>DIMENSIONI</th>
                    <th rowSpan={2}>Quantità</th>
                    <th colSpan={2} style={{ borderBottom: '1px solid #16a34a' }}>IMPORTI</th>
                    <th colSpan={4} style={{ background: '#1e3a5f', color: '#93c5fd', borderBottom: '1px solid #2563eb' }}>FLUSSO</th>
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
                    if (row.type === 'hsc') return <tr key={`hsc_${i}`} className="cmp-hsc"><td colSpan={14}>▸ {row.lb}</td></tr>
                    if (row.type === 'hca') return <tr key={`hca_${i}`} className="cmp-hca"><td colSpan={14}>{row.lb}</td></tr>

                    if (row.type === 'vo') {
                      const v = row.v
                      const isSel = sel === v.id; const isMSel = multiSel.has(v.id)
                      const idx = voceIdx(v)
                      const hasWBS = !!v.wbs_id
                      const first = v.descrizione || ''
                      return (
                        <tr key={v.id} className={`cmp-rvo${isMSel ? ' msel' : isSel ? ' sel' : ''}`}
                          onClick={e => handleRowClick(e, v.id)}
                          onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, id: v.id }) }}>
                          <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700 }}>{idx}</td>
                          <td style={{ fontSize: 10, color: '#1d4ed8', fontFamily: 'monospace' }}>{v.codice}</td>
                          <td style={{ fontSize: 10, maxWidth: 0 }}>
                            <span className="cmp-des-first" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{first}</span>
                            <span
                              className={`cmp-wbadge ${hasWBS ? 'set' : 'unset'}`}
                              title={hasWBS ? `WBS: ${v.wbs_id} ${v.wbs_label}` : 'Clicca per assegnare WBS'}
                              onClick={e => {
                                e.stopPropagation()
                                const rect = e.currentTarget.getBoundingClientRect()
                                setWbsPicker({ voceId: v.id, x: rect.left, y: rect.bottom + 4 })
                              }}>
                              {hasWBS ? `📐 ${v.wbs_id}` : '+ WBS'}
                            </span>
                          </td>
                          <td /><td /><td /><td />
                          <td className="cmp-td-edit"
                            onDoubleClick={e => { e.stopPropagation(); setEditingCell({ voceId: v.id, field: 'quantita' }); setEditingVal(String(v.quantita)) }}>
                            {editingCell?.voceId === v.id && editingCell.field === 'quantita' ? (
                              <input ref={editingRef} type="number" className="cmp-inp-cell" value={editingVal}
                                onChange={e => setEditingVal(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit() } if (e.key === 'Escape') setEditingCell(null) }}
                                onClick={e => e.stopPropagation()} />
                            ) : (
                              <span style={{ fontSize: 10, fontFamily: 'monospace', display: 'block', textAlign: 'right', color: '#374151' }}>{f3(v.quantita)}</span>
                            )}
                          </td>
                          <td className="cmp-td-edit"
                            onDoubleClick={e => { e.stopPropagation(); setEditingCell({ voceId: v.id, field: 'prezzo_unitario' }); setEditingVal(String(v.prezzo_unitario)) }}>
                            {editingCell?.voceId === v.id && editingCell.field === 'prezzo_unitario' ? (
                              <input ref={editingRef} type="number" className="cmp-inp-cell" value={editingVal}
                                onChange={e => setEditingVal(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit() } if (e.key === 'Escape') setEditingCell(null) }}
                                onClick={e => e.stopPropagation()} />
                            ) : (
                              <span style={{ fontSize: 10, fontFamily: 'monospace', display: 'block', textAlign: 'right' }}>{fi(v.prezzo_unitario)}</span>
                            )}
                          </td>
                          <td />
                          <td className="cmp-fi">
                            <span className={rdaByVoce(v.id) ? 'cmp-fi-ok' : 'cmp-fi-no'}>
                              {rdaByVoce(v.id) ? '✓' : '○'}
                            </span>
                          </td>
                          <td className="cmp-fi"><span className="cmp-fi-no">○</span></td>
                          <td className="cmp-fi"><span className="cmp-fi-no">○</span></td>
                          <td style={{ textAlign: 'center' }}><span className="cmp-sal cmp-sal-0">—</span></td>
                        </tr>
                      )
                    }

                    if (row.type === 'mi') {
                      const v = row.v; const isSel = sel === v.id
                      return (
                        <tr key={`mi_${v.id}`} className={`cmp-rmi${isSel ? ' sel' : ''}`}>
                          <td />
                          <td /><td style={{ paddingLeft: 28, color: '#6b7280', fontSize: 10, fontStyle: 'italic' }}>
                            {v.note?.split('>').pop()?.trim() || 'misura da XPWE'}
                          </td>
                          <td><span className="cmp-edt">1</span></td>
                          <td><span className="cmp-edt cmp-mono">{f3(v.quantita)}</span></td>
                          <td /><td />
                          <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 10, fontFamily: 'monospace' }}>{f3(v.quantita)}</td>
                          <td /><td /><td /><td /><td /><td />
                        </tr>
                      )
                    }

                    if (row.type === 'som') {
                      const v = row.v
                      return (
                        <tr key={`som_${v.id}`} className="cmp-rsom">
                          <td colSpan={3} style={{ textAlign: 'right', paddingRight: 6, fontWeight: 700, fontSize: 10 }}>SOMMANO {v.um}</td>
                          <td colSpan={4} />
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{f3(v.quantita)}</td>
                          <td style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>{fi(v.prezzo_unitario)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{fi(v.importo)}</td>
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

        </div>

        {/* WBS PICKER POPUP */}
        {wbsPicker && (
          <>
            <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setWbsPicker(null)} />
            <WbsPicker voceId={wbsPicker.voceId} x={wbsPicker.x} y={wbsPicker.y}
              currentWbs={voci.find(v => v.id === wbsPicker.voceId)?.wbs_id} />
          </>
        )}

        {/* BULK WBS MODAL */}
        {bulkWbsPicker && <BulkWbsModal />}

        {/* CONTEXT MENU */}
        {ctx && (
          <div className="cmp-ctx" style={{ left: ctx.x, top: ctx.y }} onClick={e => e.stopPropagation()}>
            <div className="cmp-ctxh">
              {multiSel.size > 1 ? `${multiSel.size} voci selezionate` : 'Voce EP'}
            </div>

            <div className="cmp-ctxi" style={{ color: '#7c3aed', fontWeight: 600 }} onClick={() => {
              if (multiSel.size > 1) { setBulkWbsPicker(true) }
              else { setWbsPicker({ voceId: ctx.id, x: ctx.x, y: Math.min(ctx.y, window.innerHeight - 360) }) }
              setCtx(null)
            }}>📐 Assegna WBS</div>

            <div className="cmp-ctxi acc" onClick={() => {
              if (multiSel.size <= 1) setMultiSel(new Set([ctx.id]))
              setCtx(null)
              showToast('Voce selezionata — usa "Genera RDA"')
            }}>⚡ Genera RDA da voce</div>

            <div className="cmp-ctxsep" />

            <div className="cmp-ctxi" onClick={() => {
              const voce = voci.find(v => v.id === ctx.id)
              if (voce) {
                const capIds = voci.filter(v => v.capitolo === voce.capitolo).map(v => v.id)
                setMultiSel(new Set(capIds))
                showToast(`✓ ${capIds.length} voci del capitolo selezionate`)
              }
              setCtx(null)
            }}>☑ Seleziona tutto capitolo</div>

            <div className="cmp-ctxi" onClick={() => {
              navigator.clipboard.writeText(voci.find(v => v.id === ctx.id)?.codice || '')
              setCtx(null); showToast('Codice copiato')
            }}>📋 Copia codice tariffa</div>

            <div className="cmp-ctxsep" />

            <div className="cmp-ctxi" onClick={() => { duplicaVoce(ctx.id); setCtx(null) }}>
              ⧉ Duplica voce
            </div>

            <div className="cmp-ctxi" onClick={() => {
              setCtx(null); showToast('📊 Storico prezzi — funzione in sviluppo')
            }}>📊 Storico prezzi</div>

            {multiSel.size > 1 && (
              <>
                <div className="cmp-ctxsep" />
                <div className="cmp-ctxh">Azioni bulk ({multiSel.size} voci)</div>
                <div className="cmp-ctxi acc" onClick={() => { generaRDA(); setCtx(null) }}>
                  ⚡ Genera RDA ({multiSel.size})
                </div>
                <div className="cmp-ctxi danger" onClick={() => { eliminaBulk(); setCtx(null) }}>
                  🗑 Elimina ({multiSel.size})
                </div>
              </>
            )}
          </div>
        )}

        {/* TOAST */}
        <div className={`cmp-toast${toast ? ' show' : ''}`}>{toast}</div>
      </div>
    </>
  )
}
