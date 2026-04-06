'use client'

import { useState } from 'react'
import { Plus, Search, X, ChevronDown, ChevronRight, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Calculator, FileText, Calendar, Euro, Building2 } from 'lucide-react'

// ─── Tipi ─────────────────────────────────────────────────────────────────────
type StatoGara = 'IN_PREPARAZIONE' | 'PRESENTATA' | 'IN_ATTESA' | 'AGGIUDICATA' | 'NON_AGGIUDICATA' | 'ESCLUSA'
type TipoAggiudicazione = 'OEV' | 'PREZZO' | 'QUALITA'

interface VoceSimulazione {
  id: string
  descrizione: string
  importo_base: number
  costo_interno: number
  percentuale: number
}

interface Gara {
  id: string
  codice: string
  nome: string
  committente: string
  cig: string
  cup: string
  tipo_aggiudicazione: TipoAggiudicazione
  importo_base: number
  oneri_sicurezza: number
  importo_soggetto_ribasso: number
  ribasso_offerto: number
  importo_offerto: number
  scadenza_presentazione: string
  data_aggiudicazione: string
  stato: StatoGara
  provincia: string
  categoria_opera: string
  categoria_soa: string
  costo_interno_stimato: number
  margine_stimato: number
  margine_pct: number
  voci_simulazione: VoceSimulazione[]
  note: string
  commessa_collegata: string
}

// ─── Costanti ─────────────────────────────────────────────────────────────────
const STATO_META: Record<StatoGara, { label: string; color: string }> = {
  IN_PREPARAZIONE: { label: 'In preparazione', color: '#6b7280' },
  PRESENTATA: { label: 'Presentata', color: '#3b82f6' },
  IN_ATTESA: { label: 'In attesa esito', color: '#f59e0b' },
  AGGIUDICATA: { label: 'Aggiudicata ✓', color: '#10b981' },
  NON_AGGIUDICATA: { label: 'Non aggiudicata', color: '#ef4444' },
  ESCLUSA: { label: 'Esclusa', color: '#dc2626' },
}

const TIPO_AGG: Record<TipoAggiudicazione, string> = {
  OEV: 'Offerta Economicamente Vantaggiosa',
  PREZZO: 'Minor Prezzo',
  QUALITA: 'Qualità/Prezzo',
}

const PROVINCE = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']

const CATEGORIE_OPERA = [
  { v: 'RS', l: 'Ristrutturazione' }, { v: 'NC', l: 'Nuova Costruzione' },
  { v: 'DR', l: 'Demo + Ricostruzione' }, { v: 'MS', l: 'Manutenzione Straordinaria' },
  { v: 'MO', l: 'Manutenzione Ordinaria' }, { v: 'IF', l: 'Infrastrutture' },
  { v: 'RE', l: 'Restauro' }, { v: 'IP', l: 'Impianti' },
]

