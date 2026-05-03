'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Search, Plus, ChevronDown, ChevronUp, Save, Check,
  Building2, HardHat, Shield, X, AlertCircle, Loader2,
  User, Phone, Mail, Hash, Award, FileText, MapPin,
  Calendar, Euro, Percent, Edit3, RefreshCw
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Professionista {
  id: string
  nome: string
  cognome: string
  tipo: string
  specializzazione?: string
  ordine_professionale?: string
  numero_iscrizione?: string
  pec?: string
  email?: string
  telefono?: string
  studio?: string
  partita_iva?: string
  azienda_id?: string
  note?: string
}

interface FiguraProfessionale {
  ruolo: string
  label: string
  sigla: string
  gruppo: 'committenza' | 'impresa' | 'sicurezza'
  obbligatorio: boolean
  descrizione: string
  icona: string
  normativa?: string
}

interface CommessaDati {
  id: string
  codice: string
  nome: string
  committente: string
  tipo_committente: string
  cig: string
  cup: string
  importo_contrattuale: number
  ribasso_pct: number
  oneri_sicurezza: number
  sicurezza_interna_esclusa_ribasso: boolean
  data_inizio: string
  data_fine_prev: string
  data_fine_eff: string
  stato: string
  indirizzo_cantiere: string
  azienda_id: string
}

// ─── TUTTE le figure professionali di un appalto ──────────────────────────────
// Fonte: D.Lgs. 36/2023 (Codice Appalti), D.Lgs. 81/2008 (Sicurezza), prassi settoriale

