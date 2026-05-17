'use client'

import React, { useState, useEffect, useRef, useCallback, use } from 'react'
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
const TIPI_ANALISI = [
  { value: 'materiali',          label: 'Materiali',       color: '#3b82f6', rda: true  },
  { value: 'nolo_esterno',       label: 'Nolo esterno',    color: '#8b5cf6', rda: true  },
  { value: 'subappalto',         label: 'Subappalto',      color: '#f59e0b', rda: true  },
  { value: 'manodopera_esterna', label: 'Manod. esterna',  color: '#10b981', rda: true  },
  { value: 'manodopera_interna', label: 'Manod. impresa',  color: '#6b7280', rda: false },
  { value: 'mezzi_interni',      label: 'Mezzi impresa',   color: '#64748b', rda: false },
  { value: 'utile_impresa',      label: 'Utile impresa',   color: '#34d399', rda: false },
]
interface AnalisiPrezzo {
  id: string; commessa_id: string; codice_tariffa: string
  tipo: string; descrizione?: string; importo_unitario: number; percentuale: number
}
interface RdaModalRow {
  wbs_id: string; tipo: string; label: string; color: string
  importoStimato: number; voceIds: string[]; selected: boolean
}
interface AnalisiExtraVoce {
  id: string; commessa_id: string; voce_computo_id: string; azienda_id?: string
  tipo: string; descrizione?: string; importo_unitario: number
}

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
table.cmp-t thead{position:sticky;top:0;z-index:10;background:#4ade80}
table.cmp-t th{padding:3px;font-size:10px;font-weight:700;background:#4ade80;color:#14532d;border-right:1px solid #16a34a;text-align:center;white-space:nowrap}
table.cmp-t th.thl{text-align:left;padding-left:6px}
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
.cmp-analisi-panel{background:#fefce8;border-top:2px solid #fde68a}
.cmp-analisi-hdr{display:flex;align-items:center;gap:8px;padding:5px 14px;background:#fef3c7;border-bottom:1px solid #fde68a;font-size:11px;font-weight:700;color:#92400e}
.cmp-analisi-t{width:100%;border-collapse:collapse;font-size:10px}
.cmp-analisi-t th{padding:3px 8px;background:#fffbeb;color:#78350f;font-weight:700;font-size:9px;text-transform:uppercase;border-bottom:1px solid #fde68a;text-align:left;letter-spacing:.04em}
.cmp-analisi-t td{padding:4px 8px;border-bottom:1px solid #fef3c7;vertical-align:middle}
.cmp-analisi-t tfoot td{padding:5px 8px;background:#fffbeb;border-top:1px solid #fde68a}
.cmp-analisi-inp{border:1px solid #fcd34d;border-radius:2px;padding:2px 5px;font-size:10px;font-family:monospace;background:#fffde7;outline:none;text-align:right;width:80px}
.cmp-analisi-inp:focus{border-color:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.2)}
.cmp-analisi-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:1px;vertical-align:middle;flex-shrink:0}
.cmp-analisi-add-btn{font-size:9px;color:#78350f;cursor:pointer;padding:1px 5px;border-radius:2px;border:1px dashed #fcd34d;background:transparent;margin-left:4px;vertical-align:middle}
.cmp-analisi-add-btn:hover{color:#92400e;border-color:#f59e0b;background:#fef3c7}
.cmp-rda-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:400;display:flex;align-items:center;justify-content:center;padding:16px}
.cmp-rda-modal{background:#fff;border-radius:14px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column}
.cmp-rda-modal-hdr{padding:14px 18px;background:#1e3a5f;color:#fff;font-size:13px;font-weight:700;border-radius:14px 14px 0 0;flex-shrink:0}
.cmp-rda-modal-t{width:100%;border-collapse:collapse;font-size:11px}
.cmp-rda-modal-t th{padding:6px 12px;background:#f1f5f9;color:#475569;font-weight:700;font-size:10px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;text-align:left}
.cmp-rda-modal-t td{padding:8px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
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

export default function SalAttiviPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
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
  const [analisi, setAnalisi] = useState<AnalisiPrezzo[]>([])
  const [analisiEdit, setAnalisiEdit] = useState<Record<string, string>>({})
  const [analisiExtra, setAnalisiExtra] = useState<AnalisiExtraVoce[]>([])
  const [analisiExtraEdit, setAnalisiExtraEdit] = useState<Record<string, string>>({})
  const [baseExpanded, setBaseExpanded] = useState<Record<string, boolean>>({})
  const [extraExpanded, setExtraExpanded] = useState<Record<string, boolean>>({})
  const [copiaSource, setCopiaSource] = useState('')
  const [rdaModal, setRdaModal] = useState<{ rows: RdaModalRow[]; senzaAnalisi: string[]; generaFallback: boolean } | null>(null)

  // ─── SAL Attivi state ─────────────────────────────────────────────────────
  const [salList, setSalList] = useState<Array<{id:string;numero:number;stato:string;data_emissione:string}>>([])
  const [salSel, setSalSel] = useState<{id:string;numero:number}|null>(null)
  const [qtInput, setQtInput] = useState<Record<string,number>>({})
  const [qtPerSal, setQtPerSal] = useState<Record<string,Record<string,number>>>({})
  const [qtCumul, setQtCumul] = useState<Record<string,number>>({})

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

  const toastRef    = useRef<NodeJS.Timeout | null>(null)
  const lastSelRef  = useRef<string | null>(null)
  const editingRef  = useRef<HTMLInputElement>(null)
  const dblClickRef = useRef<{ id: string; field: string; t: number } | null>(null)
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

      const [{ data: v }, { data: rda }, { data: analisiData }, { data: extraData }] = await Promise.all([
        supabase.from('voci_computo')
          .select('id,codice,descrizione,um,quantita,prezzo_unitario,importo,capitolo,categoria,note,wbs_id,wbs_label')
          .eq('computo_id', computo.id).order('capitolo').order('codice'),
        supabase.from('rda').select('id,wbs_id,stato,tipo').eq('commessa_id', id),
        supabase.from('analisi_prezzi_tariffa').select('*').eq('commessa_id', id),
        supabase.from('analisi_extra_voce').select('*').eq('commessa_id', id),
      ])
      if (v) { setVoci(v); setTotale(v.reduce((s, x) => s + (x.importo || 0), 0)) }
      if (rda) setRdaList(rda as RDADB[])
      if (analisiData) setAnalisi(analisiData as AnalisiPrezzo[])
      if (extraData) setAnalisiExtra(extraData as AnalisiExtraVoce[])

      // Carica SAL e quantità certificate
      const { data: sals } = await supabase
        .from('sal').select('id,numero,stato,data_emissione')
        .eq('commessa_id', id).order('numero')
      setSalList(sals || [])
      if (sals?.length) {
        const { data: sv } = await supabase
          .from('sal_voci').select('sal_id,voce_computo_id,quantita_periodo')
          .in('sal_id', sals.map((s: any) => s.id))
        const perSal: Record<string, Record<string, number>> = {}
        const cumul: Record<string, number> = {}
        sv?.forEach((r: any) => {
          if (!perSal[r.sal_id]) perSal[r.sal_id] = {}
          perSal[r.sal_id][r.voce_computo_id] = r.quantita_periodo
          cumul[r.voce_computo_id] = (cumul[r.voce_computo_id] || 0) + r.quantita_periodo
        })
        setQtPerSal(perSal)
        setQtCumul(cumul)
      }
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

  // ─── Analisi prezzi tariffa ──────────────────────────────────────────────

  const aggiungiAnalisi = async (codice: string, tipo: string) => {
    const aziendaId = await getAziendaId()
    const { data } = await supabase.from('analisi_prezzi_tariffa').insert({
      commessa_id: id, azienda_id: aziendaId || null,
      codice_tariffa: codice, tipo, importo_unitario: 0, percentuale: 0,
    }).select().single()
    if (data) setAnalisi(prev => [...prev, data as AnalisiPrezzo])
  }

  const eliminaAnalisi = async (analisiId: string) => {
    await supabase.from('analisi_prezzi_tariffa').delete().eq('id', analisiId)
    setAnalisi(prev => prev.filter(a => a.id !== analisiId))
  }

  const aggiornaAnalisi = async (a: AnalisiPrezzo, field: 'importo_unitario' | 'percentuale', rawVal: string, pu: number) => {
    const val = parseFloat(rawVal) || 0
    let newImporto = a.importo_unitario
    let newPct = a.percentuale
    if (field === 'importo_unitario') {
      newImporto = val
      newPct = pu > 0 ? Math.round((val / pu) * 10000) / 100 : 0
    } else {
      newPct = val
      newImporto = Math.round(pu * val / 100 * 100) / 100
    }
    await supabase.from('analisi_prezzi_tariffa').update({ importo_unitario: newImporto, percentuale: newPct }).eq('id', a.id)
    setAnalisi(prev => prev.map(x => x.id === a.id ? { ...x, importo_unitario: newImporto, percentuale: newPct } : x))
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
    if (data) setAnalisi(data as AnalisiPrezzo[])
    setCopiaSource('')
    showToast(`✓ Analisi copiata da ${codiceSource}`)
  }

  // ─── Analisi extra per voce ──────────────────────────────────────────────

  const aggiungiExtra = async (voceId: string, tipo: string) => {
    const aziendaId = await getAziendaId()
    const { error } = await supabase.from('analisi_extra_voce').insert({
      voce_computo_id: voceId, commessa_id: id, azienda_id: aziendaId || null,
      tipo, descrizione: '', importo_unitario: 0,
    })
    if (error) { console.error('Extra voce error:', error); showToast('Errore: ' + error.message); return }
    const { data } = await supabase.from('analisi_extra_voce').select('*').eq('commessa_id', id)
    if (data) setAnalisiExtra(data as AnalisiExtraVoce[])
  }

  const eliminaExtra = async (extraId: string) => {
    const { error } = await supabase.from('analisi_extra_voce').delete().eq('id', extraId)
    if (error) { console.error('Extra voce error:', error); showToast('Errore: ' + error.message); return }
    const { data } = await supabase.from('analisi_extra_voce').select('*').eq('commessa_id', id)
    if (data) setAnalisiExtra(data as AnalisiExtraVoce[])
  }

  const aggiornaExtra = async (e: AnalisiExtraVoce, rawVal: string) => {
    const val = parseFloat(rawVal) || 0
    await supabase.from('analisi_extra_voce').update({ importo_unitario: val }).eq('id', e.id)
    setAnalisiExtra(prev => prev.map(x => x.id === e.id ? { ...x, importo_unitario: val } : x))
    setAnalisiExtraEdit(prev => { const n = { ...prev }; delete n['ex_' + e.id]; return n })
  }

  // ─── Genera RDA da selezione (intelligente) ──────────────────────────────

  const generaRDA = async () => {
    const ids = Array.from(multiSel)
    if (!ids.length) { showToast('Seleziona almeno una voce'); return }
    const senzaWBS = ids.filter(vid => !voci.find(v => v.id === vid)?.wbs_id)
    if (senzaWBS.length > 0) {
      showToast(`⚠ ${senzaWBS.length} voci senza nodo WBS — assegna WBS prima di generare RDA`)
      setMultiSel(new Set(senzaWBS)); return
    }
    const wbsGroups: Record<string, string[]> = {}
    ids.forEach(vid => {
      const v = voci.find(x => x.id === vid)
      const key = v?.wbs_id || 'nessun_wbs'
      if (!wbsGroups[key]) wbsGroups[key] = []
      wbsGroups[key].push(vid)
    })
    // Controlla se esistono analisi per i codici selezionati
    const conAnalisi = ids.filter(vid => { const v = voci.find(x => x.id === vid); return v && analisi.some(a => a.codice_tariffa === v.codice) })
    if (conAnalisi.length === 0) {
      // Nessuna analisi — comportamento classico
      await generaRDAClassica(wbsGroups); return
    }
    // Calcola righe modal RDA intelligente
    const rows: RdaModalRow[] = []
    for (const [wbsId, voceIds] of Object.entries(wbsGroups)) {
      for (const ta of TIPI_ANALISI.filter(t => t.rda)) {
        let imp = 0
        for (const vid of voceIds) {
          const v = voci.find(x => x.id === vid); if (!v) continue
          imp += analisi.filter(a => a.codice_tariffa === v.codice && a.tipo === ta.value).reduce((s, a) => s + v.quantita * (a.importo_unitario || 0), 0)
          imp += analisiExtra.filter(e => e.voce_computo_id === vid && e.tipo === ta.value).reduce((s, e) => s + v.quantita * (e.importo_unitario || 0), 0)
        }
        if (imp > 0.01) rows.push({ wbs_id: wbsId, tipo: ta.value, label: ta.label, color: ta.color, importoStimato: Math.round(imp * 100) / 100, voceIds, selected: true })
      }
    }
    const senzaAnalisiIds = ids.filter(vid => { const v = voci.find(x => x.id === vid); return !v || !analisi.some(a => a.codice_tariffa === v.codice) })
    setRdaModal({ rows, senzaAnalisi: senzaAnalisiIds, generaFallback: senzaAnalisiIds.length > 0 })
  }

  const generaRDAClassica = async (wbsGroups: Record<string, string[]>) => {
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
    await caricaDati(); setMultiSel(new Set())
    showToast(`⚡ ${created} RDA create per ${Array.from(multiSel).length} voci`)
  }

  const generaRDADaModal = async () => {
    if (!rdaModal) return
    const aziendaId = await getAziendaId()
    let created = 0
    for (const row of rdaModal.rows.filter(r => r.selected)) {
      const tipoRda = row.tipo === 'materiali' ? 'MAT' : row.tipo === 'subappalto' ? 'SUB' : ['manodopera_esterna', 'manodopera_interna'].includes(row.tipo) ? 'MAN' : 'SRV'
      const codice = 'RDA-' + Date.now().toString(36).toUpperCase() + '-' + created
      await supabase.from('rda').insert({
        commessa_id: id, azienda_id: aziendaId || null, codice, stato: 'bozza',
        tipo: tipoRda, oggetto: `${row.label} — WBS ${row.wbs_id}`,
        voci_ids: row.voceIds,
        wbs_id: row.wbs_id !== 'nessun_wbs' ? row.wbs_id : null,
        wbs_label: row.wbs_id !== 'nessun_wbs' ? WBS_MAP[row.wbs_id] : null,
      })
      created++
    }
    if (rdaModal.generaFallback && rdaModal.senzaAnalisi.length > 0) {
      const fallbackGroups: Record<string, string[]> = {}
      rdaModal.senzaAnalisi.forEach(vid => { const v = voci.find(x => x.id === vid); const key = v?.wbs_id || 'nessun_wbs'; if (!fallbackGroups[key]) fallbackGroups[key] = []; fallbackGroups[key].push(vid) })
      for (const [wbsId, voceIds] of Object.entries(fallbackGroups)) {
        await supabase.from('rda').insert({ commessa_id: id, azienda_id: aziendaId || null, codice: 'RDA-' + Date.now().toString(36).toUpperCase() + '-FB' + created, stato: 'bozza', tipo: 'MAT', oggetto: `RDA da computo (${voceIds.length} voci)`, voci_ids: voceIds, wbs_id: wbsId !== 'nessun_wbs' ? wbsId : null, wbs_label: wbsId !== 'nessun_wbs' ? WBS_MAP[wbsId] : null })
        created++
      }
    }
    setRdaModal(null); setMultiSel(new Set()); await caricaDati()
    showToast(`⚡ ${created} RDA create`)
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
    setEditingCell(null)
    setEditingVal('')
    if (editingCell) { saveEdit() }
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
            <div style={{ flex: '0 1 auto', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>
              {wbsSel ? (
                <><span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>📐 {wbsSel} {WBS_MAP[wbsSel]}</span>
                  <button style={{ fontSize: 9, padding: '1px 6px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }} onClick={() => setWbsSel(null)}>✕</button></>
              ) : catFilter.sc ? (
                <><span style={{ fontWeight: 700, color: '#14532d', fontSize: 11 }}>{catFilter.sc}</span>
                  <button style={{ fontSize: 9, padding: '1px 6px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }} onClick={() => setCatFilter({ sc: null, c: null })}>✕</button></>
              ) : <span style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>SAL Attivi · seleziona voce per il dettaglio</span>}
            </div>
            <button className="cmp-tbtn" style={{ fontSize: 11, padding: '3px 8px', opacity: fontSize <= 9 ? 0.4 : 1 }} onClick={() => changeFontSize(-1)} disabled={fontSize <= 9} title="Riduci testo">A-</button>
            <span style={{ fontSize: 10, color: '#6b7280', minWidth: 26, textAlign: 'center' }}>{fontSize}px</span>
            <button className="cmp-tbtn" style={{ fontSize: 12, padding: '3px 8px', opacity: fontSize >= 13 ? 0.4 : 1 }} onClick={() => changeFontSize(1)} disabled={fontSize >= 13} title="Aumenta testo">A+</button>
            <div style={{ marginLeft: 'auto', position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <select value={salSel?.id || ''} onChange={e => {
              const s = salList.find((x: any) => x.id === e.target.value) || null
              setSalSel(s)
              if (s) { const qt: Record<string,number> = {}; Object.entries(qtPerSal[s.id] || {}).forEach(([k, v]) => { qt[k] = v as number }); setQtInput(qt) }
              else setQtInput({})
            }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1fae5', background: '#f0fdf4', fontSize: 11 }}>
              <option value=''>— Seleziona SAL —</option>
              {salList.map((s: any) => <option key={s.id} value={s.id}>SAL {s.numero} · {s.stato}</option>)}
            </select>
            <button onClick={async () => {
              const n = (salList.length ? Math.max(...salList.map((s: any) => s.numero)) : 0) + 1
              const aziendaId = await getAziendaId()
              const { data, error } = await supabase.from('sal').insert({ commessa_id: id, azienda_id: aziendaId, numero: n, data_emissione: new Date().toISOString().split('T')[0], stato: 'bozza', metodo: 'manuale', note: '' }).select().single()
              if (error) { showToast('Errore creazione SAL: ' + error.message); return }
              if (data) { setSalList((p: any) => [...p, data]); setSalSel(data); setQtInput({}) }
            }} style={{ padding: '4px 12px', background: 'rgba(79,142,247,.2)', border: '1px solid rgba(79,142,247,.3)', borderRadius: 6, color: '#7baff8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Nuovo SAL</button>
            {salSel && <button onClick={async () => {
              await supabase.from('sal_voci').delete().eq('sal_id', salSel.id)
              const rows = Object.entries(qtInput).filter(([, q]) => q > 0).map(([vid, q]) => ({ sal_id: salSel.id, voce_computo_id: vid, quantita_periodo: q }))
              if (rows.length) await supabase.from('sal_voci').insert(rows)
              const nuovoCumul = { ...qtCumul }
              Object.entries(qtPerSal[salSel.id] || {}).forEach(([vid, q]) => { nuovoCumul[vid] = (nuovoCumul[vid] || 0) - (q as number) })
              Object.entries(qtInput).forEach(([vid, q]) => { nuovoCumul[vid] = (nuovoCumul[vid] || 0) + q })
              setQtCumul(nuovoCumul)
              setQtPerSal((p: any) => ({ ...p, [salSel.id]: qtInput }))
              const importoPeriodo = Object.entries(qtInput).reduce((sum, [vid, q]) => {
                const voce = voci.find((x: any) => x.id === vid)
                return sum + (q * (voce?.prezzo_unitario || 0))
              }, 0)
              const ritenuta = importoPeriodo * 0.05
              const cumulPrev = Object.entries(qtPerSal)
                .filter(([sid]) => sid !== salSel.id)
                .reduce((sum, [, perVoce]) =>
                  sum + Object.entries(perVoce).reduce((s, [vid, q]) => {
                    const voce = voci.find((x: any) => x.id === vid)
                    return s + (q as number) * (voce?.prezzo_unitario || 0)
                  }, 0)
                , 0)
              await supabase.from('sal').update({
                importo_certificato: importoPeriodo,
                importo_cumulativo: cumulPrev + importoPeriodo,
                ritenuta_garanzia: ritenuta,
                importo_netto: importoPeriodo - ritenuta,
                stato: 'emesso',
              }).eq('id', salSel.id)
              setSalList((p: any) => p.map((s: any) =>
                s.id === salSel.id ? { ...s, importo_certificato: importoPeriodo, stato: 'emesso' } : s
              ))
              showToast('✓ SAL salvato')
            }} style={{ padding: '4px 12px', background: 'rgba(52,211,153,.2)', border: '1px solid rgba(52,211,153,.3)', borderRadius: 6, color: '#34d399', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>💾 Salva SAL</button>}
            </div>
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
                  <col style={{ width: 30 }} /><col style={{ width: 80 }} /><col />
                  <col style={{ width: 40 }} /><col style={{ width: 40 }} /><col style={{ width: 40 }} /><col style={{ width: 40 }} />
                  <col style={{ width: 65 }} />
                  <col style={{ width: 65 }} /><col style={{ width: 65 }} />
                  {salList.filter((s: any) => s.id !== salSel?.id).map((s: any) => <col key={s.id} style={{ width: 60 }} />)}
                  <col style={{ width: 60 }} /><col style={{ width: 75 }} /><col style={{ width: 65 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>Nr</th>
                    <th rowSpan={2}>Tariffa</th>
                    <th rowSpan={2} className="thl">DESIGNAZIONE dei LAVORI / WBS</th>
                    <th colSpan={4}>DIMENSIONI</th>
                    <th rowSpan={2}>Quantità</th>
                    <th colSpan={2}>IMPORTI</th>
                    <th colSpan={salList.filter((s: any) => s.id !== salSel?.id).length + 3} style={{ background: '#1e3a5f', color: '#93c5fd' }}>SAL PERIODO</th>
                  </tr>
                  <tr>
                    {['par.ug.', 'lung.', 'larg.', 'H/peso'].map(t => <th key={t} className="th2">{t}</th>)}
                    {['unit.[1]', 'TOTALE'].map(t => <th key={t} className="th2">{t}</th>)}
                    {salList.filter((s: any) => s.id !== salSel?.id).map((s: any) => (
                      <th key={s.id} style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 9 }}>N.{s.numero}</th>
                    ))}
                    <th style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 9 }}>Cumul.</th>
                    <th style={{ background: '#166534', color: '#86efac', fontSize: 9, minWidth: 70 }}>{salSel ? `SAL ${salSel.numero}` : 'SAL'}</th>
                    <th style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 9 }}>Residuo</th>
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
                            {(() => {
                              const av = analisi.filter(a => a.codice_tariffa === v.codice)
                              const ex = analisiExtra.filter(e => e.voce_computo_id === v.id)
                              if (av.length === 0 && ex.length === 0) return (
                                <button className="cmp-analisi-add-btn" onClick={e => { e.stopPropagation(); setSel(v.id) }}>→ Analisi</button>
                              )
                              const totBase = av.reduce((s, a) => s + (a.importo_unitario || 0), 0)
                              const totExtra = ex.reduce((s, e) => s + (e.importo_unitario || 0), 0)
                              const tot = totBase + totExtra
                              const ok = Math.abs(tot - v.prezzo_unitario) < 0.01
                              return (
                                <span style={{ display: 'inline-flex', gap: 1, alignItems: 'center', marginLeft: 4, verticalAlign: 'middle' }}>
                                  {av.map(a => { const tc = TIPI_ANALISI.find(t => t.value === a.tipo); return <span key={a.id} className="cmp-analisi-dot" style={{ background: tc?.color || '#9ca3af' }} title={tc?.label} /> })}
                                  {ex.length > 0 && <span style={{ fontSize: 8, color: '#d97706', fontWeight: 700, marginLeft: 1 }}>+{ex.length}</span>}
                                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#374151', marginLeft: 2 }}>{fi(tot)}</span>
                                  <span style={{ fontSize: 8 }}>{ok ? '✅' : '⚠️'}</span>
                                </span>
                              )
                            })()}
                          </td>
                          <td /><td /><td /><td />
                          <td className="cmp-td-edit"
                            onClick={e => {
                              e.stopPropagation()
                              const now = Date.now()
                              const prev = dblClickRef.current
                              if (prev && prev.id === v.id && prev.field === 'quantita' && now - prev.t < 400) {
                                dblClickRef.current = null
                                setEditingCell({ voceId: v.id, field: 'quantita' })
                                setEditingVal(String(v.quantita))
                              } else {
                                dblClickRef.current = { id: v.id, field: 'quantita', t: now }
                              }
                            }}>
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
                            onClick={e => {
                              e.stopPropagation()
                              const now = Date.now()
                              const prev = dblClickRef.current
                              if (prev && prev.id === v.id && prev.field === 'prezzo_unitario' && now - prev.t < 400) {
                                dblClickRef.current = null
                                setEditingCell({ voceId: v.id, field: 'prezzo_unitario' })
                                setEditingVal(String(v.prezzo_unitario))
                              } else {
                                dblClickRef.current = { id: v.id, field: 'prezzo_unitario', t: now }
                              }
                            }}>
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
                          {salList.filter((s: any) => s.id !== salSel?.id).map((s: any) => (
                            <td key={s.id} style={{ textAlign: 'right', fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>{qtPerSal[s.id]?.[v.id] || '—'}</td>
                          ))}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 10 }}>{(qtCumul[v.id] || 0).toFixed(3)}</td>
                          <td style={{ padding: '2px 4px' }} onClick={e => e.stopPropagation()}>
                            {salSel ? (
                              <input type="number" step="0.001" min="0" value={qtInput[v.id] ?? ''} onChange={e => setQtInput(p => ({ ...p, [v.id]: parseFloat(e.target.value) || 0 }))}
                                style={{ width: '100%', border: '1px solid #3b82f6', borderRadius: 3, padding: '2px 4px', fontSize: 10, background: '#eff6ff', textAlign: 'right', outline: 'none' }} />
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: 10 }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 10, color: (v.quantita - (qtCumul[v.id] || 0) - (qtInput[v.id] || 0)) < 0 ? '#ef4444' : '#16a34a' }}>
                            {(v.quantita - (qtCumul[v.id] || 0) - (qtInput[v.id] || 0)).toFixed(3)}
                          </td>
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
                          <td /><td />{Array.from({ length: salList.filter((s: any) => s.id !== salSel?.id).length + 3 }).map((_, i) => <td key={i} />)}
                        </tr>
                      )
                    }

                    if (row.type === 'som') {
                      const v = row.v
                      const isSel = sel === v.id
                      return (
                        <React.Fragment key={`som_${v.id}`}>
                          <tr className="cmp-rsom">
                            <td colSpan={3} style={{ textAlign: 'right', paddingRight: 6, fontWeight: 700, fontSize: 10 }}>SOMMANO {v.um}</td>
                            <td colSpan={4} />
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{f3(v.quantita)}</td>
                            <td style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>{fi(v.prezzo_unitario)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{fi(v.importo)}</td>
                            <td /><td /><td /><td />
                          </tr>
                          {isSel && (
                            <tr key={v.id + '-sp'}><td colSpan={99} style={{ padding: '10px 16px', background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
                              {salSel ? (
                                <div style={{ display: 'flex', gap: 20, fontSize: 11, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span><b>Contratto:</b> {v.quantita} {v.um}</span>
                                  <span><b>Cumulativo:</b> {(qtCumul[v.id] || 0).toFixed(3)} {v.um}</span>
                                  <span style={{ color: '#1d4ed8' }}><b>SAL {salSel.numero}:</b>
                                    <input type="number" step="0.001" min="0" value={qtInput[v.id] ?? ''} onChange={e => setQtInput(p => ({ ...p, [v.id]: parseFloat(e.target.value) || 0 }))}
                                      style={{ marginLeft: 6, width: 80, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 6px', fontSize: 11, background: '#eff6ff', textAlign: 'right', outline: 'none' }} /> {v.um}
                                  </span>
                                  <span style={{ color: (v.quantita - (qtCumul[v.id] || 0) - (qtInput[v.id] || 0)) < 0 ? '#ef4444' : '#16a34a' }}>
                                    <b>Residuo:</b> {(v.quantita - (qtCumul[v.id] || 0) - (qtInput[v.id] || 0)).toFixed(3)} {v.um}
                                  </span>
                                  <span><b>Importo:</b> €{((qtInput[v.id] || 0) * v.prezzo_unitario).toFixed(2)}</span>
                                </div>
                              ) : (
                                <span style={{ color: '#6b7280', fontSize: 11 }}>← Seleziona un SAL dalla toolbar per inserire le quantità</span>
                              )}
                            </td></tr>
                          )}
                          {false && isSel && (() => {
                            const av = analisi.filter(a => a.codice_tariffa === v.codice)
                            const ex = analisiExtra.filter(e => e.voce_computo_id === v.id)
                            const costoBase = av.reduce((s, a) => s + (a.importo_unitario || 0), 0)
                            const costoExtra = ex.reduce((s, e) => s + (e.importo_unitario || 0), 0)
                            const costoPrevisto = costoBase + costoExtra
                            const margineUnitario = v.prezzo_unitario - costoPrevisto
                            const marginePerc = v.prezzo_unitario > 0 ? (margineUnitario / v.prezzo_unitario) * 100 : 0
                            const costoTotaleVoce = costoPrevisto * v.quantita
                            const ricavoVoce = v.importo
                            const margineVoce = ricavoVoce - costoTotaleVoce
                            const margColor = marginePerc >= 15 ? '#059669' : marginePerc >= 5 ? '#d97706' : marginePerc >= 0 ? '#dc2626' : '#991b1b'
                            const codiciConAnalisi = [...new Set(analisi.filter(a => a.codice_tariffa !== v.codice).map(a => a.codice_tariffa))]
                            const baseExp = baseExpanded[v.codice] || false
                            const extraExp = extraExpanded[v.id] || false
                            const tipiInBase = new Set(av.map(a => a.tipo))
                            const altreVoci = voci.filter(x => x.codice === v.codice && x.id !== v.id).length
                            return (
                              <tr>
                                <td colSpan={14} style={{ padding: 0 }}>
                                  <div className="cmp-analisi-panel" onClick={e => e.stopPropagation()}>

                                    {/* Header */}
                                    <div className="cmp-analisi-hdr">
                                      <span>ANALISI PREZZI — {v.codice}</span>
                                      <span style={{ fontWeight: 400, fontSize: 10, color: '#92400e', marginLeft: 4 }}>P.U. € {fi(v.prezzo_unitario)}/{v.um}</span>
                                      <span style={{ fontSize: 9, color: '#78350f', marginLeft: 4, fontWeight: 400 }}>· condivisa tra tutte le voci con codice {v.codice}</span>
                                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                        {codiciConAnalisi.length > 0 && (
                                          <>
                                            <span style={{ fontSize: 9, color: '#78350f' }}>📋 Copia da:</span>
                                            <select value={copiaSource} onChange={e => setCopiaSource(e.target.value)}
                                              style={{ fontSize: 9, border: '1px solid #fcd34d', borderRadius: 3, padding: '1px 4px', background: '#fffbeb' }}>
                                              <option value="">scegli tariffa...</option>
                                              {codiciConAnalisi.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            {copiaSource && (
                                              <button onClick={() => copiaAnalisi(copiaSource, v.codice)}
                                                style={{ fontSize: 9, padding: '1px 7px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
                                                Copia
                                              </button>
                                            )}
                                          </>
                                        )}
                                        <button onClick={() => { setSel(null); showToast('Analisi salvata') }}
                                          style={{ fontSize: 9, padding: '2px 8px', background: '#14532d', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700 }}>
                                          ✓ Fatto
                                        </button>
                                        <button onClick={() => setSel(null)}
                                          style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(0,0,0,.1)', color: '#78350f', border: '1px solid #fcd34d', borderRadius: 3, cursor: 'pointer' }}>
                                          ✕ Chiudi
                                        </button>
                                      </span>
                                    </div>

                                    {/* Banner propagazione automatica */}
                                    {altreVoci > 0 && (
                                      <div style={{ padding: '5px 14px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 10, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span>ℹ️</span>
                                        <span>La base di questa tariffa si applica automaticamente a <strong>{altreVoci}</strong> {altreVoci === 1 ? 'altra voce' : 'altre voci'} con codice <strong>{v.codice}</strong> in questa commessa</span>
                                      </div>
                                    )}

                                    {/* SEZIONE BASE */}
                                    <div style={{ borderBottom: '1px solid #fde68a' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: '#fffde7' }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: '#78350f', textTransform: 'uppercase' as const, letterSpacing: '.04em' }}>BASE — da tariffa {v.codice}</span>
                                        {costoBase > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#92400e', fontWeight: 700 }}>€ {fi(costoBase)}</span>}
                                        <button onClick={() => setBaseExpanded(prev => ({ ...prev, [v.codice]: !baseExp }))}
                                          style={{ fontSize: 9, padding: '1px 7px', background: baseExp ? '#fde68a' : '#fffbeb', border: '1px solid #fcd34d', borderRadius: 3, cursor: 'pointer', marginLeft: 'auto', color: '#78350f', fontWeight: 600 }}>
                                          {baseExp ? '▼ Nascondi' : '✏️ Modifica'}
                                        </button>
                                      </div>
                                      {!baseExp && av.length > 0 && (
                                        <div style={{ display: 'flex', gap: 8, padding: '5px 14px', flexWrap: 'wrap' as const }}>
                                          {av.map(a => {
                                            const tc = TIPI_ANALISI.find(t => t.value === a.tipo)
                                            return (
                                              <span key={a.id} style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#374151' }}>
                                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: tc?.color || '#9ca3af', flexShrink: 0 }} />
                                                <span style={{ color: tc?.color, fontWeight: 600 }}>{tc?.label}</span>
                                                <span style={{ fontFamily: 'monospace' }}>€ {fi(a.importo_unitario)}</span>
                                              </span>
                                            )
                                          })}
                                        </div>
                                      )}
                                      {!baseExp && av.length === 0 && (
                                        <div style={{ padding: '5px 14px', fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>Nessuna analisi base — clicca "Modifica"</div>
                                      )}
                                      {baseExp && (
                                        <>
                                          <table className="cmp-analisi-t">
                                            <thead>
                                              <tr>
                                                <th style={{ width: 130 }}>Componente</th>
                                                <th style={{ width: 90, textAlign: 'right' }}>€/um</th>
                                                <th style={{ width: 60, textAlign: 'right' }}>%</th>
                                                <th style={{ width: 36 }} />
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {av.map(a => {
                                                const tc = TIPI_ANALISI.find(t => t.value === a.tipo)
                                                const keyIu = a.id + '_iu'; const keyPct = a.id + '_pct'
                                                const iu = analisiEdit[keyIu] ?? String(a.importo_unitario)
                                                const pctV = analisiEdit[keyPct] ?? String(a.percentuale)
                                                return (
                                                  <tr key={a.id}>
                                                    <td>
                                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: tc?.color }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tc?.color || '#9ca3af', flexShrink: 0 }} />
                                                        {tc?.label || a.tipo}
                                                      </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                      <input className="cmp-analisi-inp" value={iu}
                                                        title={altreVoci > 0 ? `Aggiorna tutte le voci con codice ${v.codice}` : undefined}
                                                        onChange={e => setAnalisiEdit(prev => ({ ...prev, [keyIu]: e.target.value }))}
                                                        onBlur={() => aggiornaAnalisi(a, 'importo_unitario', iu, v.prezzo_unitario)}
                                                        onClick={e => e.stopPropagation()} />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                      <input className="cmp-analisi-inp" value={pctV}
                                                        title={altreVoci > 0 ? `Aggiorna tutte le voci con codice ${v.codice}` : undefined}
                                                        onChange={e => setAnalisiEdit(prev => ({ ...prev, [keyPct]: e.target.value }))}
                                                        onBlur={() => aggiornaAnalisi(a, 'percentuale', pctV, v.prezzo_unitario)}
                                                        onClick={e => e.stopPropagation()} />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                      <button onClick={() => eliminaAnalisi(a.id)} style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>🗑</button>
                                                    </td>
                                                  </tr>
                                                )
                                              })}
                                            </tbody>
                                          </table>
                                          <div style={{ padding: '5px 14px', display: 'flex', gap: 5, flexWrap: 'wrap' as const, borderTop: av.length > 0 ? '1px solid #fde68a' : 'none' }}>
                                            {TIPI_ANALISI.filter(t => !tipiInBase.has(t.value)).map(t => (
                                              <button key={t.value} onClick={() => aggiungiAnalisi(v.codice, t.value)}
                                                style={{ fontSize: 9, padding: '2px 7px', background: t.color + '18', color: t.color, border: '1px solid ' + t.color + '40', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                                + {t.label}
                                              </button>
                                            ))}
                                            {tipiInBase.size === TIPI_ANALISI.length && <span style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic' }}>Tutti i componenti presenti</span>}
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* SEZIONE EXTRA */}
                                    <div style={{ borderBottom: '1px solid #fde68a' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: '#f0fdf4' }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: '#065f46', textTransform: 'uppercase' as const, letterSpacing: '.04em' }}>EXTRA — specifico per questa voce</span>
                                        {costoExtra > 0 && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>€ {fi(costoExtra)}</span>}
                                        <button onClick={() => setExtraExpanded(prev => ({ ...prev, [v.id]: !extraExp }))}
                                          style={{ fontSize: 9, padding: '1px 7px', background: extraExp ? '#d1fae5' : '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 3, cursor: 'pointer', marginLeft: 'auto', color: '#065f46', fontWeight: 600 }}>
                                          {extraExp ? '▼ Nascondi' : '✏️ Modifica'}
                                        </button>
                                      </div>
                                      {!extraExp && ex.length > 0 && (
                                        <div style={{ display: 'flex', gap: 8, padding: '5px 14px', flexWrap: 'wrap' as const }}>
                                          {ex.map(e => {
                                            const tc = TIPI_ANALISI.find(t => t.value === e.tipo)
                                            return (
                                              <span key={e.id} style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#374151' }}>
                                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: tc?.color || '#9ca3af', flexShrink: 0 }} />
                                                <span style={{ color: tc?.color, fontWeight: 600 }}>{tc?.label}</span>
                                                <span style={{ fontFamily: 'monospace' }}>€ {fi(e.importo_unitario)}</span>
                                              </span>
                                            )
                                          })}
                                        </div>
                                      )}
                                      {!extraExp && ex.length === 0 && (
                                        <div style={{ padding: '5px 14px', fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>Nessuna maggiorazione extra — clicca "Modifica"</div>
                                      )}
                                      {extraExp && (
                                        <>
                                          {ex.length > 0 && (
                                            <table className="cmp-analisi-t">
                                              <thead>
                                                <tr>
                                                  <th style={{ width: 130 }}>Tipo</th>
                                                  <th>Descrizione</th>
                                                  <th style={{ width: 90, textAlign: 'right' }}>€/um</th>
                                                  <th style={{ width: 36 }} />
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {ex.map(e => {
                                                  const tc = TIPI_ANALISI.find(t => t.value === e.tipo)
                                                  const keyIu = 'ex_' + e.id
                                                  const iu = analisiExtraEdit[keyIu] ?? String(e.importo_unitario)
                                                  return (
                                                    <tr key={e.id} style={{ background: '#f0fdf4' }}>
                                                      <td>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: tc?.color }}>
                                                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tc?.color || '#9ca3af', flexShrink: 0 }} />
                                                          {tc?.label || e.tipo}
                                                        </span>
                                                      </td>
                                                      <td style={{ fontSize: 10, fontStyle: e.descrizione ? 'normal' : 'italic', color: e.descrizione ? '#374151' : '#9ca3af' }}>
                                                        {e.descrizione || 'nessuna descrizione'}
                                                      </td>
                                                      <td style={{ textAlign: 'right' }}>
                                                        <input className="cmp-analisi-inp" style={{ background: '#f0fdf4' }} value={iu}
                                                          onChange={ev => setAnalisiExtraEdit(prev => ({ ...prev, [keyIu]: ev.target.value }))}
                                                          onBlur={() => aggiornaExtra(e, iu)}
                                                          onClick={ev => ev.stopPropagation()} />
                                                      </td>
                                                      <td style={{ textAlign: 'center' }}>
                                                        <button onClick={() => eliminaExtra(e.id)} style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>🗑</button>
                                                      </td>
                                                    </tr>
                                                  )
                                                })}
                                              </tbody>
                                            </table>
                                          )}
                                          {ex.length === 0 && <div style={{ padding: '5px 14px', fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>Nessuna maggiorazione extra — aggiungi con i bottoni sotto</div>}
                                          <div style={{ padding: '5px 14px', display: 'flex', gap: 5, flexWrap: 'wrap' as const, borderTop: ex.length > 0 ? '1px solid #6ee7b7' : 'none' }}>
                                            {TIPI_ANALISI.map(t => (
                                              <button key={t.value} onClick={() => aggiungiExtra(v.id, t.value)}
                                                style={{ fontSize: 9, padding: '2px 7px', background: '#f0fdf4', color: t.color, border: '1px solid #6ee7b7', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                                + {t.label}
                                              </button>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* QUADRO ECONOMICO */}
                                    <div style={{ padding: '8px 14px', background: '#f8fafc' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                        <div>
                                          <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '.04em', marginBottom: 6 }}>Per unità ({v.um})</div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                                            <span style={{ color: '#6b7280' }}>Costo previsto</span>
                                            <span style={{ fontFamily: 'monospace', color: '#374151', fontWeight: 600 }}>€ {fi(costoPrevisto)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                                            <span style={{ color: '#6b7280' }}>P.U. contratto</span>
                                            <span style={{ fontFamily: 'monospace', color: '#374151' }}>€ {fi(v.prezzo_unitario)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 5, paddingTop: 5, borderTop: '1px solid #e5e7eb' }}>
                                            <span style={{ fontWeight: 700, color: margColor }}>Margine</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: margColor }}>€ {fi(margineUnitario)} ({marginePerc.toFixed(1)}%)</span>
                                          </div>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '.04em', marginBottom: 6 }}>Per {f3(v.quantita)} {v.um}</div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                                            <span style={{ color: '#6b7280' }}>Costo totale</span>
                                            <span style={{ fontFamily: 'monospace', color: '#374151', fontWeight: 600 }}>€ {fi(costoTotaleVoce)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                                            <span style={{ color: '#6b7280' }}>Ricavo</span>
                                            <span style={{ fontFamily: 'monospace', color: '#374151' }}>€ {fi(ricavoVoce)}</span>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 5, paddingTop: 5, borderTop: '1px solid #e5e7eb' }}>
                                            <span style={{ fontWeight: 700, color: margColor }}>Margine atteso</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: margColor }}>€ {fi(margineVoce)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                  </div>
                                </td>
                              </tr>
                            )
                          })()}
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

        {/* RDA INTELLIGENTE MODAL */}
        {rdaModal && (
          <div className="cmp-rda-modal-overlay" onClick={() => setRdaModal(null)}>
            <div className="cmp-rda-modal" onClick={e => e.stopPropagation()}>
              <div className="cmp-rda-modal-hdr">
                ⚡ Riepilogo RDA da generare
                <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 8, color: '#93c5fd' }}>da analisi prezzi</span>
              </div>
              <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
                {rdaModal.senzaAnalisi.length > 0 && (
                  <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#92400e', marginBottom: 12 }}>
                    ⚠ {rdaModal.senzaAnalisi.length} voci senza analisi prezzi — verranno raggruppate per WBS senza spacchettamento
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={rdaModal.generaFallback} onChange={e => setRdaModal(prev => prev ? { ...prev, generaFallback: e.target.checked } : null)} />
                      <span>Genera comunque RDA senza spacchettamento</span>
                    </label>
                  </div>
                )}
                <table className="cmp-rda-modal-t" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>WBS</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Importo stimato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdaModal.rows.map((r, i) => (
                      <tr key={i} style={{ background: r.selected ? 'transparent' : '#f9fafb' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={r.selected}
                            onChange={e => setRdaModal(prev => prev ? { ...prev, rows: prev.rows.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x) } : null)} />
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>{r.wbs_id}</span>
                          <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>{WBS_MAP[r.wbs_id]}</span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: r.color }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                            {r.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>€ {fi(r.importoStimato)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setRdaModal(null)}
                  style={{ flex: 1, padding: '8px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                  Annulla
                </button>
                <button onClick={generaRDADaModal}
                  style={{ flex: 2, padding: '8px', fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                  ⚡ Genera RDA selezionate ({rdaModal.rows.filter(r => r.selected).length})
                </button>
              </div>
            </div>
          </div>
        )}

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
