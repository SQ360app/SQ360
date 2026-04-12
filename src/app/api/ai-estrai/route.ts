import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SCHEMI: Record<string, string> = {
  fornitore: '{"ragione_sociale":"","partita_iva":"","codice_fiscale":"","pec":"","email":"","telefono":"","indirizzo":"","citta":"","provincia":"NA","cap":"","codice_sdi":"","categoria_soa":"","classifica_soa":"","codice_ateco":"","note":""}',
  gara: '{"nome":"","committente":"","cig":"","cup":"","importo_base":0,"categoria_prevalente":"OG1","provincia":"NA","tipo_committente":"P","data_scadenza":"","criterio_aggiudicazione":"OEP","note":""}',
  commessa: '{"nome":"","committente":"","cig":"","cup":"","importo_base":0,"importo_aggiudicato":0,"ribasso_pct":0,"oneri_sicurezza":0,"categoria_prevalente":"OG1","provincia":"NA","tipo_committente":"P","data_aggiudicazione":"","durata_gg":365,"rup_nome":"","rup_email":"","dl_nome":"","dl_email":"","note":""}',
  documento: '{"nome_progetto":"","committente":"","cig":"","cup":"","importo_base":0,"importo_aggiudicato":0,"ribasso_pct":0,"oneri_sicurezza":0,"categoria_prevalente":"OG1","provincia":"NA","data_aggiudicazione":"","durata_gg":365,"rup_nome":"","rup_email":"","dl_nome":"","dl_email":"","csp_nome":"","cse_nome":"","note":""}',
}

const buildPrompt = (tipo: string, schema: string, testo: string) =>
  `Sei un esperto di appalti pubblici italiani. Analizza questo documento di ${tipo} ed estrai i dati richiesti.
Rispondi SOLO con un oggetto JSON valido. Nessun testo prima o dopo. Nessun markdown. Solo JSON puro.
Schema da compilare: ${schema}
Regole:
- Per importi: solo numeri interi senza simboli (es. 500000)
- Per date: formato YYYY-MM-DD
- Per provincia: sigla 2 lettere (es. NA, RM, MI)
- Se un campo non e' presente nel documento: lascia il valore default dello schema
- Estrai TUTTI i dati disponibili

DOCUMENTO:
${testo.slice(0, 9000)}`

async function callClaude(prompt: string, apiKey: string): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}`)
  const data = await res.json() as { content?: Array<{ text?: string }> }
  const raw = data.content?.[0]?.text ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON non trovato in risposta Claude')
  return JSON.parse(match[0]) as Record<string, unknown>
}

async function callGemini(prompt: string, apiKey: string, attempt = 0): Promise<Record<string, unknown>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
  })
  if (res.status === 429) {
    if (attempt >= 3) throw new Error('Gemini 429 dopo 3 tentativi')
    await new Promise(r => setTimeout(r, [5000, 15000, 30000][attempt]))
    return callGemini(prompt, apiKey, attempt + 1)
  }
  if (!res.ok) throw new Error(`Gemini API ${res.status}`)
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON non trovato in risposta Gemini')
  return JSON.parse(match[0]) as Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const { testo, tipo = 'commessa' } = await req.json() as { testo?: string; tipo?: string }
    if (!testo || testo.trim().length < 20) return NextResponse.json({ ok: false, errore: 'Testo troppo breve' })
    const schema = SCHEMI[tipo] ?? SCHEMI.commessa
    const tipoLabel = { fornitore: 'fornitore/subappaltatore', gara: "gara d'appalto pubblica", commessa: 'commessa edile', documento: 'documento di appalto' }[tipo] ?? tipo
    const prompt = buildPrompt(tipoLabel, schema, testo)
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY
    let dati: Record<string, unknown>
    if (anthropicKey) {
      dati = await callClaude(prompt, anthropicKey)
    } else if (geminiKey) {
      dati = await callGemini(prompt, geminiKey)
    } else {
      return NextResponse.json({ ok: false, errore: 'Nessuna chiave AI configurata' })
    }
    return NextResponse.json({ ok: true, dati })
  } catch (err) {
    const msg = String(err)
    console.error('ai-estrai error:', msg)
    const errore = msg.includes('429') ? 'Limite Gemini raggiunto — aggiungi ANTHROPIC_API_KEY su Vercel per risolvere' : `Errore AI: ${msg}`
    return NextResponse.json({ ok: false, errore })
  }
}
