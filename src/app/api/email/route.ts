import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json()
    if (!to || !subject || !html) {
      return NextResponse.json({ ok: false, error: 'to, subject e html sono obbligatori' }, { status: 400 })
    }
    const { data, error } = await resend.emails.send({
      from: 'SQ360 <noreply@sq360.app>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })
    if (error) return NextResponse.json({ ok: false, error }, { status: 400 })
    return NextResponse.json({ ok: true, id: data?.id })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
