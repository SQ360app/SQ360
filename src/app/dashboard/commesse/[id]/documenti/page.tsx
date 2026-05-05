'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATEGORIE = [
  { id: 'contratto', label: 'Contratto', icona: '📋' },
  { id: 'elaborati', label: 'Elaborati progettuali', icona: '📐' },
  { id: 'capitolato', label: 'Capitolato', icona: '📖' },
  { id: 'autorizzazioni', label: 'Autorizzazioni', icona: '🏛️' },
  { id: 'sicurezza', label: 'Sicurezza (PSC/POS)', icona: '🦺' },
  { id: 'collaudo', label: 'Collaudo', icona: '✅' },
  { id: 'corrispondenza', label: 'Corrispondenza DL', icona: '📧' },
  { id: 'altro', label: 'Altro', icona: '📎' },
]

interface Documento {
  id: string
  commessa_id: string
  nome: string
  categoria: string
  url: string
  tipo_mime: string
  dimensione: number
  note: string
  created_at: string
  uploaded_by?: string
}

const fmt = (b: number) => b > 1e6 ? (b/1e6).toFixed(1)+' MB' : b > 1e3 ? (b/1e3).toFixed(0)+' KB' : b+' B'
const isImg = (mime: string) => mime?.startsWith('image/')
const isPdf = (mime: string) => mime === 'application/pdf'

