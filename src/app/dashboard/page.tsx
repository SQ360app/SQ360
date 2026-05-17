'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

const MapCommesse = dynamic(() => import('@/components/MapCommesse'), { ssr: false })

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fmt  = (n: number) => (n || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })
const fmtM = (n: number) => n >= 1_000_000 ? `€ ${(n/1_000_000).toFixed(1)}M` : `€ ${fmt(n)}`
const fmtD = (s?: string) =>
  s ? new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '—'
const ggA = (s: string) =>
  Math.round((new Date(s).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)

const STATO_COL: Record<string, string> = {
  IN_ESECUZIONE: '#10b981', AGGIUDICATA: '#3b82f6',
  IN_COLLAUDO: '#8b5cf6',  SOSPESA: '#ef4444',
  ULTIMATA: '#64748b',     CHIUSA: '#64748b',
}
const sc = (s: string) => STATO_COL[s] || '#6b7280'

/* ── Subcomponenti ────────────────────────────────────────────────────── */

function KpiCard({ label, value, sub, color, alert = false }: {
  label: string; value: string | number; sub?: string; color: string; alert?: boolean
}) {
  return (
    <div style={{
      background: alert ? color + '0d' : 'var(--panel)',
      border: `1px solid ${alert ? color + '50' : 'var(--border)'}`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 10, padding: '14px 16px',
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase',
        letterSpacing: '0.06em', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 10, color: 'var(--t3)', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

function AlertKpi({ icon, label, value, color, onClick }: {
  icon: string; label: string; value: number; color: string; onClick?: () => void
}) {
  const zero = value === 0
  return (
    <div onClick={onClick}
      style={{
        background: zero ? 'var(--panel)' : color + '0d',
        border: `1px solid ${zero ? 'var(--border)' : color + '50'}`,
        borderRadius: 10, padding: '12px 16px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
      <span style={{ fontSize: 22 }}>{zero ? '✅' : icon}</span>
      <div>
        <p style={{ fontSize: 20, fontWeight: 800, color: zero ? '#10b981' : color,
          margin: 0, fontFamily: 'var(--font-mono)' }}>{value}</p>
        <p style={{ fontSize: 10, color: 'var(--t3)', margin: '2px 0 0' }}>{label}</p>
      </div>
    </div>
  )
}

function RecentList({ title, icon, items, onNav }: {
  title: string; icon: string
  items: { id: string; primary: string; secondary: string; meta: string; date: string; cid?: string }[]
  onNav: (cid: string) => void
}) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '11px 15px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{icon} {title}</span>
      </div>
      {items.length === 0 ? (
        <p style={{ padding: '20px 15px', textAlign: 'center', fontSize: 11, color: 'var(--t3)', margin: 0 }}>
          Nessun elemento recente
        </p>
      ) : items.map((it, i) => (
        <div key={it.id}
          onClick={() => it.cid && onNav(it.cid)}
          style={{
            padding: '9px 15px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            cursor: it.cid ? 'pointer' : 'default', display: 'flex', gap: 8, alignItems: 'center',
          }}
          onMouseEnter={e => { if (it.cid) e.currentTarget.style.background = 'var(--bg)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', margin: '0 0 1px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.primary}</p>
            <p style={{ fontSize: 10, color: 'var(--t3)', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.secondary}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', margin: '0 0 1px' }}>{it.meta}</p>
            <p style={{ fontSize: 9, color: 'var(--t3)', margin: 0 }}>{fmtD(it.date)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Pagina principale ───────────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [commesse, setCommesse] = useState<any[]>([])
  const [spesaMap, setSpesaMap] = useState<Record<string, number>>({})
  const [kpi, setKpi] = useState({
    attive: 0, portafoglio: 0, odaMese: 0,
    fattureCount: 0, fattureTot: 0,
    durc: 0, scaduti: 0, subIncompl: 0,
  })
  const [scad, setScad] = useState<any[]>([])
  const [rec, setRec] = useState<{ oda: any[]; ddt: any[]; docs: any[] }>({
    oda: [], ddt: [], docs: [],
  })

  /* ── Carica tutti i dati in parallelo ─────────────────────────────── */
  const carica = useCallback(async () => {
    setLoading(true)
    const oggi = new Date()
    const todayS = oggi.toISOString().slice(0, 10)
    const tra30S = new Date(oggi.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const meseS  = new Date(oggi.getFullYear(), oggi.getMonth(), 1).toISOString()

    const [
      rC,    // commesse
      rOM,   // ODA questo mese (count)
      rFP,   // fatture da pagare
      rDS,   // doc sicurezza in scadenza ≤30gg
      rDSc,  // doc sicurezza scaduti (count)
      rCS,   // contratti sub (checklist)
      rOS,   // ODA per spesa per commessa
      rOR,   // ultimi 5 ODA
      rDR,   // ultimi 5 DDT
      rDocR, // ultimi 5 documenti
      rFS,   // fatture in scadenza ≤30gg
    ] = await Promise.all([
      supabase.from('commesse')
        .select('id,codice,nome,stato,committente,importo_contratto')
        .order('created_at', { ascending: false }),

      supabase.from('oda')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', meseS),

      supabase.from('fatture_passive')
        .select('id,importo_totale')
        .eq('stato', 'da_pagare'),

      supabase.from('documenti_sicurezza')
        .select('id,tipo,soggetto,data_scadenza,commessa_id')
        .not('data_scadenza', 'is', null)
        .gte('data_scadenza', todayS)
        .lte('data_scadenza', tra30S)
        .order('data_scadenza', { ascending: true }),

      supabase.from('documenti_sicurezza')
        .select('*', { count: 'exact', head: true })
        .not('data_scadenza', 'is', null)
        .lt('data_scadenza', todayS),

      supabase.from('contratti_sub')
        .select('id,durc_ok,pos_approvato,comunicazione_sa,antimafia_ok')
        .neq('stato', 'RESCISSO'),

      supabase.from('oda')
        .select('commessa_id,importo_netto')
        .neq('stato', 'ANNULLATO'),

      supabase.from('oda')
        .select('id,numero,commessa_id,importo_netto,created_at,fornitore:professionisti_fornitori(ragione_sociale),commessa:commesse(codice)')
        .order('created_at', { ascending: false })
        .limit(5),

      supabase.from('ddt')
        .select('id,numero,commessa_id,stato,created_at,commessa:commesse(codice)')
        .order('created_at', { ascending: false })
        .limit(5),

      supabase.from('documenti_commessa')
        .select('id,nome,categoria,commessa_id,created_at,commessa:commesse(codice)')
        .order('created_at', { ascending: false })
        .limit(5),

      supabase.from('fatture_passive')
        .select('id,numero,importo_totale,data_scadenza,commessa_id,commessa:commesse(codice,nome)')
        .not('data_scadenza', 'is', null)
        .gte('data_scadenza', todayS)
        .lte('data_scadenza', tra30S)
        .order('data_scadenza', { ascending: true }),
    ])

    /* ── Elaborazione dati ──────────────────────────────────────────── */
    const comm   = rC.data   || []
    const fpArr  = rFP.data  || []
    const dsArr  = rDS.data  || []
    const csArr  = rCS.data  || []
    const osArr  = rOS.data  || []
    const fsArr  = rFS.data  || []

    const attive = comm.filter((c: any) => c.stato !== 'CHIUSA')

    // Mappa spesa per commessa (da ODA non annullati)
    const sMap: Record<string, number> = {}
    for (const o of osArr) sMap[o.commessa_id] = (sMap[o.commessa_id] || 0) + (o.importo_netto || 0)

    // Subappaltatori con checklist incompleta (tutti e 4 i flag devono essere true)
    const subIncompl = csArr.filter(
      (c: any) => !(c.durc_ok && c.pos_approvato && c.comunicazione_sa && c.antimafia_ok)
    ).length

    // Scadenziario: merge doc sicurezza + fatture, ordinato per data
    const scadItems = [
      ...dsArr.map((d: any) => ({
        data: d.data_scadenza,
        gg: ggA(d.data_scadenza),
        label: `${d.tipo}${d.soggetto ? ` — ${d.soggetto}` : ''}`,
        tipo: d.tipo === 'DURC' ? 'DURC' : 'DOC',
        color: d.tipo === 'DURC' ? '#d97706' : '#6b7280',
        cid: d.commessa_id,
      })),
      ...fsArr.map((f: any) => ({
        data: f.data_scadenza,
        gg: ggA(f.data_scadenza),
        label: `Fattura ${f.numero || '—'} · ${fmtM(f.importo_totale || 0)}`,
        tipo: 'FATTURA',
        color: '#2563eb',
        cid: f.commessa_id,
        commessa: f.commessa,
      })),
    ].sort((a, b) => a.data.localeCompare(b.data))

    setCommesse(comm)
    setSpesaMap(sMap)
    setKpi({
      attive: attive.length,
      portafoglio: attive.reduce((s: number, c: any) => s + (c.importo_contratto || 0), 0),
      odaMese: rOM.count || 0,
      fattureCount: fpArr.length,
      fattureTot: fpArr.reduce((s: number, f: any) => s + (f.importo_totale || 0), 0),
      durc: dsArr.filter((d: any) => d.tipo === 'DURC').length,
      scaduti: rDSc.count || 0,
      subIncompl,
    })
    setScad(scadItems)
    setRec({
      oda: (rOR.data || []).map((o: any) => ({
        id: o.id, cid: o.commessa_id,
        primary: o.numero || '—',
        secondary: (o.fornitore as any)?.ragione_sociale || '—',
        meta: fmtM(o.importo_netto || 0),
        date: o.created_at,
      })),
      ddt: (rDR.data || []).map((d: any) => ({
        id: d.id, cid: d.commessa_id,
        primary: d.numero || '—',
        secondary: d.stato || '—',
        meta: (d.commessa as any)?.codice || '—',
        date: d.created_at,
      })),
      docs: (rDocR.data || []).map((d: any) => ({
        id: d.id, cid: d.commessa_id,
        primary: d.nome || '—',
        secondary: d.categoria || '—',
        meta: (d.commessa as any)?.codice || '—',
        date: d.created_at,
      })),
    })
    setLoading(false)
  }, [])

  useEffect(() => { carica() }, [carica])

  /* ── Dati derivati ──────────────────────────────────────────────── */
  const commesseAttive = commesse.filter((c: any) => c.stato !== 'CHIUSA')
  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const nav = (id: string) => router.push(`/dashboard/commesse/${id}`)

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 11, color: 'var(--t3)', margin: '3px 0 0', textTransform: 'capitalize' }}>{today}</p>
        </div>
        <button onClick={carica} disabled={loading}
          style={{ fontSize: 11, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--panel)', color: 'var(--t2)', cursor: 'pointer' }}>
          {loading ? '...' : '↻ Aggiorna'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280,
          color: 'var(--t3)', fontSize: 13 }}>
          Caricamento dashboard...
        </div>
      ) : <>

        {/* ── KPI RIGA 1 — Panoramica ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard label="Commesse attive" value={kpi.attive} color="#10b981" />
          <KpiCard label="Portafoglio totale" value={fmtM(kpi.portafoglio)} color="#3b82f6" />
          <KpiCard label="ODA questo mese" value={kpi.odaMese} color="#8b5cf6" />
          <KpiCard
            label="Fatture da pagare"
            value={kpi.fattureCount}
            sub={kpi.fattureCount > 0 ? fmtM(kpi.fattureTot) : 'Nessuna in sospeso'}
            color="#f59e0b"
            alert={kpi.fattureCount > 0}
          />
        </div>

        {/* ── KPI RIGA 2 — Alert priorità ──────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <AlertKpi
            icon="⚠️" label="DURC in scadenza ≤30gg"
            value={kpi.durc} color="#d97706"
            onClick={() => router.push('/dashboard/commesse')}
          />
          <AlertKpi
            icon="🔴" label="Documenti scaduti"
            value={kpi.scaduti} color="#dc2626"
          />
          <AlertKpi
            icon="📋" label="Subappaltatori checklist incompleta"
            value={kpi.subIncompl} color="#7c3aed"
            onClick={() => router.push('/dashboard/commesse')}
          />
        </div>

        {/* ── MAPPA CANTIERI ───────────────────────────────────────── */}
        <MapCommesse />

        {/* ── MAIN: Commesse + Scadenziario ────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>

          {/* Lista commesse attive */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Commesse attive</span>
              <button onClick={() => router.push('/dashboard/commesse')}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none',
                  border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Tutte le commesse →
              </button>
            </div>

            {commesseAttive.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                Nessuna commessa attiva.
                <br />
                <button onClick={() => router.push('/dashboard/commesse?new=true')}
                  style={{ marginTop: 12, fontSize: 12, padding: '7px 16px', borderRadius: 8,
                    border: '1px solid var(--accent)', background: 'none', color: 'var(--accent)',
                    cursor: 'pointer' }}>
                  + Nuova commessa
                </button>
              </div>
            ) : commesseAttive.map((c: any, i: number) => {
              const budget   = c.importo_contratto || 0
              const spesa    = spesaMap[c.id] || 0
              const pct      = budget > 0 ? Math.min((spesa / budget) * 100, 100) : 0
              const margine  = budget > 0 ? (budget - spesa) / budget * 100 : null
              const barCol   = pct > 90 ? '#dc2626' : pct > 70 ? '#d97706' : '#10b981'
              const col      = sc(c.stato)
              return (
                <div key={c.id} onClick={() => nav(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: i < commesseAttive.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {/* Indicatore stato */}
                  <div style={{ width: 4, height: 46, borderRadius: 2, background: col, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                        fontWeight: 700, color: 'var(--accent)' }}>{c.codice}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: col,
                        background: col + '18', borderRadius: 4, padding: '1px 6px' }}>
                        {c.stato.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', margin: '0 0 2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.nome}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--t3)', margin: '0 0 5px' }}>{c.committente}</p>
                    {/* Barra avanzamento spesa */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: barCol, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                        {pct.toFixed(0)}% speso
                      </span>
                    </div>
                  </div>
                  {/* Importo + margine */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)',
                      fontFamily: 'var(--font-mono)', margin: '0 0 2px' }}>
                      {fmtM(budget)}
                    </p>
                    {margine !== null && (
                      <p style={{ fontSize: 10, fontWeight: 700, margin: 0,
                        color: margine >= 0 ? '#10b981' : '#dc2626' }}>
                        {margine >= 0 ? '+' : ''}{margine.toFixed(1)}% margine
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--t4)', flexShrink: 0 }}>→</span>
                </div>
              )
            })}
          </div>

          {/* Scadenziario globale */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12,
            overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>📅 Scadenziario 30gg</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 420 }}>
              {scad.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                  <span style={{ display: 'block', fontSize: 28, marginBottom: 8 }}>✓</span>
                  Nessuna scadenza nei prossimi 30 giorni
                </div>
              ) : scad.map((s, i) => {
                const urgente = s.gg <= 7
                return (
                  <div key={i}
                    onClick={() => s.cid && nav(s.cid)}
                    style={{
                      display: 'flex', gap: 10, padding: '10px 14px',
                      borderBottom: '1px solid var(--border)',
                      cursor: s.cid ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e => { if (s.cid) e.currentTarget.style.background = 'var(--bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    {/* Giorni */}
                    <div style={{ width: 34, textAlign: 'center', flexShrink: 0, paddingTop: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, margin: 0,
                        color: urgente ? '#dc2626' : s.color }}>{s.gg}</p>
                      <p style={{ fontSize: 9, color: 'var(--t3)', margin: 0 }}>gg</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: s.color,
                          background: s.color + '18', padding: '1px 5px', borderRadius: 3,
                        }}>{s.tipo}</span>
                        <span style={{ fontSize: 9, color: 'var(--t3)' }}>{fmtD(s.data)}</span>
                        {urgente && <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>⚠</span>}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--t1)', margin: 0, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.label}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── ATTIVITÀ RECENTE ─────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <RecentList
            title="Ultimi ODA" icon="📋"
            items={rec.oda}
            onNav={nav}
          />
          <RecentList
            title="Ultimi DDT" icon="🚚"
            items={rec.ddt}
            onNav={nav}
          />
          <RecentList
            title="Ultimi documenti" icon="📎"
            items={rec.docs}
            onNav={nav}
          />
        </div>

      </>}
    </div>
  )
}
