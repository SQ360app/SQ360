'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (v: number, tot: number) => tot > 0 ? (v / tot * 100).toFixed(1) + '%' : '\u2014'

export default function ContoEconomicoPage() {
  const params = useParams()
  const commessaId = params.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: ce } = await supabase.from('vw_conto_economico').select('*').eq('commessa_id', commessaId).single()
    setData(ce)
    setLoading(false)
  }

  useEffect(() => { load() }, [commessaId])

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-sm text-gray-400 gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Calcolo conto economico...
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-48 text-sm text-gray-400">
      Nessun dato disponibile
    </div>
  )

  const totCosti = (data.costi_oda_impegnati || 0) + (data.costi_spese_cantiere || 0)
  const margine = (data.importo_contratto || 0) - totCosti
  const marginePct = data.importo_contratto > 0 ? (margine / data.importo_contratto * 100) : 0

  return (
    <div className="space-y-4">
      {/* Margine principale */}
      <div className={`rounded-xl border p-5 ${marginePct > 10 ? 'bg-green-50 border-green-100' : marginePct > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Margine lordo previsto</p>
            <p className={`text-2xl font-semibold ${marginePct > 10 ? 'text-green-700' : marginePct > 0 ? 'text-yellow-700' : 'text-red-700'}`}>\u20ac {fmt(margine)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">su importo contratto</p>
            <div className="flex items-center gap-1 justify-end">
              {marginePct > 10 ? <TrendingUp className="w-5 h-5 text-green-600" /> : marginePct > 0 ? <Minus className="w-5 h-5 text-yellow-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
              <span className={`text-xl font-semibold ${marginePct > 10 ? 'text-green-700' : marginePct > 0 ? 'text-yellow-700' : 'text-red-700'}`}>{marginePct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dettaglio righe */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Conto Economico</span>
          <button onClick={load} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-3 h-3" /> Aggiorna
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {[
              { label: 'Importo contratto', val: data.importo_contratto, tipo: 'header' },
              { label: 'SAL attivi emessi', val: data.ricavi_sal_emessi, tipo: 'ricavo', sub: true },
              { label: 'di cui incassati', val: data.ricavi_incassati, tipo: 'ricavo_light', sub: true },
              { label: 'Costi da ODA / contratti impegnati', val: data.costi_oda_impegnati, tipo: 'costo', sub: false },
              { label: 'Spese cantiere registrate', val: data.costi_spese_cantiere, tipo: 'costo', sub: false },
              { label: 'Totale costi', val: totCosti, tipo: 'subtotal', sub: false },
              { label: 'MARGINE LORDO PREVISTO', val: margine, tipo: 'margine', sub: false },
              { label: 'Ritenute accumulate (sblocco a collaudo)', val: data.ritenute_accumulate, tipo: 'warning', sub: false },
            ].map((r, i) => (
              <tr key={i} className={`border-b border-gray-50 last:border-0 ${r.tipo === 'header' ? 'bg-gray-50' : r.tipo === 'subtotal' ? 'bg-gray-50 border-t border-gray-200' : r.tipo === 'margine' ? (marginePct > 10 ? 'bg-green-50' : marginePct > 0 ? 'bg-yellow-50' : 'bg-red-50') : r.tipo === 'warning' ? 'bg-yellow-50/50' : ''}`}>
                <td className={`py-2.5 px-4 ${r.sub ? 'pl-8 text-gray-500 text-xs' : 'text-gray-700'} ${r.tipo === 'margine' || r.tipo === 'subtotal' || r.tipo === 'header' ? 'font-medium' : ''}`}>
                  {r.tipo === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 inline mr-1.5" />}
                  {r.label}
                </td>
                <td className={`py-2.5 px-4 text-right tabular-nums ${r.tipo === 'costo' || r.tipo === 'subtotal' ? 'text-red-600' : r.tipo === 'ricavo' ? 'text-green-600' : r.tipo === 'ricavo_light' ? 'text-green-400' : r.tipo === 'margine' ? (marginePct > 10 ? 'text-green-700 font-semibold' : marginePct > 0 ? 'text-yellow-700 font-semibold' : 'text-red-700 font-semibold') : r.tipo === 'warning' ? 'text-yellow-700' : 'text-gray-900'}`}>
                  \u20ac {fmt(r.val || 0)}
                </td>
                <td className="py-2.5 px-4 text-right text-xs text-gray-400 w-20">
                  {r.tipo !== 'header' && r.tipo !== 'margine' ? pct(r.val || 0, data.importo_contratto) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <div className="text-xs text-gray-400 space-y-1 px-1">
        <p>\u2022 <strong>Costi impegnati</strong>: somma di tutti gli ODA non annullati</p>
        <p>\u2022 <strong>Spese cantiere</strong>: spese registrate e approvate (corsia veloce)</p>
        <p>\u2022 <strong>Ritenute</strong>: trattenute 5% sui SAL subappaltatori, sbloccate a collaudo</p>
        <p>\u2022 Il margine si aggiorna in tempo reale ad ogni ODA emesso o spesa registrata</p>
      </div>
    </div>
  )
}
