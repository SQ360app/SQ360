'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, Users, Bell, Shield, Plus, Save, CheckCircle, Edit2, Upload, Image as ImageIcon, FileImage, Loader2, Trash2 } from 'lucide-react'
import { supabase, getAziendaId } from '@/lib/supabase'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

// ─── Tipi ────────────────────────────────────────────────────────────────────
type Ruolo = 'admin' | 'direttore_tecnico' | 'responsabile_commessa' | 'operatore' | 'contabilita' | 'viewer'

interface Utente {
  id: string
  nome: string
  cognome: string
  email: string
  ruolo: Ruolo
  commesse_assegnate: string[]
  attivo: boolean
  ultimo_accesso: string
}

// ─── Dati campione ────────────────────────────────────────────────────────────
const UTENTI_INIT: Utente[] = [
  { id:'u1', nome:'Marco', cognome:'Bianchi', email:'m.bianchi@sq360.it', ruolo:'admin', commesse_assegnate:[], attivo:true, ultimo_accesso:'2024-06-01' },
  { id:'u2', nome:'Laura', cognome:'Verdi', email:'l.verdi@sq360.it', ruolo:'direttore_tecnico', commesse_assegnate:['C-2024-007','C-2024-003'], attivo:true, ultimo_accesso:'2024-05-30' },
  { id:'u3', nome:'Giovanni', cognome:'Rossi', email:'g.rossi@sq360.it', ruolo:'responsabile_commessa', commesse_assegnate:['C-2024-007'], attivo:true, ultimo_accesso:'2024-06-01' },
  { id:'u4', nome:'Anna', cognome:'Ferrari', email:'a.ferrari@sq360.it', ruolo:'contabilita', commesse_assegnate:[], attivo:true, ultimo_accesso:'2024-05-28' },
  { id:'u5', nome:'Stefano', cognome:'Marino', email:'s.marino@sq360.it', ruolo:'operatore', commesse_assegnate:['C-2024-007'], attivo:false, ultimo_accesso:'2024-04-15' },
]

const RUOLO_META: Record<Ruolo, { label: string; color: string; descrizione: string; permessi: string[] }> = {
  admin: {
    label: 'Amministratore', color: '#ef4444',
    descrizione: 'Accesso completo a tutte le funzioni e impostazioni',
    permessi: ['Tutte le commesse', 'Gestione utenti', 'Impostazioni azienda', 'Tutti i moduli', 'Export/Import', 'Fatturazione']
  },
  direttore_tecnico: {
    label: 'Direttore Tecnico', color: '#3b82f6',
    descrizione: 'Supervisione su tutte le commesse, approvazione SAL',
    permessi: ['Tutte le commesse (lettura)', 'Approvazione SAL', 'Gare', 'Marginalità', 'Report']
  },
  responsabile_commessa: {
    label: 'Resp. Commessa', color: '#8b5cf6',
    descrizione: 'Gestione completa delle commesse assegnate',
    permessi: ['Commesse assegnate', 'SAM', 'SAL passivi', 'Pianificazione', 'Cantiere', 'Fornitori']
  },
  contabilita: {
    label: 'Contabilità', color: '#f59e0b',
    descrizione: 'Accesso ai moduli amministrativi e finanziari',
    permessi: ['Fatturazione', 'Marginalità (lettura)', 'Scadenzario', 'SAL (lettura)']
  },
  operatore: {
    label: 'Operatore', color: '#10b981',
    descrizione: 'Inserimento dati operativi di cantiere',
    permessi: ['Giornale lavori', 'Registro accessi', 'DAM (inserimento)']
  },
  viewer: {
    label: 'Viewer', color: '#6b7280',
    descrizione: 'Sola lettura su commesse assegnate',
    permessi: ['Lettura commesse assegnate', 'Dashboard (lettura)']
  }
}

interface AziendaInfo {
  ragione_sociale: string
  piva: string
  cf: string
  indirizzo_sede: string
  cap_sede: string
  comune_sede: string
  provincia_sede: string
  pec: string
  email: string
  tel: string
  rea: string
  soa_categorie: string
  patente_crediti: string
}

