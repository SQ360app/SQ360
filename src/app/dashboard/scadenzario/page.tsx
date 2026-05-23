'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getAziendaId } from '@/lib/supabase'

interface ScadenzaContatto {
  id: string
  nome: string
  tipo: string
  tipo_scadenza: string
  data_scadenza: string
  giorni: number
}

function oggi() {
  return new Date().toISOString().slice(0, 10)
}
function fra30() {
  const d = new Date(); d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' })
}
function giorni(s: string) {
  return Math.round((new Date(s).getTime() - Date.now()) / 86400000)
}
function badgeColor(g: number) {
  if (g < 0) return '#ef4444'
  if (g <= 7)  return '#ef4444'
  if (g <= 15) return '#f59e0b'
  return '#eab308'
}
function nomeContatto(c: any): string {
  if (c.ragione_sociale) return c.ragione_sociale
  const parts = [c.nome, c.cognome].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

const CSS = `
.scad-wrap { padding: 24px; max-width: 900px; }
.scad-title { font-size: 22px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
.scad-sub   { font-size: 13px; color: #64748b; margin-bottom: 24px; }
.scad-section { margin-bottom: 32px; }
.scad-sh { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.scad-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #0c1020; border: 1px solid #1e293b; border-radius: 8px; margin-bottom: 8px; }
.scad-row:hover { border-color: #334155; }
.scad-nome { flex: 1; font-size: 14px; color: #e2e8f0; font-weight: 500; }
.scad-tipo-badge { font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; white-space: nowrap; }
.scad-tipo-scad { font-size: 12px; color: #94a3b8; white-space: nowrap; }
.scad-data { font-size: 13px; color: #cbd5e1; white-space: nowrap; }
.scad-gg { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 12px; color: #fff; white-space: nowrap; }
.scad-link { font-size: 12px; color: #4f8ef7; text-decoration: none; white-space: nowrap; }
.scad-link:hover { text-decoration: underline; }
.scad-empty { padding: 16px; font-size: 13px; color: #475569; background: #0c1020; border: 1px solid #1e293b; border-radius: 8px; }
.scad-count { font-size: 11px; background: #1e293b; color: #94a3b8; border-radius: 10px; padding: 1px 8px; font-weight: 600; }
`

export default function ScadenziarioPage() {
  const [items, setItems] = useState<ScadenzaContatto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const aziendaId = await getAziendaId()
    if (!aziendaId) { setLoading(false); return }

    const today = oggi()
    const in30  = fra30()

    const { data } = await (supabase as any)
      .from('professionisti_fornitori')
      .select('id, nome, cognome, ragione_sociale, tipo, durc_scadenza, polizza_rc_scadenza, inarcassa_scadenza')
      .eq('azienda_id', aziendaId)
      .or(
        `durc_scadenza.lte.${in30},polizza_rc_scadenza.lte.${in30},inarcassa_scadenza.lte.${in30}`
      )

    const rows: ScadenzaContatto[] = []
    for (const c of data || []) {
      const nome = nomeContatto(c)
      const tipo = c.tipo || 'altro'
      if (c.durc_scadenza && c.durc_scadenza <= in30) {
        rows.push({ id: c.id, nome, tipo, tipo_scadenza: 'DURC', data_scadenza: c.durc_scadenza, giorni: giorni(c.durc_scadenza) })
      }
      if (c.polizza_rc_scadenza && c.polizza_rc_scadenza <= in30) {
        rows.push({ id: c.id, nome, tipo, tipo_scadenza: 'Polizza RC', data_scadenza: c.polizza_rc_scadenza, giorni: giorni(c.polizza_rc_scadenza) })
      }
      if (c.inarcassa_scadenza && c.inarcassa_scadenza <= in30) {
        rows.push({ id: c.id, nome, tipo, tipo_scadenza: 'Inarcassa', data_scadenza: c.inarcassa_scadenza, giorni: giorni(c.inarcassa_scadenza) })
      }
    }

    rows.sort((a, b) => a.giorni - b.giorni)
    setItems(rows)
    setLoading(false)
  }

  const TIPO_COLORS: Record<string, string> = {
    professionista: '#3b82f6', fornitore: '#10b981', subappaltatore: '#8b5cf6',
    committente: '#f59e0b', ente_pubblico: '#ef4444', nolo: '#06b6d4', altro: '#6b7280',
  }
  const TIPO_LABELS: Record<string, string> = {
    professionista: 'Professionista', fornitore: 'Fornitore', subappaltatore: 'Subappaltatore',
    committente: 'Committente', ente_pubblico: 'Ente Pubblico', nolo: 'Nolo', altro: 'Altro',
  }

  const durc    = items.filter(i => i.tipo_scadenza === 'DURC')
  const polizza = items.filter(i => i.tipo_scadenza === 'Polizza RC')
  const inarc   = items.filter(i => i.tipo_scadenza === 'Inarcassa')

  function renderRows(rows: ScadenzaContatto[]) {
    if (!rows.length) return <div className="scad-empty">Nessuna scadenza nei prossimi 30 giorni</div>
    return rows.map((r, i) => (
      <div key={i} className="scad-row">
        <div className="scad-nome">{r.nome}</div>
        <span
          className="scad-tipo-badge"
          style={{ background: (TIPO_COLORS[r.tipo] || '#6b7280') + '22', color: TIPO_COLORS[r.tipo] || '#6b7280' }}
        >
          {TIPO_LABELS[r.tipo] || r.tipo}
        </span>
        <span className="scad-data">{fmtDate(r.data_scadenza)}</span>
        <span className="scad-gg" style={{ background: badgeColor(r.giorni) }}>
          {r.giorni < 0 ? `Scaduto ${Math.abs(r.giorni)}gg fa` : `${r.giorni}gg`}
        </span>
        <a href={`/dashboard/fornitori?id=${r.id}`} className="scad-link">→ Scheda</a>
      </div>
    ))
  }

  return (
    <div>
      <style>{CSS}</style>
      <div className="header">
        <div>
          <div className="header-bread">SQ360</div>
          <div className="header-title">Scadenziario Contatti</div>
        </div>
      </div>
      <div className="content fade-in">
        <div className="scad-wrap">
          <div className="scad-title">Scadenze nei prossimi 30 giorni</div>
          <div className="scad-sub">DURC · Polizza RC · Inarcassa — aggiornato in tempo reale</div>

          {loading ? (
            <div style={{ color: '#64748b', fontSize: 14 }}>Caricamento...</div>
          ) : (
            <>
              <div className="scad-section">
                <div className="scad-sh">
                  📋 DURC
                  <span className="scad-count">{durc.length}</span>
                </div>
                {renderRows(durc)}
              </div>

              <div className="scad-section">
                <div className="scad-sh">
                  🛡️ Polizza RC
                  <span className="scad-count">{polizza.length}</span>
                </div>
                {renderRows(polizza)}
              </div>

              <div className="scad-section">
                <div className="scad-sh">
                  🏛️ Inarcassa
                  <span className="scad-count">{inarc.length}</span>
                </div>
                {renderRows(inarc)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
