'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowRight, AlertTriangle, CheckCircle, TrendingUp, Building2, Euro, MapPin, X } from 'lucide-react'

interface Commessa {
  id: string
  codice: string
  nome: string
  committente: string
  stato: string
  importo_aggiudicato: number
  data_fine_contrattuale: string
  avanzamento_pct: number
  n_sal_attivi: number
  importo_incassato: number
  margine_incassato: number
  provincia: string
  dl_nome: string
}

interface Scadenza {
  tipo: string
  entita: string
  data_scadenza: string
  giorni_rimasti: number
}

const STATO_COLOR: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6', COLLAUDO: '#8b5cf6',
  SOSPESA: '#ef4444', CHIUSA: '#374151', ACQUISITA: '#6b7280'
}

// Coordinate italiane per provincia
const PROVINCE_COORDS: Record<string, [number, number]> = {
  NA: [40.8518, 14.2681], MI: [45.4654, 9.1859], RM: [41.9028, 12.4964],
  TO: [45.0703, 7.6869], FI: [43.7696, 11.2558], BO: [44.4949, 11.3426],
  VE: [45.4408, 12.3155], GE: [44.4056, 8.9463], BA: [41.1171, 16.8719],
  PA: [38.1157, 13.3615], CA: [39.2238, 9.1217], SA: [40.6824, 14.7681],
  AV: [40.9145, 15.0639], BN: [41.1292, 14.7750], CE: [41.0765, 14.3322],
  CZ: [38.9000, 16.5886], RC: [38.1100, 15.6500], CS: [39.3000, 16.2500],
  LE: [40.3516, 18.1752], TA: [40.4644, 17.2470], BR: [40.6364, 17.9413],
  FG: [41.4621, 15.5446], PE: [42.3569, 14.0961], CH: [42.3500, 14.1667],
  AQ: [42.3500, 13.3999], CB: [41.5600, 14.6626], IS: [41.5922, 14.2311],
  PZ: [40.6386, 15.8006], MT: [40.6664, 16.6043], AN: [43.6170, 13.5189],
  MC: [43.3007, 13.4528], AP: [42.9000, 13.5833], PU: [43.6157, 12.7139],
  LI: [43.5479, 10.3148], GR: [42.7636, 11.1117], AR: [43.4638, 11.8796],
  SI: [43.3181, 11.3307], LU: [43.8430, 10.5076], PT: [43.9333, 10.9167],
  MS: [44.0333, 10.1333], PI: [43.7228, 10.4017], PO: [43.8805, 11.0965],
  PG: [43.1107, 12.3908], TR: [42.5636, 12.6434], VT: [42.4167, 12.1000],
  RI: [42.4047, 12.8628], FR: [41.4836, 13.7681], LT: [41.4636, 12.9036],
  default: [41.9028, 12.4964]
}

function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtM(n: number) { return n >= 1000000 ? `€ ${(n / 1000000).toFixed(1)}M` : `€ ${fmt(n)}` }

