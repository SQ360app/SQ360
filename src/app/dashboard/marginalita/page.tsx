'use client'

import { useState } from 'react'

import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3, ChevronDown, ChevronRight, Info } from 'lucide-react'

// ─── Tipi ────────────────────────────────────────────────────────────────────
interface VoceCosto {
  id: string
  codice: string
  descrizione: string
  tipo: string
  costo_prev: number
  costo_effettivo: number
  impegnato: number      // ordini emessi non ancora fatturati
  rimanente: number      // stima a finire
}

interface GruppoMarginalita {
  id: string
  titolo: string
  voci: VoceCosto[]
  espanso: boolean
}

// ─── Dati campione ───────────────────────────────────────────────────────────
const GRUPPI_INIT: GruppoMarginalita[] = [
  {
    id: 'g1', titolo: 'STRUTTURE', espanso: true,
    voci: [
      { id:'v1', codice:'01.001', descrizione:'Scavi', tipo:'nolo', costo_prev:2220, costo_effettivo:2180, impegnato:0, rimanente:0 },
      { id:'v2', codice:'01.002', descrizione:'Cls armato c.a.', tipo:'materiale', costo_prev:14025, costo_effettivo:12800, impegnato:1500, rimanente:0 },
      { id:'v3', codice:'01.003', descrizione:'Carpenteria metallica', tipo:'materiale', costo_prev:9240, costo_effettivo:9500, impegnato:0, rimanente:0 },
      { id:'v4', codice:'01.004', descrizione:'Posa carpenteria', tipo:'manodopera', costo_prev:13440, costo_effettivo:14800, impegnato:0, rimanente:200 },
    ]
  },
  {
    id: 'g2', titolo: 'OPERE EDILI', espanso: true,
    voci: [
      { id:'v5', codice:'02.001', descrizione:'Muratura laterizio (sub)', tipo:'subappalto', costo_prev:17100, costo_effettivo:16200, impegnato:900, rimanente:0 },
      { id:'v6', codice:'02.002', descrizione:'Intonaco civile (sub)', tipo:'subappalto', costo_prev:27720, costo_effettivo:0, impegnato:0, rimanente:27720 },
    ]
  },
  {
    id: 'g3', titolo: 'IMPIANTI', espanso: false,
    voci: [
      { id:'v7', codice:'03.001', descrizione:'Impianto elettrico (sub)', tipo:'subappalto', costo_prev:30240, costo_effettivo:0, impegnato:30240, rimanente:0 },
      { id:'v8', codice:'03.002', descrizione:'Impianto idrico (sub)', tipo:'subappalto', costo_prev:19980, costo_effettivo:0, impegnato:19980, rimanente:0 },
    ]
  },
  {
    id: 'g4', titolo: 'SPESE GENERALI E ONERI', espanso: false,
    voci: [
      { id:'v9', codice:'04.001', descrizione:'CSP/CSE', tipo:'altro', costo_prev:4500, costo_effettivo:4500, impegnato:0, rimanente:0 },
      { id:'v10', codice:'04.002', descrizione:'Polizza CAR', tipo:'altro', costo_prev:2200, costo_effettivo:2200, impegnato:0, rimanente:0 },
      { id:'v11', codice:'04.003', descrizione:'Smaltimento rifiuti', tipo:'altro', costo_prev:3800, costo_effettivo:2100, impegnato:0, rimanente:1800 },
    ]
  }
]

