'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, FileText, CheckCircle2, Clock, AlertTriangle, ArrowUpRight, ArrowDownLeft, Euro } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATI_ATTIVA: Record<string, { label: string; color: string; bg: string }> = {
  BOZZA:     { label: 'Bozza',        color: '#6b7280', bg: '#f3f4f6' },
  EMESSA:    { label: 'Emessa',       color: '#2563eb', bg: '#eff6ff' },
  INVIATA:   { label: 'Inviata',      color: '#d97706', bg: '#fffbeb' },
  PAGATA:    { label: 'Pagata',       color: '#059669', bg: '#f0fdf4' },
  SCADUTA:   { label: 'Scaduta',      color: '#dc2626', bg: '#fef2f2' },
  STORNATA:  { label: 'Stornata',     color: '#6b7280', bg: '#f3f4f6' },
}

const STATI_PASSIVA: Record<string, { label: string; color: string; bg: string }> = {
  DA_RICEVERE:   { label: 'Da ricevere',   color: '#6b7280', bg: '#f3f4f6' },
  RICEVUTA:      { label: 'Ricevuta',      color: '#2563eb', bg: '#eff6ff' },
  IN_VERIFICA:   { label: 'In verifica',   color: '#d97706', bg: '#fffbeb' },
  APPROVATA:     { label: 'Approvata',     color: '#059669', bg: '#f0fdf4' },
  PAGATA:        { label: 'Pagata',        color: '#059669', bg: '#f0fdf4' },
  CONTESTATA:    { label: 'Contestata',    color: '#dc2626', bg: '#fef2f2' },
  SOSPESA:       { label: 'Sospesa',       color: '#7c3aed', bg: '#f5f3ff' },
}

