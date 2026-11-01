# SQ360 — Test di isolamento tra aziende

> Progetto di **prova** (`sq360-test`), dati inventati. Utente: admin di *Alfa Costruzioni* (A) contro i dati di *Beta Edilizia* (B), con le stesse API e regole dell'app. Ogni esito è verificato nel database (letto = riga restituita; modificato = versione della riga cambiata; inserito = riga creata con i dati di B; eliminato = riga sparita, o fermata solo da un vincolo FK). "—" = non applicabile o non provato.

## PRIMA della correzione

Data: 2026-11-01T10:28:19.830Z

- Tabelle di azienda provate: **90** · con dati di B raggiungibili da A: **39**
  - lette: 39 · modificate: 39 · inserite come B: 38 · eliminate: 39
- Viste che mostrano dati di B ad A: **7** (`v_commesse_kpi`, `v_sal_delta`, `v_sal_totale`, `v_voci_importo`, `v_voce_avanzamento`, `v_voci_importo_3strati`, `v_wbs_budget`)
- Utente NON admin di A: modifica un collega **sì**, modifica sé stesso **sì** · admin di A si sposta nell'azienda B: **sì**
- Funzioni legittime di A (sulle proprie righe) diverse dall'atteso: **8** — `utenti.eliminato`, `aziende.eliminato`, `wbs_template.modificato`, `wbs_template.inserito`, `rdo_offerte.letto`, `rdo_offerte.modificato`, `rdo_offerte.inserito`, `rdo_offerte.eliminato`

