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

## Bug aperti (priorità alta)
1. contratti/assegnazione: tabella `fornitori` vs `professionisti_fornitori` — verificare nome corretto
2. DB: tabelle `ddt`, `fatture_passive`, `documenti_sicurezza` vanno create su Supabase prima di testare i nuovi moduli
3. Multi-tenant Fase 2 SQL: eseguire RLS su Supabase per `commesse`, `gare`, `contratti`, `professionisti_fornitori`, `dam` (SQL già pronto dalla sessione)

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

### Sessione 2025-05-14 — parte 5 (commit 865aea8 → f3d3c7d)
- ✅ Multi-tenant Fase 2 SQL: template RLS pronto con `get_azienda_id()` helper function (da eseguire su Supabase)
- ✅ /api/ai-sicurezza/route.ts: Gemini Vision — riconosce 24 tipologie di documenti sicurezza edile (commit 865aea8)
- ✅ sicurezza/page.tsx: modulo completo — KPI, alert banner scadenze, tabella colori live, AI upload, CRUD, preview stato nel form (commit 865aea8)
- ✅ layout.tsx: tab "Sicurezza" aggiunto tra Cantiere e Spese (commit 865aea8)
- ✅ Fix TypeScript build Vercel: rimosso `TUTTI_TIPI` unused, rimosso `nullsFirst` non nel tipo, fix `Partial<DocSicurezza>` spread (commit f3d3c7d)

## Prossimi 3 task prioritari
1. **Badge cantiere con QR** — PWA mobile, QR code per accesso cantiere, registro presenze giornaliero per lavoratore; richiede tabella `badge_cantiere` + `presenze`
2. **Registrazione multi-azienda** — pagina onboarding `/register` che crea `aziende` + `utenti` + primo utente admin; attualmente non esiste un flusso di signup
3. **Contratti/assegnazione fix** — verificare se la tabella si chiama `fornitori` o `professionisti_fornitori`, correggere le query, testare il flusso assegnazione subappalti

## Moduli roadmap completa
1. ~~Comparativa offerte RDO con aggiudicazione~~ ✅
2. ~~DAM nel flusso corretto~~ ✅
3. ~~Fix ODA~~ ✅
4. ~~DDT con AI lettura foto~~ ✅
5. ~~Fattura passiva con AI~~ ✅
6. ~~Conto economico automatico + Marginalità per WBS~~ ✅
7. ~~Multi-tenant Fase 1 (codice)~~ ✅ — Fase 2 (RLS SQL) in attesa esecuzione su Supabase
8. ~~Sicurezza documentale 24 tipologie con AI~~ ✅
9. Badge cantiere con QR e PWA mobile ← **NEXT**
10. Registrazione multi-azienda (onboarding) ← **NEXT**
11. Contratti/assegnazione fix ← **NEXT**

## Note implementazione
- `getAziendaId()` in `src/lib/supabase.ts` — helper condiviso: `auth.uid() → utenti.azienda_id`
- Tabelle nuove da creare su Supabase: `ddt`, `fatture_passive`, `documenti_sicurezza`
- RLS SQL pronto ma non ancora eseguito: usa `get_azienda_id()` function + policy FOR ALL USING

## Principi UX
- Semplicità estrema: max 3 tap per qualsiasi azione
