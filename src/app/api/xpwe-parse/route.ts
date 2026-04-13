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
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractTag(xml: string, tagName: string): string {
  const open = '<' + tagName
  const close = '</' + tagName + '>'
  let si = 0
  while (si < xml.length) {
    const found = xml.indexOf(open, si)
    if (found < 0) return ''
    const ca = xml[found + open.length]
    if (ca === '>' || ca === ' ' || ca === '\n' || ca === '\r' || ca === '\t') {
      const ei = xml.indexOf('>', found)
      if (ei < 0) return ''
      const ci = xml.indexOf(close, ei)
      if (ci < 0) return ''
      return stripTags(stripCDATA(xml.slice(ei + 1, ci))).trim()
    }
    si = found + 1
  }
  return ''
}

function extractAttr(xml: string, attrName: string): string {
  const pat1 = attrName + '="'
  const si1 = xml.indexOf(pat1)
  if (si1 >= 0) {
    const s = si1 + pat1.length
    const e = xml.indexOf('"', s)
    if (e >= 0) return xml.slice(s, e).trim()
  }
  const pat2 = attrName + "='"
  const si2 = xml.indexOf(pat2)
  if (si2 >= 0) {
    const s = si2 + pat2.length
    const e = xml.indexOf("'", s)
    if (e >= 0) return xml.slice(s, e).trim()
  }
  return ''
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

// Parser bilanciato — gestisce tag annidati dello stesso tipo
function splitBlocksBalanced(xml: string, tagName: string): string[] {
  const blocks: string[] = []
  const open = '<' + tagName
  const close = '</' + tagName + '>'
  let pos = 0

  while (pos < xml.length) {
    const si = xml.indexOf(open, pos)
    if (si < 0) break

    // Verifica che sia esattamente questo tag (non un prefisso)
    const charAfter = xml[si + open.length]
    if (charAfter !== '>' && charAfter !== ' ' && charAfter !== '\n' && charAfter !== '\r' && charAfter !== '\t' && charAfter !== '/') {
      pos = si + 1
      continue
    }

    // Conta profondità di annidamento
    let depth = 1
    let search = si + open.length

    while (depth > 0 && search < xml.length) {
      const nextOpen = xml.indexOf(open, search)
      const nextClose = xml.indexOf(close, search)

      if (nextClose < 0) { depth = -1; break }

      if (nextOpen >= 0 && nextOpen < nextClose) {
        const ca = xml[nextOpen + open.length]
        if (ca === '>' || ca === ' ' || ca === '\n' || ca === '\r' || ca === '\t') {
          depth++
          search = nextOpen + open.length
        } else {
          search = nextOpen + 1
        }
      } else {
        depth--
        search = nextClose + close.length
      }
    }

    if (depth === 0) {
      blocks.push(xml.slice(si, search))
      pos = search
    } else {
      pos = si + 1
    }
  }
  return blocks
}

function findBlocks(xml: string, ...names: string[]): string[] {
  for (const name of names) {
    const b = splitBlocksBalanced(xml, name)
    if (b.length > 0) return b
  }
  return []
}

function parseNum(s: string): number {
  if (!s) return 0
  const c = s.replace(/[^0-9,.-]/g, '')
  if (c.includes(',') && c.includes('.')) {
    return parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(c.replace(',', '.')) || 0
}

function extractVoce(v: string, capitolo: string, idx: number): VoceParsed | null {
  const tipo = attrFirst(v, 'TipoVoce', 'Tipo', 'Type')
  if (tipo && ['U','T','S','G','H'].includes(tipo.toUpperCase())) return null

  const desc = tagFirst(v,
    'Descrizione', 'DescrizioneVoce', 'DescrizioneArticolo',
    'Description', 'Testo', 'DesBreve', 'Oggetto', 'TestoBreve', 'DescrizioneEstesa'
  )
  if (!desc || desc.length < 3) return null

  const cod = tagFirst(v, 'Codice', 'CodiceVoce', 'CodiceArticolo', 'CodBreve', 'Code', 'Tariffa')
    || attrFirst(v, 'ID', 'Codice', 'Code') || ('V' + idx)

  const um = tagFirst(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit', 'Unita', 'UdM') || 'nr'
  const pu = parseNum(tagFirst(v, 'PrezzoUnitario', 'PrezzoArticolo', 'Prezzo', 'PU', 'Price', 'CostoUnitario', 'Costo'))
  const qt = parseNum(tagFirst(v, 'Quantita', 'QuantitaArticolo', 'QuantitaTotale', 'SommaMisure', 'Qt', 'Qta', 'Qty', 'TotaleQuantita', 'QuantitaComplessiva'))

  return {
    capitolo: capitolo.slice(0, 150),
    codice: cod.slice(0, 50),
    descrizione: desc.slice(0, 2000),
    um: um.slice(0, 10),
    quantita: qt,
    prezzo_unitario: pu,
    importo: Math.round(qt * pu * 100) / 100
  }
}

// Estrae voci ricorsivamente (gestisce strutture ad albero profonde)
function extractVociFromBlock(block: string, capitolo: string, risultato: VoceParsed[]): void {
  // Cerca voci dirette
  const voceBlocks = findBlocks(block,
    'VersoVoce', 'VoceAlbero', 'VersoDeiVoci', 'SintesiArticolo', 'VoceComputo',
    'Voce', 'Articolo', 'Item', 'Row', 'Lavorazione', 'NodoVoce',
    'VoceElemento', 'ElementoComputo', 'ArticoloComputo', 'Prestazione', 'RigaComputo'
  )

  if (voceBlocks.length > 0) {
    for (let i = 0; i < voceBlocks.length; i++) {
      const v = extractVoce(voceBlocks[i], capitolo, risultato.length + 1)
      if (v) risultato.push(v)
    }
    return
  }

  // Nessuna voce diretta — cerca sottocapitoli e scendi
  const subCaps = findBlocks(block,
    'RamoDeiVoci', 'CapitoloDeiVoci', 'CapitoloSintesi', 'CapitoloComputo',
    'Capitolo', 'Chapter', 'GruppoArticoli', 'GruppoVoci', 'NodoAlbero',
    'SezioneComputo', 'Gruppo', 'WBS', 'SubCapitolo', 'SottoCapitolo'
  )

  for (const sub of subCaps) {
    const subNome = attrFirst(sub, 'Descrizione', 'Description', 'Nome', 'Name', 'Titolo')
      || tagFirst(sub, 'Descrizione', 'Nome', 'Titolo') || capitolo
    const nomeCombinato = subNome !== capitolo ? (capitolo + ' > ' + subNome) : capitolo
    extractVociFromBlock(sub, nomeCombinato, risultato)
  }
}

function parseXML(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // Strategia 1: struttura ad albero con capitoli
  const capBlocks = findBlocks(xml,
    'RamoDeiVoci', 'CapitoloDeiVoci', 'CapitoloSintesi', 'CapitoloComputo',
    'Capitolo', 'Chapter', 'GruppoArticoli', 'GruppoVoci', 'NodoAlbero',
    'SezioneComputo', 'Gruppo', 'WBS', 'AlberoVoci'
  )

  if (capBlocks.length > 0) {
    for (const cap of capBlocks) {
      const nomeCap = attrFirst(cap, 'Descrizione', 'Description', 'Nome', 'Name', 'Titolo')
        || tagFirst(cap, 'Descrizione', 'Nome', 'Titolo', 'Description') || 'Capitolo'
      extractVociFromBlock(cap, nomeCap, voci)
    }
    if (voci.length > 0) return voci
  }

  // Strategia 2: voci flat senza capitoli
  const flatNames = ['Voce', 'VoceComputo', 'Lavorazione', 'Articolo',
    'VoceElemento', 'SintesiArticolo', 'ArticoloComputo', 'Prestazione', 'RigaComputo']
  for (const name of flatNames) {
    const blocks = splitBlocksBalanced(xml, name)
    if (blocks.length < 1) continue
    for (let i = 0; i < blocks.length; i++) {
      const cap = tagFirst(blocks[i], 'Capitolo', 'Categoria', 'Gruppo', 'Sezione') || 'Importato'
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
      content: 'Sei un esperto di computi metrici edili italiani (Primus DEI). Analizza questo XML ed estrai TUTTE le voci del computo. Rispondi SOLO con JSON array. Schema: [{"capitolo":"","codice":"","descrizione":"","um":"nr","quantita":0,"prezzo_unitario":0,"importo":0}]. XML: ' + xml.slice(0, 8000)
    }]
  })
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body
  })
  if (!r.ok) return []
  const d = await r.json() as { content?: Array<{ text?: string }> }
  const raw = d.content?.[0]?.text || ''
  const s = raw.indexOf('['), e = raw.lastIndexOf(']')
  if (s < 0 || e < 0) return []
  try { return JSON.parse(raw.slice(s, e + 1)) as VoceParsed[] } catch { return [] }
}

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
        try { allContents.push(entry.getData().toString('latin1')) } catch { /* skip */ }
      }
    } catch {
      try { allContents.push(buffer.toString('utf8')) } catch { /* skip */ }
      try { allContents.push(buffer.toString('latin1')) } catch { /* skip */ }
    }

    const contents = allContents.filter(c => c && c.trim().length > 50)
    if (contents.length === 0) return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })

    let voci: VoceParsed[] = []
    let bestContent = contents[0]
    for (const content of contents) {
      const v = parseXML(content)
      if (v.length > voci.length) { voci = v; bestContent = content }
    }

    const xmlPreview = bestContent.slice(0, 500)
    console.log('xpwe-ok voci=' + voci.length + ' xmlHead=' + xmlPreview.slice(0, 300))

    if (voci.length === 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey) {
        voci = await parseWithClaude(bestContent, apiKey)
        if (voci.length > 0) return NextResponse.json({ ok: true, voci, fonte: 'AI', totale: voci.length })
      }
      return NextResponse.json({ ok: false, errore: 'Formato XPWE non riconosciuto', xmlPreview })
    }

    return NextResponse.json({ ok: true, voci, fonte: 'parser', totale: voci.length, xmlPreview })
  } catch (err) {
    console.error('xpwe-parse error:', String(err))
    return NextResponse.json({ ok: false, errore: 'Errore: ' + String(err) }, { status: 500 })
  }
}
