-- ═══════════════════════════════════════════════════════════════════════════
-- SQ360 — Regole RLS per le tabelle con RLS attiva e nessuna regola (31/10/2026)
--
-- Oggi queste tabelle rifiutano QUALSIASI lettura/scrittura degli utenti
-- collegati (RLS attiva senza regole = tutto negato). Criterio unico:
--   azienda_id = (SELECT public.get_azienda_id())
-- applicato direttamente (a), tramite commesse.azienda_id (b) o risalendo la
-- tabella madre fino a commesse/azienda (c). Solo ruolo authenticated: nessuna
-- regola per anon. Tutte le tabelle sono oggi vuote (verificato in sola lettura).
--
-- NON incluse (vedi note in fondo):
--   contratto_voci             → collegamento ambiguo (contratto_id senza FK)
--   user_aziende               → tabella di sistema, proposta da approvare
--   config_soglie_approvazione → configurazione globale, proposta da approvare
--
-- Rieseguibile: ogni regola viene prima eliminata se esiste.
-- In fondo: SQL per tornare indietro (commentato).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── accessi_cantiere ─────────────────────────────────────────────────────────
-- Classe (b): commessa_id → commesse.azienda_id
-- Usata da: nessuna pagina oggi (registro accessi di cantiere, previsto)
DROP POLICY IF EXISTS accessi_cantiere_azienda ON public.accessi_cantiere;
CREATE POLICY accessi_cantiere_azienda ON public.accessi_cantiere FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c WHERE c.id = accessi_cantiere.commessa_id AND c.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c WHERE c.id = accessi_cantiere.commessa_id AND c.azienda_id = (SELECT public.get_azienda_id())));


-- ── audit_trail ──────────────────────────────────────────────────────────────
-- Classe (d): registro di sistema, senza azienda_id.
-- Solo INSERT (dell'utente stesso) e lettura dei movimenti degli utenti della
-- propria azienda (utente_id → utenti.azienda_id). Nessun UPDATE/DELETE:
-- il registro non è modificabile dall'app.
-- Usata da: nessuna pagina oggi
DROP POLICY IF EXISTS audit_trail_inserimento ON public.audit_trail;
CREATE POLICY audit_trail_inserimento ON public.audit_trail FOR INSERT TO authenticated
  WITH CHECK (utente_id = auth.uid());
DROP POLICY IF EXISTS audit_trail_lettura ON public.audit_trail;
CREATE POLICY audit_trail_lettura ON public.audit_trail FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.utenti u WHERE u.id = audit_trail.utente_id AND u.azienda_id = (SELECT public.get_azienda_id())));


-- ── certificazioni_dam ───────────────────────────────────────────────────────
-- Classe (c): dam_id → dam (azienda_id, oppure commessa_id → commesse)
-- Usata da: SAM globale (/dashboard/dam) — checklist certificazioni del SAM
DROP POLICY IF EXISTS certificazioni_dam_azienda ON public.certificazioni_dam;
CREATE POLICY certificazioni_dam_azienda ON public.certificazioni_dam FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dam d WHERE d.id = certificazioni_dam.dam_id AND (
           d.azienda_id = (SELECT public.get_azienda_id())
           OR EXISTS (SELECT 1 FROM public.commesse c WHERE c.id = d.commessa_id AND c.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dam d WHERE d.id = certificazioni_dam.dam_id AND (
           d.azienda_id = (SELECT public.get_azienda_id())
           OR EXISTS (SELECT 1 FROM public.commesse c WHERE c.id = d.commessa_id AND c.azienda_id = (SELECT public.get_azienda_id())))));


-- ── documenti_fornitore ──────────────────────────────────────────────────────
-- Classe (c): fornitore_id → fornitori.azienda_id (tabella fornitori legacy)
-- Usata da: nessuna pagina oggi
DROP POLICY IF EXISTS documenti_fornitore_azienda ON public.documenti_fornitore;
CREATE POLICY documenti_fornitore_azienda ON public.documenti_fornitore FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.fornitori f WHERE f.id = documenti_fornitore.fornitore_id AND f.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fornitori f WHERE f.id = documenti_fornitore.fornitore_id AND f.azienda_id = (SELECT public.get_azienda_id())));


