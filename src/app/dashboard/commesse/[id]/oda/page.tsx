'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, FileText, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

const fmt = (n: number) => Number(n||0).toLocaleString('it-IT', { minimumFractionDigits:2 })
const fLabel = (f: any) => f.ragione_sociale || ((f.nome||'')+' '+(f.cognome || '')).trim()

const TIPI_ODA = [
  { key:'MAT', label:'Fornitura Materiali', bg:'#eff6ff', fg:'#1d4ed8' },
  { key:'SUBAPPALTO', label:'Subappalto', bg:'#f5f3ff', fg:'#6d28d9' },
  { key:'NOLO', label:'Nolo', bg:'#fefce8', fg:'#854d0e' },
  { key:'MANODOPERA', label:'Manodopera', bg:'#f0fdf4', fg:'#14532d' },
  { key:'MIX', label:'Misto (mat.+lavoro)', bg:'#fff7ed', fg:'#9a3412' },
]

const STATI_ODA = [
  { key:'BOZZA', label:'Bozza'}, { key:'CONFERMATO', label:'Confermato' },
  { key:'PARZ_EVASO', label:'Parz. Evaso' }, { key:'EVASO', label:'Evaso' },
  { key:'ANNULLATO', label:'Annullato' },
]

export default function OdaPage() {
  const { id } = useParams() as { id: string }
  const [oda, setOda] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [rdoAggiudicate, setRdoAggiudicate] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tipo, setTipo] = useState('MAT')
  const [oggetto, setOggetto] = useState('')
  const [fornitoreId, setFornitoreId] = useState('')
  const [rdoId, setRdoId] = useState('')
  const [importoNetto, setImportoNetto] = useState('')
  const [iva, setIva] = useState('22')
  const [ritenuta, setRitenuta] = useState('0')
  const [condPag, setCondPag] = useState('')
  const [dataConsegna, setDataConsegna] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const importoNum = parseFloat(importoNetto) || 0
  const totale = importoNum * (1 + (parseFloat(iva)||0)/100)
  const ritenutaImp = importoNum * (parseFloat(ritenuta)||0) / 100

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: forn }, { data: rdoList }] = await Promise.all([
      supabase.from('oda').select('*').eq('commessa_id', id).order('created_at', { ascending: false }),
      supabase.from('professionisti_fornitori').select('id,ragione_sociale,nome,cognome').order('ragione_sociale'),
      supabase.from('rdo').select('id,codice,oggetto,tipo').eq('commessa_id', id).eq('stato','aggiudicata'),
    ])
    setOda(data || [])
    setFornitori(forn || [])
    setRdoAggiudicate(rdoList || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!oggetto.trim()) { setErr('Inserisci l\\oggetto'); return }
    if (!fornitoreId) { setErr('Seleziona un fornitore/appaltatore'); return }
    setSaving(true); setErr('')
    const { count } = await supabase.from('oda').select('*', { count:'exact', head:true }).eq('commessa_id', id)
    const numero = 'ODA-' + new Date().getFullYear() + '-' + String((count||0)+1).padStart(3,'0')
    const { data: odaData, error } = await supabase.from('oda').insert({
      commessa_id: id, numero, tipo, oggetto: oggetto.trim(),
      fornitore_id: fornitoreId, rdo_id: rdoId || null,
      importo_netto: importoNum, iva_pct: parseFloat(iva)||22, importo_totale: totale,
      ritenuta_pct: parseFloat(ritenuta)||0, ritenuta_importo: ritenutaImp,
      cond_pagamento: condPag, data_consegna: dataConsegna||null,
      note: note.trim(), stato: 'BOZZA'
    }).select().single()
    if (error) { setErr('Errore: ' + error.message); setSaving(false); return }
    // Se è forniture MAT o MIX → crea DAM automaticamente
    if (odaData && (tipo === 'MAT' || tipo === 'MIX')) {
      const forn = fornitori.find(f => f.id === fornitoreId)
      const { data: dam } = await supabase.from('certificazioni_dam').insert({
        commessa_id: id, oda_id: odaData.id,
        denominazione_materiale: oggetto.trim(),
        fornitore: fLabel(forn || {}),
        stato: 'BOZZA'
      }).select().single()
      if (dam) await supabase.from('oda').update({ dam_id: dam.id }).eq('id', odaData.id)
    }
    // Se RDO collegata → aggiorna rdo.oda_id
    if (rdoId) await supabase.from('rdo').update({ oda_id: odaData.id }).eq('id', rdoId)
    setSaving(false); setModalOpen(false)
    setOggetto(''); setFornitoreId(''); setRdoId(''); setImportoNetto(''); setNote('')
    load()
  }

  const cambiaStato = async (oda_item: any, stato: string) => {
    await supabase.from('oda').update({ stato }).eq('id', oda_item.id)
    load()
  }

  const totOda = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s,o) => s+(o.importo_totale||0), 0)
  const totEvasi = oda.filter(o => o.stato === 'EVASO').reduce((s,o) => s+(o.importo_totale||0), 0)
  const totRitenute = oda.filter(o => o.stato !== 'ANNULLATO').reduce((s,o) => s+(o.ritenuta_importo||0), 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          ['ODA Emessi', oda.filter(o=>o.stato!=='ANNULLATO').length, '#'],
          ['Valore totale', '€ '+fmt(totOda), '#'],
          ['Evasi', '€ '+fmt(totEvasi), '#'],
          ['Ritenute', '€ '+fmt(totRitenute), '#'],
        ].map(([l,v]) => (
          <div key={l} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px' }}>
            <p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase', margin:0 }}>{l}</p>
            <p style={{ fontSize:20, fontWeight:800, color:'var(--t1)', margin:'4px 0 0' }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Header azioni */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ fontSize:15, fontWeight:700, margin:0 }}>Ordini di Acquisto</h2>
        <button onClick={() => setModalOpen(true)} className="btn-primary" style={{ fontSize:12, padding:'8px 14px', display:'flex', alignItems:'center', gap:6 }}>
          <Plus size={14} /> Nuovo ODA
        </button>
      </div>

      {/* Lista ODA */}
      {loading ? <div style={{ textAlign:'center', padding:40 }}><Loader2 className="spin" size={24} /></div>
      : oda.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:160, color:'#9ca3af', background:'var(--panel)', borderRadius:12, border:'1px solid var(--border)' }}>
          <FileText size={40} style={{ marginBottom:12, opacity:0.3 }} />
          <p style={{ fontSize:14 }}>Nessun ordine emesso</p>
          <p style={{ fontSize:12 }}>Crea il primo ODA dalla RDO aggiudicata</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {oda.map(o => {
            const ti = TIPI_ODA.find(t => t.key === o.tipo)
            const st = STATI_ODA.find(s => s.key === o.stato)
            const isOpen = expanded === o.id
            return (
              <div key={o.id} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', gap:12, cursor:'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : o.id)}>
                  {isOpen ? <ChevronDown size={16} color=\"var(--t3)\" /> : <ChevronRight size={16} color=\"var(--t3)\" />}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>{o.numero}</span>
                      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:12, fontWeight:600, background:ti?.bg||''  , color:ti?.fg||''  }}>{ti?.label||o.tipo}</span>
                      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:12, fontWeight:600, background:'#f3f4f6', color:'#374151' }}>{st?.label||o.stato}</span>
                    </div>
                    <p style={{ fontSize:12, color:'var(--t2)', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.oggetto}</p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:14, fontWeight:700, margin:0 }}>€ {fmt(o.importo_totale||0)}</p>
                    {o.data_consegna && <p style={{ fontSize:10, color:'var(--t3)', margin:'2px 0 0' }}>{new Date(o.data_consegna).toLocaleDateString('it-IT')}</p>}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop:'1px solid var(--border)', padding:'12px 16px', background:'var(--bg)' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                      {[
                        ['Importo netto', '€ '+fmt(o.importo_netto||0)],
                        ['IVA '+o.iva_pct+'%', '€ '+fmt((o.importo_netto||0)*(o.iva_pct||22)/100)],
                        ['Totale IVA inclusa', '€ '+fmt(o.importo_totale||0)],
                        ['Ritenuta '+o.ritenuta_pct+'%', '€ '+fmt(o.ritenuta_importo||0)],
                        ['Netto a pagare', '€ '+fmt((o.importo_totale||0)-(o.ritenuta_importo||0))],
                        ['Cond. Pagamento', o.cond_pagamento||'—'],
                      ].map(([l,v]) => <div key={l}><p style={{ fontSize:10, color:'var(--t3)', fontWeight:700, margin:0 }}>{l}</p><p style={{ fontSize:13, margin:'2px 0 0' }}>{v}</p></div>)}
                    </div>
                    {o.note && <p style={{ fontSize:12, color:'var(--t2)', fontStyle:'italic', marginBottom:12 }}>{o.note}</p>}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                      <span style={{ fontSize:11, color:'#6b7280' }}>Cambia stato:</span>
                      {['CONFERMATO', 'PARZ_EVASO', 'EVASO', 'ANNULLATO'].filter(s => s !== o.stato).map(s => (
                        <button key={s} onClick={() => cambiaStato(o, s)}
                          style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--panel)', cursor:'pointer' }}>
                          {STATI_ODA.find(x=>x.key===s)?.label||s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL NUOVO ODA */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target===e.currentTarget) setModalOpen(false) }}>
          <div className="modal-box" style={{ maxWidth:560, width:'95%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>Nuovo Ordine di Acquisto</h3>
              <button onClick={() => setModalOpen(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Tipo */}
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:6 }}>Tipo ordine *</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {TIPI_ODA.map(t => (
                    <button key={t.key} onClick={() => setTipo(t.key)}
                      style={{ padding:'6px 12px', borderRadius:8, border:'2px solid ' + (tipo===t.key ? t.fg : 'var(--border)'), background:tipo===t.key?t.bg:'var(--panel)', color:tipo===t.key?t.fg:'var(--t2)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* RDO aggiudicata */}
              {rdoAggiudicate.length > 0 && (
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>RDO aggiudicata collegata (opzionale)</label>
                  <select value={rdoId} onChange={e => setRdoId(e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, background:'var(--panel)', color:'var(--t1)', outline:'none' }}>
                    <option value="">— Nessuna RDO collegata —</option>
                    {rdoAggiudicate.map(r => <option key={r.id} value={r.id}>{r.codice} — {r.oggetto}</option>)}
                  </select>
                </div>
              )}
              {/* Oggetto */}
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>Oggetto *</label>
                <input value={oggetto} onChange={e => setOggetto(e.target.value)}
                  placeholder="Descrivi cosa si ordina/appalta/nola..."
                  style={{ width:'100%', fontSize:12, border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', background:'var(--panel)', color:'var(--t1)', outline:'none' }} />
              </div>
              {/* Fornitore/Appaltatore */}
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>
                  {tipo === 'SUBAPPALTO' ? 'Subappaltatore *' : tipo === 'NOLO' ? 'Noleggiatore *' : tipo === 'MANODOPERA' ? 'Fornitore manodopera *' : 'Fornitore *'}
                </label>
                <select value={fornitoreId} onChange={e => setFornitoreId(e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, background:'var(--panel)', color:'var(--t1)', outline:'none' }}>
                  <option value="">— Seleziona dal database Contatti —</option>
                  {fornitori.map(f => <option key={f.id} value={f.id}>{fLabel(f)}</option>)}
                </select>
              </div>
              {/* Importi */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>Importo netto (€) *</label>
                  <input type="number" step="0.01" value={importoNetto} onChange={e => setImportoNetto(e.target.value)}
                    style={{ width:'100%', fontSize:12, border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', background:'var(--panel)', color:'var(--t1)', outline:'none' }} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>IVA %</label>
                  <select value={iva} onChange={e => setIva(e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, background:'var(--panel)', color:'var(--t1)', outline:'none' }}>
                    {['0','4','5','10','22'].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>Ritenuta %</label>
                  <select value={ritenuta} onChange={e => setRitenuta(e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, background:'var(--panel)', color:'var(--t1)', outline:'none' }}>
                    {['0','4','20'].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
              </div>
              {/* Riepilogo importi */}
              {importoNum > 0 && (
                <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 12px', border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:'var(--t3)' }}>Totale IVA inclusa:</span>
                    <span style={{ fontWeight:700 }}>€ {fmt(totale)}</span>
                  </div>
                  {ritenutaImp > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:4 }}>
                    <span style={{ color:'var(--t3)' }}>Netto a pagare:</span>
                    <span style={{ fontWeight:700 }}>€ {fmt(totale - ritenutaImp)}</span>
                  </div>}
                </div>
              )}
              {/* Data consegna e note */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>Data consegna/esecuzione</label>
                  <input type="date" value={dataConsegna} onChange={e => setDataConsegna(e.target.value)}
                    style={{ width:'100%', fontSize:12, border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', background:'var(--panel)', color:'var(--t1)', outline:'none' }} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>Condizioni pagamento</label>
                  <select value={condPag} onChange={e => setCondPag(e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, background:'var(--panel)', color:'var(--t1)', outline:'none' }}>
                    <option value="">—</option>
                    {['30 gg d.f.f.m.','60 gg d.f.f.m.','90 gg d.f.f.m.','Bonifico anticipato','Contrassegno','SAL'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--t2)', display:'block', marginBottom:4 }}>Note</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                  style={{ width:'100%', fontSize:12, border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', background:'var(--panel)', color:'var(--t1)', outline:'none', resize:'vertical' }} />
              </div>
              {err && <p style={{ color:'#ef4444', fontSize:12 }}>{err}</p>}
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => setModalOpen(false)} style={{ padding:'9px 18px', border:'1px solid var(--border)', borderRadius:8, background:'none', cursor:'pointer', fontSize:13 }}>Annulla</button>
                <button onClick={submit} disabled={saving} className="btn-primary" style={{ fontSize:13, padding:'9px 18px' }}>
                  {saving ? <><Loader2 size={14} className="spin" /> Salvataggio...</> : 'Crea ODA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
