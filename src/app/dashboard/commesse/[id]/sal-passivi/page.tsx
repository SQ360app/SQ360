'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, FileText, CheckCircle, AlertTriangle, X, Save, ChevronDown, ChevronRight, Shield, Ban } from 'lucide-react'

// ─── TIPI ───────────────────────────────────────────────────────────────────

interface SalPassivo {
  id: string
  numero: number
  fornitore_id: string
  fornitore_nome: string
  data_emissione: string
  data_riferimento_a: string
  totale_sal: number
  ritenute_garanzia: number
  ritenuta_fiscale: number
  importo_netto: number
  stato: string
  approvato_rc: boolean
  data_approvazione_rc: string
  note: string
  durc_valido: boolean
  durc_scadenza?: string
}

interface Fornitore {
  id: string
  ragione_sociale: string
  partita_iva: string
  durc_scadenza?: string
}

interface FormState {
  fornitore_id: string
  numero: number
  data_emissione: string
  data_riferimento_a: string
  importo_lordo: number
  ritenute_pct: number
  ritenuta_fiscale_pct: number
  note: string
}

const STATO_LABEL: Record<string, string> = {
  RICEVUTO: 'Ricevuto', IN_VERIFICA: 'In verifica',
  APPROVATO_RC: 'Approvato RC', SOSPESO: 'Sospeso', PAGATO: 'Pagato'
}
const STATO_COLOR: Record<string, string> = {
  RICEVUTO: '#6b7280', IN_VERIFICA: '#f59e0b',
  APPROVATO_RC: '#3b82f6', SOSPESO: '#ef4444', PAGATO: '#10b981'
}

