'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Trash2, ChevronRight, ChevronLeft, Search, X } from 'lucide-react'

interface Commessa {
  id: string; codice: string; nome: string
  stato: string; importo_contratto: number; committente: string
}

const TABS = [
  { key: 'anagrafica',      label: 'Anagrafica',      path: '/anagrafica',      icon: '🏢' },
  { key: 'documenti',       label: 'Documenti',        path: '/documenti',       icon: '📄' },
  { key: 'contratti',       label: 'Contratti Sub',    path: '/contratti',       icon: '📝' },
  { key: 'computo',         label: 'Computo',          path: '/computo',         icon: '🔢' },
  { key: 'rda',             label: 'RDA',              path: '/rda',             icon: '📋' },
  { key: 'rdo',             label: 'RDO',              path: '/rdo',             icon: '📊' },
  { key: 'oda',             label: 'ODA',              path: '/oda',             icon: '📦' },
  { key: 'dam',             label: 'DAM',              path: '/dam',             icon: '💰' },
  { key: 'ddt',             label: 'DDT',              path: '/ddt',             icon: '🚚' },
  { key: 'cantiere',        label: 'Cantiere',         path: '/cantiere',        icon: '🏗️' },
  { key: 'persone',         label: 'Persone',          path: '/persone',         icon: '👷' },
  { key: 'sicurezza',       label: 'Sicurezza',        path: '/sicurezza',       icon: '🛡️' },
  { key: 'spese',           label: 'Spese',            path: '/spese',           icon: '💳' },
  { key: 'sal-attivi',      label: 'SAL Attivi',       path: '/sal-attivi',      icon: '📈' },
  { key: 'sal-passivi',     label: 'SAL Passivi',      path: '/sal-passivi',     icon: '📉' },
  { key: 'fatturazione',    label: 'Fatturazione',     path: '/fatturazione',    icon: '🧾' },
  { key: 'fatture',         label: 'Fatt. passive',    path: '/fatture',         icon: '📥' },
  { key: 'conto-economico', label: 'CE',               path: '/conto-economico', icon: '⚖️' },
  { key: 'marginalita',     label: 'Marginalità',      path: '/marginalita',     icon: '📊' },
  { key: 'archivio',        label: 'Archivio',         path: '/archivio',        icon: '📁' },
]

const GROUPS = [
  { label: 'CONTRATTO', keys: ['anagrafica', 'documenti', 'contratti'] },
  { label: 'ACQUISTI',  keys: ['computo', 'rda', 'rdo', 'oda', 'dam', 'ddt'] },
  { label: 'CANTIERE',  keys: ['cantiere', 'persone', 'sicurezza'] },
  { label: 'ECONOMICO', keys: ['spese', 'sal-attivi', 'sal-passivi', 'fatturazione', 'fatture', 'conto-economico', 'marginalita', 'archivio'] },
]

const STATI_COLOR: Record<string, string> = {
  AGGIUDICATA: '#d97706', IN_ESECUZIONE: '#059669', SOSPESA: '#dc2626',
  ULTIMATA: '#7c3aed', IN_COLLAUDO: '#2563eb', CHIUSA: '#6b7280', RESCISSA: '#dc2626',
}

const C = {
  bg:     '#07090f',
  panel:  '#0c1020',
  strip:  '#0a0d18',
  accent: '#4f8ef7',
  t1:     'rgba(255,255,255,.85)',
  t2:     'rgba(255,255,255,.45)',
  t3:     'rgba(255,255,255,.25)',
  border: 'rgba(255,255,255,.06)',
}

const fmtM = (n: number) =>
  n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `€${(n / 1_000).toFixed(0)}K`
  : `€${Math.round(n).toLocaleString('it-IT')}`

const MOBILE_TABS = ['anagrafica', 'oda', 'cantiere', 'sicurezza', 'conto-economico']

