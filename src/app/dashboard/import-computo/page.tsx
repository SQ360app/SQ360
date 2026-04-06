'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Sparkles, Plus, Trash2 } from 'lucide-react'

type TipoImport = 'pdf' | 'word' | 'xpwe' | 'excel' | 'six'
type FaseImport = 'idle' | 'caricamento' | 'analisi_ai' | 'revisione' | 'completato'
type TipoUso = 'GARA' | 'AGGIUDICATA'

interface VoceComputo {
  id: string
  capitolo: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  categoria: string
  note: string
  selezionata: boolean
}

// Tipo semplice senza index signature conflittuali
type DatiCommessa = {
  nome: string
  committente: string
  cig: string
  cup: string
  importo_base: number
  ribasso_pct: number
  oneri_sicurezza: number
  data_aggiudicazione: string
  data_inizio: string
  data_fine: string
  durata_gg: number
  dl_nome: string
  rup_nome: string
  provincia: string
  categoria_opera: string
  tipo_committente: string
  confidenza: number
}

const COMMESSA_VUOTA: DatiCommessa = {
  nome: '', committente: '', cig: '', cup: '',
  importo_base: 0, ribasso_pct: 0, oneri_sicurezza: 0,
  data_aggiudicazione: '', data_inizio: '', data_fine: '', durata_gg: 0,
  dl_nome: '', rup_nome: '', provincia: 'NA',
  categoria_opera: 'NC', tipo_committente: 'P', confidenza: 0
}

const PROVINCE = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']
const CATEGORIE_OPERA = [
  { v: 'RS', l: 'Ristrutturazione' }, { v: 'NC', l: 'Nuova Costruzione' },
  { v: 'DR', l: 'Demo + Ricostruzione' }, { v: 'MS', l: 'Manutenzione Straordinaria' },
  { v: 'MO', l: 'Manutenzione Ordinaria' }, { v: 'IF', l: 'Infrastrutture' },
  { v: 'RE', l: 'Restauro' }, { v: 'IP', l: 'Impianti' },
  { v: 'UR', l: 'Urbanizzazione' }, { v: 'BO', l: 'Bonifica' },
]
const TIPI_COMMITTENTE = [
  { v: 'P', l: 'Pubblico' }, { v: 'V', l: 'Privato' },
  { v: 'M', l: 'Misto PPP' }, { v: 'A', l: 'Accordo Quadro' },
]

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function uid() { return Math.random().toString(36).slice(2, 8) }

function parseXPWE(xmlText: string): VoceComputo[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'text/xml')
    const voci: VoceComputo[] = []
    const elements = doc.querySelectorAll('VOCE, EP, ArticoloEP, ArticoloComputo')
    elements.forEach(el => {
      const desc = el.getAttribute('Descrizione') || el.querySelector('Descrizione')?.textContent || ''
      const codice = el.getAttribute('Codice') || el.querySelector('Codice')?.textContent || ''
      const um = el.getAttribute('Um') || el.querySelector('Um')?.textContent || 'nr'
      const qta = parseFloat((el.getAttribute('Quantita') || '0').replace(',', '.')) || 0
      const prezz = parseFloat((el.getAttribute('PrezzoUnitario') || '0').replace(',', '.')) || 0
      if (desc || codice) {
        voci.push({ id: uid(), capitolo: '01', codice, descrizione: desc, um, quantita: qta, prezzo_unitario: prezz, importo: qta * prezz, categoria: '', note: '', selezionata: true })
      }
    })
    return voci
  } catch { return [] }
}

