'use client'

// ─── /auth/conferma — scelta password da link email ──────────────────────────
// Destinazione dei link Supabase di:
//   - invito utente      (#access_token=…&type=invite)
//   - recupero password  (#access_token=…&type=recovery)
// Link scaduto/già usato: #error=access_denied&error_code=otp_expired&…
//
// Il client Supabase (detectSessionInUrl) legge da solo il token dall'hash e poi
// lo cancella dall'indirizzo: per questo l'hash viene catturato SUBITO, al
// caricamento del modulo, prima che il client lo rimuova.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Building2, Eye, EyeOff, AlertCircle, CheckCircle2, Mail } from 'lucide-react'

const HASH_INIZIALE = typeof window !== 'undefined' ? window.location.hash : ''
const QUERY_INIZIALE = typeof window !== 'undefined' ? window.location.search : ''
const MIN_PASSWORD = 10

type Stato = 'verifica' | 'form' | 'salvataggio' | 'scaduto' | 'errore'
type Tipo = 'invite' | 'recovery' | 'altro'

function leggiParametri() {
  const h = new URLSearchParams(HASH_INIZIALE.replace(/^#/, ''))
  const q = new URLSearchParams(QUERY_INIZIALE)
  const get = (k: string) => h.get(k) ?? q.get(k)
  return {
    tipo: (get('type') as Tipo) || 'altro',
    errore: get('error'),
    codiceErrore: get('error_code'),
    descrizioneErrore: get('error_description'),
    code: q.get('code'), // flusso PKCE (?code=…), se attivato in futuro
  }
}

export default function ConfermaPage() {
  const router = useRouter()
  const [stato, setStato] = useState<Stato>('verifica')
  const [tipo, setTipo] = useState<Tipo>('altro')
  const [messaggio, setMessaggio] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [errore, setErrore] = useState('')
  const [nuovoLink, setNuovoLink] = useState<'idle' | 'invio' | 'inviato'>('idle')

  useEffect(() => {
    let annullato = false
    ;(async () => {
      const p = leggiParametri()
      setTipo(p.tipo)

      if (p.errore || p.codiceErrore) {
        if (annullato) return
        setStato(p.codiceErrore === 'otp_expired' ? 'scaduto' : 'errore')
        setMessaggio(p.codiceErrore === 'otp_expired'
          ? 'Il link è scaduto o è già stato usato.'
          : (p.descrizioneErrore?.replace(/\+/g, ' ') || 'Link non valido.'))
        return
      }

      if (p.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(p.code)
        if (error && !annullato) { setStato('scaduto'); setMessaggio('Il link è scaduto o è già stato usato.'); return }
      }

      // getSession attende che il client abbia letto il token dall'hash
      const { data: { session } } = await supabase.auth.getSession()
      if (annullato) return
      if (!session) {
        setStato('scaduto')
        setMessaggio('Link non valido o già usato.')
        return
      }
      setEmail(session.user.email || '')
      setStato('form')
    })()
    return () => { annullato = true }
  }, [])

  async function salva(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) { setErrore(`La password deve avere almeno ${MIN_PASSWORD} caratteri`); return }
    if (password !== conferma) { setErrore('Le due password non coincidono'); return }
    setErrore(''); setStato('salvataggio')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setStato('form')
      setErrore(error.message.includes('different from the old')
        ? 'La nuova password deve essere diversa da quella attuale'
        : `Password non salvata: ${error.message}`)
      return
    }
    router.replace('/dashboard')
  }

  async function richiediNuovoLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) { setErrore('Inserisci la tua email'); return }
    setErrore(''); setNuovoLink('invio')
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/conferma`,
    })
    // Messaggio volutamente generico: non rivela se l'email è registrata
    setNuovoLink('inviato')
  }

  const inp: React.CSSProperties = {
    width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '12px 14px', color: '#0f172a', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }
  const btn = (attivo: boolean): React.CSSProperties => ({
    width: '100%', padding: 13, borderRadius: 10, border: 'none', color: 'white', fontSize: 15, fontWeight: 700,
    background: attivo ? '#3b82f6' : '#93c5fd', cursor: attivo ? 'pointer' : 'not-allowed',
  })
  const titolo = tipo === 'invite' ? 'Benvenuto in SQ360' : tipo === 'recovery' ? 'Reimposta la password' : 'Scegli la password'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(59,130,246,0.4)' }}>
            <Building2 size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.03em' }}>SQ360</h1>
        </div>

        <div style={{ background: 'white', borderRadius: 20, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          {stato === 'verifica' && (
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', margin: 0 }}>Verifica del link in corso…</p>
          )}

          {(stato === 'form' || stato === 'salvataggio') && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{titolo}</h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
                Scegli la password per <strong>{email}</strong> (almeno {MIN_PASSWORD} caratteri).
              </p>
              {errore && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                  <AlertCircle size={15} color="#ef4444" /><span style={{ fontSize: 13, color: '#ef4444' }}>{errore}</span>
                </div>
              )}
              <form onSubmit={salva}>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Nuova password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      style={{ ...inp, paddingRight: 44 }} autoComplete="new-password" required minLength={MIN_PASSWORD} />
                    <button type="button" onClick={() => setShowPass(!showPass)} aria-label="Mostra password"
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8' }}>
                      {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={lbl}>Conferma password</label>
                  <input type={showPass ? 'text' : 'password'} value={conferma} onChange={e => setConferma(e.target.value)}
                    style={inp} autoComplete="new-password" required minLength={MIN_PASSWORD} />
                </div>
                <button type="submit" disabled={stato === 'salvataggio'} style={btn(stato !== 'salvataggio')}>
                  {stato === 'salvataggio' ? 'Salvataggio…' : 'Salva password ed entra'}
                </button>
              </form>
            </>
          )}

          {(stato === 'scaduto' || stato === 'errore') && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Link non più valido</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <AlertCircle size={15} color="#c2410c" /><span style={{ fontSize: 13, color: '#9a3412' }}>{messaggio}</span>
              </div>
              {nuovoLink === 'inviato' ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
                  <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: '#166534' }}>
                    Se l&apos;indirizzo è registrato, riceverai a breve una email con un nuovo link. Controlla anche la cartella spam.
                  </span>
                </div>
              ) : (
                <form onSubmit={richiediNuovoLink}>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
                    Inserisci la tua email per ricevere un nuovo link. Se eri stato invitato e il problema persiste, chiedi all&apos;amministratore di reinviare l&apos;invito.
                  </p>
                  {errore && <p style={{ fontSize: 13, color: '#ef4444', margin: '0 0 10px' }}>{errore}</p>}
                  <label style={lbl}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inp, marginBottom: 16 }} autoComplete="email" required />
                  <button type="submit" disabled={nuovoLink === 'invio'} style={{ ...btn(nuovoLink !== 'invio'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Mail size={16} /> {nuovoLink === 'invio' ? 'Invio…' : 'Invia un nuovo link'}
                  </button>
                </form>
              )}
              <p style={{ textAlign: 'center', fontSize: 13, marginTop: 18, marginBottom: 0 }}>
                <a href="/login" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>← Torna al login</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
