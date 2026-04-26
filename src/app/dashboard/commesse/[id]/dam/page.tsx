'use client'

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