// ─── Dati demo ─────────────────────────────────────────────────────────────────
const DEMO_GARE: Gara[] = [
  {
    id: 'g1', codice: 'GARA-2026-001', nome: 'Riqualificazione Palestra Comunale',
    committente: 'Comune di Salerno', cig: 'C12345678D', cup: 'F51H22000010007',
    tipo_aggiudicazione: 'OEV', importo_base: 850000, oneri_sicurezza: 18000,
    importo_soggetto_ribasso: 832000, ribasso_offerto: 9.5,
    importo_offerto: 753360, scadenza_presentazione: '2026-04-20',
    data_aggiudicazione: '', stato: 'IN_ATTESA', provincia: 'SA', categoria_opera: 'RS',
    categoria_soa: 'OG1 cl.II', costo_interno_stimato: 680000,
    margine_stimato: 73360, margine_pct: 9.74,
    voci_simulazione: [
      { id: 'v1', descrizione: 'Strutture e murature', importo_base: 280000, costo_interno: 245000, percentuale: 32.9 },
      { id: 'v2', descrizione: 'Impianti (sub)', importo_base: 180000, costo_interno: 162000, percentuale: 21.2 },
      { id: 'v3', descrizione: 'Finiture', importo_base: 220000, costo_interno: 198000, percentuale: 25.9 },
      { id: 'v4', descrizione: 'Opere esterne', importo_base: 152000, costo_interno: 75000, percentuale: 17.9 },
    ],
    note: 'Criterio qualità peso 70%, prezzo 30%', commessa_collegata: ''
  },
  {
    id: 'g2', codice: 'GARA-2026-002', nome: 'Nuova Scuola Primaria Via Leopardi',
    committente: 'Comune di Caserta', cig: 'D98765432E', cup: 'G51J22000050007',
    tipo_aggiudicazione: 'PREZZO', importo_base: 2200000, oneri_sicurezza: 44000,
    importo_soggetto_ribasso: 2156000, ribasso_offerto: 12.3,
    importo_offerto: 1892908, scadenza_presentazione: '2026-05-15',
    data_aggiudicazione: '', stato: 'IN_PREPARAZIONE', provincia: 'CE', categoria_opera: 'NC',
    categoria_soa: 'OG1 cl.III', costo_interno_stimato: 1720000,
    margine_stimato: 172908, margine_pct: 9.13,
    voci_simulazione: [
      { id: 'v1', descrizione: 'Fondazioni e strutture', importo_base: 660000, costo_interno: 580000, percentuale: 30.0 },
      { id: 'v2', descrizione: 'Murature e partizioni', importo_base: 440000, costo_interno: 390000, percentuale: 20.0 },
      { id: 'v3', descrizione: 'Impianti elettrici (sub)', importo_base: 330000, costo_interno: 297000, percentuale: 15.0 },
      { id: 'v4', descrizione: 'Impianti idraulici (sub)', importo_base: 286000, costo_interno: 257000, percentuale: 13.0 },
      { id: 'v5', descrizione: 'Finiture e serramenti', importo_base: 484000, costo_interno: 196000, percentuale: 22.0 },
    ],
    note: 'Attenzione: soglia anomalia stimata ~13%', commessa_collegata: ''
  },
  {
    id: 'g3', codice: 'GARA-2025-018', nome: 'Manutenzione Strade Comunali Lotto 3',
    committente: 'Comune di Napoli', cig: 'B11223344F', cup: '',
    tipo_aggiudicazione: 'PREZZO', importo_base: 450000, oneri_sicurezza: 9000,
    importo_soggetto_ribasso: 441000, ribasso_offerto: 15.2,
    importo_offerto: 383568, scadenza_presentazione: '2025-11-30',
    data_aggiudicazione: '2025-12-20', stato: 'AGGIUDICATA', provincia: 'NA', categoria_opera: 'MO',
    categoria_soa: 'OG3 cl.I', costo_interno_stimato: 340000,
    margine_stimato: 43568, margine_pct: 11.36,
    voci_simulazione: [],
    note: 'Aggiudicata. Commessa creata: 25.PNA.MO.004', commessa_collegata: '25.PNA.MO.004'
  },
]

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtPct(n: number) { return n.toFixed(3) + '%' }

const GARA_VUOTA: Omit<Gara, 'id' | 'codice' | 'voci_simulazione'> = {
  nome: '', committente: '', cig: '', cup: '',
  tipo_aggiudicazione: 'PREZZO', importo_base: 0, oneri_sicurezza: 0,
  importo_soggetto_ribasso: 0, ribasso_offerto: 0, importo_offerto: 0,
  scadenza_presentazione: '', data_aggiudicazione: '', stato: 'IN_PREPARAZIONE',
  provincia: 'NA', categoria_opera: 'NC', categoria_soa: '',
  costo_interno_stimato: 0, margine_stimato: 0, margine_pct: 0,
  note: '', commessa_collegata: '',
}

