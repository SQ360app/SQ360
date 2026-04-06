import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SQ360 — Gestionale Edile',
  description: 'Dal bando al collaudo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
