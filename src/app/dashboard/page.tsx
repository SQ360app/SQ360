'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowRight, AlertTriangle, CheckCircle, TrendingUp,
  Building2, Euro, Sparkles, Camera, FileText, X,
  Send, Zap, Activity, BarChart2, Clock
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
}

interface Scadenza {
  tipo: string
  entita: string
  data_scadenza: string
  giorni_rimasti: number
}

// Coordinate SVG per ogni provincia italiana (su viewport 500x600)
const PROV_SVG: Record<string, [number, number]> = {
  AO: [118, 68], VC: [128, 92], BI: [131, 96], NO: [122, 100], VB: [115, 80],
  TO: [112, 105], CN: [110, 128], AT: [130, 115], AL: [138, 112], SV: [132, 138],
  IM: [125, 148], GE: [145, 135], SP: [152, 142], MS: [160, 145], LU: [165, 150],
  PI: [163, 162], LI: [160, 170], GR: [170, 182], FI: [175, 155], PT: [170, 153],
  PO: [172, 150], AR: [182, 160], SI: [178, 170], MI: [148, 98], VA: [138, 90],
  CO: [142, 88], LC: [145, 90], MB: [144, 95], SO: [152, 82], BG: [152, 96],
  BS: [160, 98], MN: [165, 108], CR: [158, 108], LO: [150, 105], PV: [140, 110],
  PC: [148, 118], PR: [158, 122], RE: [163, 122], MO: [168, 122], BO: [172, 125],
  FE: [176, 118], RA: [181, 125], FC: [185, 130], RN: [190, 132], VR: [168, 102],
  PD: [174, 105], VI: [170, 100], TV: [177, 98], VE: [180, 103], RO: [175, 112],
  BL: [175, 88], TN: [162, 88], BZ: [160, 78], UD: [192, 88], PN: [185, 93],
  TS: [195, 102], GO: [193, 100], VT: [188, 168], RI: [195, 170], RM: [195, 182],
  LT: [193, 196], FR: [200, 192], AP: [198, 162], MC: [193, 158], AN: [192, 150],
  PU: [188, 142], PG: [188, 162], TR: [190, 172], TE: [205, 172], PE: [210, 178],
  CH: [213, 185], CB: [215, 192], IS: [212, 196], BN: [218, 200], AV: [215, 205],
  SA: [218, 215], NA: [215, 210], CE: [212, 202], CS: [230, 228], KR: [240, 232],
  CZ: [235, 238], RC: [232, 250], VV: [230, 245], MT: [238, 220], PZ: [228, 215],
  FG: [222, 190], BA: [228, 200], TA: [232, 210], BR: [235, 208], LE: [242, 215],
  PA: [200, 268], ME: [220, 262], CT: [232, 272], SR: [232, 280], RG: [226, 282],
  EN: [218, 272], CL: [214, 276], AG: [205, 278], TP: [196, 270], CA: [195, 318],
  SS: [168, 280], NU: [182, 295], OR: [172, 305], OG: [190, 308], SU: [185, 315],
  default: [195, 182]
}

const STATO_COLOR: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6', COLLAUDO: '#8b5cf6',
  SOSPESA: '#ef4444', CHIUSA: '#64748b', ACQUISITA: '#94a3b8'
}

function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtM(n: number) { return n >= 1000000 ? `€ ${(n / 1000000).toFixed(1)}M` : `€ ${fmt(n)}` }

// Calcola la "salute" del cantiere (0-100)
function calcolaSalute(c: Commessa): { score: number; colore: string; label: string } {
  let score = 100
  const giorniFine = c.data_fine_contrattuale
    ? Math.ceil((new Date(c.data_fine_contrattuale).getTime() - Date.now()) / 86400000)
    : 180
  if (giorniFine < 0) score -= 30
  else if (giorniFine < 30) score -= 15
  if (c.avanzamento_pct < 10 && giorniFine < 180) score -= 20
  if (c.n_sal_attivi === 0 && c.stato === 'IN_ESECUZIONE') score -= 10
  if (c.stato === 'SOSPESA') score = 20
  if (score >= 80) return { score, colore: '#10b981', label: 'Ottimo' }
  if (score >= 60) return { score, colore: '#f59e0b', label: 'Attenzione' }
  return { score, colore: '#ef4444', label: 'Critico' }
}

