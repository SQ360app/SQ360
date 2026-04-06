'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Trophy, FileText, Users, Package,
  ScrollText, BarChart2, HardHat, Calendar,
  Calculator, GanttChartSquare, TrendingUp,
  Wallet, Settings, FileBarChart, Building2, LogOut
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { label: '── GARA & CONTRATTO', section: true },
  { href: '/dashboard/gare', label: 'M1 · Analisi Gare', icon: Trophy },
  { href: '/dashboard/preventivazione', label: 'M2 · Preventivazione', icon: Calculator },
  { href: '/dashboard/pianificazione', label: 'M3 · Pianificazione', icon: GanttChartSquare },
  { label: '── GESTIONE CANTIERE', section: true },
  { href: '/dashboard/commesse', label: 'Commesse', icon: FileText },
  { href: '/dashboard/cantiere', label: 'M4 · Cantiere', icon: HardHat },
  { href: '/dashboard/dam', label: 'DAM Materiali', icon: Package },
  { label: '── SAL & MARGINI', section: true },
  { href: '/dashboard/sal', label: 'M5 · SAL Att/Pass', icon: BarChart2 },
  { href: '/dashboard/marginalita', label: 'M5C · Marginalità', icon: TrendingUp },
  { label: '── FORNITORI & DOCUMENTI', section: true },
  { href: '/dashboard/fornitori', label: 'Fornitori', icon: Users },
  { href: '/dashboard/contratti', label: 'Contratti Sub', icon: ScrollText },
  { href: '/dashboard/scadenzario', label: 'Scadenzario', icon: Calendar },
  { label: '── AMMINISTRAZIONE', section: true },
  { href: '/dashboard/amministrazione', label: 'M6 · Fatturazione', icon: Wallet },
  { href: '/dashboard/report', label: 'Report & Export', icon: FileBarChart },
  { label: '── IMPOSTAZIONI', section: true },
  { href: '/dashboard/impostazioni', label: 'Impostazioni', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{
      width: 230, flexShrink: 0,
      background: '#0f172a',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      overflowY: 'auto'
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>SQ360</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Gestionale Edile</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 10px', flex: 1 }}>
        {NAV.map((item, i) => {
          if ('section' in item) {
            return <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '12px 10px 4px', fontWeight: 700 }}>{item.label?.replace('── ','')}</div>
          }
          const Icon = item.icon!
          const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href!)
          return (
            <Link key={item.href} href={item.href!} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 8, marginBottom: 1,
                background: active ? 'rgba(59,130,246,0.18)' : 'transparent',
                color: active ? '#93c5fd' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
                fontSize: 12, fontWeight: active ? 600 : 400,
              }}>
                <Icon size={14} style={{ flexShrink: 0 }} />
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8, padding: '8px 12px', color: 'rgba(239,68,68,0.8)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer'
        }}>
          <LogOut size={13} /> Esci
        </button>
      </div>
    </aside>
  )
}
