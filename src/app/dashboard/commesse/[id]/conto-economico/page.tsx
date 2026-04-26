'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n: number, t: number) => t > 0 ? ((n / t) * 100).toFixed(1) + '%' : '0.0%'

export default function ContoEconomicoPage() {
  const { id } = useParams() as { id: string }
  const [ce, setCe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)

    // IMPORTO CONTRATTO: legge SUM reale dal computo (non campo statico)
    const { data: voci } = await supabase
      .from('voci_computo')
      .select('importo')
      .eq('commessa_id', id)
    const importoContratto = (voci || []).reduce((s: number, v: any) => s + (Number(v.importo) || 0), 0)

    // SAL attivi (ricavi maturati)
    const { data: sal } = await supabase
      .from('sal_attivi')
      .select('importo_netto_sal, stato')
      .eq('commessa_id', id)
    const ricaviEmessi   = (sal || []).filter((s: any) => s.stato !== 'BOZZA').reduce((s: number, x: any) => s + (x.importo_netto_sal || 0), 0)
    const ricaviIncassati = (sal || []).filter((s: any) => s.stato === 'PAGATO').reduce((s: number, x: any) => s + (x.importo_netto_sal || 0), 0)

    // Costi da ODA e contratti
    const { data: odaList } = await supabase.from('oda').select('importo_netto, stato').eq('commessa_id', id)
    const costiOda = (odaList || []).filter((o: any) => o.stato !== 'ANNULLATO').reduce((s: number, x: any) => s + (x.importo_netto || 0), 0)

    // Spese cantiere
    const { data: speseList } = await supabase.from('spese_cantiere').select('importo_netto, stato').eq('commessa_id', id)
    const costiSpese = (speseList || []).filter((s: any) => ['REGISTRATA', 'APPROVATA'].includes(s.stato)).reduce((s: number, x: any) => s + (x.importo_netto || 0), 0)

    // Ritenute accumulate (svincolate a collaudo)
    const { data: salP } = await supabase.from('sal_passivi').select('ritenuta_importo, stato').eq('commessa_id', id)
    const ritenute = (salP || []).filter((s: any) => ['APPROVATO', 'PAGATO'].includes(s.stato)).reduce((s: number, x: any) => s + (x.ritenuta_importo || 0), 0)

    // Contratti sub impegnati
    const { data: contSub } = await supabase.from('contratti_sub').select('importo_netto, stato').eq('commessa_id', id)
    const costiContrattiSub = (contSub || []).filter((c: any) => c.stato !== 'ANNULLATO').reduce((s: number, x: any) => s + (x.importo_netto || 0), 0)

    setCe({ importoContratto, ricaviEmessi, ricaviIncassati, costiOda, costiSpese, ritenute, costiContrattiSub })
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: '#9ca3af' }}>
      <Loader2 size={18} className="animate-spin" /> Caricamento Conto Economico...
    </div>
  )

  const { importoContratto, ricaviEmessi, ricaviIncassati, costiOda, costiSpese, ritenute, costiContrattiSub } = ce
  const totCosti = costiOda + costiSpese
  const margineNetto = importoContratto - totCosti
  const marginePerc = importoContratto > 0 ? (margineNetto / importoContratto) * 100 : 0
  const avanzamento = importoContratto > 0 ? (ricaviEmessi / importoContratto) * 100 : 0

  const MargineIcon = marginePerc >= 15 ? TrendingUp : marginePerc >= 5 ? Minus : TrendingDown
  const margineColor = marginePerc >= 15 ? '#059669' : marginePerc >= 5 ? '#d97706' : '#dc2626'

  const Row = ({ label, value, sub, color, bold }: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 13, color: sub ? '#9ca3af' : '#374151', paddingLeft: sub ? 20 : 0, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color || '#111827' }}>EUR {fmt(value)}</span>
        {importoContratto > 0 && !sub && (
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{pct(value, importoContratto)}</span>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Margine lordo previsto */}
      <div style={{ background: marginePerc >= 15 ? '#f0fdf4' : marginePerc >= 5 ? '#fffbeb' : '#fef2f2', border: '1px solid ' + (marginePerc >= 15 ? '#bbf7d0' : marginePerc >= 5 ? '#fde68a' : '#fecaca'), borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px', fontWeight: 500 }}>Margine lordo previsto</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: margineColor, margin: 0 }}>EUR {fmt(margineNetto)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
            <MargineIcon size={20} style={{ color: margineColor }} />
            <span style={{ fontSize: 32, fontWeight: 800, color: margineColor }}>{marginePerc.toFixed(1)}%</span>
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>su importo contratto</p>
        </div>
      </div>

      {/* Conto economico dettaglio */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>

        <Row label="Importo contratto netto (da computo)" value={importoContratto} bold />
        <Row label="SAL attivi emessi (ricavo maturato)" value={ricaviEmessi} color="#059669" />
        <Row label="di cui incassati dal committente" value={ricaviIncassati} sub color="#059669" />

        <div style={{ height: 8 }} />

        <Row label="Costi da ODA impegnati" value={costiOda} color="#dc2626" />
        <Row label="Costi da contratti sub" value={costiContrattiSub} color="#dc2626" />
        <Row label="Spese cantiere contabilizzate" value={costiSpese} color="#dc2626" />
        <Row label="Totale costi impegnati" value={totCosti} bold color="#dc2626" />

        {ritenute > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <AlertTriangle size={13} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#d97706', flex: 1 }}>Ritenute accumulate (sbloccate a collaudo)</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#d97706' }}>EUR {fmt(ritenute)}</span>
          </div>
        )}

        <div style={{ height: 8 }} />
        <Row label="Margine lordo previsto" value={margineNetto} bold color={margineColor} />
      </div>

      {/* Avanzamento commessa */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px', color: '#374151' }}>Avanzamento commessa</h3>

        {[
          { label: 'Ricavo contratto', value: importoContratto, color: '#6b7280', pctVal: 100 },
          { label: 'SAL emessi (ricavo maturato)', value: ricaviEmessi, color: '#059669', pctVal: avanzamento },
          { label: 'SAL incassati', value: ricaviIncassati, color: '#2563eb', pctVal: importoContratto > 0 ? (ricaviIncassati / importoContratto) * 100 : 0 },
          { label: 'Costi impegnati', value: totCosti, color: '#dc2626', pctVal: importoContratto > 0 ? (totCosti / importoContratto) * 100 : 0 },
        ].map(({ label, value, color, pctVal }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>EUR {fmt(value)} ({pctVal.toFixed(1)}%)</span>
            </div>
            <div style={{ height: 6, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: color, borderRadius: 4, width: Math.min(100, pctVal) + '%', transition: 'width 0.8s ease' }} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280', alignSelf: 'flex-start' }}>
        <RefreshCw size={13} /> Aggiorna dati
      </button>
    </div>
  )
}
