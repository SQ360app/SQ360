import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, base64, tipo_file, tipo_uso } = body

    const messages: { role: string; content: unknown }[] = []

    if (base64 && (tipo_file === 'pdf')) {
      // Invia PDF come immagine/documento a Claude
      messages.push({
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64
            }
          },
          {
            type: 'text',
            text: `Sei un esperto di appalti edili italiani. Analizza questo documento e estrai in JSON puro (senza markdown):
{
  "commessa": {
    "nome": "nome progetto",
    "committente": "nome committente o stazione appaltante",
    "cig": "codice CIG",
    "cup": "codice CUP", 
    "importo_base": 0,
    "ribasso_pct": 0,
    "oneri_sicurezza": 0,
    "data_aggiudicazione": "YYYY-MM-DD",
    "data_inizio": "YYYY-MM-DD",
    "data_fine": "YYYY-MM-DD",
    "durata_gg": 0,
    "dl_nome": "direttore lavori",
    "rup_nome": "nome RUP",
    "provincia": "sigla 2 lettere",
    "categoria_opera": "RS|NC|DR|MS|MO|IF|RE|IP|UR|BO",
    "tipo_committente": "P|V|M|A",
    "confidenza": 85
  },
  "voci": [
    {
      "capitolo": "01",
      "codice": "codice voce elenco prezzi",
      "descrizione": "descrizione completa lavorazione",
      "um": "mq|mc|ml|kg|nr|corpo|h",
      "quantita": 0,
      "prezzo_unitario": 0,
      "categoria": "OG1 o simile se indicato"
    }
  ]
}

Tipo documento: ${tipo_uso === 'GARA' ? 'Documento di gara/bando' : 'Contratto/progetto aggiudicato'}
Estrai TUTTE le voci del computo metrico presenti. Se non ci sono prezzi unitari, metti 0.
Rispondi SOLO con il JSON, nessun testo aggiuntivo.`
          }
        ]
      })
    } else {
      // Testo puro
      messages.push({
        role: 'user',
        content: prompt || 'Analizza il documento e restituisci JSON.'
      })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: err }, { status: response.status })
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || '{}'

    return NextResponse.json({ content })

  } catch (error) {
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}
