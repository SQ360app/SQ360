'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Send, ThumbsUp, FileText, AlertTriangle } from 'lucide-react'
import { supabase, getAziendaId } from '@/lib/supabase'

type TipoSAL = 'ATTIVO' | 'PASSIVO'
type StatoSAL = 'BOZZA' | 'INVIATO' | 'APPROVATO' | 'APPROVATO_NOTE' | 'RIFIUTATO' | 'PAGATO'

interface VoceSAL {
  id: string
  tipo_voce: string
  codice: string
  descrizione: string
  um: string
  quantita_contratto: number
  quantita_precedente: number
  quantita_periodo: number
  prezzo_unitario: number
  importo_periodo: number
}

interface SAL {
  id: string
  tipo: TipoSAL
  numero: number
  codice: string
  commessa_id: string
  committente_subappaltatore: string
  data_emissione: string
  data_scadenza_pagamento: string
  data_approvazione: string
  stato: StatoSAL
  importo_lordo: number
  ritenuta_garanzia: number
  ritenuta_acconto: number
  importo_netto: number
  avanzamento_pct: number
  note_approvazione: string
  approvatore: string
  voci_sal?: VoceSAL[]
}

const STATO_META: Record<StatoSAL, { label: string; color: string }> = {
  BOZZA: { label: 'Bozza', color: '#6b7280' },
  INVIATO: { label: 'Inviato', color: '#3b82f6' },
  APPROVATO: { label: 'Approvato ✓', color: '#10b981' },
  APPROVATO_NOTE: { label: 'Approvato con note', color: '#f59e0b' },
  RIFIUTATO: { label: 'Rifiutato', color: '#ef4444' },
  PAGATO: { label: 'Pagato ✓', color: '#10b981' },
}

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function SALPage() {
  const [salList, setSalList] = useState<SAL[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TipoSAL>('ATTIVO')
  const [selected, setSelected] = useState<string | null>(null)
  const [showApprovaModal, setShowApprovaModal] = useState(false)
  const [noteApprovazione, setNoteApprovazione] = useState('')
  const [approvatore, setApprovatore] = useState('')

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sal')
      .select('*, voci_sal(*)')
      .order('created_at', { ascending: false })
    if (!error && data) setSalList(data)
    setLoading(false)
  }

  const filtered = salList.filter(s => s.tipo === tab)
  const salSelezionato = salList.find(s => s.id === selected) ?? null

  const totaleEmesso = filtered.filter(s => s.stato !== 'BOZZA').reduce((t, s) => t + (s.importo_lordo || 0), 0)
  const totaleInAttesa = filtered.filter(s => ['INVIATO','APPROVATO','APPROVATO_NOTE'].includes(s.stato)).reduce((t, s) => t + (s.importo_netto || 0), 0)
  const totalePagato = filtered.filter(s => s.stato === 'PAGATO').reduce((t, s) => t + (s.importo_netto || 0), 0)

  async function approva(esito: 'APPROVATO' | 'APPROVATO_NOTE' | 'RIFIUTATO') {
    if (!selected) return
    const { data, error } = await supabase.from('sal').update({
      stato: esito, approvatore, note_approvazione: noteApprovazione,
      data_approvazione: new Date().toISOString().slice(0, 10)
    }).eq('id', selected).select().single()
    if (!error && data) {
      setSalList(prev => prev.map(s => s.id === selected ? { ...s, ...data } : s))
    }
    setShowApprovaModal(false); setNoteApprovazione(''); setApprovatore('')
  }

  async function inviaADL() {
    if (!selected) return
    const { data, error } = await supabase.from('sal').update({ stato: 'INVIATO' }).eq('id', selected).select().single()
    if (!error && data) setSalList(prev => prev.map(s => s.id === selected ? { ...s, stato: 'INVIATO' } : s))
  }

  const inp = { width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>M5 — SAL Attivi e Passivi</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>Stati Avanzamento Lavori · Committente e Subappaltatori</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['ATTIVO', 'PASSIVO'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSelected(null) }} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: tab === t ? (t === 'ATTIVO' ? '#3b82f6' : '#8b5cf6') : 'var(--panel)', color: tab === t ? 'white' : 'var(--t2)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {t === 'ATTIVO' ? '📤 SAL Attivi (→ Committente)' : '📥 SAL Passivi (→ Subappaltatori)'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Totale emesso', val: `€ ${fmt(totaleEmesso)}`, color: '#3b82f6' },
          { label: 'In attesa pagamento', val: `€ ${fmt(totaleInAttesa)}`, color: '#f59e0b' },
          { label: 'Pagato', val: `€ ${fmt(totalePagato)}`, color: '#10b981' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>Caricamento dal database...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: salSelezionato ? '420px 1fr' : '1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(sal => {
              const sm = STATO_META[sal.stato]
              const isSelected = selected === sal.id
              const scaduto = sal.data_scadenza_pagamento && new Date(sal.data_scadenza_pagamento) < new Date() && sal.stato !== 'PAGATO'
              return (
                <div key={sal.id} onClick={() => setSelected(sal.id === selected ? null : sal.id)}
                  style={{ background: 'var(--panel)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{sal.codice}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: sm.color, background: `${sm.color}15`, border: `1px solid ${sm.color}30`, borderRadius: 5, padding: '2px 8px' }}>{sm.label}</span>
                        {scaduto && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠ SCADUTO</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>{sal.committente_subappaltatore}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(sal.importo_lordo || 0)}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>netto: € {fmt(sal.importo_netto || 0)}</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>Avanzamento</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: tab === 'ATTIVO' ? '#3b82f6' : '#8b5cf6' }}>{sal.avanzamento_pct || 0}%</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${sal.avanzamento_pct || 0}%`, height: '100%', background: tab === 'ATTIVO' ? '#3b82f6' : '#8b5cf6', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)' }}>
                    <span>Emissione: {sal.data_emissione || '—'}</span>
                    <span>Scadenza: {sal.data_scadenza_pagamento || '—'}</span>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && !loading && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12 }}>
                Nessun SAL {tab === 'ATTIVO' ? 'attivo' : 'passivo'} nel database.
              </div>
            )}
          </div>

          {salSelezionato && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{salSelezionato.codice} — SAL N° {salSelezionato.numero}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{salSelezionato.committente_subappaltatore}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}><X size={14} /></button>
              </div>
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {salSelezionato.stato === 'BOZZA' && (
                  <button onClick={inviaADL} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Send size={13} /> Invia a DL
                  </button>
                )}
                {salSelezionato.stato === 'INVIATO' && (
                  <button onClick={() => setShowApprovaModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <ThumbsUp size={13} /> Approva / Annota / Rifiuta
                  </button>
                )}
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>
                  <FileText size={13} /> Esporta PDF
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Quadro Economico SAL</div>
                  {[
                    { label: 'Importo lordo', val: salSelezionato.importo_lordo || 0, color: 'var(--t1)' },
                    { label: `Ritenuta garanzia`, val: -(salSelezionato.ritenuta_garanzia || 0), color: '#f59e0b' },
                    ...(tab === 'PASSIVO' ? [{ label: 'Ritenuta acconto', val: -(salSelezionato.ritenuta_acconto || 0), color: '#8b5cf6' }] : []),
                    { label: 'NETTO A PAGARE', val: salSelezionato.importo_netto || 0, color: tab === 'ATTIVO' ? '#3b82f6' : '#8b5cf6', bold: true },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: (r as { bold?: boolean }).bold ? 700 : 400 }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: (r as { bold?: boolean }).bold ? 800 : 600, color: r.color }}>
                        {r.val < 0 ? '− ' : ''}€ {fmt(Math.abs(r.val))}
                      </span>
                    </div>
                  ))}
                </div>
                {salSelezionato.voci_sal && salSelezionato.voci_sal.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Voci SAL ({salSelezionato.voci_sal.length})</div>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                        <thead>
                          <tr style={{ background: 'rgba(59,130,246,0.05)' }}>
                            {['Codice', 'Descrizione', 'U.M.', 'Q.periodo', 'P.U.', 'Importo'].map(h => (
                              <th key={h} style={{ padding: '7px 10px', fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {salSelezionato.voci_sal.map(voce => (
                            <tr key={voce.id} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '7px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--t3)' }}>{voce.codice}</td>
                              <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--t1)' }}>{voce.descrizione}</td>
                              <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>{voce.um}</td>
                              <td style={{ padding: '7px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{voce.quantita_periodo}</td>
                              <td style={{ padding: '7px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t2)' }}>€ {fmt(voce.prezzo_unitario || 0)}</td>
                              <td style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 700, color: 'var(--t1)' }}>€ {fmt(voce.importo_periodo || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showApprovaModal && salSelezionato && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, width: '100%', maxWidth: 480, padding: '28px 32px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>Gestione SAL</h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 20px' }}>{salSelezionato.codice} · € {fmt(salSelezionato.importo_lordo || 0)}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Approvatore *</label>
              <input value={approvatore} onChange={e => setApprovatore(e.target.value)} placeholder="Es. Ing. Rossi DL" style={{ width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Note / Annotazioni</label>
              <textarea value={noteApprovazione} onChange={e => setNoteApprovazione(e.target.value)} placeholder="Eventuali note o riserve..." style={{ width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13, resize: 'vertical', minHeight: 80 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => approva('APPROVATO')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✅ Approva</button>
              <button onClick={() => approva('APPROVATO_NOTE')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#f59e0b', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📝 Con note</button>
              <button onClick={() => approva('RIFIUTATO')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>❌ Rifiuta</button>
            </div>
            <button onClick={() => setShowApprovaModal(false)} style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}
