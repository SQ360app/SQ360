bash

cat /tmp/xpwe_route_final.ts
Output

import { NextRequest, NextResponse } from 'next/server'
import AdmZip from 'adm-zip'

export const runtime = 'nodejs'

// ── INTERFACES ────────────────────────────────────────────────────
export interface RigaMisura {
  posizione: number
  nota: string
  nr: string      // conserva espressione originale es. "3.00*2"
  a: string
  b: string
  h: string
  q_parziale: number
  is_titolo: boolean  // riga senza dimensioni = intestazione sezione
}

export interface VoceParsed {
  capitolo: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  pct_manodopera: number
  pct_materiali: number
  pct_noli: number
  misure: RigaMisura[]
}

// ── UTILITIES ─────────────────────────────────────────────────────
function getTag(xml: string, tag: string): string {
  let s = xml.indexOf('<' + tag + '>')
  if (s < 0) s = xml.indexOf('<' + tag + ' ')
  if (s < 0) return ''
  const gt = xml.indexOf('>', s)
  if (gt < 0) return ''
  if (xml[gt - 1] === '/') return '' // self-closing
  const e = xml.indexOf('</' + tag + '>', gt)
  if (e < 0) return ''
  return xml.slice(gt + 1, e)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim()
}

function getAttr(xml: string, attr: string): string {
  const p = attr + '="'
  const s = xml.indexOf(p)
  if (s < 0) return ''
  const st = s + p.length
  const en = xml.indexOf('"', st)
  return en >= 0 ? xml.slice(st, en).trim() : ''
}

function blocks(xml: string, tag: string): string[] {
  const res: string[] = []
  const open = '<' + tag
  const close = '</' + tag + '>'
  let pos = 0
  while (pos < xml.length) {
    const si = xml.indexOf(open, pos)
    if (si < 0) break
    const ca = xml[si + open.length]
    if (ca !== '>' && ca !== ' ' && ca !== '\n' && ca !== '\r' && ca !== '\t') { pos = si + 1; continue }
    const fg = xml.indexOf('>', si)
    if (fg > 0 && xml[fg - 1] === '/') { pos = fg + 1; continue }
    let depth = 1, search = si + open.length
    while (depth > 0 && search < xml.length) {
      const no = xml.indexOf(open, search)
      const nc = xml.indexOf(close, search)
      if (nc < 0) { depth = -1; break }
      if (no >= 0 && no < nc) {
        const cb = xml[no + open.length]
        if (cb === '>' || cb === ' ' || cb === '\n' || cb === '\r' || cb === '\t') { depth++; search = no + open.length }
        else { search = no + 1 }
      } else { depth--; search = nc + close.length }
    }
    if (depth === 0) { res.push(xml.slice(si, search)); pos = search }
    else { pos = si + 1 }
  }
  return res
}

function parseNum(s: string): number {
  if (!s || !s.trim()) return 0
  const c = s.trim().replace(/[^\d,.-]/g, '')
  if (!c) return 0
  if (c.includes(',') && c.includes('.')) return parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(c.replace(',', '.')) || 0
}

// ── PARSER RIGHE MISURA ───────────────────────────────────────────
// Ogni RGItem: Descrizione|PartiUguali|Lunghezza|Larghezza|HPeso|Quantita
function parseRGItem(rgXml: string, pos: number): RigaMisura {
  const nota = getTag(rgXml, 'Descrizione') || ''
  const nrRaw = getTag(rgXml, 'PartiUguali') || ''
  const aRaw = getTag(rgXml, 'Lunghezza') || ''
  const bRaw = getTag(rgXml, 'Larghezza') || ''
  const hRaw = getTag(rgXml, 'HPeso') || ''
  const qParz = parseNum(getTag(rgXml, 'Quantita'))

  // Riga titolo = ha solo Descrizione, nessuna dimensione, quantità 0
  const isTitolo = !nrRaw && !aRaw && !bRaw && !hRaw && qParz === 0

  return {
    posizione: pos,
    nota: nota.slice(0, 300),
    nr: nrRaw,   // conserva espressione originale (es. "3.00*2")
    a: aRaw,
    b: bRaw,
    h: hRaw,
    q_parziale: qParz,
    is_titolo: isTitolo
  }
}

