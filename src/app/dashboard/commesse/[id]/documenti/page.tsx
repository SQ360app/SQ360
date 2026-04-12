'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase, getAziendaId } from '@/lib/supabase'
import { Upload, FileText, Trash2, Eye, Sparkles, CheckCircle, AlertTriangle, File } from 'lucide-react'

type TipoDoc = 'BANDO' | 'CAPITOLATO' | 'COMPUTO' | 'CONTRATTO' | 'VERBALE' | 'SAL_FIRMATO' | 'VARIANTE' | 'DAM' | 'ALTRO'

interface Documento {
  id: string
  tipo: TipoDoc
  nome: string
  descrizione: string
  file_nome: string
  file_size: number
  data_documento: string
  ai_elaborato: boolean
  ai_dati_estratti: Record<string, unknown>
  versione: number
  created_at: string
}

const TIPO_META: Record<TipoDoc, { label: string; color: string; icon: string }> = {
  BANDO:       { label: 'Bando di gara',          color: '#f59e0b', icon: '📢' },
  CAPITOLATO:  { label: 'Capitolato speciale',    color: '#3b82f6', icon: '📋' },
  COMPUTO:     { label: 'Computo estimativo',      color: '#10b981', icon: '🔢' },
  CONTRATTO:   { label: 'Contratto d\'appalto',   color: '#8b5cf6', icon: '📝' },
  VERBALE:     { label: 'Verbale',                color: '#6b7280', icon: '🗒️' },
  SAL_FIRMATO: { label: 'SAL firmato',            color: '#10b981', icon: '✅' },
  VARIANTE:    { label: 'Variante',               color: '#ef4444', icon: '🔄' },
  DAM:         { label: 'DAM',                    color: '#ec4899', icon: '📦' },
  ALTRO:       { label: 'Altro',                  color: '#94a3b8', icon: '📄' },
}

function fmtSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}

