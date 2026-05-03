'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  User, Search, Plus, ChevronDown, ChevronUp, Save, Check,
  Building2, HardHat, Shield, Clipboard, FileText, Wrench,
  Phone, Mail, Hash, Award, X, AlertCircle, Loader2
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface Professionista {
  id: string
  nome: string
  cognome: string
  tipo: string               // 'professionista' | 'dipendente' | 'fornitore'
  specializzazione?: string  // 'ingegnere' | 'architetto' | 'geologo' | 'perito' | ecc
  ordine_professionale?: string
  numero_iscrizione?: string
  pec?: string
  telefono?: string
  studio?: string
  partita_iva?: string
  note?: string
}

interface FiguraProfessionale {
  ruolo: string
  label: string
  sigla: string
  gruppo: 'committenza' | 'impresa'
  obbligatorio: boolean
  descrizione: string
  icona: string
  professionista_id?: string
  professionista?: Professionista
}

interface CommessaAnagrafica {
  id: string
  codice: string
  nome: string
  committente: string
  cig: string
  cup: string
  importo_contrattuale: number
  ribasso_aggiudicazione: number
  oneri_sicurezza_speciali: number
  // CONFIG RIBASSO SICUREZZA
  sicurezza_interna_esclusa_ribasso: boolean
  // DATE
  data_contratto: string
  data_consegna: string
  data_fine_contratto: string
  durata_giorni: number
  // LUOGO
  indirizzo_cantiere: string
  comune: string
  provincia: string
  lat?: number
  lng?: number
  // FIGURE PROFESSIONALI
  figure: Record<string, { professionista_id: string; professionista?: Professionista }>
}

// ─── Definizione figure professionali ────────────────────────────────────────

