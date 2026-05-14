'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, RefreshCw } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const WBS_FLAT: [string, string][] = [
  ['F01','FASE PRELIMINARE'],['F01.01','Apertura commessa'],
  ['F02','PROGETTAZIONE'],['F02.01','Progett. architettonica'],['F02.02','Strutturale'],['F02.03','Impianti'],
  ['F03','APPROVVIGIONAMENTI'],['F03.01','Materiali strutturali'],['F03.02','Finiture'],['F03.03','Noleggi'],['F03.04','Contratti sub'],
  ['F04','CANTIERE'],['F04.01','Opere preliminari'],['F04.02','Demolizioni'],['F04.03','Scavi'],
  ['F04.04','Fondazioni'],['F04.05','Struttura in elevazione'],['F04.06','Solaio e copertura'],
  ['F04.07','Tamponamenti'],['F04.08','Intonaci'],['F04.09','Massetti e pavimenti'],
  ['F04.10','Serramenti'],['F04.11','Tinteggiature'],
  ['F05','IMPIANTI'],['F05.01','Impianto elettrico'],['F05.02','Idro-sanitario'],['F05.03','Termico'],
  ['F06','OPERE ESTERNE'],['F06.01','Pavimentazioni esterne'],['F06.02','Recinzioni'],
  ['F07','SICUREZZA'],['F07.01','DPI'],['F07.02','Apprestamenti'],
  ['F08','GESTIONE ECONOMICA'],['F08.01','Controllo budget'],['F08.02','Fatturazione'],
]
const WBS_MAP = Object.fromEntries(WBS_FLAT)

interface WBSRow {
  code: string; label: string; isRoot: boolean
  budget: number; costoOda: number; delta: number; deltaPerc: number
}

