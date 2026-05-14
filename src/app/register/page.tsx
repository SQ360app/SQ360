'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Building2, Eye, EyeOff, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Mail } from 'lucide-react'

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface FormAzienda {
  nome: string; piva: string; cf: string; provincia: string
}
interface FormAdmin {
  nome: string; cognome: string; email: string
  password: string; conferma: string
}
// Stato di recovery se signUp riesce ma l'insert DB fallisce
interface PendingLink { userId: string; aziendaId?: string }

type Step = 'azienda' | 'admin' | 'done'

// ─── Validazioni ─────────────────────────────────────────────────────────────

function validaPiva(v: string) {
  return /^\d{11}$/.test(v.replace(/\s/g, ''))
}

function validaAzienda(f: FormAzienda): string {
  if (!f.nome.trim()) return 'Inserisci il nome dell\'azienda'
  if (!f.piva.trim()) return 'Inserisci la Partita IVA'
  if (!validaPiva(f.piva)) return 'Partita IVA non valida (11 cifre)'
  return ''
}

function validaAdmin(f: FormAdmin): string {
  if (!f.nome.trim()) return 'Inserisci il nome'
  if (!f.cognome.trim()) return 'Inserisci il cognome'
  if (!f.email.trim() || !f.email.includes('@')) return 'Email non valida'
  if (f.password.length < 8) return 'Password di almeno 8 caratteri'
  if (f.password !== f.conferma) return 'Le password non coincidono'
  return ''
}

// ─── Stili condivisi ──────────────────────────────────────────────────────────

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0',
  borderRadius: 10, padding: '12px 14px', color: '#0f172a',
  fontSize: 14, outline: 'none', boxSizing: 'border-box', ...extra,
})
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }

// ─── Componente principale ────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()

  const [step, setStep]         = useState<Step>('azienda')
  const [azienda, setAzienda]   = useState<FormAzienda>({ nome: '', piva: '', cf: '', provincia: '' })
  const [admin, setAdmin]       = useState<FormAdmin>({ nome: '', cognome: '', email: '', password: '', conferma: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [errore, setErrore]     = useState('')
  const [pending, setPending]   = useState<PendingLink | null>(null)

  // ─── Step 1 → 2 ────────────────────────────────────────────────────────────

  function avanti() {
    const err = validaAzienda(azienda)
    if (err) { setErrore(err); return }
    setErrore(''); setStep('admin')
  }

  // ─── Registrazione ──────────────────────────────────────────────────────────

  async function registra(e: React.FormEvent) {
    e.preventDefault()
    const err = validaAdmin(admin)
    if (err) { setErrore(err); return }
    setErrore(''); setLoading(true)

    try {
      // 1. Crea utente Auth Supabase
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: admin.email.trim(),
        password: admin.password,
      })
      if (authErr) throw new Error(authErr.message)
      if (!authData.user) throw new Error('Registrazione non riuscita, riprova.')

      const userId = authData.user.id
      await completaRegistrazione(userId)

    } catch (e: unknown) {
      const msg = (e instanceof Error) ? e.message : 'Errore sconosciuto'
      setErrore(
        msg.includes('User already registered') || msg.includes('already been registered')
          ? 'Email già registrata. Usa un\'altra email o accedi.'
          : msg
      )
    } finally {
      setLoading(false)
    }
  }

  // Eseguito anche dal bottone "Riprova" in caso di fallimento parziale
  async function completaRegistrazione(userId: string, esistenteAziendaId?: string) {
    let aziendaId = esistenteAziendaId

    if (!aziendaId) {
      // 2. Crea azienda
      const { data: newAzienda, error: aziendaErr } = await supabase
        .from('aziende')
        .insert({
          nome:      azienda.nome.trim(),
          piva:      azienda.piva.replace(/\s/g, ''),
          cf:        azienda.cf.trim() || null,
          provincia: azienda.provincia.trim() || null,
        })
        .select('id')
        .single()

      if (aziendaErr || !newAzienda) {
        setPending({ userId })
        throw new Error('Errore creazione azienda: ' + (aziendaErr?.message || 'riprovare'))
      }
      aziendaId = newAzienda.id as string
    }

    // 3. Crea record utenti con ruolo admin
    const { error: utenteErr } = await supabase
      .from('utenti')
      .insert({
        id:         userId,
        azienda_id: aziendaId,
        email:      admin.email.trim(),
        nome:       admin.nome.trim(),
        cognome:    admin.cognome.trim(),
        ruolo:      'admin',
      })

    if (utenteErr) {
      setPending({ userId, aziendaId })
      throw new Error('Errore collegamento utente: ' + utenteErr.message)
    }

    // Tutto riuscito
    setPending(null)
    setStep('done')
  }

  async function riprova() {
    if (!pending) return
    setErrore(''); setLoading(true)
    try {
      await completaRegistrazione(pending.userId, pending.aziendaId)
    } catch (e: unknown) {
      setErrore((e instanceof Error) ? e.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, background: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(59,130,246,0.4)'
          }}>
            <Building2 size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.03em' }}>SQ360</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Gestionale Edile Professionale</p>
        </div>

        {/* Indicatore step */}
        {step !== 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {(['azienda', 'admin'] as const).map((s, i) => {
              const active  = step === s
              const done_s  = (step === 'admin' && s === 'azienda')
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done_s ? '#22c55e' : active ? '#3b82f6' : 'rgba(255,255,255,.15)',
                    fontSize: 12, fontWeight: 700, color: (done_s || active) ? '#fff' : '#94a3b8',
                    transition: 'all .2s'
                  }}>
                    {done_s ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, color: active ? '#fff' : '#64748b', fontWeight: active ? 600 : 400 }}>
                    {s === 'azienda' ? 'Azienda' : 'Account'}
                  </span>
                  {i === 0 && <ChevronRight size={14} color="#334155" />}
                </div>
              )
            })}
          </div>
        )}

        {/* Card */}
        <div style={{ background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

          {/* ── STEP: AZIENDA ── */}
          {step === 'azienda' && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>La tua azienda</h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 22px' }}>Crea il tuo account aziendale SQ360</p>

              <ErrorBox msg={errore} />

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Ragione sociale *</label>
                <input style={inp()} placeholder="Es. Edil Rossi Srl" value={azienda.nome}
                  onChange={e => setAzienda({ ...azienda, nome: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && avanti()} />
              </div>

              <div style={grid2}>
                <div>
                  <label style={lbl}>Partita IVA *</label>
                  <input style={inp()} placeholder="12345678901" value={azienda.piva} maxLength={13}
                    onChange={e => setAzienda({ ...azienda, piva: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && avanti()} />
                </div>
                <div>
                  <label style={lbl}>Codice fiscale</label>
                  <input style={inp()} placeholder="Uguale alla P.IVA se Srl" value={azienda.cf}
                    onChange={e => setAzienda({ ...azienda, cf: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && avanti()} />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>Provincia (sigla)</label>
                <input style={inp({ width: 100 })} placeholder="MI" maxLength={2}
                  value={azienda.provincia}
                  onChange={e => setAzienda({ ...azienda, provincia: e.target.value.toUpperCase() })}
                  onKeyDown={e => e.key === 'Enter' && avanti()} />
              </div>

              <button onClick={avanti} style={btnStyle('#3b82f6')}>
                Avanti <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* ── STEP: ADMIN ── */}
          {step === 'admin' && (
            <form onSubmit={registra}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Account amministratore</h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 22px' }}>Sarai il primo utente admin di {azienda.nome}</p>

              <ErrorBox msg={errore} onRetry={pending ? riprova : undefined} retryLoading={loading} />

              <div style={grid2}>
                <div>
                  <label style={lbl}>Nome *</label>
                  <input style={inp()} placeholder="Mario" value={admin.nome} autoComplete="given-name"
                    onChange={e => setAdmin({ ...admin, nome: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Cognome *</label>
                  <input style={inp()} placeholder="Rossi" value={admin.cognome} autoComplete="family-name"
                    onChange={e => setAdmin({ ...admin, cognome: e.target.value })} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Email *</label>
                <input type="email" style={inp()} placeholder="mario@edilrossi.it" value={admin.email}
                  autoComplete="email"
                  onChange={e => setAdmin({ ...admin, email: e.target.value })} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} style={inp({ paddingRight: 44 })}
                    placeholder="Min. 8 caratteri" value={admin.password}
                    autoComplete="new-password"
                    onChange={e => setAdmin({ ...admin, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {admin.password.length > 0 && admin.password.length < 8 && (
                  <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>Ancora {8 - admin.password.length} caratteri</p>
                )}
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>Conferma password *</label>
                <input type={showPass ? 'text' : 'password'} style={inp({
                  borderColor: admin.conferma && admin.conferma !== admin.password ? '#fca5a5' : '#e2e8f0'
                })}
                  placeholder="••••••••" value={admin.conferma}
                  autoComplete="new-password"
                  onChange={e => setAdmin({ ...admin, conferma: e.target.value })} />
                {admin.conferma && admin.conferma !== admin.password && (
                  <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Le password non coincidono</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setStep('azienda'); setErrore('') }}
                  style={{ ...btnStyle('#64748b'), flex: '0 0 auto', padding: '13px 16px' }}>
                  <ChevronLeft size={16} />
                </button>
                <button type="submit" disabled={loading} style={{ ...btnStyle(loading ? '#93c5fd' : '#3b82f6'), flex: 1 }}>
                  {loading
                    ? <><Spinner /> Creazione account…</>
                    : 'Crea account'}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px solid #bbf7d0' }}>
                <Mail size={28} color="#16a34a" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Controlla la tua email</h2>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 6px', lineHeight: 1.6 }}>
                Abbiamo inviato un link di conferma a <strong>{admin.email}</strong>.
              </p>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 24px' }}>
                Dopo la conferma potrai accedere con le tue credenziali.
              </p>
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', marginBottom: 24, textAlign: 'left' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 6px' }}>Account creato</p>
                <p style={{ fontSize: 13, color: '#374151', margin: '0 0 2px' }}><strong>{azienda.nome}</strong></p>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>P.IVA {azienda.piva} · Admin: {admin.nome} {admin.cognome}</p>
              </div>
              <CheckCircle2 size={16} color="#16a34a" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>Account e azienda configurati</span>

              <button onClick={() => router.push('/login')}
                style={{ ...btnStyle('#3b82f6'), marginTop: 20, width: '100%' }}>
                Vai al login
              </button>
            </div>
          )}
        </div>

        {/* Link login / register */}
        {step !== 'done' && (
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 18 }}>
            Hai già un account?{' '}
            <a href="/login" style={{ color: '#60a5fa', fontWeight: 600, textDecoration: 'none' }}>Accedi</a>
          </p>
        )}

        <p style={{ textAlign: 'center', color: '#334155', fontSize: 11, marginTop: 16 }}>
          SQ360 v3.0 · Dal bando al collaudo
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Helper UI ────────────────────────────────────────────────────────────────

function btnStyle(bg: string): React.CSSProperties {
  return {
    width: '100%', padding: '13px', borderRadius: 10, border: 'none',
    background: bg, color: 'white', fontSize: 14, fontWeight: 700,
    cursor: bg === '#93c5fd' ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  }
}

function Spinner() {
  return (
    <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
  )
}

function ErrorBox({ msg, onRetry, retryLoading }: { msg: string; onRetry?: () => void; retryLoading?: boolean }) {
  if (!msg) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 18
    }}>
      <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, color: '#ef4444' }}>{msg}</span>
        {onRetry && (
          <button onClick={onRetry} disabled={retryLoading}
            style={{ display: 'block', marginTop: 6, fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            {retryLoading ? 'Riprovando…' : 'Riprova collegamento'}
          </button>
        )}
      </div>
    </div>
  )
}
