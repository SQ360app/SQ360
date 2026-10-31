import { NextRequest, NextResponse } from 'next/server'
import { getUserClient } from '@/lib/supabaseServer'
import { chiamaGemini, estraiJson } from '@/lib/gemini'

// Analisi AI: fino a 60 s (limite Vercel); i tempi dei tentativi sono in src/lib/gemini.ts
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Solo utenti collegati: evita uso anonimo (e costi AI) della route
  const auth = await getUserClient(req)
  if (auth.response) return auth.response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const rdo_id = formData.get('rdo_id') as string
    const voci_rda_raw = formData.get('voci_rda') as string

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ ok: false, error: 'File PDF mancante o non valido' }, { status: 400 })
    }

    const voci_rda: any[] = JSON.parse(voci_rda_raw || '[]')

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const vociRdaList = voci_rda.length > 0
      ? '\n\nVoci RDA di riferimento per il matching:\n' + voci_rda.map((v: any, i: number) =>
          `${i + 1}. ${v.descrizione} (${v.um || '—'}, qtà ${v.quantita ?? '—'})`
        ).join('\n')
      : ''

    const prompt = `Sei un assistente per imprese edili italiane.
Estrai da questo preventivo PDF:
- ragione_sociale fornitore
- data preventivo (formato YYYY-MM-DD)
- per ogni voce: descrizione, unita_misura, quantita (numero), prezzo_unitario (numero), importo (numero)
- importo_totale (numero, IVA esclusa)
- condizioni_pagamento
- note e osservazioni${vociRdaList}

Restituisci SOLO JSON valido senza markdown, senza \`\`\`, con questa struttura esatta:
{
  "ragione_sociale": "...",
  "data_preventivo": "YYYY-MM-DD",
  "voci": [
    {
      "descrizione": "...",
      "unita_misura": "...",
      "quantita": 0,
      "prezzo_unitario": 0,
      "importo": 0
    }
  ],
  "importo_totale": 0,
  "condizioni_pagamento": "...",
  "note": "..."
}`

    // Modello e chiamata centralizzati in src/lib/gemini.ts (GEMINI_MODEL)
    const esito = await chiamaGemini({ prompt, file: { mimeType: 'application/pdf', base64 } })
    if (!esito.ok) return NextResponse.json({ ok: false, error: esito.errore }, { status: esito.status === 404 ? 503 : 502 })
    const data: any = estraiJson(esito.testo) ?? { error: 'Parsing fallito', raw: esito.testo.slice(0, 500) } // eslint-disable-line @typescript-eslint/no-explicit-any

    return NextResponse.json({ ok: true, rdo_id, data })
  } catch (e: any) {
    console.error('rdo-extract-offerta:', e)
    return NextResponse.json({ ok: false, error: 'Errore durante l’analisi AI del preventivo: riprova.' }, { status: 500 })
  }
}
