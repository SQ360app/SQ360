import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { testo, tipo } = await req.json()

    if (!testo || testo.trim().length < 20) {
      return NextResponse.json({ ok: false, errore: 'Testo troppo breve o vuoto' })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, errore: 'ANTHROPIC_API_KEY non configurata' })
    }

    const schema = tipo === 'fornitore'
      ? `{"ragione_sociale":"","partita_iva":"","codice_fiscale":"","pec":"","email":"","telefono":"","indirizzo":"","citta":"","provincia":"NA","cap":"","codice_sdi":"","categoria_soa":"","classifica_soa":"","codice_ateco":"","note":""}`
      : tipo === 'gara'
      ? `{"nome":"","committente":"","cig":"","cup":"","importo_base":0,"categoria_prevalente":"OG1","provincia":"NA","tipo_committente":"P","data_scadenza":"","criterio_aggiudicazione":"OEP","note":""}`
      : `{"nome":"","committente":"","cig":"","cup":"","importo_base":0,"importo_aggiudicato":0,"ribasso_pct":0,"oneri_sicurezza":0,"categoria_prevalente":"OG1","provincia":"NA","indirizzo_cantiere":"","citta_cantiere":"","tipo_committente":"P","data_aggiudicazione":"","durata_giorni":365,"rup_nome":"","rup_email":"","dl_nome":"","dl_email":"","note":""}`

    const tipoLabel = tipo === 'fornitore' ? 'fornitore/subappaltatore' : tipo === 'gara' ? 'gara d\'appalto pubblica' : 'commessa edile'

    const prompt = `Sei un esperto di appalti pubblici italiani. Analizza questo documento di ${tipoLabel} ed estrai i dati richiesti.
Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick, senza testo aggiuntivo.
Schema da rispettare: ${schema}
Se un campo non è presente nel documento, lascia il valore di default dello schema.
Per importi numerici usa solo il numero senza simboli (es. 1500000 non "€ 1.500.000").
Per le date usa formato YYYY-MM-DD.

DOCUMENTO:
${testo.slice(0, 6000)}`

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
      const errText = await response.text()
      return NextResponse.json({ ok: false, errore: `API error ${response.status}: ${errText}` })
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> }
    const raw = data.content?.find(c => c.type === 'text')?.text || ''
    
    // Rimuovi markdown e whitespace
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    // Estrai solo il JSON dall'inizio del testo
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, errore: 'Nessun JSON trovato nella risposta', raw: cleaned })
    }

    try {
      const dati = JSON.parse(jsonMatch[0])
      return NextResponse.json({ ok: true, dati })
    } catch {
      return NextResponse.json({ ok: false, errore: 'JSON non valido', raw: cleaned })
    }

  } catch (err) {
    return NextResponse.json({ ok: false, errore: String(err) }, { status: 500 })
  }
}
