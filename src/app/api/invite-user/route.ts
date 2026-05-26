import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { email, ruolo, moduli_abilitati, azienda_id } = await req.json()
    if (!email || !azienda_id) {
      return NextResponse.json({ error: 'email e azienda_id richiesti' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurata' }, { status: 500 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sq360.app'}/dashboard`,
      data: { azienda_id, ruolo },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await admin.from('utenti').upsert({
      id: data.user.id,
      email,
      azienda_id,
      ruolo: ruolo || 'operatore',
      nome: '',
      cognome: '',
      moduli_abilitati: moduli_abilitati || {},
    }, { onConflict: 'id' })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Errore interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