export default function FatturazionePage() {
  const { id } = useParams() as { id: string }
  const [attive, setAttive]   = useState<any[]>([])
  const [passive, setPassive] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'attive'|'passive'>('attive')
  const [showFormA, setShowFormA] = useState(false)
  const [showFormP, setShowFormP] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [fornitori, setFornitori] = useState<any[]>([])

  const [formA, setFormA] = useState({ numero: '', data_emissione: new Date().toISOString().split('T')[0], importo_netto: '', iva_pct: '22', soggetto: '', note: '' })
  const [formP, setFormP] = useState({ numero_fattura: '', data_fattura: new Date().toISOString().split('T')[0], fornitore_id: '', imponibile: '', iva_pct: '22', note: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: a }, { data: p }, { data: f }] = await Promise.all([
      supabase.from('fatture').select('*').eq('commessa_id', id).order('data_emissione', { ascending: false }),
      supabase.from('fatture_passive').select('*, fornitore:fornitori(ragione_sociale)').eq('commessa_id', id).order('data_fattura', { ascending: false }),
      supabase.from('fornitori').select('id, ragione_sociale').order('ragione_sociale'),
    ])
    setAttive(a || [])
    setPassive(p || [])
    setFornitori(f || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function saveAttiva() {
    if (!formA.numero || !formA.importo_netto) { setErr('Numero e importo obbligatori'); return }
    setSaving(true)
    const importo = parseFloat(formA.importo_netto)
    const iva = importo * parseFloat(formA.iva_pct) / 100
    const { error } = await supabase.from('fatture').insert({
      commessa_id: id, tipo: 'ATTIVA',
      numero: formA.numero,
      data_emissione: formA.data_emissione,
      importo_netto: importo,
      iva_pct: parseFloat(formA.iva_pct),
      importo_iva: iva,
      importo_lordo: importo + iva,
      soggetto: formA.soggetto || 'Committente',
      stato: 'EMESSA',
      note: formA.note || null,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); setShowFormA(false)
    setFormA({ numero: '', data_emissione: new Date().toISOString().split('T')[0], importo_netto: '', iva_pct: '22', soggetto: '', note: '' })
    await load()
  }

  async function savePassiva() {
    if (!formP.numero_fattura || !formP.imponibile) { setErr('Numero e importo obbligatori'); return }
    setSaving(true)
    const imponibile = parseFloat(formP.imponibile)
    const iva = imponibile * parseFloat(formP.iva_pct) / 100
    const { error } = await supabase.from('fatture_passive').insert({
      commessa_id: id,
      fornitore_id: formP.fornitore_id || null,
      numero_fattura: formP.numero_fattura,
      data_fattura: formP.data_fattura,
      imponibile,
      iva_pct: parseFloat(formP.iva_pct),
      importo_iva: iva,
      importo_totale: imponibile + iva,
      stato: 'RICEVUTA',
      note: formP.note || null,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); setShowFormP(false)
    setFormP({ numero_fattura: '', data_fattura: new Date().toISOString().split('T')[0], fornitore_id: '', imponibile: '', iva_pct: '22', note: '' })
    await load()
  }

  async function cambiaStatoA(fid: string, stato: string) {
    await supabase.from('fatture').update({ stato }).eq('id', fid); await load()
  }
  async function cambiaStatoP(fid: string, stato: string) {
    await supabase.from('fatture_passive').update({ stato }).eq('id', fid); await load()
  }

  const totEmesse   = attive.filter(f => ['EMESSA','INVIATA'].includes(f.stato)).reduce((s, f) => s + (f.importo_lordo || 0), 0)
  const totIncassate = attive.filter(f => f.stato === 'PAGATA').reduce((s, f) => s + (f.importo_lordo || 0), 0)
  const totPassive  = passive.filter(f => ['RICEVUTA','IN_VERIFICA','APPROVATA'].includes(f.stato)).reduce((s, f) => s + (f.importo_totale || 0), 0)
  const totPagate   = passive.filter(f => f.stato === 'PAGATA').reduce((s, f) => s + (f.importo_totale || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { l: 'Fatturato al committente', v: 'EUR ' + fmt(totEmesse + totIncassate), icon: ArrowUpRight, c: '#059669' },
          { l: 'Incassato', v: 'EUR ' + fmt(totIncassate), icon: CheckCircle2, c: '#059669' },
          { l: 'Fatture passive in attesa', v: 'EUR ' + fmt(totPassive), icon: ArrowDownLeft, c: '#d97706' },
          { l: 'Pagato ai fornitori', v: 'EUR ' + fmt(totPagate), icon: Euro, c: '#dc2626' },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Icon size={13} style={{ color: k.c }} />
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{k.l}</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{k.v}</p>
            </div>
          )
        })}
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 4 }}>
          {(['attive', 'passive'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111' : '#6b7280',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {t === 'attive' ? 'Fatture attive (' + attive.length + ')' : 'Fatture passive (' + passive.length + ')'}
            </button>
          ))}
        </div>
        <button onClick={() => tab === 'attive' ? setShowFormA(true) : setShowFormP(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: tab === 'attive' ? '#059669' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={14} /> {tab === 'attive' ? 'Emetti fattura' : 'Registra fattura passiva'}
        </button>
      </div>

      {/* Lista */}
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, gap: 8, color: '#9ca3af' }}>
            <Loader2 size={16} className="animate-spin" />
          </div>
        : tab === 'attive'
        ? attive.length === 0
          ? <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}><FileText size={40} style={{ marginBottom: 8, opacity: 0.3 }} /><p>Nessuna fattura emessa</p></div>
          : attive.map(f => {
              const si = STATI_ATTIVA[f.stato] || STATI_ATTIVA.BOZZA
              const scaduta = f.data_scadenza && new Date(f.data_scadenza) < new Date() && f.stato !== 'PAGATA'
              return (
                <div key={f.id} style={{ border: '1px solid ' + (scaduta ? '#fecaca' : '#e5e7eb'), borderRadius: 10, padding: '12px 16px', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 80, flexShrink: 0 }}>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>N°</p>
                    <p style={{ fontSize: 12, fontWeight: 600, margin: 0, fontFamily: 'monospace' }}>{f.numero}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, margin: 0 }}>{f.soggetto || 'Committente'}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                      Emessa: {f.data_emissione} {f.data_scadenza && '• Scad: ' + f.data_scadenza}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>EUR {fmt(f.importo_lordo)}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>IVA {f.iva_pct}%</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, fontWeight: 600, background: si.bg, color: si.color }}>{si.label}</span>
                    {f.stato === 'EMESSA' && (
                      <button onClick={() => cambiaStatoA(f.id, 'PAGATA')}
                        style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #bbf7d0', borderRadius: 6, background: '#f0fdf4', color: '#059669', cursor: 'pointer' }}>
                        Segna pagata
                      </button>
                    )}
                    {f.stato === 'INVIATA' && (
                      <button onClick={() => cambiaStatoA(f.id, 'PAGATA')}
                        style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #bbf7d0', borderRadius: 6, background: '#f0fdf4', color: '#059669', cursor: 'pointer' }}>
                        Incassata
                      </button>
                    )}
                  </div>
                </div>
              )
            })
        : passive.length === 0
          ? <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}><FileText size={40} style={{ marginBottom: 8, opacity: 0.3 }} /><p>Nessuna fattura passiva registrata</p></div>
          : passive.map(f => {
              const si = STATI_PASSIVA[f.stato] || STATI_PASSIVA.RICEVUTA
              return (
                <div key={f.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 80, flexShrink: 0 }}>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>N° forn.</p>
                    <p style={{ fontSize: 12, fontWeight: 600, margin: 0, fontFamily: 'monospace' }}>{f.numero_fattura}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, margin: 0 }}>{f.fornitore?.ragione_sociale || 'Fornitore'}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>Ricevuta: {f.data_fattura}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>EUR {fmt(f.importo_totale)}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>IVA {f.iva_pct}%</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, fontWeight: 600, background: si.bg, color: si.color }}>{si.label}</span>
                    {f.stato === 'RICEVUTA' && (
                      <button onClick={() => cambiaStatoP(f.id, 'APPROVATA')}
                        style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #bbf7d0', borderRadius: 6, background: '#f0fdf4', color: '#059669', cursor: 'pointer' }}>
                        Approva
                      </button>
                    )}
                    {f.stato === 'APPROVATA' && (
                      <button onClick={() => cambiaStatoP(f.id, 'PAGATA')}
                        style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff', color: '#1e40af', cursor: 'pointer' }}>
                        Pagata
                      </button>
                    )}
                    {['RICEVUTA','IN_VERIFICA'].includes(f.stato) && (
                      <button onClick={() => cambiaStatoP(f.id, 'CONTESTATA')}
                        style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #fecaca', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                        Contesta
                      </button>
                    )}
                  </div>
                </div>
              )
            })
      }

      {/* Modal Fattura Attiva */}
      {showFormA && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', color: '#059669' }}>Emetti fattura attiva</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Numero fattura *</label>
                <input value={formA.numero} onChange={e => setFormA(f => ({...f, numero: e.target.value}))} placeholder="es. 001/2026"
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data emissione</label>
                <input type="date" value={formA.data_emissione} onChange={e => setFormA(f => ({...f, data_emissione: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Committente / Soggetto</label>
              <input value={formA.soggetto} onChange={e => setFormA(f => ({...f, soggetto: e.target.value}))} placeholder="Ente/committente..."
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Importo netto *</label>
                <input type="number" step="0.01" value={formA.importo_netto} onChange={e => setFormA(f => ({...f, importo_netto: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box', textAlign: 'right' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>IVA %</label>
                <select value={formA.iva_pct} onChange={e => setFormA(f => ({...f, iva_pct: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                  <option value="22">22%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option>
                </select></div>
            </div>
            {parseFloat(formA.importo_netto) > 0 && (
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Imponibile</span><span>EUR {fmt(parseFloat(formA.importo_netto))}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>IVA {formA.iva_pct}%</span><span>EUR {fmt(parseFloat(formA.importo_netto) * parseFloat(formA.iva_pct) / 100)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid #bbf7d0' }}><span>Totale</span><span>EUR {fmt(parseFloat(formA.importo_netto) * (1 + parseFloat(formA.iva_pct)/100))}</span></div>
              </div>
            )}
            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowFormA(false); setErr('') }} style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
              <button onClick={saveAttiva} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, background: '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {saving && <Loader2 size={13} className="animate-spin" />} Emetti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fattura Passiva */}
      {showFormP && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', color: '#dc2626' }}>Registra fattura passiva</h2>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore</label>
              <select value={formP.fornitore_id} onChange={e => setFormP(f => ({...f, fornitore_id: e.target.value}))}
                style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                <option value="">Seleziona fornitore...</option>
                {fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
              </select></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>N° fattura fornitore *</label>
                <input value={formP.numero_fattura} onChange={e => setFormP(f => ({...f, numero_fattura: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data fattura</label>
                <input type="date" value={formP.data_fattura} onChange={e => setFormP(f => ({...f, data_fattura: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Imponibile *</label>
                <input type="number" step="0.01" value={formP.imponibile} onChange={e => setFormP(f => ({...f, imponibile: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box', textAlign: 'right' }} /></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>IVA %</label>
                <select value={formP.iva_pct} onChange={e => setFormP(f => ({...f, iva_pct: e.target.value}))}
                  style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                  <option value="22">22%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option>
                </select></div>
            </div>
            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowFormP(false); setErr('') }} style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
              <button onClick={savePassiva} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {saving && <Loader2 size={13} className="animate-spin" />} Registra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
