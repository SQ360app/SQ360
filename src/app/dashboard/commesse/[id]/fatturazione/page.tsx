'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, CheckCircle2, Clock, AlertTriangle, FileText, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATI_ATTIVA: Record<string, { l: string; c: string; bg: string }> = {
  BOZZA:       { l: 'Bozza',       c: '#6b7280', bg: '#f3f4f6' },
  EMESSA:      { l: 'Emessa',      c: '#2563eb', bg: '#eff6ff' },
  TRASMESSA:   { l: 'Trasmessa SA',c: '#d97706', bg: '#fffbeb' },
  PAGATA:      { l: 'Pagata',      c: '#059669', bg: '#f0fdf4' },
  CONTESTATA:  { l: 'Contestata',  c: '#dc2626', bg: '#fef2f2' },
  STORNATA:    { l: 'Stornata',    c: '#7c3aed', bg: '#f5f3ff' },
}

const STATI_PASSIVA: Record<string, { l: string; c: string; bg: string }> = {
  DA_PAGARE:         { l: 'Da pagare',     c: '#d97706', bg: '#fffbeb' },
  IN_APPROVAZIONE:   { l: 'In approvaz.',  c: '#2563eb', bg: '#eff6ff' },
  APPROVATA:         { l: 'Approvata',     c: '#059669', bg: '#f0fdf4' },
  PAGATA:            { l: 'Pagata',        c: '#374151', bg: '#f9fafb' },
  CONTESTATA:        { l: 'Contestata',    c: '#dc2626', bg: '#fef2f2' },
  BLOCCATA_DURC:     { l: 'Bloccata DURC', c: '#dc2626', bg: '#fef2f2' },
}

