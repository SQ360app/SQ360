import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ─── Client Supabase server-side con il token dell'utente collegato ──────────
// Le route API NON devono usare il client anon senza sessione (per il DB l'utente
// è anonimo) né la service role (salta le RLS). Il chiamante invia
// `Authorization: Bearer <access_token>`; il client creato qui esegue ogni query
// come quell'utente, quindi le RLS si applicano esattamente come nel browser.
// Il client va creato dentro l'handler (mai a livello modulo: build Vercel).

// Uso: `const auth = await getUserClient(req); if (auth.response) return auth.response`
// (tipo piatto: il progetto non ha strictNullChecks, l'unione discriminata non si restringe)
interface Esito {
  db: any // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string | null
  email: string | null
  response: NextResponse | null // valorizzato solo in caso di 401
}

const nonAutorizzato = (error: string): Esito => ({
  db: null,
  userId: null,
  email: null,
  response: NextResponse.json({ ok: false, error }, { status: 401 }),
})

export async function getUserClient(req: NextRequest): Promise<Esito> {
  const header = req.headers.get('authorization') || ''
  const token = /^Bearer\s+(\S+)$/i.exec(header.trim())?.[1]
  if (!token) {
    return nonAutorizzato('Sessione mancante: effettua di nuovo il login e riprova.')
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  )

  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) {
    return nonAutorizzato('Sessione scaduta o non valida: effettua di nuovo il login e riprova.')
  }
  return { db, userId: data.user.id, email: data.user.email ?? null, response: null }
}
