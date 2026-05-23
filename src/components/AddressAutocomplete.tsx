'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface ParsedAddress {
  indirizzo: string
  cap: string
  comune: string
  provincia: string
  lat: number
  lng: number
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  address: Record<string, string>
}

interface Props {
  value: string
  onChange: (val: string) => void
  onSelect: (parsed: ParsedAddress) => void
  placeholder?: string
  inputStyle?: React.CSSProperties
}

function getProvince(a: Record<string, string>): string {
  const iso = a['ISO3166-2-lvl6']
  if (iso) return iso.split('-').pop()?.toUpperCase() || ''
  return (a.county || '').substring(0, 2).toUpperCase()
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder, inputStyle }: Props) {
  const [results, setResults]   = useState<NominatimResult[]>([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&countrycodes=it`,
        { headers: { 'Accept-Language': 'it', 'User-Agent': 'SQ360/1.0 info.sq360@gmail.com' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
      if (data.length > 0) setOpen(true)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(value), 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [value, search])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = (r: NominatimResult) => {
    const a = r.address
    const road   = [a.road, a.house_number].filter(Boolean).join(' ')
    const comune = a.city || a.town || a.village || a.municipality || ''
    onChange(road || value)
    onSelect({
      indirizzo: road || value,
      cap:       a.postcode || '',
      comune,
      provincia: getProvince(a),
      lat:       parseFloat(r.lat),
      lng:       parseFloat(r.lon),
    })
    setOpen(false)
    setResults([])
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder={placeholder || 'Cerca indirizzo…'}
        style={inputStyle}
      />
      {loading && (
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#9ca3af', pointerEvents: 'none' }}>
          …
        </span>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden',
        }}>
          {results.map((r, i) => {
            const a      = r.address
            const road   = [a.road, a.house_number].filter(Boolean).join(' ') || r.display_name.split(',')[0]
            const city   = a.city || a.town || a.village || ''
            const cap    = a.postcode || ''
            return (
              <div key={i}
                onClick={() => select(r)}
                style={{
                  padding: '9px 12px', cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{road}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                  {[cap, city].filter(Boolean).join(' ')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
