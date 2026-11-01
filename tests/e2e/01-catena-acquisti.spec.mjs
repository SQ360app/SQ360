// ─── 1. Catena acquisti: RDA da computo → RDO a 2 fornitori → aggiudicazione →
//        ODA → DDT (verifica) → fattura passiva → conto economico ─────────────
// Utente: admin di A. Ogni esito verificato nel DB. Se un passo fallisce, i
// successivi ripiegano sui dati del seed (annotato nel report) per provare comunque il resto.
import { test } from '@playwright/test'
import { A, BASE, e2e, q, q1, attendi, accedi, mockAI, campo, annota, verifica, verificaUguale, messaggioAschermo, seguiDialoghi, apri, contesto, numIt, r2, oggi, tra, pdfFinto } from './helpers.mjs'

const F1 = e2e.fornitori.valido, F2 = e2e.fornitori.inScadenza
const nomeF = f => f.ragione_sociale || f.nome
const ids = e2e.voci.map(v => v.id)
const prezzi1 = Object.fromEntries(e2e.voci.map(v => [v.id, r2(v.pu * 0.9)]))          // F1: -10% sul prezzo di contratto
const totF1 = r2(e2e.voci.reduce((s, v) => s + r2(prezzi1[v.id] * v.quantita), 0))
const totF2 = r2(totF1 * 1.1)                                                          // F2 (da PDF + AI): +10% → vince F1
const ctx = contesto('acquisti')

const fallback = async (ti, chiave, sql, params, cosa) => {
  if (ctx[chiave]) return ctx[chiave]
  annota(ti, 'nota', `Passo precedente non riuscito: uso ${cosa} del seed`)
  ctx[chiave] = await q1(sql, params)
  return ctx[chiave]
}

