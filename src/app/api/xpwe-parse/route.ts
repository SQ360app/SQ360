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

// Rimuove CDATA usando indexOf — evita problemi regex
function stripCDATA(text: string): string {
  const s = text.indexOf('<![CDATA[')
  if (s >= 0) {
    const e = text.indexOf(']]>', s)
    if (e >= 0) return text.slice(s + 9, e)
  }
  return text
}

// Rimuove tag HTML
function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').trim()
}

// Estrae contenuto da tag XML (prova nomi multipli)
function tag(xml: string, ...tags: string[]): string {
  for (const t of tags) {
    const re = new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + t + '>', 'i')
    const m = xml.match(re)
    if (m) return stripTags(stripCDATA(m[1] || '')).trim()
    // Cerca come attributo
    const ar = new RegExp('<[^>]+\\b' + t + '="([^"]+)"', 'i')
    const am = xml.match(ar)
    if (am) return am[1].trim()
  }
  return ''
}

function attr(xml: string, ...attrs: string[]): string {
  for (const a of attrs) {
    const m = xml.match(new RegExp('\\b' + a + '="([^"]*)"', 'i'))
    if (m) return m[1].trim()
  }
  return ''
}

function allBlocks(xml: string, ...tags: string[]): string[] {
  for (const t of tags) {
    const re = new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + t + '>', 'gi')
    const res: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) res.push(m[0])
    if (res.length > 0) return res
  }
  return []
}

function num(s: string): number {
  if (!s) return 0
  // Gestisce sia 1.234,56 (italiano) che 1234.56 (inglese)
  const cleaned = s.replace(/[^0-9,.-]/g, '')
  const normalized = cleaned.includes(',') && cleaned.includes('.')
    ? cleaned.replace('.', '').replace(',', '.')
    : cleaned.replace(',', '.')
  return parseFloat(normalized) || 0
}

