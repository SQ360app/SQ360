# SQ360 — Contesto progetto

## Stack
- Next.js 15, Supabase, Vercel
- AI: Gemini 2.0 Flash (GEMINI_API_KEY server-side)
- GitHub: github.com/SQ360app/SQ360

## Strategia prodotto
- Piattaforma gestionale edile italiana per TUTTE le imprese (piccole, medie, grandi)
- Stessa piattaforma per lavori privati e appalti pubblici (switch tipo commessa)
- Differenziatore: profondità appalti pubblici + AI edile specializzata + badge cantiere
- Concorrenti: Pillar (finanza+WhatsApp), TeamSystem (enterprise costoso), Brix IT (solo procurement)
- Pricing: un piano per numero utenti, commesse ILLIMITATE in tutti i piani

## Bug aperti / pendenti
*(nessun bug critico aperto — piattaforma multi-tenant completamente sicura)*

## Fix e feature completati

### Sessione 2025-05-14 — parti 1-3 (commit 527a0f4 → 25c22f7)
- ✅ rda/rdo/oda/computo: fix tabelle, WBS, VociRdaSection, flusso RDA→RDO→ODA completo
- ✅ Flusso RDO→DAM: pulsante Aggiudica, Crea DAM, prefill da URL params
- ✅ DDT + Fatture passive con AI Gemini Vision
- ✅ Conto economico: doppio margine atteso/attuale, fix query voci_computo
- ✅ Marginalità per WBS: costruito da zero con join ODA→RDO→RDA→wbs_id

### Sessione 2025-05-14 — parte 4 (commit 39ef6c3 → cd1e40c)
- ✅ rda/page.tsx: rimossi campi inesistenti (oggetto, tipo, rda_ids) dall'insert rdo (commit e4f8ec9)
- ✅ CLAUDE.md aggiornato sessione parte 3 (commit 39ef6c3)
- ✅ Multi-tenant Fase 1 — codice: filtri `azienda_id` aggiunti a commesse/gare/contratti/dam SELECT; fix bug `aziende.select().single()` → `getAziendaId()`; fix `azienda_id: null` hardcoded in dam (commit cd1e40c)

### Sessione 2026-05-14 — parti 6-9 (commit a6abf68 → 5e01c3b)

#### Modulo Persone in cantiere (a6abf68 → 94d1004)
- ✅ persone/page.tsx: lista lavoratori con KPI, stato DURC/formazione/patente (verde/arancio/rosso), QR badge modal, registro presenze manuale, report settimanale, dashboard mattino (presenti/assenti/irregolari), CRUD lavoratore, pulsante "Scansiona QR"
- ✅ persone/scan/page.tsx: PWA scanner QR con jsQR — fotocamera posteriore, mirino, torcia, bottoni ENTRATA/USCITA grandi, coda offline localStorage con sync automatica
- ✅ scan/[token]/page.tsx: pagina pubblica (no login) — stato documenti + pulsanti ENTRATA/USCITA dal QR badge
- ✅ jsqr@1.4.0 installato

#### Registrazione multi-azienda (cac4d3e)
- ✅ /register: wizard 2 step — Passo 1 (azienda: nome, P.IVA, CF, provincia) + Passo 2 (admin: nome, cognome, email, password)
- ✅ Sequenza: auth.signUp() → insert aziende → insert utenti (ruolo admin)
- ✅ Recovery orfano: se insert DB fallisce dopo signUp, bottone "Riprova collegamento"
- ✅ Schermata "Controlla email" + link login↔register
- ✅ login/page.tsx: aggiunto link "Registra la tua azienda"

#### Fix contratti/assegnazione (11d57cf)
- ✅ contratti/page.tsx:31: join `fornitore:fornitori` → `fornitore:professionisti_fornitori`
- ✅ assegnazione/page.tsx:112: `from('fornitori')` → `from('professionisti_fornitori')`

#### Fix multi-tenant INSERT + doppio DAM (5e01c3b)
- ✅ `azienda_id` aggiunto a tutti gli INSERT mancanti: rda (×2), rdo (×2), oda, contratti_sub, dam, giornale_lavori, ddt, fatture_passive (×2), fatture
- ✅ Fix doppio DAM: oda/handleSave ora controlla se esiste già un DAM con lo stesso rdo_id prima di crearne uno
- ✅ fatturazione/page.tsx: `fornitori` → `professionisti_fornitori` nel join fatture_passive e nel dropdown fornitori

#### RLS completo multi-tenant (sessione 2026-05-14 serata)
- ✅ RLS attivato su Supabase per tutte le tabelle figlie: `rda`, `rdo`, `oda`, `ddt`, `fatture_passive`, `giornale_lavori`, `contratti_sub`
- ✅ Piattaforma multi-tenant completamente sicura: isolamento dati per azienda garantito a livello DB
- ✅ Schema DB verificato: tutte le colonne `azienda_id` presenti, tabelle `lavoratori_commessa` e `presenze_cantiere` operative

### Sessione 2025-05-14 — parte 5 (commit 865aea8 → f3d3c7d)
- ✅ Multi-tenant Fase 2 SQL: template RLS pronto con `get_azienda_id()` helper function (da eseguire su Supabase)
- ✅ /api/ai-sicurezza/route.ts: Gemini Vision — riconosce 24 tipologie di documenti sicurezza edile (commit 865aea8)
- ✅ sicurezza/page.tsx: modulo completo — KPI, alert banner scadenze, tabella colori live, AI upload, CRUD, preview stato nel form (commit 865aea8)
- ✅ layout.tsx: tab "Sicurezza" aggiunto tra Cantiere e Spese (commit 865aea8)
- ✅ Fix TypeScript build Vercel: rimosso `TUTTI_TIPI` unused, rimosso `nullsFirst` non nel tipo, fix `Partial<DocSicurezza>` spread (commit f3d3c7d)

### Sessione 2026-05-15 — email notifiche + fix build (commit 042525c → 06745a6)
- ✅ PDF professionali ODA + DAM completati con @react-pdf/renderer (OdaDocument.tsx, DamDocument.tsx)
- ✅ Email notifiche con Resend — `resend@1.x` installato, `RESEND_API_KEY` configurato in produzione
- ✅ `/api/email/route.ts`: route generica `POST { to, subject, html }` → Resend
- ✅ `src/lib/emailTemplates.ts`: 5 template HTML (DURC scadenza, ODA creato, DAM approvato, Fattura scadenza, Report DURC settimanale)
- ✅ `/api/cron/durc/route.ts`: cron settimanale — scansiona DURC in scadenza ≤30gg e invia report agli admin per azienda
- ✅ `vercel.json`: cron ogni lunedì ore 8:00 → `/api/cron/durc`
- ✅ Trigger ODA: dopo salvataggio invia email "Nuovo ODA [codice]" all'utente corrente (fire-and-forget)
- ✅ Trigger DAM: aggiunti bottoni "Approva DL" / "Rifiuta" per stato INVIATO_DL; approvazione invia email con template
- ✅ Trigger Sicurezza: bottone "📧 Invia alert DURC" nel banner scadenze — invia report consolidato DURC
- ✅ Fix build Vercel: Supabase client e Resend client spostati dentro gli handler (non a livello modulo) — risolve "supabaseKey is required" durante build

### Sessione 2026-05-15 — FLUX layout commessa (commit 8f28183)
- ✅ `commesse/[id]/layout.tsx` riscritto con architettura a tre pannelli FLUX
- ✅ Striscia commessa 32px: breadcrumb, codice badge, nome, KPI inline (contratto/ODA/% speso), alert badge scadenze, stato badge, bottone ⌘K, bottone Elimina
- ✅ Pannello sinistro 220px: modulo attivo, navigazione raggruppata (CONTRATTO / ACQUISTI / CANTIERE / ECONOMICO), indicatore accent verticale, badge alert su Sicurezza
- ✅ Area principale: `{children}` senza padding wrapper — ogni modulo mantiene il proprio padding
- ✅ Pannello destro Intelligence 240px collassabile: KPI (contratto, ODA impegnati, margine, fatture), barra progresso spesa/budget, banner alert scadenze — stato persistito in localStorage (`sq360-right-panel`)
- ✅ Command palette ⌘K / Ctrl+K: filtro su tutti i 20 moduli, Enter naviga al primo, Escape chiude
- ✅ Mobile responsive <768px: pannelli laterali nascosti, bottombar 56px con 5 icone (Anagrafica, ODA, Cantiere, Sicurezza, CE)
- ✅ Palette colori dark: bg #07090f, pannelli #0c1020, striscia #0a0d18, accent #4f8ef7
- ✅ Mantenuti: caricamento commessa, modal elimina con doppia conferma, navigazione tutti i 20 moduli, breadcrumb ← Commesse
- ✅ KPI destro: 3 query in parallelo — ODA impegnati, fatture da pagare, alert scadenze ≤30gg

### Sessione 2026-05-15 — Archivio Commessa + Dashboard homepage (commit 6c4bfe6 → 706cf6b)

