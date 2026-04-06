'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Plus, Trash2, Copy, ChevronDown, ChevronRight, Calculator, Download, Upload, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'

// ─── Tipi ────────────────────────────────────────────────────────────────────
type TipoVoce = 'manodopera' | 'nolo' | 'materiale' | 'subappalto' | 'altro'
type CategoriaSpesa = 'DIRETTA' | 'INDIRETTA' | 'GENERALI'

interface VocePreventivo {
  id: string
  codice: string
  descrizione: string
  tipo: TipoVoce
  categoria: CategoriaSpesa
  um: string
  quantita: number
  costo_unitario: number
  ricarico_pct: number
  note: string
  espanso: boolean
}

interface GruppoPreventivo {
  id: string
  codice: string
  titolo: string
  voci: VocePreventivo[]
  espanso: boolean
}

// ─── Dati campione ───────────────────────────────────────────────────────────
const PREVENTIVO_INIT: GruppoPreventivo[] = [
  {
    id: 'g1', codice: '01', titolo: 'OPERE STRUTTURALI', espanso: true,
    voci: [
      { id:'v1', codice:'01.001', descrizione:'Scavo a sezione obbligata', tipo:'nolo', categoria:'DIRETTA', um:'mc', quantita:120, costo_unitario:18.50, ricarico_pct:0, note:'', espanso:false },
      { id:'v2', codice:'01.002', descrizione:'Cls armato C28/35 fondazioni', tipo:'materiale', categoria:'DIRETTA', um:'mc', quantita:85, costo_unitario:165, ricarico_pct:0, note:'', espanso:false },
      { id:'v3', codice:'01.003', descrizione:'Carpenteria metall. travi HEA', tipo:'materiale', categoria:'DIRETTA', um:'kg', quantita:4200, costo_unitario:2.20, ricarico_pct:0, note:'', espanso:false },
      { id:'v4', codice:'01.004', descrizione:'Posa carpenteria metallica', tipo:'manodopera', categoria:'DIRETTA', um:'h', quantita:320, costo_unitario:42, ricarico_pct:0, note:'', espanso:false },
    ]
  },
  {
    id: 'g2', codice: '02', titolo: 'OPERE EDILI', espanso: true,
    voci: [
      { id:'v5', codice:'02.001', descrizione:'Muratura in laterizio 30cm', tipo:'subappalto', categoria:'DIRETTA', um:'mq', quantita:380, costo_unitario:45, ricarico_pct:5, note:'Muratori Rossi srl', espanso:false },
      { id:'v6', codice:'02.002', descrizione:'Intonaco civile interno', tipo:'subappalto', categoria:'DIRETTA', um:'mq', quantita:1200, costo_unitario:22, ricarico_pct:5, note:'', espanso:false },
    ]
  },
  {
    id: 'g3', codice: '03', titolo: 'IMPIANTI', espanso: false,
    voci: [
      { id:'v7', codice:'03.001', descrizione:'Impianto elettrico BT', tipo:'subappalto', categoria:'DIRETTA', um:'corpo', quantita:1, costo_unitario:28000, ricarico_pct:8, note:'Da mettere a gara', espanso:false },
      { id:'v8', codice:'03.002', descrizione:'Impianto idrico-sanitario', tipo:'subappalto', categoria:'DIRETTA', um:'corpo', quantita:1, costo_unitario:18500, ricarico_pct:8, note:'', espanso:false },
    ]
  },
  {
    id: 'g4', codice: '04', titolo: 'SPESE GENERALI E ONERI', espanso: false,
    voci: [
      { id:'v9', codice:'04.001', descrizione:'Coordinatore sicurezza CSP/CSE', tipo:'altro', categoria:'INDIRETTA', um:'corpo', quantita:1, costo_unitario:4500, ricarico_pct:0, note:'', espanso:false },
      { id:'v10', codice:'04.002', descrizione:'Polizza CAR', tipo:'altro', categoria:'GENERALI', um:'corpus', quantita:1, costo_unitario:2200, ricarico_pct:0, note:'', espanso:false },
      { id:'v11', codice:'04.003', descrizione:'Oneri smaltimento rifiuti', tipo:'altro', categoria:'DIRETTA', um:'corpo', quantita:1, costo_unitario:3800, ricarico_pct:0, note:'', espanso:false },
    ]
  }
]

