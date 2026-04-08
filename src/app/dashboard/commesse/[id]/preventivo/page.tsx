'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Package, Users, Truck, Building2, ChevronDown, ChevronRight, Search, AlertTriangle } from 'lucide-react'

type Assegnazione = 'INTERNO' | 'SUBAPPALTO' | 'FORNITURA' | 'NOLO_CALDO' | 'NOLO_FREDDO' | null
type Componente = 'MAN' | 'MAT' | 'NOL'

interface VoceComputo {
  id: string
  capitolo: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  pct_manodopera: number
  pct_materiali: number
  pct_noli: number
  pct_spese_generali: number
  pct_utile: number
}

interface AssegnazioneState {
  MAN: Assegnazione
  MAT: Assegnazione
  NOL: Assegnazione
  MAN_fornitore?: string
  MAT_fornitore?: string
  NOL_fornitore?: string
  MAN_prezzo?: number
  MAT_prezzo?: number
  NOL_prezzo?: number
}

interface Fornitore {
  id: string
  codice: string
  ragione_sociale: string
  tipo: string
}

const ASSEGNAZIONE_META: Record<string, { label: string; color: string; shortLabel: string }> = {
  INTERNO:    { label: 'Interno (proprie risorse)', color: '#10b981', shortLabel: 'INT' },
  SUBAPPALTO: { label: 'Subappalto',               color: '#8b5cf6', shortLabel: 'SUB' },
  FORNITURA:  { label: 'Acquisto diretto',          color: '#3b82f6', shortLabel: 'ACQ' },
  NOLO_CALDO: { label: 'Nolo a caldo',              color: '#f59e0b', shortLabel: 'NC' },
  NOLO_FREDDO:{ label: 'Nolo a freddo',             color: '#f97316', shortLabel: 'NF' },
}

const COMP_META: Record<Componente, { label: string; icon: typeof Users }> = {
  MAN: { label: 'Manodopera', icon: Users },
  MAT: { label: 'Materiali',  icon: Package },
  NOL: { label: 'Noli',       icon: Truck },
}