#### Archivio Commessa (6c4bfe6)
- ✅ `archivio/page.tsx`: 6 cartelle accordion (Contratto, Acquisti, Cantiere, Sicurezza Impresa, Subappaltatori, Economico)
- ✅ Checklist automatica per ogni subappaltatore (contratto firmato, DURC, SOA, DVR/POS, UNILAV+formazione) — stato completa/incompleta/critica
- ✅ Upload documenti per sub: record in `documenti_sicurezza` (soggetto_tipo='subappaltatore') + file opzionale in `documenti_commessa` (categoria='subappaltatore', note='sub:[nome]')
- ✅ Bottone "📦 Esporta tutto": genera ZIP via jszip con cartelle 01→06, file reali da Storage + riepilogo.txt per moduli senza allegati
- ✅ `layout.tsx`: tab "Archivio" aggiunto come ultimo tab
- ✅ `jszip` installato
- ✅ Fix TypeScript: cast `unknown` per join Supabase su `contratti_sub.fornitore` (restituisce array invece di oggetto)

#### Dashboard homepage (706cf6b)
- ✅ `dashboard/page.tsx` riscritto — rimossa mappa Leaflet/AI/rapportino, sostituito con KPI aggregati
- ✅ KPI riga 1: commesse attive, portafoglio totale, ODA questo mese, fatture da pagare (con importo)
- ✅ KPI riga 2 (alert): DURC ≤30gg, documenti scaduti, subappaltatori con checklist incompleta
- ✅ Lista commesse attive: barra spesa vs budget (verde/arancio/rosso), margine % calcolato da ODA, link diretto
- ✅ Scadenziario 30gg: doc sicurezza + fatture unificati e ordinati per data, giorni in evidenza
- ✅ Attività recente: ultimi 5 ODA, DDT, documenti — click naviga alla commessa
- ✅ 11 query Supabase in parallelo (Promise.all) — nessun waterfall
- ✅ Non usa più view SQL `v_commesse_kpi` / `v_scadenze_prossime` — query dirette alle tabelle base

### Sprint 2 — RDO avanzato (commit 85e4a86 → c5f719a)

#### RDO wizard multi-fornitore da RDA (85e4a86)
- ✅ Wizard RDO: da una RDA selezionata, genera N richieste d'offerta a N fornitori in un unico flusso
- ✅ `rdo_gruppo_id` condiviso tra tutte le RDO dello stesso gruppo gara

#### Pagina pubblica /offerta/[token] (6077dcc)
- ✅ `offerta/[token]/page.tsx`: pagina senza login per il fornitore — mostra dettaglio RDO e consente invio risposta
- ✅ Token univoco per accesso sicuro senza autenticazione

#### Comparativa automatica per gruppo gara (2d50554)
- ✅ Sezione "Comparativa gare" in `rdo/page.tsx`: raggruppa RDO per `rdo_gruppo_id`
- ✅ Intestazione: oggetto RDO, data scadenza, contatore offerte ricevute/inviate
- ✅ Tabella comparativa: colonna per fornitore — righe Importo offerta / Trasporto / **TOTALE** / Pagamento gg / Anticipo % / Disponibilità
- ✅ Sfondo verde + badge "▼ BEST" sulla cella TOTALE più bassa
- ✅ Pulsante "⭐ Aggiudica" per ogni fornitore → imposta `aggiudicata` + `annullata` sugli altri + redirect a DAM con rdo_id pre-compilato

#### Upload PDF preventivo + AI Gemini estrazione (c5f719a)
- ✅ Bottone "📎 Preventivo" per ogni RDO con stato `inviata`
- ✅ Modal upload PDF con drag-area → chiama `/api/rdo-extract-offerta`
- ✅ `/api/rdo-extract-offerta/route.ts`: Gemini 2.0 Flash Vision — estrae ragione_sociale, data, voci (um/qtà/PU/importo), importo_totale, condizioni_pagamento, note
- ✅ Tabella mapping voce RDA ↔ voce estratta con % somiglianza (verde >70%, arancio >40%)
- ✅ "✓ Conferma importazione" → salva `offerta_voci` (JSON), `importo_offerta`, `stato=risposta_ricevuta`, `data_risposta` sulla RDO

### Sprint 3 — SAL completo (commit ec2d897 → bb35092)

#### SAL Attivi — verso committente (ec2d897)
- ✅ `sal-attivi/page.tsx` riscritto — legge da tabella `sal` (nuova), scrive in `sal_voci`
- ✅ Lista SAL: N°, Codice, Data, Metodo, Certificato, Cumulativo, Netto, Ritenuta, Stato, bottone Fattura
- ✅ Workflow nuovo SAL in 2 step: **Form** (data, radio Manuale/XPWE, note) → **Griglia voci** o **Import XPWE**
- ✅ Griglia voci manuale: capitoli raggruppati, colonne Qtà contratto / Qtà SAL precedenti (SUM sal_voci) / input Qtà questo SAL / Qtà totale / % completamento / PU / Importo periodo
- ✅ Quadro economico live: Importo periodo / Cumulativo precedente / Cumulativo totale / Ritenuta 5% / Netto da pagare
- ✅ Bottone "📄 Genera fattura attiva" → redirect fatturazione con importo pre-compilato
- ✅ Import XPWE dalla DL: upload → `/api/xpwe-parse-sal` → preview match/non-match → conferma → salva `sal_voci`
- ✅ `/api/xpwe-parse-sal/route.ts`: parsing XPWE, match per codice tariffa su `voci_computo`, restituisce mapping con `voce_computo_id`
- ✅ Annulla SAL in bozza: elimina record `sal` + `sal_voci` collegati

#### SAL Passivi — verso subappaltatori (bb35092)
- ✅ `sal-passivi/page.tsx` riscritto — legge da `contratti_sub` JOIN `professionisti_fornitori` + tabella `sal_passivi`
- ✅ Card per ogni contratto sub attivo: nome fornitore, badge DURC (verde/rosso con giorni), barra avanzamento %, netto emesso
- ✅ Accordion con lista SAL per contratto: N°, Date, % avanzamento, Lordo periodo, Ritenuta, Netto, DURC, Stato, Azioni
- ✅ Modal nuovo SAL: slider + input % avanzamento (deduce già certificato dai SAL precedenti), ritenuta % (default 5%), calcolo live importo periodo
- ✅ Flusso stati: `ricevuto` → 🔍 Verifica → `in_verifica` → 🔒 Autorizza → `autorizzato` → € Pagato
- ✅ "Autorizza" bloccato se DURC non valido; DURC controllato su `professionisti_fornitori.durc_scadenza`
- ✅ Fix: `from('fornitori')` → `from('professionisti_fornitori')`, rimosso `useParams`, ora usa `use(p)` pattern

### Sprint 4 — Spacchettamento costi ODA + Piano costi voce (commit 7e7b78d → 14ddb73)

#### Tipi ODA aggiornati (7e7b78d)
- ✅ `TIPI_ODA` in `oda/page.tsx` aggiornato a 6 categorie: `materiali`, `nolo_freddo`, `nolo_caldo`, `subappalto`, `manodopera`, `servizio`
- ✅ Campo `tipo_oda` aggiunto all'INSERT (colonna separata per retrocompatibilità con `tipo`)
- ✅ Badge lista ODA con stile inline (hex color/bg), bottoni modal griglia 3 colonne con colore dinamico
- ✅ Condizioni handleSave aggiornate: `'SUBAPPALTO'`→`'subappalto'`, `'MATERIALE'`→`'materiali'`

#### CE breakdown per tipo ODA (7e7b78d)
- ✅ `TIPI_ODA_CE` definito in `conto-economico/page.tsx` (6 categorie con colori)
- ✅ Query ODA estesa con `tipo_oda`; calcolo `odaPerTipo` aggregato per categoria
- ✅ Card "Costi ODA per categoria": solo categorie con importo > 0, pallino colorato, % su totale ODA

#### Analisi prezzi per codice tariffa nel computo (4c6a212 → 9acfc35)
- ✅ `TIPI_ANALISI` (7 tipi: materiali, nolo_esterno, subappalto, manodopera_esterna/interna, mezzi_interni, utile_impresa) con flag `rda: true/false`
- ✅ Tabella `analisi_prezzi_tariffa`: analisi BASE condivisa per `codice_tariffa` — si propaga automaticamente a tutte le voci con lo stesso codice
- ✅ Tabella `analisi_extra_voce`: maggiorazioni EXTRA specifiche per singola `voce_computo_id`
- ✅ Pannello ANALISI PREZZI sotto riga SOMMANO quando voce selezionata:
  - **SEZIONE BASE**: collassata (pill read-only) o espansa (input €/um e % editabili su blur, con ricalcolo automatico); bottoni aggiungi tipo mancante
  - **SEZIONE EXTRA**: righe per-voce con tipo/descrizione/€/um; bottoni "+ [tipo]" per tutte le 7 categorie
  - Totale finale: subtotale base + extra + confronto P.U. (✅ Bilancia / ⚠ Scarto / ⛔ Supera)
