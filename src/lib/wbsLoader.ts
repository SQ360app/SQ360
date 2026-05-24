import { DEFAULT_WBS_FLAT, WbsVoce, WbsNode, ricalcolaCodici, wbsFlatToNodes, wbsNodesToFlat } from './wbs'

// Carica WBS come WbsVoce[] — usato da computo/sal/rda/oda per i dropdown.
// Priorità: WBS commessa → template azienda → DEFAULT.
// Il codice numerico è sempre ricalcolato dalla posizione, mai letto dal DB.
export async function loadWbs(
  supabase: any,
  commessaId: string,
  aziendaId: string
): Promise<WbsVoce[]> {
  try {
    const { data: commessaWbs } = await supabase
      .from('wbs_commessa')
      .select('id, parent_id, etichetta, ordine')
      .eq('commessa_id', commessaId)
      .order('ordine', { ascending: true })

    if (commessaWbs && commessaWbs.length > 0) {
      const nodes: WbsNode[] = commessaWbs.map((r: any) => ({
        id: r.id, parent_id: r.parent_id || null, etichetta: r.etichetta, ordine: r.ordine,
      }))
      return wbsNodesToFlat(nodes)
    }

    const { data: templateWbs } = await supabase
      .from('wbs_template')
      .select('id, parent_id, etichetta, ordine')
      .eq('azienda_id', aziendaId)
      .order('ordine', { ascending: true })

    if (templateWbs && templateWbs.length > 0) {
      const nodes: WbsNode[] = templateWbs.map((r: any) => ({
        id: r.id, parent_id: r.parent_id || null, etichetta: r.etichetta, ordine: r.ordine,
      }))
      return wbsNodesToFlat(nodes)
    }
  } catch {
    // Tabelle non ancora create — usa il default
  }

  return DEFAULT_WBS_FLAT
}

// Carica WBS come WbsNode[] — usato dagli editor (anagrafica, impostazioni).
// Restituisce i nodi con id reali dal DB per preservare parent_id refs.
export async function loadWbsNodes(
  supabase: any,
  table: 'wbs_commessa' | 'wbs_template',
  filter: { commessa_id?: string; azienda_id?: string }
): Promise<WbsNode[]> {
  try {
    let q = supabase.from(table).select('id, parent_id, etichetta, ordine')
    if (filter.commessa_id) q = q.eq('commessa_id', filter.commessa_id)
    if (filter.azienda_id)  q = q.eq('azienda_id', filter.azienda_id)
    const { data } = await q.order('ordine', { ascending: true })
    if (data && data.length > 0) {
      return data.map((r: any) => ({
        id: r.id, parent_id: r.parent_id || null, etichetta: r.etichetta, ordine: r.ordine,
      }))
    }
  } catch {}

  return []
}
