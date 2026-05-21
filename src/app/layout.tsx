import type { Metadata, Viewport } from 'next'
import './globals.css'
import PWAInstallBanner from '@/components/PWAInstallBanner'

export const metadata: Metadata = {
  title: 'SQ360 — Gestionale Edile',
  description: 'Dal bando al collaudo',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SQ360',
  },
  icons: {
    icon: '/api/pwa-icon?size=192',
    apple: '/api/pwa-icon?size=192',
  },
}

export const viewport: Viewport = {
  themeColor: '#1e40af',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
        <PWAInstallBanner />
      </body>
    </html>
  )
}
