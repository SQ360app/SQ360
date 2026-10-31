// ─── Scritture verificate su Supabase ────────────────────────────────────────
// Problema: `await supabase.from(t).insert(...)` NON lancia eccezioni. Se la
// scrittura fallisce (colonna inesistente, campo obbligatorio, permessi RLS…)
// l'errore resta nel risultato e, se non lo si legge, la pagina mostra "salvato".
// Con le RLS, inoltre, un update/delete non permesso NON dà errore: tocca 0 righe.
//
// Uso: si passa la query con .select('id') in coda, così si sa quante righe
// sono state davvero scritte.
//   const r = await scritturaVerificata(supabase.from('ddt').insert(payload).select('id'))
//   if (!r.ok) { showToast('⚠ DDT non salvato: ' + r.errore); return }
//   const nuovoId = r.righe[0].id

export interface EsitoScrittura<T = { id: string }> {
  ok: boolean
  righe: T[]
  /** messaggio leggibile, presente se !ok */
  errore?: string
}

interface ErrorePostgrest { code?: string; message?: string; details?: string | null; hint?: string | null }

/** Traduce gli errori PostgREST/Postgres più comuni in italiano. */
export function messaggioErroreDb(e: ErrorePostgrest | null | undefined): string {
  if (!e) return 'errore sconosciuto'
  const msg = e.message || ''
  const colonna = /column "?([a-z0-9_]+)"?/i.exec(msg)?.[1] ?? /'([a-z0-9_]+)' column/i.exec(msg)?.[1]
  switch (e.code) {
    case 'PGRST204':
    case '42703':
      return `il database non ha il campo "${colonna ?? '?'}" (va aggiornato lo schema)`
    case '23502':
      return `manca un campo obbligatorio${colonna ? ` ("${colonna}")` : ''}`
    case '23505':
      return 'esiste già un elemento con lo stesso codice'
    case '23503':
      return 'collegamento non valido (elemento collegato inesistente o eliminato)'
    case '22P02':
    case '23514':
      return `valore non valido${msg ? ': ' + msg.slice(0, 120) : ''}`
    case '42501':
      return 'permessi insufficienti per questa operazione'
    default:
      if (/row-level security/i.test(msg)) return 'permessi insufficienti per questa operazione'
      return msg.slice(0, 200) || 'errore del database'
  }
}

/**
 * Esegue una scrittura (insert/update/upsert/delete con `.select(...)` in coda)
 * e verifica errore e righe toccate. `minimoRighe` = righe attese (default 1).
 */
export async function scritturaVerificata<T = { id: string }>(
  query: PromiseLike<{ data: T[] | T | null; error: ErrorePostgrest | null }>,
  minimoRighe = 1,
): Promise<EsitoScrittura<T>> {
  let risultato: { data: T[] | T | null; error: ErrorePostgrest | null }
  try {
    risultato = await query
  } catch (e) {
    return { ok: false, righe: [], errore: e instanceof Error ? e.message : 'errore di rete' }
  }
  if (risultato.error) return { ok: false, righe: [], errore: messaggioErroreDb(risultato.error) }
  const righe = Array.isArray(risultato.data) ? risultato.data : risultato.data ? [risultato.data] : []
  if (righe.length < minimoRighe) {
    return { ok: false, righe, errore: 'nessuna riga salvata (permessi insufficienti o elemento non trovato)' }
  }
  return { ok: true, righe }
}
