'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Search, FolderOpen, Users,
  Calendar, Settings, CreditCard, Building2
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',             icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/gare',        icon: Search,          label: 'Analisi Gare' },
  { href: '/dashboard/commesse',    icon: FolderOpen,      label: 'Commesse' },
  { href: '/dashboard/fornitori',   icon: Users,           label: 'Fornitori' },
  { href: '/dashboard/scadenzario', icon: Calendar,        label: 'Scadenzario' },
  { href: '/dashboard/amministrazione', icon: CreditCard,  label: 'Amministrazione' },
  { href: '/dashboard/impostazioni',icon: Settings,        label: 'Impostazioni' },
]

export function Sidebar() {
  const path = usePathname()

  return (
    <aside style={{
      width: 220, flexShrink: 0, height: '100vh',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--sidebar-text)', letterSpacing: '-0.02em' }}>SQ360</div>
            <div style={{ fontSize: 9, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gestionale Edile</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href || (href !== '/dashboard' && path.startsWith(href))
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 9, marginBottom: 2,
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
                cursor: 'pointer', transition: 'all 0.15s',
                fontSize: 13, fontWeight: active ? 600 : 400,
                borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
              }}>
                <Icon size={16} />
                {label}
                {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#3b82f6' }} />}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--sidebar-border)', fontSize: 10, color: 'var(--sidebar-muted)', textAlign: 'center' }}>
        SQ360 v3.0 · 2026
      </div>
    </aside>
  )
}

export default Sidebar