// ── PARSER PRIMUS XPWE NATIVO ─────────────────────────────────────
function parsePrimusXPWE(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // 1. Mappa SuperCategorie
  const superCatMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGSuperCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) superCatMap.set(id, nome)
  }

  // 2. Mappa Categorie
  const catMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) catMap.set(id, nome)
  }

  // 3. Mappa SottoCategorie
  const subCatMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGSottoCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) subCatMap.set(id, nome)
  }

  // 4. Mappa ElencoPrezzi
  interface EPData {
    tariffa: string; desc: string; um: string; prezzo: number
    incMDO: number; incMAT: number; incATTR: number
  }
  const epMap = new Map<string, EPData>()
  for (const item of blocks(xml, 'EPItem')) {
    const id = getAttr(item, 'ID')
    if (!id) continue
    const tariffa = getTag(item, 'Tariffa')
    const desc = getTag(item, 'DesEstesa') || getTag(item, 'DesRidotta') || getTag(item, 'Descrizione')
    const um = getTag(item, 'UnMisura') || getTag(item, 'UnMis') || 'nr'
    const prezzo = parseNum(getTag(item, 'Prezzo1') || getTag(item, 'Prezzo'))
    const incMDO = parseNum(getTag(item, 'IncMDO'))
    const incMAT = parseNum(getTag(item, 'IncMAT'))
    const incATTR = parseNum(getTag(item, 'IncATTR'))
    if (desc || tariffa) {
      epMap.set(id, { tariffa, desc: desc || tariffa, um, prezzo, incMDO, incMAT, incATTR })
    }
  }

  if (epMap.size === 0) return []

  // 5. VCItem — voce + righe misura
  for (const item of blocks(xml, 'VCItem')) {
    const idEP = getTag(item, 'IDEP')
    const qta = parseNum(getTag(item, 'Quantita'))
    const idSpCat = getTag(item, 'IDSpCat')
    const idCat = getTag(item, 'IDCat')
    const idSbCat = getTag(item, 'IDSbCat')

    const ep = epMap.get(idEP)
    if (!ep || !ep.desc) continue

    // Capitolo gerarchico
    const parts: string[] = []
    if (idSpCat && idSpCat !== '0') { const n = superCatMap.get(idSpCat); if (n) parts.push(n) }
    if (idCat && idCat !== '0') { const n = catMap.get(idCat); if (n) parts.push(n) }
    if (idSbCat && idSbCat !== '0') { const n = subCatMap.get(idSbCat); if (n) parts.push(n) }
    const capitolo = parts.join(' > ') || 'Importato'

    // Righe misura (RGItem dentro PweVCMisure)
    const misure: RigaMisura[] = []
    const misureSection = getTag(item, 'PweVCMisure')
    if (misureSection) {
      const rgItems = blocks(misureSection, 'RGItem')
      rgItems.forEach((rg, idx) => {
        misure.push(parseRGItem(rg, idx))
      })
    }

    voci.push({
      capitolo: capitolo.slice(0, 500),
      codice: (ep.tariffa || '').slice(0, 100),
      descrizione: ep.desc.slice(0, 5000),
      um: ep.um.slice(0, 20),
      quantita: qta,
      prezzo_unitario: ep.prezzo,
      importo: Math.round(qta * ep.prezzo * 100) / 100,
      pct_manodopera: ep.incMDO,
      pct_materiali: ep.incMAT,
      pct_noli: ep.incATTR,
      misure
    })
  }

  console.log('xpwe PrimusNativo: voci=' + voci.length +
    ' misure_tot=' + voci.reduce((s, v) => s + v.misure.length, 0))
  return voci
}

// ── MAIN ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file ricevuto' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const allContents: string[] = []

    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries()
        .filter(e => !e.isDirectory && e.getData().length > 50)
        .sort((a, b) => b.getData().length - a.getData().length)
      for (const entry of entries.slice(0, 5)) {
        try { allContents.push(entry.getData().toString('utf8')) } catch { /* skip */ }
      }
      console.log('xpwe: ZIP entries=' + entries.length)
    } catch {
      try { allContents.push(buffer.toString('utf8')) } catch { /* skip */ }
      console.log('xpwe: testo diretto size=' + buffer.length)
    }

    const contents = allContents.filter(c => c && c.trim().length > 50)
    if (contents.length === 0) {
      return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })
    }

    let voci: VoceParsed[] = []
    for (const content of contents) {
      const v = parsePrimusXPWE(content)
      if (v.length > voci.length) voci = v
    }

    if (voci.length === 0) {
      const preview = contents[0].slice(0, 200)
      return NextResponse.json({ ok: false, errore: 'Formato XPWE non riconosciuto', xmlPreview: preview })
    }

    const totMisure = voci.reduce((s, v) => s + v.misure.length, 0)
    console.log('xpwe OK: voci=' + voci.length + ' misure_tot=' + totMisure)

    return NextResponse.json({
      ok: true,
      voci,
      fonte: 'parser',
      totale: voci.length,
      totale_misure: totMisure
    })

  } catch (err) {
    console.error('xpwe-parse error:', String(err))
    return NextResponse.json({ ok: false, errore: 'Errore: ' + String(err) }, { status: 500 })
  }
}
Fattobash