export default function DocumentiPage() {
  const { id } = useParams() as { id: string }
  const [documenti, setDocumenti] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<TipoDoc | 'TUTTI'>('TUTTI')
  const [showUpload, setShowUpload] = useState(false)
  const [nuovoTipo, setNuovoTipo] = useState<TipoDoc>('CAPITOLATO')
  const [nuovoNome, setNuovoNome] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null)
  const [pendingFile, setPendingFile] = useState<File|null>(null)

  useEffect(() => { carica() }, [id])

  async function carica() {
    const { data } = await supabase
      .from('documenti_commessa')
      .select('*')
      .eq('commessa_id', id)
      .order('created_at', { ascending: false })
    if (data) setDocumenti(data)
    setLoading(false)
  }

  async function uploadFile(file: File) {
    setUploading(true)
    const aziendaId = await getAziendaId()
    const ext = file.name.split('.').pop()
    const path = `${aziendaId}/${id}/${Date.now()}.${ext}`

    // Upload file su Supabase Storage
    const { error: storageErr } = await supabase.storage
      .from('documenti')
      .upload(path, file, { upsert: false })

    const fileUrl = storageErr ? null : supabase.storage.from('documenti').getPublicUrl(path).data.publicUrl

    // Inserisci record nel DB
    const { data: doc, error } = await supabase
      .from('documenti_commessa')
      .insert([{
        commessa_id: id,
        tipo: nuovoTipo,
        nome: nuovoNome || file.name.replace(/\.[^/.]+$/, ''),
        file_nome: file.name,
        file_size: file.size,
        file_url: fileUrl,
        ai_elaborato: false,
        ai_dati_estratti: {},
        versione: 1
      }])
      .select().single()

    if (!error && doc) {
      setDocumenti(prev => [doc, ...prev])
      setShowUpload(false)
      setNuovoNome('')

      // Se è capitolato o contratto → analizza con AI
      if (['CAPITOLATO', 'BANDO', 'CONTRATTO', 'COMPUTO'].includes(nuovoTipo)) {
        analizzaAI(doc.id, file || pendingFile || undefined)
        setPendingFile(null)
      }
    }
    setUploading(false)
  }

  async function analizzaAI(docId: string, file?: File) {
    setAiAnalyzing(docId)
    try {
      let testoFile = ''
      if (file) {
        const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type.includes('officedocument')
        if (isDocx) {
          const fd = new FormData(); fd.append('file', file)
          const dr = await fetch('/api/docx-text', { method: 'POST', body: fd })
          const dj = await dr.json() as {ok:boolean; testo?:string}
          testoFile = dj.ok ? (dj.testo || '') : ''
        } else if (file.type.includes('text') || file.name.endsWith('.txt')) {
          testoFile = await file.text().catch(() => '')
        }
      }
      const response = await fetch('/api/ai-documenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, commessaId: id, testoFile, tipo: nuovoTipo })
      })
      const result = await response.json() as {datiEstrati?: Record<string,unknown>}
      if (result.datiEstrati) {
        await supabase.from('documenti_commessa')
          .update({ ai_elaborato: true, ai_dati_estratti: result.datiEstrati })
          .eq('id', docId)
        setDocumenti(prev => prev.map(d => d.id === docId ? { ...d, ai_elaborato: true, ai_dati_estratti: result.datiEstrati as Record<string,unknown> } : d))
        setAiResult(result.datiEstrati)
      }
    } catch (err) { console.error('AI error:', err) }
    setAiAnalyzing(null)
  }
  async function elimina(docId: string) {
    if (!confirm('Eliminare il documento?')) return
    await supabase.from('documenti_commessa').delete().eq('id', docId)
    setDocumenti(prev => prev.filter(d => d.id !== docId))
  }

  const filtrati = documenti.filter(d => filtroTipo === 'TUTTI' || d.tipo === filtroTipo)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) { setPendingFile(file); setShowUpload(true) }
  }

  const inp = { width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 11px', color: '#1e293b', fontSize: 13 }

  return (
    <div style={{ padding: '24px 32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Documenti & AI</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
            Archivio documenti di commessa · AI estrae dati automaticamente da capitolati e contratti
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          <Upload size={14} /> Carica documento
        </button>
      </div>

      {/* Filtri tipo */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFiltroTipo('TUTTI')} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroTipo === 'TUTTI' ? 'var(--accent)' : 'var(--panel)', color: filtroTipo === 'TUTTI' ? 'white' : 'var(--t3)' }}>Tutti ({documenti.length})</button>
        {(Object.keys(TIPO_META) as TipoDoc[]).filter(t => documenti.some(d => d.tipo === t)).map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${TIPO_META[t].color}30`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroTipo === t ? `${TIPO_META[t].color}15` : 'var(--panel)', color: filtroTipo === t ? TIPO_META[t].color : 'var(--t3)' }}>
            {TIPO_META[t].icon} {TIPO_META[t].label} ({documenti.filter(d => d.tipo === t).length})
          </button>
        ))}
      </div>

      {/* Area drop */}
      <div
        ref={dropRef}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12, padding: '20px 24px',
          background: dragOver ? 'var(--accent-light)' : 'var(--panel)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, cursor: 'pointer', marginBottom: 20,
          transition: 'all 0.15s'
        }}
      >
        <Upload size={18} color={dragOver ? 'var(--accent)' : 'var(--t4)'} />
        <span style={{ fontSize: 13, color: dragOver ? 'var(--accent)' : 'var(--t3)' }}>
          Trascina qui un documento oppure <strong>clicca per selezionare</strong> — PDF, Word, Excel, XPWE
        </span>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.xpwe" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setShowUpload(true) } }} />
      </div>

      {/* Risultato AI */}
      {aiResult && (
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>AI ha estratto questi dati</span>
            <button onClick={() => setAiResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {Object.entries(aiResult).map(([k, v]) => v ? (
              <div key={k} style={{ background: 'var(--panel)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{String(v)}</div>
              </div>
            ) : null)}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--t3)' }}>
            Questi dati sono stati salvati nel dossier. Puoi utilizzarli per aggiornare l&apos;anagrafica commessa.
          </div>
        </div>
      )}

      {/* Lista documenti */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
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
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${tm.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {tm.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: tm.color }}>{tm.label}</span>
                    {doc.versione > 1 && <span style={{ fontSize: 10, color: 'var(--t3)' }}>v{doc.versione}</span>}
                    {doc.ai_elaborato && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 5, padding: '1px 6px' }}>
                        <Sparkles size={9} /> AI elaborato
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }} className="truncate">{doc.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{doc.file_nome} · {fmtSize(doc.file_size)} · {doc.created_at?.slice(0,10)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!doc.ai_elaborato && ['CAPITOLATO','BANDO','CONTRATTO'].includes(doc.tipo) && (
                    <button
                      onClick={() => analizzaAI(doc.id)}
                      disabled={aiAnalyzing === doc.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(59,130,246,0.3)', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 11, cursor: aiAnalyzing === doc.id ? 'wait' : 'pointer', fontWeight: 600 }}
                    >
                      <Sparkles size={11} />
                      {aiAnalyzing === doc.id ? 'Analisi...' : 'Analizza AI'}
                    </button>
                  )}
                  <button style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Eye size={13} />
                  </button>
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
      {showUpload && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: '0 0 20px' }}>Carica documento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Tipo documento</label>
                <select value={nuovoTipo} onChange={e => setNuovoTipo(e.target.value as TipoDoc)} style={{ ...inp, width: '100%' }}>
                  {(Object.keys(TIPO_META) as TipoDoc[]).map(t => <option key={t} value={t}>{TIPO_META[t].icon} {TIPO_META[t].label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Nome documento (opzionale)</label>
                <input value={nuovoNome} onChange={e => setNuovoNome(e.target.value)} placeholder="Lascia vuoto per usare il nome del file" style={inp} />
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '32px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg)' }}
              >
                <Upload size={24} color="var(--t4)" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: 'var(--t3)' }}>Clicca per selezionare il file</div>
                <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 4 }}>PDF, Word, Excel, XPWE</div>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.xpwe" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
              </div>
              {['CAPITOLATO','BANDO','CONTRATTO'].includes(nuovoTipo) && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'var(--accent-light)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8 }}>
                  <Sparkles size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                    AI analizzerà automaticamente il documento ed estrarrà: CIG, CUP, importo, date, categorie SOA, figure professionali e voci principali.
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowUpload(false)} className="btn-secondary">Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
