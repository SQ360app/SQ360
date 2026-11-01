-- ═══════════════════════════════════════════════════════════════════════════
-- SQ360 — Isolamento tra aziende (01/11/2026) · 0. VERIFICA PRELIMINARE
-- Estratto parola per parola da 20261101_isolamento_aziende.sql con tests/isolamento/dividi-migrazione.mjs
-- (non modificare a mano: rigenerare). Ordine: 0 → 1 (→ 2 solo per tornare indietro).
-- Sola lettura: nessuna modifica al database. Da eseguire PRIMA di 1_applica.
-- Atteso: righe_senza_azienda = 0 ovunque (altrimenti quelle righe diventerebbero invisibili).
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'accessi_cantiere' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."accessi_cantiere" x
UNION ALL
SELECT 'analisi_extra_voce' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."analisi_extra_voce" x
UNION ALL
SELECT 'analisi_prezzi_tariffa' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."analisi_prezzi_tariffa" x
UNION ALL
SELECT 'azienda_sedi' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."azienda_sedi" x
UNION ALL
SELECT 'certificazioni_dam' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (CASE WHEN o1.commessa_id IS NOT NULL THEN (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) ELSE o1.azienda_id END) FROM public.dam o1 WHERE o1.id = x.dam_id) IS NULL) AS righe_senza_azienda FROM public."certificazioni_dam" x
UNION ALL
SELECT 'commessa_figure' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."commessa_figure" x
UNION ALL
SELECT 'commessa_riserve' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."commessa_riserve" x
UNION ALL
SELECT 'commessa_sospensioni' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."commessa_sospensioni" x
UNION ALL
SELECT 'commesse' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."commesse" x
UNION ALL
SELECT 'computo_metrico' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."computo_metrico" x
UNION ALL
SELECT 'computo_wbs_link' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT (CASE WHEN o2.commessa_id IS NOT NULL THEN (SELECT c2.azienda_id FROM public.commesse c2 WHERE c2.id = o2.commessa_id) ELSE o2.azienda_id END) FROM public.computo_metrico o2 WHERE o2.id = o1.computo_id) FROM public.voci_computo o1 WHERE o1.id = x.voce_computo_id) IS NULL) AS righe_senza_azienda FROM public."computo_wbs_link" x
UNION ALL
SELECT 'contratti' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."contratti" x
UNION ALL
SELECT 'contratti_sub' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."contratti_sub" x
UNION ALL
SELECT 'costi_diretti' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."costi_diretti" x
UNION ALL
SELECT 'dam' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."dam" x
UNION ALL
SELECT 'ddt' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."ddt" x
UNION ALL
SELECT 'documenti_commessa' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."documenti_commessa" x
UNION ALL
SELECT 'documenti_contratto_sub' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."documenti_contratto_sub" x
UNION ALL
SELECT 'documenti_fornitore' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT o1.azienda_id FROM public.fornitori o1 WHERE o1.id = x.fornitore_id) IS NULL) AS righe_senza_azienda FROM public."documenti_fornitore" x
UNION ALL
SELECT 'documenti_progettista' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT o1.azienda_id FROM public.progettisti o1 WHERE o1.id = x.progettista_id) IS NULL) AS righe_senza_azienda FROM public."documenti_progettista" x
UNION ALL
SELECT 'documenti_sicurezza' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."documenti_sicurezza" x
UNION ALL
SELECT 'elenco_prezzi' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."elenco_prezzi" x
UNION ALL
SELECT 'email_log' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."email_log" x
UNION ALL
SELECT 'fatture' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."fatture" x
UNION ALL
SELECT 'fatture_passive' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."fatture_passive" x
UNION ALL
SELECT 'fornitori' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."fornitori" x
UNION ALL
SELECT 'gare' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."gare" x
UNION ALL
SELECT 'giornale_lavori' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."giornale_lavori" x
UNION ALL
SELECT 'lavoratori_commessa' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."lavoratori_commessa" x
UNION ALL
SELECT 'lavoratori_sub' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."lavoratori_sub" x
UNION ALL
SELECT 'migliorie' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."migliorie" x
UNION ALL
SELECT 'misure' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) FROM public.voci_ep o1 WHERE o1.id = x.voce_id) IS NULL) AS righe_senza_azienda FROM public."misure" x
UNION ALL
SELECT 'misure_voce' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT (CASE WHEN o2.commessa_id IS NOT NULL THEN (SELECT c2.azienda_id FROM public.commesse c2 WHERE c2.id = o2.commessa_id) ELSE o2.azienda_id END) FROM public.computo_metrico o2 WHERE o2.id = o1.computo_id) FROM public.voci_computo o1 WHERE o1.id = x.voce_id) IS NULL) AS righe_senza_azienda FROM public."misure_voce" x
UNION ALL
SELECT 'nuovi_prezzi' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."nuovi_prezzi" x
UNION ALL
SELECT 'oda' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."oda" x
UNION ALL
SELECT 'oda_consegne' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."oda_consegne" x
UNION ALL
SELECT 'offerte_rdo' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."offerte_rdo" x
UNION ALL
SELECT 'ordini_servizio' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."ordini_servizio" x
UNION ALL
SELECT 'pacchetti_lavoro' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."pacchetti_lavoro" x
UNION ALL
SELECT 'pagamenti_sub' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."pagamenti_sub" x
UNION ALL
SELECT 'presenze_cantiere' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."presenze_cantiere" x
UNION ALL
SELECT 'preventivi' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."preventivi" x
UNION ALL
SELECT 'preventivi_fornitori' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."preventivi_fornitori" x
UNION ALL
SELECT 'preventivo_voci' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) FROM public.preventivi o1 WHERE o1.id = x.preventivo_id) IS NULL) AS righe_senza_azienda FROM public."preventivo_voci" x
UNION ALL
SELECT 'professionisti_fornitori' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."professionisti_fornitori" x
UNION ALL
SELECT 'progettisti' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."progettisti" x
UNION ALL
SELECT 'rapportini' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."rapportini" x
UNION ALL
SELECT 'rda' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."rda" x
UNION ALL
SELECT 'rda_voci' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (CASE WHEN o1.commessa_id IS NOT NULL THEN (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) ELSE o1.azienda_id END) FROM public.rda o1 WHERE o1.id = x.rda_id) IS NULL) AS righe_senza_azienda FROM public."rda_voci" x
UNION ALL
SELECT 'rdo' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."rdo" x
UNION ALL
SELECT 'rdo_fornitori' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT o1.azienda_id FROM public.fornitori o1 WHERE o1.id = x.fornitore_id) IS NULL) AS righe_senza_azienda FROM public."rdo_fornitori" x
UNION ALL
SELECT 'rdo_voci' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) FROM public.richieste_offerta o1 WHERE o1.id = x.rdo_id) IS NULL) AS righe_senza_azienda FROM public."rdo_voci" x
UNION ALL
SELECT 'registro_contabilita' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."registro_contabilita" x
UNION ALL
SELECT 'richieste_offerta' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."richieste_offerta" x
UNION ALL
SELECT 'riserve' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."riserve" x
UNION ALL
SELECT 'sal' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."sal" x
UNION ALL
SELECT 'sal_attivi' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."sal_attivi" x
UNION ALL
SELECT 'sal_attivo_voci' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) FROM public.sal_attivi o1 WHERE o1.id = x.sal_id) IS NULL) AS righe_senza_azienda FROM public."sal_attivo_voci" x
UNION ALL
SELECT 'sal_passivi' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."sal_passivi" x
UNION ALL
SELECT 'sal_passivo_voci' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (CASE WHEN o1.commessa_id IS NOT NULL THEN (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) ELSE o1.azienda_id END) FROM public.sal_passivi o1 WHERE o1.id = x.sal_passivo_id) IS NULL) AS righe_senza_azienda FROM public."sal_passivo_voci" x
UNION ALL
SELECT 'sal_righe' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) FROM public.sals o1 WHERE o1.id = x.sal_id) IS NULL) AS righe_senza_azienda FROM public."sal_righe" x
UNION ALL
SELECT 'sal_voci' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (CASE WHEN o1.commessa_id IS NOT NULL THEN (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) ELSE o1.azienda_id END) FROM public.sal o1 WHERE o1.id = x.sal_id) IS NULL) AS righe_senza_azienda FROM public."sal_voci" x
UNION ALL
SELECT 'sals' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."sals" x
UNION ALL
SELECT 'scadenzario' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."scadenzario" x
UNION ALL
SELECT 'soggetto_referenti' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT o1.azienda_id FROM public.professionisti_fornitori o1 WHERE o1.id = x.soggetto_id) IS NULL) AS righe_senza_azienda FROM public."soggetto_referenti" x
UNION ALL
SELECT 'spese_cantiere' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."spese_cantiere" x
UNION ALL
SELECT 'tariffa_componenti' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) FROM public.tariffe o1 WHERE o1.id = x.tariffa_id) IS NULL) AS righe_senza_azienda FROM public."tariffa_componenti" x
UNION ALL
SELECT 'tariffe' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."tariffe" x
UNION ALL
SELECT 'task_pianificazione' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."task_pianificazione" x
UNION ALL
SELECT 'utenti' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."utenti" x
UNION ALL
SELECT 'variante_diff' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (CASE WHEN o1.commessa_id IS NOT NULL THEN (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) ELSE o1.azienda_id END) FROM public.varianti o1 WHERE o1.id = x.variante_id) IS NULL) AS righe_senza_azienda FROM public."variante_diff" x
UNION ALL
SELECT 'varianti' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."varianti" x
UNION ALL
SELECT 'voce_assegnazione' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."voce_assegnazione" x
UNION ALL
SELECT 'voci_assegnazione' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."voci_assegnazione" x
UNION ALL
SELECT 'voci_computo' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (CASE WHEN o1.commessa_id IS NOT NULL THEN (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) ELSE o1.azienda_id END) FROM public.computo_metrico o1 WHERE o1.id = x.computo_id) IS NULL) AS righe_senza_azienda FROM public."voci_computo" x
UNION ALL
SELECT 'voci_computo_misurazioni' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (SELECT (CASE WHEN o2.commessa_id IS NOT NULL THEN (SELECT c2.azienda_id FROM public.commesse c2 WHERE c2.id = o2.commessa_id) ELSE o2.azienda_id END) FROM public.computo_metrico o2 WHERE o2.id = o1.computo_id) FROM public.voci_computo o1 WHERE o1.id = x.voce_computo_id) IS NULL) AS righe_senza_azienda FROM public."voci_computo_misurazioni" x
UNION ALL
SELECT 'voci_contratto' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (CASE WHEN o1.commessa_id IS NOT NULL THEN (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) ELSE o1.azienda_id END) FROM public.contratti o1 WHERE o1.id = x.contratto_id) IS NULL) AS righe_senza_azienda FROM public."voci_contratto" x
UNION ALL
SELECT 'voci_ep' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."voci_ep" x
UNION ALL
SELECT 'voci_sal' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT (CASE WHEN o1.commessa_id IS NOT NULL THEN (SELECT c1.azienda_id FROM public.commesse c1 WHERE c1.id = o1.commessa_id) ELSE o1.azienda_id END) FROM public.sal o1 WHERE o1.id = x.sal_id) IS NULL) AS righe_senza_azienda FROM public."voci_sal" x
UNION ALL
SELECT 'voci_variante' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."voci_variante" x
UNION ALL
SELECT 'wbs_commessa' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."wbs_commessa" x
UNION ALL
SELECT 'wbs_nodes' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (CASE WHEN x.commessa_id IS NOT NULL THEN (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) ELSE x.azienda_id END) IS NULL) AS righe_senza_azienda FROM public."wbs_nodes" x
UNION ALL
SELECT 'wbs_nodi' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE (SELECT c0.azienda_id FROM public.commesse c0 WHERE c0.id = x.commessa_id) IS NULL) AS righe_senza_azienda FROM public."wbs_nodi" x
UNION ALL
SELECT 'wbs_templates' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE x.azienda_id IS NULL) AS righe_senza_azienda FROM public."wbs_templates" x
ORDER BY righe_senza_azienda DESC, tabella;
