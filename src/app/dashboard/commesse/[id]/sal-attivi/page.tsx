'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, FileText, CheckCircle, Clock, AlertTriangle, X, Save, Euro, ChevronDown, ChevronRight, Send } from 'lucide-react'

// ─── TIPI ────────────────────────────────────────────────────────────────────

interface Sal {
  id: string
  numero: number
  data_emissione: string
  data_riferimento_da: string
  data_riferimento_a: string
  importo_lavori: number
  importo_oneri: number
  totale_sal: number
  ritenute_garanzia: number
  anticipazione_da_recuperare: number
  importo_netto: number
  stato: string
  note: string
  approvato_dl: boolean
  data_approvazione_dl: string
  numero_fattura: string
  data_fattura: string
}

interface VoceComputo {
  id: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  capitolo: string
}

interface VoceSal {
  id: string
  voce_computo_id: string
  quantita_sal: number
  importo_sal: number
  quantita_precedente: number
  importo_precedente: number
  quantita_totale: number
  importo_totale: number
  pct_avanzamento: number
  descrizione?: string
  um?: string
  prezzo_unitario?: number
  codice?: string
}

type StatoSal = 'BOZZA' | 'EMESSO' | 'APPROVATO_DL' | 'FATTURATO' | 'PAGATO'

const STATO_CONFIG: Record<StatoSal, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  BOZZA:        { label: 'Bozza',         color: '#6b7280', bg: 'rgba(107,114,128,0.08)', icon: <Clock size={12} /> },
  EMESSO:       { label: 'Emesso',        color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: <Send size={12} /> },
  APPROVATO_DL: { label: 'Approvato DL',  color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  icon: <CheckCircle size={12} /> },
  FATTURATO:    { label: 'Fatturato',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  icon: <FileText size={12} /> },
  PAGATO:       { label: 'Pagato',        color: '#10b981', bg: 'rgba(16,185,129,0.08)',  icon: <Euro size={12} /> },
}

