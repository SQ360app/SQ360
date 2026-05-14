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
2. DB: tabelle `ddt` e `fatture_passive` vanno create su Supabase prima di testare i nuovi moduli

## Fix e feature completati

### Sessione 2025-05-14 — parte 1 (commit 527a0f4 → c8b3cd0)
- ✅ rda/page.tsx: `computo_metrico` → `voci_computo`, `unita_misura` → `um`
- ✅ computo/page.tsx: WBS context menu `multiSel.size > 1` → `> 0`
- ✅ rdo/page.tsx: stessa fix `voci_computo`/`um`; HTML struttura VociRdaSection; Genera ODA via URL params
- ✅ oda/page.tsx: `useSearchParams` + `rdo_id` nel payload

### Sessione 2025-05-14 — parte 2 (commit 2ac8fa2 → 8ffd70b)
- ✅ rdo/page.tsx: pulsante "✓ Aggiudica" nel quadro comparativo + "📋 Crea DAM" su righe aggiudicate
- ✅ dam/page.tsx: `rdo_id`/`fornitore_id` in payload; prefill da URL params; campo fornitore nel form
- ✅ oda/page.tsx: join fornitore; DAM auto campi corretti (`materiale` + stato `bozza`); VociRdaSection fix
- ✅ layout.tsx: tab DDT e Fatt. passive aggiunti
- ✅ /api/ai-ddt/route.ts: Gemini Vision per lettura foto DDT
- ✅ /api/ai-fattura/route.ts: Gemini Vision per lettura PDF/foto fattura
- ✅ ddt/page.tsx: modulo DDT completo con AI scansione
- ✅ fatture/page.tsx: modulo Fatture passive con AI estrazione

### Sessione 2025-05-14 — parte 3 (commit e4f8ec9 → 25c22f7)
- ✅ rda/page.tsx: rimossi campi inesistenti (oggetto, tipo, rda_ids) da insert rdo (commit e4f8ec9)
- ✅ ce/page.tsx: fix query `voci_computo` (ora via `computo_metrico`); aggiunto `commessa.importo_contratto`; aggiunto `fatture_passive` pagate; doppio margine atteso/attuale (commit 25c22f7)
- ✅ marginalita/page.tsx: costruito da zero — KPI, tabella WBS con budget/ODA/Δ/%, join ODA→RDO→RDA→wbs_id, alert ODA senza WBS (commit 25c22f7)

## Prossimi 3 task prioritari
1. **Multi-tenant** — aggiungere `azienda_id` a tutte le tabelle + Row Level Security (RLS) su Supabase; registrazione/login multi-azienda
2. **Sicurezza documentale** — 65+ tipologie come Pillar (DVR, POS, DURC, visure, polizze…); upload + scadenzario + alert
3. **Badge cantiere con QR** — PWA mobile, QR code per accesso cantiere, registro presenze

## Moduli roadmap completa
1. ~~Comparativa offerte RDO con aggiudicazione~~ ✅
2. ~~DAM nel flusso corretto~~ ✅
3. ~~Fix ODA (join fornitore, DAM auto, VociRdaSection)~~ ✅
4. ~~DDT con AI lettura foto~~ ✅
5. ~~Fattura passiva con AI~~ ✅
6. ~~Conto economico automatico + Marginalità per WBS~~ ✅
7. Multi-tenant (azienda_id + RLS) ← **NEXT**
8. Sicurezza documentale 65+ tipologie ← **NEXT**
9. Badge cantiere con QR e PWA mobile ← **NEXT**

## Principi UX
- Semplicità estrema: max 3 tap per qualsiasi azione
