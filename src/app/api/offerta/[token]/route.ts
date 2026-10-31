// ─── Portale offerta fornitore (pubblico, senza login) ───────────────────────
// Il fornitore apre /offerta/<token>. Questa route, con la service role, usa
// SOLO la RDO che ha quel token_offerta e i dati collegati a quella RDO:
//   GET  → dati necessari alla pagina (RDO, commessa, voci della RDA collegata)
//   POST → salva l'offerta sulla stessa RDO e avvisa gli admin dell'azienda
// Nessun altro dato viene letto o restituito. Importi ricalcolati dal server
// con le quantità del DB (il client manda solo i prezzi unitari).

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, TOKEN_RE } from '@/lib/supabaseAdmin'
import { inviaEmail } from '@/lib/emailServer'
import { emailOffertaRicevuta } from '@/lib/emailTemplates'

const errore = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status })
type Ctx = { params: Promise<{ token: string }> }

const CAMPI_RDO = 'id,codice,oggetto,fornitore,data_scadenza,note,stato_offerta,rda_id,commessa_id,azienda_id,note_tecniche,specifiche,condizioni_particolari'

async function caricaRdo(db: any, token: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await db.from('rdo').select(CAMPI_RDO).eq('token_offerta', token).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Voci della RDA collegata, limitate alle voci del computo della STESSA commessa della RDO. */
async function caricaVoci(db: any, rdo: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!rdo.rda_id || !rdo.commessa_id) return []
  const { data: rda } = await db.from('rda').select('voci_ids,commessa_id').eq('id', rdo.rda_id).maybeSingle()
  const ids: string[] = Array.isArray(rda?.voci_ids) ? rda.voci_ids.filter((x: unknown) => typeof x === 'string' && TOKEN_RE.test(x)) : []
  if (!rda || rda.commessa_id !== rdo.commessa_id || !ids.length) return []
  const { data: computi } = await db.from('computo_metrico').select('id').eq('commessa_id', rdo.commessa_id)
  const computoIds = (computi || []).map((c: { id: string }) => c.id)
  if (!computoIds.length) return []
  const { data: voci } = await db.from('voci_computo').select('id,codice,descrizione,um,quantita')
    .in('id', ids.slice(0, 500)).in('computo_id', computoIds)
  return (voci || []) as Array<{ id: string; codice: string; descrizione: string; um: string; quantita: number }>
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params
  if (!TOKEN_RE.test(token)) return errore(404, 'Link non valido.')
  const db = getAdminClient()
  if (!db) return errore(500, 'Configurazione server incompleta')
  try {
    const rdo = await caricaRdo(db, token)
    if (!rdo) return errore(404, 'Link non valido o offerta già inviata.')
    let commessa = null
    if (rdo.commessa_id) {
      const { data } = await db.from('commesse').select('codice,nome,committente').eq('id', rdo.commessa_id).maybeSingle()
      commessa = data || null
    }
    if (rdo.stato_offerta === 'ricevuta') return NextResponse.json({ ok: true, inviata: true, commessa })
    const voci = await caricaVoci(db, rdo)
    const { id, codice, oggetto, fornitore, data_scadenza, note, note_tecniche, specifiche, condizioni_particolari } = rdo
    return NextResponse.json({
      ok: true, inviata: false, commessa, voci,
      rdo: { id, codice, oggetto, fornitore, data_scadenza, note, note_tecniche, specifiche, condizioni_particolari },
    })
  } catch (e) {
    return errore(500, e instanceof Error ? e.message : 'Errore')
  }
}

const num = (v: unknown, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}
const scelta = <T extends string>(v: unknown, ammessi: readonly T[], def: T): T =>
  (ammessi as readonly string[]).includes(String(v)) ? (v as T) : def
const testo = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '')

