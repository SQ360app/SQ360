'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, X, Send, FileText, Upload, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase, getAziendaId } from '@/lib/supabase'

type StatoDAM = 'BOZZA' | 'INVIATO_DL' | 'APPROVATO' | 'APPROVATO_NOTE' | 'RIFIUTATO' | 'REV_1' | 'REV_2'

interface Certificazione {
  id: string
  categoria: string
  nome: string
  obbligatoria: boolean
  stato: string
  numero: string
  scadenza: string
  file_caricato: boolean
}

interface DAM {
  id: string
  codice: string
  revisione: number
  commessa_id: string
  fornitore_id: string
  materiale: string
  descrizione: string
  quantita: number
  um: string
  data_emissione: string
  data_risposta_dl: string
  stato: StatoDAM
  dl_nome: string
  dl_email: string
  note_dl: string
  note_interne: string
  certificazioni_dam?: Certificazione[]
}

const STATO_META: Record<StatoDAM, { label: string; color: string; icon: string }> = {
  BOZZA: { label: 'Bozza', color: '#6b7280', icon: '📝' },
  INVIATO_DL: { label: 'Inviato a DL', color: '#3b82f6', icon: '📤' },
  APPROVATO: { label: 'Approvato', color: '#10b981', icon: '✅' },
  APPROVATO_NOTE: { label: 'Approvato con note', color: '#f59e0b', icon: '📋' },
  RIFIUTATO: { label: 'Rifiutato', color: '#ef4444', icon: '❌' },
  REV_1: { label: 'Revisione 1', color: '#8b5cf6', icon: '🔄' },
  REV_2: { label: 'Revisione 2', color: '#ec4899', icon: '🔄' },
}

const CHECKLIST_DEFAULT = [
  { categoria: 'CAM', nome: 'Criteri Ambientali Minimi (D.M. 23/06/2022)', obbligatoria: true },
  { categoria: 'CAM', nome: 'Contenuto riciclato certificato (ISO 14021)', obbligatoria: false },
  { categoria: 'CAM', nome: 'EPD — Environmental Product Declaration', obbligatoria: false },
  { categoria: 'CE', nome: 'Marcatura CE (Reg. UE 305/2011)', obbligatoria: true },
  { categoria: 'CE', nome: 'Dichiarazione di Prestazione — DoP', obbligatoria: true },
  { categoria: 'SIC', nome: 'Scheda di Sicurezza SDS (Reg. CE 1907/2006)', obbligatoria: true },
  { categoria: 'TEC', nome: 'Scheda tecnica di prodotto', obbligatoria: true },
  { categoria: 'TEC', nome: 'Campione / prova di laboratorio', obbligatoria: false },
  { categoria: 'AMB', nome: 'Certificazione ISO 14001', obbligatoria: false },
]

const FORM_VUOTO = {
  materiale: '', descrizione: '', quantita: 0, um: 'nr',
  dl_nome: '', dl_email: '', note_interne: '',
}

