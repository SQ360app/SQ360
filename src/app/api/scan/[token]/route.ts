// ─── Badge QR di cantiere (pubblico, senza login) ────────────────────────────
// /scan/<qr_token>: con la service role si usa SOLO il lavoratore attivo con quel
// qr_token, la sua commessa e le SUE presenze di oggi.
//   GET  → stato documenti del lavoratore, commessa, presenza di oggi
//   POST { azione: 'entrata' | 'uscita' } → registra la presenza
// Data e ora sono del server (fuso Europe/Rome), non del telefono.

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, TOKEN_RE } from '@/lib/supabaseAdmin'

const errore = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status })
type Ctx = { params: Promise<{ token: string }> }

function adessoRoma() {
  const parti = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const p = (t: string) => parti.find(x => x.type === t)?.value ?? '00'
  return { data: `${p('year')}-${p('month')}-${p('day')}`, ora: `${p('hour')}:${p('minute')}` }
}

async function caricaLavoratore(db: any, token: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await db.from('lavoratori_commessa')
    .select('id,commessa_id,nome,cognome,tipo_rapporto,azienda_appartenenza,mansione,durc_scadenza,formazione_scadenza,patente_crediti_punti')
    .eq('qr_token', token).eq('attivo', true).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function presenzaOggi(db: any, lavoratoreId: string, data: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: pres } = await db.from('presenze_cantiere').select('id,ora_entrata,ora_uscita')
    .eq('lavoratore_id', lavoratoreId).eq('data', data).order('created_at', { ascending: false }).limit(1)
  return pres?.[0] || null
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params
  if (!TOKEN_RE.test(token)) return errore(404, 'Badge non valido')
  const db = getAdminClient()
  if (!db) return errore(500, 'Configurazione server incompleta')
  try {
    const lav = await caricaLavoratore(db, token)
    if (!lav) return errore(404, 'Badge non valido o lavoratore non attivo')
    const { data: com } = await db.from('commesse').select('codice,nome,committente').eq('id', lav.commessa_id).maybeSingle()
    const pres = await presenzaOggi(db, lav.id, adessoRoma().data)
    const { id: _id, commessa_id: _c, ...lavoratore } = lav
    return NextResponse.json({
      ok: true, lavoratore, commessa: com || null,
      presenzaOggi: pres ? { ora_entrata: pres.ora_entrata, ora_uscita: pres.ora_uscita } : null,
    })
  } catch (e) {
    return errore(500, e instanceof Error ? e.message : 'Errore')
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params
  if (!TOKEN_RE.test(token)) return errore(404, 'Badge non valido')
  const db = getAdminClient()
  if (!db) return errore(500, 'Configurazione server incompleta')
  let azione: unknown
  try { azione = (await req.json())?.azione } catch { return errore(400, 'Richiesta non valida') }
  if (azione !== 'entrata' && azione !== 'uscita') return errore(400, 'Azione non valida')

  try {
    const lav = await caricaLavoratore(db, token)
    if (!lav) return errore(404, 'Badge non valido o lavoratore non attivo')
    const { data, ora } = adessoRoma()
    const pres = await presenzaOggi(db, lav.id, data)

    if (azione === 'entrata') {
      const { error } = await db.from('presenze_cantiere').insert({
        lavoratore_id: lav.id, commessa_id: lav.commessa_id, data, ora_entrata: ora, tipo: 'qr_scan',
      })
      if (error) return errore(500, `Errore registrazione: ${error.message}`)
      return NextResponse.json({ ok: true, presenzaOggi: { ora_entrata: ora, ora_uscita: null } })
    }

    if (pres) {
      const { error } = await db.from('presenze_cantiere').update({ ora_uscita: ora, tipo: 'qr_scan' })
        .eq('id', pres.id).eq('lavoratore_id', lav.id)
      if (error) return errore(500, `Errore registrazione: ${error.message}`)
      return NextResponse.json({ ok: true, presenzaOggi: { ora_entrata: pres.ora_entrata, ora_uscita: ora } })
    }
    const { error } = await db.from('presenze_cantiere').insert({
      lavoratore_id: lav.id, commessa_id: lav.commessa_id, data, ora_uscita: ora, tipo: 'qr_scan',
    })
    if (error) return errore(500, `Errore registrazione: ${error.message}`)
    return NextResponse.json({ ok: true, presenzaOggi: { ora_entrata: null, ora_uscita: ora } })
  } catch (e) {
    return errore(500, e instanceof Error ? e.message : 'Errore')
  }
}
