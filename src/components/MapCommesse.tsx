'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { supabase } from '@/lib/supabase'
import { getAziendaId } from '@/lib/supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix icone Leaflet con webpack
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

interface CommessaGeo {
  id: string; codice: string; nome: string; stato: string
  importo_contratto: number; lat: number; lng: number
}

const fmt = (n: number) => (n || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })

export default function MapCommesse() {
  const [commesse, setCommesse] = useState<CommessaGeo[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const aziendaId = await getAziendaId()
      const { data } = await supabase
        .from('commesse')
        .select('id,codice,nome,stato,importo_contratto,lat,lng')
        .eq('azienda_id', aziendaId || '')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .not('stato', 'in', '("CHIUSA","ARCHIVIATA","chiusa","archiviata")')
      setCommesse((data || []) as CommessaGeo[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return null

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '11px 15px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>🗺️ Cantieri attivi</span>
        <span style={{ fontSize: 11, color: 'var(--t3)' }}>{commesse.length} con coordinate</span>
      </div>

      {commesse.length === 0 ? (
        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--t3)', fontSize: 12 }}>
          <span style={{ fontSize: 20 }}>📍</span>
          <span>Aggiungi le coordinate del cantiere in <strong>Anagrafica</strong> per vedere la commessa sulla mappa</span>
        </div>
      ) : (
        <MapContainer
          center={[42, 12]}
          zoom={6}
          style={{ height: 320, width: '100%' }}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {commesse.map(c => (
            <Marker key={c.id} position={[c.lat, c.lng]}>
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'system-ui, sans-serif' }}>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#6b7280', marginBottom: 2 }}>{c.codice}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6, lineHeight: 1.3 }}>{c.nome}</div>
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
