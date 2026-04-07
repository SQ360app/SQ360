'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, X, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase, getAziendaId } from '@/lib/supabase'

type StatoGara = 'IN_PREPARAZIONE' | 'PRESENTATA' | 'IN_ATTESA' | 'AGGIUDICATA' | 'NON_AGGIUDICATA' | 'ESCLUSA'
type TipoAggiudicazione = 'OEV' | 'PREZZO' | 'QUALITA'

interface Gara {
  id: string
  codice: string
  nome: string
  committente: string
  cig: string
  cup: string
  tipo_aggiudicazione: TipoAggiudicazione
  importo_base: number
  oneri_sicurezza: number
  importo_soggetto_ribasso: number
  ribasso_offerto: number
  importo_offerto: number
  scadenza_presentazione: string
  data_aggiudicazione: string
  stato: StatoGara
  provincia: string
  categoria_opera: string
  categoria_soa: string
  costo_interno_stimato: number
  margine_stimato: number
  margine_pct: number
  note: string
  commessa_collegata: string
}

const STATO_META: Record<StatoGara, { label: string; color: string }> = {
  IN_PREPARAZIONE: { label: 'In preparazione', color: '#6b7280' },
  PRESENTATA: { label: 'Presentata', color: '#3b82f6' },
  IN_ATTESA: { label: 'In attesa esito', color: '#f59e0b' },
  AGGIUDICATA: { label: 'Aggiudicata ✓', color: '#10b981' },
  NON_AGGIUDICATA: { label: 'Non aggiudicata', color: '#ef4444' },
  ESCLUSA: { label: 'Esclusa', color: '#ef4444' },
}

const TIPO_AGG_META: Record<TipoAggiudicazione, string> = {
  OEV: 'Offerta Economicamente Vantaggiosa',
  PREZZO: 'Minor Prezzo',
  QUALITA: 'Qualità',
}

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

const FORM_VUOTO = {
  nome: '', committente: '', cig: '', cup: '',
  tipo_aggiudicazione: 'PREZZO' as TipoAggiudicazione,
  importo_base: 0, oneri_sicurezza: 0, ribasso_offerto: 0,
  scadenza_presentazione: '', stato: 'IN_PREPARAZIONE' as StatoGara,
  provincia: 'NA', categoria_opera: 'NC', categoria_soa: '',
  costo_interno_stimato: 0, note: '',
}

