'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, FileCheck, Shield, Send, Trophy, FileText, ArrowRight, Star } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATI_RDO: Record<string, { label: string; color: string; bg: string }> = {
  BOZZA:       { label: 'Bozza',            color: '#6b7280', bg: '#f3f4f6' },
  INVIATA:     { label: 'Inviata',           color: '#d97706', bg: '#fffbeb' },
  OFFERTE_RIC: { label: 'Offerte ricevute',  color: '#2563eb', bg: '#eff6ff' },
  VALUTAZIONE: { label: 'In valutazione',    color: '#7c3aed', bg: '#f5f3ff' },
  AGGIUDICATA: { label: 'Aggiudicata',       color: '#059669', bg: '#f0fdf4' },
  DESERTA:     { label: 'Deserta',           color: '#dc2626', bg: '#fef2f2' },
  ANNULLATA:   { label: 'Annullata',         color: '#6b7280', bg: '#f3f4f6' },
}

const STATI_OFFERTA: Record<string, { label: string; color: string; bg: string }> = {
  RICEVUTA:   { label: 'Ricevuta',       color: '#6b7280', bg: '#f3f4f6' },
  IDONEA:     { label: 'Idonea',         color: '#059669', bg: '#f0fdf4' },
  NON_IDONEA: { label: 'Non idonea',     color: '#dc2626', bg: '#fef2f2' },
  VINCITRICE: { label: 'Vincitrice',     color: '#059669', bg: '#f0fdf4' },
  ESCLUSA:    { label: 'Esclusa',        color: '#dc2626', bg: '#fef2f2' },
}

function DocChecklist({ offerta, onUpdate }: { offerta: any; onUpdate: () => void }) {
  const docs = [
    { field: 'scheda_tecnica_ok', label: 'Scheda tecnica prodotto' },
    { field: 'dichiarazione_prestaz_ok', label: 'DoP — Dichiarazione Prestazione (Reg. UE 305/2011)' },
    { field: 'certificato_ce_ok', label: 'Marcatura CE / Certificato conformita' },
    { field: 'cam_ok', label: 'CAM — Criteri Ambientali Minimi' },
    { field: 'durc_ok', label: 'DURC in corso di validita (subappalti)' },
    { field: 'iscrizione_albo_ok', label: 'Iscrizione albo / qualificazione SOA' },
  ]
  async function toggle(field: string, current: boolean) {
    await supabase.from('rdo_offerte').update({ [field]: !current }).eq('id', offerta.id)
    onUpdate()
  }
  const totOk = docs.filter(d => offerta[d.field]).length
  const pct = Math.round(totOk / docs.length * 100)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>Documentazione allegata all'offerta ({totOk}/{docs.length})</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: pct === 100 ? '#d1fae5' : pct >= 50 ? '#fef3c7' : '#fee2e2', color: pct === 100 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626' }}>{pct}%</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {docs.map(({ field, label }) => {
          const ok = !!offerta[field]
          return (
            <div key={field} onClick={() => toggle(field, ok)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', background: ok ? '#f0fdf4' : '#f9fafb', border: '1px solid ' + (ok ? '#bbf7d0' : '#e5e7eb') }}>
              {ok ? <CheckCircle2 size={12} style={{ color: '#059669', flexShrink: 0 }} /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #d1d5db', flexShrink: 0 }} />}
              <span style={{ fontSize: 11, color: ok ? '#065f46' : '#6b7280' }}>{label}</span>
            </div>
          )
        })}
      </div>
      {pct < 100 && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 5, padding: '3px 8px', background: '#fef2f2', borderRadius: 4 }}>Documentazione incompleta — offerta non selezionabile come vincitrice</div>}
    </div>
  )
}

