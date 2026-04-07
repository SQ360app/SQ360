'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, X, AlertTriangle, CheckCircle, AlertCircle, Star } from 'lucide-react'
import { supabase, getAziendaId } from '@/lib/supabase'

type TipoFornitore = 'SUBA' | 'FORM' | 'NOLE' | 'PROF' | 'MIXS'

interface Fornitore {
  id: string
  codice: string
  tipo: TipoFornitore
  ragione_sociale: string
  partita_iva: string
  pec: string
  email: string
  telefono: string
  referente_nome: string
  referente_email: string
  referente_telefono: string
  soa_categorie: string
  soa_scadenza: string
  durc_scadenza: string
  patente_crediti_id: string
  patente_punteggio: number
  patente_scadenza: string
  rating: number
  note_interne: string
  attivo: boolean
  blacklist: boolean
  portale_attivo: boolean
  portale_email: string
}

const TIPO_META: Record<TipoFornitore, { label: string; color: string }> = {
  SUBA: { label: 'Subappaltatore', color: '#8b5cf6' },
  FORM: { label: 'Fornitore Materiali', color: '#10b981' },
  NOLE: { label: 'Noleggiatore', color: '#f59e0b' },
  PROF: { label: 'Professionista', color: '#3b82f6' },
  MIXS: { label: 'Misto Sub+Forn', color: '#ec4899' },
}

function statoScadenza(data: string) {
  if (!data) return null
  const giorni = Math.ceil((new Date(data).getTime() - Date.now()) / 86400000)
  if (giorni < 0) return { label: 'Scaduto', color: '#ef4444' }
  if (giorni <= 30) return { label: 'In scadenza', color: '#f59e0b' }
  return { label: 'Valido', color: '#10b981' }
}

const FORM_VUOTO = {
  tipo: 'SUBA' as TipoFornitore,
  ragione_sociale: '', partita_iva: '', pec: '', email: '', telefono: '',
  referente_nome: '', referente_email: '', referente_telefono: '',
  soa_categorie: '', soa_scadenza: '', durc_scadenza: '',
  patente_crediti_id: '', patente_punteggio: 100, patente_scadenza: '',
  rating: 3, note_interne: '', attivo: true, blacklist: false,
  portale_attivo: false, portale_email: '',
}