-- ── documenti_progettista ────────────────────────────────────────────────────
-- Classe (c): progettista_id → progettisti.azienda_id
-- Usata da: nessuna pagina oggi
DROP POLICY IF EXISTS documenti_progettista_azienda ON public.documenti_progettista;
CREATE POLICY documenti_progettista_azienda ON public.documenti_progettista FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.progettisti p WHERE p.id = documenti_progettista.progettista_id AND p.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.progettisti p WHERE p.id = documenti_progettista.progettista_id AND p.azienda_id = (SELECT public.get_azienda_id())));


-- ── documenti_sicurezza ──────────────────────────────────────────────────────
-- Classe (a): azienda_id diretto (scritto da Sicurezza e Archivio)
-- Usata da: Cantiere → Sicurezza (documenti + AI), Archivio (checklist sub),
--           Dashboard (DURC/scaduti/scadenziario). Il cron DURC usa la service role.
DROP POLICY IF EXISTS documenti_sicurezza_azienda ON public.documenti_sicurezza;
CREATE POLICY documenti_sicurezza_azienda ON public.documenti_sicurezza FOR ALL TO authenticated
  USING      (azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (azienda_id = (SELECT public.get_azienda_id()));


-- ── giornale_lavori ──────────────────────────────────────────────────────────
-- Classe (a): azienda_id diretto (scritto dal Giornale lavori)
-- Usata da: Cantiere → Giornale
DROP POLICY IF EXISTS giornale_lavori_azienda ON public.giornale_lavori;
CREATE POLICY giornale_lavori_azienda ON public.giornale_lavori FOR ALL TO authenticated
  USING      (azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (azienda_id = (SELECT public.get_azienda_id()));


-- ── pacchetti_lavoro ─────────────────────────────────────────────────────────
-- Classe (a): azienda_id diretto (FK azienda)
-- Usata da: nessuna pagina oggi (pacchetti di voci assegnati a un fornitore)
DROP POLICY IF EXISTS pacchetti_lavoro_azienda ON public.pacchetti_lavoro;
CREATE POLICY pacchetti_lavoro_azienda ON public.pacchetti_lavoro FOR ALL TO authenticated
  USING      (azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (azienda_id = (SELECT public.get_azienda_id()));


-- ── preventivi_fornitori ─────────────────────────────────────────────────────
-- Classe (b): commessa_id → commesse, oppure gara_id → gare.azienda_id
-- (un preventivo può riferirsi a una gara non ancora diventata commessa)
-- Usata da: nessuna pagina oggi
DROP POLICY IF EXISTS preventivi_fornitori_azienda ON public.preventivi_fornitori;
CREATE POLICY preventivi_fornitori_azienda ON public.preventivi_fornitori FOR ALL TO authenticated
  USING (
       EXISTS (SELECT 1 FROM public.commesse c WHERE c.id = preventivi_fornitori.commessa_id AND c.azienda_id = (SELECT public.get_azienda_id()))
    OR EXISTS (SELECT 1 FROM public.gare g WHERE g.id = preventivi_fornitori.gara_id AND g.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (
       EXISTS (SELECT 1 FROM public.commesse c WHERE c.id = preventivi_fornitori.commessa_id AND c.azienda_id = (SELECT public.get_azienda_id()))
    OR EXISTS (SELECT 1 FROM public.gare g WHERE g.id = preventivi_fornitori.gara_id AND g.azienda_id = (SELECT public.get_azienda_id())));


-- ── progettisti ──────────────────────────────────────────────────────────────
-- Classe (a): azienda_id diretto
-- Usata da: nessuna pagina oggi (i progettisti sono in professionisti_fornitori)
DROP POLICY IF EXISTS progettisti_azienda ON public.progettisti;
CREATE POLICY progettisti_azienda ON public.progettisti FOR ALL TO authenticated
  USING      (azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (azienda_id = (SELECT public.get_azienda_id()));


-- ── sal_attivo_voci ──────────────────────────────────────────────────────────
-- Classe (c): sal_id → sal_attivi.commessa_id → commesse (tabella legacy)
-- Usata da: nessuna pagina oggi (i SAL attivi usano sal + sal_voci)
DROP POLICY IF EXISTS sal_attivo_voci_azienda ON public.sal_attivo_voci;
CREATE POLICY sal_attivo_voci_azienda ON public.sal_attivo_voci FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sal_attivi s JOIN public.commesse c ON c.id = s.commessa_id
                      WHERE s.id = sal_attivo_voci.sal_id AND c.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sal_attivi s JOIN public.commesse c ON c.id = s.commessa_id
                      WHERE s.id = sal_attivo_voci.sal_id AND c.azienda_id = (SELECT public.get_azienda_id())));


-- ── sal_passivo_voci ─────────────────────────────────────────────────────────
-- Classe (c): sal_passivo_id → sal_passivi.commessa_id → commesse
-- Usata da: nessuna pagina oggi (SAL passivi senza dettaglio voci)
DROP POLICY IF EXISTS sal_passivo_voci_azienda ON public.sal_passivo_voci;
CREATE POLICY sal_passivo_voci_azienda ON public.sal_passivo_voci FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sal_passivi s JOIN public.commesse c ON c.id = s.commessa_id
                      WHERE s.id = sal_passivo_voci.sal_passivo_id AND c.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sal_passivi s JOIN public.commesse c ON c.id = s.commessa_id
                      WHERE s.id = sal_passivo_voci.sal_passivo_id AND c.azienda_id = (SELECT public.get_azienda_id())));


-- ── sal_voci ─────────────────────────────────────────────────────────────────
-- Classe (c): sal_id → sal.azienda_id (obbligatorio su sal)
-- Usata da: Economico/Contratto → SAL attivi ("Salva SAL": quantità del periodo)
DROP POLICY IF EXISTS sal_voci_azienda ON public.sal_voci;
CREATE POLICY sal_voci_azienda ON public.sal_voci FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sal s WHERE s.id = sal_voci.sal_id AND s.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sal s WHERE s.id = sal_voci.sal_id AND s.azienda_id = (SELECT public.get_azienda_id())));


