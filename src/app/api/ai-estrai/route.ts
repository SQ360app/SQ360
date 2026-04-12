import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function callGemini(url: string, body: string, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    if (response.status !== 429) return response
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
  }
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { testo?: string; tipo?: string }
    const { testo, tipo } = body
    if (!testo || testo.trim().length < 20) return NextResponse.json({ ok: false, errore: 'Testo troppo breve o vuoto' })
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, errore: 'Chiave AI non configurata' })
    const schema = tipo === 'fornitore'
      ? '{"ragione_sociale":"","partita_iva":"","codice_fiscale":"","pec":"","email":"","telefono":"","indirizzo":"","citta":"","provincia":"NA","cap":"","codice_sdi":"","categoria_soa":"","classifica_soa":"","codice_ateco":"","note":""}'
      : tipo === 'gara'
      ? '{"nome":"","committente":"","cig":"","cup":"","importo_base":0,"categoria_prevalente":"OG1","provincia":"NA","tipo_committente":"P","data_scadenza":"","criterio_aggiudicazione":"OEP","note":""}'
      : '{"nome":"","committente":"","cig":"","cup":"","importo_base":0,"importo_aggiudicato":0,"ribasso_pct":0,"oneri_sicurezza":0,"categoria_prevalente":"OG1","provincia":"NA","indirizzo_cantiere":"","citta_cantiere":"","tipo_committente":"P","data_aggiudicazione":"","durata_giorni":365,"rup_nome":"","rup_email":"","dl_nome":"","dl_email":"","note":""}'
    const tipoLabel = tipo === 'fornitore' ? 'fornitore/subappaltatore' : tipo === 'gara' ? "gara d'appalto pubblica" : 'commessa edile'
    const prompt = `Sei un esperto di appalti pubblici italiani. Analizza questo documento di ${tipoLabel} ed estrai i dati richiesti.\nRispondi SOLO con un oggetto JSON valido. Nessun testo prima o dopo. Nessun markdown. Solo JSON puro.\nSchema: ${schema}\nRegole:\n- Per importi usa solo numeri interi\n- Per date usa formato YYYY-MM-DD\n- Per provincia usa sigla 2 lettere\n- Se un campo non è presente lascia il valore default dello schema\n\nDOCUMENTO:\n${testo.slice(0, 8000)}`
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
    const geminiBody = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } })
    const response = await callGemini(url, geminiBody)
    if (!response.ok) {
      const errMsg = response.status === 429 ? 'Limite richieste AI — riprova tra qualche secondo' : `Errore AI ${response.status}`
      console.error('Gemini API error:', response.status)
      return NextResponse.json({ ok: false, errore: errMsg })
    }
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!rawText) return NextResponse.json({ ok: false, errore: 'Nessuna risposta dal modello AI' })
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ ok: false, errore: 'JSON non trovato nella risposta' })
    try {
      const dati = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return NextResponse.json({ ok: true, dati })
    } catch {
      return NextResponse.json({ ok: false, errore: 'JSON malformato' })
    }
  } catch (err) {
    console.error('ai-estrai error:', err)
    return NextResponse.json({ ok: false, errore: String(err) }, { status: 500 })
  }
}
