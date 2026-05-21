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

export const supabase = getSupabase()

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
