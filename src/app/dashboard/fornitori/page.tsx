'use client'

import { useState } from 'react'
import { Plus, Search, X, CheckCircle, AlertTriangle, AlertCircle, Star, FileText, Upload, Eye, ChevronDown, ChevronRight, Building2, Phone, Mail, Globe } from 'lucide-react'

// ─── Tipi ─────────────────────────────────────────────────────────────────────
type TipoFornitore = 'SUBA' | 'FORM' | 'NOLE' | 'PROF' | 'MIXS'
type StatoDoc = 'valido' | 'in_scadenza' | 'scaduto' | 'mancante'

interface DocumentoFornitore {
  id: string
  tipo: string
  nome: string
  sezione: 'A' | 'B' | 'C' | 'D'
  obbligatorio: boolean
  scadenza: string
  caricato: boolean
  note: string
}

interface Fornitore {
  id: string
  codice: string
  tipo: TipoFornitore
  ragione_sociale: string
  partita_iva: string
  codice_fiscale: string
  sede_legale: string
  pec: string
  email: string
  telefono: string
  referente_nome: string
  referente_email: string
  referente_telefono: string
  soa_categorie: string
  soa_scadenza: string
  durc_scadenza: string
  patente_crediti_id: string
  patente_punteggio: number
  patente_scadenza: string
  rating: number
  note_interne: string
  attivo: boolean
  blacklist: boolean
  portale_attivo: boolean
  portale_email: string
  documenti: DocumentoFornitore[]
}

// ─── Costanti ─────────────────────────────────────────────────────────────────
const TIPO_LABELS: Record<TipoFornitore, string> = {
  SUBA: 'Subappaltatore',
  FORM: 'Fornitore Materiali',
  NOLE: 'Noleggiatore',
  PROF: 'Professionista',
  MIXS: 'Misto Sub+Forn',
}

const TIPO_COLORS: Record<TipoFornitore, string> = {
  SUBA: '#8b5cf6',
  FORM: '#10b981',
  NOLE: '#f59e0b',
  PROF: '#3b82f6',
  MIXS: '#ec4899',
}

// Checklist documenti per sezione
const CHECKLIST_BASE: Omit<DocumentoFornitore, 'id' | 'caricato' | 'scadenza' | 'note'>[] = [
  // Sezione A - Documenti Aziendali
  { tipo: 'visura_camerale', nome: 'Visura Camerale', sezione: 'A', obbligatorio: true },
  { tipo: 'doc_identita', nome: 'Documento Identità Legale Rappresentante', sezione: 'A', obbligatorio: true },
  { tipo: 'iso_9001', nome: 'Certificazione ISO 9001', sezione: 'A', obbligatorio: false },
  { tipo: 'bilancio', nome: 'Bilancio Ultimo Esercizio', sezione: 'A', obbligatorio: false },
  // Sezione B - Subappalto
  { tipo: 'soa', nome: 'Attestazione SOA', sezione: 'B', obbligatorio: true },
  { tipo: 'durc', nome: 'DURC (validità 120 gg)', sezione: 'B', obbligatorio: true },
  { tipo: 'patente_crediti', nome: 'Patente a Crediti (dal 01/10/2024)', sezione: 'B', obbligatorio: true },
  { tipo: 'casellario', nome: 'Certificato Casellario Giudiziale', sezione: 'B', obbligatorio: true },
  { tipo: 'dichiarazione_94', nome: 'Dichiarazione art. 94-98 D.Lgs. 36/2023', sezione: 'B', obbligatorio: true },
  { tipo: 'dvr', nome: 'DVR - Documento Valutazione Rischi', sezione: 'B', obbligatorio: true },
  { tipo: 'ccnl', nome: 'CCNL Applicato', sezione: 'B', obbligatorio: true },
  { tipo: 'polizza_rct', nome: 'Polizza RCT/RCO', sezione: 'B', obbligatorio: true },
  { tipo: 'antimafia', nome: 'Informazione Antimafia (>150.000€)', sezione: 'B', obbligatorio: false },
  // Sezione C - Fornitori Materiali
  { tipo: 'schede_tecniche', nome: 'Schede Tecniche Prodotti', sezione: 'C', obbligatorio: false },
  { tipo: 'marcatura_ce', nome: 'Marcatura CE / DoP', sezione: 'C', obbligatorio: false },
  { tipo: 'cam', nome: 'Certificazioni CAM/EPD', sezione: 'C', obbligatorio: false },
  // Sezione D - Professionisti
  { tipo: 'albo', nome: 'Iscrizione Albo Professionale', sezione: 'D', obbligatorio: false },
  { tipo: 'polizza_prof', nome: 'Polizza RC Professionale', sezione: 'D', obbligatorio: false },
  { tipo: 'curriculum', nome: 'Curriculum Vitae / Portfolio', sezione: 'D', obbligatorio: false },
]

