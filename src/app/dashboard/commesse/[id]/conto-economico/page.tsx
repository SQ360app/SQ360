'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ContoEconomicoPage() {
  const { id } = useParams() as { id: string }
  const [ce, setCe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: commessa } = await supabase.from('commesse').select('*').eq('id', id).single()
    const importoContratto = commessa?.importo_contratto || commessa?.importo_netto_aggiudicato || commessa?.importo_aggiudicato || commessa?.importo_netto || 0
    const { data: sal } = await supabase.from('sal_attivi').select('importo_netto_sal, stato').eq('commessa_id', id)
    const ricaviEmessi = (sal || []).filter((s: any) => s.stato !== 'BOZZA').reduce((s: number, x: any) => s + (x.importo_netto_sal || 0), 0)
    const ricaviIncassati = (sal || []).filter((s: any) => s.stato === 'PAGATO').reduce((s: number, x: any) => s + (x.importo_netto_sal || 0), 0)
    const { data: odaList } = await supabase.from('oda').select('importo_netto, stato').eq('commessa_id', id)
    const costiOda = (odaList || []).filter((o: any) => o.stato !== 'ANNULLATO').reduce((s: number, x: any) => s + (x.importo_netto || 0), 0)
    const { data: speseList } = await supabase.from('spese_cantiere').select('importo_netto, stato').eq('commessa_id', id)
    const costiSpese = (speseList || []).filter((s: any) => ['REGISTRATA','APPROVATA'].includes(s.stato)).reduce((s: number, x: any) => s + (x.importo_netto || 0), 0)
    const { data: salP } = await supabase.from('sal_passivi').select('ritenuta_importo, stato').eq('commessa_id', id)
    const ritenute = (salP || []).filter((s: any) => ['APPROVATO','PAGATO'].includes(s.stato)).reduce((s: number, x: any) => s + (x.ritenuta_importo || 0), 0)
    setCe({ importoContratto, ricaviEmessi, ricaviIncassati, costiOda, costiSpese, ritenute })
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, fontSize: 14, color: '#9ca3af' }}>
      <Loader2 size={16} className="animate-spin" /> Calcolo conto economico...
    </div>
  )

  if (!ce) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nessun dato disponibile</div>

  const totCosti = ce.costiOda + ce.costiSpese
  const margine = ce.importoContratto - totCosti
  const mPct = ce.importoContratto > 0 ? (margine / ce.importoContratto * 100) : 0
  const mColor = mPct > 10 ? '#059669' : mPct > 0 ? '#d97706' : '#dc2626'
  const mBg = mPct > 10 ? '#f0fdf4' : mPct > 0 ? '#fffbeb' : '#fef2f2'
  const avSal = ce.importoContratto > 0 ? Math.min(100, ce.ricaviEmessi / ce.importoContratto * 100) : 0
  const avPag = ce.importoContratto > 0 ? Math.min(100, ce.ricaviIncassati / ce.importoContratto * 100) : 0
  const avCosti = ce.importoContratto > 0 ? Math.min(100, totCosti / ce.importoContratto * 100) : 0

  const rows = [
    { label: 'Importo contratto netto', value: ce.importoContratto, tipo: 'header' },
    { label: 'SAL attivi emessi (ricavo maturato)', value: ce.ricaviEmessi, tipo: 'ricavo', sub: true },
    { label: 'di cui incassati dal committente', value: ce.ricaviIncassati, tipo: 'ricavo_light', sub: true },
    { label: 'Costi da ODA e contratti impegnati', value: ce.costiOda, tipo: 'costo' },
    { label: 'Spese cantiere contabilizzate', value: ce.costiSpese, tipo: 'costo' },
    { label: 'Totale costi impegnati', value: totCosti, tipo: 'subtotal' },
    { label: 'Ritenute accumulate (sbloccate a collaudo)', value: ce.ritenute, tipo: 'warning' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: mBg, border: '1px solid ' + mColor + '30', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>Margine lordo previsto</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: mColor, margin: 0 }}>EUR {fmt(margine)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>su importo contratto</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              {mPct > 10 ? <TrendingUp size={22} style={{ color: mColor }} />
                : mPct > 0 ? <Minus size={22} style={{ color: mColor }} />
                : <TrendingDown size={22} style={{ color: mColor }} />}
              <span style={{ fontSize: 24, fontWeight: 700, color: mColor }}>{mPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid #f3f4f6',
                background: r.tipo === 'header' || r.tipo === 'subtotal' ? '#f9fafb' : r.tipo === 'warning' ? '#fffbeb' : '#fff',
                borderTop: r.tipo === 'subtotal' ? '2px solid #e5e7eb' : undefined,
              }}>
                <td style={{ padding: '12px 16px', paddingLeft: (r as any).sub ? 32 : 16, fontWeight: r.tipo === 'header' || r.tipo === 'subtotal' ? 600 : 400, color: r.tipo === 'warning' ? '#92400e' : '#374151' }}>
                  {r.tipo === 'warning' && <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom', color: '#d97706' }} />}
                  {r.label}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'tabular-nums', fontWeight: r.tipo === 'header' || r.tipo === 'subtotal' ? 600 : 400, color: r.tipo === 'costo' || r.tipo === 'subtotal' ? '#dc2626' : r.tipo === 'ricavo' ? '#059669' : r.tipo === 'ricavo_light' ? '#6b7280' : r.tipo === 'warning' ? '#d97706' : '#111827' }}>
                  EUR {fmt(r.value)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#9ca3af', fontSize: 12, width: 70 }}>
                  {r.tipo !== 'header' && ce.importoContratto > 0 ? (r.value / ce.importoContratto * 100).toFixed(1) + '%' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px' }}>Avanzamento commessa</h3>
        {[
          { label: 'Ricavo contratto', v: ce.importoContratto, pct: 100, color: '#94a3b8' },
          { label: 'SAL emessi (ricavo maturato)', v: ce.ricaviEmessi, pct: avSal, color: '#2563eb' },
          { label: 'SAL incassati', v: ce.ricaviIncassati, pct: avPag, color: '#059669' },
          { label: 'Costi impegnati', v: totCosti, pct: avCosti, color: '#dc2626' },
        ].map(({ label, v, pct, color }, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: '#6b7280' }}>{label}</span>
              <span style={{ fontWeight: 600 }}>EUR {fmt(v)} ({pct.toFixed(1)}%)</span>
            </div>
            <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: color, borderRadius: 4, width: pct + '%', transition: 'width 0.8s ease' }} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', width: 'fit-content' }}>
        <RefreshCw size={12} /> Aggiorna
      </button>
    </div>
  )
}
