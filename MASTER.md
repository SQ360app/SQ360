# SQ360 — MASTER

> Documento di stato unico del progetto. **Va aggiornato ad ogni commit.**
> Ultimo aggiornamento: 2026-10-31 · ultimo commit di riferimento: `79e24bc` (contatti AI import + alert scadenze)
>
> Fonti: `CLAUDE.md` (storico sessioni), `DEPLOY.md`, struttura `src/app`.
> ⚠️ `sq360-prompts.md` e `TEST_CHECKLIST.md` **non presenti nel repo** al momento della creazione — le sezioni che ne dipendono sono da completare.

Legenda: ✅ completo · ⚠️ implementato ma da verificare / richiede SQL · 🚧 parziale · 📋 non iniziato

---

## 1. Stato dei moduli

### 1.1 Piattaforma / trasversali
| Modulo | Stato | Note |
|---|---|---|
| Auth login | ✅ | Protezione solo client-side (`dashboard/layout.tsx`); `middleware.ts` vuoto |
| Registrazione multi-azienda `/register` | ⚠️ | Wizard 2 step + recovery orfano; **test end-to-end register→email→login da fare** |
| Multi-tenant (`azienda_id` + RLS) | ✅ | Tutti gli INSERT con `azienda_id`; RLS su tutte le tabelle figlie |
| Permessi sotto-moduli (`moduli_abilitati`) | ✅ | Filtro tab/gruppi + redirect ad `/anagrafica`; admin vede tutto |
| Inviti utente `/api/invite-user` | ✅ | Richiede `SUPABASE_SERVICE_ROLE_KEY` |
| Email Resend + template + log | ⚠️ | Dominio `sq360.app` da verificare su Resend; `CRON_SECRET` da impostare |
| Cron DURC settimanale | ⚠️ | `vercel.json` lunedì 8:00 — richiede Vercel Pro+ |
| PDF @react-pdf (ODA, SAM, SAL, OS, Contratto Sub, RDO, Verbale consegna, NP) | ✅ | Carta intestata > logo > testo; bucket `aziende-assets` **da creare** |
| PWA (sw.js, manifest, banner, icone edge) | ⚠️ | Da verificare in DevTools + Lighthouse |
| Impostazioni azienda (logo, carta intestata, WBS template) | ⚠️ | Dipende da SQL `aziende` + `wbs_templates` |

### 1.2 Area dashboard (`src/app/dashboard/*`)
| Modulo | Stato | Note |
|---|---|---|
| Dashboard homepage (KPI, alert, scadenziario, attività) | ✅ | 11 query in `Promise.all`, no view SQL |
| Mappa cantieri (Mapbox) | ⚠️ | Richiede `NEXT_PUBLIC_MAPBOX_TOKEN`; colonne geo su `commesse` da verificare |
| Commesse (lista + codifica `[AA]-[SA]-[PR]-[SOA]-[NNN]`) | ✅ | RPC `genera_codice_commessa` |
| Gare (accordion, checklist offerta, migliorie, simulatore margine, crea commessa) | ✅ | Checklist offerta in `localStorage`, non DB |
| Contatti / fornitori v2 (38 campi, 5 tab, AI import PDF, alert scadenze) | ✅ | AI import usa Claude Haiku (`/api/ai-import-fornitore`) |
| import-computo, preventivazione, pianificazione, scadenzario, report, marginalita, sal, amministrazione, cantiere, contratti, dam | ❓ | Presenti in `src/app/dashboard` ma non documentati in CLAUDE.md — stato da verificare |

### 1.3 Commessa (`src/app/dashboard/commesse/[id]/*`) — navigazione a 2 livelli
| Gruppo | Modulo | Stato | Note |
|---|---|---|---|
| Contratto 📋 | anagrafica | ✅ | WBS commessa, verbale consegna PDF, toggle sicurezza interna |
| | elenco-prezzi | ✅ | Popolazione auto dal computo, analisi BASE, NP/xxx concordato DL |
| | computo | ✅ | XPWE + misurazioni reali, voce da EP, analisi prezzi BASE+EXTRA, voci XPWE read-only |
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
| | persone | ✅ | QR badge, scanner PWA, presenze, coda offline |
| | sicurezza | ✅ | 24 tipologie AI Gemini |
| | ddt | ✅ | AI Gemini Vision, paginazione |
| Economico 💰 | sal-attivi (+ SalGrid) | ⚠️ | Completo; **SQL `sal.pdf_*_url` da eseguire** |
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

