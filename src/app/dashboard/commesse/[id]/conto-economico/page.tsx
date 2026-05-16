'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (n: number, t: number) => t > 0 ? ((n / t) * 100).toFixed(1) + '%' : '0.0%'

const TIPI_ODA_CE = [
  { value: 'materiali',   label: 'Acquisto Materiali',  color: '#3b82f6' },
  { value: 'nolo_freddo', label: 'Nolo a Freddo',       color: '#8b5cf6' },
  { value: 'nolo_caldo',  label: 'Nolo a Caldo',        color: '#7c3aed' },
  { value: 'subappalto',  label: 'Subappalto',          color: '#f59e0b' },
  { value: 'manodopera',  label: 'Manodopera Esterna',  color: '#10b981' },
  { value: 'servizio',    label: 'Servizio/Consulenza', color: '#6b7280' },
]

export default function ContoEconomicoPage() {
  const { id } = useParams() as { id: string }
  const [ce, setCe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)

    // 1. Ricavo contrattuale ufficiale (da commessa)
    const { data: commessa } = await supabase
      .from('commesse')
      .select('importo_contratto')
      .eq('id', id)
      .single()
    const ricavoContratto = commessa?.importo_contratto || 0

    // 2. Budget computo (somma voci_computo via computo_metrico)
    const { data: computo } = await supabase
      .from('computo_metrico')
      .select('id')
      .eq('commessa_id', id)
      .maybeSingle()
    const hasComputo = !!computo
    let budgetComputo = 0
    if (computo) {
      const { data: voci } = await supabase
        .from('voci_computo')
        .select('importo')
        .eq('computo_id', computo.id)
      budgetComputo = (voci || []).reduce((s: number, v: any) => s + (Number(v.importo) || 0), 0)
    }
    // Fallback: se nessun computo importato, usa importo_contratto come riferimento budget
    if (!hasComputo) budgetComputo = ricavoContratto

    // 3. SAL attivi (ricavi maturati)
    const { data: sal } = await supabase
      .from('sal_attivi')
      .select('importo_certificato, stato')
      .eq('commessa_id', id)
    const ricaviEmessi    = (sal || []).filter((s: any) => s.stato !== 'bozza').reduce((s: number, x: any) => s + (x.importo_certificato || 0), 0)
    const ricaviIncassati = (sal || []).filter((s: any) => s.stato === 'pagato').reduce((s: number, x: any) => s + (x.importo_certificato || 0), 0)

    // 4. Costi da ODA impegnati
    const { data: odaList } = await supabase.from('oda').select('importo_netto, stato, tipo_oda').eq('commessa_id', id)
    const odaAttivi = (odaList || []).filter((o: any) => o.stato !== 'ANNULLATO')
    const costiOda = odaAttivi.reduce((s: number, x: any) => s + (x.importo_netto || 0), 0)
    const odaPerTipo: Record<string, number> = {}
    for (const o of odaAttivi) {
      const k = o.tipo_oda || 'altro'
      odaPerTipo[k] = (odaPerTipo[k] || 0) + (o.importo_netto || 0)
    }

    // 5. Costi da fatture passive effettivamente pagate (consuntivo reale)
    const { data: fatture } = await supabase
      .from('fatture_passive')
      .select('totale, stato')
      .eq('commessa_id', id)
    const costiPagati = (fatture || []).filter((f: any) => f.stato === 'pagata').reduce((s: number, f: any) => s + (f.totale || 0), 0)
    const costiDaPagare = (fatture || []).filter((f: any) => !['pagata','contestata'].includes(f.stato)).reduce((s: number, f: any) => s + (f.totale || 0), 0)

    // 6. Spese cantiere
    const { data: speseList } = await supabase.from('spese_cantiere').select('importo_netto, stato').eq('commessa_id', id)
    const costiSpese = (speseList || []).filter((s: any) => ['REGISTRATA', 'APPROVATA'].includes(s.stato)).reduce((s: number, x: any) => s + (x.importo_netto || 0), 0)

    // 7. Ritenute accumulate
    const { data: salP } = await supabase.from('sal_passivi').select('ritenuta_importo, stato').eq('commessa_id', id)
    const ritenute = (salP || []).filter((s: any) => ['APPROVATO', 'PAGATO'].includes(s.stato)).reduce((s: number, x: any) => s + (x.ritenuta_importo || 0), 0)

    // 8. Contratti sub impegnati
    const { data: contSub } = await supabase.from('contratti_sub').select('importo_netto, stato').eq('commessa_id', id)
    const costiContrattiSub = (contSub || []).filter((c: any) => c.stato !== 'ANNULLATO').reduce((s: number, x: any) => s + (x.importo_netto || 0), 0)

    setCe({ ricavoContratto, budgetComputo, hasComputo, ricaviEmessi, ricaviIncassati, costiOda, odaPerTipo, costiPagati, costiDaPagare, costiSpese, ritenute, costiContrattiSub })
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: '#9ca3af' }}>
      <Loader2 size={18} className="animate-spin" /> Caricamento Conto Economico...
    </div>
  )

  const { ricavoContratto, budgetComputo, hasComputo, ricaviEmessi, ricaviIncassati, costiOda, odaPerTipo, costiPagati, costiDaPagare, costiSpese, ritenute, costiContrattiSub } = ce
  const totCostiImpegnati = costiOda + costiSpese + costiContrattiSub
  const margineAtteso  = ricavoContratto - totCostiImpegnati
  const margineAttuale = ricavoContratto - costiPagati
  const margineAttesoPerc  = ricavoContratto > 0 ? (margineAtteso  / ricavoContratto) * 100 : 0
  const margineAttualePerc = ricavoContratto > 0 ? (margineAttuale / ricavoContratto) * 100 : 0
  const avanzamento = ricavoContratto > 0 ? (ricaviEmessi / ricavoContratto) * 100 : 0

  const MargineIcon = margineAttesoPerc >= 15 ? TrendingUp : margineAttesoPerc >= 5 ? Minus : TrendingDown
  const margineColor = margineAttesoPerc >= 15 ? '#059669' : margineAttesoPerc >= 5 ? '#d97706' : '#dc2626'
  const margineAttualeColor = margineAttualePerc >= 15 ? '#059669' : margineAttualePerc >= 5 ? '#d97706' : '#dc2626'

  const Row = ({ label, value, sub, color, bold }: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 13, color: sub ? '#9ca3af' : '#374151', paddingLeft: sub ? 20 : 0, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color || '#111827' }}>€ {fmt(value)}</span>
        {ricavoContratto > 0 && !sub && (
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{pct(value, ricavoContratto)}</span>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {!hasComputo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>Nessun computo metrico importato — il budget di lista usa l'importo contratto come riferimento. Vai al tab <strong>Computo</strong> per importare il file XPWE.</span>
        </div>
      )}

      {/* Doppio margine: atteso vs attuale */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: margineAttesoPerc >= 15 ? '#f0fdf4' : margineAttesoPerc >= 5 ? '#fffbeb' : '#fef2f2', border: '1px solid ' + (margineAttesoPerc >= 15 ? '#bbf7d0' : margineAttesoPerc >= 5 ? '#fde68a' : '#fecaca'), borderRadius: 12, padding: '20px 24px' }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Margine atteso (ODA impegnati)</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: margineColor, margin: '0 0 4px' }}>€ {fmt(margineAtteso)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MargineIcon size={16} style={{ color: margineColor }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: margineColor }}>{margineAttesoPerc.toFixed(1)}%</span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>su contratto</span>
          </div>
        </div>
        <div style={{ background: costiPagati > 0 ? (margineAttualePerc >= 15 ? '#f0fdf4' : margineAttualePerc >= 5 ? '#fffbeb' : '#fef2f2') : '#f9fafb', border: '1px solid ' + (costiPagati > 0 ? (margineAttualePerc >= 15 ? '#bbf7d0' : margineAttualePerc >= 5 ? '#fde68a' : '#fecaca') : '#e5e7eb'), borderRadius: 12, padding: '20px 24px' }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Margine attuale (fatture pagate)</p>
          {costiPagati > 0 ? (
            <>
              <p style={{ fontSize: 26, fontWeight: 700, color: margineAttualeColor, margin: '0 0 4px' }}>€ {fmt(margineAttuale)}</p>
              <span style={{ fontSize: 20, fontWeight: 800, color: margineAttualeColor }}>{margineAttualePerc.toFixed(1)}%</span>
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>su contratto</span>
            </>
          ) : (
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '8px 0 0', fontStyle: 'italic' }}>Nessuna fattura pagata ancora</p>
          )}
        </div>
      </div>

      {/* Conto economico dettaglio */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ricavi</h3>
        <Row label="Ricavo contrattuale ufficiale" value={ricavoContratto} bold />
        <Row label={hasComputo ? 'Budget computo di lista' : 'Budget computo di lista (≡ contratto, nessun XPWE)'} value={budgetComputo} sub color={!hasComputo ? '#d97706' : budgetComputo > ricavoContratto ? '#dc2626' : '#6b7280'} />
        <Row label="SAL attivi emessi (ricavo maturato)" value={ricaviEmessi} color="#059669" />
        <Row label="di cui incassati dal committente" value={ricaviIncassati} sub color="#059669" />

        <div style={{ height: 12 }} />
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Costi impegnati (ODA)</h3>
        <Row label="Costi da ODA attivi" value={costiOda} color="#dc2626" />
        <Row label="Costi da contratti sub" value={costiContrattiSub} color="#dc2626" />
        <Row label="Spese cantiere contabilizzate" value={costiSpese} color="#dc2626" />
        <Row label="Totale costi impegnati" value={totCostiImpegnati} bold color="#dc2626" />

        <div style={{ height: 12 }} />
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Costi consuntivati (fatture)</h3>
        <Row label="Fatture pagate" value={costiPagati} color="#7c3aed" bold />
        <Row label="Fatture da pagare" value={costiDaPagare} sub color="#d97706" />

        {ritenute > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6', marginTop: 4 }}>
            <AlertTriangle size={13} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#d97706', flex: 1 }}>Ritenute accumulate (sbloccate a collaudo)</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#d97706' }}>€ {fmt(ritenute)}</span>
          </div>
        )}

        <div style={{ height: 12 }} />
        <Row label="Margine atteso (contratto − ODA)" value={margineAtteso} bold color={margineColor} />
        <Row label="Margine attuale (contratto − fatture pagate)" value={margineAttuale} bold color={margineAttualeColor} />
      </div>

      {/* Breakdown ODA per categoria */}
      {costiOda > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Costi ODA per categoria</h3>
          {TIPI_ODA_CE.map(t => {
            const val = odaPerTipo[t.value] || 0
            if (val === 0) return null
            return (
              <div key={t.value} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{t.label}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>€ {fmt(val)}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{((val / costiOda) * 100).toFixed(1)}%</span>
                </div>
              </div>
            )
          })}
          {odaPerTipo['altro'] > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>Altro / non categorizzato</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>€ {fmt(odaPerTipo['altro'])}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0', fontWeight: 700 }}>
            <span style={{ fontSize: 13, color: '#374151' }}>Totale ODA impegnati</span>
            <span style={{ fontSize: 13, color: '#dc2626' }}>€ {fmt(costiOda)}</span>
          </div>
        </div>
      )}

      {/* Avanzamento commessa */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px', color: '#374151' }}>Avanzamento commessa</h3>
        {[
          { label: 'Ricavo contratto', value: ricavoContratto, color: '#6b7280', pctVal: 100 },
          { label: 'SAL emessi (ricavo maturato)', value: ricaviEmessi, color: '#059669', pctVal: avanzamento },
          { label: 'SAL incassati', value: ricaviIncassati, color: '#2563eb', pctVal: ricavoContratto > 0 ? (ricaviIncassati / ricavoContratto) * 100 : 0 },
          { label: 'Costi ODA impegnati', value: totCostiImpegnati, color: '#dc2626', pctVal: ricavoContratto > 0 ? (totCostiImpegnati / ricavoContratto) * 100 : 0 },
          { label: 'Fatture pagate (consuntivo)', value: costiPagati, color: '#7c3aed', pctVal: ricavoContratto > 0 ? (costiPagati / ricavoContratto) * 100 : 0 },
        ].map(({ label, value, color, pctVal }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>€ {fmt(value)} ({pctVal.toFixed(1)}%)</span>
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
