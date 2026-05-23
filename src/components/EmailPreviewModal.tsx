'use client'

import { useState, useRef } from 'react'

export interface EmailSendParams {
  from: string
  to: string[]
  cc: string[]
  subject: string
  html: string
}

interface EmailPreviewModalProps {
  defaultFrom?: string
  defaultTo: string[]
  defaultCc?: string[]
  defaultSubject: string
  html: string
  onSend: (params: EmailSendParams) => Promise<void>
  onClose: () => void
}

export function EmailPreviewModal({
  defaultFrom = 'SQ360 <noreply@sq360.app>',
  defaultTo,
  defaultCc = [],
  defaultSubject,
  html,
  onSend,
  onClose,
}: EmailPreviewModalProps) {
  const [from, setFrom] = useState(defaultFrom)
  const [toStr, setToStr] = useState(defaultTo.join(', '))
  const [ccStr, setCcStr] = useState(defaultCc.join(', '))
  const [subject, setSubject] = useState(defaultSubject)
  const [editHtml, setEditHtml] = useState(html)
  const [showSource, setShowSource] = useState(false)
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const totalSize = files.reduce((s, f) => s + f.size, 0)
  const overLimit = totalSize > 10 * 1024 * 1024

  const handleSend = async () => {
    const to = toStr.split(',').map(s => s.trim()).filter(Boolean)
    const cc = ccStr.split(',').map(s => s.trim()).filter(Boolean)
    if (!to.length || !subject.trim()) return
    setSending(true)
    try {
      await onSend({ from, to, cc, subject, html: editHtml })
    } finally {
      setSending(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 12, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '.04em', display: 'block', marginBottom: 4,
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '96%', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#111827' }}>📧 Componi email</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left — campi */}
          <div style={{ width: 320, flexShrink: 0, padding: '16px 18px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <div>
              <label style={lbl}>Da</label>
              <input value={from} onChange={e => setFrom(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>A (virgola tra più email)</label>
              <input value={toStr} onChange={e => setToStr(e.target.value)} style={inp} placeholder="email@fornitore.it" />
            </div>
            <div>
              <label style={lbl}>CC (opzionale)</label>
              <input value={ccStr} onChange={e => setCcStr(e.target.value)} style={inp} placeholder="copia@ufficio.it" />
            </div>
            <div>
              <label style={lbl}>Oggetto</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} />
            </div>

            {/* Allegati */}
            <div>
              <label style={lbl}>Allegati</label>
              <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
                onChange={e => {
                  setFiles(prev => [...prev, ...Array.from(e.target.files || [])])
                  if (fileRef.current) fileRef.current.value = ''
                }} />
              <button onClick={() => fileRef.current?.click()}
                style={{ padding: '6px 12px', border: '1px dashed #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>
                + Aggiungi file
              </button>
              {files.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 6px', background: '#f3f4f6', borderRadius: 4 }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ color: '#9ca3af', flexShrink: 0 }}>{Math.round(f.size / 1024)} KB</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, flexShrink: 0, lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                  ))}
                  {overLimit && (
                    <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>⚠ Totale supera 10 MB — rimuovi allegati</p>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <button onClick={() => setShowSource(s => !s)}
                style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                {showSource ? '👁 Anteprima' : '⌨ Modifica HTML'}
              </button>
            </div>
          </div>

          {/* Right — preview / editor */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {showSource ? (
              <textarea value={editHtml} onChange={e => setEditHtml(e.target.value)}
                style={{ flex: 1, padding: 14, fontFamily: 'monospace', fontSize: 11, border: 'none', outline: 'none', resize: 'none', color: '#374151', background: '#fafafa' }} />
            ) : (
              <iframe srcDoc={editHtml} sandbox="allow-same-origin"
                style={{ flex: 1, border: 'none', background: '#fff' }} title="Anteprima email" />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            Annulla
          </button>
          <button onClick={handleSend} disabled={sending || overLimit || !toStr.trim() || !subject.trim()}
            style={{ padding: '8px 22px', background: sending || overLimit || !toStr.trim() ? '#9ca3af' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: sending || overLimit ? 'not-allowed' : 'pointer' }}>
            {sending ? '⏳ Invio...' : '📧 Invia email'}
          </button>
        </div>
      </div>
    </div>
  )
}
