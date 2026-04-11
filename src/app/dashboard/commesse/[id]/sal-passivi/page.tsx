'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, FileText, CheckCircle, Clock, AlertTriangle, X, Save, Euro, ChevronDown, ChevronRight, Shield, Ban } from 'lucide-react'

interface SalPassivo {
  id: string
  numero: number
  fornitore_id: string
  fornitore_nome?: string
  data_emissione: string
  data_riferimento_a: string
  importo_lordo: number
  ritenute_garanzia: number
  ritenuta_fiscale: number
  importo_netto: number
  stato: string
  approvato_rc: boolean
  data_approvazione_rc: string
  durc_valido: boolean
  note: string
  contratto_id?: string
}

interface Fornitore {
  id: string
  ragione_sociale: string
  partita_iva: string
  durc_scadenza?: string
}

type StatoSalP = 'RICEVUTO' | 'IN_VERIFICA' | 'APPROVATO_RC' | 'SOSPESO' | 'PAGATO'

const STATO_CONFIG: Record<StatoSalP, { label: string; color: string; bg: string }> = {
  RICEVUTO:     { label: 'Ricevuto',      color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
  IN_VERIFICA:  { label: 'In verifica',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  APPROVATO_RC: { label: 'Approvato RC',  color: '#3b82f6', bg: 'rgba(59,130,246,0.08)'  },
  SOSPESO:      { label: 'Sospeso',       color: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
  PAGATO:       { label: 'Pagato',        color: '#10b981', bg: 'rgba(16,185,129,0.08)'  },
}

function fmt(n: number) {
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function durcStatus(scadenza?: string): { valido: boolean; label: string; color: string } {
  if (!scadenza) return { valido: false, label: 'Non disponibile', color: '#6b7280' }
  const gg = Math.ceil((new Date(scadenza).getTime() - Date.now()) / 86400000)
  if (gg < 0) return { valido: false, label: `Scaduto ${Math.abs(gg)}gg fa`, color: '#ef4444' }
  if (gg <= 30) return { valido: true, label: `Scade in ${gg}gg`, color: '#f59e0b' }
  return { valido: true, label: `Valido fino al ${scadenza}`, color: '#10b981' }
}

export default function SalPassiviPage() {
  const { id: commessaId } = useParams() as { id: string }

  const [sals, setSals] = useState<SalPassivo[]>([])
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuovo, setShowNuovo] = useState(false)
  const [salAperto, setSalAperto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fornitore_id: '',
    numero: 1,
    data_emissione: new Date().toISOString().slice(0, 10),
    data_riferimento_a: new Date().toISOString().slice(0, 10),
    importo_lordo: 0,
    ritenute_pct: 5,
    ritenuta_fiscale_pct: 0,
    note: '',
    durc_valido: true,
  })

  useEffect(() => { carica() }, [commessaId])

  async function carica() {
    setLoading(true)

    // Carica SAL passivi della commessa
    const { data: salData } = await supabase
      .from('sal')
      .select('*, fornitori(ragione_sociale, partita_iva, durc_scadenza)')
      .eq('commessa_id', commessaId)
      .eq('tipo', 'PASSIVO')
      .order('numero')

    if (salData) {
      const mapped = salData.map((s: Record<string, unknown>) => ({
        ...(s as object),
        fornitore_nome: (s.fornitori as Record<string, unknown>)?.ragione_sociale as string,
      })) as SalPassivo[]
      setSals(mapped)
      setForm(p => ({ ...p, numero: mapped.length + 1 }))
    }

    // Carica fornitori della commessa (da contratti)
    const { data: fornData } = await supabase
      .from('fornitori')
      .select('id, ragione_sociale, partita_iva, durc_scadenza')
      .order('ragione_sociale')

    if (fornData) setFornitori(fornData as Fornitore[])

    setLoading(false)
  }

  async function creaSalPassivo() {
    if (!form.fornitore_id || form.importo_lordo <= 0) return
    setSaving(true)

    const ritenute = form.importo_lordo * (form.ritenute_pct / 100)
    const ritenuta_fiscale = form.importo_lordo * (form.ritenuta_fiscale_pct / 100)
    const importo_netto = form.importo_lordo - ritenute - ritenuta_fiscale

    const { error } = await supabase.from('sal').insert([{
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
      importo_netto: importo_netto,
      stato: 'RICEVUTO',
      approvato_rc: false,
      durc_valido: form.durc_valido,
      note: form.note,
    }])

    setSaving(false)
    if (!error) {
      setShowNuovo(false)
      setForm(p => ({ ...p, numero: p.numero + 1, importo_lordo: 0, fornitore_id: '', note: '' }))
      await carica()
    }
  }

  async function approvaRC(salId: string) {
    const fornitore = fornitori.find(f => {
      const sal = sals.find(s => s.id === salId)
      return f.id === sal?.fornitore_id
    })
    const durc = durcStatus(fornitore?.durc_scadenza)

    if (!durc.valido) {
      if (!confirm(`⚠️ DURC del fornitore non valido (${durc.label}).\nVuoi approvare comunque?`)) return
    }

    await supabase.from('sal').update({
      stato: 'APPROVATO_RC',
      approvato_rc: true,
      data_approvazione_rc: new Date().toISOString().slice(0, 10),
    }).eq('id', salId)

    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato: 'APPROVATO_RC', approvato_rc: true } : s))
  }

  async function sospendi(salId: string) {
    await supabase.from('sal').update({ stato: 'SOSPESO' }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato: 'SOSPESO' } : s))
  }

  async function segnaComePagato(salId: string) {
    await supabase.from('sal').update({ stato: 'PAGATO' }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato: 'PAGATO' } : s))
  }

  async function mettInVerifica(salId: string) {
    await supabase.from('sal').update({ stato: 'IN_VERIFICA' }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato: 'IN_VERIFICA' } : s))
  }

  const totaleLordo = sals.reduce((s, sal) => s + (sal.importo_lordo || sal.totale_sal || 0), 0)
  const totaleNetto = sals.reduce((s, sal) => s + (sal.importo_netto || 0), 0)
  const totalePagato = sals.filter(s => s.stato === 'PAGATO').reduce((s, sal) => s + (sal.importo_netto || 0), 0)
  const inAttesa = sals.filter(s => ['RICEVUTO', 'IN_VERIFICA'].includes(s.stato)).length
  const durcScaduti = fornitori.filter(f => !durcStatus(f.durc_scadenza).valido).length

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', color: '#1e293b', fontSize: 13 }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  const fornitoreSel = fornitori.find(f => f.id === form.fornitore_id)
  const durcFornitoreSel = durcStatus(fornitoreSel?.durc_scadenza)

  return (
    <div style={{ padding: '22px 28px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>SAL Passivi → Subappaltatori</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
            {sals.length} SAL ricevuti · Da approvare: <strong style={{ color: inAttesa > 0 ? '#f59e0b' : 'inherit' }}>{inAttesa}</strong>
            {durcScaduti > 0 && <span style={{ color: '#ef4444', marginLeft: 10 }}>⚠ {durcScaduti} DURC scaduti</span>}
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
          { label: 'Da pagare', val: `€ ${fmt(totaleNetto - totalePagato)}`, color: inAttesa > 0 ? '#f59e0b' : '#6b7280' },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}`, padding: '10px 14px' }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Lista SAL passivi */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : sals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 32px', background: 'var(--panel)', border: '2px dashed var(--border)', borderRadius: 16 }}>
          <FileText size={40} color="var(--t4)" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t2)', margin: '0 0 8px' }}>Nessun SAL sub registrato</h3>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>Registra i SAL ricevuti dai subappaltatori per approvarli e gestire i pagamenti</p>
          <button onClick={() => setShowNuovo(true)} className="btn-primary"><Plus size={14} /> Registra SAL sub</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sals.map(sal => {
            const cfg = STATO_CONFIG[sal.stato as StatoSalP] || STATO_CONFIG.RICEVUTO
            const forn = fornitori.find(f => f.id === sal.fornitore_id)
            const durc = durcStatus(forn?.durc_scadenza)
            const aperto = salAperto === sal.id

            return (
              <div key={sal.id} style={{ background: 'var(--panel)', border: `1px solid ${sal.stato === 'SOSPESO' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden' }}>

                {/* Header SAL */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setSalAperto(aperto ? null : sal.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--t3)', display: 'flex' }}>
                    {aperto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>SAL {sal.numero}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 6, padding: '2px 8px' }}>{cfg.label}</span>
                      {!durc.valido && (
                        <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <AlertTriangle size={9} /> DURC {durc.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }} className="truncate">
                      {sal.fornitore_nome || 'Fornitore non trovato'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>Riferito al: {sal.data_riferimento_a}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 2 }}>Lordo</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(sal.importo_lordo || sal.totale_sal)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 2 }}>Netto</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>€ {fmt(sal.importo_netto)}</div>
                    </div>

                    {/* Pulsanti azione */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {sal.stato === 'RICEVUTO' && (
                        <button onClick={() => mettInVerifica(sal.id)}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer' }}>
                          🔍 Verifica
                        </button>
                      )}
                      {sal.stato === 'IN_VERIFICA' && (
                        <>
                          <button onClick={() => approvaRC(sal.id)}
                            style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Shield size={11} /> Approva RC
                          </button>
                          <button onClick={() => sospendi(sal.id)}
                            style={{ fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 7, border: '1px solid #ef4444', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Ban size={11} /> Sospendi
                          </button>
                        </>
                      )}
                      {sal.stato === 'APPROVATO_RC' && (
                        <button onClick={() => segnaComePagato(sal.id)}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer' }}>
                          € Pagato
                        </button>
                      )}
                      {sal.stato === 'SOSPESO' && (
                        <button onClick={() => mettInVerifica(sal.id)}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
                      {[
                        { label: 'Importo lordo', val: sal.importo_lordo || sal.totale_sal, color: '#3b82f6' },
                        { label: 'Ritenuta garanzia', val: sal.ritenute_garanzia, color: '#ef4444' },
                        { label: 'Ritenuta fiscale', val: sal.ritenuta_fiscale || 0, color: '#f59e0b' },
                        { label: 'Netto da pagare', val: sal.importo_netto, color: '#10b981' },
                        { label: 'DURC fornitore', val: null, color: durc.valido ? '#10b981' : '#ef4444', durcLabel: durc.label },
                      ].map((k, i) => (
                        <div key={i} style={{ background: 'var(--panel)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                          {k.val !== null ? (
                            <div style={{ fontSize: 14, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>€ {fmt(k.val as number)}</div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {durc.valido ? <CheckCircle size={13} color="#10b981" /> : <AlertTriangle size={13} color="#ef4444" />}
                              <span style={{ fontSize: 11, fontWeight: 600, color: k.color }}>{k.durcLabel}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Info approvazione */}
                    {sal.approvato_rc && (
                      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Shield size={13} /> Approvato dal RC il {sal.data_approvazione_rc}
                      </div>
                    )}

                    {sal.note && (
                      <div style={{ background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--t2)' }}>
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
          <div className="modal-box" style={{ maxWidth: 580 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Registra SAL Subappaltatore</h2>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>SAL N° {form.numero} ricevuto da subappaltatore/fornitore</p>
              </div>
              <button onClick={() => setShowNuovo(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Subappaltatore / Fornitore *</label>
                <select value={form.fornitore_id} onChange={e => setForm(p => ({ ...p, fornitore_id: e.target.value }))} style={{ ...inp, width: '100%' }}>
                  <option value="">— Seleziona fornitore —</option>
                  {fornitori.map(f => {
                    const d = durcStatus(f.durc_scadenza)
                    return <option key={f.id} value={f.id}>{f.ragione_sociale} {!d.valido ? '⚠ DURC' : ''}</option>
                  })}
                </select>
                {/* Alert DURC fornitore selezionato */}
                {form.fornitore_id && !durcFornitoreSel.valido && (
                  <div style={{ marginTop: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '8px 12px', fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={12} /> DURC {durcFornitoreSel.label} — il pagamento potrebbe essere bloccato
                  </div>
                )}
                {form.fornitore_id && durcFornitoreSel.valido && (
                  <div style={{ marginTop: 6, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 7, padding: '6px 12px', fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={11} /> {durcFornitoreSel.label}
                  </div>
                )}
              </div>

              <div>
                <label style={lbl}>N° SAL</label>
                <input type="number" value={form.numero} onChange={e => setForm(p => ({ ...p, numero: parseInt(e.target.value) || 1 }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Data emissione</label>
                <input type="date" value={form.data_emissione} onChange={e => setForm(p => ({ ...p, data_emissione: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Al giorno</label>
                <input type="date" value={form.data_riferimento_a} onChange={e => setForm(p => ({ ...p, data_riferimento_a: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Importo lordo (€) *</label>
                <input type="number" min={0} step={0.01} value={form.importo_lordo || ''} onChange={e => setForm(p => ({ ...p, importo_lordo: parseFloat(e.target.value) || 0 }))} placeholder="0,00" style={{ ...inp, fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={lbl}>Ritenuta garanzia %</label>
                <input type="number" min={0} max={100} step={0.5} value={form.ritenute_pct} onChange={e => setForm(p => ({ ...p, ritenute_pct: parseFloat(e.target.value) || 0 }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Ritenuta fiscale % (se appl.)</label>
                <input type="number" min={0} max={100} step={0.5} value={form.ritenuta_fiscale_pct} onChange={e => setForm(p => ({ ...p, ritenuta_fiscale_pct: parseFloat(e.target.value) || 0 }))} style={inp} />
              </div>

              {/* Calcolo netto automatico */}
              {form.importo_lordo > 0 && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 9, padding: '12px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { l: 'Lordo', v: form.importo_lordo, c: '#3b82f6' },
                      { l: `Ritenuta ${form.ritenute_pct}%`, v: -(form.importo_lordo * form.ritenute_pct / 100), c: '#ef4444' },
                      { l: `Rit. fiscale ${form.ritenuta_fiscale_pct}%`, v: -(form.importo_lordo * form.ritenuta_fiscale_pct / 100), c: '#f59e0b' },
                      { l: 'Netto da pagare', v: form.importo_lordo - (form.importo_lordo * form.ritenute_pct / 100) - (form.importo_lordo * form.ritenuta_fiscale_pct / 100), c: '#10b981' },
                    ].map((k, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 9, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k.l}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: k.c, fontFamily: 'monospace' }}>
                          {k.v < 0 ? '−' : ''}€ {fmt(Math.abs(k.v))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Note</label>
                <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Descrizione prestazioni, periodo riferimento..." style={inp} />
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowNuovo(false)} className="btn-secondary">Annulla</button>
              <button onClick={creaSalPassivo} disabled={saving || !form.fornitore_id || form.importo_lordo <= 0} className="btn-primary">
                <Save size={14} /> {saving ? 'Salvataggio...' : 'Registra SAL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
