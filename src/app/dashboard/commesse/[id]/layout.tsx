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
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <h1 style={{fontSize:18,fontWeight:600,margin:0}}>{commessa?.nome ?? '...'}</h1>
            <div style={{fontSize:12,color:'#6b7280',marginTop:4}}>
              {commessa?.cig && <span style={{marginRight:12}}>CIG: {commessa.cig}</span>}
              {commessa?.dl_nome && <span>DL: {commessa.dl_nome}</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            {(commessa?.importo_contratto ?? 0) > 0 &&
              <span style={{fontSize:16,fontWeight:600}}>€ {fmt(commessa!.importo_contratto)}</span>}
            {commessa?.stato &&
              <span style={{fontSize:11,padding:'2px 8px',borderRadius:12,
                background:(STATO_COLOR[commessa.stato]||'#6b7280')+'20',
                color:STATO_COLOR[commessa.stato]||'#6b7280',fontWeight:600}}>
                {commessa.stato}
              </span>}
          </div>
        </div>
      </div>
      <div style={{borderBottom:'1px solid #e5e7eb',overflowX:'auto'}}>
        <div style={{display:'flex',padding:'0 16px',minWidth:'max-content'}}>
          {TABS.map(tab => {
            const isActive = activeKey === tab.key
            return (
              <button key={tab.key} onClick={() => router.push(base + tab.path)}
                style={{padding:'10px 14px',fontSize:12,fontWeight:isActive?600:400,
                  color:isActive?'#3b82f6':'#6b7280',background:'none',border:'none',
                  cursor:'pointer',whiteSpace:'nowrap',
                  borderBottom:isActive?'2px solid #3b82f6':'2px solid transparent'}}>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  )
}
