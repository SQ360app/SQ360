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
}

function stripCDATA(text: string): string {
  const marker = '<![CDATA['
  const s = text.indexOf(marker)
  if (s >= 0) {
    const e = text.indexOf(']]>', s)
    if (e >= 0) return text.slice(s + 9, e)
  }
  return text
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').trim()
}

function extractTag(xml: string, tagName: string): string {
  const open = '<' + tagName
  const close = '</' + tagName + '>'
  const si = xml.indexOf(open)
  if (si < 0) return ''
  const ei = xml.indexOf('>', si)
  if (ei < 0) return ''
  const ci = xml.indexOf(close, ei)
  if (ci < 0) return ''
  return stripTags(stripCDATA(xml.slice(ei + 1, ci))).trim()
}

function extractAttr(xml: string, attrName: string): string {
  const pattern = attrName + '="'
  const si = xml.indexOf(pattern)
  if (si < 0) return ''
  const start = si + pattern.length
  const end = xml.indexOf('"', start)
  if (end < 0) return ''
  return xml.slice(start, end).trim()
}

function tagFirst(xml: string, ...names: string[]): string {
  for (const name of names) {
    const v = extractTag(xml, name)
    if (v) return v
    const a = extractAttr(xml, name)
    if (a) return a
  }
  return ''
}

function attrFirst(xml: string, ...names: string[]): string {
  for (const name of names) {
    const v = extractAttr(xml, name)
    if (v) return v
  }
  return ''
}

function splitBlocks(xml: string, tagName: string): string[] {
  const blocks: string[] = []
  const open = '<' + tagName
  const close = '</' + tagName + '>'
  let pos = 0
  while (true) {
    const si = xml.indexOf(open, pos)
    if (si < 0) break
    const ei = xml.indexOf(close, si)
    if (ei < 0) break
    blocks.push(xml.slice(si, ei + close.length))
    pos = ei + close.length
  }
  return blocks
}

function findBlocks(xml: string, ...names: string[]): string[] {
  for (const name of names) {
    const blocks = splitBlocks(xml, name)
    if (blocks.length > 0) return blocks
  }
  return []
}

function parseNum(s: string): number {
  if (!s) return 0
  const c = s.replace(/[^0-9,.-]/g, '')
  if (c.includes(',') && c.includes('.')) {
    return parseFloat(c.replace('.', '').replace(',', '.')) || 0
  }
  return parseFloat(c.replace(',', '.')) || 0
}

