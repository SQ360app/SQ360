'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommessaKPI {
  id: string; codice: string; nome: string; stato: string
  importo_contratto: number; avanzamento_pct: number
  residuo: number; giorni_rimanenti: number; in_ritardo: boolean
  lat: number | null; lng: number | null
  indirizzo_cantiere: string | null; comune_cantiere: string | null; provincia: string | null
}

interface Filtri {
  stato: 'tutti' | 'attive' | 'ritardo' | 'completate'
  avanzamento: 'tutti' | '0' | '1-50' | '51-99' | '100'
  provincia: string
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function pinColor(c: Pick<CommessaKPI, 'in_ritardo' | 'avanzamento_pct'>): string {
  if (c.in_ritardo) return '#ef4444'
  const p = c.avanzamento_pct
  if (p === 0)  return '#3b82f6'
  if (p <= 33)  return '#f59e0b'
  if (p <= 66)  return '#f97316'
  if (p < 100)  return '#22c55e'
  return '#6b7280'
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })
}

// NON modificata — logica geocoding esistente
async function geocode(c: CommessaKPI): Promise<{ lat: number; lng: number } | null> {
  const q = [c.indirizzo_cantiere, c.comune_cantiere, c.provincia, 'Italia']
    .filter(Boolean).join(', ')
  if (!q.trim()) return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'it' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { /* non bloccante */ }
  return null
}

function applyFilters(data: CommessaKPI[], f: Filtri): CommessaKPI[] {
  return data.filter(c => {
    if (f.stato === 'attive'     && (c.in_ritardo || c.avanzamento_pct >= 100)) return false
    if (f.stato === 'ritardo'    && !c.in_ritardo) return false
    if (f.stato === 'completate' && c.avanzamento_pct < 100) return false
    if (f.avanzamento === '0'     && c.avanzamento_pct !== 0) return false
    if (f.avanzamento === '1-50'  && (c.avanzamento_pct < 1  || c.avanzamento_pct > 50))  return false
    if (f.avanzamento === '51-99' && (c.avanzamento_pct < 51 || c.avanzamento_pct > 99))  return false
    if (f.avanzamento === '100'   && c.avanzamento_pct < 100) return false
    if (f.provincia && c.provincia !== f.provincia) return false
    return true
  })
}

function toGeoJSON(data: CommessaKPI[]) {
  return {
    type: 'FeatureCollection' as const,
    features: data
      .filter(c => c.lat != null && c.lng != null && !isNaN(Number(c.lat)))
      .map(c => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [Number(c.lng), Number(c.lat)] },
        properties: {
          id: c.id, nome: c.nome, codice: c.codice, stato: c.stato,
          avanzamento_pct: c.avanzamento_pct,
          in_ritardo: c.in_ritardo ? 1 : 0,   // numero per clusterProperties aggregation
          importo_contratto: c.importo_contratto,
          residuo: c.residuo, giorni_rimanenti: c.giorni_rimanenti,
          color: pinColor(c), provincia: c.provincia || '',
        },
      })),
  }
}

