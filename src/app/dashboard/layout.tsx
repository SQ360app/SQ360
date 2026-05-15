'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

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
    <div className="layout" style={{ flexDirection: 'column', height: '100vh' }}>
      <Sidebar />
      <main className="main" style={{ flex: 1, overflowY: 'auto', height: 0 }}>
        {children}
      </main>
    </div>
  )
}
