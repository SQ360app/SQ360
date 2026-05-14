import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file allegato' })

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) return NextResponse.json({ ok: false, errore: 'GEMINI_API_KEY mancante' })

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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: b64 } }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    })
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON non trovato nella risposta AI')
    return NextResponse.json({ ok: true, dati: JSON.parse(match[0]) })
  } catch (err) {
    return NextResponse.json({ ok: false, errore: String(err) })
  }
}
