import { randomUUID } from 'crypto'
import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
// ─── Parser XML per XPWE Primus ──────────────────────────────────────────────
// Struttura REALE verificata su file CM_Variante_CPM.xpwe:
// - EPItem usa ATTRIBUTO ID="614" e ELEMENTI FIGLI <Tariffa>, <DesEstesa>, ecc.
// - VCItem usa ATTRIBUTO ID="3"  e ELEMENTI FIGLI <IDEP>, <Quantita>, <IDSpCat>, ecc.
// - SuperCategorie: <DGSuperCategorieItem ID="1"><DesSintetica>...</DesSintetica>
// - Categorie:      <DGCategorieItem ID="1"><DesSintetica>...</DesSintetica>

function getAttr(tag: string, name: string): string {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag)
  return m ? m[1].trim() : ''
}

function getChild(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i').exec(xml)
  if (!m) return ''
  return m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

function getChildLong(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)
  if (!m) return ''
  return m[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
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

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const commessaId = formData.get('commessa_id') as string

    if (!file || !commessaId) {
      return NextResponse.json({ error: 'file e commessa_id obbligatori' }, { status: 400 })
    }

    // Leggo il file
    const xml = await file.text()

    // Validazione formato
    if (!xml.includes('PweDocumento') || !xml.includes('EPItem')) {
      return NextResponse.json({
        error: 'File non riconosciuto come XPWE Primus. Assicurati di esportare da PriMus ACCA in formato .xpwe'
      }, { status: 400 })
    }

    // ── 1. Parse SuperCategorie ──────────────────────────────────────────────
    const superCatMap: Record<string, string> = {}
    const scItems = findAllElements(xml, 'DGSuperCategorieItem')
    for (const sc of scItems) {
      const id = getAttr(sc, 'ID')
      const des = getChild(sc, 'DesSintetica')
      if (id) superCatMap[id] = des
    }

    // ── 2. Parse Categorie ───────────────────────────────────────────────────
    const catMap: Record<string, string> = {}
    const catItems = findAllElements(xml, 'DGCategorieItem')
    for (const cat of catItems) {
      const id = getAttr(cat, 'ID')
      const des = getChild(cat, 'DesSintetica')
      if (id) catMap[id] = des
    }

    // ── 3. Parse EPItem (Elenco Prezzi) ──────────────────────────────────────
    interface EPParsed {
      xpweId: string
      tariffa: string
      descrizione: string
      um: string
      prezzo: number
      incSic: number
      incMdo: number
      incMat: number
      incAttr: number
      tipoEP: string
    }
    const epList: EPParsed[] = []
    const epById: Record<string, EPParsed> = {}
    const epItems = findAllElements(xml, 'EPItem')

    for (const ep of epItems) {
      const xpweId = getAttr(ep, 'ID')
      if (!xpweId) continue

      const tariffa  = getChild(ep, 'Tariffa') || xpweId
      const desEst   = getChildLong(ep, 'DesEstesa') || getChild(ep, 'DesRidotta') || ''
      const um       = getChild(ep, 'UnMisura') || 'a corpo'
      const prezzoStr = getChild(ep, 'Prezzo1') || '0'
      const incSicStr = getChild(ep, 'IncSIC')  || '0'
      const incMdoStr = getChild(ep, 'IncMDO')  || '0'
      const incMatStr = getChild(ep, 'IncMAT')  || '0'
      const incAttrStr = getChild(ep, 'IncATTR') || '0'
      const tipoEP   = getChild(ep, 'TipoEP')   || '0'

      const parsed: EPParsed = {
        xpweId,
        tariffa,
        descrizione: desEst,
        um: um.slice(0, 20),
        prezzo:   parseFloat(prezzoStr.replace(',', '.'))  || 0,
        incSic:   parseFloat(incSicStr.replace(',', '.'))  || 0,
        incMdo:   parseFloat(incMdoStr.replace(',', '.'))  || 0,
        incMat:   parseFloat(incMatStr.replace(',', '.'))  || 0,
        incAttr:  parseFloat(incAttrStr.replace(',', '.')) || 0,
        tipoEP,
      }
      epList.push(parsed)
      epById[xpweId] = parsed
    }

    // ── 4. Parse VCItem (Voci Computo) con Misure ────────────────────────────
    interface MisuraParsed {
      nota: string
      nr: number
      lunghezza: number
      larghezza: number
      h_peso: number
    }
    interface VCParsed {
      idep: string
      quantita: number
      idSpCat: string
      idCat: string
      idSbCat: string
      misure: MisuraParsed[]
    }
    const vcList: VCParsed[] = []
    const vcItems = findAllElements(xml, 'VCItem')

    for (const vc of vcItems) {
      const idep = getChild(vc, 'IDEP')
      if (!idep) continue
      const qStr = getChild(vc, 'Quantita') || '0'

      // Parse <Misure> block
      const misure: MisuraParsed[] = []
      const misureBlockMatch = /<Misure(?:[^>]*)>([\s\S]*?)<\/Misure>/i.exec(vc)
      if (misureBlockMatch) {
        const misXml = misureBlockMatch[1]
        const miRe = /<MisureItem(?:[^>]*)>([\s\S]*?)<\/MisureItem>/gi
        let miMatch
        while ((miMatch = miRe.exec(misXml)) !== null) {
          const mi = miMatch[0]
          const nota     = getChild(mi, 'Nota')
          const nrStr    = getChild(mi, 'NR')
          const lungStr  = getChild(mi, 'Lung')
          const largStr  = getChild(mi, 'Larg')
          const hpesoStr = getChild(mi, 'HPeso')
          const nr    = nrStr    ? (parseFloat(nrStr.replace(',', '.'))    || 0) : 1
          const lung  = lungStr  ? (parseFloat(lungStr.replace(',', '.'))  || 0) : 1
          const larg  = largStr  ? (parseFloat(largStr.replace(',', '.'))  || 0) : 1
          const hpeso = hpesoStr ? (parseFloat(hpesoStr.replace(',', '.')) || 0) : 1
          misure.push({ nota, nr, lunghezza: lung, larghezza: larg, h_peso: hpeso })
        }
      }

      vcList.push({
        idep,
        quantita:  parseFloat(qStr.replace(',', '.')) || 0,
        idSpCat:   getChild(vc, 'IDSpCat') || '0',
        idCat:     getChild(vc, 'IDCat')   || '0',
        idSbCat:   getChild(vc, 'IDSbCat') || '0',
        misure,
      })
    }

    // ── 5. Gestisci computo_metrico ──────────────────────────────────────────
    const db = supabase as any

    await db.from('computo_metrico').delete().eq('commessa_id', commessaId)

    const { data: computo, error: errComputo } = await db
      .from('computo_metrico')
      .insert({
        commessa_id: commessaId,
        fonte: 'XPWE',
        data_import: new Date().toISOString().split('T')[0],
        note: `${file.name} · ${epList.length} tariffe · ${vcList.length} voci`,
      })
      .select('id')
      .single()

    if (errComputo || !computo) {
      throw new Error(`Errore creazione computo: ${errComputo?.message}`)
    }
    const computoId = computo.id as string

    // ── 6. Insert tariffe in batch ───────────────────────────────────────────
    await db.from('tariffe').delete().eq('commessa_id', commessaId)
    await db.from('voci_computo').delete().eq('computo_id', computoId)

    const BATCH = 50
    for (let i = 0; i < epList.length; i += BATCH) {
      const batch = epList.slice(i, i + BATCH).map(ep => ({
        commessa_id:                 commessaId,
        codice_tariffa:              ep.tariffa.slice(0, 200),
        descrizione:                 ep.descrizione || '(senza descrizione)',
        unita_misura:                ep.um,
        prezzo_unitario:             ep.prezzo,
        prezzo_unitario_lista:       ep.prezzo,
        incidenza_sicurezza_interna: ep.incSic / 100,
        voce_sicurezza:              ep.tipoEP === '2',
        voce_sicurezza_speciale:     ep.tipoEP === '2',
        sezione:                     ep.tipoEP === '2' ? 'SICUREZZA' : ep.tipoEP === '3' ? 'ECONOMIA' : 'LAVORI',
        ribassabile:                 ep.tipoEP !== '2',
        fonte:                       'XPWE',
      }))

      const { error: errT } = await db.from('tariffe').insert(batch)
      if (errT) throw new Error(`Errore insert tariffe: ${errT.message}`)
    }

    // ── 7. Leggo tariffe inserite per costruire mappa codice → id ────────────
    const { data: tariffeDB } = await db
      .from('tariffe')
      .select('id, codice_tariffa')
      .eq('commessa_id', commessaId)

    const tariffeByCode: Record<string, string> = {}
    for (const t of (tariffeDB || [])) {
      tariffeByCode[t.codice_tariffa] = t.id
    }

    const tariffeByXpweId: Record<string, string> = {}
    for (const ep of epList) {
      const dbId = tariffeByCode[ep.tariffa.slice(0, 200)]
      if (dbId) tariffeByXpweId[ep.xpweId] = dbId
    }

    // ── 8. Build voci con ID client-side (per collegare misurazioni) ──────────
    interface VoceWithMeta {
      id: string
      misure: MisuraParsed[]
      computo_id: string
      codice: string
      codice_prezzario: string
      descrizione: string
      um: string
      quantita: number
      prezzo_unitario: number
      importo: number
      capitolo: string
      categoria: string
      note: string
      sic_interna_percentuale: number
      sic_interna_importo: number
    }

    const vociWithMeta: VoceWithMeta[] = vcList
      .filter(vc => tariffeByXpweId[vc.idep])
      .map(vc => {
        const ep = epById[vc.idep]
        const prezzo = ep?.prezzo || 0
        const quantita = vc.quantita
        const importo = parseFloat((quantita * prezzo).toFixed(2))

        const superCat = vc.idSpCat !== '0' ? (superCatMap[vc.idSpCat] || `SC${vc.idSpCat}`) : null
        const cat      = vc.idCat   !== '0' ? (catMap[vc.idCat]        || `C${vc.idCat}`)    : null
        const capitolo = superCat || cat || 'Generale'

        const sicPct    = ep?.incSic || 0
        const sicImporto = Math.round((sicPct / 100 * prezzo) * 100) / 100

        return {
          id: randomUUID(),
          misure: vc.misure,
          computo_id:              computoId,
          codice:                  (ep?.tariffa || vc.idep).slice(0, 200),
          codice_prezzario:        (ep?.tariffa || vc.idep).slice(0, 200),
          descrizione:             ep?.descrizione || '(senza descrizione)',
          um:                      (ep?.um || 'a corpo').slice(0, 20),
          quantita,
          prezzo_unitario:         prezzo,
          importo,
          capitolo:                capitolo.slice(0, 200),
          categoria:               (cat || '').slice(0, 30),
          note:                    cat ? `${superCat || ''} > ${cat}` : '',
          sic_interna_percentuale: sicPct,
          sic_interna_importo:     sicImporto,
        }
      })

    // Strip misure prima dell'insert DB
    const vociInsert = vociWithMeta.map(({ misure: _m, ...rest }) => rest)

    for (let i = 0; i < vociInsert.length; i += BATCH) {
      const { error: errV } = await db
        .from('voci_computo')
        .insert(vociInsert.slice(i, i + BATCH))
      if (errV) throw new Error(`Errore insert voci: ${errV.message}`)
    }

    // ── 9. Insert misurazioni con ID pre-generati ────────────────────────────
    const misurazioniAll: Array<{
      voce_id: string; commessa_id: string; nota: string
      nr: number; lunghezza: number; larghezza: number; h_peso: number
      quantita: number; ordine: number
    }> = []

    for (const v of vociWithMeta) {
      for (let j = 0; j < v.misure.length; j++) {
        const m = v.misure[j]
        misurazioniAll.push({
          voce_id:     v.id,
          commessa_id: commessaId,
          nota:        m.nota,
          nr:          m.nr,
          lunghezza:   m.lunghezza,
          larghezza:   m.larghezza,
          h_peso:      m.h_peso,
          quantita:    parseFloat((m.nr * m.lunghezza * m.larghezza * m.h_peso).toFixed(4)),
          ordine:      j + 1,
        })
      }
    }

    // Cancella sempre le vecchie misurazioni (evita orfane se il nuovo XPWE non ha <Misure>)
    await db.from('voci_computo_misurazioni').delete().eq('commessa_id', commessaId)
    if (misurazioniAll.length > 0) {
      for (let i = 0; i < misurazioniAll.length; i += BATCH) {
        const { error: errMis } = await db
          .from('voci_computo_misurazioni')
          .insert(misurazioniAll.slice(i, i + BATCH))
        if (errMis) console.warn('Misurazioni insert warning:', errMis.message)
      }
    }

    // ── 10. Aggiorna importo_contrattuale su commessa ─────────────────────────
    const importoTotale = vociInsert.reduce((s, v) => s + v.importo, 0)
    await db.from('commesse')
      .update({ importo_contrattuale: parseFloat(importoTotale.toFixed(2)) })
      .eq('id', commessaId)

    return NextResponse.json({
      ok: true,
      tariffe:        epList.length,
      voci:           vociInsert.length,
      misurazioni:    misurazioniAll.length,
      importo_totale: importoTotale,
      supercategorie: Object.keys(superCatMap).length,
      categorie:      Object.keys(catMap).length,
    })

  } catch (e) {
    console.error('XPWE parse error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore sconosciuto' },
      { status: 500 }
    )
  }
}