export default function FatturazionePage() {
  const { id } = useParams() as { id: string }
  const [tab, setTab] = useState<'ATTIVE' | 'PASSIVE'>('ATTIVE')
  const [fattureAttive, setFattureAttive] = useState<any[]>([])
  const [fatturePassive, setFatturePassive] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formA, setFormA] = useState({ numero: '', data: '', importo_netto: '', iva_pct: '22', sal_id: '', note: '' })
  const [formP, setFormP] = useState({ numero_fattura: '', data_fattura: '', fornitore_id: '', importo_netto: '', iva_pct: '22', oda_id: '', note: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: fa }, { data: fp }, { data: f }] = await Promise.all([
      supabase.from('fatture').select('*').eq('commessa_id', id).eq('tipo', 'ATTIVA').order('created_at', { ascending: false }),
      supabase.from('fatture_passive').select('*, fornitore:fornitori(ragione_sociale)').eq('commessa_id', id).order('created_at', { ascending: false }),
      supabase.from('fornitori').select('id, ragione_sociale').order('ragione_sociale'),
    ])
    setFattureAttive(fa || [])
    setFatturePassive(fp || [])
    setFornitori(f || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function saveAttiva() {
    if (!formA.numero || !formA.importo_netto) return
    setSaving(true)
    const netto = parseFloat(formA.importo_netto)
    const iva = netto * parseFloat(formA.iva_pct) / 100
    await supabase.from('fatture').insert({
      commessa_id: id, tipo: 'ATTIVA', numero: formA.numero,
      data_emissione: formA.data || new Date().toISOString().split('T')[0],
      importo_netto: netto, importo_iva: iva, importo_totale: netto + iva,
      stato: 'EMESSA', note: formA.note || null,
    })
    setSaving(false); setShowForm(false)
    setFormA({ numero: '', data: '', importo_netto: '', iva_pct: '22', sal_id: '', note: '' })
    load()
  }

  async function savePassiva() {
    if (!formP.numero_fattura || !formP.importo_netto || !formP.fornitore_id) return
    setSaving(true)
    const netto = parseFloat(formP.importo_netto)
    const iva = netto * parseFloat(formP.iva_pct) / 100
    await supabase.from('fatture_passive').insert({
      commessa_id: id, fornitore_id: formP.fornitore_id,
      numero_fattura: formP.numero_fattura,
      data_fattura: formP.data_fattura || new Date().toISOString().split('T')[0],
      imponibile: netto, importo_iva: iva, importo_netto: netto,
      oda_id: formP.oda_id || null,
      stato_pagamento: 'DA_PAGARE', note: formP.note || null,
    })
    setSaving(false); setShowForm(false)
    setFormP({ numero_fattura: '', data_fattura: '', fornitore_id: '', importo_netto: '', iva_pct: '22', oda_id: '', note: '' })
    load()
  }

  async function aggiornaStatoAttiva(fid: string, stato: string) {
    await supabase.from('fatture').update({ stato }).eq('id', fid); load()
  }
  async function aggiornaStatoPassiva(fid: string, stato: string) {
    await supabase.from('fatture_passive').update({ stato_pagamento: stato }).eq('id', fid); load()
  }

  const totEmesso = fattureAttive.filter(f => f.stato !== 'STORNATA').reduce((s, f) => s + (f.importo_netto || 0), 0)
  const totIncassato = fattureAttive.filter(f => f.stato === 'PAGATA').reduce((s, f) => s + (f.importo_netto || 0), 0)
  const totPassive = fatturePassive.filter(f => f.stato_pagamento !== 'CONTESTATA').reduce((s, f) => s + (f.importo_netto || 0), 0)
  const totDaPagare = fatturePassive.filter(f => f.stato_pagamento === 'DA_PAGARE' || f.stato_pagamento === 'APPROVATA').reduce((s, f) => s + (f.importo_netto || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI aggregate */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <TrendingUp size={14} style={{ color: '#059669' }} />
            <p style={{ fontSize: 11, color: '#065f46', margin: 0 }}>Fatturato al committente</p>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#059669' }}>EUR {fmt(totEmesso)}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Incassato: EUR {fmt(totIncassato)}</p>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <TrendingDown size={14} style={{ color: '#dc2626' }} />
            <p style={{ fontSize: 11, color: '#991b1b', margin: 0 }}>Fatture passive ricevute</p>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#dc2626' }}>EUR {fmt(totPassive)}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Da pagare: EUR {fmt(totDaPagare)}</p>
        </div>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>Saldo netto</p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: totEmesso - totPassive >= 0 ? '#059669' : '#dc2626' }}>
            EUR {fmt(totEmesso - totPassive)}
          </p>
        </div>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>Da incassare</p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#d97706' }}>EUR {fmt(totEmesso - totIncassato)}</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, width: 'fit-content', gap: 2 }}>
        {(['ATTIVE', 'PASSIVE'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false) }}
            style={{ padding: '6px 18px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 500,
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#2563eb' : '#6b7280',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {t === 'ATTIVE' ? 'Fatture attive (al committente)' : 'Fatture passive (dai fornitori)'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
          {tab === 'ATTIVE'
            ? 'Fatture emesse al committente (SA). Collegate ai SAL attivi.'
            : 'Fatture ricevute da fornitori e subappaltatori. Verificare ODA e DDT (3-way match) prima del pagamento.'}
        </p>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={14} /> {tab === 'ATTIVE' ? 'Nuova fattura attiva' : 'Registra fattura passiva'}
        </button>
      </div>

      {/* Form fattura attiva */}
      {showForm && tab === 'ATTIVE' && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Nuova fattura al committente</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Numero fattura *</label>
              <input value={formA.numero} onChange={e => setFormA({...formA, numero: e.target.value})}
                placeholder="es. 001/2026"
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data emissione</label>
              <input type="date" value={formA.data} onChange={e => setFormA({...formA, data: e.target.value})}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Imponibile netto *</label>
              <input type="number" step="0.01" value={formA.importo_netto} onChange={e => setFormA({...formA, importo_netto: e.target.value})}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box', textAlign: 'right' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>IVA %</label>
              <select value={formA.iva_pct} onChange={e => setFormA({...formA, iva_pct: e.target.value})}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                <option value="22">22%</option><option value="10">10%</option><option value="4">4%</option>
                <option value="0">Esente</option><option value="0">Reverse charge</option>
              </select></div>
          </div>
          {formA.importo_netto && <p style={{ fontSize: 12, color: '#059669', marginBottom: 12 }}>
            Totale: EUR {fmt(parseFloat(formA.importo_netto || '0') * (1 + parseFloat(formA.iva_pct)/100))}
          </p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 18px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
            <button onClick={saveAttiva} disabled={saving} style={{ padding: '9px 18px', fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving && <Loader2 size={13} className="animate-spin" />} Emetti fattura
            </button>
          </div>
        </div>
      )}

      {/* Form fattura passiva */}
      {showForm && tab === 'PASSIVE' && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Registra fattura fornitore</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore *</label>
              <select value={formP.fornitore_id} onChange={e => setFormP({...formP, fornitore_id: e.target.value})}
                style={{ width: '100%', fontSize: 13, border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                <option value="">Seleziona...</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>N° fattura fornitore *</label>
              <input value={formP.numero_fattura} onChange={e => setFormP({...formP, numero_fattura: e.target.value})}
                style={{ width: '100%', fontSize: 13, border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data fattura</label>
              <input type="date" value={formP.data_fattura} onChange={e => setFormP({...formP, data_fattura: e.target.value})}
                style={{ width: '100%', fontSize: 13, border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Imponibile *</label>
              <input type="number" step="0.01" value={formP.importo_netto} onChange={e => setFormP({...formP, importo_netto: e.target.value})}
                style={{ width: '100%', fontSize: 13, border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box', textAlign: 'right' }} /></div>
          </div>
          <div style={{ fontSize: 12, padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #fecaca', marginBottom: 12, color: '#991b1b' }}>
            Verifica 3-way match prima del pagamento: ODA emesso → DDT consegnato → Fattura ricevuta
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 18px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
            <button onClick={savePassiva} disabled={saving} style={{ padding: '9px 18px', fontSize: 13, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving && <Loader2 size={13} className="animate-spin" />} Registra
            </button>
          </div>
        </div>
      )}

      {/* Lista fatture */}
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
            <Loader2 size={16} className="animate-spin" />
          </div>
        : tab === 'ATTIVE'
        ? fattureAttive.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '2px dashed #e5e7eb' }}>
              Nessuna fattura emessa — emetti la prima dopo aver registrato il SAL
            </div>
          : fattureAttive.map(f => {
              const si = STATI_ATTIVA[f.stato] || STATI_ATTIVA.BOZZA
              const isExp = expanded === f.id
              return (
                <div key={f.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  <div onClick={() => setExpanded(isExp ? null : f.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
                    {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af' }} /> : <ChevronRight size={14} style={{ color: '#9ca3af' }} />}
                    <TrendingUp size={16} style={{ color: '#059669', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', width: 110, flexShrink: 0 }}>{f.numero || '—'}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{f.data_emissione || '—'}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>EUR {fmt(f.importo_netto || 0)}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: si.bg, color: si.c, fontWeight: 600 }}>{si.l}</span>
                  </div>
                  {isExp && (
                    <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: '10px 16px', fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: '#6b7280' }}>Cambia stato:</span>
                        {Object.entries(STATI_ATTIVA).filter(([k]) => k !== f.stato).map(([k, v]) => (
                          <button key={k} onClick={() => aggiornaStatoAttiva(f.id, k)}
                            style={{ fontSize: 11, padding: '3px 8px', border: '1px solid ' + v.c, borderRadius: 6, background: v.bg, color: v.c, cursor: 'pointer' }}>
                            {v.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
        : fatturePassive.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '2px dashed #e5e7eb' }}>
            Nessuna fattura passiva registrata
          </div>
        : fatturePassive.map(f => {
            const si = STATI_PASSIVA[f.stato_pagamento] || STATI_PASSIVA.DA_PAGARE
            const isExp = expanded === f.id
            const scadenza = f.data_scadenza
              ? Math.ceil((new Date(f.data_scadenza).getTime() - Date.now()) / 86400000) : null
            const isScaduta = scadenza !== null && scadenza < 0
            return (
              <div key={f.id} style={{ border: isScaduta ? '2px solid #fca5a5' : '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isExp ? null : f.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
                  {isExp ? <ChevronDown size={14} style={{ color: '#9ca3af' }} /> : <ChevronRight size={14} style={{ color: '#9ca3af' }} />}
                  <TrendingDown size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', width: 110, flexShrink: 0 }}>{f.numero_fattura || '—'}</span>
                  <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{f.fornitore?.ragione_sociale || '—'}</span>
                  {isScaduta && <span style={{ fontSize: 10, padding: '2px 6px', background: '#fee2e2', color: '#dc2626', borderRadius: 4, fontWeight: 700 }}>SCADUTA</span>}
                  <span style={{ fontSize: 14, fontWeight: 700 }}>EUR {fmt(f.importo_netto || f.imponibile || 0)}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: si.bg, color: si.c, fontWeight: 600 }}>{si.l}</span>
                </div>
                {isExp && (
                  <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: '10px 16px', fontSize: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: '#6b7280' }}>Cambia stato:</span>
                      {Object.entries(STATI_PASSIVA).filter(([k]) => k !== f.stato_pagamento).map(([k, v]) => (
                        <button key={k} onClick={() => aggiornaStatoPassiva(f.id, k)}
                          style={{ fontSize: 11, padding: '3px 8px', border: '1px solid ' + v.c, borderRadius: 6, background: v.bg, color: v.c, cursor: 'pointer' }}>
                          {v.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
      }
    </div>
  )
}
