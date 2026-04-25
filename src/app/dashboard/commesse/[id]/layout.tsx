'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

interface Commessa {
  id: string; codice: string; nome: string; committente_nome: string
  stato: string; importo_contratto: number; dl_nome: string; rup_nome: string; cig: string
}

const TABS = [
  { key: 'anagrafica',      label: 'Anagrafica',     path: '' },
  { key: 'documenti',       label: 'Documenti',      path: '/documenti' },
  { key: 'computo',         label: 'Computo',        path: '/computo' },
  { key: 'assegnazione',    label: 'Assegnazione',   path: '/assegnazione' },
  { key: 'rda',             label: 'RDA',            path: '/rda' },
  { key: 'rdo',             label: 'RDO',            path: '/rdo' },
  { key: 'oda',             label: 'ODA',            path: '/oda' },
  { key: 'contratti',       label: 'Contratti Sub',  path: '/contratti' },
  { key: 'dam',             label: 'DAM',            path: '/dam' },
  { key: 'cantiere',        label: 'Cantiere',       path: '/cantiere' },
  { key: 'spese',           label: 'Spese',          path: '/spese' },
  { key: 'sal-attivi',      label: 'SAL Attivi',     path: '/sal-attivi' },
  { key: 'sal-passivi',     label: 'SAL Passivi',    path: '/sal-passivi' },
  { key: 'marginalita',     label: 'Marginalita',    path: '/marginalita' },
  { key: 'fatturazione',    label: 'Fatturazione',   path: '/fatturazione' },
  { key: 'conto-economico', label: 'CE',             path: '/conto-economico' },
]

const STATO_COLOR: Record<string,string> = {
  IN_ESECUZIONE:'#10b981', AGGIUDICATA:'#3b82f6', COLLAUDO:'#8b5cf6',
  SOSPESA:'#ef4444', CHIUSA:'#374151', ACQUISITA:'#6b7280'
}

export default function CommessaLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const pathname = usePathname()
  const [commessa, setCommessa] = useState<Commessa | null>(null)

  useEffect(() => {
    if (id) {
      supabase.from('commesse').select('*').eq('id', id).single()
        .then(({ data }) => setCommessa(data))
    }
  }, [id])

  const base = `/dashboard/commesse/${id}`
  const activeKey = TABS.slice().reverse().find(t =>
    pathname === base + t.path || pathname.startsWith(base + t.path + '/')
  )?.key ?? 'anagrafica'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/dashboard/commesse')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
          <ArrowLeft size={14} /> Commesse
        </button>
        {commessa && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{commessa.nome}</span>
            {commessa.committente_nome && (
              <span style={{ fontSize: 13, color: '#6b7280' }}>{commessa.committente_nome}</span>
            )}
            <span style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: (STATO_COLOR[commessa.stato] || '#6b7280') + '20',
              color: STATO_COLOR[commessa.stato] || '#6b7280'
            }}>
              {commessa.stato?.replace('_', ' ')}
            </span>
            {commessa.importo_contratto > 0 && (
              <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 14, color: '#111827' }}>
                {'€'} {(commessa.importo_contratto || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', padding: '0 16px', gap: 2, flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => router.push(base + tab.path)}
            style={{
              padding: '10px 14px',
              border: 'none',
              borderBottom: activeKey === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeKey === tab.key ? 600 : 400,
              color: activeKey === tab.key ? '#2563eb' : '#6b7280',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
