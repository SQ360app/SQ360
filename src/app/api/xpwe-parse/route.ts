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

// Estrae testo del primo tag trovato — gestisce namespace prefix automaticamente
// es: getTag(xml, 'Row') trova sia <Row> che <ss:Row> che <x:Row>
function getTag(xml: string, localName: string): string {
  const candidates = [localName, 'ss:' + localName, 'x:' + localName, 'o:' + localName]
  for (const tagName of candidates) {
    const open = '<' + tagName
    const close = '</' + tagName + '>'
    let p = 0
    while (p < xml.length) {
      const s = xml.indexOf(open, p)
      if (s < 0) break
      const ca = xml[s + open.length]
      if (ca === '>' || ca === ' ' || ca === '\n' || ca === '\r' || ca === '\t' || ca === '/') {
        const eGt = xml.indexOf('>', s)
        if (eGt < 0) break
        const ec = xml.indexOf(close, eGt)
        if (ec >= 0) return stripTags(stripCDATA(xml.slice(eGt + 1, ec))).trim()
        break
      }
      p = s + 1
    }
  }
  return ''
}

function getAttr(xml: string, attrName: string): string {
  for (const q of ['"', "'"]) {
    const p = attrName + '=' + q
    const s = xml.indexOf(p)
    if (s >= 0) { const st = s + p.length; const en = xml.indexOf(q, st); if (en >= 0) return xml.slice(st, en).trim() }
  }
  return ''
}

function firstTag(xml: string, ...names: string[]): string {
  for (const n of names) { const v = getTag(xml, n); if (v) return v }
  return ''
}
function firstAttr(xml: string, ...names: string[]): string {
  for (const n of names) { const v = getAttr(xml, n); if (v) return v }
  return ''
}

// Parser bilanciato — cerca sia <Tag> che <ns:Tag>
function blocks(xml: string, localName: string): string[] {
  const candidates = [localName, 'ss:' + localName, 'x:' + localName, 'o:' + localName]
  for (const tagName of candidates) {
    const res = blocksExact(xml, tagName)
    if (res.length > 0) return res
  }
  return []
}