// Tab popup
type TabPopup = 'info' | 'ai' | 'rapportino' | 'confronto'

export default function DashboardPage() {
  const router = useRouter()
  const [commesse, setCommesse] = useState<Commessa[]>([])
  const [scadenze, setScadenze] = useState<Scadenza[]>([])
  const [loading, setLoading] = useState(true)
  const [pinSelected, setPinSelected] = useState<Commessa | null>(null)
  const [tabPopup, setTabPopup] = useState<TabPopup>('info')
  const [filtroStato, setFiltroStato] = useState('TUTTI')
  const [confrontoIds, setConfrontoIds] = useState<string[]>([])
  const [aiDomanda, setAiDomanda] = useState('')
  const [aiRisposta, setAiRisposta] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [rapportino, setRapportino] = useState({ lavorazioni: '', operai: '', note: '' })
  const [rapportinoSent, setRapportinoSent] = useState(false)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const [{ data: kpi }, { data: scad }, { data: det }] = await Promise.all([
      supabase.from('v_commesse_kpi').select('*').order('stato'),
      supabase.from('v_scadenze_prossime').select('*').limit(8),
      supabase.from('commesse').select('id,provincia,dl_nome,dl_email,data_fine_contrattuale')
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
  }

  const filtrate = commesse.filter(c => filtroStato === 'TUTTI' || c.stato === filtroStato)
  const portafoglio = commesse.filter(c => c.stato !== 'CHIUSA').reduce((s, c) => s + (c.importo_aggiudicato || 0), 0)
  const inEsecuzione = commesse.filter(c => c.stato === 'IN_ESECUZIONE').length
  const incassato = commesse.reduce((s, c) => s + (c.importo_incassato || 0), 0)
  const salScadenza = scadenze.filter(s => s.tipo === 'SAL').length
  const durcScadenza = scadenze.filter(s => s.tipo === 'DURC').length

  function toggleConfronto(id: string) {
    setConfrontoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev)
  }

  async function chiediAI() {
    if (!pinSelected || !aiDomanda.trim()) return
    setAiLoading(true)
    setAiRisposta('')
    try {
      const res = await fetch('/api/ai-commessa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commessaId: pinSelected.id, domanda: aiDomanda })
      })
      const data = await res.json()
      setAiRisposta(data.risposta || 'Nessuna risposta disponibile')
    } catch {
      setAiRisposta('Servizio AI temporaneamente non disponibile. Riprova.')
    }
    setAiLoading(false)
  }

  async function inviaRapportino() {
    if (!pinSelected || !rapportino.lavorazioni) return
    await supabase.from('rapportini').insert([{
      commessa_id: pinSelected.id,
      azienda_id: 'f5ddf460-715a-495e-997a-0246ea73326b',
      data: new Date().toISOString().slice(0, 10),
      numero: 1,
      note_cantiere: rapportino.note,
      lavorazioni: [{ descrizione: rapportino.lavorazioni }],
      manodopera: [{ categoria: 'operai', n_operai: parseInt(rapportino.operai) || 0, ore: 8 }]
    }])
    setRapportinoSent(true)
    setTimeout(() => { setRapportinoSent(false); setRapportino({ lavorazioni: '', operai: '', note: '' }) }, 2000)
  }

  const commesseDaComparare = commesse.filter(c => confrontoIds.includes(c.id))

  return (
    <div style={{ padding: '18px 22px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {confrontoIds.length >= 2 && (
            <button onClick={() => setPinSelected(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#8b5cf6', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <BarChart2 size={13} /> Confronta {confrontoIds.length} cantieri
            </button>
          )}
        </div>
      </div>

      {/* Alert */}
      {(salScadenza > 0 || durcScadenza > 0) && (
        <div className="alert alert-warning" style={{ marginBottom: 14, fontSize: 12 }}>
          <AlertTriangle size={14} color="#f59e0b" />
          <span>
            {salScadenza > 0 && <><strong>{salScadenza} SAL</strong> in scadenza · </>}
            {durcScadenza > 0 && <><strong>{durcScadenza} DURC</strong> in scadenza</>}
          </span>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { icon: Building2, label: 'In esecuzione', val: inEsecuzione, color: '#10b981' },
          { icon: Euro, label: 'Portafoglio', val: fmtM(portafoglio), color: '#3b82f6', mono: true },
          { icon: TrendingUp, label: 'Incassato', val: fmtM(incassato), color: '#8b5cf6', mono: true },
          { icon: CheckCircle, label: 'Tot. commesse', val: commesse.length, color: '#6b7280' },
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

      {/* Layout principale: Mappa + Pannello */}
      <div style={{ display: 'grid', gridTemplateColumns: pinSelected ? '1fr 420px' : confrontoIds.length >= 2 ? '1fr 400px' : '1fr 280px', gap: 14, marginBottom: 14 }}>

        {/* CANTIERE PULSE — Mappa SVG Italia */}
        <div className="card" style={{ overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>CantierePulse</span>
            <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 4 }}>• Live</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)' }}>
              Clicca un pin per azioni rapide · Shift+click per confrontare
            </span>
            {/* Legenda */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ c: '#10b981', l: 'OK' }, { c: '#f59e0b', l: 'Attenzione' }, { c: '#ef4444', l: 'Critico' }].map(s => (
                <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.c }} />
                  <span style={{ fontSize: 9, color: 'var(--t3)' }}>{s.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SVG Italia */}
          <div style={{ position: 'relative', background: '#f0f4f8', height: 420, overflow: 'hidden' }}>
            <svg viewBox="90 60 170 290" style={{ width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
              {/* Sfondo mare */}
              <rect x="90" y="60" width="170" height="290" fill="#dbeafe" opacity="0.3" />
              {/* Silhouette Italia semplificata */}
              <path d="M135,75 L150,72 L165,78 L175,85 L180,95 L190,98 L198,102 L195,110 L188,115 L195,120 L200,130 L198,140 L192,148 L195,158 L198,168 L202,178 L208,185 L215,195 L218,205 L220,215 L225,225 L230,235 L232,245 L228,255 L222,262 L210,265 L205,272 L200,280 L195,285 L190,310 L185,320 L178,318 L175,308 L178,295 L172,285 L165,278 L162,268 L168,258 L172,248 L165,240 L158,232 L152,225 L148,215 L144,205 L140,195 L135,188 L130,178 L128,168 L132,158 L135,148 L130,138 L125,128 L118,118 L115,108 L118,98 L125,90 L130,82 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.8" />
              {/* Sicilia */}
              <path d="M195,265 L215,260 L228,265 L235,272 L238,280 L230,285 L218,285 L205,280 L198,273 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.8" />
              {/* Sardegna */}
              <path d="M165,278 L178,275 L185,282 L188,295 L185,308 L178,315 L168,312 L162,300 L163,288 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.8" />

              {/* PINS CANTIERI */}
              {commesse.filter(c => c.stato !== 'CHIUSA').map(c => {
                const coords = PROV_SVG[c.provincia] || PROV_SVG.default
                const salute = calcolaSalute(c)
                const isSelected = pinSelected?.id === c.id
                const isConfronto = confrontoIds.includes(c.id)

                return (
                  <g key={c.id}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      if (e.shiftKey) { toggleConfronto(c.id) }
                      else { setPinSelected(prev => prev?.id === c.id ? null : c); setTabPopup('info'); setAiRisposta('') }
                    }}>
                    {/* Pulso animato per cantieri critici */}
                    {salute.score < 60 && (
                      <circle cx={coords[0]} cy={coords[1]} r="12" fill={salute.colore} opacity="0.2">
                        <animate attributeName="r" from="8" to="16" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* Pin base */}
                    <circle cx={coords[0]} cy={coords[1]} r={isSelected ? 10 : isConfronto ? 9 : 7}
                      fill={isConfronto ? '#8b5cf6' : salute.colore}
                      stroke="white"
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter={isSelected ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : undefined}
                    />
                    {/* Percentuale avanzamento */}
                    <text x={coords[0]} y={coords[1] + 0.5} textAnchor="middle" dominantBaseline="middle"
                      fontSize="4" fontWeight="bold" fill="white" fontFamily="Inter, sans-serif">
                      {isConfronto ? '★' : `${c.avanzamento_pct || 0}%`}
                    </text>
                    {/* Tooltip area invisibile per hover */}
                    <title>{c.codice} — {c.nome}\n{STATO_COLOR[c.stato] ? c.stato.replace('_', ' ') : ''}\n€ {fmt(c.importo_aggiudicato)}</title>
                  </g>
                )
              })}
            </svg>

            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,0.8)' }}>
                <div className="spinner" />
              </div>
            )}

            {commesse.filter(c => c.stato !== 'CHIUSA').length === 0 && !loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <Building2 size={28} color="var(--t4)" />
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>Nessun cantiere attivo</span>
                <button onClick={() => router.push('/dashboard/commesse?new=true')} className="btn-primary" style={{ fontSize: 11, padding: '6px 14px' }}>+ Nuova commessa</button>
              </div>
            )}
          </div>
        </div>

        {/* PANNELLO DESTRA */}
        {pinSelected ? (
          /* POPUP COMMESSA SELEZIONATA */
          <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header popup */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{pinSelected.codice}</span>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: calcolaSalute(pinSelected).colore, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 600, color: calcolaSalute(pinSelected).colore }}>{calcolaSalute(pinSelected).label}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }} className="truncate">{pinSelected.nome}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>{pinSelected.committente}</div>
                </div>
                <button onClick={() => setPinSelected(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X size={14} color="var(--t3)" />
                </button>
              </div>
            </div>

            {/* Tab selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              {[
                { key: 'info', icon: Activity, label: 'KPI' },
                { key: 'ai', icon: Sparkles, label: 'AI' },
                { key: 'rapportino', icon: FileText, label: 'Rapportino' },
              ].map(t => (
                <button key={t.key} onClick={() => setTabPopup(t.key as TabPopup)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 4px', border: 'none', background: 'transparent', borderBottom: tabPopup === t.key ? '2px solid var(--accent)' : '2px solid transparent', color: tabPopup === t.key ? 'var(--accent)' : 'var(--t3)', fontSize: 11, fontWeight: tabPopup === t.key ? 700 : 400, cursor: 'pointer' }}>
                  <t.icon size={11} />{t.label}
                </button>
              ))}
            </div>

            {/* Contenuto tab */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>

              {/* KPI */}
              {tabPopup === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Importo', val: `€ ${fmt(pinSelected.importo_aggiudicato)}`, color: '#3b82f6' },
                      { label: 'Avanzamento', val: `${pinSelected.avanzamento_pct || 0}%`, color: calcolaSalute(pinSelected).colore },
                      { label: 'SAL emessi', val: String(pinSelected.n_sal_attivi || 0), color: '#8b5cf6' },
                      { label: 'Incassato', val: `€ ${fmt(pinSelected.importo_incassato)}`, color: '#10b981' },
                    ].map(k => (
                      <div key={k.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barra salute */}
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Salute commessa</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: calcolaSalute(pinSelected).colore }}>{calcolaSalute(pinSelected).score}/100</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${calcolaSalute(pinSelected).score}%`, height: '100%', background: calcolaSalute(pinSelected).colore, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                  </div>

                  {pinSelected.dl_nome && (
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Direttore Lavori</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{pinSelected.dl_nome}</div>
                      {pinSelected.dl_email && <div style={{ fontSize: 10, color: 'var(--t3)' }}>{pinSelected.dl_email}</div>}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => router.push(`/dashboard/commesse/${pinSelected.id}`)} className="btn-primary" style={{ flex: 1, fontSize: 12, padding: '9px', justifyContent: 'center' }}>
                      Apri commessa <ArrowRight size={12} />
                    </button>
                    <button onClick={() => toggleConfronto(pinSelected.id)}
                      style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${confrontoIds.includes(pinSelected.id) ? '#8b5cf6' : 'var(--border)'}`, background: confrontoIds.includes(pinSelected.id) ? 'rgba(139,92,246,0.08)' : 'var(--bg)', color: confrontoIds.includes(pinSelected.id) ? '#8b5cf6' : 'var(--t3)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      {confrontoIds.includes(pinSelected.id) ? '★ Sel.' : '☆ Sel.'}
                    </button>
                  </div>
                </div>
              )}

              {/* AI CHAT */}
              {tabPopup === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Sparkles size={12} color="var(--accent)" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>AI Commessa</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>Chiedi qualsiasi cosa su <strong>{pinSelected.codice}</strong></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['Qual è il margine attuale?', 'Ci sono scadenze urgenti?', 'Stato dei subappalti?', 'Avanzamento vs Gantt?'].map(q => (
                      <button key={q} onClick={() => setAiDomanda(q)}
                        style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 11, cursor: 'pointer', textAlign: 'left' }}>
                        💬 {q}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={aiDomanda} onChange={e => setAiDomanda(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && chiediAI()}
                      placeholder="Chiedi all'AI..." style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--t1)' }} />
                    <button onClick={chiediAI} disabled={aiLoading} style={{ padding: '8px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'white', cursor: aiLoading ? 'wait' : 'pointer' }}>
                      <Send size={13} />
                    </button>
                  </div>
                  {aiLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--t3)' }}>
                      <div className="spinner" style={{ width: 12, height: 12 }} /> Analisi in corso...
                    </div>
                  )}
                  {aiRisposta && (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
                      {aiRisposta}
                    </div>
                  )}
                </div>
              )}

              {/* RAPPORTINO RAPIDO */}
              {tabPopup === 'rapportino' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#065f46' }}>
                    📋 Rapportino rapido per <strong>{pinSelected.codice}</strong> — {new Date().toLocaleDateString('it-IT')}
                  </div>
                  {rapportinoSent ? (
                    <div style={{ textAlign: 'center', padding: 24, color: '#10b981' }}>
                      <CheckCircle size={28} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Rapportino inviato!</div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Lavorazioni eseguite *</label>
                        <textarea value={rapportino.lavorazioni} onChange={e => setRapportino(p => ({ ...p, lavorazioni: e.target.value }))}
                          placeholder="es. Posa massetto piano primo..." rows={3}
                          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--t1)', resize: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>N° operai presenti</label>
                        <input type="number" value={rapportino.operai} onChange={e => setRapportino(p => ({ ...p, operai: e.target.value }))}
                          placeholder="0" style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--t1)' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Note</label>
                        <input value={rapportino.note} onChange={e => setRapportino(p => ({ ...p, note: e.target.value }))}
                          placeholder="Meteo, problemi, consegne..." style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--t1)' }} />
                      </div>
                      <button onClick={inviaRapportino} disabled={!rapportino.lavorazioni} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                        <Zap size={13} /> Invia rapportino istantaneo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

        ) : confrontoIds.length >= 2 ? (
          /* PANNELLO CONFRONTO */
          <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>⚖️ Confronto cantieri</span>
              <button onClick={() => setConfrontoIds([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 11 }}>Pulisci</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {[
                { label: 'Importo', key: 'importo_aggiudicato', fmt: (v: number) => `€ ${fmt(v)}` },
                { label: 'Avanzamento', key: 'avanzamento_pct', fmt: (v: number) => `${v || 0}%` },
                { label: 'SAL emessi', key: 'n_sal_attivi', fmt: (v: number) => String(v || 0) },
                { label: 'Incassato', key: 'importo_incassato', fmt: (v: number) => `€ ${fmt(v)}` },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{row.label}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {commesseDaComparare.map(c => {
                      const val = c[row.key as keyof Commessa] as number
                      const max = Math.max(...commesseDaComparare.map(x => (x[row.key as keyof Commessa] as number) || 0))
                      const pct = max > 0 ? (val / max) * 100 : 0
                      const salute = calcolaSalute(c)
                      return (
                        <div key={c.id} style={{ flex: 1, background: 'var(--bg)', borderRadius: 7, padding: '8px 10px', border: `1px solid ${salute.colore}30` }}>
                          <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 3 }} className="truncate">{c.codice}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: salute.colore, fontFamily: 'var(--font-mono)' }}>{row.fmt(val)}</div>
                          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: salute.colore, borderRadius: 2 }} />
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
          /* PANNELLO DEFAULT: Scadenze + Azioni */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>⚠️ Scadenze</span>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {scadenze.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
                    <CheckCircle size={18} color="#10b981" style={{ marginBottom: 4 }} /><div>Nessuna scadenza critica</div>
                  </div>
                ) : scadenze.map((s, i) => {
                  const col = s.giorni_rimasti <= 7 ? '#ef4444' : s.giorni_rimasti <= 30 ? '#f59e0b' : '#6b7280'
                  const tipoCol: Record<string, string> = { SAL: '#3b82f6', DURC: '#f59e0b', SOA: '#8b5cf6' }
                  return (
                    <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: tipoCol[s.tipo] || '#6b7280', marginTop: 3, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: tipoCol[s.tipo], textTransform: 'uppercase' }}>{s.tipo}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{s.giorni_rimasti}gg</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t1)', fontWeight: 500 }} className="truncate">{s.entita}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Azioni rapide</div>
              {[
                { label: '+ Nuova commessa', href: '/dashboard/commesse?new=true', color: '#3b82f6' },
                { label: '+ Nuova gara', href: '/dashboard/gare?new=true', color: '#f59e0b' },
                { label: '+ Nuovo fornitore', href: '/dashboard/fornitori?new=true', color: '#10b981' },
              ].map(a => (
                <button key={a.label} onClick={() => router.push(a.href)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${a.color}25`, background: `${a.color}06`, color: a.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', marginBottom: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: a.color }} />{a.label}
                  <ArrowRight size={10} style={{ marginLeft: 'auto' }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lista commesse compatta */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Commesse</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {['TUTTI', 'IN_ESECUZIONE', 'AGGIUDICATA', 'COLLAUDO', 'SOSPESA'].map(s => (
              <button key={s} onClick={() => setFiltroStato(s)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: filtroStato === s ? (STATO_COLOR[s] || 'var(--accent)') : 'var(--panel)', color: filtroStato === s ? 'white' : 'var(--t3)' }}>
                {s === 'TUTTI' ? 'Tutte' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtrate.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>Nessuna commessa</div>
        ) : filtrate.map((c, i) => {
          const col = STATO_COLOR[c.stato] || '#6b7280'
          const salute = calcolaSalute(c)
          return (
            <div key={c.id} onClick={() => { setPinSelected(c); setTabPopup('info') }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < filtrate.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.12s', background: pinSelected?.id === c.id ? 'var(--accent-light)' : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
              onMouseLeave={e => e.currentTarget.style.background = pinSelected?.id === c.id ? 'var(--accent-light)' : 'transparent'}
            >
              <div style={{ width: 4, height: 40, borderRadius: 2, background: salute.colore, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{c.codice}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: col, background: `${col}15`, borderRadius: 4, padding: '1px 5px' }}>{c.stato.replace('_', ' ')}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }} className="truncate">{c.nome}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <div style={{ width: 80, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${c.avanzamento_pct || 0}%`, height: '100%', background: salute.colore }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--t3)' }}>{c.avanzamento_pct || 0}%</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(c.importo_aggiudicato)}</div>
              </div>
              <ArrowRight size={12} color="var(--t4)" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
