'use client'

import React, { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getAziendaId } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi ────────────────────────────────────────────────────────────────────

type TipoRapporto = 'dipendente' | 'subappaltatore' | 'autonomo' | 'nolo_caldo'
const TIPI_RAPPORTO: { value: TipoRapporto; label: string; color: string }[] = [
  { value: 'dipendente',    label: 'Dipendente',       color: '#2563eb' },
  { value: 'subappaltatore',label: 'Subappaltatore',   color: '#7c3aed' },
  { value: 'autonomo',      label: 'Lav. autonomo',    color: '#d97706' },
  { value: 'nolo_caldo',    label: 'Nolo a caldo',     color: '#059669' },
]

interface Lavoratore {
  id: string; commessa_id: string; azienda_id?: string
  nome: string; cognome: string; foto_url?: string
  tipo_rapporto: TipoRapporto; azienda_appartenenza?: string; mansione?: string
  qr_token: string
  durc_scadenza?: string; formazione_scadenza?: string
  patente_crediti_punti?: number; attivo: boolean; created_at: string
}

interface Presenza {
  id: string; lavoratore_id: string; commessa_id: string
  data: string; ora_entrata?: string; ora_uscita?: string
  ore_lavorate?: number; tipo: string; note?: string
}

// ─── Helpers stato documenti ──────────────────────────────────────────────────

function docStatus(date?: string | null): 'ok' | 'warning' | 'expired' | 'missing' {
  if (!date) return 'missing'
  const d = new Date(date); d.setHours(0,0,0,0)
  const oggi = new Date(); oggi.setHours(0,0,0,0)
  const tra30 = new Date(oggi); tra30.setDate(oggi.getDate() + 30)
  if (d < oggi) return 'expired'
  if (d <= tra30) return 'warning'
  return 'ok'
}

function patenteStatus(punti?: number | null): 'ok' | 'warning' | 'alert' | 'missing' {
  if (punti === null || punti === undefined) return 'missing'
  if (punti < 15) return 'alert'
  if (punti < 25) return 'warning'
  return 'ok'
}

function hasIrregolarita(l: Lavoratore): boolean {
  return docStatus(l.durc_scadenza) === 'expired' ||
    docStatus(l.formazione_scadenza) === 'expired' ||
    patenteStatus(l.patente_crediti_punti) === 'alert'
}

function hasWarning(l: Lavoratore): boolean {
  return docStatus(l.durc_scadenza) === 'warning' ||
    docStatus(l.formazione_scadenza) === 'warning' ||
    patenteStatus(l.patente_crediti_punti) === 'warning'
}

const STATUS_ICON: Record<string, string> = {
  ok: '✓', warning: '!', expired: '✕', missing: '—', alert: '✕'
}
const STATUS_COLOR: Record<string, string> = {
  ok: '#16a34a', warning: '#d97706', expired: '#dc2626', missing: '#94a3b8', alert: '#dc2626'
}

const fmtData = (s?: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—'
const oggi = new Date().toISOString().split('T')[0]

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100%', background: 'var(--bg)', padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12 },
  card: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  inp:  { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, outline: 'none', background: 'var(--panel)', color: 'var(--t1)' },
  lbl:  { fontSize: 11, fontWeight: 600 as const, color: 'var(--t2)', marginBottom: 4, display: 'block' },
  btn:  (c: string): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: c, color: '#fff' }),
  th:   { padding: '8px 12px', fontSize: 10, fontWeight: 700 as const, color: 'var(--t3)', textTransform: 'uppercase' as const, background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, whiteSpace: 'nowrap' as const },
  td:   { padding: '10px 12px', fontSize: 12, color: 'var(--t2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' as const },
}

// ─── Componente QR Code ───────────────────────────────────────────────────────