test.describe('Catena acquisti', () => {
  test.beforeEach(async ({ page }) => { await accedi(page); seguiDialoghi(page) })

  test('1.1 RDA da computo (2 voci con WBS 1.1)', async ({ page }, ti) => {
    await apri(page, `${BASE}/computo`, 'tr.cmp-rvo')
    for (const v of e2e.voci) await page.locator(`tr.cmp-rvo:has-text("${v.codice}") input[type=checkbox]`).first().check()
    await page.getByRole('button', { name: '⚡ RDA' }).click()
    const rda = await attendi(() => q1(`SELECT * FROM public.rda WHERE commessa_id = $1 AND voci_ids @> $2::uuid[] AND codice NOT LIKE 'ALFA-%' ORDER BY created_at DESC LIMIT 1`, [A.commessa, ids]))
    verifica(ti, rda, 'RDA creata nel DB con le 2 voci selezionate', `nessuna RDA scritta dal pulsante "⚡ RDA" — a schermo: ${await messaggioAschermo(page)}`)
    ctx.rda = rda
    verificaUguale(ti, rda.voci_ids.length, 2, 'voci nella RDA')
    verificaUguale(ti, rda.azienda_id, A.id, 'azienda della RDA')
    verificaUguale(ti, rda.wbs_id, e2e.wbs.codice, 'WBS della RDA', 'WBS delle voci non riportata sulla RDA')
  })

  test('1.2 RDA approvata', async ({ page }, ti) => {
    const rda = await fallback(ti, 'rda', `SELECT * FROM public.rda WHERE commessa_id = $1 AND codice = 'ALFA-RDA-001'`, [A.commessa], 'la RDA')
    if (rda.stato !== 'approvata') {
      await apri(page, `${BASE}/rda`, `tr:has-text("${rda.codice}")`)
      await page.locator(`tr:has-text("${rda.codice}")`).getByRole('button', { name: '✅ Approva' }).click()
    }
    const ok = await attendi(() => q1(`SELECT stato FROM public.rda WHERE id = $1 AND stato = 'approvata'`, [rda.id]))
    verifica(ti, ok, 'RDA approvata nel DB', `stato RDA non aggiornato — a schermo: ${await messaggioAschermo(page)}`)
    ctx.rda = { ...rda, stato: 'approvata' }
  })

  test('1.3 RDO a 2 fornitori (gara multi-fornitore)', async ({ page }, ti) => {
    const rda = await fallback(ti, 'rda', `SELECT * FROM public.rda WHERE commessa_id = $1 AND codice = 'ALFA-RDA-001'`, [A.commessa], 'la RDA')
    await apri(page, `${BASE}/rda`, `tr:has-text("${rda.codice}")`)
    await page.locator(`tr:has-text("${rda.codice}")`).getByRole('button', { name: /Gara multi-fornitore/ }).click()
    const cerca = page.getByPlaceholder('Cerca fornitore per nome o ragione sociale...')
    for (const f of [F1, F2]) {
      await cerca.fill(f.nome.split(' ').pop())
      await page.locator('div', { hasText: nomeF(f) }).filter({ has: page.locator('span') }).last().click()
    }
    await page.getByRole('button', { name: /Invia a 2 fornitori/ }).click()
    const rdo = await attendi(async () => { const r = await q(`SELECT * FROM public.rdo WHERE rda_id = $1 AND rdo_gruppo_id IS NOT NULL ORDER BY fornitore`, [rda.id]); return r.length >= 2 ? r : null })
    verifica(ti, rdo, '2 RDO create nel DB per la RDA', `RDO non scritte — a schermo: ${await messaggioAschermo(page)}`)
    ctx.rdo1 = rdo.find(r => r.fornitore_id === F1.id); ctx.rdo2 = rdo.find(r => r.fornitore_id === F2.id)
    verifica(ti, ctx.rdo1 && ctx.rdo2, 'una RDO per ciascun fornitore scelto')
    verificaUguale(ti, rdo[0].rdo_gruppo_id, rdo[1].rdo_gruppo_id, 'stesso gruppo gara')
    verifica(ti, rdo.every(r => r.token_offerta), 'token per la pagina pubblica dell\'offerta')
    const st = await q1(`SELECT stato FROM public.rda WHERE id = $1`, [rda.id])
    verificaUguale(ti, st.stato, 'inviata', 'stato RDA dopo l\'invio')
    // la WBS lungo la catena è verificata a parte nel test 1.11
  })

  test('1.4 Offerta fornitore 1 dalla pagina pubblica /offerta (senza login)', async ({ browser }, ti) => {
    verifica(ti, ctx.rdo1, 'RDO del fornitore 1 disponibile', 'il passo 1.3 non ha creato le RDO')
    const pub = await (await browser.newContext()).newPage()
    await apri(pub, `/offerta/${ctx.rdo1.token_offerta}`, 'tr:has(input[placeholder="0,00"])')
    for (const v of e2e.voci) await pub.locator(`tr:has-text("${v.codice}") input[placeholder="0,00"]`).fill(String(prezzi1[v.id]))
    const risp = pub.waitForResponse(r => r.url().includes('/api/offerta/') && r.request().method() === 'POST')
    await pub.getByRole('button', { name: /invia/i }).last().click()
    const r = await risp
    const corpo = await r.json().catch(() => ({}))
    const rdo = await attendi(() => q1(`SELECT * FROM public.rdo WHERE id = $1 AND stato_offerta = 'ricevuta'`, [ctx.rdo1.id]))
    verifica(ti, rdo, 'offerta registrata nel DB', `HTTP ${r.status()}: ${corpo.error || corpo.errore || JSON.stringify(corpo).slice(0, 200)}`)
    verificaUguale(ti, Number(rdo.importo_offerta), totF1, 'importo offerta = Σ prezzo × quantità (ricalcolato dal server)')
    ctx.rdo1 = rdo
    await pub.close()
  })

  test('1.5 Offerta fornitore 2 da preventivo PDF (AI simulata)', async ({ page }, ti) => {
    verifica(ti, ctx.rdo2, 'RDO del fornitore 2 disponibile', 'il passo 1.3 non ha creato le RDO')
    await mockAI(page, { 'rdo-extract-offerta': { ok: true, rdo_id: ctx.rdo2.id, data: {
      ragione_sociale: nomeF(F2), data: oggi(), importo_totale: totF2, condizioni_pagamento: '60 gg d.f.f.m.', note: 'estratto da AI simulata',
      voci: e2e.voci.map(v => ({ descrizione: v.codice, um: v.um, quantita: v.quantita, prezzo_unitario: r2(v.pu), importo: r2(v.pu * v.quantita) })) } } })
    await apri(page, `${BASE}/rdo`, `tr:has-text("${ctx.rdo2.codice}")`)
    await page.locator(`tr:has-text("${ctx.rdo2.codice}")`).getByRole('button', { name: '📎 Preventivo' }).click()
    await page.locator('#pdf-input').setInputFiles(pdfFinto('Preventivo fornitore 2'))
    await page.getByRole('button', { name: /Estrai con AI/ }).click()
    await page.getByRole('button', { name: /Conferma importazione/ }).click()
    const rdo = await attendi(() => q1(`SELECT * FROM public.rdo WHERE id = $1 AND importo_offerta > 0`, [ctx.rdo2.id]))
    verifica(ti, rdo, 'importo del preventivo salvato nel DB',
      `"Conferma importazione" senza effetto nel DB: la scrittura (stato 'risposta_ricevuta', non ammesso da rdo_stato_check) non controlla l'errore — a schermo: ${await messaggioAschermo(page)}`)
    verificaUguale(ti, Number(rdo.importo_offerta), totF2, 'importo offerta = totale estratto dall\'AI')
    verifica(ti, Array.isArray(rdo.offerta_voci) && rdo.offerta_voci.length === 2, 'voci dell\'offerta salvate')
    ctx.rdo2 = rdo
  })

  test('1.6 Comparativa e aggiudicazione all\'offerta più bassa', async ({ page }, ti) => {
    verifica(ti, ctx.rdo1 && ctx.rdo2, 'le due RDO del gruppo', 'passo 1.3 non riuscito')
    const gruppo = await q(`SELECT * FROM public.rdo WHERE rdo_gruppo_id = $1`, [ctx.rdo1.rdo_gruppo_id])
    const conOfferta = gruppo.filter(r => Number(r.importo_offerta) > 0).sort((a, b) => a.importo_offerta - b.importo_offerta)
    if (conOfferta.length < 2) annota(ti, 'nota', `Offerte registrate nel DB: ${conOfferta.length} su 2 (passi 1.4/1.5) — aggiudico la più bassa presente`)
    verifica(ti, conOfferta.length > 0, 'almeno un\'offerta registrata', 'nessuna offerta salvata nei passi 1.4 e 1.5')
    const vinc = conOfferta[0]
    await apri(page, `${BASE}/rdo`, page.locator('td', { hasText: /^TOTALE$/ }))
    const tabella = page.locator('table', { has: page.locator('td', { hasText: /^TOTALE$/ }) }).filter({ hasText: vinc.fornitore.slice(0, 18) }).first()
    const intest = (await tabella.locator('tr').first().locator('th, td').allInnerTexts()).map(t => t.trim())
    const parola = (vinc.fornitore.split(' ')[1] || vinc.fornitore).toLowerCase()   // l'intestazione è in maiuscolo via CSS
    const col = intest.findIndex(t => t.toLowerCase().includes(parola))
    verifica(ti, col > 0, 'colonna del fornitore nella comparativa', `intestazioni trovate: ${intest.join(' | ')}`)
    const best = tabella.locator('td', { hasText: '▼ BEST' })
    verificaUguale(ti, await best.count(), 1, 'un solo "BEST" nella comparativa')
    await tabella.locator('tr', { hasText: 'Azione' }).locator('td').nth(col).getByRole('button', { name: /Aggiudica/ }).click()
    // decisione passo 6: vincente → 'accettata', altre offerte del gruppo → 'rifiutata' (rdo_stato_check)
    const ok = await attendi(() => q1(`SELECT 1 FROM public.rdo WHERE id = $1 AND stato = 'accettata'`, [vinc.id]))
    const vincolo = (await q1(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'rdo_stato_check'`))?.d || ''
    verifica(ti, ok, 'RDO vincitrice aggiudicata nel DB (stato accettata)', `aggiudicazione non salvata — a schermo: ${await messaggioAschermo(page)} · valori ammessi da rdo_stato_check: ${(vincolo.match(/'[a-z_]+'/g) || []).join(', ')}`)
    ctx.vincitrice = await q1(`SELECT * FROM public.rdo WHERE id = $1`, [vinc.id])
    const altre = await q(`SELECT stato FROM public.rdo WHERE rdo_gruppo_id = $1 AND id <> $2`, [vinc.rdo_gruppo_id, vinc.id])
    verifica(ti, altre.every(a => a.stato === 'rifiutata'), 'le altre RDO del gruppo segnate come non aggiudicate (stato rifiutata)', `stati: ${altre.map(a => a.stato).join(', ')}`)
    await page.getByRole('button', { name: /Genera ODA direttamente/ }).waitFor()
  })

  test('1.7 ODA dall\'aggiudicazione (importo, fornitore)', async ({ page }, ti) => {
    const t0 = new Date().toISOString()
    const rdo = await fallback(ti, 'vincitrice', `SELECT * FROM public.rdo WHERE commessa_id = $1 AND codice = 'ALFA-RDO-001'`, [A.commessa], 'la RDO')
    const params = new URLSearchParams({ rdo_id: rdo.id, importo: String(rdo.importo_offerta || 0), fornitore: rdo.fornitore || '', richiede_sam: '0', wbs_ref: e2e.wbs.codice })
    await apri(page, `${BASE}/oda?${params}`, campo(page, 'Oggetto *'))    // stesso URL costruito da "Genera ODA direttamente"
    verificaUguale(ti, Number(await campo(page, 'Importo netto €').inputValue()), Number(rdo.importo_offerta), 'importo precompilato dall\'offerta')
    const fornSel = await campo(page, 'Fornitore *').inputValue()
    if (fornSel !== rdo.fornitore_id) { annota(ti, 'bug', `ODA: fornitore non preselezionato dall'aggiudicazione (nome nell'URL "${rdo.fornitore}"); selezionato a mano`); await campo(page, 'Fornitore *').selectOption(rdo.fornitore_id) }
    ctx.wbsOdaModulo = await campo(page, 'WBS / Area di riferimento').inputValue()
    await campo(page, 'Oggetto *').fill('E2E fornitura da aggiudicazione')
    await page.getByRole('button', { name: 'Crea ODA' }).click()
    const oda = await attendi(() => q1(`SELECT * FROM public.oda WHERE rdo_id = $1 AND created_at >= $2 ORDER BY created_at DESC LIMIT 1`, [rdo.id, t0]), { timeout: 12000 })
    const err = await page.locator('text=/violates|errore|error|⛔|Compila/i').allInnerTexts().catch(() => [])
    verifica(ti, oda, 'ODA creato nel DB', `ODA non salvato — messaggio nel modulo: ${err.join(' | ').slice(0, 300) || await messaggioAschermo(page)}`)
    ctx.oda = oda
    verificaUguale(ti, Number(oda.importo_netto), Number(rdo.importo_offerta), 'importo ODA = offerta aggiudicata')
    verificaUguale(ti, oda.fornitore_id, rdo.fornitore_id, 'fornitore ODA = aggiudicatario')
    verificaUguale(ti, oda.azienda_id, A.id, 'azienda ODA')
    verifica(ti, ['bozza', 'firmato', 'in_esecuzione', 'completato', 'contestato'].includes(oda.stato), `stato ODA ammesso da oda_stato_check (${oda.stato})`)
    // la WBS lungo la catena è verificata a parte nel test 1.11
  })

  test('1.8 DDT da documento (AI simulata) e verifica', async ({ page }, ti) => {
    const oda = await fallback(ti, 'oda', `SELECT * FROM public.oda WHERE commessa_id = $1 AND codice = 'ALFA-ODA-001'`, [A.commessa], 'l\'ODA')
    await mockAI(page, { 'ai-ddt': { ok: true, dati: { numero_ddt: 'E2E-DDT-001', data_ddt: oggi(), fornitore: nomeF(F1), note: 'estratto da AI simulata',
      voci: [{ descrizione: 'Materiale di prova E2E', um: 'm3', quantita: 12, prezzo_unitario: 100 }] } } })
    await apri(page, `${BASE}/ddt`, 'input[type=file]')
    await page.locator('input[type=file]').first().setInputFiles(pdfFinto('DDT fornitore'))
    await campo(page, 'Numero DDT *').waitFor()
    verificaUguale(ti, await campo(page, 'Numero DDT *').inputValue(), 'E2E-DDT-001', 'numero DDT dalla lettura AI')
    await campo(page, 'ODA collegata').selectOption(oda.id)
    await page.getByRole('button', { name: 'Salva DDT' }).click()
    const ddt = await attendi(() => q1(`SELECT * FROM public.ddt WHERE commessa_id = $1 AND numero_ddt = 'E2E-DDT-001'`, [A.commessa]))
    verifica(ti, ddt, 'DDT salvato nel DB', `DDT non salvato — a schermo: ${await messaggioAschermo(page)}`)
    verificaUguale(ti, ddt.oda_id, oda.id, 'DDT collegato all\'ODA')
    verificaUguale(ti, ddt.azienda_id, A.id, 'azienda DDT')
    verifica(ti, Array.isArray(ddt.voci) && ddt.voci.length === 1, 'voci del DDT salvate')
    await page.locator(`tr:has-text("E2E-DDT-001") select`).selectOption('verificato')
    const ver = await attendi(() => q1(`SELECT 1 FROM public.ddt WHERE id = $1 AND stato = 'verificato'`, [ddt.id]))
    verifica(ti, ver, 'DDT verificato nel DB', `stato non aggiornato — a schermo: ${await messaggioAschermo(page)}`)
    ctx.ddt = ddt
  })

  test('1.9 Fattura passiva da documento (AI simulata), collegata a ODA e DDT', async ({ page }, ti) => {
    const oda = await fallback(ti, 'oda', `SELECT * FROM public.oda WHERE commessa_id = $1 AND codice = 'ALFA-ODA-001'`, [A.commessa], 'l\'ODA')
    const ddt = await fallback(ti, 'ddt', `SELECT * FROM public.ddt WHERE commessa_id = $1 AND numero_ddt = 'ALFA-DDT-001'`, [A.commessa], 'il DDT')
    const imp = Number(oda.importo_netto)
    await mockAI(page, { 'ai-fattura': { ok: true, dati: { numero_fattura: 'E2E-FT-001', data_fattura: oggi(), data_scadenza: tra(60), fornitore: nomeF(F1),
      imponibile: imp, iva_pct: 22, importo_iva: r2(imp * 0.22), totale: r2(imp * 1.22), note: 'estratta da AI simulata' } } })
    await apri(page, `${BASE}/fatture`, 'input[type=file]')
    await page.locator('input[type=file]').first().setInputFiles(pdfFinto('Fattura fornitore'))
    await campo(page, 'Numero fattura *').waitFor()
    await campo(page, 'ODA collegata').selectOption(oda.id)
    await campo(page, 'DDT collegato').selectOption(ddt.id).catch(() => annota(ti, 'bug', 'Fattura passiva: il DDT del fornitore non è selezionabile nel modulo'))
    await page.getByRole('button', { name: 'Salva Fattura' }).click()
    const f = await attendi(() => q1(`SELECT * FROM public.fatture_passive WHERE commessa_id = $1 AND numero_fattura = 'E2E-FT-001'`, [A.commessa]))
    verifica(ti, f, 'fattura passiva salvata nel DB', `fattura non salvata — a schermo: ${await messaggioAschermo(page)}`)
    verificaUguale(ti, Number(f.imponibile), imp, 'imponibile = importo ODA')
    verificaUguale(ti, Number(f.totale), r2(imp * 1.22), 'totale = imponibile + IVA 22%')
    verificaUguale(ti, f.oda_id, oda.id, 'fattura collegata all\'ODA')
    verificaUguale(ti, f.ddt_id, ddt.id, 'fattura collegata al DDT')
    verificaUguale(ti, f.azienda_id, A.id, 'azienda fattura')
    ctx.fattura = f
  })

  test('1.10 Conto economico: ODA impegnati = somma ODA nel DB', async ({ page }, ti) => {
    await apri(page, `${BASE}/conto-economico`, page.locator('span', { hasText: /^Totale ODA impegnati$/ }))
    const riga = page.locator('div', { has: page.locator('span', { hasText: /^Totale ODA impegnati$/ }) }).last()
    const mostrato = numIt((await riga.locator('span').nth(1).innerText()))
    const { s } = await q1(`SELECT coalesce(sum(importo_netto), 0)::float8 s FROM public.oda WHERE commessa_id = $1 AND coalesce(stato, '') <> 'ANNULLATO'`, [A.commessa])
    verificaUguale(ti, mostrato, r2(s), 'CE "Totale ODA impegnati" = Σ importo_netto ODA della commessa')
    if (ctx.oda) verifica(ti, s >= Number(ctx.oda.importo_netto), 'l\'ODA del test è compreso nel conto economico')
  })

  test('1.11 WBS propagata lungo la catena RDA → RDO → ODA', async ({}, ti) => {
    verifica(ti, ctx.rda && ctx.rdo1, 'RDA e RDO del test disponibili', 'passi 1.1–1.3 non riusciti')
    const rda = await q1(`SELECT wbs_id, wbs_ref FROM public.rda WHERE id = $1`, [ctx.rda.id])
    const rdo = await q1(`SELECT wbs_ref FROM public.rdo WHERE id = $1`, [ctx.rdo1.id])
    const oda = ctx.oda ? await q1(`SELECT wbs_ref FROM public.oda WHERE id = $1`, [ctx.oda.id]) : null
    const wbs = rda.wbs_id || rda.wbs_ref
    verificaUguale(ti, wbs, e2e.wbs.codice, 'WBS sulla RDA')
    const errori = []
    if (rdo.wbs_ref !== wbs) errori.push(`RDO: wbs_ref = ${JSON.stringify(rdo.wbs_ref)} (la RDO copia solo rda.wbs_ref; la RDA generata dal computo ha la WBS in rda.wbs_id)`)
    if (!oda) errori.push('ODA del test non creato (passo 1.7)')
    else if ((oda.wbs_ref || ctx.wbsOdaModulo || null) !== wbs) errori.push(`ODA: wbs_ref = ${JSON.stringify(oda.wbs_ref)} (la pagina ODA non legge wbs_ref dall'URL: legge solo rdo_id, importo, fornitore, dam_id, richiede_sam)`)
    verifica(ti, !errori.length, `WBS "${wbs}" propagata a RDO e ODA`, errori.join(' · '))
  })

  test('1.12 Stati ODA: firmato → in esecuzione → completato → annullato (escluso da CE e DDT)', async ({ page }, ti) => {
    const oda = await fallback(ti, 'oda', `SELECT * FROM public.oda WHERE commessa_id = $1 AND codice = 'ALFA-ODA-001'`, [A.commessa], 'l\'ODA')
    await apri(page, `${BASE}/oda`, page.getByText(oda.codice).first())
    await page.getByText(oda.codice).first().click()                     // apre il dettaglio dell'ODA
    const vincolo = (await q1(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'oda_stato_check'`))?.d || ''
    const passaggi = [['Confermato (firmato)', 'firmato'], ['Parz. evaso', 'in_esecuzione'], ['Evaso', 'completato']]
    for (const [pulsante, atteso] of passaggi) {
      await page.getByRole('button', { name: pulsante, exact: true }).first().click()
      const ok = await attendi(() => q1(`SELECT 1 FROM public.oda WHERE id = $1 AND stato = $2`, [oda.id, atteso]))
      verifica(ti, ok, `pulsante "${pulsante}" → stato ${atteso} nel DB`, `stato non salvato — a schermo: ${await messaggioAschermo(page)} · ammessi da oda_stato_check: ${(vincolo.match(/'[a-z_]+'/g) || []).join(', ')}`)
    }
    await page.getByRole('button', { name: 'Annulla', exact: true }).first().click()   // conferma accettata da seguiDialoghi
    const ann = await attendi(() => q1(`SELECT 1 FROM public.oda WHERE id = $1 AND stato = 'annullato'`, [oda.id]))
    verifica(ti, ann, 'pulsante "Annulla" → stato annullato nel DB', `annullamento non salvato — a schermo: ${await messaggioAschermo(page)} · ammessi da oda_stato_check: ${(vincolo.match(/'[a-z_]+'/g) || []).join(', ')}`)
    // l'ODA annullato non deve più contare né essere proposto
    await apri(page, `${BASE}/conto-economico`, page.locator('span', { hasText: /^Totale ODA impegnati$/ }))
    const riga = page.locator('div', { has: page.locator('span', { hasText: /^Totale ODA impegnati$/ }) }).last()
    const mostrato = numIt(await riga.locator('span').nth(1).innerText())
    const { s } = await q1(`SELECT coalesce(sum(importo_netto), 0)::float8 s FROM public.oda WHERE commessa_id = $1 AND stato <> 'annullato'`, [A.commessa])
    verificaUguale(ti, mostrato, r2(s), 'CE "Totale ODA impegnati" esclude l\'ODA annullato')
    await apri(page, `${BASE}/ddt`, 'input[type=file]')
    await page.getByRole('button', { name: '+ Nuovo DDT' }).click()
    await campo(page, 'ODA collegata').waitFor()
    const opzioniDdt = await campo(page, 'ODA collegata').locator('option').evaluateAll(o => o.map(x => x.value))
    verifica(ti, !opzioniDdt.includes(oda.id), 'l\'ODA annullato non è proposto nei DDT', 'il filtro sugli ODA del modulo DDT non esclude lo stato annullato')
  })

  test('1.13 RDO annullata dal pulsante "✕ Annulla"', async ({ page }, ti) => {
    // RDO di prova in stato "inviata" (copia della RDO del seed, preparata nel DB per questo test)
    const base = await q1(`SELECT * FROM public.rdo WHERE commessa_id = $1 AND codice = 'ALFA-RDO-001'`, [A.commessa])
    const { id } = await q1(`INSERT INTO public.rdo (rda_id, commessa_id, azienda_id, codice, fornitore, fornitore_id, stato, oggetto)
      VALUES ($1, $2, $3, 'E2E-RDO-ANN', $4, $5, 'inviata', 'E2E RDO da annullare') RETURNING id`, [base.rda_id, A.commessa, A.id, base.fornitore, base.fornitore_id])
    await apri(page, `${BASE}/rdo`, 'tr:has-text("E2E-RDO-ANN")')
    await page.locator('tr:has-text("E2E-RDO-ANN")').getByRole('button', { name: /Annulla/ }).click()   // due conferme, accettate
    const ok = await attendi(() => q1(`SELECT 1 FROM public.rdo WHERE id = $1 AND stato = 'annullata'`, [id]))
    const vincolo = (await q1(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'rdo_stato_check'`))?.d || ''
    verifica(ti, ok, 'RDO annullata nel DB (stato annullata)', `annullamento non salvato — a schermo: ${await messaggioAschermo(page)} · ammessi da rdo_stato_check: ${(vincolo.match(/'[a-z_]+'/g) || []).join(', ')}`)
  })
})
