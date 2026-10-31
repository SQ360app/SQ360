// ─── Registrazione nuova azienda (server) ────────────────────────────────────
// Chiamata da /register DOPO supabase.auth.signUp(). Crea:
//   1. azienda   (tabella collegata a utenti: ragione_sociale, partita_iva, codice_fiscale)
//   2. aziende   (stessa id: serve alle FK di wbs_templates / azienda_sedi)
//   3. utenti    (ruolo admin)
// Usa la service role (le tabelle azienda/aziende non hanno regole INSERT e NON
// vanno aperte): per questo la route valida tutto prima di scrivere.
//
// Controlli anti-abuso:
//   - l'utente Auth deve esistere, avere la stessa email e essere stato creato
//     da meno di 24 ore;
//   - non deve essere già collegato a un'azienda (nessuna riga in utenti);
//   - la P.IVA non deve essere già registrata.
// Se un passo fallisce, le righe create in QUESTA richiesta vengono rimosse:
// lo stato torna pulito e il pulsante "Riprova" può ripetere la chiamata.
//
// Richiede SUPABASE_SERVICE_ROLE_KEY (Vercel → Environment Variables).

import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ETA_MS = 24 * 60 * 60 * 1000

const errore = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status })
const testo = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return errore(400, 'Richiesta non valida') }

  const userId   = testo(body.user_id)
  const email    = testo(body.email).toLowerCase()
  const az       = (body.azienda ?? {}) as Record<string, unknown>
  const ad       = (body.admin ?? {}) as Record<string, unknown>
  const ragione  = testo(az.ragione_sociale)
  const piva     = testo(az.piva).replace(/\s/g, '')
  const cf       = testo(az.cf).replace(/\s/g, '').toUpperCase()
  const nome     = testo(ad.nome)
  const cognome  = testo(ad.cognome)

  // ── Validazione dati ──────────────────────────────────────────────────────
  if (!UUID_RE.test(userId))                         return errore(400, 'Utente non valido')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))     return errore(400, 'Email non valida')
  if (ragione.length < 2 || ragione.length > 200)    return errore(400, 'Nome azienda non valido')
  if (!/^\d{11}$/.test(piva))                        return errore(400, 'Partita IVA non valida (11 cifre)')
  if (cf && !/^([A-Z0-9]{16}|\d{11})$/.test(cf))     return errore(400, 'Codice fiscale non valido')
  if (!nome || nome.length > 100)                    return errore(400, 'Nome non valido')
  if (!cognome || cognome.length > 100)              return errore(400, 'Cognome non valido')

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return errore(500, 'Configurazione server incompleta (SUPABASE_SERVICE_ROLE_KEY)')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── Verifica utente Auth ──────────────────────────────────────────────────
  const { data: authUser, error: errAuth } = await db.auth.admin.getUserById(userId)
  const u = authUser?.user
  if (errAuth || !u) return errore(400, 'Utente non trovato: ripeti la registrazione')
  if ((u.email || '').toLowerCase() !== email) return errore(400, 'Email non corrispondente all\'utente')
  if (Date.now() - new Date(u.created_at).getTime() > MAX_ETA_MS) {
    return errore(400, 'Registrazione scaduta: contatta il supporto')
  }

  const { data: giaUtente, error: errU } = await db.from('utenti').select('id').eq('id', userId).maybeSingle()
  if (errU) return errore(500, `Errore verifica utente: ${errU.message}`)
  if (giaUtente) return errore(409, 'Questo utente è già collegato a un\'azienda: accedi dal login')

  const { data: giaPiva, error: errP } = await db.from('azienda').select('id').eq('partita_iva', piva).limit(1)
  if (errP) return errore(500, `Errore verifica Partita IVA: ${errP.message}`)
  if (giaPiva?.length) return errore(409, 'Esiste già un\'azienda registrata con questa Partita IVA')

  // ── Scritture (con annullamento delle righe create in questa richiesta) ────
  const aziendaId = randomUUID()
  const create: Array<'azienda' | 'aziende'> = []
  const annulla = async () => {
    for (const t of create.reverse()) await db.from(t).delete().eq('id', aziendaId)
  }

  const { error: e1 } = await db.from('azienda').insert({
    id: aziendaId, ragione_sociale: ragione, partita_iva: piva, codice_fiscale: cf || null, email,
  })
  if (e1) return errore(500, `Errore creazione azienda: ${e1.message}`)
  create.push('azienda')

  const { error: e2 } = await db.from('aziende').insert({
    id: aziendaId, ragione_sociale: ragione, piva, cf: cf || null, email,
  })
  if (e2) { await annulla(); return errore(500, `Errore creazione azienda (anagrafica documenti): ${e2.message}`) }
  create.push('aziende')

  const { error: e3 } = await db.from('utenti').insert({
    id: userId, azienda_id: aziendaId, email, nome, cognome,
    ruolo: 'admin', attivo: true, moduli_abilitati: {},
  })
  if (e3) { await annulla(); return errore(500, `Errore collegamento utente: ${e3.message}`) }

  return NextResponse.json({ ok: true, azienda_id: aziendaId })
}
