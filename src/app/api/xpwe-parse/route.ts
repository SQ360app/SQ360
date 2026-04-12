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

// Estrae testo da un tag XML (prova tag multipli)
function tag(xml: string, ...tags: string[]): string {
  for (const t of tags) {
    const m = xml.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i'))
    if (m) return m[1].replace(/<!\.CDATA\.([\s\S]*?)\.>/g, '$1').replace(/<[^>]+>/g, ' ').trim()
  }
  return ''
}

// Estrae attributo da tag XML
function attr(xml: string, a: string): string {
  const m = xml.match(new RegExp(`${a}="([^"]*)"`, 'i'))
  return m ? m[1] : ''
}

// Estrae tutti i blocchi di un tag
function allTags(xml: string, ...tags: string[]): string[] {
  for (const t of tags) {
    const re = new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'gi')
    const res: string[] = []
    let m
    while ((m = re.exec(xml)) !== null) res.push(m[0])
    if (res.length > 0) return res
  }
  return []
}

function parseNum(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0
}

function parseXpweXml(xml: string): VoceParsed[] {
  const voci: VoceParsed[] = []

  // Prova formato 1: AlberoVoci / RamoDeiVoci / VersoVoce (Primus v3+)
  const capitoli1 = allTags(xml, 'RamoDeiVoci', 'CapitoloDeiVoci', 'Capitolo', 'Chapter')
  if (capitoli1.length > 0) {
    for (const cap of capitoli1) {
      const nomeCap = attr(cap, 'Descrizione') || attr(cap, 'Description') || tag(cap, 'Descrizione', 'Nome') || 'Capitolo'
      const vociXml = allTags(cap, 'VersoVoce', 'VoceAlbero', 'VersoDeiVoci', 'Item', 'Voce')
      for (const vXml of vociXml) {
        const tipoVoce = attr(vXml, 'TipoVoce') || attr(vXml, 'Type') || 'V'
        if (['U','T','S','G'].includes(tipoVoce.toUpperCase())) continue
        const desc = tag(vXml, 'Descrizione', 'DescrizioneVoce', 'Description', 'Testo', 'DescrVoce')
        if (!desc || desc.length < 3) continue
        const cod = tag(vXml, 'Codice', 'CodiceVoce', 'CodBreve', 'Code', 'ID') || attr(vXml, 'ID') || `V${voci.length+1}`
        const um = tag(vXml, 'UnMis', 'UnitaMisura', 'UM', 'Unit') || 'nr'
        const pu = parseNum(tag(vXml, 'PrezzoUnitario', 'Prezzo', 'PU', 'Price', 'UnitPrice'))
        const qt = parseNum(tag(vXml, 'Quantita', 'SommaMisure', 'Qt', 'Quantity', 'TotaleQuantita'))
        voci.push({ capitolo: nomeCap, codice: cod.slice(0,30), descrizione: desc.slice(0,500), um: um.slice(0,10), quantita: qt, prezzo_unitario: pu, importo: qt * pu })
      }
    }
    if (voci.length > 0) return voci
  }

  // Prova formato 2: SuperSintesi / CapitoloSintesi / SintesiArticolo (Primus v4+)
  const capitoli2 = allTags(xml, 'CapitoloSintesi', 'GruppoArticoli')
  if (capitoli2.length > 0) {
    for (const cap of capitoli2) {
      const nomeCap = attr(cap, 'Descrizione') || tag(cap, 'Descrizione') || 'Capitolo'
      const vociXml = allTags(cap, 'SintesiArticolo', 'Articolo', 'ArticoloSintesi')
      for (const vXml of vociXml) {
        const desc = tag(vXml, 'Descrizione', 'DescrizioneArticolo', 'Testo')
        if (!desc || desc.length < 3) continue
        const cod = tag(vXml, 'CodiceArticolo', 'Codice', 'Tariffa') || `A${voci.length+1}`
        const um = tag(vXml, 'UnMis', 'UnitaMisura', 'UM') || 'nr'
        const pu = parseNum(tag(vXml, 'PrezzoArticolo', 'PrezzoUnitario', 'Prezzo'))
        const qt = parseNum(tag(vXml, 'QuantitaArticolo', 'Quantita', 'Qt'))
        voci.push({ capitolo: nomeCap, codice: cod.slice(0,30), descrizione: desc.slice(0,500), um, quantita: qt, prezzo_unitario: pu, importo: qt * pu })
      }
    }
    if (voci.length > 0) return voci
  }

  // Prova formato 3: flat (nessun capitolo, voci dirette)
  const flat = allTags(xml, 'Voce', 'VoceComputo', 'Item', 'Row')
  if (flat.length > 0) {
    for (const vXml of flat) {
      const desc = tag(vXml, 'Descrizione', 'Description', 'Testo')
      if (!desc || desc.length < 3) continue
      const cod = tag(vXml, 'Codice', 'Code', 'CodiceVoce') || `V${voci.length+1}`
      const cap = tag(vXml, 'Capitolo', 'Categoria', 'Gruppo') || 'Importato'
      const um = tag(vXml, 'UM', 'UnMis', 'UnitaMisura') || 'nr'
      const pu = parseNum(tag(vXml, 'PrezzoUnitario', 'Prezzo', 'PU'))
      const qt = parseNum(tag(vXml, 'Quantita', 'Qt', 'Qta'))
      voci.push({ capitolo: cap, codice: cod.slice(0,30), descrizione: desc.slice(0,500), um, quantita: qt, prezzo_unitario: pu, importo: qt * pu })
    }
  }

  return voci
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, errore: 'Nessun file ricevuto' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    let xmlContent = ''

    // Prova a leggere come ZIP (XPWE = ZIP con XML dentro)
    try {
      const zip = new AdmZip(buffer)
      const entries = zip.getEntries().filter(e => !e.isDirectory)
      // Cerca il file XML principale (il più grande o quello con Computo/DEI nel nome)
      const xmlEntries = entries.filter(e => e.entryName.toLowerCase().endsWith('.xml'))
      const mainEntry = xmlEntries.sort((a, b) => b.getData().length - a.getData().length)[0]
        || entries.sort((a, b) => b.getData().length - a.getData().length)[0]
      if (mainEntry) xmlContent = mainEntry.getData().toString('utf8')
    } catch {
      // Non è un ZIP — prova come XML diretto (alcuni XPWE sono XML plain)
      xmlContent = buffer.toString('utf8')
    }

    if (!xmlContent || xmlContent.trim().length < 100) {
      return NextResponse.json({ ok: false, errore: 'File vuoto o formato non riconosciuto' })
    }

    const voci = parseXpweXml(xmlContent)

    if (voci.length === 0) {
      // Fallback: invia l'XML (troncato) a Claude per l'estrazione
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (anthropicKey) {
        const prompt = `Sei un esperto di computi metrici italiani. Analizza questo XML di Primus/XPWE ed estrai le voci del computo metrico.
Rispondi SOLO con JSON array: [{"capitolo":"...","codice":"...","descrizione":"...","um":"mc","quantita":0,"prezzo_unitario":0}]
XML: ${xmlContent.slice(0, 6000)}`
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
        })
        if (r.ok) {
          const d = await r.json() as { content?: Array<{ text?: string }> }
          const raw = d.content?.[0]?.text || ''
          const m = raw.match(/\[[\s\S]*\]/)
          if (m) {
            const aiVoci = JSON.parse(m[0]) as VoceParsed[]
            return NextResponse.json({ ok: true, voci: aiVoci, fonte: 'AI' })
          }
        }
      }
      return NextResponse.json({ ok: false, errore: 'Nessuna voce trovata. Verifica che il file XPWE sia valido e non corrotto.', xmlPreview: xmlContent.slice(0, 300) })
    }

    return NextResponse.json({ ok: true, voci, fonte: 'parser', totale: voci.length })
  } catch (err) {
    console.error('xpwe-parse error:', err)
    return NextResponse.json({ ok: false, errore: `Errore: ${String(err)}` }, { status: 500 })
  }
}