function fmt(n: number) {
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function durcInfo(scadenza?: string): { valido: boolean; label: string } {
  if (!scadenza) return { valido: false, label: 'Non disponibile' }
  const gg = Math.ceil((new Date(scadenza).getTime() - Date.now()) / 86400000)
  if (gg < 0) return { valido: false, label: `Scaduto ${Math.abs(gg)}gg fa` }
  if (gg <= 30) return { valido: true, label: `Scade in ${gg}gg` }
  return { valido: true, label: `Valido fino ${scadenza}` }
}

const FORM_INIZIALE: FormState = {
  fornitore_id: '', numero: 1,
  data_emissione: new Date().toISOString().slice(0, 10),
  data_riferimento_a: new Date().toISOString().slice(0, 10),
  importo_lordo: 0, ritenute_pct: 5, ritenuta_fiscale_pct: 0, note: ''
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────

export default function SalPassiviPage() {
  const { id: commessaId } = useParams() as { id: string }
  const [sals, setSals] = useState<SalPassivo[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuovo, setShowNuovo] = useState(false)
  const [salAperto, setSalAperto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>({ ...FORM_INIZIALE })

  useEffect(() => { carica() }, [commessaId])

  async function carica() {
    setLoading(true)

    const { data: salData } = await supabase
      .from('sal')
      .select('*')
      .eq('commessa_id', commessaId)
      .eq('tipo', 'PASSIVO')
      .order('numero')

    const { data: fornData } = await supabase
      .from('fornitori')
      .select('id, ragione_sociale, partita_iva, durc_scadenza')
      .order('ragione_sociale')

    const forniList = (fornData || []) as Fornitore[]
    setFornitori(forniList)

    if (salData) {
      const mapped: SalPassivo[] = (salData as Record<string, unknown>[]).map(s => {
        const forn = forniList.find(f => f.id === s.fornitore_id)
        return {
          id: s.id as string,
          numero: s.numero as number,
          fornitore_id: s.fornitore_id as string,
          fornitore_nome: forn?.ragione_sociale || 'Fornitore sconosciuto',
          data_emissione: s.data_emissione as string,
          data_riferimento_a: s.data_riferimento_a as string,
          totale_sal: s.totale_sal as number || 0,
          ritenute_garanzia: s.ritenute_garanzia as number || 0,
          ritenuta_fiscale: s.ritenuta_fiscale as number || 0,
          importo_netto: s.importo_netto as number || 0,
          stato: s.stato as string || 'RICEVUTO',
          approvato_rc: s.approvato_rc as boolean || false,
          data_approvazione_rc: s.data_approvazione_rc as string || '',
          note: s.note as string || '',
          durc_valido: s.durc_valido as boolean || false,
          durc_scadenza: forn?.durc_scadenza,
        }
      })
      setSals(mapped)
      setForm(p => ({ ...p, numero: mapped.length + 1 }))
    }

    setLoading(false)
  }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function creaSal() {
    if (!form.fornitore_id || form.importo_lordo <= 0) return
    setSaving(true)
    const ritenute = form.importo_lordo * (form.ritenute_pct / 100)
    const ritenuta_fiscale = form.importo_lordo * (form.ritenuta_fiscale_pct / 100)
    const importo_netto = form.importo_lordo - ritenute - ritenuta_fiscale
    const forn = fornitori.find(f => f.id === form.fornitore_id)
    const durc = durcInfo(forn?.durc_scadenza)

    await supabase.from('sal').insert([{
      commessa_id: commessaId,
      tipo: 'PASSIVO',
      numero: form.numero,
      fornitore_id: form.fornitore_id,
      data_emissione: form.data_emissione,
      data_riferimento_da: null,
      data_riferimento_a: form.data_riferimento_a,
      importo_lavori: form.importo_lordo,
      importo_oneri: 0,
      totale_sal: form.importo_lordo,
      ritenute_garanzia: ritenute,
      ritenuta_fiscale: ritenuta_fiscale,
      anticipazione_da_recuperare: 0,
      importo_netto,
      stato: 'RICEVUTO',
      approvato_rc: false,
      durc_valido: durc.valido,
      note: form.note,
    }])

    setSaving(false)
    setShowNuovo(false)
    setForm({ ...FORM_INIZIALE })
    await carica()
  }

  async function cambiaStato(salId: string, stato: string, extra?: Record<string, unknown>) {
    await supabase.from('sal').update({ stato, ...extra }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato, ...extra } : s))
  }

  async function approvaRC(sal: SalPassivo) {
    const durc = durcInfo(sal.durc_scadenza)
    if (!durc.valido) {
      if (!confirm(`DURC non valido: ${durc.label}\nVuoi approvare comunque?`)) return
    }
    await cambiaStato(sal.id, 'APPROVATO_RC', {
      approvato_rc: true,
      data_approvazione_rc: new Date().toISOString().slice(0, 10)
    })
  }

  // KPI
  const totaleLordo = sals.reduce((s, x) => s + x.totale_sal, 0)
  const totaleNetto = sals.reduce((s, x) => s + x.importo_netto, 0)
  const totalePagato = sals.filter(x => x.stato === 'PAGATO').reduce((s, x) => s + x.importo_netto, 0)
  const daApprovare = sals.filter(x => ['RICEVUTO', 'IN_VERIFICA'].includes(x.stato)).length

  const fornitoreSel = fornitori.find(f => f.id === form.fornitore_id)
  const durcSel = durcInfo(fornitoreSel?.durc_scadenza)
  const nettoCalc = form.importo_lordo - (form.importo_lordo * form.ritenute_pct / 100) - (form.importo_lordo * form.ritenuta_fiscale_pct / 100)

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', color: '#1e293b', fontSize: 13 }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '22px 28px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>SAL Passivi → Subappaltatori</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
            {sals.length} SAL ricevuti
            {daApprovare > 0 && <span style={{ color: '#f59e0b', marginLeft: 8 }}>· ⚠ {daApprovare} da approvare</span>}
          </p>
        </div>
        <button onClick={() => setShowNuovo(true)} className="btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Registra SAL sub
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Totale lordo', val: `€ ${fmt(totaleLordo)}`, color: '#3b82f6' },
          { label: 'Totale netto', val: `€ ${fmt(totaleNetto)}`, color: '#8b5cf6' },
          { label: 'Pagato', val: `€ ${fmt(totalePagato)}`, color: '#10b981' },
          { label: 'Da pagare', val: `€ ${fmt(totaleNetto - totalePagato)}`, color: '#f59e0b' },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}`, padding: '10px 14px' }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : sals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 32px', background: 'var(--panel)', border: '2px dashed var(--border)', borderRadius: 16 }}>
          <FileText size={40} color="var(--t4)" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t2)', margin: '0 0 8px' }}>Nessun SAL sub registrato</h3>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>Registra i SAL ricevuti dai subappaltatori per gestire approvazioni e pagamenti</p>
          <button onClick={() => setShowNuovo(true)} className="btn-primary"><Plus size={14} /> Registra SAL sub</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sals.map(sal => {
            const color = STATO_COLOR[sal.stato] || '#6b7280'
            const durc = durcInfo(sal.durc_scadenza)
            const aperto = salAperto === sal.id
            return (
              <div key={sal.id} style={{ background: 'var(--panel)', border: `1px solid ${sal.stato === 'SOSPESO' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setSalAperto(aperto ? null : sal.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--t3)', display: 'flex' }}>
                    {aperto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>SAL {sal.numero}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 6, padding: '2px 8px' }}>
                        {STATO_LABEL[sal.stato] || sal.stato}
                      </span>
                      {!durc.valido && (
                        <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <AlertTriangle size={9} /> DURC {durc.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }} className="truncate">{sal.fornitore_nome}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>Al {sal.data_riferimento_a}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 2 }}>Lordo</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(sal.totale_sal)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 2 }}>Netto</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>€ {fmt(sal.importo_netto)}</div>
                    </div>

                    {/* Pulsanti azione */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {sal.stato === 'RICEVUTO' && (
                        <button onClick={() => cambiaStato(sal.id, 'IN_VERIFICA')}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer' }}>
                          🔍 Verifica
                        </button>
                      )}
                      {sal.stato === 'IN_VERIFICA' && (
                        <>
                          <button onClick={() => approvaRC(sal)}
                            style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Shield size={11} /> Approva RC
                          </button>
                          <button onClick={() => cambiaStato(sal.id, 'SOSPESO')}
                            style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, border: '1px solid #ef4444', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Ban size={11} /> Sospendi
                          </button>
                        </>
                      )}
                      {sal.stato === 'APPROVATO_RC' && (
                        <button onClick={() => cambiaStato(sal.id, 'PAGATO')}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer' }}>
                          € Pagato
                        </button>
                      )}
                      {sal.stato === 'SOSPESO' && (
                        <button onClick={() => cambiaStato(sal.id, 'IN_VERIFICA')}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, border: '1px solid #6b7280', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
                          ↩ Riapri
                        </button>
                      )}
                      {sal.stato === 'PAGATO' && (
                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={13} /> Pagato
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dettaglio espanso */}
                {aperto && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', background: 'var(--bg)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
                      {[
                        { label: 'Importo lordo', val: fmt(sal.totale_sal), color: '#3b82f6' },
                        { label: 'Ritenuta garanzia', val: fmt(sal.ritenute_garanzia), color: '#ef4444' },
                        { label: 'Ritenuta fiscale', val: fmt(sal.ritenuta_fiscale || 0), color: '#f59e0b' },
                        { label: 'Netto da pagare', val: fmt(sal.importo_netto), color: '#10b981' },
                      ].map((k, i) => (
                        <div key={i} style={{ background: 'var(--panel)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>€ {k.val}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {/* DURC */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: durc.valido ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${durc.valido ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 8, padding: '7px 12px', fontSize: 11, color: durc.valido ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {durc.valido ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                        DURC: {durc.label}
                      </div>
                      {/* Approvazione RC */}
                      {sal.approvato_rc && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '7px 12px', fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                          <Shield size={12} /> Approvato RC il {sal.data_approvazione_rc}
                        </div>
                      )}
                    </div>

                    {sal.note && (
                      <div style={{ marginTop: 10, background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--t2)' }}>
                        📝 {sal.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL NUOVO SAL PASSIVO */}
      {showNuovo && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Registra SAL Subappaltatore</h2>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>SAL N° {form.numero}</p>
              </div>
              <button onClick={() => setShowNuovo(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Subappaltatore / Fornitore *</label>
                <select value={form.fornitore_id} onChange={e => setF('fornitore_id', e.target.value)} style={{ ...inp, width: '100%' }}>
                  <option value="">— Seleziona fornitore —</option>
                  {fornitori.map(f => {
                    const d = durcInfo(f.durc_scadenza)
                    return <option key={f.id} value={f.id}>{f.ragione_sociale}{!d.valido ? ' ⚠ DURC' : ''}</option>
                  })}
                </select>
                {form.fornitore_id && (
                  <div style={{ marginTop: 6, background: durcSel.valido ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${durcSel.valido ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 7, padding: '7px 12px', fontSize: 11, color: durcSel.valido ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {durcSel.valido ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                    DURC: {durcSel.label}
                  </div>
                )}
              </div>

              <div>
                <label style={lbl}>N° SAL</label>
                <input type="number" value={form.numero} onChange={e => setF('numero', parseInt(e.target.value) || 1)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Data emissione</label>
                <input type="date" value={form.data_emissione} onChange={e => setF('data_emissione', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Al giorno</label>
                <input type="date" value={form.data_riferimento_a} onChange={e => setF('data_riferimento_a', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Importo lordo (€) *</label>
                <input type="number" min={0} step={0.01} value={form.importo_lordo || ''} onChange={e => setF('importo_lordo', parseFloat(e.target.value) || 0)} placeholder="0,00" style={{ ...inp, fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={lbl}>Ritenuta garanzia %</label>
                <input type="number" min={0} max={100} step={0.5} value={form.ritenute_pct} onChange={e => setF('ritenute_pct', parseFloat(e.target.value) || 0)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Ritenuta fiscale %</label>
                <input type="number" min={0} max={100} step={0.5} value={form.ritenuta_fiscale_pct} onChange={e => setF('ritenuta_fiscale_pct', parseFloat(e.target.value) || 0)} style={inp} />
              </div>

              {form.importo_lordo > 0 && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 9, padding: '12px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { l: 'Lordo', v: form.importo_lordo, c: '#3b82f6', neg: false },
                      { l: `Rit. gar. ${form.ritenute_pct}%`, v: form.importo_lordo * form.ritenute_pct / 100, c: '#ef4444', neg: true },
                      { l: `Rit. fisc. ${form.ritenuta_fiscale_pct}%`, v: form.importo_lordo * form.ritenuta_fiscale_pct / 100, c: '#f59e0b', neg: true },
                      { l: 'Netto', v: nettoCalc, c: '#10b981', neg: false },
                    ].map((k, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 9, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k.l}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: k.c, fontFamily: 'monospace' }}>
                          {k.neg ? '−' : ''}€ {fmt(k.v)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Note</label>
                <input value={form.note} onChange={e => setF('note', e.target.value)} placeholder="Prestazioni, periodo riferimento..." style={inp} />
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowNuovo(false)} className="btn-secondary">Annulla</button>
              <button onClick={creaSal} disabled={saving || !form.fornitore_id || form.importo_lordo <= 0} className="btn-primary">
                <Save size={14} /> {saving ? 'Salvataggio...' : 'Registra SAL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
