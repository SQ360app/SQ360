'use client'

import { useState } from 'react'
import { Plus, Search, X, CheckCircle, AlertCircle, AlertTriangle, FileText, Euro, Calendar, Building2, ChevronDown, ChevronRight } from 'lucide-react'

// ─── Tipi ─────────────────────────────────────────────────────────────────────
type TipoContratto = 'SUBAPPALTO' | 'SUBAFFIDAMENTO' | 'NOLO' | 'FORNITURA'
type StatoContratto = 'BOZZA' | 'FIRMATO' | 'IN_ESECUZIONE' | 'SOSPESO' | 'CONCLUSO' | 'RESCISSO'

interface VoceContratto {
  id: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
}

interface Contratto {
  id: string
  codice: string
  tipo: TipoContratto
  commessa: string
  fornitore: string
  fornitore_piva: string
  oggetto: string
  importo_contrattuale: number
  importo_contabilizzato: number
  importo_pagato: number
  ritenuta_garanzia_pct: number
  ritenuta_acconto_pct: number
  data_stipula: string
  data_inizio: string
  data_fine: string
  stato: StatoContratto
  categoria_soa: string
  cig_subappalto: string
  autorizzazione_sa: boolean
  data_autorizzazione: string
  sal_emessi: number
  voci: VoceContratto[]
  note: string
}

// ─── Costanti ─────────────────────────────────────────────────────────────────
const TIPO_META: Record<TipoContratto, { label: string; color: string }> = {
  SUBAPPALTO: { label: 'Subappalto', color: '#8b5cf6' },
  SUBAFFIDAMENTO: { label: 'Subaffidamento', color: '#3b82f6' },
  NOLO: { label: 'Nolo a caldo', color: '#f59e0b' },
  FORNITURA: { label: 'Fornitura', color: '#10b981' },
}

const STATO_META: Record<StatoContratto, { label: string; color: string }> = {
  BOZZA: { label: 'Bozza', color: '#6b7280' },
  FIRMATO: { label: 'Firmato', color: '#3b82f6' },
  IN_ESECUZIONE: { label: 'In esecuzione', color: '#10b981' },
  SOSPESO: { label: 'Sospeso', color: '#f59e0b' },
  CONCLUSO: { label: 'Concluso', color: '#10b981' },
  RESCISSO: { label: 'Rescisso', color: '#ef4444' },
}

