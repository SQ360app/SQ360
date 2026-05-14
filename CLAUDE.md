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

## Fix completati (sessione 2025-05-14)
- ✅ rda/page.tsx: `computo_metrico` → `voci_computo`, `unita_misura` → `um` (commit 527a0f4)
- ✅ computo/page.tsx: WBS context menu `multiSel.size > 1` → `> 0` (commit 527a0f4)
- ✅ rdo/page.tsx: `voci_computo`/`um` in VociRdaSection + generaPdf; HTML struttura; Genera ODA URL params (commit c8b3cd0)
- ✅ oda/page.tsx: `useSearchParams` + `rdo_id` nel payload (commit c8b3cd0)
- ✅ rdo/page.tsx: pulsante "✓ Aggiudica" nel quadro comparativo + "📋 Crea DAM" (commit 2ac8fa2)
- ✅ dam/page.tsx: `rdo_id`/`fornitore_id` in payload; prefill da URL params; campo fornitore nel form (commit 2ac8fa2)
- ✅ oda/page.tsx: join fornitore `select('*, fornitore:professionisti_fornitori(...)')` (commit 8ffd70b)
- ✅ oda/page.tsx: DAM auto → `materiale` + stato `bozza`; VociRdaSection → `voci_computo`/`um` (commit 8ffd70b)
- ✅ layout.tsx: tab DDT e Fatt. passive aggiunti (commit 8ffd70b)
- ✅ /api/ai-ddt/route.ts: Gemini Vision per lettura foto DDT (commit 8ffd70b)
- ✅ /api/ai-fattura/route.ts: Gemini Vision per lettura PDF/foto fattura (commit 8ffd70b)
- ✅ ddt/page.tsx: modulo DDT completo con AI scansione (commit 8ffd70b)
- ✅ fatture/page.tsx: modulo Fatture passive con AI estrazione (commit 8ffd70b)
- ✅ rda/page.tsx: rimossi campi inesistenti (oggetto, tipo, rda_ids) da insert rdo (commit e4f8ec9)

## Prossimi task prioritari
1. **Conto economico + Marginalità per WBS** — ce/page.tsx già funzionante (legge ODA+SAL+spese), manca: `fatture_passive` pagate come costo attuale, `commessa.importo_contratto` come ricavo ufficiale; marginalita/page.tsx è placeholder vuoto — va costruito con breakdown per WBS (budget da voci_computo, costi da ODA→RDO→RDA→wbs_id)
2. **Multi-tenant** (azienda_id + RLS su tutte le tabelle)
3. **Sicurezza documentale** — 65+ tipologie come Pillar
4. **Badge cantiere** con QR e PWA mobile

## Moduli roadmap completa
1. ~~Comparativa offerte RDO con aggiudicazione~~ ✅
2. ~~DAM nel flusso corretto~~ ✅
3. ~~Fix ODA (join fornitore, DAM auto, VociRdaSection)~~ ✅
4. ~~DDT con AI lettura foto~~ ✅
5. ~~Fattura passiva con AI~~ ✅
6. Conto economico automatico + Marginalità per WBS ← **NEXT**
7. Multi-tenant (azienda_id + RLS)
8. Sicurezza documentale 65+ tipologie
9. Badge cantiere con QR e PWA mobile

## Principi UX
- Semplicità estrema: max 3 tap per qualsiasi azione
