'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileText, Plus, Loader2, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight, Shield } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const STATI: Record<string, { label: string; color: string; bg: string }> = {
  BOZZA:      { label: 'Bozza',          color: '#6b7280', bg: '#f3f4f6' },
  IN_FIRMA:   { label: 'In firma',        color: '#d97706', bg: '#fffbeb' },
  ATTIVO:     { label: 'Attivo',          color: '#059669', bg: '#f0fdf4' },
  SOSPESO:    { label: 'Sospeso',         color: '#dc2626', bg: '#fef2f2' },
  RISOLTO:    { label: 'Risolto',         color: '#7c3aed', bg: '#f5f3ff' },
  CONCLUSO:   { label: 'Concluso',        color: '#0369a1', bg: '#eff6ff' },
}

export default function ContrattiPage() {
  const { id } = useParams() as { id: string }
  const [contratti, setContratti] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    fornitore_id: '', importo_netto: '', ritenuta_pct: '5',
    data_stipula: '', data_inizio: '', data_fine_prevista: '',
    oggetto: '', note: '',
    durc_ok: false, antimafia_ok: false, notifica_sa_ok: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from('contratti_sub')
        .select('*, fornitore:fornitori(ragione_sociale, piva, codice_fiscale)')
        .eq('commessa_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('fornitori').select('id, ragione_sociale').order('ragione_sociale'),
    ])
    setContratti(c || [])
    setFornitori(f || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.fornitore_id || !form.importo_netto || !form.oggetto) {
      setErr('Fornitore, oggetto e importo sono obbligatori'); return
    }
    setSaving(true)
    const { count } = await supabase.from('contratti_sub')
      .select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = 'CS-' + new Date().getFullYear() + '-' + String((count || 0) + 1).padStart(3, '0')
    const importo = parseFloat(form.importo_netto)
    const ritenuta_pct = parseFloat(form.ritenuta_pct) || 5
    const { error } = await supabase.from('contratti_sub').insert({
      commessa_id: id,
      numero,
      fornitore_id: form.fornitore_id,
      importo_netto: importo,
      ritenuta_pct,
      stato: 'BOZZA',
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false)
    setShowForm(false)
    setForm({ fornitore_id: '', importo_netto: '', ritenuta_pct: '5', data_stipula: '', data_inizio: '', data_fine_prevista: '', oggetto: '', note: '', durc_ok: false, antimafia_ok: false, notifica_sa_ok: false })
    await load()
  }

  async function cambiaStato(cid: string, stato: string) {
    await supabase.from('contratti_sub').update({ stato }).eq('id', cid)
    await load()
  }

  const totAttivi    = contratti.filter(c => c.stato === 'ATTIVO').reduce((s, c) => s + (c.importo_netto || 0), 0)
  const totRitenute  = contratti.filter(c => c.stato === 'ATTIVO').reduce((s, c) => s + (c.importo_netto || 0) * (c.ritenuta_pct || 5) / 100, 0)
  const nAttivi      = contratti.filter(c => c.stato === 'ATTIVO').length
  const nScadentiDurc = contratti.filter(c => {
    if (!c.durc_scadenza) return false
    const diff = (new Date(c.durc_scadenza).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff < 30
  }).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { l: 'Contratti attivi', v: String(nAttivi) },
          { l: 'Valore impegnato', v: 'EUR ' + fmt(totAttivi) },
          { l: 'Ritenute accumulate', v: 'EUR ' + fmt(totRitenute), warn: totRitenute > 0 },
          { l: 'DURC in scadenza', v: String(nScadentiDurc), warn: nScadentiDurc > 0 },
        ].map((k, i) => (
          <div key={i} style={{ background: k.warn ? '#fffbeb' : '#f9fafb', border: '1px solid ' + (k.warn ? '#fde68a' : '#e5e7eb'), borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{k.l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: k.warn ? '#d97706' : '#111' }}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Alert DURC */}
      {nScadentiDurc > 0 && (
        <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <div><strong>Attenzione:</strong> {nScadentiDurc} contratto/i con DURC in scadenza entro 30 giorni. Rinnovare prima della prossima fattura.</div>
        </div>
      )}

      {/* Banner D.Lgs. 36/2023 */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 11, color: '#1e40af' }}>
        <Shield size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span><strong>D.Lgs. 36/2023 art. 119:</strong> Il contratto di subappalto deve essere trasmesso alla Stazione Appaltante almeno 5 giorni prima dell inizio dei lavori. Ritenuta 5% a garanzia svincolata a collaudo (art. 11 D.Lgs. 36/2023). DURC obbligatorio per tutta la durata del contratto.</span>
      </div>

      {/* Header lista */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Contratti di Subappalto</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{contratti.length} contratto/i • D.Lgs. 36/2023</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={14} /> Nuovo contratto
        </button>
      </div>

      {/* Lista contratti */}
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
            <Loader2 size={16} className="animate-spin" /> Caricamento...
          </div>
        : contratti.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af' }}>
            <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, margin: 0 }}>Nessun contratto di subappalto</p>
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>I contratti si generano automaticamente dagli ODA di tipo Subappalto</p>
          </div>
        : contratti.map(c => {
            const si = STATI[c.stato] || STATI.BOZZA
            const forn = c.fornitore
            const ritenuta = (c.importo_netto || 0) * (c.ritenuta_pct || 5) / 100
            const netto_pagabile = (c.importo_netto || 0) - ritenuta
            const isExp = expanded === c.id

            const durcDays = c.durc_scadenza
              ? Math.floor((new Date(c.durc_scadenza).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null

            return (
              <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isExp ? null : c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
                  {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af' }} /> : <ChevronRight size={14} style={{ color: '#9ca3af' }} />}
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', flexShrink: 0, width: 100 }}>{c.numero || '—'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{forn?.ragione_sociale || '—'}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                      P.IVA: {forn?.piva || '—'} • Ritenuta {fmtPct(c.ritenuta_pct || 5)}%
                    </p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, width: 130, textAlign: 'right', flexShrink: 0 }}>EUR {fmt(c.importo_netto)}</span>
                  {durcDays !== null && durcDays < 30 && (
                    <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 10, flexShrink: 0 }}>
                      DURC {durcDays < 0 ? 'SCADUTO' : durcDays + 'gg'}
                    </span>
                  )}
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600, flexShrink: 0, background: si.bg, color: si.color }}>{si.label}</span>
                </div>

                {isExp && (
                  <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: 16 }}>
                    {/* Dettaglio economico */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
                      {[
                        ['Importo netto contratto', 'EUR ' + fmt(c.importo_netto)],
                        ['Ritenuta ' + fmtPct(c.ritenuta_pct || 5) + '% (svinco a collaudo)', '- EUR ' + fmt(ritenuta)],
                        ['Da pagare effettivo', 'EUR ' + fmt(netto_pagabile)],
                      ].map(([l, v], i) => (
                        <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
                          <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase' }}>{l}</p>
                          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: i === 1 ? '#7c3aed' : '#111' }}>{v}</p>
                        </div>
                      ))}
                    </div>

                    {/* Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                      {[
                        ['Stipula', c.data_stipula],
                        ['Inizio lavori', c.data_inizio],
                        ['Fine prevista', c.data_fine_prevista],
                        ['DURC scadenza', c.durc_scadenza],
                      ].map(([l, v]) => (
                        <div key={String(l)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px' }}>
                          <p style={{ fontSize: 9, color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase' }}>{l}</p>
                          <p style={{ fontSize: 11, margin: 0 }}>{String(v) || '—'}</p>
                        </div>
                      ))}
                    </div>

                    {/* Checklist compliance */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      {[
                        { label: 'DURC in corso validita', ok: !!c.durc_ok },
                        { label: 'Antimafia dichiarata', ok: !!c.antimafia_ok },
                        { label: 'Notifica SA eseguita', ok: !!c.notifica_sa_ok },
                        { label: 'POS coordinato', ok: !!c.pos_ok },
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 16,
                          background: item.ok ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (item.ok ? '#bbf7d0' : '#fecaca') }}>
                          {item.ok
                            ? <CheckCircle2 size={12} style={{ color: '#059669' }} />
                            : <AlertTriangle size={12} style={{ color: '#dc2626' }} />}
                          <span style={{ fontSize: 11, color: item.ok ? '#065f46' : '#991b1b' }}>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Cambio stato */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Avanza stato:</span>
                      {c.stato === 'BOZZA' && (
                        <button onClick={() => cambiaStato(c.id, 'IN_FIRMA')}
                          style={{ fontSize: 11, padding: '4px 12px', border: '1px solid #fde68a', borderRadius: 6, background: '#fffbeb', color: '#92400e', cursor: 'pointer' }}>
                          Invia per firma
                        </button>
                      )}
                      {c.stato === 'IN_FIRMA' && (
                        <button onClick={() => cambiaStato(c.id, 'ATTIVO')}
                          style={{ fontSize: 11, padding: '4px 12px', border: '1px solid #bbf7d0', borderRadius: 6, background: '#f0fdf4', color: '#065f46', cursor: 'pointer' }}>
                          Firmato — Attiva
                        </button>
                      )}
                      {c.stato === 'ATTIVO' && (
                        <>
                          <button onClick={() => cambiaStato(c.id, 'SOSPESO')}
                            style={{ fontSize: 11, padding: '4px 12px', border: '1px solid #fecaca', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                            Sospendi
                          </button>
                          <button onClick={() => cambiaStato(c.id, 'CONCLUSO')}
                            style={{ fontSize: 11, padding: '4px 12px', border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff', color: '#1e40af', cursor: 'pointer' }}>
                            Concludi
                          </button>
                        </>
                      )}
                      {c.stato === 'SOSPESO' && (
                        <button onClick={() => cambiaStato(c.id, 'ATTIVO')}
                          style={{ fontSize: 11, padding: '4px 12px', border: '1px solid #bbf7d0', borderRadius: 6, background: '#f0fdf4', color: '#065f46', cursor: 'pointer' }}>
                          Riattiva
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
      }

      {/* Modal nuovo contratto */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px' }}>Nuovo Contratto di Subappalto</h2>
            <div style={{ fontSize: 11, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, marginBottom: 16, color: '#1e40af' }}>
              I contratti si generano automaticamente quando si crea un ODA di tipo Subappalto. Puoi anche crearli manualmente qui.
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Subappaltatore *</label>
              <select value={form.fornitore_id} onChange={e => setForm(f => ({...f, fornitore_id: e.target.value}))}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                <option value="">Seleziona...</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto del contratto *</label>
              <input value={form.oggetto} onChange={e => setForm(f => ({...f, oggetto: e.target.value}))}
                placeholder="es. Opere strutturali in c.a. Zona A"
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo netto *</label>
                <input type="number" step="0.01" value={form.importo_netto} onChange={e => setForm(f => ({...f, importo_netto: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box', textAlign: 'right' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ritenuta % (default 5%)</label>
                <input type="number" step="0.5" value={form.ritenuta_pct} onChange={e => setForm(f => ({...f, ritenuta_pct: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box', textAlign: 'right' }} />
              </div>
            </div>

            {parseFloat(form.importo_netto) > 0 && (
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                  <span>Importo contratto</span><span>EUR {fmt(parseFloat(form.importo_netto))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7c3aed', marginTop: 4 }}>
                  <span>Ritenuta {form.ritenuta_pct}% (svinco a collaudo)</span>
                  <span>- EUR {fmt(parseFloat(form.importo_netto) * parseFloat(form.ritenuta_pct) / 100)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
                  <span>Da pagare effettivo</span>
                  <span>EUR {fmt(parseFloat(form.importo_netto) * (1 - parseFloat(form.ritenuta_pct)/100))}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data stipula</label>
                <input type="date" value={form.data_stipula} onChange={e => setForm(f => ({...f, data_stipula: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Inizio lavori previsto</label>
                <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({...f, data_inizio: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
              </div>
            </div>

            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowForm(false); setErr('') }}
                style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {saving && <Loader2 size={13} className="animate-spin" />} Crea contratto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