// ─── Dati demo ─────────────────────────────────────────────────────────────────
const DEMO: Contratto[] = [
  {
    id: 'c1', codice: 'CTR-2026-001', tipo: 'SUBAPPALTO',
    commessa: '26.PNA.RS.001', fornitore: 'Muratori Rossi Srl', fornitore_piva: '12345678901',
    oggetto: 'Esecuzione murature perimetrali e partizioni interne — lavorazioni art. 119 D.Lgs. 36/2023',
    importo_contrattuale: 45000, importo_contabilizzato: 16200, importo_pagato: 14742,
    ritenuta_garanzia_pct: 5, ritenuta_acconto_pct: 4,
    data_stipula: '2026-02-15', data_inizio: '2026-03-01', data_fine: '2026-06-30',
    stato: 'IN_ESECUZIONE', categoria_soa: 'OG1 cl.II',
    cig_subappalto: 'A12345678B-SUB01', autorizzazione_sa: true, data_autorizzazione: '2026-02-20',
    sal_emessi: 1, note: 'Conforme D.Lgs. 36/2023 art. 119 — Subappalto autorizzato SA',
    voci: [
      { id: 'v1', codice: '02.001', descrizione: 'Muratura laterizio 30cm', um: 'mq', quantita: 380, prezzo_unitario: 45, importo: 17100 },
      { id: 'v2', codice: '02.002', descrizione: 'Intonaco civile interno', um: 'mq', quantita: 1200, prezzo_unitario: 22, importo: 26400 },
      { id: 'v3', codice: 'ON-001', descrizione: 'Oneri sicurezza', um: 'corpo', quantita: 1, prezzo_unitario: 1500, importo: 1500 },
    ]
  },
  {
    id: 'c2', codice: 'CTR-2026-002', tipo: 'SUBAPPALTO',
    commessa: '26.PNA.RS.001', fornitore: 'Elettrica Sud Srl', fornitore_piva: '11223344556',
    oggetto: 'Realizzazione impianto elettrico BT, quadri, illuminazione e cablaggio strutturato',
    importo_contrattuale: 28000, importo_contabilizzato: 12000, importo_pagato: 0,
    ritenuta_garanzia_pct: 5, ritenuta_acconto_pct: 4,
    data_stipula: '2026-03-10', data_inizio: '2026-05-01', data_fine: '2026-07-31',
    stato: 'IN_ESECUZIONE', categoria_soa: 'OG10 cl.I',
    cig_subappalto: 'A12345678B-SUB02', autorizzazione_sa: true, data_autorizzazione: '2026-03-15',
    sal_emessi: 1, note: 'Primo SAL con annotazioni DL su impianto terra',
    voci: [
      { id: 'v4', codice: '03.001', descrizione: 'Impianto elettrico quadri BT', um: 'corpo', quantita: 1, prezzo_unitario: 8500, importo: 8500 },
      { id: 'v5', codice: '03.002', descrizione: 'Canalizzazioni e cablaggi', um: 'ml', quantita: 450, prezzo_unitario: 38, importo: 17100 },
      { id: 'v6', codice: '03.003', descrizione: 'Illuminazione LED', um: 'nr', quantita: 40, prezzo_unitario: 60, importo: 2400 },
    ]
  },
  {
    id: 'c3', codice: 'CTR-2026-003', tipo: 'FORNITURA',
    commessa: '26.PNA.RS.001', fornitore: 'Calcestruzzi Nord Spa', fornitore_piva: '98765432109',
    oggetto: 'Fornitura calcestruzzo preconfezionato C28/35 XC2 per strutture portanti',
    importo_contrattuale: 14025, importo_contabilizzato: 14025, importo_pagato: 14025,
    ritenuta_garanzia_pct: 0, ritenuta_acconto_pct: 0,
    data_stipula: '2026-02-20', data_inizio: '2026-03-05', data_fine: '2026-04-30',
    stato: 'CONCLUSO', categoria_soa: '',
    cig_subappalto: '', autorizzazione_sa: false, data_autorizzazione: '',
    sal_emessi: 2, note: 'Fornitura completata — DAM approvato DL',
    voci: [
      { id: 'v7', codice: 'MAT-001', descrizione: 'Calcestruzzo C28/35 XC2 Dmax20', um: 'mc', quantita: 85, prezzo_unitario: 165, importo: 14025 },
    ]
  },
]

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const FORM_VUOTO: Omit<Contratto, 'id' | 'codice' | 'voci' | 'importo_contabilizzato' | 'importo_pagato' | 'sal_emessi'> = {
  tipo: 'SUBAPPALTO', commessa: '', fornitore: '', fornitore_piva: '',
  oggetto: '', importo_contrattuale: 0,
  ritenuta_garanzia_pct: 5, ritenuta_acconto_pct: 4,
  data_stipula: '', data_inizio: '', data_fine: '',
  stato: 'BOZZA', categoria_soa: '', cig_subappalto: '',
  autorizzazione_sa: false, data_autorizzazione: '', note: '',
}

