import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { testo, tipo } = await req.json()

    const prompt = tipo === 'fornitore' ? `
Dal testo del documento estrai i dati del fornitore/subappaltatore.
Rispondi SOLO con un JSON valido, senza markdown, senza backtick.
Schema: {"ragione_sociale":"","partita_iva":"","codice_fiscale":"","pec":"","email":"","telefono":"","indirizzo":"","citta":"","provincia":"NA","cap":"","codice_sdi":"","categoria_soa":"","classifica_soa":"","codice_ateco":"","note":""}
Documento: ${testo}
` : tipo === 'gara' ? `
Dal documento di gara pubblica italiana estrai i dati principali.
Rispondi SOLO con un JSON valido, senza markdown, senza backtick.
Schema: {"nome":"","committente":"","cig":"","cup":"","importo_base":0,"categoria_prevalente":"OG1","provincia":"NA","tipo_committente":"P","data_scadenza":"","criterio_aggiudicazione":"OEP","note":""}
Documento: ${testo}
` : `
Dal documento (contratto/capitolato/determina) estrai i dati della commessa edile.
Rispondi SOLO con un JSON valido, senza markdown, senza backtick.
Schema: {"nome":"","committente":"","cig":"","cup":"","importo_base":0,"importo_aggiudicato":0,"ribasso_pct":0,"oneri_sicurezza":0,"categoria_prevalente":"OG1","provincia":"NA","indirizzo_cantiere":"","citta_cantiere":"","tipo_committente":"P","data_aggiudicazione":"","durata_giorni":365,"rup_nome":"","rup_email":"","dl_nome":"","dl_email":"","note":""}
Documento: ${testo}
`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const raw = data.content?.[0]?.text || ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const dati = JSON.parse(cleaned)
      return NextResponse.json({ ok: true, dati })
    } catch {
      return NextResponse.json({ ok: false, errore: 'JSON non valido', raw })
    }
  } catch (err) {
    return NextResponse.json({ ok: false, errore: String(err) }, { status: 500 })
  }
}