export default function FornitoriPage() {
  const [fornitori, setFornitori] = useState<Fornitore[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoFornitore | 'TUTTI'>('TUTTI')
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<'anagrafica' | 'documenti'>('anagrafica')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data, error } = await supabase.from('fornitori').select('*').order('ragione_sociale')
    if (!error && data) setFornitori(data)
    setLoading(false)
  }

  function setF(field: string, val: unknown) { setForm(prev => ({ ...prev, [field]: val })) }

  const filtered = fornitori.filter(f => {
    const matchSearch = !search || f.ragione_sociale?.toLowerCase().includes(search.toLowerCase()) || f.partita_iva?.includes(search) || f.codice?.toLowerCase().includes(search.toLowerCase())
    const matchTipo = filtroTipo === 'TUTTI' || f.tipo === filtroTipo
    return matchSearch && matchTipo
  })

  const fornitoreSelezionato = fornitori.find(f => f.id === selected) ?? null
  const inScadenza = fornitori.filter(f => { const s = statoScadenza(f.durc_scadenza); return s?.label === 'In scadenza' || s?.label === 'Scaduto' }).length

  async function salva() {
    if (!form.ragione_sociale.trim()) { setErrore('Ragione sociale obbligatoria'); return }
    setSaving(true); setErrore('')
    const aziendaId = await getAziendaId()
    const prog = fornitori.filter(f => f.tipo === form.tipo).length + 1
    const prefisso = form.tipo
    const codice = `${prefisso}${String(prog).padStart(3, '0')}`
    const { data, error } = await supabase.from('fornitori').insert([{ ...form, codice, progressivo: prog, azienda_id: aziendaId }]).select().single()
    if (error) { setErrore('Errore: ' + error.message); setSaving(false); return }
    setFornitori(prev => [...prev, data].sort((a, b) => a.ragione_sociale.localeCompare(b.ragione_sociale)))
    setSaving(false); setShowForm(false); setForm({ ...FORM_VUOTO })
  }

  const inp = { width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }
  const lbl = { fontSize: 10, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Fornitori & Documenti</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>{fornitori.length} fornitori · {inScadenza} con documenti in scadenza</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={16} /> Nuovo Fornitore
        </button>
      </div>

      {inScadenza > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={15} color="#f59e0b" />
          <span style={{ fontSize: 13, color: '#f59e0b' }}><strong>{inScadenza} fornitori</strong> con DURC/SOA in scadenza</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ragione sociale, P.IVA..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroTipo('TUTTI')} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroTipo === 'TUTTI' ? 'var(--accent)' : 'var(--panel)', color: filtroTipo === 'TUTTI' ? 'white' : 'var(--t2)' }}>Tutti</button>
          {(Object.keys(TIPO_META) as TipoFornitore[]).map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroTipo === t ? TIPO_META[t].color : 'var(--panel)', color: filtroTipo === t ? 'white' : 'var(--t2)' }}>{TIPO_META[t].label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>Caricamento dal database...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: fornitoreSelezionato ? '1fr 420px' : '1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(f => {
              const tm = TIPO_META[f.tipo] ?? TIPO_META.SUBA
              const durc = statoScadenza(f.durc_scadenza)
              const soa = statoScadenza(f.soa_scadenza)
              const isSelected = selected === f.id
              return (
                <div key={f.id} onClick={() => { setSelected(f.id === selected ? null : f.id); setTab('anagrafica') }}
                  style={{ background: 'var(--panel)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: tm.color, background: `${tm.color}15`, border: `1px solid ${tm.color}30`, borderRadius: 5, padding: '2px 7px' }}>{f.codice}</span>
                        <span style={{ fontSize: 10, color: tm.color }}>{tm.label}</span>
                        {f.portale_attivo && <span style={{ fontSize: 10, color: '#10b981' }}>● Portale attivo</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{f.ragione_sociale}</div>
                      {f.partita_iva && <div style={{ fontSize: 11, color: 'var(--t3)' }}>P.IVA: {f.partita_iva}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {durc && <span style={{ fontSize: 10, fontWeight: 600, color: durc.color, background: `${durc.color}15`, border: `1px solid ${durc.color}30`, borderRadius: 5, padding: '2px 7px' }}>DURC {durc.label}</span>}
                      {soa && <span style={{ fontSize: 10, fontWeight: 600, color: soa.color, background: `${soa.color}15`, border: `1px solid ${soa.color}30`, borderRadius: 5, padding: '2px 7px' }}>SOA {soa.label}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
                    {[1,2,3,4,5].map(s => <Star key={s} size={12} fill={s <= (f.rating || 0) ? '#f59e0b' : 'none'} color={s <= (f.rating || 0) ? '#f59e0b' : '#d1d5db'} />)}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && !loading && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12 }}>
                {fornitori.length === 0 ? 'Nessun fornitore. Clicca "Nuovo Fornitore" per aggiungerne uno.' : 'Nessun risultato.'}
              </div>
            )}
          </div>

          {fornitoreSelezionato && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: TIPO_META[fornitoreSelezionato.tipo]?.color, marginBottom: 3 }}>{fornitoreSelezionato.codice}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{fornitoreSelezionato.ragione_sociale}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>P.IVA: {fornitoreSelezionato.partita_iva || '—'} · {TIPO_META[fornitoreSelezionato.tipo]?.label}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}><X size={14} /></button>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {[{ key: 'anagrafica', label: '📋 Anagrafica' }, { key: 'documenti', label: '📁 Compliance' }].map(t => (
                  <button key={t.key} onClick={() => setTab(t.key as 'anagrafica' | 'documenti')} style={{ flex: 1, padding: '10px', border: 'none', borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t.label}</button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
                {tab === 'anagrafica' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Contatti</div>
                      {[
                        { label: 'Email', val: fornitoreSelezionato.email },
                        { label: 'PEC', val: fornitoreSelezionato.pec },
                        { label: 'Telefono', val: fornitoreSelezionato.telefono },
                        { label: 'Referente', val: fornitoreSelezionato.referente_nome },
                        { label: 'Email referente', val: fornitoreSelezionato.referente_email },
                      ].map(r => r.val ? (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{r.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--t1)' }}>{r.val}</span>
                        </div>
                      ) : null)}
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Valutazione</div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {[1,2,3,4,5].map(s => <Star key={s} size={20} fill={s <= (fornitoreSelezionato.rating || 0) ? '#f59e0b' : 'none'} color={s <= (fornitoreSelezionato.rating || 0) ? '#f59e0b' : '#d1d5db'} />)}
                      </div>
                      {fornitoreSelezionato.note_interne && <div style={{ fontSize: 12, color: 'var(--t2)' }}>{fornitoreSelezionato.note_interne}</div>}
                    </div>
                  </div>
                )}
                {tab === 'documenti' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: 'DURC', data: fornitoreSelezionato.durc_scadenza },
                      { label: 'SOA', data: fornitoreSelezionato.soa_scadenza },
                      { label: 'Patente a Crediti', data: fornitoreSelezionato.patente_scadenza },
                    ].map(doc => {
                      const stato = statoScadenza(doc.data)
                      return (
                        <div key={doc.label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{doc.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--t3)' }}>Scadenza: {doc.data || '—'}</div>
                          </div>
                          {stato && <span style={{ fontSize: 11, fontWeight: 600, color: stato.color, background: `${stato.color}15`, border: `1px solid ${stato.color}30`, borderRadius: 6, padding: '4px 10px' }}>{stato.label}</span>}
                        </div>
                      )
                    })}
                    {fornitoreSelezionato.soa_categorie && (
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Categorie SOA</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{fornitoreSelezionato.soa_categorie}</div>
                      </div>
                    )}
                    {fornitoreSelezionato.patente_crediti_id && (
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Patente a Crediti</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{fornitoreSelezionato.patente_crediti_id} · Punteggio: {fornitoreSelezionato.patente_punteggio}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, width: '100%', maxWidth: 700, padding: '28px 32px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Nuovo Fornitore</h2>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>
            {errore && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' }}>{errore}</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(Object.keys(TIPO_META) as TipoFornitore[]).map(t => (
                <button key={t} onClick={() => setF('tipo', t)} style={{ padding: '8px 14px', borderRadius: 8, border: `2px solid ${form.tipo === t ? TIPO_META[t].color : '#e2e8f0'}`, background: form.tipo === t ? `${TIPO_META[t].color}15` : '#f8fafc', color: form.tipo === t ? TIPO_META[t].color : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{TIPO_META[t].label}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Ragione sociale *</label><input value={form.ragione_sociale} onChange={e => setF('ragione_sociale', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>P.IVA</label><input value={form.partita_iva} onChange={e => setF('partita_iva', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>PEC</label><input value={form.pec} onChange={e => setF('pec', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Email</label><input value={form.email} onChange={e => setF('email', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Telefono</label><input value={form.telefono} onChange={e => setF('telefono', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Referente</label><input value={form.referente_nome} onChange={e => setF('referente_nome', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Email referente</label><input value={form.referente_email} onChange={e => setF('referente_email', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Categorie SOA</label><input value={form.soa_categorie} onChange={e => setF('soa_categorie', e.target.value)} placeholder="es. OG1 cl.III, OG11 cl.II" style={inp} /></div>
              <div><label style={lbl}>Scadenza SOA</label><input type="date" value={form.soa_scadenza} onChange={e => setF('soa_scadenza', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Scadenza DURC</label><input type="date" value={form.durc_scadenza} onChange={e => setF('durc_scadenza', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Patente Crediti ID</label><input value={form.patente_crediti_id} onChange={e => setF('patente_crediti_id', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Punteggio patente</label><input type="number" value={form.patente_punteggio} onChange={e => setF('patente_punteggio', +e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Rating (1-5)</label><input type="number" min={1} max={5} value={form.rating} onChange={e => setF('rating', +e.target.value)} style={inp} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Note interne</label><textarea value={form.note_interne} onChange={e => setF('note_interne', e.target.value)} style={{ ...inp, resize: 'vertical', minHeight: 60 }} /></div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#3b82f6', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvataggio...' : '✓ Crea fornitore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