export default function ImportComputoPage() {
  const [fase, setFase] = useState<FaseImport>('idle')
  const [tipoUso, setTipoUso] = useState<TipoUso>('GARA')
  const [file, setFile] = useState<File | null>(null)
  const [progresso, setProgresso] = useState(0)
  const [messaggioAI, setMessaggioAI] = useState('')
  const [voci, setVoci] = useState<VoceComputo[]>([])
  const [commessa, setCommessa] = useState<DatiCommessa>({ ...COMMESSA_VUOTA })
  const [capitoliEspansi, setCapitoliEspansi] = useState<Record<string, boolean>>({ '01': true })
  const [errore, setErrore] = useState('')
  const [tab, setTab] = useState<'computo' | 'commessa'>('computo')
  const inputRef = useRef<HTMLInputElement>(null)

  const rilevaType = (f: File): TipoImport => {
    const n = f.name.toLowerCase()
    if (n.endsWith('.xpwe') || n.endsWith('.pwe') || n.endsWith('.dcf')) return 'xpwe'
    if (n.endsWith('.six') || n.endsWith('.xml')) return 'six'
    if (n.endsWith('.pdf')) return 'pdf'
    if (n.endsWith('.doc') || n.endsWith('.docx')) return 'word'
    return 'excel'
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) gestisciFile(f)
  }, [])

  async function gestisciFile(f: File) {
    setFile(f)
    setErrore('')
    const tipo = rilevaType(f)
    setFase('caricamento')
    setProgresso(20)

    if (tipo === 'xpwe' || tipo === 'six') {
      setMessaggioAI('Parsing formato Primus XPWE...')
      setProgresso(50)
      const testo = await f.text()
      const vociParsate = parseXPWE(testo)
      setVoci(vociParsate)
      setProgresso(100)
      setFase('revisione')
      return
    }

    // PDF / Word / Excel — analisi AI
    setFase('analisi_ai')
    setMessaggioAI('Analisi AI in corso — estrazione voci e dati commessa...')
    setProgresso(50)

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1] || ''
        const response = await fetch('/api/ai-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, tipo_file: tipo, tipo_uso: tipoUso })
        })
        setProgresso(85)
        if (response.ok) {
          const data = await response.json()
          try {
            const parsed = JSON.parse(data.content)
            if (parsed.commessa) setCommessa({ ...COMMESSA_VUOTA, ...parsed.commessa })
            if (parsed.voci) {
              setVoci((parsed.voci as Record<string, unknown>[]).map(v => ({
                id: uid(),
                capitolo: String(v.capitolo || '01'),
                codice: String(v.codice || ''),
                descrizione: String(v.descrizione || ''),
                um: String(v.um || 'nr'),
                quantita: Number(v.quantita) || 0,
                prezzo_unitario: Number(v.prezzo_unitario) || 0,
                importo: (Number(v.quantita) || 0) * (Number(v.prezzo_unitario) || 0),
                categoria: String(v.categoria || ''),
                note: '',
                selezionata: true
              })))
            }
          } catch { /* usa form vuoto */ }
        }
      } catch { setErrore('Errore durante analisi AI.') }
      setProgresso(100)
      setFase('revisione')
    }
    reader.readAsDataURL(f)
  }

  // Aggiorna campo commessa in modo type-safe
  function setC(field: keyof DatiCommessa, val: string | number) {
    setCommessa(prev => ({ ...prev, [field]: val }))
  }

  function toggleCapitolo(cap: string) {
    setCapitoliEspansi(prev => ({ ...prev, [cap]: !prev[cap] }))
  }

  function aggiornaVoce(id: string, field: keyof VoceComputo, val: unknown) {
    setVoci(prev => prev.map(v => {
      if (v.id !== id) return v
      const aggiornata = { ...v, [field]: val }
      if (field === 'quantita' || field === 'prezzo_unitario') {
        aggiornata.importo = Number(aggiornata.quantita) * Number(aggiornata.prezzo_unitario)
      }
      return aggiornata
    }))
  }

  function aggiungiVoce() {
    setVoci(prev => [...prev, { id: uid(), capitolo: '01', codice: '', descrizione: 'Nuova voce', um: 'nr', quantita: 0, prezzo_unitario: 0, importo: 0, categoria: '', note: '', selezionata: true }])
  }

  function rimuoviVoce(id: string) { setVoci(prev => prev.filter(v => v.id !== id)) }
  function toggleVoce(id: string) { setVoci(prev => prev.map(v => v.id === id ? { ...v, selezionata: !v.selezionata } : v)) }

  const capitoli = [...new Set(voci.map(v => v.capitolo))].sort()
  const totaleComputo = voci.reduce((s, v) => s + v.importo, 0)
  const totaleSelezionato = voci.filter(v => v.selezionata).reduce((s, v) => s + v.importo, 0)

  const campiTesto: { field: keyof DatiCommessa; label: string; placeholder: string }[] = [
    { field: 'nome', label: 'Nome commessa *', placeholder: 'es. Scuola Media Viale Mazzini' },
    { field: 'committente', label: 'Committente *', placeholder: 'Comune di...' },
    { field: 'cig', label: 'CIG', placeholder: 'A12345678B' },
    { field: 'cup', label: 'CUP', placeholder: 'J51H22000010007' },
    { field: 'dl_nome', label: 'Direttore Lavori', placeholder: 'Ing. Mario Rossi' },
    { field: 'rup_nome', label: 'RUP', placeholder: 'Arch. Laura Bianchi' },
  ]

  const campiNumerici: { field: keyof DatiCommessa; label: string; type: string }[] = [
    { field: 'importo_base', label: 'Importo base (€)', type: 'number' },
    { field: 'ribasso_pct', label: 'Ribasso offerto (%)', type: 'number' },
    { field: 'oneri_sicurezza', label: 'Oneri sicurezza (€)', type: 'number' },
    { field: 'data_aggiudicazione', label: 'Data aggiudicazione', type: 'date' },
    { field: 'data_inizio', label: 'Data inizio lavori', type: 'date' },
    { field: 'data_fine', label: 'Data fine lavori', type: 'date' },
  ]

  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }
  const labelStyle = { fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Importazione Computo</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>PDF · Word · Primus XPWE · STR SIX · Excel — Generazione automatica commessa con AI</p>
      </div>

      {/* Scelta tipo uso */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['GARA', 'AGGIUDICATA'] as TipoUso[]).map(t => (
          <button key={t} onClick={() => setTipoUso(t)} style={{
            padding: '12px 24px', borderRadius: 10,
            border: tipoUso === t ? 'none' : '1px solid var(--border)',
            background: tipoUso === t ? (t === 'GARA' ? '#f59e0b' : '#10b981') : 'var(--panel)',
            color: tipoUso === t ? 'white' : 'var(--t2)', fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>
            {t === 'GARA' ? '🏆 Preparazione Gara' : '✅ Commessa Aggiudicata'}
          </button>
        ))}
      </div>

      {/* IDLE — Drop zone */}
      {fase === 'idle' && (
        <div
          onDrop={onDrop} onDragOver={e => e.preventDefault()}
          style={{ border: '2px dashed var(--border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center', cursor: 'pointer' }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.xpwe,.pwe,.dcf,.six,.xml,.xls,.xlsx,.csv" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) gestisciFile(e.target.files[0]) }} />
          <Upload size={48} color="var(--t3)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: '0 0 8px' }}>Trascina qui il file del computo</h3>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 24px' }}>oppure clicca per selezionarlo</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Primus XPWE/PWE', color: '#3b82f6', desc: 'Import diretto' },
              { label: 'STR SIX/XML', color: '#8b5cf6', desc: 'Import diretto' },
              { label: 'PDF Bando/Progetto', color: '#ef4444', desc: 'Analisi AI' },
              { label: 'Word (.doc/.docx)', color: '#2563eb', desc: 'Analisi AI' },
              { label: 'Excel/CSV', color: '#10b981', desc: 'Import tabella' },
            ].map(f => (
              <div key={f.label} style={{ background: `${f.color}12`, border: `1px solid ${f.color}30`, borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: f.color }}>{f.label}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CARICAMENTO / ANALISI AI */}
      {(fase === 'caricamento' || fase === 'analisi_ai') && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
          <Sparkles size={40} color="var(--accent)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', margin: '0 0 8px' }}>
            {fase === 'analisi_ai' ? 'AI in analisi...' : 'Caricamento...'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 24px' }}>{messaggioAI || `Elaborazione ${file?.name}...`}</p>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
            <div style={{ width: `${progresso}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>{progresso}%</p>
        </div>
      )}

      {/* REVISIONE */}
      {fase === 'revisione' && (
        <div>
          {/* Barra stato */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText size={18} color="var(--accent)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{file?.name ?? 'File caricato'}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                  {voci.length} voci · Totale: <strong style={{ color: 'var(--accent)' }}>€ {fmt(totaleComputo)}</strong>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setFase('idle'); setFile(null); setVoci([]); setCommessa({ ...COMMESSA_VUOTA }) }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={13} /> Nuovo file
              </button>
              <button onClick={aggiungiVoce}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} /> Aggiungi voce
              </button>
              <button onClick={() => setFase('completato')}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={13} /> {tipoUso === 'GARA' ? 'Usa per gara' : 'Crea commessa'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {[
              { key: 'computo', label: `📋 Computo (${voci.length} voci)` },
              { key: 'commessa', label: `🏗️ Dati Commessa${commessa.confidenza > 0 ? ` — AI ${commessa.confidenza}% sicura` : ''}` },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as 'computo' | 'commessa')} style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
                background: tab === t.key ? 'var(--accent)' : 'var(--panel)',
                color: tab === t.key ? 'white' : 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}>{t.label}</button>
            ))}
          </div>

          {/* TAB COMPUTO */}
          {tab === 'computo' && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px 70px 70px 1fr 60px 80px 80px 90px 32px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['', 'Cap.', 'Codice', 'Descrizione', 'U.M.', 'Quantità', 'P.U. (€)', 'Importo (€)', ''].map((h, i) => (
                  <div key={i} style={{ padding: '9px 8px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                ))}
              </div>
              {capitoli.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--t3)', fontSize: 13 }}>Nessuna voce importata. Aggiungile manualmente.</p>
                  <button onClick={aggiungiVoce} style={{ marginTop: 12, padding: '8px 18px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: 'white', fontSize: 13, cursor: 'pointer' }}>+ Aggiungi prima voce</button>
                </div>
              ) : (
                capitoli.map(cap => {
                  const vociCap = voci.filter(v => v.capitolo === cap)
                  const totaleCap = vociCap.reduce((s, v) => s + v.importo, 0)
                  const espanso = capitoliEspansi[cap] !== false
                  return (
                    <div key={cap}>
                      <div onClick={() => toggleCapitolo(cap)} style={{ display: 'grid', gridTemplateColumns: '32px 70px 70px 1fr 60px 80px 80px 90px 32px', background: 'rgba(59,130,246,0.06)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                        <div style={{ padding: '10px', display: 'flex', alignItems: 'center' }}>{espanso ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</div>
                        <div style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: 'var(--t1)', gridColumn: 'span 2' }}>Cap. {cap}</div>
                        <div style={{ padding: '10px', fontSize: 11, color: 'var(--t3)' }}>{vociCap.length} voci</div>
                        <div /><div /><div />
                        <div style={{ padding: '10px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(totaleCap)}</div>
                        <div />
                      </div>
                      {espanso && vociCap.map(voce => (
                        <div key={voce.id} style={{ display: 'grid', gridTemplateColumns: '32px 70px 70px 1fr 60px 80px 80px 90px 32px', borderBottom: '1px solid var(--border)', background: voce.selezionata ? 'var(--panel)' : 'rgba(0,0,0,0.02)', opacity: voce.selezionata ? 1 : 0.5 }}>
                          <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={voce.selezionata} onChange={() => toggleVoce(voce.id)} /></div>
                          <div style={{ padding: '6px 8px' }}><input value={voce.capitolo} onChange={e => aggiornaVoce(voce.id, 'capitolo', e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: 11 }} /></div>
                          <div style={{ padding: '6px 8px' }}><input value={voce.codice} onChange={e => aggiornaVoce(voce.id, 'codice', e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: 11 }} /></div>
                          <div style={{ padding: '6px 8px' }}><input value={voce.descrizione} onChange={e => aggiornaVoce(voce.id, 'descrizione', e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t1)', fontSize: 12 }} /></div>
                          <div style={{ padding: '6px 8px' }}><input value={voce.um} onChange={e => aggiornaVoce(voce.id, 'um', e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t2)', fontSize: 12, textAlign: 'center' }} /></div>
                          <div style={{ padding: '6px 8px' }}><input type="number" value={voce.quantita} onChange={e => aggiornaVoce(voce.id, 'quantita', +e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t1)', fontSize: 12, textAlign: 'right' }} /></div>
                          <div style={{ padding: '6px 8px' }}><input type="number" step="0.01" value={voce.prezzo_unitario} onChange={e => aggiornaVoce(voce.id, 'prezzo_unitario', +e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--t1)', fontSize: 12, textAlign: 'right' }} /></div>
                          <div style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, color: 'var(--t1)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{fmt(voce.importo)}</div>
                          <div style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button onClick={() => rimuoviVoce(voce.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)' }}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '32px 70px 70px 1fr 60px 80px 80px 90px 32px', background: 'rgba(59,130,246,0.08)', borderTop: '2px solid var(--border)' }}>
                <div /><div /><div />
                <div style={{ padding: '12px 8px', fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>TOTALE COMPUTO</div>
                <div /><div /><div />
                <div style={{ padding: '12px 8px', fontSize: 15, fontWeight: 800, color: 'var(--accent)', textAlign: 'right' }}>{fmt(totaleComputo)}</div>
                <div />
              </div>
            </div>
          )}

          {/* TAB COMMESSA */}
          {tab === 'commessa' && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
              {commessa.confidenza > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: commessa.confidenza >= 70 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${commessa.confidenza >= 70 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
                  <Sparkles size={14} color={commessa.confidenza >= 70 ? '#10b981' : '#f59e0b'} />
                  <span style={{ fontSize: 12, color: commessa.confidenza >= 70 ? '#10b981' : '#f59e0b' }}>
                    AI ha estratto i dati con {commessa.confidenza}% di confidenza. Verifica e correggi se necessario.
                  </span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {campiTesto.map(f => (
                    <div key={f.field}>
                      <label style={labelStyle}>{f.label}</label>
                      <input
                        value={String(commessa[f.field])}
                        onChange={e => setC(f.field, e.target.value)}
                        placeholder={f.placeholder}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Provincia</label>
                      <select value={commessa.provincia} onChange={e => setC('provincia', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                        {PROVINCE.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo committente</label>
                      <select value={commessa.tipo_committente} onChange={e => setC('tipo_committente', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                        {TIPI_COMMITTENTE.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Categoria opera</label>
                    <select value={commessa.categoria_opera} onChange={e => setC('categoria_opera', e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                      {CATEGORIE_OPERA.map(c => <option key={c.v} value={c.v}>{c.v} — {c.l}</option>)}
                    </select>
                  </div>
                  {campiNumerici.map(f => (
                    <div key={f.field}>
                      <label style={labelStyle}>{f.label}</label>
                      <input
                        type={f.type}
                        value={String(commessa[f.field])}
                        onChange={e => setC(f.field, f.type === 'number' ? +e.target.value : e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setFase('completato')} style={{ padding: '11px 28px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ {tipoUso === 'GARA' ? 'Conferma e usa per gara' : 'Crea commessa con computo'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPLETATO */}
      {fase === 'completato' && (
        <div style={{ background: 'var(--panel)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
          <CheckCircle size={48} color="#10b981" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: '0 0 8px' }}>
            {tipoUso === 'GARA' ? 'Computo caricato per la gara' : 'Commessa creata con computo'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 24px' }}>
            {voci.filter(v => v.selezionata).length} voci · Totale € {fmt(totaleSelezionato)}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => { setFase('idle'); setFile(null); setVoci([]); setCommessa({ ...COMMESSA_VUOTA }) }}
              style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>
              Nuovo import
            </button>
            <button style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Vai alla commessa →
            </button>
          </div>
        </div>
      )}

      {errore && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginTop: 16 }}>
          <AlertCircle size={15} color="#ef4444" />
          <span style={{ fontSize: 13, color: '#fca5a5' }}>{errore}</span>
        </div>
      )}
    </div>
  )
}
