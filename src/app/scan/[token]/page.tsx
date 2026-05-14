'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Lavoratore {
  id: string; nome: string; cognome: string
  tipo_rapporto: string; azienda_appartenenza?: string; mansione?: string
  durc_scadenza?: string; formazione_scadenza?: string
  patente_crediti_punti?: number; commessa_id: string
}

interface Commessa { id: string; codice: string; nome: string; committente?: string }
interface Presenza { id: string; data: string; ora_entrata?: string; ora_uscita?: string }

function docStatus(date?: string | null): 'ok' | 'warning' | 'expired' | 'missing' {
  if (!date) return 'missing'
  const d = new Date(date); d.setHours(0,0,0,0)
  const oggi = new Date(); oggi.setHours(0,0,0,0)
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
const oggi = new Date().toISOString().split('T')[0]
const ora = () => new Date().toTimeString().slice(0, 5)

export default function ScanPage({ params: p }: { params: Promise<{ token: string }> }) {
  const { token } = use(p)
  const [lav, setLav] = useState<Lavoratore | null>(null)
  const [commessa, setCommessa] = useState<Commessa | null>(null)
  const [presenzaOggi, setPresenzaOggi] = useState<Presenza | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<'entrata' | 'uscita' | null>(null)

  useEffect(() => {
    async function load() {
      const { data: lavData } = await supabase
        .from('lavoratori_commessa')
        .select('*')
        .eq('qr_token', token)
        .eq('attivo', true)
        .single()

      if (!lavData) { setNotFound(true); setLoading(false); return }
      setLav(lavData as Lavoratore)

      const [{ data: com }, { data: pres }] = await Promise.all([
        supabase.from('commesse').select('id,codice,nome,committente').eq('id', lavData.commessa_id).single(),
        supabase.from('presenze_cantiere').select('*').eq('lavoratore_id', lavData.id).eq('data', oggi).order('created_at', { ascending: false }).limit(1),
      ])
      setCommessa(com as Commessa)
      setPresenzaOggi(pres?.[0] as Presenza || null)
      setLoading(false)
    }
    load()
  }, [token])

  const registraEntrata = async () => {
    if (!lav) return
    setSaving(true)
    await supabase.from('presenze_cantiere').insert({
      lavoratore_id: lav.id,
      commessa_id: lav.commessa_id,
      data: oggi,
      ora_entrata: ora(),
      tipo: 'qr_scan',
    })
    setSaving(false)
    setDone('entrata')
    setPresenzaOggi({ id: '', data: oggi, ora_entrata: ora() })
  }

  const registraUscita = async () => {
    if (!lav || !presenzaOggi) return
    setSaving(true)
    const uscita = ora()
    if (presenzaOggi.id) {
      await supabase.from('presenze_cantiere')
        .update({ ora_uscita: uscita, tipo: 'qr_scan' })
        .eq('id', presenzaOggi.id)
    } else {
      await supabase.from('presenze_cantiere').insert({
        lavoratore_id: lav.id,
        commessa_id: lav.commessa_id,
        data: oggi,
        ora_uscita: uscita,
        tipo: 'qr_scan',
      })
    }
    setSaving(false)
    setDone('uscita')
    setPresenzaOggi(p => p ? { ...p, ora_uscita: uscita } : null)
  }

  // ─── Stato documenti ─────────────────────────────────────────────────────

  const durc = lav ? docStatus(lav.durc_scadenza) : 'missing'
  const form = lav ? docStatus(lav.formazione_scadenza) : 'missing'
  const pat  = lav ? patenteStatus(lav.patente_crediti_punti) : 'missing'
  const hasAlert = durc === 'expired' || form === 'expired' || pat === 'alert'
  const hasWarn  = !hasAlert && (durc === 'warning' || form === 'warning' || pat === 'warning')

  const overallBg  = hasAlert ? '#dc2626' : hasWarn ? '#d97706' : '#16a34a'
  const overallMsg = hasAlert ? '🚫 ACCESSO NON CONSENTITO' : hasWarn ? '⚠ AMMESSO CON AVVISO' : '✓ ACCESSO CONSENTITO'

  const docRow = (label: string, status: string, value?: string) => {
    const colors: Record<string, string> = { ok: '#16a34a', warning: '#d97706', expired: '#dc2626', missing: '#94a3b8', alert: '#dc2626' }
    const icons: Record<string, string>  = { ok: '✓', warning: '!', expired: '✕', missing: '—', alert: '✕' }
    return (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
        <span style={{ fontSize: 14, color: '#374151' }}>{label}</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: colors[status] }}>{icons[status]}</span>
          {value && <span style={{ display: 'block', fontSize: 11, color: '#9ca3af' }}>{value}</span>}
        </div>
      </div>
    )
  }

  // ─── Loading / Not found ──────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', padding: 24, textAlign: 'center' }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>⚠</p>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Badge non trovato</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Il QR code non corrisponde a nessun lavoratore attivo.</p>
    </div>
  )

  if (!lav) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', maxWidth: 480, margin: '0 auto', padding: '0 0 40px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header stato */}
      <div style={{ background: overallBg, padding: '24px 20px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.8)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SQ360 · Verifica cantiere</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{overallMsg}</p>
      </div>

      {/* Card lavoratore */}
      <div style={{ margin: '16px 16px 0', background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
        <div style={{ marginBottom: 4 }}>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: '0 0 2px' }}>
            {lav.cognome} {lav.nome}
          </p>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            {lav.mansione || lav.tipo_rapporto} {lav.azienda_appartenenza ? `· ${lav.azienda_appartenenza}` : ''}
          </p>
        </div>
        {commessa && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 700 }}>Commessa</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>{commessa.codice} — {commessa.nome}</p>
          </div>
        )}
      </div>

      {/* Stato documenti */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Documenti</p>
        {docRow('DURC', durc, lav.durc_scadenza ? `Scad. ${fmtData(lav.durc_scadenza)}` : undefined)}
        {docRow('Formazione sicurezza', form, lav.formazione_scadenza ? `Scad. ${fmtData(lav.formazione_scadenza)}` : undefined)}
        {docRow('Patente a crediti', pat, lav.patente_crediti_punti != null ? `${lav.patente_crediti_punti} punti` : undefined)}
      </div>

      {/* Presenze oggi */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
          Oggi — {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
        {presenzaOggi ? (
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>Entrata</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', margin: 0 }}>{presenzaOggi.ora_entrata || '—'}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>Uscita</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: presenzaOggi.ora_uscita ? '#2563eb' : '#d1d5db', margin: 0 }}>
                {presenzaOggi.ora_uscita || '—'}
              </p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: '#9ca3af', fontStyle: 'italic' }}>Nessuna presenza registrata oggi</p>
        )}
      </div>

      {/* Feedback dopo registrazione */}
      {done && (
        <div style={{ margin: '12px 16px 0', background: done === 'entrata' ? '#f0fdf4' : '#eff6ff', borderRadius: 16, padding: '16px 20px', border: `1px solid ${done === 'entrata' ? '#bbf7d0' : '#bfdbfe'}`, textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: done === 'entrata' ? '#15803d' : '#1d4ed8', margin: 0 }}>
            {done === 'entrata' ? '✓ Entrata registrata' : '✓ Uscita registrata'}
          </p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{ora()}</p>
        </div>
      )}

      {/* Bottoni azione */}
      {!hasAlert && (
        <div style={{ margin: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!presenzaOggi?.ora_entrata && !done && (
            <button disabled={saving} onClick={registraEntrata}
              style={{ padding: '18px', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 800, background: '#16a34a', color: '#fff', boxShadow: '0 4px 16px rgba(22,163,74,.3)', opacity: saving ? 0.6 : 1 }}>
              {saving ? '...' : '✓ Registra ENTRATA'}
            </button>
          )}
          {presenzaOggi?.ora_entrata && !presenzaOggi?.ora_uscita && done !== 'uscita' && (
            <button disabled={saving} onClick={registraUscita}
              style={{ padding: '18px', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 800, background: '#2563eb', color: '#fff', boxShadow: '0 4px 16px rgba(37,99,235,.3)', opacity: saving ? 0.6 : 1 }}>
              {saving ? '...' : '→ Registra USCITA'}
            </button>
          )}
          {(presenzaOggi?.ora_uscita || done === 'uscita') && (
            <div style={{ padding: '14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Presenza completa per oggi</p>
            </div>
          )}
        </div>
      )}

      {hasAlert && (
        <div style={{ margin: '16px 16px 0', padding: '16px 20px', borderRadius: 14, background: '#fef2f2', border: '2px solid #fecaca', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', margin: 0 }}>
            Irregolarità documentale — contattare il responsabile di cantiere prima di accedere
          </p>
        </div>
      )}

      <p style={{ textAlign: 'center', fontSize: 11, color: '#d1d5db', marginTop: 32 }}>SQ360 · Sistema gestione cantiere interno</p>
    </div>
  )
}
