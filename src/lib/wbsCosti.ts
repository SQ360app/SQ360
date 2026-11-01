// ─── WBS dei costi effettivi (ODA) — criterio unico per marginalità e conto economico ─
// Convenzione WBS: codice testuale (es. "1.1"), calcolato dall'ordine dei nodi della
// commessa. Chi scrive valorizza wbs_id e wbs_ref dove esistono; chi legge usa
// wbs_ref, altrimenti wbs_id.
// WBS di un ODA = oda.wbs_ref; altrimenti quella della RDA collegata (ODA → RDO → RDA):
// rda.wbs_ref, altrimenti rda.wbs_id.
// Attenzione: i codici cambiano se i nodi della WBS vengono riordinati; i riferimenti
// già salvati restano col codice precedente.

/* eslint-disable @typescript-eslint/no-explicit-any */

export const wbsDi = (r?: { wbs_ref?: string | null; wbs_id?: string | null } | null): string =>
  r?.wbs_ref || r?.wbs_id || ''

export interface CostiOdaPerWbs {
  /** importo netto degli ODA non annullati, per codice WBS */
  perWbs: Record<string, number>
  /** importo degli ODA senza WBS (né sull'ODA né sulla RDA collegata) */
  senzaWbs: number
  totale: number
}

/** Somma gli ODA non annullati della commessa per WBS (oda_stato_check: 'annullato' escluso). */
export async function costiOdaPerWbs(supabase: any, commessaId: string): Promise<CostiOdaPerWbs> {
  const [{ data: oda }, { data: rdo }, { data: rda }] = await Promise.all([
    supabase.from('oda').select('importo_netto, rdo_id, stato, wbs_ref').eq('commessa_id', commessaId),
    supabase.from('rdo').select('id, rda_id').eq('commessa_id', commessaId),
    supabase.from('rda').select('id, wbs_id, wbs_ref').eq('commessa_id', commessaId),
  ])
  const rdoToRda: Record<string, string> = {}
  for (const r of rdo || []) if (r.rda_id) rdoToRda[r.id] = r.rda_id
  const wbsRda: Record<string, string> = {}
  for (const r of rda || []) { const w = wbsDi(r); if (w) wbsRda[r.id] = w }

  const out: CostiOdaPerWbs = { perWbs: {}, senzaWbs: 0, totale: 0 }
  for (const o of oda || []) {
    if (o.stato === 'annullato') continue
    const imp = Number(o.importo_netto) || 0
    out.totale += imp
    const rdaId = o.rdo_id ? rdoToRda[o.rdo_id] : null
    const w = o.wbs_ref || (rdaId ? wbsRda[rdaId] : '')
    if (w) out.perWbs[w] = (out.perWbs[w] || 0) + imp
    else out.senzaWbs += imp
  }
  return out
}
