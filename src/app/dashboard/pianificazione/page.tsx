'use client'

import { useState, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { Plus, ChevronDown, ChevronRight, Calendar, Users, AlertTriangle, Flag, Download } from 'lucide-react'

// ─── Tipi ────────────────────────────────────────────────────────────────────
type StatoTask = 'da_fare' | 'in_corso' | 'completata' | 'bloccata'
type TipoTask = 'lavorazione' | 'milestone' | 'fornitura' | 'collaudo' | 'sospensione'

interface TaskRisorsa {
  nome: string
  ruolo: string
}

interface Task {
  id: string
  codice: string
  titolo: string
  tipo: TipoTask
  stato: StatoTask
  inizio: string       // YYYY-MM-DD
  fine: string
  avanzamento_pct: number
  predecessori: string[]
  risorse: TaskRisorsa[]
  note: string
  critico: boolean
}

interface FaseGantt {
  id: string
  titolo: string
  tasks: Task[]
  espanso: boolean
}

// ─── Colori ──────────────────────────────────────────────────────────────────
const STATO_COLORS: Record<StatoTask, string> = {
  da_fare: '#6b7280',
  in_corso: '#3b82f6',
  completata: '#10b981',
  bloccata: '#ef4444'
}
const TIPO_COLORS: Record<TipoTask, string> = {
  lavorazione: '#3b82f6',
  milestone: '#f59e0b',
  fornitura: '#8b5cf6',
  collaudo: '#10b981',
  sospensione: '#ef4444'
}

// ─── Dati campione ───────────────────────────────────────────────────────────
const FASI_INIT: FaseGantt[] = [
  {
    id: 'f1', titolo: 'FASE 1 — STRUTTURE', espanso: true,
    tasks: [
      { id:'t1', codice:'01.001', titolo:'Scavi e fondazioni', tipo:'lavorazione', stato:'completata', inizio:'2024-03-01', fine:'2024-03-22', avanzamento_pct:100, predecessori:[], risorse:[{nome:'Squadra A',ruolo:'Scavatorista'},{nome:'Bianchi Mario',ruolo:'Muratore'}], note:'', critico:true },
      { id:'t2', codice:'01.002', titolo:'Struttura in c.a.', tipo:'lavorazione', stato:'in_corso', inizio:'2024-03-18', fine:'2024-05-10', avanzamento_pct:65, predecessori:['t1'], risorse:[{nome:'Squadra A',ruolo:'Carpentiere'},{nome:'Verdi Luca',ruolo:'Ferraiolo'}], note:'Cemento in attesa CAR', critico:true },
      { id:'t3', codice:'01.M01', titolo:'✦ Collaudo strutturale', tipo:'milestone', stato:'da_fare', inizio:'2024-05-10', fine:'2024-05-10', avanzamento_pct:0, predecessori:['t2'], risorse:[{nome:'Ing. Rossi',ruolo:'Collaudatore'}], note:'', critico:true },
    ]
  },
  {
    id: 'f2', titolo: 'FASE 2 — CHIUSURE E PARTIZIONI', espanso: true,
    tasks: [
      { id:'t4', codice:'02.001', titolo:'Murature perimetrali', tipo:'lavorazione', stato:'da_fare', inizio:'2024-05-13', fine:'2024-06-07', avanzamento_pct:0, predecessori:['t3'], risorse:[{nome:'Muratori Rossi srl',ruolo:'Subappaltatore'}], note:'', critico:false },
      { id:'t5', codice:'02.002', titolo:'Fornitura serramenti', tipo:'fornitura', stato:'da_fare', inizio:'2024-04-15', fine:'2024-05-30', avanzamento_pct:0, predecessori:[], risorse:[{nome:'Finestre Bianchi',ruolo:'Fornitore'}], note:'Tempi consegna 6 sett.', critico:false },
      { id:'t6', codice:'02.003', titolo:'Posa serramenti', tipo:'lavorazione', stato:'da_fare', inizio:'2024-06-10', fine:'2024-06-28', avanzamento_pct:0, predecessori:['t4','t5'], risorse:[{nome:'Squadra B',ruolo:'Posatore'}], note:'', critico:false },
    ]
  },
  {
    id: 'f3', titolo: 'FASE 3 — IMPIANTI', espanso: false,
    tasks: [
      { id:'t7', codice:'03.001', titolo:'Impianto elettrico', tipo:'lavorazione', stato:'da_fare', inizio:'2024-06-01', fine:'2024-07-20', avanzamento_pct:0, predecessori:['t3'], risorse:[{nome:'Elettrica Sud srl',ruolo:'Subappaltatore'}], note:'', critico:false },
      { id:'t8', codice:'03.002', titolo:'Impianto idrico-sanitario', tipo:'lavorazione', stato:'da_fare', inizio:'2024-06-10', fine:'2024-07-25', avanzamento_pct:0, predecessori:['t3'], risorse:[{nome:'Idroterm srl',ruolo:'Subappaltatore'}], note:'', critico:false },
      { id:'t9', codice:'03.M01', titolo:'✦ Collaudo impianti', tipo:'collaudo', stato:'da_fare', inizio:'2024-07-26', fine:'2024-07-26', avanzamento_pct:0, predecessori:['t7','t8'], risorse:[{nome:'Tecnico INAIL',ruolo:'Collaudatore'}], note:'', critico:true },
    ]
  },
  {
    id: 'f4', titolo: 'FASE 4 — FINITURE E CONSEGNA', espanso: false,
    tasks: [
      { id:'t10', codice:'04.001', titolo:'Intonaci e pavimenti', tipo:'lavorazione', stato:'da_fare', inizio:'2024-07-15', fine:'2024-08-30', avanzamento_pct:0, predecessori:['t6'], risorse:[{nome:'Squadra C',ruolo:'Finissaggio'}], note:'', critico:false },
      { id:'t11', codice:'04.002', titolo:'Pitture e rifinitura', tipo:'lavorazione', stato:'da_fare', inizio:'2024-09-02', fine:'2024-09-20', avanzamento_pct:0, predecessori:['t10'], risorse:[{nome:'Tinteggiatura Verdi',ruolo:'Imbianchino'}], note:'', critico:false },
      { id:'t12', codice:'04.M01', titolo:'✦ Consegna al Committente', tipo:'milestone', stato:'da_fare', inizio:'2024-09-30', fine:'2024-09-30', avanzamento_pct:0, predecessori:['t11','t9'], risorse:[], note:'', critico:true },
    ]
  }
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseDate(s: string) { return new Date(s) }
function daysBetween(a: string, b: string) { return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000) }
function addDays(s: string, d: number) { const dt = parseDate(s); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0,10) }

