# SQ360 — Risultati test end-to-end

> App locale collegata al progetto di **prova** `sq360-test` (dati inventati), utente admin di *Alfa Costruzioni*. Ogni esito è verificato nel database. AI simulata con risposte fisse (intercettazione Playwright). Regole di isolamento (migrazione 20261101) sulla prova: **applicate**.

Data: 2026-11-01T09:12:49.021Z · Comando: `npm run test:piattaforma`

## Riepilogo

- Test: **19** · ✅ superati **11** · ❌ falliti **7** · ⏭ non eseguibili nella prova **1**
- Bug annotati durante test superati: **4**

| Esito | Test | Durata | Causa probabile / dettaglio |
|---|---|---|---|
| ✅ | 1.1 RDA da computo (2 voci con WBS 1.1) | 40.0 s |  |
| ✅ | 1.2 RDA approvata | 8.5 s |  |
| ❌ | 1.3 RDO a 2 fornitori (gara multi-fornitore) | 9.4 s | la RDO copia solo rda.wbs_ref; la RDA generata dal computo ha la WBS in rda.wbs_id → WBS persa (atteso "1.1", trovato null) — Error: WBS propagata dalla RDA alla RDO: atteso "1.1", trovato null · expect(received).toBeTruthy() · Received: false |
| ❌ | 1.4 Offerta fornitore 1 dalla pagina pubblica /offerta (senza login) | 28.9 s | HTTP 500: Errore salvataggio offerta: new row for relation "rdo" violates check constraint "rdo_stato_check" — Error: offerta registrata nel DB · expect(received).toBeTruthy() · Received: undefined |
| ❌ | 1.5 Offerta fornitore 2 da preventivo PDF (AI simulata) | 23.8 s | "Conferma importazione" senza effetto nel DB: la scrittura (stato 'risposta_ricevuta', non ammesso da rdo_stato_check) non controlla l'errore — a schermo: nessun messaggio — Error: importo del preventivo salvato nel DB · expect(received).toBeTruthy() · Received: undefined |
| ❌ | 1.6 Comparativa e aggiudicazione all'offerta più bassa | 1.2 s | nessuna offerta salvata nei passi 1.4 e 1.5 — Error: almeno un'offerta registrata · expect(received).toBeTruthy() · Received: false |
| ❌ | 1.7 ODA dall'aggiudicazione (importo, fornitore, WBS) | 21.3 s | ODA non salvato — messaggio nel modulo: new row for relation "oda" violates check constraint "oda_stato_check" — Error: ODA creato nel DB · expect(received).toBeTruthy() · Received: undefined |
| ✅ | 1.8 DDT da documento (AI simulata) e verifica | 9.0 s | Passo precedente non riuscito: uso l'ODA del seed |
| ✅ | 1.9 Fattura passiva da documento (AI simulata), collegata a ODA e DDT | 8.5 s |  |
| ✅ | 1.10 Conto economico: ODA impegnati = somma ODA nel DB | 9.1 s |  |
| ✅ | 2.1 SAL attivo: nuovo SAL, quantità di una voce, salvataggio ed emissione | 54.1 s |  |
| ❌ | 2.2 SAL attivo: caricamento PDF della DL | 28.8 s | funzione non presente nella pagina SAL attivi attuale: nessun campo file PDF e nessun uso di sal.pdf_dl_url nel codice (CLAUDE.md la dà per completata con SalGrid.tsx, che non esiste più) — Error: controllo per caricare il PDF della DL presente nella pagina · expect(received).toBeTruthy() · Received: false |
| ❌ | 2.3 Fattura attiva dal SAL (Fatturazione) | 24.4 s | fattura non salvata — a schermo: [alert] ⚠ Fattura non salvata: valore non valido: new row for relation "fatture" violates check constraint "fatture_tipo_check" · la pagina scrive tipo 'ATTIVA', il vincolo fatture_tipo_check ammette solo 'attiva'/'passiva' — Error: fattura attiva salvata nel DB · expect(received).toBeTruthy() · Received: undefined |
| ✅ | 2.4 SAL passivo con fornitore dal DURC scaduto: registrazione e blocco autorizzazione | 11.0 s |  |
| ✅ | 3.1 Persone: nuovo lavoratore con QR badge | 6.0 s |  |
| ✅ | 3.2 Presenze da QR: ENTRATA e USCITA dalla pagina pubblica /scan (senza login) | 14.3 s |  |
| ✅ | 3.3 Giornale lavori: nuova registrazione | 8.1 s |  |
| ⏭ | 3.4 Invito utente (esito verificato solo nel database) | 21.0 s | Invio reale non eseguibile nella prova senza mandare email: Supabase non invia l'invito a un indirizzo fittizio (dominio rifiutato o limite di invii del progetto gratuito; risposta HTTP 400: email rate limit exceeded). Verificato: richiesta partita con il token dell'admin e nessun utente orfano dopo il rifiuto |
| ✅ | 3.5 Archiviazione commessa (dati conservati) e ripristino | 22.5 s |  |

