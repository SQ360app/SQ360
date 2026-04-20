import { NextRequest, NextResponse } from 'next/server'
import AdmZip from 'adm-zip'

export const runtime = 'nodejs'

export interface VoceParsed {
  capitolo: string
  codice: string
  descrizione: string
  um: string
  quantita: number
  prezzo_unitario: number
  importo: number
  pct_manodopera?: number
  pct_materiali?: number
  pct_noli?: number
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function getTag(xml: string, tag: string): string {
  let s = xml.indexOf('<' + tag + '>')
  if (s < 0) s = xml.indexOf('<' + tag + ' ')
  if (s < 0) return ''
  const gt = xml.indexOf('>', s)
  if (gt < 0) return ''
  const e = xml.indexOf('</' + tag + '>', gt)
  if (e < 0) return ''
  return xml.slice(gt + 1, e).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim()
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
    if (ca !== '>' && ca !== ' ' && ca !== '\n' && ca !== '\r' && ca !== '\t' && ca !== '/') { pos = si + 1; continue }
    // Self-closing?
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
  if (!s) return 0
  const c = s.replace(/[^\d,.-]/g, '')
  if (c.includes(',') && c.includes('.')) return parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(c.replace(',', '.')) || 0
}

// ── PARSER XPWE PRIMUS NATIVO ──────────────────────────────────────────────────
// Formato: <?mso-application progid="PriMus.Document.XPWE"?>
// Struttura:
//   PweDatiGenerali > PweDGCapitoliCategorie > PweDGSuperCategorie > DGSuperCategorieItem
//   PweDatiGenerali > PweDGCapitoliCategorie > PweDGCategorie > DGCategorieItem
//   PweElencoPrezzi > EPItem  (prezzario con Tariffa, DesEstesa, UnMisura, Prezzo1, IncMDO, IncMAT, IncATTR)
//   PweVociComputo  > VCItem  (IDEP → EPItem.ID, Quantita, IDSpCat, IDCat, IDSbCat)

function parsePrimusXPWE(xml: string): VoceParsed[] {
  // 1. Mappa SuperCategorie: ID → nome
  const superCatMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGSuperCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) superCatMap.set(id, nome)
  }

  // 2. Mappa Categorie: ID → nome
  const catMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) catMap.set(id, nome)
  }

  // 3. Mappa SubCategorie: ID → nome
  const subCatMap = new Map<string, string>()
  for (const item of blocks(xml, 'DGSottoCategorieItem')) {
    const id = getAttr(item, 'ID')
    const nome = getTag(item, 'DesSintetica') || getTag(item, 'DesEstesa')
    if (id && nome) subCatMap.set(id, nome)
  }

  // 4. Mappa ElencoPrezzi: ID → voce
  interface EPData { tariffa: string; desc: string; um: string; prezzo: number; incMDO: number; incMAT: number; incATTR: number }
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
    if (desc || tariffa) epMap.set(id, { tariffa, desc: desc || tariffa, um, prezzo, incMDO, incMAT, incATTR })
  }

  if (epMap.size === 0) return [] // Non è formato Primus XPWE nativo

  // 5. Leggo VCItem e unisco con EPItem
  const voci: VoceParsed[] = []
  for (const item of blocks(xml, 'VCItem')) {
    const idEP = getTag(item, 'IDEP')
    const qta = parseNum(getTag(item, 'Quantita'))
    const idSpCat = getTag(item, 'IDSpCat')
    const idCat = getTag(item, 'IDCat')
    const idSbCat = getTag(item, 'IDSbCat')

    const ep = epMap.get(idEP)
    if (!ep || !ep.desc) continue

    // Costruisco il capitolo gerarchico
    const parts: string[] = []
    if (idSpCat && idSpCat !== '0') { const n = superCatMap.get(idSpCat); if (n) parts.push(n) }
    if (idCat && idCat !== '0') { const n = catMap.get(idCat); if (n) parts.push(n) }
    if (idSbCat && idSbCat !== '0') { const n = subCatMap.get(idSbCat); if (n) parts.push(n) }
    const capitolo = parts.join(' > ') || 'Importato'

    const importo = Math.round(qta * ep.prezzo * 100) / 100
    voci.push({
      capitolo: capitolo.slice(0, 150),
      codice: (ep.tariffa || '').slice(0, 50),
      descrizione: ep.desc.slice(0, 2000),
      um: ep.um.slice(0, 10),
      quantita: qta,
      prezzo_unitario: ep.prezzo,
      importo,
      pct_manodopera: ep.incMDO,
      pct_materiali: ep.incMAT,
      pct_noli: ep.incATTR
    })
  }

  console.log('xpwe: PrimusNativo superCat=' + superCatMap.size + ' cat=' + catMap.size + ' ep=' + epMap.size + ' voci=' + voci.length)
  return voci
}