- ✅ Banner propagazione automatica: "ℹ️ La base si applica automaticamente a N altre voci con codice [X]"
- ✅ Tooltip su input BASE: "Aggiorna tutte le voci con codice [X]" quando N > 0
- ✅ Copia analisi da altra tariffa: select + bottone sovrascrive la BASE del codice corrente
- ✅ Dot indicatori nella cella DESIGNAZIONE: pallini per tipo BASE + "+N" arancione per extra + totale €/um + ✅/⚠️
- ✅ Link "→ Analisi" se nessuna analisi presente
- ✅ `caricaDati`: 4 query in `Promise.all` (voci, rda, analisi_prezzi_tariffa, analisi_extra_voce)
- ✅ Generazione RDA intelligente: importo per tipo = SUM(qtà × base) + SUM(qtà × extra); modal con checkbox per scegliere quali RDA generare
- ✅ CE "Costi previsti per WBS": barra stacked colorata per tipo da analisi × quantità voci

#### Piano costi rimosso (9acfc35)
- ✅ Modulo `piano_costi_voce` e tutti i riferimenti rimossi da `computo/page.tsx`
- ✅ Funzionalità unificata in Analisi Prezzi BASE + EXTRA — approccio più preciso e condiviso per codice tariffa
- ⚠️ Tabella `piano_costi_voce` rimane in Supabase (dati storici) ma non è più usata dal frontend

### Fix analisi extra voce + layout pannello analisi (commit b7641fd → aee0ea2)
- ✅ `aggiungiExtra`: payload completo (`descrizione: ''`), error handling con toast, reload da DB dopo INSERT
- ✅ `eliminaExtra`: error handling con toast, reload da DB dopo DELETE
- ✅ Pannello analisi prezzi: layout unificato BASE e EXTRA (stesso pattern collapsed/expanded)
- ✅ Sezione EXTRA: stato `extraExpanded` keyed per `voce_computo_id`, bottone `✏️ Modifica` come BASE
- ✅ Rimosso vincolo 100% (Bilancia/Scarto/Supera) — sostituito con quadro economico reale
- ✅ Quadro economico per voce: Costo previsto / P.U. contratto / Margine €+% (per unità) + Costo totale / Ricavo / Margine atteso (per quantità totale)
- ✅ Colori margine: verde ≥15% / arancio 5-15% / rosso 0-5% / rosso scuro <0%
- ✅ Pulsanti `✓ Fatto` e `✕ Chiudi` nell'header del pannello analisi

### Sprint 5 — Varianti e Ordini di Servizio (già completi in codebase)
- ✅ `varianti/page.tsx` (454 righe): KPI, banner soglia D.Lgs.36/2023, lista accordion, workflow proposta→RUP→SA→esecutiva, voci variante, modal nuova variante con preview soglia
- ✅ `ordini-servizio/page.tsx` (367 righe): KPI, alert banner non firmati >5gg e riserve in scadenza, workflow firma/firma-con-riserva/chiudi, genera variante da OS

### Sprint 6 — Subappalti flusso completo (commit 41fa145)
- ✅ `contratti/page.tsx` riscritto (232 → 424 righe nette): fix `useParams` → `use(paramsPromise)`
- ✅ Modal creazione diretta contratto sub: fornitore, tipo (subappalto/subaffidamento/nolo_caldo), oggetto, importo con warning >40%, % subappalto, date, SOA, note
- ✅ Workflow sequenziale forzato: `bozza → attesa_autorizzazione → autorizzato → in_esecuzione → completato`; Sospendi sempre disponibile; compatibile con stati legacy uppercase via `STATI_ALIAS`
- ✅ "Avvia lavori" bloccato se documenti critici mancanti nella checklist
- ✅ Tab per contratto: Dettagli | Documenti | Lavoratori | Pagamenti
- ✅ **Tab Documenti** — checklist 7 documenti obbligatori: Contratto firmato, DURC (con scadenza), SOA (categoria+classifica), DVR, POS, Notifica SA, IBAN L.136/2010; upload su Storage Supabase `{azienda_id}/contratti-sub/{id}/{tipo}.pdf`; stato verde/rosso/arancio
- ✅ **Tab Lavoratori** — lista con nome/cognome/CF/crediti patente, alert scadenze UNILAV/idoneità/formazione, form inline aggiunta
- ✅ **Tab Pagamenti** — riepilogo pagato/ritenute/residuo, tabella SAL con ritenuta 5% auto, pulsante "Svincola ritenuta" (solo se completato)
- ✅ Nuove tabelle Supabase richieste: `documenti_contratto_sub`, `lavoratori_sub`, `pagamenti_sub`

### Sprint 7 — Elenco Prezzi + Navigazione a due livelli (commit 6072f67 → f55bab8)

#### Modulo Elenco Prezzi (6072f67)
- ✅ `elenco-prezzi/page.tsx`: popolazione automatica dal computo al mount (INSERT batch codici mancanti, fonte='prezzario')
- ✅ Banner sync "N tariffe sincronizzate" dopo ogni caricamento con nuove tariffe
- ✅ KPI 6 card: totale tariffe, da prezzario, prezzi nuovi, da variante, con analisi, senza analisi
- ✅ Filtri pill: Tutte / Da prezzario / Prezzi nuovi / Da variante / Con analisi / Senza analisi
- ✅ Tabella tariffe: Codice | Descrizione (2 righe con tooltip) | UM | P.U. | Fonte (badge colorati) | Analisi (✅/⚠️/○ con margine%) | Voci (count cliccabile)
- ✅ Accordion dettaglio tariffa:
  - **Dati tariffa**: tutti i campi editabili on-blur; campi fonte-specifici (prezzario: riferimento+anno; prezzo_nuovo: approvato_da+data; variante: select variante)
  - **Analisi del prezzo**: home canonica dell'analisi BASE — stessa interfaccia computo (collapsed/expanded, tabella editabile, copia da altra tariffa, quadro margine)
  - **Voci del computo**: lista mini con WBS/Descrizione/Quantità/Importo + totale per tariffa
- ✅ Modal nuovo prezzo: selezione fonte, codice/descrizione/um/PU, variante collegata, giustificazione
- ✅ Tab "Elenco Prezzi" aggiunto in layout.tsx prima di "Computo"

#### Navigazione commessa a due livelli (b5e5934)
- ✅ `layout.tsx` riscritto: sostituiti 20 tab flat con navigazione a 2 righe
- ✅ **RIGA 1** — 6 pill colorate: Contratto 📋 (blu) / Acquisti 🛒 (arancio) / Cantiere 🏗️ (verde) / Economico 💰 (viola) / Contrattuale ⚖️ (rosso) / Archivio 📁 (grigio)
- ✅ **RIGA 2** — sotto-tab del gruppo attivo con bordo inferiore nel colore gruppo; cambia automaticamente al cambio gruppo
- ✅ Rilevamento gruppo attivo da pathname (no state aggiuntivo); click gruppo non attivo → naviga al primo sotto-modulo
- ✅ Mantiene: breadcrumb, info commessa, bottone elimina, modal conferma, padding contenuto

#### Fix descrizione EP (89e2c0c → f55bab8)
- ✅ Cella descrizione tabella EP: `WebkitLineClamp: 2` per max 2 righe + `title` tooltip completo + `cursor: 'help'`

### Sprint 8 — Migliorie gare + commessa (commit 68319f5 → 2a3aebf)

#### Migliorie in Analisi Gare (68319f5)
- ✅ `gare/page.tsx` riscritto (369 → 575 righe): accordion dettaglio per ogni gara (click su riga)
- ✅ **Tab 1 Dati gara**: griglia 12 campi in visualizzazione, link bando, pulsante "🏆 Crea commessa" (solo se AGGIUDICATA e senza commessa_id) → INSERT commesse + UPDATE gare.commessa_id + UPDATE migliorie.commessa_id (offerta=true) + redirect
- ✅ **Tab 2 Checklist offerta**: 8 voci con checkbox (Domanda, DGUE, Offerta economica, Offerta tecnica, Cauzione 2%, PassOE ANAC, Antimafia, Riferimenti bancari), barra progresso, badge "CRITICO" per voci obbligatorie; persistito in `localStorage('checklist-{gara_id}')`; badge "N/8 docs" visibile nella riga collassata
- ✅ **Tab 3 Migliorie proposte**: KPI 3 card (valutate/offerte/costo), lista migliorie con badge categoria (Tecnica/Temporale/Qualitativa/Ambientale/Sociale), toggle "★ Offri", form inline (categoria/descrizione/costo/punti), badge "★ N migliorie" nella riga collassata
- ✅ **Simulatore margine offerta**: ribasso % input → calcolo importo offerta / detrazione costo migliorie offerte / margine % colorato (verde ≥15% / arancio 5-15% / rosso <5%) + punteggio tecnico stimato
- ✅ Tabella `migliorie` in Supabase: `gara_id`, `commessa_id`, `categoria`, `descrizione`, `costo_stimato`, `costo_effettivo`, `punteggio_tecnico_stimato`, `note`, `offerta` (bool), `fase` ('gara'|'commessa'), `stato`

