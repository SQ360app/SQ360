'use client'
import React, { useState, useEffect, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'
import { Plus, AlertTriangle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('it-IT') : '—'
const daysDiff = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

const TIPI_OS = [
  { value: 'disposizione',  label: 'Disposizione esecutiva' },
  { value: 'sospensione',   label: 'Sospensione lavori' },
  { value: 'ripresa',       label: 'Ripresa lavori' },
  { value: 'nuovo_prezzo',  label: 'Nuovo prezzo' },
  { value: 'variante',      label: "Variante in corso d'opera" },
]

const STATI_OS = [
  { value: 'emesso',               label: 'Emesso',              color: '#6b7280' },
  { value: 'firmato',              label: 'Firmato',             color: '#10b981' },
  { value: 'firmato_con_riserva',  label: 'Firmato c/ Riserva',  color: '#f59e0b' },
  { value: 'chiuso',               label: 'Chiuso',              color: '#3b82f6' },
]

interface OrdineServizio {
  id: string; numero: number; data_emissione: string; oggetto: string
  tipo: string; descrizione_estesa?: string; stato: string
  variante_id?: string; riserva: boolean
  testo_riserva?: string; importo_riserva?: number; scadenza_riserva?: string
  note?: string
}
interface Variante { id: string; numero: number; descrizione: string }
interface CommessaInfo { codice: string; nome: string }

export default function OrdiniServizioPage({ params: pp }: { params: Promise<{ id: string }> }) {
  const { id } = use(pp)
  const [ordini, setOrdini] = useState<OrdineServizio[]>([])
  const [varianti, setVarianti] = useState<Variante[]>([])
  const [commessa, setCommessa] = useState<CommessaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  // Form nuovo OS
  const [fData, setFData] = useState(new Date().toISOString().slice(0, 10))
  const [fOggetto, setFOggetto] = useState('')
  const [fTipo, setFTipo] = useState('disposizione')
  const [fDesc, setFDesc] = useState('')
  const [fVarianteId, setFVarianteId] = useState('')
  const [fNote, setFNote] = useState('')

  // Form riserva
  const [riservaId, setRiservaId] = useState<string | null>(null)
  const [fRTesto, setFRTesto] = useState('')
  const [fRImporto, setFRImporto] = useState('')
  const [fRScadenza, setFRScadenza] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: os }, { data: v }, { data: comm }] = await Promise.all([
      supabase.from('ordini_servizio').select('*').eq('commessa_id', id).order('numero'),
      supabase.from('varianti').select('id,numero,descrizione').eq('commessa_id', id).order('numero'),
      supabase.from('commesse').select('codice,nome').eq('id', id).single(),
    ])
    setOrdini(os || [])
    setVarianti(v || [])
    setCommessa(comm as CommessaInfo | null)
    setLoading(false)
  }

  async function generaPdfOs(os: OrdineServizio) {
    setPdfLoading(os.id)
    try {
      const varLink = varianti.find(v => v.id === os.variante_id)
      const { OsDocument } = await import('@/components/pdf/OsDocument')
      const { pdf } = await import('@react-pdf/renderer')
      const React = await import('react')
      const blob = await pdf(
        React.createElement(OsDocument, {
          os: { ...os, descrizione: os.descrizione_estesa },
          commessa: { codice: commessa?.codice || '', nome: commessa?.nome || '' },
          variante: varLink ? { numero: varLink.numero, descrizione: varLink.descrizione } : undefined,
        }) as any
      ).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch { console.error('Errore PDF OS') }
    setPdfLoading(null)
  }

  useEffect(() => { load() }, [id])

  async function handleSave() {
    if (!fOggetto.trim()) { setErr('Oggetto obbligatorio'); return }
    setSaving(true)
    const aziendaId = await getAziendaId()
    const { count } = await supabase.from('ordini_servizio').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = (count || 0) + 1
    const { error } = await supabase.from('ordini_servizio').insert({
      commessa_id: id, azienda_id: aziendaId || null,
      numero, data_emissione: fData, oggetto: fOggetto.trim(),
      tipo: fTipo, descrizione_estesa: fDesc || null,
      variante_id: fVarianteId || null, stato: 'emesso', riserva: false, note: fNote || null,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); setModalOpen(false)
    setFOggetto(''); setFDesc(''); setFVarianteId(''); setFNote('')
    await load()
  }

  async function cambiaStato(osId: string, nuovoStato: string) {
    const riserva = nuovoStato === 'firmato_con_riserva'
    await supabase.from('ordini_servizio').update({ stato: nuovoStato, riserva }).eq('id', osId)
    await load()
    if (riserva) { setRiservaId(osId); setExpanded(osId) }
  }

  async function salvaRiserva(osId: string) {
    await supabase.from('ordini_servizio').update({
      testo_riserva:   fRTesto   || null,
      importo_riserva: parseFloat(fRImporto) || null,
      scadenza_riserva: fRScadenza || null,
    }).eq('id', osId)
    setRiservaId(null); setFRTesto(''); setFRImporto(''); setFRScadenza('')
    await load()
  }

  async function generaVarianteDaOS(os: OrdineServizio) {
    const aziendaId = await getAziendaId()
    const { count } = await supabase.from('varianti').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const { data: vCreata } = await supabase.from('varianti').insert({
      commessa_id: id, azienda_id: aziendaId || null,
      numero: (count || 0) + 1, tipo: 'necessaria',
      descrizione: os.oggetto, importo_variante: 0, importo_perizia: 0,
      data_proposta: new Date().toISOString().slice(0, 10), stato: 'proposta',
    }).select().single()
    if (vCreata) {
      await supabase.from('ordini_servizio').update({ variante_id: vCreata.id }).eq('id', os.id)
      await load()
    }
  }

  const alertNonFirmati   = ordini.filter(o => o.stato === 'emesso' && o.data_emissione && daysDiff(o.data_emissione) > 5)
  const alertRiserve      = ordini.filter(o => o.riserva && o.scadenza_riserva && daysDiff(o.scadenza_riserva) >= -5 && daysDiff(o.scadenza_riserva) < 0)
  const totRiserve        = ordini.filter(o => o.riserva).reduce((s, o) => s + (o.importo_riserva || 0), 0)

  const inputSt: React.CSSProperties = { width: '100%', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', boxSizing: 'border-box' }

  return (
    <div className="space-y-4">

      {/* Alert OS non firmati */}
      {alertNonFirmati.map(o => (
        <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12 }}>
          <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} />
          <span style={{ color: '#92400e' }}>OS n.{o.numero} non ancora firmato — emesso {daysDiff(o.data_emissione)} giorni fa</span>
          <button onClick={() => { setExpanded(o.id) }} style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Vedi</button>
        </div>
      ))}

      {/* Alert riserve in scadenza */}
      {alertRiserve.map(o => (
        <div key={o.id + '_r'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12 }}>
          <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
          <span style={{ color: '#991b1b', fontWeight: 600 }}>OS n.{o.numero} — riserva in scadenza il {fmtDate(o.scadenza_riserva)}</span>
        </div>
      ))}

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'OS totali',       v: String(ordini.length),                                          alert: false },
          { l: 'Non firmati',     v: String(ordini.filter(o => o.stato === 'emesso').length),         alert: ordini.some(o => o.stato === 'emesso' && o.data_emissione && daysDiff(o.data_emissione) > 5) },
          { l: 'Con riserva',     v: String(ordini.filter(o => o.riserva).length),                   alert: ordini.some(o => o.riserva) },
          { l: 'Importo riserve', v: '€ ' + fmt(totRiserve),                                         alert: totRiserve > 0 },
        ].map(({ l, v, alert }) => (
          <div key={l} style={{ background: alert ? '#fef2f2' : '#f9fafb', border: '1px solid ' + (alert ? '#fca5a5' : '#f3f4f6'), borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: alert ? '#dc2626' : '#6b7280', marginBottom: 3 }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: alert ? '#dc2626' : '#111827' }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Ordini di Servizio</h2>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Disposizioni DL · Sospensioni · Riserve</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> Nuovo OS
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
          <Loader2 size={16} /> Caricamento...
        </div>
      ) : ordini.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, color: '#9ca3af', gap: 8, border: '1px dashed #e5e7eb', borderRadius: 12 }}>
          <p style={{ fontSize: 14 }}>Nessun Ordine di Servizio emesso</p>
          <p style={{ fontSize: 12 }}>Clicca "Nuovo OS" per iniziare</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ordini.map(o => {
            const stato      = STATI_OS.find(s => s.value === o.stato)
            const tipo       = TIPI_OS.find(t => t.value === o.tipo)
            const varLink    = varianti.find(v => v.id === o.variante_id)
            const isExp      = expanded === o.id
            const overdue    = o.stato === 'emesso' && o.data_emissione && daysDiff(o.data_emissione) > 5

            return (
              <div key={o.id} style={{ border: '1px solid ' + (overdue ? '#fde68a' : o.riserva ? '#fca5a5' : '#e5e7eb'), borderRadius: 12, overflow: 'hidden', background: '#fff' }}>

                {/* Header card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', userSelect: 'none', background: overdue ? '#fffdf0' : 'transparent' }}
                  onClick={() => setExpanded(isExp ? null : o.id)}>
                  {isExp ? <ChevronDown size={16} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: 'monospace', flexShrink: 0 }}>OS {o.numero}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(o.data_emissione)}</span>
                  <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0, background: '#f3f4f6', padding: '1px 7px', borderRadius: 3 }}>{tipo?.label || o.tipo}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.oggetto}</span>
                  {o.riserva && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', flexShrink: 0 }}>⚠ RISERVA</span>}
                  {varLink && <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, flexShrink: 0 }}>Var. {varLink.numero}</span>}
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 600, color: stato?.color, background: stato?.color + '18', flexShrink: 0 }}>{stato?.label}</span>
                </div>

                {/* Dettaglio espanso */}
                {isExp && (
                  <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {o.descrizione_estesa && (
                      <p style={{ fontSize: 12, color: '#374151', margin: 0, padding: '8px 12px', background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8 }}>{o.descrizione_estesa}</p>
                    )}
                    {o.note && <p style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', margin: 0 }}>Note: {o.note}</p>}

                    {/* Riserva dettaglio */}
                    {o.riserva && (
                      <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>⚠ RISERVA ISCRITTA</span>
                          {o.importo_riserva ? <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>€ {fmt(o.importo_riserva)}</span> : null}
                          {o.scadenza_riserva ? <span style={{ fontSize: 11, color: '#6b7280' }}>· scad. {fmtDate(o.scadenza_riserva)}</span> : null}
                        </div>
                        {o.testo_riserva && <p style={{ fontSize: 12, color: '#7f1d1d', margin: 0 }}>{o.testo_riserva}</p>}
                      </div>
                    )}

                    {/* Form dati riserva */}
                    {riservaId === o.id && (
                      <div style={{ padding: '12px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>Dati riserva</span>
                        <textarea value={fRTesto} onChange={e => setFRTesto(e.target.value)} rows={2}
                          placeholder="Testo riserva — descrizione del disaccordo"
                          style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', resize: 'none', boxSizing: 'border-box', width: '100%' }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="number" value={fRImporto} onChange={e => setFRImporto(e.target.value)} placeholder="Importo richiesto €"
                            style={{ flex: 1, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', textAlign: 'right' }} />
                          <input type="date" value={fRScadenza} onChange={e => setFRScadenza(e.target.value)}
                            title="Scadenza iscrizione a registro contabilità"
                            style={{ flex: 1, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => salvaRiserva(o.id)}
                            style={{ fontSize: 12, padding: '5px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            Salva riserva
                          </button>
                          <button onClick={() => setRiservaId(null)}
                            style={{ fontSize: 12, padding: '5px 10px', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>
                            Annulla
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Workflow azioni */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => generaPdfOs(o)} disabled={pdfLoading === o.id}
                        style={{ fontSize: 11, padding: '4px 12px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, opacity: pdfLoading === o.id ? 0.6 : 1 }}>
                        {pdfLoading === o.id ? '...' : '📄 PDF'}
                      </button>
                      {o.stato === 'emesso' && (
                        <>
                          <button onClick={() => cambiaStato(o.id, 'firmato')}
                            style={{ fontSize: 11, padding: '4px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            ✓ Firma
                          </button>
                          <button onClick={() => cambiaStato(o.id, 'firmato_con_riserva')}
                            style={{ fontSize: 11, padding: '4px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                            ⚠ Firma con riserva
                          </button>
                        </>
                      )}
                      {o.stato === 'firmato_con_riserva' && !riservaId && (
                        <button onClick={() => { setRiservaId(o.id); setFRTesto(o.testo_riserva || ''); setFRImporto(String(o.importo_riserva || '')); setFRScadenza(o.scadenza_riserva || '') }}
                          style={{ fontSize: 11, padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                          ✏ Modifica riserva
                        </button>
                      )}
                      {(o.stato === 'firmato' || o.stato === 'firmato_con_riserva') && (
                        <button onClick={() => cambiaStato(o.id, 'chiuso')}
                          style={{ fontSize: 11, padding: '4px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                          ✓ Chiudi OS
                        </button>
                      )}
                      {o.tipo === 'variante' && !o.variante_id && (
                        <button onClick={() => generaVarianteDaOS(o)}
                          style={{ fontSize: 11, padding: '4px 12px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                          ⇒ Genera Variante
                        </button>
                      )}
                      {varLink && (
                        <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>
                          Collegato a Var. {varLink.numero} — {varLink.descrizione?.slice(0, 40)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuovo OS */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Nuovo Ordine di Servizio</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data emissione *</label>
                <input type="date" value={fData} onChange={e => setFData(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Tipo *</label>
                <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={inputSt}>
                  {TIPI_OS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto *</label>
              <input value={fOggetto} onChange={e => setFOggetto(e.target.value)} placeholder="Descrizione sintetica dell'ordine" style={inputSt} />
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Descrizione estesa</label>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={3} style={{ ...inputSt, resize: 'none' }} />
            </div>

            {varianti.length > 0 && (
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Variante collegata</label>
                <select value={fVarianteId} onChange={e => setFVarianteId(e.target.value)} style={inputSt}>
                  <option value="">Nessuna</option>
                  {varianti.map(v => <option key={v.id} value={v.id}>Var. {v.numero} — {v.descrizione?.slice(0, 50)}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note</label>
              <textarea value={fNote} onChange={e => setFNote(e.target.value)} rows={2} style={{ ...inputSt, resize: 'none' }} />
            </div>

            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{err}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setModalOpen(false); setErr('') }}
                style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {saving && <Loader2 size={13} />} Emetti OS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