const FIGURE_PROFESSIONALI: FiguraProfessionale[] = [

  // ── STAZIONE APPALTANTE / COMMITTENTE ──────────────────────────────────────
  {
    ruolo: 'rup',
    label: 'Responsabile Unico del Progetto',
    sigla: 'RUP',
    gruppo: 'committenza',
    obbligatorio: true,
    icona: '⚖️',
    normativa: 'D.Lgs. 36/2023 art.15',
    descrizione: 'Referente unico della SA per il ciclo di vita del contratto'
  },
  {
    ruolo: 'dl',
    label: 'Direttore dei Lavori',
    sigla: 'DL',
    gruppo: 'committenza',
    obbligatorio: true,
    icona: '📐',
    normativa: 'D.Lgs. 36/2023 art.114',
    descrizione: 'Sorveglianza tecnica, accettazione materiali, emissione SAL'
  },
  {
    ruolo: 'direttore_operativo',
    label: 'Direttore Operativo',
    sigla: 'DO',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '🔭',
    normativa: 'D.Lgs. 36/2023 art.114',
    descrizione: 'Assistente DL per specifici settori lavorativi (strutture, impianti)'
  },
  {
    ruolo: 'ispettore_cantiere',
    label: 'Ispettore di Cantiere',
    sigla: 'IC',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '🔍',
    normativa: 'D.Lgs. 36/2023 art.114',
    descrizione: 'Controllo quotidiano in cantiere per conto del DL'
  },
  {
    ruolo: 'dec',
    label: "Direttore dell'Esecuzione del Contratto",
    sigla: 'DEC',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '📋',
    normativa: 'D.Lgs. 36/2023 art.116',
    descrizione: 'Per contratti misti o di servizi. Verifica l\'esecuzione contrattuale'
  },
  {
    ruolo: 'csp',
    label: 'Coordinatore Sicurezza Progettazione',
    sigla: 'CSP',
    gruppo: 'committenza',
    obbligatorio: true,
    icona: '🦺',
    normativa: 'D.Lgs. 81/2008 art.91',
    descrizione: 'Redige PSC e fascicolo dell\'opera. Designato dal committente'
  },
  {
    ruolo: 'cse',
    label: 'Coordinatore Sicurezza Esecuzione',
    sigla: 'CSE',
    gruppo: 'committenza',
    obbligatorio: true,
    icona: '🚧',
    normativa: 'D.Lgs. 81/2008 art.92',
    descrizione: 'Verifica applicazione PSC. Può sospendere i lavori. Aggiorna PSC'
  },
  {
    ruolo: 'collaudatore_co',
    label: "Collaudatore in Corso d'Opera",
    sigla: 'COLL-CO',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '📊',
    normativa: 'D.Lgs. 36/2023 art.116',
    descrizione: 'Per lavori complessi o importo rilevante. Verifica SAL intermedi'
  },
  {
    ruolo: 'collaudatore_statico',
    label: 'Collaudatore Statico',
    sigla: 'COLL-S',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '🏛️',
    normativa: 'D.P.R. 380/2001 art.67 - NTC 2018',
    descrizione: 'Collaudo statico obbligatorio per strutture in c.a., acciaio, muratura armata'
  },
  {
    ruolo: 'collaudatore_finale',
    label: 'Collaudatore Tecnico-Amministrativo',
    sigla: 'COLL-TA',
    gruppo: 'committenza',
    obbligatorio: true,
    icona: '✅',
    normativa: 'D.Lgs. 36/2023 art.116',
    descrizione: 'Certifica la regolare esecuzione al termine dei lavori'
  },
  {
    ruolo: 'progettista',
    label: 'Progettista Architettonico',
    sigla: 'PROG',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '✏️',
    descrizione: 'Progettazione architettonica. Iscrizione albo obbligatoria per LL.PP.'
  },
  {
    ruolo: 'progettista_strutturale',
    label: 'Progettista Strutturale',
    sigla: 'PROG-S',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '🏗️',
    normativa: 'NTC 2018 - D.M. 17/01/2018',
    descrizione: 'Calcolo strutturale. Firma e timbra elaborati strutturali. Deposito al Genio Civile'
  },
  {
    ruolo: 'progettista_impiantistico_el',
    label: 'Progettista Impianti Elettrici',
    sigla: 'PROG-IE',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '⚡',
    normativa: 'D.M. 37/2008',
    descrizione: 'Impianti elettrici, speciali, fotovoltaico, domotica'
  },
  {
    ruolo: 'progettista_impiantistico_mec',
    label: 'Progettista Impianti Meccanici',
    sigla: 'PROG-IM',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '🔧',
    normativa: 'D.M. 37/2008',
    descrizione: 'Impianti termici, idro-sanitari, HVAC, antincendio'
  },
  {
    ruolo: 'geologo',
    label: 'Geologo',
    sigla: 'GEO',
    gruppo: 'committenza',
    obbligatorio: false,
    icona: '🪨',
    normativa: 'NTC 2018 cap.3',
    descrizione: 'Relazione geologica e geotecnica. Caratterizzazione del sito'
  },

  // ── IMPRESA ESECUTRICE ──────────────────────────────────────────────────────
  {
    ruolo: 'responsabile_commessa',
    label: 'Responsabile di Commessa',
    sigla: 'RC',
    gruppo: 'impresa',
    obbligatorio: true,
    icona: '👷',
    descrizione: 'Referente lato impresa. Approva SAL passivi e ordini di acquisto'
  },
  {
    ruolo: 'direttore_tecnico',
    label: 'Direttore Tecnico',
    sigla: 'DT',
    gruppo: 'impresa',
    obbligatorio: false,
    icona: '🎓',
    normativa: 'D.Lgs. 36/2023 — SOA',
    descrizione: 'Responsabile tecnico iscritto all\'albo. Obbligatorio per gare SOA'
  },
  {
    ruolo: 'capocantiere',
    label: 'Capocantiere',
    sigla: 'CAP',
    gruppo: 'impresa',
    obbligatorio: true,
    icona: '🦺',
    descrizione: 'Gestione operativa quotidiana. Firma rapportini e ordini del giorno'
  },
  {
    ruolo: 'assistente_cantiere',
    label: 'Assistente di Cantiere',
    sigla: 'ASS',
    gruppo: 'impresa',
    obbligatorio: false,
    icona: '📝',
    descrizione: 'Supporto tecnico-amministrativo. Gestione misurazioni e contabilità'
  },
  {
    ruolo: 'responsabile_qualita',
    label: 'Responsabile Qualità',
    sigla: 'RQ',
    gruppo: 'impresa',
    obbligatorio: false,
    icona: '🎯',
    descrizione: 'Gestione sistema qualità ISO 9001. Non conformità e audit interni'
  },

  // ── SICUREZZA (D.Lgs. 81/2008) ─────────────────────────────────────────────
  {
    ruolo: 'rspp',
    label: 'RSPP',
    sigla: 'RSPP',
    gruppo: 'sicurezza',
    obbligatorio: true,
    icona: '🛡️',
    normativa: 'D.Lgs. 81/2008 art.17-31',
    descrizione: 'Responsabile Servizio Prevenzione e Protezione. Nomina obbligatoria'
  },
  {
    ruolo: 'preposto',
    label: 'Preposto',
    sigla: 'PREP',
    gruppo: 'sicurezza',
    obbligatorio: true,
    icona: '👁️',
    normativa: 'D.Lgs. 81/2008 art.19 - L. 215/2021',
    descrizione: 'Sorveglia l\'osservanza delle misure di sicurezza. Obbligatorio da L.215/2021'
  },
  {
    ruolo: 'medico_competente',
    label: 'Medico Competente',
    sigla: 'MC',
    gruppo: 'sicurezza',
    obbligatorio: false,
    icona: '🩺',
    normativa: 'D.Lgs. 81/2008 art.25',
    descrizione: 'Sorveglianza sanitaria lavoratori. Obbligatorio se ci sono rischi specifici'
  },
  {
    ruolo: 'rls',
    label: 'Rappresentante Lavoratori per la Sicurezza',
    sigla: 'RLS',
    gruppo: 'sicurezza',
    obbligatorio: false,
    icona: '🤝',
    normativa: 'D.Lgs. 81/2008 art.47',
    descrizione: 'Eletto dai lavoratori. Consulta DVR e partecipa alla valutazione rischi'
  },
  {
    ruolo: 'addetto_antincendio',
    label: 'Addetto Antincendio',
    sigla: 'AA',
    gruppo: 'sicurezza',
    obbligatorio: false,
    icona: '🧯',
    normativa: 'D.Lgs. 81/2008 - D.M. 10/03/1998',
    descrizione: 'Addetto alle misure antincendio. Corso specifico obbligatorio'
  },
  {
    ruolo: 'addetto_primo_soccorso',
    label: 'Addetto Primo Soccorso',
    sigla: 'APS',
    gruppo: 'sicurezza',
    obbligatorio: false,
    icona: '🏥',
    normativa: 'D.Lgs. 81/2008 art.45 - D.M. 388/2003',
    descrizione: 'Addetto al pronto soccorso. Corso specifico obbligatorio'
  },
]