cat /tmp/xpwe_route_final.ts
Output

import { NextRequest, NextResponse } from 'next/server'
import AdmZip from 'adm-zip'

export const runtime = 'nodejs'

// ── INTERFACES ────────────────────────────────────────────────────
export interface RigaMisura {
  posizione: number
  nota: string
  nr: string      // conserva espressione originale es. "3.00*2"
  a: string
  b: string
  h: string
  q_parziale: number
  is_titolo: boolean  // riga senza dimensioni = intestazione sezione
}

export interface VoceParsed {
  capitolo: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  pct_manodopera: number
  pct_materiali: number
  pct_noli: number
  misure: RigaMisura[]
}

// ── UTILITIES ─────────────────────────────────────────────────────
function getTag(xml: string, tag: string): string {
  let s = xml.indexOf('<' + tag + '>')
  if (s < 0) s = xml.indexOf('<' + tag + ' ')
  if (s < 0) return ''
  const gt = xml.indexOf('>', s)
  if (gt < 0) return ''
  if (xml[gt - 1] === '/') return '' // self-closing
  const e = xml.indexOf('</' + tag + '>', gt)
  if (e < 0) return ''
  return xml.slice(gt + 1, e)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim()
}

function getAttr(xml: string, attr: string): string {
  const p = attr + '="'
  const s = xml.indexOf(p)
  if (s < 0) return ''
  const st = s + p.length
  const en = xml.indexOf('"', st)
  return en >= 0 ? xml.slice(st, en).trim() : ''
}

function blocks(xml: string, tag: string): string[] {
  const res: string[] = []
  const open = '<' + tag
  const close = '</' + tag + '>'
  let pos = 0
  while (pos < xml.length) {
    const si = xml.indexOf(open, pos)
    if (si < 0) break
    const ca = xml[si + open.length]
    if (ca !== '>' && ca !== ' ' && ca !== '\n' && ca !== '\r' && ca !== '\t') { pos = si + 1; continue }
    const fg = xml.indexOf('>', si)
    if (fg > 0 && xml[fg - 1] === '/') { pos = fg + 1; continue }
    let depth = 1, search = si + open.length
    while (depth > 0 && search < xml.length) {
      const no = xml.indexOf(open, search)
      const nc = xml.indexOf(close, search)
      if (nc < 0) { depth = -1; break }
      if (no >= 0 && no < nc) {
        const cb = xml[no + open.length]
        if (cb === '>' || cb === ' ' || cb === '\n' || cb === '\r' || cb === '\t') { depth++; search = no + open.length }
        else { search = no + 1 }
      } else { depth--; search = nc + close.length }
    }
    if (depth === 0) { res.push(xml.slice(si, search)); pos = search }
    else { pos = si + 1 }
  }
  return res
}

function parseNum(s: string): number {
  if (!s || !s.trim()) return 0
  const c = s.trim().replace(/[^\d,.-]/g, '')
  if (!c) return 0
  if (c.includes(',') && c.includes('.')) return parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(c.replace(',', '.')) || 0
}

// ── PARSER RIGHE MISURA ───────────────────────────────────────────
// Ogni RGItem: Descrizione|PartiUguali|Lunghezza|Larghezza|HPeso|Quantita
function parseRGItem(rgXml: string, pos: number): RigaMisura {
  const nota = getTag(rgXml, 'Descrizione') || ''
  const nrRaw = getTag(rgXml, 'PartiUguali') || ''
  const aRaw = getTag(rgXml, 'Lunghezza') || ''
  const bRaw = getTag(rgXml, 'Larghezza') || ''
  const hRaw = getTag(rgXml, 'HPeso') || ''
  const qParz = parseNum(getTag(rgXml, 'Quantita'))

  // Riga titolo = ha solo Descrizione, nessuna dimensione, quantità 0
  const isTitolo = !nrRaw && !aRaw && !bRaw && !hRaw && qParz === 0

  return {
    posizione: pos,
    nota: nota.slice(0, 300),
    nr: nrRaw,   // conserva espressione originale (es. "3.00*2")
    a: aRaw,
    b: bRaw,
    h: hRaw,
    q_parziale: qParz,
    is_titolo: isTitolo
  }
}

