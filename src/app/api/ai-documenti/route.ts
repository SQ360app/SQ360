import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { testoFile?: string; tipo?: string; docId?: string; commessaId?: string }
    const testo = body.testoFile || ''
    if (!testo || testo.trim().length < 20) {
      return NextResponse.json({ datiEstrati: null, errore: 'Testo documento troppo breve' })
    }
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/ai-estrai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testo, tipo: 'documento' }),
    })
    const json = await res.json() as { ok: boolean; dati?: Record<string, unknown>; errore?: string }
    return NextResponse.json({ datiEstrati: json.ok ? json.dati : null, errore: json.errore })
  } catch (err) {
    return NextResponse.json({ datiEstrati: null, errore: String(err) })
  }
}
