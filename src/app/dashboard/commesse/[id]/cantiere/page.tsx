'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, Cloud, Sun, CloudRain, CloudSnow, Wind, AlertTriangle, BookOpen, Users, Truck } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const METEO: Record<string, { label: string; icon: any; color: string }> = {
  SERENO:       { label: 'Sereno',        icon: Sun,        color: '#f59e0b' },
  NUVOLOSO:     { label: 'Nuvoloso',      icon: Cloud,      color: '#6b7280' },
  PIOGGIA:      { label: 'Pioggia',       icon: CloudRain,  color: '#3b82f6' },
  NEVE:         { label: 'Neve',          icon: CloudSnow,  color: '#93c5fd' },
  VENTO:        { label: 'Vento forte',   icon: Wind,       color: '#8b5cf6' },
  TEMPORALE:    { label: 'Temporale',     icon: CloudRain,  color: '#dc2626' },
}

export default function CantiereGiornalePage() {
  const { id } = useParams() as { id: string }
  const [voci, setVoci] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [activeTab, setActiveTab] = useState<'giornale'|'sospensioni'>('giornale')
  const [form, setForm] = useState({
    data: new Date().toISOString().split('T')[0],
    meteo: 'SERENO',
    temperatura: '',
    operai_presenti: '0',
    ore_lavorate: '0',
    mezzi_attivi: '',
    lavori_eseguiti: '',
    lavori_sospesi: false,
    motivo_sospensione: '',
    note_dl: '',
    note: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('giornale_lavori')
      .select('*')
      .eq('commessa_id', id)
      .order('data', { ascending: false })
    setVoci(data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.lavori_eseguiti.trim() && !form.lavori_sospesi) {
      setErr('Descrivi i lavori eseguiti o indica la sospensione'); return
    }
    setSaving(true)
    const { error } = await supabase.from('giornale_lavori').insert({
      commessa_id: id,
      data: form.data,
      meteo: form.meteo,
      temperatura: form.temperatura ? parseFloat(form.temperatura) : null,
      operai_presenti: parseInt(form.operai_presenti) || 0,
      ore_lavorate: parseFloat(form.ore_lavorate) || 0,
      mezzi_attivi: form.mezzi_attivi || null,
      lavori_eseguiti: form.lavori_eseguiti || null,
      lavori_sospesi: form.lavori_sospesi,
      motivo_sospensione: form.motivo_sospensione || null,
      note_dl: form.note_dl || null,
      note: form.note || null,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false)
    setShowForm(false)
    setForm({ data: new Date().toISOString().split('T')[0], meteo: 'SERENO', temperatura: '', operai_presenti: '0', ore_lavorate: '0', mezzi_attivi: '', lavori_eseguiti: '', lavori_sospesi: false, motivo_sospensione: '', note_dl: '', note: '' })
    await load()
  }

  const giornateSospese = voci.filter(v => v.lavori_sospesi).length
  const totOperai = voci.filter(v => !v.lavori_sospesi).reduce((s, v) => s + (v.operai_presenti || 0), 0)
  const totOre = voci.filter(v => !v.lavori_sospesi).reduce((s, v) => s + (v.ore_lavorate || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { l: 'Giorni registrati', v: String(voci.length) },
          { l: 'Sospensioni lavori', v: String(giornateSospese), warn: giornateSospese > 0 },
          { l: 'Totale operai-giorno', v: String(totOperai) },
          { l: 'Ore lavorate totali', v: fmt(totOre) },
        ].map((k, i) => (
          <div key={i} style={{ background: k.warn ? '#fef2f2' : '#f9fafb', border: '1px solid ' + (k.warn ? '#fecaca' : '#e5e7eb'), borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{k.l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: k.warn ? '#dc2626' : '#111' }}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Tab + pulsante */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 4 }}>
          {(['giornale', 'sospensioni'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: activeTab === t ? '#fff' : 'transparent',
                color: activeTab === t ? '#111' : '#6b7280',
                boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {t === 'giornale' ? 'Giornale lavori' : 'Sospensioni (' + giornateSospese + ')'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={14} /> Nuova registrazione
        </button>
      </div>

      {/* Lista */}
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
            <Loader2 size={16} className="animate-spin" /> Caricamento...
          </div>
        : (activeTab === 'giornale' ? voci.filter(v => !v.lavori_sospesi) : voci.filter(v => v.lavori_sospesi)).length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af' }}>
            <BookOpen size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14, margin: 0 }}>Nessuna voce nel giornale</p>
          </div>
        : (activeTab === 'giornale' ? voci.filter(v => !v.lavori_sospesi) : voci.filter(v => v.lavori_sospesi)).map(v => {
            const meteo = METEO[v.meteo] || METEO.SERENO
            const MeteoIcon = meteo.icon
            return (
              <div key={v.id} style={{ border: '1px solid ' + (v.lavori_sospesi ? '#fecaca' : '#e5e7eb'), borderRadius: 10, padding: '12px 16px', background: v.lavori_sospesi ? '#fef2f2' : '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Data */}
                  <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '6px 10px', textAlign: 'center', flexShrink: 0, minWidth: 56 }}>
                    <p style={{ fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1 }}>
                      {new Date(v.data + 'T00:00:00').getDate()}
                    </p>
                    <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>
                      {new Date(v.data + 'T00:00:00').toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })}
                    </p>
                  </div>

                  {/* Contenuto */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <MeteoIcon size={15} style={{ color: meteo.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: meteo.color, fontWeight: 500 }}>{meteo.label}</span>
                      {v.temperatura && <span style={{ fontSize: 11, color: '#6b7280' }}>{v.temperatura}°C</span>}
                      <div style={{ display: 'flex', gap: 12, marginLeft: 8, color: '#6b7280' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                          <Users size={11} /> {v.operai_presenti} op.
                        </span>
                        <span style={{ fontSize: 11 }}>{v.ore_lavorate}h</span>
                        {v.mezzi_attivi && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}><Truck size={11} /> {v.mezzi_attivi}</span>}
                      </div>
                      {v.lavori_sospesi && (
                        <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', background: '#fef2f2', color: '#dc2626', borderRadius: 10, fontWeight: 600, border: '1px solid #fecaca' }}>
                          SOSPENSIONE
                        </span>
                      )}
                    </div>
                    {v.lavori_eseguiti && <p style={{ fontSize: 13, margin: '0 0 4px', color: '#374151' }}>{v.lavori_eseguiti}</p>}
                    {v.motivo_sospensione && (
                      <p style={{ fontSize: 12, margin: '0 0 4px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} /> {v.motivo_sospensione}
                      </p>
                    )}
                    {v.note_dl && <p style={{ fontSize: 11, color: '#7c3aed', margin: '2px 0 0', fontStyle: 'italic' }}>DL: {v.note_dl}</p>}
                    {v.note && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{v.note}</p>}
                  </div>
                </div>
              </div>
            )
          })
      }

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px' }}>Nuova registrazione giornale lavori</h2>

            {/* Sospensione toggle */}
            <div onClick={() => setForm(f => ({...f, lavori_sospesi: !f.lavori_sospesi}))}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 16,
                background: form.lavori_sospesi ? '#fef2f2' : '#f0fdf4', border: '1px solid ' + (form.lavori_sospesi ? '#fecaca' : '#bbf7d0') }}>
              <AlertTriangle size={16} style={{ color: form.lavori_sospesi ? '#dc2626' : '#059669' }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: form.lavori_sospesi ? '#dc2626' : '#065f46' }}>
                  {form.lavori_sospesi ? 'SOSPENSIONE LAVORI' : 'Giornata lavorativa regolare'}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>Clicca per alternare</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data *</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Meteo</label>
                <select value={form.meteo} onChange={e => setForm(f => ({...f, meteo: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                  {Object.entries(METEO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Temperatura °C</label>
                <input type="number" step="0.5" value={form.temperatura} onChange={e => setForm(f => ({...f, temperatura: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', boxSizing: 'border-box', textAlign: 'right' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Operai presenti</label>
                <input type="number" value={form.operai_presenti} onChange={e => setForm(f => ({...f, operai_presenti: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', boxSizing: 'border-box', textAlign: 'right' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ore lavorate</label>
                <input type="number" step="0.5" value={form.ore_lavorate} onChange={e => setForm(f => ({...f, ore_lavorate: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', boxSizing: 'border-box', textAlign: 'right' }} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Mezzi attivi in cantiere</label>
              <input value={form.mezzi_attivi} onChange={e => setForm(f => ({...f, mezzi_attivi: e.target.value}))}
                placeholder="es. Gru torre, Betoniera, Escavatore CAT320"
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>

            {!form.lavori_sospesi && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Lavori eseguiti *</label>
                <textarea value={form.lavori_eseguiti} onChange={e => setForm(f => ({...f, lavori_eseguiti: e.target.value}))} rows={3}
                  placeholder="Descrivere i lavori eseguiti nella giornata..."
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            )}

            {form.lavori_sospesi && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#dc2626', display: 'block', marginBottom: 4 }}>Motivo sospensione *</label>
                <textarea value={form.motivo_sospensione} onChange={e => setForm(f => ({...f, motivo_sospensione: e.target.value}))} rows={2}
                  placeholder="es. Pioggia intensa, Gelo, Vento forte > 60 km/h, Disposizione DL..."
                  style={{ width: '100%', fontSize: 13, border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#7c3aed', display: 'block', marginBottom: 4 }}>Note Direzione Lavori</label>
              <input value={form.note_dl} onChange={e => setForm(f => ({...f, note_dl: e.target.value}))}
                placeholder="Eventuali indicazioni o osservazioni della DL..."
                style={{ width: '100%', fontSize: 13, border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>

            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowForm(false); setErr('') }}
                style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: 10, fontSize: 13, background: form.lavori_sospesi ? '#dc2626' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {saving && <Loader2 size={13} className="animate-spin" />}
                {form.lavori_sospesi ? 'Registra sospensione' : 'Registra giornata'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
