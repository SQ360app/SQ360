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

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function stripCDATA(t: string): string {
  const s = t.indexOf('<![CDATA[')
  if (s >= 0) { const e = t.indexOf(']]>', s); if (e >= 0) return t.slice(s + 9, e) }
  return t
}

function stripTags(t: string): string {
  return t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Estrae il testo del primo tag trovato (usa indexOf, no regex problematici)
function getTag(xml: string, tagName: string): string {
  const open = '<' + tagName
  const close = '</' + tagName + '>'
  let p = 0
  while (p < xml.length) {
    const s = xml.indexOf(open, p)
    if (s < 0) return ''
    const ca = xml[s + open.length]
    if (ca === '>' || ca === ' ' || ca === '\n' || ca === '\r' || ca === '\t') {
      const eGt = xml.indexOf('>', s)
      if (eGt < 0) return ''
      const ec = xml.indexOf(close, eGt)
      if (ec < 0) return ''
      return stripTags(stripCDATA(xml.slice(eGt + 1, ec))).trim()
    }
    p = s + 1
  }
  return ''
}

// Estrae il valore di un attributo
function getAttr(xml: string, attrName: string): string {
  const p1 = attrName + '="'
  const s1 = xml.indexOf(p1)
  if (s1 >= 0) { const st = s1 + p1.length; const en = xml.indexOf('"', st); if (en >= 0) return xml.slice(st, en).trim() }
  const p2 = attrName + "='"
  const s2 = xml.indexOf(p2)
  if (s2 >= 0) { const st = s2 + p2.length; const en = xml.indexOf("'", st); if (en >= 0) return xml.slice(st, en).trim() }
  return ''
}

// Primo valore trovato tra nomi multipli
function firstTag(xml: string, ...names: string[]): string {
  for (const n of names) { const v = getTag(xml, n); if (v) return v }
  return ''
}
function firstAttr(xml: string, ...names: string[]): string {
  for (const n of names) { const v = getAttr(xml, n); if (v) return v }
  return ''
}

// Parser bilanciato di blocchi con lo stesso tag (gestisce annidamento)
function blocks(xml: string, tagName: string): string[] {
  const res: string[] = []
  const open = '<' + tagName
  const close = '</' + tagName + '>'
  let pos = 0
  while (pos < xml.length) {
    const si = xml.indexOf(open, pos)
    if (si < 0) break
    const ca = xml[si + open.length]
    if (ca !== '>' && ca !== ' ' && ca !== '\n' && ca !== '\r' && ca !== '\t' && ca !== '/') { pos = si + 1; continue }
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

function firstBlocks(xml: string, ...names: string[]): string[] {
  for (const n of names) { const b = blocks(xml, n); if (b.length > 0) return b }
  return []
}

function parseNum(s: string): number {
  if (!s) return 0
  const c = s.replace(/[^\d,.-]/g, '')
  if (c.includes(',') && c.includes('.')) return parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(c.replace(',', '.')) || 0
}

// ── STRATEGIA A: Formato Primus DEI con ElencoPrezzi + AlberoVoci ─────────────
// I VersoVoce hanno IDVoce che referenzia ElemElenco nel ElencoPrezzi

function parsePrimusStandard(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // 1. Costruisco mappa ID → {codice, descrizione, um, prezzo}
  const lookup = new Map<string, { codice: string; descrizione: string; um: string; prezzo: number }>()

  const elencoSection = blocks(xml, 'ElencoPrezzi')[0] || blocks(xml, 'Listino')[0] || ''
  const elencoItems = firstBlocks(elencoSection || xml,
    'ElemElenco', 'ArticoloElenco', 'VoceElenco', 'ElemListino',
    'PrezzoElemento', 'Elemento', 'Articolo', 'ElencoVoce'
  )

  for (const item of elencoItems) {
    const id = firstAttr(item, 'IDVoce', 'ID', 'CodBreve') ||
               firstTag(item, 'IDVoce', 'CodBreve', 'Codice', 'ID')
    const desc = firstTag(item, 'Descrizione', 'DescrizioneEstesa', 'Description', 'Testo', 'DescrizioneVoce')
    if (!id || !desc) continue
    lookup.set(id, {
      codice: firstTag(item, 'CodBreve', 'Codice', 'CodiceVoce') || id,
      descrizione: desc.slice(0, 2000),
      um: firstTag(item, 'UnMis', 'UnitaMisura', 'UM', 'Unit') || 'nr',
      prezzo: parseNum(firstTag(item, 'PrezzoUnitario', 'Prezzo', 'PU', 'CostoUnitario'))
    })
  }

  if (lookup.size === 0) return [] // Nessun ElencoPrezzi trovato

  // 2. Scorro l'albero delle voci
  function processCapitolo(capXml: string, nomeCap: string) {
    // Cerca VersoVoce diretti
    const vociBlocks = firstBlocks(capXml,
      'VersoVoce', 'VoceAlbero', 'VersoDeiVoci', 'NodoVoce', 'VoceComputo'
    )

    let hasValidVoci = false
    for (const v of vociBlocks) {
      const tipo = firstAttr(v, 'TipoVoce', 'Tipo', 'Type')
      if (['U','T','S','G','H','CAPITOLO','TITOLO'].includes(tipo.toUpperCase())) continue

      const voceId = firstAttr(v, 'IDVoce', 'ID', 'CodBreve', 'IDArticolo') ||
                     firstTag(v, 'IDVoce', 'CodBreve', 'Codice')

      const priceData = voceId ? lookup.get(voceId) : null

      const desc = priceData?.descrizione ||
                   firstTag(v, 'Descrizione', 'DescrizioneVoce', 'Description', 'Testo', 'DesBreve')
      if (!desc || desc.length < 3) continue

      const qt = parseNum(firstTag(v, 'SommaMisure', 'Quantita', 'QuantitaTotale', 'Qt', 'Qta', 'TotaleQuantita', 'QuantitaComplessiva'))
      const pu = priceData?.prezzo || parseNum(firstTag(v, 'PrezzoUnitario', 'Prezzo', 'PU'))
      const um = priceData?.um || firstTag(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit') || 'nr'
      const cod = priceData?.codice || firstAttr(v, 'IDVoce', 'CodBreve', 'ID') || ('V' + (voci.length + 1))

      voci.push({
        capitolo: nomeCap.slice(0, 150),
        codice: cod.slice(0, 50),
        descrizione: desc,
        um: um.slice(0, 10),
        quantita: qt,
        prezzo_unitario: pu,
        importo: Math.round(qt * pu * 100) / 100
      })
      hasValidVoci = true
    }

    if (!hasValidVoci || vociBlocks.length === 0) {
      // Scendi nei sottocapitoli
      const subCaps = firstBlocks(capXml,
        'RamoDeiVoci', 'CapitoloDeiVoci', 'Capitolo', 'Chapter',
        'NodoAlbero', 'GruppoArticoli', 'SezioneComputo', 'WBS'
      )
      for (const sub of subCaps) {
        const subNome = firstAttr(sub, 'Descrizione', 'Description', 'Nome', 'Name', 'Titolo') ||
                        firstTag(sub, 'Descrizione', 'Nome', 'Titolo') || nomeCap
        const nomeCompleto = subNome !== nomeCap ? (nomeCap + ' > ' + subNome) : nomeCap
        processCapitolo(sub, nomeCompleto)
      }
    }
  }

  // Trova i capitoli top-level
  const alberonXml = blocks(xml, 'AlberoVoci')[0] ||
                     blocks(xml, 'Computo')[0] ||
                     blocks(xml, 'ComputoMetrico')[0] || xml

  const capTopLevel = firstBlocks(alberonXml,
    'RamoDeiVoci', 'CapitoloDeiVoci', 'Capitolo', 'Chapter',
    'NodoAlbero', 'GruppoArticoli', 'SezioneComputo', 'WBS'
  )

  for (const cap of capTopLevel) {
    const nome = firstAttr(cap, 'Descrizione', 'Description', 'Nome', 'Name', 'Titolo') ||
                 firstTag(cap, 'Descrizione', 'Nome', 'Titolo') || 'Capitolo'
    processCapitolo(cap, nome)
  }

  return voci
}

// ── STRATEGIA B: SpreadsheetML (<?mso-application progid="Excel.Sheet"?>) ─────
// Primus a volte esporta XPWE come Excel XML SpreadsheetML

function parseSpreadsheetML(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // Trova il primo foglio di lavoro con dati
  const worksheetBlocks = blocks(xml, 'Worksheet')
  if (worksheetBlocks.length === 0) return []

  // Prende il foglio più grande (più dati)
  const mainWs = worksheetBlocks.sort((a, b) => b.length - a.length)[0]
  const tableBlock = blocks(mainWs, 'Table')[0] || mainWs
  const rowBlocks = blocks(tableBlock, 'Row')
  if (rowBlocks.length < 2) return []

  // Prima riga = intestazioni
  const getCellData = (rowXml: string): string[] => {
    return blocks(rowXml, 'Cell').map(cell => {
      const data = getTag(cell, 'Data') || firstAttr(cell, 'ss:Value') || ''
      return stripTags(data).trim()
    })
  }

  const headers = getCellData(rowBlocks[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_àèéìòùì]/g, ''))

  const idx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)))
  const iCap = idx(['cap', 'categ', 'titol'])
  const iCod = idx(['cod', 'tar'])
  const iDesc = idx(['desc', 'lav', 'ogg'])
  const iUm = idx(['um', 'unit', 'mis'])
  const iQt = idx(['quan', 'qta', 'qt'])
  const iPu = idx(['prezz', 'pu', 'unitario'])
  const iImp = idx(['imp', 'tot', 'import'])

  if (iDesc < 0) return [] // Nessuna colonna descrizione

  let lastCap = 'Importato'

  for (let r = 1; r < rowBlocks.length; r++) {
    const cells = getCellData(rowBlocks[r])
    if (!cells.some(c => c.trim())) continue

    const desc = iDesc >= 0 ? cells[iDesc] || '' : ''
    if (!desc || desc.length < 3) {
      // Riga capitolo?
      if (iCap >= 0 && cells[iCap]) lastCap = cells[iCap]
      else if (cells[0] && cells.filter(c => c).length <= 2) lastCap = cells[0]
      continue
    }

    const qt = parseNum(iQt >= 0 ? cells[iQt] : '')
    const pu = parseNum(iPu >= 0 ? cells[iPu] : '')
    const imp = parseNum(iImp >= 0 ? cells[iImp] : '') || Math.round(qt * pu * 100) / 100
    const cod = (iCod >= 0 ? cells[iCod] : '') || ('R' + r)
    const um = (iUm >= 0 ? cells[iUm] : '') || 'nr'
    const cap = (iCap >= 0 && cells[iCap]) ? cells[iCap] : lastCap

    voci.push({
      capitolo: cap.slice(0, 150),
      codice: cod.slice(0, 50),
      descrizione: desc.slice(0, 2000),
      um: um.slice(0, 10),
      quantita: qt,
      prezzo_unitario: pu,
      importo: imp
    })
  }

  return voci
}