// ─── Utils ────────────────────────────────────────────────────────────────────
function fmt(n: number, sign = false) {
  const s = Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  if (sign) return (n >= 0 ? '+' : '−') + ' € ' + s
  return '€ ' + s
}
function pct(v: number, t: number) { return t === 0 ? 0 : (v / t) * 100 }
function scostamento(prev: number, eff: number, imp: number, rim: number) {
  const totale_attuale = eff + imp + rim
  return prev - totale_attuale
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function MarginalitaPage() {
  const [gruppi, setGruppi] = useState<GruppoMarginalita[]>(GRUPPI_INIT)
  const [importoNetto] = useState(294400) // importo contrattuale dopo ribasso
  const [salMaturato] = useState(180000)  // SAL attivi maturati

  // Totali globali
  const allVoci = gruppi.flatMap(g => g.voci)
  const totPrev = allVoci.reduce((s, v) => s + v.costo_prev, 0)
  const totEff = allVoci.reduce((s, v) => s + v.costo_effettivo, 0)
  const totImp = allVoci.reduce((s, v) => s + v.impegnato, 0)
  const totRim = allVoci.reduce((s, v) => s + v.rimanente, 0)
  const totAtFinire = totEff + totImp + totRim

  // Margini
  const margine_prev = importoNetto - totPrev
  const margine_corrente = salMaturato - totEff
  const margine_previsionale = importoNetto - totAtFinire
  const avanzamento_lavori_pct = pct(salMaturato, importoNetto)

  // Budget consumato
  const budget_consumato_pct = pct(totEff + totImp, totPrev)

  // Alert: voci in scostamento negativo > 5%
  const voci_alert = allVoci.filter(v => {
    const tot = v.costo_effettivo + v.impegnato + v.rimanente
    return tot > v.costo_prev * 1.05 && v.costo_prev > 0
  })

  function toggle(gid: string) {
    setGruppi(prev => prev.map(g => g.id === gid ? { ...g, espanso: !g.espanso } : g))
  }

  const TIPO_COLORS: Record<string, string> = { manodopera: '#3b82f6', nolo: '#f59e0b', materiale: '#10b981', subappalto: '#8b5cf6', altro: '#6b7280' }

  return (
    <>
      
      <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

        {/* Alert voci in scostamento */}
        {voci_alert.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fca5a5', marginBottom: 4 }}>
                {voci_alert.length} voc{voci_alert.length > 1 ? 'i' : 'e'} in scostamento negativo (&gt;5% del preventivo)
              </div>
              <div style={{ fontSize: 12, color: 'rgba(252,165,165,0.8)' }}>
                {voci_alert.map(v => v.descrizione).join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* KPI principali */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Importo contratto netto', val: fmt(importoNetto), sub: 'Dopo ribasso 8,5%', color: '#3b82f6', icon: null },
            { label: 'SAL maturato', val: fmt(salMaturato), sub: `${avanzamento_lavori_pct.toFixed(1)}% avanzamento`, color: '#f59e0b', icon: null },
            { label: 'Margine preventivato', val: fmt(margine_prev), sub: `${pct(margine_prev, importoNetto).toFixed(1)}%`, color: margine_prev >= 0 ? '#10b981' : '#ef4444', icon: margine_prev >= 0 ? TrendingUp : TrendingDown },
            { label: 'Margine previsionale', val: fmt(margine_previsionale), sub: `${pct(margine_previsionale, importoNetto).toFixed(1)}% a finire`, color: margine_previsionale >= 0 ? '#10b981' : '#ef4444', icon: margine_previsionale >= 0 ? TrendingUp : TrendingDown },
          ].map((k, i) => {
            const Icon = k.icon
            return (
              <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', borderLeft: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: k.color, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {Icon && <Icon size={16} color={k.color} />}
                  {k.val}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{k.sub}</div>
              </div>
            )
          })}
        </div>

        {/* Barre avanzamento */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Avanzamento lavori', val: avanzamento_lavori_pct, color: '#3b82f6', note: `${fmt(salMaturato)} / ${fmt(importoNetto)}` },
            { label: 'Budget consumato (eff + impegnato)', val: budget_consumato_pct, color: budget_consumato_pct > 100 ? '#ef4444' : budget_consumato_pct > 80 ? '#f59e0b' : '#10b981', note: `${fmt(totEff + totImp)} / ${fmt(totPrev)} prev.` },
          ].map((b, i) => (
            <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{b.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: b.color }}>{b.val.toFixed(1)}%</span>
              </div>
              <div style={{ height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(b.val, 100)}%`, height: '100%', background: b.color, borderRadius: 5, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>{b.note}</div>
            </div>
          ))}
        </div>

        {/* Tabella dettaglio costi */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 100px 110px 110px 110px 100px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            {['Codice', 'Voce', 'Tipo', 'Preventivo', 'Effettivo', 'Impegnato', 'A finire', 'Scostamento'].map(h => (
              <div key={h} style={{ padding: '10px 10px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>

          {gruppi.map(gruppo => {
            const totGPrev = gruppo.voci.reduce((s, v) => s + v.costo_prev, 0)
            const totGEff = gruppo.voci.reduce((s, v) => s + v.costo_effettivo, 0)
            const totGImp = gruppo.voci.reduce((s, v) => s + v.impegnato, 0)
            const totGRim = gruppo.voci.reduce((s, v) => s + v.rimanente, 0)
            const totGScost = totGPrev - (totGEff + totGImp + totGRim)

            return (
              <div key={gruppo.id}>
                {/* Riga gruppo */}
                <div
                  onClick={() => toggle(gruppo.id)}
                  style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 100px 110px 110px 110px 100px', background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <div style={{ padding: '10px', display: 'flex', alignItems: 'center' }}>
                    {gruppo.espanso ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </div>
                  <div style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: 'var(--t1)', display: 'flex', alignItems: 'center' }}>{gruppo.titolo}</div>
                  <div />
                  <div style={{ padding: '10px', fontSize: 12, fontWeight: 600, color: 'var(--t2)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totGPrev)}</div>
                  <div style={{ padding: '10px', fontSize: 12, fontWeight: 600, color: 'var(--t1)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totGEff)}</div>
                  <div style={{ padding: '10px', fontSize: 12, fontWeight: 600, color: '#f59e0b', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totGImp)}</div>
                  <div style={{ padding: '10px', fontSize: 12, fontWeight: 600, color: 'var(--t3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totGRim)}</div>
                  <div style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: totGScost >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                    {fmt(totGScost, true)}
                  </div>
                </div>

                {/* Righe voci */}
                {gruppo.espanso && gruppo.voci.map(voce => {
                  const scost = scostamento(voce.costo_prev, voce.costo_effettivo, voce.impegnato, voce.rimanente)
                  const scost_pct = voce.costo_prev > 0 ? (scost / voce.costo_prev) * 100 : 0
                  const isAlert = scost < 0 && Math.abs(scost_pct) > 5
                  return (
                    <div key={voce.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 100px 110px 110px 110px 100px', borderBottom: '1px solid var(--border)', background: isAlert ? 'rgba(239,68,68,0.04)' : 'var(--panel)' }}>
                      <div style={{ padding: '8px 10px', fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{voce.codice}</div>
                      <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isAlert && <AlertTriangle size={11} color="#ef4444" />}
                        {voce.descrizione}
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10, background: `${TIPO_COLORS[voce.tipo] ?? '#6b7280'}15`, color: TIPO_COLORS[voce.tipo] ?? '#6b7280', border: `1px solid ${TIPO_COLORS[voce.tipo] ?? '#6b7280'}40`, borderRadius: 5, padding: '2px 6px' }}>{voce.tipo}</span>
                      </div>
                      <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(voce.costo_prev)}</div>
                      <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--t1)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{voce.costo_effettivo > 0 ? fmt(voce.costo_effettivo) : '—'}</div>
                      <div style={{ padding: '8px 10px', fontSize: 12, color: '#f59e0b', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{voce.impegnato > 0 ? fmt(voce.impegnato) : '—'}</div>
                      <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{voce.rimanente > 0 ? fmt(voce.rimanente) : '—'}</div>
                      <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: scost >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                        {fmt(scost, true)}
                        {scost_pct !== 0 && <div style={{ fontSize: 9, opacity: 0.7 }}>{scost_pct.toFixed(1)}%</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Riga totale */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 100px 110px 110px 110px 100px', background: 'rgba(59,130,246,0.08)', borderTop: '2px solid var(--border)' }}>
            <div />
            <div style={{ padding: '12px 10px', fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>TOTALE COMMESSA</div>
            <div />
            <div style={{ padding: '12px 10px', fontSize: 13, fontWeight: 700, color: 'var(--t2)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totPrev)}</div>
            <div style={{ padding: '12px 10px', fontSize: 13, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totEff)}</div>
            <div style={{ padding: '12px 10px', fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totImp)}</div>
            <div style={{ padding: '12px 10px', fontSize: 13, fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totRim)}</div>
            <div style={{ padding: '12px 10px', fontSize: 14, fontWeight: 800, color: (totPrev - totAtFinire) >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
              {fmt(totPrev - totAtFinire, true)}
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { color: 'var(--t1)', label: 'Costi effettivi (fatturato)' },
            { color: '#f59e0b', label: 'Impegnato (ordini emessi)' },
            { color: 'var(--t3)', label: 'Stima a finire' },
            { color: '#10b981', label: 'Scostamento positivo (risparmio)' },
            { color: '#ef4444', label: 'Scostamento negativo (sforamento)' },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
