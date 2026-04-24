'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Upload, Plus, Search, FileText, Trash2, Edit2, Save, X,
  ShoppingCart, CheckSquare, Square, AlertTriangle, Printer,
  Calculator
} from 'lucide-react'

interface Misura {
  id?: string
  voce_id?: string
  posizione: number
  nota: string
  nr: number
  a: number
  b: number
  h: number
}

interface VoceComputo {
  id: string
  capitolo: string
  codice: string
  codice_prezzario: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  pct_manodopera: number
  pct_materiali: number
  pct_noli: number
  tipo_costo: string[]
  note_approvvigionamento: string
}

interface Computo { id: string; tipo_uso: string; fonte: string; data_import: string }

interface FormVoce {
  capitolo: string; codice: string; codice_prezzario: string; descrizione: string
  um: string; quantita: number; prezzo_unitario: number
  pct_manodopera: number; pct_materiali: number; pct_noli: number
  tipo_costo: string[]; note_approvvigionamento: string
}

const TIPI_COSTO = [
  { id: 'INT', label: 'Interno',    color: '#10b981' },
  { id: 'SUB', label: 'Subappalto', color: '#8b5cf6' },
  { id: 'ACQ', label: 'Acquisto',   color: '#3b82f6' },
  { id: 'NC',  label: 'Nolo Caldo', color: '#f59e0b' },
  { id: 'NF',  label: 'Nolo Freddo',color: '#64748b' },
]

const UM_LIST = ['mc','mq','ml','kg','t','nr','corpo','lt','ora','gg','%','kW','kWh']