function creaDocumenti(tipo: TipoFornitore): DocumentoFornitore[] {
  const sezioni: ('A' | 'B' | 'C' | 'D')[] = tipo === 'SUBA' || tipo === 'MIXS'
    ? ['A', 'B'] : tipo === 'FORM' ? ['A', 'C'] : tipo === 'PROF' ? ['A', 'D'] : ['A']
  return CHECKLIST_BASE
    .filter(d => sezioni.includes(d.sezione))
    .map(d => ({ ...d, id: Math.random().toString(36).slice(2), caricato: false, scadenza: '', note: '' }))
}

// ─── Dati demo ─────────────────────────────────────────────────────────────────
const DEMO: Fornitore[] = [
  {
    id: 'f1', codice: 'SUBA001', tipo: 'SUBA', ragione_sociale: 'Muratori Rossi Srl',
    partita_iva: '12345678901', codice_fiscale: '12345678901',
    sede_legale: 'Via Napoli 1, 80100 Napoli NA', pec: 'muratori.rossi@pec.it',
    email: 'info@muratorirossi.it', telefono: '+39 081 1234567',
    referente_nome: 'Mario Rossi', referente_email: 'mario@muratorirossi.it', referente_telefono: '+39 333 1234567',
    soa_categorie: 'OG1 cl.III, OG11 cl.II', soa_scadenza: '2026-06-30',
    durc_scadenza: '2026-04-22', patente_crediti_id: 'PAT-001234', patente_punteggio: 85, patente_scadenza: '2026-12-31',
    rating: 4, note_interne: 'Affidabile, puntuale nei pagamenti', attivo: true, blacklist: false,
    portale_attivo: true, portale_email: 'mario@muratorirossi.it',
    documenti: creaDocumenti('SUBA').map((d, i) => ({ ...d, caricato: i < 6 }))
  },
  {
    id: 'f2', codice: 'FORM001', tipo: 'FORM', ragione_sociale: 'Calcestruzzi Nord Spa',
    partita_iva: '98765432109', codice_fiscale: '98765432109',
    sede_legale: 'Via Milano 5, 20100 Milano MI', pec: 'calcestruzzi.nord@pec.it',
    email: 'ordini@calcestruzzinord.it', telefono: '+39 02 9876543',
    referente_nome: 'Luca Bianchi', referente_email: 'l.bianchi@calcestruzzinord.it', referente_telefono: '+39 348 9876543',
    soa_categorie: '', soa_scadenza: '',
    durc_scadenza: '2026-03-15', patente_crediti_id: '', patente_punteggio: 0, patente_scadenza: '',
    rating: 3, note_interne: '', attivo: true, blacklist: false,
    portale_attivo: false, portale_email: '',
    documenti: creaDocumenti('FORM').map((d, i) => ({ ...d, caricato: i < 2 }))
  },
  {
    id: 'f3', codice: 'SUBA002', tipo: 'SUBA', ragione_sociale: 'Elettrica Sud Srl',
    partita_iva: '11223344556', codice_fiscale: '11223344556',
    sede_legale: 'Via Roma 22, 84100 Salerno SA', pec: 'elettrica.sud@pec.it',
    email: 'info@elettricasud.it', telefono: '+39 089 1122334',
    referente_nome: 'Anna Verde', referente_email: 'a.verde@elettricasud.it', referente_telefono: '+39 329 1122334',
    soa_categorie: 'OG10 cl.II, OS30 cl.I', soa_scadenza: '2025-12-31',
    durc_scadenza: '2026-05-10', patente_crediti_id: 'PAT-005678', patente_punteggio: 70, patente_scadenza: '2026-08-31',
    rating: 5, note_interne: 'Eccellente qualità lavori impianti', attivo: true, blacklist: false,
    portale_attivo: true, portale_email: 'a.verde@elettricasud.it',
    documenti: creaDocumenti('SUBA').map((d, i) => ({ ...d, caricato: i < 9 }))
  },
]

