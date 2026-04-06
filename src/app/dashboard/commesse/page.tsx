'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, Search, Filter, X, ChevronDown, AlertCircle, CheckCircle, Building2, Calendar, Euro, FileText, User } from 'lucide-react'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tutte 107 province italiane ────────────────────────────────────────────
const PROVINCE = [
  'AG','AL','AN','AO','AP','AQ','AR','AT','AV',
  'BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ',
  'CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ',
  'EN','FC','FE','FG','FI','FM','FR',
  'GE','GO','GR',
  'IM','IS',
  'KR',
  'LC','LE','LI','LO','LT','LU',
  'MB','MC','ME','MI','MN','MO','MS','MT',
  'NA','NO','NU',
  'OR',
  'PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ',
  'RA','RC','RE','RG','RI','RM','RN','RO',
  'SA','SI','SO','SP','SR','SS','SU','SV',
  'TA','TE','TN','TO','TP','TR','TS','TV',
  'UD',
  'VA','VB','VC','VE','VI','VR','VT','VV'
]

const TIPI_COMMITTENTE = [
  { v: 'P', l: 'Pubblico' },
  { v: 'V', l: 'Privato' },
  { v: 'M', l: 'Misto PPP' },
  { v: 'A', l: 'Accordo Quadro' },
  { v: 'S', l: 'Subappalto ricevuto' },
  { v: 'C', l: 'Concessione' },
]

const CATEGORIE_OPERA = [
  { v: 'RS', l: 'Ristrutturazione' },
  { v: 'NC', l: 'Nuova Costruzione' },
  { v: 'DR', l: 'Demo + Ricostruzione' },
  { v: 'MS', l: 'Manutenzione Straordinaria' },
  { v: 'MO', l: 'Manutenzione Ordinaria' },
  { v: 'IF', l: 'Infrastrutture' },
  { v: 'RE', l: 'Restauro / Conservazione' },
  { v: 'IP', l: 'Impianti' },
  { v: 'UR', l: 'Urbanizzazione' },
  { v: 'BO', l: 'Bonifica' },
]

const STATI = [
  { v: 'ACQUISITA', l: 'Acquisita', color: '#6b7280' },
  { v: 'IN_GARA', l: 'In gara', color: '#f59e0b' },
  { v: 'AGGIUDICATA', l: 'Aggiudicata', color: '#3b82f6' },
  { v: 'IN_ESECUZIONE', l: 'In esecuzione', color: '#10b981' },
  { v: 'SOSPESA', l: 'Sospesa', color: '#ef4444' },
  { v: 'COLLAUDO', l: 'Collaudo', color: '#8b5cf6' },
  { v: 'CHIUSA', l: 'Chiusa', color: '#374151' },
]

interface Commessa {
  id?: string
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
  stato: string
  note: string
}

const FORM_VUOTO: Omit<Commessa, 'id' | 'codice' | 'progressivo' | 'importo_aggiudicato'> = {
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
  stato: 'AGGIUDICATA',
  note: '',
}