const FIGURE_PROFESSIONALI: FiguraProfessionale[] = [
  // COMMITTENZA / SA
  {
    ruolo: 'rup', label: 'Responsabile Unico del Procedimento', sigla: 'RUP',
    gruppo: 'committenza', obbligatorio: true, icona: '⚖️',
    descrizione: 'D.Lgs. 36/2023 art. 15 — referente unico della SA'
  },
  {
    ruolo: 'dl', label: 'Direttore dei Lavori', sigla: 'DL',
    gruppo: 'committenza', obbligatorio: true, icona: '📐',
    descrizione: 'Sorveglianza tecnica, accettazione materiali, SAL'
  },
  {
    ruolo: 'direttore_operativo', label: 'Direttore Operativo', sigla: 'DO',
    gruppo: 'committenza', obbligatorio: false, icona: '🔭',
    descrizione: 'Assistente DL per specifici settori lavorativi'
  },
  {
    ruolo: 'ispettore_cantiere', label: 'Ispettore di Cantiere', sigla: 'IC',
    gruppo: 'committenza', obbligatorio: false, icona: '🔍',
    descrizione: 'Controllo quotidiano in cantiere per conto del DL'
  },
  {
    ruolo: 'csp', label: 'Coordinatore Sicurezza Progettazione', sigla: 'CSP',
    gruppo: 'committenza', obbligatorio: true, icona: '🦺',
    descrizione: 'D.Lgs. 81/2008 — redige PSC, fascicolo dell\'opera'
  },
  {
    ruolo: 'cse', label: 'Coordinatore Sicurezza Esecuzione', sigla: 'CSE',
    gruppo: 'committenza', obbligatorio: true, icona: '🚧',
    descrizione: 'Verifica applicazione PSC, sospende lavori se necessario'
  },
  {
    ruolo: 'collaudatore_co', label: 'Collaudatore in Corso d\'Opera', sigla: 'COLL-CO',
    gruppo: 'committenza', obbligatorio: false, icona: '📋',
    descrizione: 'Per lavori con SAL intermedi di importo rilevante'
  },
  {
    ruolo: 'collaudatore_finale', label: 'Collaudatore Finale / Statico', sigla: 'COLL-F',
    gruppo: 'committenza', obbligatorio: true, icona: '✅',
    descrizione: 'Verifica conformità opera ultimata al progetto'
  },
  {
    ruolo: 'progettista', label: 'Progettista', sigla: 'PROG',
    gruppo: 'committenza', obbligatorio: false, icona: '✏️',
    descrizione: 'Progettazione architettonica generale'
  },
  {
    ruolo: 'progettista_strutturale', label: 'Progettista Strutturale', sigla: 'PROG-S',
    gruppo: 'committenza', obbligatorio: false, icona: '🏗️',
    descrizione: 'Calcolo strutturale, certificazioni NTC 2018'
  },
  {
    ruolo: 'progettista_impiantistico', label: 'Progettista Impiantistico', sigla: 'PROG-I',
    gruppo: 'committenza', obbligatorio: false, icona: '⚡',
    descrizione: 'Impianti elettrici, termici, idraulici'
  },
  {
    ruolo: 'geologo', label: 'Geologo', sigla: 'GEO',
    gruppo: 'committenza', obbligatorio: false, icona: '🪨',
    descrizione: 'Relazione geologica e geotecnica'
  },
  // IMPRESA
  {
    ruolo: 'responsabile_commessa', label: 'Responsabile di Commessa', sigla: 'RC',
    gruppo: 'impresa', obbligatorio: true, icona: '👷',
    descrizione: 'Referente lato impresa, approva SAL passivi'
  },
  {
    ruolo: 'capocantiere', label: 'Capocantiere', sigla: 'CAP',
    gruppo: 'impresa', obbligatorio: true, icona: '🦺',
    descrizione: 'Gestione operativa quotidiana, rapportini'
  },
  {
    ruolo: 'rspp', label: 'RSPP', sigla: 'RSPP',
    gruppo: 'impresa', obbligatorio: true, icona: '🛡️',
    descrizione: 'Responsabile Servizio Prevenzione e Protezione'
  },
  {
    ruolo: 'assistente_cantiere', label: 'Assistente di Cantiere', sigla: 'ASS',
    gruppo: 'impresa', obbligatorio: false, icona: '📝',
    descrizione: 'Supporto tecnico-amministrativo in cantiere'
  },
  {
    ruolo: 'preposto', label: 'Preposto', sigla: 'PREP',
    gruppo: 'impresa', obbligatorio: false, icona: '👁️',
    descrizione: 'D.Lgs. 81/2008 — sorveglianza sicurezza operai'
  },
]

// ─── Componente ricerca professionista ───────────────────────────────────────

