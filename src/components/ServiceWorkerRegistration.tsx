'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        // Silent success — DevTools Application → Service Workers shows it as "activated"
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing
          if (worker) {
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                // New SW installed — page will use it on next navigation
              }
            })
          }
        })
      })
      .catch(() => {
        // SW registration failed (e.g. HTTP in dev) — not critical
      })
  }, [])

  return null
}