// NON modificato — stesso HTML del popup esistente
function buildPopupHTML(p: Record<string, any>, lat: number, lng: number): string {
  const color = p.color || '#6b7280'
  const gmUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const gg = Number(p.giorni_rimanenti)
  return `
    <div style="font-family:'Segoe UI',sans-serif;font-size:12px;min-width:240px">
      <div style="background:${color};padding:8px 12px;margin:-10px -10px 10px;border-radius:4px 4px 0 0">
        <div style="color:#fff;font-weight:700;font-size:13px">${p.nome}</div>
        <div style="color:rgba(255,255,255,.8);font-size:10px;margin-top:2px">${p.codice} · ${String(p.stato || '').replace(/_/g, ' ')}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 2px 8px">
        <div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Contratto</div>
          <div style="font-weight:700;color:#111">€ ${fmt(Number(p.importo_contratto))}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Avanzamento</div>
          <div style="font-weight:700;color:${color}">${p.avanzamento_pct}%</div>
        </div>
        <div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Residuo</div>
          <div style="font-weight:600;color:#374151">€ ${fmt(Number(p.residuo))}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Giorni rimasti</div>
          <div style="font-weight:600;color:${gg === 0 ? '#ef4444' : '#374151'}">${gg === 0 ? '⚠ Scaduta' : gg + ' gg'}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;padding-top:6px;border-top:1px solid #f3f4f6">
        <button onclick="window.__sq360_open('${p.id}')"
          style="flex:1;padding:6px 10px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">
          Apri commessa
        </button>
        <a href="${gmUrl}" target="_blank" rel="noreferrer"
          style="flex:1;display:flex;align-items:center;justify-content:center;padding:6px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;color:#374151;text-decoration:none;font-size:11px;font-weight:500">
          📍 Google Maps
        </a>
      </div>
    </div>`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGENDA = [
  { color: '#3b82f6', label: '0% — Non iniziata' },
  { color: '#f59e0b', label: '1–33% — Avvio' },
  { color: '#f97316', label: '34–66% — In corso' },
  { color: '#22c55e', label: '67–99% — Avanzata' },
  { color: '#6b7280', label: '100% — Completata' },
  { color: '#ef4444', label: 'In ritardo' },
]

const FILTRI_DEFAULT: Filtri = { stato: 'tutti', avanzamento: 'tutti', provincia: '' }

const STATO_LABELS: Record<string, string> = {
  tutti: 'Tutti', attive: 'Attive', ritardo: 'In ritardo', completate: 'Completate',
}
const AVZ_LABELS: Record<string, string> = {
  tutti: 'Tutti', '0': '0%', '1-50': '1–50%', '51-99': '51–99%', '100': '100%',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MappaCantieri() {
  const mapContainer  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<mapboxgl.Map | null>(null)
  const sedeMarker    = useRef<mapboxgl.Marker | null>(null)
  const allDataRef    = useRef<CommessaKPI[]>([])
  const filtriRef     = useRef<Filtri>(FILTRI_DEFAULT)
  const router        = useRouter()

  const [loading, setLoading]             = useState(true)
  const [count, setCount]                 = useState(0)
  const [error, setError]                 = useState<string | null>(null)
  const [geocodingInfo, setGeocodingInfo] = useState<string | null>(null)
  const [filtri, setFiltri]               = useState<Filtri>(FILTRI_DEFAULT)
  const [filtriOpen, setFiltriOpen]       = useState(false)
  const [province, setProvince]           = useState<string[]>([])

  // Keep ref in sync so closures always see the latest filters
  filtriRef.current = filtri

  const updateSource = useCallback((newFiltri: Filtri) => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('commesse') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const filtered = applyFilters(allDataRef.current, newFiltri)
    src.setData(toGeoJSON(filtered))
    setCount(filtered.filter(c => c.lat != null && c.lng != null).length)
  }, [])

  function handleFiltri(next: Filtri) {
    setFiltri(next)
    filtriRef.current = next
    updateSource(next)
  }

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

      // ── Auth ──────────────────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Sessione scaduta — effettua il login'); setLoading(false); return }

      const { data: profile } = await (supabase as any)
        .from('utenti').select('azienda_id').eq('id', user.id).single()
      const aziendaId = profile?.azienda_id
      console.log('[Mappa] user.id:', user.id, '→ azienda_id:', aziendaId)
      if (!aziendaId) { setError('Profilo utente non trovato'); setLoading(false); return }

      // ── Sede impresa ──────────────────────────────────────────────────────
      const { data: az, error: azErr } = await (supabase as any)
        .from('azienda').select('*').eq('id', aziendaId).maybeSingle()

      console.log('[Sede]', az, '— error:', azErr?.message)

      if (az) {
        const nomeAz    = az.ragione_sociale || az.nome || 'Sede impresa'
        const sedeLegale = az.sede_legale || null
        const prov      = az.provincia || null
        let sedeLat = az.sede_lat ?? az.lat ?? null
        let sedeLng = az.sede_lng ?? az.lng ?? null

        console.log('[Sede] campi risolti →', { nomeAz, sedeLegale, prov, sedeLat, sedeLng })

        if ((!sedeLat || !sedeLng) && sedeLegale) {
          const q = `${sedeLegale}, Italia`
          try {
            const r = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
              { headers: { 'Accept-Language': 'it' } }
            )
            const j = await r.json()
            console.log('[Sede geocoding]', q, j[0] ?? null)
            if (j[0]) { sedeLat = parseFloat(j[0].lat); sedeLng = parseFloat(j[0].lon) }
          } catch { /* non bloccante */ }
        }
        // Fallback: ragione_sociale + provincia
        if (!sedeLat && (nomeAz || prov)) {
          const q2 = [nomeAz, prov, 'Italia'].filter(Boolean).join(', ')
          try {
            const r2 = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q2)}&format=json&limit=1`,
              { headers: { 'Accept-Language': 'it' } }
            )
            const j2 = await r2.json()
            console.log('[Sede geocoding fallback]', q2, j2[0] ?? null)
            if (j2[0]) { sedeLat = parseFloat(j2[0].lat); sedeLng = parseFloat(j2[0].lon) }
          } catch { /* non bloccante */ }
        }

        console.log('[Sede] coordinate finali →', { sedeLat, sedeLng })

        if (sedeLat && sedeLng) {
          const el = document.createElement('div')
          el.innerHTML = `<div style="
            width:46px;height:46px;border-radius:50%;
            background:#1e3a5f;border:3px solid #fff;
            display:flex;align-items:center;justify-content:center;
            font-size:22px;cursor:pointer;
            box-shadow:0 3px 14px rgba(0,0,0,.5)">🏢</div>`

          const sedePopup = new mapboxgl.Popup({ offset: 26, maxWidth: '260px' })
            .setHTML(`
              <div style="font-family:'Segoe UI',sans-serif;font-size:12px;padding:2px">
                <div style="font-weight:700;font-size:13px;color:#1e3a5f;margin-bottom:6px">🏢 ${nomeAz}</div>
                ${sedeLegale ? `<div style="color:#374151;margin-bottom:2px">📍 ${sedeLegale}</div>` : ''}
                ${prov ? `<div style="color:#6b7280;font-size:11px">${prov}</div>` : ''}
                ${az.piva ? `<div style="color:#6b7280;font-size:10px;margin-top:4px;font-family:monospace">P.IVA ${az.piva}</div>` : ''}
              </div>`)

          sedeMarker.current = new mapboxgl.Marker({ element: el })
            .setLngLat([sedeLng, sedeLat])
            .setPopup(sedePopup)
            .addTo(map)
        }

        // Rate limit prima del loop commesse
        await new Promise(r => setTimeout(r, 1100))
      }

      // ── Carica commesse ───────────────────────────────────────────────────
      const { data: kpiData, error: dbErr } = await (supabase as any)
        .from('v_commesse_kpi')
        .select('id,codice,nome,stato,importo_contratto,avanzamento_pct,residuo,giorni_rimanenti,in_ritardo,lat,lng')
        .eq('azienda_id', aziendaId)

      if (dbErr) { setError('Errore caricamento dati: ' + dbErr.message); setLoading(false); return }
      console.log('[Mappa] KPI da view:', kpiData?.length, 'commesse')

      const { data: addrData } = await (supabase as any)
        .from('commesse')
        .select('id,indirizzo_cantiere,comune_cantiere,cap_cantiere,provincia,lat,lng')
        .eq('azienda_id', aziendaId)
      console.log('[Mappa] Indirizzi da commesse:', addrData?.length)

      const addrMap = new Map<string, any>((addrData || []).map((r: any) => [r.id, r]))
      const allData: CommessaKPI[] = (kpiData || []).map((c: any) => {
        const addr = addrMap.get(c.id) || {}
        return {
          ...c,
          lat: c.lat ?? addr.lat ?? null,
          lng: c.lng ?? addr.lng ?? null,
          indirizzo_cantiere: addr.indirizzo_cantiere || null,
          comune_cantiere:    addr.comune_cantiere    || null,
          provincia:          addr.provincia           || null,
        }
      })

      allDataRef.current = allData

      const provSet = new Set(allData.map(c => c.provincia).filter((p): p is string => !!p))
      setProvince(Array.from(provSet).sort())

      const conCoord  = allData.filter(c => c.lat != null && c.lng != null)
      const senzaCoord = allData.filter(c => (c.lat == null || c.lng == null) && (c.indirizzo_cantiere || c.comune_cantiere))
      console.log('[Mappa] Con coordinate:', conCoord.length, '— Da geocodificare:', senzaCoord.length)

      // ── GeoJSON source + cluster layers ───────────────────────────────────
      map.addSource('commesse', {
        type: 'geojson',
        data: toGeoJSON(allData),
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 50,
        clusterProperties: {
          sum_ritardo: ['+', ['get', 'in_ritardo']],
        },
      } as any)

      // Cluster circle
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'commesse',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'case',
            ['>=', ['/', ['get', 'sum_ritardo'], ['get', 'point_count']], 0.5], '#ef4444',
            ['>', ['get', 'sum_ritardo'], 0], '#f97316',
            '#22c55e',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 22, 5, 30, 20, 38],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9,
        },
      })

      // Cluster count label
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'commesse',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
        },
        paint: { 'text-color': '#fff' },
      })

      // Individual points
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'commesse',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 11,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#fff',
        },
      })

      setCount(conCoord.length)
      setLoading(false)

      if (conCoord.length > 0) {
        const b = new mapboxgl.LngLatBounds()
        conCoord.forEach(c => b.extend([Number(c.lng), Number(c.lat)]))
        map.fitBounds(b, { padding: 80, maxZoom: 13 })
      }

      // Click cluster → zoom
      map.on('click', 'clusters', e => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
        if (!f) return
        ;(map.getSource('commesse') as mapboxgl.GeoJSONSource)
          .getClusterExpansionZoom(f.properties!.cluster_id, (err, zoom) => {
            if (err || zoom == null) return
            map.easeTo({ center: (f.geometry as any).coordinates, zoom })
          })
      })

      // Click individual point → popup (HTML identico all'esistente)
      map.on('click', 'unclustered-point', e => {
        const f = e.features![0]
        const [lng, lat] = (f.geometry as any).coordinates as [number, number]
        new mapboxgl.Popup({ offset: 20, maxWidth: '300px' })
          .setLngLat([lng, lat])
          .setHTML(buildPopupHTML(f.properties as Record<string, any>, lat, lng))
          .addTo(map)
      })

      map.on('mouseenter', 'clusters',          () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'clusters',          () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = '' })

      // ── Geocodifica commesse senza coordinate ─────────────────────────────
      if (senzaCoord.length > 0) {
        setGeocodingInfo(`Geocodifica ${senzaCoord.length} cantieri…`)
        let geocodedCount = 0

        for (let i = 0; i < senzaCoord.length; i++) {
          const c = senzaCoord[i]
          if (i > 0) await new Promise(r => setTimeout(r, 1000)) // ToS Nominatim: 1 req/sec

          setGeocodingInfo(`Geocodifica cantieri… ${i + 1}/${senzaCoord.length}`)
          console.log(`[Mappa] Geocodifica ${i + 1}/${senzaCoord.length}: ${c.nome}`)

          const coords = await geocode(c)
          console.log(`[Mappa] Risultato "${c.nome}":`, coords)
          if (!coords) continue

          ;(supabase as any).from('commesse')
            .update({ lat: coords.lat, lng: coords.lng }).eq('id', c.id).then()

          const idx = allDataRef.current.findIndex(x => x.id === c.id)
          if (idx !== -1) allDataRef.current[idx] = { ...allDataRef.current[idx], ...coords }

          geocodedCount++
          const filtered = applyFilters(allDataRef.current, filtriRef.current)
          ;(map.getSource('commesse') as mapboxgl.GeoJSONSource).setData(toGeoJSON(filtered))
          setCount(filtered.filter(x => x.lat != null && x.lng != null).length)

          const b2 = new mapboxgl.LngLatBounds()
          allDataRef.current.filter(x => x.lat != null).forEach(x => b2.extend([Number(x.lng), Number(x.lat)]))
          if (!b2.isEmpty()) map.fitBounds(b2, { padding: 80, maxZoom: 13 })
        }

        if (geocodedCount > 0) {
          setGeocodingInfo(`${geocodedCount} cantieri geocodificati e salvati`)
          setTimeout(() => setGeocodingInfo(null), 3000)
        } else {
          setGeocodingInfo(null)
        }
      }
    })

    ;(window as any).__sq360_open = (id: string) => {
      router.push(`/dashboard/commesse/${id}/anagrafica`)
    }

    return () => {
      sedeMarker.current?.remove()
      sedeMarker.current = null
      map.remove()
      delete (window as any).__sq360_open
    }
  }, [router])

  // ─── JSX ──────────────────────────────────────────────────────────────────

  const filtriAttivi = filtri.stato !== 'tutti' || filtri.avanzamento !== 'tutti' || !!filtri.provincia

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 52px)' }}>

      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Controlli top-left: header + filtri */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280 }}>

        {/* Header */}
        <div style={{
          background: 'rgba(0,0,0,.70)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '8px 12px', color: '#fff',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 15 }}>🗺️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Cantieri attivi</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.65)' }}>
              {loading ? 'Caricamento…' : `${count} cantieri sulla mappa`}
            </div>
          </div>
          <button
            onClick={() => setFiltriOpen(v => !v)}
            style={{
              background: filtriAttivi ? '#3b82f6' : 'rgba(255,255,255,.15)',
              border: 'none', borderRadius: 6, padding: '4px 9px',
              color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: filtriAttivi ? 700 : 400,
              flexShrink: 0,
            }}>
            {filtriOpen ? '✕' : `⚙ Filtri${filtriAttivi ? ' •' : ''}`}
          </button>
        </div>

        {/* Pannello filtri */}
        {filtriOpen && (
          <div style={{
            background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(8px)',
            borderRadius: 10, padding: '12px 14px', color: '#fff',
          }}>

            {/* Stato */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.45)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 6 }}>
                Stato
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['tutti', 'attive', 'ritardo', 'completate'] as const).map(v => (
                  <button key={v}
                    onClick={() => handleFiltri({ ...filtri, stato: v })}
                    style={{
                      padding: '4px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      fontSize: 10, fontWeight: filtri.stato === v ? 700 : 400,
                      background: filtri.stato === v ? '#3b82f6' : 'rgba(255,255,255,.12)',
                      color: '#fff',
                    }}>
                    {STATO_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>

            {/* Avanzamento */}
            <div style={{ marginBottom: province.length > 0 ? 10 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.45)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 6 }}>
                Avanzamento
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['tutti', '0', '1-50', '51-99', '100'] as const).map(v => (
                  <button key={v}
                    onClick={() => handleFiltri({ ...filtri, avanzamento: v })}
                    style={{
                      padding: '4px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      fontSize: 10, fontWeight: filtri.avanzamento === v ? 700 : 400,
                      background: filtri.avanzamento === v ? '#3b82f6' : 'rgba(255,255,255,.12)',
                      color: '#fff',
                    }}>
                    {AVZ_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>

            {/* Provincia */}
            {province.length > 0 && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.45)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 6 }}>
                  Provincia
                </div>
                <select
                  value={filtri.provincia}
                  onChange={e => handleFiltri({ ...filtri, provincia: e.target.value })}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,.12)',
                    border: '1px solid rgba(255,255,255,.2)', borderRadius: 5,
                    color: '#fff', padding: '5px 8px', fontSize: 11,
                  }}>
                  <option value="">Tutte le province</option>
                  {province.map(p => <option key={p} value={p} style={{ color: '#111' }}>{p}</option>)}
                </select>
              </div>
            )}

            {/* Reset */}
            {filtriAttivi && (
              <button
                onClick={() => handleFiltri(FILTRI_DEFAULT)}
                style={{
                  marginTop: 10, width: '100%', padding: '5px', borderRadius: 5,
                  border: '1px solid rgba(255,255,255,.2)', background: 'transparent',
                  color: 'rgba(255,255,255,.65)', cursor: 'pointer', fontSize: 10,
                }}>
                ↺ Azzera filtri
              </button>
            )}
          </div>
        )}
      </div>

      {/* Badge geocodifica in corso */}
      {geocodingInfo && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
          borderRadius: 20, padding: '6px 14px', color: '#fff',
          fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          ⏳ {geocodingInfo}
        </div>
      )}

      {/* Errore */}
      {error && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 20, background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,.2)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{error}</div>
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