// ─── Componente principale ─────────────────────────────────────────────────────
export default function GarePage() {
  const [gare, setGare] = useState<Gara[]>(DEMO_GARE)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState<StatoGara | 'TUTTE'>('TUTTE')
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...GARA_VUOTA })
  const [ribasso, setRibasso] = useState(10)
  const [costoInterno, setCostoInterno] = useState(0)
  const [tabDettaglio, setTabDettaglio] = useState<'riepilogo' | 'simulatore' | 'voci'>('riepilogo')

  function setF(field: string, val: unknown) {
    setForm(prev => {
      const upd = { ...prev, [field]: val }
      // Ricalcola automaticamente
      const soggRibasso = (upd.importo_base || 0) - (upd.oneri_sicurezza || 0)
      const offerto = soggRibasso * (1 - (upd.ribasso_offerto || 0) / 100) + (upd.oneri_sicurezza || 0)
      return { ...upd, importo_soggetto_ribasso: soggRibasso, importo_offerto: offerto }
    })
  }

  const filtered = gare.filter(g => {
    const matchSearch = !search || g.nome.toLowerCase().includes(search.toLowerCase()) || g.committente.toLowerCase().includes(search.toLowerCase()) || g.cig.includes(search)
    const matchStato = filtroStato === 'TUTTE' || g.stato === filtroStato
    return matchSearch && matchStato
  })

  const garaSelezionata = gare.find(g => g.id === selected) ?? null

  // Simulatore ribasso
  const importoSoggetto = form.importo_base - form.oneri_sicurezza
  const importoOfferto = importoSoggetto * (1 - ribasso / 100) + form.oneri_sicurezza
  const margineSimulato = importoOfferto - costoInterno
  const marginePct = importoOfferto > 0 ? (margineSimulato / importoOfferto) * 100 : 0

  // Statistiche globali
  const totalPortafoglio = gare.filter(g => g.stato === 'AGGIUDICATA').reduce((s, g) => s + g.importo_offerto, 0)
  const inCorso = gare.filter(g => ['IN_PREPARAZIONE', 'PRESENTATA', 'IN_ATTESA'].includes(g.stato)).length
  const aggiudicate = gare.filter(g => g.stato === 'AGGIUDICATA').length
  const successRate = gare.length > 0 ? Math.round((aggiudicate / gare.length) * 100) : 0

  function salvaGara() {
    const nuova: Gara = {
      ...form,
      id: Date.now().toString(),
      codice: `GARA-${new Date().getFullYear()}-${String(gare.length + 1).padStart(3, '0')}`,
      voci_simulazione: [],
    }
    setGare(prev => [nuova, ...prev])
    setShowForm(false)
    setForm({ ...GARA_VUOTA })
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', color: 'var(--t1)', fontSize: 13 }
  const labelStyle = { fontSize: 10, color: 'var(--t3)', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>M1 — Analisi Gare</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>Gestione offerte, simulatore ribasso, analisi marginalità pre-gara</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Nuova Gara
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Gare in corso', val: inCorso, color: '#f59e0b', sub: 'Da presentare o in attesa' },
          { label: 'Aggiudicate', val: aggiudicate, color: '#10b981', sub: `Tasso successo: ${successRate}%` },
          { label: 'Portafoglio acquisito', val: `€ ${fmt(totalPortafoglio)}`, color: '#3b82f6', sub: 'Da gare aggiudicate' },
          { label: 'Totale gare', val: gare.length, color: '#8b5cf6', sub: 'Nel periodo corrente' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome, committente, CIG..."
            style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['TUTTE', ...Object.keys(STATO_META)] as (StatoGara | 'TUTTE')[]).map(s => (
            <button key={s} onClick={() => setFiltroStato(s)} style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: filtroStato === s ? 'var(--accent)' : 'var(--panel)',
              color: filtroStato === s ? 'white' : 'var(--t2)'
            }}>{s === 'TUTTE' ? 'Tutte' : STATO_META[s].label}</button>
          ))}
        </div>
      </div>

      {/* Layout principale */}
      <div style={{ display: 'grid', gridTemplateColumns: garaSelezionata ? '1fr 1fr' : '1fr', gap: 16 }}>

        {/* Lista gare */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['Codice', 'Gara', 'Committente', 'Importo base', 'Ribasso', 'Offerto', 'Scadenza', 'Stato'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => {
                const sm = STATO_META[g.stato]
                const isSelected = selected === g.id
                const giorniScadenza = g.scadenza_presentazione
                  ? Math.ceil((new Date(g.scadenza_presentazione).getTime() - Date.now()) / 86400000)
                  : null
                return (
                  <tr key={g.id}
                    onClick={() => { setSelected(g.id === selected ? null : g.id); setTabDettaglio('riepilogo') }}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(59,130,246,0.02)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '11px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>{g.codice}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{g.nome}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>{g.categoria_opera} · {TIPO_AGG[g.tipo_aggiudicazione]}</div>
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--t2)' }}>{g.committente}</td>
                    <td style={{ padding: '11px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t1)', fontWeight: 600 }}>€ {fmt(g.importo_base)}</td>
                    <td style={{ padding: '11px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: g.ribasso_offerto > 15 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                      {g.ribasso_offerto > 0 ? fmtPct(g.ribasso_offerto) : '—'}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t1)' }}>
                      {g.importo_offerto > 0 ? `€ ${fmt(g.importo_offerto)}` : '—'}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      {g.scadenza_presentazione ? (
                        <div>
                          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>{g.scadenza_presentazione}</div>
                          {giorniScadenza !== null && giorniScadenza > 0 && (
                            <div style={{ fontSize: 10, color: giorniScadenza <= 7 ? '#ef4444' : giorniScadenza <= 15 ? '#f59e0b' : '#10b981' }}>
                              {giorniScadenza}gg
                            </div>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: sm.color, background: `${sm.color}15`, border: `1px solid ${sm.color}40`, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>{sm.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Nessuna gara trovata. Clicca &quot;Nuova Gara&quot; per iniziare.
            </div>
          )}
        </div>

        {/* Dettaglio gara */}
        {garaSelezionata && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header dettaglio */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 2 }}>{garaSelezionata.codice}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{garaSelezionata.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{garaSelezionata.committente} · {garaSelezionata.provincia}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer', color: 'var(--t2)' }}>
                <X size={14} />
              </button>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
              {[
                { key: 'riepilogo', label: '📋 Riepilogo' },
                { key: 'simulatore', label: '🧮 Simulatore ribasso' },
                { key: 'voci', label: `📊 Analisi voci (${garaSelezionata.voci_simulazione.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTabDettaglio(t.key as typeof tabDettaglio)} style={{
                  flex: 1, padding: '10px', border: 'none', borderBottom: tabDettaglio === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'transparent', color: tabDettaglio === t.key ? 'var(--accent)' : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* TAB RIEPILOGO */}
              {tabDettaglio === 'riepilogo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Dati gara */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'CIG', val: garaSelezionata.cig || '—' },
                      { label: 'CUP', val: garaSelezionata.cup || '—' },
                      { label: 'Tipo aggiudicazione', val: TIPO_AGG[garaSelezionata.tipo_aggiudicazione] },
                      { label: 'Categoria SOA', val: garaSelezionata.categoria_soa || '—' },
                      { label: 'Scadenza presentazione', val: garaSelezionata.scadenza_presentazione || '—' },
                      { label: 'Data aggiudicazione', val: garaSelezionata.data_aggiudicazione || '—' },
                    ].map(r => (
                      <div key={r.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>{r.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Quadro economico */}
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Quadro Economico</div>
                    {[
                      { label: 'Importo base d\'asta', val: garaSelezionata.importo_base, color: 'var(--t1)' },
                      { label: 'Oneri sicurezza', val: garaSelezionata.oneri_sicurezza, color: 'var(--t2)' },
                      { label: 'Importo soggetto a ribasso', val: garaSelezionata.importo_soggetto_ribasso, color: 'var(--t2)' },
                      { label: `Ribasso offerto (${fmtPct(garaSelezionata.ribasso_offerto)})`, val: -(garaSelezionata.importo_soggetto_ribasso * garaSelezionata.ribasso_offerto / 100), color: '#ef4444' },
                      { label: 'IMPORTO OFFERTO', val: garaSelezionata.importo_offerto, color: '#3b82f6', bold: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: r.bold ? '2px solid var(--border)' : '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: r.bold ? 800 : 600, color: r.color }}>
                          € {fmt(Math.abs(r.val))}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Marginalità stimata */}
                  <div style={{ background: garaSelezionata.margine_pct >= 8 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${garaSelezionata.margine_pct >= 8 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margine stimato</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: garaSelezionata.margine_pct >= 8 ? '#10b981' : '#ef4444' }}>
                          € {fmt(garaSelezionata.margine_stimato)}
                        </div>
                      </div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: garaSelezionata.margine_pct >= 8 ? '#10b981' : '#ef4444' }}>
                        {garaSelezionata.margine_pct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Commessa collegata */}
                  {garaSelezionata.commessa_collegata && (
                    <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle size={15} color="#3b82f6" />
                      <span style={{ fontSize: 12, color: '#3b82f6' }}>Commessa collegata: <strong>{garaSelezionata.commessa_collegata}</strong></span>
                    </div>
                  )}

                  {garaSelezionata.note && (
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>
                      <strong>Note:</strong> {garaSelezionata.note}
                    </div>
                  )}
                </div>
              )}

              {/* TAB SIMULATORE RIBASSO */}
              {tabDettaglio === 'simulatore' && (
                <div>
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 12 }}>Parametri simulazione</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div>
                        <label style={labelStyle}>Importo base (€)</label>
                        <input type="number" value={form.importo_base || garaSelezionata.importo_base}
                          onChange={e => setF('importo_base', +e.target.value)}
                          style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Oneri sicurezza (€)</label>
                        <input type="number" value={form.oneri_sicurezza || garaSelezionata.oneri_sicurezza}
                          onChange={e => setF('oneri_sicurezza', +e.target.value)}
                          style={inputStyle} />
                      </div>
                    </div>

                    {/* Slider ribasso */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Ribasso offerto</label>
                        <span style={{ fontSize: 20, fontWeight: 800, color: ribasso > 15 ? '#ef4444' : ribasso > 10 ? '#f59e0b' : '#10b981' }}>{ribasso.toFixed(3)}%</span>
                      </div>
                      <input type="range" min="0" max="30" step="0.001" value={ribasso}
                        onChange={e => setRibasso(+e.target.value)}
                        style={{ width: '100%', accentColor: 'var(--accent)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                        <span>0%</span><span>Soglia anomalia ~13%</span><span>30%</span>
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Costo interno stimato (€)</label>
                      <input type="number" value={costoInterno || garaSelezionata.costo_interno_stimato}
                        onChange={e => setCostoInterno(+e.target.value)}
                        style={inputStyle} />
                    </div>
                  </div>

                  {/* Risultati simulazione */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Importo soggetto a ribasso', val: (form.importo_base || garaSelezionata.importo_base) - (form.oneri_sicurezza || garaSelezionata.oneri_sicurezza), color: 'var(--t2)' },
                      { label: `Ribasso (${ribasso.toFixed(3)}%)`, val: -((form.importo_base || garaSelezionata.importo_base) - (form.oneri_sicurezza || garaSelezionata.oneri_sicurezza)) * ribasso / 100, color: '#ef4444' },
                      { label: 'Importo offerto', val: importoOfferto, color: '#3b82f6', bold: true },
                      { label: 'Costo interno', val: -(costoInterno || garaSelezionata.costo_interno_stimato), color: '#f59e0b' },
                      { label: 'MARGINE STIMATO', val: margineSimulato, color: margineSimulato >= 0 ? '#10b981' : '#ef4444', bold: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: r.bold ? 'var(--bg)' : 'transparent', borderRadius: r.bold ? 8 : 0, borderBottom: !r.bold ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                        <span style={{ fontSize: r.bold ? 18 : 14, fontWeight: r.bold ? 800 : 600, color: r.color, fontFamily: 'var(--font-mono)' }}>
                          {r.val < 0 ? '− ' : ''}€ {fmt(Math.abs(r.val))}
                        </span>
                      </div>
                    ))}
                    <div style={{ padding: '12px 14px', background: margineSimulato >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: 10, border: `1px solid ${margineSimulato >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>Margine percentuale</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: margineSimulato >= 0 ? '#10b981' : '#ef4444' }}>
                        {marginePct.toFixed(2)}%
                      </div>
                      {marginePct < 5 && <div style={{ fontSize: 11, color: '#ef4444' }}>⚠️ Margine sotto soglia minima consigliata (5%)</div>}
                      {marginePct >= 5 && marginePct < 8 && <div style={{ fontSize: 11, color: '#f59e0b' }}>⚠️ Margine accettabile ma basso</div>}
                      {marginePct >= 8 && <div style={{ fontSize: 11, color: '#10b981' }}>✅ Margine adeguato</div>}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB VOCI */}
              {tabDettaglio === 'voci' && (
                <div>
                  {garaSelezionata.voci_simulazione.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                      <FileText size={32} color="var(--t3)" style={{ marginBottom: 12 }} />
                      <div>Nessuna voce inserita.</div>
                      <div style={{ marginTop: 4, fontSize: 12 }}>Importa il computo dalla sezione &quot;Import Computo&quot;</div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)' }}>
                            {['Lavorazione', 'Importo base', 'Costo interno', 'Margine', '%'].map(h => (
                              <th key={h} style={{ padding: '9px 12px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {garaSelezionata.voci_simulazione.map(v => {
                            const margine = v.importo_base - v.costo_interno
                            const mpct = v.importo_base > 0 ? (margine / v.importo_base) * 100 : 0
                            return (
                              <tr key={v.id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--t1)' }}>{v.descrizione}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>€ {fmt(v.importo_base)}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>€ {fmt(v.costo_interno)}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: margine >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>€ {fmt(margine)}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12, color: mpct >= 8 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{mpct.toFixed(1)}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL NUOVA GARA */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 700, padding: '28px 32px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Nuova Gara</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { field: 'nome', label: 'Nome gara *', placeholder: 'es. Riqualificazione Palestra', full: true },
                { field: 'committente', label: 'Committente *', placeholder: 'Comune di...' },
                { field: 'cig', label: 'CIG', placeholder: 'A12345678B' },
                { field: 'cup', label: 'CUP', placeholder: 'J51H22000010007' },
                { field: 'categoria_soa', label: 'Categoria SOA richiesta', placeholder: 'OG1 cl.II' },
                { field: 'scadenza_presentazione', label: 'Scadenza presentazione', placeholder: '', type: 'date' },
                { field: 'importo_base', label: 'Importo base asta (€)', placeholder: '0', type: 'number' },
                { field: 'oneri_sicurezza', label: 'Oneri sicurezza (€)', placeholder: '0', type: 'number' },
                { field: 'ribasso_offerto', label: 'Ribasso offerto (%)', placeholder: '0.000', type: 'number' },
                { field: 'costo_interno_stimato', label: 'Costo interno stimato (€)', placeholder: '0', type: 'number' },
              ].map(f => (
                <div key={f.field} style={{ gridColumn: f.full ? 'span 2' : undefined }}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.placeholder}
                    value={(form as Record<string, unknown>)[f.field] as string || ''}
                    onChange={e => setF(f.field, f.type === 'number' ? +e.target.value : e.target.value)}
                    style={inputStyle} />
                </div>
              ))}

              <div>
                <label style={labelStyle}>Tipo aggiudicazione</label>
                <select value={form.tipo_aggiudicazione} onChange={e => setF('tipo_aggiudicazione', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {(Object.entries(TIPO_AGG) as [TipoAggiudicazione, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Provincia</label>
                <select value={form.provincia} onChange={e => setF('provincia', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {PROVINCE.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Categoria opera</label>
                <select value={form.categoria_opera} onChange={e => setF('categoria_opera', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {CATEGORIE_OPERA.map(c => <option key={c.v} value={c.v}>{c.v} — {c.l}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Stato</label>
                <select value={form.stato} onChange={e => setF('stato', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  {(Object.entries(STATO_META) as [StatoGara, { label: string; color: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Note</label>
                <textarea value={form.note} onChange={e => setF('note', e.target.value)} placeholder="Note interne..."
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
              </div>
            </div>

            {/* Preview calcoli */}
            {form.importo_base > 0 && (
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>Preview calcoli</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Soggetto ribasso</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>€ {fmt(form.importo_soggetto_ribasso)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Importo offerto</div><div style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>€ {fmt(form.importo_offerto)}</div></div>
                  {form.costo_interno_stimato > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>Margine stimato</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: form.importo_offerto - form.costo_interno_stimato >= 0 ? '#10b981' : '#ef4444' }}>
                        € {fmt(form.importo_offerto - form.costo_interno_stimato)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salvaGara} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Crea gara</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
