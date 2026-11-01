// ─── 2. SAL attivi (nuovo SAL, quantità, emissione, PDF DL, fattura attiva)
//        e SAL passivi con blocco per DURC scaduto ──────────────────────────────
import { test } from '@playwright/test'
import { A, BASE, e2e, q, q1, attendi, accedi, clientDi, campo, annota, verifica, verificaUguale, messaggioAschermo, seguiDialoghi, apri, contesto, r2 } from './helpers.mjs'

const ctx = contesto('sal')

test.describe('SAL', () => {
  test.beforeEach(async ({ page }) => { await accedi(page); seguiDialoghi(page) })

  test('2.1 SAL attivo: nuovo SAL, quantità di una voce, salvataggio ed emissione', async ({ page }, ti) => {
    const v = e2e.voci[0]
    const qta = r2(v.quantita * 0.1)
    const t0 = new Date().toISOString()
    const { n } = await q1(`SELECT coalesce(max(numero), 0)::int n FROM public.sal WHERE commessa_id = $1`, [A.commessa])
    await apri(page, `${BASE}/sal-attivi`, 'tr.cmp-rvo')
    await page.locator('option', { hasText: `SAL ${n} ·` }).first().waitFor({ state: 'attached', timeout: 60000 })   // elenco SAL caricato
    await page.getByRole('button', { name: '+ Nuovo SAL' }).click()
    const sal = await attendi(() => q1(`SELECT * FROM public.sal WHERE commessa_id = $1 AND created_at >= $2 ORDER BY created_at DESC LIMIT 1`, [A.commessa, t0]))
    verifica(ti, sal, 'nuovo SAL creato nel DB', `SAL non creato — a schermo: ${await messaggioAschermo(page)}`)
    verificaUguale(ti, sal.numero, n + 1, 'numero progressivo del SAL')
    const unico = await q1(`SELECT 1 FROM pg_constraint co JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = ANY(co.conkey) WHERE co.conrelid = 'public.sal'::regclass AND co.contype = 'u' AND a.attname = 'numero'`)
    if (!unico) annota(ti, 'bug', 'SAL attivi: nessun vincolo di unicità su sal(commessa_id, numero) e "+ Nuovo SAL" è attivo prima che l\'elenco sia caricato — cliccando subito si crea un SAL con numero già usato (osservato nel primo giro dei test)')
    verificaUguale(ti, sal.stato, 'bozza', 'stato iniziale')
    await page.locator(`tr:has-text("${v.codice}") input[step="0.001"][min="0"]`).first().fill(String(qta))
    await page.getByRole('button', { name: '💾 Salva SAL' }).click()
    const em = await attendi(() => q1(`SELECT * FROM public.sal WHERE id = $1 AND stato = 'emesso'`, [sal.id]))
    verifica(ti, em, 'SAL emesso nel DB', `SAL non salvato — a schermo: ${await messaggioAschermo(page)}`)
    const voci = await q(`SELECT voce_computo_id, quantita_periodo::float8 q FROM public.sal_voci WHERE sal_id = $1`, [sal.id])
    verificaUguale(ti, voci.length, 1, 'righe sal_voci')
    verificaUguale(ti, voci[0]?.q, qta, 'quantità del periodo')
    const atteso = r2(v.pu * qta)       // ribasso 0 e sicurezza: con ribasso 0 la formula a 3 livelli dà PU × q
    verificaUguale(ti, r2(em.importo_certificato), atteso, 'importo certificato = PU × quantità')
    verificaUguale(ti, r2(em.ritenuta_garanzia), r2(atteso * 0.05), 'ritenuta 5%')
    verificaUguale(ti, r2(em.importo_netto), r2(atteso * 0.95), 'netto = importo − ritenuta')
    ctx.sal = em
  })

  test('2.2 SAL attivo: caricamento PDF della DL', async ({ page }, ti) => {
    await apri(page, `${BASE}/sal-attivi`, 'tr.cmp-rvo')
    const filePdf = page.locator('input[type=file][accept*="pdf"]')
    const pulsante = page.getByText(/PDF DL|Carica PDF|PDF della DL|Carica certificato/i)
    verifica(ti, (await filePdf.count()) + (await pulsante.count()) > 0, 'controllo per caricare il PDF della DL presente nella pagina',
      'funzione non presente nella pagina SAL attivi attuale: nessun campo file PDF e nessun uso di sal.pdf_dl_url nel codice (CLAUDE.md la dà per completata con SalGrid.tsx, che non esiste più)')
  })

  test('2.3 Fattura attiva dal SAL (Fatturazione)', async ({ page }, ti) => {
    const sal = ctx.sal || await q1(`SELECT * FROM public.sal WHERE commessa_id = $1 ORDER BY numero DESC LIMIT 1`, [A.commessa])
    if (!ctx.sal) annota(ti, 'nota', 'Passo 2.1 non riuscito: uso l\'ultimo SAL del seed')
    const netto = r2(sal.importo_netto || 1000)
    await apri(page, `${BASE}/fatturazione`, page.getByRole('button', { name: /Nuova fattura attiva/ }))
    await page.getByRole('button', { name: /Nuova fattura attiva/ }).click()
    await campo(page, 'Numero fattura *').fill('E2E-FA-001')
    await campo(page, 'Imponibile netto *').fill(String(netto))
    const selSal = page.locator('select').filter({ has: page.locator(`option[value="${sal.id}"]`) })
    const haSal = (await selSal.count()) > 0
    if (haSal) await selSal.first().selectOption(sal.id)
    await page.getByRole('button', { name: /Emetti fattura/ }).click()
    const f = await attendi(() => q1(`SELECT * FROM public.fatture WHERE commessa_id = $1 AND numero = 'E2E-FA-001'`, [A.commessa]))
    verifica(ti, f, 'fattura attiva salvata nel DB', `fattura non salvata — a schermo: ${await messaggioAschermo(page)} · la pagina scrive tipo 'ATTIVA', il vincolo fatture_tipo_check ammette solo 'attiva'/'passiva'`)
    verificaUguale(ti, f.tipo, 'attiva', 'tipo fattura (valore del vincolo fatture_tipo_check)')
    verificaUguale(ti, Number(f.importo_imponibile), netto, 'imponibile = netto del SAL')
    verificaUguale(ti, Number(f.importo_iva), r2(netto * 0.22), 'IVA 22%')
    verificaUguale(ti, f.azienda_id, A.id, 'azienda fattura')
    verifica(ti, ['attiva', 'passiva'].includes(f.tipo), `tipo ammesso da fatture_tipo_check (${f.tipo})`)
    ctx.fatturaAttiva = { id: f.id, sal: sal.id, haCampoSal: haSal }   // collegamento al SAL verificato a parte nel test 2.5
  })

  test('2.4 SAL passivo con fornitore dal DURC scaduto: registrazione e blocco autorizzazione', async ({ page }, ti) => {
    const F = e2e.fornitori.scaduto
    await apri(page, `${BASE}/sal-passivi`, page.getByRole('button', { name: '+ SAL' }))
    const card = page.locator('div', { hasText: F.ragione_sociale || F.nome }).filter({ has: page.getByRole('button', { name: '+ SAL' }) }).last()
    await card.getByRole('button', { name: '+ SAL' }).click()
    await page.locator('input[type=number][max="100"][step="0.1"]').fill('20')
    await page.getByRole('button', { name: /Registra SAL/ }).click()
    const sp = await attendi(() => q1(`SELECT * FROM public.sal_passivi WHERE contratto_id = $1 ORDER BY created_at DESC LIMIT 1`, [e2e.contrattoSub]))
    verifica(ti, sp, 'SAL passivo registrato nel DB', `SAL passivo non salvato — a schermo: ${await messaggioAschermo(page)}`)
    verificaUguale(ti, sp.durc_ok, false, 'SAL marcato con DURC non valido')
    verificaUguale(ti, Number(sp.importo_lordo), 10000, 'lordo = 20% di € 50.000')
    verificaUguale(ti, Number(sp.ritenuta_garanzia), 500, 'ritenuta 5%')
    verificaUguale(ti, Number(sp.importo_netto), 9500, 'netto')
    verificaUguale(ti, sp.stato, 'ricevuto', 'stato iniziale')
    await page.getByRole('button', { name: '🔍 Verifica' }).first().click()
    verifica(ti, await attendi(() => q1(`SELECT 1 FROM public.sal_passivi WHERE id = $1 AND stato = 'in_verifica'`, [sp.id])), 'SAL passivo in verifica nel DB')
    await page.getByRole('button', { name: '🔒 Autorizza' }).first().click()
    await page.waitForTimeout(2500)
    const dopo = await q1(`SELECT stato FROM public.sal_passivi WHERE id = $1`, [sp.id])
    verificaUguale(ti, dopo.stato, 'in_verifica', 'autorizzazione BLOCCATA con DURC scaduto', 'il pagamento è stato autorizzato nonostante il DURC scaduto')
    // il blocco vale anche fuori dall'interfaccia? (API con il token di A, stesse RLS dell'app)
    const c = await clientDi('A_admin')
    await c.from('sal_passivi').update({ stato: 'autorizzato' }).eq('id', sp.id)
    const bypass = await q1(`SELECT stato FROM public.sal_passivi WHERE id = $1`, [sp.id])
    if (bypass.stato === 'autorizzato') {
      annota(ti, 'bug', 'SAL passivi: il blocco per DURC scaduto esiste solo nell\'interfaccia — con una chiamata API diretta lo stato passa ad "autorizzato" (nessun controllo nel DB)')
      await q(`UPDATE public.sal_passivi SET stato = 'in_verifica' WHERE id = $1`, [sp.id])
    }
  })

  test('2.5 Fattura attiva collegata al SAL (fatture.sal_id)', async ({}, ti) => {
    verifica(ti, ctx.fatturaAttiva, 'fattura attiva del test disponibile', 'passo 2.3 non riuscito')
    const f = await q1(`SELECT sal_id FROM public.fatture WHERE id = $1`, [ctx.fatturaAttiva.id])
    verifica(ti, f.sal_id === ctx.fatturaAttiva.sal, 'fattura collegata al SAL',
      ctx.fatturaAttiva.haCampoSal ? 'il SAL scelto non viene salvato nella fattura' : 'il modulo "Nuova fattura attiva" non ha un campo SAL (formA.sal_id esiste ma non è mostrato né salvato)')
  })
})
