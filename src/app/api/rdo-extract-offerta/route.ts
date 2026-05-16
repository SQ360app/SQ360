import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
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

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'application/pdf', data: base64 } }
            ]
          }],
          generationConfig: { temperature: 0.1 }
        })
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      return NextResponse.json({ ok: false, error: 'Gemini error: ' + err }, { status: 500 })
    }

    const geminiJson = await geminiRes.json()
    const rawText: string = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    let data: any
    try {
      const clean = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim()
      data = JSON.parse(clean)
    } catch {
      data = { error: 'Parsing fallito', raw: rawText.slice(0, 500) }
    }

    return NextResponse.json({ ok: true, rdo_id, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