function fmt(n: number, dec = 2) {
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtQ(n: number) { return fmt(n, 3) }

const FORM_VUOTO: FormVoce = {
  capitolo: '', codice: '', codice_prezzario: '', descrizione: '',
  um: 'mc', quantita: 0, prezzo_unitario: 0,
  pct_manodopera: 30, pct_materiali: 45, pct_noli: 12,
  tipo_costo: ['INT'], note_approvvigionamento: ''
}

export default function ComputoPage() {
  const { id: commessaId } = useParams() as { id: string }
  const [computo, setComputo] = useState<Computo | null>(null)
  const [voci, setVoci] = useState<VoceComputo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCapitolo, setFiltroCapitolo] = useState('TUTTI')
  const [showImport, setShowImport] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showMisure, setShowMisure] = useState<string | null>(null)
  const [showRdo, setShowRdo] = useState(false)
  const [showDescr, setShowDescr] = useState<string | null>(null)
  const [form, setForm] = useState<FormVoce>({ ...FORM_VUOTO })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importErr, setImportErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set())
  const [misure, setMisure] = useState<Misura[]>([])
  const [savingMisure, setSavingMisure] = useState(false)

  useEffect(() => { carica() }, [commessaId])

  async function carica() {
    setLoading(true)
    const { data: comp } = await supabase.from('computo_metrico').select('*').eq('commessa_id', commessaId).eq('tipo_uso', 'AGGIUDICATA').single()
    if (comp) {
      setComputo(comp)
      const { data: v } = await supabase.from('voci_computo').select('*').eq('computo_id', comp.id).order('capitolo').order('codice')
      if (v) setVoci(v as VoceComputo[])
    }
    setLoading(false)
  }

  async function getOrCreateComputoId(): Promise<string | null> {
    if (computo?.id) return computo.id
    const { data } = await supabase.from('computo_metrico').insert([{ commessa_id: commessaId, tipo_uso: 'AGGIUDICATA', fonte: 'MANUALE', data_import: new Date().toISOString().slice(0,10) }]).select().single()
    if (data) { setComputo(data as Computo); return data.id as string }
    return null
  }
  async function handleFileImport(file: File) {
    setImporting(true); setImportMsg('Analisi file...'); setImportErr('')
    try {
      const isXpwe = /\.(xpwe|xml)$/i.test(file.name)
      const computoId = await getOrCreateComputoId()
      if (!computoId) { setImportErr('Errore creazione computo'); setImporting(false); return }

      if (isXpwe) {
        setImportMsg('Lettura Primus XPWE...')
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/xpwe-parse', { method: 'POST', body: fd })
        const json = await res.json() as { ok: boolean; voci?: Array<Record<string, unknown>>; errore?: string; totale?: number; totale_misure?: number }
        if (!json.ok || !json.voci) { setImportErr('Errore XPWE: ' + (json.errore || 'formato non riconosciuto')); setImporting(false); return }

        setImportMsg('Trovate ' + json.voci.length + ' voci (' + (json.totale_misure || 0) + ' righe misura). Salvataggio...')
        let tot = 0
        const voceIdMap: Array<{ voceId: string; misure: Array<Record<string,unknown>> }> = []

        for (let i = 0; i < json.voci.length; i += 50) {
          const chunk = json.voci.slice(i, i + 50)
          const rows = chunk.map((v: Record<string, unknown>) => ({
            computo_id: computoId,
            capitolo: String(v.capitolo || 'Importato').slice(0, 500),
            codice: String(v.codice || '').slice(0, 100),
            codice_prezzario: String(v.codice || '').slice(0, 100),
            descrizione: String(v.descrizione || '').slice(0, 5000),
            um: String(v.um || 'nr').slice(0, 20),
            quantita: Number(v.quantita) || 0,
            prezzo_unitario: Number(v.prezzo_unitario) || 0,
            importo: Number(v.importo) || 0,
            pct_manodopera: Number(v.pct_manodopera) || 0,
            pct_materiali: Number(v.pct_materiali) || 0,
            pct_noli: Number(v.pct_noli) || 0,
            tipo_costo: ['INT'],
            selezionata: true
          }))
          const { data: savedVoci, error } = await supabase.from('voci_computo').insert(rows).select('id')
          if (error) { setImportErr('Errore DB: ' + error.message); setImporting(false); return }
          if (savedVoci) {
            savedVoci.forEach((sv: { id: string }, idx: number) => {
              const misureVoce = Array.isArray(chunk[idx]?.misure) ? chunk[idx].misure as Array<Record<string,unknown>> : []
              if (misureVoce.length > 0) voceIdMap.push({ voceId: sv.id, misure: misureVoce })
            })
          }
          tot += chunk.length
          setImportMsg('Salvate ' + tot + '/' + json.voci.length + ' voci...')
        }

        if (voceIdMap.length > 0) {
          setImportMsg('Salvataggio righe di misura...')
          const misureRows: Array<Record<string,unknown>> = []
          for (const { voceId, misure } of voceIdMap) {
            misure.forEach((m: Record<string,unknown>, idx: number) => {
              const nrStr = String(m.nr || '0')
              let nrVal = 0
              try { nrVal = nrStr.includes('*') ? nrStr.split('*').reduce((p: number, v: string) => p * (parseFloat(v) || 1), 1) : parseFloat(nrStr) || 0 } catch { nrVal = 0 }
              misureRows.push({ voce_id: voceId, posizione: idx, nota: String(m.nota || '').slice(0, 300), nr: nrVal, a: Number(m.a) || 0, b: Number(m.b) || 0, h: Number(m.h) || 0 })
            })
          }
          for (let i = 0; i < misureRows.length; i += 200) {
            await supabase.from('misure_voce').insert(misureRows.slice(i, i + 200))
          }
        }

        setImportMsg('✅ ' + tot + ' voci con ' + voceIdMap.reduce((s,x)=>s+x.misure.length,0) + ' righe misura importate!')
        await carica()

      } else {
        const txt = await file.text()
        const lines = txt.split('\n').filter(l => l.trim())
        if (lines.length < 2) { setImportErr('File vuoto'); setImporting(false); return }
        const sep = txt.includes(';') ? ';' : ','
        const hdr = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g,''))
        const get = (vals: string[], n: string) => { const i = hdr.findIndex(h => h.includes(n)); return i >= 0 ? vals[i] || '' : '' }
        const rows: Record<string, unknown>[] = []
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g,''))
          if (!vals.some(v => v)) continue
          const q = parseFloat(get(vals,'quant') || get(vals,'qta') || '0') || 0
          const p = parseFloat(get(vals,'prezz') || get(vals,'pu') || get(vals,'prezzo') || '0') || 0
          rows.push({ computo_id: computoId, capitolo: (get(vals,'cap') || get(vals,'capitolo') || 'Importato').slice(0,500), codice: (get(vals,'codice') || get(vals,'cod') || 'CSV'+String(i).padStart(3,'0')).slice(0,100), codice_prezzario: (get(vals,'prezzario') || get(vals,'tariffa') || '').slice(0,100), descrizione: (get(vals,'descriz') || get(vals,'desc') || get(vals,'lavorazione') || vals[0] || '').slice(0,5000), um: (get(vals,'um') || 'nr').slice(0,20), quantita: q, prezzo_unitario: p, importo: q*p, pct_manodopera: 30, pct_materiali: 45, pct_noli: 12, tipo_costo: ['INT'], selezionata: true })
        }
        if (!rows.length) { setImportErr('Nessuna voce trovata'); setImporting(false); return }
        let tot = 0
        for (let i = 0; i < rows.length; i += 100) {
          const { error } = await supabase.from('voci_computo').insert(rows.slice(i, i+100))
          if (error) { setImportErr('Errore DB: ' + error.message); setImporting(false); return }
          tot += Math.min(100, rows.length - i)
          setImportMsg('Salvate ' + tot + '/' + rows.length + '...')
        }
        setImportMsg('✅ Importate ' + tot + ' voci!')
        await carica()
      }
    } catch(e) { setImportErr('Errore: ' + String(e)) }
    setImporting(false)
    setTimeout(() => { setShowImport(false); setImportMsg(''); setImportErr('') }, 3500)
  }

  async function apriMisure(voceId: string) {
    setShowMisure(voceId)
    const { data } = await supabase.from('misure_voce').select('*').eq('voce_id', voceId).order('posizione')
    if (data && data.length > 0) { setMisure(data as Misura[]) }
    else { setMisure([{ posizione: 0, nota: '', nr: 1, a: 0, b: 0, h: 0 }]) }
  }

  function updateMisura(idx: number, field: keyof Misura, value: string | number) {
    setMisure(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

  function calcolaQtaMisure(): number {
    return misure.reduce((s, m) => {
      const parts = [Number(m.nr)||1, Number(m.a)||0, Number(m.b)||0, Number(m.h)||0].filter(v => v !== 0)
      return s + (parts.length > 0 ? parts.reduce((p, v) => p * v, 1) : 0)
    }, 0)
  }

  async function salvaMisure() {
    if (!showMisure) return
    setSavingMisure(true)
    try {
      await supabase.from('misure_voce').delete().eq('voce_id', showMisure)
      const rows = misure.map((m, i) => ({ ...m, voce_id: showMisure, posizione: i }))
      if (rows.length > 0) await supabase.from('misure_voce').insert(rows)
      const qtaTot = calcolaQtaMisure()
      const voce = voci.find(v => v.id === showMisure)
      if (voce) {
        const { data } = await supabase.from('voci_computo').update({ quantita: qtaTot, importo: qtaTot * voce.prezzo_unitario }).eq('id', showMisure).select().single()
        if (data) setVoci(prev => prev.map(v => v.id === showMisure ? (data as VoceComputo) : v))
      }
      setShowMisure(null)
    } finally { setSavingMisure(false) }
  }

  async function salvaVoce() {
    if (!form.descrizione.trim()) return
    setSaving(true)
    const computoId = await getOrCreateComputoId()
    if (!computoId) { setSaving(false); return }
    const payload = { ...form, importo: form.quantita * form.prezzo_unitario, computo_id: computoId, selezionata: true }
    if (editingId) {
      const { data } = await supabase.from('voci_computo').update(payload).eq('id', editingId).select().single()
      if (data) setVoci(prev => prev.map(v => v.id === editingId ? (data as VoceComputo) : v))
      setEditingId(null)
    } else {
      const { data } = await supabase.from('voci_computo').insert([payload]).select().single()
      if (data) setVoci(prev => [...prev, data as VoceComputo])
    }
    setSaving(false); setShowForm(false); setForm({ ...FORM_VUOTO })
  }

  async function eliminaVoce(id: string) {
    if (!confirm('Eliminare questa voce?')) return
    await supabase.from('voci_computo').delete().eq('id', id)
    setVoci(prev => prev.filter(v => v.id !== id))
    setSelezionate(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  async function eliminaTutte() {
    if (!computo?.id || !confirm('Svuotare TUTTO il computo?')) return
    await supabase.from('voci_computo').delete().eq('computo_id', computo.id)
    setVoci([]); setSelezionate(new Set())
  }

  async function aggiornaTipo(id: string, tipo: string) {
    const voce = voci.find(v => v.id === id)
    if (!voce) return
    const cur = voce.tipo_costo || ['INT']
    const newT = cur.includes(tipo) ? (cur.filter(t => t !== tipo).length > 0 ? cur.filter(t => t !== tipo) : ['INT']) : [...cur, tipo]
    const { data } = await supabase.from('voci_computo').update({ tipo_costo: newT }).eq('id', id).select().single()
    if (data) setVoci(prev => prev.map(v => v.id === id ? { ...v, tipo_costo: newT } : v))
  }

  function iniziaModifica(voce: VoceComputo) {
    setForm({ capitolo: voce.capitolo||'', codice: voce.codice||'', codice_prezzario: voce.codice_prezzario||'', descrizione: voce.descrizione, um: voce.um||'mc', quantita: voce.quantita, prezzo_unitario: voce.prezzo_unitario, pct_manodopera: voce.pct_manodopera||30, pct_materiali: voce.pct_materiali||45, pct_noli: voce.pct_noli||12, tipo_costo: voce.tipo_costo||['INT'], note_approvvigionamento: voce.note_approvvigionamento||'' })
    setEditingId(voce.id); setShowForm(true)
  }

  const capitoli = [...new Set(voci.map(v => v.capitolo || 'Generale'))].sort()
  const vociFiltrate = voci.filter(v => {
    const mc = filtroCapitolo === 'TUTTI' || (v.capitolo||'Generale') === filtroCapitolo
    const ms = !search || v.descrizione?.toLowerCase().includes(search.toLowerCase()) || v.codice?.toLowerCase().includes(search.toLowerCase())
    return mc && ms
  })
  const capitoliFiltrati = [...new Set(vociFiltrate.map(v => v.capitolo||'Generale'))].sort()
  const totale = voci.reduce((s,v) => s+(v.importo||0), 0)
  const totManodopera = voci.reduce((s,v) => s+(v.importo||0)*(v.pct_manodopera||0)/100, 0)
  const totMateriali = voci.reduce((s,v) => s+(v.importo||0)*(v.pct_materiali||0)/100, 0)
  const totNoli = voci.reduce((s,v) => s+(v.importo||0)*(v.pct_noli||0)/100, 0)
  const totSel = voci.filter(v => selezionate.has(v.id)).reduce((s,v) => s+(v.importo||0), 0)
  let progressivo = 0

  const inp: React.CSSProperties = { width:'100%', boxSizing:'border-box' as const, background:'#fff', border:'1px solid #e2e8f0', borderRadius:7, padding:'7px 10px', color:'#1e293b', fontSize:13 }
  const lbl: React.CSSProperties = { fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:3 }
  const thS: React.CSSProperties = { padding:'7px 10px', fontSize:9, fontWeight:700, color:'#64748b', textTransform:'uppercase' as const, letterSpacing:'0.05em', textAlign:'left' as const, whiteSpace:'nowrap' as const, borderBottom:'2px solid var(--border)', background:'#f8fafc' }

  return (
    <div style={{ padding:'20px 24px', background:'var(--bg)', minHeight:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, color:'var(--t1)', margin:0 }}>Computo Metrico Estimativo</h2>
          <p style={{ fontSize:12, color:'var(--t3)', marginTop:3 }}>
            {voci.length} voci · {capitoli.length} capitoli · <strong>€ {fmt(totale)}</strong>
            {selezionate.size > 0 && <span style={{ color:'#8b5cf6', marginLeft:8 }}>· {selezionate.size} sel. € {fmt(totSel)}</span>}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {selezionate.size > 0 && <button onClick={() => setShowRdo(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'none', background:'#8b5cf6', color:'white', fontSize:12, fontWeight:700, cursor:'pointer' }}><ShoppingCart size={13} /> RDO ({selezionate.size})</button>}
          <button onClick={() => window.print()} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel)', color:'var(--t2)', fontSize:12, cursor:'pointer' }}><Printer size={13} /> Stampa</button>
          {voci.length > 0 && <button onClick={eliminaTutte} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #fecaca', background:'#fef2f2', color:'#ef4444', fontSize:11, cursor:'pointer' }}>🗑 Svuota</button>}
          <button onClick={() => setShowImport(true)} className="btn-secondary" style={{ fontSize:12 }}><Upload size={13} /> Importa</button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({...FORM_VUOTO}) }} className="btn-primary" style={{ fontSize:12 }}><Plus size={13} /> Nuova voce</button>
        </div>
      </div>

      {voci.length > 0 && (
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:220 }}>
            <Search size={12} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t4)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca codice o descrizione..." style={{ width:'100%', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px 8px 30px', fontSize:12, color:'var(--t1)', boxSizing:'border-box' as const }} />
          </div>
          <select value={filtroCapitolo} onChange={e => setFiltroCapitolo(e.target.value)} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel)', fontSize:12, color:'var(--t1)', cursor:'pointer' }}>
            <option value="TUTTI">Tutti i capitoli ({capitoli.length})</option>
            {capitoli.map(c => <option key={c} value={c}>{c.length > 50 ? c.slice(0,50)+'…' : c}</option>)}
          </select>
          {selezionate.size > 0 && <button onClick={() => setSelezionate(new Set())} style={{ padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel)', fontSize:11, color:'var(--t3)', cursor:'pointer' }}>✕ Deseleziona</button>}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:48 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
      ) : voci.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 32px', background:'var(--panel)', border:'2px dashed var(--border)', borderRadius:16 }}>
          <FileText size={40} color="var(--t4)" style={{ marginBottom:14 }} />
          <h3 style={{ fontSize:16, fontWeight:700, color:'var(--t2)', margin:'0 0 8px' }}>Computo vuoto</h3>
          <p style={{ fontSize:13, color:'var(--t3)', marginBottom:20 }}>Importa da Primus XPWE o inserisci le voci manualmente</p>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={14} /> Importa XPWE / CSV</button>
            <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={14} /> Inserisci manualmente</button>
          </div>
        </div>
      ) : (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1100 }}>
              <thead>
                <tr>
                  <th style={{ ...thS, width:36, textAlign:'center' as const }}></th>
                  <th style={{ ...thS, width:40, textAlign:'center' as const }}>N°</th>
                  <th style={{ ...thS, width:100 }}>Codice</th>
                  <th style={{ ...thS }}>Descrizione lavori</th>
                  <th style={{ ...thS, width:55, textAlign:'center' as const }}>U.M.</th>
                  <th style={{ ...thS, width:90, textAlign:'right' as const }}>Quantità</th>
                  <th style={{ ...thS, width:100, textAlign:'right' as const }}>P.U. (€)</th>
                  <th style={{ ...thS, width:110, textAlign:'right' as const }}>Importo (€)</th>
                  <th style={{ ...thS, width:45, textAlign:'center' as const }}>Man%</th>
                  <th style={{ ...thS, width:45, textAlign:'center' as const }}>Mat%</th>
                  <th style={{ ...thS, width:45, textAlign:'center' as const }}>Nol%</th>
                  <th style={{ ...thS, width:130, textAlign:'center' as const }}>Tipo costo</th>
                  <th style={{ ...thS, width:85 }}></th>
                </tr>
              </thead>
              <tbody>
                {capitoliFiltrati.map(cap => {
                  const vociCap = vociFiltrate.filter(v => (v.capitolo||'Generale') === cap)
                  const totaleCap = vociCap.reduce((s,v) => s+(v.importo||0), 0)
                  const tutteSel = vociCap.length > 0 && vociCap.every(v => selezionate.has(v.id))
                  return [
                    <tr key={'cap-'+cap} style={{ background:'#1e3a5f' }}>
                      <td style={{ padding:'8px 10px', textAlign:'center' as const }}>
                        <button onClick={() => { const ids=vociCap.map(v=>v.id); setSelezionate(prev => { const s=new Set(prev); ids.forEach(id => tutteSel ? s.delete(id) : s.add(id)); return s }) }} style={{ background:'none', border:'none', cursor:'pointer', color:tutteSel?'#a78bfa':'#94a3b8', display:'flex', alignItems:'center' }}>{tutteSel ? <CheckSquare size={13}/> : <Square size={13}/>}</button>
                      </td>
                      <td colSpan={11} style={{ padding:'8px 12px' }}>
                        <span style={{ fontSize:11, fontWeight:800, color:'#ffffff', textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>{cap}</span>
                        <span style={{ fontSize:10, color:'#94a3b8', marginLeft:12 }}>{vociCap.length} voci</span>
                      </td>
                      <td style={{ padding:'8px 12px', textAlign:'right' as const }}>
                        <span style={{ fontSize:12, fontWeight:800, color:'#60a5fa', fontFamily:'var(--font-mono)' }}>€ {fmt(totaleCap)}</span>
                      </td>
                    </tr>,
                    ...vociCap.map(voce => {
                      progressivo++
                      const isSel = selezionate.has(voce.id)
                      const tipiAttivi = voce.tipo_costo || ['INT']
                      return (
                        <tr key={voce.id} style={{ borderBottom:'1px solid var(--border)', background:isSel?'rgba(139,92,246,0.04)':'transparent' }}>
                          <td style={{ padding:'6px 10px', textAlign:'center' as const }}>
                            <button onClick={() => { const s=new Set(selezionate); s.has(voce.id)?s.delete(voce.id):s.add(voce.id); setSelezionate(s) }} style={{ background:'none', border:'none', cursor:'pointer', color:isSel?'#8b5cf6':'var(--t4)', display:'flex', alignItems:'center' }}>{isSel?<CheckSquare size={13}/>:<Square size={13}/>}</button>
                          </td>
                          <td style={{ padding:'6px 8px', fontSize:10, color:'var(--t4)', textAlign:'center' as const, fontFamily:'var(--font-mono)' }}>{progressivo}</td>
                          <td style={{ padding:'6px 10px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--t3)', whiteSpace:'nowrap' as const }}>{voce.codice||'—'}</td>
                          <td style={{ padding:'6px 10px', fontSize:12, color:'var(--t1)', lineHeight:1.45, maxWidth:400 }}>
                            <div style={{ cursor:'pointer' }} onClick={() => setShowDescr(showDescr===voce.id?null:voce.id)}>
                              {showDescr===voce.id ? (
                                <div style={{ whiteSpace:'pre-wrap' as const, fontSize:12, lineHeight:1.5 }}>{voce.descrizione}</div>
                              ) : (
                                <div style={{ overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>{voce.descrizione}</div>
                              )}
                            </div>
                            {voce.codice_prezzario && voce.codice_prezzario!==voce.codice && <div style={{ fontSize:9, color:'var(--t4)', marginTop:2, fontFamily:'var(--font-mono)' }}>Prezzario: {voce.codice_prezzario}</div>}
                          </td>
                          <td style={{ padding:'6px 10px', fontSize:11, color:'var(--t3)', textAlign:'center' as const }}>{voce.um}</td>
                          <td style={{ padding:'6px 10px', fontSize:11, fontFamily:'var(--font-mono)', textAlign:'right' as const, color:'var(--t2)', cursor:'pointer' }} onClick={() => apriMisure(voce.id)} title="Foglio misure">
                            <span style={{ borderBottom:'1px dashed var(--t4)' }}>{fmtQ(voce.quantita)}</span>
                          </td>
                          <td style={{ padding:'6px 10px', fontSize:12, fontFamily:'var(--font-mono)', textAlign:'right' as const, color:'var(--t2)' }}>{fmt(voce.prezzo_unitario)}</td>
                          <td style={{ padding:'6px 10px', fontSize:13, fontFamily:'var(--font-mono)', textAlign:'right' as const, fontWeight:700, color:'var(--t1)' }}>{fmt(voce.importo)}</td>
                          <td style={{ padding:'6px 6px', fontSize:10, textAlign:'center' as const, color:'#10b981' }}>{voce.pct_manodopera||0}%</td>
                          <td style={{ padding:'6px 6px', fontSize:10, textAlign:'center' as const, color:'#3b82f6' }}>{voce.pct_materiali||0}%</td>
                          <td style={{ padding:'6px 6px', fontSize:10, textAlign:'center' as const, color:'#f59e0b' }}>{voce.pct_noli||0}%</td>
                          <td style={{ padding:'6px 8px' }}>
                            <div style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center' }}>
                              {TIPI_COSTO.map(t => { const on=tipiAttivi.includes(t.id); return <button key={t.id} onClick={() => aggiornaTipo(voce.id,t.id)} title={t.label} style={{ padding:'2px 5px', borderRadius:4, border:'1px solid '+(on?t.color:'var(--border)'), background:on?(t.color+'22'):'transparent', color:on?t.color:'var(--t4)', fontSize:9, fontWeight:700, cursor:'pointer' }}>{t.id}</button> })}
                            </div>
                          </td>
                          <td style={{ padding:'6px 8px', whiteSpace:'nowrap' as const }}>
                            <div style={{ display:'flex', gap:3 }}>
                              <button onClick={() => apriMisure(voce.id)} title="Foglio misure" style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, padding:'3px 6px', cursor:'pointer', color:'var(--t3)', display:'flex', alignItems:'center' }}><Calculator size={10}/></button>
                              <button onClick={() => iniziaModifica(voce)} title="Modifica" style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, padding:'3px 6px', cursor:'pointer', color:'var(--t3)', display:'flex', alignItems:'center' }}><Edit2 size={10}/></button>
                              <button onClick={() => eliminaVoce(voce.id)} title="Elimina" style={{ background:'none', border:'1px solid rgba(239,68,68,0.2)', borderRadius:5, padding:'3px 6px', cursor:'pointer', color:'#ef4444', display:'flex', alignItems:'center' }}><Trash2 size={10}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    }),
                    <tr key={'tot-'+cap} style={{ background:'rgba(30,58,95,0.06)', borderTop:'2px solid rgba(30,58,95,0.15)', borderBottom:'3px solid rgba(30,58,95,0.2)' }}>
                      <td colSpan={7} style={{ padding:'7px 12px', fontSize:11, fontWeight:700, color:'#1e3a5f' }}>Totale — {cap.length>60?cap.slice(0,60)+'…':cap}</td>
                      <td style={{ padding:'7px 10px', fontSize:14, fontFamily:'var(--font-mono)', fontWeight:800, color:'#1e3a5f', textAlign:'right' as const }}>{fmt(totaleCap)}</td>
                      <td colSpan={5}/>
                    </tr>
                  ]
                })}
              </tbody>
            </table>
          </div>
          <div style={{ borderTop:'3px solid var(--border)', background:'#f8fafc', padding:'16px 24px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 2fr', gap:16, alignItems:'end' }}>
              {[
                { label:'Incid. Manodopera', val:'€ '+fmt(totManodopera), sub:(totManodopera/totale*100||0).toFixed(1)+'%', color:'#10b981' },
                { label:'Incid. Materiali',  val:'€ '+fmt(totMateriali),  sub:(totMateriali/totale*100||0).toFixed(1)+'%', color:'#3b82f6' },
                { label:'Incid. Noli',       val:'€ '+fmt(totNoli),       sub:(totNoli/totale*100||0).toFixed(1)+'%',     color:'#f59e0b' },
                { label:'N° Voci / Capitoli',val:voci.length+' / '+capitoli.length, sub:'voci importate', color:'#8b5cf6' },
              ].map((k,i) => (
                <div key={i} style={{ background:'white', borderRadius:8, padding:'10px 14px', border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:9, color:'var(--t4)', textTransform:'uppercase' as const, marginBottom:4, letterSpacing:'0.06em' }}>{k.label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:k.color, fontFamily:'var(--font-mono)' }}>{k.val}</div>
                  <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>{k.sub}</div>
                </div>
              ))}
              <div style={{ background:'#1e3a5f', borderRadius:10, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#94c5f8' }}>TOTALE COMPUTO</span>
                <span style={{ fontSize:26, fontWeight:900, color:'#ffffff', fontFamily:'var(--font-mono)' }}>€ {fmt(totale)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay"><div className="modal-box" style={{ maxWidth:520 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div><h2 style={{ fontSize:18, fontWeight:800, color:'#1e293b', margin:0 }}>Importa Computo</h2><p style={{ fontSize:11, color:'#64748b', marginTop:3, margin:'3px 0 0' }}>Primus XPWE · XML · CSV</p></div>
            <button onClick={() => { setShowImport(false); setImportMsg(''); setImportErr('') }} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:8, cursor:'pointer' }}><X size={15} color="#64748b"/></button>
          </div>
          {importErr && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#ef4444', display:'flex', gap:8 }}><AlertTriangle size={14} style={{ flexShrink:0, marginTop:1 }}/>{importErr}</div>}
          {importing ? (
            <div style={{ textAlign:'center', padding:'32px 0' }}><div className="spinner" style={{ margin:'0 auto 14px' }}/><div style={{ fontSize:13, color:'#64748b' }}>{importMsg}</div></div>
          ) : importMsg.startsWith('✅') ? (
            <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:20, textAlign:'center', color:'#10b981', fontSize:14, fontWeight:700 }}>{importMsg}</div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                {[{icon:'🏗',t:'Primus XPWE',s:'.xpwe / .xml',c:'#6366f1'},{icon:'📊',t:'CSV / TXT',s:'separatore ; o ,',c:'#10b981'}].map((b,i) => (
                  <div key={i} onClick={() => fileRef.current?.click()} style={{ border:'2px dashed '+b.c+'50', borderRadius:10, padding:'20px 14px', textAlign:'center', cursor:'pointer', background:b.c+'08' }}>
                    <div style={{ fontSize:28, marginBottom:6 }}>{b.icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:b.c }}>{b.t}</div>
                    <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{b.s}</div>
                  </div>
                ))}
              </div>
              <div onClick={() => fileRef.current?.click()} style={{ border:'2px dashed var(--border)', borderRadius:10, padding:18, textAlign:'center', cursor:'pointer', background:'var(--bg)' }}>
                <Upload size={20} color="var(--t4)" style={{ marginBottom:6 }}/><div style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>Clicca o trascina il file</div><div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>.xpwe · .xml · .csv · .txt</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt,.xpwe,.xml" style={{ display:'none' }} onChange={e => { const f=e.target.files?.[0]; if(f){handleFileImport(f);e.target.value=''} }}/>
              <div style={{ marginTop:12, background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#334155', marginBottom:4 }}>CSV — intestazione:</div>
                <code style={{ fontSize:10, color:'#475569', background:'#e2e8f0', padding:'4px 8px', borderRadius:4, display:'block' }}>capitolo;codice;descrizione;um;quantita;prezzo_unitario</code>
              </div>
            </>
          )}
        </div></div>
      )}

      {showMisure && (
        <div className="modal-overlay"><div className="modal-box" style={{ maxWidth:700 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div><h2 style={{ fontSize:17, fontWeight:800, color:'#1e293b', margin:0 }}>Foglio Misure</h2><p style={{ fontSize:11, color:'#64748b', marginTop:3, margin:'3px 0 0' }}>{voci.find(v=>v.id===showMisure)?.codice} — {voci.find(v=>v.id===showMisure)?.descrizione?.slice(0,60)}</p></div>
            <button onClick={() => setShowMisure(null)} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:8, cursor:'pointer' }}><X size={15} color="#64748b"/></button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'#f8fafc', borderBottom:'2px solid var(--border)' }}>
                {['Nota / Posizione','NR','A','B','H','Q. parziale',''].map((h,i) => <th key={i} style={{ padding:'7px 10px', fontSize:9, fontWeight:700, color:'#64748b', textTransform:'uppercase' as const, textAlign:(i>=1&&i<=5?'right':'left') as 'right'|'left' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {misure.map((m,idx) => {
                  const parts=[Number(m.nr)||1,Number(m.a)||0,Number(m.b)||0,Number(m.h)||0].filter(v=>v!==0)
                  const qp=parts.length>0?parts.reduce((p,v)=>p*v,1):0
                  return (
                    <tr key={idx} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'4px 6px' }}><input value={m.nota} onChange={e=>updateMisura(idx,'nota',e.target.value)} placeholder="es. Piano terra" style={{ ...inp, fontSize:11, padding:'4px 8px' }}/></td>
                      {(['nr','a','b','h'] as const).map(f => <td key={f} style={{ padding:'4px 6px', width:80 }}><input type="number" step="0.001" value={(m[f] as number)||''} onChange={e=>updateMisura(idx,f,parseFloat(e.target.value)||0)} style={{ ...inp, fontSize:11, padding:'4px 8px', textAlign:'right' as const, fontFamily:'monospace' }}/></td>)}
                      <td style={{ padding:'4px 10px', textAlign:'right' as const, fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#1e3a5f', whiteSpace:'nowrap' as const }}>{fmtQ(qp)}</td>
                      <td style={{ padding:'4px 6px', width:30 }}><button onClick={() => setMisure(prev=>prev.filter((_,i)=>i!==idx))} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', display:'flex', alignItems:'center' }}><X size={12}/></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button onClick={() => setMisure(prev=>[...prev,{posizione:prev.length,nota:'',nr:1,a:0,b:0,h:0}])} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:7, border:'1px dashed var(--border)', background:'var(--bg)', fontSize:12, cursor:'pointer', color:'var(--t2)' }}><Plus size={13}/> Aggiungi riga</button>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ textAlign:'right' as const }}>
                <div style={{ fontSize:10, color:'var(--t3)', marginBottom:2 }}>QUANTITÀ TOTALE</div>
                <div style={{ fontSize:20, fontWeight:900, color:'#1e3a5f', fontFamily:'monospace' }}>{fmtQ(calcolaQtaMisure())}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowMisure(null)} className="btn-secondary">Annulla</button>
                <button onClick={salvaMisure} disabled={savingMisure} className="btn-primary"><Save size={13}/> {savingMisure?'Salvo...':'Salva misure'}</button>
              </div>
            </div>
          </div>
        </div></div>
      )}

      {showRdo && (
        <div className="modal-overlay"><div className="modal-box" style={{ maxWidth:560 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div><h2 style={{ fontSize:18, fontWeight:800, color:'#1e293b', margin:0 }}>Richiesta d'Offerta</h2><p style={{ fontSize:11, color:'#64748b', marginTop:3 }}>{selezionate.size} voci · € {fmt(totSel)}</p></div>
            <button onClick={() => setShowRdo(false)} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:8, cursor:'pointer' }}><X size={15} color="#64748b"/></button>
          </div>
          <div style={{ background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:10, padding:'12px 16px', marginBottom:16, maxHeight:220, overflowY:'auto' }}>
            {voci.filter(v=>selezionate.has(v.id)).map(v => (
              <div key={v.id} style={{ display:'flex', gap:8, padding:'5px 0', borderBottom:'1px solid rgba(139,92,246,0.1)', fontSize:11 }}>
                <span style={{ color:'#7c3aed', fontFamily:'monospace', flexShrink:0 }}>{v.codice||'—'}</span>
                <span style={{ color:'#4c1d95', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{v.descrizione}</span>
                <span style={{ color:'#7c3aed', fontFamily:'monospace', flexShrink:0, fontWeight:700 }}>€ {fmt(v.importo)}</span>
              </div>
            ))}
          </div>
          <div style={{ background:'#f8fafc', borderRadius:10, padding:16, fontSize:12, color:'#64748b', textAlign:'center' }}>
            <div style={{ fontSize:20, marginBottom:8 }}>🚀</div>
            <div style={{ fontWeight:700, color:'#334155', marginBottom:6 }}>Modulo RDO — In sviluppo</div>
            <div>Potrai inviare la RDO ai fornitori, ricevere preventivi, confrontarli e generare contratti di subappalto e ordini di acquisto in automatico.</div>
          </div>
          <div style={{ marginTop:16, display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button onClick={() => setShowRdo(false)} className="btn-secondary">Chiudi</button>
            <button className="btn-primary" style={{ background:'#8b5cf6', opacity:0.7, cursor:'not-allowed' }}><ShoppingCart size={13}/> Crea RDO (presto)</button>
          </div>
        </div></div>
      )}

      {showForm && (
        <div className="modal-overlay"><div className="modal-box" style={{ maxWidth:680 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#1e293b', margin:0 }}>{editingId?'Modifica voce':'Nuova voce'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:8, cursor:'pointer' }}><X size={15} color="#64748b"/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, maxHeight:'70vh', overflowY:'auto', paddingRight:2 }}>
            <div><label style={lbl}>Capitolo</label><input value={form.capitolo} onChange={e=>setForm(p=>({...p,capitolo:e.target.value}))} placeholder="es. OPERE IN C.A." style={inp}/></div>
            <div><label style={lbl}>Codice tariffa</label><input value={form.codice} onChange={e=>setForm(p=>({...p,codice:e.target.value}))} style={{ ...inp, fontFamily:'monospace' }}/></div>
            <div><label style={lbl}>Codice prezzario</label><input value={form.codice_prezzario} onChange={e=>setForm(p=>({...p,codice_prezzario:e.target.value}))} style={{ ...inp, fontFamily:'monospace' }}/></div>
            <div><label style={lbl}>U.M.</label><select value={form.um} onChange={e=>setForm(p=>({...p,um:e.target.value}))} style={{ ...inp, width:'100%' }}>{UM_LIST.map(u=><option key={u}>{u}</option>)}</select></div>
            <div style={{ gridColumn:'span 2' }}><label style={lbl}>Descrizione completa *</label><textarea value={form.descrizione} onChange={e=>setForm(p=>({...p,descrizione:e.target.value}))} rows={4} placeholder="Inserisci descrizione completa della lavorazione..." style={{ ...inp, resize:'vertical', minHeight:90, width:'100%' }}/></div>
            <div><label style={lbl}>Quantità</label><input type="number" step="0.001" value={form.quantita||''} onChange={e=>setForm(p=>({...p,quantita:parseFloat(e.target.value)||0}))} style={{ ...inp, fontFamily:'monospace' }}/></div>
            <div><label style={lbl}>Prezzo unitario (€)</label><input type="number" step="0.01" value={form.prezzo_unitario||''} onChange={e=>setForm(p=>({...p,prezzo_unitario:parseFloat(e.target.value)||0}))} style={{ ...inp, fontFamily:'monospace' }}/></div>
            <div style={{ gridColumn:'span 2', background:'rgba(30,58,95,0.06)', border:'1px solid rgba(30,58,95,0.15)', borderRadius:9, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'#1e3a5f' }}>Importo calcolato</span>
              <span style={{ fontSize:22, fontWeight:900, color:'#1e3a5f', fontFamily:'monospace' }}>€ {fmt(form.quantita*form.prezzo_unitario)}</span>
            </div>
            <div><label style={lbl}>% Manodopera</label><input type="number" min={0} max={100} value={form.pct_manodopera} onChange={e=>setForm(p=>({...p,pct_manodopera:parseFloat(e.target.value)||0}))} style={{ ...inp, borderColor:'#10b98140' }}/></div>
            <div><label style={lbl}>% Materiali</label><input type="number" min={0} max={100} value={form.pct_materiali} onChange={e=>setForm(p=>({...p,pct_materiali:parseFloat(e.target.value)||0}))} style={{ ...inp, borderColor:'#3b82f640' }}/></div>
            <div style={{ gridColumn:'span 2' }}>
              <label style={lbl}>Tipo costo</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                {TIPI_COSTO.map(t => { const on=form.tipo_costo.includes(t.id); return <button key={t.id} type="button" onClick={() => { const cur=form.tipo_costo; const newT=cur.includes(t.id)?(cur.filter(x=>x!==t.id).length>0?cur.filter(x=>x!==t.id):['INT']):[...cur,t.id]; setForm(p=>({...p,tipo_costo:newT})) }} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 16px', borderRadius:8, border:'2px solid '+(on?t.color:'var(--border)'), background:on?(t.color+'15'):'var(--bg)', cursor:'pointer' }}><span style={{ fontSize:14, fontWeight:800, color:on?t.color:'var(--t3)' }}>{t.id}</span><span style={{ fontSize:9, color:on?(t.color+'cc'):'var(--t4)', marginTop:1 }}>{t.label}</span></button> })}
              </div>
            </div>
            <div style={{ gridColumn:'span 2' }}><label style={lbl}>Note approvvigionamento</label><input value={form.note_approvvigionamento} onChange={e=>setForm(p=>({...p,note_approvvigionamento:e.target.value}))} placeholder="es. Verificare disponibilità fornitore" style={inp}/></div>
          </div>
          <div style={{ marginTop:18, display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary">Annulla</button>
            <button onClick={salvaVoce} disabled={saving||!form.descrizione.trim()} className="btn-primary"><Save size={14}/>{saving?'Salvataggio...':editingId?'Aggiorna':'Aggiungi voce'}</button>
          </div>
        </div></div>
      )}
    </div>
  )
}
