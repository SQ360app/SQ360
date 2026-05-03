import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Tipi XPWE ────────────────────────────────────────────────────────────────

interface EPItem {
  ID: string
  Tariffa: string
  DesEstesa: string
  DesSintetica?: string
  UnMisura: string
  Prezzo1: string
  IncMDO?: string   // incidenza manodopera
  IncMAT?: string   // incidenza materiali
  IncATTR?: string  // incidenza attrezzatura
  IncSIC?: string   // incidenza sicurezza interna ← chiave per formula ribasso
  TipoVoce?: string // 'L'=Lavoro, 'S'=Sicurezza, 'E'=Economia, 'N'=Nolo
}

interface VCItem {
  IDEP: string
  Quantita: string
  IDSpCat?: string  // supercategoria
  IDCat?: string    // categoria
  IDSbCat?: string  // subcategoria
  NrOrdinale?: string
}

interface Capitolo {
  ID: string
  DesSintetica: string
}

// ─── Parser XML manuale (no librerie) ─────────────────────────────────────────

function extractAll(xml: string, tag: string): string[] {
  const results: string[] = []
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  let m
  while ((m = re.exec(xml)) !== null) results.push(m[0])
  return results
}

function attr(xml: string, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(xml)
  return m ? m[1].trim() : ''
}

function innerText(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml)
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : ''
}

function parseXPWE(xml: string) {
  // ── Supercategorie
  const superCatMap: Record<string, string> = {}
  const scBlock = xml.match(/<SuperCategorie[\s\S]*?<\/SuperCategorie>/)
  if (scBlock) {
    const scItems = extractAll(scBlock[0], 'SupCat')
    for (const sc of scItems) {
      const id = attr(sc, 'ID') || innerText(sc, 'ID')
      const des = attr(sc, 'DesSintetica') || innerText(sc, 'DesSintetica')
      if (id) superCatMap[id] = des
    }
  }

  // ── Categorie
  const catMap: Record<string, string> = {}
  const catBlock = xml.match(/<Categorie[\s\S]*?<\/Categorie>/)
  if (catBlock) {
    const catItems = extractAll(catBlock[0], 'Cat')
    for (const c of catItems) {
      const id = attr(c, 'ID') || innerText(c, 'ID')
      const des = attr(c, 'DesSintetica') || innerText(c, 'DesSintetica')
      if (id) catMap[id] = des
    }
  }

  // ── Elenco Prezzi
  const epMap: Record<string, EPItem> = {}
  const epBlock = xml.match(/<PweElencoPrezzi[\s\S]*?<\/PweElencoPrezzi>/)
  if (epBlock) {
    const epItems = extractAll(epBlock[0], 'EPItem')
    for (const ep of epItems) {
      const item: EPItem = {
        ID:          attr(ep, 'ID')          || innerText(ep, 'ID'),
        Tariffa:     attr(ep, 'Tariffa')     || innerText(ep, 'Tariffa'),
        DesEstesa:   attr(ep, 'DesEstesa')   || innerText(ep, 'DesEstesa'),
        DesSintetica:attr(ep, 'DesSintetica')|| innerText(ep, 'DesSintetica'),
        UnMisura:    attr(ep, 'UnMisura')    || innerText(ep, 'UnMisura'),
        Prezzo1:     attr(ep, 'Prezzo1')     || innerText(ep, 'Prezzo1'),
        IncMDO:      attr(ep, 'IncMDO')      || innerText(ep, 'IncMDO'),
        IncMAT:      attr(ep, 'IncMAT')      || innerText(ep, 'IncMAT'),
        IncATTR:     attr(ep, 'IncATTR')     || innerText(ep, 'IncATTR'),
        IncSIC:      attr(ep, 'IncSIC')      || innerText(ep, 'IncSIC'),
        TipoVoce:    attr(ep, 'TipoVoce')    || innerText(ep, 'TipoVoce'),
      }
      if (item.ID) epMap[item.ID] = item
    }
  }

  // ── Voci Computo
  const voci: VCItem[] = []
  const vcBlock = xml.match(/<PweVociComputo[\s\S]*?<\/PweVociComputo>/)
  if (vcBlock) {
    const vcItems = extractAll(vcBlock[0], 'VCItem')
    for (const vc of vcItems) {
      voci.push({
        IDEP:      attr(vc, 'IDEP')      || innerText(vc, 'IDEP'),
        Quantita:  attr(vc, 'Quantita')  || innerText(vc, 'Quantita'),
        IDSpCat:   attr(vc, 'IDSpCat')   || innerText(vc, 'IDSpCat'),
        IDCat:     attr(vc, 'IDCat')     || innerText(vc, 'IDCat'),
        IDSbCat:   attr(vc, 'IDSbCat')   || innerText(vc, 'IDSbCat'),
        NrOrdinale:attr(vc, 'NrOrdinale')|| innerText(vc, 'NrOrdinale'),
      })
    }
  }

  return { superCatMap, catMap, epMap, voci }
}

