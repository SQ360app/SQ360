'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowRight, AlertTriangle, CheckCircle, TrendingUp,
  Building2, Euro, Sparkles, FileText, X,
  Send, Zap, Activity, BarChart2
} from 'lucide-react'

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
  dl_email: string
  lat?: number
  lng?: number
}

interface Scadenza {
  tipo: string
  entita: string
  data_scadenza: string
  giorni_rimasti: number
}

// Coordinate geografiche reali per provincia italiana
const PROV_COORDS: Record<string, [number, number]> = {
  AG:[37.31,13.58],AL:[44.91,8.62],AN:[43.62,13.52],AO:[45.74,7.32],AP:[42.85,13.58],
  AQ:[42.35,13.40],AR:[43.46,11.88],AT:[44.90,8.21],AV:[40.91,15.06],BA:[41.12,16.87],
  BG:[45.70,9.67],BI:[45.56,8.05],BL:[46.14,12.22],BN:[41.13,14.78],BO:[44.49,11.34],
  BR:[40.63,17.94],BS:[45.54,10.22],BT:[41.20,16.28],BZ:[46.50,11.35],CA:[39.22,9.11],
  CB:[41.56,14.66],CE:[41.08,14.33],CH:[42.35,14.10],CL:[37.49,14.06],CN:[44.39,7.54],
  CO:[45.80,9.09],CR:[45.13,10.02],CS:[39.30,16.25],CT:[37.50,15.09],CZ:[38.90,16.59],
  EN:[37.56,14.28],FC:[44.22,12.04],FE:[44.83,11.62],FG:[41.46,15.54],FI:[43.77,11.26],
  FM:[43.16,13.72],FR:[41.48,13.77],GE:[44.41,8.95],GO:[45.94,13.62],GR:[42.76,11.11],
  IM:[43.89,7.91],IS:[41.59,14.23],KR:[39.08,17.12],LC:[45.86,9.40],LE:[40.35,18.17],
  LI:[43.55,10.31],LO:[45.31,9.50],LT:[41.46,12.90],LU:[43.84,10.51],MB:[45.60,9.27],
  MC:[43.30,13.45],ME:[38.19,15.55],MI:[45.46,9.19],MN:[45.16,10.79],MO:[44.65,10.93],
  MS:[44.03,10.14],MT:[40.67,16.60],NA:[40.85,14.27],NO:[45.45,8.62],NU:[40.32,9.33],
  OG:[39.90,9.52],OR:[39.90,8.58],PA:[38.12,13.36],PC:[44.99,9.65],PD:[45.41,11.88],
  PE:[42.35,14.10],PG:[43.11,12.39],PI:[43.72,10.40],PN:[46.07,12.66],PO:[43.88,11.10],
  PR:[44.80,10.33],PT:[43.93,10.92],PU:[43.62,12.71],PV:[45.19,9.16],PZ:[40.64,15.80],
  RA:[44.42,12.20],RC:[38.11,15.65],RE:[44.70,10.63],RG:[36.93,14.74],RI:[42.40,12.86],
  RM:[41.90,12.50],RN:[44.06,12.57],RO:[45.07,11.79],SA:[40.68,14.76],SI:[43.32,11.33],
  SO:[46.17,9.87],SP:[44.10,9.82],SR:[37.07,15.29],SS:[40.73,8.56],SU:[39.31,9.00],
  SV:[44.31,8.48],TA:[40.46,17.25],TE:[42.66,13.70],TN:[46.07,11.12],TO:[45.07,7.69],
  TP:[37.87,12.74],TR:[42.56,12.64],TS:[45.65,13.78],TV:[45.67,12.24],UD:[46.07,13.24],
  VA:[45.82,8.83],VB:[46.13,8.27],VC:[45.32,8.42],VE:[45.44,12.32],VI:[45.55,11.55],
  VR:[45.44,10.99],VT:[42.42,12.10],VV:[38.68,16.10],
  default:[41.90,12.50]
}

const STATO_COLOR: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6', COLLAUDO: '#8b5cf6',
  SOSPESA: '#ef4444', CHIUSA: '#64748b', ACQUISITA: '#94a3b8'
}

