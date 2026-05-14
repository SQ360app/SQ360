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
