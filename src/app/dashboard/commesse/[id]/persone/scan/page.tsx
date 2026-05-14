'use client'

import React, { useState, useEffect, useRef, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import jsQR from 'jsqr'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface Lavoratore {
  id: string; nome: string; cognome: string
  tipo_rapporto: string; azienda_appartenenza?: string; mansione?: string
  durc_scadenza?: string; formazione_scadenza?: string
  patente_crediti_punti?: number; commessa_id: string
}

interface Presenza {
  id: string; data: string; ora_entrata?: string; ora_uscita?: string
}

interface OfflineJob {
  id: string
  lavoratore_id: string; commessa_id: string; data: string
  ora_entrata?: string; ora_uscita?: string; tipo: string
  presenza_id?: string; action: 'entrata' | 'uscita'
  ts: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function docStatus(date?: string | null): 'ok' | 'warning' | 'expired' | 'missing' {
  if (!date) return 'missing'
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const tra30 = new Date(oggi); tra30.setDate(oggi.getDate() + 30)
  if (d < oggi) return 'expired'
  if (d <= tra30) return 'warning'
  return 'ok'
}

function patenteStatus(punti?: number | null): 'ok' | 'warning' | 'alert' | 'missing' {
  if (punti === null || punti === undefined) return 'missing'
  if (punti < 15) return 'alert'
  if (punti < 25) return 'warning'
  return 'ok'
}

const fmtData = (s?: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—'
const ora = () => new Date().toTimeString().slice(0, 5)
const oggi = () => new Date().toISOString().split('T')[0]

const QUEUE_KEY = 'sq360_offline_queue'

function loadQueue(): OfflineJob[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}
function saveQueue(q: OfflineJob[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

// ─── Stato semaforo ───────────────────────────────────────────────────────────

function StatusBadge({ lav }: { lav: Lavoratore }) {
  const durc = docStatus(lav.durc_scadenza)
  const form = docStatus(lav.formazione_scadenza)
  const pat  = patenteStatus(lav.patente_crediti_punti)
  const hasAlert = durc === 'expired' || form === 'expired' || pat === 'alert'
  const hasWarn  = !hasAlert && (durc === 'warning' || form === 'warning' || pat === 'warning')
  const bg  = hasAlert ? '#dc2626' : hasWarn ? '#d97706' : '#16a34a'
  const msg = hasAlert ? '🚫 STOP — documenti irregolari' : hasWarn ? '⚠ Avviso documenti' : '✓ Documenti OK'

  const DOC_COLORS: Record<string, string> = { ok: '#16a34a', warning: '#d97706', expired: '#dc2626', missing: '#94a3b8', alert: '#dc2626' }
  const DOC_ICONS:  Record<string, string> = { ok: '✓', warning: '!', expired: '✕', missing: '—', alert: '✕' }

  return (
    <div>
      <div style={{ background: bg, padding: '10px 16px', borderRadius: 12, textAlign: 'center', marginBottom: 12 }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{msg}</span>
      </div>
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '8px 14px' }}>
        {[
          { label: 'DURC', st: durc, val: lav.durc_scadenza ? `scad. ${fmtData(lav.durc_scadenza)}` : 'non inserito' },
          { label: 'Formazione', st: form, val: lav.formazione_scadenza ? `scad. ${fmtData(lav.formazione_scadenza)}` : 'non inserita' },
          { label: 'Patente', st: pat, val: lav.patente_crediti_punti != null ? `${lav.patente_crediti_punti} pt` : 'non inserita' },
        ].map(({ label, st, val }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{val}</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: DOC_COLORS[st], minWidth: 16, textAlign: 'center' }}>{DOC_ICONS[st]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────

type Mode = 'scanning' | 'loading' | 'result' | 'done' | 'no-camera' | 'not-found'

export default function ScanPage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id: commessaId } = use(p)
  const router = useRouter()

  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef    = useRef<number>(0)
  const lastToken = useRef<string>('')

  const [mode, setMode]           = useState<Mode>('scanning')
  const [lav, setLav]             = useState<Lavoratore | null>(null)
  const [presenzaOggi, setPresenza] = useState<Presenza | null>(null)
  const [done, setDone]           = useState<'entrata' | 'uscita' | null>(null)
  const [saving, setSaving]       = useState(false)
  const [queueLen, setQueueLen]   = useState(0)
  const [online, setOnline]       = useState(true)
  const [torchOn, setTorchOn]     = useState(false)
  const [scannedToken, setScannedToken] = useState('')

  // ─── Sync offline queue ─────────────────────────────────────────────────

  const syncQueue = useCallback(async () => {
    const q = loadQueue()
    if (q.length === 0) return
    const remaining: OfflineJob[] = []
    for (const job of q) {
      try {
        if (job.action === 'entrata') {
          await supabase.from('presenze_cantiere').insert({
            lavoratore_id: job.lavoratore_id, commessa_id: job.commessa_id,
            data: job.data, ora_entrata: job.ora_entrata, tipo: 'qr_scan_offline',
          })
        } else {
          if (job.presenza_id) {
            await supabase.from('presenze_cantiere').update({ ora_uscita: job.ora_uscita }).eq('id', job.presenza_id)
          } else {
            await supabase.from('presenze_cantiere').insert({
              lavoratore_id: job.lavoratore_id, commessa_id: job.commessa_id,
              data: job.data, ora_uscita: job.ora_uscita, tipo: 'qr_scan_offline',
            })
          }
        }
      } catch {
        remaining.push(job)
      }
    }
    saveQueue(remaining)
    setQueueLen(remaining.length)
  }, [])

  useEffect(() => {
    setQueueLen(loadQueue().length)
    const handleOnline = () => { setOnline(true); syncQueue() }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setOnline(navigator.onLine)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [syncQueue])

  // ─── Camera ─────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setMode('no-camera')
    }
  }, [])

  const scanFrame = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) { rafRef.current = requestAnimationFrame(scanFrame); return }

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' })

    if (code?.data) {
      const url = code.data
      const match = url.match(/\/scan\/([a-f0-9-]{36})/)
      if (match && match[1] !== lastToken.current) {
        lastToken.current = match[1]
        setScannedToken(match[1])
        setMode('loading')
        return
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame)
  }, [])

  useEffect(() => {
    if (mode === 'scanning') {
      lastToken.current = ''
      startCamera().then(() => { rafRef.current = requestAnimationFrame(scanFrame) })
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [mode, startCamera, scanFrame])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ─── Fetch lavoratore dopo scan ──────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'loading' || !scannedToken) return
    async function fetch() {
      const { data: lavData } = await supabase
        .from('lavoratori_commessa')
        .select('*')
        .eq('qr_token', scannedToken)
        .eq('attivo', true)
        .single()

      if (!lavData) { setMode('not-found'); return }
      setLav(lavData as Lavoratore)

      const { data: pres } = await supabase
        .from('presenze_cantiere')
        .select('*')
        .eq('lavoratore_id', lavData.id)
        .eq('data', oggi())
        .order('created_at', { ascending: false })
        .limit(1)
      setPresenza(pres?.[0] as Presenza || null)
      setDone(null)
      setMode('result')
    }
    fetch()
  }, [mode, scannedToken])

  // ─── Azioni presenza ─────────────────────────────────────────────────────

  const registraEntrata = async () => {
    if (!lav) return
    setSaving(true)
    const oraStr = ora()
    if (navigator.onLine) {
      await supabase.from('presenze_cantiere').insert({
        lavoratore_id: lav.id, commessa_id: lav.commessa_id,
        data: oggi(), ora_entrata: oraStr, tipo: 'qr_scan',
      })
    } else {
      const q = loadQueue()
      q.push({ id: crypto.randomUUID(), lavoratore_id: lav.id, commessa_id: lav.commessa_id, data: oggi(), ora_entrata: oraStr, tipo: 'qr_scan', action: 'entrata', ts: Date.now() })
      saveQueue(q); setQueueLen(q.length)
    }
    setPresenza({ id: '', data: oggi(), ora_entrata: oraStr })
    setSaving(false); setDone('entrata')
  }

  const registraUscita = async () => {
    if (!lav) return
    setSaving(true)
    const oraStr = ora()
    if (navigator.onLine) {
      if (presenzaOggi?.id) {
        await supabase.from('presenze_cantiere').update({ ora_uscita: oraStr }).eq('id', presenzaOggi.id)
      } else {
        await supabase.from('presenze_cantiere').insert({
          lavoratore_id: lav.id, commessa_id: lav.commessa_id,
          data: oggi(), ora_uscita: oraStr, tipo: 'qr_scan',
        })
      }
    } else {
      const q = loadQueue()
      q.push({ id: crypto.randomUUID(), lavoratore_id: lav.id, commessa_id: lav.commessa_id, data: oggi(), ora_uscita: oraStr, tipo: 'qr_scan', action: 'uscita', presenza_id: presenzaOggi?.id, ts: Date.now() })
      saveQueue(q); setQueueLen(q.length)
    }
    setPresenza(prev => prev ? { ...prev, ora_uscita: oraStr } : { id: '', data: oggi(), ora_uscita: oraStr })
    setSaving(false); setDone('uscita')
  }

  // ─── Torch ───────────────────────────────────────────────────────────────

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn(t => !t)
    } catch { /* torch non supportato */ }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100%', background: '#0f172a', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Barra superiore */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,.5)', zIndex: 10 }}>
        <button onClick={() => router.back()}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          ← Indietro
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>📱 Scansione QR</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!online && <span style={{ fontSize: 10, background: '#d97706', color: '#fff', padding: '3px 7px', borderRadius: 6, fontWeight: 700 }}>OFFLINE</span>}
          {queueLen > 0 && <span style={{ fontSize: 10, background: '#7c3aed', color: '#fff', padding: '3px 7px', borderRadius: 6, fontWeight: 700 }}>{queueLen} in coda</span>}
          {mode === 'scanning' && (
            <button onClick={toggleTorch}
              style={{ background: torchOn ? '#fbbf24' : 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, padding: '6px 10px', color: torchOn ? '#000' : '#fff', fontSize: 14, cursor: 'pointer' }}>
              🔦
            </button>
          )}
        </div>
      </div>

      {/* ── Modalità: SCANNING ── */}
      {mode === 'scanning' && (
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} muted playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Mirino */}
          <div style={{ position: 'relative', zIndex: 2, width: 240, height: 240 }}>
            <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(255,255,255,.2)', borderRadius: 16 }} />
            {[
              { top: 0, left: 0, borderTop: '4px solid #2563eb', borderLeft: '4px solid #2563eb', borderRadius: '16px 0 0 0' },
              { top: 0, right: 0, borderTop: '4px solid #2563eb', borderRight: '4px solid #2563eb', borderRadius: '0 16px 0 0' },
              { bottom: 0, left: 0, borderBottom: '4px solid #2563eb', borderLeft: '4px solid #2563eb', borderRadius: '0 0 0 16px' },
              { bottom: 0, right: 0, borderBottom: '4px solid #2563eb', borderRight: '4px solid #2563eb', borderRadius: '0 0 16px 0' },
            ].map((style, i) => (
              <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...style }} />
            ))}
          </div>
          <p style={{ position: 'relative', zIndex: 2, color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 16, textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,.8)' }}>
            Inquadra il QR badge del lavoratore
          </p>
        </div>
      )}

      {/* ── Modalità: LOADING ── */}
      {mode === 'loading' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Verifica lavoratore…</p>
          <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
        </div>
      )}

      {/* ── Modalità: NOT FOUND ── */}
      {mode === 'not-found' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 48 }}>⚠</p>
          <p style={{ color: '#f87171', fontWeight: 700, fontSize: 16 }}>Badge non riconosciuto</p>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Il QR non corrisponde a nessun lavoratore attivo in questa commessa.</p>
          <button onClick={() => setMode('scanning')}
            style={{ marginTop: 12, padding: '12px 28px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Riprova
          </button>
        </div>
      )}

      {/* ── Modalità: NO CAMERA ── */}
      {mode === 'no-camera' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 48 }}>📷</p>
          <p style={{ color: '#f87171', fontWeight: 700, fontSize: 16 }}>Fotocamera non disponibile</p>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Abilita l'accesso alla fotocamera nelle impostazioni del browser.</p>
        </div>
      )}

      {/* ── Modalità: RESULT ── */}
      {mode === 'result' && lav && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 20px' }}>

          {/* Intestazione lavoratore */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e293b' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>
              {lav.cognome} {lav.nome}
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              {lav.mansione || lav.tipo_rapporto}{lav.azienda_appartenenza ? ` · ${lav.azienda_appartenenza}` : ''}
            </p>
          </div>

          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Stato documenti */}
            <StatusBadge lav={lav} />

            {/* Presenze oggi */}
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                Oggi — {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px' }}>Entrata</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: presenzaOggi?.ora_entrata ? '#4ade80' : '#334155', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {presenzaOggi?.ora_entrata || '—'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px' }}>Uscita</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: presenzaOggi?.ora_uscita ? '#60a5fa' : '#334155', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {presenzaOggi?.ora_uscita || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Feedback azione */}
            {done && (
              <div style={{ background: done === 'entrata' ? '#14532d' : '#1e3a5f', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                <p style={{ color: done === 'entrata' ? '#4ade80' : '#60a5fa', fontWeight: 800, fontSize: 16, margin: 0 }}>
                  {done === 'entrata' ? '✓ Entrata registrata' : '✓ Uscita registrata'}
                </p>
                {!online && <p style={{ color: '#fbbf24', fontSize: 11, margin: '4px 0 0' }}>Salvato offline — sincronizzazione automatica</p>}
              </div>
            )}

            {/* Bottoni ENTRATA / USCITA */}
            {(() => {
              const durc = docStatus(lav.durc_scadenza)
              const form = docStatus(lav.formazione_scadenza)
              const pat  = patenteStatus(lav.patente_crediti_punti)
              const blocked = durc === 'expired' || form === 'expired' || pat === 'alert'
              if (blocked) return null
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!presenzaOggi?.ora_entrata && !done && (
                    <button disabled={saving} onClick={registraEntrata}
                      style={{ padding: '20px', borderRadius: 16, border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: 18, fontWeight: 800, background: '#16a34a', color: '#fff', boxShadow: '0 4px 20px rgba(22,163,74,.4)', opacity: saving ? 0.6 : 1, letterSpacing: '.02em' }}>
                      {saving ? '…' : '✓  ENTRATA'}
                    </button>
                  )}
                  {presenzaOggi?.ora_entrata && !presenzaOggi?.ora_uscita && done !== 'uscita' && (
                    <button disabled={saving} onClick={registraUscita}
                      style={{ padding: '20px', borderRadius: 16, border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: 18, fontWeight: 800, background: '#2563eb', color: '#fff', boxShadow: '0 4px 20px rgba(37,99,235,.4)', opacity: saving ? 0.6 : 1, letterSpacing: '.02em' }}>
                      {saving ? '…' : '→  USCITA'}
                    </button>
                  )}
                  {(presenzaOggi?.ora_uscita || done === 'uscita') && (
                    <div style={{ padding: '14px', borderRadius: 12, background: '#1e293b', textAlign: 'center' }}>
                      <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Presenza completa per oggi</p>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Scansione successiva */}
            <button onClick={() => { setLav(null); setPresenza(null); setDone(null); setScannedToken(''); setMode('scanning') }}
              style={{ padding: '14px', borderRadius: 12, border: '1px solid #1e293b', background: 'transparent', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              ← Scansiona altro lavoratore
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
