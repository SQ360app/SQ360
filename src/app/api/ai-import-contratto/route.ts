import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SCHEMA = JSON.stringify({
  nome: '', committente: '', cig: '', cup: '',
  importo_base: 0, importo_aggiudicato: 0, ribasso_pct: 0, oneri_sicurezza: 0,
  categoria_prevalente: 'OG1', provincia: 'NA', tipo_committente: 'P',
  data_aggiudicazione: '', durata_gg: 365,
  indirizzo_cantiere: '', citta_cantiere: '',
  rup_nome: '', rup_email: '', rup_telefono: '',
  dl_nome: '', dl_email: '', dl_telefono: '',
  csp_nome: '', cse_nome: '', note: ''
})

const PROMPT = `Sei un esperto di appalti pubblici italiani. Analizza questo documento ed estrai i dati della commessa edile. Rispondi SOLO con JSON valido, nessun testo, nessun markdown. Schema: ${SCHEMA}. Regole: importi come numeri interi, date come YYYY-MM-DD, provincia come sigla 2 lettere maiuscole, lascia default se non trovato.`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, errore: 'ANTHROPIC_API_KEY non configurata' })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const testo = formData.get('testo') as string | null

    let messages: Array<{ role: string; content: unknown }>

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        const b64 = buffer.toString('base64')
        messages = [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: PROMPT }
        ]}]
      } else {
        const txt = buffer.toString('utf8').replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ').slice(0, 9000)
        messages = [{ role: 'user', content: PROMPT + '\n\nDocumento:\n' + txt }]
      }
    } else if (testo) {
      messages = [{ role: 'user', content: PROMPT + '\n\nDocumento:\n' + testo.slice(0, 9000) }]
    } else {
      return NextResponse.json({ ok: false, errore: 'Nessun file o testo ricevuto' })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages })
    })

    if (!res.ok) throw new Error('Claude API ' + res.status)
    const data = await res.json() as { content?: Array<{ text?: string }> }
    const raw = data.content?.[0]?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON non trovato')
    const dati = JSON.parse(match[0]) as Record<string, unknown>
    return NextResponse.json({ ok: true, dati })
  } catch (err) {
    console.error('ai-import-contratto:', String(err))
    return NextResponse.json({ ok: false, errore: 'Errore: ' + String(err) })
  }
}
