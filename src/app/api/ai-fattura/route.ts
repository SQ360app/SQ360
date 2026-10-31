import { NextRequest, NextResponse } from 'next/server'
import { getUserClient } from '@/lib/supabaseServer'
import { chiamaGemini, estraiJson } from '@/lib/gemini'

// Analisi AI: fino a 60 s (limite Vercel); i tempi dei tentativi sono in src/lib/gemini.ts
export const maxDuration = 60

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Solo utenti collegati: evita uso anonimo (e costi AI) della route
  const auth = await getUserClient(req)
  if (auth.response) return auth.response

  try {
    const fd = await req.formData()
    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file allegato' })

    const buf = await file.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')
    const mimeType = file.type || 'application/pdf'

    const schema = '{"numero_fattura":"","data_fattura":"","data_scadenza":"","fornitore":"","partita_iva":"","imponibile":0,"iva_pct":22,"importo_iva":0,"totale":0,"note":""}'

    const prompt = `Sei un esperto contabile italiano. Analizza questa fattura ed estrai tutti i dati fiscali.
Rispondi SOLO con un oggetto JSON valido. Nessun testo prima o dopo il JSON. Solo JSON puro.
Schema da compilare: ${schema}
Regole:
- date: formato YYYY-MM-DD
- importi: numeri con max 2 decimali, senza simboli valuta (es. 1234.56)
- iva_pct: solo il numero intero (es. 22, non "22%")
- data_scadenza: calcola se non esplicita (es. 30gg da data fattura)
- Se un campo non è leggibile: lascia il valore default`

    // Modello e chiamata centralizzati in src/lib/gemini.ts (GEMINI_MODEL)
    const esito = await chiamaGemini({ prompt, file: { mimeType, base64: b64 } })
    if (!esito.ok) return NextResponse.json({ ok: false, errore: esito.errore })
    const dati = estraiJson(esito.testo)
    if (!dati) return NextResponse.json({ ok: false, errore: 'L’AI non ha restituito dati leggibili: riprova con un file più nitido.' })
    return NextResponse.json({ ok: true, dati })
  } catch (err) {
    console.error('Errore analisi AI:', err)
    return NextResponse.json({ ok: false, errore: 'Errore durante l’analisi AI: riprova.' })
  }
}
