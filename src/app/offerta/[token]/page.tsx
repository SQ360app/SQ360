'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fi = (n: number, d = 2) =>
  (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })

interface VoceRDA { id: string; codice: string; descrizione: string; um: string; quantita: number }
interface RDO {
  id: string; codice: string; oggetto: string; fornitore: string
  data_scadenza: string; note: string; stato_offerta: string
  rda_id?: string; commessa_id?: string
}
interface Commessa { codice: string; nome: string; committente: string }

const INP: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
  background: '#fff', color: '#111827', boxSizing: 'border-box',
}
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }
const SEC: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
  overflow: 'hidden', marginBottom: 16,
}
const SEC_HDR: React.CSSProperties = {
  padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
  fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase',
  letterSpacing: '0.05em',
}
const SEC_BODY: React.CSSProperties = { padding: 16 }

export default function OffertaPage({ params: p }: { params: Promise<{ token: string }> }) {
  const { token } = use(p)

  const [rdo, setRdo]         = useState<RDO | null>(null)
  const [commessa, setCommessa] = useState<Commessa | null>(null)
  const [voci, setVoci]       = useState<VoceRDA[]>([])
  const [loading, setLoading] = useState(true)
  const [inviata, setInviata] = useState(false)
  const [sending, setSending] = useState(false)
  const [errore, setErrore]   = useState('')

  // ── Form state ────────────────────────────────────────────────────────────
  const [prezziVoci, setPrezziVoci] = useState<Record<string, number>>({})
  const [trasportoImporto, setTrasportoImporto] = useState(0)
  const [trasportoTipo, setTrasportoTipo] = useState('incluso')
  const [imballo, setImballo] = useState(0)
  const [pagamentoGiorni, setPagamentoGiorni] = useState(30)
  const [anticipoPct, setAnticipoPct] = useState(0)
  const [scontoAnticipato, setScontoAnticipato] = useState(0)
  const [formaPagamento, setFormaPagamento] = useState('bonifico')
  const [disponibilita, setDisponibilita] = useState('')
  const [validitaGiorni, setValiditaGiorni] = useState(30)
  const [luogoConsegna, setLuogoConsegna] = useState('franco_cantiere')
  const [noteOfferta, setNoteOfferta] = useState('')
  const [osservazioni, setOsservazioni] = useState('')

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    ;(async () => {
      const { data: rdoData } = await supabase
        .from('rdo')
        .select('id,codice,oggetto,fornitore,data_scadenza,note,stato_offerta,rda_id,commessa_id')
        .eq('token_offerta', token)
        .maybeSingle()

      if (!rdoData) { setErrore('Token non valido o offerta già inviata.'); setLoading(false); return }
      if (rdoData.stato_offerta === 'ricevuta') { setInviata(true); setLoading(false); return }
      setRdo(rdoData)

      if (rdoData.commessa_id) {
        const { data: com } = await supabase
          .from('commesse').select('codice,nome,committente').eq('id', rdoData.commessa_id).single()
        if (com) setCommessa(com)
      }

      if (rdoData.rda_id) {
        const { data: rda } = await supabase
          .from('rda').select('voci_ids').eq('id', rdoData.rda_id).single()
        if (rda?.voci_ids?.length) {
          const { data: v } = await supabase
            .from('voci_computo')
            .select('id,codice,descrizione,um,quantita')
            .in('id', rda.voci_ids)
          setVoci((v as VoceRDA[]) || [])
          const init: Record<string, number> = {}
          ;(v || []).forEach((x: VoceRDA) => { init[x.id] = 0 })
          setPrezziVoci(init)
        }
      }

      setLoading(false)
    })()
  }, [token])

  // ── Calcoli ───────────────────────────────────────────────────────────────
  const totMateriali = voci.reduce((s, v) => s + (prezziVoci[v.id] || 0) * (v.quantita || 0), 0)
  const totOfferta = totMateriali + trasportoImporto + imballo

  // ── Submit ────────────────────────────────────────────────────────────────
  const invia = async () => {
    if (!rdo) return
    setSending(true)
    try {
      const offertaVoci = voci.map(v => ({
        voce_id: v.id, codice: v.codice, descrizione: v.descrizione,
        um: v.um, quantita: v.quantita,
        prezzo_unitario: prezziVoci[v.id] || 0,
        importo: (prezziVoci[v.id] || 0) * (v.quantita || 0),
      }))

      const { error } = await supabase.from('rdo').update({
        stato_offerta: 'ricevuta',
        data_risposta: new Date().toISOString(),
        importo_offerta: totOfferta,
        offerta_voci: offertaVoci,
        trasporto_importo: trasportoImporto,
        trasporto_tipo: trasportoTipo,
        pagamento_giorni: pagamentoGiorni,
        anticipo_pct: anticipoPct,
        sconto_anticipato_pct: scontoAnticipato,
        forma_pagamento: formaPagamento,
        disponibilita,
        validita_giorni: validitaGiorni,
        luogo_consegna: luogoConsegna,
        note_offerta: noteOfferta + (osservazioni ? '\n\nOsservazioni tecniche:\n' + osservazioni : ''),
        stato: 'risposta_ricevuta',
      }).eq('id', rdo.id)

      if (error) { setErrore('Errore invio: ' + error.message); return }
      setInviata(true)
    } finally { setSending(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Caricamento...</p>
    </div>
  )

  if (errore) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 18, color: '#111827', marginBottom: 8 }}>Link non valido</h2>
        <p style={{ color: '#6b7280', fontSize: 13 }}>{errore}</p>
      </div>
    </div>
  )

  if (inviata) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 32, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Offerta inviata correttamente</h2>
        <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
          La tua offerta è stata ricevuta e sarà valutata dall'ufficio acquisti.
          Verrai contattato direttamente per l'eventuale aggiudicazione.
        </p>
        {commessa && (
          <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
            Commessa: <strong>{commessa.codice} — {commessa.nome}</strong>
          </p>
        )}
      </div>
    </div>
  )

  if (!rdo) return null

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: '#1e3a5f', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>S</div>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>SQ360</span>
        </div>
        <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Richiesta d'Offerta</span>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>

        {/* Intestazione */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>Richiesta d'offerta</p>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '4px 0 4px' }}>{rdo.codice}</h1>
              <p style={{ fontSize: 14, color: '#374151', margin: 0, fontWeight: 500 }}>{rdo.oggetto}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {commessa && (
                <>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Commessa</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '2px 0 0' }}>{commessa.codice} — {commessa.nome}</p>
                  {commessa.committente && <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{commessa.committente}</p>}
                </>
              )}
              {rdo.data_scadenza && (
                <div style={{ marginTop: 8, padding: '4px 10px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 11, color: '#92400e', fontWeight: 600 }}>
                  ⏰ Scadenza: {new Date(rdo.data_scadenza).toLocaleDateString('it-IT')}
                </div>
              )}
            </div>
          </div>
          {rdo.note && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>
              📌 {rdo.note}
            </div>
          )}
        </div>

        {/* SEZIONE 1 — Prezzi per voce */}
        {voci.length > 0 && (
          <div style={SEC}>
            <div style={SEC_HDR}>1 — Prezzi per voce (compila prezzo unitario)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Cod.', 'Descrizione', 'UM', 'Quantità', 'P.U. offerto (€)', 'Importo (€)'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', textAlign: h === 'Descrizione' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {voci.map((v, i) => {
                    const pu = prezziVoci[v.id] || 0
                    const imp = pu * (v.quantita || 0)
                    return (
                      <tr key={v.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: 10, color: '#3b82f6', whiteSpace: 'nowrap' }}>{v.codice}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#111827', lineHeight: 1.4, maxWidth: 300 }}>{v.descrizione}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#6b7280' }}>{v.um || '—'}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: 600 }}>
                          {(v.quantita || 0).toLocaleString('it-IT', { maximumFractionDigits: 3 })}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                          <input type="number" step="0.01" min="0" value={pu || ''}
                            placeholder="0,00"
                            onChange={e => setPrezziVoci(prev => ({ ...prev, [v.id]: parseFloat(e.target.value) || 0 }))}
                            style={{ width: 110, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right', outline: 'none', background: pu > 0 ? '#f0fdf4' : '#fff' }} />
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: 700, color: imp > 0 ? '#059669' : '#9ca3af' }}>
                          {imp > 0 ? fi(imp) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#f0fdf4' }}>
                    <td colSpan={4} style={{ padding: '10px', fontWeight: 700, fontSize: 12, color: '#065f46', textAlign: 'right', borderTop: '2px solid #6ee7b7' }}>Totale materiali</td>
                    <td style={{ padding: '10px', borderTop: '2px solid #6ee7b7' }} />
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#059669', borderTop: '2px solid #6ee7b7' }}>€ {fi(totMateriali)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SEZIONE 2 — Costi aggiuntivi */}
        <div style={SEC}>
          <div style={SEC_HDR}>2 — Costi aggiuntivi</div>
          <div style={{ ...SEC_BODY, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={LBL}>Trasporto (€)</label>
              <input type="number" step="0.01" min="0" style={INP} value={trasportoImporto || ''}
                placeholder="0,00" onChange={e => setTrasportoImporto(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={LBL}>Tipo trasporto</label>
              <select style={INP} value={trasportoTipo} onChange={e => setTrasportoTipo(e.target.value)}>
                <option value="incluso">Incluso nel prezzo</option>
                <option value="escluso">Escluso (a carico fornitore)</option>
                <option value="cliente">A carico del cliente</option>
              </select>
            </div>
            <div>
              <label style={LBL}>Imballo (€)</label>
              <input type="number" step="0.01" min="0" style={INP} value={imballo || ''}
                placeholder="0,00" onChange={e => setImballo(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        {/* SEZIONE 3 — Condizioni commerciali */}
        <div style={SEC}>
          <div style={SEC_HDR}>3 — Condizioni commerciali</div>
          <div style={{ ...SEC_BODY, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={LBL}>Pagamento</label>
              <select style={INP} value={pagamentoGiorni} onChange={e => setPagamentoGiorni(parseInt(e.target.value))}>
                {[30, 60, 90, 120].map(g => <option key={g} value={g}>{g} giorni data fattura</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Forma pagamento</label>
              <select style={INP} value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
                <option value="bonifico">Bonifico bancario</option>
                <option value="riba">RIBA (effetti bancari)</option>
                <option value="assegno">Assegno</option>
                <option value="contanti">Contanti alla consegna</option>
              </select>
            </div>
            <div>
              <label style={LBL}>Anticipo richiesto (%)</label>
              <input type="number" step="1" min="0" max="100" style={INP} value={anticipoPct || ''}
                placeholder="0" onChange={e => setAnticipoPct(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={LBL}>Sconto pagamento anticipato (%)</label>
              <input type="number" step="0.5" min="0" max="100" style={INP} value={scontoAnticipato || ''}
                placeholder="0" onChange={e => setScontoAnticipato(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        {/* SEZIONE 4 — Consegna e validità */}
        <div style={SEC}>
          <div style={SEC_HDR}>4 — Consegna e validità offerta</div>
          <div style={{ ...SEC_BODY, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={LBL}>Disponibilità / tempi consegna</label>
              <input style={INP} value={disponibilita} onChange={e => setDisponibilita(e.target.value)}
                placeholder="es. entro 7 giorni lavorativi" />
            </div>
            <div>
              <label style={LBL}>Validità offerta (giorni)</label>
              <input type="number" min="1" style={INP} value={validitaGiorni}
                onChange={e => setValiditaGiorni(parseInt(e.target.value) || 30)} />
            </div>
            <div>
              <label style={LBL}>Luogo consegna</label>
              <select style={INP} value={luogoConsegna} onChange={e => setLuogoConsegna(e.target.value)}>
                <option value="franco_cantiere">Franco cantiere</option>
                <option value="franco_magazzino">Franco magazzino fornitore</option>
                <option value="concordare">Da concordare</option>
              </select>
            </div>
          </div>
        </div>

        {/* SEZIONE 5 — Note e allegati */}
        <div style={SEC}>
          <div style={SEC_HDR}>5 — Note e osservazioni</div>
          <div style={{ ...SEC_BODY, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LBL}>Note libere</label>
              <textarea style={{ ...INP, resize: 'vertical', minHeight: 80 }} value={noteOfferta}
                onChange={e => setNoteOfferta(e.target.value)}
                placeholder="Eventuali condizioni, esclusioni, note commerciali..." />
            </div>
            <div>
              <label style={LBL}>Osservazioni tecniche</label>
              <textarea style={{ ...INP, resize: 'vertical', minHeight: 80 }} value={osservazioni}
                onChange={e => setOsservazioni(e.target.value)}
                placeholder="Specifiche tecniche del materiale offerto, certificazioni, varianti proposte..." />
            </div>
          </div>
        </div>

        {/* Riepilogo e invio */}
        <div style={{ background: '#1e3a5f', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: '#93c5fd', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>Totale offerta</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#4ade80', margin: '4px 0 0', fontFamily: 'monospace' }}>
                € {fi(totOfferta)}
              </p>
              {voci.length > 0 && (
                <p style={{ fontSize: 11, color: '#93c5fd', margin: '4px 0 0' }}>
                  Materiali {fi(totMateriali)} + Trasporto {fi(trasportoImporto)} + Imballo {fi(imballo)}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: '#93c5fd', margin: '0 0 4px' }}>Pagamento: {pagamentoGiorni}gg · {formaPagamento}</p>
              {anticipoPct > 0 && <p style={{ fontSize: 11, color: '#fbbf24', margin: '0 0 4px' }}>Anticipo: {anticipoPct}%</p>}
              <p style={{ fontSize: 11, color: '#93c5fd', margin: 0 }}>Validità: {validitaGiorni} giorni</p>
            </div>
          </div>

          <button onClick={invia} disabled={sending || totOfferta <= 0}
            style={{
              width: '100%', padding: '14px', background: totOfferta > 0 ? '#10b981' : '#374151',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800,
              cursor: totOfferta > 0 ? 'pointer' : 'not-allowed', letterSpacing: '0.02em',
            }}>
            {sending ? '⏳ Invio in corso...' : totOfferta > 0 ? '📤 INVIA OFFERTA' : '⚠ Compila almeno un prezzo per inviare'}
          </button>
        </div>
      </div>
    </div>
  )
}