function extractVoce(v: string, capitolo: string, idx: number): VoceParsed | null {
  const tipo = attrFirst(v, 'TipoVoce', 'Tipo', 'Type')
  if (['U','T','S','G','H'].includes(tipo.toUpperCase())) return null

  const desc = tagFirst(v,
    'Descrizione', 'DescrizioneVoce', 'DescrizioneArticolo',
    'Description', 'Testo', 'DesBreve', 'Oggetto', 'TestoBreve'
  )
  if (!desc || desc.length < 3) return null

  const cod = tagFirst(v, 'Codice', 'CodiceVoce', 'CodiceArticolo', 'CodBreve', 'Code', 'Tariffa')
    || attrFirst(v, 'ID', 'Codice') || ('V' + idx)

  const um = tagFirst(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit', 'Unita', 'UdM') || 'nr'
  const pu = parseNum(tagFirst(v, 'PrezzoUnitario', 'PrezzoArticolo', 'Prezzo', 'PU', 'Price', 'CostoUnitario'))
  const qt = parseNum(tagFirst(v, 'Quantita', 'QuantitaArticolo', 'QuantitaTotale', 'SommaMisure', 'Qt', 'Qta', 'Qty', 'TotaleQuantita'))

  return {
    capitolo: capitolo.slice(0, 100),
    codice: cod.slice(0, 30),
    descrizione: desc.slice(0, 500),
    um: um.slice(0, 10),
    quantita: qt,
    prezzo_unitario: pu,
    importo: qt * pu
  }
}

function parseXML(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  const capBlocks = findBlocks(xml,
    'RamoDeiVoci', 'CapitoloDeiVoci', 'CapitoloSintesi', 'CapitoloComputo',
    'Capitolo', 'Chapter', 'GruppoArticoli', 'GruppoVoci', 'NodoAlbero',
    'SezioneComputo', 'Gruppo', 'WBS'
  )

  if (capBlocks.length > 0) {
    for (const cap of capBlocks) {
      const nomeCap = attrFirst(cap, 'Descrizione', 'Description', 'Nome', 'Name', 'Titolo')
        || tagFirst(cap, 'Descrizione', 'Nome', 'Titolo') || 'Capitolo'

      const voceBlocks = findBlocks(cap,
        'VersoVoce', 'VoceAlbero', 'VersoDeiVoci', 'SintesiArticolo', 'VoceComputo',
        'Voce', 'Articolo', 'Item', 'Row', 'Lavorazione', 'NodoVoce',
        'VoceElemento', 'ElementoComputo', 'ArticoloComputo', 'Prestazione'
      )

      for (let i = 0; i < voceBlocks.length; i++) {
        const v = extractVoce(voceBlocks[i], nomeCap, voci.length + 1)
        if (v) voci.push(v)
      }
    }
    if (voci.length > 0) return voci
  }

  const flatNames = [
    'Voce', 'VoceComputo', 'Item', 'Row', 'Lavorazione', 'Articolo',
    'VoceElemento', 'ElementoComputo', 'SintesiArticolo', 'ArticoloComputo',
    'Prestazione', 'RigaComputo'
  ]
  for (const name of flatNames) {
    const blocks = splitBlocks(xml, name)
    if (blocks.length < 1) continue
    for (let i = 0; i < blocks.length; i++) {
      const cap = tagFirst(blocks[i], 'Capitolo', 'Categoria', 'Gruppo', 'Sezione')
        || attrFirst(blocks[i], 'Capitolo') || 'Importato'
      const v = extractVoce(blocks[i], cap, voci.length + 1)
      if (v) voci.push(v)
    }
    if (voci.length > 0) return voci
  }

  return voci
}

async function parseWithClaude(xml: string, apiKey: string): Promise<VoceParsed[]> {
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: 'Sei un esperto di computi metrici edili italiani. Analizza questo XML esportato da Primus/DEI ed estrai TUTTE le voci del computo metrico. Rispondi SOLO con JSON array senza markdown. Schema per voce: {"capitolo":"","codice":"","descrizione":"","um":"nr","quantita":0,"prezzo_unitario":0,"importo":0}. XML: ' + xml.slice(0, 8000)
    }]
  })
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body
  })
  if (!r.ok) return []
  const d = await r.json() as { content?: Array<{ text?: string }> }
  const raw = d.content?.[0]?.text || ''
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end < 0) return []
  try {
    return JSON.parse(raw.slice(start, end + 1)) as VoceParsed[]
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ ok: false, errore: 'Nessun file ricevuto' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const allContents: string[] = []

    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries()
        .filter(e => !e.isDirectory && e.getData().length > 50)
        .sort((a, b) => b.getData().length - a.getData().length)

      for (const entry of entries.slice(0, 5)) {
        try { allContents.push(entry.getData().toString('utf8')) } catch { /* skip */ }
        try { allContents.push(entry.getData().toString('latin1')) } catch { /* skip */ }
      }
    } catch {
      try { allContents.push(buffer.toString('utf8')) } catch { /* skip */ }
      try { allContents.push(buffer.toString('latin1')) } catch { /* skip */ }
    }

    const contents = allContents.filter(c => c && c.trim().length > 50)
    if (contents.length === 0) {
      return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })
    }

    let voci: VoceParsed[] = []
    let bestContent = contents[0]
    for (const content of contents) {
      const v = parseXML(content)
      if (v.length > voci.length) {
        voci = v
        bestContent = content
      }
    }

    if (voci.length === 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      const xmlPreview = bestContent.slice(0, 400)
      console.log('xpwe-parse fallback AI, xmlPreview:', xmlPreview.slice(0, 200))

      if (apiKey) {
        voci = await parseWithClaude(bestContent, apiKey)
        if (voci.length > 0) {
          return NextResponse.json({ ok: true, voci, fonte: 'AI', totale: voci.length })
        }
      }

      return NextResponse.json({
        ok: false,
        errore: 'Formato XPWE non riconosciuto',
        xmlPreview
      })
    }

    re
