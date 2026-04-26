'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, Cloud, Sun, CloudRain, Wind, Thermometer, Users, Truck, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

const METEO = [
  { v: 'SOLE', l: 'Soleggiato', icon: '☀️' },
  { v: 'NUVOLOSO', l: 'Nuvoloso', icon: '⛅' },
  { v: 'PIOGGIA', l: 'Pioggia', icon: '🌧️' },
  { v: 'VENTO', l: 'Vento forte', icon: '💨' },
  { v: 'NEVE', l: 'Neve', icon: '❄️' },
  { v: 'NEBBIA', l: 'Nebbia', icon: '🌫️' },
]

export default function CantierePage() {
  const { id } = useParams() as { id: string }
  const [giorni, setGiorni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    data: today, meteo: 'SOLE', temperatura_min: '', temperatura_max: '',
    n_operai: '', n_mezzi: '', lavori_eseguiti: '',
    lavori_sospesi: false, motivo_sospensione: '',
    note: '', direttore_cantiere: ''
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('giornale_lavori')
      .select('*')
      .eq('commessa_id', id)
      .order('data', { ascending: false })
    setGiorni(data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.lavori_eseguiti.trim()) return
    setSaving(true)
    await supabase.from('giornale_lavori').insert({
      commessa_id: id,
      data: form.data,
      meteo: form.meteo,
      temperatura_min: parseFloat(form.temperatura_min) || null,
      temperatura_max: parseFloat(form.temperatura_max) || null,
      n_operai: parseInt(form.n_operai) || 0,
      n_mezzi: parseInt(form.n_mezzi) || 0,
      lavori_eseguiti: form.lavori_eseguiti.trim(),
      lavori_sospesi: form.lavori_sospesi,
      motivo_sospensione: form.lavori_sospesi ? form.motivo_sospensione : null,
      note: form.note || null,
      direttore_cantiere: form.direttore_cantiere || null,
    })
    setSaving(false)
    setShowForm(false)
    setForm({ data: today, meteo: 'SOLE', temperatura_min: '', temperatura_max: '',
      n_operai: '', n_mezzi: '', lavori_eseguiti: '', lavori_sospesi: false,
      motivo_sospensione: '', note: '', direttore_cantiere: '' })
    load()
  }

  const totOperai = giorni.slice(0, 30).reduce((s, g) => s + (g.n_operai || 0), 0)
  const giorniLavorati = giorni.filter(g => !g.lavori_sospesi).length
  const giorniSospesi = giorni.filter(g => g.lavori_sospesi).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { l: 'Giorni registrati', v: String(giorni.length) },
          { l: 'Giorni lavorati', v: String(giorniLavorati), c: '#059669' },
          { l: 'Giorni sospesi', v: String(giorniSospesi), c: giorniSospesi > 0 ? '#dc2626' : '#6b7280' },
          { l: 'Presenze ultimo mese', v: String(totOperai) + ' operai·gg' },
        ].map(({ l, v, c }, i) => (
          <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: c || '#374151' }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Giornale dei Lavori</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
            Registro giornaliero obbligatorio — meteo, operai, mezzi, attività eseguite e sospensioni
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={14} /> Nuova registrazione
        </button>
      </div>

      {/* Form nuova registrazione */}
      {showForm && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Registrazione giornaliera</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data *</label>
              <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Meteo</label>
              <select value={form.meteo} onChange={e => setForm({ ...form, meteo: e.target.value })}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                {METEO.map(m => <option key={m.v} value={m.v}>{m.icon} {m.l}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>T° min</label>
                <input type="number" value={form.temperatura_min} onChange={e => setForm({ ...form, temperatura_min: e.target.value })}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>T° max</label>
                <input type="number" value={form.temperatura_max} onChange={e => setForm({ ...form, temperatura_max: e.target.value })}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>N° operai presenti</label>
              <input type="number" value={form.n_operai} onChange={e => setForm({ ...form, n_operai: e.target.value })}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>N° mezzi attivi</label>
              <input type="number" value={form.n_mezzi} onChange={e => setForm({ ...form, n_mezzi: e.target.value })}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Direttore di cantiere</label>
              <input value={form.direttore_cantiere} onChange={e => setForm({ ...form, direttore_cantiere: e.target.value })}
                placeholder="es. Geom. Rossi Mario"
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Lavori eseguiti oggi *</label>
            <textarea value={form.lavori_eseguiti} onChange={e => setForm({ ...form, lavori_eseguiti: e.target.value })} rows={3}
              placeholder="Descrizione dettagliata delle attività eseguite durante la giornata..."
              style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <input type="checkbox" id="sospesi" checked={form.lavori_sospesi}
              onChange={e => setForm({ ...form, lavori_sospesi: e.target.checked })} />
            <label htmlFor="sospesi" style={{ fontSize: 13, fontWeight: 500, color: '#dc2626', cursor: 'pointer' }}>
              Lavori sospesi oggi
            </label>
          </div>
          {form.lavori_sospesi && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Motivo sospensione</label>
              <input value={form.motivo_sospensione} onChange={e => setForm({ ...form, motivo_sospensione: e.target.value })}
                placeholder="es. Condizioni meteo avverse, mancanza materiali, disposizione DL..."
                style={{ width: '100%', fontSize: 13, border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note aggiuntive</label>
            <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
              style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '9px 18px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={handleSave} disabled={saving || !form.lavori_eseguiti.trim()}
              style={{ padding: '9px 18px', fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
              {saving && <Loader2 size={13} className="animate-spin" />} Salva registrazione
            </button>
          </div>
        </div>
      )}

      {/* Lista giornale */}
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
            <Loader2 size={16} className="animate-spin" /> Caricamento...
          </div>
        : giorni.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af',
            background: '#f9fafb', borderRadius: 12, border: '2px dashed #e5e7eb' }}>
            <p style={{ fontSize: 14 }}>Nessuna registrazione — inizia con la prima giornata</p>
          </div>
        : giorni.map(g => {
            const meteoInfo = METEO.find(m => m.v === g.meteo)
            const isExp = expanded === g.id
            return (
              <div key={g.id} style={{ border: g.lavori_sospesi ? '2px solid #fca5a5' : '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isExp ? null : g.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
                  {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af' }} /> : <ChevronRight size={14} style={{ color: '#9ca3af' }} />}
                  <span style={{ fontSize: 13, fontWeight: 600, width: 100, flexShrink: 0 }}>
                    {new Date(g.data).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </span>
                  <span style={{ fontSize: 18 }}>{meteoInfo?.icon || '☁️'}</span>
                  {g.temperatura_min != null && (
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{g.temperatura_min}°/{g.temperatura_max}°</span>
                  )}
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#6b7280' }}>
                    <span><Users size={12} style={{ display: 'inline' }} /> {g.n_operai || 0}</span>
                    <span><Truck size={12} style={{ display: 'inline' }} /> {g.n_mezzi || 0}</span>
                  </div>
                  <p style={{ flex: 1, fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>
                    {g.lavori_eseguiti}
                  </p>
                  {g.lavori_sospesi && (
                    <span style={{ fontSize: 11, padding: '2px 8px', background: '#fee2e2', color: '#dc2626', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                      SOSPESO
                    </span>
                  )}
                </div>
                {isExp && (
                  <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: '12px 16px', fontSize: 13 }}>
                    <p style={{ margin: '0 0 8px' }}><strong>Lavori eseguiti:</strong> {g.lavori_eseguiti}</p>
                    {g.lavori_sospesi && g.motivo_sospensione && (
                      <p style={{ margin: '0 0 8px', color: '#dc2626' }}>
                        <AlertTriangle size={13} style={{ display: 'inline', marginRight: 4 }} />
                        <strong>Motivo sospensione:</strong> {g.motivo_sospensione}
                      </p>
                    )}
                    {g.note && <p style={{ margin: '0 0 8px', color: '#6b7280' }}><strong>Note:</strong> {g.note}</p>}
                    {g.direttore_cantiere && <p style={{ margin: 0, color: '#6b7280' }}><strong>Direttore cantiere:</strong> {g.direttore_cantiere}</p>}
                  </div>
                )}
              </div>
            )
          })
      }
    </div>
  )
}
