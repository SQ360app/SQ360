'use client'

import { useState } from 'react'
import { Plus, Search, X, CheckCircle, AlertCircle, Building2, Calendar, Euro, FileText, ChevronDown, ChevronRight } from 'lucide-react'

// ─── Tipi ─────────────────────────────────────────────────────────────────────
type StatoCommessa = 'ACQUISITA' | 'IN_GARA' | 'AGGIUDICATA' | 'IN_ESECUZIONE' | 'SOSPESA' | 'COLLAUDO' | 'CHIUSA'

interface Commessa {
  id: string
  codice: string
  anno: number
  tipo_committente: string
  provincia: string
  categoria: string
  progressivo: number
  nome: string
  committente: string
  piva_committente: string
  cig: string
  cup: string
  importo_base: number
  ribasso_pct: number
  importo_aggiudicato: number
  oneri_sicurezza: number
  data_aggiudicazione: string
  data_inizio: string
  data_fine: string
  durata_gg: number
  dl_nome: string
  dl_email: string
  rup_nome: string
  rup_email: string
  stato: StatoCommessa
  note: string
  sal_emessi: number
  avanzamento_pct: number
}

// ─── Costanti ─────────────────────────────────────────────────────────────────
const PROVINCE = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']

const TIPI_COMMITTENTE = [
  { v: 'P', l: 'Pubblico' }, { v: 'V', l: 'Privato' },
  { v: 'M', l: 'Misto PPP' }, { v: 'A', l: 'Accordo Quadro' },
  { v: 'S', l: 'Subappalto ricevuto' }, { v: 'C', l: 'Concessione' },
]

const CATEGORIE_OPERA = [
  { v: 'RS', l: 'Ristrutturazione' }, { v: 'NC', l: 'Nuova Costruzione' },
  { v: 'DR', l: 'Demo + Ricostruzione' }, { v: 'MS', l: 'Manutenzione Straordinaria' },
  { v: 'MO', l: 'Manutenzione Ordinaria' }, { v: 'IF', l: 'Infrastrutture' },
  { v: 'RE', l: 'Restauro / Conservazione' }, { v: 'IP', l: 'Impianti' },
  { v: 'UR', l: 'Urbanizzazione' }, { v: 'BO', l: 'Bonifica' },
]

const STATI: Record<StatoCommessa, { label: string; color: string }> = {
  ACQUISITA: { label: 'Acquisita', color: '#6b7280' },
  IN_GARA: { label: 'In gara', color: '#f59e0b' },
  AGGIUDICATA: { label: 'Aggiudicata', color: '#3b82f6' },
  IN_ESECUZIONE: { label: 'In esecuzione', color: '#10b981' },
  SOSPESA: { label: 'Sospesa', color: '#ef4444' },
  COLLAUDO: { label: 'Collaudo', color: '#8b5cf6' },
  CHIUSA: { label: 'Chiusa', color: '#374151' },
}

