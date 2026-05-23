'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'

// ─── Tipi pubblici ─────────────────────────────────────────────────────────────

export interface ParsedAddress {
  indirizzo: string
  cap: string
  comune: string
  provincia: string
  lat: number
  lng: number
  interno?: string
}

export type AddressResult = ParsedAddress

// ─── Tipi interni ──────────────────────────────────────────────────────────────

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
  // Contesto opzionale per query Nominatim migliori
  comuneCorrente?: string
  provinciaCorrente?: string
  // Tipo indirizzo iniziale
  tipoDefault?: string
  // Campo Int./Scala/Piano (default false per backward compat)
  showInterno?: boolean
  onInternoChange?: (interno: string) => void
}

// ─── Configurazione tipi indirizzo italiani ────────────────────────────────────

const TIPI = [
  { value: 'via',      label: 'Via/Viale/Corso',         placeholder: 'es. Via Roma 14' },
  { value: 'piazza',   label: 'Piazza/Largo/Vicolo',     placeholder: 'es. Piazza Garibaldi 1' },
  { value: 'ss',       label: 'Strada Statale (SS)',      placeholder: 'es. SS4 km 23+500' },
  { value: 'sp',       label: 'Strada Provinciale (SP)', placeholder: 'es. SP12 km 5' },
  { value: 'localita', label: 'Località/Frazione',       placeholder: 'es. Loc. Colle Bianco SNC' },
  { value: 'contrada', label: 'Contrada (C.da)',         placeholder: 'es. C.da Fontana Vecchia' },
  { value: 'zona_ind', label: 'Zona Ind. (Z.I.)',        placeholder: 'es. Z.I. ASI lotto 14' },
  { value: 'altro',    label: 'Altro',                   placeholder: 'Inserisci indirizzo...' },
]

// ─── Query Nominatim contestuale per tipo ──────────────────────────────────────

function buildQuery(tipo: string, testo: string, comune?: string, provincia?: string): string {
  const ctx     = [comune, provincia, 'Italia'].filter(Boolean).join(', ')
  const ctxProv = [provincia, 'Italia'].filter(Boolean).join(', ')
  const base     = ctx || 'Italia'
  const baseProv = ctxProv || 'Italia'
  switch (tipo) {
    case 'ss':
    case 'sp':
      // Le strade statali/provinciali si trovano meglio con provincia, non comune
      return `${testo}, ${baseProv}`
    case 'localita':
      return `frazione ${testo}, ${base}`
    case 'contrada':
      return `contrada ${testo}, ${base}`
    default:
      return `${testo}, ${base}`
  }
}

