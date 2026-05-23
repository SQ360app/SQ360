'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'

interface EmailLog {
  id: string
  tipo_doc: string
  doc_id: string
  doc_codice: string
  direzione: string
  mittente: string
  destinatari: string[]
  cc: string[]
  oggetto: string
  html: string
  allegati: any[]
  stato: string
  inviata_at: string
  created_at: string
}

const TIPO_COLOR: Record<string, string> = {
  rdo: '#3b82f6', oda: '#f59e0b', dam: '#8b5cf6', sal: '#10b981', durc: '#dc2626', altro: '#6b7280',
}

const FILTRI = ['tutti', 'rdo', 'oda', 'dam', 'sal']

export default function ComunicazioniPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('tutti')
  const [preview, setPreview] = useState<EmailLog | null>(null)

  useEffect(() => {
    ;(supabase as any)
      .from('email_log')
      .select('*')
      .eq('commessa_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        setLogs(data || [])
        setLoading(false)
      })
  }, [id])

  const filtrati = filtro === 'tutti' ? logs : logs.filter(l => l.tipo_doc?.toLowerCase() === filtro)

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100%', background: 'var(--bg)' }}>

      {/* KPI / filtri */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {FILTRI.map(t => {
          const count = t === 'tutti' ? logs.length : logs.filter(l => l.tipo_doc?.toLowerCase() === t).length
          const color = TIPO_COLOR[t] || '#6b7280'
          const isActive = filtro === t
          return (
            <div key={t} onClick={() => setFiltro(t)}
              style={{ background: isActive ? color + '15' : 'var(--panel)', border: `1px solid ${isActive ? color : 'var(--border)'}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? color : 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                {t === 'tutti' ? 'Tutte' : t.toUpperCase()}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: isActive ? color : 'var(--t1)' }}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* Tabella */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', flex: 1 }}>
        {loading ? (
          <p style={{ padding: 32, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Caricamento...</p>
        ) : filtrati.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>📭</p>
            <p style={{ color: 'var(--t3)', fontSize: 13, margin: 0 }}>
              Nessuna email registrata{filtro !== 'tutti' ? ` per ${filtro.toUpperCase()}` : ''}.
            </p>
            <p style={{ color: 'var(--t3)', fontSize: 11, margin: '6px 0 0' }}>
              Le email inviate da RDO, ODA, SAM e SAL appariranno qui.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Data', 'Tipo', 'Documento', 'Oggetto', 'Destinatario', 'Stato', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: '.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrati.map(log => {
                  const color = TIPO_COLOR[log.tipo_doc?.toLowerCase()] || '#6b7280'
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                        {log.inviata_at
                          ? new Date(log.inviata_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.tipo_doc && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: color + '20', color, fontWeight: 700 }}>
                            {log.tipo_doc.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--t2)' }}>
                        {log.doc_codice || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t1)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.oggetto || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(log.destinatari || []).join(', ') || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                          background: log.stato === 'inviata' ? '#dcfce7' : '#fef3c7',
                          color: log.stato === 'inviata' ? '#16a34a' : '#92400e',
                        }}>
                          {log.stato || 'inviata'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.html && (
                          <button onClick={() => setPreview(log)}
                            style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--t2)' }}>
                            👁 Visualizza
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal anteprima */}
      {preview && (
        <div onClick={e => { if (e.target === e.currentTarget) setPreview(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 720, height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 18px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{preview.oggetto}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  Da: {preview.mittente || '—'} · A: {(preview.destinatari || []).join(', ') || '—'}
                </div>
                {preview.inviata_at && (
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                    {new Date(preview.inviata_at).toLocaleString('it-IT')}
                  </div>
                )}
              </div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
            <iframe srcDoc={preview.html} sandbox="allow-same-origin"
              style={{ flex: 1, border: 'none' }} title="Anteprima email" />
          </div>
        </div>
      )}
    </div>
  )
}