// ── PARSER PRIMUS XPWE NATIVO ─────────────────────────────────────
function parsePrimusXPWE(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // 1. Mappa SuperCategorie
  const superCatMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGSuperCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) superCatMap.set(id, nome)
  }

  // 2. Mappa Categorie
  const catMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) catMap.set(id, nome)
  }

  // 3. Mappa SottoCategorie
  const subCatMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGSottoCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) subCatMap.set(id, nome)
  }

  // 4. Mappa ElencoPrezzi
  interface EPData {
    tariffa: string; desc: string; um: string; prezzo: number
    incMDO: number; incMAT: number; incATTR: number
  }
  const epMap = new Map<string, EPData>()
  for (const item of blocks(xml, 'EPItem')) {
    const id = getAttr(item, 'ID')
    if (!id) continue
    const tariffa = getTag(item, 'Tariffa')
    const desc = getTag(item, 'DesEstesa') || getTag(item, 'DesRidotta') || getTag(item, 'Descrizione')
    const um = getTag(item, 'UnMisura') || getTag(item, 'UnMis') || 'nr'
    const prezzo = parseNum(getTag(item, 'Prezzo1') || getTag(item, 'Prezzo'))
    const incMDO = parseNum(getTag(item, 'IncMDO'))
    const incMAT = parseNum(getTag(item, 'IncMAT'))
    const incATTR = parseNum(getTag(item, 'IncATTR'))
    if (desc || tariffa) {
      epMap.set(id, { tariffa, desc: desc || tariffa, um, prezzo, incMDO, incMAT, incATTR })
    }
  }

  if (epMap.size === 0) return []

  // 5. VCItem — voce + righe misura
  for (const item of blocks(xml, 'VCItem')) {
    const idEP = getTag(item, 'IDEP')
    const qta = parseNum(getTag(item, 'Quantita'))
    const idSpCat = getTag(item, 'IDSpCat')
    const idCat = getTag(item, 'IDCat')
    const idSbCat = getTag(item, 'IDSbCat')

    const ep = epMap.get(idEP)
    if (!ep || !ep.desc) continue

    // Capitolo gerarchico
    const parts: string[] = []
    if (idSpCat && idSpCat !== '0') { const n = superCatMap.get(idSpCat); if (n) parts.push(n) }
    if (idCat && idCat !== '0') { const n = catMap.get(idCat); if (n) parts.push(n) }
    if (idSbCat && idSbCat !== '0') { const n = subCatMap.get(idSbCat); if (n) parts.push(n) }
    const capitolo = parts.join(' > ') || 'Importato'

    // Righe misura (RGItem dentro PweVCMisure)
    const misure: RigaMisura[] = []
    const misureSection = getTag(item, 'PweVCMisure')
    if (misureSection) {
      const rgItems = blocks(misureSection, 'RGItem')
      rgItems.forEach((rg, idx) => {
        misure.push(parseRGItem(rg, idx))
      })
    }

    voci.push({
      capitolo: capitolo.slice(0, 500),
      codice: (ep.tariffa || '').slice(0, 100),
      descrizione: ep.desc.slice(0, 5000),
      um: ep.um.slice(0, 20),
      quantita: qta,
      prezzo_unitario: ep.prezzo,
      importo: Math.round(qta * ep.prezzo * 100) / 100,
      pct_manodopera: ep.incMDO,
      pct_materiali: ep.incMAT,
      pct_noli: ep.incATTR,
      misure
    })
  }

  console.log('xpwe PrimusNativo: voci=' + voci.length +
    ' misure_tot=' + voci.reduce((s, v) => s + v.misure.length, 0))
  return voci
}

// ── MAIN ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file ricevuto' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const allContents: string[] = []

    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries()
        .filter(e => !e.isDirectory && e.getData().length > 50)
        .sort((a, b) => b.getData().length - a.getData().length)
      for (const entry of entries.slice(0, 5)) {
        try { allContents.push(entry.getData().toString('utf8')) } catch { /* skip */ }
      }
      console.log('xpwe: ZIP entries=' + entries.length)
    } catch {
      try { allContents.push(buffer.toString('utf8')) } catch { /* skip */ }
      console.log('xpwe: testo diretto size=' + buffer.length)
    }

    const contents = allContents.filter(c => c && c.trim().length > 50)
    if (contents.length === 0) {
      return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })
    }

    let voci: VoceParsed[] = []
    for (const content of contents) {
      const v = parsePrimusXPWE(content)
      if (v.length > voci.length) voci = v
    }

    if (voci.length === 0) {
      const preview = contents[0].slice(0, 200)
      return NextResponse.json({ ok: false, errore: 'Formato XPWE non riconosciuto', xmlPreview: preview })
    }

    const totMisure = voci.reduce((s, v) => s + v.misure.length, 0)
    console.log('xpwe OK: voci=' + voci.length + ' misure_tot=' + totMisure)

    return NextResponse.json({
      ok: true,
      voci,
      fonte: 'parser',
      totale: voci.length,
      totale_misure: totMisure
    })

  } catch (err) {
    console.error('xpwe-parse error:', String(err))
    return NextResponse.json({ ok: false, errore: 'Errore: ' + String(err) }, { status: 500 })
  }
}