// ─── Componente Card Figura ────────────────────────────────────────────────────

function RicercaProfessionista({
  figura,
  valore,
  aziendaId,
  onSeleziona,
  onAggiungiNuovo,
}: {
  figura: FiguraProfessionale
  valore?: Professionista
  aziendaId: string
  onSeleziona: (p: Professionista) => void
  onAggiungiNuovo: (ruolo: string, query: string) => void
}) {
  const [query, setQuery] = useState('')
  const [risultati, setRisultati] = useState<Professionista[]>([])
  const [aperto, setAperto] = useState(false)
  const [caricamento, setCaricamento] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const cerca = useCallback(async (q: string) => {
    if (q.length < 2) { setRisultati([]); return }
    setCaricamento(true)
    try {
      // Cerca in TUTTA la tabella (non filtra per azienda - i professionisti sono condivisi)
      const { data } = await supabase
        .from('professionisti_fornitori')
        .select('id, nome, cognome, tipo, specializzazione, ordine_professionale, numero_iscrizione, pec, email, telefono, studio')
        .or(`nome.ilike.%${q}%,cognome.ilike.%${q}%,studio.ilike.%${q}%,codice_fiscale.ilike.%${q}%`)
        .eq('attivo', true)
        .limit(10)
      setRisultati(data || [])
    } catch(e) {
      console.error('Errore ricerca:', e)
    } finally {
      setCaricamento(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => cerca(query), 300)
    return () => clearTimeout(t)
  }, [query, cerca])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setAperto(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const rimuovi = () => {
    onSeleziona({ id: '', nome: '', cognome: '', tipo: '' })
    setQuery('')
  }

  if (valore?.id) {
    return (
      <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-green-100 border border-green-200 flex items-center justify-center text-sm font-bold text-green-700 flex-shrink-0">
          {(valore.nome[0] || '?')}{(valore.cognome?.[0] || '')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {valore.nome} {valore.cognome}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {valore.ordine_professionale && (
              <span className="text-xs text-gray-500 truncate">{valore.ordine_professionale}</span>
            )}
            {valore.numero_iscrizione && (
              <span className="text-xs text-blue-600">#{valore.numero_iscrizione}</span>
            )}
            {valore.pec && (
              <span className="text-xs text-gray-400 truncate">{valore.pec}</span>
            )}
            {valore.telefono && (
              <span className="text-xs text-gray-400">{valore.telefono}</span>
            )}
          </div>
        </div>
        <button
          onClick={rimuovi}
          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 p-1"
          title="Rimuovi"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div ref={dropRef} className="relative">
      <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
        {caricamento
          ? <Loader2 size={14} className="text-blue-500 animate-spin" />
          : <Search size={14} className="text-gray-400" />
        }
      </div>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setAperto(true) }}
        onFocus={() => { setAperto(true); if (query.length >= 2) cerca(query) }}
        placeholder={`Cerca ${figura.sigla}...`}
        className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors"
      />

      {aperto && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          {risultati.length > 0 ? (
            <>
              {risultati.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onSeleziona(p); setAperto(false); setQuery('') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-green-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    {p.nome[0]}{p.cognome?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium">{p.nome} {p.cognome}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {p.ordine_professionale || p.specializzazione || p.tipo}
                      {p.pec && <span className="ml-2 text-blue-500">{p.pec}</span>}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setAperto(false); onAggiungiNuovo(figura.ruolo, query) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
              >
                <Plus size={12} /> Aggiungi nuovo al database
              </button>
            </>
          ) : query.length >= 2 ? (
            <div className="px-3 py-3">
              <p className="text-xs text-gray-400 mb-2">Nessun risultato per &ldquo;{query}&rdquo;</p>
              <button
                onClick={() => { setAperto(false); onAggiungiNuovo(figura.ruolo, query) }}
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={12} /> Aggiungi &ldquo;{query}&rdquo; al database
              </button>
            </div>
          ) : (
            <p className="px-3 py-2.5 text-xs text-gray-400">Digita almeno 2 caratteri...</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal Nuovo Professionista ────────────────────────────────────────────────

function ModalNuovoProfessionista({
  aperto,
  onChiudi,
  onSalvato,
  queryIniziale,
  aziendaId,
}: {
  aperto: boolean
  onChiudi: () => void
  onSalvato: (p: Professionista) => void
  queryIniziale: string
  aziendaId: string
}) {
  const [form, setForm] = useState<Partial<Professionista>>({ tipo: 'professionista' })
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    if (aperto) {
      const parti = queryIniziale.trim().split(' ')
      setForm({
        nome: parti[0] || '',
        cognome: parti.slice(1).join(' ') || '',
        tipo: 'professionista',
      })
      setErrore('')
    }
  }, [aperto, queryIniziale])

  const f = (k: keyof Professionista, v: string) => setForm(p => ({ ...p, [k]: v }))

  const salva = async () => {
    if (!form.nome?.trim()) { setErrore('Il nome è obbligatorio'); return }
    setSalvando(true); setErrore('')
    try {
      const { data, error } = await supabase
        .from('professionisti_fornitori')
        .insert([{
          ...form,
          azienda_id: aziendaId,
          attivo: true,
        }])
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="bg-blue-600 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus size={18} /> Nuovo Professionista
            </h3>
            <p className="text-xs text-blue-200 mt-0.5">Verrà aggiunto al database condiviso</p>
          </div>
          <button onClick={onChiudi} className="text-blue-200 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div className="flex gap-2">
            {['professionista', 'dipendente', 'ente_pubblico'].map(t => (
              <button
                key={t}
                onClick={() => f('tipo', t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors border ${
                  form.tipo === t
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Nome/Cognome */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Nome *</label>
              <input
                value={form.nome || ''}
                onChange={e => f('nome', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Mario"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Cognome</label>
              <input
                value={form.cognome || ''}
                onChange={e => f('cognome', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Rossi"
              />
            </div>
          </div>

          {/* Ordine/Iscrizione */}
          {form.tipo === 'professionista' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Ordine professionale</label>
                <input
                  value={form.ordine_professionale || ''}
                  onChange={e => f('ordine_professionale', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="Ingegnere Civile - OAI NA"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">N. Iscrizione</label>
                <input
                  value={form.numero_iscrizione || ''}
                  onChange={e => f('numero_iscrizione', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="NA-12345"
                />
              </div>
            </div>
          )}

          {/* Studio/Specializzazione */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              {form.tipo === 'professionista' ? 'Studio / Società' : 'Qualifica / Ruolo'}
            </label>
            <input
              value={form.studio || form.specializzazione || ''}
              onChange={e => f(form.tipo === 'professionista' ? 'studio' : 'specializzazione', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder={form.tipo === 'professionista' ? 'Studio Rossi & Associati' : 'Capocantiere'}
            />
          </div>

          {/* PEC/Tel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">PEC</label>
              <input
                value={form.pec || ''}
                onChange={e => f('pec', e.target.value)}
                type="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="nome@pec.it"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Telefono</label>
              <input
                value={form.telefono || ''}
                onChange={e => f('telefono', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="335 123 4567"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
            <input
              value={form.email || ''}
              onChange={e => f('email', e.target.value)}
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="nome@studio.it"
            />
          </div>

          {errore && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600">{errore}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onChiudi} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Annulla
          </button>
          <button
            onClick={salva}
            disabled={salvando}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {salvando ? 'Salvataggio...' : 'Salva e seleziona'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pagina principale ─────────────────────────────────────────────────────────

export default function AnagraficaCommessa({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(paramsPromise)

  type Figure = Record<string, { professionista_id: string; professionista?: Professionista }>

  const [commessa, setCommessa] = useState<Partial<CommessaDati>>({
    sicurezza_interna_esclusa_ribasso: true,
  })
  const [figure, setFigure] = useState<Figure>({})
  const [aziendaId, setAziendaId] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')

  const [gruppoAperto, setGruppoAperto] = useState<'committenza' | 'impresa' | 'sicurezza' | null>('committenza')
  const [editDati, setEditDati] = useState(false)

  const [modal, setModal] = useState({ aperto: false, ruolo: '', query: '' })

  // ─── Carica commessa e figure ──────────────────────────────────────────────
  useEffect(() => {
    if (!id) return

    const carica = async () => {
      setCaricamento(true)
      try {
        // 1. Dati commessa
        const { data: comm, error: errComm } = await supabase
          .from('commesse')
          .select('*')
          .eq('id', id)
          .single()

        if (errComm) throw errComm
        if (comm) {
          setCommessa(comm)
          setAziendaId(comm.azienda_id || '')
        }

        // 2. Figure assegnate con dati professionista
        const { data: figureDB } = await supabase
          .from('commessa_figure')
          .select(`
            ruolo,
            professionista_id,
            professionista:professionisti_fornitori (
              id, nome, cognome, tipo, specializzazione,
              ordine_professionale, numero_iscrizione, pec, email, telefono, studio
            )
          `)
          .eq('commessa_id', id)

        if (figureDB) {
          const map: Figure = {}
          for (const f of figureDB) {
            map[f.ruolo] = {
              professionista_id: f.professionista_id,
              professionista: Array.isArray(f.professionista) ? f.professionista[0] : f.professionista,
            }
          }
          setFigure(map)
        }
      } catch (e: unknown) {
        setErrore(e instanceof Error ? e.message : 'Errore caricamento')
      } finally {
        setCaricamento(false)
      }
    }

    carica()
  }, [id])

  // ─── Salva figura (ottimistico) ────────────────────────────────────────────
  const salvaFigura = (ruolo: string, p: Professionista) => {
    if (!p.id) {
      setFigure(prev => { const n = { ...prev }; delete n[ruolo]; return n })
      return
    }
    setFigure(prev => ({
      ...prev,
      [ruolo]: { professionista_id: p.id, professionista: p },
    }))
  }

  // ─── Salva tutto ───────────────────────────────────────────────────────────
  const salva = async () => {
    setSalvando(true); setErrore('')
    try {
      // Aggiorna dati commessa (solo campi editabili)
      const { error: e1 } = await supabase
        .from('commesse')
        .update({
          cig: commessa.cig,
          cup: commessa.cup,
          committente: commessa.committente,
          tipo_committente: commessa.tipo_committente,
          importo_contrattuale: commessa.importo_contrattuale,
          ribasso_pct: commessa.ribasso_pct,
          oneri_sicurezza: commessa.oneri_sicurezza,
          sicurezza_interna_esclusa_ribasso: commessa.sicurezza_interna_esclusa_ribasso,
          data_inizio: commessa.data_inizio,
          data_fine_prev: commessa.data_fine_prev,
          indirizzo_cantiere: commessa.indirizzo_cantiere,
        })
        .eq('id', id)
      if (e1) throw e1

      // Sostituisci figure (delete + insert)
      await supabase.from('commessa_figure').delete().eq('commessa_id', id)

      const ins = Object.entries(figure)
        .filter(([, v]) => v.professionista_id)
        .map(([ruolo, v]) => ({
          commessa_id: id,
          ruolo,
          professionista_id: v.professionista_id,
        }))

      if (ins.length > 0) {
        const { error: e2 } = await supabase.from('commessa_figure').insert(ins)
        if (e2) throw e2
      }

      setSalvato(true)
      setTimeout(() => setSalvato(false), 3000)
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Errore salvataggio')
    } finally {
      setSalvando(false)
    }
  }

  const fc = (k: keyof CommessaDati, v: string | number | boolean) =>
    setCommessa(p => ({ ...p, [k]: v }))

  const fig_comm = FIGURE_PROFESSIONALI.filter(f => f.gruppo === 'committenza')
  const fig_imp = FIGURE_PROFESSIONALI.filter(f => f.gruppo === 'impresa')
  const fig_sic = FIGURE_PROFESSIONALI.filter(f => f.gruppo === 'sicurezza')

  const totAssegnate = Object.keys(figure).length
  const totObbligatori = FIGURE_PROFESSIONALI.filter(f => f.obbligatorio).length
  const assObbligatori = FIGURE_PROFESSIONALI.filter(f => f.obbligatorio && figure[f.ruolo]?.professionista_id).length

  if (caricamento) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="text-gray-500">Caricamento anagrafica...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HEADER STICKY ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-base font-bold text-gray-900">Anagrafica Commessa</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {commessa.codice} — {commessa.nome}
              &nbsp;·&nbsp;
              <span className={assObbligatori === totObbligatori ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                {assObbligatori}/{totObbligatori} figure obbligatorie assegnate
              </span>
              &nbsp;·&nbsp; {totAssegnate} totali
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditDati(!editDati)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                editDati
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Edit3 size={13} />
              {editDati ? 'Annulla modifica' : 'Modifica dati'}
            </button>
            <button
              onClick={salva}
              disabled={salvando}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                salvato
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-60`}
            >
              {salvato
                ? <><Check size={15} /> Salvato</>
                : salvando
                ? <><Loader2 size={15} className="animate-spin" /> Salvataggio...</>
                : <><Save size={15} /> Salva anagrafica</>
              }
            </button>
          </div>
        </div>
        {errore && (
          <div className="max-w-5xl mx-auto mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="text-red-500" />
            <p className="text-xs text-red-600">{errore}</p>
            <button onClick={() => setErrore('')} className="ml-auto text-red-400 hover:text-red-600">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ── DATI GENERALI COMMESSA ── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <FileText size={15} className="text-gray-500" /> Dati Generali Commessa
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              commessa.stato === 'IN_ESECUZIONE' ? 'bg-green-100 text-green-700' :
              commessa.stato === 'AGGIUDICATA' ? 'bg-blue-100 text-blue-700' :
              commessa.stato === 'CHIUSA' ? 'bg-gray-100 text-gray-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {commessa.stato?.replace('_', ' ') || 'Bozza'}
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* CIG */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">CIG</label>
                {editDati ? (
                  <input value={commessa.cig || ''} onChange={e => fc('cig', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm font-mono text-gray-800">{commessa.cig || '—'}</p>
                )}
              </div>
              {/* CUP */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">CUP</label>
                {editDati ? (
                  <input value={commessa.cup || ''} onChange={e => fc('cup', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm font-mono text-gray-800">{commessa.cup || '—'}</p>
                )}
              </div>
              {/* Committente */}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Committente</label>
                {editDati ? (
                  <input value={commessa.committente || ''} onChange={e => fc('committente', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm text-gray-800">{commessa.committente || '—'}</p>
                )}
              </div>
              {/* Importo */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  <Euro size={11} className="inline mr-0.5" /> Importo contrattuale
                </label>
                {editDati ? (
                  <input type="number" value={commessa.importo_contrattuale || ''} onChange={e => fc('importo_contrattuale', parseFloat(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm font-semibold text-gray-800">
                    € {(commessa.importo_contrattuale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              {/* Ribasso */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  <Percent size={11} className="inline mr-0.5" /> Ribasso aggiudicazione
                </label>
                {editDati ? (
                  <input type="number" step="0.001" value={commessa.ribasso_pct || ''} onChange={e => fc('ribasso_pct', parseFloat(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm text-gray-800">{commessa.ribasso_pct?.toFixed(3) || '0.000'}%</p>
                )}
              </div>
              {/* Oneri sicurezza */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Oneri sicurezza (€)</label>
                {editDati ? (
                  <input type="number" value={commessa.oneri_sicurezza || ''} onChange={e => fc('oneri_sicurezza', parseFloat(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm text-gray-800">€ {(commessa.oneri_sicurezza || 0).toLocaleString('it-IT')}</p>
                )}
              </div>
              {/* Data inizio */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  <Calendar size={11} className="inline mr-0.5" /> Inizio lavori
                </label>
                {editDati ? (
                  <input type="date" value={commessa.data_inizio || ''} onChange={e => fc('data_inizio', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm text-gray-800">
                    {commessa.data_inizio ? new Date(commessa.data_inizio).toLocaleDateString('it-IT') : '—'}
                  </p>
                )}
              </div>
              {/* Data fine */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Fine prevista</label>
                {editDati ? (
                  <input type="date" value={commessa.data_fine_prev || ''} onChange={e => fc('data_fine_prev', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm text-gray-800">
                    {commessa.data_fine_prev ? new Date(commessa.data_fine_prev).toLocaleDateString('it-IT') : '—'}
                  </p>
                )}
              </div>
              {/* Indirizzo */}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  <MapPin size={11} className="inline mr-0.5" /> Indirizzo cantiere
                </label>
                {editDati ? (
                  <input value={commessa.indirizzo_cantiere || ''} onChange={e => fc('indirizzo_cantiere', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
                ) : (
                  <p className="text-sm text-gray-800">{commessa.indirizzo_cantiere || '—'}</p>
                )}
              </div>
            </div>

            {/* Ribasso sicurezza strato 3 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <Shield size={13} /> Sicurezza interna alle voci (Strato 3 — IncSIC da XPWE)
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Quota sicurezza dentro ogni EPItem di Primus. Configura se va in ribasso o no.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                  <button
                    onClick={() => fc('sicurezza_interna_esclusa_ribasso', !commessa.sicurezza_interna_esclusa_ribasso)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      commessa.sicurezza_interna_esclusa_ribasso ? 'bg-amber-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      commessa.sicurezza_interna_esclusa_ribasso ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className="text-xs font-medium text-gray-600 w-28">
                    {commessa.sicurezza_interna_esclusa_ribasso ? 'NON ribassata ✓' : 'Ribassata'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── GRUPPI FIGURE PROFESSIONALI ── */}
        {([
          {
            key: 'committenza' as const,
            label: 'Stazione Appaltante / Committente',
            desc: 'Figure designate dalla SA — RUP, DL, CSP/CSE, Collaudo, Progettisti',
            icona: <Building2 size={16} className="text-blue-600" />,
            bgHdr: 'bg-blue-50',
            borderHdr: 'border-blue-200',
            figure: fig_comm,
          },
          {
            key: 'impresa' as const,
            label: 'Impresa Esecutrice',
            desc: 'Figure interne all\'impresa — RC, DT, Capocantiere, Assistenti',
            icona: <HardHat size={16} className="text-orange-600" />,
            bgHdr: 'bg-orange-50',
            borderHdr: 'border-orange-200',
            figure: fig_imp,
          },
          {
            key: 'sicurezza' as const,
            label: 'Sicurezza — D.Lgs. 81/2008',
            desc: 'RSPP, Preposto, Medico Competente, RLS, Addetti emergenza',
            icona: <Shield size={16} className="text-red-600" />,
            bgHdr: 'bg-red-50',
            borderHdr: 'border-red-200',
            figure: fig_sic,
          },
        ]).map(gruppo => {
          const assGruppo = gruppo.figure.filter(f => figure[f.ruolo]?.professionista_id).length
          const obbGruppo = gruppo.figure.filter(f => f.obbligatorio).length
          const assObbGruppo = gruppo.figure.filter(f => f.obbligatorio && figure[f.ruolo]?.professionista_id).length

          return (
            <div key={gruppo.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setGruppoAperto(g => g === gruppo.key ? null : gruppo.key)}
                className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b ${
                  gruppoAperto === gruppo.key ? 'border-gray-200' : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${gruppo.bgHdr} border ${gruppo.borderHdr} flex items-center justify-center`}>
                    {gruppo.icona}
                  </div>
                  <div className="text-left">
                    <h2 className="text-sm font-bold text-gray-900">{gruppo.label}</h2>
                    <p className="text-xs text-gray-500">{gruppo.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${assObbGruppo === obbGruppo ? 'text-green-600' : 'text-amber-600'}`}>
                      {assObbGruppo}/{obbGruppo} obbligatorie
                    </p>
                    <p className="text-xs text-gray-400">{assGruppo}/{gruppo.figure.length} totali</p>
                  </div>
                  {gruppoAperto === gruppo.key
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />
                  }
                </div>
              </button>

              {gruppoAperto === gruppo.key && (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gruppo.figure.map(figura => {
                    const assegnata = figure[figura.ruolo]
                    return (
                      <div key={figura.ruolo} className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-lg flex-shrink-0 mt-0.5">{figura.icona}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-semibold text-gray-800 leading-tight">
                                {figura.label}
                              </p>
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {figura.sigla}
                              </span>
                              {figura.obbligatorio && (
                                <span className="text-[10px] text-amber-600 font-medium">• obbligatorio</span>
                              )}
                            </div>
                            {figura.normativa && (
                              <p className="text-[10px] text-blue-500 mt-0.5">{figura.normativa}</p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{figura.descrizione}</p>
                          </div>
                        </div>
                        <RicercaProfessionista
                          figura={figura}
                          valore={assegnata?.professionista}
                          aziendaId={aziendaId}
                          onSeleziona={p => salvaFigura(figura.ruolo, p)}
                          onAggiungiNuovo={(ruolo, query) => setModal({ aperto: true, ruolo, query })}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal nuovo professionista */}
      <ModalNuovoProfessionista
        aperto={modal.aperto}
        queryIniziale={modal.query}
        aziendaId={aziendaId}
        onChiudi={() => setModal({ aperto: false, ruolo: '', query: '' })}
        onSalvato={p => {
          salvaFigura(modal.ruolo, p)
          setModal({ aperto: false, ruolo: '', query: '' })
        }}
      />
    </div>
  )
}
