'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase, getAziendaId } from '@/lib/supabase'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

/* ── Types ────────────────────────────────────────────────────────────────── */
interface SoaItem { categoria: string; classifica: string; scadenza: string }
interface Contatto {
  id: string; tipo: string
  nome?: string; cognome?: string; ragione_sociale?: string
  codice_fiscale?: string; partita_iva?: string
  pec?: string; iban?: string; regime_fiscale?: string
  telefono_ufficio?: string; telefono_mobile?: string; telefono?: string
  email?: string; website?: string
  indirizzo?: string; comune?: string; cap?: string; provincia?: string
  tipo_professione?: string
  ordine_professionale?: string; n_iscrizione_ordine?: string; numero_iscrizione?: string
  provincia_ordine?: string; data_iscrizione_ordine?: string
  polizza_rc_numero?: string; polizza_rc_scadenza?: string; polizza_rc_massimale?: number
  inarcassa_regolare?: boolean; inarcassa_scadenza?: string
  soa_categorie?: SoaItem[]; durc_scadenza?: string; durc_regolare?: boolean
  iso_certificazioni?: string[]; patente_cantieri?: boolean; patente_punteggio?: number
  studio_id?: string; specializzazioni?: string[]; specializzazione?: string
  note?: string; rating?: number; blacklist?: boolean; blacklist_motivo?: string
  attivo: boolean; created_at: string
}

/* ── Constants ────────────────────────────────────────────────────────────── */
const TIPI = [
  { v: 'professionista', l: 'Professionista', c: '#3b82f6' },
  { v: 'fornitore',      l: 'Fornitore',      c: '#10b981' },
  { v: 'subappaltatore', l: 'Subappaltatore', c: '#8b5cf6' },
  { v: 'committente',    l: 'Committente',    c: '#f59e0b' },
  { v: 'ente_pubblico',  l: 'Ente Pubblico',  c: '#ef4444' },
  { v: 'nolo',           l: 'Nolo',           c: '#06b6d4' },
  { v: 'altro',          l: 'Altro',          c: '#6b7280' },
]
const TMAP = Object.fromEntries(TIPI.map(t => [t.v, t]))
const TIPO_PRO = ['architetto','ingegnere','geometra','geologo','perito_industriale','agronomo','altro']
const ISO_LIST = ['ISO 9001','ISO 14001','ISO 45001','SA 8000']
const SOA_CAT  = ['OG1','OG2','OG3','OG4','OG6','OG8','OG11','OS3','OS6','OS12','OS18','OS19','OS21','OS28','OS30']
const SOA_CLS  = ['I','II','III','IV','V','VI','VII','VIII']
const TIPI_STANDARD = new Set(['professionista','fornitore','subappaltatore','committente','ente_pubblico','nolo','altro'])
const TIPI_TAB = ['professionista','fornitore','subappaltatore','committente','ente_pubblico']

const FILTER_TABS = [
  { v: 'tutti',          l: 'Tutti' },
  { v: 'professionista', l: 'Professionisti' },
  { v: 'fornitore',      l: 'Fornitori' },
  { v: 'subappaltatore', l: 'Subappaltatori' },
  { v: 'committente',    l: 'Committenti' },
  { v: 'ente_pubblico',  l: 'Enti Pubblici' },
  { v: 'altro',          l: 'Altro' },
]

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fNome = (c: Partial<Contatto>) =>
  c.ragione_sociale || [c.nome, c.cognome].filter(Boolean).join(' ') || '—'

const initials = (c: Partial<Contatto>) => {
  const words = fNome(c).split(' ').filter(Boolean)
  return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : fNome(c).slice(0, 2).toUpperCase()
}

