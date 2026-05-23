'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const AZIENDA_ID = 'f5ddf460-715a-495e-997a-0246ea73326b'

interface CommessaKPI {
  id: string
  codice: string
  nome: string
  stato: string
  importo_contratto: number
  avanzamento_pct: number
  residuo: number
  giorni_rimanenti: number
  in_ritardo: boolean
  lat: number
  lng: number
}

function pinColor(c: CommessaKPI): string {
  if (c.in_ritardo) return '#ef4444'
  const p = c.avanzamento_pct
  if (p === 0)    return '#3b82f6'
  if (p <= 33)    return '#f59e0b'
  if (p <= 66)    return '#f97316'
  if (p < 100)    return '#22c55e'
  return '#6b7280'
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })
}

const LEGENDA = [
  { color: '#3b82f6', label: '0% — Non iniziata' },
  { color: '#f59e0b', label: '1–33% — Avvio' },
  { color: '#f97316', label: '34–66% — In corso' },
  { color: '#22c55e', label: '67–99% — Avanzata' },
  { color: '#6b7280', label: '100% — Completata' },
  { color: '#ef4444', label: 'In ritardo' },
]

export default function MappaCantieri() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const markersRef   = useRef<mapboxgl.Marker[]>([])
  const router       = useRouter()
  const [loading, setLoading]   = useState(true)
  const [count, setCount]       = useState(0)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || token.startsWith('pk.inserisci')) {
      setError('Token Mapbox non configurato. Aggiungi NEXT_PUBLIC_MAPBOX_TOKEN in .env.local')
      setLoading(false)
      return
    }

    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [12.5674, 41.8719],
      zoom: 5.5,
    })
    mapRef.current = map

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    map.on('load', async () => {
      const { data, error: dbErr } = await (supabase as any)
        .from('v_commesse_kpi')
        .select('id,codice,nome,stato,importo_contratto,avanzamento_pct,residuo,giorni_rimanenti,in_ritardo,lat,lng')
        .eq('azienda_id', AZIENDA_ID)

      if (dbErr) {
        setError('Errore caricamento dati: ' + dbErr.message)
        setLoading(false)
        return
      }

      const commesse: CommessaKPI[] = (data || []).filter(
        (c: any) => c.lat != null && c.lng != null && !isNaN(Number(c.lat)) && !isNaN(Number(c.lng))
      )

      setCount(commesse.length)
      setLoading(false)

      commesse.forEach(c => {
        const color = pinColor(c)

        // SVG pin
        const el = document.createElement('div')
        el.style.cssText = 'cursor:pointer;width:32px;height:32px'
        el.innerHTML = `
          <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z"
                  fill="${color}" stroke="white" stroke-width="2"/>
            <circle cx="16" cy="16" r="6" fill="white" opacity="0.9"/>
          </svg>`

        const gmUrl = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`

        const popup = new mapboxgl.Popup({ offset: 30, maxWidth: '300px' })
          .setHTML(`
            <div style="font-family:'Segoe UI',sans-serif;font-size:12px;min-width:240px">
              <div style="background:${color};padding:8px 12px;margin:-10px -10px 10px;border-radius:4px 4px 0 0">
                <div style="color:#fff;font-weight:700;font-size:13px">${c.nome}</div>
                <div style="color:rgba(255,255,255,.8);font-size:10px;margin-top:2px">${c.codice} · ${c.stato?.replace(/_/g, ' ')}</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 2px 8px">
                <div>
                  <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Contratto</div>
                  <div style="font-weight:700;color:#111">€ ${fmt(c.importo_contratto)}</div>
                </div>
                <div>
                  <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Avanzamento</div>
                  <div style="font-weight:700;color:${color}">${c.avanzamento_pct}%</div>
                </div>
                <div>
                  <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Residuo</div>
                  <div style="font-weight:600;color:#374151">€ ${fmt(c.residuo)}</div>
                </div>
                <div>
                  <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Giorni rimasti</div>
                  <div style="font-weight:600;color:${c.giorni_rimanenti === 0 ? '#ef4444' : '#374151'}">${c.giorni_rimanenti === 0 ? '⚠ Scaduta' : c.giorni_rimanenti + ' gg'}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;padding-top:6px;border-top:1px solid #f3f4f6">
                <button onclick="window.__sq360_open('${c.id}')"
                  style="flex:1;padding:6px 10px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">
                  Apri commessa
                </button>
                <a href="${gmUrl}" target="_blank" rel="noreferrer"
                  style="flex:1;display:flex;align-items:center;justify-content:center;padding:6px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;color:#374151;text-decoration:none;font-size:11px;font-weight:500">
                  📍 Google Maps
                </a>
              </div>
            </div>`)

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([Number(c.lng), Number(c.lat)])
          .setPopup(popup)
          .addTo(map)

        markersRef.current.push(marker)
      })

      // Fit bounds se ci sono cantieri
      if (commesse.length > 0) {
        const bounds = new mapboxgl.LngLatBounds()
        commesse.forEach(c => bounds.extend([Number(c.lng), Number(c.lat)]))
        map.fitBounds(bounds, { padding: 80, maxZoom: 13 })
      }
    })

    // Esponi callback globale per il bottone nel popup
    ;(window as any).__sq360_open = (id: string) => {
      router.push(`/dashboard/commesse/${id}/anagrafica`)
    }

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      map.remove()
      delete (window as any).__sq360_open
    }
  }, [router])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>

      {/* Mappa */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Header overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 10,
        background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)',
        borderRadius: 10, padding: '8px 14px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>🗺️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Cantieri attivi</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.65)' }}>
            {loading ? 'Caricamento…' : `${count} cantieri con coordinate`}
          </div>
        </div>
      </div>

      {/* Errore */}
      {error && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 20, background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,.2)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{error}</div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#6b7280', fontFamily: 'monospace', background: '#f9fafb', padding: '6px 10px', borderRadius: 6 }}>
            NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
          </div>
        </div>
      )}

      {/* Legenda */}
      {!error && (
        <div style={{
          position: 'absolute', bottom: 36, left: 12, zIndex: 10,
          background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '10px 14px',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 7 }}>
            Avanzamento SAL
          </div>
          {LEGENDA.map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0, border: '1.5px solid rgba(255,255,255,.3)' }} />
              <span style={{ fontSize: 11, color: '#fff' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
