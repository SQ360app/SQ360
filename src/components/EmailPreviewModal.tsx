'use client'

// ─── Componi email (invito RDO) ──────────────────────────────────────────────
// Il mittente è FISSO e l'HTML lo genera il server (/api/email): qui l'utente
// sceglie solo destinatari, oggetto e un messaggio aggiuntivo in testo semplice.
// L'anteprima usa lo stesso modello del server (emailRdoInvito).

import { useState } from 'react'

export const MITTENTE_FISSO = 'SQ360 <noreply@sq360.app>'

export interface EmailSendParams {
  to: string[]
  cc: string[]
  subject: string
  messaggio: string
}

interface EmailPreviewModalProps {
  defaultTo: string[]
  defaultCc?: string[]
  defaultSubject: string
  /** HTML di anteprima per il messaggio aggiuntivo corrente */
  anteprima: (messaggio: string) => string
  onSend: (params: EmailSendParams) => Promise<void>
  onClose: () => void
}

export function EmailPreviewModal({
  defaultTo,
  defaultCc = [],
  defaultSubject,
  anteprima,
  onSend,
  onClose,
}: EmailPreviewModalProps) {
  const [toStr, setToStr] = useState(defaultTo.filter(Boolean).join(', '))
  const [ccStr, setCcStr] = useState(defaultCc.join(', '))
  const [subject, setSubject] = useState(defaultSubject)
  const [messaggio, setMessaggio] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const to = toStr.split(',').map(s => s.trim()).filter(Boolean)
    const cc = ccStr.split(',').map(s => s.trim()).filter(Boolean)
    if (!to.length || !subject.trim()) return
    setSending(true)
    try {
      await onSend({ to, cc, subject, messaggio })
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#111827' }}>📧 Componi email</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ width: 320, flexShrink: 0, padding: '16px 18px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <div>
              <label style={lbl}>Da</label>
              <div style={{ ...inp, background: '#f3f4f6', color: '#6b7280' }}>{MITTENTE_FISSO}</div>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: '4px 0 0' }}>Le risposte arrivano al tuo indirizzo email.</p>
            </div>
            <div>
              <label style={lbl}>A (virgola tra più email, max 10)</label>
              <input value={toStr} onChange={e => setToStr(e.target.value)} style={inp} placeholder="email@fornitore.it" />
            </div>
            <div>
              <label style={lbl}>CC (opzionale)</label>
              <input value={ccStr} onChange={e => setCcStr(e.target.value)} style={inp} placeholder="copia@ufficio.it" />
            </div>
            <div>
              <label style={lbl}>Oggetto</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} maxLength={200} />
            </div>
            <div>
              <label style={lbl}>Messaggio aggiuntivo (opzionale)</label>
              <textarea value={messaggio} onChange={e => setMessaggio(e.target.value)} maxLength={2000}
                style={{ ...inp, minHeight: 110, resize: 'vertical' }} placeholder="Testo semplice aggiunto all'invito…" />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <iframe srcDoc={anteprima(messaggio)} sandbox=""
              style={{ flex: 1, border: 'none', background: '#fff' }} title="Anteprima email" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            Annulla
          </button>
          <button onClick={handleSend} disabled={sending || !toStr.trim() || !subject.trim()}
            style={{ padding: '8px 22px', background: sending || !toStr.trim() ? '#9ca3af' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}>
            {sending ? '⏳ Invio...' : '📧 Invia email'}
          </button>
        </div>
      </div>
    </div>
  )
}
