import { NextRequest, NextResponse } from 'next/server'
import { getUserClient } from '@/lib/supabaseServer'
import { chiamaGemini, estraiJson } from '@/lib/gemini'

// Analisi AI: fino a 60 s (limite Vercel); i tempi dei tentativi sono in src/lib/gemini.ts
export const maxDuration = 60

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Solo utenti collegati: evita uso anonimo (e costi AI) della route
  const auth = await getUserClient(req)
  if (auth.response) return auth.response

  try {
    const fd = await req.formData()
    const file = fd.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file allegato' })

    const buf = await file.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const tipi = [
      'DURC','SOA','Visura camerale','Polizza RC','Polizza CAR','Polizza fidejussione','DUVRI',
      'UNILAV','Idoneità sanitaria','Attestato formazione 16h','Attestato formazione 8h','Attestato formazione 4h',
      'Patente a crediti','Documento identità','DVR','POS','PSC','PIMUS','Notifica preliminare',
      'Piano smaltimento rifiuti','Revisione mezzo','Assicurazione mezzo','Libretto immatricolazione','Omologazione mezzo'
    ].join(', ')

    const schema = `{"tipo":"","numero_documento":"","soggetto":"","soggetto_tipo":"azienda","data_emissione":"","data_scadenza":"","note":""}`

    const prompt = `Sei un esperto di sicurezza nei cantieri edili italiani. Analizza questo documento e identifica di che tipo si tratta.
Rispondi SOLO con JSON valido, nessun testo fuori dal JSON.
Schema: ${schema}
Tipi possibili per il campo "tipo": ${tipi}
Valori possibili per "soggetto_tipo": azienda, lavoratore, subappaltatore, mezzo
Regole:
- date: formato YYYY-MM-DD
- soggetto: nome dell'azienda, lavoratore o mezzo a cui si riferisce il documento
- numero_documento: numero protocollo o identificativo univoco se presente
- Se un campo non è leggibile: lascia la stringa vuota`

    // Modello e chiamata centralizzati in src/lib/gemini.ts (GEMINI_MODEL)
    const esito = await chiamaGemini({ prompt, file: { mimeType, base64: b64 } })
    if (!esito.ok) return NextResponse.json({ ok: false, errore: esito.errore })
    const dati = estraiJson(esito.testo)
    if (!dati) return NextResponse.json({ ok: false, errore: 'L’AI non ha restituito dati leggibili: riprova con un file più nitido.' })
    return NextResponse.json({ ok: true, dati })
  } catch (err) {
    console.error('Errore analisi AI:', err)
    return NextResponse.json({ ok: false, errore: 'Errore durante l’analisi AI: riprova.' })
  }
}
