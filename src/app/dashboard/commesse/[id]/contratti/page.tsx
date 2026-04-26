'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FileText, AlertTriangle, CheckCircle2, Clock, Loader2, ChevronDown, ChevronRight, Shield } from 'lucide-react'

const fmt = (n: number) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATI = {
  BOZZA:    { label: 'Bozza',     color: '#6b7280', bg: '#f3f4f6' },
  IN_FIRMA: { label: 'In firma',  color: '#d97706', bg: '#fffbeb' },
  ATTIVO:   { label: 'Attivo',    color: '#059669', bg: '#f0fdf4' },
  SOSPESO:  { label: 'Sospeso',   color: '#dc2626', bg: '#fef2f2' },
  CONCLUSO: { label: 'Concluso',  color: '#2563eb', bg: '#eff6ff' },
  RESCISSO: { label: 'Rescisso',  color: '#7c3aed', bg: '#f5f3ff' },
} as const

type StatoKey = keyof typeof STATI

export default function ContrattiPage() {
  const { id } = useParams() as { id: string }
  const [contratti, setContratti] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: c } = await supabase.from('contratti_sub')
      .select('*, fornitore:fornitori(ragione_sociale, piva)')
      .eq('commessa_id', id)
      .order('created_at', { ascending: false })
    setContratti(c || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function cambiaStato(cid: string, stato: string) {
    setSaving(true)
    await supabase.from('contratti_sub').update({ stato }).eq('id', cid)
    setSaving(false)
    load()
  }

  async function toggleCheck(cid: string, campo: string, val: boolean) {
    await supabase.from('contratti_sub').update({ [campo]: val }).eq('id', cid)
    load()
  }

  const totale = contratti
    .filter(c => c.stato !== 'RESCISSO')
    .reduce((s, c) => s + (c.importo_netto || 0), 0)

  const ritenute = contratti
    .filter(c => c.stato === 'ATTIVO')
    .reduce((s, c) => s + (c.importo_netto || 0) * ((c.ritenuta_pct || 5) / 100), 0)

  const attivi = contratti.filter(c => c.stato === 'ATTIVO').length

  const durcAlert = contratti.filter(c => {
    if (!c.durc_scadenza) return false
    const days = Math.ceil((new Date(c.durc_scadenza).getTime() - Date.now()) / 86400000)
    return days < 30
  }).length

  const kpi = [
    { l: 'Contratti attivi', v: String(attivi), c: '#059669' },
    { l: 'Valore impegnato', v: 'EUR ' + fmt(totale), c: '#2563eb' },
    { l: 'Ritenute accumulate', v: 'EUR ' + fmt(ritenute), c: '#7c3aed' },
    { l: durcAlert > 0 ? 'ALERT DURC' : 'DURC ok', v: durcAlert > 0 ? String(durcAlert) + ' contratti' : 'Tutti validi', c: durcAlert > 0 ? '#dc2626' : '#059669' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {kpi.map((item, i) => (
          <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>{item.l}</p>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: item.c }}>{item.v}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
        <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>D.Lgs. 36/2023 art. 119:</strong> Comunicazione subappalto alla SA almeno 5 giorni prima dell&apos;inizio lavori.
          Ritenuta di garanzia 5% svincolata a collaudo. DURC in corso di validita obbligatorio per ogni SAL.
        </span>
      </div>

      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Contratti di Subappalto</h2>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
          Generati dall&apos;ODA — aggiorna stati e verifica conformita documentale
        </p>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: '#9ca3af' }}>
          <Loader2 size={16} className="animate-spin" /> Caricamento...
        </div>
      )}

      {!loading && contratti.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '2px dashed #e5e7eb' }}>
          <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Nessun contratto — crea un ODA di tipo Subappalto</p>
        </div>
      )}

      {!loading && contratti.map(c => {
        const statoKey = c.stato as StatoKey
        const si = STATI[statoKey] || STATI.BOZZA
        const isExp = expanded === c.id
        const durcDays = c.durc_scadenza
          ? Math.ceil((new Date(c.durc_scadenza).getTime() - Date.now()) / 86400000)
          : null
        const isDurcAlert = durcDays !== null && durcDays < 30

        return (
          <div key={c.id} style={{ border: isDurcAlert ? '2px solid #fca5a5' : '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div
              onClick={() => setExpanded(isExp ? null : c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isExp ? '#f9fafb' : '#fff' }}>
              {isExp
                ? <ChevronDown size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
                : <ChevronRight size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />}
              {c.stato === 'ATTIVO'
                ? <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
                : c.stato === 'SOSPESO' || c.stato === 'RESCISSO'
                ? <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                : <Clock size={18} style={{ color: '#d97706', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.fornitore?.ragione_sociale || 'Fornitore non assegnato'}
                  </p>
                  {isDurcAlert && (
                    <span style={{ fontSize: 10, padding: '2px 6px', background: '#fee2e2', color: '#dc2626', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
                      DURC {durcDays !== null && durcDays <= 0 ? 'SCADUTO' : 'scade ' + String(durcDays) + 'gg'}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                  {c.oggetto || 'Contratto subappalto'}
                  {c.data_stipula ? ' — Stipulato: ' + String(c.data_stipula) : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>EUR {fmt(c.importo_netto || 0)}</span>
                <span style={{ fontSize: 11, color: '#7c3aed' }}>
                  Ritenuta {c.ritenuta_pct || 5}% = EUR {fmt((c.importo_netto || 0) * (c.ritenuta_pct || 5) / 100)}
                </span>
              </div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600, background: si.bg, color: si.color, flexShrink: 0 }}>
                {si.label}
              </span>
            </div>

            {isExp && (
              <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14, fontSize: 12 }}>
                  {[
                    ['Importo netto', 'EUR ' + fmt(c.importo_netto || 0)],
                    ['Ritenuta ' + String(c.ritenuta_pct || 5) + '%', 'EUR ' + fmt((c.importo_netto || 0) * (c.ritenuta_pct || 5) / 100)],
                    ['Da liquidare', 'EUR ' + fmt((c.importo_netto || 0) * (1 - (c.ritenuta_pct || 5) / 100))],
                    ['Data stipula', c.data_stipula || '—'],
                    ['Inizio lavori', c.data_inizio || '—'],
                    ['Fine prevista', c.data_fine_prevista || '—'],
                    ['DURC scadenza', c.durc_scadenza || '—'],
                    ['P.IVA fornitore', c.fornitore?.piva || '—'],
                  ].map(([l, v]) => (
                    <div key={String(l)} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>{l}</p>
                      <p style={{ fontSize: 12, margin: 0, fontWeight: 500 }}>{String(v)}</p>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={13} /> Conformita D.Lgs. 36/2023
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      { label: 'DURC in corso di validita', campo: 'durc_ok' },
                      { label: 'Comunicazione SA eseguita', campo: 'comunicazione_sa' },
                      { label: 'Antimafia verificata', campo: 'antimafia_ok' },
                      { label: 'POS trasmesso e approvato', campo: 'pos_approvato' },
                    ].map(item => (
                      <div
                        key={item.campo}
                        onClick={() => toggleCheck(c.id, item.campo, !c[item.campo])}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                          background: c[item.campo] ? '#f0fdf4' : '#fef2f2',
                          border: '1px solid ' + (c[item.campo] ? '#bbf7d0' : '#fecaca') }}>
                        {c[item.campo]
                          ? <CheckCircle2 size={14} style={{ color: '#059669', flexShrink: 0 }} />
                          : <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />}
                        <span style={{ fontSize: 12, color: c[item.campo] ? '#065f46' : '#991b1b' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Cambia stato:</span>
                  {(Object.keys(STATI) as StatoKey[])
                    .filter(k => k !== c.stato)
                    .map(k => (
                      <button
                        key={k}
                        disabled={saving}
                        onClick={() => cambiaStato(c.id, k)}
                        style={{ fontSize: 11, padding: '4px 10px', border: '1px solid ' + STATI[k].color, borderRadius: 6, background: STATI[k].bg, color: STATI[k].color, cursor: 'pointer' }}>
                        {STATI[k].label}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