export default function CommessaLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router  = useRouter()
  const pathname = usePathname()

  const [commessa,          setCommessa]          = useState<Commessa | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting,          setDeleting]          = useState(false)
  const [showCmd,           setShowCmd]           = useState(false)
  const [cmdQ,              setCmdQ]              = useState('')
  const [rightOpen,         setRightOpen]         = useState(true)
  const [kpi,               setKpi]               = useState({ odaImpegnati: 0, fattDaPagare: 0, alertCount: 0 })

  const cmdRef = useRef<HTMLInputElement>(null)

  /* ── right panel persistence ───────────────────────────────────────── */
  useEffect(() => {
    if (localStorage.getItem('sq360-right-panel') === 'closed') setRightOpen(false)
  }, [])

  const toggleRight = () => setRightOpen(v => {
    localStorage.setItem('sq360-right-panel', v ? 'closed' : 'open')
    return !v
  })

  /* ── load commessa ─────────────────────────────────────────────────── */
  useEffect(() => {
    supabase.from('commesse')
      .select('id,codice,nome,stato,importo_contratto,committente')
      .eq('id', id).single()
      .then(({ data }) => setCommessa(data))
  }, [id])

  /* ── load right-panel KPI ──────────────────────────────────────────── */
  useEffect(() => {
    if (!id) return
    const today = new Date().toISOString().slice(0, 10)
    const t30   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    Promise.all([
      supabase.from('oda').select('importo_netto').eq('commessa_id', id).neq('stato', 'ANNULLATO'),
      supabase.from('fatture_passive').select('importo_totale').eq('commessa_id', id).eq('stato', 'da_pagare'),
      supabase.from('documenti_sicurezza')
        .select('id', { count: 'exact', head: true })
        .eq('commessa_id', id)
        .not('data_scadenza', 'is', null)
        .gte('data_scadenza', today)
        .lte('data_scadenza', t30),
    ]).then(([rO, rF, rA]) => {
      setKpi({
        odaImpegnati: (rO.data || []).reduce((s, o) => s + (o.importo_netto || 0), 0),
        fattDaPagare: (rF.data || []).reduce((s, f) => s + (f.importo_totale || 0), 0),
        alertCount:   rA.count || 0,
      })
    })
  }, [id])

  /* ── command palette keyboard ──────────────────────────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCmd(v => !v)
        setCmdQ('')
      }
      if (e.key === 'Escape') setShowCmd(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (showCmd) setTimeout(() => cmdRef.current?.focus(), 40)
  }, [showCmd])

  /* ── delete ─────────────────────────────────────────────────────────── */
  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('commesse').delete().eq('id', id)
    if (error) { setDeleting(false); return }
    router.push('/dashboard/commesse')
  }

  /* ── derived ─────────────────────────────────────────────────────────── */
  const base       = '/dashboard/commesse/' + id
  const currentTab = TABS.find(t => pathname.startsWith(base + t.path))?.key || 'anagrafica'
  const nav        = (path: string) => router.push(base + path)

  const budget     = commessa?.importo_contratto || 0
  const statoColor = commessa ? (STATI_COLOR[commessa.stato] || '#6b7280') : '#6b7280'
  const pctSpeso   = budget > 0 ? Math.min((kpi.odaImpegnati / budget) * 100, 100) : 0
  const margine    = budget - kpi.odaImpegnati

  const filteredTabs = TABS.filter(t =>
    t.label.toLowerCase().includes(cmdQ.toLowerCase()) ||
    t.key.toLowerCase().includes(cmdQ.toLowerCase())
  )

  /* ─────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────── */
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 40px)',
      background: C.bg, overflow: 'hidden',
      color: C.t1, fontFamily: 'inherit',
    }}>

      {/* ══ TOP STRIP 32px ════════════════════════════════════════════ */}
      <div style={{
        height: 32, flexShrink: 0,
        background: C.strip,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center',
        padding: '0 8px', gap: 0, overflow: 'hidden',
      }}>
        {/* Breadcrumb */}
        <button onClick={() => router.push('/dashboard/commesse')} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.t2, fontSize: 11, padding: '0 6px', flexShrink: 0,
        }}>
          <ArrowLeft size={11} /> Commesse
        </button>

        <span style={{ color: C.t3, fontSize: 13, margin: '0 2px' }}>›</span>

        {commessa && (
          <span style={{
            fontFamily: 'monospace', fontSize: 10,
            background: C.accent + '18', color: C.accent,
            padding: '1px 6px', borderRadius: 3,
            marginLeft: 4, flexShrink: 0,
          }}>{commessa.codice}</span>
        )}

        <span style={{
          fontSize: 11, fontWeight: 600, color: C.t1,
          marginLeft: 8,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 180, flexShrink: 1,
        }}>
          {commessa?.nome || ''}
        </span>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: C.border, margin: '0 12px', flexShrink: 0 }} />

        {/* KPI inline */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
          {[
            { label: 'Contratto', value: fmtM(budget), color: C.t1 },
            { label: 'ODA',       value: fmtM(kpi.odaImpegnati), color: '#d97706' },
            { label: 'Speso',     value: `${pctSpeso.toFixed(0)}%`,
              color: pctSpeso > 90 ? '#dc2626' : pctSpeso > 70 ? '#d97706' : '#10b981' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'monospace' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Alert badge */}
        {kpi.alertCount > 0 && (
          <div style={{
            marginLeft: 8, padding: '2px 7px', borderRadius: 10,
            background: '#d97706' + '20', border: '1px solid ' + '#d97706' + '40',
            fontSize: 9, fontWeight: 700, color: '#d97706', flexShrink: 0,
          }}>
            ⚠ {kpi.alertCount}
          </div>
        )}

        {/* Stato */}
        {commessa && (
          <div style={{
            marginLeft: 6, padding: '2px 7px', borderRadius: 10,
            background: statoColor + '18', border: `1px solid ${statoColor}40`,
            fontSize: 9, fontWeight: 600, color: statoColor, flexShrink: 0,
          }}>
            {commessa.stato.replace(/_/g, ' ')}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* ⌘K button */}
        <button onClick={() => { setShowCmd(true); setCmdQ('') }} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(255,255,255,.05)', border: `1px solid ${C.border}`,
          borderRadius: 5, padding: '3px 9px',
          fontSize: 10, color: C.t2, cursor: 'pointer', flexShrink: 0,
        }}>
          <Search size={9} />
          <span>Cerca modulo</span>
          <span style={{ fontSize: 9, background: 'rgba(255,255,255,.08)', padding: '1px 4px', borderRadius: 3, color: C.t3 }}>
            ⌘K
          </span>
        </button>

        {/* Elimina */}
        {commessa && (
          <button onClick={() => setShowDeleteConfirm(true)} title="Elimina commessa" style={{
            display: 'flex', alignItems: 'center', gap: 3,
            marginLeft: 6, padding: '3px 8px',
            border: '1px solid rgba(220,38,38,.3)',
            borderRadius: 5, background: 'rgba(220,38,38,.08)',
            color: '#dc2626', cursor: 'pointer', fontSize: 10, flexShrink: 0,
          }}>
            <Trash2 size={9} /> Elimina
          </button>
        )}
      </div>

      {/* ══ THREE-PANEL LAYOUT ════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
        <div className="sq360-left-panel" style={{
          width: 220, flexShrink: 0,
          background: C.panel,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Active module header */}
          <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
              Modulo attivo
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.t1, margin: 0 }}>
              {TABS.find(t => t.key === currentTab)?.icon}{' '}
              {TABS.find(t => t.key === currentTab)?.label || '—'}
            </p>
          </div>

          {/* Nav groups */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0 12px' }}>
            {GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: 2 }}>
                <p style={{
                  fontSize: 9, fontWeight: 700, color: C.t3,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  margin: 0, padding: '8px 14px 3px',
                }}>{group.label}</p>

                {TABS.filter(t => group.keys.includes(t.key)).map(tab => {
                  const active = tab.key === currentTab
                  const hasAlert = tab.key === 'sicurezza' && kpi.alertCount > 0
                  return (
                    <button key={tab.key} onClick={() => nav(tab.path)} style={{
                      position: 'relative',
                      width: '100%', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 14px 6px 16px',
                      background: active ? C.accent + '14' : 'none',
                      border: 'none', cursor: 'pointer',
                      fontSize: 12,
                      color: active ? C.accent : C.t2,
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = C.t1 }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = C.t2 }}>
                      {/* Active indicator */}
                      {active && (
                        <div style={{
                          position: 'absolute', left: 0,
                          top: '50%', transform: 'translateY(-50%)',
                          width: 2, height: '60%',
                          background: C.accent, borderRadius: 1,
                        }} />
                      )}
                      <span style={{ fontSize: 13 }}>{tab.icon}</span>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tab.label}
                      </span>
                      {hasAlert && (
                        <span style={{
                          fontSize: 8, background: '#d97706', color: '#fff',
                          borderRadius: 8, padding: '1px 5px', fontWeight: 700, flexShrink: 0,
                        }}>
                          {kpi.alertCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN AREA ──────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
          {children}
        </main>

        {/* ── RIGHT INTELLIGENCE PANEL ───────────────────────────────── */}
        <div className="sq360-right-panel" style={{
          width: rightOpen ? 220 : 28, flexShrink: 0,
          background: C.panel,
          borderLeft: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.18s ease',
          overflow: 'hidden',
        }}>
          {/* Toggle */}
          <button onClick={toggleRight} style={{
            height: 32, flexShrink: 0, width: '100%',
            display: 'flex', alignItems: 'center',
            justifyContent: rightOpen ? 'flex-end' : 'center',
            gap: 5, padding: rightOpen ? '0 10px' : '0',
            background: 'none', border: 'none',
            borderBottom: `1px solid ${C.border}`,
            cursor: 'pointer', color: C.t3,
          }}>
            {rightOpen && <span style={{ fontSize: 9 }}>Intelligence</span>}
            {rightOpen ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
          </button>

          {rightOpen && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* KPI list */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                  KPI Commessa
                </p>
                {[
                  { label: 'Valore contratto',   value: fmtM(budget),              color: C.accent },
                  { label: 'ODA impegnati',       value: fmtM(kpi.odaImpegnati),   color: '#d97706' },
                  { label: 'Margine disponibile', value: fmtM(Math.abs(margine)),
                    color: margine >= 0 ? '#10b981' : '#dc2626' },
                  { label: 'Fatt. da pagare',     value: fmtM(kpi.fattDaPagare),
                    color: kpi.fattDaPagare > 0 ? '#f59e0b' : '#10b981' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: 9, color: C.t3, margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color, margin: 0, fontFamily: 'monospace' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ fontSize: 9, color: C.t3, margin: 0 }}>Spesa / Budget</p>
                  <p style={{ fontSize: 9, fontWeight: 700, margin: 0,
                    color: pctSpeso > 90 ? '#dc2626' : pctSpeso > 70 ? '#d97706' : '#10b981' }}>
                    {pctSpeso.toFixed(0)}%
                  </p>
                </div>
                <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${pctSpeso}%`,
                    background: pctSpeso > 90 ? '#dc2626' : pctSpeso > 70 ? '#d97706' : '#10b981',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              {/* Alert scadenze */}
              {kpi.alertCount > 0 && (
                <div style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: '#d97706' + '14',
                  border: '1px solid ' + '#d97706' + '30',
                }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#d97706', margin: '0 0 3px' }}>⚠ SCADENZE</p>
                  <p style={{ fontSize: 11, color: C.t2, margin: 0 }}>
                    {kpi.alertCount} doc. in scadenza ≤30gg
                  </p>
                  <button onClick={() => nav('/sicurezza')} style={{
                    marginTop: 5, fontSize: 9, color: '#d97706',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, textDecoration: 'underline',
                  }}>
                    Vai a Sicurezza →
                  </button>
                </div>
              )}

              {/* Current module */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                  Modulo corrente
                </p>
                <p style={{ fontSize: 12, color: C.t1, margin: 0, fontWeight: 500 }}>
                  {TABS.find(t => t.key === currentTab)?.icon}{' '}
                  {TABS.find(t => t.key === currentTab)?.label}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ MOBILE BOTTOMBAR ══════════════════════════════════════════ */}
      <div className="sq360-bottombar" style={{
        height: 56, flexShrink: 0,
        background: C.strip,
        borderTop: `1px solid ${C.border}`,
        display: 'none',
        alignItems: 'center', justifyContent: 'space-around',
      }}>
        {TABS.filter(t => MOBILE_TABS.includes(t.key)).map(tab => {
          const active = tab.key === currentTab
          return (
            <button key={tab.key} onClick={() => nav(tab.path)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 10px',
              color: active ? C.accent : C.t3,
            }}>
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 400 }}>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ══ COMMAND PALETTE ═══════════════════════════════════════════ */}
      {showCmd && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: 100, zIndex: 2000,
          }}
          onClick={() => setShowCmd(false)}>
          <div
            style={{
              width: 520, background: '#111827',
              border: `1px solid ${C.border}`,
              borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 25px 80px rgba(0,0,0,.7)',
            }}
            onClick={e => e.stopPropagation()}>

            {/* Input */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <Search size={14} style={{ color: C.t3, flexShrink: 0 }} />
              <input
                ref={cmdRef}
                value={cmdQ}
                onChange={e => setCmdQ(e.target.value)}
                placeholder="Cerca modulo..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 14, color: C.t1,
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && filteredTabs.length > 0) {
                    nav(filteredTabs[0].path)
                    setShowCmd(false)
                  }
                }}
              />
              <button onClick={() => setShowCmd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3 }}>
                <X size={13} />
              </button>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {filteredTabs.length === 0 ? (
                <p style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: C.t3, margin: 0 }}>
                  Nessun modulo trovato
                </p>
              ) : filteredTabs.map((tab, i) => {
                const active = tab.key === currentTab
                const isFirst = i === 0 && cmdQ.length > 0
                return (
                  <button key={tab.key}
                    onClick={() => { nav(tab.path); setShowCmd(false) }}
                    style={{
                      width: '100%', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 16px',
                      background: isFirst ? C.accent + '12' : 'none',
                      border: 'none', borderBottom: `1px solid ${C.border}`,
                      cursor: 'pointer',
                      color: active ? C.accent : C.t1,
                      fontSize: 13,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.accent + '12' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isFirst ? C.accent + '12' : 'none' }}>
                    <span style={{ fontSize: 16 }}>{tab.icon}</span>
                    <span style={{ flex: 1 }}>{tab.label}</span>
                    {active && (
                      <span style={{ fontSize: 9, color: C.accent, background: C.accent + '20', padding: '2px 6px', borderRadius: 4 }}>
                        ATTIVO
                      </span>
                    )}
                    {isFirst && <span style={{ fontSize: 9, color: C.t3 }}>↵</span>}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 16px', borderTop: `1px solid ${C.border}`,
              display: 'flex', gap: 14, alignItems: 'center',
            }}>
              {[['↵', 'Apri'], ['Esc', 'Chiudi']].map(([k, v]) => (
                <span key={k} style={{ fontSize: 10, color: C.t3, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ background: 'rgba(255,255,255,.08)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>{k}</span>
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE MODAL ══════════════════════════════════════════════ */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div style={{
            background: '#111827', borderRadius: 16, padding: 24, width: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,.6)',
            border: `1px solid ${C.border}`,
          }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(220,38,38,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 size={18} style={{ color: '#dc2626' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: C.t1 }}>Elimina commessa</h3>
                <p style={{ fontSize: 12, color: C.t2, margin: 0 }}>Operazione irreversibile</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: C.t2, margin: '0 0 16px', lineHeight: 1.5 }}>
              Stai per eliminare{' '}
              <strong style={{ color: C.t1 }}>{commessa?.nome}</strong>{' '}
              ({commessa?.codice}). Tutti i dati collegati (computo, RDA, RDO, ODA, SAL)
              verranno eliminati definitivamente. Il database Contatti NON viene eliminato.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{
                padding: '8px 16px', border: `1px solid ${C.border}`,
                borderRadius: 8, background: 'none',
                cursor: 'pointer', fontSize: 13, color: C.t2,
              }}>
                Annulla
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{
                padding: '8px 16px', background: '#dc2626', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                opacity: deleting ? 0.7 : 1,
              }}>
                {deleting ? 'Eliminando...' : 'Sì, elimina'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .sq360-left-panel  { display: none !important; }
          .sq360-right-panel { display: none !important; }
          .sq360-bottombar   { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
