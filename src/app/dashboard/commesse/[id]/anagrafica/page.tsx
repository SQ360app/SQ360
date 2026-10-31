'use client'

import React, { useState, useEffect, useRef, useCallback, use } from 'react'
import {
  Search, Plus, Save, Check, ChevronDown, ChevronUp,
  X, AlertCircle, Loader2, Shield, Euro, Calendar,
  MapPin, FileText, Building2, HardHat, Edit3
} from 'lucide-react'
import { supabase, getAziendaId } from '@/lib/supabase'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { DEFAULT_WBS_FLAT, WbsNode, ricalcolaCodici, wbsFlatToNodes } from '@/lib/wbs'
import { loadWbsNodes, buildWbsInsertPayload } from '@/lib/wbsLoader'

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
  azienda_id?: string
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
  id: string; codice: string; nome: string
  committente: string; committente_piva: string; tipo_committente: string
  cig: string; cup: string; tipo_commessa: string
  importo_contrattuale: number; ribasso_pct: number; oneri_sicurezza: number
  sicurezza_interna_esclusa_ribasso: boolean
  sam_obbligatoria: boolean
  data_inizio: string; data_fine_prev: string; data_proroga: string
  stato: string
  indirizzo_cantiere: string; cap_cantiere: string; comune_cantiere: string; provincia: string
  note: string; lat?: number; lng?: number; azienda_id: string
}

// ─── Tutte le figure professionali ────────────────────────────────────────────

const FIGURE: FiguraProfessionale[] = [
  // COMMITTENZA
  { ruolo:'rup',                      label:'Responsabile Unico del Progetto',        sigla:'RUP',     gruppo:'committenza', obbligatorio:true,  icona:'⚖️',  normativa:'D.Lgs. 36/2023 art.15',  descrizione:'Referente unico SA per il ciclo di vita del contratto' },
  { ruolo:'dl',                       label:'Direttore dei Lavori',                    sigla:'DL',      gruppo:'committenza', obbligatorio:true,  icona:'📐',  normativa:'D.Lgs. 36/2023 art.114', descrizione:'Sorveglianza tecnica, accettazione materiali, emissione SAL' },
  { ruolo:'direttore_operativo',      label:'Direttore Operativo',                     sigla:'DO',      gruppo:'committenza', obbligatorio:false, icona:'🔭',  normativa:'D.Lgs. 36/2023 art.114', descrizione:'Assistente DL per specifici settori lavorativi' },
  { ruolo:'ispettore_cantiere',       label:'Ispettore di Cantiere',                   sigla:'IC',      gruppo:'committenza', obbligatorio:false, icona:'🔍',  normativa:'D.Lgs. 36/2023 art.114', descrizione:'Controllo quotidiano in cantiere per conto del DL' },
  { ruolo:'dec',                      label:"Direttore dell'Esecuzione del Contratto", sigla:'DEC',     gruppo:'committenza', obbligatorio:false, icona:'📋',  normativa:'D.Lgs. 36/2023 art.116', descrizione:"Per contratti misti o di servizi. Verifica l'esecuzione" },
  { ruolo:'csp',                      label:'Coordinatore Sicurezza Progettazione',    sigla:'CSP',     gruppo:'committenza', obbligatorio:true,  icona:'🦺',  normativa:'D.Lgs. 81/2008 art.91',  descrizione:"Redige PSC e fascicolo dell'opera. Designato dal committente" },
  { ruolo:'cse',                      label:'Coordinatore Sicurezza Esecuzione',       sigla:'CSE',     gruppo:'committenza', obbligatorio:true,  icona:'🚧',  normativa:'D.Lgs. 81/2008 art.92',  descrizione:'Verifica applicazione PSC. Può sospendere i lavori' },
  { ruolo:'collaudatore_co',          label:"Collaudatore in Corso d'Opera",           sigla:'COLL-CO', gruppo:'committenza', obbligatorio:false, icona:'📊',  normativa:'D.Lgs. 36/2023 art.116', descrizione:'Per lavori complessi. Verifica SAL intermedi' },
  { ruolo:'collaudatore_statico',     label:'Collaudatore Statico',                    sigla:'COLL-S',  gruppo:'committenza', obbligatorio:false, icona:'🏛️', normativa:'D.P.R. 380/2001 - NTC 2018', descrizione:'Obbligatorio per strutture in c.a., acciaio, muratura armata' },
  { ruolo:'collaudatore_finale',      label:'Collaudatore Tecnico-Amministrativo',     sigla:'COLL-TA', gruppo:'committenza', obbligatorio:true,  icona:'✅',  normativa:'D.Lgs. 36/2023 art.116', descrizione:'Certifica la regolare esecuzione al termine dei lavori' },
  { ruolo:'progettista',              label:'Progettista Architettonico',              sigla:'PROG',    gruppo:'committenza', obbligatorio:false, icona:'✏️',  descrizione:'Progettazione architettonica. Iscrizione albo obbligatoria' },
  { ruolo:'progettista_strutturale',  label:'Progettista Strutturale',                 sigla:'PROG-S',  gruppo:'committenza', obbligatorio:false, icona:'🏗️', normativa:'NTC 2018 - D.M. 17/01/2018', descrizione:'Calcolo strutturale. Deposito al Genio Civile' },
  { ruolo:'progettista_imp_el',       label:'Progettista Impianti Elettrici',          sigla:'PROG-IE', gruppo:'committenza', obbligatorio:false, icona:'⚡',  normativa:'D.M. 37/2008', descrizione:'Impianti elettrici, speciali, fotovoltaico' },
  { ruolo:'progettista_imp_mec',      label:'Progettista Impianti Meccanici',          sigla:'PROG-IM', gruppo:'committenza', obbligatorio:false, icona:'🔧',  normativa:'D.M. 37/2008', descrizione:'Impianti termici, idro-sanitari, HVAC, antincendio' },
  { ruolo:'geologo',                  label:'Geologo',                                 sigla:'GEO',     gruppo:'committenza', obbligatorio:false, icona:'🪨',  normativa:'NTC 2018 cap.3', descrizione:'Relazione geologica e geotecnica. Caratterizzazione sito' },
  // IMPRESA
  { ruolo:'responsabile_commessa',    label:'Responsabile di Commessa',               sigla:'RC',      gruppo:'impresa',     obbligatorio:true,  icona:'👷',  descrizione:'Referente lato impresa. Approva SAL passivi e ordini' },
  { ruolo:'direttore_tecnico',        label:'Direttore Tecnico',                       sigla:'DT',      gruppo:'impresa',     obbligatorio:false, icona:'🎓',  normativa:'D.Lgs. 36/2023 — SOA', descrizione:"Responsabile tecnico iscritto all'albo. Obbligatorio per gare SOA" },
  { ruolo:'capocantiere',             label:'Capocantiere',                            sigla:'CAP',     gruppo:'impresa',     obbligatorio:true,  icona:'🦺',  descrizione:'Gestione operativa quotidiana. Firma rapportini' },
  { ruolo:'assistente_cantiere',      label:'Assistente di Cantiere',                  sigla:'ASS',     gruppo:'impresa',     obbligatorio:false, icona:'📝',  descrizione:'Supporto tecnico-amministrativo. Gestione misurazioni' },
  { ruolo:'responsabile_qualita',     label:'Responsabile Qualità',                   sigla:'RQ',      gruppo:'impresa',     obbligatorio:false, icona:'🎯',  descrizione:'Gestione sistema qualità ISO 9001. Non conformità' },
  // SICUREZZA
  { ruolo:'rspp',                     label:'RSPP',                                    sigla:'RSPP',    gruppo:'sicurezza',   obbligatorio:true,  icona:'🛡️', normativa:'D.Lgs. 81/2008 art.17-31', descrizione:'Responsabile Servizio Prevenzione e Protezione' },
  { ruolo:'preposto',                 label:'Preposto',                                sigla:'PREP',    gruppo:'sicurezza',   obbligatorio:true,  icona:'👁️', normativa:'D.Lgs. 81/2008 - L.215/2021', descrizione:"Sorveglia l'osservanza delle misure di sicurezza" },
  { ruolo:'medico_competente',        label:'Medico Competente',                       sigla:'MC',      gruppo:'sicurezza',   obbligatorio:false, icona:'🩺',  normativa:'D.Lgs. 81/2008 art.25', descrizione:'Sorveglianza sanitaria. Obbligatorio se ci sono rischi specifici' },
  { ruolo:'rls',                      label:'Rappresentante Lavoratori Sicurezza',     sigla:'RLS',     gruppo:'sicurezza',   obbligatorio:false, icona:'🤝',  normativa:'D.Lgs. 81/2008 art.47', descrizione:'Eletto dai lavoratori. Partecipa alla valutazione rischi' },
  { ruolo:'addetto_antincendio',      label:'Addetto Antincendio',                     sigla:'AA',      gruppo:'sicurezza',   obbligatorio:false, icona:'🧯',  normativa:'D.M. 10/03/1998', descrizione:'Addetto alle misure antincendio. Corso specifico obbligatorio' },
  { ruolo:'addetto_primo_soccorso',   label:'Addetto Primo Soccorso',                  sigla:'APS',     gruppo:'sicurezza',   obbligatorio:false, icona:'🏥',  normativa:'D.M. 388/2003', descrizione:'Addetto al pronto soccorso. Corso specifico obbligatorio' },
]