// ── FALLBACK AI ────────────────────────────────────────────────────────────────

async function parseWithClaude(xml: string, apiKey: string): Promise<VoceParsed[]> {
  const prompt = 'Sei un esperto di computi metrici edili italiani (Primus DEI). Analizza questo XML ed estrai TUTTE le voci del computo. Rispondi SOLO con JSON array (nessun markdown). Schema: [{"capitolo":"","codice":"","descrizione":"","um":"nr","quantita":0,"prezzo_unitario":0,"importo":0}]. Includi solo voci con quantita > 0 o prezzo > 0. XML: ' + xml.slice(0, 8000)
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
  })
  if (!r.ok) return []
  const d = await r.json() as { content?: Array<{ text?: string }> }
  const raw = d.content?.[0]?.text || ''
  const s = raw.indexOf('['), e = raw.lastIndexOf(']')
  if (s < 0 || e < 0) return []
  try { return JSON.parse(raw.slice(s, e + 1)) as VoceParsed[] } catch { return [] }
}

// ── MAIN ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file ricevuto' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const allContents: string[] = []

    // Prova come ZIP prima, altrimenti legge testo diretto
    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries().filter(e => !e.isDirectory && e.getData().length > 50)
        .sort((a, b) => b.getData().length - a.getData().length)
      for (const entry of entries.slice(0, 5)) {
        try { allContents.push(entry.getData().toString('utf8')) } catch { /* skip */ }
        try { allContents.push(entry.getData().toString('latin1')) } catch { /* skip */ }
      }
      console.log('xpwe: ZIP entries=' + entries.length)
    } catch {
      try { allContents.push(buffer.toString('utf8')) } catch { /* skip */ }
      try { allContents.push(buffer.toString('latin1')) } catch { /* skip */ }
      console.log('xpwe: testo diretto, head=' + buffer.toString('utf8').slice(0, 80).replace(/\n/g, ' '))
    }

    const contents = allContents.filter(c => c && c.trim().length > 50)
    if (contents.length === 0) return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })

    let voci: VoceParsed[] = []
    let bestContent = contents[0]

    for (const content of contents) {
      const v = parsePrimusXPWE(content)
      if (v.length > voci.length) { voci = v; bestContent = content }
    }

    const xmlPreview = bestContent.slice(0, 300)

    if (voci.length === 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      console.log('xpwe: parser nativo 0 voci, provo AI. head=' + xmlPreview.slice(0, 100))
      if (apiKey) {
        voci = await parseWithClaude(bestContent, apiKey)
        if (voci.length > 0) return NextResponse.json({ ok: true, voci, fonte: 'AI', totale: voci.length })
      }
      return NextResponse.json({ ok: false, errore: 'Formato non supportato', xmlPreview })
    }

    return NextResponse.json({ ok: true, voci, fonte: 'parser', totale: voci.length })
  } catch (err) {
    console.error('xpwe-parse error:', String(err))
    return NextResponse.json({ ok: false, errore: 'Errore: ' + String(err) }, { status: 500 })
  }
}