function parseXML(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // STRATEGIA 1: Capitoli con voci annidate (albero gerarchico)
  const capBlocks = allBlocks(xml,
    'RamoDeiVoci', 'CapitoloDeiVoci', 'CapitoloSintesi', 'CapitoloComputo',
    'Capitolo', 'Chapter', 'GruppoArticoli', 'GruppoVoci', 'NodoAlbero',
    'SezioneComputo', 'Gruppo', 'WBS'
  )

  if (capBlocks.length > 0) {
    for (const cap of capBlocks) {
      const nomeCap = attr(cap, 'Descrizione', 'Description', 'Nome', 'Name', 'Titolo')
        || tag(cap, 'Descrizione', 'Nome', 'Titolo', 'Description') || 'Capitolo'
      const voceBlocks = allBlocks(cap,
        'VersoVoce', 'VoceAlbero', 'VersoDeiVoci', 'SintesiArticolo', 'VoceComputo',
        'Voce', 'Articolo', 'Item', 'Row', 'Lavorazione', 'NodoVoce',
        'VoceElemento', 'ElementoComputo', 'ArticoloComputo', 'Prestazione'
      )
      for (const v of voceBlocks) {
        const tipoVoce = attr(v, 'TipoVoce', 'Tipo', 'Type') || 'V'
        if (['U','T','S','G','H'].includes(tipoVoce.toUpperCase())) continue
        const desc = tag(v, 'Descrizione', 'DescrizioneVoce', 'DescrizioneArticolo',
          'Description', 'Testo', 'DesBreve', 'Oggetto', 'EstesaDescrizione', 'TestoBreve')
        if (!desc || desc.length < 3) continue
        const cod = tag(v, 'Codice', 'CodiceVoce', 'CodiceArticolo', 'CodBreve', 'Code', 'Tariffa')
          || attr(v, 'ID', 'Codice', 'Code') || ('V' + (voci.length + 1))
        const um = tag(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit', 'Unita', 'UdM') || 'nr'
        const pu = num(tag(v, 'PrezzoUnitario', 'PrezzoArticolo', 'Prezzo', 'PU', 'Price', 'CostoUnitario'))
        const qt = num(tag(v, 'Quantita', 'QuantitaArticolo', 'QuantitaTotale', 'SommaMisure', 'Qt', 'TotaleQuantita', 'Qta', 'Qty'))
        voci.push({ capitolo: nomeCap.slice(0, 100), codice: cod.slice(0, 30), descrizione: desc.slice(0, 500), um: um.slice(0, 10), quantita: qt, prezzo_unitario: pu, importo: qt * pu })
      }
    }
    if (voci.length > 0) return voci
  }

  // STRATEGIA 2: Voci flat senza capitoli
  const flatTags = ['Voce', 'VoceComputo', 'Item', 'Row', 'Lavorazione', 'Articolo',
    'VoceElemento', 'ElementoComputo', 'SintesiArticolo', 'ArticoloComputo', 'Prestazione', 'RigaComputo']
  for (const tagName of flatTags) {
    const blocks = allBlocks(xml, tagName)
    if (blocks.length < 1) continue
    for (const v of blocks) {
      const desc = tag(v, 'Descrizione', 'DescrizioneVoce', 'Description', 'Testo', 'DesBreve', 'Oggetto')
      if (!desc || desc.length < 3) continue
      const cap = tag(v, 'Capitolo', 'Categoria', 'Gruppo', 'Sezione') || attr(v, 'Capitolo') || 'Importato'
      const cod = tag(v, 'Codice', 'CodiceVoce', 'Code', 'Tariffa') || attr(v, 'ID') || ('V' + (voci.length + 1))
      const um = tag(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit', 'UdM') || 'nr'
      const pu = num(tag(v, 'PrezzoUnitario', 'Prezzo', 'PU', 'Price', 'CostoUnitario'))
      const qt = num(tag(v, 'Quantita', 'Qt', 'Qta', 'QuantitaTotale', 'Qty'))
      voci.push({ capitolo: cap.slice(0, 100), codice: cod.slice(0, 30), descrizione: desc.slice(0, 500), um: um.slice(0, 10), quantita: qt, prezzo_unitario: pu, importo: qt * pu })
    }
    if (voci.length > 0) return voci
  }

  // STRATEGIA 3: Attributi inline con descrizione e prezzo
  const inlineRe = /<([A-Za-z]+)[^>]*(Descrizione|Description|Desc)="([^"]{5,})"[^>]*(Prezzo|Price|PU|PrezzoUnitario)="([^"]+)"[^>]*/gi
  let im: RegExpExecArray | null
  while ((im = inlineRe.exec(xml)) !== null) {
    const fullTag = im[0]
    const desc = im[3]
    const pu = num(im[5])
    const cod = attr(fullTag, 'Codice', 'Cod', 'Code', 'ID') || ('A' + (voci.length + 1))
    const um = attr(fullTag, 'UM', 'UnMis', 'Unit') || 'nr'
    const qt = num(attr(fullTag, 'Quantita', 'Qt', 'Qta', 'Quantity'))
    const cap = attr(fullTag, 'Capitolo', 'Categoria', 'Gruppo') || 'Importato'
    voci.push({ capitolo: cap.slice(0, 100), codice: cod.slice(0, 30), descrizione: desc.slice(0, 500), um, quantita: qt, prezzo_unitario: pu, importo: qt * pu })
  }

  return voci
}

async function parseWithClaude(xmlContent: string, apiKey: string): Promise<VoceParsed[]> {
  const prompt = 'Sei un esperto di computi metrici edili italiani. Analizza questo XML esportato da Primus/DEI ed estrai TUTTE le voci del computo metrico. Rispondi SOLO con JSON array. Nessun testo, nessun markdown. Schema: [{"capitolo":"","codice":"","descrizione":"","um":"nr","quantita":0,"prezzo_unitario":0,"importo":0}]. XML: ' + xmlContent.slice(0, 8000)
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
  })
  if (!r.ok) return []
  const d = await r.json() as { content?: Array<{ text?: string }> }
  const raw = d.content?.[0]?.text || ''
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) as VoceParsed[] } catch { return [] }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file ricevuto' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const allContents: string[] = []

    // Prova ZIP
    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries().filter(e => !e.isDirectory && e.getData().length > 50)
      entries.sort((a, b) => b.getData().length - a.getData().length)
      for (const entry of entries.slice(0, 5)) {
        try { allContents.push(entry.getData().toString('utf8')) } catch {}
        try { allContents.push(entry.getData().toString('latin1')) } catch {}
      }
    } catch {
      // Non è un ZIP
      try { allContents.push(buffer.toString('utf8')) } catch {}
      try { allContents.push(buffer.toString('latin1')) } catch {}
    }

    const contents = allContents.filter(c => c && c.trim().length > 50)
    if (contents.length === 0) return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })

    // Parsing XML
    let voci: VoceParsed[] = []
    let bestContent = contents[0]
    for (const content of contents) {
      const v = parseXML(content)
      if (v.length > voci.length) { voci = v; bestContent = content }
    }

    // Fallback Claude AI
    if (voci.length === 0) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      const xmlPreview = bestContent.slice(0, 300)
      console.log('xpwe fallback AI - preview:', xmlPreview.slice(0, 150))
      if (apiKey) {
        voci = await parseWithClaude(bestContent, apiKey)
        if (voci.length > 0) return NextResponse.json({ ok: true, voci, fonte: 'AI', totale: voci.length })
      }
      return NextResponse.json({ ok: false, errore: 'Formato XPWE non riconosciuto', xmlPreview })
    }

    return NextResponse.json({ ok: true, voci, fonte: 'parser', totale: voci.length })
  } catch (err) {
    return NextResponse.json({ ok: false, errore: 'Errore: ' + String(err) }, { status: 500 })
  }
}
