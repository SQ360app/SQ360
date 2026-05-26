import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const rdo_id = formData.get('rdo_id') as string
    const token = formData.get('token') as string

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ ok: false, error: 'File PDF mancante o non valido' }, { status: 400 })
    }
    if (!rdo_id || !token) {
      return NextResponse.json({ ok: false, error: 'Parametri mancanti' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ ok: false, error: 'Configurazione server mancante' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey) as any

    // Verifica token
    const { data: rdo } = await admin.from('rdo').select('id').eq('id', rdo_id).eq('token_offerta', token).single()
    if (!rdo) {
      return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 403 })
    }

    const bytes = await file.arrayBuffer()
    const path = `offerte/${rdo_id}/${token}.pdf`

    const { error: uploadErr } = await admin.storage.from('documenti').upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    })
    if (uploadErr) {
      return NextResponse.json({ ok: false, error: uploadErr.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('documenti').getPublicUrl(path)
    const publicUrl: string = urlData?.publicUrl || ''

    await admin.from('rdo').update({ offerta_pdf_url: publicUrl }).eq('id', rdo_id)

    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
