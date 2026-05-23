import { supabase } from '@/lib/supabase'

export interface EmailLogData {
  azienda_id: string
  commessa_id?: string
  tipo_doc?: string
  doc_id?: string
  doc_codice?: string
  direzione?: 'uscita' | 'entrata'
  mittente?: string
  destinatari: string[]
  cc?: string[]
  oggetto: string
  html?: string
  allegati?: any[]
  stato?: string
  resend_id?: string
  created_by?: string
}

export async function saveEmailLog(data: EmailLogData): Promise<void> {
  try {
    await (supabase as any).from('email_log').insert({
      ...data,
      direzione: data.direzione ?? 'uscita',
      stato: data.stato ?? 'inviata',
      inviata_at: new Date().toISOString(),
    })
  } catch {
    // fire-and-forget — non blocca il flusso principale
  }
}
