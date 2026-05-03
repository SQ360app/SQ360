'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Upload, FileText, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle, RefreshCw,
  Calculator, Shield, TrendingDown, X, Download
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface VoceComputo {
  id: string
  codice: string
  codice_prezzario?: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  capitolo: string
  categoria?: string
  note?: string
}

interface Commessa {
  id: string; codice: string; nome: string
  ribasso_pct?: number; oneri_sicurezza?: number
  sicurezza_interna_esclusa_ribasso?: boolean
  importo_contrattuale?: number
}

interface GruppoCapitolo {
  nome: string
  voci: VoceComputo[]
  totale: number
  aperto: boolean
}

interface RisultatoImport {
  ok?: boolean; tariffe?: number; voci?: number
  importo_totale?: number; error?: string
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const fi = (n: number, d = 2) =>
  n?.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—'

// ─── Stili inline con design system globals.css ───────────────────────────────

const S = {
  page:       { minHeight: '100%', background: 'var(--bg)' } as React.CSSProperties,
  toolbar:    { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', flexShrink: 0 } as React.CSSProperties,
  content:    { padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 12 },
  card:       { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' } as React.CSSProperties,
  cardHdr:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', borderRadius: '12px 12px 0 0' } as React.CSSProperties,
  cardHdrT:   { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  kpiGrid:    { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid var(--border)' } as React.CSSProperties,
  kpiCell:    (last: boolean) => ({ padding: '14px 16px', borderRight: last ? 'none' : '1px solid var(--border)' } as React.CSSProperties),
  kpiLabel:   { fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 6 },
  kpiValue:   { fontSize: 18, fontWeight: 700, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' as const },
  kpiSub:     { fontSize: 11, color: 'var(--t3)', marginTop: 3 },
  formula:    { padding: '10px 16px', background: '#0f172a', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const } as React.CSSProperties,
  // Drop zone
  dropZone:   (over: boolean) => ({
    border: `2px dashed ${over ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 10, padding: '28px 20px', textAlign: 'center' as const,
    background: over ? 'var(--accent-light)' : 'var(--bg)',
    transition: 'all 0.15s', cursor: 'pointer',
  } as React.CSSProperties),
  // Capitolo header
  capHdr:     (open: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: open ? '1px solid var(--border)' : 'none',
    transition: 'background 0.1s',
  } as React.CSSProperties),
  // Table
  table:      { width: '100%', borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const },
  th:         { padding: '7px 8px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', textAlign: 'left' as const, background: 'var(--bg)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const },
  thR:        { padding: '7px 8px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', textAlign: 'right' as const, background: 'var(--bg)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const },
  td:         { padding: '8px 8px', fontSize: 12, color: 'var(--t2)', borderBottom: '1px solid var(--border)' },
  tdR:        { padding: '8px 8px', fontSize: 12, color: 'var(--t2)', borderBottom: '1px solid var(--border)', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
  tdMono:     { padding: '8px 8px', fontSize: 11, color: 'var(--accent)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' },
  totRow:     { background: 'var(--bg)', fontWeight: 600 },
  // Risultato import
  alertOk:    { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, fontSize: 12, color: '#065f46' } as React.CSSProperties,
  alertErr:   { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 12, color: '#991b1b' } as React.CSSProperties,
}

// ─── Pagina Computo ────────────────────────────────────────────────────────────

export default function ComputoPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)

  const [commessa, setCommessa] = useState<Partial<Commessa>>({})
  const [capitoli, setCapitoli] = useState<GruppoCapitolo[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [importando, setImportando] = useState(false)
  const [risultatoImport, setRisultatoImport] = useState<RisultatoImport | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // ── Carica dati ──────────────────────────────────────────────────────────────

  const caricaDati = useCallback(async () => {
    if (!id) return
    setCaricamento(true)
    try {
      // Commessa
      const { data: comm } = await supabase
        .from('commesse')
        .select('id,codice,nome,ribasso_pct,oneri_sicurezza,sicurezza_interna_esclusa_ribasso,importo_contrattuale')
        .eq('id', id).single()
      if (comm) setCommessa(comm)

      // Computo metrico
      const { data: computo } = await supabase
        .from('computo_metrico')
        .select('id')
        .eq('commessa_id', id)
        .single()
      if (!computo) { setCaricamento(false); return }

      // Voci
      const { data: voci } = await supabase
        .from('voci_computo')
        .select('id,codice,codice_prezzario,descrizione,um,quantita,prezzo_unitario,importo,capitolo,categoria,note')
        .eq('computo_id', computo.id)
        .order('capitolo').order('codice')

      if (voci) {
        const map: Record<string, GruppoCapitolo> = {}
        for (const v of voci) {
          const cap = v.capitolo || 'Generale'
          if (!map[cap]) map[cap] = { nome: cap, voci: [], totale: 0, aperto: true }
          map[cap].voci.push(v)
          map[cap].totale += v.importo || 0
        }
        setCapitoli(Object.values(map))
      }
    } finally { setCaricamento(false) }
  }, [id])

  useEffect(() => { caricaDati() }, [caricaDati])

  // ── Import XPWE ──────────────────────────────────────────────────────────────

  const importaFile = async (file: File) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xpwe', 'pwe', 'xml'].includes(ext || '')) {
      setRisultatoImport({ error: 'Formato non supportato. Usa .xpwe, .pwe o .xml da Primus ACCA.' })
      return
    }
    setImportando(true); setRisultatoImport(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('commessa_id', id)
      const res = await fetch('/api/xpwe-parse', { method: 'POST', body: fd })
      const data = await res.json()
      setRisultatoImport(data)
      if (data.ok) await caricaDati()
    } catch {
      setRisultatoImport({ error: "Errore di rete durante l'importazione" })
    } finally { setImportando(false) }
  }

  const toggleCapitolo = (idx: number) =>
    setCapitoli(prev => prev.map((c, i) => i === idx ? { ...c, aperto: !c.aperto } : c))

  // ── Calcoli ──────────────────────────────────────────────────────────────────

  const totale = capitoli.reduce((s, c) => s + c.totale, 0)
  const nVoci  = capitoli.reduce((s, c) => s + c.voci.length, 0)
  const ribasso = (commessa.ribasso_pct || 0) / 100
  const oneriSic = commessa.oneri_sicurezza || 0
  const importoAggiudicato = totale * (1 - ribasso) + oneriSic
  const varCSS_ok = typeof window !== 'undefined'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={S.page} className="fade-in">

      {/* ── TOOLBAR ── */}
      <div style={S.toolbar}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginRight: 4 }}>Computo Metrico</span>
        {nVoci > 0 && (
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>
            {nVoci} voci · {capitoli.length} capitoli
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={caricaDati} disabled={caricamento}>
            <RefreshCw size={13} style={{ animation: caricamento ? 'spin 0.6s linear infinite' : 'none' }} />
            Aggiorna
          </button>
          {nVoci > 0 && (
            <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
              <Download size={13} /> Esporta
            </button>
          )}
        </div>
      </div>

      <div style={S.content}>

        {/* ── IMPORT XPWE ── */}
        <div style={S.card}>
          <div style={S.cardHdr}>
            <div style={S.cardHdrT}><Upload size={13} /> Importazione Computo</div>
            <span style={{ fontSize: 11, color: 'var(--t4)' }}>Primus ACCA · STR Vision · Formati: .xpwe .pwe .xml</span>
          </div>
          <div style={{ padding: 16 }}>
            <div
              style={S.dropZone(dragOver)}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) importaFile(f) }}
            >
              {importando ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Importazione in corso...</p>
                  <p style={{ fontSize: 11, color: 'var(--t3)' }}>Analisi voci, tariffe e incidenze XPWE</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-light)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={22} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                      Trascina il file XPWE oppure{' '}
                      <label style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>
                        seleziona dal computer
                        <input type="file" accept=".xpwe,.pwe,.xml" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) importaFile(f) }} />
                      </label>
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                      Legge SuperCategorie, Categorie, EPItem (con IncSIC), VCItem — formula ribasso a 3 strati
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Risultato */}
            {risultatoImport && (
              <div style={{ marginTop: 10, ...(risultatoImport.ok ? S.alertOk : S.alertErr) }}>
                {risultatoImport.ok
                  ? <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  : <AlertCircle  size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                }
                <div style={{ flex: 1 }}>
                  {risultatoImport.ok ? (
                    <p><strong>Importazione completata</strong> — {risultatoImport.tariffe} tariffe · {risultatoImport.voci} voci · Totale lista: <strong>€ {fi(risultatoImport.importo_totale || 0)}</strong></p>
                  ) : (
                    <p>{risultatoImport.error}</p>
                  )}
                </div>
                <button onClick={() => setRisultatoImport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── QUADRO ECONOMICO ── */}
        {nVoci > 0 && (
          <div style={S.card}>
            <div style={S.cardHdr}>
              <div style={S.cardHdrT}><Calculator size={13} /> Quadro Economico Riepilogativo</div>
              <span style={{ fontSize: 11, color: commessa.sicurezza_interna_esclusa_ribasso ? 'var(--warning)' : 'var(--t4)' }}>
                <Shield size={11} style={{ display: 'inline', marginRight: 3 }} />
                Sicurezza interna: {commessa.sicurezza_interna_esclusa_ribasso ? 'NON ribassata (Strato 3)' : 'Ribassata'}
              </span>
            </div>

            {/* KPI 4 colonne */}
            <div style={S.kpiGrid}>
              <div style={S.kpiCell(false)}>
                <p style={S.kpiLabel}><FileText size={10} style={{ display: 'inline', marginRight: 3 }} />Importo di lista</p>
                <p style={S.kpiValue}>€ {fi(totale)}</p>
                <p style={S.kpiSub}>{nVoci} voci · {capitoli.length} capitoli</p>
              </div>
              <div style={S.kpiCell(false)}>
                <p style={S.kpiLabel}><TrendingDown size={10} style={{ display: 'inline', marginRight: 3 }} />Ribasso</p>
                <p style={{ ...S.kpiValue, color: 'var(--accent)' }}>{(commessa.ribasso_pct || 0).toFixed(3)}%</p>
                <p style={S.kpiSub}>Importo ribassato: € {fi(totale * (1 - ribasso))}</p>
              </div>
              <div style={S.kpiCell(false)}>
                <p style={S.kpiLabel}><Shield size={10} style={{ display: 'inline', marginRight: 3 }} />Oneri sicurezza speciali</p>
                <p style={{ ...S.kpiValue, color: 'var(--warning)' }}>€ {fi(oneriSic)}</p>
                <p style={S.kpiSub}>Strato 2 — mai ribassati</p>
              </div>
              <div style={S.kpiCell(true)}>
                <p style={S.kpiLabel}><Calculator size={10} style={{ display: 'inline', marginRight: 3 }} />Importo aggiudicato</p>
                <p style={{ ...S.kpiValue, color: 'var(--success)' }}>€ {fi(importoAggiudicato)}</p>
                <p style={S.kpiSub}>Lavori + sicurezza</p>
              </div>
            </div>

            {/* Formula */}
            <div style={S.formula}>
              <span style={{ color: '#94a3b8', marginRight: 4, fontSize: 10, fontWeight: 700 }}>FORMULA:</span>
              <span style={{ color: '#4ade80' }}>Lavori × (1−R)</span>
              <span style={{ color: '#475569' }}>+</span>
              <span style={{ color: commessa.sicurezza_interna_esclusa_ribasso ? '#fbbf24' : '#64748b' }}>
                SicInterna{commessa.sicurezza_interna_esclusa_ribasso ? '' : ' × (1−R)'}
              </span>
              <span style={{ color: '#475569' }}>+</span>
              <span style={{ color: '#f87171' }}>SicSpeciale</span>
              <span style={{ color: '#475569' }}>+</span>
              <span style={{ color: '#60a5fa' }}>OneriSicurezza</span>
            </div>
          </div>
        )}

        {/* ── VOCI PER CAPITOLO ── */}
        {caricamento ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, color: 'var(--t3)' }}>
            <span className="spinner" />
            <span style={{ fontSize: 13 }}>Caricamento voci...</span>
          </div>
        ) : nVoci === 0 ? (
          <div style={{ ...S.card, padding: 40, textAlign: 'center' }}>
            <FileText size={40} style={{ color: 'var(--border)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>Nessun computo importato</p>
            <p style={{ fontSize: 12, color: 'var(--t3)' }}>Carica un file XPWE da Primus ACCA per importare le voci del computo</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {capitoli.map((cap, idx) => (
              <div key={cap.nome} style={S.card}>
                {/* Header capitolo */}
                <button
                  style={S.capHdr(cap.aperto)}
                  onClick={() => toggleCapitolo(idx)}
                >
                  {cap.aperto
                    ? <ChevronDown size={15} style={{ color: 'var(--t3)', flexShrink: 0 }} />
                    : <ChevronRight size={15} style={{ color: 'var(--t3)', flexShrink: 0 }} />
                  }
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--t1)', textAlign: 'left' }}>
                    {cap.nome}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 8px', marginRight: 12 }}>
                    {cap.voci.length} voci
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
                    € {fi(cap.totale)}
                  </span>
                </button>

                {/* Tabella voci */}
                {cap.aperto && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={S.table}>
                      <colgroup>
                        <col style={{ width: 100 }} />{/* tariffa */}
                        <col />{/* descrizione */}
                        <col style={{ width: 44 }} />{/* um */}
                        <col style={{ width: 86 }} />{/* quantità */}
                        <col style={{ width: 90 }} />{/* p.u. */}
                        <col style={{ width: 100 }} />{/* importo */}
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={S.th}>Tariffa</th>
                          <th style={{ ...S.th, textAlign: 'left' }}>Designazione</th>
                          <th style={{ ...S.thR, textAlign: 'center' }}>UM</th>
                          <th style={S.thR}>Quantità</th>
                          <th style={S.thR}>P.U. (€)</th>
                          <th style={S.thR}>Importo (€)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cap.voci.map(v => (
                          <tr key={v.id} style={{ transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={S.tdMono}>{v.codice || v.codice_prezzario || '—'}</td>
                            <td style={{ ...S.td, maxWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {v.descrizione?.split('.')[0] || v.descrizione}
                              </p>
                              {v.descrizione && v.descrizione.includes('.') && (
                                <p style={{ fontSize: 11, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {v.descrizione.slice(v.descrizione.indexOf('.') + 1, 160)}
                                </p>
                              )}
                            </td>
                            <td style={{ ...S.tdR, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>{v.um}</td>
                            <td style={{ ...S.tdR, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {fi(v.quantita, 3)}
                            </td>
                            <td style={{ ...S.tdR, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {fi(v.prezzo_unitario)}
                            </td>
                            <td style={{ ...S.tdR, fontWeight: 700, color: 'var(--t1)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                              {fi(v.importo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={S.totRow}>
                          <td colSpan={5} style={{ ...S.tdR, fontSize: 12, fontWeight: 600, color: 'var(--t2)', borderTop: '1px solid var(--border-strong)', borderBottom: 'none', paddingTop: 10, paddingBottom: 10 }}>
                            Totale {cap.nome}
                          </td>
                          <td style={{ ...S.tdR, fontSize: 14, fontWeight: 700, color: 'var(--t1)', borderTop: '1px solid var(--border-strong)', borderBottom: 'none', paddingTop: 10, paddingBottom: 10, fontFamily: 'var(--font-mono)' }}>
                            {fi(cap.totale)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}

            {/* Totale generale */}
            <div style={{ background: 'var(--sidebar-bg)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>TOTALE COMPUTO DI LISTA</p>
                <p style={{ fontSize: 11, color: 'var(--sidebar-muted)', marginTop: 2 }}>
                  {nVoci} voci · {capitoli.length} capitoli · IVA esclusa
                </p>
              </div>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#4ade80', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                € {fi(totale)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
