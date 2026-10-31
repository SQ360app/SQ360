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

> ⚠️ Fonte `sq360-prompts.md` non trovata nel repo. Tabella da completare quando il file sarà disponibile.

| # | Prompt | Stato | Commit | Note |
|---|---|---|---|---|
| 1 | Fix bug critici (fornitori, WBS RDA→RDO, impostazioni, mappa, computo XPWE read-only, varianti) | ✅ | `f73ea2b` | Da CLAUDE.md, sessione 28/05/2026 |
| 2 | ? | ❓ | | |
| 3 | ? | ❓ | | |
| 4 | ? | ❓ | | |
| 5 | ? | ❓ | | |
| 6 | ? | ❓ | | |
| 7 | ? | ❓ | | |
| 8 | ? | ❓ | | |
| 9 | ? | ❓ | | |
| 10 | ? | ❓ | | |
| 11 | ? | ❓ | | |
| 12 | ? | ❓ | | |
| 13 | ? | ❓ | | |
| 14 | ? | ❓ | | |
| 15 | ? | ❓ | | |
| 16 | ? | ❓ | | |

## 6. Test checklist

> ⚠️ Fonte `TEST_CHECKLIST.md` non trovata nel repo. Da integrare.

---

## Changelog MASTER
| Data | Commit | Modifica |
|---|---|---|
| 2026-10-31 | — | Creazione iniziale da CLAUDE.md + DEPLOY.md + struttura codice |
