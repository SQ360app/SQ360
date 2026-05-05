'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TIPI = ['professionista', 'fornitore', 'subappaltatore', 'nolo', 'altro']
const TIPI_COLOR: Record<string, string> = {
  professionista: '#3b82f6', fornitore: '#10b981',
  subappaltatore: '#8b5cf6', nolo: '#f59e0b', altro: '#6b7280'
}

interface Soggetto {
  id: string
  nome?: string; cognome?: string; ragione_sociale?: string
  tipo: string; specializzazione?: string
  pec?: string; email?: string; telefono?: string
  ordine_professionale?: string; numero_iscrizione?: string
  categoria_soa?: string; studio?: string
  attivo: boolean; created_at: string
}

const fNome = (s: Soggetto) => s.ragione_sociale || ((s.nome || '') + ' ' + (s.cognome || '')).trim()

export default function FornitoriPage() {
  const [lista, setLista] = useState<Soggetto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('tutti')
  const [detail, setDetail] = useState<Soggetto | null>(null)
  const [form, setForm] = useState(false)
  const [edit, setEdit] = useState<Partial<Soggetto> | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const carica = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('professionisti_fornitori')
      .select('*')
      .order('created_at', { ascending: false })
    setLista((data as Soggetto[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { carica() }, [carica])

  const salva = async () => {
    if (!edit?.tipo) { showToast('Seleziona tipo'); return }
    if (!fNome(edit as Soggetto)) { showToast('Inserisci nome o ragione sociale'); return }
    setSaving(true)
    try {
      if (edit.id) {
        await supabase.from('professionisti_fornitori').update(edit).eq('id', edit.id)
        showToast('Aggiornato')
      } else {
        await supabase.from('professionisti_fornitori').insert({ ...edit, attivo: true })
        showToast('Aggiunto')
      }
      setForm(false); setEdit(null); carica()
    } finally { setSaving(false) }
  }

  const elimina = async (s: Soggetto) => {
    const nome = fNome(s)
    if (!window.confirm(`Eliminare "${nome}" dal database?`)) return
    if (!window.confirm(`Conferma definitiva: "${nome}" verrà rimosso permanentemente e da tutte le commesse collegate.`)) return
    await supabase.from('professionisti_fornitori').delete().eq('id', s.id)
    if (detail?.id === s.id) setDetail(null)
    showToast('Eliminato')
    carica()
  }

  const filtrati = lista.filter(s => {
    const match = search ? fNome(s).toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()) || s.specializzazione?.toLowerCase().includes(search.toLowerCase()) : true
    const tipo = filtroTipo === 'tutti' || s.tipo === filtroTipo
    return match && tipo
  })

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--panel)', color: 'var(--t1)', outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 4 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} className="fade-in">

      {/* HEADER */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Database Professionisti & Fornitori</h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{lista.length} soggetti nel database</p>
        </div>
        <button className="btn-primary" style={{ fontSize: 12, padding: '8px 14px' }}
          onClick={() => { setEdit({ tipo: 'professionista', attivo: true }); setForm(true) }}>
          + Nuovo
        </button>
      </div>

      {/* KPI TIPI */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['tutti', ...TIPI].map(t => {
          const count = t === 'tutti' ? lista.length : lista.filter(s => s.tipo === t).length
          return (
            <button key={t} onClick={() => setFiltroTipo(t)}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid ' + (TIPI_COLOR[t] || 'var(--border)') + (filtroTipo === t ? '' : '44'), cursor: 'pointer', fontSize: 11, fontWeight: 600, background: filtroTipo === t ? (TIPI_COLOR[t] || 'var(--accent)') : 'var(--panel)', color: filtroTipo === t ? '#fff' : 'var(--t2)' }}>
              {t === 'tutti' ? 'Tutti' : t} ({count})
            </button>
          )
        })}
      </div>

      {/* SEARCH + LISTA */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Cerca per nome, email, specializzazione..."
            style={{ ...inp, width: '100%' }} />
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
        ) : filtrati.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Nessun risultato</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Nome / Ragione Sociale', 'Tipo', 'Specializzazione', 'Email / PEC', 'Telefono', ''].map(h => (
                    <th key={h} style={{ padding: '7px 12px', fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrati.map(s => (
                  <tr key={s.id} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--accent-light)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    onClick={() => setDetail(s)}>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--t1)', borderBottom: '1px solid var(--border)' }}>{fNome(s)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, background: (TIPI_COLOR[s.tipo] || '#ccc') + '22', color: TIPI_COLOR[s.tipo] || '#666', fontWeight: 600 }}>{s.tipo}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t2)', borderBottom: '1px solid var(--border)' }}>{s.specializzazione || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      {s.pec ? <a href={'mailto:' + s.pec} onClick={e => e.stopPropagation()} style={{ color: 'var(--accent)' }}>{s.pec}</a> : s.email ? <a href={'mailto:' + s.email} onClick={e => e.stopPropagation()} style={{ color: 'var(--accent)' }}>{s.email}</a> : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t2)', borderBottom: '1px solid var(--border)' }}>{s.telefono || '—'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEdit(s); setForm(true) }}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 11 }}>✎</button>
                        <button onClick={() => elimina(s)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ef4444', color: '#ef4444', background: 'none', cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      {detail && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: 360, height: '100vh', background: 'var(--panel)', borderLeft: '1px solid var(--border)', zIndex: 200, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Anagrafica</h3>
            <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
          </div>
          <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 10 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{fNome(detail)}</p>
              <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 10, background: (TIPI_COLOR[detail.tipo] || '#ccc') + '22', color: TIPI_COLOR[detail.tipo] || '#666', fontSize: 11, fontWeight: 600 }}>{detail.tipo}</span>
            </div>
            {detail.specializzazione && <Row label="Specializzazione" value={detail.specializzazione} />}
            {detail.ordine_professionale && <Row label="Ordine" value={detail.ordine_professionale + (detail.numero_iscrizione ? ' n. ' + detail.numero_iscrizione : '')} />}
            {detail.categoria_soa && <Row label="SOA" value={detail.categoria_soa} />}
            {detail.pec && <Row label="PEC" value={detail.pec} href={'mailto:' + detail.pec} />}
            {detail.email && <Row label="Email" value={detail.email} href={'mailto:' + detail.email} />}
            {detail.telefono && <Row label="Telefono" value={detail.telefono} href={'tel:' + detail.telefono} />}
            {detail.studio && <Row label="Studio" value={detail.studio} />}
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 12 }}
              onClick={() => { setEdit(detail); setForm(true); setDetail(null) }}>✎ Modifica</button>
            <button style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #ef4444', color: '#ef4444', background: 'none', cursor: 'pointer', fontSize: 12 }}
              onClick={() => elimina(detail)}>✕ Elimina</button>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {form && edit && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setForm(false); setEdit(null) } }}>
          <div className="modal-box" style={{ maxWidth: 520, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>{edit.id ? 'Modifica' : 'Nuovo'} soggetto</h3>
              <button onClick={() => { setForm(false); setEdit(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Tipo *</label>
                <select style={inp} value={edit.tipo || 'professionista'} onChange={e => setEdit({ ...edit, tipo: e.target.value })}>
                  {TIPI.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {(edit.tipo === 'fornitore' || edit.tipo === 'subappaltatore' || edit.tipo === 'nolo') ? (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Ragione Sociale *</label>
                  <input style={inp} value={edit.ragione_sociale || ''} onChange={e => setEdit({ ...edit, ragione_sociale: e.target.value })} placeholder="Nome azienda" />
                </div>
              ) : (
                <>
                  <div>
                    <label style={lbl}>Nome *</label>
                    <input style={inp} value={edit.nome || ''} onChange={e => setEdit({ ...edit, nome: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Cognome *</label>
                    <input style={inp} value={edit.cognome || ''} onChange={e => setEdit({ ...edit, cognome: e.target.value })} />
                  </div>
                </>
              )}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Specializzazione / Ruolo</label>
                <input style={inp} value={edit.specializzazione || ''} onChange={e => setEdit({ ...edit, specializzazione: e.target.value })} placeholder="Es. Ingegnere strutturale, Fornitura calcestruzzo..." />
              </div>
              <div>
                <label style={lbl}>PEC</label>
                <input type="email" style={inp} value={edit.pec || ''} onChange={e => setEdit({ ...edit, pec: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input type="email" style={inp} value={edit.email || ''} onChange={e => setEdit({ ...edit, email: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Telefono</label>
                <input style={inp} value={edit.telefono || ''} onChange={e => setEdit({ ...edit, telefono: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Ordine professionale</label>
                <input style={inp} value={edit.ordine_professionale || ''} onChange={e => setEdit({ ...edit, ordine_professionale: e.target.value })} placeholder="OAI Roma, Geometri..." />
              </div>
              <div>
                <label style={lbl}>N. iscrizione</label>
                <input style={inp} value={edit.numero_iscrizione || ''} onChange={e => setEdit({ ...edit, numero_iscrizione: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Cat. SOA</label>
                <input style={inp} value={edit.categoria_soa || ''} onChange={e => setEdit({ ...edit, categoria_soa: e.target.value })} placeholder="OS1, OG1..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setForm(false); setEdit(null) }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 12 }}>Annulla</button>
              <button onClick={salva} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>{saving ? '...' : 'Salva'}</button>
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

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' }}>{label}</span>
      {href ? (
        <a href={href} style={{ fontSize: 13, color: 'var(--accent)' }}>{value}</a>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--t1)' }}>{value}</span>
      )}
    </div>
  )
}