| Tabella | Tipo | Letto | Modificato | Inserito come B | Eliminato | A sulle proprie righe (L M I E) | Causa / nota |
|---|---|---|---|---|---|---|---|
| `accessi_cantiere` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "accessi_cantiere" |
| `analisi_extra_voce` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "analisi_extra_voce" |
| `analisi_prezzi_tariffa` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "analisi_prezzi_tariffa" |
| `audit_trail` | audit | no | no | no | no | L✓ M✗ I✓ E✗ | 42501 new row violates row-level security policy for table "audit_trail" |
| `azienda` | riga_azienda | no | no | no | no | L✓ M✓ I✗ E✗ | 42501 new row violates row-level security policy for table "azienda" |
| `azienda_sedi` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "azienda_sedi" |
| `aziende` | riga_azienda | no | no | no | no | L✓ M✓ I✗ E✓⚠ | 42501 new row violates row-level security policy for table "aziende" |
| `categorie_c` | globale_invariata | — | — | — | — | L✓ M✗ I✗ E· |  |
| `categorie_sb` | globale_invariata | — | — | — | — | L✓ M✗ I✗ E· |  |
| `categorie_sc` | globale_invariata | — | — | — | — | L✓ M✗ I✗ E· |  |
| `certificazioni_dam` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "certificazioni_dam" |
| `commessa_figure` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "auth_all_cf" USING true; regola "auth_all_commessa_figure" USING true |
| `commessa_riserve` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "ris_all": basta il login |
| `commessa_sospensioni` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "sos_all": basta il login |
| `commesse` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "commesse" |
| `computo_metrico` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `computo_wbs_link` | figlia | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `config_soglie_approvazione` | bloccata | — | — | — | — | L✗ M✗ I✗ E· |  |
| `contratti` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "contratti" |
| `contratti_sub` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta; regola "allow_all_cs" USING true; regola "cs_auth": basta il login |
| `contratto_voci` | bloccata | no | no | no | no | L✗ M✗ I✗ E✗ | 42501 new row violates row-level security policy for table "contratto_voci" |
| `costi_diretti` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `dam` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "allow_all_dam" USING true; regola "dam_auth": basta il login |
| `ddt` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "ddt" |
| `documenti_commessa` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `documenti_contratto_sub` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_contratto_sub" |
| `documenti_fornitore` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_fornitore" |
| `documenti_progettista` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_progettista" |
| `documenti_sicurezza` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_sicurezza" |
| `elenco_prezzi` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "elenco_prezzi" |
| `email_log` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "email_log" |
| `fatture` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `fatture_passive` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "allow_all_fp" USING true |
| `fornitori` | azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `gare` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "gare" |
| `giornale_lavori` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "giornale_lavori" |
| `lavoratori_commessa` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "lavoratori_commessa" |
| `lavoratori_sub` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "lavoratori_sub" |
| `migliorie` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "migliorie" |
| `misure` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "misure" |
| `misure_voce` | figlia | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `nuovi_prezzi` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "np_auth" USING true |
| `oda` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "oda" |
| `oda_consegne` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "ddt_all": basta il login |
| `offerte_rdo` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "offerte_all": basta il login |
| `ordini_servizio` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "ordini_servizio" |
| `pacchetti_lavoro` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "pacchetti_lavoro" |
| `pagamenti_sub` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "pagamenti_sub" |
| `presenze_cantiere` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "presenze_cantiere" |
| `preventivi` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `preventivi_fornitori` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "preventivi_fornitori" |
| `preventivo_voci` | figlia | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `professionisti_fornitori` | azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "auth_all_pf" USING true; regola "auth_read_professionisti" USING true; regola "auth_write_professionisti" USING true |
| `progettisti` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "progettisti" |
| `rapportini` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `rda` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "rda" |
| `rda_voci` | figlia | no | — | — | no | L✓ M· I· E✓ | nessuna colonna modificabile |
| `rdo` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "rdo" |
| `rdo_fornitori` | figlia | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `rdo_offerte` | bloccata | **sì** | **sì** | **sì** | **sì** | L✓⚠ M✓⚠ I✓⚠ E✓⚠ | regola "allow_all_ro" USING true; regola "rdooff_all": basta il login |
| `rdo_voci` | figlia | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `registro_contabilita` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "registro_contabilita" |
| `richieste_offerta` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `riserve` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "riserve_auth" USING true |
| `sal` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal" |
| `sal_attivi` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `sal_attivo_voci` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal_attivo_voci" |
| `sal_passivi` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "salp_all": basta il login |
| `sal_passivo_voci` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal_passivo_voci" |
| `sal_righe` | figlia | no | no | no | no | L✓ M✓ I· E✓ | 42501 new row violates row-level security policy for table "sal_righe" |
| `sal_voci` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal_voci" |
| `sals` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sals" |
| `scadenzario` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `soggetto_referenti` | figlia | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `spese_cantiere` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta; regola "allow_all_sc" USING true; regola "spese_auth": basta il login |
| `tariffa_componenti` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "tariffa_componenti" |
| `tariffe` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `task_pianificazione` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "task_pianificazione" |
| `user_aziende` | bloccata | no | no | — | no | L✗ M✗ I· E✗ | chiave composta: non provato |
| `utenti` | utenti | **sì** | **sì** | — | **sì** | L✓ M✓ I· E✓⚠ | RLS spenta |
| `variante_diff` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "variante_diff" |
| `varianti` | commessa_o_azienda | no | no | no | no | L✓ M· I✓ E✓ | 42501 new row violates row-level security policy for table "varianti" |
| `voce_assegnazione` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "allow_all_va" USING true |
| `voci_assegnazione` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_assegnazione" |
| `voci_computo` | figlia | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta |
| `voci_computo_misurazioni` | figlia | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "vcm_all" USING true |
| `voci_contratto` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_contratto" |
| `voci_ep` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_ep" |
| `voci_sal` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_sal" |
| `voci_variante` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_variante" |
| `wbs_commessa` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "wbs_commessa_rls" USING true |
| `wbs_nodes` | commessa_o_azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "wbs_nodes_auth" USING true |
| `wbs_nodi` | commessa | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | RLS spenta; regola "wbs_auth": basta il login |
| `wbs_template` | globale_lettura | — | — | — | — | L✓ M✓⚠ I✓⚠ E· |  |
| `wbs_templates` | azienda | **sì** | **sì** | **sì** | **sì** | L✓ M✓ I✓ E✓ | regola "wbs_templates_auth" USING true |

**Viste**

| Vista | Mostra dati di B ad A | Righe di B nel DB | A vede le proprie righe (viste/nel DB) | Opzioni |
|---|---|---|---|---|
| `v_commesse_kpi` | **sì** | 1 | 1/1 ✓ | senza security_invoker (salta le RLS) |
| `v_sal_delta` | **sì** | 1 | 1/1 ✓ | senza security_invoker (salta le RLS) |
| `v_sal_totale` | **sì** | 1 | 1/1 ✓ | senza security_invoker (salta le RLS) |
| `v_scadenze_prossime` | — | — | — | security_invoker=true |
| `v_voci_importo` | **sì** | 1 | 1/1 ✓ | senza security_invoker (salta le RLS) |
| `v_voce_avanzamento` | **sì** | 1 | 1/1 ✓ | senza security_invoker (salta le RLS) |
| `v_voci_importo_3strati` | **sì** | 3 | 815/815 ✓ | senza security_invoker (salta le RLS) |
| `v_wbs_budget` | **sì** | 1 | 1/1 ✓ | senza security_invoker (salta le RLS) |

