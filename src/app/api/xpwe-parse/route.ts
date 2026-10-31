import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getUserClient } from '@/lib/supabaseServer'
import {
  DIM_FIELDS, DimField, FLAG_DEDUZIONE, FLAG_VEDI_VOCE,
  buildFormula, calcolaQuantita, parseValoreXpwe,
} from '@/lib/misurazioni'
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

/**
 * Valore di un tag con nome ESATTO (getChild con "Lung" catturerebbe anche "<Lunghezza>").
 * Prova i nomi in ordine; tag vuoto o autochiuso (<Lunghezza/>) → ''.
 */
function getTag(xml: string, ...tags: string[]): string {
  for (const tag of tags) {
    const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'i').exec(xml)
    if (m) {
      return m[1]
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        .trim()
    }
    if (new RegExp(`<${tag}(?:\\s[^>]*)?/>`, 'i').test(xml)) return ''
  }
  return ''
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
  // Client Supabase con il token dell'utente: le RLS si applicano come nel browser
  const auth = await getUserClient(req)
  if (auth.response) return auth.response
  const db = auth.db

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

    // ── 4. Parse VCItem (Voci Computo) con righe di misura ───────────────────
    // Formato PriMus reale: <PweVCMisure><RGItem> con Descrizione, PartiUguali,
    // Lunghezza, Larghezza, HPeso, Quantita, Flags, IDVV.
    // Vecchi nomi mantenuti come alternativa: <Misure><MisureItem> con Nota, NR, Lung, Larg.
    interface MisuraParsed {
      descrizione: string | null
      dims: Record<DimField, number | null>
      formule: Partial<Record<DimField, string>>
      quantita: number | null
      flags: number | null
      idvv: number | null
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
    // ID XPWE della voce → numero progressivo nel file (come "Vedi voce n." di PriMus) + IDEP
    const vcRifById: Record<string, { n: number; idep: string }> = {}

    vcItems.forEach((vc, idx) => {
      const vcId = getAttr(vc.slice(0, vc.indexOf('>') + 1), 'ID')
      const idep = getChild(vc, 'IDEP')
      if (vcId) vcRifById[vcId] = { n: idx + 1, idep }
      if (!idep) return
      const qStr = getChild(vc, 'Quantita') || '0'

      const misure: MisuraParsed[] = []
      const blocco = /<(PweVCMisure|Misure)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i.exec(vc)
      if (blocco) {
        const riRe = /<(RGItem|MisureItem)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi
        let ri
        while ((ri = riRe.exec(blocco[2])) !== null) {
          const r = ri[2]
          const dims = {} as Record<DimField, number | null>
          const formule: Partial<Record<DimField, string>> = {}
          const raw: Record<DimField, string> = {
            parti_uguali: getTag(r, 'PartiUguali', 'NR'),
            lunghezza:    getTag(r, 'Lunghezza', 'Lung'),
            larghezza:    getTag(r, 'Larghezza', 'Larg'),
            altezza_peso: getTag(r, 'HPeso'),
          }
          for (const f of DIM_FIELDS) {
            const { valore, formula } = parseValoreXpwe(raw[f])
            dims[f] = valore
            if (formula) formule[f] = formula
          }
          const flagsStr = getTag(r, 'Flags')
          const idvvStr  = getTag(r, 'IDVV')
          const flags = flagsStr ? parseInt(flagsStr, 10) : null
          const idvv  = idvvStr  ? parseInt(idvvStr, 10)  : null
          const tutteVuote = DIM_FIELDS.every(f => dims[f] === null)
          let quantita = parseValoreXpwe(getTag(r, 'Quantita')).valore
          if (quantita === null) {
            // Vecchio formato senza <Quantita>: prodotto dei soli campi valorizzati
            quantita = calcolaQuantita({ ...dims, is_negativo: null, flags })
          }
          // Riga titolo (es. "Piano terra"): nessuna misura → nessuna quantità
          if (tutteVuote && quantita === 0) quantita = null
          misure.push({
            descrizione: getTag(r, 'Descrizione', 'Nota') || null,
            dims, formule, quantita,
            flags: Number.isFinite(flags) ? flags : null,
            idvv:  Number.isFinite(idvv)  ? idvv  : null,
          })
        }
      }

      vcList.push({
        idep,
        quantita:  parseValoreXpwe(qStr).valore ?? 0,
        idSpCat:   getChild(vc, 'IDSpCat') || '0',
        idCat:     getChild(vc, 'IDCat')   || '0',
        idSbCat:   getChild(vc, 'IDSbCat') || '0',
        misure,
      })
    })

    // ── 5. Sostituzione del computo precedente ───────────────────────────────
    // Tutte le cancellazioni avvengono PRIMA di qualsiasi insert e ognuna viene
    // verificata ricontando le righe: con le RLS una DELETE non permessa non dà
    // errore ma cancella 0 righe. Se qualcosa resta, l'import si ferma senza
    // inserire nulla → niente voci/tariffe duplicate.
    // Ordine: misurazioni → voci → computo_metrico → tariffe.
    const conta = async (q: any): Promise<number> => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const { count, error } = await q
      if (error) throw new Error(`Errore verifica cancellazione: ${error.message}`)
      return count ?? 0
    }
    const permessi = 'Verifica i permessi dell\'utente su questa commessa.'

    const { data: vecchiComputi, error: errVC } = await db.from('computo_metrico').select('id').eq('commessa_id', commessaId)
    if (errVC) throw new Error(`Errore lettura computo precedente: ${errVC.message}`)
    const vecchiComputoIds: string[] = (vecchiComputi || []).map((c: { id: string }) => c.id)

    if (vecchiComputoIds.length > 0) {
      const vecchieVoci: string[] = []
      for (let from = 0; ; from += 1000) {
        const { data: vv, error: errVV } = await db.from('voci_computo').select('id')
          .in('computo_id', vecchiComputoIds).order('id').range(from, from + 999)
        if (errVV) throw new Error(`Errore lettura voci precedenti: ${errVV.message}`)
        vecchieVoci.push(...(vv || []).map((v: { id: string }) => v.id))
        if (!vv || vv.length < 1000) break
      }

      // 5a. misurazioni delle voci precedenti (la tabella non ha commessa_id)
      for (let i = 0; i < vecchieVoci.length; i += 200) {
        const { error: errDel } = await db.from('voci_computo_misurazioni').delete()
          .in('voce_computo_id', vecchieVoci.slice(i, i + 200))
        if (errDel) throw new Error(`Errore cancellazione misurazioni precedenti: ${errDel.message}`)
      }

      // 5b. voci precedenti
      for (let i = 0; i < vecchieVoci.length; i += 200) {
        const { error: errDel } = await db.from('voci_computo').delete().in('id', vecchieVoci.slice(i, i + 200))
        if (errDel) throw new Error(`Errore cancellazione voci precedenti: ${errDel.message}`)
      }
      const vociRimaste = await conta(db.from('voci_computo').select('id', { count: 'exact', head: true }).in('computo_id', vecchiComputoIds))
      if (vociRimaste > 0) {
        throw new Error(`Import interrotto prima di inserire dati: ${vociRimaste} voci del computo precedente non sono state eliminate. ${permessi}`)
      }

      // 5c. testata computo precedente
      const { error: errDelC } = await db.from('computo_metrico').delete().eq('commessa_id', commessaId)
      if (errDelC) throw new Error(`Errore cancellazione computo precedente: ${errDelC.message}`)
      const computiRimasti = await conta(db.from('computo_metrico').select('id', { count: 'exact', head: true }).eq('commessa_id', commessaId))
      if (computiRimasti > 0) {
        throw new Error(`Import interrotto prima di inserire dati: il computo precedente non è stato eliminato. ${permessi}`)
      }
    }

    // 5d. tariffe precedenti della commessa
    const { error: errDelT } = await db.from('tariffe').delete().eq('commessa_id', commessaId)
    if (errDelT) throw new Error(`Errore cancellazione tariffe precedenti: ${errDelT.message}`)
    const tariffeRimaste = await conta(db.from('tariffe').select('id', { count: 'exact', head: true }).eq('commessa_id', commessaId))
    if (tariffeRimaste > 0) {
      throw new Error(`Import interrotto prima di inserire dati: ${tariffeRimaste} tariffe precedenti non sono state eliminate. ${permessi}`)
    }

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

    // ── 9. Insert misurazioni (voce_computo_id = ID voce pre-generato) ───────
    const misurazioniAll: Array<{
      voce_computo_id: string
      descrizione: string | null
      parti_uguali: number | null; lunghezza: number | null
      larghezza: number | null; altezza_peso: number | null
      formula: string | null
      quantita_calc: number | null
      is_negativo: boolean
      flags: number | null
      rif_idvv: number | null
      ordine: number
    }> = []

    for (const v of vociWithMeta) {
      for (let j = 0; j < v.misure.length; j++) {
        const m = v.misure[j]
        const vediVoce = ((m.flags ?? 0) & FLAG_VEDI_VOCE) !== 0 && m.idvv !== null && m.idvv > 0
        let rif: string | null = null
        if (vediVoce) {
          const ref = vcRifById[String(m.idvv)]
          const tariffa = ref ? epById[ref.idep]?.tariffa : undefined
          rif = ref ? `Vedi voce n. ${ref.n}${tariffa ? ` (${tariffa})` : ''}` : `Vedi voce ID ${m.idvv}`
        }
        misurazioniAll.push({
          voce_computo_id: v.id,
          descrizione:     m.descrizione,
          parti_uguali:    m.dims.parti_uguali,
          lunghezza:       m.dims.lunghezza,
          larghezza:       m.dims.larghezza,
          altezza_peso:    m.dims.altezza_peso,
          formula:         buildFormula({ rif, campi: m.formule }),
          quantita_calc:   m.quantita,
          is_negativo:     ((m.flags ?? 0) & FLAG_DEDUZIONE) !== 0 || (m.quantita ?? 0) < 0,
          flags:           m.flags,
          rif_idvv:        m.idvv,
          ordine:          j + 1,
        })
      }
    }

    for (let i = 0; i < misurazioniAll.length; i += BATCH) {
      const { error: errMis } = await db
        .from('voci_computo_misurazioni')
        .insert(misurazioniAll.slice(i, i + BATCH))
      if (errMis) {
        throw new Error(
          `Import interrotto: errore nel salvataggio delle righe di misura ` +
          `(righe ${i + 1}–${Math.min(i + BATCH, misurazioniAll.length)} di ${misurazioniAll.length}): ${errMis.message}. ` +
          `Le voci del computo sono state importate ma le misurazioni sono incomplete: risolvi il problema e reimporta il file.`
        )
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
