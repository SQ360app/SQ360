import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Helper: get current user azienda_id ─────────────────────────────────────
export async function getAziendaId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('utenti').select('azienda_id').eq('id', user.id).single()
  return data?.azienda_id ?? null
}

// ─── Commesse ─────────────────────────────────────────────────────────────────
export async function getCommesse() {
  const { data, error } = await supabase
    .from('commesse')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) console.error('getCommesse:', error)
  return data ?? []
}

export async function createCommessa(payload: Record<string, unknown>) {
  const aziendaId = await getAziendaId()
  const { data, error } = await supabase
    .from('commesse')
    .insert([{ ...payload, azienda_id: aziendaId }])
    .select()
    .single()
  if (error) console.error('createCommessa:', error)
  return data
}

// ─── Fornitori ────────────────────────────────────────────────────────────────
export async function getFornitori() {
  const { data, error } = await supabase
    .from('fornitori')
    .select('*')
    .order('ragione_sociale')
  if (error) console.error('getFornitori:', error)
  return data ?? []
}

export async function createFornitore(payload: Record<string, unknown>) {
  const aziendaId = await getAziendaId()
  const { data, error } = await supabase
    .from('fornitori')
    .insert([{ ...payload, azienda_id: aziendaId }])
    .select()
    .single()
  if (error) console.error('createFornitore:', error)
  return data
}

// ─── Gare ─────────────────────────────────────────────────────────────────────
export async function getGare() {
  const { data, error } = await supabase
    .from('gare')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) console.error('getGare:', error)
  return data ?? []
}

export async function createGara(payload: Record<string, unknown>) {
  const aziendaId = await getAziendaId()
  const { data, error } = await supabase
    .from('gare')
    .insert([{ ...payload, azienda_id: aziendaId }])
    .select()
    .single()
  if (error) console.error('createGara:', error)
  return data
}

// ─── SAL ─────────────────────────────────────────────────────────────────────
export async function getSAL(tipo?: 'ATTIVO' | 'PASSIVO') {
  let query = supabase.from('sal').select('*, voci_sal(*)').order('created_at', { ascending: false })
  if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query
  if (error) console.error('getSAL:', error)
  return data ?? []
}

export async function updateSALStato(id: string, stato: string, approvatore: string, note: string) {
  const { data, error } = await supabase
    .from('sal')
    .update({ stato, approvatore, note_approvazione: note, data_approvazione: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
    .select()
    .single()
  if (error) console.error('updateSALStato:', error)
  return data
}

// ─── DAM ─────────────────────────────────────────────────────────────────────
export async function getDAM() {
  const { data, error } = await supabase
    .from('dam')
    .select('*, certificazioni_dam(*)')
    .order('created_at', { ascending: false })
  if (error) console.error('getDAM:', error)
  return data ?? []
}

export async function createDAM(payload: Record<string, unknown>) {
  const aziendaId = await getAziendaId()
  const { data, error } = await supabase
    .from('dam')
    .insert([{ ...payload, azienda_id: aziendaId }])
    .select()
    .single()
  if (error) console.error('createDAM:', error)
  return data
}

// ─── Contratti ────────────────────────────────────────────────────────────────
export async function getContratti() {
  const { data, error } = await supabase
    .from('contratti')
    .select('*, voci_contratto(*)')
    .order('created_at', { ascending: false })
  if (error) console.error('getContratti:', error)
  return data ?? []
}

export async function createContratto(payload: Record<string, unknown>) {
  const aziendaId = await getAziendaId()
  const { data, error } = await supabase
    .from('contratti')
    .insert([{ ...payload, azienda_id: aziendaId }])
    .select()
    .single()
  if (error) console.error('createContratto:', error)
  return data
}

// ─── Scadenzario ─────────────────────────────────────────────────────────────
export async function getScadenzeProssime(giorni = 60) {
  const dataLimite = new Date()
  dataLimite.setDate(dataLimite.getDate() + giorni)
  const { data, error } = await supabase
    .from('scadenzario')
    .select('*')
    .lte('data_scadenza', dataLimite.toISOString().slice(0, 10))
    .gte('data_scadenza', new Date().toISOString().slice(0, 10))
    .order('data_scadenza')
  if (error) console.error('getScadenzeProssime:', error)
  return data ?? []
}

// ─── Fatture ─────────────────────────────────────────────────────────────────
export async function getFatture(tipo?: 'attiva' | 'passiva') {
  let query = supabase.from('fatture').select('*').order('data_emissione', { ascending: false })
  if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query
  if (error) console.error('getFatture:', error)
  return data ?? []
}
