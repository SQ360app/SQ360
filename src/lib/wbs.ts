export type WbsVoce = [string, string]

export const DEFAULT_WBS_FLAT: WbsVoce[] = [
  ['F01','FASE PRELIMINARE'],['F01.01','Apertura commessa'],
  ['F02','PROGETTAZIONE'],['F02.01','Progett. architettonica'],['F02.02','Strutturale'],['F02.03','Impianti'],
  ['F03','APPROVVIGIONAMENTI'],['F03.01','Materiali strutturali'],['F03.02','Finiture'],['F03.03','Noleggi'],['F03.04','Contratti sub'],
  ['F04','CANTIERE'],['F04.01','Opere preliminari'],['F04.02','Demolizioni'],['F04.03','Scavi'],
  ['F04.04','Fondazioni'],['F04.05','Struttura in elevazione'],['F04.06','Solaio e copertura'],
  ['F04.07','Tamponamenti'],['F04.08','Intonaci'],['F04.09','Massetti e pavimenti'],
  ['F04.10','Serramenti'],['F04.11','Tinteggiature'],
  ['F05','IMPIANTI'],['F05.01','Impianto elettrico'],['F05.02','Idro-sanitario'],['F05.03','Termico'],
  ['F06','OPERE ESTERNE'],['F06.01','Pavimentazioni esterne'],['F06.02','Recinzioni'],
  ['F07','SICUREZZA'],['F07.01','DPI'],['F07.02','Apprestamenti'],
  ['F08','GESTIONE ECONOMICA'],['F08.01','Controllo budget'],['F08.02','Fatturazione'],
]

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
  if (children.length === 0) return `${parent}.01`
  const nums = children.map(c => {
    const parts = c.split('.')
    return parseInt(parts[parts.length - 1], 10)
  })
  const next = Math.max(...nums) + 1
  return `${parent}.${String(next).padStart(2, '0')}`
}

export interface WbsNode {
  code: string
  label: string
  children: WbsNode[]
}

export function buildWbsTree(flat: WbsVoce[]): WbsNode[] {
  const roots = wbsRoots(flat)
  function buildNode(code: string): WbsNode {
    const label = wbsLabel(flat, code)
    const childCodes = wbsChildren(flat, code)
    return { code, label, children: childCodes.map(buildNode) }
  }
  return roots.map(buildNode)
}