export default function DashboardPage() {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const [commesse, setCommesse] = useState<Commessa[]>([])
  const [scadenze, setScadenze] = useState<Scadenza[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState('TUTTI')
  const [commessaSelezionata, setCommessaSelezionata] = useState<Commessa | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => { carica() }, [])

  useEffect(() => {
    if (!mapLoaded || commesse.length === 0) return
    initMappa()
  }, [mapLoaded, commesse])

  useEffect(() => {
    // Carica Leaflet dinamicamente
    if (typeof window !== 'undefined' && !mapLoaded) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
      script.onload = () => setMapLoaded(true)
      document.head.appendChild(script)
    }
  }, [])

  async function carica() {
    setLoading(true)
    const [{ data: comm }, { data: scad }] = await Promise.all([
      supabase.from('v_commesse_kpi').select('*, commesse(provincia, dl_nome)').order('stato'),
      supabase.from('v_scadenze_prossime').select('*').limit(8)
    ])
    if (comm) {
      const arricchite = await Promise.all(comm.map(async (c) => {
        const { data: det } = await supabase.from('commesse').select('provincia, dl_nome').eq('id', c.id).single()
        return { ...c, provincia: det?.provincia || 'NA', dl_nome: det?.dl_nome || '' }
      }))
      setCommesse(arricchite)
    }
    if (scad) setScadenze(scad)
    setLoading(false)
  }

  function initMappa() {
    if (!mapRef.current || !window.L) return
    if (mapInstanceRef.current) {
      (mapInstanceRef.current as { remove: () => void }).remove()
    }
    const L = window.L
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = (L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true }) as any)
    map.setView([41.9, 12.5], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(map)
    mapInstanceRef.current = map

    // Aggiungi markers per ogni commessa
    const commesseAttive = commesse.filter(c => c.stato !== 'CHIUSA')
    commesseAttive.forEach(c => {
      const coords = PROVINCE_COORDS[c.provincia] || PROVINCE_COORDS.default
      // Aggiungi piccola randomizzazione per evitare sovrapposizioni
      const lat = coords[0] + (Math.random() - 0.5) * 0.05
      const lng = coords[1] + (Math.random() - 0.5) * 0.05
      const color = STATO_COLOR[c.stato] || '#6b7280'

      const icon = L.divIcon({
        html: `<div style="
          width:32px;height:32px;border-radius:50%;
          background:${color};border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:800;color:white;
          cursor:pointer;transition:transform 0.15s;
        ">${c.avanzamento_pct || 0}%</div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 16]
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const marker = (L.marker([lat, lng], { icon }).addTo(map)) as any
      marker.bindTooltip(`
        <div style="min-width:180px;padding:4px 0">
          <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:3px">${c.codice}</div>
          <div style="font-size:12px;font-weight:600;color:#1e293b">${c.nome}</div>
          <div style="font-size:11px;color:#64748b">${c.committente}</div>
          <div style="font-size:12px;font-weight:700;color:#1e293b;margin-top:4px">€ ${fmt(c.importo_aggiudicato)}</div>
        </div>
      `, { permanent: false, direction: 'top', offset: [0, -18] })

      marker.on('click', () => setCommessaSelezionata(c))
    })

    // Centra la mappa sui markers se ci sono
    if (commesseAttive.length > 0) {
      const bounds = commesseAttive.map(c => {
        const coords = PROVINCE_COORDS[c.provincia] || PROVINCE_COORDS.default
        return [coords[0], coords[1]] as [number, number]
      })
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 }) } catch (e) { /* ignore */ }
    }
  }

  const filtrate = commesse.filter(c => filtroStato === 'TUTTI' || c.stato === filtroStato)
  const portafoglio = commesse.filter(c => c.stato !== 'CHIUSA').reduce((s, c) => s + (c.importo_aggiudicato || 0), 0)
  const inEsecuzione = commesse.filter(c => c.stato === 'IN_ESECUZIONE').length
  const incassato = commesse.reduce((s, c) => s + (c.importo_incassato || 0), 0)
  const salScadenza = scadenze.filter(s => s.tipo === 'SAL').length
  const durcScadenza = scadenze.filter(s => s.tipo === 'DURC').length

  return (
    <div style={{ padding: '20px 24px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Alert */}
      {(salScadenza > 0 || durcScadenza > 0) && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <AlertTriangle size={15} color="#f59e0b" />
          <span>
            {salScadenza > 0 && <><strong>{salScadenza} SAL</strong> in scadenza · </>}
            {durcScadenza > 0 && <><strong>{durcScadenza} DURC</strong> fornitori in scadenza</>}
          </span>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { icon: Building2, label: 'In esecuzione', val: inEsecuzione, color: '#10b981', sub: `${commesse.filter(c => c.stato === 'COLLAUDO').length} in collaudo` },
          { icon: Euro, label: 'Portafoglio attivo', val: fmtM(portafoglio), color: '#3b82f6', sub: 'Commesse aperte', mono: true },
          { icon: TrendingUp, label: 'Incassato', val: fmtM(incassato), color: '#8b5cf6', sub: 'SAL pagati', mono: true },
          { icon: CheckCircle, label: 'Totale commesse', val: commesse.length, color: '#6b7280', sub: `${commesse.filter(c => c.stato === 'CHIUSA').length} chiuse` },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <k.icon size={14} color={k.color} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontFamily: k.mono ? 'var(--font-mono)' : 'inherit' }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Mappa + Lista */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>

        {/* MAPPA CANTIERI */}
        <div className="card" style={{ overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={15} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Cantieri attivi</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)' }}>Clicca su un cantiere per i dettagli</span>
          </div>
          <div ref={mapRef} style={{ height: 380, background: '#e8f0e8' }}>
            {!mapLoaded && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
                <div className="spinner" />
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>Caricamento mappa...</span>
              </div>
            )}
          </div>

          {/* Popup commessa selezionata */}
          {commessaSelezionata && (
            <div style={{
              position: 'absolute', bottom: 16, left: 16, right: 16,
              background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-lg)',
              animation: 'fadeIn 0.2s ease', zIndex: 1000
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{commessaSelezionata.codice}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: STATO_COLOR[commessaSelezionata.stato], background: `${STATO_COLOR[commessaSelezionata.stato]}15`, border: `1px solid ${STATO_COLOR[commessaSelezionata.stato]}30`, borderRadius: 5, padding: '1px 7px' }}>{commessaSelezionata.stato.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{commessaSelezionata.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>{commessaSelezionata.committente}</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>Importo</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(commessaSelezionata.importo_aggiudicato)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>Avanzamento</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: STATO_COLOR[commessaSelezionata.stato] }}>{commessaSelezionata.avanzamento_pct || 0}%</div>
                    </div>
                    {commessaSelezionata.data_fine_contrattuale && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--t3)' }}>Fine lavori</div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>{commessaSelezionata.data_fine_contrattuale}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <button onClick={() => router.push(`/dashboard/commesse/${commessaSelezionata.id}`)} className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}>
                    Apri <ArrowRight size={12} />
                  </button>
                  <button onClick={() => setCommessaSelezionata(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                    <X size={13} color="var(--t3)" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PANNELLO DESTRA: Scadenze + Azioni rapide */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ flex: 1 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>⚠️ Scadenze prossime</span>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 200 }}>
              {scadenze.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                  <CheckCircle size={20} color="#10b981" style={{ marginBottom: 6 }} />
                  <div>Nessuna scadenza critica</div>
                </div>
              ) : scadenze.map((s, i) => {
                const urgente = s.giorni_rimasti <= 7
                const color = urgente ? '#ef4444' : s.giorni_rimasti <= 30 ? '#f59e0b' : '#6b7280'
                const tipoColor: Record<string, string> = { SAL: '#3b82f6', DURC: '#f59e0b', SOA: '#8b5cf6' }
                return (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: i < scadenze.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: tipoColor[s.tipo] || '#6b7280', marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: tipoColor[s.tipo], textTransform: 'uppercase' }}>{s.tipo}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color }}>{s.giorni_rimasti}gg</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t1)', fontWeight: 500 }} className="truncate">{s.entita}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{s.data_scadenza}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>Azioni rapide</div>
            {[
              { label: '+ Nuova commessa aggiudicata', href: '/dashboard/commesse?new=true', color: '#3b82f6' },
              { label: '+ Nuova gara', href: '/dashboard/gare?new=true', color: '#f59e0b' },
              { label: '+ Nuovo fornitore', href: '/dashboard/fornitori?new=true', color: '#10b981' },
            ].map(a => (
              <button key={a.label} onClick={() => router.push(a.href)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${a.color}25`, background: `${a.color}06`, color: a.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 6, textAlign: 'left' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.color }} />
                {a.label}
                <ArrowRight size={11} style={{ marginLeft: 'auto' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista commesse */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Commesse</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['TUTTI', 'IN_ESECUZIONE', 'AGGIUDICATA', 'COLLAUDO', 'SOSPESA', 'CHIUSA'].map(s => (
              <button key={s} onClick={() => setFiltroStato(s)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroStato === s ? (STATO_COLOR[s] || 'var(--accent)') : 'var(--panel)', color: filtroStato === s ? 'white' : 'var(--t3)' }}>
                {s === 'TUTTI' ? 'Tutte' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>
            <div className="spinner" style={{ margin: '0 auto 8px' }} />
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {filtrate.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}>Nessuna commessa trovata</div>
                <button onClick={() => router.push('/dashboard/commesse')} className="btn-primary" style={{ margin: '0 auto' }}>Vai alle commesse</button>
              </div>
            ) : filtrate.map((c, i) => {
              const col = STATO_COLOR[c.stato] || '#6b7280'
              const giorniFine = c.data_fine_contrattuale ? Math.ceil((new Date(c.data_fine_contrattuale).getTime() - Date.now()) / 86400000) : null
              return (
                <div key={c.id}
                  onClick={() => router.push(`/dashboard/commesse/${c.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: i < filtrate.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: col, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{c.codice}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: col, background: `${col}15`, border: `1px solid ${col}30`, borderRadius: 5, padding: '1px 6px' }}>{c.stato.replace('_', ' ')}</span>
                      {giorniFine !== null && giorniFine <= 30 && giorniFine >= 0 && <span style={{ fontSize: 10, color: giorniFine <= 7 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>⚠ {giorniFine}gg</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }} className="truncate">{c.nome}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', maxWidth: 160 }}>
                        <div style={{ width: `${c.avanzamento_pct || 0}%`, height: '100%', background: col, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>{c.avanzamento_pct || 0}%</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(c.importo_aggiudicato)}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>SAL: {c.n_sal_attivi || 0}</div>
                  </div>
                  <ArrowRight size={14} color="var(--t4)" />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any
  }
}
