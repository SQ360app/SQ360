'use client'

import { useState } from 'react'
import { Plus, X, CheckCircle, AlertCircle, Clock, AlertTriangle, ChevronDown, ChevronRight, FileText, Send, ThumbsUp, ThumbsDown } from 'lucide-react'

// ─── Tipi ─────────────────────────────────────────────────────────────────────
type TipoSAL = 'ATTIVO' | 'PASSIVO'
type StatoSAL = 'BOZZA' | 'INVIATO' | 'APPROVATO' | 'APPROVATO_NOTE' | 'RIFIUTATO' | 'PAGATO'
type TipoVoceSAL = 'LAVORAZIONE' | 'MATERIALE' | 'ONERE' | 'VARIANTE'

interface VoceSAL {
  id: string
  tipo: TipoVoceSAL
  codice: string
  descrizione: string
  um: string
  quantita_contratto: number
  quantita_precedente: number
  quantita_periodo: number
  quantita_totale: number
  prezzo_unitario: number
  importo_periodo: number
  importo_totale: number
}

interface SAL {
  id: string
  tipo: TipoSAL
  numero: number
  codice: string
  commessa: string
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
  voci: VoceSAL[]
}

// ─── Costanti ─────────────────────────────────────────────────────────────────
const STATO_META: Record<StatoSAL, { label: string; color: string }> = {
  BOZZA: { label: 'Bozza', color: '#6b7280' },
  INVIATO: { label: 'Inviato', color: '#3b82f6' },
  APPROVATO: { label: 'Approvato ✓', color: '#10b981' },
  APPROVATO_NOTE: { label: 'Approvato con note', color: '#f59e0b' },
  RIFIUTATO: { label: 'Rifiutato', color: '#ef4444' },
  PAGATO: { label: 'Pagato ✓', color: '#10b981' },
}

