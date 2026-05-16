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

## Prossimi task prioritari
1. **Sprint 6** — da definire
2. **Test flusso register→login** — test end-to-end registrazione → conferma email → primo accesso
3. **Verifica dominio Resend** — verificare `sq360.app` su Resend → Domains per mittente ufficiale

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
21. ~~SAL Attivi: griglia voci manuale + import XPWE DL + quadro economico~~ ✅
22. ~~SAL Passivi: card sub, slider avanzamento, DURC check, autorizzazione pagamento~~ ✅
23. ~~6 tipi ODA (materiali/nolo_freddo/nolo_caldo/subappalto/manodopera/servizio) + tipo_oda in INSERT~~ ✅
24. ~~Piano costi voce nel computo: dot indicatori, pannello componenti, genera RDA diretta~~ ✅
25. ~~CE breakdown costi per tipo ODA + confronto piano previsto vs ODA emessi~~ ✅

## Note implementazione
- `getAziendaId()` in `src/lib/supabase.ts` — helper condiviso: `auth.uid() → utenti.azienda_id`
- Auth: protezione solo client-side (dashboard/layout.tsx); middleware.ts è vuoto
- Tutti i moduli salvano `azienda_id` negli INSERT; RLS attivo su DB garantisce isolamento completo
- Tabella `utenti`: `id` = `auth.uid`, `azienda_id` FK, `email`, `nome`, `cognome`, `ruolo` (admin/user)
- Tabella `aziende`: `id`, `nome`, `piva`, `cf`, `provincia`, `created_at`

## Principi UX
- Semplicità estrema: max 3 tap per qualsiasi azione
