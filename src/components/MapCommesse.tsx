'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { supabase, getAziendaId } from '@/lib/supabase'
import L from 'leaflet'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATO_COL: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6',
  IN_COLLAUDO:   '#8b5cf6', SOSPESA: '#ef4444',
  ULTIMATA:      '#64748b', CHIUSA: '#64748b',
}

interface CommessaRaw {
  id: string; codice: string; nome: string; stato: string
  importo_contratto: number; lat?: number; lng?: number
  indirizzo_cantiere?: string; comune_cantiere?: string
  cap_cantiere?: string; provincia?: string
}

interface CommessaGeo extends CommessaRaw {
  lat: number; lng: number
  indirizzo_display?: string
}

const fmt = (n: number) => (n || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })

async function geocodifica(c: CommessaRaw): Promise<{ lat: number; lng: number } | null> {
  const query = [c.indirizzo_cantiere, c.comune_cantiere, c.cap_cantiere, c.provincia, 'Italy']
    .filter(Boolean).join(', ')
  if (!query.trim() || query === 'Italy') return null

  try {
    const r1 = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SQ360/1.0' } }
    )
    const j1 = await r1.json()
    if (j1[0]) return { lat: parseFloat(j1[0].lat), lng: parseFloat(j1[0].lon) }

    // Fallback: solo comune + provincia
    const fallback = [c.comune_cantiere, c.provincia, 'Italy'].filter(Boolean).join(', ')
    const r2 = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallback)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SQ360/1.0' } }
    )
    const j2 = await r2.json()
    if (j2[0]) return { lat: parseFloat(j2[0].lat), lng: parseFloat(j2[0].lon) }
  } catch { /* ignora errori rete */ }

  return null
}

export default function MapCommesse() {
  const [markers,   setMarkers]   = useState<CommessaGeo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [geocoding, setGeocoding] = useState(false)
  const [pendenti,  setPendenti]  = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const aziendaId = await getAziendaId()
      const { data } = await supabase
        .from('commesse')
        .select('id,codice,nome,stato,importo_contratto,lat,lng,indirizzo_cantiere,comune_cantiere,cap_cantiere,provincia')
        .eq('azienda_id', aziendaId || '')
        .not('stato', 'in', '("CHIUSA","ARCHIVIATA","chiusa","archiviata")')

      if (cancelled) return
      const raw = (data || []) as CommessaRaw[]

      // Commesse con coordinate già presenti
      const conCoord: CommessaGeo[] = raw
        .filter(c => c.lat != null && c.lng != null)
        .map(c => ({
          ...c,
          lat: c.lat!,
          lng: c.lng!,
          indirizzo_display: [c.indirizzo_cantiere, c.comune_cantiere].filter(Boolean).join(', ') || undefined,
        }))

      setMarkers(conCoord)
      setLoading(false)

      // Commesse senza coordinate ma con indirizzo
      const daGeocode = raw.filter(c =>
        (c.lat == null || c.lng == null) &&
        (c.indirizzo_cantiere || c.comune_cantiere || c.provincia)
      )

      if (daGeocode.length === 0) return

      setGeocoding(true)
      setPendenti(daGeocode.length)

      for (const c of daGeocode) {
        if (cancelled) break
        const coords = await geocodifica(c)
        setPendenti(p => Math.max(0, p - 1))
        if (!coords) continue

        // Aggiunge marker immediatamente
        const geo: CommessaGeo = {
          ...c, lat: coords.lat, lng: coords.lng,
          indirizzo_display: [c.indirizzo_cantiere, c.comune_cantiere].filter(Boolean).join(', ') || undefined,
        }
        if (!cancelled) setMarkers(prev => [...prev, geo])

        // Salva coordinate nel DB (fire-and-forget)
        supabase.from('commesse').update({ lat: coords.lat, lng: coords.lng }).eq('id', c.id)

        // Rispetta rate limit Nominatim (1 req/s)
        await new Promise(r => setTimeout(r, 1100))
      }

      if (!cancelled) setGeocoding(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const headerRight = loading ? (
    <span style={{ fontSize: 11, color: 'var(--t3)' }}>Caricamento...</span>
  ) : geocoding ? (
    <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>
      📍 Geolocalizzazione in corso... ({pendenti} rimanenti)
    </span>
  ) : (
    <span style={{ fontSize: 11, color: 'var(--t3)' }}>{markers.length} cantieri</span>
  )

  if (loading) return null

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '11px 15px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>🗺️ Cantieri attivi</span>
        {headerRight}
      </div>

      {markers.length === 0 && !geocoding ? (
        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--t3)', fontSize: 12 }}>
          <span style={{ fontSize: 20 }}>📍</span>
          <span>Aggiungi le coordinate o l&apos;indirizzo del cantiere in <strong>Anagrafica</strong> per vedere la commessa sulla mappa</span>
        </div>
      ) : (
        <MapContainer
          center={[42, 12]}
          zoom={6}
          style={{ height: '320px', width: '100%' }}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {markers.map(c => (
            <Marker key={c.id} position={[c.lat, c.lng]}>
              <Popup>
                <div style={{ minWidth: 190, fontFamily: 'system-ui, sans-serif' }}>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#6b7280', marginBottom: 2 }}>{c.codice}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4, lineHeight: 1.3 }}>{c.nome}</div>
                  {c.indirizzo_display && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>📍 {c.indirizzo_display}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 3, fontWeight: 600, background: (STATO_COL[c.stato] || '#6b7280') + '20', color: STATO_COL[c.stato] || '#6b7280' }}>
                      {c.stato?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>€ {fmt(c.importo_contratto)}</div>
                  <a href={`/dashboard/commesse/${c.id}/anagrafica`}
                    style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>
                    → Apri commessa
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  )
}