export default function DocumentiPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('tutti')
  const [preview, setPreview] = useState<Documento | null>(null)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState(false)
  const [newDoc, setNewDoc] = useState({ nome: '', categoria: 'contratto', note: '' })
  const [file, setFile] = useState<File | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('documenti_commessa')
      .select('*')
      .eq('commessa_id', id)
      .order('created_at', { ascending: false })
    setDocs((data as Documento[]) || [])
    setLoading(false)
  }, [id])

  useEffect(() => { carica() }, [carica])

  const getPublicUrl = (url: string) => {
    if (!url) return ''
    if (url.startsWith('http')) return url
    const { data } = supabase.storage.from('documenti').getPublicUrl(url)
    return data?.publicUrl || ''
  }

  const upload = async () => {
    if (!file || !newDoc.nome.trim()) { showToast('Inserisci nome e seleziona un file'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documenti').upload(path, file)
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('documenti').getPublicUrl(path)
      await supabase.from('documenti_commessa').insert({
        commessa_id: id,
        nome: newDoc.nome.trim(),
        categoria: newDoc.categoria,
        url: urlData.publicUrl,
        tipo_mime: file.type,
        dimensione: file.size,
        note: newDoc.note,
      })
      showToast('Documento caricato')
      setForm(false)
      setFile(null)
      setNewDoc({ nome: '', categoria: 'contratto', note: '' })
      carica()
    } catch (e: any) {
      showToast('Errore upload: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const elimina = async (doc: Documento) => {
    if (!window.confirm(`Eliminare il documento "${doc.nome}"?`)) return
    if (!window.confirm('Conferma definitiva: il documento verrà eliminato permanentemente.')) return
    await supabase.from('documenti_commessa').delete().eq('id', doc.id)
    showToast('Documento eliminato')
    carica()
  }

  const docsFiltrati = filtroCategoria === 'tutti' ? docs : docs.filter(d => d.categoria === filtroCategoria)

  const stileCard: React.CSSProperties = {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)'
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} className="fade-in">

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...stileCard, padding: '12px 16px' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>Documenti Commessa</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{docs.length} documento{docs.length !== 1 ? 'i' : ''} caricato{docs.length !== 1 ? 'i' : ''}</p>
        </div>
        <button className="btn-primary" style={{ fontSize: 12, padding: '8px 14px' }}
          onClick={() => setForm(true)}>
          + Carica documento
        </button>
      </div>

      {/* FILTRI CATEGORIE */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFiltroCategoria('tutti')}
          style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: filtroCategoria === 'tutti' ? 'var(--accent)' : 'var(--panel)', color: filtroCategoria === 'tutti' ? '#fff' : 'var(--t2)' }}>
          Tutti ({docs.length})
        </button>
        {CATEGORIE.map(c => {
          const count = docs.filter(d => d.categoria === c.id).length
          if (count === 0) return null
          return (
            <button key={c.id}
              onClick={() => setFiltroCategoria(c.id)}
              style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: filtroCategoria === c.id ? 'var(--accent)' : 'var(--panel)', color: filtroCategoria === c.id ? '#fff' : 'var(--t2)' }}>
              {c.icona} {c.label} ({count})
            </button>
          )
        })}
      </div>

      {/* LISTA DOCUMENTI */}
      <div style={stileCard}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
        ) : docsFiltrati.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            {docs.length === 0 ? 'Nessun documento caricato. Usa "+ Carica documento" per iniziare.' : 'Nessun documento in questa categoria.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, padding: 16 }}>
            {docsFiltrati.map(doc => {
              const pubUrl = getPublicUrl(doc.url)
              const cat = CATEGORIE.find(c => c.id === doc.categoria)
              return (
                <div key={doc.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => setPreview(doc)}>
                  {/* Thumbnail */}
                  <div style={{ height: 120, background: 'var(--panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {isImg(doc.tipo_mime) ? (
                      <img src={pubUrl} alt={doc.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 36 }}>{isPdf(doc.tipo_mime) ? '📄' : '📎'}</div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{doc.tipo_mime?.split('/')[1]?.toUpperCase() || 'FILE'}</div>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 6px', fontSize: 9, color: '#fff' }}>
                      {cat?.icona} {cat?.label || doc.categoria}
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nome}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>{fmt(doc.dimensione || 0)}</span>
                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <a href={pubUrl} download={doc.nome} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none', padding: '3px 8px', border: '1px solid var(--accent)', borderRadius: 4 }}>
                          ⬇ Scarica
                        </a>
                        <button onClick={() => elimina(doc)}
                          style={{ fontSize: 10, color: '#ef4444', background: 'none', border: '1px solid #ef4444', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL PREVIEW */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div style={{ background: 'var(--panel)', borderRadius: 16, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', position: 'relative' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>{preview.nome}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href={getPublicUrl(preview.url)} download={preview.nome} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: 'var(--accent)', padding: '6px 12px', border: '1px solid var(--accent)', borderRadius: 6, textDecoration: 'none' }}>
                  ⬇ Scarica
                </a>
                <button onClick={() => setPreview(null)}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
              </div>
            </div>
            <div style={{ padding: 16, minWidth: 320 }}>
              {isImg(preview.tipo_mime) ? (
                <img src={getPublicUrl(preview.url)} alt={preview.nome}
                  style={{ maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }} />
              ) : isPdf(preview.tipo_mime) ? (
                <iframe src={getPublicUrl(preview.url)} style={{ width: '80vw', height: '70vh', border: 'none', borderRadius: 8 }} title={preview.nome} />
              ) : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 60 }}>📎</div>
                  <p style={{ marginTop: 12, color: 'var(--t2)' }}>{preview.nome}</p>
                  <p style={{ fontSize: 12, color: 'var(--t3)', margin: '8px 0 16px' }}>{preview.tipo_mime} — {fmt(preview.dimensione || 0)}</p>
                  <a href={getPublicUrl(preview.url)} download={preview.nome} target="_blank" rel="noreferrer"
                    style={{ color: 'var(--accent)', padding: '10px 20px', border: '1px solid var(--accent)', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>
                    ⬇ Scarica il file
                  </a>
                </div>
              )}
              {preview.note && (
                <p style={{ marginTop: 12, fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>Note: {preview.note}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL UPLOAD */}
      {form && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setForm(false) }}>
          <div className="modal-box" style={{ maxWidth: 500, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Carica documento</h3>
              <button onClick={() => setForm(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Nome documento *</label>
                <input style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--panel)', color: 'var(--t1)', outline: 'none' }}
                  value={newDoc.nome} onChange={e => setNewDoc({ ...newDoc, nome: e.target.value })}
                  placeholder="Es. Contratto d'appalto, Planimetria piano terra..." />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Categoria</label>
                <select style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--panel)', color: 'var(--t1)', outline: 'none' }}
                  value={newDoc.categoria} onChange={e => setNewDoc({ ...newDoc, categoria: e.target.value })}>
                  {CATEGORIE.map(c => <option key={c.id} value={c.id}>{c.icona} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>File *</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg,.dxf"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!newDoc.nome) setNewDoc(prev => ({ ...prev, nome: f.name.replace(/\.[^.]+$/, '') })) } }}
                  style={{ width: '100%', padding: '8px', fontSize: 12 }} />
                {file && <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{file.name} — {fmt(file.size)}</p>}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Note (opzionale)</label>
                <textarea style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--panel)', color: 'var(--t1)', outline: 'none', resize: 'vertical', minHeight: 60 }}
                  value={newDoc.note} onChange={e => setNewDoc({ ...newDoc, note: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 12 }}>Annulla</button>
                <button onClick={upload} disabled={uploading} className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>
                  {uploading ? 'Caricamento...' : 'Carica'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#14532d', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, zIndex: 1000, boxShadow: 'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