// ─── Stili inline basati su design system globals.css ─────────────────────────

const S = {
  page: { height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: 0 } as React.CSSProperties,
  stickyHeader: { position: 'sticky' as const, top: 0, zIndex: 30, background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '14px 24px', boxShadow: 'var(--shadow-sm)' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headerTitle: { fontSize: 15, fontWeight: 700, color: 'var(--t1)' },
  headerSub: { fontSize: 12, color: 'var(--t3)', marginTop: 2 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  content: { padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  card: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', borderRadius: '12px 12px 0 0' },
  cardHeaderTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--t1)' },
  cardBody: { padding: '16px' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 6, display: 'block' },
  value: { fontSize: 13, color: 'var(--t1)', fontWeight: 500 },
  valueMono: { fontSize: 13, color: 'var(--t1)', fontFamily: 'var(--font-mono)', fontWeight: 600 },
  badge: (color: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color === 'green' ? 'rgba(16,185,129,0.1)' : color === 'blue' ? 'rgba(59,130,246,0.1)' : color === 'amber' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)', color: color === 'green' ? '#065f46' : color === 'blue' ? '#1e40af' : color === 'amber' ? '#92400e' : 'var(--t2)' }),
  // Gruppi figure
  groupBtn: (open: boolean) => ({ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }),
  gruppoGrid: { padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
  // Figura card
  figuraWrap: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  figuraInfo: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  figuraIcon: { fontSize: 18, flexShrink: 0, marginTop: 1 },
  figuraLabel: { fontSize: 12, fontWeight: 600, color: 'var(--t1)' },
  figuraNorm: { fontSize: 10, color: 'var(--accent)', marginTop: 1 },
  figuraDesc: { fontSize: 10, color: 'var(--t4)', marginTop: 1, lineHeight: 1.4 },
  // Search dropdown
  searchWrap: { position: 'relative' as const },
  searchInput: { width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px 8px 32px', color: 'var(--t1)', fontSize: 12, transition: 'border-color 0.15s' },
  searchIcon: { position: 'absolute' as const, left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', pointerEvents: 'none' as const },
  dropdown: { position: 'absolute' as const, top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden' },
  dropItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' },
  dropAvatar: { width: 30, height: 30, borderRadius: 15, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 },
  dropName: { fontSize: 13, fontWeight: 500, color: 'var(--t1)' },
  dropSub: { fontSize: 11, color: 'var(--t3)', marginTop: 1 },
  dropAdd: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', borderTop: '1px solid var(--border)', fontWeight: 500 },
  dropEmpty: { padding: '12px 14px', fontSize: 12, color: 'var(--t3)' },
  // Scelto
  selectedCard: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' },
  selectedAvatar: { width: 32, height: 32, borderRadius: 16, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#065f46', flexShrink: 0 },
  selectedName: { fontSize: 13, fontWeight: 600, color: 'var(--t1)' },
  selectedSub: { fontSize: 11, color: 'var(--t3)', marginTop: 1 },
  removeBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
}

// ─── Componente ricerca professionista ────────────────────────────────────────

function RicercaProfessionista({ figura, valore, onSeleziona, onNuovo }: {
  figura: FiguraProfessionale
  valore?: Professionista
  onSeleziona: (p: Professionista) => void
  onNuovo: (ruolo: string, q: string) => void
}) {
  const [query, setQuery] = useState('')
  const [risultati, setRisultati] = useState<Professionista[]>([])
  const [aperto, setAperto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const cerca = useCallback(async (q: string) => {
    if (q.length < 2) { setRisultati([]); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('professionisti_fornitori')
        .select('id,nome,cognome,tipo,specializzazione,ordine_professionale,numero_iscrizione,pec,email,telefono,studio')
        .or(`nome.ilike.%${q}%,cognome.ilike.%${q}%,studio.ilike.%${q}%`)
        .eq('attivo', true)
        .limit(8)
      setRisultati(data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { const t = setTimeout(() => cerca(query), 280); return () => clearTimeout(t) }, [query, cerca])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setAperto(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  if (valore?.id) {
    return (
      <div style={S.selectedCard}>
        <div style={S.selectedAvatar}>{valore.nome[0]}{valore.cognome?.[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <button onClick={() => setShowProfile(true)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left' as const, width:'100%' }}>
              <p style={{...S.selectedName, textDecoration:'underline', textDecorationColor:'var(--accent)'}} className="truncate">{valore.nome} {valore.cognome}</p>
            </button>
          <p style={S.selectedSub} className="truncate">
            {valore.ordine_professionale || valore.specializzazione || valore.tipo}
            {valore.pec && <span style={{ marginLeft: 6, color: 'var(--accent)' }}>{valore.pec}</span>}
            {valore.telefono && <span style={{ marginLeft: 6 }}>· {valore.telefono}</span>}
          </p>
        </div>
        <button style={S.removeBtn} onClick={() => {
          if (window.confirm('Rimuovere questa figura professionale?') && window.confirm('Conferma definitiva: rimuovere la figura?')) {
            onSeleziona({ id:'',nome:'',cognome:'',tipo:'' })
          }
        }} title="Rimuovi">
          <X size={14} />
        </button>
            {showProfile && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
                onClick={() => setShowProfile(false)}>
                <div style={{ background:'var(--panel)', borderRadius:16, padding:24, width:420, maxWidth:'92vw', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                    <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Anagrafica professionista</h3>
                    <button onClick={() => setShowProfile(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--t3)' }}>✕</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:8, fontSize:13 }}>
                    <div style={{ fontSize:16, fontWeight:700 }}>{valore.nome} {valore.cognome}</div>
                    {valore.ordine_professionale && <div><b>Ordine:</b> {valore.ordine_professionale}{valore.numero_iscrizione ? ' n. '+valore.numero_iscrizione : ''}</div>}
                    {(valore.studio || valore.specializzazione) && <div><b>Studio:</b> {valore.studio || valore.specializzazione}</div>}
                    {valore.pec && <div><b>PEC:</b> <a href={'mailto:'+valore.pec} style={{ color:'var(--accent)' }}>{valore.pec}</a></div>}
                    {valore.email && <div><b>Email:</b> <a href={'mailto:'+valore.email} style={{ color:'var(--accent)' }}>{valore.email}</a></div>}
                    {valore.telefono && <div><b>Tel:</b> {valore.telefono}</div>}
                  </div>
                </div>
              </div>
            )}
      </div>
    )
  }

  return (
    <div ref={dropRef} style={S.searchWrap}>
      <div style={S.searchIcon}>
        {loading ? <Loader2 size={13} style={{ animation: 'spin 0.6s linear infinite' }} /> : <Search size={13} />}
      </div>
      <input
        style={S.searchInput}
        type="text" value={query}
        onChange={e => { setQuery(e.target.value); setAperto(true) }}
        onFocus={() => { setAperto(true); if (query.length >= 2) cerca(query) }}
        placeholder={`Cerca ${figura.sigla}...`}
      />
      {aperto && (
        <div style={S.dropdown}>
          {risultati.length > 0 ? (
            <>
              {risultati.map(p => (
                <div key={p.id}
                  style={{ ...S.dropItem, background: hover === p.id ? 'var(--panel-hover)' : 'transparent' }}
                  onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
                  onClick={() => { onSeleziona(p); setAperto(false); setQuery('') }}
                >
                  <div style={S.dropAvatar}>{p.nome[0]}{p.cognome?.[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={S.dropName}>{p.nome} {p.cognome}</p>
                    <p style={S.dropSub} className="truncate">{p.ordine_professionale || p.tipo}</p>
                  </div>
                </div>
              ))}
              <div style={S.dropAdd} onClick={() => { setAperto(false); onNuovo(figura.ruolo, query) }}>
                <Plus size={13} /> Aggiungi nuovo al database
              </div>
            </>
          ) : query.length >= 2 ? (
            <div style={S.dropEmpty}>
              <p>Nessun risultato per &ldquo;{query}&rdquo;</p>
              <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px', marginTop: 8 }}
                onClick={() => { setAperto(false); onNuovo(figura.ruolo, query) }}>
                <Plus size={12} /> Aggiungi &ldquo;{query}&rdquo;
              </button>
            </div>
          ) : (
            <p style={S.dropEmpty}>Digita almeno 2 caratteri...</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal nuovo professionista ────────────────────────────────────────────────

function ModalNuovo({ aperto, onChiudi, onSalvato, queryIniziale, aziendaId }: {
  aperto: boolean; onChiudi: () => void; onSalvato: (p: Professionista) => void
  queryIniziale: string; aziendaId: string
}) {
  const [form, setForm] = useState<Partial<Professionista>>({ tipo: 'professionista' })
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')
  const f = (k: keyof Professionista, v: string) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (aperto) {
      const p = queryIniziale.trim().split(' ')
      setForm({ nome: p[0] || '', cognome: p.slice(1).join(' ') || '', tipo: 'professionista' })
      setErrore('')
    }
  }, [aperto, queryIniziale])

  const salva = async () => {
    if (!form.nome?.trim()) { setErrore('Il nome è obbligatorio'); return }
    setSalvando(true); setErrore('')
    try {
      const { data, error } = await supabase.from('professionisti_fornitori')
        .insert([{ ...form, azienda_id: aziendaId, attivo: true }])
        .select().single()
      if (error) throw error
      onSalvato(data); onChiudi()
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Errore nel salvataggio')
    } finally { setSalvando(false) }
  }

  if (!aperto) return null

  const inpS = { ...S.searchInput, paddingLeft: 12, marginBottom: 0 }

  return (
    <div className="modal-overlay fade-in">
      <div className="modal-box" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'var(--accent)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Nuovo Professionista</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>Aggiunto al database condiviso</p>
          </div>
          <button onClick={onChiudi} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Tipo */}
          <div style={{ display: 'flex', gap: 8 }}>
            {['professionista', 'dipendente', 'ente_pubblico'].map(t => (
              <button key={t} onClick={() => f('tipo', t)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: form.tipo === t ? 'none' : '1px solid var(--border)',
                background: form.tipo === t ? 'var(--accent)' : 'var(--panel)',
                color: form.tipo === t ? '#fff' : 'var(--t2)',
              }}>
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Nome *</label>
              <input style={inpS} value={form.nome || ''} onChange={e => f('nome', e.target.value)} placeholder="Mario" />
            </div>
            <div>
              <label style={S.label}>Cognome</label>
              <input style={inpS} value={form.cognome || ''} onChange={e => f('cognome', e.target.value)} placeholder="Rossi" />
            </div>
          </div>
          {form.tipo === 'professionista' && (
            <div style={S.grid2}>
              <div>
                <label style={S.label}>Ordine professionale</label>
                <input style={inpS} value={form.ordine_professionale || ''} onChange={e => f('ordine_professionale', e.target.value)} placeholder="Ingegnere Civile - OAI NA" />
              </div>
              <div>
                <label style={S.label}>N. Iscrizione</label>
                <input style={inpS} value={form.numero_iscrizione || ''} onChange={e => f('numero_iscrizione', e.target.value)} placeholder="NA-12345" />
              </div>
            </div>
          )}
          <div>
            <label style={S.label}>{form.tipo === 'professionista' ? 'Studio / Società' : 'Qualifica'}</label>
            <input style={inpS} value={form.studio || form.specializzazione || ''}
              onChange={e => f(form.tipo === 'professionista' ? 'studio' : 'specializzazione', e.target.value)}
              placeholder={form.tipo === 'professionista' ? 'Studio Rossi & Associati' : 'Capocantiere'} />
          </div>
          <div style={S.grid2}>
            <div>
              <label style={S.label}>PEC</label>
              <input style={inpS} type="email" value={form.pec || ''} onChange={e => f('pec', e.target.value)} placeholder="nome@pec.it" />
            </div>
            <div>
              <label style={S.label}>Telefono</label>
              <input style={inpS} value={form.telefono || ''} onChange={e => f('telefono', e.target.value)} placeholder="335 123 4567" />
            </div>
          </div>
          {errore && (
            <div className="alert alert-danger" style={{ fontSize: 12 }}>
              <AlertCircle size={14} /> {errore}
            </div>
          )}
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={onChiudi}>Annulla</button>
          <button className="btn-primary" style={{ fontSize: 12, padding: '7px 16px' }} onClick={salva} disabled={salvando}>
            {salvando ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Save size={13} />}
            {salvando ? 'Salvataggio...' : 'Salva e seleziona'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pagina principale ─────────────────────────────────────────────────────────

export default function AnagraficaCommessa({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise)

  type Figure = Record<string, { professionista_id: string; professionista?: Professionista }>

  const [commessa, setCommessa] = useState<Partial<CommessaDati>>({ sicurezza_interna_esclusa_ribasso: true, sam_obbligatoria: false })
  const [figure, setFigure] = useState<Figure>({})
  const [aziendaId, setAziendaId] = useState('')
  const [wbsNodes, setWbsNodes] = useState<WbsNode[]>(() => wbsFlatToNodes(DEFAULT_WBS_FLAT))
  const [wbsOpen, setWbsOpen] = useState(false)
  const [wbsSaving, setWbsSaving] = useState(false)
  const [wbsEdited, setWbsEdited] = useState(false)
  const [caricamento, setCaricamento] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')
  const [editDati, setEditDati] = useState(false)
  const [gruppoAperto, setGruppoAperto] = useState<'committenza'|'impresa'|'sicurezza'|null>('committenza')
  const [modal, setModal] = useState({ aperto: false, ruolo: '', query: '' })
  const [aziendaDoc, setAziendaDoc] = useState<any>(null)

  useEffect(() => {
    getAziendaId().then(async azId => {
      if (!azId) return
      const { data } = await supabase.from('azienda').select('logo_url,carta_intestata_header_url,carta_intestata_footer_url').eq('id', azId).single()
      setAziendaDoc(data || null)
    })
  }, [])

  const generaVerbale = async () => {
    try {
      const fig: Record<string, string> = {}
      for (const [ruolo, v] of Object.entries(figure)) {
        const p = v.professionista
        if (p?.nome) fig[ruolo] = `${p.nome} ${p.cognome || ''}`.trim()
      }
      const [pdfrMod, docMod] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/VerbaleConsegnaDocument'),
      ])
      const element = React.createElement(docMod.VerbaleConsegnaDocument, {
        commessa: {
          codice: commessa.codice || '',
          nome: commessa.nome || '',
          committente: commessa.committente,
          cig: commessa.cig,
          cup: commessa.cup,
          data_inizio: commessa.data_inizio,
          indirizzo_cantiere: commessa.indirizzo_cantiere,
          comune_cantiere: commessa.comune_cantiere,
          provincia: commessa.provincia,
        },
        figure: fig,
        aziendaDoc,
      })
      const blob = await pdfrMod.pdf(element as any).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `VerbaleConsegna-${commessa.codice || 'commessa'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Errore generazione PDF: ' + e.message)
    }
  }

  useEffect(() => {
    if (!id) return
    const carica = async () => {
      setCaricamento(true)
      try {
        const { data: comm, error: e1 } = await supabase.from('commesse').select('*').eq('id', id).single()
        if (e1) throw e1
        if (comm) {
          setCommessa(comm)
          const azId = comm.azienda_id || ''
          setAziendaId(azId)
          if (azId) {
            loadWbsNodes(supabase, 'wbs_nodes', { commessa_id: id, azienda_id: azId }).then(({ nodes, error }) => {
              if (error) console.error('Lettura WBS commessa:', error)
              if (nodes.length > 0) setWbsNodes(nodes)
              else setWbsNodes(wbsFlatToNodes(DEFAULT_WBS_FLAT, () => crypto.randomUUID()))
            })
          }
        }

        const { data: figDB } = await supabase
          .from('commessa_figure')
          .select('ruolo, professionista_id, professionista:professionisti_fornitori(id,nome,cognome,tipo,specializzazione,ordine_professionale,numero_iscrizione,pec,email,telefono,studio)')
          .eq('commessa_id', id)

        if (figDB) {
          const map: Figure = {}
          for (const f of figDB) {
            map[f.ruolo] = {
              professionista_id: f.professionista_id,
              professionista: Array.isArray(f.professionista) ? f.professionista[0] : f.professionista as Professionista,
            }
          }
          setFigure(map)
        }
      } catch (e: unknown) {
        setErrore(e instanceof Error ? e.message : 'Errore caricamento')
      } finally { setCaricamento(false) }
    }
    carica()
  }, [id])

  const salvaFigura = (ruolo: string, p: Professionista) => {
    if (!p.id) { setFigure(prev => { const n = { ...prev }; delete n[ruolo]; return n }); return }
    setFigure(prev => ({ ...prev, [ruolo]: { professionista_id: p.id, professionista: p } }))
  }

  const salva = async () => {
    setSalvando(true); setErrore('')
    try {
      const { error: e1 } = await supabase.from('commesse').update({
        cig: commessa.cig, cup: commessa.cup,
        committente: commessa.committente,
        committente_piva: commessa.committente_piva || null,
        tipo_committente: commessa.tipo_committente,
        tipo_commessa: commessa.tipo_commessa || null,
        importo_contrattuale: commessa.importo_contrattuale,
        ribasso_pct: commessa.ribasso_pct, oneri_sicurezza: commessa.oneri_sicurezza,
        sicurezza_interna_esclusa_ribasso: commessa.sicurezza_interna_esclusa_ribasso,
        sam_obbligatoria: commessa.sam_obbligatoria ?? false,
        data_inizio: commessa.data_inizio, data_fine_prev: commessa.data_fine_prev,
        data_proroga: commessa.data_proroga || null,
        indirizzo_cantiere: commessa.indirizzo_cantiere,
        cap_cantiere: commessa.cap_cantiere || null,
        comune_cantiere: commessa.comune_cantiere || null,
        provincia: commessa.provincia || null,
        note: commessa.note || null,
      }).eq('id', id)
      if (e1) throw e1

      // Geocodifica Nominatim (fire-and-forget, non bloccante)
      if (commessa.comune_cantiere || commessa.indirizzo_cantiere) {
        try {
          const geoParams = new URLSearchParams({
            street: commessa.indirizzo_cantiere || '',
            city: commessa.comune_cantiere || '',
            postalcode: commessa.cap_cantiere || '',
            country: 'Italy', format: 'json', limit: '1'
          })
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?${geoParams}`, {
            headers: { 'User-Agent': 'SQ360/1.0 info.sq360@gmail.com' }
          })
          const geoData = await geoRes.json()
          if (geoData?.[0]?.lat) {
            await supabase.from('commesse').update({
              lat: parseFloat(geoData[0].lat),
              lng: parseFloat(geoData[0].lon)
            }).eq('id', id)
          }
        } catch { /* geocodifica non bloccante */ }
      }

      await supabase.from('commessa_figure').delete().eq('commessa_id', id)
      const ins = Object.entries(figure).filter(([,v]) => v.professionista_id)
        .map(([ruolo, v]) => ({ commessa_id: id, ruolo, professionista_id: v.professionista_id }))
      if (ins.length) { const { error: e2 } = await supabase.from('commessa_figure').insert(ins); if (e2) throw e2 }
      setSalvato(true); setTimeout(() => setSalvato(false), 3000)
    } catch (e: unknown) { setErrore(e instanceof Error ? e.message : 'Errore salvataggio') }
    finally { setSalvando(false) }
  }

  const fc = (k: keyof CommessaDati, v: string | number | boolean) => setCommessa(p => ({ ...p, [k]: v }))

  const fig_comm = FIGURE.filter(f => f.gruppo === 'committenza')
  const fig_imp  = FIGURE.filter(f => f.gruppo === 'impresa')
  const fig_sic  = FIGURE.filter(f => f.gruppo === 'sicurezza')

  const totObb = FIGURE.filter(f => f.obbligatorio).length
  const assObb = FIGURE.filter(f => f.obbligatorio && figure[f.ruolo]?.professionista_id).length
  const totAss = Object.keys(figure).filter(k => figure[k]?.professionista_id).length

  const statoColor = commessa.stato === 'IN_ESECUZIONE' ? 'green' : commessa.stato === 'AGGIUDICATA' ? 'blue' : commessa.stato === 'CHIUSA' ? 'gray' : 'amber'

  if (caricamento) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: 'var(--t3)' }}>
        <span className="spinner" />
        <span style={{ fontSize: 14 }}>Caricamento anagrafica...</span>
      </div>
    )
  }

  const inpEdit = { ...S.searchInput, paddingLeft: 12, fontSize: 13 }

  return (
    <div style={S.page} className="fade-in">
      {/* HEADER */}
      <div style={S.stickyHeader}>
        <div style={S.headerRow}>
          <div>
            <p style={S.headerTitle}>Anagrafica Commessa</p>
            <p style={S.headerSub}>
              {/^\d\d-[A-Z0-9]+-[A-Z]{2}-\d{3}$/.test(commessa.codice)
                ? <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '1px 7px', borderRadius: 5, marginRight: 6, letterSpacing: 0.5 }}>{commessa.codice}</span>
                : <span style={{ fontFamily: 'monospace', fontWeight: 600, marginRight: 6 }}>{commessa.codice}</span>
              }{commessa.nome}
              &nbsp;·&nbsp;
              <span style={{ color: assObb === totObb ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                {assObb}/{totObb} figure obbligatorie
              </span>
              &nbsp;·&nbsp; {totAss} assegnate su {FIGURE.length}
            </p>
          </div>
          <div style={S.headerActions}>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={generaVerbale}>
              📄 Verbale consegna
            </button>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={() => setEditDati(!editDati)}>
              <Edit3 size={13} /> {editDati ? 'Annulla' : 'Modifica dati'}
            </button>
            <button className={`btn-primary${salvato ? '' : ''}`}
              style={{ fontSize: 13, padding: '8px 20px', background: salvato ? 'var(--success)' : 'var(--accent)' }}
              onClick={salva} disabled={salvando}>
              {salvato ? <><Check size={14} /> Salvato</> : salvando ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Salvataggio...</> : <><Save size={14} /> Salva anagrafica</>}
            </button>
          </div>
        </div>
        {errore && (
          <div className="alert alert-danger" style={{ marginTop: 10, fontSize: 12 }}>
            <AlertCircle size={14} /> {errore}
            <button onClick={() => setErrore('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={12} /></button>
          </div>
        )}
      </div>

      {/* CONTENUTO */}
      <div style={S.content}>

        {/* ── DATI GENERALI ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.cardHeaderTitle}>
              <FileText size={14} style={{ color: 'var(--t3)' }} /> Dati Generali Commessa
            </div>
            <span style={S.badge(statoColor)}>{commessa.stato?.replace('_', ' ') || 'Bozza'}</span>
          </div>
          <div style={S.cardBody}>
            <div style={S.grid4}>
              <div>
                <label style={S.label}>CIG</label>
                {editDati ? <input style={inpEdit} value={commessa.cig || ''} onChange={e => fc('cig', e.target.value)} placeholder="—" />
                : <p style={S.valueMono}>{commessa.cig || '—'}</p>}
              </div>
              <div>
                <label style={S.label}>CUP</label>
                {editDati ? <input style={inpEdit} value={commessa.cup || ''} onChange={e => fc('cup', e.target.value)} placeholder="—" />
                : <p style={S.valueMono}>{commessa.cup || '—'}</p>}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}>Tipo commessa</label>
                {editDati ? (
                  <select style={{ ...inpEdit, cursor: 'pointer' }} value={commessa.tipo_commessa || ''} onChange={e => fc('tipo_commessa', e.target.value)}>
                    <option value="">— Seleziona —</option>
                    <option value="pubblica">🏛 Pubblica</option>
                    <option value="privata">🏠 Privata</option>
                  </select>
                ) : (
                  <p style={S.value}>{commessa.tipo_commessa === 'pubblica' ? '🏛 Pubblica' : commessa.tipo_commessa === 'privata' ? '🏠 Privata' : '—'}</p>
                )}
              </div>
              <div style={{ gridColumn: 'span 3' }}>
                <label style={S.label}>Committente / Stazione appaltante</label>
                {editDati ? <input style={inpEdit} value={commessa.committente || ''} onChange={e => fc('committente', e.target.value)} placeholder="Nome ente o privato" />
                : <p style={S.value}>{commessa.committente || '—'}</p>}
              </div>
              <div>
                <label style={S.label}>P.IVA committente</label>
                {editDati ? <input style={inpEdit} value={commessa.committente_piva || ''} onChange={e => fc('committente_piva', e.target.value)} placeholder="IT00000000000" />
                : <p style={S.valueMono}>{commessa.committente_piva || '—'}</p>}
              </div>
              <div>
                <label style={S.label}><Euro size={10} style={{ display: 'inline', marginRight: 3 }} />Importo contrattuale</label>
                {editDati ? <input style={inpEdit} type="number" value={commessa.importo_contrattuale || ''} onChange={e => fc('importo_contrattuale', parseFloat(e.target.value))} />
                : <p style={{ ...S.value, fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>€ {(commessa.importo_contrattuale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>}
              </div>
              <div>
                <label style={S.label}>Ribasso aggiudicazione</label>
                {editDati ? <input style={inpEdit} type="number" step="0.001" value={commessa.ribasso_pct || ''} onChange={e => fc('ribasso_pct', parseFloat(e.target.value))} />
                : <p style={S.value}>{commessa.ribasso_pct?.toFixed(3) || '0.000'}%</p>}
              </div>
              <div>
                <label style={S.label}>Oneri sicurezza (€)</label>
                {editDati ? <input style={inpEdit} type="number" value={commessa.oneri_sicurezza || ''} onChange={e => fc('oneri_sicurezza', parseFloat(e.target.value))} />
                : <p style={S.value}>€ {(commessa.oneri_sicurezza || 0).toLocaleString('it-IT')}</p>}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}>
                  🛡️ Quota sicurezza interna alle voci
                  <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--t3)', fontWeight: 400, cursor: 'help' }}
                    title="Configura se la quota di sicurezza interna alle singole voci è soggetta al ribasso d'asta. Verifica il tuo capitolato speciale d'appalto. Default: Non ribassabile (più tutelante)">
                    ⓘ
                  </span>
                </label>
                {editDati ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {[
                      { val: true,  label: '🔒 Non ribassabile', desc: 'La quota sicurezza NON subisce il ribasso d\'asta' },
                      { val: false, label: '✓ Soggetta a ribasso', desc: 'La quota sicurezza subisce il ribasso come le lavorazioni' },
                    ].map(opt => (
                      <button key={String(opt.val)} onClick={() => fc('sicurezza_interna_esclusa_ribasso', opt.val)}
                        title={opt.desc}
                        style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                          background: (commessa.sicurezza_interna_esclusa_ribasso ?? true) === opt.val ? '#14532d' : 'var(--bg)',
                          color:      (commessa.sicurezza_interna_esclusa_ribasso ?? true) === opt.val ? '#fff' : 'var(--t2)' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p style={S.value}>
                    {(commessa.sicurezza_interna_esclusa_ribasso ?? true)
                      ? '🔒 Non ribassabile (esclude dal ribasso d\'asta)'
                      : '✓ Soggetta a ribasso'}
                  </p>
                )}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}>
                  📋 SAM obbligatoria per tutti gli acquisti
                  <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--t3)', fontWeight: 400, cursor: 'help' }}
                    title="Se attivo, ogni RDO aggiudicata richiede l'approvazione SAM prima di emettere l'ODA. Default automatico per appalti pubblici.">
                    ⓘ
                  </span>
                </label>
                {editDati ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <button onClick={() => fc('sam_obbligatoria', !commessa.sam_obbligatoria)}
                      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', background: commessa.sam_obbligatoria ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s', left: commessa.sam_obbligatoria ? 23 : 3 }} />
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>
                      {commessa.sam_obbligatoria ? '✓ Obbligatoria' : 'Opzionale'}
                    </span>
                    {commessa.tipo_committente === 'pubblico' && !commessa.sam_obbligatoria && (
                      <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 4 }}>⚠ Consigliata per appalti pubblici</span>
                    )}
                  </div>
                ) : (
                  <p style={S.value}>{commessa.sam_obbligatoria ? '✓ Obbligatoria per tutti gli acquisti' : 'Opzionale'}</p>
                )}
              </div>
              <div>
                <label style={S.label}><Calendar size={10} style={{ display: 'inline', marginRight: 3 }} />Inizio lavori</label>
                {editDati ? <input style={inpEdit} type="date" value={commessa.data_inizio || ''} onChange={e => fc('data_inizio', e.target.value)} />
                : <p style={S.value}>{commessa.data_inizio ? new Date(commessa.data_inizio).toLocaleDateString('it-IT') : '—'}</p>}
              </div>
              <div>
                <label style={S.label}>Fine lavori prevista</label>
                {editDati ? <input style={inpEdit} type="date" value={commessa.data_fine_prev || ''} onChange={e => fc('data_fine_prev', e.target.value)} />
                : <p style={S.value}>{commessa.data_fine_prev ? new Date(commessa.data_fine_prev).toLocaleDateString('it-IT') : '—'}</p>}
              </div>
              <div>
                <label style={S.label}>Proroga al</label>
                {editDati ? <input style={inpEdit} type="date" value={commessa.data_proroga || ''} onChange={e => fc('data_proroga', e.target.value)} />
                : <p style={{ ...S.value, color: commessa.data_proroga ? 'var(--warning)' : 'var(--t4)' }}>{commessa.data_proroga ? new Date(commessa.data_proroga).toLocaleDateString('it-IT') : '—'}</p>}
              </div>
              <div /> {/* spacer */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}><MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />Via / Indirizzo cantiere</label>
                {editDati ? (
                  <AddressAutocomplete
                    value={commessa.indirizzo_cantiere || ''}
                    onChange={v => fc('indirizzo_cantiere', v)}
                    onSelect={parsed => {
                      fc('indirizzo_cantiere', parsed.indirizzo)
                      fc('cap_cantiere', parsed.cap)
                      fc('comune_cantiere', parsed.comune)
                      fc('provincia', parsed.provincia)
                    }}
                    placeholder="Via Roma, 1"
                    inputStyle={inpEdit}
                  />
                ) : <p style={S.value}>{commessa.indirizzo_cantiere || '—'}</p>}
              </div>
              <div>
                <label style={S.label}>CAP</label>
                {editDati ? <input style={inpEdit} maxLength={5} value={commessa.cap_cantiere || ''} onChange={e => fc('cap_cantiere', e.target.value)} placeholder="80100" />
                : <p style={S.valueMono}>{commessa.cap_cantiere || '—'}</p>}
              </div>
              <div>
                <label style={S.label}>Comune</label>
                {editDati ? <input style={inpEdit} value={commessa.comune_cantiere || ''} onChange={e => fc('comune_cantiere', e.target.value)} placeholder="Napoli" />
                : <p style={S.value}>{commessa.comune_cantiere || '—'}</p>}
              </div>
              <div>
                <label style={S.label}>Provincia</label>
                {editDati ? <input style={inpEdit} maxLength={2} value={commessa.provincia || ''} onChange={e => fc('provincia', e.target.value.toUpperCase())} placeholder="NA" />
                : <p style={S.valueMono}>{commessa.provincia || '—'}</p>}
              </div>
            </div>

            {/* Note generali */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <label style={S.label}>Note generali</label>
              {editDati ? (
                <textarea
                  style={{ ...inpEdit, resize: 'vertical' as const, minHeight: 72, fontFamily: 'inherit', lineHeight: 1.5 }}
                  value={commessa.note || ''}
                  onChange={e => fc('note', e.target.value)}
                  placeholder="Note, vincoli, riferimenti contratto, comunicazioni importanti..."
                />
              ) : (
                <p style={{ ...S.value, whiteSpace: 'pre-wrap', color: commessa.note ? 'var(--t1)' : 'var(--t4)', fontStyle: commessa.note ? 'normal' : 'italic' }}>
                  {commessa.note || 'Nessuna nota'}
                </p>
              )}
            </div>

            {/* Sicurezza Strato 3 */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={13} /> Sicurezza interna alle voci — Strato 3 (IncSIC da XPWE)
                </p>
                <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>
                  Quota sicurezza dentro ogni EPItem Primus. Configura se va in ribasso o no per questa commessa.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <button
                  onClick={() => fc('sicurezza_interna_esclusa_ribasso', !commessa.sicurezza_interna_esclusa_ribasso)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
                    background: commessa.sicurezza_interna_esclusa_ribasso ? 'var(--warning)' : 'var(--border)',
                    transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s', left: commessa.sicurezza_interna_esclusa_ribasso ? 23 : 3,
                  }} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', minWidth: 120 }}>
                  {commessa.sicurezza_interna_esclusa_ribasso ? '✓ NON ribassata' : 'Ribassata'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── WBS PERSONALIZZATA ── */}
        {(() => {
          // Ordered display with auto-computed codes
          const wbsOrdered = ricalcolaCodici(wbsNodes)

          const saveWbs = async () => {
            setWbsSaving(true)
            try {
              const db = supabase as any
              await db.from('wbs_nodes').delete().eq('commessa_id', id).eq('azienda_id', aziendaId)
              if (wbsNodes.length > 0) {
                await db.from('wbs_nodes').insert(
                  buildWbsInsertPayload(wbsNodes, { commessa_id: id, azienda_id: aziendaId })
                )
              }
              setWbsEdited(false)
            } finally { setWbsSaving(false) }
          }

          const moveUp = (nodeId: string) => {
            const node = wbsNodes.find(n => n.id === nodeId)!
            const siblings = wbsNodes.filter(n => n.parent_id === node.parent_id).sort((a,b) => a.ordine - b.ordine)
            const sibIdx = siblings.findIndex(s => s.id === nodeId)
            if (sibIdx === 0) return
            const prev = siblings[sibIdx - 1]
            setWbsNodes(ns => ns.map(n => n.id === nodeId ? { ...n, ordine: prev.ordine } : n.id === prev.id ? { ...n, ordine: node.ordine } : n))
            setWbsEdited(true)
          }

          const moveDown = (nodeId: string) => {
            const node = wbsNodes.find(n => n.id === nodeId)!
            const siblings = wbsNodes.filter(n => n.parent_id === node.parent_id).sort((a,b) => a.ordine - b.ordine)
            const sibIdx = siblings.findIndex(s => s.id === nodeId)
            if (sibIdx === siblings.length - 1) return
            const next = siblings[sibIdx + 1]
            setWbsNodes(ns => ns.map(n => n.id === nodeId ? { ...n, ordine: next.ordine } : n.id === next.id ? { ...n, ordine: node.ordine } : n))
            setWbsEdited(true)
          }

          const editLabel = (nodeId: string, etichetta: string) => {
            setWbsNodes(ns => ns.map(n => n.id === nodeId ? { ...n, etichetta } : n))
            setWbsEdited(true)
          }

          const deleteNode = (nodeId: string) => {
            const toDelete = new Set([nodeId])
            let changed = true
            while (changed) {
              changed = false
              wbsNodes.forEach(n => { if (n.parent_id && toDelete.has(n.parent_id) && !toDelete.has(n.id)) { toDelete.add(n.id); changed = true } })
            }
            setWbsNodes(ns => ns.filter(n => !toDelete.has(n.id)))
            setWbsEdited(true)
          }

          const addRoot = () => {
            const roots = wbsNodes.filter(n => !n.parent_id)
            const maxOrdine = roots.length > 0 ? Math.max(...roots.map(n => n.ordine)) + 1 : 0
            setWbsNodes(ns => [...ns, { id: crypto.randomUUID(), parent_id: null, etichetta: 'Nuova fase', ordine: maxOrdine }])
            setWbsEdited(true)
          }

          const addChild = (parentId: string) => {
            const children = wbsNodes.filter(n => n.parent_id === parentId)
            const maxOrdine = children.length > 0 ? Math.max(...children.map(n => n.ordine)) + 1 : 0
            setWbsNodes(ns => [...ns, { id: crypto.randomUUID(), parent_id: parentId, etichetta: 'Nuova voce', ordine: maxOrdine }])
            setWbsEdited(true)
          }

          const importFromTemplate = async () => {
            if (!aziendaId) return
            const db = supabase as any
            const { data } = await db.from('wbs_templates')
              .select('id,parent_id,descrizione,ordine')
              .eq('azienda_id', aziendaId)
              .order('ordine', { ascending: true })
            if (!data?.length) {
              alert('Nessun template WBS configurato. Vai in Impostazioni → Template WBS aziendale.')
              return
            }
            // Remap IDs: nuovi UUID per questa commessa, mantieni struttura parent_id
            const oldToNew: Record<string, string> = {}
            const imported: WbsNode[] = data.map((r: any) => {
              const newId = crypto.randomUUID()
              oldToNew[r.id] = newId
              return { id: newId, parent_id: r.parent_id, etichetta: r.descrizione, ordine: r.ordine, template_id: r.id }
            })
            const remapped = imported.map(n => ({ ...n, parent_id: n.parent_id ? (oldToNew[n.parent_id] || null) : null }))
            setWbsNodes(remapped)
            setWbsEdited(true)
            setWbsOpen(true)
          }

          return (
            <div style={S.card}>
              <button style={{ ...S.cardHeader, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => setWbsOpen(x => !x)}>
                <div style={S.cardHeaderTitle}>
                  📐 WBS Commessa
                  {wbsEdited && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>● modificata</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>{wbsNodes.length} voci</span>
                  {wbsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>
              {wbsOpen && (
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button style={{ fontSize: 11, padding: '4px 10px', background: '#14532d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                      onClick={addRoot}>➕ Fase radice</button>
                    <button style={{ fontSize: 11, padding: '4px 10px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                      onClick={importFromTemplate}>📋 Importa da template aziendale</button>
                    {wbsEdited && (
                      <button style={{ fontSize: 11, padding: '4px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                        onClick={saveWbs} disabled={wbsSaving}>
                        {wbsSaving ? '…' : '💾 Salva WBS commessa'}
                      </button>
                    )}
                    <button style={{ fontSize: 11, padding: '4px 10px', background: 'transparent', color: 'var(--t3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                      onClick={() => { setWbsNodes(wbsFlatToNodes(DEFAULT_WBS_FLAT, () => crypto.randomUUID())); setWbsEdited(true) }}>↩ Ripristina default</button>
                  </div>
                  {wbsNodes.length === 0 && (
                    <div style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e', marginBottom: 8 }}>
                      ⚠ Nessuna WBS configurata. Clicca "📋 Importa da template aziendale" o "➕ Fase radice" per iniziare.
                    </div>
                  )}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {wbsOrdered.map(node => {
                      const depth = (node.codice!.match(/\./g) || []).length
                      const isRoot = depth === 0
                      const siblings = wbsNodes.filter(n => n.parent_id === node.parent_id).sort((a,b) => a.ordine - b.ordine)
                      const sibIdx = siblings.findIndex(s => s.id === node.id)
                      return (
                        <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', paddingLeft: 8 + depth * 16, borderBottom: '1px solid var(--border)', background: isRoot ? '#f0fdf4' : '#fff' }}>
                          <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0, width: 8 }}>{isRoot ? '▶' : '└'}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', minWidth: 40, flexShrink: 0 }}>{node.codice}</span>
                          {node.template_id && <span title="Importato da template" style={{ width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', flexShrink: 0 }} />}
                          <input style={{ fontSize: 11, flex: 1, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4 }}
                            value={node.etichetta}
                            onChange={e => editLabel(node.id, e.target.value)} />
                          {isRoot && (
                            <button style={{ fontSize: 10, padding: '2px 6px', background: '#dcfce7', color: '#14532d', border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                              onClick={() => addChild(node.id)}>+voce</button>
                          )}
                          <button style={{ fontSize: 10, padding: '2px 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t3)' }}
                            onClick={() => moveUp(node.id)} disabled={sibIdx === 0}>↑</button>
                          <button style={{ fontSize: 10, padding: '2px 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t3)' }}
                            onClick={() => moveDown(node.id)} disabled={sibIdx === siblings.length - 1}>↓</button>
                          <button style={{ fontSize: 10, padding: '2px 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                            onClick={() => deleteNode(node.id)}>✕</button>
                        </div>
                      )
                    })}
                    {wbsNodes.length === 0 && (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                        Nessuna voce WBS — clicca "Fase radice" per aggiungere
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── GRUPPI FIGURE PROFESSIONALI ── */}
        {([
          { key: 'committenza' as const, label: 'Stazione Appaltante / Committente', desc: 'RUP, DL, CSP/CSE, Collaudo, Progettisti', icon: <Building2 size={15} style={{ color: 'var(--accent)' }} />, figure: fig_comm },
          { key: 'impresa'     as const, label: 'Impresa Esecutrice',                desc: 'RC, DT, Capocantiere, Assistenti',          icon: <HardHat  size={15} style={{ color: '#f59e0b' }}    />, figure: fig_imp  },
          { key: 'sicurezza'   as const, label: 'Sicurezza — D.Lgs. 81/2008',        desc: 'RSPP, Preposto, Medico, RLS, Emergenze',   icon: <Shield   size={15} style={{ color: 'var(--danger)' }}/>, figure: fig_sic  },
        ]).map(g => {
          const assGruppo = g.figure.filter(f => figure[f.ruolo]?.professionista_id).length
          const obbGruppo = g.figure.filter(f => f.obbligatorio).length
          const assObbGruppo = g.figure.filter(f => f.obbligatorio && figure[f.ruolo]?.professionista_id).length
          const isOpen = gruppoAperto === g.key

          return (
            <div key={g.key} style={S.card}>
              <button style={S.groupBtn(isOpen)}
                onClick={() => setGruppoAperto(x => x === g.key ? null : g.key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {g.icon}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{g.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{g.desc}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: assObbGruppo === obbGruppo ? 'var(--success)' : 'var(--warning)' }}>
                      {assObbGruppo}/{obbGruppo} obbligatorie
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--t4)', marginTop: 1 }}>{assGruppo}/{g.figure.length} totali</p>
                  </div>
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--t3)' }} /> : <ChevronDown size={16} style={{ color: 'var(--t3)' }} />}
                </div>
              </button>

              {isOpen && (
                <div style={S.gruppoGrid}>
                  {g.figure.map(figura => (
                    <div key={figura.ruolo} style={S.figuraWrap}>
                      <div style={S.figuraInfo}>
                        <span style={S.figuraIcon}>{figura.icona}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={S.figuraLabel}>{figura.label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', background: 'var(--bg)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>
                              {figura.sigla}
                            </span>
                            {figura.obbligatorio && (
                              <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600 }}>obbligatorio</span>
                            )}
                          </div>
                          {figura.normativa && <p style={S.figuraNorm}>{figura.normativa}</p>}
                          <p style={S.figuraDesc}>{figura.descrizione}</p>
                        </div>
                      </div>
                      <RicercaProfessionista
                        figura={figura}
                        valore={figure[figura.ruolo]?.professionista}
                        onSeleziona={p => salvaFigura(figura.ruolo, p)}
                        onNuovo={(ruolo, q) => setModal({ aperto: true, ruolo, query: q })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal nuovo professionista */}
      <ModalNuovo
        aperto={modal.aperto}
        queryIniziale={modal.query}
        aziendaId={aziendaId}
        onChiudi={() => setModal({ aperto: false, ruolo: '', query: '' })}
        onSalvato={p => { salvaFigura(modal.ruolo, p); setModal({ aperto: false, ruolo: '', query: '' }) }}
      />
    </div>
  )
}
