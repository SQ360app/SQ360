'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, Trash2, Eye, Sparkles, CheckCircle, AlertTriangle, File, X } from 'lucide-react'

type TipoDoc = 'BANDO' | 'CAPITOLATO' | 'COMPUTO' | 'CONTRATTO' | 'VERBALE' | 'SAL_FIRMATO' | 'VARIANTE' | 'DAM' | 'ALTRO'

interface Documento {
  id: string
  tipo: TipoDoc
  nome: string
  file_nome: string
  file_size: number
  ai_elaborato: boolean
  ai_dati_estratti: Record<string, unknown>
  created_at: string
}

const TIPO_META: Record<TipoDoc, { label: string; color: string; icon: string }> = {
  BANDO:       { label: 'Bando di gara',       color: '#f59e0b', icon: '📢' },
  CAPITOLATO:  { label: 'Capitolato speciale',  color: '#3b82f6', icon: '📋' },
  COMPUTO:     { label: 'Computo estimativo',   color: '#10b981', icon: '🔢' },
  CONTRATTO:   { label: "Contratto d'appalto",  color: '#8b5cf6', icon: '📝' },
  VERBALE:     { label: 'Verbale',              color: '#6b7280', icon: '🗒️' },
  SAL_FIRMATO: { label: 'SAL firmato',          color: '#10b981', icon: '✅' },
  VARIANTE:    { label: 'Variante',             color: '#ef4444', icon: '🔄' },
  DAM:         { label: 'DAM',                  color: '#ec4899', icon: '📦' },
  ALTRO:       { label: 'Altro',               color: '#94a3b8', icon: '📄' },
}

const AZIENDA_ID = 'f5ddf460-715a-495e-997a-0246ea73326b'

function fmtSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}

