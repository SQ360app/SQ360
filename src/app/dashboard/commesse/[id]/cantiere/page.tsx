'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, Cloud, Sun, CloudRain, Wind, HardHat, ChevronDown, ChevronRight } from 'lucide-react'

const METEO = [
  { v: 'SERENO',    Icon: Sun,        c: '#f59e0b' },
  { v: 'NUVOLOSO',  Icon: Cloud,      c: '#9ca3af' },
  { v: 'PIOGGIA',   Icon: CloudRain,  c: '#3b82f6' },
  { v: 'VENTO',     Icon: Wind,       c: '#6b7280' },
  { v: 'NEVE',      Icon: Cloud,      c: '#bfdbfe' },
]

export default function CantierePage() {
  const { id } = useParams() as { id: string }
  const [giorni, setGiorni] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    data: new Date().toISOString().split('T')[0],
    meteo: 'SERENO', temperatura: '', lavori_eseguiti: '',
    lavori_sospesi: '', motivo_sospensione: '',
    n_operai: '', n_mezzi: '', note: '',
    direttore_cantiere: '', preposto: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('giornale_lavori')
      .select('*').eq('commessa_id', id)
      .order('data', { ascending: false })
    setGiorni(data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function salva() {
    if (!form.lavori_eseguiti.trim()) return
    setSaving(true)
    const { error } = await supabase.from('giornale_lavori').insert({
      commessa_id: id,
      data: form.data,
      meteo: form.meteo,
      temperatura: form.temperatura ? parseFloat(form.temperatura) : null,
      lavori_eseguiti: form.lavori_eseguiti.trim(),
      lavori_sospesi: form.lavori_sospesi || false,
      motivo_sospensione: form.motivo_sospensione || null,
      n_operai: form.n_operai ? parseInt(form.n_operai) : null,
      n_mezzi: form.n_mezzi ? parseInt(form.n_mezzi) : null,
      note: form.note || null,
      direttore_cantiere: form.direttore_cantiere || null,
      preposto: form.preposto || null,
    })
    setSaving(false)
    if (!error) {
      setShowForm(false)
      setForm(f => ({ ...f, lavori_eseguiti: '', note: '', motivo_sospensione: '', lavori_sospesi: '' }))
      await load()
    }
  }

  const ggLavoro = giorni.filter(g => !g.lavori_sospesi).length
  const ggSospesi = giorni.filter(g => g.lavori_sospesi).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          ['Giorni registrati', String(giorni.length), '#374151'],
          ['Giorni lavoro', String(ggLavoro), '#059669'],
          ['Giorni sospesi', String(ggSospesi), '#dc2626'],
          ['Ultimo aggiornamento', giorni[0]?.data || '—', '#6b7280'],
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
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Giornale dei Lavori</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Registro giornaliero obbligatorio — meteo, operai, lavori eseguiti, sospensioni.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={14} /> Registra giornata
        </button>
      </div>

      {/* Form nuova giornata */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <HardHat size={16} style={{ color: '#d97706' }} /> Nuova registrazione giornale lavori
          </h3>

          {/* Data e meteo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data</label>
              <input type="date" value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Temperatura °C</label>
              <input type="number" value={form.temperatura} onChange={e => setForm(f => ({...f, temperatura: e.target.value}))} placeholder="es. 22" style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>N. operai presenti</label>
              <input type="number" value={form.n_operai} onChange={e => setForm(f => ({...f, n_operai: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>N. mezzi in cantiere</label>
              <input type="number" value={form.n_mezzi} onChange={e => setForm(f => ({...f, n_mezzi: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
          </div>

          {/* Meteo */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Condizioni meteo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {METEO.map(({ v, Icon, c }) => (
                <button key={v} onClick={() => setForm(f => ({...f, meteo: v}))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: form.meteo === v ? '2px solid ' + c : '1px solid #e5e7eb', background: form.meteo === v ? '#f9fafb' : '#fff', cursor: 'pointer', fontSize: 12, color: c }}>
                  <Icon size={14} /> {v}
                </button>
              ))}
            </div>
          </div>

          {/* Lavori eseguiti */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Lavori eseguiti *</label>
            <textarea value={form.lavori_eseguiti} onChange={e => setForm(f => ({...f, lavori_eseguiti: e.target.value}))} rows={4} placeholder="Descrivi i lavori eseguiti durante la giornata, avanzamento, zone interessate..." style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', resize: 'vertical', boxSizing: 'border-box' }} /></div>

          {/* Sospensione */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="sosp" checked={form.lavori_sospesi === 'true'} onChange={e => setForm(f => ({...f, lavori_sospesi: e.target.checked ? 'true' : ''}))} />
            <label htmlFor="sosp" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Lavori sospesi in questa giornata</label>
          </div>
          {form.lavori_sospesi === 'true' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Motivo sospensione</label>
              <input value={form.motivo_sospensione} onChange={e => setForm(f => ({...f, motivo_sospensione: e.target.value}))} placeholder="es. Pioggia intensa, sospensione SA, problema sicurezza..." style={{ width: '100%', fontSize: 13, border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
          )}

          {/* Firmatari */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Direttore cantiere</label>
              <input value={form.direttore_cantiere} onChange={e => setForm(f => ({...f, direttore_cantiere: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Preposto</label>
              <input value={form.preposto} onChange={e => setForm(f => ({...f, preposto: e.target.value}))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
            <button onClick={salva} disabled={saving || !form.lavori_eseguiti.trim()} style={{ padding: '8px 20px', fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: (saving || !form.lavori_eseguiti.trim()) ? 0.5 : 1 }}>
              {saving ? 'Salvataggio...' : 'Registra giornata'}
            </button>
          </div>
        </div>
      )}

      {/* Lista giornate */}
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /></div>
        : giorni.length === 0
        ? <div style={{ border: '2px dashed #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Nessuna registrazione — inizia il giornale lavori con la prima giornata</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {giorni.map(g => {
              const meteoInfo = METEO.find(m => m.v === g.meteo) || METEO[0]
              const MeteoIcon = meteoInfo.Icon
              const isExp = expanded === g.id
              return (
                <div key={g.id} style={{ border: g.lavori_sospesi ? '1px solid #fecaca' : '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: g.lavori_sospesi ? '#fef2f2' : '#fff' }}>
                  <div onClick={() => setExpanded(isExp ? null : g.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}>
                    {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: 600, width: 100, flexShrink: 0 }}>{g.data}</span>
                    <MeteoIcon size={16} style={{ color: meteoInfo.c, flexShrink: 0 }} />
                    {g.temperatura && <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>{g.temperatura}°C</span>}
                    {g.n_operai && <span style={{ fontSize: 11, padding: '2px 8px', background: '#f3f4f6', borderRadius: 6, flexShrink: 0 }}><HardHat size={11} style={{ display: 'inline', marginRight: 3 }} />{g.n_operai} op.</span>}
                    <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>{g.lavori_eseguiti}</span>
                    {g.lavori_sospesi && <span style={{ fontSize: 11, padding: '2px 8px', background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontWeight: 600, flexShrink: 0 }}>SOSPESO</span>}
                  </div>
                  {isExp && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 14px', background: '#fafafa' }}>
                      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px', lineHeight: 1.5 }}>{g.lavori_eseguiti}</p>
                      {g.lavori_sospesi && g.motivo_sospensione && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}><strong>Motivo sospensione:</strong> {g.motivo_sospensione}</p>}
                      {g.note && <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{g.note}</p>}
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
                        {g.direttore_cantiere && <span>DC: {g.direttore_cantiere}</span>}
                        {g.preposto && <span>Preposto: {g.preposto}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}