// ─── Dati demo ─────────────────────────────────────────────────────────────────
const DEMO: Commessa[] = [
  {
    id: 'c1', codice: '26.PNA.RS.001', anno: 2026, tipo_committente: 'P', provincia: 'NA',
    categoria: 'RS', progressivo: 1, nome: 'Scuola Media Viale Mazzini',
    committente: 'Comune di Napoli', piva_committente: '80014890633',
    cig: 'A12345678B', cup: 'J51H22000010007',
    importo_base: 3200000, ribasso_pct: 8.5, importo_aggiudicato: 2928000, oneri_sicurezza: 48000,
    data_aggiudicazione: '2026-01-15', data_inizio: '2026-03-01', data_fine: '2026-09-30', durata_gg: 213,
    dl_nome: 'Ing. Mario Rossi', dl_email: 'm.rossi@comune.napoli.it',
    rup_nome: 'Arch. Laura Bianchi', rup_email: 'l.bianchi@comune.napoli.it',
    stato: 'IN_ESECUZIONE', note: '', sal_emessi: 2, avanzamento_pct: 56
  },
  {
    id: 'c2', codice: '26.PRM.NC.002', anno: 2026, tipo_committente: 'V', provincia: 'RM',
    categoria: 'NC', progressivo: 2, nome: 'Residenziale Via Caracciolo',
    committente: 'Immobiliare Centrale Srl', piva_committente: '12345678901',
    cig: '', cup: '',
    importo_base: 1850000, ribasso_pct: 0, importo_aggiudicato: 1850000, oneri_sicurezza: 22000,
    data_aggiudicazione: '2026-02-10', data_inizio: '2026-04-01', data_fine: '2027-03-15', durata_gg: 348,
    dl_nome: 'Arch. Verdi', dl_email: 'verdi@studio.it',
    rup_nome: '', rup_email: '',
    stato: 'AGGIUDICATA', note: '', sal_emessi: 0, avanzamento_pct: 0
  },
  {
    id: 'c3', codice: '26.PCE.IF.003', anno: 2026, tipo_committente: 'P', provincia: 'CE',
    categoria: 'IF', progressivo: 3, nome: 'Asse Viario Provinciale L2',
    committente: 'Provincia di Caserta', piva_committente: '80009930610',
    cig: 'B98765432C', cup: 'H51J22000050007',
    importo_base: 8900000, ribasso_pct: 12.3, importo_aggiudicato: 7803300, oneri_sicurezza: 185000,
    data_aggiudicazione: '2025-11-20', data_inizio: '2026-01-10', data_fine: '2026-12-31', durata_gg: 355,
    dl_nome: 'Ing. Ferrari', dl_email: 'ferrari@provincia.ce.it',
    rup_nome: 'Geom. Esposito', rup_email: 'esposito@provincia.ce.it',
    stato: 'IN_ESECUZIONE', note: '', sal_emessi: 3, avanzamento_pct: 34
  },
  {
    id: 'c4', codice: '26.PVN.DR.004', anno: 2026, tipo_committente: 'V', provincia: 'VN',
    categoria: 'DR', progressivo: 4, nome: 'Demo+Ricostruzione Via Toledo 44',
    committente: 'Privato Gianluca Russo', piva_committente: '',
    cig: '', cup: '',
    importo_base: 650000, ribasso_pct: 0, importo_aggiudicato: 650000, oneri_sicurezza: 9500,
    data_aggiudicazione: '2026-03-01', data_inizio: '2026-04-15', data_fine: '2026-10-30', durata_gg: 198,
    dl_nome: 'Arch. Martino', dl_email: 'martino@architetti.it',
    rup_nome: '', rup_email: '',
    stato: 'COLLAUDO', note: 'Lavori conclusi, in attesa collaudo', sal_emessi: 4, avanzamento_pct: 98
  },
]

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

const FORM_VUOTO = {
  anno: new Date().getFullYear(),
  tipo_committente: 'P',
  provincia: 'NA',
  categoria: 'NC',
  nome: '',
  committente: '',
  piva_committente: '',
  cig: '',
  cup: '',
  importo_base: 0,
  ribasso_pct: 0,
  oneri_sicurezza: 0,
  data_aggiudicazione: '',
  data_inizio: '',
  data_fine: '',
  durata_gg: 0,
  dl_nome: '',
  dl_email: '',
  rup_nome: '',
  rup_email: '',
  stato: 'AGGIUDICATA' as StatoCommessa,
  note: '',
}

