'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Building2, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@sq360.it')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')

  async function login(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setErrore('Inserisci email e password'); return }
    setLoading(true); setErrore('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrore(
        error.message === 'Invalid login credentials'
          ? 'Email o password non corretti'
          : error.message
      )
      setLoading(false)
      return
    }

    if (data.session) {
      // Successo - naviga al dashboard
      router.push('/dashboard')
      router.refresh()
    }
  }

  const inp = {
    width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 10, padding: '12px 14px', color: '#0f172a',
    fontSize: 14, outline: 'none', boxSizing: 'border-box' as const
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, background: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(59,130,246,0.4)'
          }}>
            <Building2 size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.03em' }}>SQ360</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>Gestionale Edile Professionale</p>
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: 20, padding: '32px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Accedi</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>Inserisci le credenziali del tuo account</p>

          {errore && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 18
            }}>
              <AlertCircle size={15} color="#ef4444" />
              <span style={{ fontSize: 13, color: '#ef4444' }}>{errore}</span>
            </div>
          )}

          <form onSubmit={login}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@sq360.it" style={inp} autoComplete="email" required />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" style={{ ...inp, paddingRight: 44 }}
                  autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8'
                }}>
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: loading ? '#93c5fd' : '#3b82f6', color: 'white',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              {loading
                ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Accesso...</>
                : 'Accedi a SQ360'
              }
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: 11, marginTop: 20 }}>
          SQ360 v3.0 · Dal bando al collaudo
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
