'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'
import { Loader2, AlertTriangle } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const CATEGORIE_MIGLIORIA = [
  { value: 'tecnica',     label: 'Tecnica',      color: '#3b82f6' },
  { value: 'temporale',  label: 'Temporale',    color: '#8b5cf6' },
  { value: 'qualitativa',label: 'Qualitativa',  color: '#10b981' },
  { value: 'ambientale', label: 'Ambientale',   color: '#059669' },
  { value: 'sociale',    label: 'Sociale',      color: '#f59e0b' },
]

const STATI_MIGLIORIA = [
  { value: 'contrattuale',  label: 'Contrattuale',   color: '#3b82f6' },
  { value: 'da_eseguire',   label: 'Da eseguire',    color: '#6b7280' },
  { value: 'in_esecuzione', label: 'In esecuzione',  color: '#f59e0b' },
  { value: 'completata',    label: 'Completata',     color: '#10b981' },
  { value: 'verificata_dl', label: 'Verificata DL',  color: '#7c3aed' },
]

function getNextStato(stato: string): { value: string; label: string; color: string } | null {
  switch (stato) {
    case 'contrattuale':  return { value: 'da_eseguire',   label: 'Avvia',       color: '#6b7280' }
    case 'da_eseguire':   return { value: 'in_esecuzione', label: 'Inizia esecuzione', color: '#f59e0b' }
    case 'in_esecuzione': return { value: 'completata',    label: 'Completa',    color: '#10b981' }
    case 'completata':    return { value: 'verificata_dl', label: 'Verifica DL', color: '#7c3aed' }
    default:              return null
  }
}

interface Miglioria {
  id: string; gara_id?: string; commessa_id?: string
  categoria: string; descrizione: string
  costo_stimato: number; costo_effettivo?: number
  punteggio_tecnico_stimato: number
  note?: string; offerta: boolean; fase: string; stato?: string
  os_id?: string; variante_id?: string
  _source?: 'diretta' | 'da_gara'
}