function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtM(n: number) { return n >= 1000000 ? `€ ${(n / 1000000).toFixed(1)}M` : `€ ${fmt(n)}` }

function calcolaSalute(c: Commessa): { score: number; colore: string; label: string } {
  let score = 100
  const gg = c.data_fine_contrattuale ? Math.ceil((new Date(c.data_fine_contrattuale).getTime() - Date.now()) / 86400000) : 180
  if (gg < 0) score -= 30
  else if (gg < 30) score -= 15
  if ((c.avanzamento_pct || 0) < 10 && gg < 180) score -= 15
  if (c.stato === 'SOSPESA') score = 20
  if (score >= 80) return { score, colore: '#10b981', label: 'Ottimo' }
  if (score >= 60) return { score, colore: '#f59e0b', label: 'Attenzione' }
  return { score, colore: '#ef4444', label: 'Critico' }
}

type TabPopup = 'info' | 'ai' | 'rapportino'

export default function DashboardPage() {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  const [commesse, setCommesse] = useState<Commessa[]>([])
  const [scadenze, setScadenze] = useState<Scadenza[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [pinSelected, setPinSelected] = useState<Commessa | null>(null)
  const [tabPopup, setTabPopup] = useState<TabPopup>('info')
  const [filtroStato, setFiltroStato] = useState('TUTTI')
  const [confrontoIds, setConfrontoIds] = useState<string[]>([])
  const [aiDomanda, setAiDomanda] = useState('')
  const [aiRisposta, setAiRisposta] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [rapportino, setRapportino] = useState({ lavorazioni: '', operai: '', note: '' })
  const [rapportinoSent, setRapportinoSent] = useState(false)

  // Carica Leaflet una sola volta
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.L) { setMapReady(true); return }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => setMapReady(true)
    document.head.appendChild(script)
  }, [])

  // Inizializza mappa satellitare ESRI
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L
    const map = L.map(mapRef.current, {
      center: [42.0, 12.5], zoom: 6,
      zoomControl: true, scrollWheelZoom: true
    })
    // ESRI World Imagery — satellite gratuito, nessuna API key
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye',
        maxZoom: 18
      }
    ).addTo(map)
    // Labels stradali sopra il satellite (opzionale ma utile)
    L.tileLayer(
      'https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png',
      { opacity: 0.4, maxZoom: 18 }
    ).addTo(map)

    mapInstance.current = map
  }, [mapReady])

  // Aggiorna markers quando cambiano le commesse
  useEffect(() => {
    if (!mapReady || !mapInstance.current || commesse.length === 0) return
    const L = window.L
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstance.current as any

    // Rimuovi markers precedenti
    markersRef.current.forEach(m => { try { map.removeLayer(m) } catch {} })
    markersRef.current = []

    const attive = commesse.filter(c => c.stato !== 'CHIUSA')
    const bounds: [number, number][] = []

    attive.forEach(c => {
      const coords = PROV_COORDS[c.provincia] || PROV_COORDS.default
      // Piccola randomizzazione per evitare sovrapposizioni nella stessa provincia
      const lat = coords[0] + (Math.random() - 0.5) * 0.04
      const lng = coords[1] + (Math.random() - 0.5) * 0.06
      bounds.push([lat, lng])

      const salute = calcolaSalute(c)
      const isSelected = pinSelected?.id === c.id

      const icon = L.divIcon({
        html: `<div style="
          width:${isSelected ? 42 : 34}px;
          height:${isSelected ? 42 : 34}px;
          border-radius:50%;
          background:${salute.colore};
          border:3px solid white;
          box-shadow:0 3px 10px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:800;color:white;
          cursor:pointer;
          transition:all 0.2s;
          ${salute.score < 60 ? 'animation:pulse 2s infinite;' : ''}
        ">${c.avanzamento_pct || 0}%</div>
        <style>@keyframes pulse{0%,100%{box-shadow:0 0 0 0 ${salute.colore}60}50%{box-shadow:0 0 0 10px ${salute.colore}00}}</style>`,
        className: '',
        iconSize: [isSelected ? 42 : 34, isSelected ? 42 : 34],
        iconAnchor: [isSelected ? 21 : 17, isSelected ? 21 : 17]
      })

      const marker = L.marker([lat, lng], { icon })
      marker.addTo(map)
      marker.bindTooltip(`
        <div style="min-width:200px;font-family:Inter,sans-serif">
          <div style="font-size:10px;font-weight:700;color:${salute.colore};text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">${c.codice} · ${salute.label}</div>
          <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:2px">${c.nome}</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:6px">${c.committente}</div>
          <div style="font-size:14px;font-weight:800;color:#1e293b">€ ${fmt(c.importo_aggiudicato)}</div>
          <div style="height:4px;background:#e2e8f0;border-radius:2px;margin-top:6px;overflow:hidden">
            <div style="height:100%;width:${c.avanzamento_pct||0}%;background:${salute.colore};border-radius:2px"></div>
          </div>
        </div>
      `, { permanent: false, direction: 'top', offset: [0, -20], className: 'sq360-tooltip' })

      marker.on('click', () => {
        setPinSelected(prev => prev?.id === c.id ? null : c)
        setTabPopup('info')
        setAiRisposta('')
      })

      markersRef.current.push(marker)
    })

    if (bounds.length > 0) {
      try { map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 }) } catch {}
    }
  }, [commesse, mapReady, pinSelected?.id])

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: kpi }, { data: scad }, { data: det }] = await Promise.all([
      supabase.from('v_commesse_kpi').select('*').order('stato'),
      supabase.from('v_scadenze_prossime').select('*').limit(8),
      supabase.from('commesse').select('id,provincia,dl_nome,dl_email')
    ])
    if (kpi && det) {
      const merged = kpi.map((k: Record<string, unknown>) => {
        const d = det.find((x: { id: string }) => x.id === k.id) || {}
        return { ...k, ...d }
      })
      setCommesse(merged as Commessa[])
    }
    if (scad) setScadenze(scad)
    setLoading(false)
  }, [])

  useEffect(() => { carica() }, [carica])

  const filtrate = commesse.filter(c => filtroStato === 'TUTTI' || c.stato === filtroStato)
  const portafoglio = commesse.filter(c => c.stato !== 'CHIUSA').reduce((s, c) => s + (c.importo_aggiudicato || 0), 0)
  const inEsecuzione = commesse.filter(c => c.stato === 'IN_ESECUZIONE').length
  const incassato = commesse.reduce((s, c) => s + (c.importo_incassato || 0), 0)

  async function chiediAI() {
    if (!pinSelected || !aiDomanda.trim()) return
    setAiLoading(true); setAiRisposta('')
    try {
      const res = await fetch('/api/ai-commessa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commessaId: pinSelected.id, domanda: aiDomanda })
      })
      const data = await res.json()
      setAiRisposta(data.risposta || 'Servizio non disponibile')
    } catch {
      setAiRisposta('Errore connessione AI. Riprova.')
    }
    setAiLoading(false)
  }

  async function inviaRapportino() {
    if (!pinSelected || !rapportino.lavorazioni) return
    const aziendaId = await import('@/lib/supabase').then(m => m.getAziendaId())
    await supabase.from('rapportini').insert([{
      commessa_id: pinSelected.id,
      azienda_id: aziendaId,
      data: new Date().toISOString().slice(0, 10),
      numero: Math.floor(Math.random() * 999) + 1,
      note_cantiere: rapportino.note,
      lavorazioni: [{ descrizione: rapportino.lavorazioni }],
      manodopera: [{ categoria: 'operai', n_operai: parseInt(rapportino.operai) || 0, ore: 8 }]
    }])
    setRapportinoSent(true)
    setTimeout(() => { setRapportinoSent(false); setRapportino({ lavorazioni: '', operai: '', note: '' }) }, 2500)
  }

  const salute = pinSelected ? calcolaSalute(pinSelected) : null
  const confrontoCommesse = commesse.filter(c => confrontoIds.includes(c.id))

  return (
    <div style={{ padding: '18px 22px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { icon: Building2, label: 'In esecuzione', val: inEsecuzione, color: '#10b981' },
          { icon: Euro, label: 'Portafoglio', val: fmtM(portafoglio), color: '#3b82f6', mono: true },
          { icon: TrendingUp, label: 'Incassato', val: fmtM(incassato), color: '#8b5cf6', mono: true },
          { icon: CheckCircle, label: 'Commesse', val: commesse.length, color: '#6b7280' },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}`, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <k.icon size={12} color={k.color} />
              <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontFamily: (k as {mono?: boolean}).mono ? 'var(--font-mono)' : 'inherit' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Layout: Mappa satellitare + Pannello */}
      <div style={{ display: 'grid', gridTemplateColumns: pinSelected || confrontoIds.length >= 2 ? '1fr 400px' : '1fr 260px', gap: 14, marginBottom: 14 }}>

        {/* MAPPA SATELLITARE */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel)' }}>
            <Activity size={14} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>CantierePulse</span>
            <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>● LIVE</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>Clicca pin · Shift+click per confronto</span>
              {[{ c: '#10b981', l: 'Ottimo' }, { c: '#f59e0b', l: 'Attenzione' }, { c: '#ef4444', l: 'Critico' }].map(s => (
                <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.c }} />
                  <span style={{ fontSize: 9, color: 'var(--t3)' }}>{s.l}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Mappa Leaflet con ESRI satellite */}
          <div ref={mapRef} style={{ height: 420 }}>
            {!mapReady && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 8 }}>
                <div className="spinner" />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Caricamento mappa satellitare...</span>
              </div>
            )}
          </div>
          {/* CSS tooltip Leaflet personalizzato */}
          <style>{`
            .sq360-tooltip { background: white !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important; padding: 10px 12px !important; }
            .sq360-tooltip::before { display: none !important; }
            .leaflet-control-zoom { border: 1px solid var(--border) !important; box-shadow: var(--shadow-sm) !important; }
            .leaflet-control-zoom a { color: var(--t1) !important; }
          `}</style>
        </div>

        {/* PANNELLO DESTRA */}
        {pinSelected ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{pinSelected.codice}</span>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: salute?.colore }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: salute?.colore }}>{salute?.label}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }} className="truncate">{pinSelected.nome}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>{pinSelected.committente}</div>
                </div>
                <button onClick={() => setPinSelected(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                  <X size={14} color="var(--t3)" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {[
                { key: 'info', icon: Activity, label: 'KPI' },
                { key: 'ai', icon: Sparkles, label: 'AI' },
                { key: 'rapportino', icon: FileText, label: 'Rapportino' },
              ].map(t => (
                <button key={t.key} onClick={() => setTabPopup(t.key as TabPopup)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '9px', border: 'none', background: 'transparent', borderBottom: tabPopup === t.key ? '2px solid var(--accent)' : '2px solid transparent', color: tabPopup === t.key ? 'var(--accent)' : 'var(--t3)', fontSize: 11, fontWeight: tabPopup === t.key ? 700 : 400, cursor: 'pointer' }}>
                  <t.icon size={11} />{t.label}
                </button>
              ))}
            </div>

            {/* Contenuto */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {tabPopup === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Importo', val: `€ ${fmt(pinSelected.importo_aggiudicato)}`, color: '#3b82f6' },
                      { label: 'Avanzamento', val: `${pinSelected.avanzamento_pct || 0}%`, color: salute?.colore || '#10b981' },
                      { label: 'SAL emessi', val: String(pinSelected.n_sal_attivi || 0), color: '#8b5cf6' },
                      { label: 'Incassato', val: `€ ${fmt(pinSelected.importo_incassato)}`, color: '#10b981' },
                    ].map(k => (
                      <div key={k.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{k.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Salute */}
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Salute commessa</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: salute?.colore }}>{salute?.score}/100</span>
                    </div>
                    <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${salute?.score}%`, height: '100%', background: salute?.colore, borderRadius: 4 }} />
                    </div>
                  </div>
                  {/* Fine lavori */}
                  {pinSelected.data_fine_contrattuale && (
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fine lavori</span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--t1)' }}>{pinSelected.data_fine_contrattuale}</span>
                    </div>
                  )}
                  {/* Azioni */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => router.push(`/dashboard/commesse/${pinSelected.id}`)} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '9px' }}>
                      Apri commessa <ArrowRight size={12} />
                    </button>
                    <button onClick={() => setConfrontoIds(p => p.includes(pinSelected.id) ? p.filter(x => x !== pinSelected.id) : p.length < 4 ? [...p, pinSelected.id] : p)}
                      style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${confrontoIds.includes(pinSelected.id) ? '#8b5cf6' : 'var(--border)'}`, background: confrontoIds.includes(pinSelected.id) ? 'rgba(139,92,246,0.08)' : 'var(--bg)', color: confrontoIds.includes(pinSelected.id) ? '#8b5cf6' : 'var(--t3)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      {confrontoIds.includes(pinSelected.id) ? '★' : '☆'}
                    </button>
                  </div>
                </div>
              )}

              {tabPopup === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <Sparkles size={12} color="var(--accent)" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>AI Commessa</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>Analisi contestuale di <strong>{pinSelected.codice}</strong></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {['Qual è il margine attuale?', 'Ci sono scadenze urgenti?', 'Stato dei subappalti?', 'Avanzamento vs programma?'].map(q => (
                      <button key={q} onClick={() => setAiDomanda(q)} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: aiDomanda === q ? 'var(--accent-light)' : 'var(--bg)', color: aiDomanda === q ? 'var(--accent)' : 'var(--t2)', fontSize: 11, cursor: 'pointer', textAlign: 'left', fontWeight: aiDomanda === q ? 600 : 400 }}>
                        💬 {q}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={aiDomanda} onChange={e => setAiDomanda(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && chiediAI()}
                      placeholder="Chiedi all'AI..." style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--t1)' }} />
                    <button onClick={chiediAI} disabled={aiLoading} style={{ padding: '8px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'white', cursor: aiLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Send size={13} />
                    </button>
                  </div>
                  {aiLoading && <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--t3)', alignItems: 'center' }}><div className="spinner" style={{ width: 12, height: 12 }} /> Analisi...</div>}
                  {aiRisposta && <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{aiRisposta}</div>}
                </div>
              )}

              {tabPopup === 'rapportino' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#065f46' }}>
                    📋 Rapportino rapido · {pinSelected.codice} · {new Date().toLocaleDateString('it-IT')}
                  </div>
                  {rapportinoSent ? (
                    <div style={{ textAlign: 'center', padding: 24, color: '#10b981' }}>
                      <CheckCircle size={28} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Inviato!</div>
                    </div>
                  ) : <>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Lavorazioni eseguite *</label>
                      <textarea value={rapportino.lavorazioni} onChange={e => setRapportino(p => ({ ...p, lavorazioni: e.target.value }))}
                        placeholder="es. Posa massetto piano primo..." rows={3}
                        style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--t1)', resize: 'none', boxSizing: 'border-box' as const }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>N° operai</label>
                        <input type="number" value={rapportino.operai} onChange={e => setRapportino(p => ({ ...p, operai: e.target.value }))}
                          placeholder="0" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--t1)', boxSizing: 'border-box' as const }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Note</label>
                        <input value={rapportino.note} onChange={e => setRapportino(p => ({ ...p, note: e.target.value }))}
                          placeholder="Meteo, problemi..." style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--t1)', boxSizing: 'border-box' as const }} />
                      </div>
                    </div>
                    <button onClick={inviaRapportino} disabled={!rapportino.lavorazioni} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                      <Zap size={13} /> Invia rapportino
                    </button>
                  </>}
                </div>
              )}
            </div>
          </div>

        ) : confrontoIds.length >= 2 ? (
          /* CONFRONTO */
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>⚖️ Confronto cantieri</span>
              <button onClick={() => setConfrontoIds([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 11 }}>Pulisci</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {[
                { label: 'Importo', key: 'importo_aggiudicato', f: (v: number) => `€ ${fmt(v)}` },
                { label: 'Avanzamento', key: 'avanzamento_pct', f: (v: number) => `${v || 0}%` },
                { label: 'SAL emessi', key: 'n_sal_attivi', f: (v: number) => String(v || 0) },
                { label: 'Incassato', key: 'importo_incassato', f: (v: number) => `€ ${fmt(v)}` },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{row.label}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {confrontoCommesse.map(c => {
                      const val = (c[row.key as keyof Commessa] as number) || 0
                      const max = Math.max(...confrontoCommesse.map(x => (x[row.key as keyof Commessa] as number) || 0))
                      const s = calcolaSalute(c)
                      return (
                        <div key={c.id} style={{ flex: 1, background: 'var(--bg)', borderRadius: 7, padding: '8px 10px', border: `1px solid ${s.colore}30` }}>
                          <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 2 }} className="truncate">{c.codice}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: s.colore, fontFamily: 'var(--font-mono)' }}>{row.f(val)}</div>
                          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                            <div style={{ width: `${max > 0 ? (val/max)*100 : 0}%`, height: '100%', background: s.colore, borderRadius: 2 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

        ) : (
          /* DEFAULT: Scadenze + Azioni */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>⚠️ Scadenze</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {scadenze.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
                    <CheckCircle size={20} color="#10b981" style={{ marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
                    Nessuna scadenza critica
                  </div>
                ) : scadenze.map((s, i) => {
                  const col = s.giorni_rimasti <= 7 ? '#ef4444' : s.giorni_rimasti <= 30 ? '#f59e0b' : '#6b7280'
                  const tc: Record<string, string> = { SAL: '#3b82f6', DURC: '#f59e0b', SOA: '#8b5cf6' }
                  return (
                    <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: tc[s.tipo] || '#6b7280', marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: tc[s.tipo], textTransform: 'uppercase' }}>{s.tipo}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{s.giorni_rimasti}gg</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t1)', fontWeight: 500 }} className="truncate">{s.entita}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Lista commesse */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Commesse</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {['TUTTI', 'IN_ESECUZIONE', 'AGGIUDICATA', 'COLLAUDO', 'SOSPESA', 'CHIUSA'].map(s => (
              <button key={s} onClick={() => setFiltroStato(s)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: filtroStato === s ? (STATO_COLOR[s] || 'var(--accent)') : 'var(--panel)', color: filtroStato === s ? 'white' : 'var(--t3)' }}>
                {s === 'TUTTI' ? 'Tutte' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtrate.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
            {commesse.length === 0 ? (
              <div>
                <Building2 size={24} color="var(--t4)" style={{ marginBottom: 8 }} />
                <div style={{ marginBottom: 10 }}>Nessuna commessa · Inizia creandone una</div>
                <button onClick={() => router.push('/dashboard/commesse?new=true')} className="btn-primary" style={{ margin: '0 auto' }}>+ Nuova commessa</button>
              </div>
            ) : 'Nessuna commessa con questo filtro'}
          </div>
        ) : filtrate.map((c, i) => {
          const s = calcolaSalute(c)
          return (
            <div key={c.id} onClick={() => { setPinSelected(c); setTabPopup('info') }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < filtrate.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: pinSelected?.id === c.id ? 'var(--accent-light)' : 'transparent', transition: 'background 0.12s' }}
              onMouseEnter={e => { if (pinSelected?.id !== c.id) e.currentTarget.style.background = 'var(--panel-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = pinSelected?.id === c.id ? 'var(--accent-light)' : 'transparent' }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: s.colore, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{c.codice}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: STATO_COLOR[c.stato] || '#6b7280', background: `${STATO_COLOR[c.stato] || '#6b7280'}15`, borderRadius: 4, padding: '1px 5px' }}>{c.stato.replace('_', ' ')}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }} className="truncate">{c.nome}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <div style={{ width: 80, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${c.avanzamento_pct || 0}%`, height: '100%', background: s.colore }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--t3)' }}>{c.avanzamento_pct || 0}%</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(c.importo_aggiudicato)}</div>
                <div style={{ fontSize: 9, color: 'var(--t3)' }}>SAL: {c.n_sal_attivi || 0}</div>
              </div>
              <ArrowRight size={12} color="var(--t4)" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

declare global { interface Window { L: any } }
