// ─── Invito utente (server) ──────────────────────────────────────────────────
// Chiamata da Impostazioni → Utenti con `Authorization: Bearer <access_token>`.
//
// Sicurezza:
//   - chi chiama viene identificato dal token (getUserClient) → 401 se manca/scaduto;
//   - deve avere una riga in `utenti` ed essere ADMIN → 403 altrimenti;
//   - l'azienda dell'invitato è SEMPRE quella del chiamante (mai dal body):
//     un azienda_id diverso nel body → 403.
// La service role serve solo per inviteUserByEmail e per scrivere la riga in
// `utenti` del nuovo utente (che non ha ancora una sessione).
//
// Il link dell'email porta a <dominio della richiesta>/auth/conferma, dove
// l'invitato sceglie la password. Il dominio va aggiunto in Supabase →
// Authentication → URL Configuration → Redirect URLs.
//
// Richiede SUPABASE_SERVICE_ROLE_KEY (Vercel → Environment Variables).

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getUserClient } from '@/lib/supabaseServer'

const RUOLI = ['admin', 'direttore_tecnico', 'responsabile_commessa', 'operatore', 'contabilita', 'viewer']
const errore = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status })

export async function POST(req: NextRequest) {
  // ── Chi chiama ────────────────────────────────────────────────────────────
  const auth = await getUserClient(req)
  if (auth.response) return auth.response

  const { data: chiamante, error: errC } = await auth.db
    .from('utenti').select('azienda_id, ruolo').eq('id', auth.userId).maybeSingle()
  if (errC) return errore(500, `Errore verifica utente: ${errC.message}`)
  if (!chiamante?.azienda_id) return errore(403, 'Il tuo utente non è collegato a nessuna azienda')
  if (chiamante.ruolo !== 'admin') return errore(403, 'Solo un amministratore può invitare nuovi utenti')
  const aziendaId: string = chiamante.azienda_id

  // ── Dati invito ───────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return errore(400, 'Richiesta non valida') }
  if (body.azienda_id && body.azienda_id !== aziendaId) {
    return errore(403, 'Non puoi invitare utenti in un\'altra azienda')
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errore(400, 'Email non valida')
  const ruolo = typeof body.ruolo === 'string' && RUOLI.includes(body.ruolo) ? body.ruolo : 'operatore'
  const m = body.moduli_abilitati
  const moduli: Record<string, boolean> = {}
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      if (/^[a-z_]{1,40}$/.test(k)) moduli[k] = v === true
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return errore(500, 'SUPABASE_SERVICE_ROLE_KEY non configurata')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── Invito ────────────────────────────────────────────────────────────────
  const redirectTo = `${req.nextUrl.origin}/auth/conferma`
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { azienda_id: aziendaId, ruolo },
  })
  if (error) {
    const giaRegistrato = /already been registered|already registered|exists/i.test(error.message)
    return errore(400, giaRegistrato ? 'Esiste già un utente con questa email' : error.message)
  }
  const nuovoId: string | undefined = data?.user?.id
  if (!nuovoId) return errore(500, 'Invito non riuscito: utente non creato')

  const { error: errUp } = await admin.from('utenti').upsert({
    id: nuovoId,
    email,
    azienda_id: aziendaId,
    ruolo,
    nome: '',
    cognome: '',
    attivo: true,
    moduli_abilitati: moduli,
  }, { onConflict: 'id' })
  if (errUp) {
    // Senza la riga in `utenti` l'invitato entrerebbe senza azienda: si annulla
    // l'utente appena creato (solo quello di QUESTA richiesta) e si segnala l'errore.
    await admin.auth.admin.deleteUser(nuovoId).catch(() => {})
    return errore(500, `Invito annullato: errore nel collegamento all'azienda (${errUp.message})`)
  }

  return NextResponse.json({ ok: true })
}
