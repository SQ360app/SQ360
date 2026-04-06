'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { FileText, Download, Filter, Calendar, Building2, BarChart3, Clock, FileSpreadsheet, CheckCircle } from 'lucide-react'

interface TipoReport {
  id: string
  titolo: string
  descrizione: string
  modulo: string
  formati: ('pdf' | 'xlsx' | 'csv')[]
  icona: string
  template: string
}

const REPORT_DISPONIBILI: TipoReport[] = [
  { id:'r1', titolo:'Report Commessa Completo', descrizione:'Riepilogo dati commessa: economico, avanzamento, SAL, scadenze', modulo:'Commesse', formati:['pdf','xlsx'], icona:'📋', template:'commessa_completa' },
  { id:'r2', titolo:'Analisi Marginalità', descrizione:'Confronto preventivo vs consuntivo con scostamenti per voce', modulo:'M5C', formati:['pdf','xlsx'], icona:'📊', template:'marginalita' },
  { id:'r3', titolo:'SAL Riepilogativo', descrizione:'Tutti i SAL attivi e passivi con stato approvazione', modulo:'SAL', formati:['pdf','xlsx'], icona:'💶', template:'sal_riepilogo' },
  { id:'r4', titolo:'Scadenzario DURC/SOA', descrizione:'Fornitori con scadenze documento entro X giorni', modulo:'Fornitori', formati:['pdf','xlsx','csv'], icona:'📅', template:'scadenze_compliance' },
  { id:'r5', titolo:'Giornale Lavori', descrizione:'Registro accessi, consegne e annotazioni per commessa', modulo:'Cantiere', formati:['pdf'], icona:'📝', template:'giornale_lavori' },
  { id:'r6', titolo:'Situazione Crediti/Debiti', descrizione:'Fatture attive/passive con scadenze e ritenute', modulo:'Amministrazione', formati:['pdf','xlsx'], icona:'💼', template:'crediti_debiti' },
  { id:'r7', titolo:'DAM — Stato Accettazione Materiali', descrizione:'Tutti i dossier con stato (approvato/annotazioni/rev)', modulo:'DAM', formati:['pdf','xlsx'], icona:'📦', template:'dam_stato' },
  { id:'r8', titolo:'Contratti Subappalto', descrizione:'Elenco contratti, importi, SAL passivi, ritenute per sub', modulo:'Contratti', formati:['pdf','xlsx'], icona:'📜', template:'contratti_sub' },
  { id:'r9', titolo:'Preventivo Costi', descrizione:'Preventivo per gruppi di lavoro con breakdown per tipo', modulo:'M2', formati:['pdf','xlsx'], icona:'🔢', template:'preventivo_costi' },
  { id:'r10', titolo:'Pianificazione Gantt', descrizione:'Diagramma Gantt con percorso critico e milestone', modulo:'M3', formati:['pdf'], icona:'📈', template:'gantt' },
]

const MODULO_COLORS: Record<string, string> = {
  'Commesse': '#3b82f6', 'M5C': '#10b981', 'SAL': '#f59e0b',
  'Fornitori': '#8b5cf6', 'Cantiere': '#6b7280', 'Amministrazione': '#ef4444',
  'DAM': '#0ea5e9', 'Contratti': '#ec4899', 'M2': '#14b8a6', 'M3': '#f97316'
}

interface GenerazioneLog {
  id: string
  report: string
  commessa: string
  formato: string
  data: string
  stato: 'ok' | 'errore'
}

const LOG_INIT: GenerazioneLog[] = [
  { id:'l1', report:'Analisi Marginalità', commessa:'C-2024-007', formato:'PDF', data:'2024-06-01 09:15', stato:'ok' },
  { id:'l2', report:'SAL Riepilogativo', commessa:'C-2024-003', formato:'XLSX', data:'2024-05-30 14:22', stato:'ok' },
  { id:'l3', report:'Scadenzario DURC/SOA', commessa:'Tutte', formato:'PDF', data:'2024-05-28 11:05', stato:'ok' },
]

export default function ReportPage() {
  const [commessaFiltro, setCommessaFiltro] = useState('tutte')
  const [periodoFiltro, setPeriodoFiltro] = useState('')
  const [generando, setGenerando] = useState<string | null>(null)
  const [log, setLog] = useState<GenerazioneLog[]>(LOG_INIT)

  function genera(r: TipoReport, formato: string) {
    setGenerando(r.id + formato)
    setTimeout(() => {
      setGenerando(null)
      setLog(prev => [{
        id: Date.now().toString(),
        report: r.titolo,
        commessa: commessaFiltro === 'tutte' ? 'Tutte' : commessaFiltro,
        formato: formato.toUpperCase(),
        data: new Date().toLocaleString('it-IT'),
        stato: 'ok'
      }, ...prev.slice(0, 9)])
    }, 1800)
  }

  return (
    <>
      <Header title="Report & Esportazioni" breadcrumb={['Dashboard', 'Report']} />
      <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

        {/* Filtri globali */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>Commessa</label>
            <select value={commessaFiltro} onChange={e => setCommessaFiltro(e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--t1)', fontSize: 13 }}>
              <option value="tutte">Tutte le commesse</option>
              <option value="C-2024-007">C-2024-007 — Via Roma</option>
              <option value="C-2024-003">C-2024-003 — Capannone Nord</option>
              <option value="C-2024-012">C-2024-012 — Ristrutturazione Villa</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>Periodo</label>
            <input type="month" value={periodoFiltro} onChange={e => setPeriodoFiltro(e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--t1)', fontSize: 13 }} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} color="var(--t3)" />
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>I filtri si applicano a tutti i report generati</span>
          </div>
        </div>

        {/* Grid report */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12, marginBottom: 32 }}>
          {REPORT_DISPONIBILI.map(r => {
            const mc = MODULO_COLORS[r.modulo] ?? '#6b7280'
            return (
              <div key={r.id} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 24 }}>{r.icona}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.3 }}>{r.titolo}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 }}>{r.descrizione}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, background: `${mc}15`, color: mc, border: `1px solid ${mc}40`, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>{r.modulo}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.formati.map(fmt => {
                    const isLoading = generando === r.id + fmt
                    return (
                      <button
                        key={fmt}
                        onClick={() => genera(r, fmt)}
                        disabled={!!generando}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
                          background: isLoading ? 'var(--accent)' : 'var(--bg)',
                          color: isLoading ? 'white' : 'var(--t2)',
                          fontSize: 12, fontWeight: 600, cursor: generando ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isLoading ? (
                          <>
                            <div style={{ width: 12, height: 12, border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Generando...
                          </>
                        ) : (
                          <>
                            {fmt === 'pdf' ? <FileText size={12} /> : <FileSpreadsheet size={12} />}
                            {fmt.toUpperCase()}
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Log generazioni */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={14} color="var(--t3)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>Ultime esportazioni</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Report', 'Commessa', 'Formato', 'Data', 'Stato', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--t1)' }}>{l.report}</td>
                  <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{l.commessa}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>{l.formato}</span>
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{l.data}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <CheckCircle size={14} color="#10b981" />
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--t3)', fontSize: 11, cursor: 'pointer' }}>
                      <Download size={11} /> Scarica
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