// ─── Utils ─────────────────────────────────────────────────────────────────────
function statoScadenza(data: string): StatoDoc {
  if (!data) return 'mancante'
  const ms = new Date(data).getTime() - Date.now()
  const giorni = ms / 86400000
  if (giorni < 0) return 'scaduto'
  if (giorni < 30) return 'in_scadenza'
  return 'valido'
}

const STATO_META: Record<StatoDoc, { label: string; color: string; bg: string }> = {
  valido: { label: 'Valido', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  in_scadenza: { label: 'In scadenza', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  scaduto: { label: 'Scaduto', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  mancante: { label: 'Mancante', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

function Badge({ stato }: { stato: StatoDoc }) {
  const m = STATO_META[stato]
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: m.color, background: m.bg, border: `1px solid ${m.color}40`, borderRadius: 6, padding: '2px 8px' }}>
      {m.label}
    </span>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={11} fill={i <= n ? '#f59e0b' : 'transparent'} color={i <= n ? '#f59e0b' : '#d1d5db'} />
      ))}
    </div>
  )
}

const FORM_VUOTO: Omit<Fornitore, 'id' | 'codice' | 'documenti'> = {
  tipo: 'SUBA', ragione_sociale: '', partita_iva: '', codice_fiscale: '',
  sede_legale: '', pec: '', email: '', telefono: '',
  referente_nome: '', referente_email: '', referente_telefono: '',
  soa_categorie: '', soa_scadenza: '', durc_scadenza: '',
  patente_crediti_id: '', patente_punteggio: 0, patente_scadenza: '',
  rating: 3, note_interne: '', attivo: true, blacklist: false,
  portale_attivo: false, portale_email: '',
}

