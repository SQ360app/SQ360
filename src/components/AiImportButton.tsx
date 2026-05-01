'use client'
import { useState, useRef } from 'react'

interface AiImportButtonProps {
  endpoint: string
  onResult: (dati: Record<string, unknown>) => void
  label?: string
  accept?: string
}

export function AiImportButton({
  endpoint,
  onResult,
  label = 'Importa da PDF/Word',
  accept = '.pdf,.doc,.docx',
}: AiImportButtonProps) {
  const [stato, setStato] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStato('loading')
    setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(endpoint, { method: 'POST', body: fd })
      const json = await res.json() as { ok: boolean; dati?: Record<string, unknown>; errore?: string }
      if (!json.ok || !json.dati) throw new Error(json.errore || 'Errore')
      onResult(json.dati)
      setStato('ok')
      setMsg('Precompilato da ' + file.name)
    } catch (err) {
      setStato('error')
      setMsg(String(err))
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const borderColor = stato === 'ok' ? '#059669' : stato === 'error' ? '#dc2626' : '#2563eb'
  const bg = stato === 'ok' ? '#f0fdf4' : stato === 'error' ? '#fef2f2' : '#eff6ff'
  const color = stato === 'ok' ? '#059669' : stato === 'error' ? '#dc2626' : '#2563eb'

  return (
    <div style={{ marginBottom: 16 }}>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
      <button
        type="button"
        onClick={() => { setStato('idle'); setMsg(''); inputRef.current?.click() }}
        disabled={stato === 'loading'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 18px', border: '2px dashed', borderColor, borderRadius: 10,
          background: bg, color, cursor: stato === 'loading' ? 'wait' : 'pointer',
          fontSize: 13, fontWeight: 600, width: '100%',
        }}
      >
        {stato === 'loading' ? '⏳ Analisi AI in corso...'
          : stato === 'ok' ? '✅ ' + msg
          : stato === 'error' ? '⚠ Errore — riprova'
          : '🤖 ' + label}
      </button>
      {stato === 'error' && msg && <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0' }}>{msg}</p>}
      {stato === 'idle' && <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0', textAlign: 'center' }}>PDF o Word — l&apos;AI estrae e precompila i campi automaticamente</p>}
    </div>
  )
                                     }
