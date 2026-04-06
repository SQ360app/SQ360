'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { FileText, Clock, CheckCircle, AlertCircle, Euro, TrendingUp, CreditCard, ChevronDown, ChevronRight, Plus, Download } from 'lucide-react'

// ─── Tipi ────────────────────────────────────────────────────────────────────
type TipoFattura = 'attiva' | 'passiva'
type StatoPagamento = 'da_emettere' | 'emessa' | 'inviata' | 'pagata' | 'scaduta' | 'contestata'

interface Fattura {
  id: string
  numero: string
  tipo: TipoFattura
  soggetto: string      // cliente o fornitore
  commessa: string
  importo_imponibile: number
  iva_pct: number
  ritenuta_garanzia_pct: number
  ritenuta_acconto_pct: number
  data_emissione: string
  data_scadenza: string
  stato: StatoPagamento
  note: string
  collegata_sal: string
}

// ─── Dati campione ────────────────────────────────────────────────────────────
const FATTURE_INIT: Fattura[] = [
  { id:'f1', numero:'001/2024', tipo:'attiva', soggetto:'Comune di Milano', commessa:'C-2024-007', importo_imponibile:80000, iva_pct:10, ritenuta_garanzia_pct:5, ritenuta_acconto_pct:0, data_emissione:'2024-03-20', data_scadenza:'2024-04-19', stato:'pagata', note:'SAL 1', collegata_sal:'SAL-A-001' },
  { id:'f2', numero:'002/2024', tipo:'attiva', soggetto:'Comune di Milano', commessa:'C-2024-007', importo_imponibile:100000, iva_pct:10, ritenuta_garanzia_pct:5, ritenuta_acconto_pct:0, data_emissione:'2024-05-10', data_scadenza:'2024-06-09', stato:'inviata', note:'SAL 2', collegata_sal:'SAL-A-002' },
  { id:'f3', numero:'003/2024', tipo:'attiva', soggetto:'Mario Bianchi Srl', commessa:'C-2024-003', importo_imponibile:45000, iva_pct:22, ritenuta_garanzia_pct:0, ritenuta_acconto_pct:0, data_emissione:'2024-04-01', data_scadenza:'2024-04-31', stato:'scaduta', note:'Acconto', collegata_sal:'' },
  { id:'f4', numero:'FPA-021', tipo:'passiva', soggetto:'Muratori Rossi srl', commessa:'C-2024-007', importo_imponibile:16200, iva_pct:22, ritenuta_garanzia_pct:5, ritenuta_acconto_pct:4, data_emissione:'2024-04-15', data_scadenza:'2024-05-15', stato:'pagata', note:'Sub SAL 1', collegata_sal:'' },
  { id:'f5', numero:'FPA-031', tipo:'passiva', soggetto:'Elettrica Sud srl', commessa:'C-2024-007', importo_imponibile:28000, iva_pct:22, ritenuta_garanzia_pct:5, ritenuta_acconto_pct:4, data_emissione:'2024-05-20', data_scadenza:'2024-06-20', stato:'emessa', note:'Sub ordine 1', collegata_sal:'' },
  { id:'f6', numero:'FPA-035', tipo:'passiva', soggetto:'Calcestruzzi Nord spa', commessa:'C-2024-007', importo_imponibile:12800, iva_pct:22, ritenuta_garanzia_pct:0, ritenuta_acconto_pct:0, data_emissione:'2024-05-05', data_scadenza:'2024-06-04', stato:'scaduta', note:'Fornitore materiali', collegata_sal:'' },
]

const STATO_META: Record<StatoPagamento, { label: string; color: string }> = {
  da_emettere: { label: 'Da emettere', color: '#6b7280' },
  emessa: { label: 'Emessa', color: '#3b82f6' },
  inviata: { label: 'Inviata', color: '#8b5cf6' },
  pagata: { label: 'Pagata', color: '#10b981' },
  scaduta: { label: 'Scaduta', color: '#ef4444' },
  contestata: { label: 'Contestata', color: '#f59e0b' },
}

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function calcola(f: Fattura) {
  const iva = f.importo_imponibile * f.iva_pct / 100
  const totale_lordo = f.importo_imponibile + iva
  const ritenuta_g = f.importo_imponibile * f.ritenuta_garanzia_pct / 100
  const ritenuta_a = f.importo_imponibile * f.ritenuta_acconto_pct / 100
  const netto_dovuto = f.tipo === 'attiva'
    ? totale_lordo - ritenuta_g
    : totale_lordo - ritenuta_g - ritenuta_a
  return { iva, totale_lordo, ritenuta_g, ritenuta_a, netto_dovuto }
}

