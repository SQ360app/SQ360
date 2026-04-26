'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, FileCheck, Shield, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

const STATI_DAM: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  BOZZA:                  { label: 'Bozza',                color: '#6b7280', bg: '#f3f4f6', desc: 'Scheda in preparazione' },
  DOCUMENTAZIONE_INVIATA: { label: 'Doc. ricevuta',        color: '#7c3aed', bg: '#f5f3ff', desc: 'Fornitore ha inviato le certificazioni' },
  INVIATA_A_DL:           { label: 'Inviata a DL',         color: '#d97706', bg: '#fffbeb', desc: 'Scheda inviata alla Direzione Lavori' },
  IN_REVISIONE_DL:        { label: 'In revisione DL',      color: '#2563eb', bg: '#eff6ff', desc: 'DL sta esaminando la documentazione' },
  ACCETTATA:              { label: 'Accettata',             color: '#059669', bg: '#f0fdf4', desc: 'DL ha accettato, ODA autorizzato' },
  ACCETTATA_CON_RISERVA:  { label: 'Accettata c.riserva',  color: '#d97706', bg: '#fffbeb', desc: 'Accettata con osservazioni DL' },
  RIFIUTATA:              { label: 'Rifiutata',             color: '#dc2626', bg: '#fef2f2', desc: 'DL ha rifiutato, ODA sospeso' },
  SCADUTA:                { label: 'Scaduta',               color: '#6b7280', bg: '#f3f4f6', desc: 'Accettazione non piu valida' },
}

const TRANSIZIONI: Record<string, string[]> = {
  BOZZA:                  ['DOCUMENTAZIONE_INVIATA'],
  DOCUMENTAZIONE_INVIATA: ['INVIATA_A_DL', 'BOZZA'],
  INVIATA_A_DL:           ['IN_REVISIONE_DL', 'DOCUMENTAZIONE_INVIATA'],
  IN_REVISIONE_DL:        ['ACCETTATA', 'ACCETTATA_CON_RISERVA', 'RIFIUTATA'],
  ACCETTATA:              ['ACCETTATA_CON_RISERVA', 'SCADUTA'],
  ACCETTATA_CON_RISERVA:  ['ACCETTATA', 'RIFIUTATA', 'SCADUTA'],
  RIFIUTATA:              ['BOZZA'],
  SCADUTA:                ['BOZZA'],
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: checked ? '#f0fdf4' : '#f9fafb', border: '1px solid ' + (checked ? '#bbf7d0' : '#e5e7eb') }}>
      {checked ? <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #d1d5db', flexShrink: 0 }} />}
      <span style={{ fontSize: 12, color: checked ? '#065f46' : '#6b7280', fontWeight: checked ? 500 : 400 }}>{label}</span>
    </div>
  )
}

