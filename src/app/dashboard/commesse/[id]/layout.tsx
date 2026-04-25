'use client'


import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Clipboard, Upload, FileText, BarChart2,
  HardHat, TrendingUp, Package, FilePlus,
  FileSignature, Receipt, ShoppingCart, Truck, Wrench, ChevronRight
} from 'lucide-react'


interface Commessa {
  id: string; codice: string; nome: string; committente_nome: string
  stato: string; importo_contratto: number; dl_nome: string; rup_nome: string; cig: string
}


const TABS = [
  { key: 'anagrafica',   label: 'Anagrafica',     path: '' },
  { key: 'documenti',    label: 'Documenti & AI', path: '/documenti' },
  { key: 'computo',      label: 'Computo',         path: '/computo' },
  { key: 'assegnazione', label: 'Assegnazione',    path: '/assegnazione' },
  { key: 'rda',          label: 'RDA',             path: '/rda' },
  { key: 'rdo',          label: 'RDO',             path: '/rdo' },
  { key: 'oda',          label: 'ODA',             path: '/oda' },
  { key: 'contratti',    label: 'Contratti Sub',   path: '/contratti' },
  { key: 'dam',          label: 'DAM',             path: '/dam' },
  { key: 'cantiere',     label: 'Cantiere',        path: '/cantiere' },
  { key: 'spese',        label: 'Spese',           path: '/spese' },
  { key: 'sal-attivi',   label: 'SAL Attivi',      path: '/sal-attivi' },
  { key: 'sal-passivi',  label: 'SAL Passivi',     path: '/sal-passivi' },
  { key: 'marginalita',  label: 'Marginalita',     path: '/marginalita' },
  { key: 'fatturazione', label: 'Fatturazione',    path: '/fatturazione' },
  { key: 'conto-economico', label: 'CE', path: '/conto-economico' },
]


const STATO_COLOR: Record<string,string> = {
  IN_ESECUZIONE:'#10b981',AGGIUDICATA:'#3b82f6',COLLAUDO:'#8b5cf6',
  SOSPESA:'#ef4444',CHIUSA:'#374151',ACQUISITA:'#6b7280'
}


const fmt = (n: number) => (n||0).toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:0})


export default function CommessaLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const pathname = usePathname()
  const [commessa, setCommessa] = useState<Commessa | null>(null)


  useEffect(() => {
    if (id) supabase.from('commesse').select('*').eq('id',id).single()
      .then(({ data }) => setCommessa(data))
  }, [id])


  const base = `/dashboard/commesse/${id}`
  const activeKey = TABS.slice().reverse().find(t =>
    pathname === base + t.path || pathname.startsWith(base + t.path + '/')
  )?.key ?? 'anagrafica'


  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh'}}>
      <div style={{padding:'12px 24px',borderBottom:'1px solid #e5e7eb'}}>
        <button onClick={() => router.push('/dashboard/commesse')}
          style={{display:'flex',alignItems:'center',gap:4,fontSize:13,background:'none',border:'none',cursor:'pointer',marginBottom:8}}>
          <ArrowLeft size={14}/> Commesse
        </button>
