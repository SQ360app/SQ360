import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { testo?: string; tipo?: string }
    const { testo, tipo } = body

    if (!testo || testo.trim().length < 20) {
      return NextResponse.json({ ok: false, errore: 'Testo troppo breve o vuoto' })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY mancante')
      return NextResponse.json({ ok: false, errore: 'Chiave AI non configurata' })
    }

    const schema = tipo === 'fornitore'
      ? '{"ragione_sociale":"","partita_iva":"","codice_fiscale":"","pec":"","email":"","telefono":"","indirizzo":"","citta":"","provincia":"NA","cap":"","codice_sdi":"","categoria_soa":"","classifica_soa":"","codice_ateco":"","note":""}'
      : tipo === 'gara'
      ? '{"nome":"","committente":"","cig":"","cup":"","importo_base":0,"categoria_prevalente":"OG1","provincia":"NA","tipo_committente":"P","data_scadenza":"","criterio_aggiudicazione":"OEP","note":""}'
      : '{"nome":"","committente":"","cig":"","cup":"","importo_base":0,"importo_aggiudicato":0,"ribasso_pct":0,"oneri_sicurezza":0,"categoria_prevalente":"OG1","provincia":"NA","indirizzo_cantiere":"","citta_cantiere":"","tipo_committente":"P","data_aggiudicazione":"","durata_giorni":365,"rup_nome":"","rup_email":"","dl_nome":"","dl_email":"","note":""}'

    const tipoLabel = tipo === 'fornitore'
      ? 'fornitore/subappaltatore'
      : tipo === 'gara'
      ? "gara d'appalto pubblica"
      : 'commessa edile'

    const prompt = `Sei un esperto di appalti pubblici italiani. Analizza questo documento di ${tipoLabel} ed estrai i dati richiesti.
Rispondi SOLO con un oggetto JSON valido. Nessun testo prima o dopo. Nessun markdown. Solo JSON puro.
Schema: ${schema}
Regole:
- Per importi usa solo numeri interi (es. 500000 non "€ 500.000,00")
- Per date usa formato YYYY-MM-DD
- Per provincia usa sigla 2 lettere (es. NA, RM, MI)
- Se un campo non è presente lascia il valore default dello schema

DOCUMENTO:
${testo.slice(0, 8000)}`

    // Gemini 2.0 Flash — gratuito e veloce
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Gemini API error:', response.status, errBody.slice(0, 200))
      return NextResponse.json({ ok: false, errore: `Errore AI ${response.status}` })
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!rawText) {
      return NextResponse.json({ ok: false, errore: 'Nessuna risposta dal modello AI' })
    }

    // Estrai JSON — Gemini con responseMimeType json dovrebbe restituire JSON puro
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, errore: 'JSON non trovato nella risposta', raw: rawText.slice(0, 200) })
    }

    try {
      const dati = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return NextResponse.json({ ok: true, dati })
    } catch {
      return NextResponse.json({ ok: false, errore: 'JSON malformato', raw: jsonMatch[0].slice(0, 200) })
    }

  } catch (err) {
    console.error('ai-estrai error:', err)
    return NextResponse.json({ ok: false, errore: String(err) }, { status: 500 })
  }
}
