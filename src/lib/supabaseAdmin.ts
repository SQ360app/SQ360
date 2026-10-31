// ─── Client Supabase con service role (SOLO server) ──────────────────────────
// Salta le RLS: va usato solo in route che hanno già verificato chi chiama
// (token di sessione) o un token pubblico legato a UNA riga (es. /offerta, /scan),
// e che leggono/scrivono esclusivamente le righe collegate a quel token.
// Va creato dentro l'handler (mai a livello modulo: build Vercel).

import { createClient } from '@supabase/supabase-js'

export function getAdminClient(): any | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Token pubblici (offerta, badge QR): sempre UUID generati con crypto.randomUUID(). */
export const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