- **Stack**: Next.js 15 (App Router) + Supabase + Vercel. AI principale Gemini 2.0 Flash (server-side, `GEMINI_API_KEY`); eccezione: AI import fornitore su Claude Haiku.
- **Supabase client tipato `any`** (`src/lib/supabase.ts`): nessun tipo generato; evita TS2769 su build Vercel. Nelle route API: `const db = client as any`.
- **Client Supabase/Resend istanziati dentro gli handler**, mai a livello modulo (evita errori di build "supabaseKey is required").
- **Multi-tenant**: `getAziendaId()` (`auth.uid → utenti.azienda_id`) in ogni INSERT + RLS con `get_azienda_id()` su DB. Doppia protezione: codice + DB.
- **Params Next 15**: pattern `use(paramsPromise)` al posto di `useParams` nelle pagine commessa.
- **Layout commessa**: array `GRUPPI` (id, color, tabs[]); gruppo attivo da `pathname`, nessuno state; `MODULO_KEY` mappa href → permesso.
- **Dati live, non snapshot**: `sal_voci` contiene solo `sal_id, voce_computo_id, quantita_periodo, wbs_id`; tutto il resto via JOIN su `voci_computo`. SalGrid legge sempre computo + varianti esecutive al mount.
- **SalGrid = copia meccanica del computo** (`cp`) con 3 differenze; pannello analisi disabilitato con `{false && …}`.
- **Analisi prezzi**: BASE condivisa per `codice_tariffa` (`analisi_prezzi_tariffa`) + EXTRA per singola voce (`analisi_extra_voce`). Home canonica: Elenco Prezzi. `piano_costi_voce` deprecato (tabella resta per storico).
- **WBS a 2 livelli**: `wbs_templates` (azienda) → `wbs_nodes` (commessa) con `template_id`; `loadWbs()` fallback a 4 livelli fino a `DEFAULT_WBS_FLAT`.
- **XPWE reimport**: delete misurazioni SEMPRE prima del reimport; UUID client-side pre-assegnati per linkare misurazioni senza re-query.
- **Codici documento**: MAX+1 con `UNIQUE(commessa_id, azienda_id, codice)`; revisioni `-R1/-R2`.
- **Computo**: render diretto, virtualizzatore rimosso (`@tanstack/react-virtual` installato ma non usato lì).
- **Paginazione**: ODA / DDT / fatture passive a blocchi da 50 con "Carica altri".
- **PDF**: `@react-pdf/renderer` sempre con import dinamico nel click handler.
- **PWA**: `public/sw.js` statico committato; NetworkFirst su navigazione, pass-through per Supabase e `/api/*`.
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
- **Voci XPWE read-only** (quantità/PU non editabili, misurazioni non eliminabili); voci manuali (`manuale = true`) editabili.
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
- [ ] `CREATE TABLE nuovi_prezzi` + `riserve` con RLS (⚠️ policy attuali `USING (true)` — da restringere a `azienda_id = get_azienda_id()`)
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

### 4.3 Debito tecnico / idee aperte
- Auth solo client-side: `middleware.ts` vuoto — valutare protezione server-side delle route.
- Tabella `piano_costi_voce` e tabelle WBS legacy (`wbs_commessa`, `wbs_template`) ancora in DB: pianificare migrazione/rimozione.
- Checklist offerta gare in `localStorage`: non condivisa tra utenti/dispositivi — valutare persistenza in DB.
- Tipi Supabase non generati (`any` ovunque): valutare `supabase gen types`.
- Modifica non committata in `src/lib/supabase.ts` (+15 righe) al momento della creazione di questo file.
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