const TIPO_COLORS: Record<TipoVoce, string> = {
  manodopera: '#3b82f6',
  nolo: '#f59e0b',
  materiale: '#10b981',
  subappalto: '#8b5cf6',
  altro: '#6b7280'
}
const TIPO_LABELS: Record<TipoVoce, string> = {
  manodopera: 'Manodopera',
  nolo: 'Nolo',
  materiale: 'Materiale',
  subappalto: 'Subappalto',
  altro: 'Altro'
}
const CAT_COLORS: Record<CategoriaSpesa, string> = {
  DIRETTA: '#10b981',
  INDIRETTA: '#f59e0b',
  GENERALI: '#ef4444'
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function costoVoce(v: VocePreventivo) {
  return v.quantita * v.costo_unitario * (1 + v.ricarico_pct / 100)
}
function fmt(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function uid() { return Math.random().toString(36).slice(2, 8) }

// ─── Componente principale ───────────────────────────────────────────────────
export default function PreventivazioneePage() {
  const [gruppi, setGruppi] = useState<GruppoPreventivo[]>(PREVENTIVO_INIT)
  const [importoContrattuale, setImportoContrattuale] = useState(320000)
  const [ribassoOfferto, setRibassoOfferto] = useState(8.5)
  const [commessa, setCommessa] = useState('C-2024-007 — Palazzina via Roma')

  // ── Calcoli globali ──
  const totaleCostiDiretti = gruppi.flatMap(g => g.voci).filter(v => v.categoria === 'DIRETTA').reduce((s, v) => s + costoVoce(v), 0)
  const totaleCostiIndiretti = gruppi.flatMap(g => g.voci).filter(v => v.categoria === 'INDIRETTA').reduce((s, v) => s + costoVoce(v), 0)
  const totaleCostiGenerali = gruppi.flatMap(g => g.voci).filter(v => v.categoria === 'GENERALI').reduce((s, v) => s + costoVoce(v), 0)
  const totaleCosti = totaleCostiDiretti + totaleCostiIndiretti + totaleCostiGenerali
  const importoNetto = importoContrattuale * (1 - ribassoOfferto / 100)
  const margine = importoNetto - totaleCosti
  const margine_pct = importoNetto > 0 ? (margine / importoNetto) * 100 : 0

  // ── Breakdown per tipo ──
  const perTipo: Record<TipoVoce, number> = { manodopera: 0, nolo: 0, materiale: 0, subappalto: 0, altro: 0 }
  gruppi.flatMap(g => g.voci).forEach(v => { perTipo[v.tipo] += costoVoce(v) })

  function toggleGruppo(gid: string) {
    setGruppi(prev => prev.map(g => g.id === gid ? { ...g, espanso: !g.espanso } : g))
  }

  function updateVoce(gid: string, vid: string, field: keyof VocePreventivo, val: unknown) {
    setGruppi(prev => prev.map(g => g.id !== gid ? g : {
      ...g,
      voci: g.voci.map(v => v.id !== vid ? v : { ...v, [field]: val })
    }))
  }

  function addVoce(gid: string) {
    const newVoce: VocePreventivo = {
      id: uid(), codice: '', descrizione: 'Nuova voce', tipo: 'materiale',
      categoria: 'DIRETTA', um: 'mc', quantita: 1, costo_unitario: 0,
      ricarico_pct: 0, note: '', espanso: false
    }
    setGruppi(prev => prev.map(g => g.id !== gid ? g : { ...g, voci: [...g.voci, newVoce] }))
  }

  function removeVoce(gid: string, vid: string) {
    setGruppi(prev => prev.map(g => g.id !== gid ? g : { ...g, voci: g.voci.filter(v => v.id !== vid) }))
  }

  function addGruppo() {
    const n = gruppi.length + 1
    setGruppi(prev => [...prev, {
      id: uid(), codice: String(n).padStart(2,'0'), titolo: 'NUOVO GRUPPO', espanso: true, voci: []
    }])
  }

  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: 'var(--t2)' }

  return (
    <>
      <Header title="M2 — Preventivazione Costi Propri" breadcrumb={['Dashboard', 'Preventivazione']} />
      <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

        {/* Barra commessa + parametri */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Commessa</label>
            <input value={commessa} onChange={e => setCommessa(e.target.value)} style={{
              display: 'block', width: '100%', background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--t1)', fontSize: 14, marginTop: 4
            }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Importo base gara (€)</label>
            <input type="number" value={importoContrattuale} onChange={e => setImportoContrattuale(+e.target.value)} style={{
              display: 'block', background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--t1)', fontSize: 14, marginTop: 4, width: 160
            }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ribasso offerto (%)</label>
            <input type="number" step="0.01" value={ribassoOfferto} onChange={e => setRibassoOfferto(+e.target.value)} style={{
              display: 'block', background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--t1)', fontSize: 14, marginTop: 4, width: 120
            }} />
          </div>
          <button onClick={addGruppo} style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 18,
            background: 'var(--accent)', border: 'none', borderRadius: 8,
            padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>
            <Plus size={14} /> Nuovo gruppo
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 18,
            background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '9px 16px', color: 'var(--t2)', fontSize: 13, cursor: 'pointer'
          }}>
            <Download size={14} /> Esporta Excel
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 18,
            background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '9px 16px', color: 'var(--t2)', fontSize: 13, cursor: 'pointer'
          }}>
            <Upload size={14} /> Importa XLS/CSV
          </button>
        </div>

        {/* KPI Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Importo contrattuale', val: `€ ${fmt(importoContrattuale)}`, sub: `Ribasso ${ribassoOfferto}%`, color: '#3b82f6' },
            { label: 'Importo netto', val: `€ ${fmt(importoNetto)}`, sub: 'Dopo ribasso', color: '#1d4ed8' },
            { label: 'Tot. costi interni', val: `€ ${fmt(totaleCosti)}`, sub: `Dir ${fmt(totaleCostiDiretti)} | Ind ${fmt(totaleCostiIndiretti)}`, color: '#f59e0b' },
            { label: 'Margine stimato', val: `€ ${fmt(margine)}`, sub: `${fmt(margine_pct)}% sull'importo netto`, color: margine >= 0 ? '#10b981' : '#ef4444' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', borderLeft: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Alert margine negativo */}
        {margine < 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <AlertCircle size={16} color="#ef4444" />
            <span style={{ color: '#fca5a5', fontSize: 13 }}>
              <strong>Attenzione:</strong> i costi stimati superano l'importo netto di € {fmt(Math.abs(margine))}. Rivedere le voci o il ribasso.
            </span>
          </div>
        )}

        {/* Breakdown per tipo */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ripartizione costi per natura</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(perTipo) as TipoVoce[]).map(tipo => (
              <div key={tipo} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: `${TIPO_COLORS[tipo]}15`, border: `1px solid ${TIPO_COLORS[tipo]}40`,
                borderRadius: 8, padding: '6px 12px'
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: TIPO_COLORS[tipo] }} />
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>{TIPO_LABELS[tipo]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: TIPO_COLORS[tipo], fontFamily: 'var(--font-mono)' }}>
                  € {fmt(perTipo[tipo])} ({totaleCosti > 0 ? fmt(perTipo[tipo] / totaleCosti * 100) : '0'}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabella preventivo */}
        {gruppi.map(gruppo => (
          <div key={gruppo.id} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            {/* Header gruppo */}
            <div
              onClick={() => toggleGruppo(gruppo.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', cursor: 'pointer',
                background: gruppo.espanso ? 'rgba(59,130,246,0.06)' : 'transparent',
                borderBottom: gruppo.espanso ? '1px solid var(--border)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {gruppo.espanso ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{gruppo.codice} — {gruppo.titolo}</span>
                <span style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 8px' }}>
                  {gruppo.voci.length} voci
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--t1)' }}>
                  € {fmt(gruppo.voci.reduce((s, v) => s + costoVoce(v), 0))}
                </span>
              </div>
            </div>

            {/* Voci */}
            {gruppo.espanso && (
              <div>
                {/* Header colonne */}
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 60px 80px 90px 70px 60px 100px 36px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Codice', 'Descrizione', 'Tipo', 'Cat.', 'U.M.', 'Quantità', 'C.U. (€)', 'Ric%', 'Totale', ''].map((h, i) => (
                    <div key={i} style={{ ...cell, fontWeight: 600, color: 'var(--t3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                  ))}
                </div>

                {gruppo.voci.map(voce => (
                  <div key={voce.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 60px 80px 90px 70px 60px 100px 36px', borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
                    <div style={cell}>
                      <input value={voce.codice} onChange={e => updateVoce(gruppo.id, voce.id, 'codice', e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t2)', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div style={cell}>
                      <input value={voce.descrizione} onChange={e => updateVoce(gruppo.id, voce.id, 'descrizione', e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t1)', fontSize: 12 }} />
                    </div>
                    <div style={{ ...cell, padding: '4px 6px' }}>
                      <select value={voce.tipo} onChange={e => updateVoce(gruppo.id, voce.id, 'tipo', e.target.value as TipoVoce)}
                        style={{ background: `${TIPO_COLORS[voce.tipo]}18`, border: `1px solid ${TIPO_COLORS[voce.tipo]}50`, borderRadius: 6, color: TIPO_COLORS[voce.tipo], fontSize: 10, padding: '3px 4px', width: '100%' }}>
                        {(Object.keys(TIPO_LABELS) as TipoVoce[]).map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div style={{ ...cell, padding: '4px 6px' }}>
                      <select value={voce.categoria} onChange={e => updateVoce(gruppo.id, voce.id, 'categoria', e.target.value as CategoriaSpesa)}
                        style={{ background: `${CAT_COLORS[voce.categoria]}15`, border: `1px solid ${CAT_COLORS[voce.categoria]}40`, borderRadius: 6, color: CAT_COLORS[voce.categoria], fontSize: 10, padding: '3px 4px', width: '100%' }}>
                        <option value="DIRETTA">DIR</option>
                        <option value="INDIRETTA">IND</option>
                        <option value="GENERALI">GEN</option>
                      </select>
                    </div>
                    <div style={cell}>
                      <input value={voce.um} onChange={e => updateVoce(gruppo.id, voce.id, 'um', e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t2)', fontSize: 11, textAlign: 'center' }} />
                    </div>
                    <div style={cell}>
                      <input type="number" value={voce.quantita} onChange={e => updateVoce(gruppo.id, voce.id, 'quantita', +e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t1)', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                    </div>
                    <div style={cell}>
                      <input type="number" step="0.01" value={voce.costo_unitario} onChange={e => updateVoce(gruppo.id, voce.id, 'costo_unitario', +e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t1)', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                    </div>
                    <div style={cell}>
                      <input type="number" step="0.5" value={voce.ricarico_pct} onChange={e => updateVoce(gruppo.id, voce.id, 'ricarico_pct', +e.target.value)}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: voce.ricarico_pct > 0 ? '#10b981' : 'var(--t2)', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                    </div>
                    <div style={{ ...cell, textAlign: 'right', fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>
                      {fmt(costoVoce(voce))}
                    </div>
                    <div style={{ ...cell, padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button onClick={() => removeVoce(gruppo.id, voce.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Aggiunge voce */}
                <div style={{ padding: '8px 16px' }}>
                  <button onClick={() => addVoce(gruppo.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: '1px dashed var(--border)', borderRadius: 8,
                    padding: '6px 14px', color: 'var(--t3)', fontSize: 12, cursor: 'pointer', width: '100%', justifyContent: 'center'
                  }}>
                    <Plus size={13} /> Aggiungi voce
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Totale finale */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Costi diretti', val: totaleCostiDiretti, color: '#10b981' },
              { label: 'Costi indiretti', val: totaleCostiIndiretti, color: '#f59e0b' },
              { label: 'Spese generali', val: totaleCostiGenerali, color: '#ef4444' },
            ].map((r, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: r.color, fontFamily: 'var(--font-mono)' }}>€ {fmt(r.val)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>TOTALE COSTI PREVENTIVATI</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--t1)' }}>€ {fmt(totaleCosti)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>MARGINE STIMATO</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: margine >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                {margine >= 0 ? <TrendingUp size={20} color="#10b981" /> : <TrendingDown size={20} color="#ef4444" />}
                € {fmt(margine)} <span style={{ fontSize: 16 }}>({fmt(margine_pct)}%)</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
