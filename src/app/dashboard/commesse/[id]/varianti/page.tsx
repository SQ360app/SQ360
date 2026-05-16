'use client'
import React, { useState, useEffect, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'
import { Plus, ChevronDown, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TIPI_VARIANTE = [
  { value: 'necessaria',           label: 'Per cause impreviste',     color: '#f59e0b' },
  { value: 'migliorativa',         label: 'Migliorativa',             color: '#10b981' },
  { value: 'errore_progettuale',   label: 'Errore progettuale',       color: '#ef4444' },
  { value: 'opzione_contrattuale', label: 'Da opzione contrattuale',  color: '#3b82f6' },
]

const STATI_VARIANTE = [
  { value: 'proposta',       label: 'Proposta',       color: '#6b7280' },
  { value: 'approvata_rup',  label: 'Approvata RUP',  color: '#f59e0b' },
  { value: 'approvata_sa',   label: 'Approvata SA',   color: '#3b82f6' },
  { value: 'esecutiva',      label: 'Esecutiva',      color: '#10b981' },
  { value: 'respinta',       label: 'Respinta',       color: '#ef4444' },
]

const TIPI_MODIFICA = [
  { value: 'aggiunta',           label: 'Aggiunta',           color: '#10b981' },
  { value: 'modifica_quantita',  label: 'Modifica quantità',  color: '#f59e0b' },
  { value: 'soppressione',       label: 'Soppressione',       color: '#ef4444' },
]

interface Variante {
  id: string; numero: number; tipo: string; descrizione: string
  importo_variante: number; importo_perizia: number; data_proposta?: string
  stato: string; note?: string
  data_approvazione_rup?: string; data_approvazione_sa?: string; data_esecutiva?: string
}
interface VoceVariante {
  id: string; variante_id: string; codice?: string; descrizione: string
  um?: string; quantita: number; prezzo_unitario: number; importo: number
  tipo_modifica: string; voce_computo_id?: string
}

function getSoglia(pct: number) {
  if (pct < 10) return { label: 'RUP approva', color: '#10b981', bg: '#d1fae5' }
  if (pct <= 50) return { label: 'Richiede SA', color: '#d97706', bg: '#fef3c7' }
  return { label: '⚠️ Nuovo appalto obbligatorio', color: '#dc2626', bg: '#fef2f2' }
}

export default function VariantiPage({ params: pp }: { params: Promise<{ id: string }> }) {
  const { id } = use(pp)
  const [varianti, setVarianti] = useState<Variante[]>([])
  const [vociMap, setVociMap] = useState<Record<string, VoceVariante[]>>({})
  const [importoContratto, setImportoContratto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Form nuova variante
  const [fTipo, setFTipo] = useState('necessaria')
  const [fDesc, setFDesc] = useState('')
  const [fImporto, setFImporto] = useState('')
  const [fPerizia, setFPerizia] = useState('')
  const [fData, setFData] = useState(new Date().toISOString().slice(0, 10))
  const [fNote, setFNote] = useState('')

  // Form voce variante inline
  const [voceFormId, setVoceFormId] = useState<string | null>(null)
  const [fvCodice, setFvCodice] = useState('')
  const [fvDesc, setFvDesc] = useState('')
  const [fvUm, setFvUm] = useState('')
  const [fvQta, setFvQta] = useState('')
  const [fvPu, setFvPu] = useState('')
  const [fvTipo, setFvTipo] = useState('aggiunta')

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: v }, { data: vv }] = await Promise.all([
      supabase.from('commesse').select('importo_contratto').eq('id', id).single(),
      supabase.from('varianti').select('*').eq('commessa_id', id).order('numero'),
      supabase.from('voci_variante').select('*').eq('commessa_id', id),
    ])
    setImportoContratto(c?.importo_contratto || 0)
    setVarianti(v || [])
    const map: Record<string, VoceVariante[]> = {}
    for (const item of (vv || [])) {
      if (!map[item.variante_id]) map[item.variante_id] = []
      map[item.variante_id].push(item)
    }
    setVociMap(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const totaleVarianti = varianti.filter(v => v.stato !== 'respinta').reduce((s, v) => s + (v.importo_variante || 0), 0)
  const variantiEsecutive = varianti.filter(v => v.stato === 'esecutiva').reduce((s, v) => s + (v.importo_variante || 0), 0)
  const pctVarianti = importoContratto > 0 ? (totaleVarianti / importoContratto) * 100 : 0
  const importoAggiornato = importoContratto + variantiEsecutive
  const sogliaGlobale = getSoglia(pctVarianti)

  async function handleSave() {
    if (!fDesc.trim() || !fImporto) { setErr('Descrizione e importo obbligatori'); return }
    setSaving(true)
    const aziendaId = await getAziendaId()
    const { count } = await supabase.from('varianti').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = (count || 0) + 1
    const { error } = await supabase.from('varianti').insert({
      commessa_id: id, azienda_id: aziendaId || null,
      numero, tipo: fTipo, descrizione: fDesc.trim(),
      importo_variante: parseFloat(fImporto) || 0,
      importo_perizia: parseFloat(fPerizia) || 0,
      data_proposta: fData || null, note: fNote || null, stato: 'proposta',
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); setModalOpen(false)
    setFDesc(''); setFImporto(''); setFPerizia(''); setFNote('')
    await load()
  }

  async function cambiaStato(varianteId: string, nuovoStato: string, variante: Variante) {
    const updates: Record<string, string | null> = { stato: nuovoStato }
    if (nuovoStato === 'approvata_rup') updates.data_approvazione_rup = new Date().toISOString().slice(0, 10)
    if (nuovoStato === 'approvata_sa')  updates.data_approvazione_sa  = new Date().toISOString().slice(0, 10)
    if (nuovoStato === 'esecutiva') {
      updates.data_esecutiva = new Date().toISOString().slice(0, 10)
      const nuovoImporto = importoContratto + (variante.importo_variante || 0)
      await supabase.from('commesse').update({ importo_contratto: nuovoImporto }).eq('id', id)
      setImportoContratto(nuovoImporto)
    }
    await supabase.from('varianti').update(updates).eq('id', varianteId)
    await load()
  }

  async function aggiungiVoce(varianteId: string) {
    if (!fvDesc.trim()) return
    const qta = parseFloat(fvQta) || 0
    const pu  = parseFloat(fvPu)  || 0
    await supabase.from('voci_variante').insert({
      variante_id: varianteId, commessa_id: id,
      codice: fvCodice || null, descrizione: fvDesc.trim(),
      um: fvUm || null, quantita: qta, prezzo_unitario: pu,
      importo: Math.round(qta * pu * 100) / 100,
      tipo_modifica: fvTipo,
    })
    setVoceFormId(null)
    setFvCodice(''); setFvDesc(''); setFvUm(''); setFvQta(''); setFvPu('')
    await load()
  }

  async function eliminaVoce(voceId: string) {
    await supabase.from('voci_variante').delete().eq('id', voceId)
    await load()
  }

  const inputSt: React.CSSProperties = { width: '100%', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', boxSizing: 'border-box' }

  return (
    <div className="space-y-4">

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'Varianti totali',       v: String(varianti.filter(v => v.stato !== 'respinta').length), alert: false },
          { l: 'Importo varianti',      v: '€ ' + fmt(totaleVarianti),  alert: false },
          { l: '% su contratto',        v: pctVarianti.toFixed(1) + '%', alert: pctVarianti > 50 },
          { l: 'Contratto aggiornato',  v: '€ ' + fmt(importoAggiornato), alert: false },
        ].map(({ l, v, alert }) => (
          <div key={l} style={{ background: alert ? '#fef2f2' : '#f9fafb', border: '1px solid ' + (alert ? '#fca5a5' : '#f3f4f6'), borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: alert ? '#dc2626' : '#6b7280', marginBottom: 3 }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: alert ? '#dc2626' : '#111827' }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Banner soglia globale */}
      {totaleVarianti > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: sogliaGlobale.bg, border: '1px solid ' + sogliaGlobale.color + '40', borderRadius: 8, fontSize: 12 }}>
          {pctVarianti > 50 && <AlertTriangle size={14} style={{ color: sogliaGlobale.color, flexShrink: 0 }} />}
          <span style={{ color: sogliaGlobale.color, fontWeight: 600 }}>{sogliaGlobale.label}</span>
          <span style={{ color: '#6b7280', marginLeft: 4 }}>— totale varianti {pctVarianti.toFixed(1)}% dell'importo contrattuale (D.Lgs. 36/2023)</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Varianti contrattuali</h2>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Iter approvazione D.Lgs. 36/2023 · RUP · SA</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> Nuova variante
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
        </div>
      ) : varianti.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, color: '#9ca3af', gap: 8, border: '1px dashed #e5e7eb', borderRadius: 12 }}>
          <p style={{ fontSize: 14 }}>Nessuna variante registrata</p>
          <p style={{ fontSize: 12 }}>Clicca "Nuova variante" per iniziare</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {varianti.map(v => {
            const tipo   = TIPI_VARIANTE.find(t => t.value === v.tipo)
            const stato  = STATI_VARIANTE.find(s => s.value === v.stato)
            const pct    = importoContratto > 0 ? (v.importo_variante / importoContratto) * 100 : 0
            const sg     = getSoglia(pct)
            const voci   = vociMap[v.id] || []
            const isExp  = expanded === v.id

            return (
              <div key={v.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>

                {/* Header card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setExpanded(isExp ? null : v.id)}>
                  {isExp
                    ? <ChevronDown size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    : <ChevronRight size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: 'monospace', flexShrink: 0 }}>N.{v.numero}</span>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 3, fontWeight: 600, color: tipo?.color, background: tipo?.color + '18', flexShrink: 0 }}>
                    {tipo?.label || v.tipo}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.descrizione}</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#374151', flexShrink: 0 }}>€ {fmt(v.importo_variante)}</span>
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 700, color: sg.color, background: sg.bg, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {sg.label}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 600, color: stato?.color, background: stato?.color + '18', flexShrink: 0 }}>
                    {stato?.label}
                  </span>
                </div>

                {/* Dettaglio espanso */}
                {isExp && (
                  <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                      {[
                        ['Data proposta',  v.data_proposta          || '—'],
                        ['Importo perizia', '€ ' + fmt(v.importo_perizia)],
                        ['Approv. RUP',    v.data_approvazione_rup  || '—'],
                        ['Approv. SA',     v.data_approvazione_sa   || '—'],
                      ].map(([l, val]) => (
                        <div key={l}>
                          <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{l}</p>
                          <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {v.note && <p style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', margin: 0 }}>{v.note}</p>}

                    {/* Workflow bottoni */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>Avanza stato →</span>
                      {v.stato === 'proposta' && (
                        <button onClick={() => cambiaStato(v.id, 'approvata_rup', v)}
                          style={{ fontSize: 11, padding: '4px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                          ✓ Invia a RUP
                        </button>
                      )}
                      {v.stato === 'approvata_rup' && pct >= 10 && (
                        <button onClick={() => cambiaStato(v.id, 'approvata_sa', v)}
                          style={{ fontSize: 11, padding: '4px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                          ✓ Invia a SA
                        </button>
                      )}
                      {v.stato === 'approvata_rup' && pct < 10 && (
                        <button onClick={() => cambiaStato(v.id, 'esecutiva', v)}
                          style={{ fontSize: 11, padding: '4px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                          ✓ Rendi Esecutiva
                        </button>
                      )}
                      {v.stato === 'approvata_sa' && (
                        <button onClick={() => cambiaStato(v.id, 'esecutiva', v)}
                          style={{ fontSize: 11, padding: '4px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                          ✓ Rendi Esecutiva
                        </button>
                      )}
                      {v.stato !== 'respinta' && v.stato !== 'esecutiva' && (
                        <button onClick={() => cambiaStato(v.id, 'respinta', v)}
                          style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, cursor: 'pointer' }}>
                          ✕ Respingi
                        </button>
                      )}
                      {v.stato === 'esecutiva' && (
                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✅ Variante esecutiva — importo contratto aggiornato</span>
                      )}
                    </div>

                    {/* Voci variante */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Voci variante ({voci.length})</span>
                        {voceFormId !== v.id && (
                          <button onClick={() => setVoceFormId(v.id)}
                            style={{ fontSize: 11, padding: '3px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            + Aggiungi voce
                          </button>
                        )}
                      </div>

                      {voci.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                              {['Codice', 'Descrizione', 'UM', 'Qtà', 'P.U.', 'Importo', 'Tipo modifica', ''].map(h => (
                                <th key={h} style={{ padding: '4px 8px', textAlign: ['Qtà', 'P.U.', 'Importo'].includes(h) ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {voci.map(vv => {
                              const tm = TIPI_MODIFICA.find(t => t.value === vv.tipo_modifica)
                              return (
                                <tr key={vv.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 10, color: '#6b7280' }}>{vv.codice || '—'}</td>
                                  <td style={{ padding: '4px 8px', color: '#374151' }}>{vv.descrizione}</td>
                                  <td style={{ padding: '4px 8px', color: '#6b7280' }}>{vv.um || '—'}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{vv.quantita}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(vv.prezzo_unitario)}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>€ {fmt(vv.importo)}</td>
                                  <td style={{ padding: '4px 8px' }}>
                                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 600, color: tm?.color, background: tm?.color + '18' }}>
                                      {tm?.label || vv.tipo_modifica}
                                    </span>
                                  </td>
                                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                    <button onClick={() => eliminaVoce(vv.id)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}>🗑</button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}

                      {/* Form inline voce */}
                      {voceFormId === v.id && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '10px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, marginTop: 8 }}>
                          <input value={fvCodice} onChange={e => setFvCodice(e.target.value)} placeholder="Codice"
                            style={{ width: 80, fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 6px' }} />
                          <input value={fvDesc} onChange={e => setFvDesc(e.target.value)} placeholder="Descrizione *"
                            style={{ flex: 1, minWidth: 160, fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 6px' }} />
                          <input value={fvUm} onChange={e => setFvUm(e.target.value)} placeholder="UM"
                            style={{ width: 50, fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 6px' }} />
                          <input type="number" value={fvQta} onChange={e => setFvQta(e.target.value)} placeholder="Qtà"
                            style={{ width: 70, fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 6px', textAlign: 'right' }} />
                          <input type="number" value={fvPu} onChange={e => setFvPu(e.target.value)} placeholder="P.U. €"
                            style={{ width: 90, fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 6px', textAlign: 'right' }} />
                          <select value={fvTipo} onChange={e => setFvTipo(e.target.value)}
                            style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 6px' }}>
                            {TIPI_MODIFICA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <button onClick={() => aggiungiVoce(v.id)}
                            style={{ fontSize: 11, padding: '4px 12px', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                            Salva
                          </button>
                          <button onClick={() => setVoceFormId(null)}
                            style={{ fontSize: 11, padding: '4px 8px', background: 'none', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuova variante */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Nuova Variante</h2>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>Tipo variante *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TIPI_VARIANTE.map(t => (
                  <button key={t.value} onClick={() => setFTipo(t.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: fTipo === t.value ? `2px solid ${t.color}` : '1px solid #e5e7eb', background: fTipo === t.value ? t.color + '18' : '#fff', color: fTipo === t.value ? t.color : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: fTipo === t.value ? 700 : 400, textAlign: 'left' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Descrizione *</label>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} style={{ ...inputSt, resize: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo variante € *</label>
                <input type="number" step="0.01" value={fImporto} onChange={e => setFImporto(e.target.value)} style={{ ...inputSt, textAlign: 'right' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo perizia €</label>
                <input type="number" step="0.01" value={fPerizia} onChange={e => setFPerizia(e.target.value)} style={{ ...inputSt, textAlign: 'right' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data proposta</label>
              <input type="date" value={fData} onChange={e => setFData(e.target.value)} style={inputSt} />
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note</label>
              <textarea value={fNote} onChange={e => setFNote(e.target.value)} rows={2} style={{ ...inputSt, resize: 'none' }} />
            </div>

            {/* Preview soglia */}
            {fImporto && importoContratto > 0 && (() => {
              const sg = getSoglia((parseFloat(fImporto) / importoContratto) * 100)
              return (
                <div style={{ padding: '8px 12px', background: sg.bg, border: '1px solid ' + sg.color + '40', borderRadius: 8, fontSize: 12, color: sg.color, fontWeight: 600 }}>
                  {sg.label} — {((parseFloat(fImporto) / importoContratto) * 100).toFixed(1)}% del contratto
                </div>
              )
            })()}

            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{err}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setModalOpen(false); setErr('') }}
                style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving && <Loader2 size={13} />} Crea Variante
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
