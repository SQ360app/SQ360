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

## Bug aperti / pendenti su Supabase
1. **DB tabelle**: creare su Supabase: `ddt`, `fatture_passive`, `documenti_sicurezza`, `lavoratori_commessa`, `presenze_cantiere`, `giornale_lavori` (se non esistono)
2. **Multi-tenant Fase 2 SQL**: eseguire RLS su Supabase per tutte le tabelle (`get_azienda_id()` + policy FOR ALL USING — SQL già pronto)
3. **Colonna `azienda_id`**: verificare che tutte le tabelle a cui abbiamo aggiunto `azienda_id` negli INSERT la abbiano effettivamente come colonna (rda, rdo, oda, contratti_sub, giornale_lavori, ddt, fatture_passive, fatture)

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

### Sessione 2025-05-14 — parte 5 (commit 865aea8 → f3d3c7d)
- ✅ Multi-tenant Fase 2 SQL: template RLS pronto con `get_azienda_id()` helper function (da eseguire su Supabase)
- ✅ /api/ai-sicurezza/route.ts: Gemini Vision — riconosce 24 tipologie di documenti sicurezza edile (commit 865aea8)
- ✅ sicurezza/page.tsx: modulo completo — KPI, alert banner scadenze, tabella colori live, AI upload, CRUD, preview stato nel form (commit 865aea8)
- ✅ layout.tsx: tab "Sicurezza" aggiunto tra Cantiere e Spese (commit 865aea8)
- ✅ Fix TypeScript build Vercel: rimosso `TUTTI_TIPI` unused, rimosso `nullsFirst` non nel tipo, fix `Partial<DocSicurezza>` spread (commit f3d3c7d)

## Prossimi task prioritari
1. **RLS Supabase** — eseguire il SQL Fase 2 già pronto: `get_azienda_id()` function + policy FOR ALL USING su tutte le tabelle. BLOCCANTE per go-live multi-azienda.
2. **Verifica schema DB** — controllare che le colonne `azienda_id` esistano nelle tabelle rda, rdo, oda, contratti_sub, giornale_lavori, ddt, fatture, e che le tabelle lavoratori_commessa/presenze_cantiere esistano
3. **Test flusso register→login** — testare fine a fine: registrazione → conferma email → primo login → commessa con multi-tenant isolato

## Moduli roadmap completa
1. ~~Comparativa offerte RDO con aggiudicazione~~ ✅
2. ~~DAM nel flusso corretto~~ ✅
3. ~~Fix ODA~~ ✅
4. ~~DDT con AI lettura foto~~ ✅
5. ~~Fattura passiva con AI~~ ✅
6. ~~Conto economico automatico + Marginalità per WBS~~ ✅
7. ~~Multi-tenant Fase 1 (codice) — azienda_id in SELECT e INSERT~~ ✅ — Fase 2 (RLS SQL) ← da eseguire su Supabase
8. ~~Sicurezza documentale 24 tipologie con AI~~ ✅
9. ~~Badge cantiere con QR e PWA mobile~~ ✅
10. ~~Registrazione multi-azienda (onboarding /register)~~ ✅
11. ~~Contratti/assegnazione fix (fornitori → professionisti_fornitori)~~ ✅
12. RLS Supabase Fase 2 ← **NEXT**
13. Invio email notifiche (SAL, scadenze DURC) — non implementato
14. Esportazione PDF professionale (SAL, ODA, contratti) — parziale (solo RDO)

## Note implementazione
- `getAziendaId()` in `src/lib/supabase.ts` — helper condiviso: `auth.uid() → utenti.azienda_id`
- Auth: protezione solo client-side (dashboard/layout.tsx); middleware.ts è vuoto
- Tutti i moduli ora salvano `azienda_id` negli INSERT; i SELECT filtrano per `commessa_id` (che è di proprietà dell'azienda — sicuro finché RLS non è attivo)
- Tabella `utenti`: `id` = `auth.uid`, `azienda_id` FK, `email`, `nome`, `cognome`, `ruolo` (admin/user)
- Tabella `aziende`: `id`, `nome`, `piva`, `cf`, `provincia`, `created_at`

## Principi UX
- Semplicità estrema: max 3 tap per qualsiasi azione
