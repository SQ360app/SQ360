import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { testo, tipo } = await req.json()

    // Tipo può essere: 'commessa' | 'gara' | 'fornitore'
    const prompt = tipo === 'fornitore' ? `
Sei un assistente per la gestione edile. Dal testo del documento estrai i dati del fornitore/subappaltatore.
Rispondi SOLO con un JSON valido, senza markdown, senza backtick, senza spiegazioni.

Schema JSON da restituire:
{
  "ragione_sociale": "Nome azienda",
  "partita_iva": "IT12345678901",
  "codice_fiscale": "ABCDEF12G34H567I",
  "pec": "email@pec.it",
  "email": "email@azienda.it",
  "telefono": "0812345678",
  "indirizzo": "Via ...",
  "citta": "Napoli",
  "provincia": "NA",
  "cap": "80100",
  "codice_sdi": "XXXXXXX",
  "categoria_soa": "OG1",
  "classifica_soa": "IV",
  "codice_ateco": "41.20.00",
  "note": ""
}

Documento:
${testo}
    ` : tipo === 'gara' ? `
Sei un assistente per la gestione edile. Dal documento di gara pubblica italiana estrai i dati principali.
Rispondi SOLO con un JSON valido, senza markdown, senza backtick, senza spiegazioni.

Schema JSON da restituire:
{
  "nome": "Descrizione lavori",
  "committente": "Ente committente",
  "cig": "CIG se presente",
  "cup": "CUP se presente",
  "importo_base": 0,
  "categoria_prevalente": "OG1",
  "provincia": "NA",
  "tipo_committente": "P",
  "data_scadenza": "YYYY-MM-DD",
  "criterio_aggiudicazione": "OEP",
  "note": ""
}

Documento:
${testo}
    ` : `
Sei un assistente per la gestione edile. Dal documento (contratto, capitolato, decreto di aggiudicazione) estrai i dati della commessa edile.
Rispondi SOLO con un JSON valido, senza markdown, senza backtick, senza spiegazioni.

Schema JSON da restituire:
{
  "nome": "Descrizione lavori",
  "committente": "Ente committente",
  "cig": "CIG se presente",
  "cup": "CUP se presente",
  "importo_base": 0,
  "importo_aggiudicato": 0,
  "ribasso_pct": 0,
  "oneri_sicurezza": 0,
  "categoria_prevalente": "OG1",
  "provincia": "NA",
  "indirizzo_cantiere": "Via ...",
  "citta_cantiere": "Napoli",
  "tipo_committente": "P",
  "data_aggiudicazione": "YYYY-MM-DD",
  "durata_giorni": 365,
  "rup_nome": "",
  "rup_email": "",
  "dl_nome": "",
  "dl_email": "",
  "note": ""
}

Documento:
${testo}
    `

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Pulisce il JSON da eventuali wrapper markdown
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
