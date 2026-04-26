'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileSignature, Loader2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Clock, Shield, Plus } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATI: Record<string, { label: string; color: string; bg: string }> = {
  BOZZA:      { label: 'Bozza',       color: '#6b7280', bg: '#f3f4f6' },
  INVIATO:    { label: 'Inviato',     color: '#d97706', bg: '#fffbeb' },
  FIRMATO:    { label: 'Firmato',     color: '#059669', bg: '#f0fdf4' },
  IN_ESECUZIONE: { label: 'In esecuzione', color: '#2563eb', bg: '#eff6ff' },
  COMPLETATO: { label: 'Completato', color: '#7c3aed', bg: '#f5f3ff' },
  RISOLTO:    { label: 'Risolto',    color: '#dc2626', bg: '#fef2f2' },
}

export default function ContrattiSubPage() {
  const { id } = useParams() as { id: string }
  const [contratti, setContratti] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    fornitore_id: '', oggetto: '', importo_netto: '', ritenuta_pct: '5',
    data_inizio: '', data_fine_prevista: '', note: ''
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from('contratti_sub')
        .select('*, fornitore:fornitori(ragione_sociale, partita_iva)')
        .eq('commessa_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('fornitori').select('id, ragione_sociale').order('ragione_sociale'),
    ])
    setContratti(c || [])
    setFornitori(f || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function cambiaStato(cId: string, stato: string) {
    await supabase.from('contratti_sub').update({ stato }).eq('id', cId)
    await load()
  }

  async function handleSave() {
    if (!form.fornitore_id || !form.oggetto || !form.importo_netto) { setErr('Compila fornitore, oggetto e importo'); return }
    setSaving(true)
    const imp = parseFloat(form.importo_netto) || 0
    const rit = parseFloat(form.ritenuta_pct) || 5
    const { count } = await supabase.from('contratti_sub').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = 'CS-' + new Date().getFullYear() + '-' + String((count || 0) + 1).padStart(3, '0')
    const { error } = await supabase.from('contratti_sub').insert({
      commessa_id: id, numero, fornitore_id: form.fornitore_id,
      oggetto: form.oggetto, importo_netto: imp, ritenuta_pct: rit,
      ritenuta_importo: imp * rit / 100,
      data_inizio: form.data_inizio || null,
      data_fine_prevista: form.data_fine_prevista || null,
      note: form.note || null, stato: 'BOZZA',
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setModalOpen(false)
    setForm({ fornitore_id: '', oggetto: '', importo_netto: '', ritenuta_pct: '5', data_inizio: '', data_fine_prevista: '', note: '' })
    await load()
  }

  const totImpegnato = contratti.filter(c => c.stato !== 'RISOLTO').reduce((s, c) => s + (c.importo_netto || 0), 0)
  const totRitenute  = contratti.filter(c => c.stato !== 'RISOLTO').reduce((s, c) => s + (c.ritenuta_importo || 0), 0)
  const firmati = contratti.filter(c => ['FIRMATO','IN_ESECUZIONE','COMPLETATO'].includes(c.stato)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Banner normativo */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 12, color: '#1e40af' }}>
        <Shield size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div><strong>D.Lgs. 36/2023 art. 119</strong> — Il contratto di subappalto deve essere stipulato prima dell'inizio dei lavori subappaltati. Ritenuta obbligatoria 5%, svincolata a collaudo. Comunicare alla SA entro 20 giorni dall'affidamento.</div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          ['Contratti totali', String(contratti.length), '#374151'],
          ['Firmati / in esecuzione', String(firmati), '#2563eb'],
          ['Importo impegnato', 'EUR ' + fmt(totImpegnato), '#dc2626'],
          ['Ritenute accumulate', 'EUR ' + fmt(totRitenute), '#d97706'],
        ].map(([l, v, c]) => (
          <div key={String(l)} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: String(c), margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Contratti di Subappalto</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Generati automaticamente dagli ODA di tipo Subappalto. Ritenuta 5% svincolata a collaudo.</p>
        </div>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={14} /> Nuovo contratto
        </button>
      </div>

      {/* Lista contratti */}
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /> Caricamento...</div>
        : contratti.length === 0
        ? <div style={{ border: '2px dashed #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            <FileSignature size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, margin: 0 }}>Nessun contratto di subappalto. Crea un ODA di tipo Subappalto oppure aggiungi manualmente.</p>
          </div>
        : contratti.map(c => {
            const si = STATI[c.stato] || STATI.BOZZA
            const isExp = expanded === c.id
            const imp = c.importo_netto || 0
            const rit = c.ritenuta_importo || 0
            return (
              <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isExp ? null : c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
                  {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                  <FileSignature size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', width: 110, flexShrink: 0 }}>{c.numero}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.oggetto || c.fornitore?.ragione_sociale}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{c.fornitore?.ragione_sociale}</span>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>EUR {fmt(imp)}</p>
                    <p style={{ fontSize: 10, color: '#d97706', margin: 0 }}>Ritenuta: EUR {fmt(rit)}</p>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600, background: si.bg, color: si.color, flexShrink: 0 }}>{si.label}</span>
                </div>
                {isExp && (
                  <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14, fontSize: 12 }}>
                      <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>Importo netto</p><p style={{ margin: 0, fontWeight: 600 }}>EUR {fmt(imp)}</p></div>
                      <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>Ritenuta {c.ritenuta_pct}%</p><p style={{ margin: 0, color: '#d97706', fontWeight: 600 }}>EUR {fmt(rit)}</p></div>
                      <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>Da pagare</p><p style={{ margin: 0, fontWeight: 600 }}>EUR {fmt(imp - rit)}</p></div>
                      <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>P. IVA sub</p><p style={{ margin: 0 }}>{c.fornitore?.partita_iva || '—'}</p></div>
                    </div>
                    {c.data_inizio && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, fontSize: 12 }}>
                        <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>Inizio lavori</p><p style={{ margin: 0 }}>{c.data_inizio}</p></div>
                        <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>Fine prevista</p><p style={{ margin: 0 }}>{c.data_fine_prevista || '—'}</p></div>
                      </div>
                    )}
                    {/* Alert DURC */}
                    <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#92400e' }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                      Verificare: DURC in corso di validita, dichiarazione antimafia, comunicazione SA entro 20 gg.
                    </div>
                    {/* Cambio stato */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Stato contratto:</span>
                      {['BOZZA','INVIATO','FIRMATO','IN_ESECUZIONE','COMPLETATO'].filter(s => s !== c.stato).map(s => {
                        const si2 = STATI[s]
                        return <button key={s} onClick={() => cambiaStato(c.id, s)} style={{ fontSize: 11, padding: '4px 12px', border: '1px solid ' + si2.color, borderRadius: 6, background: si2.bg, color: si2.color, cursor: 'pointer' }}>{si2.label}</button>
                      })}
                      <button onClick={() => cambiaStato(c.id, 'RISOLTO')} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer', marginLeft: 'auto' }}>Risolvi</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
      }

      {/* Modal nuovo contratto */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 520, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>Nuovo Contratto di Subappalto</h2>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Subappaltatore *</label>
              <select value={form.fornitore_id} onChange={e => setForm(p => ({...p, fornitore_id: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                <option value="">Seleziona...</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select></div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto lavori *</label>
              <input value={form.oggetto} onChange={e => setForm(p => ({...p, oggetto: e.target.value}))} placeholder="es. Demolizioni strutturali Zona A..." style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo netto *</label>
                <input type="number" step="0.01" value={form.importo_netto} onChange={e => setForm(p => ({...p, importo_netto: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ritenuta %</label>
                <input type="number" value={form.ritenuta_pct} onChange={e => setForm(p => ({...p, ritenuta_pct: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Inizio lavori</label>
                <input type="date" value={form.data_inizio} onChange={e => setForm(p => ({...p, data_inizio: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fine prevista</label>
                <input type="date" value={form.data_fine_prevista} onChange={e => setForm(p => ({...p, data_fine_prevista: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            </div>
            {form.importo_netto && (
              <div style={{ background: '#fffbeb', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#d97706' }}>Ritenuta {form.ritenuta_pct}% da accantonare</span><span style={{ fontWeight: 600 }}>EUR {fmt(parseFloat(form.importo_netto) * parseFloat(form.ritenuta_pct || '5') / 100)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>Da pagare al sub</span><span style={{ fontWeight: 600 }}>EUR {fmt(parseFloat(form.importo_netto) * (1 - parseFloat(form.ritenuta_pct || '5') / 100))}</span></div>
              </div>
            )}
            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Creazione...' : 'Crea contratto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
