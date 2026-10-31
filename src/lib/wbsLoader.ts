import { DEFAULT_WBS_FLAT, WbsVoce, WbsNode, ricalcolaCodici, wbsNodesToFlat } from './wbs'

// ─── WBS: tabelle in uso ─────────────────────────────────────────────────────
//   wbs_templates  template aziendale   (id, azienda_id, codice, descrizione, parent_id, ordine, colore)
//   wbs_nodes      WBS della commessa   (id, commessa_id, azienda_id, codice, descrizione, parent_id,
//                                        template_id, ordine, colore; + label/livello legacy)
// Le tabelle legacy wbs_commessa / wbs_template NON si usano più: hanno schemi
// incompatibili (wbs_template è una libreria standard globale, senza azienda_id)
// e i fallback non hanno mai funzionato.

type TabellaWbs = 'wbs_nodes' | 'wbs_templates'

const COLONNE: Record<TabellaWbs, string> = {
  wbs_nodes:     'id,parent_id,descrizione,ordine,template_id',
  wbs_templates: 'id,parent_id,descrizione,ordine',
}

// Mappa riga DB → WbsNode
function dbToNode(r: any): WbsNode {
  return {
    id: r.id,
    parent_id: r.parent_id || null,
    etichetta: r.descrizione ?? '',
    ordine: r.ordine,
    template_id: r.template_id ?? undefined,
  }
}

export interface EsitoWbs {
  nodes: WbsNode[]
  /** valorizzato se la lettura è FALLITA (diverso da "nessun nodo") */
  error: string | null
}

// Carica WBS come WbsNode[] — per editor anagrafica e impostazioni.
// Distingue errore da vuoto: chi chiama non deve mai trattare un errore come
// "WBS assente" (es. auto-inserire un template di default).
export async function loadWbsNodes(
  supabase: any,
  table: TabellaWbs,
  filter: { commessa_id?: string; azienda_id?: string }
): Promise<EsitoWbs> {
  try {
    let q = supabase.from(table).select(COLONNE[table])
    if (filter.commessa_id) q = q.eq('commessa_id', filter.commessa_id)
    if (filter.azienda_id) q = q.eq('azienda_id', filter.azienda_id)
    const { data, error } = await q.order('ordine', { ascending: true })
    if (error) return { nodes: [], error: error.message }
    return { nodes: (data || []).map(dbToNode), error: null }
  } catch (e) {
    return { nodes: [], error: e instanceof Error ? e.message : 'Errore lettura WBS' }
  }
}

// Carica WBS come WbsVoce[] — per dropdown computo/sal/rda/oda.
// Priorità: wbs_nodes della commessa → wbs_templates dell'azienda → DEFAULT.
export async function loadWbs(
  supabase: any,
  commessaId: string,
  aziendaId: string
): Promise<WbsVoce[]> {
  const commessa = await loadWbsNodes(supabase, 'wbs_nodes', { commessa_id: commessaId, azienda_id: aziendaId })
  if (commessa.nodes.length) return wbsNodesToFlat(commessa.nodes)
  const template = await loadWbsNodes(supabase, 'wbs_templates', { azienda_id: aziendaId })
  if (template.nodes.length) return wbsNodesToFlat(template.nodes)
  return DEFAULT_WBS_FLAT
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
