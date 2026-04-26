'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Loader2, CheckCircle2, XCircle, Clock, FileCheck, Shield, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

const STATI_DAM: Record<string, { label: string; color: string; bg: string }> = {
  BOZZA:                  { label: 'Bozza',               color: '#6b7280', bg: '#f3f4f6' },
  DOCUMENTAZIONE_INVIATA: { label: 'Doc. ricevuta',        color: '#7c3aed', bg: '#f5f3ff' },
  INVIATA_A_DL:           { label: 'Inviata a DL',         color: '#d97706', bg: '#fffbeb' },
  IN_REVISIONE_DL:        { label: 'In revisione DL',      color: '#2563eb', bg: '#eff6ff' },
  ACCETTATA:              { label: 'Accettata',             color: '#059669', bg: '#f0fdf4' },
  ACCETTATA_CON_RISERVA:  { label: 'Accettata c.riserva',  color: '#d97706', bg: '#fffbeb' },
  RIFIUTATA:              { label: 'Rifiutata',             color: '#dc2626', bg: '#fef2f2' },
  SCADUTA:                { label: 'Scaduta',               color: '#6b7280', bg: '#f3f4f6' },
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
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{dam.denominazione_materiale}</p>
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
              <div><strong>Materiale accettato dalla DL</strong>{dam.dl_nome && ' - firmato da ' + dam.dl_nome}{dam.data_risposta_dl && ' il ' + dam.data_risposta_dl}{dam.note_dl && <><br /><em>Note: {dam.note_dl}</em></>}{dam.oda_id && <><br />ODA collegato portato automaticamente a stato EMESSO.</>}</div>
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
            {[['Invio DL', dam.data_invio_dl], ['Risposta DL', dam.data_risposta_dl], ['DL / RUP', dam.dl_nome], ['Norma', dam.norma_riferimento]].map(([l, v]) => (
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
              {dam.stato !== 'RIFIUTATA' && <div style={{ marginTop: 8 }}><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Motivo rifiuto (se rifiutato)</label><input value={motivoRifiuto} onChange={e => setMotivoRifiuto(e.target.value)} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>}
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

  const accettati = dams.filter(d => ['ACCETTATA', 'ACCETTATA_CON_RISERVA'].includes(d.stato)).length
  const rifiutati = dams.filter(d => d.stato === 'RIFIUTATA').length
  const inCorso   = dams.filter(d => ['INVIATA_A_DL', 'IN_REVISIONE_DL', 'DOCUMENTAZIONE_INVIATA'].includes(d.stato)).length

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
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Il DAM deve essere accettato dalla DL PRIMA dell'emissione dell'ODA e di qualsiasi consegna.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}><RefreshCw size={12} /> Aggiorna</button>
          <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}><Plus size={14} /> Nuovo DAM</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 12, color: '#1e40af' }}>
        <FileCheck size={16} style={{ color: '#2563eb', flexShrink: 0, marginTop: 1 }} />
        <div><strong>Flusso corretto (D.Lgs. 36/2023 art. 101):</strong> Fornitore invia ST+DoP+CE+CAM - Impresa prepara DAM - DL esamina - <strong style={{ color: '#059669' }}>ACCETTA: ODA sbloccato</strong> oppure <strong style={{ color: '#dc2626' }}>RIFIUTA: ODA sospeso, fornitore alternativo</strong></div>
      </div>
      {loading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}><Loader2 size={16} className="animate-spin" /> Caricamento...</div>
        : dams.length === 0 ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}><Shield size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><p style={{ fontSize: 14 }}>Nessun DAM - crea il primo documento di accettazione materiali</p></div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{dams.map(d => <DAMCard key={d.id} dam={d} fornitori={fornitori} onRefresh={load} />)}</div>
      }
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 500, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Nuovo DAM</h2>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 16px' }}>Il DAM deve essere accettato dalla DL PRIMA che l'ODA venga confermato.</p>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Denominazione materiale *</label><input value={form.denominazione} onChange={e => setForm(p => ({ ...p, denominazione: e.target.value }))} placeholder="es. Calcestruzzo C25/30..." style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxSizing: 'border-box' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Fornitore</label><select value={form.fornitore_id} onChange={e => setForm(p => ({ ...p, fornitore_id: e.target.value }))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}><option value="">Da assegnare</option>{fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>ODA collegato</label><select value={form.oda_id} onChange={e => setForm(p => ({ ...p, oda_id: e.target.value }))} style={{ width: '100%', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}><option value="">Nessuno</option>{odaList.map(o => <option key={o.id} value={o.id}>{o.numero}</option>)}</select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Norma</label><input value={form.norma} onChange={e => setForm(p => ({ ...p, norma: e.target.value }))} placeholder="UNI EN 206" style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Marca</label><input value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Classe</label><input value={form.classe} onChange={e => setForm(p => ({ ...p, classe: e.target.value }))} placeholder="C25/30" style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box' }} /></div>
            </div>
            {err && <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 10, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>{saving && <Loader2 size={13} className="animate-spin" />} Crea DAM</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