## Bug e problemi trovati (non corretti)

1. **1.3 RDO a 2 fornitori (gara multi-fornitore)** (test fallito): la RDO copia solo rda.wbs_ref; la RDA generata dal computo ha la WBS in rda.wbs_id → WBS persa (atteso "1.1", trovato null)
2. **1.4 Offerta fornitore 1 dalla pagina pubblica /offerta (senza login)** (test fallito): HTTP 500: Errore salvataggio offerta: new row for relation "rdo" violates check constraint "rdo_stato_check"
3. **1.5 Offerta fornitore 2 da preventivo PDF (AI simulata)** (test fallito): "Conferma importazione" senza effetto nel DB: la scrittura (stato 'risposta_ricevuta', non ammesso da rdo_stato_check) non controlla l'errore — a schermo: nessun messaggio
4. **1.6 Comparativa e aggiudicazione all'offerta più bassa** (test fallito): nessuna offerta salvata nei passi 1.4 e 1.5
5. **1.7 ODA dall'aggiudicazione (importo, fornitore, WBS)** (test fallito): ODA non salvato — messaggio nel modulo: new row for relation "oda" violates check constraint "oda_stato_check"
6. **2.2 SAL attivo: caricamento PDF della DL** (test fallito): funzione non presente nella pagina SAL attivi attuale: nessun campo file PDF e nessun uso di sal.pdf_dl_url nel codice (CLAUDE.md la dà per completata con SalGrid.tsx, che non esiste più)
7. **2.3 Fattura attiva dal SAL (Fatturazione)** (test fallito): fattura non salvata — a schermo: [alert] ⚠ Fattura non salvata: valore non valido: new row for relation "fatture" violates check constraint "fatture_tipo_check" · la pagina scrive tipo 'ATTIVA', il vincolo fatture_tipo_check ammette solo 'attiva'/'passiva'
8. **1.7 ODA dall'aggiudicazione (importo, fornitore, WBS)** (bug annotato): ODA: fornitore non preselezionato dall'aggiudicazione (nome nell'URL "Calcestruzzi Alfaverde"); selezionato a mano
9. **2.1 SAL attivo: nuovo SAL, quantità di una voce, salvataggio ed emissione** (bug annotato): SAL attivi: nessun vincolo di unicità su sal(commessa_id, numero) e "+ Nuovo SAL" è attivo prima che l'elenco sia caricato — cliccando subito si crea un SAL con numero già usato (osservato nel primo giro dei test)
10. **2.4 SAL passivo con fornitore dal DURC scaduto: registrazione e blocco autorizzazione** (bug annotato): SAL passivi: il blocco per DURC scaduto esiste solo nell'interfaccia — con una chiamata API diretta lo stato passa ad "autorizzato" (nessun controllo nel DB)
11. **3.4 Invito utente (esito verificato solo nel database)** (bug annotato): Impostazioni › Invita: se premuto prima che la pagina abbia caricato l'azienda il pulsante non fa nulla e non mostra messaggi (invitaUtente esce in silenzio con aziendaId vuoto)

## Note

- Artefatti dei test falliti (screenshot, trace): `tests/report/e2e-artefatti/` (escluso da git); `npx playwright show-trace <file>` per rivederli.
- I passi che dipendono da uno precedente fallito ripiegano sui dati del seed (indicato nella colonna dettaglio), così il resto della catena viene provato comunque.
