'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, ChevronRight, MoreHorizontal,
  FileText, BarChart2, Calendar, HardHat,
  TrendingUp, Receipt, Package, FileSignature,
  Clipboard, Upload, AlertTriangle
} from 'lucide-react'

// ─── Tipi ─────────────────────────────────────────────────
interface Commessa {
  id: string
  codice: string
  nome: string
  committente: string
  stato: string
  importo_aggiudicato: number
  data_fine_contrattuale: string
  avanzamento_pct: number
  dl_nome: string
  rup_nome: string
  cig: string
  n_sal_attivi?: number
  importo_incassato?: number
}

// ─── Tab della commessa ────────────────────────────────────
const TABS = [
  { key: 'anagrafica',   label: 'Anagrafica',     icon: Clipboard,     path: '' },
  { key: 'documenti',    label: 'Documenti & AI',  icon: Upload,        path: '/documenti' },
  { key: 'computo',      label: 'Computo',         icon: FileText,      path: '/computo' },
  { key: 'preventivo',   label: 'M2 Preventivo',   icon: BarChart2,     path: '/preventivo' },
  { key: 'gantt',        label: 'M3 Gantt',        icon: Calendar,      path: '/gantt' },
  { key: 'cantiere',     label: 'M4 Cantiere',     icon: HardHat,       path: '/cantiere' },
  { key: 'sal-attivi',   label: 'M5A SAL Attivi',  icon: TrendingUp,    path: '/sal-attivi' },
  { key: 'sal-passivi',  label: 'M5B SAL Passivi', icon: Package,       path: '/sal-passivi' },
  { key: 'dam',          label: 'DAM',             icon: Package,       path: '/dam' },
  { key: 'contratti',    label: 'Contratti Sub',   icon: FileSignature, path: '/contratti' },
  { key: 'marginalita',  label: 'M5C Marginalità', icon: BarChart2,     path: '/marginalita' },
  { key: 'fatturazione', label: 'M6 Fatturazione', icon: Receipt,       path: '/fatturazione' },
]

const STATO_COLOR: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6', COLLAUDO: '#8b5cf6',
  SOSPESA: '#ef4444', CHIUSA: '#374151', ACQUISITA: '#6b7280'
}

function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export default function CommessaLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const pathname = usePathname()
  const [commessa, setCommessa] = useState<Commessa | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) carica()
  }, [id])

  async function carica() {
    const { data } = await supabase
      .from('v_commesse_kpi')
      .select('*')
      .eq('id', id)
      .single()
    if (data) setCommessa(data)
    setLoading(false)
  }

  // Determina tab attiva dal pathname
  const baseUrl = `/dashboard/commesse/${id}`
  const subPath = pathname.replace(baseUrl, '') || ''
  const tabAttiva = TABS.find(t => t.path && subPath.startsWith(t.path)) || TABS[0]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div className="spinner" style={{ width: 24, height: 24 }} />
      <div style={{ fontSize: 13, color: 'var(--t3)' }}>Caricamento commessa...</div>
    </div>
  )

  if (!commessa) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 16 }}>Commessa non trovata</div>
      <button onClick={() => router.push('/dashboard/commesse')} className="btn-secondary">← Torna alle commesse</button>
    </div>
  )

  const statoColor = STATO_COLOR[commessa.stato] || '#6b7280'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Header commessa ──────────────────────────────── */}
      <div style={{
        background: 'var(--panel)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 60, flexShrink: 0,
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Breadcrumb + info commessa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard/commesse')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--t3)', fontSize: 12, cursor: 'pointer', flexShrink: 0
          }}>
            <ArrowLeft size={13} /> Commesse
          </button>
          <ChevronRight size={14} color="var(--t4)" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{commessa.codice}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: statoColor,
                background: `${statoColor}15`, border: `1px solid ${statoColor}30`,
                borderRadius: 5, padding: '2px 8px'
              }}>{commessa.stato.replace('_',' ')}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{commessa.nome}</div>
          </div>
        </div>

        {/* Dati rapidi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Importo</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(commessa.importo_aggiudicato)}</div>
          </div>
          {commessa.data_fine_contrattuale && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fine lavori</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{commessa.data_fine_contrattuale}</div>
            </div>
          )}
          {/* Barra avanzamento */}
          <div style={{ width: 100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>Avanz.</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: statoColor }}>{commessa.avanzamento_pct || 0}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${commessa.avanzamento_pct || 0}%`, background: statoColor }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────── */}
      <div className="tab-bar" style={{ flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab-item ${tabAttiva.key === tab.key ? 'active' : ''}`}
            onClick={() => router.push(`${baseUrl}${tab.path}`)}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Contenuto tab ────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
