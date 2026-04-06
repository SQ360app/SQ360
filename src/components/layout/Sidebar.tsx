'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { group: 'PRINCIPALE', items: [
    { href: '/dashboard', label: 'Dashboard', icon: '◈' },
    { href: '/dashboard/commesse', label: 'Commesse', icon: '⬡' },
    { href: '/dashboard/scadenzario', label: 'Scadenzario', icon: '◷', badge: 3 },
  ]},
  { group: 'GARE & PRODUZIONE', items: [
    { href: '/dashboard/gare', label: 'Gare & Appalti', icon: '◎' },
    { href: '/dashboard/contratti', label: 'Contratti Sub', icon: '◻' },
    { href: '/dashboard/dam', label: 'DAM', icon: '◫' },
  ]},
  { group: 'CONTABILITÀ', items: [
    { href: '/dashboard/sal', label: 'SAL', icon: '▸' },
  ]},
  { group: 'ANAGRAFICHE', items: [
    { href: '/dashboard/fornitori', label: 'Fornitori & Sub', icon: '◉' },
  ]},
  { group: 'CANTIERE', items: [
    { href: '/dashboard/cantiere', label: 'Cantiere', icon: '⬟' },
  ]},
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-box">
          <div className="logo-sq">SQ</div>
          <div>
            <div className="logo-name">SQ360</div>
            <div className="logo-sub">GESTIONALE EDILE</div>
          </div>
        </div>
      </div>
      <nav className="nav">
        {NAV.map(g => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map(item => {
              const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`}>
                  <span style={{fontSize:14}}>{item.icon}</span>
                  <span style={{flex:1}}>{item.label}</span>
                  {'badge' in item && item.badge && (
                    <span style={{background:'#B91C1C',color:'white',fontSize:9,fontWeight:800,padding:'1px 5px',borderRadius:999}}>{item.badge}</span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="nav-bottom">
        <Link href="/dashboard" className="nav-item">
          <span style={{fontSize:14}}>⚙</span> Impostazioni
        </Link>
      </div>
    </aside>
  )
}
