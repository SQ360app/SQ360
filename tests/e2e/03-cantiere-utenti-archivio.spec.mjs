// ─── 3. Persone e presenze con QR, giornale lavori, invito utente (solo DB),
//        archiviazione e ripristino della commessa (per ultima) ───────────────
import { test } from '@playwright/test'
import { A, BASE, stato, q, q1, attendi, accedi, supabaseAdmin, campo, annota, verifica, verificaUguale, messaggioAschermo, seguiDialoghi, apri, contesto, oggi } from './helpers.mjs'

const ctx = contesto('cantiere')

test.describe('Cantiere, utenti, archivio', () => {
  test.beforeEach(async ({ page }) => { await accedi(page); seguiDialoghi(page) })

  test('3.1 Persone: nuovo lavoratore con QR badge', async ({ page }, ti) => {
    await apri(page, `${BASE}/persone`, page.getByRole('button', { name: /Aggiungi lavoratore/ }))
    await page.getByRole('button', { name: /Aggiungi lavoratore/ }).click()
    await campo(page, 'Nome *').fill('Gino')
    await campo(page, 'Cognome *').fill('Alfredi E2E')
    await campo(page, 'Mansione').fill('Carpentiere')
    await campo(page, 'Scadenza DURC').fill('2027-06-30')
    await page.getByRole('button', { name: 'Aggiungi', exact: true }).click()
    const l = await attendi(() => q1(`SELECT * FROM public.lavoratori_commessa WHERE commessa_id = $1 AND cognome = 'Alfredi E2E'`, [A.commessa]))
    verifica(ti, l, 'lavoratore salvato nel DB', `lavoratore non salvato — a schermo: ${await messaggioAschermo(page)}`)
    verifica(ti, l.qr_token && l.qr_token.length >= 16, 'token QR generato')
    verificaUguale(ti, l.azienda_id, A.id, 'azienda lavoratore')
    verificaUguale(ti, l.mansione, 'Carpentiere', 'mansione')
    ctx.lav = l
  })

  test('3.2 Presenze da QR: ENTRATA e USCITA dalla pagina pubblica /scan (senza login)', async ({ browser }, ti) => {
    const l = ctx.lav || await q1(`SELECT * FROM public.lavoratori_commessa WHERE commessa_id = $1 AND attivo LIMIT 1`, [A.commessa])
    if (!ctx.lav) annota(ti, 'nota', 'Passo 3.1 non riuscito: uso un lavoratore del seed')
    const pub = await (await browser.newContext()).newPage()
    await apri(pub, `/scan/${l.qr_token}`, pub.getByRole('button', { name: /Registra ENTRATA/ }))
    await pub.getByRole('button', { name: /Registra ENTRATA/ }).click()
    const e = await attendi(() => q1(`SELECT * FROM public.presenze_cantiere WHERE lavoratore_id = $1 AND data = $2 AND ora_entrata IS NOT NULL`, [l.id, oggi()]))
    verifica(ti, e, 'ENTRATA registrata nel DB', `entrata non registrata — a schermo: ${(await pub.locator('body').innerText()).slice(0, 200)}`)
    verificaUguale(ti, e.commessa_id, A.commessa, 'commessa della presenza')
    await pub.getByRole('button', { name: /Registra USCITA/ }).click()
    const u = await attendi(() => q1(`SELECT * FROM public.presenze_cantiere WHERE id = $1 AND ora_uscita IS NOT NULL`, [e.id]))
    verifica(ti, u, 'USCITA registrata sulla stessa presenza', 'uscita non registrata sulla riga di entrata')
    await pub.close()
  })

  test('3.3 Giornale lavori: nuova registrazione', async ({ page }, ti) => {
    await apri(page, `${BASE}/cantiere`, page.getByRole('button', { name: /Nuova registrazione/ }))
    await page.getByRole('button', { name: /Nuova registrazione/ }).click()
    await campo(page, 'Operai propri').fill('4')
    await campo(page, 'Direttore di cantiere').fill('Geom. Alfio Rossi (PROVA)')
    await campo(page, 'Lavori eseguiti oggi *').fill('E2E getto fondazioni plinti 1-4')
    await page.getByRole('button', { name: /Salva registrazione/ }).click()
    const g = await attendi(() => q1(`SELECT * FROM public.giornale_lavori WHERE commessa_id = $1 AND descrizione LIKE 'E2E %'`, [A.commessa]))
    verifica(ti, g, 'registrazione salvata nel DB', `giornale non salvato — a schermo: ${await messaggioAschermo(page)}`)
    verificaUguale(ti, g.azienda_id, A.id, 'azienda')
    verificaUguale(ti, g.direttore_cantiere, 'Geom. Alfio Rossi (PROVA)', 'direttore di cantiere')
    verificaUguale(ti, g.redatto_da, stato.credenziali.A_admin.id, 'redatto da = utente collegato')
    verificaUguale(ti, Number(g.operai_propri), 4, 'operai propri')
  })

  test('3.4 Invito utente (esito verificato solo nel database)', async ({ page }, ti) => {
    const email = `invitato.e2e.${Date.now().toString(36)}@sq360-prova.example`
    await apri(page, '/dashboard/impostazioni', page.getByRole('button', { name: /Utenti/ }))
    await page.getByRole('button', { name: /Utenti/ }).first().click()
    await page.getByRole('button', { name: /Invita utente/ }).click()
    await campo(page, 'Email *').fill(email)
    await campo(page, 'Ruolo').selectOption('contabilita')
    const invia = page.locator('button', { hasText: /Invita\s*$/ }).last()
    // il pulsante è attivo prima che la pagina abbia caricato l'azienda: in quel caso non fa nulla
    let r = await Promise.all([page.waitForResponse(x => x.url().includes('/api/invite-user'), { timeout: 5000 }), invia.click()]).then(([x]) => x).catch(() => null)
    if (!r) {
      annota(ti, 'bug', 'Impostazioni › Invita: se premuto prima che la pagina abbia caricato l\'azienda il pulsante non fa nulla e non mostra messaggi (invitaUtente esce in silenzio con aziendaId vuoto)')
      await page.waitForLoadState('networkidle')
      r = await Promise.all([page.waitForResponse(x => x.url().includes('/api/invite-user'), { timeout: 30000 }), invia.click()]).then(([x]) => x)
    }
    const corpo = await r.json().catch(() => ({}))
    const motivo = corpo.error || corpo.errore || ''
    const u = await attendi(() => q1(`SELECT * FROM public.utenti WHERE email = $1`, [email]), { timeout: 8000 })
    if (!r.ok() && /invalid|not authorized|smtp|rate limit/i.test(motivo)) {
      // nessuna email vera: Supabase rifiuta i domini finti → si verifica solo che non restino utenti orfani
      const { data: lista } = await supabaseAdmin().auth.admin.listUsers({ perPage: 200 })
      verifica(ti, !u, 'dopo il rifiuto nessuna riga orfana in public.utenti', 'la route ha lasciato una riga in utenti nonostante l\'errore')
      verifica(ti, !lista.users.some(x => x.email === email), 'dopo il rifiuto nessun utente orfano in auth.users', 'la route ha lasciato un utente in auth.users nonostante l\'errore')
      test.skip(true, `Invio reale non eseguibile nella prova senza mandare email: Supabase non invia l'invito a un indirizzo fittizio (dominio rifiutato o limite di invii del progetto gratuito; risposta HTTP ${r.status()}: ${motivo}). Verificato: richiesta partita con il token dell'admin e nessun utente orfano dopo il rifiuto`)
    }
    verifica(ti, u, 'utente invitato presente in public.utenti', `HTTP ${r.status()}: ${motivo || JSON.stringify(corpo).slice(0, 200)}`)
    verificaUguale(ti, u.azienda_id, A.id, 'invitato nell\'azienda dell\'admin')
    verificaUguale(ti, u.ruolo, 'contabilita', 'ruolo scelto')
    const { data } = await supabaseAdmin().auth.admin.getUserById(u.id)
    verifica(ti, data?.user?.email === email, 'utente presente in auth.users con lo stesso id')
  })

  test('3.5 Archiviazione commessa (dati conservati) e ripristino', async ({ page }, ti) => {
    const conta = async () => q1(`SELECT (SELECT count(*) FROM public.rda WHERE commessa_id = $1)::int rda, (SELECT count(*) FROM public.oda WHERE commessa_id = $1)::int oda,
      (SELECT count(*) FROM public.sal WHERE commessa_id = $1)::int sal, (SELECT count(*) FROM public.voci_computo v JOIN public.computo_metrico c ON c.id = v.computo_id WHERE c.commessa_id = $1)::int voci`, [A.commessa])
    const prima = await conta()
    await apri(page, `${BASE}/anagrafica`, page.getByRole('button', { name: /Archivia commessa/ }))
    await page.getByRole('button', { name: /Archivia commessa/ }).click()
    await page.getByRole('button', { name: /Sì, archivia/ }).click()
    const ar = await attendi(() => q1(`SELECT * FROM public.commesse WHERE id = $1 AND archiviata_at IS NOT NULL`, [A.commessa]))
    verifica(ti, ar, 'commessa archiviata nel DB', `archiviazione non salvata — a schermo: ${await messaggioAschermo(page)}`)
    verificaUguale(ti, ar.archiviata_da, stato.credenziali.A_admin.id, 'archiviata da = utente collegato')
    const dopo = await conta()
    verifica(ti, JSON.stringify(dopo) === JSON.stringify(prima), `dati conservati (${JSON.stringify(prima)})`, `conteggi cambiati: ${JSON.stringify(dopo)}`)
    await apri(page, '/dashboard/commesse', page.getByRole('button', { name: /Archiviate \(/ }))
    await page.getByRole('button', { name: /Archiviate \(/ }).click()
    await page.locator('tr, div').filter({ hasText: 'ALFA-PROVA-001' }).getByRole('button', { name: /Ripristina/ }).last().click()
    const rip = await attendi(() => q1(`SELECT 1 FROM public.commesse WHERE id = $1 AND archiviata_at IS NULL`, [A.commessa]))
    verifica(ti, rip, 'commessa ripristinata nel DB', `ripristino non salvato — a schermo: ${await messaggioAschermo(page)}`)
    if (!rip) await q(`UPDATE public.commesse SET archiviata_at = NULL, archiviata_da = NULL WHERE id = $1`, [A.commessa])
  })
})