export default function MarginalitaPage() {
  const { id } = useParams() as { id: string }
  const [rows, setRows] = useState<WBSRow[]>([])
  const [totBudget, setTotBudget] = useState(0)
  const [totOda, setTotOda] = useState(0)
  const [ricavoContratto, setRicavoContratto] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    // 1. Ricavo contrattuale
    const { data: com } = await supabase.from('commesse').select('importo_contratto').eq('id', id).single()
    setRicavoContratto(com?.importo_contratto || 0)

    // 2. Budget per WBS da voci_computo (via computo_metrico)
    const { data: computo } = await supabase.from('computo_metrico').select('id').eq('commessa_id', id).single()
    const budgetByWbs: Record<string, number> = {}
    let totalBudget = 0
    if (computo) {
      const { data: voci } = await supabase
        .from('voci_computo')
        .select('wbs_id, importo')
        .eq('computo_id', computo.id)
      for (const v of voci || []) {
        totalBudget += Number(v.importo) || 0
        if (v.wbs_id) budgetByWbs[v.wbs_id] = (budgetByWbs[v.wbs_id] || 0) + (Number(v.importo) || 0)
      }
    }

    // 3. Costi ODA per WBS: ODA → rdo_id → RDO.rda_id → RDA.wbs_id
    const [{ data: odaData }, { data: rdoData }, { data: rdaData }] = await Promise.all([
      supabase.from('oda').select('importo_netto, rdo_id, stato').eq('commessa_id', id),
      supabase.from('rdo').select('id, rda_id').eq('commessa_id', id),
      supabase.from('rda').select('id, wbs_id').eq('commessa_id', id),
    ])

    // Build lookup maps
    const rdoToRda: Record<string, string> = {}
    for (const r of rdoData || []) { if (r.rda_id) rdoToRda[r.id] = r.rda_id }
    const rdaToWbs: Record<string, string> = {}
    for (const r of rdaData || []) { if (r.wbs_id) rdaToWbs[r.id] = r.wbs_id }

    const odaByWbs: Record<string, number> = {}
    let totalOda = 0
    for (const o of odaData || []) {
      if (o.stato === 'ANNULLATO') continue
      totalOda += Number(o.importo_netto) || 0
      const rdaId = o.rdo_id ? rdoToRda[o.rdo_id] : null
      const wbsId = rdaId ? rdaToWbs[rdaId] : null
      if (wbsId) odaByWbs[wbsId] = (odaByWbs[wbsId] || 0) + (Number(o.importo_netto) || 0)
    }

    // 4. Build WBS rows — solo nodi con dati
    const activeCodes = new Set([...Object.keys(budgetByWbs), ...Object.keys(odaByWbs)])
    const wbsRows: WBSRow[] = WBS_FLAT
      .filter(([code]) => activeCodes.has(code))
      .map(([code, label]) => {
        const budget = budgetByWbs[code] || 0
        const costoOda = odaByWbs[code] || 0
        const delta = budget - costoOda
        const deltaPerc = budget > 0 ? (delta / budget) * 100 : (costoOda > 0 ? -100 : 0)
        return { code, label, isRoot: !code.includes('.'), budget, costoOda, delta, deltaPerc }
      })

    setRows(wbsRows)
    setTotBudget(totalBudget)
    setTotOda(totalOda)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: '#9ca3af' }}>
      <Loader2 size={18} className="animate-spin" /> Caricamento marginalità...
    </div>
  )

  const deltaTotal = totBudget - totOda
  const deltaTotalPerc = totBudget > 0 ? (deltaTotal / totBudget) * 100 : 0
  const odaSuContratto = ricavoContratto > 0 ? (totOda / ricavoContratto) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Ricavo contratto', value: fmt(ricavoContratto) + ' €', bg: '#f0f9ff', border: '#bae6fd', text: '#0c4a6e' },
          { label: 'Budget computo', value: fmt(totBudget) + ' €', bg: '#f8fafc', border: '#e2e8f0', text: '#334155' },
          { label: 'ODA impegnati', value: fmt(totOda) + ' €', bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d' },
          {
            label: 'Δ Budget vs ODA',
            value: (deltaTotal >= 0 ? '+' : '') + fmt(deltaTotal) + ' € (' + deltaTotalPerc.toFixed(1) + '%)',
            bg: deltaTotal >= 0 ? '#f0fdf4' : '#fef2f2',
            border: deltaTotal >= 0 ? '#bbf7d0' : '#fecaca',
            text: deltaTotal >= 0 ? '#14532d' : '#7f1d1d',
          },
        ].map(({ label, value, bg, border, text }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 18px' }}>
            <p style={{ fontSize: 11, color: text, marginBottom: 4, fontWeight: 500, opacity: 0.7 }}>{label}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: text, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabella WBS */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#111827' }}>Marginalità per nodo WBS</h3>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Budget da voci computo · Costi ODA collegati via RDA→WBS</p>
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>
            <RefreshCw size={12} /> Aggiorna
          </button>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Nessun dato WBS disponibile</p>
            <p style={{ fontSize: 13 }}>Assegna nodi WBS alle voci del computo e collega le ODA tramite RDA per visualizzare la marginalità</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Nodo WBS', 'Budget computo', 'Costi ODA', 'Δ', '% margine', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Nodo WBS' ? 'left' : 'right', fontWeight: 600, fontSize: 10, color: '#6b7280', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', ...(h === '' ? { width: 130 } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const alertColor = row.costoOda === 0 ? '#9ca3af' : row.delta >= 0 ? '#059669' : '#dc2626'
                const barUsed = row.budget > 0 ? Math.min(100, (row.costoOda / row.budget) * 100) : 0
                const barColor = barUsed > 100 ? '#dc2626' : barUsed > 85 ? '#d97706' : '#059669'
                return (
                  <tr key={row.code} style={{ background: row.isRoot ? '#f8fafc' : '#fff' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = row.isRoot ? '#f8fafc' : '#fff')}>
                    <td style={{ padding: row.isRoot ? '10px 14px' : '8px 14px 8px 28px', borderBottom: '1px solid #f3f4f6', fontWeight: row.isRoot ? 700 : 400 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', marginRight: 8 }}>{row.code}</span>
                      <span style={{ color: '#111827' }}>{row.label}</span>
                    </td>
                    <td style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151', fontWeight: row.isRoot ? 600 : 400 }}>
                      {row.budget > 0 ? `€ ${fmt(row.budget)}` : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.costoOda > 0 ? '#dc2626' : '#d1d5db', fontWeight: row.isRoot ? 600 : 400 }}>
                      {row.costoOda > 0 ? `€ ${fmt(row.costoOda)}` : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: alertColor, fontWeight: 600 }}>
                      {row.costoOda > 0 ? `${row.delta >= 0 ? '+' : ''}€ ${fmt(row.delta)}` : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: 700, color: alertColor }}>
                      {row.costoOda > 0 ? row.deltaPerc.toFixed(1) + '%' : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      {row.costoOda > 0 && row.budget > 0 && (
                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                          <div style={{ height: '100%', background: barColor, borderRadius: 3, width: barUsed + '%', transition: 'width 0.6s ease' }} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}

              {/* Riga totale */}
              <tr style={{ background: '#1e3a5f' }}>
                <td style={{ padding: '13px 14px', color: '#93c5fd', fontWeight: 700, fontSize: 13 }}>TOTALE COMMESSA</td>
                <td style={{ padding: '13px 14px', textAlign: 'right', color: '#bfdbfe', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>€ {fmt(totBudget)}</td>
                <td style={{ padding: '13px 14px', textAlign: 'right', color: '#fca5a5', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>€ {fmt(totOda)}</td>
                <td style={{ padding: '13px 14px', textAlign: 'right', color: deltaTotal >= 0 ? '#4ade80' : '#fca5a5', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {deltaTotal >= 0 ? '+' : ''}€ {fmt(deltaTotal)}
                </td>
                <td style={{ padding: '13px 14px', textAlign: 'right', color: deltaTotal >= 0 ? '#4ade80' : '#fca5a5', fontWeight: 700 }}>
                  {deltaTotalPerc.toFixed(1)}%
                </td>
                <td style={{ padding: '13px 14px' }}>
                  {totBudget > 0 && (
                    <div style={{ height: 6, background: 'rgba(255,255,255,.15)', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                      <div style={{ height: '100%', background: odaSuContratto > 100 ? '#ef4444' : odaSuContratto > 85 ? '#f97316' : '#4ade80', borderRadius: 3, width: Math.min(100, (totOda / totBudget) * 100) + '%' }} />
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ODA non collegati a WBS */}
      {totOda > 0 && rows.reduce((s, r) => s + r.costoOda, 0) < totOda && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
          <div>
            <strong>ODA non assegnati a WBS:</strong> € {fmt(totOda - rows.reduce((s, r) => s + r.costoOda, 0))} di ODA non compaiono nel breakdown perché la loro RDA non ha un nodo WBS assegnato.
            Assegna il WBS alle RDA per una marginalità completa.
          </div>
        </div>
      )}
    </div>
  )
}