// ─── Componente principale ─────────────────────────────────────────────────────
export default function FornitoriPage() {
  const [fornitori, setFornitori] = useState<Fornitore[]>(DEMO)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoFornitore | 'TUTTI'>('TUTTI')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [tabDettaglio, setTabDettaglio] = useState<'anagrafica' | 'documenti' | 'portale'>('anagrafica')
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [saving, setSaving] = useState(false)

  function setF(field: string, val: unknown) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  const filtered = fornitori.filter(f => {
    const matchSearch = !search ||
      f.ragione_sociale.toLowerCase().includes(search.toLowerCase()) ||
      f.codice.toLowerCase().includes(search.toLowerCase()) ||
      f.partita_iva.includes(search)
    const matchTipo = filtroTipo === 'TUTTI' || f.tipo === filtroTipo
    return matchSearch && matchTipo && !f.blacklist
  })

  const fornitoreSelezionato = fornitori.find(f => f.id === selected) ?? null

  const alertCount = fornitori.filter(f => {
    const durc = statoScadenza(f.durc_scadenza)
    const soa = statoScadenza(f.soa_scadenza)
    return durc === 'scaduto' || durc === 'in_scadenza' || soa === 'scaduto'
  }).length

  async function salva() {
    setSaving(true)
    const prog = fornitori.filter(f => f.tipo === form.tipo).length + 1
    const codice = `${form.tipo}${String(prog).padStart(3, '0')}`
    const nuovo: Fornitore = {
      ...form,
      id: Date.now().toString(),
      codice,
      documenti: creaDocumenti(form.tipo),
    }
    setFornitori(prev => [nuovo, ...prev])
    setSaving(false)
    setShowForm(false)
    setForm({ ...FORM_VUOTO })
  }

  function toggleDocumento(fid: string, did: string) {
    setFornitori(prev => prev.map(f => f.id !== fid ? f : {
      ...f,
      documenti: f.documenti.map(d => d.id !== did ? d : { ...d, caricato: !d.caricato })
    }))
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', color: 'var(--t1)', fontSize: 13 }
  const labelStyle = { fontSize: 10, color: 'var(--t3)', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Lista fornitori */}
      <div style={{ width: selected ? 380 : '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: selected ? '1px solid var(--border)' : 'none', transition: 'width 0.2s', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Fornitori</h1>
            <p style={{ fontSize: 11, color: 'var(--t3)', margin: '2px 0 0' }}>{filtered.length} fornitori</p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Nuovo
          </button>
        </div>

        {/* Alert */}
        {alertCount > 0 && (
          <div style={{ margin: '12px 16px 0', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={13} color="#f59e0b" />
            <span style={{ fontSize: 12, color: '#f59e0b' }}><strong>{alertCount}</strong> fornitori con DURC/SOA in scadenza</span>
          </div>
        )}

        {/* Filtri */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ragione sociale, P.IVA..."
              style={{ ...inputStyle, paddingLeft: 30 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['TUTTI', 'SUBA', 'FORM', 'NOLE', 'PROF', 'MIXS'] as const).map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)} style={{
                padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)',
                background: filtroTipo === t ? 'var(--accent)' : 'var(--panel)',
                color: filtroTipo === t ? 'white' : 'var(--t3)', fontSize: 11, fontWeight: 600, cursor: 'pointer'
              }}>{t === 'TUTTI' ? 'Tutti' : TIPO_LABELS[t]}</button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(f => {
            const durc = statoScadenza(f.durc_scadenza)
            const soa = statoScadenza(f.soa_scadenza)
            const docsCaricati = f.documenti.filter(d => d.caricato).length
            const docsTotali = f.documenti.length
            const isSelected = selected === f.id
            return (
              <div key={f.id} onClick={() => { setSelected(f.id); setTabDettaglio('anagrafica') }}
                style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent', borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{f.ragione_sociale}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', background: `${TIPO_COLORS[f.tipo]}15`, color: TIPO_COLORS[f.tipo], border: `1px solid ${TIPO_COLORS[f.tipo]}30`, borderRadius: 4, padding: '1px 6px', marginRight: 6 }}>{f.codice}</span>
                      {TIPO_LABELS[f.tipo]}
                    </div>
                  </div>
                  <Stars n={f.rating} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {f.tipo === 'SUBA' || f.tipo === 'MIXS' ? (
                    <>
                      <Badge stato={durc} />
                      {f.soa_scadenza && <Badge stato={soa ?? 'mancante'} />}
                    </>
                  ) : null}
                  <span style={{ fontSize: 10, color: 'var(--t3)' }}>Docs: {docsCaricati}/{docsTotali}</span>
                  {f.portale_attivo && <span style={{ fontSize: 10, color: '#10b981' }}>● Portale attivo</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dettaglio fornitore */}
      {fornitoreSelezionato && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header dettaglio */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: `${TIPO_COLORS[fornitoreSelezionato.tipo]}15`, color: TIPO_COLORS[fornitoreSelezionato.tipo], border: `1px solid ${TIPO_COLORS[fornitoreSelezionato.tipo]}30`, borderRadius: 6, padding: '2px 8px' }}>{fornitoreSelezionato.codice}</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>{fornitoreSelezionato.ragione_sociale}</h2>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>P.IVA: {fornitoreSelezionato.partita_iva} · {TIPO_LABELS[fornitoreSelezionato.tipo]}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--t2)' }}>
              <X size={15} />
            </button>
          </div>

          {/* Tabs dettaglio */}
          <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {([
              { key: 'anagrafica', label: '📋 Anagrafica' },
              { key: 'documenti', label: `📁 Documenti (${fornitoreSelezionato.documenti.filter(d => d.caricato).length}/${fornitoreSelezionato.documenti.length})` },
              { key: 'portale', label: '🌐 Portale Fornitore' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTabDettaglio(t.key)} style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', border: '1px solid var(--border)', borderBottom: 'none',
                background: tabDettaglio === t.key ? 'var(--panel)' : 'transparent',
                color: tabDettaglio === t.key ? 'var(--t1)' : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>{t.label}</button>
            ))}
          </div>

          {/* Contenuto dettaglio */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

            {/* TAB ANAGRAFICA */}
            {tabDettaglio === 'anagrafica' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Contatti */}
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Contatti</div>
                  {[
                    { icon: Building2, label: 'Sede Legale', val: fornitoreSelezionato.sede_legale },
                    { icon: Mail, label: 'Email', val: fornitoreSelezionato.email },
                    { icon: Mail, label: 'PEC', val: fornitoreSelezionato.pec },
                    { icon: Phone, label: 'Telefono', val: fornitoreSelezionato.telefono },
                    { icon: Building2, label: 'Referente', val: `${fornitoreSelezionato.referente_nome} — ${fornitoreSelezionato.referente_email}` },
                  ].map((r, i) => r.val ? (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                      <r.icon size={13} color="var(--t3)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--t3)' }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--t1)' }}>{r.val}</div>
                      </div>
                    </div>
                  ) : null)}
                </div>

                {/* Compliance */}
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Compliance</div>
                  {[
                    { label: 'DURC', scadenza: fornitoreSelezionato.durc_scadenza },
                    { label: 'SOA', scadenza: fornitoreSelezionato.soa_scadenza },
                    { label: 'Patente Crediti', scadenza: fornitoreSelezionato.patente_scadenza },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{r.label}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {r.scadenza && <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{r.scadenza}</span>}
                        <Badge stato={statoScadenza(r.scadenza)} />
                      </div>
                    </div>
                  ))}
                  {fornitoreSelezionato.soa_categorie && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Categorie SOA</div>
                      <div style={{ fontSize: 12, color: 'var(--t1)' }}>{fornitoreSelezionato.soa_categorie}</div>
                    </div>
                  )}
                  {fornitoreSelezionato.patente_crediti_id && (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Patente a Crediti</div>
                      <div style={{ fontSize: 12, color: 'var(--t1)' }}>{fornitoreSelezionato.patente_crediti_id} · Punteggio: <strong>{fornitoreSelezionato.patente_punteggio}</strong></div>
                    </div>
                  )}
                </div>

                {/* Rating e note */}
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valutazione interna</div>
                    <Stars n={fornitoreSelezionato.rating} />
                  </div>
                  {fornitoreSelezionato.note_interne && (
                    <div style={{ fontSize: 12, color: 'var(--t2)', background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>{fornitoreSelezionato.note_interne}</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB DOCUMENTI */}
            {tabDettaglio === 'documenti' && (
              <div>
                {(['A', 'B', 'C', 'D'] as const).map(sez => {
                  const docs = fornitoreSelezionato.documenti.filter(d => d.sezione === sez)
                  if (docs.length === 0) return null
                  const sezioneLabel: Record<string, string> = {
                    A: 'Sezione A — Documenti Aziendali Generali',
                    B: 'Sezione B — Documenti per Subappalto (D.Lgs. 36/2023)',
                    C: 'Sezione C — Fornitori Materiali',
                    D: 'Sezione D — Professionisti',
                  }
                  return (
                    <div key={sez} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{sezioneLabel[sez]}</div>
                      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                        {docs.map((doc, i) => (
                          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < docs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <input type="checkbox" checked={doc.caricato} onChange={() => toggleDocumento(fornitoreSelezionato.id, doc.id)} style={{ cursor: 'pointer' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, color: doc.caricato ? 'var(--t1)' : 'var(--t3)', fontWeight: doc.obbligatorio ? 600 : 400 }}>
                                {doc.nome}
                                {doc.obbligatorio && <span style={{ fontSize: 9, color: '#ef4444', marginLeft: 4 }}>*</span>}
                              </div>
                              {doc.scadenza && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>Scadenza: {doc.scadenza}</div>}
                            </div>
                            {doc.caricato
                              ? <CheckCircle size={14} color="#10b981" />
                              : <AlertCircle size={14} color={doc.obbligatorio ? '#ef4444' : '#d1d5db'} />
                            }
                            <button style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Upload size={11} /> Carica
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {/* Progresso */}
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>Completamento dossier</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                      {fornitoreSelezionato.documenti.filter(d => d.caricato).length}/{fornitoreSelezionato.documenti.length}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${(fornitoreSelezionato.documenti.filter(d => d.caricato).length / fornitoreSelezionato.documenti.length) * 100}%`,
                      height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB PORTALE */}
            {tabDettaglio === 'portale' && (
              <div style={{ maxWidth: 500 }}>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Portale Fornitore</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>
                    Il fornitore accede al portale con email e password temporanea per caricare i propri documenti. Vedrà solo la propria sezione documenti.
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Email accesso portale</label>
                    <input defaultValue={fornitoreSelezionato.portale_email || fornitoreSelezionato.email} style={inputStyle} placeholder="email@fornitore.it" />
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: fornitoreSelezionato.portale_attivo ? '#ef4444' : 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {fornitoreSelezionato.portale_attivo ? '🔴 Disattiva portale' : '🟢 Attiva portale'}
                    </button>
                    <button style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>
                      📧 Invia credenziali
                    </button>
                  </div>
                  {fornitoreSelezionato.portale_attivo && (
                    <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✅ Portale attivo</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Il fornitore può accedere e caricare documenti</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL NUOVO FORNITORE */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 700, padding: '28px 32px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Nuovo Fornitore</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} /></button>
            </div>

            {/* Tipo */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tipo fornitore *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.keys(TIPO_LABELS) as TipoFornitore[]).map(t => (
                  <button key={t} onClick={() => setF('tipo', t)} style={{
                    padding: '8px 16px', borderRadius: 8, border: `2px solid ${form.tipo === t ? TIPO_COLORS[t] : 'var(--border)'}`,
                    background: form.tipo === t ? `${TIPO_COLORS[t]}15` : 'var(--bg)',
                    color: form.tipo === t ? TIPO_COLORS[t] : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>{TIPO_LABELS[t]}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { field: 'ragione_sociale', label: 'Ragione Sociale *', placeholder: 'es. Muratori Rossi Srl', full: true },
                { field: 'partita_iva', label: 'Partita IVA', placeholder: '12345678901' },
                { field: 'codice_fiscale', label: 'Codice Fiscale', placeholder: '12345678901' },
                { field: 'sede_legale', label: 'Sede Legale', placeholder: 'Via Roma 1, 80100 Napoli NA', full: true },
                { field: 'pec', label: 'PEC', placeholder: 'email@pec.it' },
                { field: 'email', label: 'Email', placeholder: 'info@azienda.it' },
                { field: 'telefono', label: 'Telefono', placeholder: '+39 081 1234567' },
                { field: 'referente_nome', label: 'Nome Referente', placeholder: 'Mario Rossi' },
                { field: 'referente_email', label: 'Email Referente', placeholder: 'mario@azienda.it' },
                { field: 'soa_categorie', label: 'Categorie SOA', placeholder: 'OG1 cl.III, OG11 cl.II' },
                { field: 'durc_scadenza', label: 'Scadenza DURC', placeholder: '', type: 'date' },
                { field: 'soa_scadenza', label: 'Scadenza SOA', placeholder: '', type: 'date' },
                { field: 'patente_crediti_id', label: 'ID Patente Crediti', placeholder: 'PAT-001234' },
                { field: 'patente_scadenza', label: 'Scadenza Patente', placeholder: '', type: 'date' },
              ].map(f => (
                <div key={f.field} style={{ gridColumn: f.full ? 'span 2' : undefined }}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={(form as Record<string, unknown>)[f.field] as string || ''}
                    onChange={e => setF(f.field, e.target.value)}
                    placeholder={f.placeholder}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Salvataggio...' : '✓ Crea fornitore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