function isScaduta(f: Fattura) {
  return new Date(f.data_scadenza) < new Date() && f.stato !== 'pagata'
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function AmministrazionePage() {
  const [fatture] = useState<Fattura[]>(FATTURE_INIT)
  const [tab, setTab] = useState<'attive' | 'passive' | 'riepilogo'>('riepilogo')
  const [filtroStato, setFiltroStato] = useState<StatoPagamento | 'tutti'>('tutti')

  const attive = fatture.filter(f => f.tipo === 'attiva')
  const passive = fatture.filter(f => f.tipo === 'passiva')

  // ── Totali ──
  const creditiTotali = attive.reduce((s, f) => s + calcola(f).netto_dovuto, 0)
  const creditiPagati = attive.filter(f => f.stato === 'pagata').reduce((s, f) => s + calcola(f).netto_dovuto, 0)
  const creditiDaRicevere = creditiTotali - creditiPagati

  const debitiTotali = passive.reduce((s, f) => s + calcola(f).netto_dovuto, 0)
  const debitiPagati = passive.filter(f => f.stato === 'pagata').reduce((s, f) => s + calcola(f).netto_dovuto, 0)
  const debitiDaPagare = debitiTotali - debitiPagati

  const ritenute_g_attive = attive.reduce((s, f) => s + calcola(f).ritenuta_g, 0)
  const ritenute_g_passive = passive.reduce((s, f) => s + calcola(f).ritenuta_g, 0)
  const ritenute_a_passive = passive.reduce((s, f) => s + calcola(f).ritenuta_a, 0)

  const fatture_scadute = fatture.filter(f => f.stato === 'scaduta')

  const filtered = fatture.filter(f => {
    const tipoOk = tab === 'riepilogo' || f.tipo === (tab === 'attive' ? 'attiva' : 'passiva')
    const statoOk = filtroStato === 'tutti' || f.stato === filtroStato
    return tipoOk && statoOk
  })

  return (
    <>
      <Header title="M6 — Amministrazione" breadcrumb={['Dashboard', 'Amministrazione']} />
      <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

        {/* Alert scadute */}
        {fatture_scadute.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={16} color="#ef4444" />
            <span style={{ fontSize: 13, color: '#fca5a5' }}>
              <strong>{fatture_scadute.length} fatture scadute</strong> senza riscontro di pagamento: {fatture_scadute.map(f => f.numero).join(', ')}
            </span>
          </div>
        )}

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Crediti da ricevere', val: `€ ${fmt(creditiDaRicevere)}`, sub: `Tot. emesso: € ${fmt(creditiTotali)}`, color: '#3b82f6' },
            { label: 'Debiti da pagare', val: `€ ${fmt(debitiDaPagare)}`, sub: `Tot. passive: € ${fmt(debitiTotali)}`, color: '#ef4444' },
            { label: 'Posizione netta', val: `€ ${fmt(creditiDaRicevere - debitiDaPagare)}`, sub: 'Crediti − Debiti', color: (creditiDaRicevere - debitiDaPagare) >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Ritenute garanzia attive', val: `€ ${fmt(ritenute_g_attive)}`, sub: 'Da svincolare a fine lavori', color: '#f59e0b' },
            { label: 'Ritenute passive (acc.)', val: `€ ${fmt(ritenute_a_passive)}`, sub: 'Ritenuta d\'acconto sub', color: '#8b5cf6' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', borderLeft: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['riepilogo', 'attive', 'passive'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
              background: tab === t ? 'var(--accent)' : 'var(--panel)',
              color: tab === t ? 'white' : 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>
              {t === 'riepilogo' ? '📊 Riepilogo' : t === 'attive' ? '📤 Fatture Attive' : '📥 Fatture Passive'}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <select value={filtroStato} onChange={e => setFiltroStato(e.target.value as typeof filtroStato)} style={{
              background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '8px 12px', color: 'var(--t2)', fontSize: 13
            }}>
              <option value="tutti">Tutti gli stati</option>
              {(Object.keys(STATO_META) as StatoPagamento[]).map(s => <option key={s} value={s}>{STATO_META[s].label}</option>)}
            </select>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'white', fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} /> Nuova fattura
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>
              <Download size={14} /> Esporta
            </button>
          </div>
        </div>

        {/* Tabella fatture */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['N°', 'Tipo', 'Soggetto', 'Commessa', 'Imponibile', 'IVA', 'Rit. Gar.', 'Rit. Acc.', 'Netto dovuto', 'Scadenza', 'SAL', 'Stato'].map(h => (
                  <th key={h} style={{ padding: '10px 10px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const c = calcola(f)
                const scaduta = isScaduta(f)
                const sm = STATO_META[f.stato]
                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--border)', background: scaduta ? 'rgba(239,68,68,0.04)' : 'var(--panel)' }}>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--t1)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{f.numero}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ fontSize: 10, background: f.tipo === 'attiva' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)', color: f.tipo === 'attiva' ? '#3b82f6' : '#ef4444', border: `1px solid ${f.tipo === 'attiva' ? '#3b82f640' : '#ef444440'}`, borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
                        {f.tipo === 'attiva' ? '↑ Attiva' : '↓ Passiva'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--t1)' }}>{f.soggetto}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{f.commessa}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>€ {fmt(f.importo_imponibile)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>€ {fmt(c.iva)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: '#f59e0b', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{c.ritenuta_g > 0 ? `€ ${fmt(c.ritenuta_g)}` : '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, color: '#8b5cf6', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{c.ritenuta_a > 0 ? `€ ${fmt(c.ritenuta_a)}` : '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>€ {fmt(c.netto_dovuto)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: scaduta ? '#ef4444' : 'var(--t2)', fontFamily: 'var(--font-mono)', fontWeight: scaduta ? 700 : 400 }}>
                      {f.data_scadenza}
                      {scaduta && <div style={{ fontSize: 9, color: '#ef4444' }}>SCADUTA</div>}
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{f.collegata_sal || '—'}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ fontSize: 10, background: `${sm.color}18`, color: sm.color, border: `1px solid ${sm.color}40`, borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>{sm.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Note ritenute */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>⚠️ Ritenute di garanzia (attive)</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.6 }}>
              Totale ritenuto dal committente: <strong>€ {fmt(ritenute_g_attive)}</strong><br />
              Svincolate al collaudo definitivo secondo contratto. Monitorare data di svincolo.
            </div>
          </div>
          <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8b5cf6', marginBottom: 6 }}>⚠️ Ritenute d&apos;acconto subappalti</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.6 }}>
              Totale ritenuto a subappaltatori: <strong>€ {fmt(ritenute_a_passive)}</strong><br />
              Da versare in F24 entro il 16 del mese successivo (D.Lgs. 36/2023, art. 119).
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
