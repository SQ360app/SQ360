// ─── Invio email lato server (Resend) ────────────────────────────────────────
// Unico punto di invio: mittente FISSO, mai scelto dal client.
// Da usare solo nelle route API (richiede RESEND_API_KEY, server-side).

import { Resend } from 'resend'

export const MITTENTE = 'SQ360 <noreply@sq360.app>'
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

export const emailValida = (e: unknown): e is string => typeof e === 'string' && EMAIL_RE.test(e.trim())

/** Normalizza un elenco di destinatari: solo email valide, senza doppioni, al massimo `max`. */
export function destinatari(v: unknown, max = 10): string[] | null {
  const arr = (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x).trim().toLowerCase())
  if (arr.some(e => !emailValida(e))) return null
  const unici = [...new Set(arr)]
  return unici.length <= max ? unici : null
}

export async function inviaEmail(p: {
  to: string[]
  cc?: string[]
  subject: string
  html: string
  replyTo?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY non configurata' }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: MITTENTE,
    to: p.to,
    subject: p.subject.slice(0, 250),
    html: p.html,
    ...(p.cc?.length ? { cc: p.cc } : {}),
    ...(p.replyTo ? { reply_to: p.replyTo } : {}),
  } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  if (error) return { ok: false, error: (error as any).message || String(error) } // eslint-disable-line @typescript-eslint/no-explicit-any
  return { ok: true, id: data?.id }
}