#### Migliorie nella commessa (2a3aebf)
- ✅ `migliorie/page.tsx` (nuovo, 250 righe): carica migliorie dirette (`commessa_id = id`) + ereditate da gara aggiudicata (`gara.commessa_id = id, offerta = true, commessa_id IS NULL`), badge "Ereditata da gara"
- ✅ Banner impatto CE fisso: "Costo stimato non remunerato: €X · Impatto su margine: −Y%"
- ✅ KPI 5 card: migliorie totali, costo stimato, costo effettivo, completate, in esecuzione
- ✅ Workflow stati: `contrattuale → da_eseguire → in_esecuzione → completata → verificata_dl`; bottoni sequenziali, alert "In attesa verifica DL" sullo stato completata
- ✅ Costo effettivo editabile on-blur con alert scarto vs stimato (rosso se supera)
- ✅ Riepilogo impatto CE in fondo: costi stimati / effettivi / incidenza %
- ✅ Form inline per aggiungere migliorie direttamente sulla commessa (fase='commessa', stato='contrattuale')
- ✅ Tab "Migliorie" aggiunto nel gruppo Contrattuale ⚖️ del layout a due livelli

### Rename DAM → SAM (commit 9f407cb)
- ✅ Label "DAM" → "SAM" (Scheda Approvazione Materiali) in: layout commessa, titolo pagina, lista archivio, PDF, report, impostazioni
- ✅ URL `/dam`, variabili e tabella DB rimasti invariati

### SAL Attivi — migliorato (commit 46b4903)
- ✅ `sal_voci` INSERT semplificato: salva solo `sal_id`, `voce_computo_id`, `quantita_periodo`, `wbs_id`; rimossi campi snapshot ridondanti (codice, descrizione, um, quantita_contratto, prezzo_unitario, importo_periodo) — JOIN su `voci_computo` garantisce dati sempre aggiornati
- ✅ `salvaVoci()`: DELETE+INSERT per idempotenza — funziona correttamente anche su riapertura bozza
- ✅ Colonna **Residuo live** nella griglia: `quantità_contratto − precedente − corrente`; verde se >0, rosso se <0 (supera contratto), ✓ grigio se =0; si aggiorna mentre si digita
- ✅ Voci da **varianti esecutive** in griglia SAL: `caricaVociGrid` carica `voci_variante` JOIN `varianti(stato='esecutiva')`, filtro client-side; sezioni variante con header blu `#1e3a5f`; voci `soppressione` in grigio barrato con input disabilitato
- ✅ Upload **PDF DL** nel form creazione SAL (opzionale) → Storage `documenti/{azienda_id}/sal/{commessa_id}/SAL-N-DL.pdf`; URL salvato in `sal.pdf_dl_url`
- ✅ **Carica Certificato RUP**: bottone 📎 Cert. per SAL in stato `emesso` → Storage `documenti/{azienda_id}/sal/{commessa_id}/SAL-N-certificato.pdf`; URL in `sal.pdf_certificato_url`
- ✅ Lista SAL: link 📄 PDF DL, link 📋 Cert. RUP se presenti; bottone ✏️ Modifica per SAL in bozza
- ✅ **Riapertura SAL in bozza**: `riaperturaBozza()` esclude il SAL corrente dal `qtPrecedente` e pre-popola `qtInput` dai `sal_voci` esistenti
- ✅ `cumulPrec` esclude sempre il SAL corrente — corretto sia per creazione che per riapertura bozza
- ⚠️ **SQL da eseguire su Supabase**: `ALTER TABLE sal ADD COLUMN IF NOT EXISTS pdf_dl_url text; ALTER TABLE sal ADD COLUMN IF NOT EXISTS pdf_certificato_url text;`

### PDF professionali SAL, OS, Contratto Sub (commit 28e367b)
- ✅ `src/components/pdf/SalDocument.tsx`: PDF SAL con header `#1e3a5f`, quadro economico (NETTO in verde), tabella voci alternata, firme DL/Impresa
- ✅ `src/components/pdf/OsDocument.tsx`: PDF Ordine di Servizio con bordo blu sinistra per oggetto, box riserva rosso se presente
- ✅ `src/components/pdf/ContrattoSubDocument.tsx`: PDF Contratto Sub con sezione Le Parti, condizioni economiche, tabella lavoratori, nota legale D.Lgs. 36/2023
- ✅ Pulsanti "📄 PDF" aggiunti in `ordini-servizio/page.tsx` e `contratti/page.tsx`

