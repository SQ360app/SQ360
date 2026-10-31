// ─── fetch verso route API protette (lato client) ────────────────────────────
// Aggiunge `Authorization: Bearer <access_token>` della sessione corrente.
// Le route /api/email, /api/ai-*, /api/docx-text, /api/rdo-extract-offerta,
// /api/xpwe-parse, /api/invite-user rispondono 401 senza token.

import { supabase } from '@/lib/supabase'

export async function fetchConToken(url: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(url, { ...init, headers })
}
