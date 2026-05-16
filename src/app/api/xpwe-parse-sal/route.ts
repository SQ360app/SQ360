import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Stessa logica di parsing di /api/xpwe-parse, ma invece di salvare in voci_computo
// restituisce un mapping voce XPWE ↔ voce_computo esistente per la preview SAL.

function getAttr(tag: string, name: string): string {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag)
  return m ? m[1].trim() : ''
}

function getChild(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i').exec(xml)
  if (!m) return ''
  return m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&quot;/g,'"').trim()
}

function getChildLong(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)
  if (!m) return ''
  return m[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()
}

function findAllElements(xml: string, tag: string): string[] {
  const results: string[] = []
  const openTag = `<${tag} `
  let pos = 0
  while (true) {
    const start = xml.indexOf(openTag, pos)
    if (start === -1) break
    const closeTag = `</${tag}>`
    const end = xml.indexOf(closeTag, start)
    if (end === -1) break
    results.push(xml.slice(start, end + closeTag.length))
    pos = end + closeTag.length
  }
  return results
}

export async function POST(req: NextRequest) {
  try {
    const formData    = await req.formData()
    const file        = formData.get('file') as File | null
    const sal_id      = formData.get('sal_id') as string
    const commessa_id = formData.get('commessa_id') as string

    if (!file || !commessa_id) {
      return NextResponse.json({ ok: false, error: 'file e commessa_id obbligatori' }, { status: 400 })
    }

    const xml = await file.text()
    if (!xml.includes('PweDocumento') || !xml.includes('EPItem')) {
      return NextResponse.json({ ok: false, error: 'File non riconosciuto come XPWE Primus.' }, { status: 400 })
    }

    // ── Parse EPItem ─────────────────────────────────────────────────────────
    interface EPParsed { xpweId: string; tariffa: string; descrizione: string; um: string; prezzo: number }
    const epById: Record<string, EPParsed> = {}
    for (const ep of findAllElements(xml, 'EPItem')) {
      const xpweId = getAttr(ep, 'ID')
      if (!xpweId) continue
      epById[xpweId] = {
        xpweId,
        tariffa:     getChild(ep, 'Tariffa') || xpweId,
        descrizione: getChildLong(ep, 'DesEstesa') || getChild(ep, 'DesRidotta') || '',
        um:          (getChild(ep, 'UnMisura') || 'a corpo').slice(0, 20),
        prezzo:      parseFloat((getChild(ep, 'Prezzo1') || '0').replace(',', '.')) || 0,
      }
    }

    // ── Parse VCItem ─────────────────────────────────────────────────────────
    interface VCParsed { idep: string; quantita: number }
    const vcList: VCParsed[] = []
    for (const vc of findAllElements(xml, 'VCItem')) {
      const idep = getChild(vc, 'IDEP')
      if (!idep) continue
      vcList.push({
        idep,
        quantita: parseFloat((getChild(vc, 'Quantita') || '0').replace(',', '.')) || 0,
      })
    }

    // ── Carica voci_computo dal DB per questa commessa ────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: computo } = await supabase
      .from('computo_metrico').select('id').eq('commessa_id', commessa_id).single()

    if (!computo) {
      return NextResponse.json({ ok: false, error: 'Nessun computo importato per questa commessa.' }, { status: 400 })
    }

    const { data: vociDB } = await supabase
      .from('voci_computo')
      .select('id,codice,descrizione,um,quantita,prezzo_unitario')
      .eq('computo_id', computo.id)

    // Mappa codice → voce DB
    const vociByCode: Record<string, any> = {}
    for (const v of (vociDB || [])) {
      vociByCode[v.codice?.trim()?.toUpperCase()] = v
    }

    // ── Match XPWE ↔ computo ─────────────────────────────────────────────────
    const matched: any[] = []
    const seen = new Set<string>() // per deduplicare per tariffa

    for (const vc of vcList) {
      const ep = epById[vc.idep]
      if (!ep) continue
      const codice = ep.tariffa.trim()
      const key    = codice.toUpperCase()
      if (seen.has(key)) continue // somma duplicati allo stesso codice? per ora skip
      seen.add(key)
      const vDB = vociByCode[key]
      matched.push({
        codice,
        descrizione:      ep.descrizione || vDB?.descrizione || '',
        um:               ep.um || vDB?.um || '—',
        quantita_xpwe:    vc.quantita,
        prezzo_unitario:  vDB?.prezzo_unitario ?? ep.prezzo,
        quantita_contratto: vDB?.quantita ?? null,
        voce_computo_id:  vDB?.id ?? null,
      })
    }

    // Ordina: abbinate prima, poi non trovate
    matched.sort((a, b) => (b.voce_computo_id ? 1 : 0) - (a.voce_computo_id ? 1 : 0))

    return NextResponse.json({
      ok: true,
      sal_id,
      matched,
      totale_abbinate:    matched.filter(v => v.voce_computo_id).length,
      totale_non_trovate: matched.filter(v => !v.voce_computo_id).length,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Errore sconosciuto' },
      { status: 500 }
    )
  }
}
