import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { emailDurcReport } from '@/lib/emailTemplates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  // Vercel cron verifica l'header Authorization
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oggi = new Date()
  const tra30 = new Date(oggi)
  tra30.setDate(tra30.getDate() + 30)

  // Cerca documenti DURC in scadenza entro 30 giorni raggruppati per azienda
  const { data: docs } = await supabase
    .from('documenti_sicurezza')
    .select('*, commessa:commessa_id(codice,nome), azienda:azienda_id(nome)')
    .eq('tipo', 'DURC')
    .gte('data_scadenza', oggi.toISOString().slice(0, 10))
    .lte('data_scadenza', tra30.toISOString().slice(0, 10))
    .order('data_scadenza', { ascending: true })

  if (!docs || docs.length === 0) {
    return NextResponse.json({ ok: true, message: 'Nessun DURC in scadenza' })
  }

  // Raggruppa per azienda_id
  const perAzienda = docs.reduce((acc: Record<string, any[]>, d: any) => {
    const key = d.azienda_id || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  const risultati: any[] = []

  for (const [aziendaId, durcDocs] of Object.entries(perAzienda)) {
    // Recupera email admin dell'azienda
    const { data: admin } = await supabase
      .from('utenti')
      .select('email')
      .eq('azienda_id', aziendaId)
      .eq('ruolo', 'admin')
      .limit(1)
      .single()

    if (!admin?.email) continue

    const scadenze = (durcDocs as any[]).map((d: any) => {
      const sc = new Date(d.data_scadenza)
      const gg = Math.round((sc.getTime() - oggi.getTime()) / 86400000)
      return {
        fornitore: d.soggetto || 'N/D',
        dataScadenza: new Date(d.data_scadenza).toLocaleDateString('it-IT'),
        commessa: d.commessa ? `${d.commessa.codice} — ${d.commessa.nome}` : 'N/D',
        giorniRimanenti: gg,
      }
    })

    const { subject, html } = emailDurcReport(scadenze)
    const { error } = await resend.emails.send({
      from: 'SQ360 <noreply@sq360.app>',
      to: [admin.email],
      subject,
      html,
    })

    risultati.push({ aziendaId, email: admin.email, durc: scadenze.length, error: error?.message })
  }

  return NextResponse.json({ ok: true, risultati })
}