-- ── tariffa_componenti ───────────────────────────────────────────────────────
-- Classe (c): tariffa_id → tariffe.commessa_id → commesse
-- Usata da: nessuna pagina oggi
DROP POLICY IF EXISTS tariffa_componenti_azienda ON public.tariffa_componenti;
CREATE POLICY tariffa_componenti_azienda ON public.tariffa_componenti FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.tariffe t JOIN public.commesse c ON c.id = t.commessa_id
                      WHERE t.id = tariffa_componenti.tariffa_id AND c.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tariffe t JOIN public.commesse c ON c.id = t.commessa_id
                      WHERE t.id = tariffa_componenti.tariffa_id AND c.azienda_id = (SELECT public.get_azienda_id())));


-- ── task_pianificazione ──────────────────────────────────────────────────────
-- Classe (a): azienda_id diretto (FK azienda)
-- Usata da: nessuna pagina oggi (Gantt / pianificazione)
DROP POLICY IF EXISTS task_pianificazione_azienda ON public.task_pianificazione;
CREATE POLICY task_pianificazione_azienda ON public.task_pianificazione FOR ALL TO authenticated
  USING      (azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (azienda_id = (SELECT public.get_azienda_id()));


-- ── voci_assegnazione ────────────────────────────────────────────────────────
-- Classe (b): commessa_id → commesse.azienda_id
-- Usata da: Commessa → Preventivo (assegnazione voci di computo ai fornitori)
DROP POLICY IF EXISTS voci_assegnazione_azienda ON public.voci_assegnazione;
CREATE POLICY voci_assegnazione_azienda ON public.voci_assegnazione FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c WHERE c.id = voci_assegnazione.commessa_id AND c.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c WHERE c.id = voci_assegnazione.commessa_id AND c.azienda_id = (SELECT public.get_azienda_id())));


-- ── voci_contratto ───────────────────────────────────────────────────────────
-- Classe (c): contratto_id → contratti.azienda_id (obbligatorio su contratti)
-- Usata da: nessuna pagina oggi
DROP POLICY IF EXISTS voci_contratto_azienda ON public.voci_contratto;
CREATE POLICY voci_contratto_azienda ON public.voci_contratto FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.contratti k WHERE k.id = voci_contratto.contratto_id AND k.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contratti k WHERE k.id = voci_contratto.contratto_id AND k.azienda_id = (SELECT public.get_azienda_id())));


-- ── voci_sal ─────────────────────────────────────────────────────────────────
-- Classe (c): sal_id → sal.azienda_id
-- Usata da: SAL globale (/dashboard/sal) — dettaglio voci nel join voci_sal(*)
DROP POLICY IF EXISTS voci_sal_azienda ON public.voci_sal;
CREATE POLICY voci_sal_azienda ON public.voci_sal FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sal s WHERE s.id = voci_sal.sal_id AND s.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sal s WHERE s.id = voci_sal.sal_id AND s.azienda_id = (SELECT public.get_azienda_id())));