function RicercaProfessionista({
  figura,
  valore,
  onSeleziona,
  onAggiungiNuovo,
}: {
  figura: FiguraProfessionale
  valore?: Professionista
  onSeleziona: (p: Professionista) => void
  onAggiungiNuovo: (ruolo: string) => void
}) {
  const [query, setQuery] = useState('')
  const [risultati, setRisultati] = useState<Professionista[]>([])
  const [aperto, setAperto] = useState(false)
  const [caricamento, setCaricamento] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Ricerca live dal DB
  const cerca = useCallback(async (q: string) => {
    if (q.length < 2) { setRisultati([]); return }
    setCaricamento(true)
    try {
      const { data } = await supabase
        .from('professionisti_fornitori')
        .select('id, nome, cognome, tipo, specializzazione, ordine_professionale, numero_iscrizione, pec, telefono, studio')
        .or(`nome.ilike.%${q}%,cognome.ilike.%${q}%,studio.ilike.%${q}%`)
        .limit(8)
      setRisultati(data || [])
    } finally {
      setCaricamento(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => cerca(query), 250)
    return () => clearTimeout(t)
  }, [query, cerca])

  // Chiudi dropdown click fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setAperto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (p: Professionista) => {
    onSeleziona(p)
    setAperto(false)
    setQuery('')
  }

  const handleRimuovi = () => {
    onSeleziona({ id: '', nome: '', cognome: '', tipo: '' })
  }

  return (
    <div className="relative" ref={dropRef}>
      {valore?.id ? (
        // Professionista selezionato
        <div className="flex items-center gap-3 bg-slate-800 border border-slate-600 rounded-lg p-3">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-400">
            {valore.nome[0]}{valore.cognome?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              {valore.nome} {valore.cognome}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {valore.ordine_professionale
                ? `${valore.ordine_professionale} · ${valore.numero_iscrizione || '—'}`
                : valore.specializzazione || valore.tipo}
              {valore.pec && <span className="ml-2 text-blue-400/70">{valore.pec}</span>}
            </p>
          </div>
          <button
            onClick={handleRimuovi}
            className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        // Campo di ricerca
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            {caricamento
              ? <Loader2 size={14} className="text-blue-400 animate-spin" />
              : <Search size={14} className="text-slate-500" />
            }
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setAperto(true) }}
            onFocus={() => setAperto(true)}
            placeholder={`Cerca ${figura.label}...`}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          />

          {aperto && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
              {risultati.length > 0 ? (
                <>
                  {risultati.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700 transition-colors text-left border-b border-slate-700/50 last:border-0"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                        {p.nome[0]}{p.cognome?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">
                          {p.nome} {p.cognome}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {p.ordine_professionale
                            ? `${p.ordine_professionale} · ${p.numero_iscrizione || '—'}`
                            : p.specializzazione || p.tipo}
                          {p.pec && <span className="ml-2">· {p.pec}</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setAperto(false); onAggiungiNuovo(figura.ruolo) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
                  >
                    <Plus size={12} />
                    Aggiungi nuovo professionista al database
                  </button>
                </>
              ) : query.length >= 2 ? (
                <div className="px-3 py-3">
                  <p className="text-xs text-slate-500 mb-2">Nessun risultato per "{query}"</p>
                  <button
                    onClick={() => { setAperto(false); onAggiungiNuovo(figura.ruolo) }}
                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Plus size={12} />
                    Aggiungi "{query}" come nuovo professionista
                  </button>
                </div>
              ) : (
                <p className="px-3 py-3 text-xs text-slate-500">
                  Digita almeno 2 caratteri per cercare...
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal aggiungi professionista ───────────────────────────────────────────

function ModalNuovoProfessionista({
  aperto,
  onChiudi,
  onSalvato,
  queryIniziale = '',
}: {
  aperto: boolean
  onChiudi: () => void
  onSalvato: (p: Professionista) => void
  queryIniziale?: string
}) {
  const [form, setForm] = useState<Partial<Professionista>>({
    nome: queryIniziale.split(' ')[0] || '',
    cognome: queryIniziale.split(' ').slice(1).join(' ') || '',
    tipo: 'professionista',
  })
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    if (aperto && queryIniziale) {
      const parti = queryIniziale.trim().split(' ')
      setForm(prev => ({
        ...prev,
        nome: parti[0] || '',
        cognome: parti.slice(1).join(' ') || '',
      }))
    }
  }, [aperto, queryIniziale])

  const f = (k: keyof Professionista, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const salva = async () => {
    if (!form.nome?.trim()) { setErrore('Il nome è obbligatorio'); return }
    setSalvando(true); setErrore('')
    try {
      const { data, error } = await supabase
        .from('professionisti_fornitori')
        .insert([form])
        .select()
        .single()
      if (error) throw error
      onSalvato(data)
      onChiudi()
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Errore nel salvataggio')
    } finally {
      setSalvando(false)
    }
  }

  if (!aperto) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plus size={18} className="text-blue-400" />
            Nuovo professionista / collaboratore
          </h3>
          <button onClick={onChiudi} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div className="flex gap-2">
            {['professionista', 'dipendente', 'ente'].map(t => (
              <button
                key={t}
                onClick={() => f('tipo', t)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors border ${
                  form.tipo === t
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Nome / Cognome */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Nome *</label>
              <input
                value={form.nome || ''}
                onChange={e => f('nome', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Mario"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Cognome</label>
              <input
                value={form.cognome || ''}
                onChange={e => f('cognome', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Rossi"
              />
            </div>
          </div>

          {/* Ordine / Iscrizione */}
          {form.tipo === 'professionista' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Ordine professionale</label>
                <input
                  value={form.ordine_professionale || ''}
                  onChange={e => f('ordine_professionale', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="es. Ingegnere Civile - OAI NA"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">N. iscrizione</label>
                <input
                  value={form.numero_iscrizione || ''}
                  onChange={e => f('numero_iscrizione', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="NA-12345"
                />
              </div>
            </div>
          )}

          {/* Studio / Specializzazione */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              {form.tipo === 'professionista' ? 'Studio / Società' : 'Ruolo / Qualifica'}
            </label>
            <input
              value={form.studio || form.specializzazione || ''}
              onChange={e => f(form.tipo === 'professionista' ? 'studio' : 'specializzazione', e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder={form.tipo === 'professionista' ? 'Studio Rossi Associati' : 'Capocantiere'}
            />
          </div>

          {/* PEC / Tel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">PEC</label>
              <input
                value={form.pec || ''}
                onChange={e => f('pec', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="mario.rossi@pec.it"
                type="email"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Telefono</label>
              <input
                value={form.telefono || ''}
                onChange={e => f('telefono', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="335 123 4567"
              />
            </div>
          </div>

          {errore && (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="text-red-400" />
              <p className="text-xs text-red-400">{errore}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-700">
          <button
            onClick={onChiudi}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={salva}
            disabled={salvando}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {salvando ? 'Salvataggio...' : 'Salva e seleziona'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function AnagraficaCommessa({ params }: { params: { id: string } }) {
  const [commessa, setCommessa] = useState<Partial<CommessaAnagrafica>>({
    sicurezza_interna_esclusa_ribasso: true,
    figure: {},
  })
  const [salvando, setSalvando] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [gruppoAperto, setGruppoAperto] = useState<'committenza' | 'impresa' | null>('committenza')
  const [modalNuovoPro, setModalNuovoPro] = useState<{ aperto: boolean; ruolo: string; query: string }>({
    aperto: false, ruolo: '', query: ''
  })

  // Carica dati commessa
  useEffect(() => {
    if (!params.id) return
    supabase
      .from('commesse')
      .select('*, commessa_figure(*, professionista:professionisti_fornitori(*))')
      .eq('id', params.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        // Ricostruisce mappa figure
        const figure: CommessaAnagrafica['figure'] = {}
        for (const f of (data.commessa_figure || [])) {
          figure[f.ruolo] = {
            professionista_id: f.professionista_id,
            professionista: f.professionista,
          }
        }
        setCommessa({ ...data, figure })
      })
  }, [params.id])

  const salvaFigura = async (ruolo: string, professionista: Professionista) => {
    if (!professionista.id) {
      // rimuovi
      setCommessa(prev => {
        const f = { ...(prev.figure || {}) }
        delete f[ruolo]
        return { ...prev, figure: f }
      })
      return
    }
    setCommessa(prev => ({
      ...prev,
      figure: {
        ...(prev.figure || {}),
        [ruolo]: { professionista_id: professionista.id, professionista },
      }
    }))
  }

  const salvaCommessa = async () => {
    setSalvando(true)
    try {
      // 1. Aggiorna dati principali
      const { error: errC } = await supabase
        .from('commesse')
        .update({
          sicurezza_interna_esclusa_ribasso: commessa.sicurezza_interna_esclusa_ribasso,
          // altri campi editabili...
        })
        .eq('id', params.id)
      if (errC) throw errC

      // 2. Aggiorna figure: delete+insert
      await supabase.from('commessa_figure').delete().eq('commessa_id', params.id)
      const figureInsert = Object.entries(commessa.figure || {})
        .filter(([, v]) => v.professionista_id)
        .map(([ruolo, v]) => ({
          commessa_id: params.id,
          ruolo,
          professionista_id: v.professionista_id,
        }))
      if (figureInsert.length > 0) {
        await supabase.from('commessa_figure').insert(figureInsert)
      }

      setSalvato(true)
      setTimeout(() => setSalvato(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSalvando(false)
    }
  }

  const figureCommittenza = FIGURE_PROFESSIONALI.filter(f => f.gruppo === 'committenza')
  const figureImpresa = FIGURE_PROFESSIONALI.filter(f => f.gruppo === 'impresa')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-lg font-semibold text-white">Anagrafica Commessa</h1>
            <p className="text-sm text-slate-400">
              {commessa.codice} — {commessa.nome || '—'}
            </p>
          </div>
          <button
            onClick={salvaCommessa}
            disabled={salvando}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              salvato
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            } disabled:opacity-60`}
          >
            {salvato
              ? <><Check size={16} /> Salvato</>
              : salvando
              ? <><Loader2 size={16} className="animate-spin" /> Salvataggio...</>
              : <><Save size={16} /> Salva anagrafica</>
            }
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── CONFIGURAZIONE RIBASSO SICUREZZA ── */}
        <div className="bg-slate-900 border border-amber-700/30 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-amber-400 mb-1 flex items-center gap-2">
            <Shield size={15} />
            Configurazione ribasso sicurezza
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Imposta il trattamento della quota sicurezza interna alle voci (strato 3) per questa commessa
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Strato 1 */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-xs font-semibold text-green-400 mb-1">Strato 1 — Lavori</p>
              <p className="text-xs text-slate-400">Tariffe lavori → soggette a ribasso</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-600 flex items-center justify-center">
                  <Check size={10} />
                </div>
                <span className="text-xs text-slate-300">Ribasso applicato: sempre</span>
              </div>
            </div>

            {/* Strato 2 */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-xs font-semibold text-red-400 mb-1">Strato 2 — Sicurezza speciale</p>
              <p className="text-xs text-slate-400">Voci sicurezza dedicate → mai in ribasso</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-600 flex items-center justify-center">
                  <X size={10} />
                </div>
                <span className="text-xs text-slate-300">Ribasso: mai (fisso)</span>
              </div>
            </div>

            {/* Strato 3 — configurabile */}
            <div className={`rounded-xl p-4 border transition-colors ${
              commessa.sicurezza_interna_esclusa_ribasso
                ? 'bg-amber-950/30 border-amber-700/40'
                : 'bg-slate-800 border-slate-700'
            }`}>
              <p className="text-xs font-semibold text-amber-400 mb-1">
                Strato 3 — Sicurezza interna alle voci
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Quota IncSIC in ogni EPItem (da XPWE)
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  onClick={() => setCommessa(prev => ({
                    ...prev,
                    sicurezza_interna_esclusa_ribasso: !prev.sicurezza_interna_esclusa_ribasso
                  }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    commessa.sicurezza_interna_esclusa_ribasso ? 'bg-amber-500' : 'bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    commessa.sicurezza_interna_esclusa_ribasso ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
                <span className="text-xs text-slate-300">
                  {commessa.sicurezza_interna_esclusa_ribasso
                    ? 'Esclusa dal ribasso'
                    : 'Soggetta a ribasso'}
                </span>
              </label>
            </div>
          </div>

          {/* Formula risultante */}
          <div className="mt-4 bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs">
            <p className="text-slate-500 mb-2">Formula importo voce applicata:</p>
            <p className="text-slate-300 leading-relaxed">
              <span className="text-green-400">IMPORTO</span> = Q × PU × %Lavori × (1 − R)
              <span className="text-slate-500"> &nbsp;←&nbsp; parte lavori ribassata</span>
            </p>
            <p className="text-slate-300 leading-relaxed">
              {'          '}{commessa.sicurezza_interna_esclusa_ribasso
                ? <><span className="text-amber-400">+ Q × PU × %SicInterna</span>
                  <span className="text-slate-500"> ←  sicurezza interna NON ribassata</span></>
                : <><span className="text-slate-400">+ Q × PU × %SicInterna × (1 − R)</span>
                  <span className="text-slate-500"> ←  sicurezza interna ribassata</span></>
              }
            </p>
            <p className="text-slate-300 leading-relaxed">
              {'          '}<span className="text-red-400">+ OneriSicurezzaSpeciali</span>
              <span className="text-slate-500"> ←  mai ribassati</span>
            </p>
          </div>
        </div>

        {/* ── FIGURE PROFESSIONALI COMMITTENZA ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setGruppoAperto(g => g === 'committenza' ? null : 'committenza')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Building2 size={15} className="text-blue-400" />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-semibold text-white">Stazione Appaltante / Committente</h2>
                <p className="text-xs text-slate-500">
                  {Object.keys(commessa.figure || {}).filter(r =>
                    figureCommittenza.find(f => f.ruolo === r)
                  ).length} / {figureCommittenza.length} figure assegnate
                </p>
              </div>
            </div>
            {gruppoAperto === 'committenza' ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {gruppoAperto === 'committenza' && (
            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800">
              {figureCommittenza.map(figura => {
                const assegnata = commessa.figure?.[figura.ruolo]
                return (
                  <div key={figura.ruolo} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{figura.icona}</span>
                      <div>
                        <p className="text-xs font-medium text-slate-200 leading-tight">
                          {figura.label}
                          {figura.obbligatorio && (
                            <span className="ml-1.5 text-amber-400 text-[10px]">obbligatorio</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-600">{figura.descrizione}</p>
                      </div>
                    </div>
                    <RicercaProfessionista
                      figura={figura}
                      valore={assegnata?.professionista}
                      onSeleziona={p => salvaFigura(figura.ruolo, p)}
                      onAggiungiNuovo={ruolo => setModalNuovoPro({ aperto: true, ruolo, query: '' })}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── FIGURE PROFESSIONALI IMPRESA ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setGruppoAperto(g => g === 'impresa' ? null : 'impresa')}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                <HardHat size={15} className="text-orange-400" />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-semibold text-white">Impresa Esecutrice</h2>
                <p className="text-xs text-slate-500">
                  {Object.keys(commessa.figure || {}).filter(r =>
                    figureImpresa.find(f => f.ruolo === r)
                  ).length} / {figureImpresa.length} figure assegnate
                </p>
              </div>
            </div>
            {gruppoAperto === 'impresa' ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {gruppoAperto === 'impresa' && (
            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800">
              {figureImpresa.map(figura => {
                const assegnata = commessa.figure?.[figura.ruolo]
                return (
                  <div key={figura.ruolo} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{figura.icona}</span>
                      <div>
                        <p className="text-xs font-medium text-slate-200 leading-tight">
                          {figura.label}
                          {figura.obbligatorio && (
                            <span className="ml-1.5 text-amber-400 text-[10px]">obbligatorio</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-600">{figura.descrizione}</p>
                      </div>
                    </div>
                    <RicercaProfessionista
                      figura={figura}
                      valore={assegnata?.professionista}
                      onSeleziona={p => salvaFigura(figura.ruolo, p)}
                      onAggiungiNuovo={ruolo => setModalNuovoPro({ aperto: true, ruolo, query: '' })}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal nuovo professionista */}
      <ModalNuovoProfessionista
        aperto={modalNuovoPro.aperto}
        queryIniziale={modalNuovoPro.query}
        onChiudi={() => setModalNuovoPro({ aperto: false, ruolo: '', query: '' })}
        onSalvato={p => {
          salvaFigura(modalNuovoPro.ruolo, p)
          setModalNuovoPro({ aperto: false, ruolo: '', query: '' })
        }}
      />
    </div>
  )
}
