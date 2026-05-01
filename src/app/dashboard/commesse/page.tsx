'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Loader2, Building2, RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react'
import { AIImportButton } from '@/components/AIImportButton'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })

const STATI_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  AGGIUDICATA:    { label: 'Aggiudicata',    color: '#d97706', bg: '#fffbeb', icon: FileText },
  IN_ESECUZIONE:  { label: 'In esecuzione',  color: '#059669', bg: '#f0fdf4', icon: CheckCircle2 },
  SOSPESA:        { label: 'Sospesa',        color: '#dc2626', bg: '#fef2f2', icon: AlertTriangle },
  ULTIMATA:       { label: 'Ultimata',       color: '#7c3aed', bg: '#f5f3ff', ichon: CheckCircle2 },
  IN_COLLAUDO:    { label: 'In collaudo',    color: '#2563eb', bg: '#eff6ff', icon: Clock },
  CHIUSA:         { label: 'Chiusa',         color: '#6b7280', bg: '#f3f4f6', icon: XCircle },
  RESCISSA:       { label: 'Rescissa',       color: '#dc2626', bg: '#fef2f2', icon: XCircle },
}

// ====================================================
// FORM CREAZIONE — wizard con 3 step
// ====================================================
const STEP_LABELS = ['Identificativi', 'Dati economici', 'Cantiere e date']

function NuovaCommessaModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    // STEP 1 — Identificativi
    codice: '26.' + new Date().getFullYear().toString().slice(-2) + '.GE.001',
    stato: 'AGGIUDICATA',
    nome: '',
    committente: '',
    committente_piva: '',
    tipo_committente: 'Pubblico',
    tipo_contratto: 'LAVORI',
    procedura_gara: 'APERTA',
    modalita_esecuzione: 'MISURA',
    cig: '',
    cup: '',
    numero_contratto: '',
    fonte_finanziamento: 'BILANCIO_COMUNALE',
    codice_finanziamento: '',
    // STEP 2 — Dati economici
    importo_base: '',
    importo_contratto: '',
    ribasso_pct: '',
    oneri_sicurezza: '',
    anticipazione_pct: '20',
    penale_giornaliera_pct: '0.1',
    penale_max_pct: '10',
    ritenuta_garanzia_pct: '5',
    termini_pagamento_giorni: '30',
    cadenza_sal: 'MENSILE',
    importo_minimo_sal: '',
    revisione_prezzi: false,
    // STEP 3 — Cantiere e date
    provincia: 'NA',
    comune_cantiere: '',
    cap_cantiere: '',
    indirizzo_cantiere: '',
    catastale_foglio: '',
    catastale_particella: '',
    titolo_edilizio: '',
    categoria: 'GE',
    data_aggiudicazione: new Date().toISOString().split('T')[0],
    data_stipula: '',
    data_consegna_cantiere: '',
    data_inizio_lavori: '',
    giorni_contrattuali: '',
    tipo_giorni: 'NATURALI',
    data_fine_contrattuale: '',
    notifica_preliminare: '',
    numero_addetti_max: '',
  })

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  // Calcolo automatico importo contratto
  const calcContratto = () => {
    const base = parseFloat(form.importo_base) || 0
    const rib = parseFloat(form.ribasso_pct) || 0
    const sic = parseFloat(form.oneri_sicurezza) || 0
    return base * (1 - rib / 100) + sic
  }

  // Calcolo data fine contrattuale
  const calcFineContrattuale = () => {
    const inizio = form.data_inizio_lavori || form.data_consegna_cantiere
    const gg = parseInt(form.giorni_contrattuali) || 0
    if (!inizio || !gg) return ''
    const d = new Date(inizio)
    if (form.tipo_giorni === 'NATURALI') {
      d.setDate(d.getDate() + gg)
    } else {
      let added = 0
      while (added < gg) {
        d.setDate(d.getDate() + 1)
        if (d.getDay() !== 0 && d.getDay() !== 6) added++
      }
    }
    return d.toISOString().split('T')[0]
  }

  const valid = step === 0
    ? form.nome.trim().length > 0 && form.committente.trim().length > 0
    : step === 1
    ? true
    : true

  async function handleCreate() {
    setSaving(true)
    setErr('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utente non autenticato')

      const { data: az } = await supabase.from('aziende').select('id').single()
      if (!az) throw new Error('Azienda non trovata')

      const fineCalc = form.data_fine_contrattuale || calcFineContrattuale()

      const { data: c, error } = await supabase.from('commesse').insert({
        azienda_id: az.id,
        codice: form.codice,
        nome: form.nome.trim(),
        committente: form.committente.trim(),
        committente_piva: form.committente_piva || null,
        tipo_committente: form.tipo_committente,
        tipo_contratto: form.tipo_contratto,
        procedura_gara: form.procedura_gara,
        modalita_esecuzione: form.modalita_esecuzione,
        stato: form.stato,
        cig: form.cig || null,
        cup: form.cup || null,
        numero_contratto: form.numero_contratto || null,
        fonte_finanziamento: form.fonte_finanziamento,
        codice_finanziamento: form.codice_finanziamento || null,
        importo_base: parseFloat(form.importo_base) || null,
        importo_contratto: parseFloat(form.importo_contratto) || calcContratto() || null,
        ribasso_pct: parseFloat(form.ribasso_pct) || 0,
        oneri_sicurezza: parseFloat(form.oneri_sicurezza) || 0,
        anticipazione_pct: parseFloat(form.anticipazione_pct) || 0,
        anticipazione_importo: (parseFloat(form.importo_contratto) || calcContratto()) * (parseFloat(form.anticipazione_pct) || 0) / 100,
        penale_giornaliera_pct: parseFloat(form.penale_giornaliera_pct) || 0,
        penale_max_pct: parseFloat(form.penale_max_pct) || 10,
        ritenuta_garanzia_pct: parseFloat(form.ritenuta_garanzia_pct) || 5,
        termini_pagamento_giorni: parseInt(form.termini_pagamento_giorni) || 30,
        cadenza_sal: form.cadenza_sal,
        importo_minimo_sal: parseFloat(form.importo_minimo_sal) || 0,
        revisione_prezzi: form.revisione_prezzi,
        provincia: form.provincia,
        comune_cantiere: form.comune_cantiere || null,
        cap_cantiere: form.cap_cantiere || null,
        indirizzo_cantiere: form.indirizzo_cantiere || null,
        catastale_foglio: form.catastale_foglio || null,
        catastale_particella: form.catastale_particella || null,
        titolo_edilizio: form.titolo_edilizio || null,
        categoria: form.categoria,
        data_aggiudicazione: form.data_aggiudicazione || null,
        data_stipula: form.data_stipula || null,
        data_consegna_cantiere: form.data_consegna_cantiere || null,
        data_inizio_lavori: form.data_inizio_lavori || null,
        giorni_contrattuali: parseInt(form.giorni_contrattuali) || null,
        tipo_giorni: form.tipo_giorni,
        data_fine_contrattuale: fineCalc || null,
        notifica_preliminare: form.notifica_preliminare || null,
        numero_addetti_max: parseInt(form.numero_addetti_max) || null,
        created_by: user.id,
      }).select('id').single()

      if (error) throw error

      // Crea automaticamente il computo_metrico collegato
      await supabase.from('computo_metrico').insert({
        azienda_id: az.id,
        commessa_id: c.id,
        nome: 'Computo metrico principale',
        tipo_uso: 'CONTRATTO',
        fonte: 'MANUALE',
      })

      onCreated(c.id)
    } catch (e: any) {
      setErr(e.message || 'Errore nella creazione')
    }
    setSaving(false)
  }

  const inputStyle = { width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, color: '#6b7280', display: 'block' as const, marginBottom: 3, fontWeight: 500 as const }
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }
  const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '95vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>Nuova Commessa</h2>
          {/* Progress steps */}
          <div style={{ display: 'flex', gap: 0 }}>
            {STEP_LABELS.map((l, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
                  background: i === step ? '#2563eb' : i < step ? '#059669' : '#e5e7eb',
                  color: i <= step ? '#fff' : '#9ca3af', flexShrink: 0 }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === step ? '#2563eb' : i < step ? '#059669' : '#9ca3af', fontWeight: i === step ? 600 : 400 }}>{l}</span>
                {i < 2 && <div style={{ flex: 1, height: 1, background: i < step ? '#059669' : '#e5e7eb', marginLeft: 6 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body scrollabile */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* STEP 0 — Identificativi */}
          {step === 0 && (
            <>
              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Codice commessa *</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input value={form.codice} onChange={e => set('codice', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => set('codice', '26.' + new Date().getFullYear().toString().slice(-2) + '.GE.' + String(Math.floor(Math.random()*900)+100))}
                      title="Rigenera" style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer' }}>
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Stato</label>
                  <select value={form.stato} onChange={e => set('stato', e.target.value)} style={inputStyle}>
                    {Object.entries(STATI_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo contratto</label>
                  <select value={form.tipo_contratto} onChange={e => set('tipo_contratto', e.target.value)} style={inputStyle}>
                    <option value="LAVORI">Lavori</option>
                    <option value="SERVIZI">Servizi</option>
                    <option value="FORNITURE">Forniture</option>
                    <option value="MISTO">Misto</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Nome / Oggetto dei lavori *</label>
                <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="es. Riqualificazione scuola media Viale Mazzini 14" style={inputStyle} />
              </div>

              <div style={grid2}>
                <div>
                  <label style={labelStyle}>Committente / Stazione appaltante *</label>
                  <input value={form.committente} onChange={e => set('committente', e.target.value)} placeholder="es. Comune di Napoli" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>P.IVA / C.F. committente</label>
                  <input value={form.committente_piva} onChange={e => set('committente_piva', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Tipo committente</label>
                  <select value={form.tipo_committente} onChange={e => set('tipo_committente', e.target.value)} style={inputStyle}>
                    <option>Pubblico</option><option>Privato</option><option>Misto</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Procedura gara</label>
                  <select value={form.procedura_gara} onChange={e => set('procedura_gara', e.target.value)} style={inputStyle}>
                    <option value="APERTA">Aperta</option>
                    <option value="RISTRETTA">Ristretta</option>
                    <option value="NEGOZIATA">Negoziata</option>
                    <option value="DIRETTA">Diretta</option>
                    <option value="ACCORDO_QUADRO">Accordo quadro</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Modalità esecuzione</label>
                  <select value={form.modalita_esecuzione} onChange={e => set('modalita_esecuzione', e.target.value)} style={inputStyle}>
                    <option value="MISURA">A misura</option>
                    <option value="CORPO">A corpo</option>
                    <option value="MISTO">Misto</option>
                  </select>
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <label style={labelStyle}>CIG</label>
                  <input value={form.cig} onChange={e => set('cig', e.target.value)} placeholder="es. 8934521ABC" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CUP</label>
                  <input value={form.cup} onChange={e => set('cup', e.target.value)} placeholder="es. J82F21001260001" style={inputStyle} />
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <label style={labelStyle}>Fonte finanziamento</label>
                  <select value={form.fonte_finanziamento} onChange={e => set('fonte_finanziamento', e.target.value)} style={inputStyle}>
                    <option value="BILANCIO_COMUNALE">Bilancio comunale</option>
                    <option value="PNRR">PNRR</option>
                    <option value="FONDI_UE">Fondi UE</option>
                    <option value="REGIONE">Regione</option>
                    <option value="MUTUO">Mutuo</option>
                    <option value="PRIVATO">Privato</option>
                    <option value="MISTO">Misto</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Numero contratto</label>
                  <input value={form.numero_contratto} onChange={e => set('numero_contratto', e.target.value)} placeholder="es. Rep. n.1234/2026" style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {/* STEP 1 — Dati economici */}
          {step === 1 && (
            <>
              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Importo base d'asta (€)</label>
                  <input type="number" step="0.01" value={form.importo_base} onChange={e => set('importo_base', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
                <div>
                  <label style={labelStyle}>Ribasso offerto (%)</label>
                  <input type="number" step="0.001" value={form.ribasso_pct} onChange={e => set('ribasso_pct', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
                <div>
                  <label style={labelStyle}>Oneri sicurezza PSC (€)</label>
                  <input type="number" step="0.01" value={form.oneri_sicurezza} onChange={e => set('oneri_sicurezza', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
              </div>

              {/* Calcolo live importo contratto */}
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Base d'asta:</span>
                  <span>EUR {fmt(parseFloat(form.importo_base) || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#dc2626' }}>
                  <span>Ribasso {form.ribasso_pct || 0}%:</span>
                  <span>− EUR {fmt((parseFloat(form.importo_base) || 0) * (parseFloat(form.ribasso_pct) || 0) / 100)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#991b1b' }}>
                  <span>+ Oneri sicurezza (no ribasso):</span>
                  <span>EUR {fmt(parseFloat(form.oneri_sicurezza) || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#059669', borderTop: '1px solid #bbf7d0', paddingTop: 6, marginTop: 4 }}>
                  <span>= IMPORTO CONTRATTO:</span>
                  <span>EUR {fmt(calcContratto())}</span>
                </div>
              </div>

              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Anticipazione contrattuale (%)</label>
                  <input type="number" step="0.01" value={form.anticipazione_pct} onChange={e => set('anticipazione_pct', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                  {form.anticipazione_pct && <span style={{ fontSize: 10, color: '#6b7280' }}>= EUR {fmt(calcContratto() * parseFloat(form.anticipazione_pct) / 100)}</span>}
                </div>
                <div>
                  <label style={labelStyle}>Ritenuta garanzia (%)</label>
                  <input type="number" step="0.01" value={form.ritenuta_garanzia_pct} onChange={e => set('ritenuta_garanzia_pct', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
                <div>
                  <label style={labelStyle}>Termini pagamento (gg)</label>
                  <input type="number" value={form.termini_pagamento_giorni} onChange={e => set('termini_pagamento_giorni', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
              </div>

              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Penale giornaliera (%)</label>
                  <input type="number" step="0.001" value={form.penale_giornaliera_pct} onChange={e => set('penale_giornaliera_pct', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
                <div>
                  <label style={labelStyle}>Penale massima (%)</label>
                  <input type="number" step="0.01" value={form.penale_max_pct} onChange={e => set('penale_max_pct', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
                <div>
                  <label style={labelStyle}>Cadenza SAL</label>
                  <select value={form.cadenza_sal} onChange={e => set('cadenza_sal', e.target.value)} style={inputStyle}>
                    <option value="MENSILE">Mensile</option>
                    <option value="BIMESTRALE">Bimestrale</option>
                    <option value="TRIMESTRALE">Trimestrale</option>
                    <option value="A_SOGLIA">A soglia importo</option>
                    <option value="A_RICHIESTA">A richiesta impresa</option>
                  </select>
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <label style={labelStyle}>Importo minimo SAL (€)</label>
                  <input type="number" step="0.01" value={form.importo_minimo_sal} onChange={e => set('importo_minimo_sal', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                  <input type="checkbox" id="rev" checked={form.revisione_prezzi} onChange={e => set('revisione_prezzi', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
                  <label htmlFor="rev" style={{ fontSize: 13, cursor: 'pointer' }}>Revisione prezzi (D.L. 50/2022)</label>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 — Cantiere e date */}
          {step === 2 && (
            <>
              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Provincia</label>
                  <select value={form.provincia} onChange={e => set('provincia', e.target.value)} style={inputStyle}>
                    {['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Comune cantiere</label>
                  <input value={form.comune_cantiere} onChange={e => set('comune_cantiere', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CAP</label>
                  <input value={form.cap_cantiere} onChange={e => set('cap_cantiere', e.target.value)} maxLength={5} style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Indirizzo cantiere</label>
                <input value={form.indirizzo_cantiere} onChange={e => set('indirizzo_cantiere', e.target.value)} placeholder="Via/Piazza, numero civico" style={inputStyle} />
              </div>

              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Categoria opera</label>
                  <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={inputStyle}>
                    {['GE','OG1','OG2','OG3','OG4','OG5','OG6','OG7','OG8','OG9','OG10','OG11','OG12','OG13','OS1','OS2','OS3','OS4','OS5','OS6','OS7','OS8','OS9','OS10','OS11','OS12','OS13','OS14','OS15','OS16','OS17','OS18','OS19','OS20','OS21','OS22','OS23','OS24','OS25','OS26','OS27','OS28','OS29','OS30'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Foglio catastale</label>
                  <input value={form.catastale_foglio} onChange={e => set('catastale_foglio', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Particella catastale</label>
                  <input value={form.catastale_particella} onChange={e => set('catastale_particella', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <label style={labelStyle}>Titolo edilizio (Permesso/SCIA/DIA)</label>
                  <input value={form.titolo_edilizio} onChange={e => set('titolo_edilizio', e.target.value)} placeholder="es. Permesso n.123/2026" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>N° max addetti contemporanei</label>
                  <input type="number" value={form.numero_addetti_max} onChange={e => set('numero_addetti_max', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ height: 1, background: '#e5e7eb', margin: '12px 0' }} />

              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Data aggiudicazione</label>
                  <input type="date" value={form.data_aggiudicazione} onChange={e => set('data_aggiudicazione', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Data stipula contratto</label>
                  <input type="date" value={form.data_stipula} onChange={e => set('data_stipula', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Consegna cantiere</label>
                  <input type="date" value={form.data_consegna_cantiere} onChange={e => set('data_consegna_cantiere', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={grid3}>
                <div>
                  <label style={labelStyle}>Inizio lavori</label>
                  <input type="date" value={form.data_inizio_lavori} onChange={e => set('data_inizio_lavori', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Giorni contrattuali</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="number" value={form.giorni_contrattuali} onChange={e => { set('giorni_contrattuali', e.target.value); set('data_fine_contrattuale', '') }} style={{ ...inputStyle, flex: 1, textAlign: 'right' }} />
                    <select value={form.tipo_giorni} onChange={e => set('tipo_giorni', e.target.value)} style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 4px' }}>
                      <option value="NATURALI">Nat.</option>
                      <option value="LAVORATIVI">Lav.</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Fine lavori contrattuale</label>
                  <input type="date" value={form.data_fine_contrattuale || calcFineContrattuale()} onChange={e => set('data_fine_contrattuale', e.target.value)} style={{ ...inputStyle, background: calcFineContrattuale() && !form.data_fine_contrattuale ? '#f0fdf4' : '' }} />
                  {calcFineContrattuale() && !form.data_fine_contrattuale && (
                    <span style={{ fontSize: 10, color: '#059669' }}>Calcolata automaticamente</span>
                  )}
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <label style={labelStyle}>Notifica preliminare INAIL</label>
                  <input type="date" value={form.notifica_preliminare} onChange={e => set('notifica_preliminare', e.target.value)} style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {err && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginTop: 8 }}>
              ⚠ {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ padding: '9px 20px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                ← Indietro
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!valid && step === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>Compila Nome lavori e Committente</span>}
            <button onClick={onClose} style={{ padding: '9px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              Annulla
            </button>
            {step < 2 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!valid}
                style={{ padding: '9px 24px', background: valid ? '#2563eb' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, cursor: valid ? 'pointer' : 'default', fontSize: 13, fontWeight: 500 }}>
                Avanti →
              </button>
            ) : (
              <button onClick={handleCreate} disabled={saving}
                style={{ padding: '9px 24px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : '✓ Crea commessa'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ====================================================
// PAGINA COMMESSE — lista
// ====================================================
export default function CommessePage() {
  const router = useRouter()
  const [commesse, setCommesse] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('TUTTE')
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('commesse')
      .select('id,codice,nome,committente,stato,importo_contratto,provincia,categoria,data_aggiudicazione,data_fine_contrattuale,giorni_contrattuali,data_inizio_lavori,tipo_contratto,fonte_finanziamento')
      .order('created_at', { ascending: false })
    setCommesse(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = commesse.filter(c => {
    const matchSearch = !search || c.nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.codice?.toLowerCase().includes(search.toLowerCase()) || c.committente?.toLowerCase().includes(search.toLowerCase())
    const matchStato = filtroStato === 'TUTTE' || c.stato === filtroStato
    return matchSearch && matchStato
  })

  const totPortafoglio = filtered.reduce((s, c) => s + (c.importo_contratto || 0), 0)
  const attive = commesse.filter(c => c.stato === 'IN_ESECUZIONE').length

  // Calcola giorni rimanenti
  const giorniRimanenti = (c: any) => {
    if (!c.data_fine_contrattuale) return null
    return Math.ceil((new Date(c.data_fine_contrattuale).getTime() - Date.now()) / 86400000)
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Commesse</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            {attive} attive · Portafoglio: EUR {fmt(totPortafoglio)}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={15} /> + Nuova commessa
        </button>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca nome, codice, committente..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        {(['TUTTE', ...Object.keys(STATI_CFG)] as const).map(s => {
          const cfg = s === 'TUTTE' ? null : STATI_CFG[s]
          return (
            <button key={s} onClick={() => setFiltroStato(s as string)}
              style={{ padding: '6px 14px', fontSize: 11, fontWeight: 500, border: '1px solid', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap',
                borderColor: filtroStato === s ? (cfg?.color || '#2563eb') : '#e5e7eb',
                background: filtroStato === s ? (cfg?.bg || '#eff6ff') : '#fff',
                color: filtroStato === s ? (cfg?.color || '#2563eb') : '#6b7280' }}>
              {s === 'TUTTE' ? 'Tutte' : cfg?.label}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#9ca3af' }}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#f9fafb', borderRadius: 16, border: '2px dashed #e5e7eb', color: '#9ca3af' }}>
          <Building2 size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14, margin: '0 0 4px' }}>Nessuna commessa {search ? 'trovata' : '— clicca "+ Nuova commessa"'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => {
            const stato = STATI_CFG[c.stato] || STATI_CFG.AGGIUDICATA
            const StatoIcon = stato.icon
            const gg = giorniRimanenti(c)
            const isScadente = gg !== null && gg >= 0 && gg <= 30
            const isScaduta = gg !== null && gg < 0
            return (
              <div key={c.id} onClick={() => router.push('/dashboard/commesse/' + c.id)}
                style={{ background: '#fff', border: '1px solid ' + (isScaduta ? '#fca5a5' : isScadente ? '#fcd34d' : '#e5e7eb'),
                  borderLeft: '4px solid ' + stato.color,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'grid',
                  gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
                  transition: 'box-shadow 0.15s' }}
                onMouseOver={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
                onMouseOut={e => (e.currentTarget.style.boxShadow = 'none')}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{c.codice}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: stato.bg, color: stato.color, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatoIcon size={11} /> {stato.label}
                    </span>
                    {isScaduta && <span style={{ fontSize: 10, padding: '2px 6px', background: '#fee2e2', color: '#dc2626', borderRadius: 4, fontWeight: 700 }}>SCADUTA {Math.abs(gg!)}gg</span>}
                    {isScadente && !isScaduta && <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef3c7', color: '#d97706', borderRadius: 4, fontWeight: 600 }}>⚠ {gg}gg rimanenti</span>}
                 </div>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px', color: '#111827' }}>{c.nome}</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                    {c.committente}
                    {c.data_fine_contrattuale && <span style={{ marginLeft: 10 }}>· Fine lavori: {new Date(c.data_fine_contrattuale).toLocaleDateString('it-IT')}</span>}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                    EUR {fmt(c.importo_contratto || 0)}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>importo contratto</div>
                </div>h
              </div>
            )
          })}
        </div>
      )}

      {/* Modal creazione */}
      {showModal && (
        <NuovaCommessaModal
          onClose={() => setShowModal(false)}
          onCreated={id => { setShowModal(false); router.push('/dashboard/commesse/' + id) }}
        />
      )}
    </div>
  )
}
