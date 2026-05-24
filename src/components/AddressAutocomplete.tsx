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
  comuneCorrente?: string
  provinciaCorrente?: string
  tipoDefault?: string
}

// ─── Configurazione tipi indirizzo italiani ────────────────────────────────────

const TIPI = [
  { value: 'via',      label: 'Via/Viale/Corso',         placeholder: 'es. Via Roma' },
  { value: 'piazza',   label: 'Piazza/Largo/Vicolo',     placeholder: 'es. Piazza Garibaldi' },
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

const NOM_HEADERS = { 'Accept-Language': 'it', 'User-Agent': 'SQ360/1.0 info.sq360@gmail.com' }
const NOM_BASE    = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=it&viewbox=6.6,47.1,18.5,35.5&bounded=0'

async function nominatimFetch(q: string): Promise<NominatimResult[]> {
  try {
    const r = await fetch(`${NOM_BASE}&q=${encodeURIComponent(q)}`, { headers: NOM_HEADERS })
    return await r.json()
  } catch { return [] }
}

// Photon (Komoot) — indice OSM più completo di Nominatim per strade minori
// bbox: lon_west,lat_south,lon_east,lat_north (Italia)
async function photonFetch(q: string): Promise<NominatimResult[]> {
  try {
    const r = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=it&limit=5&bbox=6.6,36.6,18.5,47.1`,
      { headers: { 'User-Agent': 'SQ360/1.0 info.sq360@gmail.com' } }
    )
    const json = await r.json()
    return (json.features || []).map((f: any) => {
      const p  = f.properties
      const road = p.street || p.name || ''
      const hn   = p.housenumber || ''
      const city = p.city || p.town || p.village || p.municipality || ''
      return {
        display_name: [hn ? `${road} ${hn}` : road, p.postcode && city ? `${p.postcode} ${city}` : city].filter(Boolean).join(', '),
        lat: String(f.geometry.coordinates[1]),
        lon: String(f.geometry.coordinates[0]),
        address: {
          road,
          house_number: hn,
          postcode:  p.postcode  || '',
          city,
          town:      p.town      || '',
          village:   p.village   || '',
          county:    p.county    || '',
          state:     p.state     || '',
          'ISO3166-2-lvl6': '',
        },
      }
    })
  } catch { return [] }
}

// Mappa province italiane nome completo → sigla (per risultati Photon)
const PROVINCE_MAP: Record<string, string> = {
  'agrigento':'AG','alessandria':'AL','ancona':'AN','aosta':'AO','arezzo':'AR',
  'ascoli piceno':'AP','asti':'AT','avellino':'AV','bari':'BA','barletta-andria-trani':'BT',
  'belluno':'BL','benevento':'BN','bergamo':'BG','biella':'BI','bologna':'BO',
  'bolzano':'BZ','brescia':'BS','brindisi':'BR','cagliari':'CA','caltanissetta':'CL',
  'campobasso':'CB','carbonia-iglesias':'CI','caserta':'CE','catania':'CT','catanzaro':'CZ',
  'chieti':'CH','como':'CO','cosenza':'CS','cremona':'CR','crotone':'KR','cuneo':'CN',
  'enna':'EN','fermo':'FM','ferrara':'FE','firenze':'FI','foggia':'FG',
  'forlì-cesena':'FC','frosinone':'FR','genova':'GE','gorizia':'GO','grosseto':'GR',
  'imperia':'IM','isernia':'IS','la spezia':'SP','l\'aquila':'AQ','latina':'LT',
  'lecce':'LE','lecco':'LC','livorno':'LI','lodi':'LO','lucca':'LU',
  'macerata':'MC','mantova':'MN','massa-carrara':'MS','matera':'MT','medio campidano':'VS',
  'messina':'ME','milano':'MI','modena':'MO','monza e della brianza':'MB','napoli':'NA',
  'novara':'NO','nuoro':'NU','ogliastra':'OG','olbia-tempio':'OT','oristano':'OR',
  'padova':'PD','palermo':'PA','parma':'PR','pavia':'PV','perugia':'PG',
  'pesaro e urbino':'PU','pescara':'PE','piacenza':'PC','pisa':'PI','pistoia':'PT',
  'pordenone':'PN','potenza':'PZ','prato':'PO','ragusa':'RG','ravenna':'RA',
  'reggio calabria':'RC','reggio emilia':'RE','rieti':'RI','rimini':'RN','roma':'RM',
  'rovigo':'RO','salerno':'SA','sassari':'SS','savona':'SV','siena':'SI',
  'siracusa':'SR','sondrio':'SO','taranto':'TA','teramo':'TE','terni':'TR',
  'torino':'TO','tortolì':'OG','trapani':'TP','trento':'TN','treviso':'TV',
  'trieste':'TS','udine':'UD','varese':'VA','venezia':'VE','verbano-cusio-ossola':'VB',
  'vercelli':'VC','verona':'VR','vibo valentia':'VV','vicenza':'VI','viterbo':'VT',
}

function getProvince(a: Record<string, string>): string {
  const iso = a['ISO3166-2-lvl6']
  if (iso) return iso.split('-').pop()?.toUpperCase() || ''
  const county = (a.county || '').toLowerCase().replace(/^provincia (di|del|della|dell\'|dei|degli|delle) /i, '')
  return PROVINCE_MAP[county] || (a.county || '').substring(0, 2).toUpperCase()
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function AddressAutocomplete({
  value, onChange, onSelect,
  placeholder, inputStyle,
  comuneCorrente, provinciaCorrente,
  tipoDefault = 'via',
}: Props) {
  const [tipo,      setTipo]      = useState(tipoDefault)
  const [results,   setResults]   = useState<NominatimResult[]>([])
  const [open,      setOpen]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [noResults, setNoResults] = useState(false)
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
      // Tentativo 1: query completa con comune/provincia
      let data = await nominatimFetch(buildQuery(tipo, q, comuneCorrente, provinciaCorrente))

      // Tentativo 2: rimuovi numero civico (Nominatim trova meglio la via senza civico)
      if (data.length === 0 && /\d/.test(q)) {
        const soloVia = q.replace(/\s*\d+[a-zA-Z]?\s*/g, ' ').trim()
        if (soloVia.length >= 3) {
          data = await nominatimFetch(buildQuery(tipo, soloVia, comuneCorrente, provinciaCorrente))
        }
      }

      // Tentativo 3: Photon — indice OSM più completo, trova strade minori e toponimi locali
      if (data.length === 0) {
        const qPhoton = [q, comuneCorrente].filter(Boolean).join(' ')
        data = await photonFetch(qPhoton)
      }

      // Tentativo 4: solo comune + provincia (fallback finale per frazioni/contrade)
      if (data.length === 0 && comuneCorrente) {
        const q4 = [comuneCorrente, provinciaCorrente, 'Italia'].filter(Boolean).join(', ')
        data = await nominatimFetch(q4)
      }

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
    const road   = [a.road, a.house_number].filter(Boolean).join(' ') || value
    const comune = a.city || a.town || a.village || a.municipality || a.county || ''
    const capFallback = a.postcode ? '' : (r.display_name.match(/\b(\d{5})\b/)?.[1] || '')
    const parsed: Omit<ParsedAddress, 'indirizzo'> = {
      cap:      a.postcode || capFallback,
      comune,
      provincia: getProvince(a),
      lat:      parseFloat(r.lat),
      lng:      parseFloat(r.lon),
    }
    onChange(road)
    onSelect({ indirizzo: road, ...parsed })
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
      {portal}
    </div>
  )
}
