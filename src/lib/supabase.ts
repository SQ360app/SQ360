import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let instance: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!instance) {
    instance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return instance
}

// Supabase generated types non disponibili: cast ad any per evitare TS2769 su tutte le tabelle.
// Il type-check Supabase viene fatto a runtime tramite RLS e dalla logica applicativa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = getSupabase() as any

export async function getAziendaId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ''
  const { data } = await supabase
    .from('utenti')
    .select('azienda_id')
    .eq('id', user.id)
    .single()
  return data?.azienda_id || ''
}

export async function getCurrentUserModuli(): Promise<{ moduli: Record<string, boolean>; ruolo: string; nome: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { moduli: {}, ruolo: '', nome: '' }
  const { data } = await supabase
    .from('utenti')
    .select('ruolo,moduli_abilitati,nome,cognome')
    .eq('id', user.id)
    .single()
  return {
    moduli: (data as any)?.moduli_abilitati || {},
    ruolo:  (data as any)?.ruolo || '',
    nome:   [(data as any)?.nome, (data as any)?.cognome].filter(Boolean).join(' '),
  }
}
