'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'sq360-pwa-dismissed'

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Non mostrare se già in standalone (già installata) o già dismessa
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      localStorage.getItem(DISMISS_KEY)
    ) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || !prompt) return null

  const install = async () => {
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
        localStorage.setItem(DISMISS_KEY, '1')
      }
    } catch {
      // prompt già usato o non disponibile
    }
  }

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1e3a5f',
      color: '#fff',
      borderRadius: 14,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      zIndex: 9999,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      maxWidth: 400,
      width: 'calc(100vw - 32px)',
      border: '1px solid rgba(147,197,253,.2)',
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>📱</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
          Installa SQ360
        </div>
        <div style={{ fontSize: 11, color: '#93c5fd', lineHeight: 1.4 }}>
          Usa come app nativa su PC e smartphone
        </div>
      </div>
      <button
        onClick={install}
        style={{
          flexShrink: 0,
          background: '#2563eb',
          border: 'none',
          color: '#fff',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Installa
      </button>
      <button
        onClick={dismiss}
        title="Non ora"
        style={{
          flexShrink: 0,
          background: 'none',
          border: '1px solid rgba(147,197,253,.3)',
          color: '#93c5fd',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 12,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
