'use client'

import { useState } from 'react'

import { Building2, Users, Bell, Shield, Key, Plus, Trash2, Save, CheckCircle, Edit2 } from 'lucide-react'

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
    permessi: ['Commesse assegnate', 'DAM', 'SAL passivi', 'Pianificazione', 'Cantiere', 'Fornitori']
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
  sede: string
  pec: string
  email: string
  tel: string
  rea: string
  soa_categorie: string
  patente_crediti: string
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ImpostazioniPage() {
  const [tab, setTab] = useState<'azienda' | 'utenti' | 'ruoli' | 'notifiche'>('azienda')
  const [utenti, setUtenti] = useState<Utente[]>(UTENTI_INIT)
  const [savedOk, setSavedOk] = useState(false)
  const [azienda, setAzienda] = useState<AziendaInfo>({
    ragione_sociale: 'Costruzioni Generali Bianchi Srl',
    piva: '12345678901',
    cf: '12345678901',
    sede: 'Via Roma 1, 20100 Milano MI',
    pec: 'costruzioni.bianchi@pec.it',
    email: 'info@costruzionibianchi.it',
    tel: '+39 02 1234567',
    rea: 'MI-1234567',
    soa_categorie: 'OG1 classifica IV, OG11 classifica III',
    patente_crediti: '100'
  })

  function saveAzienda() {
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 3000)
  }

  function toggleAttivo(uid: string) {
    setUtenti(prev => prev.map(u => u.id === uid ? { ...u, attivo: !u.attivo } : u))
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
          <div style={{ maxWidth: 700 }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20, margin: '0 0 20px' }}>Dati aziendali</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {([
                  { key: 'ragione_sociale', label: 'Ragione Sociale', full: true },
                  { key: 'piva', label: 'Partita IVA' },
                  { key: 'cf', label: 'Codice Fiscale' },
                  { key: 'rea', label: 'Numero REA' },
                  { key: 'sede', label: 'Sede Legale', full: true },
                  { key: 'pec', label: 'PEC' },
                  { key: 'email', label: 'Email' },
                  { key: 'tel', label: 'Telefono' },
                  { key: 'soa_categorie', label: 'Categorie SOA', full: true },
                  { key: 'patente_crediti', label: 'Punteggio Patente Crediti' },
                ] as { key: keyof AziendaInfo; label: string; full?: boolean }[]).map(f => (
                  <div key={f.key} style={{ gridColumn: f.full ? 'span 2' : undefined }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
                    <input
                      value={azienda[f.key]}
                      onChange={e => setAzienda(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--t1)', fontSize: 13 }}
                    />
                  </div>
                ))}
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
                { label: 'DAM in attesa risposta DL (> 5 giorni)', key: 'n5', default: true },
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
