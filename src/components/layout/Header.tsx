'use client'

import { usePathname } from 'next/navigation'
import { Bell, Search, ChevronRight } from 'lucide-react'

interface HeaderProps {
  title: string
  breadcrumb?: string[]
}

export function Header({ title, breadcrumb = [] }: HeaderProps) {
  return (
    <header style={{
      height: 56,
      borderBottom: '1px solid var(--border)',
      background: 'var(--panel)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      backdropFilter: 'blur(8px)',
    }}>
      {/* Breadcrumb + Title */}
      <div>
        {breadcrumb.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            {breadcrumb.map((b, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>{b}</span>
                {i < breadcrumb.length - 1 && <ChevronRight size={10} color="var(--t3)" />}
              </span>
            ))}
          </div>
        )}
        <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>{title}</h1>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--t3)', fontSize: 12
        }}>
          <Search size={14} />
          <span>Cerca...</span>
          <kbd style={{ fontSize: 10, background: 'var(--border)', borderRadius: 4, padding: '1px 5px', color: 'var(--t3)' }}>⌘K</kbd>
        </button>
        <button style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '7px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--t3)', position: 'relative'
        }}>
          <Bell size={15} />
          <div style={{
            position: 'absolute', top: 5, right: 5,
            width: 6, height: 6, borderRadius: '50%',
            background: '#ef4444', border: '1px solid var(--panel)'
          }} />
        </button>
      </div>
    </header>
  )
}
