# SQ360 — MASTER

> Documento di stato unico del progetto. **Va aggiornato ad ogni commit.**
> Ultimo aggiornamento: 2026-11-01 · ultimo commit di riferimento: migrazione stati annullati eseguita in produzione (successivo a `518ecff`)
>
> Fonti: `CLAUDE.md` (storico sessioni), `DEPLOY.md`, struttura `src/app`.

Legenda: ✅ completo · ⚠️ implementato ma da verificare / richiede SQL · 🚧 parziale · 📋 non iniziato

---

## 1. Stato dei moduli

### 1.1 Piattaforma / trasversali
| Modulo | Stato | Note |
|---|---|---|
| Auth login | ✅ | Protezione solo client-side (`dashboard/layout.tsx`); `middleware.ts` vuoto. Link "Password dimenticata?" → `resetPasswordForEmail` verso `/auth/conferma` |
| Scelta password `/auth/conferma` | ⚠️ | Unica pagina per invito (`type=invite`) e recupero (`type=recovery`): legge la sessione dal link, nuova password + conferma (min 10 caratteri), `updateUser` → `/dashboard`; link scaduto (`otp_expired`) → messaggio + richiesta nuovo link. **Da provare end-to-end** (richiede Redirect URL in Supabase) |
| Registrazione multi-azienda `/register` | ⚠️ | Wizard 2 step + recovery orfano; azienda+utente creati dalla route server `/api/register` (service role, validazione, righe in `azienda` **e** `aziende` con lo stesso id); **test end-to-end register→email→login da fare** |
| Multi-tenant (`azienda_id` + RLS) | ✅ | **Isolamento tra aziende attivo in produzione dal 01/11/2026**: migrazione `20261101_1_applica.sql` eseguita dall'utente nello SQL Editor dopo la verifica preliminare e il backup dei dati. Una regola per tabella con `get_azienda_id()` (azienda della commessa se presente, altrimenti `azienda_id`, figlie dalla madre), viste `security_invoker`. Controlli post-applicazione: RLS spenta su nessuna tabella; regole aperte solo `categorie_c/sb/sc` e `wbs_template_lettura`. Provata prima sulla prova (test A/B: 39 tabelle + 7 viste esposte → 0). Residui fuori dalla migrazione in §4.4 (storage pubblico, RPC SECURITY DEFINER, TRUNCATE) |
| Permessi sotto-moduli (`moduli_abilitati`) | ✅ | Filtro tab/gruppi + redirect ad `/anagrafica`; admin vede tutto |
| Inviti utente `/api/invite-user` | ⚠️ | Chiamante identificato dal Bearer token (401), deve essere admin con azienda (403); `azienda_id` sempre del chiamante, mai dal body (diverso → 403); link verso `<dominio richiesta>/auth/conferma`; se l'upsert su `utenti` fallisce l'utente appena invitato viene annullato. Richiede `SUPABASE_SERVICE_ROLE_KEY`. **Da provare end-to-end** |
| Email Resend + template + log | ⚠️ | Dominio `sq360.app` da verificare su Resend; `CRON_SECRET` da impostare |
| Cron DURC settimanale | ⚠️ | `vercel.json` lunedì 8:00 — richiede Vercel Pro+ |
| PDF @react-pdf (ODA, SAM, SAL, OS, Contratto Sub, RDO, Verbale consegna, NP) | ✅ | Carta intestata > logo > testo; bucket `aziende-assets` **da creare** |
| PWA (sw.js, manifest, banner, icone edge) | ⚠️ | Da verificare in DevTools + Lighthouse |
| Impostazioni azienda (logo, carta intestata, WBS template) | ⚠️ | Dipende da SQL `aziende` + `wbs_templates` |
| Controllo scritture `scripts/check-scritture.mjs` | ✅ | Confronta TUTTE le insert/update/upsert del codice (anche payload costruiti a parte, `.map`, spread, funzioni) con lo schema reale: colonne inesistenti, obbligatori mancanti, enum non validi, **tipi incompatibili** (errore: stringhe/stringa vuota in colonne uuid/data/numero/booleano; avviso: valore da un nome che non sembra un id in colonna uuid, testo grezzo in colonna numerica; `// check-scritture: id` sulla riga = id verificato a mano). Report `scripts/report-scritture.md` (escluso da git). Uso: `node scripts/check-scritture.mjs` |
| Ambiente di prova (Supabase gratuito `sq360-test`) | 🚧 | **Passi 2-3 fatti (01/11/2026)**. Schema di produzione ricostruito sulla prova (confronto 0 differenze; `tests/ambiente-prova/`: `dump-schema.mjs` sola lettura → `backup-schema-produzione/` escluso da git, `applica-schema.mjs [--reset]`, `confronta-schema.mjs`, `applica-migrazione.mjs` solo sulla prova). **Seed** `tests/seed/seed.mjs`: aziende Alfa (A) / Beta (B), admin A + tecnico A + admin B (dominio `sq360-prova.example`, nessuna email), fornitori con DURC valido/in scadenza/scaduto, lavoratori, commessa per azienda, A con computo dall'XPWE via `/api/xpwe-parse` (815 voci, € 1.286.683,48, 3017 misurazioni), RDA→RDO→ODA→DDT→fattura passiva, SAL con voci, PDF sintetici (contratto, DDT, fattura, DURC, POS, preventivo) nello storage di prova, riempitivo che garantisce righe A e B in tutte le 95 tabelle. **Test isolamento** `npm run test:isolamento` (`tests/isolamento/ciclo.mjs`: reset → genera migrazione → seed → test prima → migrazione sulla prova → seed → test dopo), esiti verificati nel DB, report `tests/report/ISOLAMENTO.md`. Mappa appartenenze unica `tests/lib/classificazione.mjs`. Smoke test sulla prova: `tests/isolamento/smoke-prova.mjs` (44 pagine, 0 rotte dopo la correzione). Credenziali di prova in `tests/.state/` (escluso). Prossimi: test Playwright dei flussi (XPWE totali, acquisti→CE, SAL, archiviazione, persone, inviti), AI simulata con intercettazione Playwright |
| Test end-to-end Playwright `npm run test:piattaforma` | 🚧 | **Passo 4 (01/11/2026)**: `tests/e2e/` — seed + `prepara.mjs` (WBS 1/1.1 sulla commessa di A, 2 voci con WBS, contratto sub con fornitore dal DURC scaduto) → app locale sulla prova → 23 test con l'admin di A, esiti verificati nel DB, AI (Gemini/Claude) simulata con intercettazione Playwright delle route `/api/ai-*` e `/api/rdo-extract-offerta`, report `tests/report/RISULTATI.md` (artefatti in `tests/report/e2e-artefatti/`, esclusi). Accesso: sessione Supabase scritta nel localStorage. Stato tra i test su file (`tests/.state/e2e-ctx-*.json`), i passi a valle di uno fallito ripiegano sui dati del seed. **Ultimo esito dopo il passo 6 (regole di isolamento + migrazione 20261101_3 applicate sulla prova): 19/23 ✅ · 3 ❌ (difetti rinviati: WBS, PDF DL, fattura↔SAL) · 1 ⏭ (invito: invio email non eseguibile nella prova)**. Playwright portato a 1.64.1 (`@playwright/test` + `playwright`): la 1.48 si bloccava al caricamento dei test con Node 24 |
| Smoke test `scripts/smoke-test.mjs` (Playwright) | ✅ | Ultimo esito 31/10/2026: 44/44 ok. Login robusto (attende l'idratazione React, verifica i campi, 3 tentativi). Sola lettura (scritture bloccate a livello di rete), 44 pagine, report `scripts/report-smoke.md` + screenshot (esclusi da git); credenziali `SMOKE_EMAIL`/`SMOKE_PASSWORD` solo in `.env.local`. Uso: `node scripts/smoke-test.mjs` |

### 1.2 Area dashboard (`src/app/dashboard/*`)
| Modulo | Stato | Note |
|---|---|---|
| Dashboard homepage (KPI, alert, scadenziario, attività) | ✅ | 11 query in `Promise.all`, no view SQL |
| Mappa cantieri (Mapbox) | ⚠️ | Richiede `NEXT_PUBLIC_MAPBOX_TOKEN`; colonne geo su `commesse` da verificare |
| Commesse (lista + codifica `[AA]-[SA]-[PR]-[SOA]-[NNN]`) | ✅ | RPC `genera_codice_commessa`. **Archiviazione** al posto della cancellazione: "Archivia commessa" nel layout, filtro "Archiviate" + "Ripristina" in lista; archiviate escluse da lista operativa, dashboard (tutti i KPI) e mappa |
| Gare (accordion, checklist offerta, migliorie, simulatore margine, crea commessa) | ✅ | Checklist offerta in `localStorage`, non DB |
| Contatti / fornitori v2 (38 campi, 5 tab, AI import PDF, alert scadenze) | ✅ | AI import usa Claude Haiku (`/api/ai-import-fornitore`) |
| import-computo, preventivazione, pianificazione, scadenzario, report, marginalita, sal, amministrazione, cantiere, contratti, dam | ❓ | Presenti in `src/app/dashboard` ma non documentati in CLAUDE.md — stato da verificare |

### 1.3 Commessa (`src/app/dashboard/commesse/[id]/*`) — navigazione a 2 livelli
| Gruppo | Modulo | Stato | Note |
|---|---|---|---|
| Contratto 📋 | anagrafica | ✅ | WBS commessa, verbale consegna PDF, toggle sicurezza interna |
| | elenco-prezzi | ✅ | Popolazione auto dal computo, analisi BASE, NP/xxx concordato DL |
| | computo | ✅ | XPWE + misurazioni reali (descrizione riga, formule, deduzioni "a detrarre", "vedi voce"), voce da EP, analisi prezzi BASE+EXTRA, voci XPWE read-only — **reimportare l'XPWE** per vedere le misurazioni |
| | varianti | ✅ | Iter D.Lgs.36/2023; esecutiva → `visibile_in_computo=true` |
| | ordini-servizio | ✅ | Firma / riserva / chiudi, genera variante |
| | nuovi-prezzi | ⚠️ | **SQL `nuovi_prezzi` da eseguire** |
| | riserve | ⚠️ | **SQL `riserve` da eseguire** |
| Acquisti 🛒 | rda | ✅ | WBS propagata a RDO, badge WBS mancante |
| | rdo | ✅ | Wizard multi-fornitore, `/offerta/[token]`, comparativa, AI preventivo |
| | dam (SAM) | ✅ | Opzionale per commessa; flusso RDO→SAM→ODA forzato |
| | oda | ✅ | 6 tipi, paginazione 50, anti-doppio SAM |
| | contratti (sub) | ⚠️ | Checklist 7 doc / lavoratori / pagamenti — **tabelle Sprint 6 da creare** |
| | assegnazione | ✅ | Fix `professionisti_fornitori` |
| Cantiere 🏗️ | cantiere (giornale) | ✅ | |
| | persone | ⚠️ | QR badge, scanner PWA, presenze, coda offline. Scritture verificate (lavoratore, presenza, disattivazione, scanner e coda offline). **Inserimento lavoratore rifiutato dal DB** (colonne corrette, tabella vuota): probabile regola RLS (`mia_azienda_id()` = NULL) → in attesa della diagnosi |
| | sicurezza | ✅ | 24 tipologie AI Gemini |
| | ddt | ✅ | AI Gemini Vision, paginazione |
| Economico 💰 | sal-attivi (+ SalGrid) | ⚠️ | Completo; righe di misura reali (read-only) al posto del nome categoria; **SQL `sal.pdf_*_url` da eseguire** |
| | sal-passivi | ✅ | Blocco autorizzazione se DURC non valido |
| | fatturazione / fatture | ✅ | Fatture passive AI, paginazione |
| | conto-economico | ✅ | Doppio margine, breakdown tipo ODA, previsti per WBS |
| | marginalita | ✅ | Join ODA→RDO→RDA→wbs_id |
| | spese | ❓ | Non documentato |
| Extra ⭐ | migliorie | ✅ | Ereditate da gara + dirette, impatto CE |
| Archivio 📁 | archivio | ✅ | 6 cartelle, checklist sub, export ZIP |
| | documenti | ✅ | |
| | comunicazioni (📧 Email) | ✅ | Da `email_log` |
| Altro | gantt, preventivo | ❓ | Presenti nel codice, stato da verificare |

### 1.4 Roadmap non iniziata
| # | Modulo | Stato |
|---|---|---|
| 43 | Registro di contabilità (libro giornale strutturato) | 📋 |
| 44 | Export completo commessa ZIP strutturato (oltre l'archivio) | 📋 |
| 45 | Knowledge base AI edile (D.Lgs. 36/2023, prezzari regionali) | 📋 |
| 46 | Billing / piani tariffari Stripe | 📋 |

---

## 2. Decisioni architetturali

- **Stack**: Next.js 15 (App Router) + Supabase + Vercel. AI principale Gemini (server-side, `GEMINI_API_KEY`); eccezione: import contratto/fornitore/progettista su Claude.
- **Gemini in un solo punto** (`src/lib/gemini.ts`): modello = `GEMINI_MODEL` (predefinito `gemini-3.8-flash`, il 2.0 Flash è stato spento da Google); riserva `GEMINI_MODEL_RISERVA` (predefinito `gemini-3.6-flash`) usata una volta se il principale risponde 503 (sovraccarico), 404 (non più disponibile) o va in timeout; timeout 22 s + 33 s, route AI con `maxDuration = 60`; messaggi d'errore leggibili (mai JSON grezzo); risposta letta escludendo le parti di "ragionamento". Formato `generateContent` (inline_data base64, `responseMimeType: application/json`, `?key=`) verificato sulla documentazione ufficiale il 31/10/2026.
- **Supabase client tipato `any`** (`src/lib/supabase.ts`): nessun tipo generato; evita TS2769 su build Vercel. Nelle route API: `const db = client as any`.
- **Pagine pubbliche (`/offerta/[token]`, `/scan/[token]`) senza accesso diretto al DB**: passano da `/api/offerta/[token]` e `/api/scan/[token]`, che con la service role (`getAdminClient`) usano solo la riga del token (UUID) e restituiscono solo i campi necessari; importi offerta ricalcolati dal server, data/ora presenze del server (Europe/Rome).
- **Email**: unico invio server-side (`src/lib/emailServer.ts`), mittente fisso, reply-to dell'utente; `/api/email` richiede il token e accetta solo un *tipo* (`oda_creato`, `dam_approvato`, `durc_report`, `rdo_invito`) + dati: l'HTML lo genera il server dai modelli con testi escapati (`escHtml`). Niente HTML/from dal client.
- **Route AI** (`ai-*`, `docx-text`, `rdo-extract-offerta`) solo per utenti collegati (`getUserClient`); i client usano `fetchConToken` (`src/lib/authFetch.ts`). `/api/cron/durc` chiusa se `CRON_SECRET` manca.
- **Link nelle email Supabase** (invito, recupero password) = `<dominio della richiesta>/auth/conferma`: niente URL fissi, `NEXT_PUBLIC_APP_URL` non è più usata. Ogni dominio va aggiunto in Supabase → Authentication → URL Configuration → Redirect URLs (vedi DEPLOY.md).
- **Client Supabase/Resend istanziati dentro gli handler**, mai a livello modulo (evita errori di build "supabaseKey is required").
- **Route API che scrivono/leggono dati utente usano il token dell'utente**: il client invia `Authorization: Bearer <access_token>`, la route crea il client con `getUserClient(req)` (`src/lib/supabaseServer.ts`) → le RLS si applicano come nel browser; 401 con messaggio se token mancante/scaduto. Vietati il client anon senza sessione (utente anonimo per il DB) e la service role nelle route chiamate dagli utenti. Applicato a `/api/xpwe-parse` e `/api/xpwe-parse-sal`.
- **Multi-tenant**: `getAziendaId()` (`auth.uid → utenti.azienda_id`) in ogni INSERT + RLS con `get_azienda_id()` su DB. Doppia protezione: codice + DB.
- **Params Next 15**: pattern `use(paramsPromise)` al posto di `useParams` nelle pagine commessa.
- **Layout commessa**: array `GRUPPI` (id, color, tabs[]); gruppo attivo da `pathname`, nessuno state; `MODULO_KEY` mappa href → permesso.
- **Dati live, non snapshot**: `sal_voci` contiene solo `sal_id, voce_computo_id, quantita_periodo, wbs_id`; tutto il resto via JOIN su `voci_computo`. SalGrid legge sempre computo + varianti esecutive al mount.
- **SalGrid = copia meccanica del computo** (`cp`) con 3 differenze; pannello analisi disabilitato con `{false && …}`.
- **Analisi prezzi**: BASE condivisa per `codice_tariffa` (`analisi_prezzi_tariffa`) + EXTRA per singola voce (`analisi_extra_voce`). Home canonica: Elenco Prezzi. `piano_costi_voce` deprecato (tabella resta per storico).
- **WBS a 2 livelli**: `wbs_templates` (azienda) → `wbs_nodes` (commessa) con `template_id`; `loadWbs()` fallback a 4 livelli fino a `DEFAULT_WBS_FLAT`.
- **XPWE reimport = sostituzione**: prima di qualsiasi insert cancella in ordine misurazioni → voci → `computo_metrico` → tariffe della commessa, verificando dopo ogni passo (ricontando) che non resti nulla; se una DELETE è bloccata (le RLS cancellano 0 righe senza errore) l'import si ferma senza inserire → niente duplicati. UUID client-side pre-assegnati per linkare misurazioni senza re-query.
- **Misurazioni XPWE** (`voci_computo_misurazioni`, schema reale: `voce_computo_id`, `descrizione`, `parti_uguali`, `lunghezza`, `larghezza`, `altezza_peso`, `formula`, `quantita_calc`, `is_negativo`, `is_parziale`, `flags`, `rif_idvv`, `ordine` — nessun `commessa_id`): parser su `<PweVCMisure>/<RGItem>` (vecchi `<Misure>/<MisureItem>` come alternativa); quantità = `<Quantita>` del file (non ricalcolata); campi vuoti = `null`; numeri con spazi (`3 679.00`); formule → valore calcolato nel campo + testo originale in `formula` (formato `VV=… · PU=… · L=… · La=… · H=…`); se l'INSERT fallisce l'import fallisce con messaggio. Logica condivisa in `src/lib/misurazioni.ts`; caricamento paginato (>1000 righe) con join `voci_computo!inner(computo_id)`.
- **Codici documento**: MAX+1 con `UNIQUE(commessa_id, azienda_id, codice)`; revisioni `-R1/-R2`.
- **Computo**: render diretto, virtualizzatore rimosso (`@tanstack/react-virtual` installato ma non usato lì).
- **Paginazione**: ODA / DDT / fatture passive a blocchi da 50 con "Carica altri".
- **PDF**: `@react-pdf/renderer` sempre con import dinamico nel click handler.
- **PWA**: `public/sw.js` statico committato; NetworkFirst su navigazione, pass-through per Supabase e `/api/*`.
- **Tabella azienda canonica = `azienda`** (FK di `utenti`, `gare`, `sal`, `documenti_commessa`, `email_log`): dati e carta intestata si leggono/scrivono lì. `aziende` resta solo per le FK di `wbs_templates`/`azienda_sedi` e viene creata con lo stesso id da `/api/register`; unificazione futura da pianificare.
- **Nomi colonna DB ≠ nomi usati nel codice**: si legge con alias PostgREST (`numero:codice`, `url:file_url`, …) e si scrive con il nome reale. Rif. `supabase/migrations/20261031_allineamento_schema.sql`.
- **Scritture non permesse da RLS**: un UPDATE/DELETE bloccato non dà errore ma tocca 0 righe → verificare sempre le righe toccate. Helper unico `scritturaVerificata(query.select('id'))` in `src/lib/scritture.ts` (errore + righe toccate + messaggio in italiano con `messaggioErroreDb`): "salvato" solo dopo la verifica, altrimenti avviso "⚠ … non salvato: motivo" e modulo aperto. Applicato a DDT, fatture passive, sicurezza, SAM, documenti, RDA, RDO, SAL attivi/passivi (stati), varianti, ODA (stati), gare.
- **Nessuna scrittura automatica all'apertura di una pagina** (es. template WBS): errore di lettura ≠ dato vuoto.
- **Stati SAM** = testo, valori canonici minuscoli `bozza → inviata_dl → approvata | rifiutata | integrazione` (`src/lib/statiSam.ts`, `normalizzaStatoSam` converte i vecchi valori MAIUSCOLI); la pagina globale `/dashboard/dam` mostra stati MAIUSCOLI ma salva quelli canonici.
- **Mappature colonne decise il 31/10/2026**: giornale lavori (operai → `operai_propri`/`operai_sub`, lavori eseguiti → `descrizione`, direttore di cantiere → `direttore_cantiere` (testo), `redatto_da` = uuid dell'utente che compila); documenti subappalto (SOA/IBAN → `categoria_soa`/`classifica_soa`/`iban`); pagamenti subappalto (ritenuta come importo in `ritenuta`, netto in `netto_pagato`, svincolo = `svincolata`); fatture attive (`soggetto` = committente, imponibile in `importo_imponibile`, totale calcolato).
- **Commesse: archiviazione, non cancellazione fisica** (`commesse.archiviata_at`, `archiviata_da`): i dati (computo, acquisti, DDT, SAL, fatture, documenti) restano per gli obblighi di conservazione; la cancellazione fisica non è più offerta dall'app (molte tabelle hanno `commessa_id` senza FK → resterebbero orfane). Filtro centralizzato `idCommesseOperative()` in `src/lib/commesse.ts`; `v_commesse_kpi` (senza `archiviata_at`) è filtrata nel codice con gli id operativi invece di ricreare la vista.
- **Rename DAM → SAM** solo nelle label: URL `/dam`, variabili e tabella `dam` invariati.
- **Pagine pubbliche senza login**: `/offerta/[token]` (fornitore), `/scan/[token]` (badge cantiere) — accesso via token univoco.

## 3. Regole di dominio

- **Una piattaforma per privati e appalti pubblici** (switch tipo commessa); commesse illimitate in tutti i piani, pricing per numero utenti.
- **Flusso acquisti obbligato**: RDA → RDO → (SAM se attivo sulla commessa) → ODA. Stati aggiornati automaticamente.
- **Subappalto** (D.Lgs. 36/2023 art.119): 8 tipi di affidamento con rilevamento automatico; warning se contratto sub > 40%.
- **Contratti sub**: workflow `bozza → attesa_autorizzazione → autorizzato → in_esecuzione → completato` (Sospendi sempre); "Avvia lavori" bloccato senza documenti critici (contratto, DURC, SOA, DVR, POS, notifica SA, IBAN L.136/2010). Svincolo ritenuta solo a completato.
- **SAL passivi**: `ricevuto → in_verifica → autorizzato → pagato`; autorizzazione bloccata se DURC sub non valido.
- **Ritenuta di garanzia**: default 5% su SAL attivi e passivi.
- **Sicurezza interna (formula 3 livelli, Primus-compatibile)**: `quotaLavori = (PU − sic) × (1 − ribasso) × q` + `quotaSicurezza = sic × q`; di default sicurezza NON ribassabile (`sicurezza_interna_esclusa_ribasso = true`).
- **Voci XPWE read-only** (quantità/PU e righe di misura non editabili né eliminabili); voci manuali (`manuale = true`) editabili, anche con formule nei campi misura.
- **Righe di misura PriMus**: `Flags & 1` = deduzione (quantità già negativa nel file) → rosso con etichetta "a detrarre"; `Flags & 32768` = "vedi voce" → `IDVV` è l'ID della voce collegata, quantità = fattori riga × quantità di quella voce, mostrata come "↪ Vedi voce n. N (tariffa)"; righe titolo (tutti i campi vuoti) solo descrizione, senza quantità.
- **Voci da variante** visibili nel computo solo quando la variante diventa `esecutiva`; voci `soppressione` barrate e non quantificabili nel SAL.
- **Varianti**: soglie RUP/SA secondo D.Lgs. 36/2023; iter proposta → RUP → SA → esecutiva.
- **Nuovi prezzi**: proposta → in_negoziazione → concordato → inserito_ep; codici `NP/001…` (fonte `concordato_dl`).
- **Riserve**: iscritta → in_discussione → accettata/respinta/arbitrato; scadenza risposta default +30gg, alert ≤7gg.
- **Ordini di servizio**: alert se non firmati > 5gg.
- **Migliorie**: `contrattuale → da_eseguire → in_esecuzione → completata → verificata_dl`; costo non remunerato → impatto negativo sul margine CE.
- **Margini**: verde ≥15% · arancio 5–15% · rosso 0–5% · rosso scuro <0%.
- **Scadenze documentali** (DURC, polizza RC, Inarcassa, formazione): verde / arancio ≤30gg / rosso scaduto.
- **UX**: massimo 3 tap per qualsiasi azione.

---

## 4. Discusso ma non implementato / pendente

### 4.1 Da eseguire su Supabase (bloccanti per moduli già scritti)
- [x] **`supabase/migrations/20261101_3_stati_annullati.sql` — ESEGUITA in produzione il 01/11/2026** dall'utente, a mano. Aggiunge `'annullata'` a `rdo_stato_check` e `'annullato'` a `oda_stato_check`, mantenendo tutti i valori attuali (DROP + ADD in una transazione; ritorno indietro commentato, che prima riporta le righe annullate a `rifiutata`/`contestato`). Abilita in produzione "✕ Annulla" della RDO e "Annulla" dell'ODA (codice del passo 6, deploy `518ecff`). Smoke test in produzione dopo il deploy: 44 pagine, 0 rotte, 0 avvisi. Il ciclo `npm run test:isolamento` la applica anche alla prova dopo la migrazione di isolamento
- [x] **`supabase/migrations/20261101_1_applica.sql` — ESEGUITA in produzione il 01/11/2026** dall'utente, a mano nello SQL Editor, dopo `20261101_0_verifica_preliminare.sql` e dopo il backup dei dati (`backup-schema-produzione/2026-11-01/dati-prima-isolamento.dump`, pg_dump --data-only, solo locale). Controlli post-applicazione: (a) tabelle con RLS spenta = nessuna; (b) regole aperte = solo `categorie_c`, `categorie_sb`, `categorie_sc` e `wbs_template_lettura`. Smoke test in produzione dopo la migrazione: 44 pagine, 0 rotte. Ritorno indietro disponibile: `20261101_2_ritorno_indietro.sql`. Contenuto: `get_azienda_id()` SECURITY DEFINER, nuova `sono_admin()`, una regola `<tabella>_azienda` per 87 tabelle (azienda della commessa se presente, altrimenti `azienda_id`, figlie dalla madre), `utenti` (lettura colleghi, modifica solo admin, `azienda_id` non modificabile, insert/delete solo server), `aziende` (lettura/modifica propria), `wbs_template` sola lettura, `rdo_offerte` bloccata, 7 viste `security_invoker`. Non toccate: `audit_trail`, `azienda`, `categorie_*`, `config_soglie_approvazione`, `user_aziende`, `contratto_voci`. Fuori: storage pubblico, RPC SECURITY DEFINER con id dal chiamante, permessi TRUNCATE
  - **File** (estratti parola per parola dall'originale con `tests/isolamento/dividi-migrazione.mjs`, rigenerati anche da `npm run test:isolamento`): `20261101_0_verifica_preliminare.sql` (solo lettura) → `20261101_1_applica.sql` (eseguito) → solo per annullare `20261101_2_ritorno_indietro.sql`. L'originale `20261101_isolamento_aziende.sql` resta come fonte unica e **non va rieseguito**
  - Provati prima sulla prova (01/11/2026): pulita → 0 → 1 → 2 → 1. Dopo 1: RLS spenta 0, regole aperte 4 (quelle volute). Dopo 2: **0 differenze su 479 oggetti** rispetto alla produzione (regole, RLS, funzioni, viste, permessi). Riapplicazione identica. Corretto l'ordine nel ritorno indietro: `DROP FUNCTION sono_admin()` in fondo (prima falliva perché usata da `utenti_modifica_admin`)
- [x] **Sicurezza passo 1 — eseguito il 31/10/2026**: `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon` + default privileges; anon mantiene solo SELECT su `commesse`, `rda`, `rdo`, `utenti`, `voci_computo`, `lavoratori_commessa`, `presenze_cantiere`, UPDATE su `rdo`, INSERT su `presenze_cantiere` (pagine pubbliche `/offerta`, `/scan`). Verifica con chiave anon: 96/103 tabelle/viste negate; **ancora leggibili senza login: `utenti` (3 righe) e `voci_computo` (1.630)** → da chiudere dopo il passo 3. Ritorno: `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon`.
- [ ] **Sicurezza passo 3b — REVOKE finale su anon** (da eseguire DOPO le prove manuali di `/offerta` e `/scan`): `REVOKE ALL ON public.commesse, public.rda, public.rdo, public.utenti, public.voci_computo, public.lavoratori_commessa, public.presenze_cantiere FROM anon;` — ritorno: `GRANT SELECT ON …; GRANT UPDATE ON public.rdo; GRANT INSERT ON public.presenze_cantiere TO anon`
- [x] `ALTER TABLE ddt ADD codice, data_ricezione, fornitore_nome, voci` — eseguita il 31/10/2026 (il salvataggio DDT falliva in silenzio)
- [x] `supabase/migrations/20261031b_allineamento_salvataggi.sql` — **eseguita il 31/10/2026**: DDT, contratti_sub, ordini_servizio, `dam.stato` → testo (default `bozza`), giornale_lavori (temperatura_min/max, n_mezzi, note), documenti_contratto_sub.nome_file. `check-scritture.mjs`: 0 colonne inesistenti, 0 obbligatori mancanti, 0 enum non validi (8 scritture con chiavi/variabili calcolate da verificare a mano)
- [x] Archiviazione commesse: `ALTER TABLE commesse ADD archiviata_at, archiviata_da` + indice parziale — eseguita il 31/10/2026
- [ ] Valutare `REVOKE DELETE ON commesse FROM authenticated` (cancellazione fisica solo da server) — rimandato
- [ ] Pagine globali ancora senza filtro archiviate: scadenzario, report, marginalità, SAL, contratti, SAM globale (mostrano dati anche di commesse archiviate)
- [x] `supabase/migrations/20261031c_regole_tabelle_senza_policy.sql` — eseguita il 31/10/2026 (19 tabelle con RLS attiva e nessuna regola ora filtrate con `get_azienda_id()`) + `giornale_lavori.direttore_cantiere` (testo)
- [ ] Da decidere: `contratto_voci` (contratto_id ambiguo: contratti o contratti_sub), `user_aziende` (solo lettura proprie righe o dismissione), `config_soglie_approvazione` (solo lettura o per azienda)
- [ ] Diagnosi Persone: regole RLS e vincoli CHECK di `lavoratori_commessa` / `presenze_cantiere` + definizione `mia_azienda_id()` (query di sola lettura fornita il 31/10/2026) → poi SQL di correzione delle regole
- [ ] Sicurezza passo 0: fotografia RLS/regole/funzioni/permessi (query di sola lettura) — necessaria per i passi 4–8 (regole per azienda con `get_azienda_id()`, tabelle figlie, `aziende`/`mia_azienda_id`, bucket `documenti` privato)
- [x] `supabase/migrations/20261031_allineamento_schema.sql` — **eseguita il 31/10/2026** (colonne mancanti su fatture_passive/oda/documenti_commessa/gare/varianti/voci_variante/sal_passivi/contratti_sub/azienda/wbs_nodes, enum `stato_gara`, FK verso `professionisti_fornitori`)
- [ ] Regola RLS **UPDATE su `azienda`** limitata alla propria azienda (oggi solo SELECT → Impostazioni non può salvare dati azienda, email, logo/carta intestata; la pagina ora lo segnala)
- [ ] `mia_azienda_id()` restituisce NULL per gli utenti → le regole di `aziende` non mostrano nulla (da correggere o sostituire con `get_azienda_id()`, che funziona)
- [ ] `CREATE TABLE nuovi_prezzi` + `riserve` con RLS (regole `USING (true)` sostituite dalla migrazione 20261101_isolamento_aziende)
- [ ] `CREATE TABLE wbs_templates`, `wbs_nodes` con RLS
- [ ] Tabelle Sprint 6: `documenti_contratto_sub`, `lavoratori_sub`, `pagamenti_sub`
- [ ] `ALTER TABLE sal ADD pdf_dl_url, pdf_certificato_url`
- [ ] `ALTER TABLE voci_computo ADD sic_interna_importo, sic_interna_percentuale, manuale`
- [ ] `ALTER TABLE elenco_prezzi ADD manuale`
- [ ] `ALTER TABLE commesse ADD sicurezza_interna_esclusa_ribasso`
- [ ] `ALTER TABLE aziende ADD logo_url, carta_intestata_header_url, carta_intestata_footer_url`
- [ ] Storage bucket pubblico `aziende-assets`

### 4.2 Configurazione / verifica
- [ ] `CRON_SECRET` su Vercel
- [ ] Dominio `sq360.app` verificato su Resend
- [ ] `NEXT_PUBLIC_MAPBOX_TOKEN` + colonne geo su `commesse` (mappa)
- [ ] Verifica PWA (service worker attivo, Lighthouse)
- [ ] Test end-to-end register → conferma email → primo login
- [ ] Supabase → Authentication → URL Configuration: Site URL + Redirect URL `https://sq-360-8ek9.vercel.app/auth/conferma` (senza, i link di invito/recupero tornano al Site URL)
- [ ] Test end-to-end invito → `/auth/conferma` → scelta password → login
- [ ] Togliere `NEXT_PUBLIC_APP_URL` dalle variabili Vercel (non più usata)

### 4.3 Esito smoke test 31/10/2026 (produzione, utente di prova admin)
**Dopo le correzioni** (deploy `0bd18e8`): ✅ **44/44 pagine ok** — 0 rotte, 0 avvisi (nessun errore console/JS, nessuna richiesta 4xx/5xx), 0 scritture automatiche all'apertura.

**Prima delle correzioni** (stato risolto dalla migrazione 20261031 + commit di allineamento codice): 1 pagina rotta, 22 con avvisi, 21 ok su 44. Dettaglio in `scripts/report-smoke.md` (locale).
- ✗ **`/dashboard/sal` rotta**: crash client `Cannot read properties of undefined (reading 'color')`.
- **Schema DB non allineato al codice** (errori 400/404 PostgREST, le pagine si aprono ma mostrano dati parziali):
  - colonne mancanti: `fatture_passive.importo_totale/numero/totale`, `ddt.numero/fornitore_nome`, `oda.numero`, `documenti_commessa.categoria`, `gare.codice_gara`, `varianti.descrizione`, `voci_variante.commessa_id`, `sal_passivi.contratto_sub_id/ritenuta_importo`, `sal_attivi.stato`, `wbs_nodes.descrizione`, `wbs_commessa.etichetta`, `wbs_templates.template_id`, `wbs_template.parent_id`, `azienda.carta_intestata_header_url`, `utenti.moduli_abilitati`
  - relazioni FK mancanti verso `professionisti_fornitori` da `oda`, `contratti_sub`, `fatture_passive`
  - tabella `piano_costi_voce` non esiste più ma `conto-economico` la interroga
  - `aziende … .single()` → 406 (0 o più righe visibili all'utente)
- **Impostazioni scrive all'apertura**: POST su `wbs_templates` partito senza clic (bloccato dallo smoke test).

### 4.4 Debito tecnico / idee aperte
- ✅ **Isolamento tra aziende — risolto in produzione il 01/11/2026** (migrazione `20261101_1_applica.sql`, §4.1). Situazione trovata il 01/11/2026 e confermata dal test A/B (`tests/report/ISOLAMENTO.md`): 39 tabelle e 7 viste in cui A leggeva, modificava, inseriva come B ed eliminava dati di B; un utente non admin poteva modificare colleghi e sé stesso (farsi admin); un admin poteva cambiare la propria `azienda_id` ed entrare in un'altra azienda. Dettaglio dal catalogo (prima della migrazione):
  - **22 tabelle con RLS disattivata** (e tutti i permessi a `authenticated`): computo_metrico, computo_wbs_link, contratti_sub, costi_diretti, documenti_commessa, fatture, fornitori, misure_voce, preventivi, preventivo_voci, rapportini, rdo_fornitori, rdo_voci, richieste_offerta, sal_attivi, scadenzario, soggetto_referenti, spese_cantiere, tariffe, utenti, voci_computo, wbs_nodi
  - **regole che lasciano passare tutto** (`USING true`; le regole permissive si sommano, quindi annullano quelle per azienda): contratti_sub.allow_all_cs, dam.allow_all_dam, fatture_passive.allow_all_fp, rdo_offerte.allow_all_ro, spese_cantiere.allow_all_sc, voce_assegnazione.allow_all_va, wbs_commessa, wbs_template, commessa_figure (×2), nuovi_prezzi, riserve, professionisti_fornitori (×3), voci_computo_misurazioni, wbs_nodes, wbs_templates (le categorie_* in sola lettura sono tabelle di riferimento: ok)
  - `anon` (senza login): nessun permesso sulle tabelle in questo momento ✅
  - ✅ Corretto e verificato sulla prova (test A/B: dopo 0 fughe) e applicato in produzione (controlli post-applicazione ok, smoke test 44/44)
- **Bug `varianti`: ogni modifica fallisce** (trovato dal test A/B 01/11/2026): il trigger `trg_varianti_upd` chiama `set_updated_at()`, ma la tabella non ha la colonna `updated_at` → `42703 record "new" has no field "updated_at"`. Colpisce ad es. il cambio di stato della variante. Correzione da decidere: `ALTER TABLE varianti ADD COLUMN updated_at timestamptz DEFAULT now()` oppure togliere il trigger
- **Bug trovati dai test e2e (01/11/2026, `tests/report/RISULTATI.md`)** — ✅ = corretto nel passo 5 (codice adattato ai vincoli del DB, verificato sulla prova; nessuna modifica al DB):
  - ✅ **Offerte RDO** (passo 5): `/api/offerta/[token]` e "Conferma importazione" del preventivo scrivono `stato: 'ricevuta'` (ammesso da `rdo_stato_check`); la conferma usa `scritturaVerificata` e mostra l'esito (errore o importo importato); lettori aggiornati: `STATI_RDO`/colori in `rdo/page.tsx`, notifica realtime "offerta ricevuta", colori in `rda/page.tsx` e `FlowThread.tsx` (chiave `risposta_ricevuta` lasciata per righe storiche). Test 1.4 e 1.5 ✅
  - ✅ **Creazione ODA** (passo 5): creazione e revisione ODA con `stato: 'bozza'` (ammessi da `oda_stato_check`: bozza, firmato, in_esecuzione, completato, contestato), etichetta "Emesso (da firmare)" in pagina e PDF (`OdaDocument.tsx`). Test 1.7 ✅. **Cambio stato** (passo 6): pulsanti → `firmato` ("Confermato (firmato)"), `in_esecuzione` ("Parz. evaso"), `completato` ("Evaso"), `annullato` ("Annulla", nuovo valore della migrazione 20261101_3); filtri degli ODA annullati aggiornati a `'annullato'` in pagina ODA (totali, KPI, avviso WBS, revisione), conto economico, marginalità, DDT, fatture passive, dashboard; etichette/colori in pagina ODA, PDF e FlowThread. Test 1.12 ✅ (ciclo completo + esclusione dal CE e dai DDT)
  - ✅ **Fattura attiva** (passo 5): `tipo: 'attiva'` in scrittura e nel filtro della lista (`fatturazione/page.tsx`; prima `.eq('tipo','ATTIVA')`). Test 2.3 ✅. **Ancora aperto** (test 2.5): il modulo non ha un campo SAL (`formA.sal_id` non mostrato né salvato) → fattura non collegabile al SAL
  - **WBS persa nella catena acquisti**: RDA da computo ha la WBS in `rda.wbs_id`, la RDO copia solo `rda.wbs_ref` → `rdo.wbs_ref` null; la pagina ODA non legge `wbs_ref` dall'URL (solo rdo_id, importo, fornitore, dam_id, richiede_sam)
  - **ODA: fornitore non preselezionato** quando il nome nell'URL non coincide con `ragione_sociale` (abbinamento solo per nome esatto, l'URL non porta `fornitore_id`)
  - **SAL attivi: caricamento PDF DL assente** (nessun campo file, `sal.pdf_dl_url` non usato nel codice; `SalGrid.tsx` citato in CLAUDE.md non esiste più)
  - **SAL attivi: numero duplicabile**: nessun vincolo UNIQUE su `sal(commessa_id, numero)` e "+ Nuovo SAL" è attivo prima che l'elenco sia caricato → SAL con numero già usato (osservato)
  - **SAL passivi: blocco DURC solo nell'interfaccia**: con una chiamata API diretta lo stato passa ad `autorizzato` anche con DURC scaduto
  - ✅ **Impostazioni › Invita** (passo 5): pulsante disabilitato ("⏳ Caricamento…") finché l'azienda non è caricata; esito sempre mostrato (invito inviato / errore del server con messaggio / errore di rete). Test 3.4: richiesta partita, messaggio di esito verificato, nessun utente orfano (invio email reale non eseguibile nella prova)
  - ✅ **Aggiudicazione e annullamento RDO** (passo 6): vincente → `accettata`, altre offerte del gruppo → `rifiutata` (scritture verificate), "✕ Annulla" → `annullata` (nuovo valore della migrazione 20261101_3); stati in pagina RDO allineati al vincolo (`bozza, inviata, ricevuta, accettata, rifiutata, annullata`, "comparativa" tolto) con etichette "aggiudicata" / "non aggiudicata"; pulsanti SAM/ODA su `accettata`; colori in `rda/page.tsx` e FlowThread. Test 1.6 ✅ e 1.13 ✅
  - **Infrastruttura test**: due volte un processo (seed nel ciclo di isolamento, avvio app negli e2e) è terminato senza messaggio subito dopo l'avvio/arresto dell'app locale; rilanciati sono passati. Da tenere d'occhio (probabile arresto con `taskkill /T` mentre la porta 3100 è ancora in chiusura)
  - Funzionano (verificati nel DB): RDA da computo con WBS, approvazione RDA, RDO multi-fornitore, DDT da AI + verifica, fattura passiva da AI collegata a ODA/DDT, conto economico (ODA impegnati = Σ DB), SAL attivo (importo = PU × q, ritenuta 5%), SAL passivo (lordo/ritenuta/netto), lavoratore + QR, presenze ENTRATA/USCITA da `/scan`, giornale lavori (`redatto_da`, `direttore_cantiere`), archiviazione con dati conservati + ripristino; invito: nessun utente orfano dopo il rifiuto di Supabase
- **Sicurezza multi-tenant (analisi 31/10/2026)**: viste `v_*` senza `security_invoker` (saltano le RLS); `nuovi_prezzi`/`riserve` aperte a tutti gli autenticati; tabelle figlie senza filtro azienda; `mia_azienda_id()` → NULL (probabile lettura da `user_aziende`, mappatura incoerente); bucket `documenti` e `aziende-assets` pubblici con percorsi prevedibili; `/api/email` e route AI senza controllo del chiamante. Criterio unico scelto: `azienda_id = (SELECT get_azienda_id())`.
- **Residui da pulire in produzione** (righe rimaste da prove precedenti, segnalate dall'utente il 01/11/2026; da eliminare con ok esplicito, dopo verifica):
  - commessa `e6c108d7…`: `computo_metrico` con 815 voci, 3017 `misure_voce`, 13 `wbs_nodi`, 1 `contratti_sub`, 1 `documenti_commessa`, 2 `voce_assegnazione`
  - 16 `wbs_nodi` senza commessa
- `wbs_templates`: 66 righe (2 copie del template, la seconda inserita alle 09:56 del 31/10 dalla versione precedente alla correzione) → pulizia da fare con ok.
- Auth solo client-side: `middleware.ts` vuoto — valutare protezione server-side delle route.
- Tabelle legacy ancora in DB ma non più usate dal codice: `piano_costi_voce` (eliminata), `wbs_commessa`, `wbs_template` (libreria WBS standard globale, 220 righe), `sal_attivi` (i SAL sono in `sal`), `fornitori` (34 righe; l'unico `contratti_sub` punta ancora lì → FK `NOT VALID`): pianificare migrazione/rimozione.
- Due tabelle azienda (`azienda` + `aziende`) con FK divise: unificare su `azienda`.
- `/register`: il campo Provincia del form non viene salvato (nessuna colonna corrispondente in `azienda`).
- Checklist offerta gare in `localStorage`: non condivisa tra utenti/dispositivi — valutare persistenza in DB.
- Tipi Supabase non generati (`any` ovunque): valutare `supabase gen types`.
- **Sicurezza RLS da verificare tabella per tabella**: con la sola chiave anon (pubblica, senza login) è stato possibile leggere righe di `computo_metrico` → alcune policy sono aperte al ruolo anon. Contraddice "multi-tenant completamente sicura".
- Reimport XPWE: le voci vengono ricreate con nuovi UUID → i riferimenti esterni alle voci vecchie (`rda.voci_ids`, `sal_voci`, `analisi_extra_voce`) non vengono riallineati.
- `/api/xpwe-parse-sal` non è chiamata da nessuna pagina (codice non usato).
- **Limite di `check-scritture.mjs`**: controlla lo schema (colonne, obbligatori, enum), non regole RLS, vincoli CHECK o permessi (non visibili via API) → questi errori emergono solo a runtime, ora sempre mostrati da `scritturaVerificata`; per intercettarli prima serve un test di scrittura su un progetto di prova.
- `voci_computo_misurazioni.is_parziale`: colonna non valorizzata dall'import (nessun flag corrispondente individuato nel file di esempio).
- Riferimento "vedi voce" salvato come testo in `formula` (non esiste colonna con l'ID XPWE della voce): se la voce collegata cambia, il testo non si aggiorna.
- Roadmap 43–46 (registro contabilità, export ZIP strutturato, KB AI edile, billing Stripe).

---

## 5. Stato dei 16 prompt

> Fonte: `sq360-prompts.md` (dettaglio completo dei prompt da fare in quel file).

| # | Prompt | Stato | Commit | Note |
|---|---|---|---|---|
| 1 | Bug critici | ✅ | `7d2c714` + `f73ea2b` | Misurazioni XPWE (solo nuovi import), voce manuale da EP, tariffa concordato DL, fix contatti, wbs_id RDA→RDO, badge WBS mancante, impostazioni, banner Mapbox, voci XPWE read-only, visibile_in_computo |
| 1B | WBS personalizzabile | ✅ | `d5293d4` | `wbs_templates` + `wbs_nodes`, template aziendale, WBS per commessa, fallback |
| 2 | PDF | ✅ | `236395b` | RDO PDF, Verbale consegna lavori; comunicazioni formali spostate al Prompt 8 (da fare) |
| 3 | Utenti e permessi | ✅ | `036ccb3` + `0b84332` | 6 ruoli, toggle 19 moduli, sidebar adattiva, blocco URL, invito email; ruoli solo etichette, controllo reale su `moduli_abilitati` |
| 4 | Contratto autonomo | ✅ | `0d0b570` | Gruppi Contratto (10 tab) / Acquisti (6 tab) / Extra; Nuovi Prezzi, Riserve |
| 5 | Contatti AI | ✅ | `79e24bc` | Import AI da PDF, banner scadenze, badge, filtri In scadenza / Scaduti |
| 6 | Sicurezza sub + Nolo + DDT→ODA | 📋 | | DDT→ODA con AI, registro nolo, rapportini manodopera, fattura passiva con WBS, portale `/documenti-sub/[token]` |
| 7 | Report economico completo | 📋 | | CE per WBS previsto/impegnato/reale, cash flow base, alert, PDF economico, pacchetto fornitore, spese generali |
| 8 | Moduli contrattuali verso committente | 📋 | | Sospensioni, anticipazione 20%, penali, revisione prezzi art. 60, conto finale, comunicazioni formali, As Built + collaudo |
| 9 | Cantiere mobile + AI zero-input | 📋 | | `/api/ai-cantiere`, scanner universale PWA, centro approvazioni, AI proattiva base |
| 10 | Alert configurabili + centro notifiche | 📋 | | `regole_alert`, campanella, reminder scadenze |
| 11 | Cash flow previsionale | 📋 | | 18 mesi, saldo cumulato, export, pianificato vs consuntivo |
| 12 | FatturaPA + SDI | 📋 | | XML, intermediario, tracking, split payment, conservazione |
| 13 | Portale documenti sub | 📋 | | Estrazione AI, confronto checklist, notifiche, scadenzario |
| 14 | Sicurezza impresa avanzata | 📋 | | POS, DVR, riunioni, notifica preliminare, DURC congruità, statistiche infortuni |
| 15 | AI integrata | 📋 | | Assistant commessa, AI proattiva avanzata, NormaBot RAG, analisi bandi, price checker |
| 16 | Go to market | 📋 | | Landing, onboarding wizard, Stripe, Supabase/Vercel Pro; 79 €/mese early adopter, 149 €/mese standard |

## 6. Test checklist

> Fonte: `TEST_CHECKLIST.md` — aggiornata 31 ottobre 2026.
> Legenda: [ ] da testare | [OK] funziona | [ERR] errore | [PARZ] parziale
> Per ogni errore annotare: modulo, cosa hai fatto, cosa e successo.

### 6.0 Prima di iniziare
- Usare una commessa di test (non una reale)
- Reimportare l'XPWE sulla commessa di test (le misurazioni compaiono solo sui nuovi import)

### 6.1 Accesso
- [ ] Login admin@sq360.it
- [ ] Logout e ritorno al login
- [ ] Registrazione nuova azienda /register

### 6.2 Dashboard
- [ ] KPI caricano
- [ ] Alert DURC e scadenziario popolati
- [ ] Mappa cantieri senza errori

### 6.3 Gare
- [ ] Lista e nuova gara
- [ ] Checklist offerta e migliorie
- [ ] Simulatore ribasso
- [ ] Crea commessa da gara aggiudicata

### 6.4 Commesse
- [ ] Creazione commessa (wizard 3 step, codice automatico)
- [ ] Elimina commessa (doppia conferma)
- [ ] Navigazione gruppi: Contratto / Acquisti / Cantiere / Economico / Extra / Archivio

### 6.5 Contratto
**Anagrafica**
- [ ] Campi editabili, figure RUP/DL/CSE
- [ ] Toggle sicurezza interna
- [ ] Bottone Verbale consegna genera PDF
- [ ] WBS commessa: importa da template

**Elenco Prezzi**
- [ ] Tariffe caricate dal computo, filtri, analisi

**Computo**
- [ ] Import XPWE
- [ ] Righe misurazioni visibili e con dati
- [ ] Voci XPWE bloccate, voci manuali editabili
- [ ] Filtro WBS e categoria
- [ ] Selezione multipla e Ctrl+A
- [ ] Analisi prezzi BASE/EXTRA
- [ ] Voce da EP

**SAL Attivi**
- [ ] Nuovo SAL, griglia, residuo live
- [ ] Upload PDF DL e certificato RUP
- [ ] Genera fattura attiva

**SAL Passivi**
- [ ] Card sub, avanzamento, blocco se DURC scaduto

**Varianti / Ordini di Servizio**
- [ ] Workflow completo
- [ ] Variante esecutiva: le sue voci compaiono nel computo

**Nuovi Prezzi**
- [ ] Proposta -> negoziazione -> concordato
- [ ] PDF verbale
- [ ] Inserimento in Elenco Prezzi

**Riserve**
- [ ] Iscrizione, scadenza +30gg, alert <=7gg, cambio stato

### 6.6 Acquisti
**RDA**
- [ ] Creazione da computo, WBS propagata, badge "WBS mancante"

**RDO**
- [ ] Wizard multi-fornitore, pagina pubblica /offerta/[token]
- [ ] Comparativa e aggiudica
- [ ] Upload preventivo con AI
- [ ] PDF RDO

**SAM / ODA**
- [ ] Flusso RDO -> SAM -> ODA, 6 tipi ODA, PDF

**Contratti Sub**
- [ ] Creazione, checklist 7 documenti, lavoratori, pagamenti

### 6.7 Cantiere
- [ ] Giornale lavori
- [ ] Sicurezza: upload con AI
- [ ] Persone: QR badge, scanner, presenze
- [ ] DDT: upload foto con AI

### 6.8 Economico
- [ ] Fatturazione e fatture passive (upload con AI)
- [ ] Conto economico (per tipo ODA, per WBS)
- [ ] Marginalita

### 6.9 Impostazioni
- [ ] Dati azienda (si chiude dopo salvataggio)
- [ ] Logo e carta intestata
- [ ] Template WBS
- [ ] Gestione utenti, invito email, permessi moduli
- [ ] Un utente con modulo disattivato non apre la pagina via URL

### 6.10 Contatti
- [ ] Nuovo contatto compare in lista (anche tipo "altro")
- [ ] Import AI da PDF
- [ ] Banner scadenze e filtri
- [ ] Drawer a 5 tab

### 6.11 PWA
- [ ] Banner installazione
- [ ] App installabile su telefono

### Bug trovati
(data - modulo - descrizione)
-

---

## Changelog MASTER
| Data | Commit | Modifica |
|---|---|---|
| 2026-10-31 | — | Creazione iniziale da CLAUDE.md + DEPLOY.md + struttura codice |
| 2026-10-31 | `ebc47e1` | Completate sezione 5 (stato 16 prompt da `sq360-prompts.md`) e sezione 6 (test checklist da `TEST_CHECKLIST.md`); aggiunti i due file al repo |
| 2026-10-31 | `7ee7dff` | Rimossa nota "file non presenti nel repo"; aggiunta riga changelog per `ebc47e1` |
| 2026-10-31 | `18e1550` | Fix import misurazioni XPWE (parser `PweVCMisure/RGItem`, schema reale tabella, formule, deduzioni, vedi voce, errore bloccante su INSERT); computo e SAL Attivi mostrano la descrizione della riga invece della categoria |
| 2026-10-31 | `d3ece43` | Fix build Vercel: committata `getCurrentUserModuli()` in `src/lib/supabase.ts` (usata da Sidebar e layout commessa, era rimasta fuori dai commit); rimosso il relativo debito tecnico |
| 2026-10-31 | `e03ee42` | `/api/xpwe-parse` e `/api/xpwe-parse-sal` con client Supabase sul token dell'utente (`getUserClient`, 401 se token mancante/scaduto) — risolve l'INSERT misurazioni bloccato dalle RLS e toglie la service role da xpwe-parse-sal; pagine Computo e SAL Attivi inviano il Bearer token; reimport con cancellazioni verificate prima degli insert (niente duplicati) |
| 2026-10-31 | `aba8858` | Smoke test Playwright in sola lettura (`scripts/smoke-test.mjs`, `playwright` devDependency, output esclusi da git); esito in §4.3 |
| 2026-10-31 | `0bd18e8` | Migrazione `20261031_allineamento_schema.sql` (eseguita) + allineamento codice: crash `/dashboard/sal` (stati minuscoli), `/register` su route server `/api/register`, carta intestata da `azienda`, WBS senza fallback legacy e senza scrittura automatica in Impostazioni, CE da `sal`, alias colonne (ODA/DDT/fatture/gare/varianti/SAL passivi/documenti), verifica righe aggiornate su `azienda` |
| 2026-10-31 | `51d26cd` | Smoke test: login robusto all'idratazione React; esito dopo le correzioni 44/44 ok (§4.3) |
| 2026-10-31 | `ba5aa25` | Flusso inviti e password: nuova pagina `/auth/conferma` (invito + recupero, link scaduto), `/api/invite-user` con token del chiamante e azienda dal suo profilo + controllo upsert, "Password dimenticata?" nel login, stop a `NEXT_PUBLIC_APP_URL`; DEPLOY.md con le Redirect URLs Supabase |
| 2026-10-31 | `c958331` | Sicurezza passo 1 eseguito (REVOKE su anon; restano leggibili senza login `utenti` e `voci_computo`); smoke test: lettura testo senza timeout sulle pagine grandi e senza falsi errori dai dati RSC, attesa della rete dopo il login; esito 44/44 ok dopo il passo 1 |
| 2026-10-31 | `676ffef` | Sicurezza passo 3: `/offerta` e `/scan` su route server legate al token; `/api/email` con token, mittente fisso e solo modelli server (RDO: messaggio aggiuntivo in testo semplice, niente HTML/allegati dal client); 11 route AI con token + pagine aggiornate; cron DURC chiuso senza `CRON_SECRET`; REVOKE finale su anon in attesa (§4.1) |
| 2026-10-31 | `4e66fbd` | Gemini: `gemini-2.0-flash` (spento) e `gemini-1.5-flash` sostituiti da `src/lib/gemini.ts` (GEMINI_MODEL, predefinito `gemini-3.8-flash`, riserva `gemini-3.6-flash`, timeout, messaggi chiari) in ai-ddt, ai-fattura, ai-sicurezza, ai-estrai, rdo-extract-offerta; pagine mostrano `errore`/`error` leggibili; DEPLOY.md con le nuove variabili |
| 2026-10-31 | `4fc31c2` | Scritture verificate: helper `src/lib/scritture.ts`, script `scripts/check-scritture.mjs`; DDT salva davvero (errore mostrato, modulo aperto); helper su fatture passive, sicurezza, SAM, documenti, RDA, RDO, SAL, varianti, ODA, gare; correzioni colonne ovvie (rdo senza `wbs_id`, `lavoratori_sub.codice_fiscale/patente_crediti`, `ordini_servizio.descrizione`, `computo_metrico.note`) |
| 2026-10-31 | `db5a284` | Migrazione `20261031b_allineamento_salvataggi.sql` (eseguita); SAM su stati testo canonici (`statiSam.ts`, pagina globale e commessa allineate); giornale lavori, documenti/pagamenti subappalto, fatture attive adeguati alle colonne reali senza perdere funzioni; scritture verificate su queste pagine; check-scritture a 0 problemi |
| 2026-10-31 | `f007deb` | Commesse archiviate al posto dell'eliminazione: layout "Archivia commessa" (conferma esplicativa, errore visibile, badge se archiviata), lista con filtro "Archiviate" + "Ripristina", dashboard e mappa filtrate (KPI, ODA, fatture, DDT, documenti, contratti sub, scadenze, v_commesse_kpi) con `src/lib/commesse.ts` |
| 2026-10-31 | `465141e` | Persone: salvataggio lavoratore, presenza manuale e disattivazione verificati (modulo aperto, "⚠ … non salvato/registrata: motivo", avvisi 7 s); scanner presenze: entrata/uscita verificate e coda offline che non perde più le presenze rifiutate dal DB |
| 2026-10-31 | `69d242e` | Giornale lavori: direttore di cantiere nella nuova colonna `direttore_cantiere`, `redatto_da` = uuid dell'utente collegato (prima un nome finiva in una colonna uuid); `check-scritture.mjs` controlla anche i tipi (0 errori, 0 avvisi; 2 falsi positivi annotati); registrata l'esecuzione delle regole 20261031c |
| 2026-11-01 | `5524acd` | Ambiente di prova passo 2: script `tests/ambiente-prova/` (dump schema in sola lettura, ricostruzione sulla prova con reset, confronto catalogo 0 differenze, blocchi prova≠produzione); rilevati e documentati in §4.4 i buchi di isolamento tra aziende (22 tabelle senza RLS, 21 regole `USING true`); stato in §1.1 |
| 2026-11-01 | `262338e` | Passo 3 ambiente di prova: seed A/B (`tests/seed/`), test di isolamento verificato su DB con report `tests/report/ISOLAMENTO.md`, ciclo `npm run test:isolamento`, smoke test sulla prova; migrazione `20261101_isolamento_aziende.sql` generata e applicata SOLO alla prova (prima 39 tabelle + 7 viste esposte → dopo 0, funzioni legittime ok) — da rivedere per la produzione; `pg` devDependency; trovato bug trigger `varianti`; §1.1, §4.1, §4.4 aggiornati |
| 2026-11-01 | `d3f5b00` | Migrazione isolamento divisa in `20261101_0_verifica_preliminare.sql` / `_1_applica.sql` (+ query di controllo commentate) / `_2_ritorno_indietro.sql` con `tests/isolamento/dividi-migrazione.mjs` (aggiunto al ciclo); corretto l'ordine del `DROP FUNCTION sono_admin()` nel ritorno indietro; ciclo 0→1→2→1 provato solo sulla prova (ritorno = produzione, 0 differenze); backup locale dei soli dati di produzione `backup-schema-produzione/2026-11-01/dati-prima-isolamento.dump` (escluso da git) |
| 2026-11-01 | `c4b42ab` | Passo 4: test e2e Playwright `tests/e2e/` (catena acquisti RDA→RDO→aggiudicazione→ODA→DDT→fattura passiva→CE, SAL attivi/passivi con DURC, persone + QR, giornale, invito, archiviazione) con verifica su DB, AI simulata per intercettazione, comando `npm run test:piattaforma`, report `tests/report/RISULTATI.md`; Playwright 1.64.1; esito 11 ✅ 7 ❌ 1 ⏭ — bug annotati in §4.4, non corretti |
| 2026-11-01 | `1e6a1ad` | Passo 5: codice adattato ai vincoli del DB — offerte RDO `ricevuta` (route pubblica + preventivo con scritturaVerificata e messaggio), creazione/revisione ODA `bozza`, fattura attiva `attiva` (scrittura + filtro lista), invito con pulsante disabilitato finché i dati non sono pronti ed esito sempre mostrato; lettori dei vecchi valori aggiornati; test e2e: controlli WBS e fattura↔SAL separati (1.11, 2.5); esito e2e 16/21 ✅ 4 ❌ 1 ⏭, isolamento invariato (dopo: 0 fughe, funzioni legittime ok) |
| 2026-11-01 | `0ad3ce8` | Migrazione di isolamento `20261101_1_applica.sql` eseguita in produzione dall'utente (SQL Editor, dopo verifica preliminare e backup dei dati); controlli post-applicazione ok (RLS spenta: nessuna; regole aperte: solo categorie_* e wbs_template_lettura); smoke test produzione 44/44; §1.1, §4.1, §4.4 aggiornati; aggiunti i residui da pulire (commessa e6c108d7, 16 wbs_nodi senza commessa) |
| 2026-11-01 | `518ecff` | Passo 6: aggiudicazione RDO `accettata`/`rifiutata`, annullamento RDO `annullata`; stati ODA `firmato`/`in_esecuzione`/`completato`/`annullato`; migrazione `20261101_3_stati_annullati.sql` (solo prova, da eseguire in produzione dopo revisione); etichette, colori e filtri aggiornati (RDO, RDA, ODA, CE, marginalità, DDT, fatture, dashboard, PDF, FlowThread); nuovi test 1.12 (stati ODA) e 1.13 (RDO annullata); e2e 19/23 ✅ 3 ❌ 1 ⏭, isolamento invariato |
| 2026-11-01 | (questo commit) | Migrazione `20261101_3_stati_annullati.sql` eseguita in produzione dall'utente (rdo_stato_check + annullata, oda_stato_check + annullato); deploy `518ecff` pubblicato; smoke test produzione 44/44, 0 rotte; §4.1 aggiornato |