### SalGrid — griglia inserimento SAL (commit b87ed7f)
- ✅ `sal-attivi/SalGrid.tsx`: copia meccanica di `computo/page.tsx` con `cp` (1541 righe, ±54 righe rispetto all'originale)
- ✅ Solo 3 differenze rispetto al computo originale:
  1. **Colonne FLUSSO** (RDA/RDO/ODA/SAL%) → colonne SAL dinamiche (N.1…Cumul./Questo SAL input/Residuo)
  2. **Pannello analisi prezzi** → box blu con Contratto/Cumulativo/Questo SAL/Residuo (read-only)
  3. **Toolbar** XPWE/RDA → `📎 PDF DL | ✕ Annulla | 💾 Salva SAL`
- ✅ Dipendenza live: legge sempre da `voci_computo` + `voci_variante` (stato=esecutiva) al mount — mai da snapshot; le varianti appaiono automaticamente
- ✅ `sal-attivi/page.tsx`: usa `SalGrid` quando `fase === 'voci'`; `qtInput` cambiato da `Record<string,string>` a `Record<string,number>`
- ✅ `SalGridProps`: `commessaId`, `salId`, `salNumero`, `salPrecedenti`, `qtPerSal`, `qtCumulative`, `qtInput`, `onQtChange`, `onSalva`, `onAnnulla`, `pdfDlUrl`, `onUploadPdf`, `saving`
- ✅ Pannello analisi originale mantenuto come `{false && (() => {...})()}` — TypeScript-safe, mai renderizzato

### Mappa cantieri dashboard (commit c731b7b → f2c28ec)
- ⚠️ **Implementata ma non verificata visivamente** — griglia card 3 colonne, immagini statiche `staticmap.openstreetmap.de`, geocodifica Nominatim con salvataggio coordinate nel DB
- ⚠️ **Possibile causa mancata visualizzazione**: tabella `commesse` non ha colonne `lat`, `lng`, `indirizzo_cantiere`, `comune_cantiere`, `cap_cantiere`, `provincia` — verificare schema DB

### Sessione 2026-05-21 — PDF carta intestata + sicurezza interna + perf + PWA + build fixes

#### Carta intestata azienda nei PDF (commit a9513f1)
- ✅ `impostazioni/page.tsx`: nuova card "Documenti azienda" — upload logo (L1: PNG/SVG, max 2MB) + carta intestata header+footer (L2: PNG 794px), anteprima live, salva in tabella `aziende`
- ✅ 5 componenti PDF aggiornati (OdaDocument, SalDocument, OsDocument, DamDocument, ContrattoSubDocument):
  - Prop `aziendaDoc?: { logo_url, carta_intestata_header_url, carta_intestata_footer_url }`
  - Priorità: carta intestata > logo > testo SQ360; CIG/CUP sempre visibili sotto header immagine
- ✅ Callers (oda, ordini-servizio, dam, contratti): caricano `aziendaDoc` da Supabase al mount
- ✅ Migration: `20260526_aziende_documenti.sql` — `ALTER TABLE aziende ADD COLUMN IF NOT EXISTS logo_url text, carta_intestata_header_url text, carta_intestata_footer_url text`
- ✅ Storage bucket: `aziende-assets` (da creare su Supabase con accesso pubblico)

#### Sicurezza interna alle voci — formula 3 livelli (commit e8afd6a)
- ✅ Migration `20260527_sic_interna_voci.sql`: `sic_interna_importo numeric`, `sic_interna_percentuale numeric` su `voci_computo`; `sicurezza_interna_esclusa_ribasso boolean DEFAULT true` su `commesse`
- ✅ XPWE parser (`xpwe-parse/route.ts`): salva `IncSIC` come `sic_interna_importo = incSic/100 × PU` e `sic_interna_percentuale` nelle voci
- ✅ Computo: badge 🛡️ accanto al PU per voci con `sic_interna_importo > 0`, tooltip con importo e %
- ✅ Anagrafica commessa: toggle "🔒 Non ribassabile / ✓ Soggetta a ribasso" per sicurezza interna
- ✅ SAL (`calcolaImportoSAL`): formula 3 livelli — `quotaLavori = (PU - sicImporto) × (1 - ribasso%) × q` + `quotaSicurezza = sicImporto × q`
- ✅ SAL pannello dettaglio voce: breakdown "Lavori: €X | 🛡️ Sicurezza: €Y" quando sicInternaEsclusa=true

#### Performance (commit 01a4798)
- ✅ `@tanstack/react-virtual` installato — virtualizzazione tabella computo
- ✅ `computo/page.tsx`: `useVirtualizer` con padding-top/bottom su `cmp-tscroll`; overscan:15; ~1000 row entries → render solo ~40 visibili
- ✅ ODA: limit 50 + "Carica altri ODA" (append, `.range(pagina*50, (pagina+1)*50-1)`)
- ✅ DDT: limit 50 + "Carica altri DDT"
- ✅ Fatture passive: limit 50 + "Carica altre fatture passive"
- ✅ react-pdf già lazy (dynamic import in click handler); recharts non usato

#### PWA installabile (commit 04a818e)
- ✅ `public/sw.js`: service worker minimo statico committato in git — NetworkFirst navigazione, pass-through per Supabase e `/api/*`
- ✅ `src/components/ServiceWorkerRegistration.tsx`: client component con `navigator.serviceWorker.register('/sw.js')` nel layout
- ✅ `src/components/PWAInstallBanner.tsx`: banner fisso bottom-center — compare solo se `beforeinstallprompt` e non già standalone; pulsante Installa + ✕ (persistito in localStorage)
- ✅ `public/manifest.json`: `display: standalone`, start_url `/dashboard`, shortcuts Commesse+Gare
- ✅ `src/app/api/pwa-icon/[size]/route.tsx`: Edge route che genera PNG 192/512 con `ImageResponse` (logo SQ360 gradient blu)
- ✅ `src/app/layout.tsx`: metadata PWA completo (manifest, appleWebApp, themeColor via viewport)
- ✅ `.gitignore`: aggiornato per escludere workbox-*.js ma NON sw.js (manuale)

#### Fix layout computo (commit 2bd3f00)
- ✅ CSS `V3_CSS` in `computo/page.tsx`: `.cmp-main` aggiunto `min-height:0`; `.cmp-tscroll` aggiunto `width:100%;min-width:0;min-height:0` — stesso fix del SAL

#### Fix TypeScript sistemico per build Vercel (commit 46dbb66 → e06dd6d)
- ✅ `src/lib/supabase.ts`: `export const supabase = getSupabase() as any` — propaga `any` a tutti i 40+ file che importano il singleton; risolve TS2769 "never" su tabelle senza tipi generati
- ✅ `xpwe-parse/route.ts`: `const db = supabase as any` — pattern pulito per tutti i `.from()` della route
- ✅ `xpwe-parse-sal/route.ts`: `const db = supabaseClient as any`
- ✅ `cron/durc/route.ts`: `createClient(...) as any`
- ✅ `documenti/page.tsx`, `fornitori/page.tsx`: import `supabase` mancante aggiunto
- ✅ `preventivo/page.tsx`: `const firstCap = caps[0]; if (firstCap) setExpandedCap({ [firstCap as string]: true })` — fix computed property key

### Sessione 23 Maggio 2026

#### Fix layout e computo
- ✅ Layout computo definitivo: rimosso virtualizer, render diretto come SAL Attivi
- ✅ Filtro categoria/WBS corretto: `vociFiltrate` con `v.categoria` per figlio, `v.capitolo` per padre
- ✅ Sort `vociFiltrate` prima di `tableRows` per evitare chiavi duplicate
- ✅ SAL Attivi colonne stabili: rimosso filter `salSel` dal colgroup
- ✅ Righe `mi` visibili: background `#f0fdf4`, padding, bordo puntinato, font `#374151` 11px

#### UX Selezione computo
- ✅ Click riga → seleziona (multiSel), click tariffa → apre pannello analisi (setSel)
- ✅ Ctrl+A rispetta filtro attivo (seleziona solo `tableRows` visibili filtrati)
- ✅ Barra azioni contestuale layout-safe: sempre nel DOM, `height:0/overflow:hidden` quando vuota
- ✅ Checkbox header (select-all) + checkbox per-riga nel tbody
- ✅ Colonna checkbox separata (28px) dal Nr — fix rowSpan che comprimeva righe `mi`
- ✅ Stessa UX replicata in `sal-attivi/page.tsx` con "📥 Imposta qtà SAL" batch

#### Flusso acquisti
- ✅ Tipo affidamento RDO: 8 tipi con rilevamento automatico subappalto (soglie D.Lgs. 36/2023 art.119)
- ✅ SAM (Scheda Approvazione Materiali) opzionale con toggle per commessa
- ✅ Flusso RDO→SAM→ODA sequenziale forzato
- ✅ Checklist compliance per tipo fornitore
- ✅ Stati automatici RDA/RDO/SAM/ODA
- ✅ Revisioni documentali con codice -R1/-R2
- ✅ WBS su RDA/ODA extra-computo

#### Sistema email
- ✅ Template centralizzato in `emailTemplates.ts`
- ✅ `EmailPreviewModal` riutilizzabile
- ✅ Log comunicazioni `email_log`
- ✅ Tab 📧 Email per commessa
- ✅ Configurazione email per area aziendale

#### Database e Supabase
- ✅ View `v_commesse_kpi` con `responsabile_nome`
- ✅ Tabella `azienda_sedi` per multi-sede
- ✅ Tabella `email_log` con RLS
- ✅ Function `genera_codice_documento()`
- ✅ Campi revisioni su `rda`/`rdo`/`dam`/`oda`/`contratti_sub`
- ✅ Flusso acquisti: `tipo_affidamento`, `compliance_ok`, `dam_id` su `oda`
- ✅ Codici univoci MAX+1 con constraint `UNIQUE(commessa_id, azienda_id, codice)`

#### Mappa cantieri
- ✅ Pin sedi azienda per tipo
- ✅ Figure commessa in mappa (click cantiere)
- ✅ Fornitori nel raggio (25/50/100km)
- ✅ Geocoding retroattivo Photon+Nominatim
- ✅ `fitBounds` su sedi+cantieri

#### Contatti v2
- ✅ 38 campi professionali
- ✅ 5 tab: Anagrafica / Professione / Qualificazioni / Commesse / Note
- ✅ Alert scadenze DURC/polizza/Inarcassa

#### Codifica commesse
- ✅ Formato `[AA]-[SA]-[PR]-[SOA]-[NNN]`
- ✅ 17 codici stazione appaltante
- ✅ Generatore automatico con RPC Supabase

### Sessione 28 Maggio 2026 — RDO PDF + Verbale Consegna Lavori (commit 236395b)
- ✅ `RdoDocument.tsx`: già presente e completo — carta intestata, CIG/CUP, voci RDA, QR portale offerte, spazio firma fornitore
- ✅ `rdo/page.tsx`: `generaPdf()` + pulsante `📄 PDF` già presenti con import dinamico `@react-pdf/renderer`
- ✅ `VerbaleConsegnaDocument.tsx` (nuovo): PDF "VERBALE DI CONSEGNA LAVORI" ai sensi D.Lgs.36/2023 art.114 + D.M.49/2018 art.5 — dati opera, figure presenti (RUP/DL/CSE/Capocantiere/RSPP), dichiarazione consegna, nota normativa, note libere, 4 spazi firma
- ✅ `anagrafica/page.tsx`: aggiunto `aziendaDoc` state + loader da `aziende`; `generaVerbale()` che raccoglie figure dalla state e genera il PDF; pulsante `📄 Verbale consegna` in header actions

### Sessione 28 Maggio 2026 — Fix bug critici prompt 1
- ✅ **BUG 1** `fornitori/page.tsx`: INSERT contatto ora controlla l'errore; se fallisce mostra toast e blocca senza chiudere il form; rimosso `console.log` debug
- ✅ **BUG 2** `rda/page.tsx` `creaRDOMulti`: aggiunto `wbs_id: wizardRda.wbs_id` nel payload INSERT delle RDO — il campo non si perdeva più al passaggio RDA→RDO
- ✅ **BUG 3** `rda/page.tsx`: badge WBS mancante aggiornato — testo "⚠ WBS mancante", sfondo arancio `#fff7ed`/`#c2410c`
- ✅ **BUG 4** `impostazioni/page.tsx` `saveAzienda`: `setEditingAzienda(false)` spostato prima del `return` sull'errore — il pannello si chiude sempre dopo salvataggio
- ✅ **BUG 5**: risolto dalla stessa fix del BUG 1 — l'INSERT con tipo='altro' ora propaga l'errore DB invece di fallire silenziosamente
- ✅ **BUG 6** `mappa/page.tsx`: banner errore Mapbox già presente — nessuna modifica necessaria (token mancante mostra overlay ⚠️ centrato)
- ✅ **BUG 7** `computo/page.tsx`: aggiunto `visibile_in_computo` a interfaccia + query con filtro `.or('visibile_in_computo.is.null,visibile_in_computo.eq.true')`; voci XPWE (`manuale !== true`) → quantità e PU non editabili al doppio-click; badge 🔒 grigio accanto al PU; pulsante 🗑 misurazioni nascosto
- ✅ **BUG 7** `varianti/page.tsx` `cambiaStato`: quando variante → `esecutiva`, esegue `UPDATE voci_computo SET visibile_in_computo = true WHERE variante_id = id`

### Sessione 26 Maggio 2026 — commit f73ea2b
- ✅ fornitori/page.tsx: fix contatto non appare dopo salvataggio — error handling corretto su INSERT
- ✅ rda/page.tsx: `wbs_id` propagato da RDA a RDO nel payload `creaRDOMulti`
- ✅ rda/page.tsx: badge "⚠ WBS mancante" arancio su RDA senza WBS
- ✅ impostazioni/page.tsx: pannello si chiude dopo salvataggio
- ✅ mappa/page.tsx: banner errore token Mapbox già presente confermato
- ✅ computo/page.tsx: filtro `visibile_in_computo=TRUE`; voci XPWE read-only con badge 🔒; misurazioni non eliminabili su voci XPWE
- ✅ varianti/page.tsx: approvazione variante → `visibile_in_computo=TRUE` su voci collegate

### Sessione 26 Maggio 2026 (commit 7d2c714)
- ✅ xpwe-parse/route.ts: parsing `<Misure>`/`<MisureItem>` per ogni voce → salvataggio in `voci_computo_misurazioni` con formula NR × Lung × Larg × HPeso
- ✅ computo/page.tsx: righe `mi` con dati reali da DB, campi editabili on-blur (Nota/NR/L/La/H), ricalcolo quantità automatico, bottoni `+riga` e 🗑
- ✅ computo/page.tsx: bottone `✚ Voce da EP`, modal ricerca EP, badge M arancio, `manuale: true`
- ✅ elenco-prezzi/page.tsx: fonte `concordato_dl`, auto-codice `NP/001`, badge NP verde, filtri pill
- ⚠️ SQL da eseguire su Supabase:
  ```sql
  ALTER TABLE voci_computo ADD COLUMN IF NOT EXISTS manuale BOOLEAN DEFAULT FALSE;
  ALTER TABLE elenco_prezzi ADD COLUMN IF NOT EXISTS manuale BOOLEAN DEFAULT FALSE;
  ```

### Sessione 2026-05-26 — Misurazioni XPWE reali + tariffa/voce manuale (commit 7d2c714 → 91856a5)

#### Misurazioni XPWE reali nel computo (7d2c714)
- ✅ `xpwe-parse/route.ts`: parse tag `<Misure>`/`<MisureItem>` — estrae nota, NR, lunghezza, larghezza, h_peso per ogni riga di calcolo
- ✅ UUID client-side (`randomUUID()`) pre-assegnati alle voci prima dell'INSERT batch — consente linking misurazioni senza re-query
- ✅ Salvataggio in `voci_computo_misurazioni`: `{id, voce_id, commessa_id, nr, lunghezza, larghezza, h_peso, quantita, nota, ordine}`
- ✅ `computo/page.tsx`: 5ª query in `caricaDati` per `voci_computo_misurazioni` → mappa `Record<voce_id, Misurazione[]>`
- ✅ Righe `mi` con misurazioni reali: N righe editabili (nota/NR/Lung/Larg/HPeso/qty/🗑) + pulsante `+ riga`
- ✅ CRUD misurazioni: `aggiornaMisurazione` (on-blur), `aggiungiMisurazione`, `eliminaMisurazione` — ricalcolo `quantita` automatico nel DB
- ✅ Interfaccia `Misurazione`: `{id, voce_id, commessa_id, nota, nr, lunghezza, larghezza, h_peso, quantita, ordine}`

#### Tariffa manuale EP con fonte Concordato DL (7d2c714)
- ✅ `elenco-prezzi/page.tsx`: nuova fonte `concordato_dl` — auto-genera codici `NP/001`, `NP/002`... (MAX+1 tra codici esistenti NP/*)
- ✅ Flag `manuale: true` su tutti gli insert in `elenco_prezzi` (anche fonte prezzario/variante aggiunti manualmente)
- ✅ Badge "NP Concordato DL" verde + badge "M" arancione per tariffe manuali nella lista EP
- ✅ Filtri pill: `concordato_dl` e `manuale` aggiunti
- ✅ `concordato_dl` aggiunto alla select fonte nel pannello dettaglio tariffa espanso

#### Voce manuale da EP nel computo (7d2c714)
- ✅ `computo/page.tsx`: pulsante `✚ Voce da EP` in toolbar (sempre visibile, stile blue)
- ✅ Modal con ricerca su `elenco_prezzi` — lista interattiva con codice/descrizione/um/PU
- ✅ Input capitolo (datalist da capitoli esistenti), categoria (datalist), WBS select
- ✅ Insert in `voci_computo` con `manuale: true` — badge "M" visibile nella riga `vo`
- ✅ `apriVoceModal`: carica `elenco_prezzi` per la commessa; `aggiungiVoceDaEP`: INSERT + reload

#### Fix misurazioni (91856a5)
- ✅ **FIX 1** `xpwe-parse/route.ts`: delete `voci_computo_misurazioni` SEMPRE prima di reimport (non solo se il nuovo XPWE ha misurazioni) — evita orfane quando si reimporta un XPWE senza `<Misure>`
- ✅ **FIX 2** `computo/page.tsx`: riga statica `mi` quando nessuna misurazione in DB — mostra testo "misura da XPWE" (non più `v.note?.split('>')`) + `+ mis` per aggiungere manualmente

### Sessione 28 Maggio 2026 — WBS personalizzabile (commit d5293d4)
- ✅ `wbs.ts`: aggiunto `template_id?: string` su `WbsNode` — traccia da quale voce `wbs_templates` proviene il nodo
- ✅ `wbsLoader.ts`: `dbToNode()` unificato (supporta `descrizione` nuovo + `etichetta` legacy); `loadWbs()` con 4 livelli di fallback: `wbs_nodes` → `wbs_commessa` → `wbs_templates` → `wbs_template` → `DEFAULT_WBS_FLAT`; `loadWbsNodes()` tipato per tutte e 4 le tabelle; `buildWbsInsertPayload()` nuovo export — ricalcola codici e mappa `etichetta→descrizione`
- ✅ `impostazioni/page.tsx`: editor template WBS aziendale salva su `wbs_templates` (nuova) + "📋 Carica WBS edilizia" pre-popola 5 categorie + "Applica a tutte le commesse" scrive su `wbs_nodes` per ogni commessa dell'azienda
- ✅ `anagrafica/page.tsx`: WBS commessa ora salva su `wbs_nodes` (nuova) con fallback a `wbs_commessa` in lettura; "📋 Importa da template aziendale" carica da `wbs_templates`, remappa UUID, imposta `template_id`; dot grigio `●` per nodi importati da template; banner vuoto-stato se WBS non configurata
- ⚠️ **SQL da eseguire su Supabase**:
  ```sql
  CREATE TABLE IF NOT EXISTS wbs_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    azienda_id UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
    codice VARCHAR(20) NOT NULL,
    descrizione VARCHAR(200) NOT NULL,
    parent_id UUID REFERENCES wbs_templates(id),
    ordine INTEGER DEFAULT 0,
    colore VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS wbs_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commessa_id UUID NOT NULL REFERENCES commesse(id) ON DELETE CASCADE,
    azienda_id UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
    codice VARCHAR(20) NOT NULL,
    descrizione VARCHAR(200) NOT NULL,
    parent_id UUID REFERENCES wbs_nodes(id),
    template_id UUID REFERENCES wbs_templates(id),
    ordine INTEGER DEFAULT 0,
    colore VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE wbs_templates ENABLE ROW LEVEL SECURITY;
  ALTER TABLE wbs_nodes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "azienda_wbs_templates" ON wbs_templates USING (azienda_id = get_azienda_id());
  CREATE POLICY "azienda_wbs_nodes" ON wbs_nodes USING (azienda_id = get_azienda_id());
  ```

### Sessione 28 Maggio 2026 — Contatti AI import + alert scadenze (commit TBD)
- ✅ `fornitori/page.tsx`: bottone "🤖 Import da PDF" in header
- ✅ `AiImportModal`: drag & drop PDF → POST `/api/ai-import-fornitore` (Claude Haiku) → preview campi estratti editabili → "✓ Importa" salva su DB
- ✅ Mapping risposta AI: `piva→partita_iva`, `citta→comune`, `soa_categorie+soa_classifica→SoaItem[]`, tutti i campi base
- ✅ Helpers `scadenzaCfg()`, `hasExpired()`, `hasWarning()` per tutte e 3 le scadenze (DURC, polizza RC, Inarcassa)
- ✅ Banner rosso "🔴 N contatti con documenti scaduti" se almeno uno scaduto
- ✅ Banner giallo "⚠ N contatti con scadenze nei prossimi 30 giorni" se almeno uno in warning
- ✅ Bottone [Vedi scaduti/Vedi scadenze] → filtra lista automaticamente
- ✅ Pills filtro scadenza: [Tutti] [⚠ In scadenza] [🔴 Scaduti] — si combinano con filtro tipo
- ✅ DetailDrawer tab Professione: `polizza_rc_scadenza` e `inarcassa_scadenza` ora mostrano badge colorati (verde/arancio/rosso) invece di testo piano

### Sessione 28 Maggio 2026 — Permessi sotto-moduli commessa (commit 0b84332)
- ✅ `commesse/[id]/layout.tsx`: carica `moduli_abilitati` via `getCurrentUserModuli()` al mount; filtra tab e gruppi pill per permessi; redirect automatico ad `/anagrafica` se URL diretto a modulo disabilitato; admin (`ruolo === 'admin'`) vede sempre tutto
- ✅ Mappa 16 href → chiave `moduli_abilitati`: computo/elenco-prezzi/rda/rdo/dam→sam/oda/sal-attivi/sal-passivi/cantiere/sicurezza/persone/fatturazione/conto-economico→economico/contratti/varianti/ordini-servizio; tutti gli altri href (anagrafica, documenti, ddt, archivio…) sempre visibili
- ✅ `DEPLOY.md` creato: elenco completo env var Vercel (Supabase URL/anon/service_role, Gemini, Resend, Cron, Mapbox)
- ✅ `/api/invite-user/route.ts`: commento esplicito su `SUPABASE_SERVICE_ROLE_KEY` richiesta

### Sessione 28 Maggio 2026 — Modulo contratto autonomo + Nuovi Prezzi + Riserve (commit 0d0b570)
- ✅ `layout.tsx`: Contratto assorbe Varianti/OS/Nuovi Prezzi/Riserve; Acquisti assorbe Contratti Sub; ex-Contrattuale diventa `extra` "Extra ⭐" con solo Migliorie
- ✅ `nuovi-prezzi/page.tsx` (nuovo): KPI 3 card; lista NP con stati proposta→in_negoziazione→concordato→inserito_ep; PDF verbale concordamento (@react-pdf); bottone "→ EP" crea voce in `elenco_prezzi` con fonte='concordato_dl' e codice NP/auto; collegamento a variante o OS
- ✅ `riserve/page.tsx` (nuovo): KPI 4 card; alert banner rosso se scadenza ≤7gg; accordion con stati iscritta→in_discussione→accettata/respinta/arbitrato; importo riconosciuto editabile on-blur; modal con scadenza default +30gg; collegamento a SAL numero o OS
- ⚠️ **SQL da eseguire su Supabase**:
  ```sql
  CREATE TABLE IF NOT EXISTS nuovi_prezzi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commessa_id UUID NOT NULL REFERENCES commesse(id),
    azienda_id UUID NOT NULL REFERENCES aziende(id),
    codice VARCHAR(20), descrizione TEXT NOT NULL, um VARCHAR(20),
    pu_proposto NUMERIC(12,4), pu_concordato NUMERIC(12,4),
    stato VARCHAR(30) DEFAULT 'proposta',
    variante_id UUID REFERENCES varianti(id),
    ordine_servizio_id UUID REFERENCES ordini_servizio(id),
    note TEXT, data_proposta DATE DEFAULT CURRENT_DATE,
    data_concordamento DATE, concordato_da VARCHAR(150),
    pdf_verbale_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE nuovi_prezzi ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "np_auth" ON nuovi_prezzi FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE TABLE IF NOT EXISTS riserve (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commessa_id UUID NOT NULL REFERENCES commesse(id),
    azienda_id UUID NOT NULL REFERENCES aziende(id),
    numero INTEGER, descrizione TEXT NOT NULL,
    importo_richiesto NUMERIC(15,2), importo_riconosciuto NUMERIC(15,2),
    riferimento_normativo TEXT, iscrizione_su VARCHAR(20) DEFAULT 'sal',
    sal_numero INTEGER, ordine_servizio_id UUID REFERENCES ordini_servizio(id),
    stato VARCHAR(30) DEFAULT 'iscritta',
    data_iscrizione DATE DEFAULT CURRENT_DATE,
    data_scadenza_risposta DATE, data_chiusura DATE,
    note TEXT, pdf_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE riserve ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "riserve_auth" ON riserve FOR ALL TO authenticated USING (true) WITH CHECK (true);
  ```

## Prossimi task prioritari
1. **SQL migrations da eseguire su Supabase** (se non già fatto):
   - `CREATE TABLE nuovi_prezzi` + `CREATE TABLE riserve` con RLS — vedi sessione 28 Maggio 2026 sopra
   - `CREATE TABLE wbs_templates` e `wbs_nodes` con RLS — vedi sessione 28 Maggio 2026 sopra
   - `ALTER TABLE sal ADD COLUMN IF NOT EXISTS pdf_dl_url text, pdf_certificato_url text`
   - `ALTER TABLE voci_computo ADD COLUMN IF NOT EXISTS sic_interna_importo numeric DEFAULT 0, sic_interna_percentuale numeric DEFAULT 0`
   - `ALTER TABLE voci_computo ADD COLUMN IF NOT EXISTS manuale BOOLEAN DEFAULT FALSE`
   - `ALTER TABLE elenco_prezzi ADD COLUMN IF NOT EXISTS manuale BOOLEAN DEFAULT FALSE`
   - `ALTER TABLE commesse ADD COLUMN IF NOT EXISTS sicurezza_interna_esclusa_ribasso boolean DEFAULT true`
   - `ALTER TABLE aziende ADD COLUMN IF NOT EXISTS logo_url text, carta_intestata_header_url text, carta_intestata_footer_url text`
2. **Storage bucket `aziende-assets`** — creare su Supabase Storage con accesso pubblico per upload logo/carta intestata
3. **PWA verifica** — DevTools → Application → Service Workers: sw.js deve essere "activated and running"; Lighthouse PWA audit
4. **Test flusso register→login** — test end-to-end registrazione → conferma email → primo accesso
5. **Verifica dominio Resend** — verificare `sq360.app` su Resend → Domains per mittente ufficiale
6. **SQL tabelle Sprint 6** — creare su Supabase: `documenti_contratto_sub`, `lavoratori_sub`, `pagamenti_sub`

## Email notifiche (Resend) — stato configurazione
- `RESEND_API_KEY`: configurato in produzione ✅
- `CRON_SECRET`: da aggiungere su Vercel → Environment Variables per proteggere `/api/cron/durc`
- Dominio mittente: verificare `sq360.app` su Resend → Domains (ora usa `noreply@sq360.app`)
- Cron DURC: ogni lunedì ore 8:00 → `/api/cron/durc` (richiede Vercel Pro+)

## Moduli roadmap completa
1. ~~Comparativa offerte RDO con aggiudicazione~~ ✅
2. ~~DAM nel flusso corretto~~ ✅
3. ~~Fix ODA~~ ✅
4. ~~DDT con AI lettura foto~~ ✅
5. ~~Fattura passiva con AI~~ ✅
6. ~~Conto economico automatico + Marginalità per WBS~~ ✅
7. ~~Multi-tenant completo — azienda_id in tutti gli INSERT + RLS attivo su tutte le tabelle~~ ✅
8. ~~Sicurezza documentale 24 tipologie con AI~~ ✅
9. ~~Badge cantiere con QR e PWA mobile~~ ✅
10. ~~Registrazione multi-azienda (onboarding /register)~~ ✅
11. ~~Contratti/assegnazione fix (fornitori → professionisti_fornitori)~~ ✅
12. ~~RLS Supabase completo su tutte le tabelle figlie~~ ✅
13. ~~PDF professionali ODA + DAM (@react-pdf/renderer)~~ ✅
14. ~~Invio email notifiche (ODA, DAM, DURC scadenze) con Resend + cron settimanale~~ ✅
15. ~~Archivio Commessa — flusso documentale completo con checklist subappaltatori e export ZIP~~ ✅
16. ~~Dashboard homepage — KPI aggregati, alert, scadenziario globale, attività recente~~ ✅
17. ~~FLUX layout commessa — tre pannelli adattivi, command palette ⌘K, mobile responsive~~ ✅
18. ~~RDO wizard multi-fornitore da RDA + pagina pubblica /offerta/[token]~~ ✅
19. ~~Comparativa automatica RDO per gruppo gara con tabella e aggiudicazione~~ ✅
20. ~~Upload PDF preventivo + AI Gemini estrazione voci offerta~~ ✅
21. ~~SAL Attivi: griglia voci manuale + import XPWE DL + quadro economico + residuo live + varianti esecutive + PDF DL/Cert RUP + riapertura bozza~~ ✅
22. ~~SAL Passivi: card sub, slider avanzamento, DURC check, autorizzazione pagamento~~ ✅
23. ~~6 tipi ODA (materiali/nolo_freddo/nolo_caldo/subappalto/manodopera/servizio) + tipo_oda in INSERT~~ ✅
24. ~~Piano costi voce nel computo: dot indicatori, pannello componenti, genera RDA diretta~~ ✅
25. ~~CE breakdown costi per tipo ODA + confronto piano previsto vs ODA emessi~~ ✅
26. ~~Varianti contrattuali: iter approvazione D.Lgs.36/2023, soglie RUP/SA, voci variante~~ ✅
27. ~~Ordini di Servizio: workflow firma/riserva/chiudi, alert non firmati, genera variante da OS~~ ✅
28. ~~Subappalti flusso completo: checklist documentale 7 doc, lavoratori, pagamenti, workflow sequenziale~~ ✅
29. ~~Elenco Prezzi: popolazione automatica dal computo, analisi per tariffa, prezzi nuovi/variante~~ ✅
30. ~~Navigazione commessa a due livelli: 6 gruppi pill + sotto-moduli per gruppo~~ ✅
31. ~~Migliorie gare: accordion dettaglio, checklist offerta, simulatore margine con ribasso~~ ✅
32. ~~Migliorie commessa: tracking stati esecuzione, costo effettivo, impatto CE~~ ✅
33. ~~Rename DAM → SAM (Scheda Approvazione Materiali) — label UI aggiornate, URL/DB invariati~~ ✅
34. Mappa cantieri dashboard con card griglia + staticmap OSM + geocodifica Nominatim ⚠️ (da verificare)
35. ~~PDF aggiuntivi SAL, Ordine di Servizio, Contratto Sub~~ ✅
36. ~~SalGrid: griglia inserimento SAL copia meccanica del computo — colonne SAL, pannello semplificato~~ ✅
37. ~~Carta intestata azienda in tutti i PDF (logo + header/footer personalizzato)~~ ✅
38. ~~Sicurezza interna alle voci — formula 3 livelli Primus-compatible nel SAL~~ ✅
39. ~~Performance: virtualizzazione computo + paginazione ODA/DDT/fatture~~ ✅
40. ~~PWA installabile — service worker statico + banner installazione~~ ✅
41. ~~Misurazioni XPWE reali nel computo + tariffa manuale EP (concordato DL / NP codes) + voce manuale da EP~~ ✅
42. ~~WBS personalizzabile: template aziendale (wbs_templates) + WBS per commessa (wbs_nodes) con import da template, dot indicatore, fallback 4 livelli~~ ✅
43. Registro di contabilità (libro giornale lavori strutturato) 📋
44. Export completo commessa in formato ZIP strutturato 📋
45. Knowledge base AI edile (normativa D.Lgs. 36/2023, prezzari regionali) 📋
46. Billing e piani tariffari (Stripe integration) 📋

## Architettura moduli specifici
- **Mappa cantieri**: Mapbox (`react-map-gl`) stile `satellite-streets-v12`. Pin SVG colorati per avanzamento SAL (blu 0% / giallo 1-33% / arancio 34-66% / verde 67-99% / grigio 100% / rosso in_ritardo). Dati da view `v_commesse_kpi`. Token: `NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx` in `.env.local` (da aggiungere manualmente — senza token mostra banner di errore, non crasha). Implementazione completa in `src/app/dashboard/mappa/page.tsx` (commit 9a2fa6a).

## Note implementazione
- `getAziendaId()` in `src/lib/supabase.ts` — helper condiviso: `auth.uid() → utenti.azienda_id`
- `supabase` è esportato come `any` in `src/lib/supabase.ts` — nessun tipo generato Supabase, cast necessario per evitare TS2769 su tutte le tabelle
- Auth: protezione solo client-side (dashboard/layout.tsx); middleware.ts è vuoto
- Tutti i moduli salvano `azienda_id` negli INSERT; RLS attivo su DB garantisce isolamento completo
- Tabella `utenti`: `id` = `auth.uid`, `azienda_id` FK, `email`, `nome`, `cognome`, `ruolo` (admin/user)
- Tabella `aziende`: `id`, `nome`, `piva`, `cf`, `provincia`, `created_at`, `logo_url`, `carta_intestata_header_url`, `carta_intestata_footer_url`, `codice_separatore`
- Tabella `wbs_templates`: `id uuid PK`, `azienda_id uuid FK`, `codice varchar(20)`, `descrizione varchar(200)`, `parent_id uuid FK self-ref`, `ordine int`, `colore varchar(7)` — template WBS aziendale (nuova, sostituisce `wbs_template` legacy con `etichetta`)
- Tabella `wbs_nodes`: `id uuid PK`, `commessa_id uuid FK`, `azienda_id uuid FK`, `codice varchar(20)`, `descrizione varchar(200)`, `parent_id uuid FK self-ref`, `template_id uuid FK → wbs_templates`, `ordine int`, `colore varchar(7)` — WBS specifica per commessa (nuova, sostituisce `wbs_commessa` legacy con `etichetta`)
- WBS architettura: 2 livelli — template aziendale (`wbs_templates`) + WBS commessa (`wbs_nodes`); `loadWbs()` usa chain di fallback a 4 livelli; `buildWbsInsertPayload()` calcola codici e mappa `etichetta→descrizione` prima dell'INSERT; `template_id` su WbsNode traccia origine import
- Tabella `elenco_prezzi`: `codice`, `descrizione`, `um`, `prezzo_unitario`, `fonte` ('prezzario'|'prezzo_nuovo'|'variante'|'concordato_dl'), `prezzario_riferimento`, `anno_prezzario`, `approvato_da`, `data_approvazione`, `variante_id`, `note`, `manuale boolean DEFAULT false`; fonte `concordato_dl` auto-genera codici `NP/001`, `NP/002`...
- Tabella `voci_computo_misurazioni`: `id uuid`, `voce_id uuid FK`, `commessa_id uuid FK`, `nr numeric`, `lunghezza numeric`, `larghezza numeric`, `h_peso numeric`, `quantita numeric`, `nota text`, `ordine int`; delete+insert ad ogni reimport XPWE
- Campo `manuale boolean DEFAULT false` su `voci_computo` — segna voci aggiunte tramite `✚ Voce da EP` (non da import XPWE)
- Tabelle Sprint 6 subappalti (da creare se non esistono): `documenti_contratto_sub` (tipo, url, nome_file, data_scadenza, extra JSONB), `lavoratori_sub` (nome, cognome, cf, documenti), `pagamenti_sub` (data, importo_lordo, ritenuta_pct, importo_netto, tipo)
- Pattern navigazione layout commessa: `GRUPPI` array con `id`, `color`, `bg`, `border`, `tabs[]` — gruppo attivo rilevato da `pathname.startsWith(base + '/' + t.href)`; `MODULO_KEY` mappa href → chiave `moduli_abilitati`; `gruppiVisibili` filtra sia gruppi che tab; redirect automatico ad `/anagrafica` se modulo disabilitato; admin escluso dal filtro
- Tabella `migliorie`: `gara_id`, `commessa_id`, `azienda_id`, `categoria`, `descrizione`, `costo_stimato`, `costo_effettivo`, `punteggio_tecnico_stimato`, `note`, `offerta` bool, `fase` ('gara'|'commessa'), `stato` (contrattuale|da_eseguire|in_esecuzione|completata|verificata_dl)
- Checklist offerta gare: persistita in `localStorage('checklist-{gara_id}')` — non in DB
- Tabella `sal`: `pdf_dl_url text`, `pdf_certificato_url text` (da aggiungere se mancanti)
- Tabella `sal_voci`: schema minimo — `sal_id`, `voce_computo_id`, `quantita_periodo`, `wbs_id`; tutti gli altri dati si leggono via JOIN su `voci_computo` (non duplicare)
- Tabella `voci_computo`: `sic_interna_importo numeric DEFAULT 0`, `sic_interna_percentuale numeric DEFAULT 0` — quota sicurezza interna Primus
- Tabella `commesse`: `sicurezza_interna_esclusa_ribasso boolean DEFAULT true` — formula 3 livelli SAL
- Upload SAL: bucket `documenti`, path `{azienda_id}/sal/{commessa_id}/SAL-{numero}-DL.pdf` e `SAL-{numero}-certificato.pdf`
- `SalGrid`: copia meccanica di `computo/page.tsx` con `cp`; usa `props.commessaId` invece di `use(paramsPromise)`; il pannello analisi originale è disabilitato con `{false && (() => {...})()}` per mantenere TypeScript-safe
- Computo: render diretto (virtualizzatore rimosso nella sessione 23 Maggio 2026); `@tanstack/react-virtual` installato ma non usato nel computo principale
- Codice commessa semantico: `genera_codice_commessa(azienda_id, categoria, provincia)` → `[AA]-[CAT]-[PR]-[NNN]`; 11 categorie SOA; `codice_separatore` su `aziende`
- PDF carta intestata: prop `aziendaDoc?` su tutti i 5 componenti PDF; priorità carta_intestata > logo > testo; icone PWA via `/api/pwa-icon/[size]` (Edge ImageResponse)
- PWA: `public/sw.js` statico committato; `ServiceWorkerRegistration` componente client; `public/manifest.json` con shortcuts

## Principi UX
- Semplicità estrema: max 3 tap per qualsiasi azione