function QRModal({ lavoratore, onClose }: { lavoratore: Lavoratore; onClose: () => void }) {
  const scanUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/scan/${lavoratore.qr_token}`
    : ''
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=png&data=${encodeURIComponent(scanUrl)}`

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 360, width: '94%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>QR Badge — {lavoratore.nome} {lavoratore.cognome}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid var(--border)', marginBottom: 12 }}>
          <img src={qrImgUrl} alt="QR Code" style={{ width: 240, height: 240, display: 'block', margin: '0 auto' }} />
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, wordBreak: 'break-all' }}>{scanUrl}</p>
        </div>
        <p style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
          Il capocantiere scansiona questo QR con il telefono per verificare lo stato documentale e registrare la presenza.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <a href={qrImgUrl} download={`badge-${lavoratore.cognome}.png`}
            style={{ ...s.btn('#2563eb'), textDecoration: 'none', display: 'inline-block' }}>
            ⬇ Scarica QR
          </a>
          <a href={scanUrl} target="_blank" rel="noreferrer"
            style={{ ...s.btn('#059669'), textDecoration: 'none', display: 'inline-block' }}>
            📱 Apri pagina
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function PersonePage({ params: p }: { params: Promise<{ id: string }> }) {
  const { id } = use(p)
  const [tab, setTab] = useState<'anagrafica' | 'presenze' | 'dashboard'>('anagrafica')
  const [lavoratori, setLavoratori] = useState<Lavoratore[]>([])
  const [presenze, setPresenze] = useState<Presenza[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editLav, setEditLav] = useState<Partial<Lavoratore> | null>(null)
  const [qrModal, setQrModal] = useState<Lavoratore | null>(null)
  const [dataPresenze, setDataPresenze] = useState(oggi)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [formPresenza, setFormPresenza] = useState<{ lavoratoreId: string; ora_entrata: string; ora_uscita: string; note: string } | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: lavs }, { data: pres }] = await Promise.all([
      supabase.from('lavoratori_commessa').select('*').eq('commessa_id', id).order('cognome'),
      supabase.from('presenze_cantiere').select('*').eq('commessa_id', id).eq('data', dataPresenze),
    ])
    setLavoratori((lavs as Lavoratore[]) || [])
    setPresenze((pres as Presenza[]) || [])
    setLoading(false)
  }, [id, dataPresenze])

  useEffect(() => { carica() }, [carica])

  // ─── Salva lavoratore ─────────────────────────────────────────────────────

  const salva = async () => {
    if (!editLav?.nome || !editLav?.cognome) { showToast('Nome e cognome obbligatori'); return }
    setSaving(true)
    try {
      const aziendaId = await getAziendaId()
      const qrToken = editLav.qr_token || crypto.randomUUID()
      const payload = {
        commessa_id: id,
        azienda_id: aziendaId || null,
        nome: editLav.nome.trim(),
        cognome: editLav.cognome.trim(),
        tipo_rapporto: editLav.tipo_rapporto || 'dipendente',
        azienda_appartenenza: editLav.azienda_appartenenza || null,
        mansione: editLav.mansione || null,
        qr_token: qrToken,
        durc_scadenza: editLav.durc_scadenza || null,
        formazione_scadenza: editLav.formazione_scadenza || null,
        patente_crediti_punti: editLav.patente_crediti_punti ?? 30,
        attivo: editLav.attivo !== false,
      }
      if (editLav.id) {
        await supabase.from('lavoratori_commessa').update(payload).eq('id', editLav.id)
        showToast('✓ Lavoratore aggiornato')
      } else {
        await supabase.from('lavoratori_commessa').insert(payload)
        showToast('✓ Lavoratore aggiunto')
      }
      setForm(false); setEditLav(null); carica()
    } finally { setSaving(false) }
  }

  // ─── Registra presenza manuale ───────────────────────────────────────────

  const salvaPresenza = async () => {
    if (!formPresenza?.lavoratoreId) return
    await supabase.from('presenze_cantiere').insert({
      lavoratore_id: formPresenza.lavoratoreId,
      commessa_id: id,
      data: dataPresenze,
      ora_entrata: formPresenza.ora_entrata || null,
      ora_uscita: formPresenza.ora_uscita || null,
      tipo: 'manuale',
      note: formPresenza.note || null,
    })
    setFormPresenza(null); showToast('✓ Presenza registrata'); carica()
  }

  const eliminaLavoratore = async (l: Lavoratore) => {
    if (!window.confirm(`Rimuovere ${l.nome} ${l.cognome} dalla commessa?`)) return
    await supabase.from('lavoratori_commessa').update({ attivo: false }).eq('id', l.id)
    showToast('Lavoratore disattivato'); carica()
  }

  // ─── Dati derivati ───────────────────────────────────────────────────────

  const lavAttivi = lavoratori.filter(l => l.attivo)
  const lavIrregolari = lavAttivi.filter(hasIrregolarita)
  const lavWarning = lavAttivi.filter(l => !hasIrregolarita(l) && hasWarning(l))
  const presentiOggi = new Set(presenze.map(p => p.lavoratore_id))

  // ─── Render tab ────────────────────────────────────────────────────────

  return (
    <div style={s.page} className="fade-in">

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--panel)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
        {([
          { k: 'anagrafica', l: '👷 Anagrafica' },
          { k: 'presenze',   l: '📋 Presenze' },
          { k: 'dashboard',  l: '🌅 Dashboard mattino' },
        ] as const).map(({ k, l }) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === k ? 700 : 400, background: tab === k ? 'var(--accent)' : 'transparent', color: tab === k ? '#fff' : 'var(--t3)', transition: 'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB ANAGRAFICA ══════════════ */}
      {tab === 'anagrafica' && (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { l: 'Lavoratori attivi', v: lavAttivi.length, c: 'var(--t1)', bg: 'var(--panel)' },
              { l: 'Presenti oggi', v: presentiOggi.size, c: '#2563eb', bg: '#eff6ff' },
              { l: 'Con irregolarità', v: lavIrregolari.length, c: lavIrregolari.length > 0 ? '#dc2626' : 'var(--t3)', bg: lavIrregolari.length > 0 ? '#fef2f2' : 'var(--panel)' },
              { l: 'In scadenza <30gg', v: lavWarning.length, c: lavWarning.length > 0 ? '#d97706' : 'var(--t3)', bg: lavWarning.length > 0 ? '#fffbeb' : 'var(--panel)' },
            ].map(({ l, v, c, bg }, i) => (
              <div key={i} style={{ ...s.card, padding: '14px 16px', background: bg }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: c, margin: 0 }}>{v}</p>
                <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{l}</p>
              </div>
            ))}
          </div>

          {/* Lista lavoratori */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Persone in cantiere</span>
              <button style={s.btn('var(--accent)')}
                onClick={() => { setEditLav({ tipo_rapporto: 'dipendente', attivo: true, patente_crediti_punti: 30 }); setForm(true) }}>
                + Aggiungi lavoratore
              </button>
            </div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
            ) : lavAttivi.length === 0 ? (
              <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--t3)' }}>
                <p style={{ fontSize: 36, marginBottom: 8 }}>👷</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>Nessun lavoratore registrato</p>
                <p style={{ fontSize: 13 }}>Aggiungi i lavoratori per gestire presenze e documenti</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['', 'Nome', 'Tipo', 'Azienda / Mansione', 'DURC', 'Formazione', 'Patente', 'Presenze oggi', ''].map((h, i) => (
                        <th key={i} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lavAttivi.map(l => {
                      const durc = docStatus(l.durc_scadenza)
                      const form = docStatus(l.formazione_scadenza)
                      const pat = patenteStatus(l.patente_crediti_punti)
                      const irreg = hasIrregolarita(l)
                      const warn = !irreg && hasWarning(l)
                      const presente = presentiOggi.has(l.id)
                      const tipoInfo = TIPI_RAPPORTO.find(t => t.value === l.tipo_rapporto)
                      return (
                        <tr key={l.id}
                          style={{ background: irreg ? '#fff5f5' : warn ? '#fffcf0' : 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.97)')}
                          onMouseLeave={e => (e.currentTarget.style.filter = '')}>
                          <td style={{ ...s.td, width: 8, paddingRight: 0 }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: irreg ? '#dc2626' : warn ? '#f59e0b' : '#22c55e', flexShrink: 0 }} />
                          </td>
                          <td style={{ ...s.td, fontWeight: 600, color: 'var(--t1)', whiteSpace: 'nowrap' as const }}>
                            {l.cognome} {l.nome}
                          </td>
                          <td style={s.td}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: (tipoInfo?.color || '#6b7280') + '22', color: tipoInfo?.color || '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' as const }}>
                              {tipoInfo?.label || l.tipo_rapporto}
                            </span>
                          </td>
                          <td style={s.td}>
                            <span style={{ fontWeight: 500 }}>{l.azienda_appartenenza || '—'}</span>
                            {l.mansione && <span style={{ display: 'block', fontSize: 10, color: 'var(--t3)' }}>{l.mansione}</span>}
                          </td>
                          {/* DURC */}
                          <td style={s.td}>
                            <span style={{ fontWeight: 700, color: STATUS_COLOR[durc], fontSize: 13 }}>{STATUS_ICON[durc]}</span>
                            {l.durc_scadenza && <span style={{ display: 'block', fontSize: 10, color: 'var(--t3)' }}>{fmtData(l.durc_scadenza)}</span>}
                          </td>
                          {/* Formazione */}
                          <td style={s.td}>
                            <span style={{ fontWeight: 700, color: STATUS_COLOR[form], fontSize: 13 }}>{STATUS_ICON[form]}</span>
                            {l.formazione_scadenza && <span style={{ display: 'block', fontSize: 10, color: 'var(--t3)' }}>{fmtData(l.formazione_scadenza)}</span>}
                          </td>
                          {/* Patente crediti */}
                          <td style={s.td}>
                            <span style={{ fontWeight: 700, color: STATUS_COLOR[pat] }}>
                              {l.patente_crediti_punti != null ? `${l.patente_crediti_punti} pt` : '—'}
                            </span>
                            {pat === 'alert' && <span style={{ display: 'block', fontSize: 9, color: '#dc2626' }}>SOTTO SOGLIA</span>}
                          </td>
                          <td style={s.td}>
                            {presente
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ Presente</span>
                              : <span style={{ fontSize: 11, color: 'var(--t4)' }}>—</span>}
                          </td>
                          <td style={{ ...s.td, whiteSpace: 'nowrap' as const }}>
                            <button style={{ ...s.btn('#6366f1'), padding: '3px 8px', fontSize: 11 }} onClick={() => setQrModal(l)} title="QR Badge">QR</button>
                            <button style={{ ...s.btn('#3b82f6'), padding: '3px 8px', fontSize: 11, marginLeft: 4 }} onClick={() => { setEditLav(l); setForm(true) }}>✎</button>
                            <button style={{ ...s.btn('#ef4444'), padding: '3px 8px', fontSize: 11, marginLeft: 4 }} onClick={() => eliminaLavoratore(l)}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ TAB PRESENZE ══════════════ */}
      {tab === 'presenze' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <label style={s.lbl}>Data</label>
              <input type="date" value={dataPresenze} onChange={e => setDataPresenze(e.target.value)}
                style={{ ...s.inp, width: 160 }} />
            </div>
            <div style={{ marginTop: 16 }}>
              <button style={s.btn('var(--accent)')}
                onClick={() => setFormPresenza({ lavoratoreId: '', ora_entrata: '08:00', ora_uscita: '', note: '' })}>
                + Registra manuale
              </button>
            </div>
          </div>

          {formPresenza && (
            <div style={{ ...s.card, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Registrazione manuale presenza</p>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={s.lbl}>Lavoratore</label>
                  <select style={s.inp} value={formPresenza.lavoratoreId} onChange={e => setFormPresenza({ ...formPresenza, lavoratoreId: e.target.value })}>
                    <option value="">— Seleziona —</option>
                    {lavAttivi.map(l => <option key={l.id} value={l.id}>{l.cognome} {l.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.lbl}>Entrata</label>
                  <input type="time" style={s.inp} value={formPresenza.ora_entrata} onChange={e => setFormPresenza({ ...formPresenza, ora_entrata: e.target.value })} />
                </div>
                <div>
                  <label style={s.lbl}>Uscita</label>
                  <input type="time" style={s.inp} value={formPresenza.ora_uscita} onChange={e => setFormPresenza({ ...formPresenza, ora_uscita: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={s.btn('var(--accent)')} onClick={salvaPresenza}>Salva</button>
                  <button style={s.btn('#6b7280')} onClick={() => setFormPresenza(null)}>Annulla</button>
                </div>
              </div>
            </div>
          )}

          <div style={s.card}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Presenze {new Date(dataPresenze).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
              </span>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>{presenze.length} registrazioni</span>
            </div>
            {presenze.length === 0 ? (
              <div style={{ padding: '40px 32px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                <p>Nessuna presenza registrata per questa data</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Registra manualmente oppure usa la scansione QR</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>{['Lavoratore', 'Tipo rapporto', 'Entrata', 'Uscita', 'Ore', 'Tipo', 'Note'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {presenze.map(p => {
                    const lav = lavoratori.find(l => l.id === p.lavoratore_id)
                    return (
                      <tr key={p.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{lav ? `${lav.cognome} ${lav.nome}` : '—'}</td>
                        <td style={s.td}>{lav ? TIPI_RAPPORTO.find(t => t.value === lav.tipo_rapporto)?.label : '—'}</td>
                        <td style={{ ...s.td, fontFamily: 'monospace' }}>{p.ora_entrata || '—'}</td>
                        <td style={{ ...s.td, fontFamily: 'monospace' }}>{p.ora_uscita || '—'}</td>
                        <td style={{ ...s.td, textAlign: 'right' as const }}>{p.ore_lavorate != null ? p.ore_lavorate + 'h' : '—'}</td>
                        <td style={s.td}><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: p.tipo === 'qr_scan' ? '#ede9fe' : '#f3f4f6', color: p.tipo === 'qr_scan' ? '#7c3aed' : '#6b7280', fontWeight: 600 }}>{p.tipo === 'qr_scan' ? '📱 QR' : '✍ Manuale'}</span></td>
                        <td style={{ ...s.td, fontSize: 11, color: 'var(--t3)' }}>{p.note || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══════════════ TAB DASHBOARD MATTINO ══════════════ */}
      {tab === 'dashboard' && (
        <>
          <div style={{ background: '#1e3a5f', borderRadius: 12, padding: '16px 20px', color: '#93c5fd' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px', opacity: 0.7 }}>
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>
              {presentiOggi.size} / {lavAttivi.length} <span style={{ fontSize: 14, fontWeight: 400, color: '#93c5fd' }}>lavoratori presenti</span>
            </p>
          </div>

          {/* Irregolarità */}
          {lavIrregolari.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: '0 0 10px' }}>
                🚫 {lavIrregolari.length} lavorator{lavIrregolari.length > 1 ? 'i con' : 'e con'} irregolarità — NON ammessi in cantiere
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lavIrregolari.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid #fecaca' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{l.cognome} {l.nome}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{l.azienda_appartenenza}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {docStatus(l.durc_scadenza) === 'expired' && <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef2f2', color: '#dc2626', borderRadius: 4, fontWeight: 700, border: '1px solid #fecaca' }}>DURC scaduto</span>}
                      {docStatus(l.formazione_scadenza) === 'expired' && <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef2f2', color: '#dc2626', borderRadius: 4, fontWeight: 700, border: '1px solid #fecaca' }}>Formazione scaduta</span>}
                      {patenteStatus(l.patente_crediti_punti) === 'alert' && <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef2f2', color: '#dc2626', borderRadius: 4, fontWeight: 700, border: '1px solid #fecaca' }}>Patente &lt;15pt</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In scadenza */}
          {lavWarning.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#d97706', margin: '0 0 10px' }}>
                ⚠ {lavWarning.length} lavorator{lavWarning.length > 1 ? 'i con' : 'e con'} documenti in scadenza entro 30 giorni
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {lavWarning.map(l => (
                  <span key={l.id} style={{ fontSize: 11, padding: '4px 10px', background: '#fff', borderRadius: 8, border: '1px solid #fde68a', fontWeight: 600, color: '#92400e' }}>
                    {l.cognome} {l.nome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Griglia presenti / assenti */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={s.card}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: '#f0fdf4' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>✓ Presenti oggi ({presentiOggi.size})</span>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lavAttivi.filter(l => presentiOggi.has(l.id)).map(l => {
                  const pres = presenze.find(p => p.lavoratore_id === l.id)
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{l.cognome} {l.nome}</span>
                      <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 'auto' }}>{pres?.ora_entrata || ''}</span>
                    </div>
                  )
                })}
                {lavAttivi.filter(l => presentiOggi.has(l.id)).length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>Nessuno ancora registrato</p>
                )}
              </div>
            </div>
            <div style={s.card}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)' }}>○ Non ancora in cantiere ({lavAttivi.filter(l => !presentiOggi.has(l.id)).length})</span>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lavAttivi.filter(l => !presentiOggi.has(l.id)).map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasIrregolarita(l) ? '#dc2626' : '#d1d5db', flexShrink: 0 }} />
                    <span style={{ fontWeight: hasIrregolarita(l) ? 700 : 400, color: hasIrregolarita(l) ? '#dc2626' : 'var(--t1)' }}>
                      {l.cognome} {l.nome}
                    </span>
                    {hasIrregolarita(l) && <span style={{ fontSize: 10, color: '#dc2626', marginLeft: 'auto' }}>IRREGOLARE</span>}
                  </div>
                ))}
                {lavAttivi.filter(l => !presentiOggi.has(l.id)).length === 0 && (
                  <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Tutti presenti!</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ MODAL FORM LAVORATORE ══════════════ */}
      {form && editLav && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setForm(false); setEditLav(null) } }}>
          <div className="modal-box" style={{ maxWidth: 620, width: '94%', maxHeight: '90vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, position: 'sticky' as const, top: 0, background: 'var(--panel)', zIndex: 1, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>{editLav.id ? 'Modifica lavoratore' : 'Aggiungi lavoratore'}</h3>
              <button onClick={() => { setForm(false); setEditLav(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Nome *</label>
                  <input style={s.inp} value={editLav.nome || ''} onChange={e => setEditLav({ ...editLav, nome: e.target.value })} />
                </div>
                <div>
                  <label style={s.lbl}>Cognome *</label>
                  <input style={s.inp} value={editLav.cognome || ''} onChange={e => setEditLav({ ...editLav, cognome: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Tipo rapporto</label>
                  <select style={s.inp} value={editLav.tipo_rapporto || 'dipendente'} onChange={e => setEditLav({ ...editLav, tipo_rapporto: e.target.value as TipoRapporto })}>
                    {TIPI_RAPPORTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.lbl}>Azienda di appartenenza</label>
                  <input style={s.inp} value={editLav.azienda_appartenenza || ''} onChange={e => setEditLav({ ...editLav, azienda_appartenenza: e.target.value })} placeholder="Es. Edil Rossi Srl" />
                </div>
              </div>
              <div>
                <label style={s.lbl}>Mansione</label>
                <input style={s.inp} value={editLav.mansione || ''} onChange={e => setEditLav({ ...editLav, mansione: e.target.value })} placeholder="Es. Muratore, Carpentiere, Gruista…" />
              </div>

              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '4px 0 0' }}>Documenti</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.lbl}>Scadenza DURC</label>
                  <input type="date" style={s.inp} value={editLav.durc_scadenza || ''} onChange={e => setEditLav({ ...editLav, durc_scadenza: e.target.value })} />
                  {editLav.durc_scadenza && (
                    <span style={{ fontSize: 10, marginTop: 2, display: 'block', color: STATUS_COLOR[docStatus(editLav.durc_scadenza)], fontWeight: 600 }}>
                      {docStatus(editLav.durc_scadenza) === 'ok' ? '✓ Valido' : docStatus(editLav.durc_scadenza) === 'warning' ? '⚠ In scadenza' : '✕ Scaduto'}
                    </span>
                  )}
                </div>
                <div>
                  <label style={s.lbl}>Scadenza formazione</label>
                  <input type="date" style={s.inp} value={editLav.formazione_scadenza || ''} onChange={e => setEditLav({ ...editLav, formazione_scadenza: e.target.value })} />
                  {editLav.formazione_scadenza && (
                    <span style={{ fontSize: 10, marginTop: 2, display: 'block', color: STATUS_COLOR[docStatus(editLav.formazione_scadenza)], fontWeight: 600 }}>
                      {docStatus(editLav.formazione_scadenza) === 'ok' ? '✓ Valida' : docStatus(editLav.formazione_scadenza) === 'warning' ? '⚠ In scadenza' : '✕ Scaduta'}
                    </span>
                  )}
                </div>
                <div>
                  <label style={s.lbl}>Patente crediti (punti)</label>
                  <input type="number" min={0} max={30} style={s.inp} value={editLav.patente_crediti_punti ?? 30} onChange={e => setEditLav({ ...editLav, patente_crediti_punti: parseInt(e.target.value) || 0 })} />
                  {editLav.patente_crediti_punti != null && (
                    <span style={{ fontSize: 10, marginTop: 2, display: 'block', color: STATUS_COLOR[patenteStatus(editLav.patente_crediti_punti)], fontWeight: 600 }}>
                      {patenteStatus(editLav.patente_crediti_punti) === 'ok' ? '✓ Regolare' : patenteStatus(editLav.patente_crediti_punti) === 'warning' ? '⚠ Basso' : patenteStatus(editLav.patente_crediti_punti) === 'alert' ? '✕ Sotto soglia 15pt' : '—'}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)', position: 'sticky' as const, bottom: 0, background: 'var(--panel)' }}>
                <button style={s.btn('#6b7280')} onClick={() => { setForm(false); setEditLav(null) }}>Annulla</button>
                <button style={s.btn('var(--accent)')} onClick={salva} disabled={saving}>{saving ? '...' : editLav.id ? 'Aggiorna' : 'Aggiungi'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && <QRModal lavoratore={qrModal} onClose={() => setQrModal(null)} />}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#14532d', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, zIndex: 1000, boxShadow: 'var(--shadow-lg)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
