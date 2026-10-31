// ─── Gemini (Google AI) — unico punto di configurazione e chiamata ───────────
// Modello: variabile d'ambiente GEMINI_MODEL, predefinito MODELLO_GEMINI_PREDEFINITO.
// Riserva: GEMINI_MODEL_RISERVA (predefinito MODELLO_GEMINI_RISERVA_PREDEFINITO), usata
// una volta se il principale risponde 503/404/timeout. Per cambiare modello: impostare
// le variabili su Vercel (basta un redeploy, nessuna modifica al codice) oppure
// cambiare le costanti qui sotto.
//
// Formato verificato sulla documentazione ufficiale (ai.google.dev, 31/10/2026):
// POST v1beta/models/{model}:generateContent?key=…, parti `inline_data`
// {mime_type, data base64} per immagini e PDF (PDF fino a 50 MB / 1000 pagine),
// generationConfig.responseMimeType = 'application/json'.
// Solo server-side (usa GEMINI_API_KEY).

export const MODELLO_GEMINI_PREDEFINITO = 'gemini-3.8-flash'
/** Riserva usata UNA volta se il principale è sovraccarico (503), in timeout o
 *  non più disponibile (404). GEMINI_MODEL_RISERVA vuota ("") = nessuna riserva. */
export const MODELLO_GEMINI_RISERVA_PREDEFINITO = 'gemini-3.6-flash'

export function modelloGemini(): string {
  return process.env.GEMINI_MODEL?.trim() || MODELLO_GEMINI_PREDEFINITO
}

export function modelloGeminiRiserva(): string | null {
  const v = process.env.GEMINI_MODEL_RISERVA
  if (v !== undefined) return v.trim() || null
  return MODELLO_GEMINI_RISERVA_PREDEFINITO
}

// Le route AI hanno maxDuration = 60 s (limite Vercel): primo tentativo 22 s,
// riserva 33 s, così la risposta arriva sempre prima che Vercel interrompa la funzione.
const TIMEOUT_PRINCIPALE_MS = 22_000
const TIMEOUT_RISERVA_MS = 33_000

export interface FileInline { mimeType: string; base64: string }

// Tipo piatto: il progetto non ha strictNullChecks (le unioni discriminate non si restringono)
export interface EsitoGemini {
  ok: boolean
  testo?: string     // presente se ok
  errore?: string    // messaggio leggibile per la pagina, presente se !ok
  status?: number
  modello: string
}

/** Messaggio leggibile per la pagina a partire dalla risposta di errore di Google. */
function messaggioErrore(status: number, corpo: string, modello: string): string {
  let msg = ''
  try { msg = JSON.parse(corpo)?.error?.message || '' } catch { /* corpo non JSON */ }
  const t = `${msg} ${corpo}`.toLowerCase()
  if (status === 404 || t.includes('no longer available') || t.includes('is not found for api version')) {
    return `Il modello AI "${modello}" non è più disponibile presso Google. ` +
      `L'amministratore deve aggiornare la variabile GEMINI_MODEL su Vercel (es. il modello indicato da Google) e ripetere il deploy.`
  }
  if (status === 429) return 'Limite di utilizzo dell\'AI raggiunto: riprova tra qualche minuto.'
  if (status === 503 || t.includes('high demand') || t.includes('overloaded')) {
    return 'Il servizio AI di Google è sovraccarico in questo momento: riprova tra qualche minuto.'
  }
  if (status === 504) return 'L\'AI sta impiegando troppo tempo a rispondere: riprova tra qualche minuto.'
  if (status === 401 || status === 403 || t.includes('api key not valid')) {
    return 'Chiave AI (GEMINI_API_KEY) non valida o senza permessi: contatta l\'amministratore.'
  }
  if (status === 413 || t.includes('too large') || t.includes('payload size')) {
    return 'File troppo grande per l\'analisi AI: riduci la dimensione o la risoluzione e riprova.'
  }
  if (status >= 500) return 'Il servizio AI di Google non risponde in questo momento: riprova tra poco.'
  return `Analisi AI non riuscita (${status})${msg ? ': ' + msg.slice(0, 200) : ''}.`
}

