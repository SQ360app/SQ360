'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, ChevronDown, ChevronRight, ArrowRight, Send } from 'lucide-react'

const fmt = (n: number) => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TIPI = ['SUBAPPALTO', 'ACQUISTO', 'NOLO_CON_CONDUCENTE', 'NOLO_A_FREDDO', 'SERVIZIO', 'MISTO']
const PRIORITA = [{ v: 'BASSA', c: '#6b7280' }, { v: 'NORMALE', c: '#2563eb' }, { v: 'ALTA', c: '#d97706' }, { v: 'URGENTE', c: '#dc2626' }]
const STATI_RDA = [
  { v: 'BOZZA',           c: '#9ca3af', bg: '#f3f4f6' },
  { v: 'IN_APPROVAZIONE', c: '#d97706', bg: '#fffbeb' },
  { v: 'APPROVATA',       c: '#059669', bg: '#f0fdf4' },
  { v: 'RIFIUTATA',       c: '#dc2626', bg: '#fef2f2' },
  { v: 'EVASA',           c: '#2563eb', bg: '#eff6ff' },
]

export default function RDAPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [rda, setRda] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [tipo, setTipo] = useState('SUBAPPALTO')
  const [priorita, setPriorita] = useState('NORMALE')
  const [oggetto, setOggetto] = useState('')
  const [importo, setImporto] = useState('')
  const [dataNecessita, setDataNecessita] = useState('')
  const [note, setNote] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('rda').select('*').eq('commessa_id', id).order('created_at', { ascending: false })
    setRda(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  async function createRDA() {
    if (!oggetto.trim()) { setErr('Oggetto obbligatorio'); return }
    setSaving(true)
    const { count } = await supabase.from('rda').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = 'RDA-' + new Date().getFullYear() + '-' + String((count || 0) + 1).padStart(3, '0')
    const { error } = await supabase.from('rda').insert({
      commessa_id: id, numero, tipo, oggetto: oggetto.trim(),
      importo_stimato: parseFloat(importo) || null,
      data_necessita: dataNecessita || null,
      note: note || null, priorita, stato: 'BOZZA',
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOggetto(''); setImporto(''); setDataNecessita(''); setNote('')
    setShowForm(false)
    await load()
  }

  async function cambiaStato(rdaId: string, stato: string) {
    await supabase.from('rda').update({ stato }).eq('id', rdaId)
    await load()
  }

  async function creaRDO(r: any) {
    // Crea RDO collegata alla RDA e naviga
    const { count } = await supabase.from('rdo').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = 'RDO-' + new Date().getFullYear() + '-' + String((count || 0) + 1).padStart(3, '0')
    const { data: rdoData, error } = await supabase.from('rdo').insert({
      commessa_id: id,
      numero,
      oggetto: r.oggetto,
      rda_id: r.id,
      tipo: r.tipo,
      stato: 'BOZZA',
      data_emissione: new Date().toISOString().split('T')[0],
    }).select().single()
    if (!error) {
      await supabase.from('rda').update({ stato: 'IN_APPROVAZIONE' }).eq('id', r.id)
      router.push('/dashboard/commesse/' + id + '/rdo')
    }
  }

  const totale = rda.length
  const inApp = rda.filter(r => r.stato === 'IN_APPROVAZIONE').length
  const approvate = rda.filter(r => r.stato === 'APPROVATA').length
  const importoTot = rda.filter(r => r.stato !== 'RIFIUTATA').reduce((s, r) => s + (r.importo_stimato || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[['Totale RDA', String(totale), '#374151'], ['In approvazione', String(inApp), '#d97706'], ['Approvate', String(approvate), '#059669'], ['Importo stimato', 'EUR ' + fmt(importoTot), '#111827']].map(([l, v, c]) => (
          <div key={String(l)} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: String(c), margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Header + bottone */}
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            <Plus size={14} /> Nuova RDA
          </button>
        </div>
      )}

      {/* Form nuova RDA */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>Nuova Richiesta di Acquisto/Affidamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Tipo *</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                {TIPI.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Priorita</label>
              <select value={priorita} onChange={e => setPriorita(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                {PRIORITA.map(p => <option key={p.v} value={p.v}>{p.v}</option>)}
              </select></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto — descrizione acquisto/lavorazione *</label>
            <input value={oggetto} onChange={e => setOggetto(e.target.value)} placeholder="es. Demolizioni strutturali Zona A, Acciaio B450C per pilastri..." style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo stimato EUR</label>
              <input type="number" step="0.01" value={importo} onChange={e => setImporto(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data necessita in cantiere</label>
              <input type="date" value={dataNecessita} onChange={e => setDataNecessita(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note di cantiere — indicazioni specifiche per ufficio acquisti</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Indica marca, specifiche, ubicazione cantiere, urgenze, materiale da sostituire..." style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', resize: 'vertical', boxSizing: 'border-box' }} /></div>
          {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setErr(''); setOggetto('') }} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
            <button onClick={createRDA} disabled={saving || !oggetto.trim()} style={{ padding: '8px 16px', fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (saving || !oggetto.trim()) ? 0.5 : 1 }}>
              {saving && <Loader2 size={13} className="animate-spin" />} Crea RDA
            </button>
          </div>
        </div>
      )}

      {/* Lista RDA */}
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /> Caricamento...</div>
        : rda.length === 0
        ? <div style={{ border: '2px dashed #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Nessuna RDA — crea la prima richiesta di acquisto o affidamento</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rda.map(r => {
              const si = STATI_RDA.find(s => s.v === r.stato) || STATI_RDA[0]
              const pa = PRIORITA.find(p => p.v === r.priorita)
              const isExp = expanded === r.id
              return (
                <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div onClick={() => setExpanded(isExp ? null : r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
                    {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', width: 120, flexShrink: 0 }}>{r.numero}</span>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#f3f4f6', color: '#374151', flexShrink: 0 }}>{r.tipo}</span>
                    <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.oggetto}</span>
                    {pa && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, border: '1px solid ' + pa.c, color: pa.c, flexShrink: 0 }}>{r.priorita}</span>}
                    {r.importo_stimato && <span style={{ fontSize: 12, fontWeight: 500, flexShrink: 0 }}>EUR {fmt(r.importo_stimato)}</span>}
                    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 12, fontWeight: 500, background: si.bg, color: si.c, flexShrink: 0 }}>{r.stato}</span>
                  </div>
                  {isExp && (
                    <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: 14 }}>
                      {r.note && <p style={{ fontSize: 12, color: '#6b7280', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', margin: '0 0 12px' }}><strong>Note cantiere:</strong> {r.note}</p>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12, fontSize: 12 }}>
                        <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>Data necessita</p><p style={{ margin: 0 }}>{r.data_necessita || '—'}</p></div>
                        <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>Creata il</p><p style={{ margin: 0 }}>{new Date(r.created_at).toLocaleDateString('it-IT')}</p></div>
                        <div><p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>Tipo</p><p style={{ margin: 0 }}>{r.tipo}</p></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>Azioni:</span>
                        {r.stato === 'BOZZA' && <button onClick={() => cambiaStato(r.id, 'IN_APPROVAZIONE')} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #fde68a', borderRadius: 6, background: '#fffbeb', color: '#d97706', cursor: 'pointer' }}>Invia per approvazione</button>}
                        {r.stato === 'IN_APPROVAZIONE' && <>
                          <button onClick={() => cambiaStato(r.id, 'APPROVATA')} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #a7f3d0', borderRadius: 6, background: '#f0fdf4', color: '#059669', cursor: 'pointer' }}>Approva</button>
                          <button onClick={() => cambiaStato(r.id, 'RIFIUTATA')} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>Rifiuta</button>
                        </>}
                        {r.stato === 'APPROVATA' && (
                          <button onClick={() => creaRDO(r)} style={{ fontSize: 12, padding: '6px 14px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                            <Send size={13} /> Crea RDO e invia a fornitori
                          </button>
                        )}
                        {r.stato === 'EVASA' && <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>RDA evasa — ODA emesso</span>}
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
