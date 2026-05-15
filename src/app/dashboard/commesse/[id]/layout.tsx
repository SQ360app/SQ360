'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Trash2 } from 'lucide-react'

interface Commessa {
  id: string; codice: string; nome: string
  stato: string; importo_contratto: number; committente: string
}

const TABS = [
  { key: 'anagrafica',    label: 'Anagrafica',      path: '/anagrafica' },
  { key: 'documenti',     label: 'Documenti',        path: '/documenti' },
  { key: 'computo',       label: 'Computo',          path: '/computo' },
  { key: 'rda',           label: 'RDA',              path: '/rda' },
  { key: 'rdo',           label: 'RDO',              path: '/rdo' },
  { key: 'oda',           label: 'ODA',              path: '/oda' },
  { key: 'contratti',     label: 'Contratti Sub',    path: '/contratti' },
  { key: 'dam',           label: 'DAM',              path: '/dam' },
  { key: 'ddt',           label: 'DDT',              path: '/ddt' },
  { key: 'cantiere',      label: 'Cantiere',         path: '/cantiere' },
  { key: 'sicurezza',     label: 'Sicurezza',        path: '/sicurezza' },
  { key: 'persone',       label: 'Persone',          path: '/persone' },
  { key: 'spese',         label: 'Spese',            path: '/spese' },
  { key: 'sal-attivi',    label: 'SAL Attivi',       path: '/sal-attivi' },
  { key: 'sal-passivi',   label: 'SAL Passivi',      path: '/sal-passivi' },
  { key: 'marginalita',   label: 'Marginalità',      path: '/marginalita' },
  { key: 'fatturazione',  label: 'Fatturazione',     path: '/fatturazione' },
  { key: 'fatture',       label: 'Fatt. passive',    path: '/fatture' },
  { key: 'conto-economico', label: 'CE',             path: '/conto-economico' },
  { key: 'archivio',        label: 'Archivio',       path: '/archivio' },
]

const STATI_COLOR: Record<string, string> = {
  AGGIUDICATA: '#d97706', IN_ESECUZIONE: '#059669', SOSPESA: '#dc2626',
  ULTIMATA: '#7c3aed', IN_COLLAUDO: '#2563eb', CHIUSA: '#6b7280', RESCISSA: '#dc2626',
}

export default function CommessaLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const pathname = usePathname()
  const [commessa, setCommessa] = useState<Commessa | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.from('commesse')
      .select('id,codice,nome,stato,importo_contratto,committente')
      .eq('id', id).single()
      .then(({ data }) => setCommessa(data))
  }, [id])

  async function handleDelete() {
    setDeleting(true)
        const { error: delErr } = await supabase.from('commesse').delete().eq('id', id)
        if (delErr) { setDeleting(false); return }
    router.push('/dashboard/commesse')
  }

  const base = '/dashboard/commesse/' + id
  const currentTab = TABS.find(t => {
    if (t.path === '') return pathname === base
    return pathname.startsWith(base + t.path)
  })?.key || 'anagrafica'

  const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })
  const statoColor = commessa ? (STATI_COLOR[commessa.stato] || '#6b7280') : '#6b7280'

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 20px', position: 'sticky', top: 52, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button onClick={() => router.push('/dashboard/commesse')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            <ArrowLeft size={14} /> Commesse
          </button>
          <span style={{ color: '#d1d5db' }}>/</span>
          {commessa && (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, color: '#6b7280' }}>
                {commessa.codice}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', flex: 1 }}>
                {commessa.nome}
              </span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 500,
                background: statoColor + '20', color: statoColor }}>
                {commessa.stato?.replace('_', ' ')}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>
                EUR {fmt(commessa.importo_contratto || 0)}
              </span>
              {/* BOTTONE DELETE */}
              <button onClick={() => setShowDeleteConfirm(true)}
                title="Elimina commessa"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', border: '1px solid #fca5a5', borderRadius: 8, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>
                <Trash2 size={13} /> Elimina
              </button>
            </>
          )}
        </div>

        {/* TAB BAR — senza Assegnazione */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const active = tab.key === currentTab
            return (
              <button key={tab.key}
                onClick={() => router.push(base + tab.path)}
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: active ? 600 : 400,
                  border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'transparent', color: active ? '#2563eb' : '#6b7280',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenuto tab */}
      <div style={{ padding: '20px 20px' }}>
        {children}
      </div>

      {/* Modal conferma eliminazione */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={18} style={{ color: '#dc2626' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Elimina commessa</h3>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Operazione irreversibile</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 16px', lineHeight: 1.5 }}>
              Stai per eliminare <strong>{commessa?.nome}</strong> ({commessa?.codice}).
              Tutti i dati collegati (computo, RDA, RDO, ODA, SAL) verranno eliminati definitivamente. Il database Contatti (fornitori, professionisti) NON viene eliminato.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Annulla
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                {deleting ? 'Eliminando...' : 'Sì, elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