function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function PreventivoPage() {
  const { id } = useParams() as { id: string }
  const [voci, setVoci] = useState<VoceComputo[]>([])
  const [assegnazioni, setAssegnazioni] = useState<Record<string, AssegnazioneState>>({})
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedCap, setExpandedCap] = useState<Record<string, boolean>>({})
  const [selectedVoce, setSelectedVoce] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { carica() }, [id])

  async function carica() {
    const [{ data: computo }, { data: forn }, { data: assegn }] = await Promise.all([
      supabase.from('computo_metrico').select('id').eq('commessa_id', id).eq('tipo_uso', 'AGGIUDICATA').single(),
      supabase.from('fornitori').select('id,codice,ragione_sociale,tipo').eq('attivo', true).order('ragione_sociale'),
      supabase.from('voci_assegnazione').select('*').eq('commessa_id', id)
    ])

    if (computo) {
      const { data: v } = await supabase.from('voci_computo').select('*').eq('computo_id', computo.id).eq('selezionata', true).order('capitolo').order('codice')
      if (v) {
        setVoci(v)
        // Expand primo capitolo
        const caps = [...new Set(v.map(x => x.capitolo))]
        if (caps[0]) setExpandedCap({ [caps[0]]: true })
      }
    }

    if (forn) setFornitori(forn)

    // Ricostruisci stato assegnazioni dal DB
    if (assegn) {
      const stato: Record<string, AssegnazioneState> = {}
      for (const a of assegn) {
        if (!stato[a.voce_computo_id]) {
          stato[a.voce_computo_id] = { MAN: null, MAT: null, NOL: null }
        }
        const comp = a.componente as Componente
        stato[a.voce_computo_id][comp] = a.tipo_assegnazione as Assegnazione
        stato[a.voce_computo_id][`${comp}_fornitore` as 'MAN_fornitore'] = a.fornitore_id
        stato[a.voce_computo_id][`${comp}_prezzo` as 'MAN_prezzo'] = a.prezzo_negoziato
      }
      setAssegnazioni(stato)
    }

    setLoading(false)
  }

  async function setAssegnazione(voceId: string, comp: Componente, tipo: Assegnazione) {
    setSaving(voceId)
    const current = assegnazioni[voceId] || { MAN: null, MAT: null, NOL: null }
    const nuovoStato = { ...current, [comp]: tipo }
    setAssegnazioni(prev => ({ ...prev, [voceId]: nuovoStato }))

    // Salva nel DB
    const existing = await supabase.from('voci_assegnazione').select('id').eq('voce_computo_id', voceId).eq('componente', comp).eq('commessa_id', id).single()

    if (tipo === null) {
      if (existing.data) await supabase.from('voci_assegnazione').delete().eq('id', existing.data.id)
    } else {
      const voce = voci.find(v => v.id === voceId)
      const pctComp = comp === 'MAN' ? voce?.pct_manodopera : comp === 'MAT' ? voce?.pct_materiali : voce?.pct_noli
      const importoPrevisto = (voce?.importo || 0) * (pctComp || 0) / 100

      if (existing.data) {
        await supabase.from('voci_assegnazione').update({ tipo_assegnazione: tipo, importo_previsto: importoPrevisto }).eq('id', existing.data.id)
      } else {
        await supabase.from('voci_assegnazione').insert([{ voce_computo_id: voceId, commessa_id: id, componente: comp, tipo_assegnazione: tipo, pct_componente: pctComp, importo_previsto: importoPrevisto }])
      }
    }
    setSaving(null)
  }

  // Raggruppamento per capitolo
  const vociFiltra = voci.filter(v => !search || v.descrizione.toLowerCase().includes(search.toLowerCase()) || v.codice.toLowerCase().includes(search.toLowerCase()))
  const capitoli = [...new Set(vociFiltra.map(v => v.capitolo || 'Senza capitolo'))]

  // KPI generali
  const totaleImporto = voci.reduce((s, v) => s + (v.importo || 0), 0)
  const totaleAssegnato = Object.entries(assegnazioni).reduce((s, [voceId, a]) => {
    const voce = voci.find(v => v.id === voceId)
    if (!voce) return s
    let costo = 0
    if (a.MAN) costo += (voce.importo || 0) * (voce.pct_manodopera || 0) / 100
    if (a.MAT) costo += (voce.importo || 0) * (voce.pct_materiali || 0) / 100
    if (a.NOL) costo += (voce.importo || 0) * (voce.pct_noli || 0) / 100
    return s + costo
  }, 0)
  const vociCompletate = voci.filter(v => {
    const a = assegnazioni[v.id]
    return a && (a.MAN || a.MAT || a.NOL)
  }).length

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>M2 — Preventivo Esecutivo</h2>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
          Assegna ogni componente (Manodopera / Materiali / Noli) a: Interno · Subappalto · Acquisto diretto · Nolo
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Importo contrattuale', val: `€ ${fmt(totaleImporto)}`, color: '#3b82f6' },
          { label: 'Costo previsto assegnato', val: `€ ${fmt(totaleAssegnato)}`, color: '#f59e0b' },
          { label: 'Margine previsto', val: `€ ${fmt(totaleImporto - totaleAssegnato)}`, color: '#10b981' },
          { label: 'Voci assegnate', val: `${vociCompletate}/${voci.length}`, color: '#8b5cf6' },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)' }}>LEGENDA:</span>
        {Object.entries(ASSEGNAZIONE_META).map(([k, v]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: v.color }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: v.color, display: 'inline-block' }} />
            {v.shortLabel} = {v.label}
          </span>
        ))}
      </div>

      {/* Ricerca */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca voce per descrizione o codice..." style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px 10px 36px', fontSize: 13, color: 'var(--t1)' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : voci.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <AlertTriangle size={32} color="var(--t4)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>Nessun computo metrico importato</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Vai alla tab <strong>Computo</strong> per importare le voci dal prezzario o da file Primus/PDF</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {capitoli.map(cap => {
            const vociCap = vociFiltra.filter(v => (v.capitolo || 'Senza capitolo') === cap)
            const expanded = expandedCap[cap]
            const totCap = vociCap.reduce((s, v) => s + (v.importo || 0), 0)
            return (
              <div key={cap} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Header capitolo */}
                <button onClick={() => setExpandedCap(prev => ({ ...prev, [cap]: !prev[cap] }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  {expanded ? <ChevronDown size={14} color="var(--t3)" /> : <ChevronRight size={14} color="var(--t3)" />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>{cap}</span>
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>{vociCap.length} voci</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginLeft: 16 }}>€ {fmt(totCap)}</span>
                </button>

                {/* Voci capitolo */}
                {expanded && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {/* Header tabella */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 120px 160px 160px 160px 100px', gap: 0, padding: '8px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {['Descrizione', 'U.M.', 'Q.tà', 'P.U. €', 'MANODOPERA', 'MATERIALI', 'NOLI', 'Importo €'].map(h => (
                        <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 8px' }}>{h}</div>
                      ))}
                    </div>

                    {vociCap.map((voce, idx) => {
                      const ass = assegnazioni[voce.id] || { MAN: null, MAT: null, NOL: null }
                      const isSelected = selectedVoce === voce.id
                      const pctMan = voce.pct_manodopera || 30
                      const pctMat = voce.pct_materiali || 45
                      const pctNol = voce.pct_noli || 12

                      return (
                        <div key={voce.id} style={{ borderBottom: idx < vociCap.length - 1 ? '1px solid var(--border)' : 'none', background: isSelected ? 'var(--accent-light)' : 'transparent' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 120px 160px 160px 160px 100px', gap: 0, padding: '10px 18px', alignItems: 'center' }}>
                            {/* Descrizione */}
                            <div style={{ padding: '0 8px', cursor: 'pointer' }} onClick={() => setSelectedVoce(isSelected ? null : voce.id)}>
                              <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{voce.codice}</div>
                              <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500, lineHeight: 1.4 }}>{voce.descrizione.slice(0, 80)}{voce.descrizione.length > 80 ? '...' : ''}</div>
                            </div>
                            {/* UM */}
                            <div style={{ padding: '0 8px', fontSize: 12, color: 'var(--t3)', textAlign: 'center' }}>{voce.um}</div>
                            {/* Quantità */}
                            <div style={{ padding: '0 8px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t2)', textAlign: 'right' }}>{(voce.quantita || 0).toFixed(2)}</div>
                            {/* P.U. */}
                            <div style={{ padding: '0 8px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t2)', textAlign: 'right' }}>€ {fmt(voce.prezzo_unitario)}</div>

                            {/* MANODOPERA */}
                            <CellaAssegnazione
                              voceId={voce.id}
                              comp="MAN"
                              valore={ass.MAN}
                              pct={pctMan}
                              importoComp={(voce.importo || 0) * pctMan / 100}
                              onSet={(tipo) => setAssegnazione(voce.id, 'MAN', tipo)}
                              isSaving={saving === voce.id}
                            />

                            {/* MATERIALI */}
                            <CellaAssegnazione
                              voceId={voce.id}
                              comp="MAT"
                              valore={ass.MAT}
                              pct={pctMat}
                              importoComp={(voce.importo || 0) * pctMat / 100}
                              onSet={(tipo) => setAssegnazione(voce.id, 'MAT', tipo)}
                              isSaving={saving === voce.id}
                            />

                            {/* NOLI */}
                            <CellaAssegnazione
                              voceId={voce.id}
                              comp="NOL"
                              valore={ass.NOL}
                              pct={pctNol}
                              importoComp={(voce.importo || 0) * pctNol / 100}
                              onSet={(tipo) => setAssegnazione(voce.id, 'NOL', tipo)}
                              isSaving={saving === voce.id}
                            />

                            {/* Importo */}
                            <div style={{ padding: '0 8px', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--t1)', textAlign: 'right' }}>€ {fmt(voce.importo)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Componente cella assegnazione ────────────────────────────────────────────
function CellaAssegnazione({
  voceId, comp, valore, pct, importoComp, onSet, isSaving
}: {
  voceId: string
  comp: Componente
  valore: Assegnazione
  pct: number
  importoComp: number
  onSet: (tipo: Assegnazione) => void
  isSaving: boolean
}) {
  const [open, setOpen] = useState(false)
  const meta = valore ? ASSEGNAZIONE_META[valore] : null
  function fmt(n: number) { return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

  const OPZIONI: Assegnazione[] = comp === 'MAN'
    ? ['INTERNO', 'SUBAPPALTO', null]
    : comp === 'MAT'
    ? ['INTERNO', 'FORNITURA', 'SUBAPPALTO', null]
    : ['INTERNO', 'NOLO_CALDO', 'NOLO_FREDDO', null]

  return (
    <div style={{ padding: '0 4px', position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isSaving}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: 7,
          border: `1px solid ${meta ? `${meta.color}40` : 'var(--border)'}`,
          background: meta ? `${meta.color}10` : 'var(--bg)',
          cursor: isSaving ? 'wait' : 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2
        }}
      >
        {meta ? (
          <>
            <span style={{ fontSize: 10, fontWeight: 700, color: meta.color }}>{meta.shortLabel}</span>
            <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>€ {fmt(importoComp)} ({pct}%)</span>
          </>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--t4)' }}>— {pct}% —</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 20,
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 9, boxShadow: 'var(--shadow-lg)', minWidth: 180, padding: 6
        }}>
          {OPZIONI.map(op => {
            const m = op ? ASSEGNAZIONE_META[op] : null
            return (
              <button key={op || 'null'} onClick={() => { onSet(op); setOpen(false) }} style={{
                width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none',
                background: valore === op ? `${m?.color || '#6b7280'}15` : 'transparent',
                color: m ? m.color : 'var(--t3)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m?.color || '#d1d5db', flexShrink: 0 }} />
                {m ? m.label : 'Non assegnato'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