interface Sede {
  id: string
  tipo: string
  nome: string | null
  indirizzo: string | null
  comune: string | null
  cap: string | null
  provincia: string | null
  lat: number | null
  lng: number | null
  telefono: string | null
  email: string | null
  referente: string | null
  note: string | null
  attiva: boolean
}

const TIPO_SEDE: Record<string, { label: string; color: string; emoji: string }> = {
  operativa:       { label: 'Operativa',      color: '#2563eb', emoji: '🏭' },
  amministrativa:  { label: 'Amministrativa', color: '#7c3aed', emoji: '🏢' },
  magazzino:       { label: 'Magazzino',      color: '#6b7280', emoji: '📦' },
  deposito:        { label: 'Deposito',       color: '#4b5563', emoji: '🏗️' },
  ufficio_tecnico: { label: 'Uff. Tecnico',   color: '#4f46e5', emoji: '💼' },
  filiale:         { label: 'Filiale',        color: '#0891b2', emoji: '🏢' },
  altro:           { label: 'Altro',          color: '#9ca3af', emoji: '⬡' },
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ImpostazioniPage() {
  const [tab, setTab] = useState<'azienda' | 'utenti' | 'ruoli' | 'notifiche'>('azienda')
  const [utenti, setUtenti] = useState<Utente[]>(UTENTI_INIT)
  const [savedOk, setSavedOk] = useState(false)

  // Documenti azienda — reali da Supabase
  const [aziendaId, setAziendaId]                         = useState<string>('')
  const [logoUrl, setLogoUrl]                             = useState<string>('')
  const [headerUrl, setHeaderUrl]                         = useState<string>('')
  const [footerUrl, setFooterUrl]                         = useState<string>('')
  const [logoPreview, setLogoPreview]                     = useState<string>('')
  const [headerPreview, setHeaderPreview]                 = useState<string>('')
  const [footerPreview, setFooterPreview]                 = useState<string>('')
  const [uploadingLogo, setUploadingLogo]                 = useState(false)
  const [uploadingHeader, setUploadingHeader]             = useState(false)
  const [uploadingFooter, setUploadingFooter]             = useState(false)
  const [docSaved, setDocSaved]                           = useState(false)
  const logoRef   = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLInputElement>(null)
  const footerRef = useRef<HTMLInputElement>(null)

  const [emailAcquisti,        setEmailAcquisti]        = useState('')
  const [emailCantiere,        setEmailCantiere]        = useState('')
  const [emailAmministrazione, setEmailAmministrazione] = useState('')
  const [emailSaved,           setEmailSaved]           = useState(false)

  const [sedi,         setSedi]         = useState<Sede[]>([])
  const [nuovaSede,    setNuovaSede]    = useState<Partial<Sede> | null>(null)
  const [salvandoSede, setSalvandoSede] = useState(false)

  useEffect(() => {
    getAziendaId().then(async id => {
      if (!id) return
      setAziendaId(id)
      const { data } = await (supabase as any).from('azienda').select('logo_url,carta_intestata_header_url,carta_intestata_footer_url').eq('id', id).single()
      if (data) {
        const d = data as any
        if (d.logo_url)                     { setLogoUrl(d.logo_url);     setLogoPreview(d.logo_url) }
        if (d.carta_intestata_header_url)   { setHeaderUrl(d.carta_intestata_header_url); setHeaderPreview(d.carta_intestata_header_url) }
        if (d.carta_intestata_footer_url)   { setFooterUrl(d.carta_intestata_footer_url); setFooterPreview(d.carta_intestata_footer_url) }
      }
      const { data: az } = await (supabase as any).from('azienda').select('*').eq('id', id).maybeSingle()
      if (az) {
        if (az.email_acquisti)        setEmailAcquisti(az.email_acquisti)
        if (az.email_cantiere)        setEmailCantiere(az.email_cantiere)
        if (az.email_amministrazione) setEmailAmministrazione(az.email_amministrazione)
        setAzienda({
          ragione_sociale: az.ragione_sociale || '',
          piva:            az.partita_iva || '',
          cf:              az.codice_fiscale || '',
          indirizzo_sede:  az.sede_legale || '',
          cap_sede:        '',
          comune_sede:     '',
          provincia_sede:  '',
          pec:             az.pec || '',
          email:           az.email || '',
          tel:             az.telefono || '',
          rea:             az.rea || '',
          soa_categorie:   az.soa_categorie || '',
          patente_crediti: az.patente_punteggio != null ? String(az.patente_punteggio) : '',
        })
      }
      const { data: sediData } = await (supabase as any)
        .from('azienda_sedi').select('*').eq('azienda_id', id).order('created_at', { ascending: true })
      if (sediData) setSedi(sediData)
    })
  }, [])

  async function uploadFile(file: File, tipo: 'logo' | 'header' | 'footer'): Promise<string | null> {
    if (!aziendaId) return null
    if (file.size > 2 * 1024 * 1024) { alert('File troppo grande (max 2 MB)'); return null }
    const ext  = file.name.split('.').pop()
    const path = `${aziendaId}/${tipo}.${ext}`
    const { error } = await supabase.storage.from('aziende-assets').upload(path, file, { upsert: true })
    if (error) { alert('Errore upload: ' + error.message); return null }
    const { data } = supabase.storage.from('aziende-assets').getPublicUrl(path)
    return data.publicUrl + '?t=' + Date.now()
  }

  async function handleUpload(tipo: 'logo' | 'header' | 'footer', file: File) {
    const set = tipo === 'logo' ? setUploadingLogo : tipo === 'header' ? setUploadingHeader : setUploadingFooter
    set(true)
    const url = await uploadFile(file, tipo)
    set(false)
    if (!url) return
    const objectUrl = URL.createObjectURL(file)
    if (tipo === 'logo')   { setLogoUrl(url);   setLogoPreview(objectUrl) }
    if (tipo === 'header') { setHeaderUrl(url); setHeaderPreview(objectUrl) }
    if (tipo === 'footer') { setFooterUrl(url); setFooterPreview(objectUrl) }
  }

  async function saveDocumenti() {
    if (!aziendaId) return
    await (supabase as any).from('azienda').update({
      logo_url:                   logoUrl   || null,
      carta_intestata_header_url: headerUrl || null,
      carta_intestata_footer_url: footerUrl || null,
    }).eq('id', aziendaId)
    setDocSaved(true)
    setTimeout(() => setDocSaved(false), 3000)
  }

  const [azienda, setAzienda] = useState<AziendaInfo>({
    ragione_sociale: 'Costruzioni Generali Bianchi Srl',
    piva: '12345678901',
    cf: '12345678901',
    indirizzo_sede: 'Via Roma 1',
    cap_sede: '20100',
    comune_sede: 'Milano',
    provincia_sede: 'MI',
    pec: 'costruzioni.bianchi@pec.it',
    email: 'info@costruzionibianchi.it',
    tel: '+39 02 1234567',
    rea: 'MI-1234567',
    soa_categorie: 'OG1 classifica IV, OG11 classifica III',
    patente_crediti: '100'
  })

  async function saveAzienda() {
    if (!aziendaId) return
    const sedeLegale = [
      azienda.indirizzo_sede,
      azienda.cap_sede && azienda.comune_sede
        ? `${azienda.cap_sede} ${azienda.comune_sede}`
        : azienda.cap_sede || azienda.comune_sede,
    ].filter(Boolean).join(', ')
    const { error } = await (supabase as any).from('azienda').update({
      ragione_sociale:   azienda.ragione_sociale || null,
      partita_iva:       azienda.piva || null,
      codice_fiscale:    azienda.cf || null,
      sede_legale:       sedeLegale || null,
      pec:               azienda.pec || null,
      email:             azienda.email || null,
      telefono:          azienda.tel || null,
      rea:               azienda.rea || null,
      soa_categorie:     azienda.soa_categorie || null,
      patente_punteggio: azienda.patente_crediti || null,
    }).eq('id', aziendaId)
    if (error) { alert('Errore salvataggio: ' + error.message); return }
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 3000)
  }

  async function saveEmailConfig() {
    if (!aziendaId) return
    await (supabase as any).from('azienda').update({
      email_acquisti:        emailAcquisti        || null,
      email_cantiere:        emailCantiere        || null,
      email_amministrazione: emailAmministrazione || null,
    }).eq('id', aziendaId)
    setEmailSaved(true)
    setTimeout(() => setEmailSaved(false), 3000)
  }

  function toggleAttivo(uid: string) {
    setUtenti(prev => prev.map(u => u.id === uid ? { ...u, attivo: !u.attivo } : u))
  }

  async function saveSede() {
    if (!aziendaId || !nuovaSede) return
    setSalvandoSede(true)
    try {
      let lat = nuovaSede.lat ?? null
      let lng = nuovaSede.lng ?? null
      if ((!lat || !lng) && nuovaSede.indirizzo) {
        const q = [nuovaSede.indirizzo, nuovaSede.comune, nuovaSede.provincia, 'Italia'].filter(Boolean).join(', ')
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=it`, { headers: { 'Accept-Language': 'it' } })
          const j = await r.json()
          if (j[0]) { lat = parseFloat(j[0].lat); lng = parseFloat(j[0].lon) }
        } catch { /* non bloccante */ }
      }
      const payload = {
        azienda_id: aziendaId,
        tipo: nuovaSede.tipo || 'operativa',
        nome: nuovaSede.nome || null,
        indirizzo: nuovaSede.indirizzo || null,
        comune: nuovaSede.comune || null,
        cap: nuovaSede.cap || null,
        provincia: nuovaSede.provincia || null,
        lat, lng,
        telefono: nuovaSede.telefono || null,
        email: nuovaSede.email || null,
        referente: nuovaSede.referente || null,
        note: nuovaSede.note || null,
        attiva: nuovaSede.attiva !== false,
      }
      let saveError: any = null
      if (nuovaSede.id) {
        const { error } = await (supabase as any).from('azienda_sedi').update(payload).eq('id', nuovaSede.id)
        saveError = error
      } else {
        const { error } = await (supabase as any).from('azienda_sedi').insert(payload)
        saveError = error
      }
      if (saveError) { alert('Errore salvataggio sede: ' + saveError.message); return }
      const { data } = await (supabase as any).from('azienda_sedi').select('*').eq('azienda_id', aziendaId).order('created_at', { ascending: true })
      if (data) setSedi(data)
      setNuovaSede(null)
    } finally {
      setSalvandoSede(false)
    }
  }

  async function deleteSede(id: string) {
    await (supabase as any).from('azienda_sedi').delete().eq('id', id)
    setSedi(prev => prev.filter(s => s.id !== id))
  }

  return (
    <>
      
      <div style={{ padding: '24px 32px', background: 'var(--bg)', minHeight: '100vh' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {([
            { key: 'azienda', label: '🏢 Azienda', icon: Building2 },
            { key: 'utenti', label: '👥 Utenti', icon: Users },
            { key: 'ruoli', label: '🔐 Ruoli & Permessi', icon: Shield },
            { key: 'notifiche', label: '🔔 Notifiche', icon: Bell },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
              background: tab === t.key ? 'var(--accent)' : 'var(--panel)',
              color: tab === t.key ? 'white' : 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── TAB AZIENDA ── */}
        {tab === 'azienda' && (
          <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Documenti azienda ── */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: '0 0 6px' }}>Documenti azienda</h3>
              <p style={{ fontSize: 12, color: 'var(--t3)', margin: '0 0 20px', lineHeight: 1.6 }}>
                Usati nell'intestazione di tutti i PDF generati da SQ360.<br />
                <strong>Priorità:</strong> carta intestata → logo → solo testo
              </p>

              {/* LIVELLO 1 — Logo */}
              <div style={{ marginBottom: 20, padding: '16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <ImageIcon size={14} color="var(--t3)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Livello 1 — Logo aziendale</span>
                  <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 4 }}>PNG / SVG · max 2 MB</span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input ref={logoRef} type="file" accept="image/png,image/svg+xml" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('logo', f) }} />
                    <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--t2)' }}>
                      {uploadingLogo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {logoUrl ? 'Sostituisci logo' : 'Carica logo'}
                    </button>
                    {logoUrl && <button onClick={() => { setLogoUrl(''); setLogoPreview('') }}
                      style={{ marginLeft: 8, padding: '9px 12px', border: '1px solid #fca5a5', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>
                      Rimuovi
                    </button>}
                  </div>
                  {logoPreview && (
                    <div style={{ width: 120, height: 60, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', overflow: 'hidden', padding: 8 }}>
                      <img src={logoPreview} alt="Logo preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* LIVELLO 2 — Carta intestata */}
              <div style={{ padding: '16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <FileImage size={14} color="var(--t3)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Livello 2 — Carta intestata completa</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--t3)', margin: '0 0 14px' }}>
                  Se presente, <strong>sostituisce</strong> l'intestazione SQ360 in tutti i PDF. Header: PNG 794×150 px (A4 @96dpi). Footer: opzionale.
                </p>

                {/* Header */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>Header (obbligatorio per carta intestata)</div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input ref={headerRef} type="file" accept="image/png" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('header', f) }} />
                      <button onClick={() => headerRef.current?.click()} disabled={uploadingHeader}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--t2)' }}>
                        {uploadingHeader ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        {headerUrl ? 'Sostituisci header' : 'Carica header PNG'}
                      </button>
                      {headerUrl && <button onClick={() => { setHeaderUrl(''); setHeaderPreview('') }}
                        style={{ marginLeft: 8, padding: '9px 12px', border: '1px solid #fca5a5', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>
                        Rimuovi
                      </button>}
                    </div>
                    {headerPreview && (
                      <div style={{ flex: 2, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                        <img src={headerPreview} alt="Header preview" style={{ width: '100%', display: 'block' }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>Footer (opzionale)</div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input ref={footerRef} type="file" accept="image/png" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('footer', f) }} />
                      <button onClick={() => footerRef.current?.click()} disabled={uploadingFooter}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--t2)' }}>
                        {uploadingFooter ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        {footerUrl ? 'Sostituisci footer' : 'Carica footer PNG'}
                      </button>
                      {footerUrl && <button onClick={() => { setFooterUrl(''); setFooterPreview('') }}
                        style={{ marginLeft: 8, padding: '9px 12px', border: '1px solid #fca5a5', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>
                        Rimuovi
                      </button>}
                    </div>
                    {footerPreview && (
                      <div style={{ flex: 2, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                        <img src={footerPreview} alt="Footer preview" style={{ width: '100%', display: 'block' }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Anteprima mock PDF */}
                {(headerPreview || logoPreview) && (
                  <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>Anteprima header PDF</div>
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                      {headerPreview ? (
                        <img src={headerPreview} alt="Anteprima carta intestata" style={{ width: '100%', display: 'block' }} />
                      ) : logoPreview ? (
                        <div style={{ padding: '12px 20px', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <img src={logoPreview} alt="Logo" style={{ height: 36, objectFit: 'contain' }} />
                          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>ORDINE DI ACQUISTO</div>
                        </div>
                      ) : null}
                      <div style={{ padding: '8px 16px', borderTop: '1px solid #e5e7eb', fontSize: 11, color: '#6b7280', background: '#f9fafb' }}>
                        Corpo del documento — {headerPreview ? 'carta intestata personalizzata' : 'layout SQ360 con logo'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                {docSaved && <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> Salvato</span>}
                <button onClick={saveDocumenti}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Save size={14} /> Salva documenti
                </button>
              </div>
            </div>

            {/* ── Dati aziendali ── */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20, margin: '0 0 20px' }}>Dati aziendali</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {([
                  { key: 'ragione_sociale', label: 'Ragione Sociale', full: true },
                  { key: 'piva', label: 'Partita IVA' },
                  { key: 'cf', label: 'Codice Fiscale' },
                  { key: 'rea', label: 'Numero REA' },
                ] as { key: keyof AziendaInfo; label: string }[]).map(f => (
                  <div key={String(f.key)}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
                    <input
                      value={azienda[f.key] as string}
                      onChange={e => setAzienda(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}
                    />
                  </div>
                ))}

                {/* Sede legale — campi separati */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>Sede Legale — Indirizzo</label>
                  <AddressAutocomplete
                    value={azienda.indirizzo_sede}
                    onChange={v => setAzienda(prev => ({ ...prev, indirizzo_sede: v }))}
                    onSelect={parsed => setAzienda(prev => ({
                      ...prev,
                      indirizzo_sede: parsed.indirizzo,
                      cap_sede:       parsed.cap,
                      comune_sede:    parsed.comune,
                      provincia_sede: parsed.provincia,
                    }))}
                    placeholder="Via Roma 1"
                    inputStyle={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px', gap: 10, gridColumn: 'span 2' }}>
                  {([
                    { key: 'cap_sede',       label: 'CAP',     maxLen: 5, placeholder: '20100' },
                    { key: 'comune_sede',    label: 'Comune',  placeholder: 'Milano' },
                    { key: 'provincia_sede', label: 'Prov.',   maxLen: 2, placeholder: 'MI', upper: true },
                  ] as { key: keyof AziendaInfo; label: string; maxLen?: number; placeholder: string; upper?: boolean }[]).map(f => (
                    <div key={String(f.key)}>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
                      <input
                        value={azienda[f.key] as string}
                        maxLength={f.maxLen}
                        placeholder={f.placeholder}
                        onChange={e => setAzienda(prev => ({ ...prev, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>

                {([
                  { key: 'pec', label: 'PEC' },
                  { key: 'email', label: 'Email' },
                  { key: 'tel', label: 'Telefono' },
                ] as { key: keyof AziendaInfo; label: string }[]).map(f => (
                  <div key={String(f.key)}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
                    <input
                      value={azienda[f.key] as string}
                      onChange={e => setAzienda(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}
                    />
                  </div>
                ))}

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>Categorie SOA</label>
                  <input
                    value={azienda.soa_categorie}
                    onChange={e => setAzienda(prev => ({ ...prev, soa_categorie: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>Punteggio Patente Crediti</label>
                  <input
                    value={azienda.patente_crediti}
                    onChange={e => setAzienda(prev => ({ ...prev, patente_crediti: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {savedOk && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 13 }}>
                    <CheckCircle size={15} /> Salvato
                  </div>
                )}
                <button onClick={saveAzienda} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--accent)', border: 'none', borderRadius: 8,
                  padding: '10px 20px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}>
                  <Save size={14} /> Salva modifiche
                </button>
              </div>
            </div>

            {/* ── Sedi e Unità Locali ── */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>Sedi e Unità Locali</h3>
                  <p style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 0', lineHeight: 1.5 }}>
                    Sedi operative, magazzini, depositi e filiali — appariranno come pin sulla mappa cantieri
                  </p>
                </div>
                <button
                  onClick={() => setNuovaSede({ tipo: 'operativa', attiva: true })}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 14px', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  <Plus size={13} /> Aggiungi sede
                </button>
              </div>

              {sedi.length === 0 && !nuovaSede && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: 13, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                  Nessuna sede — le sedi aggiuntive appariranno come pin sulla mappa
                </div>
              )}

              {sedi.map(s => {
                const meta = TIPO_SEDE[s.tipo] || TIPO_SEDE.altro
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 10, opacity: s.attiva ? 1 : 0.55 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta.color + '22', border: `2px solid ${meta.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {meta.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{s.nome || meta.label}</span>
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: meta.color + '22', color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                        {!s.attiva && <span style={{ fontSize: 10, color: '#6b7280', background: '#1e293b', padding: '1px 7px', borderRadius: 10 }}>Inattiva</span>}
                      </div>
                      {(s.indirizzo || s.comune) && (
                        <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                          📍 {[s.indirizzo, s.cap && s.comune ? `${s.cap} ${s.comune}` : s.comune, s.provincia].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {s.referente && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>👤 {s.referente}</div>}
                      {s.telefono  && <div style={{ fontSize: 11, color: 'var(--t3)' }}>📞 {s.telefono}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => {
                          setNuovaSede(null)
                          setTimeout(() => setNuovaSede({ ...s }), 0)
                        }}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--t3)' }}>
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => { if (confirm('Eliminare questa sede?')) deleteSede(s.id) }}
                        style={{ background: 'none', border: '1px solid #374151', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#ef4444' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}

              {nuovaSede !== null && (
                <div style={{ marginTop: 16, padding: '20px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--accent)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>
                    {nuovaSede.id ? 'Modifica sede' : 'Nuova sede'}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontWeight: 600 }}>Tipo sede</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Object.entries(TIPO_SEDE).map(([k, v]) => (
                        <button key={k} onClick={() => setNuovaSede(prev => ({ ...prev!, tipo: k }))}
                          style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${nuovaSede.tipo === k ? v.color : 'var(--border)'}`, background: nuovaSede.tipo === k ? v.color + '22' : 'transparent', color: nuovaSede.tipo === k ? v.color : 'var(--t3)', fontSize: 11, fontWeight: nuovaSede.tipo === k ? 700 : 400, cursor: 'pointer' }}>
                          {v.emoji} {v.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontWeight: 600 }}>Nome sede (opzionale)</label>
                    <input value={nuovaSede.nome || ''} onChange={e => setNuovaSede(prev => ({ ...prev!, nome: e.target.value }))}
                      placeholder="es. Cantiere Nord, Magazzino Centrale…"
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, fontWeight: 600 }}>Indirizzo</label>
                    <AddressAutocomplete
                      value={nuovaSede.indirizzo || ''}
                      onChange={v => setNuovaSede(prev => ({ ...prev!, indirizzo: v }))}
                      onSelect={parsed => setNuovaSede(prev => ({
                        ...prev!,
                        indirizzo: parsed.indirizzo,
                        comune:    parsed.comune,
                        cap:       parsed.cap,
                        provincia: parsed.provincia,
                        lat:       parsed.lat,
                        lng:       parsed.lng,
                      }))}
                      inputStyle={{ width: '100%', boxSizing: 'border-box' as const, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 10, marginBottom: 12 }}>
                    {([
                      { key: 'comune', label: 'Comune', placeholder: 'es. Roma' },
                      { key: 'cap',    label: 'CAP',    placeholder: '00100' },
                      { key: 'provincia', label: 'Prov.', placeholder: 'RM' },
                    ] as { key: keyof Sede; label: string; placeholder: string }[]).map(f => (
                      <div key={String(f.key)}>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, fontWeight: 600 }}>{f.label}</label>
                        <input value={(nuovaSede as any)[f.key] || ''} onChange={e => setNuovaSede(prev => ({ ...prev!, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', color: 'var(--t1)', fontSize: 13 }} />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {([
                      { key: 'telefono', label: 'Telefono', placeholder: '+39 06 …' },
                      { key: 'email',    label: 'Email',    placeholder: 'sede@azienda.it' },
                      { key: 'referente',label: 'Referente',placeholder: 'Nome cognome' },
                    ] as { key: keyof Sede; label: string; placeholder: string }[]).map(f => (
                      <div key={String(f.key)}>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, fontWeight: 600 }}>{f.label}</label>
                        <input value={(nuovaSede as any)[f.key] || ''} onChange={e => setNuovaSede(prev => ({ ...prev!, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                      </div>
                    ))}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, fontWeight: 600 }}>Stato</label>
                      <button onClick={() => setNuovaSede(prev => ({ ...prev!, attiva: !prev!.attiva }))}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t1)', justifyContent: 'center' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: nuovaSede.attiva !== false ? '#10b981' : '#6b7280' }} />
                        {nuovaSede.attiva !== false ? 'Attiva' : 'Inattiva'}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, fontWeight: 600 }}>Note</label>
                    <textarea value={nuovaSede.note || ''} onChange={e => setNuovaSede(prev => ({ ...prev!, note: e.target.value }))}
                      rows={2} placeholder="Note aggiuntive…"
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13, resize: 'vertical' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => setNuovaSede(null)}
                      style={{ padding: '9px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--t3)', fontSize: 13, cursor: 'pointer' }}>
                      Annulla
                    </button>
                    <button onClick={saveSede} disabled={salvandoSede}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 18px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {salvandoSede ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {salvandoSede ? 'Salvataggio…' : 'Salva sede'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* ── Configurazione Email ── */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: '0 0 4px' }}>📧 Configurazione Email</h3>
              <p style={{ fontSize: 12, color: 'var(--t3)', margin: '0 0 6px', lineHeight: 1.6 }}>
                Indirizzi email per area aziendale — usati come CC automatico nelle email inviate da SQ360.
              </p>
              <div style={{ padding: '10px 14px', background: '#fef3c720', border: '1px solid #fcd34d55', borderRadius: 8, fontSize: 11, color: '#92400e', marginBottom: 18 }}>
                ⚠️ Per inviare come mittente personalizzato, verifica il dominio su <strong>Resend → Domains</strong>. Fino ad allora le email partono da <code>noreply@sq360.app</code>.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([
                  { key: 'acquisti',        label: '🛒 Email Ufficio Acquisti',        value: emailAcquisti,        set: setEmailAcquisti,        placeholder: 'acquisti@azienda.it' },
                  { key: 'cantiere',        label: '🏗️ Email Ufficio Cantiere',        value: emailCantiere,        set: setEmailCantiere,        placeholder: 'cantiere@azienda.it' },
                  { key: 'amministrazione', label: '💼 Email Amministrazione',         value: emailAmministrazione, set: setEmailAmministrazione, placeholder: 'amministrazione@azienda.it' },
                ] as { key: string; label: string; value: string; set: (v: string) => void; placeholder: string }[]).map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
                    <input type="email" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                {emailSaved && <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> Salvato</span>}
                <button onClick={saveEmailConfig}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Save size={14} /> Salva email
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB UTENTI ── */}
        {tab === 'utenti' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--t3)' }}>
                {utenti.filter(u => u.attivo).length} utenti attivi su {utenti.length} totali
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={14} /> Invita utente
              </button>
            </div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Utente', 'Email', 'Ruolo', 'Commesse', 'Ultimo accesso', 'Stato', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {utenti.map(u => {
                    const rm = RUOLO_META[u.ruolo]
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', opacity: u.attivo ? 1 : 0.5 }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${rm.color}20`, border: `1px solid ${rm.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: rm.color }}>
                              {u.nome[0]}{u.cognome[0]}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{u.nome} {u.cognome}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t3)' }}>{u.email}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, background: `${rm.color}15`, color: rm.color, border: `1px solid ${rm.color}40`, borderRadius: 6, padding: '3px 9px', fontWeight: 600 }}>{rm.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)' }}>
                          {u.commesse_assegnate.length === 0 ? 'Tutte' : u.commesse_assegnate.join(', ')}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{u.ultimo_accesso}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            onClick={() => toggleAttivo(u.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: u.attivo ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.attivo ? '#10b981' : '#ef4444' }}
                          >
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                            {u.attivo ? 'Attivo' : 'Disabilitato'}
                          </button>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--t3)' }}>
                            <Edit2 size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB RUOLI ── */}
        {tab === 'ruoli' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {(Object.entries(RUOLO_META) as [Ruolo, typeof RUOLO_META[Ruolo]][]).map(([ruolo, meta]) => (
              <div key={ruolo} style={{ background: 'var(--panel)', border: `1px solid ${meta.color}30`, borderLeft: `3px solid ${meta.color}`, borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 8px' }}>
                    {utenti.filter(u => u.ruolo === ruolo).length} utenti
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--t3)', margin: '0 0 12px', lineHeight: 1.5 }}>{meta.descrizione}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {meta.permessi.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--t2)' }}>
                      <CheckCircle size={11} color={meta.color} />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB NOTIFICHE ── */}
        {tab === 'notifiche' && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: '0 0 20px' }}>Configurazione notifiche email</h3>
              {[
                { label: 'DURC in scadenza (15 giorni prima)', key: 'n1', default: true },
                { label: 'SOA in scadenza (30 giorni prima)', key: 'n2', default: true },
                { label: 'Patente crediti aggiornata', key: 'n3', default: true },
                { label: 'SAL passivo in attesa approvazione', key: 'n4', default: true },
                { label: 'SAM in attesa risposta DL (> 5 giorni)', key: 'n5', default: true },
                { label: 'Fattura scaduta senza pagamento', key: 'n6', default: true },
                { label: 'Margine sotto soglia alert (configurabile %)', key: 'n7', default: false },
                { label: 'Task pianificazione in ritardo', key: 'n8', default: false },
                { label: 'Nuovo documento caricato in commessa', key: 'n9', default: false },
              ].map(n => (
                <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>{n.label}</span>
                  <button style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
                    background: n.default ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s'
                  }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: n.default ? 23 : 3, transition: 'left 0.2s' }} />
                  </button>
                </div>
              ))}
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Save size={14} /> Salva preferenze
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