export default function MigliorieCommessaPage({ params: pp }: { params: Promise<{ id: string }> }) {
  const { id } = use(pp)

  const [migliorie,   setMigliorie]   = useState<Miglioria[]>([])
  const [importoComm, setImportoComm] = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState<string | null>(null)
  const [costoEdit,   setCostoEdit]   = useState<Record<string, string>>({})

  // Form aggiungi
  const [formOpen,  setFormOpen]  = useState(false)
  const [fCat,      setFCat]      = useState('tecnica')
  const [fDesc,     setFDesc]     = useState('')
  const [fCosto,    setFCosto]    = useState('')
  const [fNote,     setFNote]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: comm }, { data: gareList }] = await Promise.all([
      supabase.from('commesse').select('importo_contratto').eq('id', id).single(),
      supabase.from('gare').select('id').eq('commessa_id', id),
    ])
    setImportoComm(comm?.importo_contratto || 0)

    const gareIds = (gareList || []).map((g: any) => g.id)

    // Migliorie dirette sulla commessa
    const { data: dirette } = await supabase.from('migliorie').select('*').eq('commessa_id', id)

    // Migliorie ereditate dalla gara (offerta=true, non già legate a questa commessa)
    let daGara: Miglioria[] = []
    if (gareIds.length > 0) {
      const { data: viaGara } = await supabase.from('migliorie').select('*').in('gara_id', gareIds).eq('offerta', true).is('commessa_id', null)
      daGara = (viaGara || []).map((m: any) => ({ ...m, _source: 'da_gara' as const }))
    }

    const diretteTagged = (dirette || []).map((m: any) => ({ ...m, _source: 'diretta' as const }))
    setMigliorie([...diretteTagged, ...daGara] as Miglioria[])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function avanzaStato(m: Miglioria, nuovoStato: string) {
    setSaving(m.id)
    if (m._source === 'da_gara') {
      // Prima "adotta" la miglioria collegandola alla commessa
      const aziendaId = await getAziendaId()
      await supabase.from('migliorie').update({ commessa_id: id, stato: nuovoStato, azienda_id: aziendaId || null }).eq('id', m.id)
    } else {
      await supabase.from('migliorie').update({ stato: nuovoStato }).eq('id', m.id)
    }
    setSaving(null); await load()
  }

  async function aggiornaCostoEffettivo(m: Miglioria, val: string) {
    const n = parseFloat(val) || 0
    await supabase.from('migliorie').update({ costo_effettivo: n }).eq('id', m.id)
    setMigliorie(prev => prev.map(x => x.id === m.id ? { ...x, costo_effettivo: n } : x))
    setCostoEdit(prev => { const n2 = { ...prev }; delete n2[m.id]; return n2 })
  }

  async function aggiungiMiglioria() {
    if (!fDesc.trim()) return
    const aziendaId = await getAziendaId()
    const { data } = await supabase.from('migliorie').insert({
      commessa_id: id, azienda_id: aziendaId || null,
      categoria: fCat, descrizione: fDesc.trim(),
      costo_stimato: parseFloat(fCosto) || 0,
      punteggio_tecnico_stimato: 0,
      note: fNote || null, offerta: true, fase: 'commessa', stato: 'contrattuale',
    }).select().single()
    if (data) setMigliorie(prev => [...prev, { ...data as Miglioria, _source: 'diretta' }])
    setFormOpen(false); setFDesc(''); setFCosto(''); setFNote('')
  }

  // KPI
  const costoStimatoTot  = migliorie.reduce((s, m) => s + (m.costo_stimato || 0), 0)
  const costoEffTot      = migliorie.reduce((s, m) => s + (m.costo_effettivo || 0), 0)
  const completate       = migliorie.filter(m => ['completata', 'verificata_dl'].includes(m.stato || '')).length
  const inEsecuzione     = migliorie.filter(m => m.stato === 'in_esecuzione').length
    const daFare           = migliorie.filter(m => !m.stato || m.stato === 'contrattuale' || m.stato === 'da_eseguire').length
  const impattoPerc      = importoComm > 0 ? (costoStimatoTot / importoComm) * 100 : 0

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:8, color:'#9ca3af' }}>
      <Loader2 size={18} style={{ animation:'spin 1s linear infinite' }} /> Caricamento migliorie...
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Banner impatto CE */}
      {costoStimatoTot > 0 && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:10, fontSize:12 }}>
          <AlertTriangle size={16} style={{ color:'#dc2626', flexShrink:0, marginTop:1 }} />
          <div>
            <span style={{ fontWeight:700, color:'#991b1b' }}>⚠️ Le migliorie riducono il margine reale.</span>
            <span style={{ color:'#7f1d1d', marginLeft:6 }}>
              Costo stimato non remunerato: <strong>€ {fmt(costoStimatoTot)}</strong>
              {' · '}Impatto su margine commessa: <strong>−{impattoPerc.toFixed(1)}%</strong>
            </span>
          </div>
        </div>
      )}

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {[
          { l:'Migliorie totali',  v: String(migliorie.length),       c:'#374151', alert:false },
          { l:'Costo stimato',     v:'€ ' + fmt(costoStimatoTot),     c:'#dc2626', alert:costoStimatoTot>0 },
          { l:'Costo effettivo',   v:'€ ' + fmt(costoEffTot),         c:'#7c3aed', alert:costoEffTot > costoStimatoTot },
          { l:'Completate',        v: `${completate}/${migliorie.length}`, c:'#059669', alert:false },
          { l:'In esecuzione',     v: String(inEsecuzione),           c:'#f59e0b', alert:false },
        ].map(item => (
          <div key={item.l} style={{ background: item.alert ? '#fef2f2' : '#f9fafb', border:'1px solid ' + (item.alert ? '#fca5a5' : '#e5e7eb'), borderRadius:8, padding:'8px 12px' }}>
            <p style={{ fontSize:10, color:'#6b7280', margin:'0 0 2px' }}>{item.l}</p>
            <p style={{ fontSize:15, fontWeight:700, margin:0, color:item.c }}>{item.v}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontSize:15, fontWeight:600, margin:0 }}>Migliorie contrattuali</h2>
          <p style={{ fontSize:11, color:'#6b7280', margin:'2px 0 0' }}>Tracking esecuzione · Costi effettivi · Verifica DL</p>
        </div>
        <button onClick={() => setFormOpen(true)}
          style={{ fontSize:12, padding:'7px 14px', background:'#2563eb', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
          + Aggiungi miglioria
        </button>
      </div>

      {/* Form aggiungi */}
      {formOpen && (
        <div style={{ padding:14, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, display:'flex', flexDirection:'column', gap:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#1e40af' }}>Nuova miglioria contrattuale</span>
          <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 110px', gap:8 }}>
            <div>
              <label style={{ fontSize:10, color:'#6b7280', display:'block', marginBottom:2 }}>Categoria</label>
              <select value={fCat} onChange={e => setFCat(e.target.value)} style={{ fontSize:12, border:'1px solid #d1d5db', borderRadius:6, padding:'5px 8px', width:'100%' }}>
                {CATEGORIE_MIGLIORIA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:'#6b7280', display:'block', marginBottom:2 }}>Descrizione *</label>
              <input value={fDesc} onChange={e => setFDesc(e.target.value)} style={{ fontSize:12, border:'1px solid #d1d5db', borderRadius:6, padding:'5px 8px', width:'100%', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:10, color:'#6b7280', display:'block', marginBottom:2 }}>Costo stimato €</label>
              <input type="number" value={fCosto} onChange={e => setFCosto(e.target.value)} style={{ fontSize:12, border:'1px solid #d1d5db', borderRadius:6, padding:'5px 8px', width:'100%', textAlign:'right', boxSizing:'border-box' }} />
            </div>
          </div>
          <input value={fNote} onChange={e => setFNote(e.target.value)} placeholder="Note opzionali"
            style={{ fontSize:12, border:'1px solid #d1d5db', borderRadius:6, padding:'5px 8px' }} />
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={aggiungiMiglioria} style={{ fontSize:12, padding:'5px 14px', background:'#2563eb', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }}>Aggiungi</button>
            <button onClick={() => setFormOpen(false)} style={{ fontSize:12, padding:'5px 10px', background:'none', border:'1px solid #d1d5db', borderRadius:6, cursor:'pointer' }}>Annulla</button>
          </div>
        </div>
      )}

      {/* Lista migliorie */}
      {migliorie.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:160, color:'#9ca3af', background:'#f9fafb', borderRadius:12, border:'2px dashed #e5e7eb' }}>
          <p style={{ fontSize:14, margin:0 }}>Nessuna miglioria</p>
          <p style={{ fontSize:12, margin:'4px 0 0' }}>Se la commessa viene da una gara aggiudicata, le migliorie offerte appaiono automaticamente</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {migliorie.map(m => {
            const cat    = CATEGORIE_MIGLIORIA.find(c => c.value === m.categoria)
            const stato  = STATI_MIGLIORIA.find(s => s.value === (m.stato || 'contrattuale'))
            const next   = getNextStato(m.stato || 'contrattuale')
            const alert  = m.stato === 'completata'
            const isDaGara = m._source === 'da_gara'
            const scartoCosto = (m.costo_effettivo || 0) > (m.costo_stimato || 0)

            return (
              <div key={m.id} style={{ padding:'12px 16px', background:'#fff', border:'1px solid ' + (alert ? '#fde68a' : '#e5e7eb'), borderRadius:10 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>

                  {/* Lato sinistro: info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, flexWrap:'wrap' }}>
                      <span style={{ fontSize:9, padding:'1px 7px', borderRadius:3, fontWeight:700, background:(cat?.color||'#6b7280')+'18', color:cat?.color||'#6b7280' }}>
                        {cat?.label || m.categoria}
                      </span>
                      <span style={{ fontSize:9, padding:'1px 7px', borderRadius:3, fontWeight:700, background:(stato?.color||'#6b7280')+'18', color:stato?.color||'#6b7280' }}>
                        {stato?.label || m.stato || 'Contrattuale'}
                      </span>
                      {isDaGara && (
                        <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, background:'#f5f3ff', color:'#7c3aed', fontWeight:600 }}>
                          Ereditata da gara
                        </span>
                      )}
                      {alert && (
                        <span style={{ fontSize:9, fontWeight:700, color:'#d97706' }}>⚠️ In attesa verifica DL</span>
                      )}
                    </div>
                    <p style={{ fontSize:13, fontWeight:600, color:'#374151', margin:'0 0 4px' }}>{m.descrizione}</p>
                    {m.note && <p style={{ fontSize:11, color:'#6b7280', margin:'0 0 6px', fontStyle:'italic' }}>{m.note}</p>}

                    {/* Costi */}
                    <div style={{ display:'flex', gap:14, fontSize:11, alignItems:'center' }}>
                      <span style={{ color:'#6b7280' }}>Stimato: <strong style={{ color:'#dc2626' }}>€ {fmt(m.costo_stimato)}</strong></span>
                      <span style={{ color:'#6b7280' }}>Effettivo:</span>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <input
                          value={costoEdit[m.id] ?? (m.costo_effettivo != null ? String(m.costo_effettivo) : '')}
                          onChange={e => setCostoEdit(prev => ({ ...prev, [m.id]: e.target.value }))}
                          onBlur={() => { if (costoEdit[m.id] !== undefined) aggiornaCostoEffettivo(m, costoEdit[m.id]) }}
                          placeholder="0.00"
                          type="number" step="0.01"
                          style={{ width:90, fontSize:11, border:'1px solid ' + (scartoCosto ? '#fca5a5' : '#d1d5db'), borderRadius:4, padding:'2px 6px', textAlign:'right', color: scartoCosto ? '#dc2626' : '#374151' }}
                        />
                        {scartoCosto && <span style={{ fontSize:9, color:'#dc2626', fontWeight:700 }}>⚠ +€{fmt((m.costo_effettivo||0)-(m.costo_stimato||0))}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Lato destro: workflow */}
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                    {next && (
                      <button
                        disabled={saving === m.id}
                        onClick={() => avanzaStato(m, next.value)}
                        style={{ fontSize:11, padding:'4px 12px', background: next.color, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }}>
                        {saving === m.id ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : next.label}
                      </button>
                    )}
                    {m.stato === 'verificata_dl' && (
                      <span style={{ fontSize:11, color:'#7c3aed', fontWeight:700 }}>✅ Verificata</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Riepilogo impatto CE */}
      {migliorie.length > 0 && (
        <div style={{ padding:'12px 16px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10 }}>
          <p style={{ fontSize:11, fontWeight:700, color:'#374151', margin:'0 0 8px', textTransform:'uppercase', letterSpacing:'.04em' }}>Impatto Conto Economico</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, fontSize:12 }}>
            <div>
              <span style={{ color:'#6b7280' }}>Costi stimati non remunerati</span>
              <p style={{ fontSize:14, fontWeight:700, margin:'2px 0 0', color:'#dc2626' }}>€ {fmt(costoStimatoTot)}</p>
            </div>
            <div>
              <span style={{ color:'#6b7280' }}>Costi effettivi rilevati</span>
              <p style={{ fontSize:14, fontWeight:700, margin:'2px 0 0', color: costoEffTot > costoStimatoTot ? '#dc2626' : '#374151' }}>€ {fmt(costoEffTot)}</p>
            </div>
            <div>
              <span style={{ color:'#6b7280' }}>Incidenza su importo commessa</span>
              <p style={{ fontSize:14, fontWeight:700, margin:'2px 0 0', color: impattoPerc > 5 ? '#dc2626' : '#d97706' }}>−{impattoPerc.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
