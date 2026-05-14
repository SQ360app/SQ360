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
2. oda/page.tsx: join fornitore mancante — `select('*')` non popola `o.fornitore?.ragione_sociale` (serve `select('*, fornitore:professionisti_fornitori(id,ragione_sociale)')`)
3. oda/page.tsx: DAM auto-generato usa campi sbagliati (`denominazione_materiale` → `materiale`, stato `IN_ATTESA` → `bozza`)
4. oda/page.tsx: VociRdaSection ancora su `computo_metrico` + `unita_misura` (riga 37) — non fixata in sessione 2025-05-14

## Fix completati (sessione 2025-05-14)
- ✅ rda/page.tsx: `computo_metrico` → `voci_computo`, `unita_misura` → `um` (commit 527a0f4)
- ✅ computo/page.tsx: WBS context menu — condizione `multiSel.size > 1` → `> 0` (commit 527a0f4)
- ✅ rdo/page.tsx: stessa fix `voci_computo`/`um` in VociRdaSection e generaPdf (commit c8b3cd0)
- ✅ rdo/page.tsx: VociRdaSection spostata dentro `<td>` — HTML valido (commit c8b3cd0)
- ✅ rdo/page.tsx: bottone "Genera ODA" passa `rdo_id`, `importo`, `fornitore` via URL params (commit c8b3cd0)
- ✅ oda/page.tsx: `useSearchParams` + `rdo_id` nel payload di `handleSave` (commit c8b3cd0)
- ✅ rdo/page.tsx: pulsante "✓ Aggiudica" nel quadro comparativo (card BEST) — setta vincitrice + annulla altri (commit 2ac8fa2)
- ✅ rdo/page.tsx: pulsante "📋 Crea DAM" su righe aggiudicate — naviga con URL params (commit 2ac8fa2)
- ✅ dam/page.tsx: `rdo_id` in interfaccia e payload; `fornitore_id` nel payload; `useSearchParams` + prefill asincrono da RDA/fornitore; campo fornitore nel form (commit 2ac8fa2)

## Prossimi 3 task prioritari
1. **Fix ODA** (3 bug in oda/page.tsx): join fornitore con `select('*, fornitore:professionisti_fornitori(...)')`, fix DAM auto (`materiale` + stato `bozza`), fix VociRdaSection (`voci_computo`/`um`)
2. **DDT con AI lettura foto** — route `/api/ai-extract-document` già pronta, costruire il modulo DDT con upload foto e estrazione automatica campi
3. **Fattura passiva con AI** — upload PDF fattura, estrazione campi con AI, collegamento a ODA/DAM

## Moduli roadmap completa
1. ~~Comparativa offerte RDO con aggiudicazione~~ ✅ FATTO
2. ~~DAM nel flusso corretto (dopo comparativa, prima ODA)~~ ✅ FATTO
3. Fix ODA (vedere bug aperti sopra) ← **NEXT**
4. DDT con AI lettura foto ← **NEXT**
5. Fattura passiva con AI ← **NEXT**
6. Conto economico automatico alimentato da ODA
7. Multi-tenant (azienda_id + RLS)
8. Sicurezza documentale 65+ tipologie (come Pillar)
9. Badge cantiere con QR e PWA mobile

## Principi UX
- Semplicità estrema: max 3 tap per qualsiasi azione