// ─── Componente principale ─────────────────────────────────────────────────────
export default function ContrattiPage() {
  const [contratti, setContratti] = useState<Contratto[]>(DEMO)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoContratto | 'TUTTI'>('TUTTI')
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [vociEspanse, setVociEspanse] = useState(true)

  function setF(field: string, val: unknown) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  const filtered = contratti.filter(c => {
    const matchSearch = !search ||
      c.fornitore.toLowerCase().includes(search.toLowerCase()) ||
      c.codice.toLowerCase().includes(search.toLowerCase()) ||
      c.commessa.includes(search)
    const matchTipo = filtroTipo === 'TUTTI' || c.tipo === filtroTipo
    return matchSearch && matchTipo
  })

  const contrattoSelezionato = contratti.find(c => c.id === selected) ?? null

  // Alert: subappalti senza autorizzazione SA
  const alertSA = contratti.filter(c => c.tipo === 'SUBAPPALTO' && !c.autorizzazione_sa && c.stato !== 'BOZZA' && c.stato !== 'CONCLUSO')

  // Totali
  const totaleContrattuale = filtered.reduce((s, c) => s + c.importo_contrattuale, 0)
  const totaleContabilizzato = filtered.reduce((s, c) => s + c.importo_contabilizzato, 0)
  const totalePagato = filtered.reduce((s, c) => s + c.importo_pagato, 0)

  function salva() {
    const codice = `CTR-${new Date().getFullYear()}-${String(contratti.length + 1).padStart(3, '0')}`
    setContratti(prev => [{
      ...form, id: Date.now().toString(), codice,
      voci: [], importo_contabilizzato: 0, importo_pagato: 0, sal_emessi: 0
    }, ...prev])
    setShowForm(false)
    setForm({ ...FORM_VUOTO })
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }
  const labelStyle = { fontSize: 10, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Contratti Subappalto</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>D.Lgs. 36/2023 · Subappalto, Subaffidamento, Nolo, Fornitura</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Nuovo Contratto
        </button>
      </div>

      {/* Alert SA */}
      {alertSA.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={15} color="#ef4444" />
          <span style={{ fontSize: 13, color: '#fca5a5' }}>
            <strong>{alertSA.length} subappalti</strong> senza autorizzazione Stazione Appaltante: {alertSA.map(c => c.codice).join(', ')}
          </span>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Totale contrattuale', val: `€ ${fmt(totaleContrattuale)}`, color: '#3b82f6' },
          { label: 'Contabilizzato', val: `€ ${fmt(totaleContabilizzato)}`, color: '#f59e0b' },
          { label: 'Pagato', val: `€ ${fmt(totalePagato)}`, color: '#10b981' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca fornitore, codice, commessa..."
            style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['TUTTI', ...Object.keys(TIPO_META)] as (TipoContratto | 'TUTTI')[]).map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)} style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: filtroTipo === t ? 'var(--accent)' : 'var(--panel)',
              color: filtroTipo === t ? 'white' : 'var(--t2)'
            }}>{t === 'TUTTI' ? 'Tutti' : TIPO_META[t].label}</button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: contrattoSelezionato ? '420px 1fr' : '1fr', gap: 16 }}>

        {/* Lista contratti */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const tm = TIPO_META[c.tipo]
            const sm = STATO_META[c.stato]
            const isSelected = selected === c.id
            const avanzamento = c.importo_contrattuale > 0 ? (c.importo_contabilizzato / c.importo_contrattuale) * 100 : 0
            const ritenute = c.importo_contabilizzato * (c.ritenuta_garanzia_pct + c.ritenuta_acconto_pct) / 100

            return (
              <div key={c.id}
                onClick={() => setSelected(c.id === selected ? null : c.id)}
                style={{
                  background: 'var(--panel)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : 'none', transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>{c.codice}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: tm.color, background: `${tm.color}15`, border: `1px solid ${tm.color}30`, borderRadius: 5, padding: '2px 7px' }}>{tm.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: sm.color, background: `${sm.color}15`, border: `1px solid ${sm.color}30`, borderRadius: 5, padding: '2px 7px' }}>{sm.label}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{c.fornitore}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{c.commessa} · SAL emessi: {c.sal_emessi}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(c.importo_contrattuale)}</div>
                    {c.tipo === 'SUBAPPALTO' && !c.autorizzazione_sa && (
                      <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠ No autoriz. SA</div>
                    )}
                  </div>
                </div>

                {/* Barra avanzamento */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>Contabilizzato</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: tm.color }}>{avanzamento.toFixed(1)}% · € {fmt(c.importo_contabilizzato)}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(avanzamento, 100)}%`, height: '100%', background: tm.color, borderRadius: 2 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)' }}>
                  <span>Stipula: {c.data_stipula}</span>
                  <span>Fine: {c.data_fine}</span>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12 }}>
              Nessun contratto trovato.
            </div>
          )}
        </div>

        {/* Dettaglio contratto */}
        {contrattoSelezionato && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>{contrattoSelezionato.codice}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: TIPO_META[contrattoSelezionato.tipo].color }}>{TIPO_META[contrattoSelezionato.tipo].label}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{contrattoSelezionato.fornitore}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>P.IVA: {contrattoSelezionato.fornitore_piva} · {contrattoSelezionato.commessa}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Oggetto */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Oggetto del contratto</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{contrattoSelezionato.oggetto}</div>
              </div>

              {/* Quadro economico */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Quadro Economico</div>
                {[
                  { label: 'Importo contrattuale', val: contrattoSelezionato.importo_contrattuale, color: 'var(--t1)' },
                  { label: 'Importo contabilizzato (SAL)', val: contrattoSelezionato.importo_contabilizzato, color: '#f59e0b' },
                  { label: `Ritenuta garanzia (${contrattoSelezionato.ritenuta_garanzia_pct}%)`, val: -(contrattoSelezionato.importo_contabilizzato * contrattoSelezionato.ritenuta_garanzia_pct / 100), color: '#f59e0b' },
                  ...(contrattoSelezionato.tipo === 'SUBAPPALTO' ? [{ label: `Ritenuta acconto (${contrattoSelezionato.ritenuta_acconto_pct}%)`, val: -(contrattoSelezionato.importo_contabilizzato * contrattoSelezionato.ritenuta_acconto_pct / 100), color: '#8b5cf6' }] : []),
                  { label: 'Importo pagato', val: contrattoSelezionato.importo_pagato, color: '#10b981' },
                  { label: 'Residuo da liquidare', val: contrattoSelezionato.importo_contrattuale - contrattoSelezionato.importo_contabilizzato, color: '#3b82f6' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: r.color }}>
                      {r.val < 0 ? '− ' : ''}€ {fmt(Math.abs(r.val))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Compliance D.Lgs. 36/2023 */}
              {contrattoSelezionato.tipo === 'SUBAPPALTO' && (
                <div style={{ background: contrattoSelezionato.autorizzazione_sa ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${contrattoSelezionato.autorizzazione_sa ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Compliance D.Lgs. 36/2023
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Autorizzazione Stazione Appaltante', ok: contrattoSelezionato.autorizzazione_sa },
                      { label: 'CIG Subappalto', ok: !!contrattoSelezionato.cig_subappalto },
                      { label: 'Categoria SOA indicata', ok: !!contrattoSelezionato.categoria_soa },
                      { label: 'Quote subappalto ≤ 50% importo contratto principale', ok: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.ok ? <CheckCircle size={13} color="#10b981" /> : <AlertCircle size={13} color="#ef4444" />}
                        <span style={{ fontSize: 12, color: r.ok ? 'var(--t2)' : '#fca5a5' }}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                  {contrattoSelezionato.cig_subappalto && (
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--t3)' }}>
                      CIG subappalto: <strong style={{ fontFamily: 'var(--font-mono)' }}>{contrattoSelezionato.cig_subappalto}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Date */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Data stipula', val: contrattoSelezionato.data_stipula },
                  { label: 'Inizio lavori', val: contrattoSelezionato.data_inizio },
                  { label: 'Fine lavori', val: contrattoSelezionato.data_fine },
                ].map(r => (
                  <div key={r.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>{r.val || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Voci contratto */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Voci contratto ({contrattoSelezionato.voci.length})
                  </div>
                  <button onClick={() => setVociEspanse(!vociEspanse)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {vociEspanse ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {vociEspanse ? 'Comprimi' : 'Espandi'}
                  </button>
                </div>

                {vociEspanse && contrattoSelezionato.voci.length > 0 && (
                  <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(59,130,246,0.05)' }}>
                          {['Codice', 'Descrizione', 'U.M.', 'Q.tà', 'P.U. €', 'Importo €'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {contrattoSelezionato.voci.map(voce => (
                          <tr key={voce.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--t3)' }}>{voce.codice}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--t1)' }}>{voce.descrizione}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>{voce.um}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t2)' }}>{voce.quantita}</td>
                            <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t2)' }}>€ {fmt(voce.prezzo_unitario)}</td>
                            <td style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t1)', fontWeight: 700 }}>€ {fmt(voce.importo)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(59,130,246,0.04)' }}>
                          <td colSpan={5} style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>TOTALE</td>
                          <td style={{ padding: '10px', fontSize: 14, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>
                            € {fmt(contrattoSelezionato.voci.reduce((s, v) => s + v.importo, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {contrattoSelezionato.note && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>
                  <strong>Note:</strong> {contrattoSelezionato.note}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FileText size={13} /> Genera contratto PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL NUOVO CONTRATTO */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, width: '100%', maxWidth: 680, padding: '28px 32px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Nuovo Contratto</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} /></button>
            </div>

            {/* Tipo contratto */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tipo contratto *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.keys(TIPO_META) as TipoContratto[]).map(t => (
                  <button key={t} onClick={() => setF('tipo', t)} style={{
                    padding: '8px 16px', borderRadius: 8, border: `2px solid ${form.tipo === t ? TIPO_META[t].color : 'var(--border)'}`,
                    background: form.tipo === t ? `${TIPO_META[t].color}15` : 'var(--bg)',
                    color: form.tipo === t ? TIPO_META[t].color : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>{TIPO_META[t].label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { field: 'commessa', label: 'Commessa *', placeholder: '26.PNA.RS.001' },
                { field: 'fornitore', label: 'Fornitore/Subappaltatore *', placeholder: 'Muratori Rossi Srl' },
                { field: 'fornitore_piva', label: 'P.IVA Fornitore', placeholder: '12345678901' },
                { field: 'categoria_soa', label: 'Categoria SOA', placeholder: 'OG1 cl.II' },
                { field: 'cig_subappalto', label: 'CIG Subappalto', placeholder: 'A12345678B-SUB01' },
                { field: 'importo_contrattuale', label: 'Importo contrattuale (€)', placeholder: '0', type: 'number' },
                { field: 'ritenuta_garanzia_pct', label: 'Ritenuta garanzia (%)', placeholder: '5', type: 'number' },
                { field: 'ritenuta_acconto_pct', label: 'Ritenuta acconto (%)', placeholder: '4', type: 'number' },
                { field: 'data_stipula', label: 'Data stipula', placeholder: '', type: 'date' },
                { field: 'data_inizio', label: 'Data inizio', placeholder: '', type: 'date' },
                { field: 'data_fine', label: 'Data fine', placeholder: '', type: 'date' },
              ].map(f => (
                <div key={f.field}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder}
                    value={(form as Record<string, unknown>)[f.field] as string || ''}
                    onChange={e => setF(f.field, f.type === 'number' ? +e.target.value : e.target.value)}
                    style={inputStyle} />
                </div>
              ))}

              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Oggetto del contratto *</label>
                <textarea value={form.oggetto} onChange={e => setF('oggetto', e.target.value)}
                  placeholder="Descrizione completa dell'oggetto con riferimento alle lavorazioni e all'art. 119 D.Lgs. 36/2023 se subappalto..."
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="autorizzazione_sa" checked={form.autorizzazione_sa}
                  onChange={e => setF('autorizzazione_sa', e.target.checked)} style={{ cursor: 'pointer' }} />
                <label htmlFor="autorizzazione_sa" style={{ fontSize: 13, color: 'var(--t2)', cursor: 'pointer' }}>
                  Autorizzazione Stazione Appaltante ottenuta (obbligatoria per subappalti pubblici)
                </label>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salva} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Crea contratto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