export default function GarePage() {
  const [gare, setGare] = useState<Gara[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStato, setFiltroStato] = useState<StatoGara | 'TUTTI'>('TUTTI')
  const [selected, setSelected] = useState<string | null>(null)
  const [tabDettaglio, setTabDettaglio] = useState<'riepilogo' | 'simulatore' | 'voci'>('riepilogo')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...FORM_VUOTO })
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState('')
  // Simulatore ribasso
  const [simImporto, setSimImporto] = useState(0)
  const [simOneri, setSimOneri] = useState(0)
  const [simRibasso, setSimRibasso] = useState(10)
  const [simCosto, setSimCosto] = useState(0)

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    const { data, error } = await supabase.from('gare').select('*').order('created_at', { ascending: false })
    if (!error && data) setGare(data)
    setLoading(false)
  }

  function setF(field: string, val: unknown) { setForm(prev => ({ ...prev, [field]: val })) }

  const filtered = gare.filter(g => {
    const matchSearch = !search || g.nome?.toLowerCase().includes(search.toLowerCase()) || g.codice?.toLowerCase().includes(search.toLowerCase()) || g.committente?.toLowerCase().includes(search.toLowerCase())
    const matchStato = filtroStato === 'TUTTI' || g.stato === filtroStato
    return matchSearch && matchStato
  })

  const garaSelezionata = gare.find(g => g.id === selected) ?? null

  // KPI
  const inCorso = gare.filter(g => ['IN_PREPARAZIONE', 'PRESENTATA', 'IN_ATTESA'].includes(g.stato)).length
  const aggiudicate = gare.filter(g => g.stato === 'AGGIUDICATA').length
  const tassoSuccesso = gare.length > 0 ? Math.round((aggiudicate / gare.length) * 100) : 0
  const portafoglio = gare.filter(g => g.stato === 'AGGIUDICATA').reduce((s, g) => s + (g.importo_offerto || 0), 0)

  // Simulatore
  const simSoggetto = simImporto - simOneri
  const simOfferta = simImporto - (simSoggetto * simRibasso / 100)
  const simMargine = simOfferta - simCosto
  const simMarginePct = simOfferta > 0 ? (simMargine / simOfferta * 100) : 0
  const sogliAnom = simRibasso > 13

  useEffect(() => {
    if (garaSelezionata) {
      setSimImporto(garaSelezionata.importo_base || 0)
      setSimOneri(garaSelezionata.oneri_sicurezza || 0)
      setSimRibasso(garaSelezionata.ribasso_offerto || 10)
      setSimCosto(garaSelezionata.costo_interno_stimato || 0)
    }
  }, [garaSelezionata?.id])

  async function salva() {
    if (!form.nome.trim()) { setErrore('Nome gara obbligatorio'); return }
    setSaving(true); setErrore('')
    const aziendaId = await getAziendaId()
    const anno = new Date().getFullYear()
    const prog = gare.filter(g => g.codice?.startsWith(`GARA-${anno}`)).length + 1
    const codice = `GARA-${anno}-${String(prog).padStart(3, '0')}`
    const impSoggetto = form.importo_base - form.oneri_sicurezza
    const impOfferto = form.importo_base - (impSoggetto * form.ribasso_offerto / 100)
    const margine = impOfferto - form.costo_interno_stimato
    const marginePct = impOfferto > 0 ? (margine / impOfferto * 100) : 0
    const { data, error } = await supabase.from('gare').insert([{
      ...form, codice, azienda_id: aziendaId,
      importo_soggetto_ribasso: impSoggetto,
      importo_offerto: impOfferto,
      margine_stimato: margine,
      margine_pct: marginePct,
    }]).select().single()
    if (error) { setErrore('Errore: ' + error.message); setSaving(false); return }
    setGare(prev => [data, ...prev])
    setSaving(false); setShowForm(false); setForm({ ...FORM_VUOTO })
  }

  const inp = { width: '100%', boxSizing: 'border-box' as const, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }
  const lbl = { fontSize: 10, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>M1 — Analisi Gare</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0' }}>Gestione offerte, simulatore ribasso, analisi marginalità pre-gara</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={16} /> Nuova Gara
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Gare in corso', val: inCorso, sub: 'Da presentare o in attesa', color: '#f59e0b' },
          { label: 'Aggiudicate', val: aggiudicate, sub: `Tasso successo: ${tassoSuccesso}%`, color: '#10b981' },
          { label: 'Portafoglio acquisito', val: `€ ${fmt(portafoglio)}`, sub: 'Da gare aggiudicate', color: '#3b82f6' },
          { label: 'Totale gare', val: gare.length, sub: 'Nel periodo corrente', color: '#8b5cf6' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome, committente, CIG..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroStato('TUTTI')} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroStato === 'TUTTI' ? 'var(--accent)' : 'var(--panel)', color: filtroStato === 'TUTTI' ? 'white' : 'var(--t2)' }}>Tutti</button>
          {(Object.keys(STATO_META) as StatoGara[]).map(s => (
            <button key={s} onClick={() => setFiltroStato(s)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: filtroStato === s ? STATO_META[s].color : 'var(--panel)', color: filtroStato === s ? 'white' : 'var(--t2)' }}>{STATO_META[s].label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>Caricamento dal database...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: garaSelezionata ? '1fr 480px' : '1fr', gap: 16 }}>
          {/* Tabella gare */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Codice', 'Gara', 'Committente', 'Importo base', 'Ribasso', 'Offerto', 'Scadenza', 'Stato'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => {
                  const sm = STATO_META[g.stato]
                  const isSelected = selected === g.id
                  const giorni = g.scadenza_presentazione ? Math.ceil((new Date(g.scadenza_presentazione).getTime() - Date.now()) / 86400000) : null
                  return (
                    <tr key={g.id} onClick={() => { setSelected(g.id === selected ? null : g.id); setTabDettaglio('riepilogo') }}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent' }}>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>{g.codice}</span>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{g.nome}</div>
                        <div style={{ fontSize: 10, color: 'var(--t3)' }}>{g.categoria_opera} · {TIPO_AGG_META[g.tipo_aggiudicazione]?.split(' ')[0]}</div>
                      </td>
                      <td style={{ padding: '12px 12px', fontSize: 12, color: 'var(--t2)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.committente}</td>
                      <td style={{ padding: '12px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t2)', whiteSpace: 'nowrap' }}>€ {fmt(g.importo_base || 0)}</td>
                      <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, color: (g.ribasso_offerto || 0) > 13 ? '#ef4444' : '#10b981', whiteSpace: 'nowrap' }}>{(g.ribasso_offerto || 0).toFixed(3)}%</td>
                      <td style={{ padding: '12px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--t1)', whiteSpace: 'nowrap' }}>€ {fmt(g.importo_offerto || 0)}</td>
                      <td style={{ padding: '12px 12px', fontSize: 11, color: giorni !== null && giorni <= 7 ? '#ef4444' : 'var(--t3)', whiteSpace: 'nowrap' }}>
                        {g.scadenza_presentazione || '—'}
                        {giorni !== null && giorni >= 0 && giorni <= 30 && <div style={{ fontSize: 9, fontWeight: 600 }}>{giorni}gg</div>}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, background: `${sm.color}15`, color: sm.color, border: `1px solid ${sm.color}40`, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>{sm.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                {gare.length === 0 ? 'Nessuna gara. Clicca "Nuova Gara" per iniziare.' : 'Nessun risultato per i filtri selezionati.'}
              </div>
            )}
          </div>

          {/* Dettaglio */}
          {garaSelezionata && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', marginBottom: 3 }}>{garaSelezionata.codice}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{garaSelezionata.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{garaSelezionata.committente} · {garaSelezionata.provincia}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 7, cursor: 'pointer' }}><X size={14} /></button>
              </div>

              {/* Tab */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {[
                  { key: 'riepilogo', label: '📋 Riepilogo' },
                  { key: 'simulatore', label: '📊 Simulatore ribasso' },
                ].map(t => (
                  <button key={t.key} onClick={() => setTabDettaglio(t.key as 'riepilogo' | 'simulatore' | 'voci')} style={{ flex: 1, padding: '10px', border: 'none', borderBottom: tabDettaglio === t.key ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: tabDettaglio === t.key ? 'var(--accent)' : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t.label}</button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {tabDettaglio === 'riepilogo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Quadro Economico</div>
                      {[
                        { label: 'Importo base d\'asta', val: `€ ${fmt(garaSelezionata.importo_base || 0)}` },
                        { label: 'Oneri sicurezza', val: `€ ${fmt(garaSelezionata.oneri_sicurezza || 0)}` },
                        { label: 'Soggetto a ribasso', val: `€ ${fmt(garaSelezionata.importo_soggetto_ribasso || 0)}` },
                        { label: `Ribasso offerto (${garaSelezionata.ribasso_offerto || 0}%)`, val: `− € ${fmt((garaSelezionata.importo_soggetto_ribasso || 0) * (garaSelezionata.ribasso_offerto || 0) / 100)}` },
                        { label: 'IMPORTO OFFERTO', val: `€ ${fmt(garaSelezionata.importo_offerto || 0)}`, bold: true },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: (r as { bold?: boolean }).bold ? 700 : 400 }}>{r.label}</span>
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: (r as { bold?: boolean }).bold ? 800 : 500, color: (r as { bold?: boolean }).bold ? 'var(--accent)' : 'var(--t1)' }}>{r.val}</span>
                        </div>
                      ))}
                    </div>
                    {garaSelezionata.costo_interno_stimato > 0 && (
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Analisi marginalità</div>
                        {[
                          { label: 'Costo interno stimato', val: `€ ${fmt(garaSelezionata.costo_interno_stimato || 0)}`, color: '#ef4444' },
                          { label: 'Margine stimato', val: `€ ${fmt(garaSelezionata.margine_stimato || 0)}`, color: '#10b981' },
                          { label: 'Margine %', val: `${(garaSelezionata.margine_pct || 0).toFixed(2)}%`, color: '#10b981' },
                        ].map(r => (
                          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 12, color: 'var(--t2)' }}>{r.label}</span>
                            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: r.color }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'CIG', val: garaSelezionata.cig },
                        { label: 'Scadenza', val: garaSelezionata.scadenza_presentazione },
                        { label: 'Tipo aggiudicazione', val: TIPO_AGG_META[garaSelezionata.tipo_aggiudicazione] },
                        { label: 'Categoria SOA', val: garaSelezionata.categoria_soa },
                      ].map(r => r.val ? (
                        <div key={r.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>{r.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>{r.val}</div>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}

                {tabDettaglio === 'simulatore' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Parametri simulazione</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                        <div><label style={lbl}>Importo base (€)</label><input type="number" value={simImporto} onChange={e => setSimImporto(+e.target.value)} style={{ ...inp, background: '#f8fafc', color: '#1e293b' }} /></div>
                        <div><label style={lbl}>Oneri sicurezza (€)</label><input type="number" value={simOneri} onChange={e => setSimOneri(+e.target.value)} style={{ ...inp, background: '#f8fafc', color: '#1e293b' }} /></div>
                        <div><label style={lbl}>Costo interno stimato (€)</label><input type="number" value={simCosto} onChange={e => setSimCosto(+e.target.value)} style={{ ...inp, background: '#f8fafc', color: '#1e293b' }} /></div>
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <label style={lbl}>Ribasso offerto</label>
                          <span style={{ fontSize: 16, fontWeight: 800, color: sogliAnom ? '#ef4444' : '#10b981', fontFamily: 'var(--font-mono)' }}>{simRibasso.toFixed(3)}%</span>
                        </div>
                        <input type="range" min={0} max={30} step={0.1} value={simRibasso} onChange={e => setSimRibasso(+e.target.value)} style={{ width: '100%', accentColor: sogliAnom ? '#ef4444' : '#3b82f6' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                          <span>0%</span>
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>Soglia anomalia ~13%</span>
                          <span>30%</span>
                        </div>
                      </div>
                      {sogliAnom && (
                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ef4444' }}>
                          ⚠️ Ribasso superiore alla soglia di anomalia — rischio esclusione offerta
                        </div>
                      )}
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Risultato simulazione</div>
                      {[
                        { label: 'Importo offerto', val: `€ ${fmt(simOfferta)}`, color: 'var(--accent)' },
                        { label: 'Margine stimato', val: `€ ${fmt(simMargine)}`, color: simMargine >= 0 ? '#10b981' : '#ef4444' },
                        { label: 'Margine %', val: `${simMarginePct.toFixed(2)}%`, color: simMarginePct >= 5 ? '#10b981' : simMarginePct >= 0 ? '#f59e0b' : '#ef4444' },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>{r.label}</span>
                          <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 800, color: r.color }}>{r.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL NUOVA GARA */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, width: '100%', maxWidth: 720, padding: '28px 32px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Nuova Gara</h2>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>
            {errore && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' }}>{errore}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Nome gara *</label><input value={form.nome} onChange={e => setF('nome', e.target.value)} placeholder="es. Riqualificazione Palestra Comunale" style={inp} /></div>
              <div><label style={lbl}>Committente *</label><input value={form.committente} onChange={e => setF('committente', e.target.value)} placeholder="es. Comune di Napoli" style={inp} /></div>
              <div><label style={lbl}>CIG</label><input value={form.cig} onChange={e => setF('cig', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
              <div><label style={lbl}>Importo base asta (€)</label><input type="number" value={form.importo_base} onChange={e => setF('importo_base', +e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Oneri sicurezza (€)</label><input type="number" value={form.oneri_sicurezza} onChange={e => setF('oneri_sicurezza', +e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Ribasso offerto (%)</label><input type="number" step="0.001" value={form.ribasso_offerto} onChange={e => setF('ribasso_offerto', +e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Costo interno stimato (€)</label><input type="number" value={form.costo_interno_stimato} onChange={e => setF('costo_interno_stimato', +e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Scadenza presentazione</label><input type="date" value={form.scadenza_presentazione} onChange={e => setF('scadenza_presentazione', e.target.value)} style={inp} /></div>
              <div>
                <label style={lbl}>Tipo aggiudicazione</label>
                <select value={form.tipo_aggiudicazione} onChange={e => setF('tipo_aggiudicazione', e.target.value as TipoAggiudicazione)} style={{ ...inp, width: '100%' }}>
                  {(Object.keys(TIPO_AGG_META) as TipoAggiudicazione[]).map(t => <option key={t} value={t}>{TIPO_AGG_META[t]}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Stato</label>
                <select value={form.stato} onChange={e => setF('stato', e.target.value as StatoGara)} style={{ ...inp, width: '100%' }}>
                  {(Object.keys(STATO_META) as StatoGara[]).map(s => <option key={s} value={s}>{STATO_META[s].label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Categoria SOA</label><input value={form.categoria_soa} onChange={e => setF('categoria_soa', e.target.value)} placeholder="es. OG1 cl.III" style={inp} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Note</label><input value={form.note} onChange={e => setF('note', e.target.value)} style={inp} /></div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowForm(false); setErrore('') }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Annulla</button>
              <button onClick={salva} disabled={saving} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#3b82f6', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvataggio...' : '✓ Crea gara'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
