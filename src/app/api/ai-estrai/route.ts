import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { testo?: string; tipo?: string }
    const { testo, tipo } = body

    if (!testo || testo.trim().length < 20) {
      return NextResponse.json({ ok: false, errore: 'Testo troppo breve o vuoto' })
    }

    // Leggi la chiave API — DEVE essere disponibile come env var server-side
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY mancante nelle env vars')
      return NextResponse.json({ ok: false, errore: 'Chiave API non configurata sul server' })
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
Rispondi SOLO con un oggetto JSON valido. Nessun testo prima o dopo. Nessun markdown. Solo il JSON.
Schema: ${schema}
Regole:
- Per importi usa solo numeri (es. 500000 non "€ 500.000,00")
- Per date usa formato YYYY-MM-DD
- Se un campo non è presente lascia il valore default dello schema
- Per provincia usa la sigla 2 lettere (es. NA, RM, MI)

DOCUMENTO:
${testo.slice(0, 7000)}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Anthropic API error:', response.status, errBody)
      return NextResponse.json({ ok: false, errore: `API Anthropic errore ${response.status}` })
    }

    const data = await response.json() as { content?: Array<{ type: string; text: string }> }
    const rawText = data.content?.find((c) => c.type === 'text')?.text ?? ''

    // Estrai JSON — gestisci casi con testo extra
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, errore: 'Nessun JSON trovato nella risposta AI', raw: rawText.slice(0, 200) })
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