// ─── Calcolo range globale ───────────────────────────────────────────────────
function getRangeGlobale(fasi: FaseGantt[]) {
  const dates = fasi.flatMap(f => f.tasks).flatMap(t => [t.inizio, t.fine])
  return {
    min: dates.reduce((a, b) => a < b ? a : b),
    max: dates.reduce((a, b) => a > b ? a : b)
  }
}

// ─── Componente Gantt Bar ─────────────────────────────────────────────────────
function GanttBar({ task, rangeMin, totalDays, pxPerDay }: { task: Task; rangeMin: string; totalDays: number; pxPerDay: number }) {
  const offsetDays = daysBetween(rangeMin, task.inizio)
  const durationDays = Math.max(1, daysBetween(task.inizio, task.fine))
  const left = offsetDays * pxPerDay
  const width = durationDays * pxPerDay
  const color = task.critico ? '#ef4444' : TIPO_COLORS[task.tipo]

  if (task.tipo === 'milestone') {
    return (
      <div style={{ position: 'absolute', left: left + width / 2 - 8, top: '50%', transform: 'translateY(-50%)' }}>
        <div style={{ width: 16, height: 16, background: '#f59e0b', transform: 'rotate(45deg)', border: '2px solid white', boxShadow: '0 0 0 1px #f59e0b' }} />
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', left, top: '50%', transform: 'translateY(-50%)', width, height: 18, background: `${color}22`, border: `1px solid ${color}60`, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${task.avanzamento_pct}%`, height: '100%', background: color, opacity: 0.7, borderRadius: 3 }} />
      {width > 60 && <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'white', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: width - 12 }}>
        {task.avanzamento_pct}% {task.titolo}
      </span>}
    </div>
  )
}