function fmt(n: number) {
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FORM_SAL_VUOTO = {
  numero: 1,
  data_emissione: new Date().toISOString().slice(0, 10),
  data_riferimento_da: '',
  data_riferimento_a: new Date().toISOString().slice(0, 10),
  note: '',
  ritenute_pct: 5,
  anticipazione_da_recuperare: 0,
}

// ─── COMPONENTE PRINCIPALE ───────────────────────────────────────────────────

export default function SalAttiviPage() {
  const { id: commessaId } = useParams() as { id: string }

  const [sals, setSals] = useState<Sal[]>([])
  const [vociComputo, setVociComputo] = useState<VoceComputo[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuovoSal, setShowNuovoSal] = useState(false)
  const [salAperto, setSalAperto] = useState<string | null>(null)
  const [vociSal, setVociSal] = useState<Record<string, VoceSal[]>>({})
  const [form, setForm] = useState({ ...FORM_SAL_VUOTO })
  const [saving, setSaving] = useState(false)
  const [misure, setMisure] = useState<Record<string, number>>({})

  useEffect(() => { carica() }, [commessaId])

  async function carica() {
    setLoading(true)

    // Carica SAL esistenti
    const { data: salData } = await supabase
      .from('sal')
      .select('*')
      .eq('commessa_id', commessaId)
      .eq('tipo', 'ATTIVO')
      .order('numero')

    if (salData) setSals(salData as Sal[])

    // Carica voci computo per la misurazione
    const { data: compData } = await supabase
      .from('computo_metrico')
      .select('id')
      .eq('commessa_id', commessaId)
      .eq('tipo_uso', 'AGGIUDICATA')
      .single()

    if (compData) {
      const { data: voci } = await supabase
        .from('voci_computo')
        .select('*')
        .eq('computo_id', compData.id)
        .order('capitolo')
      if (voci) setVociComputo(voci as VoceComputo[])
    }

    // Numero prossimo SAL
    const prossimo = (salData?.length || 0) + 1
    setForm(p => ({ ...p, numero: prossimo }))

    setLoading(false)
  }

  async function caricaVociSal(salId: string) {
    if (vociSal[salId]) return // già caricate
    const { data } = await supabase
      .from('voci_sal')
      .select('*, voci_computo(codice, descrizione, um, prezzo_unitario)')
      .eq('sal_id', salId)
    if (data) {
      const voci = data.map((v: Record<string, unknown>) => ({
        ...(v as object),
        codice: (v.voci_computo as Record<string, unknown>)?.codice,
        descrizione: (v.voci_computo as Record<string, unknown>)?.descrizione,
        um: (v.voci_computo as Record<string, unknown>)?.um,
        prezzo_unitario: (v.voci_computo as Record<string, unknown>)?.prezzo_unitario,
      })) as VoceSal[]
      setVociSal(p => ({ ...p, [salId]: voci }))
    }
  }

  async function creaSal() {
    if (!form.data_riferimento_a) return
    setSaving(true)

    // Calcola importo dalle misure
    let importoLavori = 0
    const vociDaInserire: Record<string, unknown>[] = []

    for (const [voceId, qtaSal] of Object.entries(misure)) {
      if (!qtaSal || qtaSal <= 0) continue
      const voce = vociComputo.find(v => v.id === voceId)
      if (!voce) continue
      const importoVoceSal = qtaSal * voce.prezzo_unitario
      importoLavori += importoVoceSal
      vociDaInserire.push({
        voce_computo_id: voceId,
        quantita_sal: qtaSal,
        importo_sal: importoVoceSal,
        quantita_precedente: 0,
        importo_precedente: 0,
        quantita_totale: qtaSal,
        importo_totale: importoVoceSal,
        pct_avanzamento: voce.quantita > 0 ? Math.min(100, (qtaSal / voce.quantita) * 100) : 0,
      })
    }

    const ritenute = importoLavori * (form.ritenute_pct / 100)
    const importoNetto = importoLavori - ritenute - form.anticipazione_da_recuperare

    const { data: newSal, error } = await supabase
      .from('sal')
      .insert([{
        commessa_id: commessaId,
        tipo: 'ATTIVO',
        numero: form.numero,
        data_emissione: form.data_emissione,
        data_riferimento_da: form.data_riferimento_da || null,
        data_riferimento_a: form.data_riferimento_a,
        importo_lavori: importoLavori,
        importo_oneri: 0,
        totale_sal: importoLavori,
        ritenute_garanzia: ritenute,
        anticipazione_da_recuperare: form.anticipazione_da_recuperare,
        importo_netto: importoNetto,
        stato: 'BOZZA',
        note: form.note,
        approvato_dl: false,
      }])
      .select().single()

    if (newSal && vociDaInserire.length > 0) {
      const vociConSal = vociDaInserire.map(v => ({ ...v, sal_id: newSal.id }))
      await supabase.from('voci_sal').insert(vociConSal)
    }

    setSaving(false)
    if (!error) {
      setShowNuovoSal(false)
      setMisure({})
      setForm({ ...FORM_SAL_VUOTO, numero: form.numero + 1 })
      await carica()
    }
  }

  async function cambiaStato(salId: string, nuovoStato: StatoSal) {
    await supabase.from('sal').update({ stato: nuovoStato }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato: nuovoStato } : s))
  }

  async function approvaDL(salId: string) {
    await supabase.from('sal').update({
      stato: 'APPROVATO_DL',
      approvato_dl: true,
      data_approvazione_dl: new Date().toISOString().slice(0, 10)
    }).eq('id', salId)
    setSals(prev => prev.map(s => s.id === salId ? { ...s, stato: 'APPROVATO_DL', approvato_dl: true } : s))
  }

  const totaleSals = sals.filter(s => s.stato !== 'BOZZA').reduce((sum, s) => sum + (s.totale_sal || 0), 0)
  const totalePagato = sals.filter(s => s.stato === 'PAGATO').reduce((sum, s) => sum + (s.importo_netto || 0), 0)
  const capitoli = [...new Set(vociComputo.map(v => v.capitolo || 'Generale'))]

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', color: '#1e293b', fontSize: 13 }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '22px 28px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>SAL Attivi → Committente</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
            {sals.length} SAL emessi · Certificato: <strong>€ {fmt(totaleSals)}</strong> · Incassato: <strong>€ {fmt(totalePagato)}</strong>
          </p>
        </div>
        <button onClick={() => setShowNuovoSal(true)} className="btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Nuovo SAL
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'SAL emessi', val: String(sals.filter(s => ['EMESSO','APPROVATO_DL','FATTURATO','PAGATO'].includes(s.stato)).length), color: '#f59e0b' },
          { label: 'Certificato', val: `€ ${fmt(totaleSals)}`, color: '#3b82f6' },
          { label: 'Incassato', val: `€ ${fmt(totalePagato)}`, color: '#10b981' },
          { label: 'Da incassare', val: `€ ${fmt(totaleSals - totalePagato)}`, color: '#8b5cf6' },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}`, padding: '10px 14px' }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Lista SAL */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : sals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 32px', background: 'var(--panel)', border: '2px dashed var(--border)', borderRadius: 16 }}>
          <FileText size={40} color="var(--t4)" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t2)', margin: '0 0 8px' }}>Nessun SAL ancora emesso</h3>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>Crea il primo SAL inserendo le quantità eseguite per ogni voce del computo</p>
          <button onClick={() => setShowNuovoSal(true)} className="btn-primary"><Plus size={14} /> Crea primo SAL</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sals.map(sal => {
            const cfg = STATO_CONFIG[sal.stato as StatoSal] || STATO_CONFIG.BOZZA
            const aperto = salAperto === sal.id
            return (
              <div key={sal.id} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Header SAL */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => {
                    setSalAperto(aperto ? null : sal.id)
                    if (!aperto) caricaVociSal(sal.id)
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--t3)', display: 'flex' }}>
                    {aperto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>SAL {sal.numero}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 6, padding: '3px 8px' }}>
                      {cfg.icon}{cfg.label}
                    </span>
                  </div>

                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 2 }}>Totale SAL</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(sal.totale_sal)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 2 }}>Netto da pagare</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>€ {fmt(sal.importo_netto)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 2 }}>Riferimento</div>
                      <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{sal.data_riferimento_a}</div>
                    </div>

                    {/* Azioni stato */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {sal.stato === 'BOZZA' && (
                        <button onClick={() => cambiaStato(sal.id, 'EMESSO')}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer' }}>
                          Emetti →
                        </button>
                      )}
                      {sal.stato === 'EMESSO' && (
                        <button onClick={() => approvaDL(sal.id)}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer' }}>
                          ✓ Appr. DL
                        </button>
                      )}
                      {sal.stato === 'APPROVATO_DL' && (
                        <button onClick={() => cambiaStato(sal.id, 'FATTURATO')}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', background: '#8b5cf6', color: 'white', cursor: 'pointer' }}>
                          📄 Fattura
                        </button>
                      )}
                      {sal.stato === 'FATTURATO' && (
                        <button onClick={() => cambiaStato(sal.id, 'PAGATO')}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer' }}>
                          € Pagato
                        </button>
                      )}
                      {sal.stato === 'PAGATO' && (
                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={13} /> Incassato
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dettaglio SAL espanso */}
                {aperto && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', background: 'var(--bg)' }}>
                    {/* Riepilogo economico */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
                      {[
                        { label: 'Importo lavori', val: sal.importo_lavori, color: '#3b82f6' },
                        { label: 'Importo oneri', val: sal.importo_oneri, color: '#8b5cf6' },
                        { label: 'Ritenute garanzia', val: sal.ritenute_garanzia, color: '#ef4444' },
                        { label: 'Recupero anticipo', val: sal.anticipazione_da_recuperare, color: '#f59e0b' },
                        { label: 'Netto liquidare', val: sal.importo_netto, color: '#10b981' },
                      ].map((k, i) => (
                        <div key={i} style={{ background: 'var(--panel)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>€ {fmt(k.val)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Voci SAL */}
                    {vociSal[sal.id] && vociSal[sal.id].length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
                              {['Codice', 'Descrizione', 'U.M.', 'Q.tà SAL', 'P.U.', 'Importo SAL', 'Avanz.%'].map(h => (
                                <th key={h} style={{ padding: '8px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {vociSal[sal.id].map((v, i) => (
                              <tr key={v.id} style={{ borderBottom: i < vociSal[sal.id].length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--t3)' }}>{v.codice || '—'}</td>
                                <td style={{ padding: '8px 10px', color: 'var(--t1)', maxWidth: 260 }}>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.descrizione}</div>
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--t3)' }}>{v.um}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>{(v.quantita_sal || 0).toFixed(3)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>€ {fmt(v.prezzo_unitario || 0)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--t1)' }}>€ {fmt(v.importo_sal)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.min(100, v.pct_avanzamento || 0)}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600, width: 32, textAlign: 'right' }}>{(v.pct_avanzamento || 0).toFixed(0)}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {sal.note && (
                      <div style={{ marginTop: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--t2)' }}>
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

      {/* MODAL NUOVO SAL */}
      {showNuovoSal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 760 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Nuovo SAL Attivo N° {form.numero}</h2>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Stato avanzamento lavori verso il committente</p>
              </div>
              <button onClick={() => { setShowNuovoSal(false); setMisure({}) }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>

            {/* Dati generali */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
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
                <label style={lbl}>Ritenute garanzia %</label>
                <input type="number" min={0} max={100} step={0.5} value={form.ritenute_pct} onChange={e => setForm(p => ({ ...p, ritenute_pct: parseFloat(e.target.value) || 0 }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Recupero anticipo (€)</label>
                <input type="number" min={0} step={0.01} value={form.anticipazione_da_recuperare} onChange={e => setForm(p => ({ ...p, anticipazione_da_recuperare: parseFloat(e.target.value) || 0 }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Note</label>
                <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Note SAL..." style={inp} />
              </div>
            </div>

            {/* Misurazione voci */}
            {vociComputo.length > 0 ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📐 Misure SAL per voce di computo
                  <span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>— inserisci le quantità eseguite in questo SAL</span>
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  {capitoli.map(cap => {
                    const vociCap = vociComputo.filter(v => (v.capitolo || 'Generale') === cap)
                    return (
                      <div key={cap}>
                        <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {cap}
                        </div>
                        {vociCap.map((voce, idx) => {
                          const qta = misure[voce.id] || 0
                          const importoVoce = qta * voce.prezzo_unitario
                          return (
                            <div key={voce.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 100px auto 110px', gap: 10, alignItems: 'center', padding: '8px 14px', borderBottom: idx < vociCap.length - 1 ? '1px solid #f1f5f9' : 'none', background: qta > 0 ? 'rgba(59,130,246,0.03)' : 'white' }}>
                              <div>
                                <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{voce.codice}</div>
                                <div style={{ fontSize: 11, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voce.descrizione}</div>
                              </div>
                              <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{voce.um}</span>
                              <input
                                type="number" min={0} step={0.001}
                                value={qta || ''}
                                onChange={e => setMisure(p => ({ ...p, [voce.id]: parseFloat(e.target.value) || 0 }))}
                                placeholder="0.000"
                                style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, textAlign: 'right', fontFamily: 'monospace', background: qta > 0 ? 'white' : '#f8fafc', color: '#1e293b', width: '100%', boxSizing: 'border-box' }}
                              />
                              <span style={{ fontSize: 10, color: '#64748b' }}>× € {fmt(voce.prezzo_unitario)}</span>
                              <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: qta > 0 ? 700 : 400, color: qta > 0 ? '#3b82f6' : '#94a3b8', textAlign: 'right' }}>
                                {qta > 0 ? `€ ${fmt(importoVoce)}` : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* Totale misure */}
                {Object.values(misure).some(v => v > 0) && (
                  <div style={{ marginTop: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 9, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Totale importo lavori</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace' }}>
                        € {fmt(Object.entries(misure).reduce((sum, [id, qta]) => {
                          const voce = vociComputo.find(v => v.id === id)
                          return sum + (qta * (voce?.prezzo_unitario || 0))
                        }, 0))}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#1e40af' }}>
                      <span>– Ritenute {form.ritenute_pct}%: € {fmt(Object.entries(misure).reduce((sum, [id, qta]) => { const v = vociComputo.find(x => x.id === id); return sum + (qta * (v?.prezzo_unitario || 0)) }, 0) * form.ritenute_pct / 100)}</span>
                      {form.anticipazione_da_recuperare > 0 && <span>– Recupero anticipo: € {fmt(form.anticipazione_da_recuperare)}</span>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px 16px', fontSize: 12, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={15} />
                Nessuna voce di computo trovata. Prima inserisci il computo metrico nel tab Computo.
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowNuovoSal(false); setMisure({}) }} className="btn-secondary">Annulla</button>
              <button onClick={creaSal} disabled={saving} className="btn-primary">
                <Save size={14} /> {saving ? 'Creazione...' : 'Crea SAL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
