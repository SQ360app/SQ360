'use client'

import { useState } from 'react'
import { Plus, Search, X, CheckCircle, AlertCircle, Clock, Send, Upload, FileText, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'

// ─── Tipi ─────────────────────────────────────────────────────────────────────
type StatoDAM = 'BOZZA' | 'INVIATO_DL' | 'APPROVATO' | 'APPROVATO_NOTE' | 'RIFIUTATO' | 'REV_1' | 'REV_2'
type StatoCertificazione = 'presente' | 'mancante' | 'non_applicabile'

interface Certificazione {
  id: string
  categoria: 'CAM' | 'CE' | 'SIC' | 'AMB' | 'TEC'
  nome: string
  obbligatoria: boolean
  stato: StatoCertificazione
  numero: string
  scadenza: string
  file_caricato: boolean
}

interface DAM {
  id: string
  codice: string
  revisione: number
  commessa: string
  fornitore: string
  materiale: string
  descrizione: string
  quantita: number
  um: string
  data_emissione: string
  data_risposta_dl: string
  stato: StatoDAM
  dl_nome: string
  dl_email: string
  note_dl: string
  note_interne: string
  certificazioni: Certificazione[]
  prezzo_unitario_nascosto: number
}

// ─── Costanti ─────────────────────────────────────────────────────────────────
const STATO_META: Record<StatoDAM, { label: string; color: string; icon: string }> = {
  BOZZA: { label: 'Bozza', color: '#6b7280', icon: '📝' },
  INVIATO_DL: { label: 'Inviato a DL', color: '#3b82f6', icon: '📤' },
  APPROVATO: { label: 'Approvato', color: '#10b981', icon: '✅' },
  APPROVATO_NOTE: { label: 'Approvato con note', color: '#f59e0b', icon: '📋' },
  RIFIUTATO: { label: 'Rifiutato', color: '#ef4444', icon: '❌' },
  REV_1: { label: 'Revisione 1', color: '#8b5cf6', icon: '🔄' },
  REV_2: { label: 'Revisione 2', color: '#ec4899', icon: '🔄' },
}

const CERT_CATEGORIE: Record<string, string> = {
  CAM: 'Criteri Ambientali Minimi',
  CE: 'Marcatura CE',
  SIC: 'Sicurezza',
  AMB: 'Ambiente',
  TEC: 'Tecnica',
}

// ─── Checklist certificazioni standard ────────────────────────────────────────
const CHECKLIST_DEFAULT: Omit<Certificazione, 'id' | 'stato' | 'numero' | 'scadenza' | 'file_caricato'>[] = [
  { categoria: 'CAM', nome: 'Criteri Ambientali Minimi (D.M. 23/06/2022)', obbligatoria: true },
  { categoria: 'CAM', nome: 'Contenuto riciclato certificato (ISO 14021)', obbligatoria: false },
  { categoria: 'CAM', nome: 'EPD — Environmental Product Declaration (EN 15804)', obbligatoria: false },
  { categoria: 'CE', nome: 'Marcatura CE (Reg. UE 305/2011)', obbligatoria: true },
  { categoria: 'CE', nome: 'Dichiarazione di Prestazione — DoP', obbligatoria: true },
  { categoria: 'CE', nome: 'Certificato di conformità prodotto', obbligatoria: false },
  { categoria: 'SIC', nome: 'Scheda di Sicurezza SDS (Reg. CE 1907/2006)', obbligatoria: true },
  { categoria: 'TEC', nome: 'Scheda tecnica di prodotto', obbligatoria: true },
  { categoria: 'TEC', nome: 'Campione / prova di laboratorio', obbligatoria: false },
  { categoria: 'AMB', nome: 'Certificazione ISO 14001', obbligatoria: false },
]

function creaCertificazioni(): Certificazione[] {
  return CHECKLIST_DEFAULT.map(c => ({
    ...c,
    id: Math.random().toString(36).slice(2),
    stato: 'mancante' as StatoCertificazione,
    numero: '',
    scadenza: '',
    file_caricato: false,
  }))
}

// ─── Dati demo ─────────────────────────────────────────────────────────────────
const DEMO: DAM[] = [
  {
    id: 'd1', codice: 'DAM-001', revisione: 0,
    commessa: '26.PNA.RS.001', fornitore: 'Calcestruzzi Nord Spa',
    materiale: 'Calcestruzzo C28/35 XC2', descrizione: 'Calcestruzzo strutturale per solette e pilastri, classe di esposizione XC2, Dmax 20mm, S4',
    quantita: 85, um: 'mc', data_emissione: '2026-03-10', data_risposta_dl: '2026-03-15',
    stato: 'APPROVATO', dl_nome: 'Ing. Rossi', dl_email: 'rossi@comune.napoli.it',
    note_dl: '', note_interne: 'Approvato senza riserve',
    prezzo_unitario_nascosto: 165,
    certificazioni: creaCertificazioni().map((c, i) => ({ ...c, stato: i < 5 ? 'presente' : 'mancante', file_caricato: i < 5 }))
  },
  {
    id: 'd2', codice: 'DAM-002', revisione: 0,
    commessa: '26.PNA.RS.001', fornitore: 'Serramenti Napoli Srl',
    materiale: 'Serramenti alluminio taglio termico', descrizione: 'Serramenti in alluminio a taglio termico, doppio vetro basso emissivo, trasmittanza Uw≤1.4 W/m²K',
    quantita: 45, um: 'nr', data_emissione: '2026-04-20', data_risposta_dl: '',
    stato: 'INVIATO_DL', dl_nome: 'Ing. Rossi', dl_email: 'rossi@comune.napoli.it',
    note_dl: '', note_interne: 'In attesa risposta DL dal 20/04',
    prezzo_unitario_nascosto: 850,
    certificazioni: creaCertificazioni().map((c, i) => ({ ...c, stato: i < 7 ? 'presente' : 'mancante', file_caricato: i < 7 }))
  },
  {
    id: 'd3', codice: 'DAM-003', revisione: 1,
    commessa: '26.PNA.RS.001', fornitore: 'Laterizi Sud Srl',
    materiale: 'Laterizio forato 30x24x19', descrizione: 'Laterizio forato per murature interne, resistenza a compressione ≥2.0 N/mm²',
    quantita: 12000, um: 'nr', data_emissione: '2026-03-25', data_risposta_dl: '2026-04-02',
    stato: 'APPROVATO_NOTE', dl_nome: 'Ing. Rossi', dl_email: 'rossi@comune.napoli.it',
    note_dl: 'Richiedere certificato di fabbrica aggiornato. Campione OK ma documentazione incompleta.',
    note_interne: 'Rev 1 in preparazione',
    prezzo_unitario_nascosto: 0.45,
    certificazioni: creaCertificazioni().map((c, i) => ({ ...c, stato: i < 4 ? 'presente' : i < 6 ? 'mancante' : 'non_applicabile', file_caricato: i < 4 }))
  },
]

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// ─── Componente principale ─────────────────────────────────────────────────────
export default function DAMPage() {
  const [dams, setDams] = useState<DAM[]>(DEMO)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState<StatoDAM | 'TUTTI'>('TUTTI')
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<'scheda' | 'certificazioni'>('scheda')

  // Form nuovo DAM
  const [form, setForm] = useState({
    commessa: '26.PNA.RS.001',
    fornitore: '',
    materiale: '',
    descrizione: '',
    quantita: 0,
    um: 'nr',
    dl_nome: '',
    dl_email: '',
    note_interne: '',
  })

  const filtered = dams.filter(d => {
    const matchSearch = !search ||
      d.materiale.toLowerCase().includes(search.toLowerCase()) ||
      d.codice.toLowerCase().includes(search.toLowerCase()) ||
      d.fornitore.toLowerCase().includes(search.toLowerCase())
    const matchStato = filtroStato === 'TUTTI' || d.stato === filtroStato
    return matchSearch && matchStato
  })

  const damSelezionato = dams.find(d => d.id === selected) ?? null

  // Alert: DAM in attesa da più di 5 giorni
  const inAttesa = dams.filter(d => {
    if (d.stato !== 'INVIATO_DL') return false
    const giorni = (Date.now() - new Date(d.data_emissione).getTime()) / 86400000
    return giorni > 5
  })

  function inviaDL(id: string) {
    setDams(prev => prev.map(d => d.id !== id ? d : { ...d, stato: 'INVIATO_DL', data_emissione: new Date().toISOString().slice(0, 10) }))
  }

  function creaRevisione(id: string) {
    const dam = dams.find(d => d.id === id)
    if (!dam) return
    const nuovaRev = dam.revisione + 1
    const nuovaStatoMap: Record<number, StatoDAM> = { 1: 'REV_1', 2: 'REV_2' }
    const nuovoStato = nuovaStatoMap[nuovaRev] ?? 'REV_1'
    setDams(prev => prev.map(d => d.id !== id ? d : {
      ...d, revisione: nuovaRev, stato: nuovoStato,
      data_emissione: new Date().toISOString().slice(0, 10),
      data_risposta_dl: '', note_dl: ''
    }))
  }

  function toggleCert(damId: string, certId: string) {
    setDams(prev => prev.map(d => d.id !== damId ? d : {
      ...d,
      certificazioni: d.certificazioni.map(c => c.id !== certId ? c : {
        ...c,
        stato: c.stato === 'presente' ? 'mancante' : 'presente',
        file_caricato: c.stato !== 'presente'
      })
    }))
  }

  function salvaNuovo() {
    const codice = `DAM-${String(dams.length + 1).padStart(3, '0')}`
    const nuovoDAM: DAM = {
      id: Date.now().toString(),
      codice,
      revisione: 0,
      commessa: form.commessa,
      fornitore: form.fornitore,
      materiale: form.materiale,
      descrizione: form.descrizione,
      quantita: form.quantita,
      um: form.um,
      data_emissione: new Date().toISOString().slice(0, 10),
      data_risposta_dl: '',
      stato: 'BOZZA',
      dl_nome: form.dl_nome,
      dl_email: form.dl_email,
      note_dl: '',
      note_interne: form.note_interne,
      prezzo_unitario_nascosto: 0,
      certificazioni: creaCertificazioni(),
    }
    setDams(prev => [nuovoDAM, ...prev])
    setShowForm(false)
    setSelected(nuovoDAM.id)
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }
  const labelStyle = { fontSize: 10, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  const STATO_CERT_META: Record<StatoCertificazione, { color: string; label: string }> = {
    presente: { color: '#10b981', label: 'Presente' },
    mancante: { color: '#ef4444', label: 'Mancante' },
    non_applicabile: { color: '#6b7280', label: 'N/A' },
  }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>DAM — Dossier Accettazione Materiali</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>Workflow completo con Direzione Lavori · Senza prezzi verso DL</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> Nuovo DAM
        </button>
      </div>

      {/* Alert DL */}
      {inAttesa.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={15} color="#f59e0b" />
          <span style={{ fontSize: 13, color: '#f59e0b' }}>
            <strong>{inAttesa.length} DAM</strong> in attesa di risposta DL da più di 5 giorni: {inAttesa.map(d => d.codice).join(', ')}
          </span>
        </div>
      )}

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca materiale, fornitore, codice..."
            style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['TUTTI', ...Object.keys(STATO_META)] as (StatoDAM | 'TUTTI')[]).map(s => {
            const meta = s !== 'TUTTI' ? STATO_META[s] : null
            return (
              <button key={s} onClick={() => setFiltroStato(s)} style={{
                padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: filtroStato === s ? 'var(--accent)' : 'var(--panel)',
                color: filtroStato === s ? 'white' : 'var(--t2)'
              }}>
                {s === 'TUTTI' ? 'Tutti' : `${meta?.icon} ${meta?.label}`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: damSelezionato ? '380px 1fr' : '1fr', gap: 16 }}>

        {/* Lista DAM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(dam => {
            const sm = STATO_META[dam.stato]
            const certPresenti = dam.certificazioni.filter(c => c.stato === 'presente').length
            const certTotali = dam.certificazioni.filter(c => c.stato !== 'non_applicabile').length
            const certPct = certTotali > 0 ? Math.round((certPresenti / certTotali) * 100) : 0
            const isSelected = selected === dam.id
            const giorniAttesa = dam.stato === 'INVIATO_DL'
              ? Math.floor((Date.now() - new Date(dam.data_emissione).getTime()) / 86400000)
              : null

            return (
              <div key={dam.id}
                onClick={() => { setSelected(dam.id === selected ? null : dam.id); setTab('scheda') }}
                style={{
                  background: 'var(--panel)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : 'none', transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>
                        {dam.codice}{dam.revisione > 0 ? ` Rev.${dam.revisione}` : ''}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: sm.color, background: `${sm.color}15`, border: `1px solid ${sm.color}30`, borderRadius: 5, padding: '2px 7px' }}>
                        {sm.icon} {sm.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{dam.materiale}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{dam.fornitore} · {dam.quantita} {dam.um}</div>
                  </div>
                </div>

                {/* Barra certificazioni */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>Certificazioni</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: certPct === 100 ? '#10b981' : certPct >= 60 ? '#f59e0b' : '#ef4444' }}>{certPresenti}/{certTotali}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${certPct}%`, height: '100%', background: certPct === 100 ? '#10b981' : certPct >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)' }}>
                  <span>Emesso: {dam.data_emissione}</span>
                  {giorniAttesa !== null && (
                    <span style={{ color: giorniAttesa > 5 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                      ⏱ {giorniAttesa}gg senza risposta
                    </span>
                  )}
                  {dam.data_risposta_dl && <span>Risposta DL: {dam.data_risposta_dl}</span>}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12 }}>
              Nessun DAM trovato. Clicca &quot;Nuovo DAM&quot; per crearne uno.
            </div>
          )}
        </div>

        {/* Dettaglio DAM */}
        {damSelezionato && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>
                    {damSelezionato.codice}{damSelezionato.revisione > 0 ? ` — Revisione ${damSelezionato.revisione}` : ''}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: STATO_META[damSelezionato.stato].color }}>
                    {STATO_META[damSelezionato.stato].icon} {STATO_META[damSelezionato.stato].label}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{damSelezionato.materiale}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{damSelezionato.fornitore} · Commessa {damSelezionato.commessa}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Azioni */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {damSelezionato.stato === 'BOZZA' && (
                <button onClick={() => inviaDL(damSelezionato.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Send size={13} /> Invia a DL
                </button>
              )}
              {(damSelezionato.stato === 'APPROVATO_NOTE' || damSelezionato.stato === 'RIFIUTATO') && (
                <button onClick={() => creaRevisione(damSelezionato.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#8b5cf6', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  🔄 Crea Revisione {damSelezionato.revisione + 1}
                </button>
              )}
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>
                <FileText size={13} /> Genera PDF per DL
              </button>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {[
                { key: 'scheda', label: '📋 Scheda materiale' },
                { key: 'certificazioni', label: `📁 Certificazioni (${damSelezionato.certificazioni.filter(c => c.stato === 'presente').length}/${damSelezionato.certificazioni.filter(c => c.stato !== 'non_applicabile').length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key as 'scheda' | 'certificazioni')} style={{
                  flex: 1, padding: '10px', border: 'none', borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* TAB SCHEDA */}
              {tab === 'scheda' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Dati materiale */}
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Dati materiale</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Materiale', val: damSelezionato.materiale },
                        { label: 'Fornitore', val: damSelezionato.fornitore },
                        { label: 'Quantità', val: `${damSelezionato.quantita} ${damSelezionato.um}` },
                        { label: 'Commessa', val: damSelezionato.commessa },
                      ].map(r => (
                        <div key={r.label}>
                          <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{r.label}</div>
                          <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500 }}>{r.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Descrizione tecnica</div>
                      <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{damSelezionato.descrizione}</div>
                    </div>
                  </div>

                  {/* DL */}
                  <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Direzione Lavori</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Nome DL</div><div style={{ fontSize: 12, color: 'var(--t1)' }}>{damSelezionato.dl_nome || '—'}</div></div>
                      <div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Email DL</div><div style={{ fontSize: 12, color: 'var(--t1)' }}>{damSelezionato.dl_email || '—'}</div></div>
                      <div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Data invio</div><div style={{ fontSize: 12, color: 'var(--t1)' }}>{damSelezionato.data_emissione}</div></div>
                      <div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Data risposta</div><div style={{ fontSize: 12, color: 'var(--t1)' }}>{damSelezionato.data_risposta_dl || '—'}</div></div>
                    </div>
                  </div>

                  {/* Note DL */}
                  {damSelezionato.note_dl && (
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>📝 Note Direzione Lavori</div>
                      <div style={{ fontSize: 12, color: 'var(--t2)' }}>{damSelezionato.note_dl}</div>
                    </div>
                  )}

                  {damSelezionato.stato === 'APPROVATO' && (
                    <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle size={18} color="#10b981" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>Materiale approvato dalla DL</div>
                        <div style={{ fontSize: 11, color: 'var(--t3)' }}>È possibile procedere con gli acquisti e i contratti</div>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: 'rgba(107,114,128,0.7)', fontStyle: 'italic', padding: '8px', background: 'rgba(107,114,128,0.05)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={12} color="#6b7280" />
                    Il documento inviato alla DL non contiene prezzi unitari (policy DAM)
                  </div>
                </div>
              )}

              {/* TAB CERTIFICAZIONI */}
              {tab === 'certificazioni' && (
                <div>
                  {(['CAM', 'CE', 'SIC', 'TEC', 'AMB'] as const).map(cat => {
                    const certs = damSelezionato.certificazioni.filter(c => c.categoria === cat)
                    if (certs.length === 0) return null
                    return (
                      <div key={cat} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                          {CERT_CATEGORIE[cat]}
                        </div>
                        <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                          {certs.map((cert, i) => {
                            const meta = STATO_CERT_META[cert.stato]
                            return (
                              <div key={cert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < certs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <input type="checkbox" checked={cert.stato === 'presente'} onChange={() => toggleCert(damSelezionato.id, cert.id)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, color: cert.stato === 'presente' ? 'var(--t1)' : 'var(--t3)', fontWeight: cert.obbligatoria ? 600 : 400 }}>
                                    {cert.nome}
                                    {cert.obbligatoria && <span style={{ fontSize: 9, color: '#ef4444', marginLeft: 4 }}>*obbligatoria</span>}
                                  </div>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: `${meta.color}15`, border: `1px solid ${meta.color}30`, borderRadius: 5, padding: '2px 8px', flexShrink: 0 }}>
                                  {meta.label}
                                </span>
                                <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--t2)', flexShrink: 0 }}>
                                  <Upload size={11} /> Carica
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {/* Riepilogo */}
                  <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>Completamento dossier certificazioni</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>
                        {damSelezionato.certificazioni.filter(c => c.stato === 'presente').length}/
                        {damSelezionato.certificazioni.filter(c => c.stato !== 'non_applicabile').length}
                      </span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(damSelezionato.certificazioni.filter(c => c.stato === 'presente').length / Math.max(1, damSelezionato.certificazioni.filter(c => c.stato !== 'non_applicabile').length)) * 100}%`,
                        height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s'
                      }} />
                    </div>
                    {damSelezionato.certificazioni.filter(c => c.stato === 'mancante' && c.obbligatoria).length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 11, color: '#ef4444' }}>
                        ⚠️ {damSelezionato.certificazioni.filter(c => c.stato === 'mancante' && c.obbligatoria).length} certificazioni obbligatorie mancanti
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL NUOVO DAM */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, width: '100%', maxWidth: 600, padding: '28px 32px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Nuovo DAM</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { field: 'commessa', label: 'Commessa *', placeholder: '26.PNA.RS.001' },
                { field: 'fornitore', label: 'Fornitore *', placeholder: 'es. Calcestruzzi Nord Spa' },
                { field: 'materiale', label: 'Materiale *', placeholder: 'es. Calcestruzzo C28/35 XC2' },
                { field: 'dl_nome', label: 'Nome Direttore Lavori', placeholder: 'Ing. Mario Rossi' },
                { field: 'dl_email', label: 'Email DL', placeholder: 'dl@comune.it' },
              ].map(f => (
                <div key={f.field}>
                  <label style={labelStyle}>{f.label}</label>
                  <input value={(form as Record<string, unknown>)[f.field] as string || ''} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))} placeholder={f.placeholder} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Descrizione tecnica *</label>
                <textarea value={form.descrizione} onChange={e => setForm(p => ({ ...p, descrizione: e.target.value }))} placeholder="Descrizione tecnica completa del materiale (specifiche, classi, performance attese)..."
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Quantità</label>
                  <input type="number" value={form.quantita} onChange={e => setForm(p => ({ ...p, quantita: +e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Unità di misura</label>
                  <select value={form.um} onChange={e => setForm(p => ({ ...p, um: e.target.value }))} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13, width: '100%' }}>
                    {['mc', 'mq', 'ml', 'kg', 't', 'nr', 'corpo', 'lt', 'h'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Note interne</label>
                <input value={form.note_interne} onChange={e => setForm(p => ({ ...p, note_interne: e.target.value }))} placeholder="Note interne (non visibili alla DL)" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salvaNuovo} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Crea DAM</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
