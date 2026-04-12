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

// Estrae testo da tag XML (prova nomi multipli, gestisce CDATA e attributi)
function tag(xml: string, ...tags: string[]): string {
  for (const t of tags) {
    const patterns = [
      new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i'),
      new RegExp(`<${t}\\s[^/]*/>`, 'i'), // self-closing
    ]
    for (const re of patterns) {
      const m = xml.match(re)
      if (m) return (m[1] || '').replace(/<![CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').trim()
    }
    // Cerca anche come attributo: <Tag Descrizione="...">
    const attrRe = new RegExp(`<[^>]+\\b${t}="([^"]+)"`, 'i')
    const am = xml.match(attrRe)
    if (am) return am[1].trim()
  }
  return ''
}

function attr(xml: string, ...attrs: string[]): string {
  for (const a of attrs) {
    const m = xml.match(new RegExp(`\\b${a}="([^"]*)"`, 'i'))
    if (m) return m[1].trim()
  }
  return ''
}

function allBlocks(xml: string, ...tags: string[]): string[] {
  for (const t of tags) {
    const re = new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'gi')
    const res: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) res.push(m[0])
    if (res.length > 0) return res
  }
  return []
}

function num(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')) || 0
}

// Parser XML generico multi-formato
function parseXML(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // STRATEGIA 1: Cerca i capitoli con voci annidate (formato albero)
  const capBlocks = allBlocks(xml,
    'RamoDeiVoci', 'CapitoloDeiVoci', 'CapitoloSintesi', 'CapitoloComputo',
    'Capitolo', 'Chapter', 'GruppoArticoli', 'GruppoVoci', 'NodoAlbero',
    'SezioneComputo', 'Gruppo'
  )

  if (capBlocks.length > 0) {
    for (const cap of capBlocks) {
      const nomeCap = attr(cap, 'Descrizione', 'Description', 'Nome', 'Name')
        || tag(cap, 'Descrizione', 'Nome', 'Titolo') || 'Capitolo'
      const voceBlocks = allBlocks(cap,
        'VersoVoce', 'VoceAlbero', 'VersoDeiVoci', 'SintesiArticolo', 'VoceComputo',
        'Voce', 'Articolo', 'Item', 'Row', 'Lavorazione', 'NodoVoce',
        'VoceElemento', 'ElementoComputo', 'ArticoloComputo'
      )
      for (const v of voceBlocks) {
        const tipoVoce = attr(v, 'TipoVoce', 'Tipo', 'Type') || 'V'
        if (['U','T','S','G','H','SUB'].includes(tipoVoce.toUpperCase())) continue
        const desc = tag(v,
          'Descrizione', 'DescrizioneVoce', 'DescrizioneArticolo', 'Description',
          'Testo', 'DesBreve', 'DescBreve', 'Oggetto', 'EstesaDescrizione'
        )
        if (!desc || desc.length < 3) continue
        const cod = tag(v, 'Codice', 'CodiceVoce', 'CodiceArticolo', 'CodBreve', 'Code', 'Tariffa')
          || attr(v, 'ID', 'Codice', 'Code') || `V${voci.length + 1}`
        const um = tag(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit', 'Unita') || 'nr'
        const pu = num(tag(v, 'PrezzoUnitario', 'PrezzoArticolo', 'Prezzo', 'PU', 'Price', 'UnitPrice', 'CostoUnitario'))
        const qt = num(tag(v, 'Quantita', 'QuantitaArticolo', 'QuantitaTotale', 'SommaMisure', 'Qt', 'TotaleQuantita', 'Qta'))
        voci.push({ capitolo: nomeCap.slice(0, 100), codice: cod.slice(0, 30), descrizione: desc.slice(0, 500), um: um.slice(0, 10), quantita: qt, prezzo_unitario: pu, importo: qt * pu })
      }
    }
    if (voci.length > 0) return voci
  }

  // STRATEGIA 2: Voci flat senza capitoli (cerca TUTTI gli elementi ripetuti che sembrano voci)
  const flatCandidates = [
    'Voce', 'VoceComputo', 'Item', 'Row', 'Lavorazione', 'Articolo',
    'VoceElemento', 'ElementoComputo', 'SintesiArticolo', 'ArticoloComputo',
    'Prestazione', 'VocePrezzo', 'RigaComputo'
  ]
  for (const tagName of flatCandidates) {
    const blocks = allBlocks(xml, tagName)
    if (blocks.length < 2) continue
    let found = 0
    for (const v of blocks) {
      const desc = tag(v, 'Descrizione', 'DescrizioneVoce', 'Description', 'Testo', 'DesBreve', 'Oggetto')
      if (!desc || desc.length < 3) continue
      const cap = tag(v, 'Capitolo', 'Categoria', 'Gruppo', 'Sezione') || attr(v, 'Capitolo') || 'Importato'
      const cod = tag(v, 'Codice', 'CodiceVoce', 'Code', 'Tariffa') || attr(v, 'ID') || `V${voci.length + 1}`
      const um = tag(v, 'UnMis', 'UnitaMisura', 'UM', 'Unit') || 'nr'
      const pu = num(tag(v, 'PrezzoUnitario', 'Prezzo', 'PU', 'Price'))
      const qt = num(tag(v, 'Quantita', 'Qt', 'Qta', 'QuantitaTotale'))
      voci.push({ capitolo: cap.slice(0, 100), codice: cod.slice(0, 30), descrizione: desc.slice(0, 500), um: um.slice(0, 10), quantita: qt, prezzo_unitario: pu, importo: qt * pu })
      found++
    }
    if (found > 0) return voci
  }

  // STRATEGIA 3: Cerca attributi inline su elementi ripetuti (es. <Voce Cod="..." Desc="..." UM="..." PU="..." Qt="..."/>)
  const inlineRe = /<([A-Za-z]+)[^>]*\b(?:Descrizione|Description|Desc)="([^"]{5,})"[^>]*\b(?:PrezzoUnitario|PU|Prezzo|Price)="([^"]+)"[^>]*/gi
  let m: RegExpExecArray | null
  while ((m = inlineRe.exec(xml)) !== null) {
    const fullTag = m[0]
    const desc = m[2]
    const pu = num(m[3])
    const cod = attr(fullTag, 'Codice', 'Cod', 'Code', 'ID') || `A${voci.length + 1}`
    const um = attr(fullTag, 'UM', 'UnMis', 'Unit') || 'nr'
    const qt = num(attr(fullTag, 'Quantita', 'Qt', 'Qta', 'Quantity'))
    const cap = attr(fullTag, 'Capitolo', 'Categoria', 'Gruppo') || 'Importato'
    if (desc.length >= 3) voci.push({ capitolo: cap.slice(0,100), codice: cod.slice(0,30), descrizione: desc.slice(0,500), um: um.slice(0,10), quantita: qt, prezzo_unitario: pu, importo: qt * pu })
  }

  return voci
}

// Claude AI come parser di ultima istanza
async function parseWithClaude(xmlContent: string, apiKey: string): Promise<VoceParsed[]> {
  const prompt = `Sei un esperto di computi metrici edili italiani (software Primus/DEI).
Analizza questo XML di un file XPWE esportato da Primus e estrai TUTTE le voci del computo metrico.
Rispondi SOLO con un array JSON valido. Nessun testo, nessun markdown. Solo il JSON.
Schema per ogni voce: {"capitolo":"string","codice":"string","descrizione":"string","um":"string","quantita":number,"prezzo_unitario":number,"importo":number}
Se quantita o prezzo sono 0, metti 0. La descrizione NON deve essere vuota.
XML (potrebbe essere troncato): ${xmlContent.slice(0, 8000)}`

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
    let xmlContent = ''
    let allContents: string[] = []

    // Prova a leggere come ZIP
    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries().filter(e => !e.isDirectory && e.getData().length > 50)
      // Ordina per dimensione (più grande prima) e prova tutti
      entries.sort((a, b) => b.getData().length - a.getData().length)
      for (const entry of entries) {
        // Prova UTF-8 e poi Latin-1
        try { allContents.push(entry.getData().toString('utf8')) } catch {}
        try { allContents.push(entry.getData().toString('latin1')) } catch {}
      }
      if (allContents.length > 0) xmlContent = allContents[0]
    } catch {
      // Non è un ZIP — leggi come testo diretto (varie encoding)
      allContents = [
        buffer.toString('utf8'),
        buffer.toString('latin1'),
      ]
      xmlContent = allContents[0]
    }

    // Filtra contenuti troppo corti
    allContents = allContents.filter(c => c && c.trim().length > 50)

    if (allContents.length === 0) {
      return NextResponse.json({ ok: false, errore: 'File vuoto o illeggibile' })
    }

    // Tenta il parsing XML su tutti i contenuti estratti
    let voci: VoceParsed[] = []
    let xmlPreview = ''
    for (const content of allContents) {
      voci = parseXML(content)
      if (voci.length > 0) { xmlContent = content; break }
      if (!xmlPreview) xmlPreview = content.slice(0, 400)
    }

    // Fallback Claude AI se il parser non trova niente
    if (voci.length === 0) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (anthropicKey) {
        console.log('xpwe-parse: fallback Claude AI, xmlPreview:', xmlPreview.slice(0, 100))
        voci = await parseWithClaude(xmlContent || allContents[0] || '', anthropicKey)
        if (voci.length > 0) {
          return NextResponse.json({ ok: true, voci, fonte: 'AI', totale: voci.length })
        }
      }
      return NextResponse.json({
        ok: false,
        errore: 'Formato XPWE non riconosciuto. Contatta il supporto con il tuo file.',
        xmlPreview: xmlPreview.slice(0, 200)
      })
    }

    return NextResponse.json({ ok: true, voci, fonte: 'parser', totale: voci.length })
  } catch (err) {
    console.error('xpwe-parse error:', err)
    return NextResponse.json({ ok: false, errore: `Errore: ${String(err)}` }, { status: 500 })
  }
}