function fmt(n: number) {
  if (!n) return '—'
  return '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Dati demo per visualizzazione immediata
const DEMO: Commessa[] = [
  { id:'d1', codice:'26.PNA.RS.001', anno:2026, tipo_committente:'P', provincia:'NA', categoria:'RS', progressivo:1, nome:'Scuola Media Viale Mazzini', committente:'Comune di Napoli', piva_committente:'80014890633', cig:'A12345678B', cup:'J51H22000010007', importo_base:3200000, ribasso_pct:8.5, importo_aggiudicato:2928000, oneri_sicurezza:48000, data_aggiudicazione:'2026-01-15', data_inizio:'2026-03-01', data_fine:'2026-09-30', durata_gg:213, dl_nome:'Ing. Mario Rossi', dl_email:'m.rossi@comune.napoli.it', rup_nome:'Arch. Laura Bianchi', rup_email:'l.bianchi@comune.napoli.it', stato:'IN_ESECUZIONE', note:'' },
  { id:'d2', codice:'26.PRM.NC.002', anno:2026, tipo_committente:'V', provincia:'RM', categoria:'NC', progressivo:2, nome:'Residenziale Via Caracciolo', committente:'Immobiliare Centrale Srl', piva_committente:'12345678901', cig:'', cup:'', importo_base:1850000, ribasso_pct:0, importo_aggiudicato:1850000, oneri_sicurezza:22000, data_aggiudicazione:'2026-02-10', data_inizio:'2026-04-01', data_fine:'2027-03-15', durata_gg:348, dl_nome:'Arch. Verdi', dl_email:'verdi@studio.it', rup_nome:'', rup_email:'', stato:'AGGIUDICATA', note:'' },
  { id:'d3', codice:'26.PCE.IF.003', anno:2026, tipo_committente:'P', provincia:'CE', categoria:'IF', progressivo:3, nome:'Asse Viario Provinciale L2', committente:'Provincia di Caserta', piva_committente:'80009930610', cig:'B98765432C', cup:'H51J22000050007', importo_base:8900000, ribasso_pct:12.3, importo_aggiudicato:7803300, oneri_sicurezza:185000, data_aggiudicazione:'2025-11-20', data_inizio:'2026-01-10', data_fine:'2026-12-31', durata_gg:355, dl_nome:'Ing. Ferrari', dl_email:'ferrari@provincia.ce.it', rup_nome:'Geom. Esposito', rup_email:'esposito@provincia.ce.it', stato:'IN_ESECUZIONE', note:'' },
]

export default function CommessePage() {
  const [commesse, setCommesse] = useState<Commessa[]>(DEMO)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('tutti')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errore, setErrore] = useState('')

  // Carica da Supabase se disponibile
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await sb.from('commesse').select('*').order('created_at', { ascending: false })
      if (!error && data && data.length > 0) setCommesse(data)
      setLoading(false)
    }
    load()
  }, [])

  // Codifica automatica preview
  const anno2 = String(form.anno).slice(2)
  const codicePreview = `${anno2}.${form.tipo_committente}${form.provincia}.${form.categoria}.XXX`

  // Calcolo importo aggiudicato
  const importoAggiudicato = form.importo_base * (1 - form.ribasso_pct / 100)

  function set(field: string, val: unknown) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function salva() {
    if (!form.nome.trim()) { setErrore('Il nome commessa è obbligatorio'); return }
    if (!form.committente.trim()) { setErrore('Il committente è obbligatorio'); return }
    setSaving(true)
    setErrore('')

    // Calcola progressivo
    const prog = commesse.filter(c => c.anno === form.anno).length + 1
    const codice = `${anno2}.${form.tipo_committente}${form.provincia}.${form.categoria}.${String(prog).padStart(3, '0')}`

    const nuova: Commessa = {
      ...form,
      codice,
      progressivo: prog,
      importo_aggiudicato: importoAggiudicato,
    }

    // Salva su Supabase
    const { data, error } = await sb.from('commesse').insert([nuova]).select()
    if (error) {
      // Se Supabase non disponibile salva localmente
      setCommesse(prev => [{ ...nuova, id: Date.now().toString() }, ...prev])
    } else if (data) {
      setCommesse(prev => [data[0], ...prev])
    }

    setSaving(false)
    setSaved(true)
    setShowForm(false)
    setForm({ ...FORM_VUOTO })
    setTimeout(() => setSaved(false), 3000)
  }

  const filtered = commesse.filter(c => {
    const matchSearch = !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.codice.toLowerCase().includes(search.toLowerCase()) ||
      c.committente.toLowerCase().includes(search.toLowerCase())
    const matchStato = filtroStato === 'tutti' || c.stato === filtroStato
    return matchSearch && matchStato
  })

  const totPortafoglio = filtered.reduce((s, c) => s + (c.importo_aggiudicato || 0), 0)

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Commesse</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>
            {filtered.length} commesse · Portafoglio {fmt(totPortafoglio)}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--accent)', border: 'none', borderRadius: 10,
          padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}>
          <Plus size={16} /> Nuova Commessa
        </button>
      </div>

      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
          <CheckCircle size={15} color="#10b981" />
          <span style={{ fontSize: 13, color: '#10b981' }}>Commessa creata con successo</span>
        </div>
      )}

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome, codice, committente..."
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px 9px 36px', color: 'var(--t1)', fontSize: 13 }}
          />
        </div>
        <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--t2)', fontSize: 13 }}>
          <option value="tutti">Tutti gli stati</option>
          {STATI.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </div>

      {/* Tabella commesse */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {['Codice', 'Commessa', 'Committente', 'Importo', 'Inizio', 'Fine lavori', 'Stato'].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const stato = STATI.find(s => s.v === c.stato) ?? STATI[0]
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '3px 8px' }}>{c.codice}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{c.nome}</div>
                    {c.cig && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>CIG: {c.cig}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>{c.committente}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>{fmt(c.importo_aggiudicato)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{c.data_inizio || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{c.data_fine || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, background: `${stato.color}18`, color: stato.color, border: `1px solid ${stato.color}40`, borderRadius: 6, padding: '3px 10px' }}>{stato.l}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            Nessuna commessa trovata. Clicca "Nuova Commessa" per iniziare.
          </div>
        )}
      </div>

      {/* MODAL NUOVA COMMESSA */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 820, padding: '28px 32px', position: 'relative', marginTop: 20 }}>

            {/* Header modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Nuova Commessa</h2>
                <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>Compilare tutti i campi obbligatori *</p>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--t2)' }}>
                <X size={16} />
              </button>
            </div>

            {errore && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <AlertCircle size={14} color="#ef4444" />
                <span style={{ fontSize: 13, color: '#fca5a5' }}>{errore}</span>
              </div>
            )}

            {/* Sezione 1: Codifica */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📌 Codifica automatica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Anno *</label>
                  <input type="number" value={form.anno} onChange={e => set('anno', +e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--t1)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Tipo committente *</label>
                  <select value={form.tipo_committente} onChange={e => set('tipo_committente', e.target.value)}
                    style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--t1)', fontSize: 13 }}>
                    {TIPI_COMMITTENTE.map(t => <option key={t.v} value={t.v}>{t.v} — {t.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Provincia *</label>
                  <select value={form.provincia} onChange={e => set('provincia', e.target.value)}
                    style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--t1)', fontSize: 13 }}>
                    {PROVINCE.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Categoria opera *</label>
                  <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                    style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--t1)', fontSize: 13 }}>
                    {CATEGORIE_OPERA.map(c => <option key={c.v} value={c.v}>{c.v} — {c.l}</option>)}
                  </select>
                </div>
              </div>
              {/* Preview codice */}
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Codice generato: </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>{codicePreview}</span>
              </div>
            </div>

            {/* Sezione 2: Dati principali */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>🏗️ Dati commessa</div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Nome commessa / Alias *</label>
                <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="es. Scuola Media Viale Mazzini"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Committente / Stazione appaltante *</label>
                  <input value={form.committente} onChange={e => set('committente', e.target.value)} placeholder="es. Comune di Napoli"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>P.IVA Committente</label>
                  <input value={form.piva_committente} onChange={e => set('piva_committente', e.target.value)} placeholder="80014890633"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>CIG</label>
                  <input value={form.cig} onChange={e => set('cig', e.target.value)} placeholder="A12345678B"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13, fontFamily: 'var(--font-mono)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>CUP</label>
                  <input value={form.cup} onChange={e => set('cup', e.target.value)} placeholder="J51H22000010007"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13, fontFamily: 'var(--font-mono)' }} />
                </div>
              </div>
            </div>

            {/* Sezione 3: Dati economici */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>💶 Dati economici</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Importo base d'asta (€)</label>
                  <input type="number" value={form.importo_base} onChange={e => set('importo_base', +e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Ribasso offerto (%)</label>
                  <input type="number" step="0.001" value={form.ribasso_pct} onChange={e => set('ribasso_pct', +e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Oneri sicurezza (€)</label>
                  <input type="number" value={form.oneri_sicurezza} onChange={e => set('oneri_sicurezza', +e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                </div>
              </div>
              {/* Importo aggiudicato calcolato */}
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Importo aggiudicato calcolato: </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: '#10b981' }}>
                  {importoAggiudicato.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Sezione 4: Date */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📅 Date e durata</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: 12 }}>
                {[
                  { field: 'data_aggiudicazione', label: 'Data aggiudicazione' },
                  { field: 'data_inizio', label: 'Data inizio lavori' },
                  { field: 'data_fine', label: 'Data fine lavori' },
                ].map(f => (
                  <div key={f.field}>
                    <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input type="date" value={(form as Record<string, unknown>)[f.field] as string} onChange={e => set(f.field, e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Durata (gg)</label>
                  <input type="number" value={form.durata_gg} onChange={e => set('durata_gg', +e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                </div>
              </div>
            </div>

            {/* Sezione 5: DL e RUP */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>👤 Direzione Lavori e RUP</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                {[
                  { field: 'dl_nome', label: 'Nome DL', placeholder: 'Ing. Mario Rossi' },
                  { field: 'dl_email', label: 'Email DL', placeholder: 'dl@comune.it' },
                  { field: 'rup_nome', label: 'Nome RUP', placeholder: 'Arch. Laura Bianchi' },
                  { field: 'rup_email', label: 'Email RUP', placeholder: 'rup@comune.it' },
                ].map(f => (
                  <div key={f.field}>
                    <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input value={(form as Record<string, unknown>)[f.field] as string} onChange={e => set(f.field, e.target.value)} placeholder={f.placeholder}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Sezione 6: Stato e note */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Stato commessa</label>
                <select value={form.stato} onChange={e => set('stato', e.target.value)}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}>
                  {STATI.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Note</label>
                <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Note interne..."
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
              </div>
            </div>

            {/* Pulsanti */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 14, cursor: 'pointer' }}>
                Annulla
              </button>
              <button onClick={salva} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? 'rgba(59,130,246,0.5)' : 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvataggio...' : '✓ Crea commessa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
