# SQ360 — Risultati test end-to-end

> App locale collegata al progetto di **prova** `sq360-test` (dati inventati), utente admin di *Alfa Costruzioni*. Ogni esito è verificato nel database. AI simulata con risposte fisse (intercettazione Playwright). Regole di isolamento (migrazione 20261101) sulla prova: **applicate**.

Data: 2026-11-01T10:59:04.163Z · Comando: `npm run test:piattaforma`

## Riepilogo

- Test: **23** · ✅ superati **20** · ❌ falliti **2** · ⏭ non eseguibili nella prova **1**
- Bug annotati durante test superati: **3**

| Esito | Test | Durata | Causa probabile / dettaglio |
|---|---|---|---|
| ✅ | 1.1 RDA da computo (2 voci con WBS 1.1) | 41.9 s |  |
| ✅ | 1.2 RDA approvata | 8.7 s |  |
| ✅ | 1.3 RDO a 2 fornitori (gara multi-fornitore) | 8.9 s |  |
| ✅ | 1.4 Offerta fornitore 1 dalla pagina pubblica /offerta (senza login) | 12.5 s |  |
| ✅ | 1.5 Offerta fornitore 2 da preventivo PDF (AI simulata) | 12.7 s |  |
| ✅ | 1.6 Comparativa e aggiudicazione all'offerta più bassa | 6.7 s |  |
| ✅ | 1.7 ODA dall'aggiudicazione (importo, fornitore) | 10.4 s |  |
| ✅ | 1.8 DDT da documento (AI simulata) e verifica | 10.3 s |  |
| ✅ | 1.9 Fattura passiva da documento (AI simulata), collegata a ODA e DDT | 9.8 s |  |
| ✅ | 1.10 Conto economico: ODA impegnati = somma ODA nel DB | 9.5 s |  |
| ✅ | 1.11 WBS propagata lungo la catena RDA → RDO → ODA → conto economico | 5.2 s |  |
| ✅ | 1.12 Stati ODA: firmato → in esecuzione → completato → annullato (escluso da CE e DDT) | 20.9 s |  |
| ✅ | 1.13 RDO annullata dal pulsante "✕ Annulla" | 6.7 s |  |
| ✅ | 2.1 SAL attivo: nuovo SAL, quantità di una voce, salvataggio ed emissione | 54.4 s |  |
| ❌ | 2.2 SAL attivo: caricamento PDF della DL | 30.7 s | funzione non presente nella pagina SAL attivi attuale: nessun campo file PDF e nessun uso di sal.pdf_dl_url nel codice (CLAUDE.md la dà per completata con SalGrid.tsx, che non esiste più) — Error: controllo per caricare il PDF della DL presente nella pagina · expect(received).toBeTruthy() · Received: false |
| ✅ | 2.3 Fattura attiva dal SAL (Fatturazione) | 10.1 s |  |
| ✅ | 2.4 SAL passivo con fornitore dal DURC scaduto: registrazione e blocco autorizzazione | 11.9 s |  |
| ❌ | 2.5 Fattura attiva collegata al SAL (fatture.sal_id) | 0.4 s | il modulo "Nuova fattura attiva" non ha un campo SAL (formA.sal_id esiste ma non è mostrato né salvato) — Error: fattura collegata al SAL · expect(received).toBeTruthy() · Received: false |
| ✅ | 3.1 Persone: nuovo lavoratore con QR badge | 7.8 s |  |
| ✅ | 3.2 Presenze da QR: ENTRATA e USCITA dalla pagina pubblica /scan (senza login) | 13.0 s |  |
| ✅ | 3.3 Giornale lavori: nuova registrazione | 7.8 s |  |
| ⏭ | 3.4 Invito utente (esito verificato solo nel database) | 18.2 s | Invio reale non eseguibile nella prova senza mandare email: Supabase non invia l'invito a un indirizzo fittizio (dominio rifiutato o limite di invii del progetto gratuito; risposta HTTP 400: email rate limit exceeded). Verificato: richiesta partita con il token dell'admin e nessun utente orfano dopo il rifiuto |
| ✅ | 3.5 Archiviazione commessa (dati conservati) e ripristino | 17.7 s |  |

## Bug e problemi trovati (non corretti)

1. **2.2 SAL attivo: caricamento PDF della DL** (test fallito): funzione non presente nella pagina SAL attivi attuale: nessun campo file PDF e nessun uso di sal.pdf_dl_url nel codice (CLAUDE.md la dà per completata con SalGrid.tsx, che non esiste più)
2. **2.5 Fattura attiva collegata al SAL (fatture.sal_id)** (test fallito): il modulo "Nuova fattura attiva" non ha un campo SAL (formA.sal_id esiste ma non è mostrato né salvato)
3. **1.7 ODA dall'aggiudicazione (importo, fornitore)** (bug annotato): ODA: fornitore non preselezionato dall'aggiudicazione (nome nell'URL "Calcestruzzi Alfaverde S.r.l. (PROVA)"); selezionato a mano
4. **2.1 SAL attivo: nuovo SAL, quantità di una voce, salvataggio ed emissione** (bug annotato): SAL attivi: nessun vincolo di unicità su sal(commessa_id, numero) e "+ Nuovo SAL" è attivo prima che l'elenco sia caricato — cliccando subito si crea un SAL con numero già usato (osservato nel primo giro dei test)
5. **2.4 SAL passivo con fornitore dal DURC scaduto: registrazione e blocco autorizzazione** (bug annotato): SAL passivi: il blocco per DURC scaduto esiste solo nell'interfaccia — con una chiamata API diretta lo stato passa ad "autorizzato" (nessun controllo nel DB)

## Note

- Artefatti dei test falliti (screenshot, trace): `tests/report/e2e-artefatti/` (escluso da git); `npx playwright show-trace <file>` per rivederli.
- I passi che dipendono da uno precedente fallito ripiegano sui dati del seed (indicato nella colonna dettaglio), così il resto della catena viene provato comunque.