// ─── Componente principale ─────────────────────────────────────────────────────
export default function CommessePage() {
  const [commesse, setCommesse] = useState<Commessa[]>(DEMO)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState<StatoCommessa | 'TUTTE'>('TUTTE')
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errore, setErrore] = useState('')

  function setF(field: string, val: unknown) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  const anno2 = String(form.anno).slice(2)
  const codicePreview = `${anno2}.${form.tipo_committente}${form.provincia}.${form.categoria}.XXX`
  const importoAggiudicato = form.importo_base * (1 - form.ribasso_pct / 100)

  const filtered = commesse.filter(c => {
    const matchSearch = !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.codice.toLowerCase().includes(search.toLowerCase()) ||
      c.committente.toLowerCase().includes(search.toLowerCase()) ||
      c.cig.includes(search)
    const matchStato = filtroStato === 'TUTTE' || c.stato === filtroStato
    return matchSearch && matchStato
  })

  const commessaSelezionata = commesse.find(c => c.id === selected) ?? null

  const totPortafoglio = commesse.filter(c => c.stato !== 'CHIUSA').reduce((s, c) => s + c.importo_aggiudicato, 0)
  const inEsecuzione = commesse.filter(c => c.stato === 'IN_ESECUZIONE').length

  function salva() {
    if (!form.nome.trim()) { setErrore('Nome commessa obbligatorio'); return }
    if (!form.committente.trim()) { setErrore('Committente obbligatorio'); return }
    setSaving(true)
    setErrore('')
    const prog = commesse.filter(c => c.anno === form.anno).length + 1
    const a2 = String(form.anno).slice(2)
    const codice = `${a2}.${form.tipo_committente}${form.provincia}.${form.categoria}.${String(prog).padStart(3, '0')}`
    const nuova: Commessa = {
      ...form,
      id: Date.now().toString(),
      codice,
      progressivo: prog,
      importo_aggiudicato: importoAggiudicato,
      sal_emessi: 0,
      avanzamento_pct: 0,
    }
    setCommesse(prev => [nuova, ...prev])
    setSaving(false)
    setSaved(true)
    setShowForm(false)
    setForm({ ...FORM_VUOTO })
    setTimeout(() => setSaved(false), 3000)
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', color: 'var(--t1)', fontSize: 13 }
  const labelStyle = { fontSize: 10, color: 'var(--t3)', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }
  const sezStyle = { fontSize: 11, fontWeight: 700 as const, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12, marginTop: 4 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Commesse</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>
            {inEsecuzione} in esecuzione · Portafoglio attivo: € {fmt(totPortafoglio)}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Nuova Commessa
        </button>
      </div>

      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
          <CheckCircle size={15} color="#10b981" />
          <span style={{ fontSize: 13, color: '#10b981' }}>Commessa creata con successo</span>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Totale commesse', val: commesse.length, color: '#6b7280' },
          { label: 'In esecuzione', val: inEsecuzione, color: '#10b981' },
          { label: 'In collaudo', val: commesse.filter(c => c.stato === 'COLLAUDO').length, color: '#8b5cf6' },
          { label: 'Portafoglio attivo', val: `€ ${fmt(totPortafoglio)}`, color: '#3b82f6' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca nome, codice, committente, CIG..."
            style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroStato('TUTTE')} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroStato === 'TUTTE' ? 'var(--accent)' : 'var(--panel)', color: filtroStato === 'TUTTE' ? 'white' : 'var(--t2)' }}>Tutte</button>
          {(Object.keys(STATI) as StatoCommessa[]).map(s => (
            <button key={s} onClick={() => setFiltroStato(s)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroStato === s ? STATI[s].color : 'var(--panel)', color: filtroStato === s ? 'white' : 'var(--t2)' }}>
              {STATI[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: commessaSelezionata ? '1fr 400px' : '1fr', gap: 16 }}>

        {/* Tabella commesse */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['Codice', 'Commessa', 'Committente', 'Importo', 'Avanz.', 'Inizio', 'Fine', 'Stato'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const stato = STATI[c.stato]
                const isSelected = selected === c.id
                return (
                  <tr key={c.id}
                    onClick={() => setSelected(c.id === selected ? null : c.id)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent', transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(59,130,246,0.02)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>{c.codice}</span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{c.nome}</div>
                      {c.cig && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>CIG: {c.cig}</div>}
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: 12, color: 'var(--t2)' }}>{c.committente}</td>
                    <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>€ {fmt(c.importo_aggiudicato)}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${c.avanzamento_pct}%`, height: '100%', background: stato.color, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{c.avanzamento_pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{c.data_inizio || '—'}</td>
                    <td style={{ padding: '12px 12px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{c.data_fine || '—'}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, background: `${stato.color}15`, color: stato.color, border: `1px solid ${stato.color}40`, borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap' }}>{stato.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Nessuna commessa trovata. Clicca &quot;Nuova Commessa&quot; per iniziare.
            </div>
          )}
        </div>

        {/* Dettaglio commessa */}
        {commessaSelezionata && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', marginBottom: 3 }}>{commessaSelezionata.codice}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{commessaSelezionata.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{commessaSelezionata.committente}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer', color: 'var(--t2)' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Economico */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={sezStyle}>Dati economici</div>
                {[
                  { label: 'Importo base asta', val: `€ ${fmt(commessaSelezionata.importo_base)}` },
                  { label: `Ribasso (${commessaSelezionata.ribasso_pct}%)`, val: `− € ${fmt(commessaSelezionata.importo_base * commessaSelezionata.ribasso_pct / 100)}` },
                  { label: 'Oneri sicurezza', val: `€ ${fmt(commessaSelezionata.oneri_sicurezza)}` },
                  { label: 'IMPORTO AGGIUDICATO', val: `€ ${fmt(commessaSelezionata.importo_aggiudicato)}`, bold: true },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: (r as { bold?: boolean }).bold ? 700 : 400 }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: (r as { bold?: boolean }).bold ? 800 : 500, color: (r as { bold?: boolean }).bold ? 'var(--accent)' : 'var(--t1)' }}>{r.val}</span>
                  </div>
                ))}
              </div>

              {/* Identificativi */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={sezStyle}>Identificativi</div>
                {[
                  { label: 'CIG', val: commessaSelezionata.cig || '—' },
                  { label: 'CUP', val: commessaSelezionata.cup || '—' },
                  { label: 'P.IVA Committente', val: commessaSelezionata.piva_committente || '—' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, color: 'var(--t3)' }}>{r.label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>{r.val}</span>
                  </div>
                ))}
              </div>

              {/* Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Aggiudicazione', val: commessaSelezionata.data_aggiudicazione },
                  { label: 'Inizio lavori', val: commessaSelezionata.data_inizio },
                  { label: 'Fine lavori', val: commessaSelezionata.data_fine },
                  { label: 'Durata', val: commessaSelezionata.durata_gg ? `${commessaSelezionata.durata_gg} gg` : '—' },
                ].map(r => (
                  <div key={r.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t1)', fontWeight: 500 }}>{r.val || '—'}</div>
                  </div>
                ))}
              </div>

              {/* DL e RUP */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={sezStyle}>Direzione Lavori e RUP</div>
                {[
                  { label: 'DL', val: commessaSelezionata.dl_nome, sub: commessaSelezionata.dl_email },
                  { label: 'RUP', val: commessaSelezionata.rup_nome, sub: commessaSelezionata.rup_email },
                ].map(r => r.val ? (
                  <div key={r.label} style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}: </span>
                    <span style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>{r.val}</span>
                    {r.sub && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{r.sub}</div>}
                  </div>
                ) : null)}
              </div>

              {/* Avanzamento */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avanzamento lavori</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: STATI[commessaSelezionata.stato].color }}>{commessaSelezionata.avanzamento_pct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${commessaSelezionata.avanzamento_pct}%`, height: '100%', background: STATI[commessaSelezionata.stato].color, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>SAL emessi: {commessaSelezionata.sal_emessi}</div>
              </div>

              {commessaSelezionata.note && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--t2)' }}>
                  <strong>Note:</strong> {commessaSelezionata.note}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL NUOVA COMMESSA */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 820, padding: '28px 32px', marginTop: 20 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Nuova Commessa</h2>
                <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>Tutti i campi con * sono obbligatori</p>
              </div>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} /></button>
            </div>

            {errore && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <AlertCircle size={14} color="#ef4444" />
                <span style={{ fontSize: 13, color: '#fca5a5' }}>{errore}</span>
              </div>
            )}

            {/* Codifica automatica */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
              <div style={sezStyle}>📌 Codifica automatica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Anno *</label>
                  <input type="number" value={form.anno} onChange={e => setF('anno', +e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tipo committente *</label>
                  <select value={form.tipo_committente} onChange={e => setF('tipo_committente', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                    {TIPI_COMMITTENTE.map(t => <option key={t.v} value={t.v}>{t.v} — {t.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Provincia *</label>
                  <select value={form.provincia} onChange={e => setF('provincia', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                    {PROVINCE.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Categoria opera *</label>
                  <select value={form.categoria} onChange={e => setF('categoria', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                    {CATEGORIE_OPERA.map(c => <option key={c.v} value={c.v}>{c.v} — {c.l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Codice generato: </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{codicePreview}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* Nome e committente */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Nome commessa / Alias *</label>
                <input value={form.nome} onChange={e => setF('nome', e.target.value)} placeholder="es. Scuola Media Viale Mazzini" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Committente / Stazione appaltante *</label>
                <input value={form.committente} onChange={e => setF('committente', e.target.value)} placeholder="es. Comune di Napoli" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>P.IVA Committente</label>
                <input value={form.piva_committente} onChange={e => setF('piva_committente', e.target.value)} placeholder="80014890633" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>CIG</label>
                <input value={form.cig} onChange={e => setF('cig', e.target.value)} placeholder="A12345678B" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <label style={labelStyle}>CUP</label>
                <input value={form.cup} onChange={e => setF('cup', e.target.value)} placeholder="J51H22000010007" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
              </div>

              {/* Economico */}
              <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                <div style={sezStyle}>💶 Dati economici</div>
              </div>
              <div>
                <label style={labelStyle}>Importo base d&apos;asta (€)</label>
                <input type="number" value={form.importo_base} onChange={e => setF('importo_base', +e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ribasso offerto (%)</label>
                <input type="number" step="0.001" value={form.ribasso_pct} onChange={e => setF('ribasso_pct', +e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Oneri sicurezza (€)</label>
                <input type="number" value={form.oneri_sicurezza} onChange={e => setF('oneri_sicurezza', +e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', width: '100%' }}>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>IMPORTO AGGIUDICATO</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                    € {fmt(importoAggiudicato)}
                  </div>
                </div>
              </div>

              {/* Date */}
              <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                <div style={sezStyle}>📅 Date</div>
              </div>
              <div>
                <label style={labelStyle}>Data aggiudicazione</label>
                <input type="date" value={form.data_aggiudicazione} onChange={e => setF('data_aggiudicazione', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Durata lavori (gg)</label>
                <input type="number" value={form.durata_gg} onChange={e => setF('durata_gg', +e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Data inizio lavori</label>
                <input type="date" value={form.data_inizio} onChange={e => setF('data_inizio', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Data fine lavori</label>
                <input type="date" value={form.data_fine} onChange={e => setF('data_fine', e.target.value)} style={inputStyle} />
              </div>

              {/* DL e RUP */}
              <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                <div style={sezStyle}>👤 Direzione Lavori e RUP</div>
              </div>
              {[
                { field: 'dl_nome', label: 'Nome DL', placeholder: 'Ing. Mario Rossi' },
                { field: 'dl_email', label: 'Email DL', placeholder: 'dl@ente.it' },
                { field: 'rup_nome', label: 'Nome RUP', placeholder: 'Arch. Laura Bianchi' },
                { field: 'rup_email', label: 'Email RUP', placeholder: 'rup@ente.it' },
              ].map(f => (
                <div key={f.field}>
                  <label style={labelStyle}>{f.label}</label>
                  <input value={(form as Record<string, unknown>)[f.field] as string || ''} onChange={e => setF(f.field, e.target.value)} placeholder={f.placeholder} style={inputStyle} />
                </div>
              ))}

              {/* Stato e note */}
              <div>
                <label style={labelStyle}>Stato commessa</label>
                <select value={form.stato} onChange={e => setF('stato', e.target.value as StatoCommessa)} style={{ ...inputStyle, width: '100%' }}>
                  {(Object.keys(STATI) as StatoCommessa[]).map(s => <option key={s} value={s}>{STATI[s].label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Note interne</label>
                <input value={form.note} onChange={e => setF('note', e.target.value)} placeholder="Note interne..." style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? 'rgba(59,130,246,0.5)' : 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvataggio...' : '✓ Crea commessa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
