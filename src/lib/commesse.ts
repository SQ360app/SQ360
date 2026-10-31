// ─── Commesse operative (non archiviate) ─────────────────────────────────────
// Una commessa archiviata (commesse.archiviata_at valorizzato) conserva tutti i
// dati ma non deve comparire in lista operativa, dashboard e mappa, né pesare
// sui KPI. Le viste (es. v_commesse_kpi) non hanno la colonna archiviata_at:
// si filtrano nel codice con gli id restituiti da qui.

/** Id delle commesse non archiviate visibili all'utente (RLS). */
export async function idCommesseOperative(supabase: any): Promise<string[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from('commesse').select('id').is('archiviata_at', null)
  if (error) throw new Error(`Errore lettura commesse: ${error.message}`)
  return (data || []).map((c: { id: string }) => c.id)
}