-- ── voci_variante ────────────────────────────────────────────────────────────
-- Classe (c): variante_id → varianti.commessa_id (obbligatorio) → commesse.
-- (commessa_id diretto esiste ma è stato aggiunto il 31/10 e può essere vuoto:
--  si usa la variante, sempre valorizzata)
-- Usata da: Contratto → Varianti (voci della variante), SAL attivi (voci da varianti esecutive)
DROP POLICY IF EXISTS voci_variante_azienda ON public.voci_variante;
CREATE POLICY voci_variante_azienda ON public.voci_variante FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.varianti v JOIN public.commesse c ON c.id = v.commessa_id
                      WHERE v.id = voci_variante.variante_id AND c.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.varianti v JOIN public.commesse c ON c.id = v.commessa_id
                      WHERE v.id = voci_variante.variante_id AND c.azienda_id = (SELECT public.get_azienda_id())));


-- ═══════════════════════════════════════════════════════════════════════════
-- NON INCLUSE — da decidere
-- ═══════════════════════════════════════════════════════════════════════════
-- contratto_voci (AMBIGUA): contratto_id non ha chiave esterna e può riferirsi
--   sia a "contratti" sia a "contratti_sub" (sal_passivo_voci la usa per i SAL
--   dei subappalti). tariffa_id/componente_id sono facoltativi. Serve sapere a
--   quale tabella punta contratto_id prima di scrivere la regola.
--
-- user_aziende (sistema): associazione utente↔azienda, alternativa a
--   utenti.azienda_id. Oggi contiene 1 riga INCOERENTE (admin@sq360.it collegato
--   all'azienda demo 0000…0001 mentre in utenti è f5ddf460…) e probabilmente è la
--   fonte di mia_azienda_id(). Proposta: SOLO lettura delle proprie righe
--   (USING user_id = auth.uid()), nessuna scrittura dall'app (le gestisce il
--   server con la service role). Non scritta finché non decidi se tenerla o
--   dismetterla.
--
-- config_soglie_approvazione (configurazione globale): 3 righe di soglie
--   SPESA_CANTIERE senza azienda_id, quindi uguali per tutte le aziende.
--   Proposta: SOLO lettura per gli utenti collegati (USING true), nessuna
--   scrittura dall'app; se ogni azienda deve avere soglie proprie, aggiungere
--   azienda_id. Non scritta finché non decidi.


-- ═══════════════════════════════════════════════════════════════════════════
-- RITORNO INDIETRO (eseguire solo se serve: rimette le tabelle "tutto negato")
-- ═══════════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS accessi_cantiere_azienda      ON public.accessi_cantiere;
-- DROP POLICY IF EXISTS audit_trail_inserimento       ON public.audit_trail;
-- DROP POLICY IF EXISTS audit_trail_lettura           ON public.audit_trail;
-- DROP POLICY IF EXISTS certificazioni_dam_azienda    ON public.certificazioni_dam;
-- DROP POLICY IF EXISTS documenti_fornitore_azienda   ON public.documenti_fornitore;
-- DROP POLICY IF EXISTS documenti_progettista_azienda ON public.documenti_progettista;
-- DROP POLICY IF EXISTS documenti_sicurezza_azienda   ON public.documenti_sicurezza;
-- DROP POLICY IF EXISTS giornale_lavori_azienda       ON public.giornale_lavori;
-- DROP POLICY IF EXISTS pacchetti_lavoro_azienda      ON public.pacchetti_lavoro;
-- DROP POLICY IF EXISTS preventivi_fornitori_azienda  ON public.preventivi_fornitori;
-- DROP POLICY IF EXISTS progettisti_azienda           ON public.progettisti;
-- DROP POLICY IF EXISTS sal_attivo_voci_azienda       ON public.sal_attivo_voci;
-- DROP POLICY IF EXISTS sal_passivo_voci_azienda      ON public.sal_passivo_voci;
-- DROP POLICY IF EXISTS sal_voci_azienda              ON public.sal_voci;
-- DROP POLICY IF EXISTS tariffa_componenti_azienda    ON public.tariffa_componenti;
-- DROP POLICY IF EXISTS task_pianificazione_azienda   ON public.task_pianificazione;
-- DROP POLICY IF EXISTS voci_assegnazione_azienda     ON public.voci_assegnazione;
-- DROP POLICY IF EXISTS voci_contratto_azienda        ON public.voci_contratto;
-- DROP POLICY IF EXISTS voci_sal_azienda              ON public.voci_sal;
-- DROP POLICY IF EXISTS voci_variante_azienda         ON public.voci_variante;
