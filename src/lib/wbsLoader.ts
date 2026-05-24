import { DEFAULT_WBS_FLAT, WbsVoce } from './wbs'

export async function loadWbs(
  supabase: any,
  commessaId: string,
  aziendaId: string
): Promise<WbsVoce[]> {
  try {
    // Priority 1: commessa-specific WBS
    const { data: commessaWbs } = await supabase
      .from('wbs_commessa')
      .select('codice, etichetta')
      .eq('commessa_id', commessaId)
      .order('ordine', { ascending: true })

    if (commessaWbs && commessaWbs.length > 0) {
      return commessaWbs.map((r: any) => [r.codice, r.etichetta] as WbsVoce)
    }

    // Priority 2: azienda-level template
    const { data: templateWbs } = await supabase
      .from('wbs_template')
      .select('codice, etichetta')
      .eq('azienda_id', aziendaId)
      .order('ordine', { ascending: true })

    if (templateWbs && templateWbs.length > 0) {
      return templateWbs.map((r: any) => [r.codice, r.etichetta] as WbsVoce)
    }
  } catch {
    // Tables may not exist yet — fall through to default
  }

  return DEFAULT_WBS_FLAT
}
