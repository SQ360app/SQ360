# SQ360 — Cronoprogramma 16 prompt
Aggiornato: 31 ottobre 2026 (ricostruito dalle chat del 26 maggio 2026)

## REGOLA DI LAVORO (vale per ogni prompt)
1. Prima di scrivere un prompt: chiedere a Claude Code cosa esiste già nel codice ("NON modificare nulla, solo analisi").
2. Scrivere solo ciò che manca. Mai riscrivere cose già implementate.
3. Ogni commit aggiorna MASTER.md.
4. RLS Supabase: usare la sintassi che funziona (vedi in fondo).

---

## COMPLETATI

### Prompt 1 — Bug critici (7d2c714 + f73ea2b)
- Parsing misurazioni XPWE -> voci_computo_misurazioni (vale solo per NUOVI import: reimportare l'XPWE)
- Righe misurazioni editabili nel computo, voce manuale da EP, tariffa concordato DL
- Fix contatto non appare dopo salvataggio, wbs_id propagato RDA->RDO, badge "WBS mancante"
- Impostazioni si chiude dopo salvataggio, banner token Mapbox
- Computo: voci XPWE read-only (badge lock), filtro visibile_in_computo, varianti esecutive rendono visibili le loro voci

### Prompt 1B — WBS personalizzabile (d5293d4)
- Tabelle wbs_templates e wbs_nodes, template aziendale in Impostazioni, WBS per commessa, fallback su template

### Prompt 2 — PDF (236395b)
- RDO PDF (gia esistente), Verbale consegna lavori (template con firme RUP/DL/CSE/Impresa)
- Comunicazioni formali spostate nel Prompt 4 area Contratto (ANCORA DA FARE, vedi sotto)

### Prompt 3 — Utenti e permessi (036ccb3 + 0b84332)
- 6 ruoli, toggle 19 moduli per utente, sidebar adattiva, blocco sotto-moduli via URL, invito email
- NOTA: i ruoli sono solo etichette; il controllo reale e solo su moduli_abilitati

### Prompt 4 — Contratto autonomo (0d0b570)
- Gruppo Contratto (10 tab): Anagrafica, Documenti, EP, Computo, SAL Attivi, SAL Passivi, Varianti, Ordini Servizio, Nuovi Prezzi, Riserve
- Gruppo Acquisti (6 tab): RDA, RDO, SAM, ODA, Email, Contratti Sub
- Extra: Migliorie
- Nuovi Prezzi: proposta -> in_negoziazione -> concordato -> inserito_ep, PDF verbale
- Riserve: iscritta -> in_discussione -> accettata/respinta/arbitrato, alert scadenza risposta

### Prompt 5 — Contatti AI (79e24bc)
- Import AI da PDF, banner scadenze, badge colorati, filtri In scadenza / Scaduti

---

## DA FARE

### Prompt 6 — Sicurezza sub + Nolo + DDT->ODA
SQL prima:
- Tabelle registro_nolo e rapportini_manodopera (commessa_id, azienda_id, oda_id, data, ore, descrizione, approvato, pdf_url)
- ALTER ddt: oda_id, scostamento_quantita, approvato
- ALTER fatture_passive: wbs_id, ddt_id
Parti:
1. DDT -> ODA: AI suggerisce ODA (stesso fornitore, importo simile), verifica quantita (ok / scostamento / supera >5% = alert), "Approva DDT" sblocca la fattura passiva.
2. Registro utilizzo nolo: foglio ore giornaliero per ODA nolo, AI da foto rapportino, totale ore vs ODA, "Autorizza periodo" sblocca fattura.
3. Rapportini manodopera esterna: stesso schema.
4. Fattura passiva eredita wbs_id dall'ODA, badge WBS, filtro WBS, KPI per WBS.
5. Sicurezza subappaltatori: AI import documenti, alert 30gg, checklist per tipo fornitore (subappalto / nolo caldo / fornitura), portale fornitore pubblico /documenti-sub/[token].

### Prompt 7 — Report economico completo
1. CE per WBS: previsto (analisi prezzi x quantita) / impegnato (ODA) / reale (fatture passive per WBS) / scostamento / margine.
2. Cash flow base (entrate SAL previsti, uscite fatture, saldo mensile).
3. Alert: WBS margine <10% arancio, <0% rosso; ODA senza DDT >15gg; fattura > ODA; SAL in ritardo >30gg.
4. Report PDF economico commessa.
5. Pacchetto fornitore: offerta globale su N tariffe, importo distribuito proporzionalmente, ODA sul pacchetto.
6. Spese generali collegate a WBS e al CE.

### Prompt 8 — Moduli contrattuali verso committente
SQL prima: commesse anticipazione_importo/data/recuperata, penali_importo/giorni; tabella sospensioni.
1. Sospensioni e riprese (verbale caricato, giorni sospesi, nuova fine contrattuale, alert >45gg).
2. Anticipazione contrattuale (20%): recupero progressivo nei SAL.
3. Penali per ritardo (sospensioni fermano il conteggio, alert limite).
4. Revisione prezzi art. 60 D.Lgs. 36/2023.
5. Conto finale (SAL conclusivo, quadro economico definitivo, svincolo ritenuta 5% dopo collaudo).
6. Comunicazioni formali impresa -> DL/RUP/SA (proroga, istanza subappalto, proposta variante, richiesta NP, riserva, diffida) con registro cronologico e protocollo.
7. As Built + Collaudo + Fascicolo (checklist collaudo, piano manutenzione, garanzie, QR passaporto digitale opera, protocollo fine lavori 15 punti, alert -60gg).

### Prompt 9 — Cantiere mobile + AI zero-input
1. /api/ai-cantiere: foto -> classificazione (DDT, rapportino, doc sicurezza, ODS, verbale) -> bozza automatica.
2. Scanner universale PWA: un solo bottone "Scatta e invia".
3. Centro approvazioni ufficio (anteprima foto + dati AI, Approva / Correggi / Rifiuta, approvazione in massa).
4. AI proattiva livello base: estendere il cron giornaliero con regole fisse (ODA senza DDT, margine WBS, SAL in ritardo, DURC sub, riserve in scadenza) + email con link.

### Prompt 10 — Alert configurabili + centro notifiche
Tabella regole_alert configurabile per azienda, campanella con notifiche in DB, reminder scadenze (DURC, polizze, SAL, fine lavori, collaudo, svincolo).

### Prompt 11 — Cash flow previsionale
Modulo dedicato, 18 mesi, saldo cumulato, export, pianificato vs consuntivo.

### Prompt 12 — FatturaPA + SDI
XML conforme, invio via intermediario, tracking stati, split payment, conservazione.

### Prompt 13 — Portale documenti sub
Estrazione AI da ogni PDF caricato dal sub, confronto con checklist, notifiche, scadenzario.

### Prompt 14 — Sicurezza impresa avanzata
POS da template, DVR, riunioni sicurezza, notifica preliminare INAIL, DURC di congruita, statistiche infortuni.

### Prompt 15 — AI integrata
Assistant commessa in linguaggio naturale, AI proattiva avanzata, NormaBot (RAG pgvector, D.Lgs. 36/2023), analisi bandi, price checker.

### Prompt 16 — Go to market
Landing page, onboarding wizard (azienda, prima commessa, WBS, invito collaboratore, tour), Stripe, Supabase Pro + Vercel Pro.
Pricing: piano unico per numero utenti, commesse illimitate. Early adopter 79 EUR/mese (primi 20), standard 149 EUR/mese.

---

## DEBITI TECNICI DA SISTEMARE PRIMA DEI CLIENTI
- RLS di nuovi_prezzi e riserve (e wbs_templates / wbs_nodes) e aperta (USING true): isolare per azienda_id prima di aprire ad altre imprese.
- Verificare che /api/cron/durc controlli CRON_SECRET e risponda 401 senza.
- ANTHROPIC_API_KEY: caricare crediti su console.anthropic.com per gli import AI contratto/fornitore/progettista.
- Tabelle Sprint 6 subappalti: verificare documenti_contratto_sub, lavoratori_sub, pagamenti_sub.
- Bucket Storage aziende-assets (logo e carta intestata).
- Controllo accesso: i ruoli sono decorativi, enforcement reale solo via moduli_abilitati.
- Notifiche in Impostazioni: toggle non persistiti.
- Dominio mittente Resend (sq360.app).
- src/lib/supabase.ts: modifiche non committate da rivedere.

## DECISIONI PERMANENTI (non rimettere in discussione)
- SAL Attivi resta com'e: impresa prepara la proposta, DL certifica, impresa registra il SAL ufficiale (upload PDF DL) e genera la fattura.
- Verbale consegna, ODS, verbali sospensione: li emette il DL; l'impresa li riceve, firma/archivia.
- Varianti: impresa propone, RUP/SA approvano.
- SAL Passivi: solo subappaltatori (DURC valido per autorizzare).
- Forniture: ODA -> DDT (verifica) -> fattura passiva. Nolo/manodopera: ODA -> rapportini -> fattura. La fattura passiva e sempre lo strumento di pagamento.
- La WBS e il filo di tutto: computo -> RDA -> RDO -> ODA -> DDT -> fattura -> CE.
- Principio AI: "il geometra fotografa, l'AI fa il resto"; l'ufficio approva.

## RLS Supabase — sintassi che funziona
CREATE POLICY "nome" ON tabella FOR ALL TO authenticated USING (true) WITH CHECK (true);
(il filtro azienda_id e nel codice; le versioni con get_azienda_id() o subquery su utenti hanno dato errore 42703 in questo progetto)