// ─── Componente principale ───────────────────────────────────────────────────
export default function PianificazionePage() {
  const [fasi, setFasi] = useState<FaseGantt[]>(FASI_INIT)
  const [vista, setVista] = useState<'gantt' | 'lista'>('gantt')
  const [commessa, setCommessa] = useState('C-2024-007 — Palazzina via Roma')
  const PX_PER_DAY = 18

  const range = getRangeGlobale(fasi)
  const totalDays = daysBetween(range.min, range.max) + 14
  const ganttWidth = totalDays * PX_PER_DAY

  // Genera intestazioni settimane
  function getWeekHeaders() {
    const headers = []
    let cur = range.min
    while (cur <= addDays(range.max, 7)) {
      const d = parseDate(cur)
      headers.push({ label: `W${getWeekNum(d)} — ${d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })}`, date: cur })
      cur = addDays(cur, 7)
    }
    return headers
  }
  function getWeekNum(d: Date) { const s = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d.getTime() - s.getTime()) / 86400000 + s.getDay() + 1) / 7) }

  function toggleFase(fid: string) {
    setFasi(prev => prev.map(f => f.id === fid ? { ...f, espanso: !f.espanso } : f))
  }

  const allTasks = fasi.flatMap(f => f.tasks)
  const completate = allTasks.filter(t => t.stato === 'completata').length
  const inCorso = allTasks.filter(t => t.stato === 'in_corso').length
  const bloccate = allTasks.filter(t => t.stato === 'bloccata').length
  const critiche = allTasks.filter(t => t.critico).length

  const rowH = 38

  return (
    <>
      <Header title="M3 — Pianificazione Lavori" breadcrumb={['Dashboard', 'Pianificazione']} />
      <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input value={commessa} onChange={e => setCommessa(e.target.value)} style={{
              background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '8px 12px', color: 'var(--t1)', fontSize: 14, width: '100%'
            }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['gantt', 'lista'] as const).map(v => (
              <button key={v} onClick={() => setVista(v)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: vista === v ? 'var(--accent)' : 'var(--panel)',
                color: vista === v ? 'white' : 'var(--t2)', fontSize: 13, cursor: 'pointer', fontWeight: 600
              }}>{v === 'gantt' ? '📊 Gantt' : '📋 Lista'}</button>
            ))}
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>
            <Download size={14} /> Esporta PDF
          </button>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Task totali', val: allTasks.length, color: '#3b82f6' },
            { label: 'Completate', val: completate, color: '#10b981' },
            { label: 'In corso', val: inCorso, color: '#f59e0b' },
            { label: 'Bloccate', val: bloccate, color: '#ef4444' },
            { label: 'Percorso critico', val: critiche, color: '#ef4444' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {vista === 'gantt' ? (
          /* ─── Vista Gantt ─── */
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex' }}>
              {/* Colonna sinistra — task names */}
              <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
                <div style={{ height: 40, borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', alignItems: 'center', background: 'var(--bg)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attività</span>
                </div>
                {fasi.map(fase => (
                  <div key={fase.id}>
                    {/* Header fase */}
                    <div
                      onClick={() => toggleFase(fase.id)}
                      style={{ height: rowH, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid var(--border)' }}
                    >
                      {fase.espanso ? <ChevronDown size={13} color="var(--t3)" /> : <ChevronRight size={13} color="var(--t3)" />}
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{fase.titolo}</span>
                    </div>
                    {/* Tasks */}
                    {fase.espanso && fase.tasks.map(task => (
                      <div key={task.id} style={{ height: rowH, padding: '0 16px 0 28px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
                        {task.critico && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />}
                        <span style={{ fontSize: 12, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{task.titolo}</span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATO_COLORS[task.stato], flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Colonna destra — Gantt bars */}
              <div style={{ overflowX: 'auto', flex: 1 }}>
                {/* Header settimane */}
                <div style={{ height: 40, borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', position: 'sticky', top: 0, zIndex: 2 }}>
                  {getWeekHeaders().map((w, i) => (
                    <div key={i} style={{ minWidth: 7 * PX_PER_DAY, borderRight: '1px solid var(--border)', padding: '0 8px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{w.label}</span>
                    </div>
                  ))}
                </div>

                {/* Righe Gantt */}
                <div style={{ width: ganttWidth, position: 'relative' }}>
                  {fasi.map(fase => (
                    <div key={fase.id}>
                      {/* Fase header row */}
                      <div style={{ height: rowH, background: 'rgba(59,130,246,0.03)', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                        {/* Grigl verticali */}
                        {getWeekHeaders().map((w, i) => (
                          <div key={i} style={{ position: 'absolute', left: daysBetween(range.min, w.date) * PX_PER_DAY, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.05)' }} />
                        ))}
                      </div>
                      {/* Task rows */}
                      {fase.espanso && fase.tasks.map(task => (
                        <div key={task.id} style={{ height: rowH, borderBottom: '1px solid var(--border)', position: 'relative', background: 'var(--panel)' }}>
                          {getWeekHeaders().map((w, i) => (
                            <div key={i} style={{ position: 'absolute', left: daysBetween(range.min, w.date) * PX_PER_DAY, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.04)' }} />
                          ))}
                          <GanttBar task={task} rangeMin={range.min} totalDays={totalDays} pxPerDay={PX_PER_DAY} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Vista Lista ─── */
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Codice', 'Attività', 'Tipo', 'Stato', 'Inizio', 'Fine', 'Avanz.', 'Critico', 'Risorse'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fasi.map(fase => (
                  <>
                    <tr key={fase.id} style={{ background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={9} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase' }}>
                        {fase.titolo}
                      </td>
                    </tr>
                    {fase.tasks.map(task => (
                      <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{task.codice}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--t1)' }}>{task.titolo}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 10, background: `${TIPO_COLORS[task.tipo]}20`, color: TIPO_COLORS[task.tipo], border: `1px solid ${TIPO_COLORS[task.tipo]}40`, borderRadius: 6, padding: '2px 7px' }}>{task.tipo}</span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 10, background: `${STATO_COLORS[task.stato]}20`, color: STATO_COLORS[task.stato], border: `1px solid ${STATO_COLORS[task.stato]}40`, borderRadius: 6, padding: '2px 7px' }}>{task.stato.replace('_',' ')}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{task.inizio}</td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{task.fine}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${task.avanzamento_pct}%`, height: '100%', background: STATO_COLORS[task.stato], borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--t3)' }}>{task.avanzamento_pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {task.critico && <Flag size={13} color="#ef4444" />}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--t3)' }}>
                          {task.risorse.map(r => r.nome).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>Percorso critico</span>
          </div>
          {(Object.keys(TIPO_COLORS) as TipoTask[]).map(tipo => (
            <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 6, borderRadius: 2, background: TIPO_COLORS[tipo] }} />
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>{tipo}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