Legenda "A sulle proprie righe": ✓ riuscito · ✗ bloccato · · non provato · ⚠ diverso da quanto previsto per quel tipo di tabella.

**Errori non dovuti ai permessi** (l'operazione è fallita per altri motivi: su quella cella il test non è conclusivo)

| Tabella | Chi | Operazione | Errore |
|---|---|---|---|
| `sal_righe` | A su A | inserito | 23505 duplicate key value violates unique constraint "sal_righe_sal_id_voce_id_key" |
| `varianti` | A su A | modificato | 42703 record "new" has no field "updated_at" |

## DOPO la correzione (migrazione 20261101_isolamento_aziende.sql)

Data: 2026-11-01T10:32:00.886Z

- Tabelle di azienda provate: **90** · con dati di B raggiungibili da A: **0**
  - lette: 0 · modificate: 0 · inserite come B: 0 · eliminate: 0
- Viste che mostrano dati di B ad A: **0**
- Utente NON admin di A: modifica un collega no, modifica sé stesso no · admin di A si sposta nell'azienda B: no
- Funzioni legittime di A (sulle proprie righe) diverse dall'atteso: **0**

| Tabella | Tipo | Letto | Modificato | Inserito come B | Eliminato | A sulle proprie righe (L M I E) | Causa / nota |
|---|---|---|---|---|---|---|---|
| `accessi_cantiere` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "accessi_cantiere" |
| `analisi_extra_voce` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "analisi_extra_voce" |
| `analisi_prezzi_tariffa` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "analisi_prezzi_tariffa" |
| `audit_trail` | audit | no | no | no | no | L✓ M✗ I✓ E✗ | 42501 new row violates row-level security policy for table "audit_trail" |
| `azienda` | riga_azienda | no | no | no | no | L✓ M✓ I✗ E✗ | 42501 new row violates row-level security policy for table "azienda" |
| `azienda_sedi` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "azienda_sedi" |
| `aziende` | riga_azienda | no | no | no | no | L✓ M✓ I✗ E✗ | 42501 new row violates row-level security policy for table "aziende" |
| `categorie_c` | globale_invariata | — | — | — | — | L✓ M✗ I✗ E· |  |
| `categorie_sb` | globale_invariata | — | — | — | — | L✓ M✗ I✗ E· |  |
| `categorie_sc` | globale_invariata | — | — | — | — | L✓ M✗ I✗ E· |  |
| `certificazioni_dam` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "certificazioni_dam" |
| `commessa_figure` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "commessa_figure" |
| `commessa_riserve` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "commessa_riserve" |
| `commessa_sospensioni` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "commessa_sospensioni" |
| `commesse` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "commesse" |
| `computo_metrico` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "computo_metrico" |
| `computo_wbs_link` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "computo_wbs_link" |
| `config_soglie_approvazione` | bloccata | — | — | — | — | L✗ M✗ I✗ E· |  |
| `contratti` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "contratti" |
| `contratti_sub` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "contratti_sub" |
| `contratto_voci` | bloccata | no | no | no | no | L✗ M✗ I✗ E✗ | 42501 new row violates row-level security policy for table "contratto_voci" |
| `costi_diretti` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "costi_diretti" |
| `dam` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "dam" |
| `ddt` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "ddt" |
| `documenti_commessa` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_commessa" |
| `documenti_contratto_sub` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_contratto_sub" |
| `documenti_fornitore` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_fornitore" |
| `documenti_progettista` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_progettista" |
| `documenti_sicurezza` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "documenti_sicurezza" |
| `elenco_prezzi` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "elenco_prezzi" |
| `email_log` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "email_log" |
| `fatture` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "fatture" |
| `fatture_passive` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "fatture_passive" |
| `fornitori` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "fornitori" |
| `gare` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "gare" |
| `giornale_lavori` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "giornale_lavori" |
| `lavoratori_commessa` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "lavoratori_commessa" |
| `lavoratori_sub` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "lavoratori_sub" |
| `migliorie` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "migliorie" |
| `misure` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "misure" |
| `misure_voce` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "misure_voce" |
| `nuovi_prezzi` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "nuovi_prezzi" |
| `oda` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "oda" |
| `oda_consegne` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "oda_consegne" |
| `offerte_rdo` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "offerte_rdo" |
| `ordini_servizio` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "ordini_servizio" |
| `pacchetti_lavoro` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "pacchetti_lavoro" |
| `pagamenti_sub` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "pagamenti_sub" |
| `presenze_cantiere` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "presenze_cantiere" |
| `preventivi` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "preventivi" |
| `preventivi_fornitori` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "preventivi_fornitori" |
| `preventivo_voci` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "preventivo_voci" |
| `professionisti_fornitori` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "professionisti_fornitori" |
| `progettisti` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "progettisti" |
| `rapportini` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "rapportini" |
| `rda` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "rda" |
| `rda_voci` | figlia | no | — | — | no | L✓ M· I· E✓ | nessuna colonna modificabile |
| `rdo` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "rdo" |
| `rdo_fornitori` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "rdo_fornitori" |
| `rdo_offerte` | bloccata | no | no | no | no | L✗ M✗ I✗ E✗ | 42501 new row violates row-level security policy for table "rdo_offerte" |
| `rdo_voci` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "rdo_voci" |
| `registro_contabilita` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "registro_contabilita" |
| `richieste_offerta` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "richieste_offerta" |
| `riserve` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "riserve" |
| `sal` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal" |
| `sal_attivi` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal_attivi" |
| `sal_attivo_voci` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal_attivo_voci" |
| `sal_passivi` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal_passivi" |
| `sal_passivo_voci` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal_passivo_voci" |
| `sal_righe` | figlia | no | no | no | no | L✓ M✓ I· E✓ | 42501 new row violates row-level security policy for table "sal_righe" |
| `sal_voci` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sal_voci" |
| `sals` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "sals" |
| `scadenzario` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "scadenzario" |
| `soggetto_referenti` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "soggetto_referenti" |
| `spese_cantiere` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "spese_cantiere" |
| `tariffa_componenti` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "tariffa_componenti" |
| `tariffe` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "tariffe" |
| `task_pianificazione` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "task_pianificazione" |
| `user_aziende` | bloccata | no | no | — | no | L✗ M✗ I· E✗ | chiave composta: non provato |
| `utenti` | utenti | no | no | — | no | L✓ M✓ I· E✗ | id legato ad auth.users: provato a parte |
| `variante_diff` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "variante_diff" |
| `varianti` | commessa_o_azienda | no | no | no | no | L✓ M· I✓ E✓ | 42501 new row violates row-level security policy for table "varianti" |
| `voce_assegnazione` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voce_assegnazione" |
| `voci_assegnazione` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_assegnazione" |
| `voci_computo` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_computo" |
| `voci_computo_misurazioni` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_computo_misurazioni" |
| `voci_contratto` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_contratto" |
| `voci_ep` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_ep" |
| `voci_sal` | figlia | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_sal" |
| `voci_variante` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "voci_variante" |
| `wbs_commessa` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "wbs_commessa" |
| `wbs_nodes` | commessa_o_azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "wbs_nodes" |
| `wbs_nodi` | commessa | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "wbs_nodi" |
| `wbs_template` | globale_lettura | — | — | — | — | L✓ M✗ I✗ E· |  |
| `wbs_templates` | azienda | no | no | no | no | L✓ M✓ I✓ E✓ | 42501 new row violates row-level security policy for table "wbs_templates" |

**Viste**

| Vista | Mostra dati di B ad A | Righe di B nel DB | A vede le proprie righe (viste/nel DB) | Opzioni |
|---|---|---|---|---|
| `v_commesse_kpi` | no | 1 | 1/1 ✓ | security_invoker=true |
| `v_sal_delta` | no | 1 | 1/1 ✓ | security_invoker=true |
| `v_scadenze_prossime` | — | — | — | security_invoker=true |
| `v_sal_totale` | no | 1 | 1/1 ✓ | security_invoker=true |
| `v_voce_avanzamento` | no | 1 | 1/1 ✓ | security_invoker=true |
| `v_voci_importo` | no | 1 | 1/1 ✓ | security_invoker=true |
| `v_voci_importo_3strati` | no | 3 | 815/815 ✓ | security_invoker=true |
| `v_wbs_budget` | no | 1 | 1/1 ✓ | security_invoker=true |

Legenda "A sulle proprie righe": ✓ riuscito · ✗ bloccato · · non provato · ⚠ diverso da quanto previsto per quel tipo di tabella.

**Errori non dovuti ai permessi** (l'operazione è fallita per altri motivi: su quella cella il test non è conclusivo)

| Tabella | Chi | Operazione | Errore |
|---|---|---|---|
| `sal_righe` | A su A | inserito | 23505 duplicate key value violates unique constraint "sal_righe_sal_id_voce_id_key" |
| `varianti` | A su A | modificato | 42703 record "new" has no field "updated_at" |