// ─── Determina sezione dalla TipoVoce ─────────────────────────────────────────

function getSezione(tipoVoce?: string): string {
  if (!tipoVoce) return 'LAVORI'
  const t = tipoVoce.toUpperCase()
  if (t === 'S') return 'SICUREZZA'
  if (t === 'E') return 'ECONOMIA'
  return 'LAVORI'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const commessaId = formData.get('commessa_id') as string

    if (!file || !commessaId) {
      return NextResponse.json({ error: 'file e commessa_id obbligatori' }, { status: 400 })
    }

    const xml = await file.text()

    if (!xml.includes('PweDocumento') && !xml.includes('PweVociComputo')) {
      return NextResponse.json({ error: 'File non riconosciuto come XPWE/PWE Primus' }, { status: 400 })
    }

    const { superCatMap, catMap, epMap, voci } = parseXPWE(xml)

    // 1. Crea o aggiorna il computo_metrico
    const { data: computo, error: computoErr } = await supabase
      .from('computo_metrico')
      .upsert({
        commessa_id: commessaId,
        fonte: 'XPWE',
        data_import: new Date().toISOString().split('T')[0],
        note: `Importato da ${file.name}`,
      }, { onConflict: 'commessa_id' })
      .select()
      .single()

    if (computoErr) throw computoErr

    // 2. Cancella le tariffe esistenti di questa commessa
    await supabase.from('tariffe').delete().eq('commessa_id', commessaId)

    // 3. Cancella le voci computo esistenti
    await supabase.from('voci_computo').delete().eq('computo_id', computo.id)

    // 4. Insert tariffe (elenco prezzi)
    const tariffeInsert = Object.values(epMap).map(ep => ({
      commessa_id:                commessaId,
      codice_tariffa:             ep.Tariffa || ep.ID,
      descrizione:                ep.DesEstesa || ep.DesSintetica || '(senza descrizione)',
      unita_misura:               ep.UnMisura || 'a corpo',
      prezzo_unitario:            parseFloat(ep.Prezzo1?.replace(',', '.') || '0') || 0,
      prezzo_unitario_lista:      parseFloat(ep.Prezzo1?.replace(',', '.') || '0') || 0,
      // Incidenze per formula ribasso
      incidenza_sicurezza_interna: parseFloat(ep.IncSIC?.replace(',', '.') || '0') / 100 || 0,
      pct_manodopera:             parseFloat(ep.IncMDO?.replace(',', '.') || '0') / 100 || 0,
      pct_materiali:              parseFloat(ep.IncMAT?.replace(',', '.') || '0') / 100 || 0,
      // Flag
      voce_sicurezza:             getSezione(ep.TipoVoce) === 'SICUREZZA',
      voce_sicurezza_speciale:    getSezione(ep.TipoVoce) === 'SICUREZZA',
      sezione:                    getSezione(ep.TipoVoce),
      ribassabile:                getSezione(ep.TipoVoce) !== 'SICUREZZA',
      fonte:                      'XPWE',
      // ID interno per join con voci
      _xpwe_id:                   ep.ID,
    }))

    // Insert in batch da 100
    const BATCH = 100
    const tariffeInserted: { id: string; _xpwe_id: string }[] = []
    for (let i = 0; i < tariffeInsert.length; i += BATCH) {
      const { data, error } = await supabase
        .from('tariffe')
        .insert(tariffeInsert.slice(i, i + BATCH))
        .select('id, codice_tariffa')
      if (error) throw error
      // Non possiamo fare join su _xpwe_id che non esiste nel DB
      // Creiamo una mappa codice_tariffa → id
    }

    // Rileggo le tariffe inserite per fare join
    const { data: tariffeDB } = await supabase
      .from('tariffe')
      .select('id, codice_tariffa')
      .eq('commessa_id', commessaId)

    const tariffeMap: Record<string, string> = {}
    for (const t of (tariffeDB || [])) {
      // Mappa codice_tariffa → uuid (per la join con IDEP delle voci)
      // IDEP in VCItem corrisponde all'ID interno Primus, non alla tariffa
      // Dobbiamo usare l'ordine di inserimento
    }

    // Mappa XPWE ID → tariffa DB id
    const xpweIdToDbId: Record<string, string> = {}
    const { data: tariffeAll } = await supabase
      .from('tariffe')
      .select('id, codice_tariffa')
      .eq('commessa_id', commessaId)

    // Ricostruiamo la mappa basandoci su codice_tariffa = Tariffa o ID XPWE
    for (const ep of Object.values(epMap)) {
      const codice = ep.Tariffa || ep.ID
      const found = tariffeAll?.find(t => t.codice_tariffa === codice)
      if (found) xpweIdToDbId[ep.ID] = found.id
    }

    // 5. Insert voci computo
    const vociInsert = voci
      .filter(vc => vc.IDEP && xpweIdToDbId[vc.IDEP])
      .map(vc => {
        const ep = epMap[vc.IDEP]
        const prezzoUnit = parseFloat(ep?.Prezzo1?.replace(',', '.') || '0') || 0
        const quantita = parseFloat(vc.Quantita?.replace(',', '.') || '0') || 0
        const supCat = vc.IDSpCat ? (superCatMap[vc.IDSpCat] || vc.IDSpCat) : null
        const cat = vc.IDCat ? (catMap[vc.IDCat] || vc.IDCat) : null

        return {
          computo_id:      computo.id,
          codice:          ep?.Tariffa || vc.IDEP,
          codice_prezzario:ep?.Tariffa || vc.IDEP,
          descrizione:     ep?.DesEstesa || ep?.DesSintetica || '(senza descrizione)',
          um:              ep?.UnMisura || 'a corpo',
          quantita,
          prezzo_unitario: prezzoUnit,
          importo:         quantita * prezzoUnit,
          capitolo:        supCat || cat || 'Generale',
          categoria:       (cat || '').slice(0, 30),
          note:            `Cat: ${cat || '—'} | SpCat: ${supCat || '—'}`,
        }
      })

    for (let i = 0; i < vociInsert.length; i += BATCH) {
      const { error } = await supabase
        .from('voci_computo')
        .insert(vociInsert.slice(i, i + BATCH))
      if (error) throw error
    }

    // 6. Aggiorna importo_contrattuale sulla commessa
    const importoTotale = vociInsert.reduce((acc, v) => acc + (v.importo || 0), 0)
    await supabase
      .from('commesse')
      .update({ importo_contrattuale: importoTotale })
      .eq('id', commessaId)

    return NextResponse.json({
      ok: true,
      tariffe: tariffeInsert.length,
      voci: vociInsert.length,
      importo_totale: importoTotale,
      supercategorie: Object.keys(superCatMap).length,
      categorie: Object.keys(catMap).length,
    })

  } catch (e) {
    console.error('XPWE parse error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore sconosciuto' },
      { status: 500 }
    )
  }
}
