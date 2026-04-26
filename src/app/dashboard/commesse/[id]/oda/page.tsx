'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, FileText, Loader2, ChevronDown, ChevronRight,
         Truck, AlertTriangle, CheckCircle2, Clock, Shield } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtQ = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

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

const CLAUSOLA_STD = "La presente fornitura/lavorazione e' subordinata all'accettazione preventiva della Direzione Lavori (DL) ai sensi dell'art. 101 D.Lgs. 36/2023. Il Fornitore deve trasmettere, PRIMA dell'inizio della consegna: scheda tecnica del prodotto, Dichiarazione di Prestazione (DoP) ex Reg. UE 305/2011, certificato di conformita' CE. La fattura non potra' essere emessa ne' liquidata prima del rilascio del DAM firmato dalla DL."

// Componente Form DDT
function DDTForm({ odaId, commessaId, prezzoUnitario, um, onSaved, onCancel }: {
  odaId: string; commessaId: string; prezzoUnitario: number; um: string;
  onSaved: () => void; onCancel: () => void
}) {
  const [numeroDdt, setNumeroDdt] = useState('')
  const [dataDdt, setDataDdt] = useState(new Date().toISOString().split('T')[0])
  const [quantita, setQuantita] = useState('')
  const [accettatoDa, setAccettatoDa] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const qtaNum = parseFloat(quantita) || 0
  const importoConsegna = qtaNum * prezzoUnitario

  async function save() {
    if (!numeroDdt.trim()) { setErr('Numero DDT obbligatorio'); return }
    if (qtaNum <= 0) { setErr('Quantita non valida'); return }
    setSaving(true)
    const { error } = await supabase.from('oda_consegne').insert({
      oda_id: odaId, commessa_id: commessaId,
      numero_ddt: numeroDdt.trim(), data_ddt: dataDdt,
      quantita_consegnata: qtaNum, unita_misura: um,
      importo_consegna: importoConsegna,
      accettato_da: accettatoDa.trim() || null,
      note: note.trim() || null, stato: 'ACCETTATO',
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); onSaved()
  }

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, marginTop: 10 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: '#065f46' }}>Registra consegna (DDT)</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>N. DDT *</label>
          <input value={numeroDdt} onChange={e => setNumeroDdt(e.target.value)} placeholder="es. 001/2026"
            style={{ width: '100%', fontSize: 13, border: '1px solid #d1fae5', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Data DDT</label>
          <input type="date" value={dataDdt} onChange={e => setDataDdt(e.target.value)}
            style={{ width: '100%', fontSize: 13, border: '1px solid #d1fae5', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Quantita ({um})</label>
          <input type="number" step="0.001" value={quantita} onChange={e => setQuantita(e.target.value)}
            style={{ width: '100%', fontSize: 13, border: '1px solid #d1fae5', borderRadius: 6, padding: '6px 8px', textAlign: 'right', boxSizing: 'border-box' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Accettato da</label>
          <input value={accettatoDa} onChange={e => setAccettatoDa(e.target.value)} placeholder="Nome cognome responsabile"
            style={{ width: '100%', fontSize: 13, border: '1px solid #d1fae5', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Importo consegna (calcolato)</label>
          <div style={{ fontSize: 13, border: '1px solid #d1fae5', borderRadius: 6, padding: '6px 8px', background: '#f0fdf4', textAlign: 'right', fontWeight: 600 }}>
            EUR {fmt(importoConsegna)}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Note / Anomalie (slump test, contestazioni...)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          style={{ width: '100%', fontSize: 13, border: '1px solid #d1fae5', borderRadius: 6, padding: '6px 8px', resize: 'none', boxSizing: 'border-box' }} />
      </div>
      {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Annulla</button>
        <button onClick={save} disabled={saving} style={{ padding: '6px 14px', fontSize: 12, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: saving ? 0.6 : 1 }}>
          {saving && <Loader2 size={11} className="animate-spin" />} Registra DDT
        </button>
      </div>
    </div>
  )
}

// Componente singolo ODA con DDT tracking
function ODACard({ o, fornitori, commessaId, onRefresh }: {
  o: any; fornitori: any[]; commessaId: string; onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [consegne, setConsegne] = useState<any[]>([])
  const [loadingC, setLoadingC] = useState(false)
  const [showDDT, setShowDDT] = useState(false)

  const tipoInfo = TIPI_ODA.find(t => t.value === o.tipo)
  const statoInfo = STATI[o.stato]

  async function loadConsegne() {
    setLoadingC(true)
    const { data } = await supabase.from('oda_consegne').select('*').eq('oda_id', o.id).order('data_ddt')
    setConsegne(data || [])
    setLoadingC(false)
  }

  async function cambiaStato(stato: string) {
    await supabase.from('oda').update({ stato }).eq('id', o.id); onRefresh()
  }

  useEffect(() => { if (expanded) loadConsegne() }, [expanded])

  const totConsegnatoEur = consegne.reduce((s, c) => s + (c.importo_consegna || 0), 0)
  const totConsegnatoQta = consegne.reduce((s, c) => s + (c.quantita_consegnata || 0), 0)
  const qtaOrdinata = o.quantita_ordinata
  const prezzoUnitario = qtaOrdinata > 0 ? o.importo_netto / qtaOrdinata : o.importo_netto
  const pctConsegnato = qtaOrdinata > 0 
    ? Math.min(100, totConsegnatoQta / qtaOrdinata * 100)
    : o.importo_netto > 0 ? Math.min(100, totConsegnatoEur / o.importo_netto * 100) : 0

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: expanded ? '#f9fafb' : '#fff' }}>
        {expanded ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', width: 110, flexShrink: 0 }}>{o.numero}</span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, flexShrink: 0, background: tipoInfo?.bg || '#f3f4f6', color: tipoInfo?.fg || '#374151' }}>{tipoInfo?.label || o.tipo}</span>
        <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.oggetto}</span>
        {pctConsegnato > 0 && (
          <div style={{ flexShrink: 0, width: 80 }}>
            <div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: pctConsegnato >= 100 ? '#059669' : '#f59e0b', borderRadius: 4, width: pctConsegnato + '%' }} />
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'right', marginTop: 1 }}>{pctConsegnato.toFixed(0)}%</div>
          </div>
        )}
        <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{o.fornitore?.ragione_sociale || '-'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, width: 130, textAlign: 'right', flexShrink: 0 }}>EUR {fmt(o.importo_netto)}</span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, flexShrink: 0, color: statoInfo?.color || '#374151', background: '#f3f4f6' }}>{statoInfo?.label}</span>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
              <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px' }}>Importo netto ODA</p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>EUR {fmt(o.importo_netto)}</p>
            </div>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}>
              <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px' }}>Totale + IVA {o.iva_pct}%</p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>EUR {fmt(o.importo_netto * (1 + (o.iva_pct || 22) / 100))}</p>
            </div>
            {(o.ritenuta_pct || 0) > 0 && (
              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '8px 10px' }}>
                <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px' }}>Ritenuta {o.ritenuta_pct}%</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', margin: 0 }}>EUR {fmt(o.ritenuta_importo || 0)}</p>
              </div>
            )}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 10px' }}>
              <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px' }}>Consegnato (DDT)</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#059669', margin: 0 }}>EUR {fmt(totConsegnatoEur)}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#92400e' }}>
            <Shield size={14} style={{ flexShrink: 0, marginTop: 1, color: '#d97706' }} />
            <div>
              <strong>Clausola accettazione DL (art. 101 D.Lgs. 36/2023):</strong>{' '}
              {o.clausola_accettazione || CLAUSOLA_STD}
            </div>
          </div>
          {(o.contratto_sub_id || o.dam_id) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {o.contratto_sub_id && <span style={{ fontSize: 11, padding: '4px 10px', background: '#ede9fe', color: '#7c3aed', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12}/>Contratto sub</span>}
              {o.dam_id && <span style={{ fontSize: 11, padding: '4px 10px', background: '#d1fae5', color: '#059669', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/>DAM — attesa firma DL</span>}
            </div>
          )}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={14} style={{ color: '#6b7280' }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Consegne DDT</span>
                {qtaOrdinata > 0 && (
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    {fmtQ(totConsegnatoQta)} / {fmtQ(qtaOrdinata)} {o.unita_misura} ({pctConsegnato.toFixed(0)}%)
                  </span>
                )}
              </div>
              <button onClick={() => setShowDDT(!showDDT)} style={{ fontSize: 11, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                <Plus size={11}/> Aggiungi DDT
              </button>
            </div>
            {qtaOrdinata > 0 && (
              <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', background: pctConsegnato >= 100 ? '#059669' : '#f59e0b', borderRadius: 4, width: Math.min(100, pctConsegnato) + '%', transition: 'width 0.5s' }} />
              </div>
            )}
            {loadingC ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 8 }}>Caricamento...</div>
            ) : consegne.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 8, background: '#f9fafb', borderRadius: 6 }}>Nessun DDT registrato</div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['DDT N.','Data','Quantita','Importo','Accettato da','Stato'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {consegne.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 500 }}>{c.numero_ddt}</td>
                        <td style={{ padding: '6px 10px', color: '#6b7280' }}>{c.data_ddt}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtQ(c.quantita_consegnata)} {c.unita_misura}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>EUR {fmt(c.importo_consegna || 0)}</td>
                        <td style={{ padding: '6px 10px', color: '#6b7280' }}>{c.accettato_da || '-'}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 500,
                            background: c.stato === 'ACCETTATO' ? '#d1fae5' : c.stato === 'CONTESTATO' ? '#fee2e2' : '#fef3c7',
                            color: c.stato === 'ACCETTATO' ? '#059669' : c.stato === 'CONTESTATO' ? '#dc2626' : '#d97706' }}>
                            {c.stato}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                      <td colSpan={3} style={{ padding: '6px 10px', fontWeight: 600, fontSize: 11 }}>TOTALE CONSEGNATO</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>EUR {fmt(totConsegnatoEur)}</td>
                      <td colSpan={2}/>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {showDDT && (
              <DDTForm odaId={o.id} commessaId={commessaId} prezzoUnitario={prezzoUnitario}
                um={o.unita_misura || 'mc'}
                onSaved={() => { setShowDDT(false); loadConsegne(); onRefresh() }}
                onCancel={() => setShowDDT(false)} />
            )}
            {totConsegnatoEur > o.importo_netto * 1.02 && (
              <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, marginTop: 8, fontSize: 11, color: '#dc2626' }}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                ATTENZIONE: importo DDT supera ODA di EUR {fmt(totConsegnatoEur - o.importo_netto)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Stato:</span>
            {['CONFERMATO','PARZ_EVASO','EVASO'].filter(s => s !== o.stato).map(s => (
              <button key={s} onClick={() => cambiaStato(s)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>{STATI[s]?.label}</button>
            ))}
            <button onClick={() => cambiaStato('ANNULLATO')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626', marginLeft: 'auto' }}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Pagina principale ODA
export default function ODAPage() {
  const { id } = useParams() as { id: string }
  const [oda, setOda] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [tipo, setTipo] = useState('MATERIALE')
  const [oggetto, setOggetto] = useState('')
  const [fornitoreId, setFornitoreId] = useState('')
  const [importoNetto, setImportoNetto] = useState('')
  const [qtaOrdinata, setQtaOrdinata] = useState('')
  const [um, setUm] = useState('corpo')
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
  const prezzoUnitario = parseFloat(qtaOrdinata) > 0 ? importoNum / parseFloat(qtaOrdinata) : 0

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('oda')
      .select('*, fornitore:fornitori(ragione_sociale)')
      .eq('commessa_id', id).order('created_at', { ascending: false })
    const { data: forn } = await supabase.from('fornitori').select('id, ragione_sociale').order('ragione_sociale')
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
      quantita_ordinata: parseFloat(qtaOrdinata) || null,
      unita_misura: um || 'corpo',
      condizioni_pagamento: condPag || null,
      data_consegna_prevista: dataConsegna || null,
      note: note || null,
      clausola_accettazione: CLAUSOLA_STD,
      stato: 'EMESSO',
    }).select().single()
    if (error) { setErr(error.message); setSaving(false); return }
    if (tipo === 'SUBAPPALTO' && odaData) {
      const { data: cs } = await supabase.from('contratti_sub').insert({
        commessa_id: id, fornitore_id: fornitoreId, importo_netto: importoNum,
        ritenuta_pct: parseFloat(ritenuta), stato: 'BOZZA'
      }).select().single()
      if (cs) await supabase.from('oda').update({ contratto_sub_id: cs.id }).eq('id', odaData.id)
    }
    if ((tipo === 'MATERIALE' || tipo === 'SUBAFFIDAMENTO') && odaData) {
      const { data: dam } = await supabase.from('dam').insert({
        commessa_id: id, fornitore_id: fornitoreId,
        denominazione_materiale: oggetto.trim(), stato: 'IN_ATTESA'
      }).select().single()
      if (dam) await supabase.from('oda').update({ dam_id: dam.id }).eq('id', odaData.id)
    }
    setSaving(false); setModalOpen(false)
    setOggetto(''); setFornitoreId(''); setImportoNetto(''); setNote('')
    setQtaOrdinata(''); setUm('corpo')
    await load()
  }

  const totImpegnato = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s, o) => s + (o.importo_netto || 0), 0)
  const totRitenute = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s, o) => s + (o.ritenuta_importo || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          ['ODA emessi', String(oda.filter(o => o.stato !== 'ANNULLATO').length)],
          ['Costi impegnati', 'EUR ' + fmt(totImpegnato)],
          ['Ritenute accumulate', 'EUR ' + fmt(totRitenute)],
          ['Da pagare netto', 'EUR ' + fmt(totImpegnato - totRitenute)],
        ].map(([l, v], i) => (
          <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Ordini di Acquisto (ODA)</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>DDT tracking + clausola DL + 3-way match ODA-DDT-Fattura</p>
        </div>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={14}/> Nuovo ODA
        </button>
      </div>
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin"/> Caricamento...</div>
        : oda.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af' }}>
            <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>Nessun ordine emesso</p>
          </div>
        : oda.map(o => <ODACard key={o.id} o={o} fornitori={fornitori} commessaId={id} onRefresh={load}/>)
      }
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 20 }}>Nuovo Ordine di Acquisto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
              {TIPI_ODA.map(t => (
                <button key={t.value} onClick={() => setTipo(t.value)} style={{ padding: '8px 4px', borderRadius: 8, border: tipo === t.value ? '2px solid #2563eb' : '1px solid #e5e7eb', background: tipo === t.value ? '#eff6ff' : '#fff', fontSize: 11, cursor: 'pointer' }}>{t.label}</button>
              ))}
            </div>
            {tipo === 'SUBAPPALTO' && <div style={{ fontSize: 11, padding: '8px 12px', background: '#ede9fe', color: '#7c3aed', borderRadius: 8, margin: '0 0 12px' }}>Genera contratto sub D.Lgs. 36/2023 con ritenuta 5%</div>}
            {(tipo === 'MATERIALE' || tipo === 'SUBAFFIDAMENTO') && <div style={{ fontSize: 11, padding: '8px 12px', background: '#d1fae5', color: '#059669', borderRadius: 8, margin: '0 0 12px' }}>Genera DAM per accettazione DL — clausola art. 101 D.Lgs. 36/2023 inserita automaticamente</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto *</label>
              <input value={oggetto} onChange={e => setOggetto(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore *</label>
              <select value={fornitoreId} onChange={e => setFornitoreId(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                <option value="">Seleziona...</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo netto totale</label>
                <input type="number" step="0.01" value={importoNetto} onChange={e => setImportoNetto(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', textAlign: 'right', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Quantita ordinata</label>
                <input type="number" step="0.001" value={qtaOrdinata} onChange={e => setQtaOrdinata(e.target.value)} placeholder="es. 100"
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', textAlign: 'right', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Unita misura</label>
                <input value={um} onChange={e => setUm(e.target.value)} placeholder="mc / kg / m / corpo"
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', boxSizing: 'border-box' }} />
              </div>
            </div>
            {prezzoUnitario > 0 && (
              <div style={{ fontSize: 11, color: '#6b7280', background: '#f9fafb', borderRadius: 6, padding: '4px 10px', marginBottom: 12 }}>
                Prezzo unitario: EUR {fmt(prezzoUnitario)} / {um || 'u'}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>IVA %</label>
                <select value={ivaPct} onChange={e => setIvaPct(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                  <option value="22">22%</option><option value="10">10% (edilizia)</option><option value="4">4%</option><option value="0">0%</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ritenuta %</label>
                <input type="number" value={ritenuta} onChange={e => setRitenuta(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', textAlign: 'right', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}><span>Totale + IVA</span><span style={{ fontWeight: 500 }}>EUR {fmt(totale)}</span></div>
              {ritenutaImporto > 0 && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7c3aed', fontSize: 11, marginTop: 4 }}><span>Ritenuta {ritenuta}% (a collaudo)</span><span>- EUR {fmt(ritenutaImporto)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e5e7eb', marginTop: 6, paddingTop: 6 }}><span>Da pagare</span><span>EUR {fmt(importoNum - ritenutaImporto)}</span></div>
              </>}
            </div>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, fontSize: 11, color: '#92400e' }}>
              <strong>Clausola DL inserita automaticamente:</strong> {CLAUSOLA_STD.substring(0, 100)}...
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Condizioni pagamento</label>
                <input value={condPag} onChange={e => setCondPag(e.target.value)} placeholder="30 gg. fine mese"
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Consegna prevista</label>
                <input type="date" value={dataConsegna} onChange={e => setDataConsegna(e.target.value)}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', resize: 'none', boxSizing: 'border-box' }} />
            </div>
            {err && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {saving && <Loader2 size={13} className="animate-spin"/>} Crea ODA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}'use client'

import { useState, useEffect } from 'react'
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

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('oda').select('*, fornitore:fornitori(ragione_sociale)').eq('commessa_id', id).order('created_at', { ascending: false })
    const { data: forn } = await supabase.from('fornitori').select('id, ragione_sociale').order('ragione_sociale')
    setOda(data || [])
    setFornitori(forn || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { setRitenuta(String(TIPI_ODA.find(x => x.value === tipo)?.ritenuta || 0)) }, [tipo])

  async function handleSave() {
    if (!oggetto.trim() || importoNum <= 0 || !fornitoreId) { setErr('Compila tutti i campi obbligatori'); return }
    setSaving(true)
    const { count } = await supabase.from('oda').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = 'ODA-' + new Date().getFullYear() + '-' + String((count || 0) + 1).padStart(3, '0')
    const { data: odaData, error } = await supabase.from('oda').insert({
      commessa_id: id, numero, tipo, oggetto: oggetto.trim(),
      fornitore_id: fornitoreId, importo_netto: importoNum, iva_pct: parseFloat(ivaPct),
      ritenuta_pct: parseFloat(ritenuta), condizioni_pagamento: condPag || null,
      data_consegna_prevista: dataConsegna || null, note: note || null, stato: 'EMESSO',
    }).select().single()
    if (error) { setErr(error.message); setSaving(false); return }
    if (tipo === 'SUBAPPALTO' && odaData) {
      const { data: cs } = await supabase.from('contratti_sub').insert({ commessa_id: id, fornitore_id: fornitoreId, importo_netto: importoNum, ritenuta_pct: parseFloat(ritenuta), stato: 'BOZZA' }).select().single()
      if (cs) await supabase.from('oda').update({ contratto_sub_id: cs.id }).eq('id', odaData.id)
    }
    if (tipo === 'MATERIALE' && odaData) {
      const { data: dam } = await supabase.from('dam').insert({ commessa_id: id, fornitore_id: fornitoreId, denominazione_materiale: oggetto.trim(), stato: 'IN_ATTESA' }).select().single()
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
  const totRitenute = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s, o) => s + (o.ritenuta_importo || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[['ODA emessi', String(oda.filter(o => o.stato !== 'ANNULLATO').length)], ['Costi impegnati', 'EUR ' + fmt(totImpegnato)], ['Ritenute accumulate', 'EUR ' + fmt(totRitenute)], ['Da pagare netto', 'EUR ' + fmt(totImpegnato - totRitenute)]].map(([l, v], i) => (
          <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Ordini di Acquisto (ODA)</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Subappalto: contratto sub + ritenuta 5%. Materiale: DAM per DL.</p>
        </div>
        <button onClick={() => setModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={14} /> Nuovo ODA
        </button>
      </div>
      {loading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /> Caricamento...</div>
      : oda.length === 0 ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af' }}><FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><p style={{ fontSize: 14 }}>Nessun ordine emesso</p></div>
      : oda.map((o: any) => {
          const t = TIPI_ODA.find(x => x.value === o.tipo)
          return (
            <div key={o.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: expanded === o.id ? '#f9fafb' : '#fff' }} onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                {expanded === o.id ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', width: 110, flexShrink: 0 }}>{o.numero}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, flexShrink: 0, background: t?.bg || '#f3f4f6', color: t?.fg || '#374151' }}>{t?.label || o.tipo}</span>
                <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.oggetto}</span>
                <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{o.fornitore?.ragione_sociale || '-'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, width: 130, textAlign: 'right', flexShrink: 0 }}>EUR {fmt(o.importo_netto)}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600, flexShrink: 0, color: STATI[o.stato]?.color || '#374151', background: '#f3f4f6' }}>{STATI[o.stato]?.label}</span>
              </div>
              {expanded === o.id && (
                <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 12, fontSize: 13 }}>
                    <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Data</p><p style={{ margin: 0 }}>{o.data_emissione || '-'}</p></div>
                    <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Consegna</p><p style={{ margin: 0 }}>{o.data_consegna_prevista || '-'}</p></div>
                    <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Pagamento</p><p style={{ margin: 0 }}>{o.condizioni_pagamento || '-'}</p></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, fontSize: 13 }}>
                    <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Totale + IVA {o.iva_pct}%</p><p style={{ margin: 0 }}>EUR {fmt(o.importo_netto * (1 + (o.iva_pct || 22) / 100))}</p></div>
                    <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Ritenuta {o.ritenuta_pct || 0}%</p><p style={{ margin: 0, color: '#7c3aed', fontWeight: 500 }}>EUR {fmt(o.ritenuta_importo || 0)}</p></div>
                    <div><p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>Da pagare</p><p style={{ margin: 0, fontWeight: 600 }}>EUR {fmt(o.importo_netto - (o.ritenuta_importo || 0))}</p></div>
                  </div>
                  {(o.contratto_sub_id || o.dam_id) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {o.contratto_sub_id && <span style={{ fontSize: 11, padding: '4px 10px', background: '#ede9fe', color: '#7c3aed', borderRadius: 6 }}>Contratto sub generato</span>}
                      {o.dam_id && <span style={{ fontSize: 11, padding: '4px 10px', background: '#d1fae5', color: '#059669', borderRadius: 6 }}>DAM generato</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Stato:</span>
                    {['CONFERMATO','PARZ_EVASO','EVASO'].filter(s => s !== o.stato).map(s => (
                      <button key={s} onClick={() => cambiaStato(o.id, s)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>{STATI[s]?.label}</button>
                    ))}
                    <button onClick={() => cambiaStato(o.id, 'ANNULLATO')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626', marginLeft: 'auto' }}>Annulla</button>
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
              {TIPI_ODA.map(t => <button key={t.value} onClick={() => setTipo(t.value)} style={{ padding: '8px 4px', borderRadius: 8, border: tipo === t.value ? '2px solid #2563eb' : '1px solid #e5e7eb', background: tipo === t.value ? '#eff6ff' : '#fff', fontSize: 11, cursor: 'pointer' }}>{t.label}</button>)}
            </div>
            {tipo === 'SUBAPPALTO' && <p style={{ fontSize: 11, padding: '8px 12px', background: '#ede9fe', color: '#7c3aed', borderRadius: 8, margin: '0 0 12px' }}>Genera contratto sub D.Lgs. 36/2023 con ritenuta 5%</p>}
            {tipo === 'MATERIALE' && <p style={{ fontSize: 11, padding: '8px 12px', background: '#d1fae5', color: '#059669', borderRadius: 8, margin: '0 0 12px' }}>Genera DAM per accettazione materiali DL</p>}
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Oggetto *</label><input value={oggetto} onChange={e => setOggetto(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore *</label>
              <select value={fornitoreId} onChange={e => setFornitoreId(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                <option value="">Seleziona...</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo netto</label><input type="number" step="0.01" value={importoNetto} onChange={e => setImportoNetto(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>IVA %</label><select value={ivaPct} onChange={e => setIvaPct(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px' }}><option value="22">22%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option></select></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ritenuta %</label><input type="number" value={ritenuta} onChange={e => setRitenuta(e.target.value)} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 8px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}><span>Totale + IVA</span><span style={{ fontWeight: 500 }}>EUR {fmt(totale)}</span></div>
              {ritenutaImporto > 0 && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7c3aed', fontSize: 11, marginTop: 4 }}><span>Ritenuta {ritenuta}% (a collaudo)</span><span>- EUR {fmt(ritenutaImporto)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #e5e7eb', marginTop: 6, paddingTop: 6 }}><span>Da pagare</span><span>EUR {fmt(importoNum - ritenutaImporto)}</span></div>
              </>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Condizioni pagamento</label><input value={condPag} onChange={e => setCondPag(e.target.value)} placeholder="30 gg. data fattura" style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
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
