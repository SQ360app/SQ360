'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Trash2 } from 'lucide-react'

interface Commessa {
  id: string; codice: string; nome: string
  stato: string; importo_contratto: number; committente: string
}

const GRUPPI = [
  {
    id: 'contratto', label: 'Contratto', ico: '📋',
    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
    tabs: [
      { href: 'anagrafica',    label: 'Anagrafica' },
      { href: 'documenti',     label: 'Documenti' },
      { href: 'elenco-prezzi', label: 'Elenco Prezzi' },
      { href: 'computo',       label: 'Computo' },
      { href: 'sal-attivi',    label: 'SAL Attivi' },
      { href: 'sal-passivi',   label: 'SAL Passivi' },
    ],
  },
  {
    id: 'acquisti', label: 'Acquisti', ico: '🛒',
    color: '#c2410c', bg: '#fff7ed', border: '#fed7aa',
    tabs: [
      { href: 'rda', label: 'RDA' },
      { href: 'rdo', label: 'RDO' },
      { href: 'dam', label: 'DAM' },
      { href: 'oda', label: 'ODA' },
    ],
  },
  {
    id: 'cantiere', label: 'Cantiere', ico: '🏗️',
    color: '#065f46', bg: '#f0fdf4', border: '#bbf7d0',
    tabs: [
      { href: 'cantiere',  label: 'Giornale' },
      { href: 'sicurezza', label: 'Sicurezza' },
      { href: 'persone',   label: 'Persone' },
      { href: 'ddt',       label: 'DDT' },
      { href: 'spese',     label: 'Spese' },
    ],
  },
  {
    id: 'economico', label: 'Economico', ico: '💰',
    color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe',
    tabs: [
      { href: 'fatturazione',   label: 'Fatturazione' },
      { href: 'fatture',        label: 'Fatt. passive' },
      { href: 'conto-economico',label: 'CE' },
      { href: 'marginalita',    label: 'Marginalità' },
    ],
  },
  {
    id: 'contrattuale', label: 'Contrattuale', ico: '⚖️',
    color: '#991b1b', bg: '#fef2f2', border: '#fecaca',
    tabs: [
      { href: 'contratti',      label: 'Contratti Sub' },
      { href: 'varianti',       label: 'Varianti' },
      { href: 'ordini-servizio',label: 'Ordini Servizio' },
      { href: 'migliorie',      label: 'Migliorie' },
    ],
  },
  {
    id: 'archivio', label: 'Archivio', ico: '📁',
    color: '#374151', bg: '#f9fafb', border: '#e5e7eb',
    tabs: [
      { href: 'archivio', label: 'Archivio' },
    ],
  },
]

const STATI_COLOR: Record<string, string> = {
  AGGIUDICATA: '#d97706', IN_ESECUZIONE: '#059669', SOSPESA: '#dc2626',
  ULTIMATA: '#7c3aed', IN_COLLAUDO: '#2563eb', CHIUSA: '#6b7280', RESCISSA: '#dc2626',
}

export default function CommessaLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router   = useRouter()
  const pathname = usePathname()
  const [commessa,           setCommessa]           = useState<Commessa | null>(null)
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false)
  const [deleting,           setDeleting]           = useState(false)

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

  // Detect active group and active tab from pathname
  const activeGruppo = GRUPPI.find(g =>
    g.tabs.some(t => pathname.startsWith(base + '/' + t.href))
  ) || GRUPPI[0]

  const activeTabHref = activeGruppo.tabs.find(t =>
    pathname.startsWith(base + '/' + t.href)
  )?.href || activeGruppo.tabs[0].href

  const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })
  const statoColor = commessa ? (STATI_COLOR[commessa.stato] || '#6b7280') : '#6b7280'

  return (
    <div style={{ minHeight: 0, background: '#f9fafb' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 40 }}>

        {/* Riga breadcrumb + commessa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <button onClick={() => router.push('/dashboard/commesse')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', flexShrink: 0 }}>
            <ArrowLeft size={14} /> Commesse
          </button>
          <span style={{ color: '#d1d5db' }}>/</span>
          {commessa ? (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, color: '#6b7280', flexShrink: 0 }}>
                {commessa.codice}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {commessa.nome}
              </span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: statoColor + '20', color: statoColor, flexShrink: 0 }}>
                {commessa.stato?.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', flexShrink: 0 }}>
                EUR {fmt(commessa.importo_contratto || 0)}
              </span>
              <button onClick={() => setShowDeleteConfirm(true)} title="Elimina commessa"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>
                <Trash2 size={13} /> Elimina
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Caricamento...</span>
          )}
        </div>

        {/* RIGA 1 — Gruppi pill */}
        <div style={{ display: 'flex', gap: 4, padding: '5px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {GRUPPI.map(g => {
            const isActive = g.id === activeGruppo.id
            return (
              <button key={g.id}
                onClick={() => {
                  if (!isActive) router.push(base + '/' + g.tabs[0].href)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 20, flexShrink: 0,
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  border: `1px solid ${isActive ? g.border : '#e5e7eb'}`,
                  background: isActive ? g.bg : '#fff',
                  color: isActive ? g.color : '#6b7280',
                  cursor: isActive ? 'default' : 'pointer',
                  transition: 'all .15s',
                }}>
                <span style={{ fontSize: 14 }}>{g.ico}</span>
                {g.label}
              </button>
            )
          })}
        </div>

        {/* RIGA 2 — Sotto-tab del gruppo attivo */}
        <div style={{ display: 'flex', gap: 0, padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none', borderTop: `2px solid ${activeGruppo.bg}` }}>
          {activeGruppo.tabs.map(t => {
            const isActive = t.href === activeTabHref
            return (
              <button key={t.href}
                onClick={() => router.push(base + '/' + t.href)}
                style={{
                  padding: '6px 14px', fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  border: 'none', flexShrink: 0,
                  borderBottom: isActive ? `2px solid ${activeGruppo.color}` : '2px solid transparent',
                  background: 'transparent',
                  color: isActive ? activeGruppo.color : '#6b7280',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                {t.label}
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
              Tutti i dati collegati (computo, RDA, RDO, ODA, SAL) verranno eliminati definitivamente.
              Il database Contatti (fornitori, professionisti) NON viene eliminato.
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
