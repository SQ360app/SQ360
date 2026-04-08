'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TrendingUp, AlertTriangle, Clock, CheckCircle,
  FolderOpen, ArrowRight, Building2, Euro, Calendar
} from 'lucide-react'

interface KPI {
  commesse_attive: number
  portafoglio: number
  sal_in_scadenza: number
  fornitori_durc: number
  margine_medio: number
}

interface CommessaCard {
  id: string
  codice: string
  nome: string
  committente: string
  stato: string
  importo_aggiudicato: number
  avanzamento_pct: number
  data_fine_contrattuale: string
  n_sal_attivi: number
  importo_incassato: number
  margine_incassato: number
}

interface Scadenza {
  tipo: string
  entita: string
  data_scadenza: string
  giorni_rimasti: number
}

const STATO_COLOR: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6', COLLAUDO: '#8b5cf6',
  SOSPESA: '#ef4444', CHIUSA: '#374151', ACQUISITA: '#6b7280', IN_GARA: '#f59e0b'
}

function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtM(n: number) { return n >= 1000000 ? `€ ${(n/1000000).toFixed(1)}M` : `€ ${fmt(n)}` }

export default function DashboardPage() {
  const router = useRouter()
  const [commesse, setCommesse] = useState<CommessaCard[]>([])
  const [scadenze, setScadenze] = useState<Scadenza[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState<string>('TUTTI')

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const [{ data: comm }, { data: scad }] = await Promise.all([
      supabase.from('v_commesse_kpi').select('*').order('stato'),
      supabase.from('v_scadenze_prossime').select('*').limit(10)
    ])
    if (comm) setCommesse(comm)
    if (scad) setScadenze(scad)
    setLoading(false)
  }

  const commesseFiltrate = commesse.filter(c =>
    filtroStato === 'TUTTI' || c.stato === filtroStato
  )

  // KPI aggregati
  const portafoglio = commesse.filter(c => c.stato !== 'CHIUSA').reduce((s, c) => s + (c.importo_aggiudicato || 0), 0)
  const inEsecuzione = commesse.filter(c => c.stato === 'IN_ESECUZIONE').length
  const inCollaudo = commesse.filter(c => c.stato === 'COLLAUDO').length
  const salScadenza = scadenze.filter(s => s.tipo === 'SAL').length
  const durcScadenza = scadenze.filter(s => s.tipo === 'DURC').length
  const incassato = commesse.reduce((s, c) => s + (c.importo_incassato || 0), 0)

  const STATI = ['IN_ESECUZIONE', 'AGGIUDICATA', 'COLLAUDO', 'SOSPESA', 'CHIUSA']

  return (
    <div style={{ padding: '28px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Intestazione */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>
          Panoramica in tempo reale — {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Alert scadenze urgenti */}
      {(salScadenza > 0 || durcScadenza > 0) && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <AlertTriangle size={16} color="#f59e0b" />
          <span style={{ fontSize: 13 }}>
            {salScadenza > 0 && <><strong>{salScadenza} SAL</strong> in scadenza nei prossimi 30 giorni</>}
            {salScadenza > 0 && durcScadenza > 0 && ' · '}
            {durcScadenza > 0 && <><strong>{durcScadenza} DURC fornitore</strong> in scadenza entro 60 giorni</>}
          </span>
        </div>
      )}

      {/* KPI principali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { icon: Building2, label: 'In esecuzione', val: inEsecuzione, color: '#10b981', sub: `${inCollaudo} in collaudo` },
          { icon: Euro, label: 'Portafoglio attivo', val: fmtM(portafoglio), color: '#3b82f6', sub: 'Commesse aperte' },
          { icon: TrendingUp, label: 'Incassato', val: fmtM(incassato), color: '#8b5cf6', sub: 'Totale SAL pagati' },
          { icon: CheckCircle, label: 'Totale commesse', val: commesse.length, color: '#6b7280', sub: `${commesse.filter(c=>c.stato==='CHIUSA').length} chiuse` },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <k.icon size={15} color={k.color} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: typeof k.val === 'number' ? 'inherit' : 'var(--font-mono)' }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

        {/* Lista commesse */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>Commesse</h2>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setFiltroStato('TUTTI')} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroStato === 'TUTTI' ? 'var(--accent)' : 'var(--panel)', color: filtroStato === 'TUTTI' ? 'white' : 'var(--t3)' }}>Tutte</button>
              {STATI.map(s => (
                <button key={s} onClick={() => setFiltroStato(s)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroStato === s ? STATO_COLOR[s] : 'var(--panel)', color: filtroStato === s ? 'white' : 'var(--t3)' }}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <div>Caricamento...</div>
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              {commesseFiltrate.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <FolderOpen size={32} color="var(--t4)" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 8 }}>Nessuna commessa trovata</div>
                  <button onClick={() => router.push('/dashboard/commesse')} className="btn-primary" style={{ margin: '0 auto' }}>
                    Vai alle commesse
                  </button>
                </div>
              ) : (
                commesseFiltrate.map((c, i) => {
                  const color = STATO_COLOR[c.stato] || '#6b7280'
                  const giorniFine = c.data_fine_contrattuale
                    ? Math.ceil((new Date(c.data_fine_contrattuale).getTime() - Date.now()) / 86400000)
                    : null
                  return (
                    <div key={c.id}
                      onClick={() => router.push(`/dashboard/commesse/${c.id}`)}
                      style={{
                        padding: '14px 20px',
                        borderBottom: i < commesseFiltrate.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', transition: 'background 0.12s',
                        display: 'flex', alignItems: 'center', gap: 16
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Indicatore stato */}
                      <div style={{ width: 4, height: 40, borderRadius: 2, background: color, flexShrink: 0 }} />

                      {/* Contenuto principale */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{c.codice}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 5, padding: '1px 7px' }}>{c.stato.replace('_',' ')}</span>
                          {giorniFine !== null && giorniFine <= 30 && giorniFine >= 0 && (
                            <span style={{ fontSize: 10, color: giorniFine <= 7 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>⏰ {giorniFine}gg</span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }} className="truncate">{c.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--t3)' }}>{c.committente}</div>
                        {/* Barra avanzamento */}
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${c.avanzamento_pct || 0}%`, height: '100%', background: color, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{c.avanzamento_pct || 0}%</span>
                        </div>
                      </div>

                      {/* Dati economici */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>{fmtM(c.importo_aggiudicato)}</div>
                        <div style={{ fontSize: 11, color: 'var(--t3)' }}>SAL: {c.n_sal_attivi || 0} emessi</div>
                      </div>

                      <ArrowRight size={15} color="var(--t4)" style={{ flexShrink: 0 }} />
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Pannello scadenze */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 14 }}>
            ⚠️ Scadenze prossime
          </h2>
          <div className="card">
            {scadenze.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                <CheckCircle size={24} color="#10b981" style={{ marginBottom: 8 }} />
                <div>Nessuna scadenza critica</div>
              </div>
            ) : (
              scadenze.map((s, i) => {
                const urgente = s.giorni_rimasti <= 7
                const warning = s.giorni_rimasti <= 30
                const color = urgente ? '#ef4444' : warning ? '#f59e0b' : '#6b7280'
                const tipoColor: Record<string, string> = { SAL: '#3b82f6', DURC: '#f59e0b', SOA: '#8b5cf6' }
                return (
                  <div key={i} style={{
                    padding: '12px 16px',
                    borderBottom: i < scadenze.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', gap: 10, alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: tipoColor[s.tipo] || '#6b7280',
                      marginTop: 5, flexShrink: 0
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: tipoColor[s.tipo] || '#6b7280', textTransform: 'uppercase' }}>{s.tipo}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color }}>{s.giorni_rimasti}gg</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500, marginTop: 2 }} className="truncate">{s.entita}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>
                        <Calendar size={10} style={{ display: 'inline', marginRight: 4 }} />
                        {s.data_scadenza}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Quick actions */}
          <div style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 12 }}>Azioni rapide</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Nuova commessa aggiudicata', href: '/dashboard/commesse?new=true', color: '#3b82f6' },
                { label: 'Nuova gara', href: '/dashboard/gare?new=true', color: '#f59e0b' },
                { label: 'Nuovo fornitore', href: '/dashboard/fornitori?new=true', color: '#10b981' },
              ].map(a => (
                <button key={a.label} onClick={() => router.push(a.href)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 9,
                  border: `1px solid ${a.color}30`, background: `${a.color}08`,
                  color: a.color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  textAlign: 'left', transition: 'all 0.12s'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                  {a.label}
                  <ArrowRight size={12} style={{ marginLeft: 'auto' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
