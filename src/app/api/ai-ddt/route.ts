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
    const mimeType = file.type || 'image/jpeg'

    const schema = '{"numero_ddt":"","data_ddt":"","fornitore":"","partita_iva_fornitore":"","voci":[{"descrizione":"","um":"","quantita":0,"prezzo_unitario":0}],"note":""}'

    const prompt = `Sei un esperto di logistica edile italiana. Analizza questa immagine di un Documento di Trasporto (DDT) ed estrai tutti i dati.
Rispondi SOLO con un oggetto JSON valido. Nessun testo prima o dopo il JSON. Solo JSON puro.
Schema da compilare: ${schema}
Regole:
- data_ddt: formato YYYY-MM-DD
- quantita e prezzo_unitario: solo numeri decimali (0 se non leggibile)
- voci: array con TUTTE le righe del documento, una voce per riga
- Se un campo non è leggibile: lascia il valore default dello schema`

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