function DAMCard({ dam, fornitori, onRefresh }: { dam: any; fornitori: any[]; onRefresh: () => void }) {
  const [exp, setExp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dlNome, setDlNome] = useState(dam.dl_nome || '')
  const [noteDL, setNoteDL] = useState(dam.note_dl || '')
  const [motivoRifiuto, setMotivoRifiuto] = useState(dam.motivo_rifiuto || '')
  const si = STATI_DAM[dam.stato] || STATI_DAM.BOZZA
  const fornitore = fornitori.find((f: any) => f.id === dam.fornitore_id)

  async function cambiaStato(nuovoStato: string) {
    setSaving(true)
    const update: any = { stato: nuovoStato }
    if (['ACCETTATA', 'ACCETTATA_CON_RISERVA', 'RIFIUTATA'].includes(nuovoStato)) {
      update.data_risposta_dl = new Date().toISOString().split('T')[0]
    }
    if (['INVIATA_A_DL', 'IN_REVISIONE_DL'].includes(nuovoStato)) {
      update.data_invio_dl = new Date().toISOString().split('T')[0]
    }
    if (dlNome) update.dl_nome = dlNome
    if (noteDL) update.note_dl = noteDL
    if (motivoRifiuto && nuovoStato === 'RIFIUTATA') update.motivo_rifiuto = motivoRifiuto
    await supabase.from('dam').update(update).eq('id', dam.id)
    if (nuovoStato === 'ACCETTATA' && dam.oda_id) {
      await supabase.from('oda').update({ stato: 'EMESSO' }).eq('id', dam.oda_id)
    }
    if (nuovoStato === 'RIFIUTATA' && dam.oda_id) {
      await supabase.from('oda').update({ stato: 'SOSPESO' }).eq('id', dam.oda_id)
    }
    setSaving(false); onRefresh()
  }

  async function toggleDoc(field: string, value: boolean) {
    await supabase.from('dam').update({ [field]: value }).eq('id', dam.id)
    onRefresh()
  }

  return (
    <div style={{ border: '2px solid ' + si.color + '30', borderRadius: 12, overflow: 'hidden' }}>
      <div onClick={() => setExp(!exp)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: exp ? si.bg : '#fff' }}>
        {exp ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
        {['ACCETTATA', 'ACCETTATA_CON_RISERVA'].includes(dam.stato) ? <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} /> : dam.stato === 'RIFIUTATA' ? <XCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} /> : <Clock size={18} style={{ color: si.color, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dam.denominazione_materiale}</p>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{fornitore?.ragione_sociale || 'Fornitore da assegnare'}{dam.classe_prestazionale && ' - ' + dam.classe_prestazionale}</p>
        </div>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600, background: si.bg, color: si.color, flexShrink: 0 }}>{si.label}</span>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {[['ST', 'scheda_tecnica'], ['DoP', 'dichiarazione_prestazione'], ['CE', 'certificato_ce'], ['CAM', 'cam_compliant']].map(([abbr, field]) => (
            <span key={field} style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: dam[field] ? '#d1fae5' : '#fee2e2', color: dam[field] ? '#059669' : '#dc2626' }}>{abbr}</span>
          ))}
        </div>
      </div>
      {exp && (
        <div style={{ borderTop: '1px solid ' + si.color + '20', background: si.bg + '60', padding: 16 }}>
          {dam.stato === 'ACCETTATA' && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#065f46' }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
              <div><strong>Materiale accettato dalla DL</strong>{dam.dl_nome && ' - firmato da ' + dam.dl_nome}{dam.data_risposta_dl && ' il ' + dam.data_risposta_dl}{dam.note_dl && <><br /><em>Note: {dam.note_dl}</em></>}{dam.oda_id && <><br />ODA collegato portato a stato EMESSO automaticamente.</>}</div>
            </div>
          )}
          {dam.stato === 'RIFIUTATA' && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#991b1b' }}>
              <XCircle size={14} style={{ flexShrink: 0 }} />
              <div><strong>Materiale RIFIUTATO dalla DL</strong>{dam.dl_nome && ' - ' + dam.dl_nome}{dam.motivo_rifiuto && <><br /><strong>Motivo:</strong> {dam.motivo_rifiuto}</>}{dam.oda_id && <><br />ODA collegato SOSPESO. Proporre materiale alternativo con nuovo DAM.</>}</div>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={13} /> Documentazione fornitore (prerequisiti D.Lgs. 36/2023)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <CheckRow label="Scheda tecnica del prodotto" checked={!!dam.scheda_tecnica} onChange={v => toggleDoc('scheda_tecnica', v)} />
              <CheckRow label="Dichiarazione di Prestazione (DoP)" checked={!!dam.dichiarazione_prestazione} onChange={v => toggleDoc('dichiarazione_prestazione', v)} />
              <CheckRow label="Certificato CE / marcatura CE" checked={!!dam.certificato_ce} onChange={v => toggleDoc('certificato_ce', v)} />
              <CheckRow label="CAM - Criteri Ambientali Minimi" checked={!!dam.cam_compliant} onChange={v => toggleDoc('cam_compliant', v)} />
              <CheckRow label="Campione richiesto da DL" checked={!!dam.campione_richiesto} onChange={v => toggleDoc('campione_richiesto', v)} />
              {dam.campione_richiesto && <CheckRow label="Campione inviato alla DL" checked={!!dam.campione_inviato} onChange={v => toggleDoc('campione_inviato', v)} />}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
            {[['Invio a DL', dam.data_invio_dl], ['Risposta DL', dam.data_risposta_dl], ['DL / RUP', dam.dl_nome], ['Norma', dam.norma_riferimento]].map(([l, v]) => (
              <div key={String(l)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px' }}>
                <p style={{ fontSize: 9, color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase' }}>{l}</p>
                <p style={{ fontSize: 11, margin: 0 }}>{String(v) || '-'}</p>
              </div>
            ))}
          </div>
          {['IN_REVISIONE_DL', 'INVIATA_A_DL'].includes(dam.stato) && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px' }}>Registra risposta DL</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Nome DL / RUP</label><input value={dlNome} onChange={e => setDlNome(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>
                <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Note / Osservazioni</label><input value={noteDL} onChange={e => setNoteDL(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => cambiaStato('ACCETTATA')} disabled={saving} style={{ flex: 1, padding: '8px', fontSize: 12, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>DL ACCETTA</button>
                <button onClick={() => cambiaStato('ACCETTATA_CON_RISERVA')} disabled={saving} style={{ flex: 1, padding: '8px', fontSize: 12, background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Accetta c.riserva</button>
                <button onClick={() => cambiaStato('RIFIUTATA')} disabled={saving} style={{ flex: 1, padding: '8px', fontSize: 12, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>DL RIFIUTA</button>
              </div>
              {dam.stato === 'RIFIUTATA' && <div style={{ marginTop: 8 }}><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Motivo rifiuto</label><textarea value={motivoRifiuto} onChange={e => setMotivoRifiuto(e.target.value)} rows={2} style={{ width: '100%', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 8px', resize: 'none', boxSizing: 'border-box' }} /></div>}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>Avanza stato:</span>
            {(TRANSIZIONI[dam.stato] || []).map(ns => {
              const si2 = STATI_DAM[ns]
              return <button key={ns} onClick={() => cambiaStato(ns)} disabled={saving} style={{ fontSize: 11, padding: '4px 12px', border: '1px solid ' + si2.color, borderRadius: 6, background: si2.bg, color: si2.color, cursor: 'pointer' }}>{si2.label}</button>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DAMPage() {
  const { id } = useParams() as { id: string }
  const [dams, setDams] = useState<any[]>([])
  const [fornitori, setFornitori] = useState<any[]>([])
  const [odaList, setOdaList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ denominazione: '', fornitore_id: '', oda_id: '', norma: '', marca: '', classe: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: d }, { data: f }, { data: o }] = await Promise.all([
      supabase.from('dam').select('*, oda:oda(id,numero,stato,oggetto)').eq('commessa_id', id).order('created_at', { ascending: false }),
      supabase.from('fornitori').select('id,ragione_sociale').order('ragione_sociale'),
      supabase.from('oda').select('id,numero,stato,oggetto').eq('commessa_id', id),
    ])
    setDams(d || [])
    setFornitori(f || [])
    setOdaList(o || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.denominazione.trim()) { setErr('Denominazione obbligatoria'); return }
    setSaving(true)
    const { error } = await supabase.from('dam').insert({
      commessa_id: id, denominazione_materiale: form.denominazione.trim(),
      fornitore_id: form.fornitore_id || null, oda_id: form.oda_id || null,
      norma_riferimento: form.norma || null, marca_modello: form.marca || null,
      classe_prestazionale: form.classe || null, stato: 'BOZZA',
      scheda_tecnica: false, dichiarazione_prestazione: false, certificato_ce: false, cam_compliant: false,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setSaving(false); setShowForm(false)
    setForm({ denominazione: '', fornitore_id: '', oda_id: '', norma: '', marca: '', classe: '' })
    await load()
  }

  const accettati = dams.filter(d => ['ACCETTATA','ACCETTATA_CON_RISERVA'].includes(d.stato)).length
  const rifiutati = dams.filter(d => d.stato === 'RIFIUTATA').length
  const inCorso   = dams.filter(d => ['INVIATA_A_DL','IN_REVISIONE_DL','DOCUMENTAZIONE_INVIATA'].includes(d.stato)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[['Totale DAM', dams.length, '#374151'], ['In corso', inCorso, '#d97706'], ['Accettati DL', accettati, '#059669'], ['Rifiutati DL', rifiutati, '#dc2626']].map(([l, v, c]) => (
          <div key={String(l)} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: String(c), margin: 0 }}>{String(v)}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>DAM - Documenti di Accettazione Materiali</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Il DAM deve essere accettato dalla DL PRIMA dell'emissione dell'ODA e di qualsiasi consegna in cantiere.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}><RefreshCw size={12} /> Aggiorna</button>
          <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}><Plus size={14} /> Nuovo DAM</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 12, color: '#1e40af' }}>
        <FileCheck size={16} style={{ color: '#2563eb', flexShrink: 0, marginTop: 1 }} />
        <div><strong>Flusso corretto (D.Lgs. 36/2023 art. 101):</strong> Fornitore invia documentazione (ST+DoP+CE+CAM) - Impresa prepara DAM - DL esamina - Se ACCETTA: ODA sbloccato, consegna autorizzata - Se RIFIUTA: ODA sospeso, fornitore alternativo</div>
      </div>
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /> Caricamento...</div>
        : dams.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
            <Shield size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>Nessun DAM - crea il primo documento di accettazione materiali</p>
          </div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{dams.map(d => <DAMCard key={d.id} dam={d} fornitori={fornitori} onRefresh={load} />)}</div>
      }
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 500, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Nuovo DAM - Documento Accettazione Materiali</h2>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 16px' }}>Il DAM deve essere accettato dalla DL PRIMA che l'ODA possa essere confermato.</p>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Denominazione materiale *</label><input value={form.denominazione} onChange={e => setForm(p => ({ ...p, denominazione: e.target.value }))} placeholder="es. Calcestruzzo C25/30 per fondazioni..." style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore</label><select value={form.fornitore_id} onChange={e => setForm(p => ({ ...p, fornitore_id: e.target.value }))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}><option value="">Da assegnare</option>{fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>ODA di riferimento</label><select value={form.oda_id} onChange={e => setForm(p => ({ ...p, oda_id: e.target.value }))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}><option value="">Nessuno</option>{odaList.filter(o => ['BOZZA','IN_ATTESA_DAM','SOSPESO','EMESSO'].includes(o.stato)).map(o => <option key={o.id} value={o.id}>{o.numero}</option>)}</select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Norma</label><input value={form.norma} onChange={e => setForm(p => ({ ...p, norma: e.target.value }))} placeholder="UNI EN 206" style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Marca / Modello</label><input value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Classe prestaz.</label><input value={form.classe} onChange={e => setForm(p => ({ ...p, classe: e.target.value }))} placeholder="C25/30" style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>
            </div>
            <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, marginBottom: 14, fontSize: 11, color: '#92400e' }}>
              Dopo la creazione: raccogliere documentazione dal fornitore e avanzare il DAM fino all'accettazione DL prima di procedere con forniture.
            </div>
            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
                {saving && <Loader2 size={13} className="animate-spin" />} Crea DAM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Shield,
  ChevronDown, ChevronRight, Loader2, FileCheck2, Package
} from 'lucide-react'

const STATI_DAM: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  IN_ATTESA:   { label: 'In attesa docs', color: '#d97706', bg: '#fffbeb', icon: Clock },
  IN_VERIFICA: { label: 'In verifica DL',  color: '#7c3aed', bg: '#f5f3ff', icon: Shield },
  ACCETTATO:   { label: 'Accettato DL',   color: '#059669', bg: '#f0fdf4', icon: CheckCircle2 },
  RIFIUTATO:   { label: 'Rifiutato DL',   color: '#dc2626', bg: '#fef2f2', icon: XCircle },
}

function CheckItem({ label, checked, onChange, disabled }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer', fontSize: 12 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled}
        style={{ width: 14, height: 14, cursor: disabled ? 'default' : 'pointer' }} />
      <span style={{ color: checked ? '#059669' : '#6b7280' }}>{label}</span>
      {checked && <CheckCircle2 size={11} style={{ color: '#059669', flexShrink: 0 }} />}
    </label>
  )
}

function DAMCard({ dam, onRefresh }: { dam: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    scheda_tecnica_ok: dam.scheda_tecnica_ok || false,
    dop_ok: dam.dop_ok || false,
    cert_ce_ok: dam.cert_ce_ok || false,
    cam_ok: dam.cam_ok || false,
    campione_ok: dam.campione_ok || false,
    ref_capitolato: dam.ref_capitolato || '',
    specifica_richiesta: dam.specifica_richiesta || '',
    specifica_fornita: dam.specifica_fornita || '',
    conforme_capitolato: dam.conforme_capitolato ?? null,
    dl_nome: dam.dl_nome || '',
    dl_data: dam.dl_data || '',
    dl_decisione: dam.dl_decisione || null,
    dl_note: dam.dl_note || '',
    motivo_rifiuto: dam.motivo_rifiuto || '',
  })

  const statoInfo = STATI_DAM[dam.stato] || STATI_DAM.IN_ATTESA
  const StatoIcon = statoInfo.icon
  const docsComplete = form.scheda_tecnica_ok && form.dop_ok && form.cert_ce_ok && form.cam_ok
  const pctDocs = [form.scheda_tecnica_ok, form.dop_ok, form.cert_ce_ok, form.cam_ok, form.campione_ok]
    .filter(Boolean).length / 5 * 100

  async function saveChecklist() {
    setSaving(true)
    let nuovoStato = dam.stato
    if (form.dl_decisione === 'ACCETTATO') nuovoStato = 'ACCETTATO'
    else if (form.dl_decisione === 'RIFIUTATO') nuovoStato = 'RIFIUTATO'
    else if (form.dl_decisione === 'CON_RISERVA') nuovoStato = 'ACCETTATO'
    else if (docsComplete) nuovoStato = 'IN_VERIFICA'
    else nuovoStato = 'IN_ATTESA'
    const { error } = await supabase.from('dam').update({ ...form, stato: nuovoStato }).eq('id', dam.id)
    if (error) { console.error(error); setSaving(false); return }
    setSaving(false)
    onRefresh()
  }

  const locked = ['ACCETTATO', 'RIFIUTATO'].includes(dam.stato)

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: expanded ? '#f9fafb' : '#fff' }}>
        {expanded ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: statoInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <StatoIcon size={16} style={{ color: statoInfo.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{dam.denominazione_materiale}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Fornitore: {dam.fornitore?.ragione_sociale || '--'} | ODA: {dam.oda?.numero || '--'}</div>
        </div>
        <div style={{ flexShrink: 0, width: 80 }}>
          <div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: pctDocs === 100 ? '#059669' : '#f59e0b', borderRadius: 4, width: pctDocs + '%' }} />
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'right', marginTop: 1 }}>{Math.round(pctDocs)}% docs</div>
        </div>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600, background: statoInfo.bg, color: statoInfo.color, flexShrink: 0 }}>{statoInfo.label}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STEP 1 -- Documenti ricevuti dal fornitore</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <CheckItem label="Scheda tecnica del prodotto" checked={form.scheda_tecnica_ok} onChange={v => setForm(f => ({ ...f, scheda_tecnica_ok: v }))} disabled={locked} />
              <CheckItem label="Dichiarazione di Prestazione (DoP) Reg. UE 305/2011" checked={form.dop_ok} onChange={v => setForm(f => ({ ...f, dop_ok: v }))} disabled={locked} />
              <CheckItem label="Certificato di marcatura CE" checked={form.cert_ce_ok} onChange={v => setForm(f => ({ ...f, cert_ce_ok: v }))} disabled={locked} />
              <CheckItem label="Conformita CAM (D.Min. Ambiente)" checked={form.cam_ok} onChange={v => setForm(f => ({ ...f, cam_ok: v }))} disabled={locked} />
              <CheckItem label="Campione materiale (se richiesto DL)" checked={form.campione_ok} onChange={v => setForm(f => ({ ...f, campione_ok: v }))} disabled={locked} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STEP 2 -- Verifica conformita al capitolato speciale</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Riferimento articolo capitolato</label>
                <input value={form.ref_capitolato} onChange={e => setForm(f => ({ ...f, ref_capitolato: e.target.value }))} disabled={locked} placeholder="es. Art. 34 - Calcestruzzi strutturali" style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box', background: locked ? '#f9fafb' : '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Conforme al capitolato?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: true, l: 'SI', c: '#059669', bg: '#f0fdf4' }, { v: false, l: 'NO', c: '#dc2626', bg: '#fef2f2' }].map(opt => (
                    <button key={String(opt.v)} onClick={() => !locked && setForm(f => ({ ...f, conforme_capitolato: opt.v }))} style={{ flex: 1, padding: '6px', fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb', background: form.conforme_capitolato === opt.v ? opt.bg : '#fff', color: form.conforme_capitolato === opt.v ? opt.c : '#6b7280', cursor: locked ? 'default' : 'pointer', fontWeight: form.conforme_capitolato === opt.v ? 700 : 400 }}>{opt.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Specifica richiesta (capitolato)</label>
                <textarea value={form.specifica_richiesta} onChange={e => setForm(f => ({ ...f, specifica_richiesta: e.target.value }))} disabled={locked} rows={2} placeholder="es. Cls C25/30, Rck>=25 N/mm2, slump S3-S4, Xc2" style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', resize: 'none', boxSizing: 'border-box', background: locked ? '#f9fafb' : '#fff' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Specifica fornita (scheda tecnica)</label>
                <textarea value={form.specifica_fornita} onChange={e => setForm(f => ({ ...f, specifica_fornita: e.target.value }))} disabled={locked} rows={2} placeholder="Copiare dalla scheda tecnica del fornitore" style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', resize: 'none', boxSizing: 'border-box', background: locked ? '#f9fafb' : '#fff' }} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16, padding: 14, background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STEP 3 -- Decisione Direzione Lavori / RUP</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Nome DL / RUP che firma</label><input value={form.dl_nome} onChange={e => setForm(f => ({ ...f, dl_nome: e.target.value }))} disabled={locked} placeholder="Ing. Mario Rossi (DL)" style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box', background: locked ? '#f9fafb' : '#fff' }} /></div>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data verifica</label><input type="date" value={form.dl_data} onChange={e => setForm(f => ({ ...f, dl_data: e.target.value }))} disabled={locked} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box', background: locked ? '#f9fafb' : '#fff' }} /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 8 }}>Decisione DL *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { v: 'ACCETTATO', l: 'ACCETTATO', c: '#059669', bg: '#f0fdf4', desc: 'Conforme. ODA diventa vincolante.' },
                  { v: 'CON_RISERVA', l: 'CON RISERVA', c: '#d97706', bg: '#fffbeb', desc: 'Accettato con prescrizioni DL.' },
                  { v: 'RIFIUTATO', l: 'RIFIUTATO', c: '#dc2626', bg: '#fef2f2', desc: 'Non conforme. ODA invalidato.' },
                ].map(opt => (
                  <button key={opt.v} onClick={() => !locked && setForm(f => ({ ...f, dl_decisione: opt.v }))} style={{ padding: '10px 8px', borderRadius: 8, border: form.dl_decisione === opt.v ? '2px solid ' + opt.c : '1px solid #e5e7eb', background: form.dl_decisione === opt.v ? opt.bg : '#fff', cursor: locked ? 'default' : 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: opt.c }}>{opt.l}</div>
                    <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: form.dl_decisione === 'RIFIUTATO' ? '1fr 1fr' : '1fr', gap: 12 }}>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Note / Prescrizioni DL</label><textarea value={form.dl_note} onChange={e => setForm(f => ({ ...f, dl_note: e.target.value }))} disabled={locked} rows={2} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', resize: 'none', boxSizing: 'border-box', background: locked ? '#f9fafb' : '#fff' }} /></div>
              {form.dl_decisione === 'RIFIUTATO' && (
                <div><label style={{ fontSize: 11, color: '#dc2626', display: 'block', marginBottom: 4 }}>Motivo rifiuto (obbligatorio)</label><textarea value={form.motivo_rifiuto} onChange={e => setForm(f => ({ ...f, motivo_rifiuto: e.target.value }))} disabled={locked} rows={2} style={{ width: '100%', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 8px', resize: 'none', boxSizing: 'border-box', background: locked ? '#fef2f2' : '#fff' }} /></div>
              )}
            </div>
          </div>
          {form.dl_decisione === 'ACCETTATO' && !locked && <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#065f46' }}><CheckCircle2 size={14} style={{ flexShrink: 0 }} /> Confermando, l'ODA collegato passera automaticamente a CONFERMATO.</div>}
          {form.dl_decisione === 'RIFIUTATO' && !locked && <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#991b1b' }}><XCircle size={14} style={{ flexShrink: 0 }} /> ATTENZIONE: l'ODA collegato passera a MATERIALE_RIFIUTATO. Sara necessaria una nuova RDA.</div>}
          {locked && <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: statoInfo.bg, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12, fontSize: 12, color: statoInfo.color }}><StatoIcon size={14} style={{ flexShrink: 0 }} /> DAM {statoInfo.label} -- firmato da {dam.dl_nome || '--'} il {dam.dl_data || '--'}. Non modificabile.</div>}
          {!locked && <button onClick={saveChecklist} disabled={saving} style={{ width: '100%', padding: '10px', fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>{saving && <Loader2 size={13} className="animate-spin" />}<FileCheck2 size={13} />{form.dl_decisione ? 'Salva decisione DL: ' + form.dl_decisione : 'Salva avanzamento checklist'}</button>}
        </div>
      )}
    </div>
  )
}

export default function DAMPage() {
  const { id } = useParams() as { id: string }
  const [dam, setDam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('dam').select('*, fornitore:fornitori(ragione_sociale), oda:oda(numero)').eq('commessa_id', id).order('created_at', { ascending: false })
    setDam(data || [])
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])
  const accettati = dam.filter(d => d.stato === 'ACCETTATO').length
  const rifiutati = dam.filter(d => d.stato === 'RIFIUTATO').length
  const inAttesa = dam.filter(d => d.stato === 'IN_ATTESA').length
  const inVerifica = dam.filter(d => d.stato === 'IN_VERIFICA').length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 10, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
        <strong>Flusso DAM (Documento Accettazione Materiali):</strong><br />
        1. Il fornitore invia scheda tecnica, DoP, CE, CAM · 2. L'impresa compila la checklist e verifica conformita capitolato · 3. La scheda viene presentata alla DL per firma · 4. Solo dopo accettazione DL l'ODA diventa vincolante.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[['In attesa docs', inAttesa, '#d97706', '#fffbeb'],['In verifica DL', inVerifica, '#7c3aed', '#f5f3ff'],['Accettati DL', accettati, '#059669', '#f0fdf4'],['Rifiutati DL', rifiutati, '#dc2626', '#fef2f2']].map(([l, v, c, bg], i) => (
          <div key={i} style={{ background: bg as string, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{l}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: c as string, margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Documenti Accettazione Materiali (DAM)</h2>
      {loading
        ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /> Caricamento...</div>
        : dam.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9ca3af' }}><Package size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><p style={{ fontSize: 14, textAlign: 'center' }}>Nessun DAM -- vengono creati automaticamente dagli ODA di tipo Materiale</p></div>
        : dam.map(d => <DAMCard key={d.id} dam={d} onRefresh={load} />)
      }
    </div>
  )
}'use client'
import { useParams } from 'next/navigation'
export default function Page() {
  const { id } = useParams() as { id: string }
  return (
    <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>Modulo in costruzione</div>
      <div style={{ fontSize: 13 }}>Sarà disponibile nella prossima sessione · Commessa: {id}</div>
    </div>
  )
}
