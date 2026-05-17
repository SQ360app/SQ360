'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATO_COL: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6',
  IN_COLLAUDO:   '#8b5cf6', SOSPESA:    '#ef4444',
  ULTIMATA:      '#64748b', CHIUSA:     '#64748b',
}

interface CommessaRaw {
  id: string; codice: string; nome: string; stato: string
  importo_contratto: number; lat?: number; lng?: number
  indirizzo_cantiere?: string; comune_cantiere?: string
  cap_cantiere?: string; provincia?: string
}
interface CommessaCard extends CommessaRaw {
  resolvedLat?: number; resolvedLng?: number
  indirizzo_display?: string; geocoding?: boolean
}

const fmt = (n: number) => (n || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })

function staticMapUrl(lat: number, lng: number) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=400x200&markers=${lat},${lng},red`
}

async function geocodifica(c: CommessaRaw): Promise<{ lat: number; lng: number } | null> {
  const query = [c.indirizzo_cantiere, c.comune_cantiere, c.cap_cantiere, c.provincia, 'Italy']
    .filter(Boolean).join(', ')
  if (!query.trim() || query === 'Italy') return null
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SQ360/1.0' } }
    )
    const j = await r.json()
    if (j[0]) return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) }
    // Fallback: solo comune + provincia
    const fb = [c.comune_cantiere, c.provincia, 'Italy'].filter(Boolean).join(', ')
    const r2 = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fb)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SQ360/1.0' } }
    )
    const j2 = await r2.json()
    if (j2[0]) return { lat: parseFloat(j2[0].lat), lng: parseFloat(j2[0].lon) }
  } catch { /* ignora errori rete */ }
  return null
}

function StaticMapCard({ c, onNavigate }: { c: CommessaCard; onNavigate: (id: string) => void }) {
  const [imgErr, setImgErr] = useState(false)
  const hasCoords = c.resolvedLat != null && c.resolvedLng != null
  const col = STATO_COL[c.stato] || '#6b7280'
  const addr = c.indirizzo_display || [c.indirizzo_cantiere, c.comune_cantiere].filter(Boolean).join(', ')

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--panel)', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
      onClick={() => onNavigate(c.id)}>

      {/* Immagine mappa o placeholder */}
      <div style={{ position: 'relative', height: 130, background: col + '18', flexShrink: 0 }}>
        {hasCoords && !imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={staticMapUrl(c.resolvedLat!, c.resolvedLng!)}
            alt={c.nome}
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 14px', textAlign: 'center' }}>
            {c.geocoding ? (
              <>
                <span style={{ fontSize: 24 }}>🔍</span>
                <span style={{ fontSize: 10, color: col, fontWeight: 600 }}>Geolocalizzazione...</span>
              </>
            ) : addr ? (
              <>
                <span style={{ fontSize: 24 }}>📍</span>
                <span style={{ fontSize: 11, color: col, fontWeight: 600, lineHeight: 1.4 }}>{addr}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 28 }}>🏗️</span>
                <span style={{ fontSize: 10, color: col, fontWeight: 600 }}>Aggiungi indirizzo</span>
                <span style={{ fontSize: 9, color: '#9ca3af' }}>in Anagrafica</span>
              </>
            )}
          </div>
        )}
        {/* Badge stato overlay */}
        <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700, background: col, color: '#fff' }}>
          {c.stato?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Info commessa */}
      <div style={{ padding: '8px 10px', flex: 1 }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#6b7280', marginBottom: 1 }}>{c.codice}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {c.nome}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', fontFamily: 'monospace' }}>
          € {fmt(c.importo_contratto)}
        </div>
      </div>
    </div>
  )
}

export default function MapCommesse() {
  const [cards,    setCards]    = useState<CommessaCard[]>([])
  const [loading,  setLoading]  = useState(true)
  const [geocCnt,  setGeocCnt]  = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const aziendaId = await getAziendaId()
      const { data } = await supabase
        .from('commesse')
        .select('id,codice,nome,stato,importo_contratto,lat,lng,indirizzo_cantiere,comune_cantiere,cap_cantiere,provincia')
        .eq('azienda_id', aziendaId || '')
        .not('stato', 'in', '("CHIUSA","ARCHIVIATA","chiusa","archiviata")')
        .order('nome')

      if (cancelled) return
      const raw = (data || []) as CommessaRaw[]
      console.log('Commesse caricate:', raw.length, raw.map(c => c.nome))

      // Inizializza subito tutte le card (anche quelle senza coordinate)
      const initial: CommessaCard[] = raw.map(c => ({
        ...c,
        resolvedLat: c.lat ?? undefined,
        resolvedLng: c.lng ?? undefined,
        indirizzo_display: [c.indirizzo_cantiere, c.comune_cantiere].filter(Boolean).join(', ') || undefined,
        geocoding: (c.lat == null || c.lng == null) && !!(c.indirizzo_cantiere || c.comune_cantiere || c.provincia),
      }))
      setCards(initial)
      setLoading(false)

      // Geocodifica in background le commesse senza coordinate
      const daGeocode = raw.filter(c =>
        (c.lat == null || c.lng == null) &&
        (c.indirizzo_cantiere || c.comune_cantiere || c.provincia)
      )
      if (daGeocode.length === 0) return
      setGeocCnt(daGeocode.length)

      for (const c of daGeocode) {
        if (cancelled) break
        const coords = await geocodifica(c)
        setGeocCnt(n => Math.max(0, n - 1))
        if (coords) {
          setCards(prev => prev.map(card =>
            card.id === c.id
              ? { ...card, resolvedLat: coords.lat, resolvedLng: coords.lng, geocoding: false }
              : card
          ))
          // Salva nel DB (fire-and-forget)
          supabase.from('commesse').update({ lat: coords.lat, lng: coords.lng }).eq('id', c.id)
        } else {
          setCards(prev => prev.map(card => card.id === c.id ? { ...card, geocoding: false } : card))
        }
        await new Promise(r => setTimeout(r, 1100)) // Nominatim rate limit
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const nav = (id: string) => window.location.href = `/dashboard/commesse/${id}/anagrafica`

  if (loading) return null

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '11px 15px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>🗺️ Cantieri attivi</span>
        <span style={{ fontSize: 11, color: geocCnt > 0 ? '#d97706' : 'var(--t3)', fontWeight: geocCnt > 0 ? 600 : 400 }}>
          {geocCnt > 0 ? `📍 Geolocalizzazione in corso… (${geocCnt})` : `${cards.length} commesse`}
        </span>
      </div>

      {cards.length === 0 ? (
        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--t3)', fontSize: 12 }}>
          <span style={{ fontSize: 20 }}>🏗️</span>
          <span>Nessuna commessa attiva</span>
        </div>
      ) : (
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {cards.map(c => <StaticMapCard key={c.id} c={c} onNavigate={nav} />)}
        </div>
      )}
    </div>
  )
}