// ── STRATEGIA C: XML flat (voci inline senza price list separata) ────────────
function parsePrimusFlat(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  function processBlock(blockXml: string, capNome: string) {
    const capBlocks = firstBlocks(blockXml,
      'RamoDeiVoci', 'CapitoloDeiVoci', 'Capitolo', 'Chapter',
      'GruppoArticoli', 'NodoAlbero', 'SezioneComputo', 'WBS', 'Gruppo'
    )
    if (capBlocks.length > 0) {
      for (const cap of capBlocks) {
        const nome = firstAttr(cap, 'Descrizione', 'Description', 'Nome', 'Name') ||
                     firstTag(cap, 'Descrizione', 'Nome', 'Titolo') || capNome
        processBlock(cap, nome)
      }
      return
    }

    const voceBlocks = firstBlocks(blockXml,
      'VersoVoce', 'VoceAlbero', 'SintesiArticolo', 'VoceComputo',
      'Voce', 'Articolo', 'Item', 'Lavorazione', 'Prestazione', 'RigaComputo', 'Row'
    )
    for (const v of voceBlocks) {
      const tipo = firstAttr(v, 'TipoVoce', 'Tipo', 'Type')
      if (['U','T','S','G','H'].includes(tipo.toUpperCase())) continue
      const desc = firstTag(v, 'Descrizione', 'DescrizioneVoce', 'Description', 'Testo', 'DesBreve', 'Oggetto')
      if (!desc || desc.length < 3) continue
      const qt = parseNum(firstTag(v, 'Quantita', 'SommaMisure', 'Qt', 'Qta', 'QuantitaTotale', 'TotaleQuantita'))
      const pu = parseNum(firstTag(v, 'PrezzoUnitario', 'PrezzoArticolo', 'Prezzo', 'PU', 'Price'))
      const um = firstTag(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit') || 'nr'
      const cod = firstTag(v, 'Codice', 'CodiceVoce', 'CodBreve', 'Code') || firstAttr(v, 'IDVoce', 'ID') || ('V' + (voci.length + 1))
      voci.push({ capitolo: capNome.slice(0, 150), codice: cod.slice(0, 50), descrizione: desc.slice(0, 2000), um: um.slice(0, 10), quantita: qt, prezzo_unitario: pu, importo: Math.round(qt * pu * 100) / 100 })
    }
  }

  processBlock(xml, 'Importato')
  return voci
}

// ── FALLBACK: Claude AI ───────────────────────────────────────────────────────
async function parseWithClaude(xml: string, apiKey: string): Promise<VoceParsed[]> {
  const prompt = 'Sei un esperto di computi metrici edili italiani. Analizza questo XML/documento Primus DEI ed estrai TUTTE le voci del computo con quantita e prezzi. Ignora le categorie/supercategorie senza quantità. RISPONDI SOLO con JSON array, nessun testo. Schema: [{"capitolo":"","codice":"","descrizione":"DESCRIZIONE COMPLETA","um":"nr","quantita":0,"prezzo_unitario":0,"importo":0}]. Includi SOLO voci che hanno quantita > 0 o prezzo > 0. XML: ' + xml.slice(0, 8000)
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

// ── MAIN ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file ricevuto' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const allContents: string[] = []

    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries().filter(e => !e.isDirectory && e.getData().length > 10)
      // Log TUTTI i file nel ZIP
      console.log('xpwe-zip files:', entries.map(e => e.entryName + '(' + e.getData().length + ')').join(' | '))
      entries.sort((a, b) => b.getData().length - a.getData().length)
      for (const entry of entries.slice(0, 8)) {
        try {
          const utf8 = entry.getData().toString('utf8')
          console.log('xpwe-file[' + entry.entryName + '] head:', utf8.slice(0, 200))
          allContents.push(utf8)
        } catch { /* skip */ }
        try { allContents.push(entry.getData().toString('latin1')) } catch { /* skip */ }
      }
    } catch {
      try {
        const utf8 = buffer.toString('utf8')
        console.log('xpwe-notzip head:', utf8.slice(0, 200))
        allContents.push(utf8)
      } catch { /* skip */ }
      try { allContents.push(buffer.toString('latin1')) } catch { /* skip */ }
    }

    const contents = allContents.filter(c => c && c.trim().length > 50)
    if (contents.length === 0) return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })

    let voci: VoceParsed[] = []
    let bestContent = contents[0]

    for (const content of contents) {
      // Tenta le 3 strategie in ordine
      const isSpreadsheetML = content.includes('mso-application') || content.includes('Workbook') || content.includes('Worksheet')
      let v: VoceParsed[] = []

      if (isSpreadsheetML) {
        v = parseSpreadsheetML(content)
        console.log('xpwe SpreadsheetML voci=' + v.length)
      }

      if (v.length === 0) {
        v = parsePrimusStandard(content)
        console.log('xpwe PrimusStandard voci=' + v.length)
      }

      if (v.length === 0) {
        v = parsePrimusFlat(content)
        console.log('xpwe PrimusFlat voci=' + v.length)
      }

      if (v.length > voci.length) { voci = v; bestContent = content }
    }

    const xmlPreview = bestContent.slice(0, 600)
    console.log('xpwe-final voci=' + voci.length + ' head=' + xmlPreview.slice(0, 200))

    if (voci.length === 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey) {
        voci = await parseWithClaude(bestContent, apiKey)
        if (voci.length > 0) return NextResponse.json({ ok: true, voci, fonte: 'AI', totale: voci.length, xmlPreview })
      }
      return NextResponse.json({ ok: false, errore: 'Formato XPWE non riconosciuto. Struttura XML non supportata.', xmlPreview })
    }

    return NextResponse.json({ ok: true, voci, fonte: 'parser', totale: voci.length, xmlPreview })
  } catch (err) {
    console.error('xpwe-parse error:', String(err))
    return NextResponse.json({ ok: false, errore: 'Errore: ' + String(err) }, { status: 500 })
  }
}
