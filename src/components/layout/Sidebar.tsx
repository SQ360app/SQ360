'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase, getCurrentUserModuli } from '@/lib/supabase'
import {
  LayoutDashboard, Search, FolderOpen, Users,
  Calendar, Settings, CreditCard, Building2, LogOut, Map
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',                 icon: LayoutDashboard, label: 'Dashboard',        modulo: null as null | string },
  { href: '/dashboard/mappa',           icon: Map,             label: 'Mappa cantieri',   modulo: null },
  { href: '/dashboard/gare',            icon: Search,          label: 'Analisi Gare',     modulo: 'gare' },
  { href: '/dashboard/commesse',        icon: FolderOpen,      label: 'Commesse',         modulo: '_commesse' },
  { href: '/dashboard/fornitori',       icon: Users,           label: 'Contatti',         modulo: 'contatti' },
  { href: '/dashboard/scadenzario',     icon: Calendar,        label: 'Scadenzario',      modulo: 'scadenzario' },
  { href: '/dashboard/amministrazione', icon: CreditCard,      label: 'Amministrazione',  modulo: 'economico' },
  { href: '/dashboard/impostazioni',    icon: Settings,        label: 'Impostazioni',     modulo: 'impostazioni' },
]

const SUB_COMMESSE = ['computo','sal_attivi','sal_passivi','rda','rdo','sam','oda','contratti','cantiere','sicurezza','varianti','documenti','comunicazioni']

export function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [moduli, setModuli] = useState<Record<string, boolean>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email || '')
    })
    getCurrentUserModuli().then(({ moduli: m }) => setModuli(m))
  }, [])

  function isVisible(modulo: string | null): boolean {
    if (modulo === null) return true
    if (modulo === '_commesse') return SUB_COMMESSE.some(k => moduli[k] !== false)
    return moduli[modulo] !== false
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <nav style={{
      height: 52, width: '100%', flexShrink: 0,
      background: 'var(--sidebar-bg)',
      borderBottom: '1px solid var(--sidebar-border)',
      display: 'flex', alignItems: 'center',
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        padding: '0 16px', height: '100%', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        borderRight: '1px solid var(--sidebar-border)',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: '#3b82f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Building2 size={16} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--sidebar-text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>SQ360</div>
          <div style={{ fontSize: 8, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gestionale Edile</div>
        </div>
      </div>

      {/* Nav links orizzontali */}
      <div style={{
        display: 'flex', alignItems: 'center',
        flex: 1, height: '100%',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {NAV.filter(item => isVisible(item.modulo)).map(({ href, icon: Icon, label }) => {
          const active = path === href || (href !== '/dashboard' && path.startsWith(href))
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none', height: '100%', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 16px', height: '100%',
                borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
                borderTop: '2px solid transparent',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
                boxSizing: 'border-box',
              }}>
                <Icon size={14} />
                {label}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Email + Esci */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px', height: '100%', flexShrink: 0,
        borderLeft: '1px solid var(--sidebar-border)',
      }}>
        {email && (
          <span style={{
            fontSize: 11, color: 'var(--sidebar-muted)',
            maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {email}
          </span>
        )}
        <button onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: '1px solid var(--sidebar-border)',
          borderRadius: 6, padding: '5px 10px',
          fontSize: 11, color: 'var(--sidebar-muted)', cursor: 'pointer',
        }}>
          <LogOut size={11} /> Esci
        </button>
      </div>
    </nav>
  )
}

export default Sidebar