function OffertaCard({ offerta, rank, isVincitrice, onUpdate, onSetVincitrice, onGeneraDAM }: { offerta: any; rank: number; isVincitrice: boolean; onUpdate: () => void; onSetVincitrice: (id: string) => void; onGeneraDAM: (o: any) => void }) {
  const [exp, setExp] = useState(false)
  const [ptTecnico, setPtTecnico] = useState(String(offerta.punteggio_tecnico || ''))
  const [ptEconom, setPtEconom] = useState(String(offerta.punteggio_economico || ''))
  const [noteVal, setNoteVal] = useState(offerta.note_valutazione || '')
  const [saving, setSaving] = useState(false)
  const si = STATI_OFFERTA[offerta.stato_offerta] || STATI_OFFERTA.RICEVUTA
  const ptT = parseFloat(ptTecnico) || 0
  const ptE = parseFloat(ptEconom) || 0
  const ptTot = ptT * 0.7 + ptE * 0.3
  const docsOk = offerta.scheda_tecnica_ok && offerta.dichiarazione_prestaz_ok && offerta.certificato_ce_ok

  async function salvaValutaz() {
    setSaving(true)
    await supabase.from('rdo_offerte').update({ punteggio_tecnico: ptT || null, punteggio_economico: ptE || null, punteggio_totale: ptTot || null, note_valutazione: noteVal || null }).eq('id', offerta.id)
    setSaving(false); onUpdate()
  }
  async function cambiaStato(stato: string) {
    await supabase.from('rdo_offerte').update({ stato_offerta: stato }).eq('id', offerta.id); onUpdate()
  }

  return (
    <div style={{ border: '2px solid ' + (isVincitrice ? '#059669' : si.color + '30'), borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={() => setExp(!exp)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: isVincitrice ? '#f0fdf4' : '#fff' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: rank === 1 ? '#fef3c7' : '#f9fafb', flexShrink: 0 }}>
          {rank === 1 ? <Trophy size={13} style={{ color: '#d97706' }} /> : <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>{rank}</span>}
        </div>
        {exp ? <ChevronDown size={13} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{offerta.fornitore?.ragione_sociale || offerta.fornitore_nome_libero || 'Fornitore'}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{offerta.condizioni_pagamento || ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {[['ST', 'scheda_tecnica_ok'], ['DoP', 'dichiarazione_prestaz_ok'], ['CE', 'certificato_ce_ok'], ['CAM', 'cam_ok']].map(([a, f]) => (
            <span key={f} style={{ fontSize: 9, fontWeight: 700, padding: '2px 4px', borderRadius: 3, background: offerta[f] ? '#d1fae5' : '#fee2e2', color: offerta[f] ? '#059669' : '#dc2626' }}>{a}</span>
          ))}
        </div>
        {offerta.prezzo_offerto && <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, color: rank === 1 ? '#059669' : '#374151' }}>EUR {fmt(offerta.prezzo_offerto)}</span>}
        {(offerta.punteggio_totale || ptTot) > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: '#eff6ff', color: '#2563eb', flexShrink: 0 }}>{(offerta.punteggio_totale || ptTot).toFixed(1)} pt</span>}
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: si.bg, color: si.color, flexShrink: 0 }}>{si.label}</span>
        {isVincitrice && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#059669' }}>VINCITRICE</span>}
      </div>
      {exp && (
        <div style={{ borderTop: '1px solid #e5e7eb', background: '#fafafa', padding: 14 }}>
          {!docsOk && <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 10, fontSize: 11, color: '#991b1b' }}><AlertTriangle size={12} style={{ flexShrink: 0 }} />Documentazione incompleta — non selezionabile come vincitrice</div>}
          <div style={{ marginBottom: 12 }}><DocChecklist offerta={offerta} onUpdate={onUpdate} /></div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Star size={12} /> Valutazione OEPV (70% tecnico + 30% economico)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Tecnico (0-70)</label><input type="number" min="0" max="70" value={ptTecnico} onChange={e => setPtTecnico(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 6px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Economico (0-30)</label><input type="number" min="0" max="30" value={ptEconom} onChange={e => setPtEconom(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 6px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Totale</label><div style={{ fontSize: 14, fontWeight: 700, border: '2px solid #2563eb', borderRadius: 6, padding: '4px 6px', textAlign: 'right', color: '#2563eb' }}>{ptTot.toFixed(1)}</div></div>
            </div>
            <textarea value={noteVal} onChange={e => setNoteVal(e.target.value)} rows={1} placeholder="Note valutazione..." style={{ width: '100%', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', resize: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
            <button onClick={salvaValutaz} disabled={saving} style={{ padding: '5px 12px', fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: saving ? 0.6 : 1 }}>{saving && <Loader2 size={10} className="animate-spin" />}Salva punteggi</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {offerta.stato_offerta !== 'ESCLUSA' && !docsOk && <button onClick={() => cambiaStato('ESCLUSA')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>Escludi (doc. incompleta)</button>}
            {docsOk && offerta.stato_offerta !== 'IDONEA' && <button onClick={() => cambiaStato('IDONEA')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #bbf7d0', borderRadius: 6, background: '#f0fdf4', color: '#059669', cursor: 'pointer' }}>Segna idonea</button>}
            {!isVincitrice && offerta.stato_offerta === 'IDONEA' && docsOk && <button onClick={() => onSetVincitrice(offerta.id)} style={{ fontSize: 11, padding: '3px 12px', border: '2px solid #059669', borderRadius: 6, background: '#f0fdf4', color: '#059669', cursor: 'pointer', fontWeight: 600 }}>Seleziona VINCITRICE</button>}
            {isVincitrice && !offerta.dam_generato && <button onClick={() => onGeneraDAM(offerta)} style={{ fontSize: 11, padding: '3px 12px', border: '2px solid #2563eb', borderRadius: 6, background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><FileCheck size={11} />Genera DAM da questa offerta</button>}
            {offerta.dam_generato && <span style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #bbf7d0', borderRadius: 6, background: '#f0fdf4', color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} />DAM generato</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function RDOCard({ rdo, fornitori, onRefresh }: { rdo: any; fornitori: any[]; onRefresh: () => void }) {
  const [exp, setExp] = useState(false)
  const [offerte, setOfferte] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [forn, setForn] = useState(''); const [fornLib, setFornLib] = useState(''); const [prezzo, setPrezzo] = useState(''); const [cond, setCond] = useState('60 gg. d.f.f.m.'); const [noteO, setNoteO] = useState(''); const [saving, setSaving] = useState(false)
  const si = STATI_RDO[rdo.stato] || STATI_RDO.BOZZA

  async function loadOfferte() {
    setLoading(true)
    const { data } = await supabase.from('rdo_offerte').select('*, fornitore:fornitori(ragione_sociale)').eq('rdo_id', rdo.id).order('punteggio_totale', { ascending: false, nullsFirst: false })
    setOfferte(data || [])
    setLoading(false)
  }

  useEffect(() => { if (exp) loadOfferte() }, [exp])

  async function addOfferta() {
    if (!forn && !fornLib) return
    setSaving(true)
    await supabase.from('rdo_offerte').insert({ rdo_id: rdo.id, fornitore_id: forn || null, fornitore_nome_libero: fornLib || null, prezzo_offerto: parseFloat(prezzo) || null, condizioni_pagamento: cond || null, note_offerta: noteO || null, stato_offerta: 'RICEVUTA', scheda_tecnica_ok: false, dichiarazione_prestaz_ok: false, certificato_ce_ok: false, cam_ok: false, durc_ok: false, iscrizione_albo_ok: false })
    setSaving(false); setForn(''); setFornLib(''); setPrezzo(''); setNoteO(''); setShowAdd(false)
    await loadOfferte()
  }

  async function setVincitrice(offertaId: string) {
    for (const o of offerte) {
      if (o.id === offertaId) await supabase.from('rdo_offerte').update({ stato_offerta: 'VINCITRICE' }).eq('id', o.id)
      else if (o.stato_offerta === 'VINCITRICE') await supabase.from('rdo_offerte').update({ stato_offerta: 'IDONEA' }).eq('id', o.id)
    }
    await supabase.from('rdo').update({ stato: 'AGGIUDICATA' }).eq('id', rdo.id)
    await loadOfferte(); onRefresh()
  }

  async function generaDAM(offerta: any) {
    const { data: dam } = await supabase.from('dam').insert({ commessa_id: rdo.commessa_id, fornitore_id: offerta.fornitore_id || null, rdo_id: rdo.id, offerta_rdo_id: offerta.id, denominazione_materiale: rdo.oggetto || 'Materiale da RDO', stato: 'BOZZA', num_revisione: 0, scheda_tecnica: offerta.scheda_tecnica_ok || false, dichiarazione_prestazione: offerta.dichiarazione_prestaz_ok || false, certificato_ce: offerta.certificato_ce_ok || false, cam_compliant: offerta.cam_ok || false }).select().single()
    if (dam) { await supabase.from('rdo_offerte').update({ dam_generato: true }).eq('id', offerta.id); await loadOfferte() }
  }

  async function cambiaStatoRDO(stato: string) {
    await supabase.from('rdo').update({ stato }).eq('id', rdo.id); onRefresh()
  }

  const vincitrice = offerte.find(o => o.stato_offerta === 'VINCITRICE')
  const offerteOrd = [...offerte].sort((a, b) => (b.punteggio_totale || 0) - (a.punteggio_totale || 0))

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div onClick={() => setExp(!exp)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: exp ? '#f9fafb' : '#fff' }}>
        {exp ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', width: 100, flexShrink: 0 }}>{rdo.numero || 'RDO'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rdo.oggetto}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{rdo.tipo_fornitura || ''}{rdo.data_scadenza ? ' — Scad. ' + rdo.data_scadenza : ''}</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#374151', flexShrink: 0 }}>{offerte.length} offerte</span>
        {vincitrice && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#059669', flexShrink: 0 }}><Trophy size={11} />{vincitrice.fornitore?.ragione_sociale || vincitrice.fornitore_nome_libero}</div>}
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10, background: si.bg, color: si.color, flexShrink: 0 }}>{si.label}</span>
      </div>
      {exp && (
        <div style={{ borderTop: '1px solid #e5e7eb', background: '#fafafa', padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#1e40af' }}>
            <FileText size={13} style={{ flexShrink: 0 }} />
            <div><strong>Regola capitolato:</strong> I fornitori invitati devono allegare all'offerta tutta la documentazione tecnica (ST, DoP, CE, CAM). La valutazione e tecnico-economica (OEPV: 70% tecnico + 30% prezzo). Il DAM si genera automaticamente dall'offerta vincente.{rdo.note_capitolato && <><br /><em>{rdo.note_capitolato}</em></>}</div>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 12 }}><Loader2 size={15} className="animate-spin" /></div>
            : offerteOrd.length === 0 ? <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 12, border: '2px dashed #e5e7eb', borderRadius: 8, marginBottom: 10 }}>Nessuna offerta — aggiungi le offerte pervenute dai fornitori</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>{offerteOrd.map((o, i) => <OffertaCard key={o.id} offerta={o} rank={i + 1} isVincitrice={o.stato_offerta === 'VINCITRICE'} onUpdate={loadOfferte} onSetVincitrice={setVincitrice} onGeneraDAM={generaDAM} />)}</div>
          }
          {showAdd ? (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px' }}>Registra offerta ricevuta</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Fornitore archivio</label><select value={forn} onChange={e => setForn(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px' }}><option value="">Seleziona...</option>{fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}</select></div>
                <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Oppure nome libero</label><input value={fornLib} onChange={e => setFornLib(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Prezzo offerto EUR</label><input type="number" step="0.01" value={prezzo} onChange={e => setPrezzo(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', textAlign: 'right', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Condizioni pagamento</label><input value={cond} onChange={e => setCond(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ fontSize: 10, padding: '5px 8px', background: '#fef3c7', borderRadius: 4, marginBottom: 8, color: '#92400e' }}>Dopo aver registrato l'offerta, spuntare la documentazione ricevuta allegata (ST, DoP, CE, CAM)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowAdd(false)} style={{ padding: '5px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Annulla</button>
                <button onClick={addOfferta} disabled={saving || (!forn && !fornLib)} style={{ padding: '5px 12px', fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: (!forn && !fornLib) ? 0.5 : 1 }}>Registra offerta</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} style={{ fontSize: 11, padding: '5px 12px', border: '1px dashed #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}><Plus size={11} />Aggiungi offerta ricevuta</button>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Stato:</span>
            {rdo.stato === 'BOZZA' && <button onClick={() => cambiaStatoRDO('INVIATA')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #fcd34d', borderRadius: 6, background: '#fffbeb', color: '#d97706', cursor: 'pointer' }}>Segna Inviata</button>}
            {rdo.stato === 'INVIATA' && <button onClick={() => cambiaStatoRDO('OFFERTE_RIC')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #93c5fd', borderRadius: 6, background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}>Offerte ricevute</button>}
            {rdo.stato === 'OFFERTE_RIC' && <button onClick={() => cambiaStatoRDO('VALUTAZIONE')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #c4b5fd', borderRadius: 6, background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer' }}>Avvia valutazione</button>}
            {vincitrice && rdo.stato !== 'AGGIUDICATA' && <button onClick={() => cambiaStatoRDO('AGGIUDICATA')} style={{ fontSize: 11, padding: '3px 12px', border: '2px solid #059669', borderRadius: 6, background: '#f0fdf4', color: '#059669', cursor: 'pointer', fontWeight: 600 }}>Aggiudica RDO</button>}
            {rdo.stato !== 'DESERTA' && <button onClick={() => cambiaStatoRDO('DESERTA')} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>Deserta</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function RDOPage() {
  const { id } = useParams() as { id: string }
  const [rdoList, setRdoList] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ oggetto: '', tipo_fornitura: 'MATERIALE', data_scadenza: '', numero_inviti: '3', note_capitolato: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: f }] = await Promise.all([
      supabase.from('rdo').select('*').eq('commessa_id', id).order('created_at', { ascending: false }),
      supabase.from('fornitori').select('id,ragione_sociale').order('ragione_sociale'),
    ])
    setRdoList(r || [])
    setFornitori(f || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.oggetto.trim()) { setErr('Oggetto obbligatorio'); return }
    setSaving(true)
    const { count } = await supabase.from('rdo').select('*', { count: 'exact', head: true }).eq('commessa_id', id)
    const numero = 'RDO-' + new Date().getFullYear() + '-' + String((count || 0) + 1).padStart(3, '0')
    const { error } = await supabase.from('rdo').insert({ commessa_id: id, numero, oggetto: form.oggetto.trim(), tipo_fornitura: form.tipo_fornitura, data_scadenza: form.data_scadenza || null, numero_inviti: parseInt(form.numero_inviti) || 3, note_capitolato: form.note_capitolato || null, stato: 'BOZZA' })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); setShowForm(false)
    setForm({ oggetto: '', tipo_fornitura: 'MATERIALE', data_scadenza: '', numero_inviti: '3', note_capitolato: '' })
    await load()
  }

  const aggiudicate = rdoList.filter(r => r.stato === 'AGGIUDICATA').length
  const inCorso = rdoList.filter(r => ['INVIATA', 'OFFERTE_RIC', 'VALUTAZIONE'].includes(r.stato)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[['Totale RDO', rdoList.length, '#374151'], ['In corso', inCorso, '#d97706'], ['Aggiudicate', aggiudicate, '#059669'], ['Deserte', rdoList.filter(r => r.stato === 'DESERTA').length, '#dc2626']].map(([l, v, c]) => (
          <div key={String(l)} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: String(c), margin: 0 }}>{String(v)}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Richieste di Offerta (RDO)</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Fornitori invitati devono allegare tutta la documentazione tecnica all'offerta (ST+DoP+CE+CAM). Valutazione tecnico-economica OEPV. Il DAM si genera automaticamente dall'offerta vincente.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={14} /> Nuova RDO
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
        {['RDA', 'RDO + Docs', 'Valutazione OEPV', 'Scelta + Clausola DL', 'DAM (da offerta)', 'ODA', 'Contratto'].map((step, i, arr) => (
          <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontWeight: i === 1 ? 700 : 400, color: i === 1 ? '#2563eb' : '#374151', padding: '1px 6px', borderRadius: 4, background: i === 1 ? '#eff6ff' : 'transparent' }}>{step}</span>
            {i < arr.length - 1 && <ArrowRight size={10} style={{ color: '#d1d5db' }} />}
          </span>
        ))}
      </div>
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Nuova Richiesta di Offerta</h3>
          <div style={{ marginBottom: 10 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Oggetto *</label><input value={form.oggetto} onChange={e => setForm(p => ({ ...p, oggetto: e.target.value }))} placeholder="es. Fornitura calcestruzzo C25/30 per fondazioni" style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Tipo</label><select value={form.tipo_fornitura} onChange={e => setForm(p => ({ ...p, tipo_fornitura: e.target.value }))} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px' }}><option value="MATERIALE">Materiale</option><option value="SUBAPPALTO">Subappalto</option><option value="SERVIZIO">Servizio</option><option value="NOLO">Nolo</option></select></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Scadenza offerte</label><input type="date" value={form.data_scadenza} onChange={e => setForm(p => ({ ...p, data_scadenza: e.target.value }))} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', boxSizing: 'border-box' }} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Fornitori invitati</label><input type="number" min="1" value={form.numero_inviti} onChange={e => setForm(p => ({ ...p, numero_inviti: e.target.value }))} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', boxSizing: 'border-box' }} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Note capitolato — documentazione obbligatoria richiesta ai fornitori</label><textarea value={form.note_capitolato} onChange={e => setForm(p => ({ ...p, note_capitolato: e.target.value }))} rows={2} placeholder="es. Allegare obbligatoriamente: scheda tecnica, DoP, marcatura CE, certificato aggregati..." style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', resize: 'none', boxSizing: 'border-box' }} /></div>
          {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 14px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '7px 18px', fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>{saving && <Loader2 size={12} className="animate-spin" />}Crea RDO</button>
          </div>
        </div>
      )}
      {loading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" />Caricamento...</div>
        : rdoList.length === 0 ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}><Send size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><p style={{ fontSize: 14 }}>Nessuna RDO — crea la prima richiesta di offerta</p></div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{rdoList.map(r => <RDOCard key={r.id} rdo={r} fornitori={fornitori} onRefresh={load} />)}</div>
      }
    </div>
  )
}
