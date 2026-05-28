export type WbsVoce = [string, string]

// ── Flat node format (editor + DB) ────────────────────────────────────────
export interface WbsNode {
  id: string
  parent_id: string | null
  etichetta: string
  ordine: number
  codice?: string     // computed by ricalcolaCodici, stored in DB on save
  template_id?: string // set when node was imported from wbs_templates
}

// ── DEFAULT WBS numerica gerarchica ───────────────────────────────────────
export const DEFAULT_WBS_FLAT: WbsVoce[] = [
  ['1',   'STRUTTURE'],
  ['1.1', 'Fondazioni'],
  ['1.2', 'Struttura in elevazione'],
  ['1.3', 'Solai e coperture'],
  ['2',   'FINITURE'],
  ['2.1', 'Intonaci e rasature'],
  ['2.2', 'Massetti e pavimenti'],
  ['2.3', 'Rivestimenti'],
  ['2.4', 'Controsoffitti'],
  ['2.5', 'Serramenti'],
  ['2.6', 'Tinteggiature'],
  ['3',   'IMPIANTI'],
  ['3.1', 'Impianto elettrico'],
  ['3.2', 'Impianto idro-sanitario'],
  ['3.3', 'Impianto termico'],
  ['3.4', 'Impianti speciali'],
  ['4',   'OPERE ESTERNE'],
  ['4.1', 'Sistemazioni esterne'],
  ['4.2', 'Recinzioni e cancelli'],
  ['5',   'SICUREZZA'],
  ['5.1', 'DPI e apprestamenti'],
  ['5.2', 'Oneri sicurezza'],
  ['6',   'PRELIMINARI'],
  ['6.1', 'Opere provvisionali'],
  ['6.2', 'Demolizioni e rimozioni'],
  ['6.3', 'Scavi e movimenti terra'],
  ['7',   'PROGETTAZIONE'],
  ['7.1', 'Architettonico'],
  ['7.2', 'Strutturale'],
  ['7.3', 'Impiantistico'],
  ['8',   'GESTIONE COMMESSA'],
  ['8.1', 'Controllo costi'],
  ['8.2', 'Subappalti e noli'],
]

// ── Ricalcola codici dalla posizione nell'albero ───────────────────────────
// Il codice NON viene mai salvato nel DB — viene ricalcolato al caricamento
// e dopo ogni modifica/spostamento nell'editor.
export function ricalcolaCodici(voci: WbsNode[]): WbsNode[] {
  const radici = voci
    .filter(v => !v.parent_id)
    .sort((a, b) => a.ordine - b.ordine)

  let risultato: WbsNode[] = []

  radici.forEach((radice, i) => {
    const codice = String(i + 1)
    risultato.push({ ...radice, codice })
    risultato = risultato.concat(ricalcolaFigli(voci, radice.id, codice))
  })

  return risultato
}

function ricalcolaFigli(
  tutte: WbsNode[],
  parentId: string,
  prefisso: string
): WbsNode[] {
  const figli = tutte
    .filter(v => v.parent_id === parentId)
    .sort((a, b) => a.ordine - b.ordine)

  let risultato: WbsNode[] = []
  figli.forEach((figlio, i) => {
    const codice = `${prefisso}.${i + 1}`
    risultato.push({ ...figlio, codice })
    risultato = risultato.concat(ricalcolaFigli(tutte, figlio.id, codice))
  })
  return risultato
}

// ── Conversione WbsVoce[] → WbsNode[] ─────────────────────────────────────
// genId: iniettare crypto.randomUUID in componenti client; lasciare default per il loader
export function wbsFlatToNodes(
  flat: WbsVoce[],
  genId: () => string = () => Math.random().toString(36).slice(2)
): WbsNode[] {
  const idMap: Record<string, string> = {}
  flat.forEach(([code]) => { idMap[code] = genId() })

  const ordinePerParent: Record<string, number> = {}
  return flat.map(([code, etichetta]) => {
    const parts = code.split('.')
    parts.pop()
    const parentCode = parts.join('.')
    const parent_id = parentCode ? (idMap[parentCode] || null) : null
    const key = parent_id ?? 'root'
    const ordine = ordinePerParent[key] || 0
    ordinePerParent[key] = ordine + 1
    return { id: idMap[code], parent_id, etichetta, ordine }
  })
}

// ── Conversione WbsNode[] → WbsVoce[] ─────────────────────────────────────
export function wbsNodesToFlat(nodes: WbsNode[]): WbsVoce[] {
  return ricalcolaCodici(nodes).map(n => [n.codice!, n.etichetta] as WbsVoce)
}

// ── Helpers per WbsVoce[] (dropdown computo/sal/rda/oda) ──────────────────
export function wbsLabel(flat: WbsVoce[], code: string): string {
  return Object.fromEntries(flat)[code] || code
}

export function wbsRoots(flat: WbsVoce[]): string[] {
  return flat.filter(([c]) => !c.includes('.')).map(([c]) => c)
}

export function wbsChildren(flat: WbsVoce[], parent: string): string[] {
  return flat.filter(([c]) => {
    const p = c.split('.')
    if (p.length === 1) return false
    p.pop()
    return p.join('.') === parent
  }).map(([c]) => c)
}

export function wbsParent(code: string): string | null {
  const parts = code.split('.')
  if (parts.length <= 1) return null
  parts.pop()
  return parts.join('.')
}

export function nextChildCode(flat: WbsVoce[], parent: string): string {
  const children = wbsChildren(flat, parent)
  if (children.length === 0) return `${parent}.1`
  const nums = children.map(c => {
    const parts = c.split('.')
    return parseInt(parts[parts.length - 1], 10)
  })
  return `${parent}.${Math.max(...nums) + 1}`
}

// ── Albero annidato (per computo sidebar) ─────────────────────────────────
export interface WbsTreeNode {
  code: string
  label: string
  children: WbsTreeNode[]
}

export function buildWbsTree(flat: WbsVoce[]): WbsTreeNode[] {
  const roots = wbsRoots(flat)
  function buildNode(code: string): WbsTreeNode {
    const label = wbsLabel(flat, code)
    const childCodes = wbsChildren(flat, code)
    return { code, label, children: childCodes.map(buildNode) }
  }
  return roots.map(buildNode)
}
