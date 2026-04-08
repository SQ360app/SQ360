'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Trophy, Users,
  CalendarClock, Receipt, Settings, ChevronRight,
  Building2
} from 'lucide-react'

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/dashboard/gare', icon: Trophy, label: 'M1 · Analisi Gare' },
  { href: '/dashboard/commesse', icon: FolderOpen, label: 'Commesse' },
  { href: '/dashboard/fornitori', icon: Users, label: 'Fornitori' },
  { href: '/dashboard/scadenzario', icon: CalendarClock, label: 'Scadenzario' },
  { href: '/dashboard/amministrazione', icon: Receipt, label: 'Amministrazione' },
  { href: '/dashboard/impostazioni', icon: Settings, label: 'Impostazioni' },
]

export function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    // commesse/[id]/... → evidenzia sempre commesse
    return pathname.startsWith(href)
  }

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100vh', position: 'sticky', top: 0,
      background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Building2 size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--sidebar-text)', letterSpacing: '-0.02em' }}>SQ360</div>
          <div style={{ fontSize: 9, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gestionale Edile</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = isActive(item.href, item.exact)
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8, marginBottom: 2,
              textDecoration: 'none',
              background: active ? 'var(--sidebar-active-bg)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--sidebar-muted)',
              fontWeight: active ? 600 : 400, fontSize: 13,
              transition: 'all 0.12s',
              borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
            }}>
              <item.icon size={15} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--sidebar-border)',
        fontSize: 10, color: 'var(--sidebar-muted)',
        textAlign: 'center'
      }}>
        SQ360 v3.0 · 2026
      </div>
    </aside>
  )
}
