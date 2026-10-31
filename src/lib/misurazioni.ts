// ─── Misurazioni computo (tabella voci_computo_misurazioni) ──────────────────
// Schema reale DB: id, voce_computo_id, descrizione, parti_uguali, lunghezza,
// larghezza, altezza_peso, formula, quantita_calc, is_negativo, is_parziale,
// ordine, flags, rif_idvv, created_at — tutte nullable.
//
// Formato XPWE PriMus: <PweVCMisure><RGItem> con Descrizione, PartiUguali,
// Lunghezza, Larghezza, HPeso, Quantita, Flags, IDVV.
//   Flags & 1      → riga in deduzione ("a detrarre"), Quantita già negativa
//   Flags & 32768  → "vedi voce": quantità ripresa dalla voce con ID = IDVV
//   IDVV = -2      → nessun collegamento

export interface Misurazione {
  id: string
  voce_computo_id: string
  descrizione: string | null
  parti_uguali: number | null
  lunghezza: number | null
  larghezza: number | null
  altezza_peso: number | null
  formula: string | null
  quantita_calc: number | null
  is_negativo: boolean | null
  is_parziale: boolean | null
  flags: number | null
  rif_idvv: number | null
  ordine: number | null
}

export type DimField = 'parti_uguali' | 'lunghezza' | 'larghezza' | 'altezza_peso'
export const DIM_FIELDS: DimField[] = ['parti_uguali', 'lunghezza', 'larghezza', 'altezza_peso']

export const FLAG_DEDUZIONE = 1
export const FLAG_VEDI_VOCE = 32768

// ─── Colonna `formula` ───────────────────────────────────────────────────────
// Contiene il testo originale delle formule per campo e il riferimento "vedi voce":
//   "VV=Vedi voce n. 21 (A.01.002) · L=(14.05+1.30)/2 · H=(2.10+2.96)/2"
const FORMULA_KEY: Record<DimField, string> = {
  parti_uguali: 'PU', lunghezza: 'L', larghezza: 'La', altezza_peso: 'H',
}
const SEP = ' · '

export interface FormulaParsed {
  rif: string | null
  campi: Partial<Record<DimField, string>>
}

export function parseFormula(formula: string | null | undefined): FormulaParsed {
  const out: FormulaParsed = { rif: null, campi: {} }
  if (!formula) return out
  for (const seg of formula.split(SEP)) {
    const eq = seg.indexOf('=')
    if (eq < 0) continue
    const key = seg.slice(0, eq)
    const val = seg.slice(eq + 1)
    if (key === 'VV') { out.rif = val; continue }
    const field = DIM_FIELDS.find(f => FORMULA_KEY[f] === key)
    if (field) out.campi[field] = val
  }
  return out
}

export function buildFormula(f: FormulaParsed): string | null {
  const segs: string[] = []
  if (f.rif) segs.push(`VV=${f.rif}`)
  for (const field of DIM_FIELDS) {
    const t = f.campi[field]
    if (t) segs.push(`${FORMULA_KEY[field]}=${t}`)
  }
  return segs.length ? segs.join(SEP) : null
}

// ─── Numeri e formule PriMus ─────────────────────────────────────────────────

/** Valuta un'espressione aritmetica (+ - * / parentesi). Nessun eval: parser dedicato. */
export function valutaEspressione(raw: string): number | null {
  const s = raw.replace(/[\s  ]/g, '').replace(/,/g, '.')
  if (!s || !/^[0-9.+\-*/()]+$/.test(s)) return null
  let i = 0
  const fail = (): never => { throw new Error('espressione non valida') }
  const expr = (): number => {
    let v = term()
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r }
    return v
  }
  const term = (): number => {
    let v = factor()
    while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const r = factor(); v = op === '*' ? v * r : v / r }
    return v
  }
  const factor = (): number => {
    if (s[i] === '-') { i++; return -factor() }
    if (s[i] === '+') { i++; return factor() }
    if (s[i] === '(') { i++; const v = expr(); if (s[i++] !== ')') fail(); return v }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i))
    if (!m) fail()
    i += m![0].length
    return parseFloat(m![0])
  }
  try {
    const v = expr()
    if (i !== s.length || !Number.isFinite(v)) return null
    return Math.round(v * 1e6) / 1e6
  } catch { return null }
}

/**
 * Legge un campo numerico XPWE: vuoto → null; "3 679.00" → 3679;
 * formula "(14.05+1.30)/2" → valore calcolato + testo originale in `formula`.
 */
export function parseValoreXpwe(raw: string | null | undefined): { valore: number | null; formula: string | null } {
  const t = (raw ?? '').trim()
  if (!t) return { valore: null, formula: null }
  const compatto = t.replace(/[\s  ]/g, '')
  if (/^[+-]?(\d+[.,]?\d*|[.,]\d+)$/.test(compatto)) {
    return { valore: parseFloat(compatto.replace(',', '.')), formula: null }
  }
  return { valore: valutaEspressione(compatto), formula: t }
}

// ─── Logica riga ─────────────────────────────────────────────────────────────

export const isDeduzione = (m: Pick<Misurazione, 'is_negativo' | 'flags'>) =>
  m.is_negativo === true || ((m.flags ?? 0) & FLAG_DEDUZIONE) !== 0

export const isVediVoce = (m: Pick<Misurazione, 'flags'>) =>
  ((m.flags ?? 0) & FLAG_VEDI_VOCE) !== 0

/** Prodotto dei soli campi valorizzati (semantica PriMus); null se tutti vuoti. Segno negativo per le deduzioni. */
export function calcolaQuantita(m: Pick<Misurazione, DimField | 'is_negativo' | 'flags'>): number | null {
  const vals = DIM_FIELDS.map(f => m[f]).filter((v): v is number => v !== null && v !== undefined)
  if (vals.length === 0) return null
  const p = vals.reduce((a, b) => a * b, 1)
  const q = isDeduzione(m) ? -Math.abs(p) : p
  return Math.round(q * 1e4) / 1e4
}

export const sommaQuantita = (rows: Misurazione[]) =>
  Math.round(rows.reduce((s, m) => s + (m.quantita_calc ?? 0), 0) * 1e4) / 1e4

/** Numero per la griglia: vuoto se null. */
export const fmtMis = (n: number | null | undefined, dec = 3) =>
  n === null || n === undefined ? '' : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: dec })

// ─── Caricamento ─────────────────────────────────────────────────────────────

/** Tutte le misurazioni delle voci di un computo, raggruppate per voce (paginato: >1000 righe). */
export async function caricaMisurazioni(db: any, computoId: string): Promise<Record<string, Misurazione[]>> {
  const PAGE = 1000
  const all: Misurazione[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('voci_computo_misurazioni')
      .select('id,voce_computo_id,descrizione,parti_uguali,lunghezza,larghezza,altezza_peso,formula,quantita_calc,is_negativo,is_parziale,flags,rif_idvv,ordine,voci_computo!inner(computo_id)')
      .eq('voci_computo.computo_id', computoId)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Errore caricamento misurazioni: ${error.message}`)
    const rows = (data || []) as (Misurazione & { voci_computo?: unknown })[]
    for (const { voci_computo: _vc, ...m } of rows) all.push(m as Misurazione)
    if (rows.length < PAGE) break
  }
  const map: Record<string, Misurazione[]> = {}
  for (const m of all) (map[m.voce_computo_id] ||= []).push(m)
  for (const k in map) map[k].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0))
  return map
}
