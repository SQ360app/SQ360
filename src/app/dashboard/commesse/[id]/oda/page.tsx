'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, FileText, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TIPI_ODA = [
  { value: 'SUBAPPALTO',     label: 'Subappalto',       bg: '#ede9fe', fg: '#7c3aed', ritenuta: 5 },
  { value: 'SUBAFFIDAMENTO', label: 'Subaffidamento',   bg: '#dbeafe', fg: '#1d4ed8', ritenuta: 0 },
  { value: 'MATERIALE',      label: 'Acquisto diretto', bg: '#d1fae5', fg: '#065f46', ritenuta: 0 },
  { value: 'SERVIZIO',       label: 'Servizio/Prof.',   bg: '#ffedd5', fg: '#92400e', ritenuta: 0 },
]

const STATI: Record<string, { label: string; color: string }> = {
  EMESSO:     { label: 'Emesso',      color: '#2563eb' },
  CONFERMATO: { label: 'Confermato',  color: '#4f46e5' },
  PARZ_EVASO: { label: 'Parz. evaso', color: '#d97706' },
  EVASO:      { label: 'Evaso',       color: '#059669' },
  ANNULLATO:  { label: 'Annullato',   color: '#dc2626' },
}

export default function ODAPage() {
  const { id } = useParams() as { id: string }
  const [oda, setOda] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tipo, setTipo] = useState('MATERIALE')
  const [oggetto, setOggetto] = useState('')
  const [fornitoreId, setFornitoreId] = useState('')
  const [importoNetto, setImportoNetto] = useState('')
  const [ivaPct, setIvaPct] = useState('22')
  const [ritenuta, setRitenuta] = useState('0')
  const [condPag, setCondPag] = useState('')
  const [dataConsegna, setDataConsegna] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const importoNum = parseFloat(importoNetto) || 0
  const totale = importoNum * (1 + parseFloat(ivaPct) / 100)
  const ritenutaImporto = importoNum * parseFloat(ritenuta) / 100

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('oda')
      .select('*, fornitore:fornitori(ragione_sociale)')
      .eq('commessa_id', id)
      .order('created_at', { ascending: false })
    const { data: forn } = await supabase.from('fornitori')
      .select('id, ragione_sociale').order('ragione_sociale')
    setOda(data || [])
    setFornitori(forn || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { setRitenuta(String(TIPI_ODA.find(x => x.value === tipo)?.ritenuta || 0)) }, [tipo])

  async function handleSave() {
    if (!oggetto.trim() || importoNum <= 0 || !fornitoreId) { setErr('Compila tutti i campi obbligatori'); return }
    setSaving(true)
    const { count } = await supabase.from('oda').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = 'ODA-' + new Date().getFullYear() + '-' + String((count || 0) + 1).padStart(3, '0')
    const { data: odaData, error } = await supabase.from('oda').insert({
      commessa_id: id, numero, tipo, oggetto: oggetto.trim(),
      fornitore_id: fornitoreId, importo_netto: importoNum,
      iva_pct: parseFloat(ivaPct), ritenuta_pct: parseFloat(ritenuta),
      condizioni_pagamento: condPag || null,
      data_consegna_prevista: dataConsegna || null,
      note: note || null, stato: 'EMESSO',
    }).select().single()
    if (error) { setErr(error.message); setSaving(false); return }
    if (tipo === 'SUBAPPALTO' && odaData) {
      const { data: cs } = await supabase.from('contratti_sub').insert({
        commessa_id: id, fornitore_id: fornitoreId, importo_netto: importoNum,
        ritenuta_pct: parseFloat(ritenuta), stato: 'BOZZA'
      }).select().single()
      if (cs) await supabase.from('oda').update({ contratto_sub_id: cs.id }).eq('id', odaData.id)
    }
    if (tipo === 'MATERIALE' && odaData) {
      const { data: dam } = await supabase.from('dam').insert({
        commessa_id: id, fornitore_id: fornitoreId,
        denominazione_materiale: oggetto.trim(), stato: 'BOZZA'
      }).select().single()
      if (dam) await supabase.from('oda').update({ dam_id: dam.id }).eq('id', odaData.id)
    }
    setSaving(false); setModalOpen(false)
    setOggetto(''); setFornitoreId(''); setImportoNetto(''); setNote('')
    await load()
  }

  async function cambiaStato(oid: string, stato: string) {
    await supabase.from('oda').update({ stato }).eq('id', oid); await load()
  }

  const totImpegnato = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s, o) => s + (o.importo_netto || 0), 0)
  const totRitenute  = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s, o) => s + (o.ritenuta_importo || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[['ODA emessi', String(oda.filter(o => o.stato !== 'ANNULLATO').length)],['Costi impegnati', 'EUR ' + fmt(totImpegnato)],['Ritenute accumulate', 'EUR ' + fmt(totRitenute)],['Da pagare netto', 'EUR ' + fmt(totImpegnato - totRitenute)]].map(([l, v], i) => (
          <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Ordini di Acquisto (ODA)</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Subappalto: contratto sub + ritenuta 5%. Materiale: DAM per DL (prerequisito accettazione).</p>
        </div>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={14} /> Nuovo ODA
        </button>
      </div>
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /> Caricamento...</div>
        : oda.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af' }}>
            <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>Nessun ordine emesso</p>
          </div>
        : oda.map(o => {
            const ti = TIPI_ODA.find(t => t.value === o.tipo)
            const si = STATI[o.stato]
            const isExp = expanded === o.id
            return (
              <div key={o.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isExp ? null : o.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
                  {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', width: 110, flexShrink: 0 }}>{o.numero}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, flexShrink: 0, background: ti?.bg || '#f3f4f6', color: ti?.fg || '#374151' }}>{ti?.label || o.tipo}</span>
                  <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.oggetto}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{o.fornitore?.ragione_sociale || '-'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, width: 130, textAlign: 'right', flexShrink: 0 }}>EUR {fmt(o.importo_netto)}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, flexShrink: 0, color: si?.color || '#374151', background: '#f3f4f6' }}>{si?.label}</span>
                </div>
                {isExp && (
                  <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 12, fontSize: 13 }}>
                      <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Data emissione</p><p style={{ margin: 0 }}>{o.data_emissione || '-'}</p></div>
                      <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Consegna prevista</p><p style={{ margin: 0 }}>{o.data_consegna_prevista || '-'}</p></div>
                      <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Pagamento</p><p style={{ margin: 0 }}>{o.condizioni_pagamento || '-'}</p></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                      <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Totale + IVA {o.iva_pct}%</p><p style={{ margin: 0 }}>EUR {fmt(o.importo_netto * (1 + (o.iva_pct || 22) / 100))}</p></div>
                      <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Ritenuta {o.ritenuta_pct || 0}%</p><p style={{ margin: 0, color: '#7c3aed', fontWeight: 500 }}>EUR {fmt(o.ritenuta_importo || 0)}</p></div>
                      <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Da pagare</p><p style={{ margin: 0, fontWeight: 600 }}>EUR {fmt(o.importo_netto - (o.ritenuta_importo || 0))}</p></div>
                    </div>
                    {(o.contratto_sub_id || o.dam_id) && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        {o.contratto_sub_id && <span style={{ fontSize: 11, padding: '4px 10px', background: '#ede9fe', color: '#7c3aed', borderRadius: 6 }}>Contratto sub generato</span>}
                        {o.dam_id && <span style={{ fontSize: 11, padding: '4px 10px', background: '#d1fae5', color: '#059669', borderRadius: 6 }}>DAM generato - richiede approvazione DL</span>}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Cambia stato:</span>
                      {['CONFERMATO', 'PARZ_EVASO', 'EVASO'].filter(s => s !== o.stato).map(s => (
                        <button key={s} onClick={() => cambiaStato(o.id, s)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>{STATI[s]?.label}</button>
                      ))}
                      <button onClick={() => cambiaStato(o.id, 'ANNULLATO')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626', marginLeft: 'auto' }}>Annulla ODA</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
      }
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 20 }}>Nuovo Ordine di Acquisto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
              {TIPI_ODA.map(t => (
                <button key={t.value} onClick={() => setTipo(t.value)} style={{ padding: '8px 4px', borderRadius: 8, border: tipo === t.value ? '2px solid #2563eb' : '1px solid #e5e7eb', background: tipo === t.value ? '#eff6ff' : '#fff', fontSize: 11, cursor: 'pointer' }}>{t.label}</button>
              ))}
            </div>
            {tipo === 'SUBAPPALTO' && <p style={{ fontSize: 11, padding: '8px 12px', background: '#ede9fe', color: '#7c3aed', borderRadius: 8, margin: '0 0 12px' }}>Genera contratto sub D.Lgs. 36/2023 con ritenuta 5%</p>}
            {tipo === 'MATERIALE' && <p style={{ fontSize: 11, padding: '8px 12px', background: '#d1fae5', color: '#059669', borderRadius: 8, margin: '0 0 12px' }}>Genera DAM — il DAM deve essere approvato dalla DL prima della consegna</p>}
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto *</label><input value={oggetto} onChange={e => setOggetto(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore *</label>
              <select value={fornitoreId} onChange={e => setFornitoreId(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                <option value="">Seleziona...</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo netto</label><input type="number" step="0.01" value={importoNetto} onChange={e => setImportoNetto(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>IVA %</label><select value={ivaPct} onChange={e => setIvaPct(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px' }}><option value="22">22%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option></select></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ritenuta %</label><input type="number" value={ritenuta} onChange={e => setRitenuta(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}><span>Totale + IVA</span><span style={{ fontWeight: 500 }}>EUR {fmt(totale)}</span></div>
              {ritenutaImporto > 0 && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7c3aed', fontSize: 11, marginTop: 4 }}><span>Ritenuta {ritenuta}%</span><span>- EUR {fmt(ritenutaImporto)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e5e7eb', marginTop: 6, paddingTop: 6 }}><span>Da pagare</span><span>EUR {fmt(importoNum - ritenutaImporto)}</span></div>
              </>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Condizioni pagamento</label><input value={condPag} onChange={e => setCondPag(e.target.value)} placeholder="30 gg. fine mese" style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Consegna prevista</label><input type="date" value={dataConsegna} onChange={e => setDataConsegna(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', resize: 'none', boxSizing: 'border-box' }} /></div>
            {err && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {saving && <Loader2 size={13} className="animate-spin" />} Crea ODA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
