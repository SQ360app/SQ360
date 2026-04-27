'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Loader2, Building2, RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })

const STATI_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  AGGIUDICATA:    { label: 'Aggiudicata',    color: '#d97706', bg: '#fffbeb', icon: FileText },
  IN_ESECUZIONE:  { label: 'In esecuzione',  color: '#059669', bg: '#f0fdf4', icon: CheckCircle2 },
  SOSPESA:        { label: 'Sospesa',        color: '#dc2626', bg: '#fef2f2', icon: AlertTriangle },
  ULTIMATA:       { label: 'Ultimata',       color: '#7c3aed', bg: '#f5f3ff', icon: CheckCircle2 },
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
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{c.categoria} · {c.provincia}</span>
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
                </div>
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
}'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Search, ArrowRight, Upload, Sparkles, MapPin, X, Save, CheckCircle, AlertCircle, ChevronDown, AlertTriangle } from 'lucide-react'

interface Commessa {
  id: string
  codice: string
  nome: string
  committente: string
  stato: string
  importo_aggiudicato: number
  avanzamento_pct: number
}

interface FormCommessa {
  codice: string; nome: string; committente: string; cig: string; cup: string
  importo_base: number; importo_aggiudicato: number; ribasso_pct: number; oneri_sicurezza: number
  provincia: string; categoria: string; tipo_committente: string; stato: string
  indirizzo_cantiere: string; citta_cantiere: string; lat: string; lng: string
  data_aggiudicazione: string; data_fine_contrattuale: string; durata_giorni: number; note: string
  rup_nome: string; rup_email: string; rup_telefono: string
  dl_nome: string; dl_email: string; dl_telefono: string
  direttore_operativo_nome: string; direttore_operativo_email: string
  ispettore_cantiere_nome: string; ispettore_cantiere_email: string
  csp_nome: string; csp_email: string; cse_nome: string; cse_email: string
  collaudatore_nome: string; collaudatore_email: string
  collaudatore_statico_nome: string; collaudatore_statico_email: string
  rc_nome: string; rc_email: string; rc_telefono: string
  direttore_tecnico_nome: string; direttore_tecnico_email: string
  capocantiere_nome: string; capocantiere_telefono: string
  rspp_nome: string; rspp_email: string
  preposto_nome: string; preposto_telefono: string
  responsabile_qualita_nome: string; responsabile_qualita_email: string
}

const PROVINCE_IT = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OG','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']
const STATI = ['IN_ESECUZIONE','AGGIUDICATA','COLLAUDO','SOSPESA','CHIUSA']
const STATO_COLOR: Record<string, string> = { IN_ESECUZIONE:'#10b981', AGGIUDICATA:'#3b82f6', COLLAUDO:'#8b5cf6', SOSPESA:'#ef4444', CHIUSA:'#64748b' }
const AZIENDA_ID = 'f5ddf460-715a-495e-997a-0246ea73326b'

const FORM_VUOTO: FormCommessa = {
  codice:'', nome:'', committente:'', cig:'', cup:'',
  importo_base:0, importo_aggiudicato:0, ribasso_pct:0, oneri_sicurezza:0,
  provincia:'NA', categoria:'GE', tipo_committente:'P', stato:'AGGIUDICATA',
  indirizzo_cantiere:'', citta_cantiere:'', lat:'', lng:'',
  data_aggiudicazione: new Date().toISOString().slice(0,10),
  data_fine_contrattuale:'', durata_giorni:365, note:'',
  rup_nome:'', rup_email:'', rup_telefono:'',
  dl_nome:'', dl_email:'', dl_telefono:'',
  direttore_operativo_nome:'', direttore_operativo_email:'',
  ispettore_cantiere_nome:'', ispettore_cantiere_email:'',
  csp_nome:'', csp_email:'', cse_nome:'', cse_email:'',
  collaudatore_nome:'', collaudatore_email:'',
  collaudatore_statico_nome:'', collaudatore_statico_email:'',
  rc_nome:'', rc_email:'', rc_telefono:'',
  direttore_tecnico_nome:'', direttore_tecnico_email:'',
  capocantiere_nome:'', capocantiere_telefono:'',
  rspp_nome:'', rspp_email:'',
  preposto_nome:'', preposto_telefono:'',
  responsabile_qualita_nome:'', responsabile_qualita_email:'',
}