function blocksExact(xml: string, tagName: string): string[] {
  const res: string[] = []
  const open = '<' + tagName
  const close = '</' + tagName + '>'
  let pos = 0
  while (pos < xml.length) {
    const si = xml.indexOf(open, pos)
    if (si < 0) break
    const ca = xml[si + open.length]
    if (ca !== '>' && ca !== ' ' && ca !== '\n' && ca !== '\r' && ca !== '\t' && ca !== '/') { pos = si + 1; continue }
    // Self-closing?
    const firstGt = xml.indexOf('>', si)
    if (firstGt > 0 && xml[firstGt - 1] === '/') { pos = firstGt + 1; continue }
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

// ── STRATEGIA A: SpreadsheetML (<?mso-application progid="Excel.Sheet"?>) ─────
// Primus/DEI esporta XPWE come SpreadsheetML. Le righe possono avere namespace.

function parseSpreadsheetML(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // Trova tutti i worksheet
  const worksheetBlocks = blocks(xml, 'Worksheet')
  if (worksheetBlocks.length === 0) {
    console.log('SpreadsheetML: nessun Worksheet trovato')
    // Debug: mostra i primi 200 chars per capire la struttura
    const debug = xml.slice(0, 500).replace(/\n/g, ' ')
    console.log('XML head:', debug)
    return []
  }

  // Prende il worksheet più grande
  const mainWs = worksheetBlocks.sort((a, b) => b.length - a.length)[0]
  const wsName = getAttr(mainWs, 'ss:Name') || getAttr(mainWs, 'Name') || ''
  console.log('SpreadsheetML: worksheet=' + wsName + ' size=' + mainWs.length)

  // Trova la tabella
  const tableBlock = blocks(mainWs, 'Table')[0] || mainWs

  // Legge tutte le righe
  const rowBlocks = blocks(tableBlock, 'Row')
  console.log('SpreadsheetML: rows=' + rowBlocks.length)
  if (rowBlocks.length < 2) return []

  // Estrae il testo di ogni cella di una riga
  const getCells = (rowXml: string): string[] => {
    const cellBlocks = blocks(rowXml, 'Cell')
    return cellBlocks.map(cell => {
      // Prova ss:Data, Data, o valore diretto
      const data = getTag(cell, 'Data') || getTag(cell, 'ss:Data') || ''
      return stripTags(data).trim()
    })
  }

  // Prima riga = intestazione
  const hdr = getCells(rowBlocks[0]).map(h => h.toLowerCase().replace(/[^a-zàèéìòù0-9_]/g, ''))
  console.log('SpreadsheetML: headers=' + hdr.slice(0,8).join('|'))

  const idx = (kws: string[]) => hdr.findIndex(h => kws.some(k => h.includes(k)))
  const iCap = idx(['cap', 'categ', 'titol', 'sez'])
  const iCod = idx(['cod', 'tar', 'num'])
  const iDesc = idx(['desc', 'lav', 'ogg', 'voc'])
  const iUm = idx(['um', 'unit', 'mis'])
  const iQt = idx(['quan', 'qta', 'qt', 'mis'])
  const iPu = idx(['prezz', 'pu', 'unitario', 'costo'])
  const iImp = idx(['imp', 'tot', 'import'])

  console.log('SpreadsheetML: iDesc=' + iDesc + ' iQt=' + iQt + ' iPu=' + iPu)

  // Se non troviamo descrizione nell'header, prova approccio euristico (nessun header)
  if (iDesc < 0 && rowBlocks.length > 1) {
    // Prova a rilevare le colonne dalla struttura delle prime righe dati
    const sample = getCells(rowBlocks[1])
    console.log('SpreadsheetML: sample row1=' + JSON.stringify(sample.slice(0,6)))
  }

  let lastCap = 'Importato'

  for (let r = 1; r < rowBlocks.length; r++) {
    const cells = getCells(rowBlocks[r])
    if (!cells.some(c => c.trim())) continue

    // Riga capitolo: molte celle vuote con solo 1-2 valori
    const nonEmpty = cells.filter(c => c.trim())
    if (nonEmpty.length <= 2 && cells.some(c => c.length > 10)) {
      lastCap = nonEmpty.find(c => c.length > 5) || lastCap
      continue
    }

    const desc = iDesc >= 0 ? cells[iDesc] : (cells[2] || cells[1] || '')
    if (!desc || desc.length < 3) {
      if (cells[0] && cells.filter(c=>c).length <= 2) lastCap = cells.find(c=>c.length>5) || lastCap
      continue
    }

    const qt = parseNum(iQt >= 0 ? cells[iQt] : cells[4] || '')
    const pu = parseNum(iPu >= 0 ? cells[iPu] : cells[5] || '')
    const imp = parseNum(iImp >= 0 ? cells[iImp] : cells[6] || '') || Math.round(qt * pu * 100) / 100
    const cod = (iCod >= 0 ? cells[iCod] : cells[1] || '').slice(0, 50) || ('R' + r)
    const um = (iUm >= 0 ? cells[iUm] : cells[3] || '').slice(0, 10) || 'nr'
    const cap = (iCap >= 0 && cells[iCap]) ? cells[iCap] : lastCap

    if (qt === 0 && pu === 0 && imp === 0) continue // Riga vuota/capitolo

    voci.push({
      capitolo: cap.slice(0, 150),
      codice: cod,
      descrizione: desc.slice(0, 2000),
      um,
      quantita: qt,
      prezzo_unitario: pu,
      importo: imp || Math.round(qt * pu * 100) / 100
    })
  }

  return voci
}

// ── STRATEGIA B: Primus Standard (ElencoPrezzi + AlberoVoci) ──────────────────

function parsePrimusStandard(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  const lookup = new Map<string, { codice: string; descrizione: string; um: string; prezzo: number }>()

  const elencoSection = blocks(xml, 'ElencoPrezzi')[0] || blocks(xml, 'Listino')[0] || ''
  if (elencoSection) {
    const elencoItems = firstBlocks(elencoSection,
      'ElemElenco', 'ArticoloElenco', 'VoceElenco', 'ElemListino', 'Elemento', 'Articolo'
    )
    for (const item of elencoItems) {
      const id = firstAttr(item, 'IDVoce', 'ID', 'CodBreve') || firstTag(item, 'IDVoce', 'CodBreve', 'Codice', 'ID')
      const desc = firstTag(item, 'Descrizione', 'DescrizioneEstesa', 'Description', 'Testo')
      if (!id || !desc) continue
      lookup.set(id, { codice: firstTag(item, 'CodBreve', 'Codice') || id, descrizione: desc.slice(0, 2000), um: firstTag(item, 'UnMis', 'UnitaMisura', 'UM') || 'nr', prezzo: parseNum(firstTag(item, 'PrezzoUnitario', 'Prezzo', 'PU')) })
    }
  }

  function processCapitolo(capXml: string, nomeCap: string) {
    const voceBlocks = firstBlocks(capXml, 'VersoVoce', 'VoceAlbero', 'VersoDeiVoci', 'NodoVoce', 'VoceComputo')
    let hasVoci = false
    for (const v of voceBlocks) {
      const tipo = firstAttr(v, 'TipoVoce', 'Tipo', 'Type')
      if (['U','T','S','G','H','CAPITOLO','TITOLO'].includes(tipo.toUpperCase())) continue
      const voceId = firstAttr(v, 'IDVoce', 'ID', 'CodBreve') || firstTag(v, 'IDVoce', 'CodBreve')
      const pd = voceId ? lookup.get(voceId) : null
      const desc = pd?.descrizione || firstTag(v, 'Descrizione', 'DescrizioneVoce', 'Description', 'Testo', 'DesBreve')
      if (!desc || desc.length < 3) continue
      const qt = parseNum(firstTag(v, 'SommaMisure', 'Quantita', 'QuantitaTotale', 'Qt', 'Qta', 'TotaleQuantita'))
      const pu = pd?.prezzo || parseNum(firstTag(v, 'PrezzoUnitario', 'Prezzo', 'PU'))
      const um = pd?.um || firstTag(v, 'UnMis', 'UnitaMisura', 'UM') || 'nr'
      const cod = pd?.codice || firstAttr(v, 'IDVoce', 'CodBreve') || ('V' + (voci.length + 1))
      voci.push({ capitolo: nomeCap.slice(0,150), codice: cod.slice(0,50), descrizione: desc, um: um.slice(0,10), quantita: qt, prezzo_unitario: pu, importo: Math.round(qt*pu*100)/100 })
      hasVoci = true
    }
    if (!hasVoci || voceBlocks.length === 0) {
      const subCaps = firstBlocks(capXml, 'RamoDeiVoci', 'CapitoloDeiVoci', 'Capitolo', 'Chapter', 'NodoAlbero', 'GruppoArticoli', 'SezioneComputo', 'WBS')
      for (const sub of subCaps) {
        const subNome = firstAttr(sub, 'Descrizione', 'Description', 'Nome') || firstTag(sub, 'Descrizione', 'Nome') || nomeCap
        processCapitolo(sub, subNome !== nomeCap ? nomeCap + ' > ' + subNome : nomeCap)
      }
    }
  }

  const alberonXml = blocks(xml, 'AlberoVoci')[0] || blocks(xml, 'Computo')[0] || xml
  const capTopLevel = firstBlocks(alberonXml, 'RamoDeiVoci', 'CapitoloDeiVoci', 'Capitolo', 'Chapter', 'NodoAlbero', 'GruppoArticoli', 'SezioneComputo', 'WBS')
  for (const cap of capTopLevel) {
    const nome = firstAttr(cap, 'Descrizione', 'Description', 'Nome') || firstTag(cap, 'Descrizione', 'Nome') || 'Capitolo'
    processCapitolo(cap, nome)
  }
  return voci
}

// ── STRATEGIA C: Flat XML ─────────────────────────────────────────────────────

function parsePrimusFlat(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []
  function processBlock(blockXml: string, capNome: string) {
    const capBlocks = firstBlocks(blockXml, 'RamoDeiVoci', 'CapitoloDeiVoci', 'Capitolo', 'Chapter', 'GruppoArticoli', 'NodoAlbero', 'SezioneComputo', 'WBS', 'Gruppo')
    if (capBlocks.length > 0) {
      for (const cap of capBlocks) {
        const nome = firstAttr(cap, 'Descrizione', 'Description', 'Nome') || firstTag(cap, 'Descrizione', 'Nome') || capNome
        processBlock(cap, nome)
      }
      return
    }
    const voceBlocks = firstBlocks(blockXml, 'VersoVoce', 'VoceAlbero', 'SintesiArticolo', 'VoceComputo', 'Voce', 'Articolo', 'Item', 'Lavorazione', 'Prestazione', 'RigaComputo')
    for (const v of voceBlocks) {
      const tipo = firstAttr(v, 'TipoVoce', 'Tipo', 'Type')
      if (['U','T','S','G','H'].includes(tipo.toUpperCase())) continue
      const desc = firstTag(v, 'Descrizione', 'DescrizioneVoce', 'Description', 'Testo', 'DesBreve', 'Oggetto')
      if (!desc || desc.length < 3) continue
      const qt = parseNum(firstTag(v, 'Quantita', 'SommaMisure', 'Qt', 'Qta', 'QuantitaTotale'))
      const pu = parseNum(firstTag(v, 'PrezzoUnitario', 'PrezzoArticolo', 'Prezzo', 'PU'))
      const um = firstTag(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit') || 'nr'
      const cod = firstTag(v, 'Codice', 'CodiceVoce', 'CodBreve') || firstAttr(v, 'IDVoce', 'ID') || ('V' + (voci.length + 1))
      voci.push({ capitolo: capNome.slice(0,150), codice: cod.slice(0,50), descrizione: desc.slice(0,2000), um: um.slice(0,10), quantita: qt, prezzo_unitario: pu, importo: Math.round(qt*pu*100)/100 })
    }
  }
  processBlock(xml, 'Importato')
  return voci
}

// ── CLAUDE AI FALLBACK ────────────────────────────────────────────────────────

async function parseWithClaude(xml: string, apiKey: string): Promise<VoceParsed[]> {
  const isExcel = xml.includes('mso-application') || xml.includes('Workbook')
  const hint = isExcel
    ? 'Il file è in formato SpreadsheetML (Excel XML). Ogni <Row> contiene <Cell><Data> con i valori. Ignora le righe che sono capitoli/titoli (quelle senza quantità e prezzo). Estrai solo le righe con descrizione, quantità e prezzo.'
    : 'Il file è un XML Primus DEI. Estrai tutte le voci con descrizione, quantità e prezzo.'
  const prompt = 'Sei un esperto di computi metrici edili italiani. ' + hint + ' RISPONDI SOLO con JSON array senza markdown. Schema: [{"capitolo":"","codice":"","descrizione":"DESCRIZIONE COMPLETA","um":"nr","quantita":0,"prezzo_unitario":0,"importo":0}]. Includi SOLO voci con quantita > 0 o prezzo > 0. XML: ' + xml.slice(0, 8000)
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
      const entries = zip.getEntries().filter(e => !e.isDirectory && e.getData().length > 50).sort((a, b) => b.getData().length - a.getData().length)
      for (const entry of entries.slice(0, 5)) {
        try { allContents.push(entry.getData().toString('utf8')) } catch { /* skip */ }
        try { allContents.push(entry.getData().toString('latin1')) } catch { /* skip */ }
      }
      console.log('xpwe: ZIP entries=' + entries.length)
    } catch {
      try { allContents.push(buffer.toString('utf8')) } catch { /* skip */ }
      try { allContents.push(buffer.toString('latin1')) } catch { /* skip */ }
      console.log('xpwe: not ZIP, reading as text, head=' + buffer.toString('utf8').slice(0, 100).replace(/\n/g,' '))
    }

    const contents = allContents.filter(c => c && c.trim().length > 50)
    if (contents.length === 0) return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })

    let voci: VoceParsed[] = []
    let bestContent = contents[0]

    for (const content of contents) {
      const isSpreadsheet = content.includes('mso-application') || content.includes('Workbook') || content.includes('Worksheet')
      let v: VoceParsed[] = []

      if (isSpreadsheet) {
        v = parseSpreadsheetML(content)
        console.log('xpwe: SpreadsheetML=' + v.length)
      }

      if (v.length === 0) {
        v = parsePrimusStandard(content)
        console.log('xpwe: PrimusStd=' + v.length)
      }

      if (v.length === 0) {
        v = parsePrimusFlat(content)
        console.log('xpwe: PrimusFlat=' + v.length)
      }

      if (v.length > voci.length) { voci = v; bestContent = content }
    }

    const xmlPreview = bestContent.slice(0, 600)

    if (voci.length === 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      console.log('xpwe: fallback Claude AI, xmlHead=' + xmlPreview.slice(0, 200).replace(/\n/g,' '))
      if (apiKey) {
        voci = await parseWithClaude(bestContent, apiKey)
        if (voci.length > 0) return NextResponse.json({ ok: true, voci, fonte: 'AI', totale: voci.length, xmlPreview })
      }
      return NextResponse.json({ ok: false, errore: 'Formato non riconosciuto.', xmlPreview })
    }

    return NextResponse.json({ ok: true, voci, fonte: 'parser', totale: voci.length, xmlPreview })
  } catch (err) {
    console.error('xpwe-parse error:', String(err))
    return NextResponse.json({ ok: false, errore: 'Errore: ' + String(err) }, { status: 500 })
  }
}