function getProvince(a: Record<string, string>): string {
  const iso = a['ISO3166-2-lvl6']
  if (iso) return iso.split('-').pop()?.toUpperCase() || ''
  return (a.county || '').substring(0, 2).toUpperCase()
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function AddressAutocomplete({
  value, onChange, onSelect,
  placeholder, inputStyle,
  comuneCorrente, provinciaCorrente,
  tipoDefault = 'via',
  showInterno = false,
  onInternoChange,
}: Props) {
  const [tipo,      setTipo]      = useState(tipoDefault)
  const [results,   setResults]   = useState<NominatimResult[]>([])
  const [open,      setOpen]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [interno,   setInterno]   = useState('')
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0, width: 300 })
  const [mounted,   setMounted]   = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const portalRef    = useRef<HTMLDivElement | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Portal richiede il DOM — disponibile solo dopo mount
  useEffect(() => { setMounted(true) }, [])

  const tipoInfo = TIPI.find(t => t.value === tipo) || TIPI[0]

  // ─── Posizione dropdown (ricalcolata a ogni scroll/resize) ────────────────

  const updatePos = useCallback(() => {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  // ─── Chiudi cliccando fuori (container O portal) ──────────────────────────

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const inContainer = containerRef.current?.contains(e.target as Node)
      const inPortal    = portalRef.current?.contains(e.target as Node)
      if (!inContainer && !inPortal) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ─── Ricerca Nominatim con debounce 400ms ─────────────────────────────────

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); setNoResults(false); return }
    setLoading(true)
    setNoResults(false)
    try {
      const query = buildQuery(tipo, q, comuneCorrente, provinciaCorrente)
      const res   = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=it`,
        { headers: { 'Accept-Language': 'it', 'User-Agent': 'SQ360/1.0 info.sq360@gmail.com' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
      setOpen(true)
      setNoResults(data.length === 0)
    } catch {
      setResults([])
      setNoResults(false)
    } finally {
      setLoading(false)
    }
  }, [tipo, comuneCorrente, provinciaCorrente])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(value), 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [value, search])

  // ─── Selezione risultato ──────────────────────────────────────────────────

  const select = (r: NominatimResult) => {
    const a      = r.address
    const road   = [a.road, a.house_number].filter(Boolean).join(' ')
    const comune = a.city || a.town || a.village || a.municipality || ''
    const street = road || value
    onChange(street)
    onSelect({
      indirizzo: street,
      cap:       a.postcode || '',
      comune,
      provincia: getProvince(a),
      lat:       parseFloat(r.lat),
      lng:       parseFloat(r.lon),
      interno:   interno || undefined,
    })
    setOpen(false)
    setResults([])
    setNoResults(false)
  }

  // ─── Stili derivati dall'inputStyle del caller ────────────────────────────

  const selectStyle: React.CSSProperties = {
    flexShrink: 0,
    width: 140,
    padding: typeof inputStyle?.padding === 'string' ? inputStyle.padding : '7px 8px',
    border: `1px solid ${typeof inputStyle?.borderColor === 'string' ? inputStyle.borderColor : '#d1d5db'}`,
    borderRadius: typeof inputStyle?.borderRadius === 'number'
      ? inputStyle.borderRadius
      : typeof inputStyle?.borderRadius === 'string'
        ? inputStyle.borderRadius
        : 6,
    fontSize: 11,
    fontFamily: 'inherit',
    background: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'auto' as React.CSSProperties['appearance'],
  }

  const internoStyle: React.CSSProperties = {
    marginTop: 5,
    width: '100%',
    boxSizing: 'border-box',
    padding: '5px 10px',
    border: `1px solid ${typeof inputStyle?.borderColor === 'string' ? inputStyle.borderColor : '#e5e7eb'}`,
    borderRadius: typeof inputStyle?.borderRadius === 'number'
      ? inputStyle.borderRadius
      : 6,
    fontSize: 11,
    color: '#9ca3af',
    background: 'transparent',
    outline: 'none',
    fontFamily: 'inherit',
  }

  // ─── Portal dropdown (position:fixed, zIndex 9999) ────────────────────────

  const portal = mounted && open
    ? ReactDOM.createPortal(
        <div
          ref={portalRef}
          style={{
            position: 'fixed',
            top:   dropPos.top,
            left:  dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            overflow: 'hidden',
            fontFamily: 'system-ui,-apple-system,sans-serif',
          }}
        >
          {noResults && !loading ? (
            <div style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
              Nessun risultato — puoi inserire manualmente
            </div>
          ) : (
            results.map((r, i) => {
              const a    = r.address
              const road = [a.road, a.house_number].filter(Boolean).join(' ')
                        || r.display_name.split(',')[0]
              const city = a.city || a.town || a.village || ''
              const cap  = a.postcode || ''
              return (
                <div
                  key={i}
                  onMouseDown={() => select(r)}
                  style={{
                    padding: '9px 12px',
                    cursor: 'pointer',
                    borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{road}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    {[cap, city].filter(Boolean).join(' — ')}
                  </div>
                </div>
              )
            })
          )}
        </div>,
        document.body
      )
    : null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef}>
      {/* Riga tipo + campo testo */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        <select
          value={tipo}
          onChange={e => {
            setTipo(e.target.value)
            setResults([])
            setOpen(false)
            setNoResults(false)
          }}
          style={selectStyle}
          title="Tipo indirizzo"
        >
          {TIPI.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={value}
            onChange={e => {
              onChange(e.target.value)
              if (e.target.value.length >= 3) setOpen(true)
            }}
            onFocus={() => { if (results.length > 0 || noResults) setOpen(true) }}
            placeholder={placeholder || tipoInfo.placeholder}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 0 }}
          />
          {loading && (
            <span style={{
              position: 'absolute', right: 10, top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 11, color: '#9ca3af', pointerEvents: 'none',
            }}>
              ⋯
            </span>
          )}
        </div>
      </div>

      {/* Campo Int./Scala/Piano opzionale */}
      {showInterno && (
        <input
          type="text"
          value={interno}
          onChange={e => {
            setInterno(e.target.value)
            onInternoChange?.(e.target.value)
          }}
          placeholder="Int./Scala/Piano — es. Sc. B Int. 4 P. 2 (opzionale)"
          style={internoStyle}
        />
      )}

      {portal}
    </div>
  )
}
