import { DEFAULT_WBS_FLAT, WbsVoce, WbsNode, ricalcolaCodici, wbsFlatToNodes, wbsNodesToFlat } from './wbs'

// Mappa riga DB → WbsNode — supporta sia 'descrizione' (nuovo) che 'etichetta' (legacy)
function dbToNode(r: any): WbsNode {
  return {
    id: r.id,
    parent_id: r.parent_id || null,
    etichetta: r.descrizione ?? r.etichetta ?? '',
    ordine: r.ordine,
    template_id: r.template_id ?? undefined,
  }
}

// Carica WBS come WbsVoce[] — per dropdown computo/sal/rda/oda.
// Priorità: wbs_nodes commessa → wbs_commessa (legacy) → wbs_templates azienda → wbs_template (legacy) → DEFAULT.
export async function loadWbs(
  supabase: any,
  commessaId: string,
  aziendaId: string
): Promise<WbsVoce[]> {
  try {
    const { data: nd } = await supabase
      .from('wbs_nodes')
      .select('id,parent_id,descrizione,ordine')
      .eq('commessa_id', commessaId)
      .eq('azienda_id', aziendaId)
      .order('ordine', { ascending: true })
    if (nd?.length) return wbsNodesToFlat(nd.map(dbToNode))
  } catch {}

  try {
    const { data: cw } = await supabase
      .from('wbs_commessa')
      .select('id,parent_id,etichetta,ordine')
      .eq('commessa_id', commessaId)
      .order('ordine', { ascending: true })
    if (cw?.length) return wbsNodesToFlat(cw.map(dbToNode))
  } catch {}

  try {
    const { data: td } = await supabase
      .from('wbs_templates')
      .select('id,parent_id,descrizione,ordine')
      .eq('azienda_id', aziendaId)
      .order('ordine', { ascending: true })
    if (td?.length) return wbsNodesToFlat(td.map(dbToNode))
  } catch {}

  try {
    const { data: tw } = await supabase
      .from('wbs_template')
      .select('id,parent_id,etichetta,ordine')
      .eq('azienda_id', aziendaId)
      .order('ordine', { ascending: true })
    if (tw?.length) return wbsNodesToFlat(tw.map(dbToNode))
  } catch {}

  return DEFAULT_WBS_FLAT
}

// Carica WBS come WbsNode[] — per editor anagrafica e impostazioni.
export async function loadWbsNodes(
  supabase: any,
  table: 'wbs_nodes' | 'wbs_templates' | 'wbs_commessa' | 'wbs_template',
  filter: { commessa_id?: string; azienda_id?: string }
): Promise<WbsNode[]> {
  const isNew = table === 'wbs_nodes' || table === 'wbs_templates'
  const col = isNew ? 'descrizione' : 'etichetta'
  const extraCol = isNew ? ',template_id' : ''
  try {
    let q = supabase.from(table).select(`id,parent_id,${col},ordine${extraCol}`)
    if (filter.commessa_id) q = q.eq('commessa_id', filter.commessa_id)
    if (filter.azienda_id) q = q.eq('azienda_id', filter.azienda_id)
    const { data } = await q.order('ordine', { ascending: true })
    if (data?.length) return data.map(dbToNode)
  } catch {}
  return []
}

// Costruisce payload DB per INSERT su wbs_nodes o wbs_templates.
// Aggiunge codice calcolato da ricalcolaCodici + mappa etichetta → descrizione.
export function buildWbsInsertPayload(
  nodes: WbsNode[],
  extra: Record<string, unknown>
): Record<string, unknown>[] {
  const ordered = ricalcolaCodici(nodes)
  return ordered.map(n => ({
    id: n.id,
    parent_id: n.parent_id,
    descrizione: n.etichetta,
    codice: n.codice || '',
    ordine: n.ordine,
    ...extra,
  }))
}
