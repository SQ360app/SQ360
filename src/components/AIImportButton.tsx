'use client'
import { useState, useRef, useCallback } from 'react'

export interface AIImportConfig {
  endpoint?: string
  label?: string
  onDati: (dati: Record<string, unknown>) => void
  style?: React.CSSProperties
}

type Stato = 'idle' | 'loading' | 'preview' | 'errore'

export function AIImportButton({
  endpoint = '/api/ai-import-contratto',
  label = 'Importa da PDF / Word',
  onDati,
  style,
}: AIImportConfig) {
  const [stato, setStato] = useState<Stato>('idle')
  const [errore, setErrore] = useState('')
  const [datiPreview, setDatiPreview] = useState<Record<string, unknown> | null>(null)
  const [nomeFile, setNomeFile] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processa = useCallback(async (file: File) => {
    setStato('loading'); setErrore(''); setNomeFile(file.name)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(endpoint, { method: 'POST', body: fd })
      const json = await res.json() as { ok?: boolean; dati?: Record<string, unknown>; errore?: string; content?: string }
      let dati: Record<string, unknown> | null = null
      if (json.ok && json.dati) {
        dati = json.dati
      } else if (json.content) {
        try { dati = JSON.parse(json.content) } catch { /**/ }
        if (dati && dati.commessa) dati = dati.commessa as Record<string, unknown>
      }
      if (!dati) throw new Error(json.errore || 'Nessun dato estratto')
      setDatiPreview(dati); setStato('preview')
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : String(e)); setStato('errore')
    }
  }, [endpoint])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processa(f); e.target.value = ''
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processa(f)
  }
  const applica = () => { if (datiPreview) { onDati(datiPreview); setStato('idle'); setDatiPreview(null) } }
  const reset = () => { setStato('idle'); setDatiPreview(null); setErrore('') }

  const campiEstratti = datiPreview
    ? Object.entries(datiPreview).filter(([, v]) => v !== null && v !== '' && v !== 0).length : 0
  const totCampi = datiPreview ? Object.keys(datiPreview).length : 0
  const baseBtn: React.CSSProperties = { cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ marginBottom: 16, ...style }}>
      {stato === 'idle' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{ border: dragging ? '2px dashed #2563eb' : '2px dashed #d1d5db', borderRadius: 10,
            padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            background: dragging ? '#eff6ff' : '#f9fafb', transition: 'all .15s' }}>
          <div style={{ fontSize: 28 }}>📎</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              Trascina qui PDF, Word o testo — Claude precompila automaticamente
            </div>
          </div>
          <div style={{ padding: '6px 14px', background: '#2563eb', color: '#fff',
            borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            Scegli file
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={onFileChange} style={{ display: 'none' }} />
        </div>
      )}
      {stato === 'loading' && (
        <div style={{ border: '2px solid #dbeafe', borderRadius: 10, padding: '14px 20px',
          background: '#eff6ff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>⏳</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>Analisi in corso…</div>
            <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Claude sta leggendo: {nomeFile}</div>
          </div>
        </div>
      )}
      {stato === 'preview' && datiPreview && (
        <div style={{ border: '2px solid #bbf7d0', borderRadius: 10, overflow: 'hidden', background: '#f0fdf4' }}>
          <div style={{ padding: '10px 16px', background: '#dcfce7', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#14532d' }}>
                Estratti {campiEstratti}/{totCampi} campi da: {nomeFile}
              </div>
              <div style={{ fontSize: 11, color: '#15803d' }}>Verifica e clicca Applica per precompilare</div>
            </div>
            <button onClick={reset} style={{ ...baseBtn, background: 'none', border: 'none', color: '#6b7280', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '6px 16px', maxHeight: 180, overflowY: 'auto' }}>
            {Object.entries(datiPreview).map(([k, v]) => {
              if (v === null || v === '' || v === 0) return null
              return (
                <div key={k} style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                  <span style={{ color: '#6b7280', minWidth: 80, flexShrink: 0 }}>{k}:</span>
                  <span style={{ fontWeight: 600, color: '#15803d', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #bbf7d0',
            display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={reset} style={{ ...baseBtn, padding: '7px 16px', border: '1px solid #d1d5db',
              borderRadius: 8, background: '#fff', fontSize: 12 }}>Annulla</button>
            <button onClick={applica} style={{ ...baseBtn, padding: '7px 20px', background: '#16a34a',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              ✓ Applica al modulo
            </button>
          </div>
        </div>
      )}
      {stato === 'errore' && (
        <div style={{ border: '2px solid #fca5a5', borderRadius: 10, padding: '12px 16px',
          background: '#fef2f2', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>Errore estrazione</div>
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errore}</div>
          </div>
          <button onClick={reset} style={{ ...baseBtn, padding: '5px 12px',
            border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', fontSize: 12, color: '#dc2626' }}>
            Riprova
          </button>
        </div>
      )}
    </div>
  )
}
