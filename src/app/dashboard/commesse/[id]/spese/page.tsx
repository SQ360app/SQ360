'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, CheckCircle2, Clock, XCircle, AlertTriangle, Loader2 } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const SOGLIA = 50

const TIPI = [
  { value: 'PICCOLO_ACQUISTO', label: 'Piccolo acquisto', bg: '#fff7ed', color: '#c2410c' },
  { value: 'RIMBORSO_SPESE',   label: 'Rimborso spese',  bg: '#eff6ff', color: '#1d4ed8' },
  { value: 'COSTO_INDIRETTO',  label: 'Costo indiretto', bg: '#f3f4f6', color: '#374151' },
  { value: 'PROFESSIONISTA',   label: 'Professionista',  bg: '#f5f3ff', color: '#6d28d9' },
  { value: 'ALTRO',            label: 'Altro',           bg: '#f3f4f6', color: '#6b7280' },
]
const METODI = [
  { value: 'CONTANTI',         label: 'Contanti' },
  { value: 'CARTA_AZIENDALE',  label: 'Carta aziendale' },
  { value: 'BONIFICO',         label: 'Bonifico' },
  { value: 'RIMBORSO_OPERAIO', label: 'Rimborso operaio' },
]

export default function SpeseCantierePage() {
  const { id } = useParams() as { id: string }
  const [spese, setSpese] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState('PICCOLO_ACQUISTO')
  const [dataSpesa, setDataSpesa] = useState(new Date().toISOString().split('T')[0])
  const [descrizione, setDescrizione] = useState('')
  const [importo, setImporto] = useState('')
  const [iva, setIva] = useState('22')
  const [fornitore, setFornitore] = useState('')
  const [metodo, setMetodo] = useState('CONTANTI')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const importoNum = parseFloat(importo) || 0
  const totale = importoNum * (1 + parseFloat(iva) / 100)
  const richiedeApprovazione = importoNum > SOGLIA

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('spese_cantiere').select('*').eq('commessa_id', id).order('data_spesa', { ascending: false })
    setSpese(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSave() {
    if (!descrizione.trim()) { setErr("Descrizione obbligatoria"); return }
    if (importoNum <= 0) { setErr('Importo non valido'); return }
    setSaving(true)
    const { error } = await supabase.from('spese_cantiere').insert({
      commessa_id: id, tipo, data_spesa: dataSpesa,
      descrizione: descrizione.trim(), importo_netto: importoNum,
      iva_pct: parseFloat(iva), fornitore_libero: fornitore.trim() || null,
      metodo_pagamento: metodo, stato: richiedeApprovazione ? 'IN_APPROVAZIONE' : 'REGISTRATA',
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); setShowForm(false)
    setDescrizione(''); setImporto(''); setFornitore('')
    await load()
  }

  const totR = spese.filter(s => ['REGISTRATA','APPROVATA'].includes(s.stato)).reduce((s, x) => s + (x.importo_netto || 0), 0)
  const totA = spese.filter(s => s.stato === 'IN_APPROVAZIONE').reduce((s, x) => s + (x.importo_netto || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>Registrate / approvate</p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>EUR {fmt(totR)}</p>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>In approvazione</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#d97706', margin: 0 }}>EUR {fmt(totA)}</p>
        </div>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>Totale voci</p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{spese.length}</p>
        </div>
      </div>
      {!showForm
        ? <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, border: '2px dashed #e5e7eb', borderRadius: 12, background: '#fafafa', fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
            <Plus size={16} /> Registra nuova spesa
          </button>
        : <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>Registra spesa di cantiere</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
              {TIPI.map(t => <button key={t.value} onClick={() => setTipo(t.value)} style={{ padding: '8px 4px', borderRadius: 8, border: tipo === t.value ? '2px solid #2563eb' : '1px solid #e5e7eb', background: tipo === t.value ? '#eff6ff' : '#fff', fontSize: 10, cursor: 'pointer', color: tipo === t.value ? '#2563eb' : '#6b7280' }}>{t.label}</button>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data</label><input type="date" value={dataSpesa} onChange={e => setDataSpesa(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Metodo</label><select value={metodo} onChange={e => setMetodo(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>{METODI.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Descrizione *</label><input value={descrizione} onChange={e => setDescrizione(e.target.value)} placeholder="Es: Viti e tasselli ferramenta Rossi" style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo netto</label><input type="number" step="0.01" value={importo} onChange={e => setImporto(e.target.value)} placeholder="0,00" style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>IVA %</label><select value={iva} onChange={e => setIva(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px' }}><option value="22">22%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0% esente</option></select></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Totale IVA incl.</label><div style={{ fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', background: '#f9fafb', textAlign: 'right', fontWeight: 500 }}>EUR {fmt(totale)}</div></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore (testo libero)</label><input value={fornitore} onChange={e => setFornitore(e.target.value)} placeholder="Es: Ferramenta Rossi, Copisteria..." style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            {richiedeApprovazione && importoNum > 0 && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                Importo superiore a EUR {SOGLIA} - richiede approvazione responsabile commessa
              </div>
            )}
            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowForm(false); setErr('') }} style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {saving && <Loader2 size={13} className="animate-spin" />}
                {richiedeApprovazione ? 'Invia per approvazione' : 'Registra spesa'}
              </button>
            </div>
          </div>
      }
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 96, gap: 8, color: '#9ca3af', fontSize: 14 }}><Loader2 size={16} className="animate-spin" /> Caricamento...</div>
        : <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Data','Tipo','Descrizione','Fornitore','Importo netto','Stato'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {spese.length === 0
                  ? <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nessuna spesa registrata</td></tr>
                  : spese.map(s => {
                      const t = TIPI.find(x => x.value === s.tipo)
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{s.data_spesa}</td>
                          <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 500, background: t?.bg, color: t?.color }}>{t?.label || s.tipo}</span></td>
                          <td style={{ padding: '10px 12px' }}>{s.descrizione}</td>
                          <td style={{ padding: '10px 12px', color: '#6b7280' }}>{s.fornitore_libero || '-'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>EUR {fmt(s.importo_netto)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {['REGISTRATA','APPROVATA'].includes(s.stato) ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
                              : s.stato === 'IN_APPROVAZIONE' ? <Clock size={16} style={{ color: '#d97706' }} />
                              : s.stato === 'RIFIUTATA' ? <XCircle size={16} style={{ color: '#dc2626' }} /> : null}
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
              {spese.length > 0 && (
                <tfoot><tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                  <td colSpan={4} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Totale registrate + approvate nel CE</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>EUR {fmt(totR)}</td>
                  <td />
                </tr></tfoot>
              )}
            </table>
          </div>
      }
    </div>
  )
}