// ─── Dati demo ─────────────────────────────────────────────────────────────────
const DEMO_SAL: SAL[] = [
  {
    id: 's1', tipo: 'ATTIVO', numero: 1, codice: 'SAL-A-001',
    commessa: '26.PNA.RS.001', committente_subappaltatore: 'Comune di Napoli',
    data_emissione: '2026-03-20', data_scadenza_pagamento: '2026-04-19', data_approvazione: '2026-03-28',
    stato: 'PAGATO', importo_lordo: 80000, ritenuta_garanzia: 4000, ritenuta_acconto: 0,
    importo_netto: 76000, avanzamento_pct: 25, note_approvazione: '', approvatore: 'Ing. Rossi DL',
    voci: [
      { id: 'v1', tipo: 'LAVORAZIONE', codice: '01.001', descrizione: 'Scavi e demolizioni', um: 'mc', quantita_contratto: 500, quantita_precedente: 0, quantita_periodo: 280, quantita_totale: 280, prezzo_unitario: 45, importo_periodo: 12600, importo_totale: 12600 },
      { id: 'v2', tipo: 'LAVORAZIONE', codice: '01.002', descrizione: 'Struttura in c.a.', um: 'mc', quantita_contratto: 120, quantita_precedente: 0, quantita_periodo: 65, quantita_totale: 65, prezzo_unitario: 420, importo_periodo: 27300, importo_totale: 27300 },
      { id: 'v3', tipo: 'LAVORAZIONE', codice: '02.001', descrizione: 'Murature perimetrali', um: 'mq', quantita_contratto: 800, quantita_precedente: 0, quantita_periodo: 350, quantita_totale: 350, prezzo_unitario: 115, importo_periodo: 40250, importo_totale: 40250 },
    ]
  },
  {
    id: 's2', tipo: 'ATTIVO', numero: 2, codice: 'SAL-A-002',
    commessa: '26.PNA.RS.001', committente_subappaltatore: 'Comune di Napoli',
    data_emissione: '2026-05-10', data_scadenza_pagamento: '2026-06-09', data_approvazione: '',
    stato: 'INVIATO', importo_lordo: 100000, ritenuta_garanzia: 5000, ritenuta_acconto: 0,
    importo_netto: 95000, avanzamento_pct: 56, note_approvazione: '', approvatore: '',
    voci: [
      { id: 'v4', tipo: 'LAVORAZIONE', codice: '01.002', descrizione: 'Struttura in c.a.', um: 'mc', quantita_contratto: 120, quantita_precedente: 65, quantita_periodo: 55, quantita_totale: 120, prezzo_unitario: 420, importo_periodo: 23100, importo_totale: 50400 },
      { id: 'v5', tipo: 'LAVORAZIONE', codice: '03.001', descrizione: 'Intonaci interni', um: 'mq', quantita_contratto: 1200, quantita_precedente: 0, quantita_periodo: 600, quantita_totale: 600, prezzo_unitario: 28, importo_periodo: 16800, importo_totale: 16800 },
      { id: 'v6', tipo: 'MATERIALE', codice: 'MAT-001', descrizione: 'Fornitura serramenti', um: 'nr', quantita_contratto: 45, quantita_precedente: 0, quantita_periodo: 20, quantita_totale: 20, prezzo_unitario: 3005, importo_periodo: 60100, importo_totale: 60100 },
    ]
  },
  {
    id: 's3', tipo: 'PASSIVO', numero: 1, codice: 'SAL-P-001',
    commessa: '26.PNA.RS.001', committente_subappaltatore: 'Muratori Rossi Srl',
    data_emissione: '2026-04-01', data_scadenza_pagamento: '2026-05-01', data_approvazione: '',
    stato: 'BOZZA', importo_lordo: 16200, ritenuta_garanzia: 810, ritenuta_acconto: 648,
    importo_netto: 14742, avanzamento_pct: 100, note_approvazione: '', approvatore: '',
    voci: [
      { id: 'v7', tipo: 'LAVORAZIONE', codice: '02.001', descrizione: 'Murature perimetrali', um: 'mq', quantita_contratto: 350, quantita_precedente: 0, quantita_periodo: 350, quantita_totale: 350, prezzo_unitario: 45, importo_periodo: 15750, importo_totale: 15750 },
      { id: 'v8', tipo: 'ONERE', codice: 'ON-001', descrizione: 'Oneri sicurezza', um: 'corpo', quantita_contratto: 1, quantita_precedente: 0, quantita_periodo: 1, quantita_totale: 1, prezzo_unitario: 450, importo_periodo: 450, importo_totale: 450 },
    ]
  },
  {
    id: 's4', tipo: 'PASSIVO', numero: 1, codice: 'SAL-P-002',
    commessa: '26.PNA.RS.001', committente_subappaltatore: 'Elettrica Sud Srl',
    data_emissione: '2026-04-15', data_scadenza_pagamento: '2026-05-15', data_approvazione: '2026-04-20',
    stato: 'APPROVATO_NOTE', importo_lordo: 12000, ritenuta_garanzia: 600, ritenuta_acconto: 480,
    importo_netto: 10920, avanzamento_pct: 42, note_approvazione: 'Verificare quantità voce impianto terra', approvatore: 'Geom. Bianchi',
    voci: [
      { id: 'v9', tipo: 'LAVORAZIONE', codice: '03.001', descrizione: 'Impianto elettrico quadri', um: 'corpo', quantita_contratto: 1, quantita_precedente: 0, quantita_periodo: 1, quantita_totale: 1, prezzo_unitario: 8500, importo_periodo: 8500, importo_totale: 8500 },
      { id: 'v10', tipo: 'LAVORAZIONE', codice: '03.002', descrizione: 'Canalizzazioni BT', um: 'ml', quantita_contratto: 180, quantita_precedente: 0, quantita_periodo: 80, quantita_totale: 80, prezzo_unitario: 43.75, importo_periodo: 3500, importo_totale: 3500 },
    ]
  },
]

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// ─── Componente principale ─────────────────────────────────────────────────────
export default function SALPage() {
  const [salList, setSalList] = useState<SAL[]>(DEMO_SAL)
  const [tab, setTab] = useState<'ATTIVO' | 'PASSIVO'>('ATTIVO')
  const [selected, setSelected] = useState<string | null>(null)
  const [showApprovaModal, setShowApprovaModal] = useState(false)
  const [noteApprovazione, setNoteApprovazione] = useState('')
  const [approvatore, setApprovatore] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [vociEspanse, setVociEspanse] = useState(true)

  const filtered = salList.filter(s => s.tipo === tab)
  const salSelezionato = salList.find(s => s.id === selected) ?? null

  // Totali
  const totaleEmesso = filtered.filter(s => s.stato !== 'BOZZA').reduce((s, sal) => s + sal.importo_lordo, 0)
  const totalePagato = filtered.filter(s => s.stato === 'PAGATO').reduce((s, sal) => s + sal.importo_netto, 0)
  const totaleInAttesa = filtered.filter(s => ['INVIATO', 'APPROVATO', 'APPROVATO_NOTE'].includes(s.stato)).reduce((s, sal) => s + sal.importo_netto, 0)

  function approva(esito: 'APPROVATO' | 'APPROVATO_NOTE' | 'RIFIUTATO') {
    if (!selected) return
    setSalList(prev => prev.map(s => s.id !== selected ? s : {
      ...s,
      stato: esito,
      data_approvazione: new Date().toISOString().slice(0, 10),
      note_approvazione: noteApprovazione,
      approvatore,
    }))
    setShowApprovaModal(false)
    setNoteApprovazione('')
    setApprovatore('')
  }

  function inviaADL() {
    if (!selected) return
    setSalList(prev => prev.map(s => s.id !== selected ? s : { ...s, stato: 'INVIATO' }))
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', color: 'var(--t1)', fontSize: 13 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>M5 — SAL Attivi e Passivi</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>Stati Avanzamento Lavori · Committente e Subappaltatori</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Nuovo SAL
        </button>
      </div>

      {/* Tabs ATTIVO / PASSIVO */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['ATTIVO', 'PASSIVO'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSelected(null) }} style={{
            padding: '10px 28px', borderRadius: 10, border: 'none',
            background: tab === t ? (t === 'ATTIVO' ? '#3b82f6' : '#8b5cf6') : 'var(--panel)',
            color: tab === t ? 'white' : 'var(--t2)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
          }}>
            {t === 'ATTIVO' ? '📤 SAL Attivi (→ Committente)' : '📥 SAL Passivi (→ Subappaltatori)'}
          </button>
        ))}
        <div style={{ marginLeft: 12, padding: '10px 16px', background: tab === 'ATTIVO' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)', border: `1px solid ${tab === 'ATTIVO' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)'}`, borderRadius: 10, fontSize: 12, color: 'var(--t3)' }}>
          {tab === 'ATTIVO'
            ? '💡 I SAL attivi vengono inviati al committente per approvazione e fatturazione'
            : '💡 I SAL passivi richiedono approvazione del Responsabile Commessa prima del pagamento'}
        </div>
      </div>

      {/* KPI */}
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

      {/* Layout principale */}
      <div style={{ display: 'grid', gridTemplateColumns: salSelezionato ? '420px 1fr' : '1fr', gap: 16 }}>

        {/* Lista SAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(sal => {
            const sm = STATO_META[sal.stato]
            const isSelected = selected === sal.id
            const scaduto = sal.data_scadenza_pagamento && new Date(sal.data_scadenza_pagamento) < new Date() && sal.stato !== 'PAGATO'
            return (
              <div key={sal.id}
                onClick={() => setSelected(sal.id === selected ? null : sal.id)}
                style={{
                  background: 'var(--panel)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{sal.codice}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: sm.color, background: `${sm.color}15`, border: `1px solid ${sm.color}30`, borderRadius: 5, padding: '2px 8px' }}>{sm.label}</span>
                      {scaduto && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠ SCADUTO</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>{sal.committente_subappaltatore}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>Commessa: {sal.commessa}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(sal.importo_lordo)}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>netto: € {fmt(sal.importo_netto)}</div>
                  </div>
                </div>

                {/* Barra avanzamento */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>Avanzamento lavori</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: tab === 'ATTIVO' ? '#3b82f6' : '#8b5cf6' }}>{sal.avanzamento_pct}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${sal.avanzamento_pct}%`, height: '100%', background: tab === 'ATTIVO' ? '#3b82f6' : '#8b5cf6', borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)' }}>
                  <span>Emissione: {sal.data_emissione}</span>
                  <span>Scadenza pag.: {sal.data_scadenza_pagamento || '—'}</span>
                </div>

                {sal.note_approvazione && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, fontSize: 11, color: '#f59e0b' }}>
                    📝 {sal.note_approvazione}
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12 }}>
              Nessun SAL {tab === 'ATTIVO' ? 'attivo' : 'passivo'}. Clicca &quot;Nuovo SAL&quot; per crearne uno.
            </div>
          )}
        </div>

        {/* Dettaglio SAL */}
        {salSelezionato && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 2 }}>{salSelezionato.commessa} · {salSelezionato.committente_subappaltatore}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{salSelezionato.codice} — SAL N° {salSelezionato.numero}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Azioni */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {salSelezionato.stato === 'BOZZA' && (
                <button onClick={inviaADL} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: tab === 'ATTIVO' ? '#3b82f6' : '#8b5cf6', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Send size={13} /> {tab === 'ATTIVO' ? 'Invia a DL' : 'Invia a Resp. Commessa'}
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

              {/* Riepilogo economico */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Quadro Economico SAL</div>
                {[
                  { label: 'Importo lordo lavori', val: salSelezionato.importo_lordo, color: 'var(--t1)' },
                  { label: `Ritenuta garanzia (${salSelezionato.importo_lordo > 0 ? ((salSelezionato.ritenuta_garanzia / salSelezionato.importo_lordo) * 100).toFixed(1) : 0}%)`, val: -salSelezionato.ritenuta_garanzia, color: '#f59e0b' },
                  ...(tab === 'PASSIVO' ? [{ label: `Ritenuta acconto (${salSelezionato.importo_lordo > 0 ? ((salSelezionato.ritenuta_acconto / salSelezionato.importo_lordo) * 100).toFixed(1) : 0}%)`, val: -salSelezionato.ritenuta_acconto, color: '#8b5cf6' }] : []),
                  { label: 'NETTO A PAGARE', val: salSelezionato.importo_netto, color: tab === 'ATTIVO' ? '#3b82f6' : '#8b5cf6', bold: true },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: (r as { bold?: boolean }).bold ? 700 : 400 }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: (r as { bold?: boolean }).bold ? 800 : 600, color: r.color }}>
                      {r.val < 0 ? '− ' : ''}€ {fmt(Math.abs(r.val))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dettaglio approvazione */}
              {salSelezionato.approvatore && (
                <div style={{ background: salSelezionato.stato === 'APPROVATO' ? 'rgba(16,185,129,0.06)' : salSelezionato.stato === 'RIFIUTATO' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${salSelezionato.stato === 'APPROVATO' ? 'rgba(16,185,129,0.2)' : salSelezionato.stato === 'RIFIUTATO' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>
                    {salSelezionato.stato === 'APPROVATO' ? '✅' : salSelezionato.stato === 'RIFIUTATO' ? '❌' : '📝'} {STATO_META[salSelezionato.stato].label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                    {salSelezionato.approvatore} · {salSelezionato.data_approvazione}
                  </div>
                  {salSelezionato.note_approvazione && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--t2)' }}>{salSelezionato.note_approvazione}</div>
                  )}
                </div>
              )}

              {/* Voci SAL */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Voci SAL ({salSelezionato.voci.length})</div>
                  <button onClick={() => setVociEspanse(!vociEspanse)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    {vociEspanse ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {vociEspanse ? 'Comprimi' : 'Espandi'}
                  </button>
                </div>

                {vociEspanse && (
                  <div style={{ background: 'var(--bg)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(59,130,246,0.05)' }}>
                          {['Codice', 'Descrizione', 'U.M.', 'Q.tà contr.', 'Q.tà prec.', 'Q.tà periodo', 'P.U. €', 'Importo periodo'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {salSelezionato.voci.map(voce => (
                          <tr key={voce.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--t3)' }}>{voce.codice}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--t1)', maxWidth: 180 }}>{voce.descrizione}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>{voce.um}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t3)' }}>{voce.quantita_contratto}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t3)' }}>{voce.quantita_precedente}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{voce.quantita_periodo}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t2)' }}>€ {fmt(voce.prezzo_unitario)}</td>
                            <td style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t1)', fontWeight: 700 }}>€ {fmt(voce.importo_periodo)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(59,130,246,0.04)' }}>
                          <td colSpan={7} style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>TOTALE SAL</td>
                          <td style={{ padding: '10px', fontSize: 14, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>
                            € {fmt(salSelezionato.voci.reduce((s, v) => s + v.importo_periodo, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL APPROVAZIONE */}
      {showApprovaModal && salSelezionato && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 480, padding: '28px 32px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>Gestione SAL</h2>
            <p style={{ fontSize: 12, color: 'var(--t3)', margin: '0 0 20px' }}>{salSelezionato.codice} · {salSelezionato.committente_subappaltatore} · € {fmt(salSelezionato.importo_lordo)}</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Approvatore / Responsabile *</label>
              <input value={approvatore} onChange={e => setApprovatore(e.target.value)} placeholder="Es. Ing. Rossi DL"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Note / Annotazioni</label>
              <textarea value={noteApprovazione} onChange={e => setNoteApprovazione(e.target.value)} placeholder="Eventuali note, riserve o richieste di revisione..."
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13, resize: 'vertical', minHeight: 80 }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => approva('APPROVATO')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ✅ Approva
              </button>
              <button onClick={() => approva('APPROVATO_NOTE')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#f59e0b', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                📝 Approva con note
              </button>
              <button onClick={() => approva('RIFIUTATO')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ❌ Rifiuta
              </button>
            </div>
            <button onClick={() => setShowApprovaModal(false)} style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