type ParamGemini = { prompt: string; file?: FileInline; json?: boolean; temperature?: number }

/** Chiama generateContent con un prompt ed eventualmente un file (immagine o PDF) in base64.
 *  Se il modello principale è sovraccarico/in timeout/non disponibile, riprova una
 *  volta con il modello di riserva. */
export async function chiamaGemini(p: ParamGemini): Promise<EsitoGemini> {
  const principale = modelloGemini()
  const primo = await chiamaModello(principale, p, TIMEOUT_PRINCIPALE_MS)
  if (primo.ok || ![404, 500, 503, 504].includes(primo.status ?? 0)) return primo
  const riserva = modelloGeminiRiserva()
  if (!riserva || riserva === principale) return primo
  console.warn(`Gemini: ${principale} → ${primo.status}, nuovo tentativo con il modello di riserva ${riserva}`)
  const secondo = await chiamaModello(riserva, p, TIMEOUT_RISERVA_MS)
  // Se fallisce anche la riserva si mostra l'errore del principale (es. modello non più disponibile)
  return secondo.ok ? secondo : primo
}

async function chiamaModello(modello: string, p: ParamGemini, timeoutMs: number): Promise<EsitoGemini> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return { ok: false, errore: 'Chiave AI (GEMINI_API_KEY) non configurata sul server.', status: 500, modello }

  const parts: Array<Record<string, unknown>> = [{ text: p.prompt }]
  if (p.file) parts.push({ inline_data: { mime_type: p.file.mimeType, data: p.file.base64 } })

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  let res: Response
  let corpo: string
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modello)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        signal: ac.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: p.temperature ?? 0.1,
            ...(p.json !== false ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      },
    )
    corpo = await res.text()
  } catch (e) {
    const scaduto = e instanceof Error && e.name === 'AbortError'
    return scaduto
      ? { ok: false, errore: messaggioErrore(504, '', modello), status: 504, modello }
      : { ok: false, errore: 'Servizio AI non raggiungibile: controlla la connessione e riprova.', status: 503, modello }
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    console.error(`Gemini ${modello} ${res.status}:`, corpo.slice(0, 500))
    return { ok: false, errore: messaggioErrore(res.status, corpo, modello), status: res.status, modello }
  }

  type Parte = { text?: string; thought?: boolean }
  let dati: { candidates?: Array<{ content?: { parts?: Parte[] }; finishReason?: string }>; promptFeedback?: { blockReason?: string } }
  try { dati = JSON.parse(corpo) } catch {
    return { ok: false, errore: 'Risposta AI non leggibile: riprova.', status: 502, modello }
  }
  if (dati.promptFeedback?.blockReason) {
    return { ok: false, errore: `Documento non analizzabile dall'AI (${dati.promptFeedback.blockReason}).`, status: 422, modello }
  }
  // I modelli recenti possono restituire parti di "ragionamento" (thought: true): si
  // usano solo le parti di testo della risposta vera e propria.
  const testo = (dati.candidates?.[0]?.content?.parts || [])
    .filter(x => typeof x.text === 'string' && !x.thought)
    .map(x => x.text)
    .join('')
  if (!testo.trim()) {
    return { ok: false, errore: 'L\'AI non ha restituito dati: prova con un\'immagine più nitida.', status: 502, modello }
  }
  return { ok: true, testo, modello }
}

/** Estrae il primo oggetto JSON dal testo della risposta (tollera ```json … ```). */
export function estraiJson<T = Record<string, unknown>>(testo: string): T | null {
  const pulito = testo.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(pulito) as T } catch { /* prova a isolare l'oggetto */ }
  const m = pulito.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) as T } catch { return null }
}
