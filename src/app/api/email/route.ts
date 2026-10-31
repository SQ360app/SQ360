// ─── Invio email dall'app (utente collegato) ─────────────────────────────────
// Sicurezza:
//   - richiede `Authorization: Bearer <access_token>` (getUserClient) → 401;
//   - mittente FISSO (MITTENTE), mai dal client; reply-to = email di chi invia;
//   - niente HTML libero: il client sceglie un TIPO e passa dati, l'HTML lo
//     genera il server dai modelli in src/lib/emailTemplates.ts (testi escapati).
//
// Tipi:
//   oda_creato | dam_approvato | durc_report → destinatario = l'utente stesso
//   rdo_invito  → { rdo_id, to[], cc?[], oggetto?, messaggio? }: la RDO viene letta
//                 con i permessi dell'utente (RLS); destinatari scelti dall'utente
//                 (solo email valide, max 10 + 10 in copia).
// L'email di notifica del portale /offerta NON passa da qui: la invia
// /api/offerta/[token] lato server.

import { NextRequest, NextResponse } from 'next/server'
import { getUserClient } from '@/lib/supabaseServer'
import { destinatari, inviaEmail } from '@/lib/emailServer'
import { emailDamApprovato, emailDurcReport, emailOdaCreato, emailRdoInvito, escHtml } from '@/lib/emailTemplates'

const errore = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status })
const t = (v: unknown, max = 300) => escHtml(String(v ?? '').slice(0, max))

export async function POST(req: NextRequest) {
  const auth = await getUserClient(req)
  if (auth.response) return auth.response
  const mia = auth.email
  if (!mia) return errore(403, 'Utente senza email')

  let body: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = await req.json() } catch { return errore(400, 'Richiesta non valida') }
  const d = (body.dati ?? {}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  let to: string[] = [mia]
  let cc: string[] = []
  let mail: { subject: string; html: string }

  switch (body.tipo) {
    case 'oda_creato':
      mail = emailOdaCreato({ codiceOda: t(d.codiceOda, 60), oggetto: t(d.oggetto), fornitore: t(d.fornitore), importo: t(d.importo, 40), commessa: t(d.commessa) })
      break
    case 'dam_approvato':
      mail = emailDamApprovato({ materiale: t(d.materiale), codice: t(d.codice, 60), commessa: t(d.commessa), dlNome: d.dlNome ? t(d.dlNome) : undefined })
      break
    case 'durc_report': {
      const righe = Array.isArray(d.scadenze) ? d.scadenze.slice(0, 200) : []
      if (!righe.length) return errore(400, 'Nessuna scadenza da inviare')
      mail = emailDurcReport(righe.map((s: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        fornitore: t(s.fornitore), dataScadenza: t(s.dataScadenza, 20), commessa: t(s.commessa),
        giorniRimanenti: Number.isFinite(Number(s.giorniRimanenti)) ? Math.trunc(Number(s.giorniRimanenti)) : 0,
      })))
      break
    }
    case 'rdo_invito': {
      const toList = destinatari(body.to)
      const ccList = destinatari(body.cc ?? [])
      if (!toList?.length) return errore(400, 'Destinatari non validi (email separate da virgola, massimo 10)')
      if (!ccList) return errore(400, 'Indirizzi in copia non validi (massimo 10)')
      // Lettura con i permessi dell'utente: una RDO di un'altra azienda non si vede
      const { data: rdo, error: errR } = await auth.db.from('rdo')
        .select('id,codice,oggetto,fornitore,data_scadenza,note,token_offerta').eq('id', String(body.rdo_id || '')).maybeSingle()
      if (errR) return errore(500, `Errore lettura RDO: ${errR.message}`)
      if (!rdo) return errore(404, 'RDO non trovata')
      const base = emailRdoInvito({
        fornitore: rdo.fornitore, codice: rdo.codice, oggetto: rdo.oggetto,
        dataScadenza: rdo.data_scadenza, note: rdo.note,
        portalUrl: rdo.token_offerta ? `${req.nextUrl.origin}/offerta/${rdo.token_offerta}` : null,
        messaggio: typeof body.messaggio === 'string' ? body.messaggio.slice(0, 2000) : null,
      })
      const oggetto = typeof body.oggetto === 'string' && body.oggetto.trim() ? body.oggetto.trim().slice(0, 200) : base.subject
      mail = { subject: oggetto, html: base.html }
      to = toList; cc = ccList
      break
    }
    default:
      return errore(400, 'Tipo di email non supportato')
  }

  const esito = await inviaEmail({ to, cc, subject: mail.subject, html: mail.html, replyTo: mia })
  if (!esito.ok) return errore(502, `Invio non riuscito: ${esito.error}`)
  return NextResponse.json({ ok: true, id: esito.id, mittente: 'SQ360 <noreply@sq360.app>', to, cc, subject: mail.subject, html: mail.html })
}