export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params
  if (!TOKEN_RE.test(token)) return errore(404, 'Link non valido.')
  const db = getAdminClient()
  if (!db) return errore(500, 'Configurazione server incompleta')

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return errore(400, 'Richiesta non valida') }

  try {
    const rdo = await caricaRdo(db, token)
    if (!rdo) return errore(404, 'Link non valido.')
    if (rdo.stato_offerta === 'ricevuta') return errore(409, 'Offerta già inviata.')

    // Importi ricalcolati con le quantità del DB; dal client solo i prezzi unitari
    const voci = await caricaVoci(db, rdo)
    const prezzi = (b.prezzi && typeof b.prezzi === 'object') ? b.prezzi as Record<string, unknown> : {}
    const offertaVoci = voci.map(v => {
      const pu = num(prezzi[v.id], 0, 1e9)
      return { voce_id: v.id, codice: v.codice, descrizione: v.descrizione, um: v.um, quantita: v.quantita, prezzo_unitario: pu, importo: Math.round(pu * (v.quantita || 0) * 100) / 100 }
    })
    const trasporto = num(b.trasporto_importo, 0, 1e9)
    const imballo = num(b.imballo, 0, 1e9)
    const totale = Math.round((offertaVoci.reduce((s, v) => s + v.importo, 0) + trasporto + imballo) * 100) / 100
    if (totale <= 0) return errore(400, 'Compila almeno un prezzo')

    const note = testo(b.note_offerta)
    const oss = testo(b.osservazioni)
    const { data: agg, error } = await db.from('rdo').update({
      stato_offerta: 'ricevuta',
      data_risposta: new Date().toISOString(),
      importo_offerta: totale,
      offerta_voci: offertaVoci,
      trasporto_importo: trasporto,
      trasporto_tipo: scelta(b.trasporto_tipo, ['incluso', 'escluso', 'cliente'] as const, 'incluso'),
      pagamento_giorni: Number(scelta(String(b.pagamento_giorni), ['30', '60', '90', '120'] as const, '30')),
      anticipo_pct: num(b.anticipo_pct, 0, 100),
      sconto_anticipato_pct: num(b.sconto_anticipato_pct, 0, 100),
      forma_pagamento: scelta(b.forma_pagamento, ['bonifico', 'riba', 'assegno', 'contanti'] as const, 'bonifico'),
      disponibilita: testo(b.disponibilita, 300),
      validita_giorni: Math.trunc(num(b.validita_giorni, 1, 365)),
      luogo_consegna: scelta(b.luogo_consegna, ['franco_cantiere', 'franco_magazzino', 'concordare'] as const, 'franco_cantiere'),
      note_offerta: note + (oss ? '\n\nOsservazioni tecniche:\n' + oss : ''),
      stato: 'risposta_ricevuta',
    }).eq('id', rdo.id).eq('token_offerta', token)
      .or('stato_offerta.is.null,stato_offerta.neq.ricevuta')
      .select('id')
    if (error) return errore(500, `Errore salvataggio offerta: ${error.message}`)
    if (!agg?.length) return errore(409, 'Offerta già inviata.')

    // Notifica: destinatari decisi dal server (admin attivi dell'azienda della RDO)
    let aziendaId = rdo.azienda_id
    if (!aziendaId && rdo.commessa_id) {
      const { data: c } = await db.from('commesse').select('azienda_id').eq('id', rdo.commessa_id).maybeSingle()
      aziendaId = c?.azienda_id
    }
    if (aziendaId) {
      const { data: admin } = await db.from('utenti').select('email,attivo').eq('azienda_id', aziendaId).eq('ruolo', 'admin').limit(5)
      const to = (admin || []).filter((u: any) => u.email && u.attivo !== false).map((u: any) => u.email) // eslint-disable-line @typescript-eslint/no-explicit-any
      if (to.length) {
        const mail = emailOffertaRicevuta({
          codiceRdo: rdo.codice, fornitore: rdo.fornitore,
          importo: totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        })
        await inviaEmail({ to, subject: mail.subject, html: mail.html }).catch(() => null)
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errore(500, e instanceof Error ? e.message : 'Errore')
  }
}
