'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Save, Edit2, CheckCircle } from 'lucide-react'

const PROVINCE = ['AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO','BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ','EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE','LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU','OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA','RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV','TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR','VT','VV']

const STATI = ['AGGIUDICATA','IN_ESECUZIONE','SOSPESA','COLLAUDO','CHIUSA']

export default function AnagraficaPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<Record<string, unknown>>({})
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carica() }, [id])

  async function carica() {
    const { data: d } = await supabase.from('commesse').select('*').eq('id', id).single()
    if (d) setData(d)
    setLoading(false)
  }

  function setF(field: string, val: unknown) {
    setData(prev => ({ ...prev, [field]: val }))
  }

  async function salva() {
    setSaving(true)
    const { error } = await supabase.from('commesse').update(data).eq('id', id)
    if (!error) { setSaved(true); setEdit(false); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  const inp = {
    width: '100%', background: edit ? '#ffffff' : 'var(--bg)',
    border: `1px solid ${edit ? 'var(--border)' : 'transparent'}`,
    borderRadius: 7, padding: '8px 10px', color: 'var(--t1)', fontSize: 13,
    cursor: edit ? 'text' : 'default'
  }
  const lbl = { fontSize: 10, color: 'var(--t3)', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 4 }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>

  const sezioneStyle = {
    background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '20px 24px', marginBottom: 16
  }
  const titoloSezioneStyle = {
    fontSize: 11, fontWeight: 700 as const, color: 'var(--t3)',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 16
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>

      {/* Header azioni */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>Anagrafica Commessa</h2>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>Dati contrattuali, figure professionali, date</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981' }}>
              <CheckCircle size={14} /> Salvato
            </div>
          )}
          {edit ? (
            <>
              <button onClick={() => setEdit(false)} className="btn-secondary">Annulla</button>
              <button onClick={salva} disabled={saving} className="btn-primary">
                <Save size={14} /> {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </>
          ) : (
            <button onClick={() => setEdit(true)} className="btn-secondary">
              <Edit2 size={14} /> Modifica
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Sezione 1: Identificativi */}
        <div style={{ ...sezioneStyle, gridColumn: 'span 2' }}>
          <div style={titoloSezioneStyle}>📋 Identificativi gara/contratto</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <div>
              <label style={lbl}>Codice commessa</label>
              <div style={{ ...inp, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid rgba(59,130,246,0.2)' }}>
                {data.codice as string}
              </div>
            </div>
            <div>
              <label style={lbl}>CIG</label>
              <input readOnly={!edit} value={(data.cig as string) || ''} onChange={e => setF('cig', e.target.value)} style={{ ...inp, fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <label style={lbl}>CUP</label>
              <input readOnly={!edit} value={(data.cup as string) || ''} onChange={e => setF('cup', e.target.value)} style={{ ...inp, fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <label style={lbl}>Stato</label>
              {edit ? (
                <select value={(data.stato as string) || ''} onChange={e => setF('stato', e.target.value)} style={{ ...inp, width: '100%' }}>
                  {STATI.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              ) : (
                <div style={inp}>{(data.stato as string || '').replace('_',' ')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Sezione 2: Committente */}
        <div style={sezioneStyle}>
          <div style={titoloSezioneStyle}>🏛️ Committente / Stazione appaltante</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>Ragione sociale *</label>
              <input readOnly={!edit} value={(data.committente as string) || ''} onChange={e => setF('committente', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>P.IVA</label>
              <input readOnly={!edit} value={(data.piva_committente as string) || ''} onChange={e => setF('piva_committente', e.target.value)} style={{ ...inp, fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
        </div>

        {/* Sezione 3: Opera */}
        <div style={sezioneStyle}>
          <div style={titoloSezioneStyle}>🏗️ Oggetto dell'appalto</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>Nome commessa / Alias *</label>
              <input readOnly={!edit} value={(data.nome as string) || ''} onChange={e => setF('nome', e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Provincia</label>
                {edit ? (
                  <select value={(data.provincia as string) || 'NA'} onChange={e => setF('provincia', e.target.value)} style={{ ...inp, width: '100%' }}>
                    {PROVINCE.map(p => <option key={p}>{p}</option>)}
                  </select>
                ) : (
                  <div style={inp}>{data.provincia as string}</div>
                )}
              </div>
              <div>
                <label style={lbl}>Categoria opera</label>
                <input readOnly={!edit} value={(data.categoria as string) || ''} onChange={e => setF('categoria', e.target.value)} style={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* Sezione 4: Dati economici */}
        <div style={sezioneStyle}>
          <div style={titoloSezioneStyle}>💶 Dati economici</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { field: 'importo_base', label: 'Importo base asta (€)', type: 'number' },
              { field: 'ribasso_pct', label: 'Ribasso offerto (%)', type: 'number' },
              { field: 'oneri_sicurezza', label: 'Oneri sicurezza (€)', type: 'number' },
            ].map(f => (
              <div key={f.field}>
                <label style={lbl}>{f.label}</label>
                <input readOnly={!edit} type={f.type} value={(data[f.field] as number) || 0} onChange={e => setF(f.field, +e.target.value)} style={{ ...inp, fontFamily: 'var(--font-mono)' }} />
              </div>
            ))}
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>IMPORTO AGGIUDICATO</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                € {((data.importo_base as number || 0) * (1 - (data.ribasso_pct as number || 0) / 100)).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        {/* Sezione 5: Date */}
        <div style={sezioneStyle}>
          <div style={titoloSezioneStyle}>📅 Date contrattuali</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { field: 'data_aggiudicazione', label: 'Data aggiudicazione' },
              { field: 'data_consegna_cantiere', label: 'Consegna cantiere' },
              { field: 'data_inizio', label: 'Inizio lavori' },
              { field: 'data_fine_contrattuale', label: 'Fine lavori contrattuale' },
              { field: 'data_fine_effettiva', label: 'Fine lavori effettiva' },
            ].map(f => (
              <div key={f.field} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ ...lbl, marginBottom: 0 }}>{f.label}</label>
                {edit ? (
                  <input type="date" value={(data[f.field] as string) || ''} onChange={e => setF(f.field, e.target.value)} style={{ ...inp, width: 160, fontFamily: 'var(--font-mono)' }} />
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t2)' }}>{(data[f.field] as string) || '—'}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sezione 6: Figure professionali */}
        <div style={{ ...sezioneStyle, gridColumn: 'span 2' }}>
          <div style={titoloSezioneStyle}>👤 Figure professionali</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { nome: 'dl_nome', email: 'dl_email', tel: 'dl_telefono', label: 'Direttore Lavori (DL)' },
              { nome: 'rup_nome', email: 'rup_email', tel: null, label: 'RUP' },
              { nome: 'cse_nome', email: null, tel: null, label: 'Coordinatore Sicurezza Esecuzione (CSE)' },
            ].map(fig => (
              <div key={fig.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 10 }}>{fig.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label style={lbl}>Nome e cognome</label>
                    <input readOnly={!edit} value={(data[fig.nome] as string) || ''} onChange={e => setF(fig.nome, e.target.value)} placeholder="Ing. / Arch. / Geom." style={inp} />
                  </div>
                  {fig.email && (
                    <div>
                      <label style={lbl}>Email</label>
                      <input readOnly={!edit} value={(data[fig.email] as string) || ''} onChange={e => setF(fig.email!, e.target.value)} style={inp} />
                    </div>
                  )}
                  {fig.tel && (
                    <div>
                      <label style={lbl}>Telefono</label>
                      <input readOnly={!edit} value={(data[fig.tel] as string) || ''} onChange={e => setF(fig.tel!, e.target.value)} style={inp} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sezione 7: Note */}
        <div style={{ ...sezioneStyle, gridColumn: 'span 2' }}>
          <div style={titoloSezioneStyle}>📝 Note interne</div>
          <textarea
            readOnly={!edit}
            value={(data.note as string) || ''}
            onChange={e => setF('note', e.target.value)}
            placeholder="Note operative, avvertenze, informazioni rilevanti sulla commessa..."
            style={{ ...inp, resize: 'vertical', minHeight: 80, width: '100%' }}
          />
        </div>

      </div>
    </div>
  )
}
