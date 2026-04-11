'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/Sidebar'
import { LogOut } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState<{ email?: string } | null>(null)

  useEffect(() => {
    // Controlla sessione al caricamento
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setUser(session.user)
        setChecking(false)
      }
    })

    // Ascolta cambiamenti di sessione
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login')
      } else {
        setUser(session.user)
        setChecking(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 16
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid rgba(59,130,246,0.3)',
          borderTopColor: '#3b82f6', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Caricamento SQ360...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {/* Barra utente in alto */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          background: 'var(--panel)', borderBottom: '1px solid var(--border)',
          padding: '0 20px', height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12
        }}>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{user?.email}</span>
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 7, padding: '4px 10px',
            fontSize: 11, color: 'var(--t3)', cursor: 'pointer'
          }}>
            <LogOut size={12} /> Esci
          </button>
        </div>
        {children}
      </main>
    </div>
  )
}
