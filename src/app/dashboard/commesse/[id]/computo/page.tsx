'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Upload, Plus, Search, ChevronDown, ChevronRight, FileText, Trash2, Edit2, Save, X } from 'lucide-react'

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
  selezionata: boolean
}

interface Computo { id: string; tipo_uso: string; fonte: string; data_import: string }

interface FormVoce {
  capitolo: string; codice: string; codice_prezzario: string; descrizione: string
  um: string; quantita: number; prezzo_unitario: number
  pct_manodopera: number; pct_materiali: number; pct_noli: number
}

function fmt(n: number) {
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FORM_VUOTO: FormVoce = {
  capitolo: '', codice: '', codice_prezzario: '', descrizione: '',
  um: 'mc', quantita: 0, prezzo_unitario: 0,
  pct_manodopera: 30, pct_materiali: 45, pct_noli: 12
}

export default function ComputoPage() {
  const { id: commessaId } = useParams() as { id: string }
  const [computo, setComputo] = useState<Computo | null>(null)
  const [voci, setVoci] = useState<VoceComputo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [capitoliAperti, setCapitoliAperti] = useState<Record<string, boolean>>({})
  const [showImport, setShowImport] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormVoce>({ ...FORM_VUOTO })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { carica() }, [commessaId])

  async function carica() {
    setLoading(true)
    const { data: comp } = await supabase
      .from('computo_metrico').select('*')
      .eq('commessa_id', commessaId).eq('tipo_uso', 'AGGIUDICATA').single()
    if (comp) {
      setComputo(comp)
      const { data: v } = await supabase.from('voci_computo').select('*')
        .eq('computo_id', comp.id).order('capitolo').order('codice')
      if (v) {
        setVoci(v as VoceComputo[])
        const caps = [...new Set((v as VoceComputo[]).map(x => x.capitolo || 'Generale'))]
        if (caps[0]) setCapitoliAperti({ [caps[0]]: true })
      }
    }
    setLoading(false)
  }

  async function getOrCreateComputoId(): Promise<string | null> {
    if (computo?.id) return computo.id
    const { data } = await supabase.from('computo_metrico')
      .insert([{ commessa_id: commessaId, tipo_uso: 'AGGIUDICATA', fonte: 'MANUALE', data_import: new Date().toISOString().slice(0, 10) }])
      .select().single()
    if (data) { setComputo(data as Computo); return data.id as string }
    return null
  }

  async function handleFileImport(file: File) {
    setImporting(true)
    setImportMsg('Analisi file in corso...')
    try {
      const isXpwe = file.name.toLowerCase().endsWith('.xpwe') || file.name.toLowerCase().endsWith('.xml')
      const computoId = await getOrCreateComputoId()
      if (!computoId) { setImportMsg('❌ Errore creazione computo'); setImporting(false); return }
      let vociDaInserire: Record<string, unknown>[] = []

      if (isXpwe) {
        setImportMsg('🏗 Lettura file Primus XPWE...')
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/xpwe-parse', { method: 'POST', body: fd })
        const json = await res.json() as { ok: boolean; voci?: Array<Record<string,unknown>>; errore?: string }
        if (!json.ok || !json.voci) { setImportMsg(`❌ ${json.errore || 'Errore lettura XPWE'}`); setImporting(false); return }
        setImportMsg(`Trovate ${json.voci.length} voci Primus. Salvataggio...`)
        vociDaInserire = json.voci.map((v: Record<string,unknown>) => ({
          computo_id: computoId,
          capitolo: String(v.capitolo || 'Importato Primus'),
          codice: String(v.codice || '').slice(0, 30),
          codice_prezzario: String(v.codice || '').slice(0, 30),
          descrizione: String(v.descrizione || '').slice(0, 1000),
          um: String(v.um || 'nr').slice(0, 10),
          quantita: Number(v.quantita) || 0,
          prezzo_unitario: Number(v.prezzo_unitario) || 0,
          importo: Number(v.importo) || (Number(v.quantita) * Number(v.prezzo_unitario)) || 0,
          pct_manodopera: 30, pct_materiali: 45, pct_noli: 12, selezionata: true
        }))
      } else {
        const testo = await file.text()
        const righe = testo.split('\n').filter(r => r.trim())
        if (righe.length < 2) { setImportMsg('⚠️ File CSV vuoto'); setImporting(false); return }
        const sep = testo.includes(';') ? ';' : ','
        const header = righe[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''))
        setImportMsg(`Trovate ${righe.length - 1} voci CSV. Importazione...`)
        for (let i = 1; i < righe.length; i++) {
          const valori = righe[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
          if (valori.length < 2 || !valori.some(v => v.trim())) continue
          const idx = (n: string) => header.findIndex(h => h.includes(n))
          const get = (n: string) => valori[Math.max(0, idx(n))] || ''
          const q = parseFloat(get('quant') || get('qta') || '0') || 0
          const p = parseFloat(get('prezz') || get('pu') || get('unitario') || get('prezzo') || '0') || 0
          vociDaInserire.push({
            computo_id: computoId,
            capitolo: get('cap') || get('sezione') || get('capitolo') || 'Importato',
            codice: (get('codice') || get('cod') || `CSV${i.toString().padStart(3,'0')}`).slice(0,30),
            codice_prezzario: get('prezzario') || get('tariffa') || '',
            descrizione: (get('descriz') || get('desc') || get('lavorazione') || valori[0] || `Voce ${i}`).slice(0,1000),
            um: (get('um') || get('unita') || get('misura') || 'nr').slice(0,10),
            quantita: q, prezzo_unitario: p, importo: q * p,
            pct_manodopera: parseFloat(get('manod') || '30') || 30,
            pct_materiali: parseFloat(get('mater') || '45') || 45,
            pct_noli: parseFloat(get('noli') || '12') || 12, selezionata: true
          })
        }
      }

      if (vociDaInserire.length === 0) { setImportMsg('⚠️ Nessuna voce trovata. Verifica il formato.'); setImporting(false); return }

      // Inserimento batch da 100
      let tot = 0
      for (let i = 0; i < vociDaInserire.length; i += 100) {
        const { error } = await supabase.from('voci_computo').insert(vociDaInserire.slice(i, i + 100))
        if (error) { setImportMsg(`❌ Errore DB: ${error.message}`); setImporting(false); return }
        tot += Math.min(100, vociDaInserire.length - i)
        setImportMsg(`Salvataggio ${tot}/${vociDaInserire.length}...`)
      }
      setImportMsg(`✅ Importate ${tot} voci!`)
      await carica()
    } catch(err) { setImportMsg(`❌ Errore: ${String(err)}`) }
    setImporting(false)
    setTimeout(() => { setShowImport(false); setImportMsg('') }, 4000)
  }
  async function salvaVoce() {
    if (!form.descrizione.trim()) return
    setSaving(true)
    const computoId = await getOrCreateComputoId()
    if (!computoId) { setSaving(false); return }
    const importo = form.quantita * form.prezzo_unitario
    const payload = { ...form, importo, computo_id: computoId, selezionata: true }
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

  async function eliminaVoce(voceId: string) {
    if (!confirm('Eliminare la voce?')) return
    await supabase.from('voci_computo').delete().eq('id', voceId)
    setVoci(prev => prev.filter(v => v.id !== voceId))
  }

  function iniziaModifica(voce: VoceComputo) {
    setForm({
      capitolo: voce.capitolo || '', codice: voce.codice || '',
      codice_prezzario: voce.codice_prezzario || '', descrizione: voce.descrizione,
      um: voce.um || 'mc', quantita: voce.quantita, prezzo_unitario: voce.prezzo_unitario,
      pct_manodopera: voce.pct_manodopera || 30, pct_materiali: voce.pct_materiali || 45, pct_noli: voce.pct_noli || 12
    })
    setEditingId(voce.id); setShowForm(true)
  }

  function setF<K extends keyof FormVoce>(f: K, v: FormVoce[K]) {
    setForm(p => ({ ...p, [f]: v }))
  }

  const vociFiltrate = voci.filter(v =>
    !search || v.descrizione?.toLowerCase().includes(search.toLowerCase()) ||
    v.codice?.toLowerCase().includes(search.toLowerCase())
  )
  const capitoli = [...new Set(vociFiltrate.map(v => v.capitolo || 'Generale'))]
  const totaleImporto = voci.reduce((s, v) => s + (v.importo || 0), 0)

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', color: '#1e293b', fontSize: 13 }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '22px 28px', background: 'var(--bg)', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Computo Metrico Aggiudicato</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>{voci.length} voci · Totale: <strong>€ {fmt(totaleImporto)}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImport(true)} className="btn-secondary" style={{ fontSize: 12 }}><Upload size={13} /> Importa file</button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...FORM_VUOTO }) }} className="btn-primary" style={{ fontSize: 12 }}><Plus size={13} /> Nuova voce</button>
        </div>
      </div>

      {/* KPI */}
      {voci.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Totale computo', val: `€ ${fmt(totaleImporto)}`, color: '#3b82f6' },
            { label: 'N° voci', val: String(voci.length), color: '#8b5cf6' },
            { label: 'Capitoli', val: String(capitoli.length), color: '#10b981' },
            { label: 'Imp. medio voce', val: `€ ${fmt(totaleImporto / voci.length)}`, color: '#f59e0b' },
          ].map((k, i) => (
            <div key={i} className="kpi-card" style={{ borderLeft: `3px solid ${k.color}`, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ricerca */}
      {voci.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per descrizione o codice..."
            style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px 9px 34px', fontSize: 13, color: 'var(--t1)', boxSizing: 'border-box' }} />
        </div>
      )}

      {/* Contenuto */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : voci.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 32px', background: 'var(--panel)', border: '2px dashed var(--border)', borderRadius: 16 }}>
          <FileText size={40} color="var(--t4)" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t2)', margin: '0 0 8px' }}>Nessun computo metrico</h3>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>Importa da file CSV oppure inserisci le voci manualmente</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload size={14} /> Importa da file</button>
            <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={14} /> Inserisci manualmente</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {capitoli.map(cap => {
            const vociCap = vociFiltrate.filter(v => (v.capitolo || 'Generale') === cap)
            const totaleCap = vociCap.reduce((s, v) => s + (v.importo || 0), 0)
            const aperto = capitoliAperti[cap]
            return (
              <div key={cap} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={() => setCapitoliAperti(p => ({ ...p, [cap]: !p[cap] }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  {aperto ? <ChevronDown size={14} color="var(--t3)" /> : <ChevronRight size={14} color="var(--t3)" />}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 5, padding: '2px 8px', border: '1px solid rgba(59,130,246,0.2)' }}>{cap}</span>
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>{vociCap.length} voci</span>
                  <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>€ {fmt(totaleCap)}</span>
                </button>
                {aperto && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                      <thead>
                        <tr style={{ background: 'rgba(59,130,246,0.04)', borderTop: '1px solid var(--border)' }}>
                          {['Codice','Descrizione','U.M.','Quantità','P.U. €','Importo €','MAN%','MAT%','NOL%',''].map(h => (
                            <th key={h} style={{ padding: '8px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vociCap.map((voce, idx) => (
                          <tr key={voce.id} style={{ borderBottom: idx < vociCap.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '10px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--t3)' }}>{voce.codice || '—'}</td>
                            <td style={{ padding: '10px', fontSize: 12, color: 'var(--t1)', maxWidth: 280 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{voce.descrizione}</div>
                            </td>
                            <td style={{ padding: '10px', fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>{voce.um}</td>
                            <td style={{ padding: '10px', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t2)' }}>{(voce.quantita || 0).toFixed(3)}</td>
                            <td style={{ padding: '10px', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--t2)' }}>€ {fmt(voce.prezzo_unitario)}</td>
                            <td style={{ padding: '10px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 700, color: 'var(--t1)' }}>€ {fmt(voce.importo)}</td>
                            <td style={{ padding: '10px', fontSize: 11, textAlign: 'center', color: '#10b981' }}>{voce.pct_manodopera || 30}%</td>
                            <td style={{ padding: '10px', fontSize: 11, textAlign: 'center', color: '#3b82f6' }}>{voce.pct_materiali || 45}%</td>
                            <td style={{ padding: '10px', fontSize: 11, textAlign: 'center', color: '#f59e0b' }}>{voce.pct_noli || 12}%</td>
                            <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => iniziaModifica(voce)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: 'var(--t3)', display: 'flex', alignItems: 'center' }}><Edit2 size={11} /></button>
                                <button onClick={() => eliminaVoce(voce.id)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}><Trash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'rgba(59,130,246,0.04)', borderTop: '2px solid var(--border)' }}>
                          <td colSpan={5} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--t2)' }}>Totale {cap}</td>
                          <td style={{ padding: '8px 10px', fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent)', textAlign: 'right' }}>€ {fmt(totaleCap)}</td>
                          <td colSpan={4} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '2px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>TOTALE COMPUTO AGGIUDICATO</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>€ {fmt(totaleImporto)}</span>
          </div>
        </div>
      )}

      {/* MODAL IMPORT */}
      {showImport && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Importa Computo Metrico</h2>
                  <p style={{ fontSize: 11, color: '#64748b', marginTop: 2, margin: 0 }}>Supporta Primus XPWE e CSV</p>
              <button onClick={() => { setShowImport(false); setImportMsg('') }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>
            {importMsg ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 14, color: importMsg.startsWith('✅') ? '#10b981' : importMsg.startsWith('❌') ? '#ef4444' : '#f59e0b' }}>{importMsg}</div>
                {importing && <div className="spinner" style={{ margin: '12px auto 0' }} />}
              </div>
            ) : (
              <>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Formato CSV (intestazione obbligatoria):</div>
                  <code style={{ fontSize: 11, color: '#475569', background: '#e2e8f0', padding: '6px 10px', borderRadius: 5, display: 'block' }}>
                    capitolo;codice;descrizione;um;quantita;prezzo_unitario
                  </code>
                </div>
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #e2e8f0', borderRadius: 10, padding: 36, textAlign: 'center', cursor: 'pointer', background: '#f8fafc', marginBottom: 14 }}>
                  <Upload size={26} color="#94a3b8" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 3 }}>Clicca per selezionare il file</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>CSV, XLS, XLSX</div>
                  <input ref={fileRef} type="file" accept=".csv,.txt,.xpwe,.xml,.xls,.xlsx" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileImport(f) }} />
                </div>
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#1e40af' }}>

                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL NUOVA/MODIFICA VOCE */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>{editingId ? 'Modifica voce' : 'Nuova voce computo'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Capitolo</label><input value={form.capitolo} onChange={e => setF('capitolo', e.target.value)} placeholder="es. Opere in c.a." style={inp} /></div>
              <div><label style={lbl}>Codice voce</label><input value={form.codice} onChange={e => setF('codice', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
              <div><label style={lbl}>Codice prezzario</label><input value={form.codice_prezzario} onChange={e => setF('codice_prezzario', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
              <div><label style={lbl}>U.M.</label>
                <select value={form.um} onChange={e => setF('um', e.target.value)} style={{ ...inp, width: '100%' }}>
                  {['mc','mq','ml','kg','t','nr','corpo','lt','ora','gg'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Descrizione *</label>
                <textarea value={form.descrizione} onChange={e => setF('descrizione', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', minHeight: 70, width: '100%' }} />
              </div>
              <div><label style={lbl}>Quantità</label><input type="number" step="0.001" value={form.quantita} onChange={e => setF('quantita', parseFloat(e.target.value) || 0)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
              <div><label style={lbl}>Prezzo unitario (€)</label><input type="number" step="0.01" value={form.prezzo_unitario} onChange={e => setF('prezzo_unitario', parseFloat(e.target.value) || 0)} style={{ ...inp, fontFamily: 'monospace' }} /></div>
              <div style={{ gridColumn: 'span 2', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 9, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#1e40af' }}>Importo calcolato</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>€ {fmt(form.quantita * form.prezzo_unitario)}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Incidenze componenti (%)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {([
                    { f: 'pct_manodopera' as keyof FormVoce, l: 'Manodopera %', c: '#10b981' },
                    { f: 'pct_materiali' as keyof FormVoce, l: 'Materiali %', c: '#3b82f6' },
                    { f: 'pct_noli' as keyof FormVoce, l: 'Noli %', c: '#f59e0b' }
                  ]).map(({ f, l, c }) => (
                    <div key={f}>
                      <label style={{ ...lbl, color: c }}>{l}</label>
                      <input type="number" min={0} max={100}
                        value={form[f] as number}
                        onChange={e => setF(f, parseFloat(e.target.value) || 0)}
                        style={{ ...inp, borderColor: c + '40' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary">Annulla</button>
              <button onClick={salvaVoce} disabled={saving || !form.descrizione.trim()} className="btn-primary">
                <Save size={14} /> {saving ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Aggiungi voce'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