const durcStatus = (s?: string): 'none' | 'ok' | 'warn' | 'expired' => {
  if (!s) return 'none'
  const diff = Math.round((new Date(s).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  return diff < 0 ? 'expired' : diff <= 30 ? 'warn' : 'ok'
}

const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('it-IT') : '—'

/* ── Avatar ───────────────────────────────────────────────────────────────── */
function Avatar({ c, size = 36 }: { c: Partial<Contatto>; size?: number }) {
  const col = (TMAP[c.tipo || ''] || { c: '#6b7280' }).c
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: col + '22', border: `2px solid ${col}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: col, flexShrink: 0 }}>
      {initials(c)}
    </div>
  )
}

/* ── DurcBadge ────────────────────────────────────────────────────────────── */
function DurcBadge({ scadenza }: { scadenza?: string }) {
  const s = durcStatus(scadenza)
  if (s === 'none') return null
  const cfg = { ok: { l: 'DURC ✓', bg: '#f0fdf4', c: '#16a34a' }, warn: { l: 'DURC ⚠', bg: '#fffbeb', c: '#d97706' }, expired: { l: 'DURC ✕', bg: '#fef2f2', c: '#dc2626' } }[s]
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: cfg.bg, color: cfg.c, border: `1px solid ${cfg.c}44`, whiteSpace: 'nowrap' }}>{cfg.l}</span>
}

/* ── Stars ────────────────────────────────────────────────────────────────── */
function Stars({ val = 0, onChange }: { val?: number; onChange: (v: number) => void }) {
  const [h, setH] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onMouseEnter={() => setH(n)} onMouseLeave={() => setH(0)}
          onClick={() => onChange(n === val ? 0 : n)}
          style={{ fontSize: 24, cursor: 'pointer', color: n <= (h || val) ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
    </div>
  )
}

/* ── TagInput ─────────────────────────────────────────────────────────────── */
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [v, setV] = useState('')
  const add = () => { const t = v.trim(); if (t && !tags.includes(t)) onChange([...tags, t]); setV('') }
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {tags.map(t => (
          <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 4 }}>
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={v} onChange={e => setV(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Aggiungi + Enter"
          style={{ flex: 1, fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--t1)' }} />
        <button onClick={add} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--t2)' }}>+</button>
      </div>
    </div>
  )
}

/* ── Toggle ───────────────────────────────────────────────────────────────── */
function Toggle({ on, onChange, color = '#10b981' }: { on: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 34, height: 19, borderRadius: 10, background: on ? color : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 1.5, left: on ? 16 : 1.5, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </div>
  )
}

/* ── SoaEditor ────────────────────────────────────────────────────────────── */
function SoaEditor({ items, onChange }: { items: SoaItem[]; onChange: (i: SoaItem[]) => void }) {
  const add = () => onChange([...items, { categoria: 'OG1', classifica: 'I', scadenza: '' }])
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))
  const upd = (i: number, k: keyof SoaItem, v: string) => onChange(items.map((it, j) => j === i ? { ...it, [k]: v } : it))
  const si: React.CSSProperties = { fontSize: 11, padding: '4px 6px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--t1)' }
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <select value={it.categoria} onChange={e => upd(i, 'categoria', e.target.value)} style={{ ...si, flex: 1 }}>
            {SOA_CAT.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={it.classifica} onChange={e => upd(i, 'classifica', e.target.value)} style={{ ...si, width: 54 }}>
            {SOA_CLS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={it.scadenza} onChange={e => upd(i, 'scadenza', e.target.value)} style={{ ...si, flex: 1 }} />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px dashed var(--accent)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: '100%', marginTop: 2 }}>+ Aggiungi categoria SOA</button>
    </div>
  )
}

/* ── Detail Drawer ────────────────────────────────────────────────────────── */
function DetailDrawer({ c, allContatti, onClose, onEdit, onDelete }: {
  c: Contatto; allContatti: Contatto[]
  onClose: () => void; onEdit: (c: Contatto) => void; onDelete: (c: Contatto) => void
}) {
  type DTab = 'anagrafica' | 'professione' | 'qualificazioni' | 'commesse' | 'note'
  const [tab, setTab] = useState<DTab>('anagrafica')
  const [commesse, setCommesse] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(c.note || '')
  const [rating, setRating] = useState(c.rating || 0)
  const [bl, setBl] = useState(!!c.blacklist)
  const [blMotivo, setBlMotivo] = useState(c.blacklist_motivo || '')

  const col = (TMAP[c.tipo] || { c: '#6b7280' }).c
  const lbl = (c.tipo) || ''

  useEffect(() => {
    if (tab !== 'commesse') return
    ;(supabase as any).from('commessa_figure')
      .select('ruolo, commesse(id, codice, nome, data_aggiudicazione)')
      .eq('professionista_id', c.id)
      .then(({ data }: any) => setCommesse(data || []))
  }, [tab, c.id])

  const saveNote = async () => {
    setSaving(true)
    await (supabase as any).from('professionisti_fornitori')
      .update({ note, rating, blacklist: bl, blacklist_motivo: blMotivo }).eq('id', c.id)
    setSaving(false)
  }

  const inp: React.CSSProperties = { fontSize: 12, padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t1)', width: '100%', boxSizing: 'border-box' as const }
  const lbs: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 3 }
  const fld = (label: string, value: string | undefined | null, href?: string) => value ? (
    <div style={{ marginBottom: 10 }}>
      <span style={lbs}>{label}</span>
      {href ? <a href={href} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>{value}</a>
             : <span style={{ fontSize: 13, color: 'var(--t1)' }}>{value}</span>}
    </div>
  ) : null

  const TABS = [
    { id: 'anagrafica',     l: 'Anagrafica' },
    { id: 'professione',    l: 'Professione',    hide: c.tipo !== 'professionista' },
    { id: 'qualificazioni', l: 'Qualificazioni', hide: !['fornitore','subappaltatore'].includes(c.tipo) },
    { id: 'commesse',       l: 'Commesse' },
    { id: 'note',           l: 'Note' },
  ]

  const studio = c.studio_id ? allContatti.find(x => x.id === c.studio_id) : null
  const collaboratori = allContatti.filter(x => x.studio_id === c.id)

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: 'var(--panel)', borderLeft: '1px solid var(--border)', zIndex: 200, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.15)' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar c={c} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fNome(c)}</div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: col + '22', color: col }}>{TMAP[c.tipo]?.l || lbl}</span>
            {c.provincia && <span style={{ fontSize: 10, color: 'var(--t3)' }}>📍 {c.provincia}</span>}
            <DurcBadge scadenza={c.durc_scadenza} />
            {c.blacklist && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>🚫 BL</span>}
            {!!c.rating && c.rating > 0 && <span style={{ fontSize: 10, color: '#f59e0b' }}>{'★'.repeat(Math.round(c.rating))}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)', flexShrink: 0 }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', overflowX: 'auto' }}>
        {TABS.filter(t => !t.hide).map(t => (
          <button key={t.id} onClick={() => setTab(t.id as DTab)}
            style={{ flexShrink: 0, padding: '9px 14px', fontSize: 11, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? 'var(--accent)' : 'var(--t3)', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* TAB: Anagrafica */}
        {tab === 'anagrafica' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fld('Codice Fiscale', c.codice_fiscale)}
              {fld('Partita IVA', c.partita_iva)}
            </div>
            {fld('PEC', c.pec, c.pec ? 'mailto:' + c.pec : undefined)}
            {fld('Email', c.email, c.email ? 'mailto:' + c.email : undefined)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fld('Tel. ufficio', c.telefono_ufficio || c.telefono, (c.telefono_ufficio || c.telefono) ? 'tel:' + (c.telefono_ufficio || c.telefono) : undefined)}
              {fld('Mobile', c.telefono_mobile, c.telefono_mobile ? 'tel:' + c.telefono_mobile : undefined)}
            </div>
            {fld('IBAN', c.iban)}
            {fld('Regime fiscale', c.regime_fiscale)}
            {fld('Website', c.website, c.website)}
            {fld('Indirizzo', c.indirizzo)}
            {(c.comune || c.provincia) && fld('Comune', [c.comune, c.cap, c.provincia].filter(Boolean).join(' '))}
            {studio && (
              <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={lbs}>Studio associato</span>
                <span style={{ fontSize: 13, color: 'var(--accent)' }}>{fNome(studio)}</span>
              </div>
            )}
            {collaboratori.length > 0 && (
              <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={lbs}>Collaboratori ({collaboratori.length})</span>
                {collaboratori.map(x => <div key={x.id} style={{ fontSize: 12, color: 'var(--t1)', marginTop: 4 }}>{fNome(x)}</div>)}
              </div>
            )}
          </>
        )}

        {/* TAB: Professione */}
        {tab === 'professione' && (
          <>
            {fld('Tipo professione', c.tipo_professione)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fld('Ordine', c.ordine_professionale)}
              {fld('N° iscrizione', c.n_iscrizione_ordine || c.numero_iscrizione)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fld('Prov. ordine', c.provincia_ordine)}
              {fld('Data iscrizione', fmtDate(c.data_iscrizione_ordine))}
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', marginBottom: 8 }}>Polizza RC</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fld('N° polizza', c.polizza_rc_numero)}
              {fld('Scadenza', fmtDate(c.polizza_rc_scadenza))}
            </div>
            {c.polizza_rc_massimale && fld('Massimale', '€ ' + c.polizza_rc_massimale.toLocaleString('it-IT'))}
            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', marginBottom: 8 }}>Inarcassa</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ marginBottom: 10 }}>
                <span style={lbs}>Posizione</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.inarcassa_regolare ? '#16a34a' : '#dc2626' }}>
                  {c.inarcassa_regolare !== undefined ? (c.inarcassa_regolare ? '✓ Regolare' : '✕ Non regolare') : '—'}
                </span>
              </div>
              {fld('Scadenza verifica', fmtDate(c.inarcassa_scadenza))}
            </div>
          </>
        )}

        {/* TAB: Qualificazioni */}
        {tab === 'qualificazioni' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <span style={{ ...lbs, marginBottom: 8 }}>Categorie SOA</span>
              {!(c.soa_categorie?.length) ? (
                <p style={{ fontSize: 12, color: 'var(--t3)' }}>Nessuna categoria SOA</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {c.soa_categorie!.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 38 }}>{s.categoria}</span>
                      <span style={{ fontSize: 10, color: 'var(--t2)', background: '#dbeafe', borderRadius: 4, padding: '1px 6px' }}>Class. {s.classifica}</span>
                      <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 'auto' }}>{fmtDate(s.scadenza)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <div style={{ marginBottom: 12 }}>
              <span style={lbs}>DURC</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.durc_regolare ? '#16a34a' : '#dc2626' }}>
                  {c.durc_regolare !== undefined ? (c.durc_regolare ? '✓ Regolare' : '✕ Non regolare') : '—'}
                </span>
                {c.durc_scadenza && <span style={{ fontSize: 12, color: 'var(--t2)' }}>scad. {fmtDate(c.durc_scadenza)}</span>}
                <DurcBadge scadenza={c.durc_scadenza} />
              </div>
            </div>
            {!!(c.iso_certificazioni?.length) && (
              <div style={{ marginBottom: 12 }}>
                <span style={lbs}>Certificazioni ISO</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {c.iso_certificazioni!.map(iso => (
                    <span key={iso} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>{iso}</span>
                  ))}
                </div>
              </div>
            )}
            {c.patente_cantieri && (
              <div style={{ marginBottom: 12 }}>
                <span style={lbs}>Patente a crediti</span>
                <span style={{ fontSize: 13, color: 'var(--t1)' }}>Attiva — {c.patente_punteggio ?? 'n/d'} crediti</span>
              </div>
            )}
            {!!(c.specializzazioni?.length) && (
              <div>
                <span style={lbs}>Specializzazioni</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {c.specializzazioni!.map(s => (
                    <span key={s} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB: Commesse */}
        {tab === 'commesse' && (
          commesse.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              Nessuna commessa associata
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {commesse.map((cf: any, i) => {
                const cm = cf.commesse || {}
                return (
                  <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{cm.codice}</span>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'var(--border)', color: 'var(--t2)', fontWeight: 600 }}>{cf.ruolo}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{cm.nome}</div>
                    {cm.data_aggiudicazione && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{new Date(cm.data_aggiudicazione).getFullYear()}</div>}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* TAB: Note */}
        {tab === 'note' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <span style={lbs}>Rating</span>
              <Stars val={rating} onChange={setRating} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: bl ? 10 : 0 }}>
                <span style={lbs}>Blacklist</span>
                <Toggle on={bl} onChange={setBl} color="#ef4444" />
              </div>
              {bl && (
                <input value={blMotivo} onChange={e => setBlMotivo(e.target.value)}
                  placeholder="Motivo blacklist..."
                  style={{ ...inp, marginTop: 6 }} />
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={lbs}>Note libere</span>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={6}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Appunti, condizioni, osservazioni..." />
            </div>
            <button onClick={saveNote} disabled={saving}
              style={{ width: '100%', padding: '9px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {saving ? 'Salvando...' : '💾 Salva note'}
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button onClick={() => onEdit(c)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 12 }}>✎ Modifica</button>
        <button onClick={() => onDelete(c)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #ef4444', color: '#ef4444', background: 'none', cursor: 'pointer', fontSize: 12 }}>✕ Elimina</button>
      </div>
    </div>
  )
}

/* ── Form Modal ───────────────────────────────────────────────────────────── */
function FormModal({ initial, allContatti, onSave, onClose }: {
  initial: Partial<Contatto>; allContatti: Contatto[]
  onSave: (c: Partial<Contatto>) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Contatto>>(initial)
  const [saving, setSaving] = useState(false)
  const [fTab, setFTab] = useState<'base' | 'professione' | 'qualificazioni'>('base')

  const set = (k: keyof Contatto, v: any) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, background: 'var(--panel)', color: 'var(--t1)', boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 4 }
  const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }
  const g3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }

  const isPro = form.tipo === 'professionista'
  const isSub = ['fornitore','subappaltatore'].includes(form.tipo || '')
  const soa: SoaItem[] = (form.soa_categorie as SoaItem[]) || []
  const isoChecked: string[] = form.iso_certificazioni || []
  const spec: string[] = form.specializzazioni || []

  async function handleSave() {
    if (!form.tipo || !fNome(form)) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const FTABS = [
    { id: 'base', l: 'Base' },
    { id: 'professione', l: 'Professione', hide: !isPro },
    { id: 'qualificazioni', l: 'Qualificazioni', hide: !isSub },
  ]

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 580, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{form.id ? 'Modifica' : 'Nuovo'} contatto</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
          {FTABS.filter(t => !t.hide).map(t => (
            <button key={t.id} onClick={() => setFTab(t.id as any)}
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: fTab === t.id ? 700 : 400, color: fTab === t.id ? 'var(--accent)' : 'var(--t3)', background: 'none', border: 'none', borderBottom: fTab === t.id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }}>
              {t.l}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>

          {fTab === 'base' && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Tipo *</label>
                <select style={inp} value={form.tipo || 'professionista'} onChange={e => set('tipo', e.target.value)}>
                  {TIPI.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              {isPro ? (
                <div style={g2}>
                  <div><label style={lbl}>Nome *</label><input style={inp} value={form.nome || ''} onChange={e => set('nome', e.target.value)} /></div>
                  <div><label style={lbl}>Cognome *</label><input style={inp} value={form.cognome || ''} onChange={e => set('cognome', e.target.value)} /></div>
                </div>
              ) : (
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Ragione Sociale *</label>
                  <input style={inp} value={form.ragione_sociale || ''} onChange={e => set('ragione_sociale', e.target.value)} />
                </div>
              )}
              <div style={g2}>
                <div><label style={lbl}>Codice Fiscale</label><input style={inp} value={form.codice_fiscale || ''} onChange={e => set('codice_fiscale', e.target.value.toUpperCase())} /></div>
                <div><label style={lbl}>Partita IVA</label><input style={inp} value={form.partita_iva || ''} onChange={e => set('partita_iva', e.target.value)} /></div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>PEC</label><input type="email" style={inp} value={form.pec || ''} onChange={e => set('pec', e.target.value)} /></div>
                <div><label style={lbl}>Email</label><input type="email" style={inp} value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>Tel. ufficio</label><input style={inp} value={form.telefono_ufficio || form.telefono || ''} onChange={e => set('telefono_ufficio', e.target.value)} /></div>
                <div><label style={lbl}>Mobile</label><input style={inp} value={form.telefono_mobile || ''} onChange={e => set('telefono_mobile', e.target.value)} /></div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>IBAN</label><input style={inp} value={form.iban || ''} onChange={e => set('iban', e.target.value)} /></div>
                <div>
                  <label style={lbl}>Regime fiscale</label>
                  <select style={inp} value={form.regime_fiscale || ''} onChange={e => set('regime_fiscale', e.target.value)}>
                    <option value="">—</option>
                    {['ordinario','forfettario','minimi','pa'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Indirizzo</label>
                <AddressAutocomplete
                  value={form.indirizzo || ''}
                  onChange={v => set('indirizzo', v)}
                  onSelect={p => setForm(f => ({ ...f, indirizzo: p.indirizzo, comune: p.comune, cap: p.cap, provincia: p.provincia }))}
                  placeholder="Via Roma 1, 80100 Napoli NA"
                  inputStyle={{ ...inp, marginBottom: 0 }}
                />
              </div>
              <div style={g3}>
                <div><label style={lbl}>Comune</label><input style={inp} value={form.comune || ''} onChange={e => set('comune', e.target.value)} /></div>
                <div><label style={lbl}>CAP</label><input style={inp} maxLength={5} value={form.cap || ''} onChange={e => set('cap', e.target.value)} /></div>
                <div><label style={lbl}>Prov.</label><input style={inp} maxLength={2} value={form.provincia || ''} onChange={e => set('provincia', e.target.value.toUpperCase())} /></div>
              </div>
              {isPro && (
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Studio associato</label>
                  <select style={inp} value={form.studio_id || ''} onChange={e => set('studio_id', e.target.value || undefined)}>
                    <option value="">— Nessuno</option>
                    {allContatti.filter(x => x.tipo === 'professionista' && x.id !== form.id).map(x => (
                      <option key={x.id} value={x.id}>{fNome(x)}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {fTab === 'professione' && isPro && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Tipo professione</label>
                <select style={inp} value={form.tipo_professione || ''} onChange={e => set('tipo_professione', e.target.value)}>
                  <option value="">—</option>
                  {TIPO_PRO.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={g2}>
                <div><label style={lbl}>Ordine professionale</label><input style={inp} value={form.ordine_professionale || ''} onChange={e => set('ordine_professionale', e.target.value)} /></div>
                <div><label style={lbl}>N° iscrizione</label><input style={inp} value={form.n_iscrizione_ordine || form.numero_iscrizione || ''} onChange={e => set('n_iscrizione_ordine', e.target.value)} /></div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>Prov. ordine</label><input style={inp} maxLength={2} value={form.provincia_ordine || ''} onChange={e => set('provincia_ordine', e.target.value.toUpperCase())} /></div>
                <div><label style={lbl}>Data iscrizione</label><input type="date" style={inp} value={form.data_iscrizione_ordine || ''} onChange={e => set('data_iscrizione_ordine', e.target.value)} /></div>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', marginBottom: 8 }}>Polizza RC</div>
              <div style={g2}>
                <div><label style={lbl}>N° polizza</label><input style={inp} value={form.polizza_rc_numero || ''} onChange={e => set('polizza_rc_numero', e.target.value)} /></div>
                <div><label style={lbl}>Scadenza</label><input type="date" style={inp} value={form.polizza_rc_scadenza || ''} onChange={e => set('polizza_rc_scadenza', e.target.value)} /></div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Massimale (€)</label>
                <input type="number" style={inp} value={form.polizza_rc_massimale || ''} onChange={e => set('polizza_rc_massimale', parseFloat(e.target.value) || undefined)} />
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', marginBottom: 8 }}>Inarcassa</div>
              <div style={g2}>
                <div>
                  <label style={lbl}>Posizione regolare</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <Toggle on={!!form.inarcassa_regolare} onChange={v => set('inarcassa_regolare', v)} />
                    <span style={{ fontSize: 12, color: form.inarcassa_regolare ? '#16a34a' : '#dc2626' }}>{form.inarcassa_regolare ? 'Regolare' : 'Non regolare'}</span>
                  </div>
                </div>
                <div><label style={lbl}>Scadenza verifica</label><input type="date" style={inp} value={form.inarcassa_scadenza || ''} onChange={e => set('inarcassa_scadenza', e.target.value)} /></div>
              </div>
            </>
          )}

          {fTab === 'qualificazioni' && isSub && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ ...lbl, marginBottom: 8 }}>Categorie SOA</label>
                <SoaEditor items={soa} onChange={v => set('soa_categorie', v)} />
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
              <div style={g2}>
                <div>
                  <label style={lbl}>DURC regolare</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <Toggle on={!!form.durc_regolare} onChange={v => set('durc_regolare', v)} />
                    <span style={{ fontSize: 12, color: form.durc_regolare ? '#16a34a' : '#dc2626' }}>{form.durc_regolare ? 'Regolare' : 'Non regolare'}</span>
                  </div>
                </div>
                <div><label style={lbl}>Scadenza DURC</label><input type="date" style={inp} value={form.durc_scadenza || ''} onChange={e => set('durc_scadenza', e.target.value)} /></div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Certificazioni ISO</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                  {ISO_LIST.map(iso => (
                    <label key={iso} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={isoChecked.includes(iso)}
                        onChange={e => set('iso_certificazioni', e.target.checked ? [...isoChecked, iso] : isoChecked.filter(x => x !== iso))} />
                      {iso}
                    </label>
                  ))}
                </div>
              </div>
              <div style={g2}>
                <div>
                  <label style={lbl}>Patente cantieri</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <Toggle on={!!form.patente_cantieri} onChange={v => set('patente_cantieri', v)} />
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>{form.patente_cantieri ? 'Attiva' : 'Non attiva'}</span>
                  </div>
                </div>
                {form.patente_cantieri && (
                  <div><label style={lbl}>Punteggio crediti</label><input type="number" style={inp} value={form.patente_punteggio || ''} onChange={e => set('patente_punteggio', parseInt(e.target.value) || undefined)} /></div>
                )}
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Specializzazioni</label>
                <TagInput tags={spec} onChange={v => set('specializzazioni', v)} />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 12 }}>Annulla</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: '8px 20px' }}>{saving ? '...' : 'Salva'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function ContattiPage() {
  const [lista, setLista] = useState<Contatto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('tutti')
  const [detail, setDetail] = useState<Contatto | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState<Partial<Contatto>>({})
  const [confirmDel, setConfirmDel] = useState<Contatto | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    const azId = await getAziendaId()
    if (!azId) return
    setLoading(true)
    const { data } = await (supabase as any)
      .from('professionisti_fornitori')
      .select('*')
      .eq('azienda_id', azId)
      .order('nome')
    setLista(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { carica() }, [carica])

  const salva = async (form: Partial<Contatto>) => {
    if (form.id) {
      await (supabase as any).from('professionisti_fornitori').update(form).eq('id', form.id)
      showToast('Contatto aggiornato')
      if (detail?.id === form.id) setDetail({ ...detail, ...form } as Contatto)
    } else {
      const azId = await getAziendaId()
      const payload = { ...form, azienda_id: azId, attivo: true }
      const { error } = await (supabase as any).from('professionisti_fornitori').insert(payload)
      if (error) { showToast('⚠ Errore: ' + error.message); return }
      showToast('Contatto aggiunto')
    }
    await carica()
    setShowForm(false)
  }

  const confermaElimina = async () => {
    if (!confirmDel) return
    const { error } = await (supabase as any).from('professionisti_fornitori').delete().eq('id', confirmDel.id)
    if (error?.code === '23503') {
      showToast('Impossibile: contatto assegnato a una commessa')
    } else {
      if (detail?.id === confirmDel.id) setDetail(null)
      showToast('Eliminato')
      carica()
    }
    setConfirmDel(null)
  }

  const isAltro = (c: Contatto) => !c.tipo || c.tipo === 'altro' || !TIPI_TAB.includes(c.tipo)

  const filtrati = lista.filter(c => {
    if (filtroTipo === 'altro' && !isAltro(c)) return false
    if (filtroTipo !== 'tutti' && filtroTipo !== 'altro' && c.tipo !== filtroTipo) return false
    if (search) {
      const q = search.toLowerCase()
      return fNome(c).toLowerCase().includes(q)
        || (c.partita_iva || '').toLowerCase().includes(q)
        || (c.email || '').toLowerCase().includes(q)
        || (c.pec || '').toLowerCase().includes(q)
        || (c.comune || '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} className="fade-in">

      {/* Header */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Database Contatti</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{lista.length} contatti registrati</p>
        </div>
        <button className="btn-primary" style={{ fontSize: 12, padding: '8px 14px' }}
          onClick={() => { setEditData({ tipo: 'professionista', attivo: true }); setShowForm(true) }}>
          + Nuovo contatto
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(t => {
          const cnt = t.v === 'tutti' ? lista.length : t.v === 'altro' ? lista.filter(isAltro).length : lista.filter(c => c.tipo === t.v).length
          const col = t.v === 'tutti' ? '#3b82f6' : (TMAP[t.v]?.c || '#6b7280')
          const active = filtroTipo === t.v
          return (
            <button key={t.v} onClick={() => setFiltroTipo(t.v)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? col : col + '55'}`, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: active ? col : 'var(--panel)', color: active ? '#fff' : 'var(--t2)' }}>
              {t.l} <span style={{ fontWeight: 400, opacity: 0.7 }}>({cnt})</span>
            </button>
          )
        })}
      </div>

      {/* Search + List */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Cerca nome, P.IVA, email, comune..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg)', color: 'var(--t1)', boxSizing: 'border-box' }} />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
        ) : filtrati.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Nessun risultato</div>
        ) : filtrati.map((c, i) => {
          const col = (TMAP[c.tipo] || { c: '#6b7280' }).c
          const active = detail?.id === c.id
          return (
            <div key={c.id} onClick={() => setDetail(active ? null : c)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < filtrati.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: active ? col + '0d' : 'transparent', transition: 'background .1s' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = col + '08' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
              <Avatar c={c} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{fNome(c)}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: col + '22', color: col }}>{TMAP[c.tipo]?.l || c.tipo}</span>
                  <DurcBadge scadenza={c.durc_scadenza} />
                  {c.blacklist && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>🚫 BL</span>}
                  {!!c.rating && c.rating > 0 && <span style={{ fontSize: 10, color: '#f59e0b' }}>{'★'.repeat(Math.round(c.rating))}</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(c.pec || c.email) && <span style={{ fontSize: 11, color: 'var(--t3)' }}>{c.pec || c.email}</span>}
                  {(c.telefono_ufficio || c.telefono) && <span style={{ fontSize: 11, color: 'var(--t3)' }}>{c.telefono_ufficio || c.telefono}</span>}
                  {c.provincia && <span style={{ fontSize: 11, color: 'var(--t3)' }}>📍 {c.comune ? `${c.comune} (${c.provincia})` : c.provincia}</span>}
                </div>
              </div>
              <span style={{ fontSize: 14, color: 'var(--t4)', flexShrink: 0 }}>›</span>
            </div>
          )
        })}
      </div>

      {/* Detail drawer */}
      {detail && (
        <DetailDrawer
          c={detail} allContatti={lista}
          onClose={() => setDetail(null)}
          onEdit={c => { setEditData(c); setShowForm(true); setDetail(null) }}
          onDelete={c => { setConfirmDel(c); setDetail(null) }}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <FormModal
          initial={editData} allContatti={lista}
          onSave={salva}
          onClose={() => { setShowForm(false); setEditData({}) }}
        />
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal-box" style={{ maxWidth: 400, width: '92%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚠️</div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Elimina contatto</h3>
                <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>Operazione irreversibile</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>Eliminare <strong>{fNome(confirmDel)}</strong>?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDel(null)} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--panel)', cursor: 'pointer', fontSize: 12 }}>Annulla</button>
              <button onClick={confermaElimina} style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Elimina</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#14532d', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, zIndex: 1000 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