export default function DocumentiPage() {
  const { id } = useParams() as { id: string }
  const [documenti, setDocumenti] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [erroreUpload, setErroreUpload] = useState('')
  const [aiAnalyzing, setAiAnalyzing] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [nuovoTipo, setNuovoTipo] = useState<TipoDoc>('CAPITOLATO')
  const [nuovoNome, setNuovoNome] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoDoc | 'TUTTI'>('TUTTI')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const modalFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { carica() }, [id])

  async function carica() {
    const { data, error } = await supabase
      .from('documenti_commessa')
      .select('*')
      .eq('commessa_id', id)
      .order('created_at', { ascending: false })
    if (data) setDocumenti(data)
    if (error) console.error('Carica documenti error:', error)
    setLoading(false)
  }

  async function getAziendaId(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return AZIENDA_ID
      const { data } = await supabase.from('utenti').select('azienda_id').eq('id', user.id).single()
      return data?.azienda_id || AZIENDA_ID
    } catch { return AZIENDA_ID }
  }

  function apriModal(file?: File) {
    setPendingFile(file || null)
    setNuovoNome(file ? file.name.replace(/\.[^/.]+$/, '') : '')
    setErroreUpload('')
    setShowModal(true)
  }

  async function uploadFile() {
    if (!pendingFile) return
    setUploading(true)
    setErroreUpload('')
    try {
      const aziendaId = await getAziendaId()
      const ext = pendingFile.name.split('.').pop() || 'bin'
      const path = `${aziendaId}/${id}/${Date.now()}.${ext}`

      // Upload su Storage (non bloccante se il bucket non esiste)
      let fileUrl: string | null = null
      try {
        const { error: storageErr } = await supabase.storage.from('documenti').upload(path, pendingFile, { upsert: false })
        if (!storageErr) {
          fileUrl = supabase.storage.from('documenti').getPublicUrl(path).data.publicUrl
        } else {
          console.warn('Storage upload skip:', storageErr.message)
        }
      } catch (storageEx) {
        console.warn('Storage exception:', storageEx)
      }

      // Insert DB — funziona anche senza file_url
      const { data: doc, error: dbErr } = await supabase
        .from('documenti_commessa')
        .insert([{
          commessa_id: id,
          tipo: nuovoTipo,
          nome: nuovoNome || pendingFile.name.replace(/\.[^/.]+$/, ''),
          file_nome: pendingFile.name,
          file_size: pendingFile.size,
          file_url: fileUrl,
          ai_elaborato: false,
          ai_dati_estratti: {},
          versione: 1,
        }])
        .select()
        .single()

      if (dbErr) {
        setErroreUpload(`Errore DB: ${dbErr.message} [${dbErr.code}]`)
        return
      }

      if (doc) {
        setDocumenti(prev => [doc, ...prev])
        setShowModal(false)
        setPendingFile(null)
        setNuovoNome('')
        // AI analisi automatica per doc rilevanti
        if (['CAPITOLATO', 'BANDO', 'CONTRATTO', 'COMPUTO'].includes(nuovoTipo)) {
          analizzaAI(doc.id, pendingFile)
        }
      }
    } catch (err) {
      setErroreUpload(`Errore: ${String(err)}`)
    } finally {
      setUploading(false)
    }
  }

  async function analizzaAI(docId: string, file?: File) {
    setAiAnalyzing(docId)
    try {
      let testoFile = ''
      if (file) {
        const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type.includes('officedocument')
        const isPdf = file.type === 'application/pdf'
        if (isDocx) {
          const fd = new FormData(); fd.append('file', file)
          const dr = await fetch('/api/docx-text', { method: 'POST', body: fd })
          const dj = await dr.json() as {ok: boolean; testo?: string}
          testoFile = dj.ok ? (dj.testo || '') : ''
        } else if (!isPdf) {
          testoFile = await file.text().catch(() => '')
        }
      }
      if (testoFile.trim().length < 20) {
        setAiAnalyzing(null)
        return
      }
      const response = await fetch('/api/ai-estrai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testoFile, tipo: 'documento' })
      })
      const result = await response.json() as { ok: boolean; dati?: Record<string, unknown> }
      if (result.ok && result.dati) {
        await supabase.from('documenti_commessa')
          .update({ ai_elaborato: true, ai_dati_estratti: result.dati })
          .eq('id', docId)
        setDocumenti(prev => prev.map(d => d.id === docId ? { ...d, ai_elaborato: true, ai_dati_estratti: result.dati as Record<string, unknown> } : d))
        setAiResult(result.dati)
      }
    } catch (err) { console.error('AI error:', err) }
    setAiAnalyzing(null)
  }

  async function elimina(docId: string) {
    if (!confirm('Eliminare il documento?')) return
    await supabase.from('documenti_commessa').delete().eq('id', docId)
    setDocumenti(prev => prev.filter(d => d.id !== docId))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) apriModal(file)
  }

  const filtrati = documenti.filter(d => filtroTipo === 'TUTTI' || d.tipo === filtroTipo)
  const inp: React.CSSProperties = { width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13, boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Documenti & AI</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>Archivio documenti · AI estrae dati automaticamente da capitolati e contratti</p>
        </div>
        <button onClick={() => apriModal()} className="btn-primary"><Upload size={14} /> Carica documento</button>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFiltroTipo('TUTTI')} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroTipo === 'TUTTI' ? 'var(--accent)' : 'var(--panel)', color: filtroTipo === 'TUTTI' ? 'white' : 'var(--t3)' }}>
          Tutti ({documenti.length})
        </button>
        {(Object.keys(TIPO_META) as TipoDoc[]).filter(t => documenti.some(d => d.tipo === t)).map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${TIPO_META[t].color}30`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroTipo === t ? `${TIPO_META[t].color}15` : 'var(--panel)', color: filtroTipo === t ? TIPO_META[t].color : 'var(--t3)' }}>
            {TIPO_META[t].icon} {TIPO_META[t].label} ({documenti.filter(d => d.tipo === t).length})
          </button>
        ))}
      </div>

      {/* Drop area */}
      <div
        ref={fileRef as unknown as React.RefObject<HTMLDivElement>}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => { const inp = document.getElementById('doc-file-input') as HTMLInputElement; inp?.click() }}
        style={{ border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '18px 24px', background: dragOver ? 'var(--accent-light)' : 'var(--panel)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 20 }}
      >
        <Upload size={18} color={dragOver ? 'var(--accent)' : 'var(--t4)'} />
        <span style={{ fontSize: 13, color: dragOver ? 'var(--accent)' : 'var(--t3)' }}>
          Trascina qui un documento oppure <strong>clicca per selezionare</strong> — PDF, Word, TXT, XPWE
        </span>
        <input id="doc-file-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.xpwe" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) apriModal(f); e.target.value = '' }} />
      </div>

      {/* Risultato AI */}
      {aiResult && (
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>AI ha estratto questi dati</span>
            <button onClick={() => setAiResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            {Object.entries(aiResult).filter(([, v]) => v && String(v).trim()).map(([k, v]) => (
              <div key={k} style={{ background: 'var(--panel)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista documenti */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filtrati.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--t3)' }}>
          <File size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, marginBottom: 8 }}>Nessun documento</div>
          <div style={{ fontSize: 12 }}>Carica il capitolato, il contratto o altri documenti di commessa</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrati.map(doc => {
            const tm = TIPO_META[doc.tipo]
            return (
              <div key={doc.id} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${tm.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{tm.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: tm.color }}>{tm.label}</span>
                    {doc.ai_elaborato && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 5, padding: '1px 6px' }}><Sparkles size={9} /> AI elaborato</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }} className="truncate">{doc.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{doc.file_nome} · {fmtSize(doc.file_size)} · {doc.created_at?.slice(0, 10)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!doc.ai_elaborato && ['CAPITOLATO', 'BANDO', 'CONTRATTO'].includes(doc.tipo) && (
                    <button onClick={() => analizzaAI(doc.id)} disabled={aiAnalyzing === doc.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(59,130,246,0.3)', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 11, cursor: aiAnalyzing === doc.id ? 'wait' : 'pointer', fontWeight: 600 }}>
                      <Sparkles size={11} />{aiAnalyzing === doc.id ? 'Analisi...' : 'Analizza AI'}
                    </button>
                  )}
                  <button onClick={() => elimina(doc.id)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal upload */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Carica documento</h2>
              <button onClick={() => { setShowModal(false); setPendingFile(null) }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}><X size={15} color="#64748b" /></button>
            </div>

            {erroreUpload && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#ef4444', display: 'flex', gap: 8 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />{erroreUpload}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Tipo documento</label>
                <select value={nuovoTipo} onChange={e => setNuovoTipo(e.target.value as TipoDoc)} style={{ ...inp, width: '100%' }}>
                  {(Object.keys(TIPO_META) as TipoDoc[]).map(t => <option key={t} value={t}>{TIPO_META[t].icon} {TIPO_META[t].label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Nome documento</label>
                <input value={nuovoNome} onChange={e => setNuovoNome(e.target.value)} placeholder="Lascia vuoto per usare il nome del file" style={inp} />
              </div>

              {pendingFile ? (
                <div style={{ border: '2px solid var(--accent)', borderRadius: 10, padding: '16px', background: 'var(--accent-light)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{pendingFile.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{fmtSize(pendingFile.size)}</div>
                  <button onClick={() => { setPendingFile(null); setNuovoNome('') }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 11 }}>✕ Cambia file</button>
                </div>
              ) : (
                <div onClick={() => modalFileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '28px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg)' }}>
                  <Upload size={24} color="var(--t4)" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 13, color: 'var(--t3)' }}>Clicca per selezionare il file</div>
                  <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 4 }}>PDF, Word, TXT, XPWE</div>
                  <input ref={modalFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.xpwe" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); if (!nuovoNome) setNuovoNome(f.name.replace(/\.[^/.]+$/, '')) } }} />
                </div>
              )}

              {['CAPITOLATO', 'BANDO', 'CONTRATTO'].includes(nuovoTipo) && pendingFile && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'var(--accent-light)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8 }}>
                  <Sparkles size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>AI analizzerà automaticamente il documento ed estrarrà CIG, importo, date e figure professionali.</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowModal(false); setPendingFile(null) }} className="btn-secondary">Annulla</button>
              <button onClick={uploadFile} disabled={!pendingFile || uploading} className="btn-primary" style={{ opacity: (!pendingFile || uploading) ? 0.5 : 1 }}>
                <Upload size={14} />{uploading ? 'Caricamento...' : 'Carica documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