function fmt(n: number) { return (n||0).toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:0}) }
function generaCodice(prov: string, cat: string, prog: number) {
  const aa = String(new Date().getFullYear()).slice(-2)
  return `${aa}.${(prov||'NA').toUpperCase().slice(0,3)}.${(cat||'GE').toUpperCase().slice(0,2)}.${String(prog).padStart(3,'0')}`
}

type Step = 'UPLOAD' | 'AI_LOADING' | 'FORM'

export default function CommessePage() {
  const router = useRouter()
  const [commesse, setCommesse] = useState<Commessa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState('TUTTI')
  const [showNuova, setShowNuova] = useState(false)
  const [step, setStep] = useState<Step>('UPLOAD')
  const [aiMsg, setAiMsg] = useState('')
  const [aiOk, setAiOk] = useState<boolean|null>(null)
  const [saving, setSaving] = useState(false)
  const [erroreInsert, setErroreInsert] = useState('')
  const [showFigure, setShowFigure] = useState(false)
  const [sezFigure, setSezFigure] = useState<'sa'|'impresa'>('sa')
  const [form, setForm] = useState<FormCommessa>({...FORM_VUOTO})
  const fileRef = useRef<HTMLInputElement>(null)
  const [deleteId, setDeleteId] = useState<string|null>(null)
  const [deleteStep, setDeleteStep] = useState(0)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data } = await supabase
      .from('v_commesse_kpi')
      .select('id,codice,nome,committente,stato,importo_aggiudicato,avanzamento_pct')
      .order('stato')
    if (data) setCommesse(data as Commessa[])
    setLoading(false)
  }

  function setStr(k: keyof FormCommessa, v: string) { setForm(p => ({...p, [k]: v})) }
  function setNum(k: keyof FormCommessa, v: number) { setForm(p => ({...p, [k]: v})) }

  async function geocodifica() {
    if (!form.indirizzo_cantiere || !form.citta_cantiere) return
    try {
      const q = encodeURIComponent(`${form.indirizzo_cantiere}, ${form.citta_cantiere}, Italia`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`)
      const data = await res.json() as Array<{lat:string;lon:string}>
      if (data[0]) { setStr('lat', data[0].lat); setStr('lng', data[0].lon) }
    } catch { /* silenzioso */ }
  }

  // ── AI IMPORT CONTRATTO (PDF, DOCX, TXT) ──────────────────────────────────
  async function handleFileImport(file: File) {
    setStep('AI_LOADING'); setAiMsg('Analisi documento...'); setAiOk(null)
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type.includes('officedocument')

      setAiMsg(isPdf ? '📄 AI legge il PDF...' : isDocx ? '📝 Analisi DOCX...' : '🔍 AI estrae i dati...')

      const fd = new FormData()
      if (isPdf || isDocx) {
        fd.append('file', file)
      } else {
        const testo = await file.text()
        fd.append('testo', testo.slice(0, 9000))
      }

      const res = await fetch('/api/ai-import-contratto', { method: 'POST', body: fd })
      const json = await res.json() as { ok: boolean; dati?: Record<string, unknown>; errore?: string }

      if (json.ok && json.dati) {
        const d = json.dati
        const s = (v: unknown) => typeof v === 'string' ? v : ''
        const n = (v: unknown) => parseFloat(String(v || '0')) || 0
        const prov = (s(d.provincia) || 'NA').toUpperCase().slice(0, 2)
        const cat = (s(d.categoria_prevalente) || 'GE').toUpperCase().slice(0, 2)
        const durataGg = parseInt(String(d.durata_gg || d.durata_giorni || '365')) || 365

        setForm(p => ({
          ...p,
          codice: generaCodice(prov, cat, commesse.length + 1),
          nome: s(d.nome) || p.nome,
          committente: s(d.committente) || p.committente,
          cig: s(d.cig) || p.cig,
          cup: s(d.cup) || p.cup,
          importo_base: n(d.importo_base) || p.importo_base,
          importo_aggiudicato: n(d.importo_aggiudicato) || n(d.importo_base) || p.importo_aggiudicato,
          ribasso_pct: n(d.ribasso_pct) || p.ribasso_pct,
          oneri_sicurezza: n(d.oneri_sicurezza) || p.oneri_sicurezza,
          provincia: prov,
          categoria: cat,
          data_aggiudicazione: s(d.data_aggiudicazione) || p.data_aggiudicazione,
          durata_giorni: durataGg,
          indirizzo_cantiere: s(d.indirizzo_cantiere) || p.indirizzo_cantiere,
          citta_cantiere: s(d.citta_cantiere) || p.citta_cantiere,
          rup_nome: s(d.rup_nome) || p.rup_nome,
          rup_email: s(d.rup_email) || p.rup_email,
          rup_telefono: s(d.rup_telefono) || p.rup_telefono,
          dl_nome: s(d.dl_nome) || p.dl_nome,
          dl_email: s(d.dl_email) || p.dl_email,
          dl_telefono: s(d.dl_telefono) || p.dl_telefono,
          csp_nome: s(d.csp_nome) || p.csp_nome,
          cse_nome: s(d.cse_nome) || p.cse_nome,
          note: s(d.note) || p.note,
        }))
        setAiOk(true)
        setAiMsg('✅ Dati estratti — verifica e integra i campi mancanti')
      } else {
        setAiOk(false)
        setAiMsg(`⚠️ ${json.errore || 'Estrazione parziale'} — compila manualmente i campi`)
      }
    } catch (e) {
      setAiOk(false)
      setAiMsg(`❌ ${String(e)} — inserisci i dati manualmente`)
    }
    setStep('FORM')
  }

  async function creaCommessa() {
    if (!form.nome.trim() || !form.committente.trim()) return
    setSaving(true); setErroreInsert('')
    try {
      let aziendaId = AZIENDA_ID
      try {
        const { data: ut } = await supabase.auth.getUser()
        if (ut.user?.id) {
          const { data: utData } = await supabase.from('utenti').select('azienda_id').eq('id', ut.user.id).single()
          if (utData?.azienda_id) aziendaId = utData.azienda_id
        }
      } catch { /* fallback */ }

      const progressivo = commesse.length + 1
      const { data, error } = await supabase.from('commesse').insert([{
        azienda_id: aziendaId,
        codice: form.codice || generaCodice(form.provincia, form.categoria, progressivo),
        anno: new Date().getFullYear(),
        progressivo,
        nome: form.nome.trim(),
        committente: form.committente.trim(),
        cig: form.cig || null,
        cup: form.cup || null,
        importo_base: form.importo_base || 0,
        importo_aggiudicato: form.importo_aggiudicato || form.importo_base || 0,
        ribasso_pct: form.ribasso_pct || 0,
        oneri_sicurezza: form.oneri_sicurezza || 0,
        provincia: form.provincia || 'NA',
        categoria: form.categoria || 'GE',
        tipo_committente: form.tipo_committente || 'P',
        stato: form.stato || 'AGGIUDICATA',
        data_aggiudicazione: form.data_aggiudicazione || null,
        data_fine_contrattuale: form.data_fine_contrattuale || null,
        durata_gg: form.durata_giorni || 365,
        rup_nome: form.rup_nome || null,
        rup_email: form.rup_email || null,
        dl_nome: form.dl_nome || null,
        dl_email: form.dl_email || null,
        csp_nome: form.csp_nome || null,
        cse_nome: form.cse_nome || null,
        note: form.note || null,
      }]).select('id,codice').single()

      if (error) { setErroreInsert(`Errore DB: ${error.message} [${error.code}]`); return }
      if (!data) { setErroreInsert('Errore: nessun dato ricevuto — riprova'); return }

      setShowNuova(false)
      await carica()
      router.push(`/dashboard/commesse/${data.id}`)
    } catch (err) {
      setErroreInsert(`Errore imprevisto: ${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function eliminaCommessa(id: string) {
    const { error } = await supabase.from('commesse').delete().eq('id', id)
    if (!error) { setDeleteId(null); setDeleteStep(0); await carica() }
    else alert('Errore eliminazione: ' + error.message)
  }

  function apriNuova() {
    setStep('UPLOAD'); setAiMsg(''); setAiOk(null); setErroreInsert('')
    setForm({...FORM_VUOTO, codice: generaCodice('NA','GE',commesse.length+1)})
    setShowNuova(true)
  }

  const filtrate = commesse.filter(c => {
    const ms = filtroStato === 'TUTTI' || c.stato === filtroStato
    const mq = !search || [c.nome,c.codice,c.committente].some(x => x?.toLowerCase().includes(search.toLowerCase()))
    return ms && mq
  })

  const portafoglio = commesse.filter(c=>c.stato!=='CHIUSA').reduce((s,c)=>s+(c.importo_aggiudicato||0),0)

  const inp: React.CSSProperties = { width:'100%', boxSizing:'border-box' as const, background:'#fff', border:'1px solid #e2e8f0', borderRadius:7, padding:'8px 10px', color:'#1e293b', fontSize:13 }
  const lbl: React.CSSProperties = { fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:4 }
  const si: React.CSSProperties = { ...inp, padding:'6px 8px', fontSize:12 }
  const sl: React.CSSProperties = { ...lbl, fontSize:9 }

  const figSA: Array<{k:keyof FormCommessa;l:string}> = [
    {k:'rup_nome',l:'RUP — Nome'},{k:'rup_email',l:'RUP — Email'},{k:'rup_telefono',l:'RUP — Tel.'},
    {k:'dl_nome',l:'DL — Nome'},{k:'dl_email',l:'DL — Email'},{k:'dl_telefono',l:'DL — Tel.'},
    {k:'direttore_operativo_nome',l:'Dir. Operativo'},{k:'direttore_operativo_email',l:'Dir. Op. Email'},
    {k:'ispettore_cantiere_nome',l:'Ispettore'},{k:'ispettore_cantiere_email',l:'Ispettore Email'},
    {k:'csp_nome',l:'CSP — Nome'},{k:'csp_email',l:'CSP — Email'},
    {k:'cse_nome',l:'CSE — Nome'},{k:'cse_email',l:'CSE — Email'},
    {k:'collaudatore_nome',l:'Collaudatore'},{k:'collaudatore_email',l:'Coll. Email'},
    {k:'collaudatore_statico_nome',l:'Coll. Statico'},{k:'collaudatore_statico_email',l:'Coll. Stat. Email'},
  ]

  const figI: Array<{k:keyof FormCommessa;l:string}> = [
    {k:'rc_nome',l:'Resp. Commessa'},{k:'rc_email',l:'RC — Email'},{k:'rc_telefono',l:'RC — Tel.'},
    {k:'direttore_tecnico_nome',l:'Dir. Tecnico'},{k:'direttore_tecnico_email',l:'Dir. Tec. Email'},
    {k:'capocantiere_nome',l:'Capocantiere'},{k:'capocantiere_telefono',l:'Capo — Tel.'},
    {k:'rspp_nome',l:'RSPP — Nome'},{k:'rspp_email',l:'RSPP — Email'},
    {k:'preposto_nome',l:'Preposto'},{k:'preposto_telefono',l:'Preposto — Tel.'},
    {k:'responsabile_qualita_nome',l:'Resp. Qualità'},{k:'responsabile_qualita_email',l:'RQ — Email'},
  ]

  return (
    <div style={{padding:'22px 28px',background:'var(--bg)',minHeight:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:'var(--t1)',margin:0}}>Commesse</h1>
          <p style={{fontSize:12,color:'var(--t3)',marginTop:3}}>{commesse.filter(c=>c.stato!=='CHIUSA').length} attive · Portafoglio: € {fmt(portafoglio)}</p>
        </div>
        <button onClick={apriNuova} className="btn-primary">+ Nuova commessa</button>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:240}}>
          <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--t3)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca nome, codice, committente..."
            style={{width:'100%',background:'var(--panel)',border:'1px solid var(--border)',borderRadius:9,padding:'9px 12px 9px 34px',fontSize:13,color:'var(--t1)',boxSizing:'border-box' as const}}/>
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {['TUTTI',...STATI].map(s=>(
            <button key={s} onClick={()=>setFiltroStato(s)} style={{padding:'7px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:11,fontWeight:600,cursor:'pointer',background:filtroStato===s?(STATO_COLOR[s]||'var(--accent)'):'var(--panel)',color:filtroStato===s?'white':'var(--t3)',whiteSpace:'nowrap' as const}}>
              {s==='TUTTI'?'Tutte':s.replace('_',' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:48,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}}/></div>
        ) : filtrate.length===0 ? (
          <div style={{padding:'60px 32px',textAlign:'center',color:'var(--t3)',fontSize:13}}>
            {commesse.length===0?'Nessuna commessa — clicca "+ Nuova commessa"':'Nessun risultato'}
          </div>
        ) : filtrate.map((c,i)=>{
          const col=STATO_COLOR[c.stato]||'#6b7280'
          return (
            <div key={c.id} onClick={()=>router.push(`/dashboard/commesse/${c.id}`)}
              style={{display:'flex',alignItems:'center',gap:14,padding:'13px 20px',borderBottom:i<filtrate.length-1?'1px solid var(--border)':'none',cursor:'pointer',transition:'background 0.12s'}}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--accent-light)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <div style={{width:4,height:44,borderRadius:2,background:col,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700,color:'var(--accent)'}}>{c.codice}</span>
                  <span style={{fontSize:10,fontWeight:600,color:col,background:`${col}15`,borderRadius:5,padding:'1px 6px'}}>{c.stato.replace('_',' ')}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--t1)'}} className="truncate">{c.nome}</div>
                <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{c.committente}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:80,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{width:`${c.avanzamento_pct||0}%`,height:'100%',background:col}}/>
                </div>
                <span style={{fontSize:10,color:'var(--t3)',width:28}}>{c.avanzamento_pct||0}%</span>
              </div>
              <div style={{fontSize:14,fontWeight:800,color:'var(--t1)',fontFamily:'var(--font-mono)',flexShrink:0}}>€ {fmt(c.importo_aggiudicato)}</div>
              <button onClick={e=>{e.stopPropagation();setDeleteId(c.id);setDeleteStep(1)}}
                style={{background:'none',border:'none',cursor:'pointer',padding:'4px 6px',borderRadius:6,color:'#ef4444',opacity:0.6}} title="Elimina">🗑</button>
              <ArrowRight size={14} color="var(--t4)"/>
            </div>
          )
        })}
      </div>

      {/* MODAL DELETE */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box" style={{maxWidth:420,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>{deleteStep===1?'🗑':'⚠️'}</div>
            {deleteStep===1 && <>
              <h2 style={{fontSize:17,fontWeight:800,color:'#1e293b',marginBottom:8}}>Elimina commessa?</h2>
              <p style={{fontSize:13,color:'#64748b',marginBottom:20}}>L'operazione è irreversibile. Tutti i dati verranno eliminati.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={()=>{setDeleteId(null);setDeleteStep(0)}} className="btn-secondary">Annulla</button>
                <button onClick={()=>setDeleteStep(2)} style={{background:'#ef4444',color:'white',border:'none',borderRadius:8,padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>Sì, elimina</button>
              </div>
            </>}
            {deleteStep===2 && <>
              <h2 style={{fontSize:17,fontWeight:800,color:'#ef4444',marginBottom:8}}>Conferma eliminazione</h2>
              <p style={{fontSize:13,color:'#64748b',marginBottom:20}}>Sei sicuro? Questa azione non può essere annullata.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <button onClick={()=>{setDeleteId(null);setDeleteStep(0)}} className="btn-secondary">Annulla</button>
                <button onClick={()=>eliminaCommessa(deleteId)} style={{background:'#dc2626',color:'white',border:'none',borderRadius:8,padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>ELIMINA DEFINITIVAMENTE</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* MODAL NUOVA COMMESSA */}
      {showNuova && (
        <div className="modal-overlay">
          <div className="modal-box" style={{maxWidth:step==='FORM'?780:480}}>

            {step==='UPLOAD' && <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div><h2 style={{fontSize:18,fontWeight:800,color:'#1e293b',margin:0}}>Nuova Commessa</h2><p style={{fontSize:12,color:'#64748b',marginTop:3}}>Importa documento o inserisci manualmente</p></div>
                <button onClick={()=>setShowNuova(false)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:8,cursor:'pointer'}}><X size={15} color="#64748b"/></button>
              </div>
              <div onClick={()=>fileRef.current?.click()} style={{border:'2px dashed #e2e8f0',borderRadius:14,padding:'40px 24px',textAlign:'center',cursor:'pointer',background:'#f8fafc',marginBottom:16}}>
                <div style={{width:52,height:52,borderRadius:14,background:'rgba(59,130,246,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}><Upload size={24} color="#3b82f6"/></div>
                <div style={{fontSize:15,fontWeight:700,color:'#1e293b',marginBottom:6}}>Importa documento</div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:6}}>PDF, TXT, DOCX — Contratto, Capitolato, Determina</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontSize:11,color:'#3b82f6',fontWeight:600}}><Sparkles size={13}/> AI compila i campi in automatico</div>
                <input ref={fileRef} type="file" accept=".txt,.doc,.docx,.pdf" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFileImport(f)}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}><div style={{flex:1,height:1,background:'#e2e8f0'}}/><span style={{fontSize:11,color:'#94a3b8'}}>oppure</span><div style={{flex:1,height:1,background:'#e2e8f0'}}/></div>
              <button onClick={()=>setStep('FORM')} className="btn-secondary" style={{width:'100%',justifyContent:'center'}}>Inserisci dati manualmente</button>
            </>}

            {step==='AI_LOADING' && (
              <div style={{textAlign:'center',padding:'48px 24px'}}>
                <div style={{width:56,height:56,borderRadius:16,background:'rgba(59,130,246,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><Sparkles size={28} color="#3b82f6"/></div>
                <div style={{fontSize:16,fontWeight:700,color:'#1e293b',marginBottom:8}}>AI analizza il documento</div>
                <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>{aiMsg}</div>
                <div className="spinner" style={{margin:'0 auto'}}/>
              </div>
            )}

            {step==='FORM' && <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:800,color:'#1e293b',margin:0}}>Dati commessa</h2>
                  {aiMsg && <div style={{display:'flex',alignItems:'center',gap:6,marginTop:5,fontSize:11,color:aiOk===true?'#10b981':'#f59e0b'}}>{aiOk===true?<CheckCircle size={12}/>:<AlertCircle size={12}/>}{aiMsg}</div>}
                </div>
                <button onClick={()=>setShowNuova(false)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:8,cursor:'pointer',flexShrink:0}}><X size={15} color="#64748b"/></button>
              </div>

              {erroreInsert && (
                <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#ef4444',display:'flex',gap:8}}>
                  <AlertTriangle size={14} style={{flexShrink:0,marginTop:1}}/>{erroreInsert}
                </div>
              )}

              <div style={{maxHeight:'62vh',overflowY:'auto',paddingRight:4}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <label style={lbl}>Codice *</label>
                    <div style={{display:'flex',gap:6}}>
                      <input value={form.codice} onChange={e=>setStr('codice',e.target.value)} style={{...inp,fontFamily:'monospace',fontWeight:700,flex:1}}/>
                      <button onClick={()=>setStr('codice',generaCodice(form.provincia,form.categoria,commesse.length+1))} style={{padding:'8px 10px',borderRadius:7,border:'1px solid var(--border)',background:'var(--bg)',cursor:'pointer',color:'var(--accent)'}}>↺</button>
                    </div>
                  </div>
                  <div><label style={lbl}>Stato</label><select value={form.stato} onChange={e=>setStr('stato',e.target.value)} style={{...inp,width:'100%'}}>{STATI.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></div>
                  <div style={{gridColumn:'span 2'}}><label style={lbl}>Nome / Oggetto lavori *</label><input value={form.nome} onChange={e=>setStr('nome',e.target.value)} placeholder="es. Riqualificazione Scuola Media Viale Mazzini" style={inp}/></div>
                  <div><label style={lbl}>Committente *</label><input value={form.committente} onChange={e=>setStr('committente',e.target.value)} placeholder="es. Comune di Napoli" style={inp}/></div>
                  <div><label style={lbl}>Tipo committente</label><select value={form.tipo_committente} onChange={e=>setStr('tipo_committente',e.target.value)} style={{...inp,width:'100%'}}><option value="P">Pubblico</option><option value="PR">Privato</option><option value="M">Misto</option></select></div>
                  <div><label style={lbl}>CIG</label><input value={form.cig} onChange={e=>setStr('cig',e.target.value)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>CUP</label><input value={form.cup} onChange={e=>setStr('cup',e.target.value)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Importo base (€)</label><input type="number" min={0} value={form.importo_base||''} onChange={e=>setNum('importo_base',parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Importo aggiudicato (€)</label><input type="number" min={0} value={form.importo_aggiudicato||''} onChange={e=>setNum('importo_aggiudicato',parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Ribasso %</label><input type="number" min={0} max={100} step={0.001} value={form.ribasso_pct||''} onChange={e=>setNum('ribasso_pct',parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Oneri sicurezza (€)</label><input type="number" min={0} value={form.oneri_sicurezza||''} onChange={e=>setNum('oneri_sicurezza',parseFloat(e.target.value)||0)} style={{...inp,fontFamily:'monospace'}}/></div>
                  <div><label style={lbl}>Provincia</label><select value={form.provincia} onChange={e=>setStr('provincia',e.target.value)} style={{...inp,width:'100%'}}>{PROVINCE_IT.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                  <div><label style={lbl}>Categoria</label><select value={form.categoria} onChange={e=>setStr('categoria',e.target.value)} style={{...inp,width:'100%'}}>{[['GE','Generale'],['RS','Ristrutturazione'],['NR','Nuova Realizzazione'],['ML','Manutenzione'],['SI','Impianti'],['ST','Strade'],['ID','Idraulica'],['EL','Elettrico']].map(([v,l])=><option key={v} value={v}>{v} — {l}</option>)}</select></div>
                  <div><label style={lbl}>Data aggiudicazione</label><input type="date" value={form.data_aggiudicazione} onChange={e=>setStr('data_aggiudicazione',e.target.value)} style={inp}/></div>
                  <div><label style={lbl}>Fine lavori</label><input type="date" value={form.data_fine_contrattuale} onChange={e=>setStr('data_fine_contrattuale',e.target.value)} style={inp}/></div>
                  <div style={{gridColumn:'span 2',paddingTop:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#334155',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><MapPin size={13} color="#3b82f6"/> Localizzazione cantiere</div>
                  </div>
                  <div style={{gridColumn:'span 2'}}><label style={lbl}>Indirizzo cantiere</label><input value={form.indirizzo_cantiere} onChange={e=>setStr('indirizzo_cantiere',e.target.value)} placeholder="Via Roma 1" style={inp}/></div>
                  <div><label style={lbl}>Città</label><input value={form.citta_cantiere} onChange={e=>setStr('citta_cantiere',e.target.value)} style={inp}/></div>
                  <div>
                    <label style={{...lbl,display:'flex',justifyContent:'space-between'}}>Coordinate <button onClick={geocodifica} style={{fontSize:9,color:'#3b82f6',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>📍 Calcola</button></label>
                    <div style={{display:'flex',gap:6}}>
                      <input value={form.lat} onChange={e=>setStr('lat',e.target.value)} placeholder="Lat" style={{...inp,fontFamily:'monospace'}}/>
                      <input value={form.lng} onChange={e=>setStr('lng',e.target.value)} placeholder="Lng" style={{...inp,fontFamily:'monospace'}}/>
                    </div>
                  </div>
                  <div style={{gridColumn:'span 2'}}><label style={lbl}>Note</label><textarea value={form.note} onChange={e=>setStr('note',e.target.value)} rows={2} style={{...inp,resize:'vertical',width:'100%'}}/></div>

                  <div style={{gridColumn:'span 2',marginTop:8}}>
                    <button onClick={()=>setShowFigure(!showFigure)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:showFigure?'rgba(59,130,246,0.06)':'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,color:'#334155'}}>
                      <span>👷 Figure professionali</span><ChevronDown size={14} style={{transform:showFigure?'rotate(180deg)':'none',transition:'0.2s'}}/>
                    </button>
                    {showFigure && (
                      <div style={{border:'1px solid #e2e8f0',borderRadius:10,marginTop:4,overflow:'hidden'}}>
                        <button onClick={()=>setSezFigure('sa')} style={{width:'100%',display:'flex',justifyContent:'space-between',padding:'9px 14px',background:sezFigure==='sa'?'rgba(59,130,246,0.06)':'#f8fafc',border:'none',borderBottom:'1px solid #e2e8f0',cursor:'pointer',fontSize:11,fontWeight:700,color:'#334155'}}>
                          🏛 Stazione Appaltante <ChevronDown size={12}/>
                        </button>
                        {sezFigure==='sa' && (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:'12px 14px',background:'#fafafa'}}>
                            {figSA.map(({k,l})=><div key={k}><label style={sl}>{l}</label><input value={String(form[k]||'')} onChange={e=>setStr(k,e.target.value)} style={si}/></div>)}
                          </div>
                        )}
                        <button onClick={()=>setSezFigure('impresa')} style={{width:'100%',display:'flex',justifyContent:'space-between',padding:'9px 14px',background:sezFigure==='impresa'?'rgba(59,130,246,0.06)':'#f8fafc',border:'none',borderTop:'1px solid #e2e8f0',cursor:'pointer',fontSize:11,fontWeight:700,color:'#334155'}}>
                          🏗 Impresa Esecutrice <ChevronDown size={12}/>
                        </button>
                        {sezFigure==='impresa' && (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:'12px 14px',background:'#fafafa'}}>
                            {figI.map(({k,l})=><div key={k}><label style={sl}>{l}</label><input value={String(form[k]||'')} onChange={e=>setStr(k,e.target.value)} style={si}/></div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{marginTop:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <button onClick={()=>setStep('UPLOAD')} className="btn-secondary" style={{fontSize:12}}>← Documento</button>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <button onClick={()=>setShowNuova(false)} className="btn-secondary">Annulla</button>
                  <button onClick={creaCommessa} disabled={saving||!form.nome.trim()||!form.committente.trim()} className="btn-primary" style={{opacity:(!form.nome.trim()||!form.committente.trim())?0.5:1}}>
                    <Save size={14}/>{saving?'Creazione...':'Crea commessa'}
                  </button>
                </div>
              </div>
              {(!form.nome.trim()||!form.committente.trim()) && (
                <div style={{textAlign:'center',marginTop:8,fontSize:11,color:'#94a3b8'}}>Compila <strong>Nome lavori</strong> e <strong>Committente</strong></div>
              )}
            </>}
          </div>
        </div>
      )}
    </div>
  )
}
