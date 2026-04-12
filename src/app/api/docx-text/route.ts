import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file ricevuto' }, { status: 400 })
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await mammoth.extractRawText({ buffer })
    if (!result.value || result.value.trim().length < 10) return NextResponse.json({ ok: false, errore: 'DOCX vuoto o non leggibile' })
    return NextResponse.json({ ok: true, testo: result.value })
  } catch (err) {
    return NextResponse.json({ ok: false, errore: `Errore: ${String(err)}` }, { status: 500 })
  }
}
