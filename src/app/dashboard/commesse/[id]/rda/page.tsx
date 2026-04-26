'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2 } from 'lucide-react'

const fmt = (n: number) => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const TIPI = ['MATERIALE', 'SUBAPPALTO', 'SUBAFFIDAMENTO', 'SERVIZIO', 'MISTO']
const PRIORITA = [{ v: 'URGENTE', c: '#dc2626' }, { v: 'NORMALE', c: '#2563eb' }, { v: 'BASSA', c: '#9ca3af' }]
const STATI_RDA = [
  { v: 'BOZZA', c: '#9ca3af' },
  { v: 'IN_APPROVAZIONE', c: '#d97706' },
  { v: 'APPROVATA', c: '#059669' },
  { v: 'RIFIUTATA', c: '#dc2626' },
  { v: 'EVASA', c: '#7c3aed' },
]

export default function RDAPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [rda, setRda] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ tipo: 'MATERIALE', oggetto: '', importo_stimato: '', priorita: 'NORMALE', data_necessita: '', note: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('rda').select('*').eq('commessa_id', id).order('created_at', { ascending: false })
    setRda(data || [])
    setLoading(false)
  }

  async function createRDA() {
    setSaving(true)
    const numero = 'RDA-' + new Date().getFullYear() + '-' + String(rda.length + 1).padStart(3, '0')
    await supabase.from('rda').insert({
      commessa_id: id, numero, tipo: form.tipo, oggetto: form.oggetto,
      importo_stimato: parseFloat(form.importo_stimato) || 0,
      priorita: form.priorita, data_necessita: form.data_necessita || null,
      note: form.note, stato: 'BOZZA',
    })
    setSaving(false); setShowForm(false)
    setForm({ tipo: 'MATERIALE', oggetto: '', importo_stimato: '', priorita: 'NORMALE', data_necessita: '', note: '' })
    load()
  }

  async function cambiaStato(rdaId: string, s: string) {
    await supabase.from('rda').update({ stato: s }).eq('id', rdaId); load()
  }

  useEffect(() => { load() }, [id])

  const totale = rda.filter(r => r.stato !== 'RIFIUTATA').reduce((s, r) => s + (r.importo_stimato || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { l: 'Totale RDA', v: String(rda.length) },
          { l: 'In approvazione', v: String(rda.filter(r => r.stato === 'IN_APPROVAZIONE').length) },
          { l: 'Approvate', v: String(rda.filter(r => r.stato === 'APPROVATA').length) },
          { l: 'Importo stimato', v: 'EUR ' + fmt(totale) },
        ].map(({ l, v }, i) => (
          <div key={i} style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '7px 16px', fontSize: 13, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Nuova RDA
        </button>
      </div>
      {showForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16, background: '#f9fafb' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Nuova Richiesta di Acquisto</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}>
                {TIPI.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Priorita</label>
              <select value={form.priorita} onChange={e => setForm(p => ({ ...p, priorita: e.target.value }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}>
                {PRIORITA.map(p => <option key={p.v} value={p.v}>{p.v}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto *</label>
              <input value={form.oggetto} onChange={e => setForm(p => ({ ...p, oggetto: e.target.value }))} placeholder="Descrizione acquisto..." style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo stimato EUR</label>
              <input type="number" value={form.importo_stimato} onChange={e => setForm(p => ({ ...p, importo_stimato: e.target.value }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data necessita</label>
              <input type="date" value={form.data_necessita} onChange={e => setForm(p => ({ ...p, data_necessita: e.target.value }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note</label>
              <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2} placeholder="Indicazioni dal cantiere..." style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, resize: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer' }}>Annulla</button>
            <button onClick={createRDA} disabled={saving || !form.oggetto} style={{ padding: '6px 14px', fontSize: 13, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: !form.oggetto ? 0.5 : 1 }}>
              {saving ? '...' : 'Crea RDA'}
            </button>
          </div>
        </div>
      )}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Numero', 'Tipo', 'Oggetto', 'Importo stimato', 'Priorita', 'Stato', 'Azioni'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Caricamento...</td></tr>
              : rda.length === 0
              ? <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nessuna RDA</td></tr>
              : rda.map(r => {
                  const sa = STATI_RDA.find(s => s.v === r.stato)
                  const pa = PRIORITA.find(p => p.v === r.priorita)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{r.numero}</td>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#f3f4f6' }}>{r.tipo}</span></td>
                      <td style={{ padding: '8px 12px', maxWidth: 200 }}>{r.oggetto}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{r.importo_stimato > 0 ? 'EUR ' + fmt(r.importo_stimato) : '-'}</td>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 11, fontWeight: 600, color: pa?.c }}>{r.priorita}</span></td>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: (sa?.c || '#9ca3af') + '20', color: sa?.c, fontWeight: 600 }}>{r.stato}</span></td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {r.stato === 'BOZZA' && <button onClick={() => cambiaStato(r.id, 'IN_APPROVAZIONE')} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #d97706', borderRadius: 4, background: 'white', color: '#d97706', cursor: 'pointer' }}>Invia</button>}
                          {r.stato === 'IN_APPROVAZIONE' && <>
                            <button onClick={() => cambiaStato(r.id, 'APPROVATA')} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #059669', borderRadius: 4, background: 'white', color: '#059669', cursor: 'pointer' }}>Approva</button>
                            <button onClick={() => cambiaStato(r.id, 'RIFIUTATA')} style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #dc2626', borderRadius: 4, background: 'white', color: '#dc2626', cursor: 'pointer' }}>Rifiuta</button>
                          </>}
                          {r.stato === 'APPROVATA' && <button onClick={() => router.push('/dashboard/commesse/' + id + '/rdo?rda=' + r.id)} style={{ padding: '2px 8px', fontSize: 11, border: 'none', borderRadius: 4, background: '#2563eb', color: 'white', cursor: 'pointer' }}>Crea RDO</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