export default function DAMPage() {
  const [dams, setDams] = useState<DAM[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState<StatoDAM | 'TUTTI'>('TUTTI')
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<'scheda' | 'certificazioni'>('scheda')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data, error } = await supabase
      .from('dam')
      .select('*, certificazioni_dam(*)')
      .order('created_at', { ascending: false })
    if (!error && data) setDams(data)
    setLoading(false)
  }

  function setF(field: string, val: unknown) { setForm(prev => ({ ...prev, [field]: val })) }

  const filtered = dams.filter(d => {
    const matchSearch = !search || d.materiale?.toLowerCase().includes(search.toLowerCase()) || d.codice?.toLowerCase().includes(search.toLowerCase())
    const matchStato = filtroStato === 'TUTTI' || d.stato === filtroStato
    return matchSearch && matchStato
  })

  const damSelezionato = dams.find(d => d.id === selected) ?? null
  const inAttesa = dams.filter(d => {
    if (d.stato !== 'INVIATO_DL') return false
    return (Date.now() - new Date(d.data_emissione).getTime()) / 86400000 > 5
  })

  async function salva() {
    if (!form.materiale.trim()) { setErrore('Materiale obbligatorio'); return }
    setSaving(true); setErrore('')
    const aziendaId = await getAziendaId()
    const codice = `DAM-${String(dams.length + 1).padStart(3, '0')}`
    const { data: damData, error: damError } = await supabase
      .from('dam')
      .insert([{ ...form, codice, revisione: 0, stato: 'BOZZA', azienda_id: aziendaId, data_emissione: new Date().toISOString().slice(0, 10) }])
      .select().single()
    if (damError) { setErrore('Errore: ' + damError.message); setSaving(false); return }
    // Crea certificazioni default
    const certs = CHECKLIST_DEFAULT.map(c => ({ ...c, dam_id: damData.id, stato: 'mancante', numero: '', file_caricato: false }))
    await supabase.from('certificazioni_dam').insert(certs)
    await carica()
    setSaving(false); setShowForm(false); setForm({ ...FORM_VUOTO }); setSelected(damData.id)
  }

  async function inviaDL(id: string) {
    await supabase.from('dam').update({ stato: 'INVIATO_DL', data_emissione: new Date().toISOString().slice(0, 10) }).eq('id', id)
    setDams(prev => prev.map(d => d.id === id ? { ...d, stato: 'INVIATO_DL' } : d))
  }

  async function toggleCert(damId: string, certId: string, statoAttuale: string) {
    const nuovoStato = statoAttuale === 'presente' ? 'mancante' : 'presente'
    await supabase.from('certificazioni_dam').update({ stato: nuovoStato, file_caricato: nuovoStato === 'presente' }).eq('id', certId)
    setDams(prev => prev.map(d => d.id !== damId ? d : {
      ...d, certificazioni_dam: d.certificazioni_dam?.map(c => c.id !== certId ? c : { ...c, stato: nuovoStato, file_caricato: nuovoStato === 'presente' })
    }))
  }

  const inp = { width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }
  const lbl = { fontSize: 10, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>DAM — Dossier Accettazione Materiali</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>Workflow completo con DL · Senza prezzi verso DL</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={16} /> Nuovo DAM
        </button>
      </div>

      {inAttesa.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={15} color="#f59e0b" />
          <span style={{ fontSize: 13, color: '#f59e0b' }}><strong>{inAttesa.length} DAM</strong> in attesa risposta DL da più di 5 giorni: {inAttesa.map(d => d.codice).join(', ')}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca materiale, codice..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroStato('TUTTI')} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroStato === 'TUTTI' ? 'var(--accent)' : 'var(--panel)', color: filtroStato === 'TUTTI' ? 'white' : 'var(--t2)' }}>Tutti</button>
          {(Object.keys(STATO_META) as StatoDAM[]).map(s => (
            <button key={s} onClick={() => setFiltroStato(s)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: filtroStato === s ? STATO_META[s].color : 'var(--panel)', color: filtroStato === s ? 'white' : 'var(--t2)' }}>
              {STATO_META[s].icon} {STATO_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>Caricamento dal database...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: damSelezionato ? '380px 1fr' : '1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(dam => {
              const sm = STATO_META[dam.stato]
              const certs = dam.certificazioni_dam ?? []
              const presenti = certs.filter(c => c.stato === 'presente').length
              const totali = certs.filter(c => c.stato !== 'non_applicabile').length
              const pct = totali > 0 ? Math.round((presenti / totali) * 100) : 0
              const isSelected = selected === dam.id
              const giorniAttesa = dam.stato === 'INVIATO_DL' ? Math.floor((Date.now() - new Date(dam.data_emissione).getTime()) / 86400000) : null
              return (
                <div key={dam.id} onClick={() => { setSelected(dam.id === selected ? null : dam.id); setTab('scheda') }}
                  style={{ background: 'var(--panel)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>{dam.codice}{dam.revisione > 0 ? ` Rev.${dam.revisione}` : ''}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: sm.color, background: `${sm.color}15`, border: `1px solid ${sm.color}30`, borderRadius: 5, padding: '2px 7px' }}>{sm.icon} {sm.label}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{dam.materiale}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{dam.quantita} {dam.um}</div>
                    </div>
                  </div>
                  {totali > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>Certificazioni</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }}>{presenti}/{totali}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)' }}>
                    <span>Emesso: {dam.data_emissione || '—'}</span>
                    {giorniAttesa !== null && <span style={{ color: giorniAttesa > 5 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>⏱ {giorniAttesa}gg senza risposta</span>}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && !loading && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12 }}>
                Nessun DAM. Clicca &quot;Nuovo DAM&quot; per crearne uno.
              </div>
            )}
          </div>

          {damSelezionato && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{damSelezionato.materiale}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{damSelezionato.codice} · {STATO_META[damSelezionato.stato].label}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}><X size={14} /></button>
              </div>
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {damSelezionato.stato === 'BOZZA' && (
                  <button onClick={() => inviaDL(damSelezionato.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Send size={13} /> Invia a DL
                  </button>
                )}
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>
                  <FileText size={13} /> PDF per DL
                </button>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {[
                  { key: 'scheda', label: '📋 Scheda' },
                  { key: 'certificazioni', label: `📁 Certificazioni (${(damSelezionato.certificazioni_dam ?? []).filter(c => c.stato === 'presente').length}/${(damSelezionato.certificazioni_dam ?? []).filter(c => c.stato !== 'non_applicabile').length})` },
                ].map(t => (
                  <button key={t.key} onClick={() => setTab(t.key as 'scheda' | 'certificazioni')} style={{ flex: 1, padding: '10px', border: 'none', borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t.label}</button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {tab === 'scheda' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                      {[
                        { label: 'Materiale', val: damSelezionato.materiale },
                        { label: 'Quantità', val: `${damSelezionato.quantita} ${damSelezionato.um}` },
                        { label: 'DL', val: damSelezionato.dl_nome },
                        { label: 'Email DL', val: damSelezionato.dl_email },
                        { label: 'Data invio', val: damSelezionato.data_emissione },
                        { label: 'Risposta DL', val: damSelezionato.data_risposta_dl },
                      ].map(r => r.val ? (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{r.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--t1)' }}>{r.val}</span>
                        </div>
                      ) : null)}
                    </div>
                    {damSelezionato.descrizione && (
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Descrizione tecnica</div>
                        <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{damSelezionato.descrizione}</div>
                      </div>
                    )}
                    {damSelezionato.note_dl && (
                      <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>📝 Note DL</div>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>{damSelezionato.note_dl}</div>
                      </div>
                    )}
                    {damSelezionato.stato === 'APPROVATO' && (
                      <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CheckCircle size={18} color="#10b981" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>Materiale approvato dalla DL</span>
                      </div>
                    )}
                  </div>
                )}
                {tab === 'certificazioni' && (
                  <div>
                    {['CAM', 'CE', 'SIC', 'TEC', 'AMB'].map(cat => {
                      const certs = (damSelezionato.certificazioni_dam ?? []).filter(c => c.categoria === cat)
                      if (certs.length === 0) return null
                      const nomi: Record<string, string> = { CAM: 'Criteri Ambientali Minimi', CE: 'Marcatura CE', SIC: 'Sicurezza', TEC: 'Tecnica', AMB: 'Ambiente' }
                      return (
                        <div key={cat} style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{nomi[cat]}</div>
                          <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            {certs.map((cert, i) => (
                              <div key={cert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < certs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <input type="checkbox" checked={cert.stato === 'presente'} onChange={() => toggleCert(damSelezionato.id, cert.id, cert.stato)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, color: cert.stato === 'presente' ? 'var(--t1)' : 'var(--t3)', fontWeight: cert.obbligatoria ? 600 : 400 }}>
                                    {cert.nome}{cert.obbligatoria && <span style={{ fontSize: 9, color: '#ef4444', marginLeft: 4 }}>*obbligatoria</span>}
                                  </div>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 600, color: cert.stato === 'presente' ? '#10b981' : '#ef4444', background: cert.stato === 'presente' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 5, padding: '2px 8px', flexShrink: 0 }}>
                                  {cert.stato === 'presente' ? 'Presente' : 'Mancante'}
                                </span>
                                <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--t2)', flexShrink: 0 }}>
                                  <Upload size={11} /> Carica
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, width: '100%', maxWidth: 600, padding: '28px 32px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Nuovo DAM</h2>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>
            {errore && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' }}>{errore}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>Materiale *</label><input value={form.materiale} onChange={e => setF('materiale', e.target.value)} placeholder="es. Calcestruzzo C28/35 XC2" style={inp} /></div>
              <div><label style={lbl}>Descrizione tecnica</label><textarea value={form.descrizione} onChange={e => setF('descrizione', e.target.value)} placeholder="Specifiche tecniche, classi, performance..." style={{ ...inp, resize: 'vertical', minHeight: 80 }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Quantità</label><input type="number" value={form.quantita} onChange={e => setF('quantita', +e.target.value)} style={inp} /></div>
                <div><label style={lbl}>U.M.</label>
                  <select value={form.um} onChange={e => setF('um', e.target.value)} style={{ ...inp, width: '100%' }}>
                    {['mc','mq','ml','kg','t','nr','corpo','lt'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Nome DL</label><input value={form.dl_nome} onChange={e => setF('dl_nome', e.target.value)} placeholder="Ing. Mario Rossi" style={inp} /></div>
              <div><label style={lbl}>Email DL</label><input value={form.dl_email} onChange={e => setF('dl_email', e.target.value)} placeholder="dl@ente.it" style={inp} /></div>
              <div><label style={lbl}>Note interne</label><input value={form.note_interne} onChange={e => setF('note_interne', e.target.value)} placeholder="Non visibili alla DL" style={inp} /></div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#3b82f6', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvataggio...' : '✓ Crea DAM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
