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

    const tipi = [
      'DURC','SOA','Visura camerale','Polizza RC','Polizza CAR','Polizza fidejussione','DUVRI',
      'UNILAV','Idoneità sanitaria','Attestato formazione 16h','Attestato formazione 8h','Attestato formazione 4h',
      'Patente a crediti','Documento identità','DVR','POS','PSC','PIMUS','Notifica preliminare',
      'Piano smaltimento rifiuti','Revisione mezzo','Assicurazione mezzo','Libretto immatricolazione','Omologazione mezzo'
    ].join(', ')

    const schema = `{"tipo":"","numero_documento":"","soggetto":"","soggetto_tipo":"azienda","data_emissione":"","data_scadenza":"","note":""}`

    const prompt = `Sei un esperto di sicurezza nei cantieri edili italiani. Analizza questo documento e identifica di che tipo si tratta.
Rispondi SOLO con JSON valido, nessun testo fuori dal JSON.
Schema: ${schema}
Tipi possibili per il campo "tipo": ${tipi}
Valori possibili per "soggetto_tipo": azienda, lavoratore, subappaltatore, mezzo
Regole:
- date: formato YYYY-MM-DD
- soggetto: nome dell'azienda, lavoratore o mezzo a cui si riferisce il documento
- numero_documento: numero protocollo o identificativo univoco se presente
- Se un campo non è leggibile: lascia la stringa vuota`

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
