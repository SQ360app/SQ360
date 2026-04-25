'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (v: number, tot: number) => tot > 0 ? (v / tot * 100).toFixed(1) + '%' : '-'

export default function ContoEconomicoPage() {
  const { id } = useParams() as { id: string }
  const [ce, setCe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)

    // Carica commessa
    const { data: commessa } = await supabase.from('commesse').select('*').eq('id', id).single()

    // Importo contratto: cerca diverse colonne possibili
    const importoContratto =
      commessa?.importo_contratto ||
      commessa?.importo_netto_aggiudicato ||
      commessa?.importo_netto ||
      commessa?.importo_aggiudicato ||
      commessa?.importo_base_asta ||
      0

    // SAL Attivi
    const { data: salAttivi } = await supabase
      .from('sal_attivi').select('importo_netto_sal, stato').eq('commessa_id', id)
    const ricaviSalEmessi = (salAttivi || [])
      .filter(s => s.stato !== 'BOZZA')
      .reduce((s, x) => s + (x.importo_netto_sal || 0), 0)
    const ricaviIncassati = (salAttivi || [])
      .filter(s => s.stato === 'PAGATO')
      .reduce((s, x) => s + (x.importo_netto_sal || 0), 0)

    // ODA — costi impegnati
    const { data: odaList } = await supabase
      .from('oda').select('importo_netto, stato').eq('commessa_id', id)
    const costiOda = (odaList || [])
      .filter(o => o.stato !== 'ANNULLATO')
      .reduce((s, x) => s + (x.importo_netto || 0), 0)

    // Spese cantiere
    const { data: speseList } = await supabase
      .from('spese_cantiere').select('importo_netto, stato').eq('commessa_id', id)
    const costiSpese = (speseList || [])
      .filter(s => ['REGISTRATA', 'APPROVATA'].includes(s.stato))
      .reduce((s, x) => s + (x.importo_netto || 0), 0)

    // SAL Passivi — ritenute trattenute
    const { data: salPassivi } = await supabase
      .from('sal_passivi').select('ritenuta_importo, stato').eq('commessa_id', id)
    const ritenutaAccumulata = (salPassivi || [])
      .filter(s => ['APPROVATO', 'PAGATO'].includes(s.stato))
      .reduce((s, x) => s + (x.ritenuta_importo || 0), 0)

    // Fatture passive pagate
    const { data: fatture } = await supabase
      .from('fatture_passive').select('imponibile, stato').eq('commessa_id', id)
    const costiPagati = (fatture || [])
      .filter(f => f.stato === 'PAGATA')
      .reduce((s, x) => s + (x.imponibile || 0), 0)

    // Assegnazioni voci — budget previsto
    const { data: assegnazioni } = await supabase
      .from('voce_assegnazione').select('importo_previsto, tipo_canale').eq('commessa_id', id)
    const budgetAssegnato = (assegnazioni || [])
      .reduce((s, x) => s + (x.importo_previsto || 0), 0)
    const budgetSubappalti = (assegnazioni || [])
      .filter(a => a.tipo_canale === 'SUBAPPALTO')
      .reduce((s, x) => s + (x.importo_previsto || 0), 0)
    const budgetAcquisti = (assegnazioni || [])
      .filter(a => a.tipo_canale === 'ACQUISTO_DIRETTO')
      .reduce((s, x) => s + (x.importo_previsto || 0), 0)
    const budgetSubaffidamenti = (assegnazioni || [])
      .filter(a => a.tipo_canale === 'SUBAFFIDAMENTO')
      .reduce((s, x) => s + (x.importo_previsto || 0), 0)
    const budgetProprio = (assegnazioni || [])
      .filter(a => a.tipo_canale === 'LAVORO_PROPRIO')
      .reduce((s, x) => s + (x.importo_previsto || 0), 0)

    setCe({
      importo_contratto: importoContratto,
      ricavi_sal_emessi: ricaviSalEmessi,
      ricavi_incassati: ricaviIncassati,
      costi_oda: costiOda,
      costi_spese: costiSpese,
      costi_pagati: costiPagati,
      ritenuta_accumulata: ritenutaAccumulata,
      budget_assegnato: budgetAssegnato,
      budget_subappalti: budgetSubappalti,
      budget_acquisti: budgetAcquisti,
      budget_subaffidamenti: budgetSubaffidamenti,
      budget_proprio: budgetProprio,
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, fontSize: 14, color: '#9ca3af' }}>
      <Loader2 size={16} className="animate-spin" /> Calcolo conto economico...
    </div>
  )

  if (!ce) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>Nessun dato disponibile</div>
  )

  const totCostiImpegnati = ce.costi_oda + ce.costi_spese
  const margine = ce.importo_contratto - totCostiImpegnati
  const marginePct = ce.importo_contratto > 0 ? (margine / ce.importo_contratto * 100) : 0
  const marginePreventivato = ce.importo_contratto - ce.budget_assegnato
  const marginePctPrev = ce.importo_contratto > 0 ? (marginePreventivato / ce.importo_contratto * 100) : 0

  const mColor = marginePct > 10 ? '#059669' : marginePct > 0 ? '#d97706' : '#dc2626'
  const mBg    = marginePct > 10 ? '#f0fdf4' : marginePct > 0 ? '#fffbeb' : '#fef2f2'
  const mBorder= marginePct > 10 ? '#bbf7d0' : marginePct > 0 ? '#fef3c7' : '#fecaca'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── MARGINE BOX PRINCIPALE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: mBg, border: '1px solid ' + mBorder, borderRadius: 12, padding: '20px 24px' }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>Margine lordo consuntivo (vs ODA)</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: mColor, margin: '0 0 4px' }}>EUR {fmt(margine)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {marginePct > 10 ? <TrendingUp size={18} style={{ color: mColor }} />
              : marginePct > 0 ? <Minus size={18} style={{ color: mColor }} />
              : <TrendingDown size={18} style={{ color: mColor }} />}
            <span style={{ fontSize: 18, fontWeight: 700, color: mColor }}>{marginePct.toFixed(1)}%</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>sul contratto</span>
          </div>
        </div>
        <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 12, padding: '20px 24px' }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>Margine preventivato (vs assegnazioni)</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: '#4f46e5', margin: '0 0 4px' }}>EUR {fmt(marginePreventivato)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#4f46e5' }}>{marginePctPrev.toFixed(1)}%</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>sul contratto</span>
          </div>
        </div>
      </div>

      {/* ── CONTO ECONOMICO DETTAGLIATO ── */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#374151' }}>Conto Economico Commessa</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Voce</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: 160 }}>Importo</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: 80 }}>% su contr.</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'IMPORTO CONTRATTO', value: ce.importo_contratto, tipo: 'header', indent: 0 },
              { label: 'SAL attivi emessi (ricavo maturato)', value: ce.ricavi_sal_emessi, tipo: 'ricavo', indent: 1 },
              { label: 'di cui incassati', value: ce.ricavi_incassati, tipo: 'ricavo_light', indent: 2 },
              { label: null, value: 0, tipo: 'separator', indent: 0 },
              { label: 'COSTI IMPEGNATI', value: totCostiImpegnati, tipo: 'section', indent: 0 },
              { label: 'Da ODA / contratti', value: ce.costi_oda, tipo: 'costo', indent: 1 },
              { label: 'Spese cantiere registrate', value: ce.costi_spese, tipo: 'costo', indent: 1 },
              { label: 'Fatture passive pagate', value: ce.costi_pagati, tipo: 'costo_light', indent: 2 },
              { label: null, value: 0, tipo: 'separator', indent: 0 },
              { label: 'BUDGET ASSEGNAZIONI', value: ce.budget_assegnato, tipo: 'section', indent: 0 },
              { label: 'Subappalti', value: ce.budget_subappalti, tipo: 'neutral', indent: 1 },
              { label: 'Acquisti diretti', value: ce.budget_acquisti, tipo: 'neutral', indent: 1 },
              { label: 'Subaffidamenti', value: ce.budget_subaffidamenti, tipo: 'neutral', indent: 1 },
              { label: 'Lavoro proprio', value: ce.budget_proprio, tipo: 'neutral', indent: 1 },
              { label: null, value: 0, tipo: 'separator', indent: 0 },
              { label: 'Ritenute trattenute (sbloccate a collaudo)', value: ce.ritenuta_accumulata, tipo: 'warning', indent: 0 },
            ].map((r, i) => {
              if (r.tipo === 'separator') return <tr key={i}><td colSpan={3} style={{ padding: '4px 0', background: '#f9fafb' }} /></tr>
              return (
                <tr key={i} style={{
                  borderBottom: '1px solid #f3f4f6',
                  background: r.tipo === 'header' ? '#f0f9ff'
                    : r.tipo === 'section' ? '#fafafa'
                    : r.tipo === 'warning' ? '#fffbeb'
                    : '#fff',
                }}>
                  <td style={{
                    padding: '10px 16px',
                    paddingLeft: 16 + (r.indent * 16),
                    fontWeight: r.tipo === 'header' || r.tipo === 'section' ? 700 : 400,
                    color: r.tipo === 'warning' ? '#92400e' : '#374151',
                    fontSize: r.tipo === 'ricavo_light' || r.tipo === 'costo_light' ? 12 : 13,
                  }}>
                    {r.tipo === 'warning' && <AlertTriangle size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom', color: '#d97706' }} />}
                    {r.label}
                  </td>
                  <td style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    fontWeight: r.tipo === 'header' || r.tipo === 'section' ? 700 : 400,
                    color: r.tipo === 'costo' || r.tipo === 'costo_light' ? '#dc2626'
                      : r.tipo === 'ricavo' ? '#059669'
                      : r.tipo === 'ricavo_light' ? '#6b7280'
                      : r.tipo === 'warning' ? '#d97706'
                      : r.tipo === 'header' ? '#1d4ed8'
                      : '#374151',
                    fontFamily: 'tabular-nums',
                    fontSize: r.tipo === 'ricavo_light' || r.tipo === 'costo_light' ? 12 : 13,
                  }}>
                    EUR {fmt(r.value)}
                  </td>
                  <td style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    color: '#9ca3af',
                    fontSize: 12,
                    fontFamily: 'tabular-nums',
                  }}>
                    {r.tipo !== 'header' && r.tipo !== 'separator' && r.tipo !== 'section' ? pct(r.value, ce.importo_contratto) : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── AVANZAMENTO SAL ── */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 14px', color: '#374151' }}>Avanzamento SAL verso committente</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { l: 'Contratto', v: ce.importo_contratto, color: '#374151' },
            { l: 'SAL emessi', v: ce.ricavi_sal_emessi, color: '#2563eb' },
            { l: 'Incassato', v: ce.ricavi_incassati, color: '#059669' },
          ].map(({ l, v, color }, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color, marginBottom: 6 }}>EUR {fmt(v)}</div>
              {ce.importo_contratto > 0 && (
                <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: color, borderRadius: 4, width: Math.min(100, v / ce.importo_contratto * 100) + '%', transition: 'width 0.5s' }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{pct(v, ce.importo_contratto)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIPARTIZIONE COSTI PER CANALE ── */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 14px', color: '#374151' }}>Ripartizione budget per canale di acquisto</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { l: 'Subappalti', v: ce.budget_subappalti, color: '#7c3aed', bg: '#ede9fe' },
            { l: 'Acquisti diretti', v: ce.budget_acquisti, color: '#059669', bg: '#d1fae5' },
            { l: 'Subaffidamenti', v: ce.budget_subaffidamenti, color: '#2563eb', bg: '#dbeafe' },
            { l: 'Lavoro proprio', v: ce.budget_proprio, color: '#d97706', bg: '#fef3c7' },
          ].map(({ l, v, color, bg }, i) => (
            <div key={i} style={{ background: bg, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color }}>EUR {fmt(v)}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{pct(v, ce.importo_contratto)}</div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', width: 'fit-content' }}>
        <RefreshCw size={12} /> Aggiorna
      </button>
    </div>
  )
}'use client'

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
