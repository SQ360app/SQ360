-- ═══════════════════════════════════════════════════════════════════════════
-- SQ360 — Isolamento tra aziende (01/11/2026) · 1. APPLICA
-- Estratto parola per parola da 20261101_isolamento_aziende.sql con tests/isolamento/dividi-migrazione.mjs
-- (non modificare a mano: rigenerare). Ordine: 0 → 1 (→ 2 solo per tornare indietro).
-- Transazione unica: o tutto o niente. Eseguire solo dopo 0_verifica_preliminare.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Funzioni ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_azienda_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT azienda_id FROM public.utenti WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.sono_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.utenti WHERE id = auth.uid() AND ruolo = 'admin' AND coalesce(attivo, true)) $$;
REVOKE ALL ON FUNCTION public.sono_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sono_admin() TO authenticated, service_role;

-- ── Tabelle (87) ───────────────────────────────────────────────────────

-- ── accessi_cantiere ──────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: accessi_cantiere_azienda
ALTER TABLE public."accessi_cantiere" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accessi_cantiere_azienda" ON public."accessi_cantiere";
DROP POLICY IF EXISTS "accessi_cantiere_azienda" ON public."accessi_cantiere";
CREATE POLICY "accessi_cantiere_azienda" ON public."accessi_cantiere" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = accessi_cantiere.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = accessi_cantiere.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── analisi_extra_voce ────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: analisi_extra_tenant
ALTER TABLE public."analisi_extra_voce" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analisi_extra_tenant" ON public."analisi_extra_voce";
DROP POLICY IF EXISTS "analisi_extra_voce_azienda" ON public."analisi_extra_voce";
CREATE POLICY "analisi_extra_voce_azienda" ON public."analisi_extra_voce" FOR ALL TO authenticated
  USING      (((analisi_extra_voce.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = analisi_extra_voce.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (analisi_extra_voce.commessa_id IS NULL AND analisi_extra_voce.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((analisi_extra_voce.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = analisi_extra_voce.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (analisi_extra_voce.commessa_id IS NULL AND analisi_extra_voce.azienda_id = (SELECT public.get_azienda_id()))));

-- ── analisi_prezzi_tariffa ────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: analisi_prezzi_tenant
ALTER TABLE public."analisi_prezzi_tariffa" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analisi_prezzi_tenant" ON public."analisi_prezzi_tariffa";
DROP POLICY IF EXISTS "analisi_prezzi_tariffa_azienda" ON public."analisi_prezzi_tariffa";
CREATE POLICY "analisi_prezzi_tariffa_azienda" ON public."analisi_prezzi_tariffa" FOR ALL TO authenticated
  USING      (((analisi_prezzi_tariffa.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = analisi_prezzi_tariffa.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (analisi_prezzi_tariffa.commessa_id IS NULL AND analisi_prezzi_tariffa.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((analisi_prezzi_tariffa.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = analisi_prezzi_tariffa.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (analisi_prezzi_tariffa.commessa_id IS NULL AND analisi_prezzi_tariffa.azienda_id = (SELECT public.get_azienda_id()))));

-- ── azienda_sedi ──────────────────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS attiva; regole: azienda_sedi_rls
ALTER TABLE public."azienda_sedi" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "azienda_sedi_rls" ON public."azienda_sedi";
DROP POLICY IF EXISTS "azienda_sedi_azienda" ON public."azienda_sedi";
CREATE POLICY "azienda_sedi_azienda" ON public."azienda_sedi" FOR ALL TO authenticated
  USING      (azienda_sedi.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (azienda_sedi.azienda_id = (SELECT public.get_azienda_id()));

-- ── aziende ───────────────────────────────────────────────────────────────
-- Appartenenza: la propria azienda (lettura e modifica)
-- oggi: RLS attiva; regole: vedi solo la tua azienda
ALTER TABLE public."aziende" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vedi solo la tua azienda" ON public."aziende";
DROP POLICY IF EXISTS "aziende_lettura" ON public."aziende";
DROP POLICY IF EXISTS "aziende_modifica" ON public."aziende";
CREATE POLICY "aziende_lettura" ON public."aziende" FOR SELECT TO authenticated
  USING (id = (SELECT public.get_azienda_id()));
CREATE POLICY "aziende_modifica" ON public."aziende" FOR UPDATE TO authenticated
  USING (id = (SELECT public.get_azienda_id())) WITH CHECK (id = (SELECT public.get_azienda_id()));
-- Nessuna regola INSERT/DELETE: aziende create solo dal server (/api/register).

-- ── certificazioni_dam ────────────────────────────────────────────────────
-- Appartenenza: madre dam (tramite dam_id)
-- oggi: RLS attiva; regole: certificazioni_dam_azienda
ALTER TABLE public."certificazioni_dam" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "certificazioni_dam_azienda" ON public."certificazioni_dam";
DROP POLICY IF EXISTS "certificazioni_dam_azienda" ON public."certificazioni_dam";
CREATE POLICY "certificazioni_dam_azienda" ON public."certificazioni_dam" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.dam p1 WHERE p1.id = certificazioni_dam.dam_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dam p1 WHERE p1.id = certificazioni_dam.dam_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))));

-- ── commessa_figure ───────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: auth_all_cf, auth_all_commessa_figure, commessa_figure_isolamento
ALTER TABLE public."commessa_figure" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_cf" ON public."commessa_figure";
DROP POLICY IF EXISTS "auth_all_commessa_figure" ON public."commessa_figure";
DROP POLICY IF EXISTS "commessa_figure_isolamento" ON public."commessa_figure";
DROP POLICY IF EXISTS "commessa_figure_azienda" ON public."commessa_figure";
CREATE POLICY "commessa_figure_azienda" ON public."commessa_figure" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = commessa_figure.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = commessa_figure.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── commessa_riserve ──────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: ris_all
ALTER TABLE public."commessa_riserve" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ris_all" ON public."commessa_riserve";
DROP POLICY IF EXISTS "commessa_riserve_azienda" ON public."commessa_riserve";
CREATE POLICY "commessa_riserve_azienda" ON public."commessa_riserve" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = commessa_riserve.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = commessa_riserve.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── commessa_sospensioni ──────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: sos_all
ALTER TABLE public."commessa_sospensioni" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sos_all" ON public."commessa_sospensioni";
DROP POLICY IF EXISTS "commessa_sospensioni_azienda" ON public."commessa_sospensioni";
CREATE POLICY "commessa_sospensioni_azienda" ON public."commessa_sospensioni" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = commessa_sospensioni.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = commessa_sospensioni.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── commesse ──────────────────────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS attiva; regole: commesse della mia azienda, commesse_tenant
ALTER TABLE public."commesse" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commesse della mia azienda" ON public."commesse";
DROP POLICY IF EXISTS "commesse_tenant" ON public."commesse";
DROP POLICY IF EXISTS "commesse_azienda" ON public."commesse";
CREATE POLICY "commesse_azienda" ON public."commesse" FOR ALL TO authenticated
  USING      (commesse.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (commesse.azienda_id = (SELECT public.get_azienda_id()));

-- ── computo_metrico ───────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."computo_metrico" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "computo_metrico_azienda" ON public."computo_metrico";
CREATE POLICY "computo_metrico_azienda" ON public."computo_metrico" FOR ALL TO authenticated
  USING      (((computo_metrico.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = computo_metrico.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (computo_metrico.commessa_id IS NULL AND computo_metrico.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((computo_metrico.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = computo_metrico.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (computo_metrico.commessa_id IS NULL AND computo_metrico.azienda_id = (SELECT public.get_azienda_id()))));

-- ── computo_wbs_link ──────────────────────────────────────────────────────
-- Appartenenza: madre voci_computo (tramite voce_computo_id)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."computo_wbs_link" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "computo_wbs_link_azienda" ON public."computo_wbs_link";
CREATE POLICY "computo_wbs_link_azienda" ON public."computo_wbs_link" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.voci_computo p1 WHERE p1.id = computo_wbs_link.voce_computo_id AND EXISTS (SELECT 1 FROM public.computo_metrico p2 WHERE p2.id = p1.computo_id AND ((p2.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c2 WHERE c2.id = p2.commessa_id AND c2.azienda_id = (SELECT public.get_azienda_id()))) OR (p2.commessa_id IS NULL AND p2.azienda_id = (SELECT public.get_azienda_id()))))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.voci_computo p1 WHERE p1.id = computo_wbs_link.voce_computo_id AND EXISTS (SELECT 1 FROM public.computo_metrico p2 WHERE p2.id = p1.computo_id AND ((p2.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c2 WHERE c2.id = p2.commessa_id AND c2.azienda_id = (SELECT public.get_azienda_id()))) OR (p2.commessa_id IS NULL AND p2.azienda_id = (SELECT public.get_azienda_id()))))));

-- ── contratti ─────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: contratti_tenant, pol_contratti
ALTER TABLE public."contratti" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contratti_tenant" ON public."contratti";
DROP POLICY IF EXISTS "pol_contratti" ON public."contratti";
DROP POLICY IF EXISTS "contratti_azienda" ON public."contratti";
CREATE POLICY "contratti_azienda" ON public."contratti" FOR ALL TO authenticated
  USING      (((contratti.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = contratti.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (contratti.commessa_id IS NULL AND contratti.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((contratti.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = contratti.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (contratti.commessa_id IS NULL AND contratti.azienda_id = (SELECT public.get_azienda_id()))));

-- ── contratti_sub ─────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS SPENTA; regole: allow_all_cs, cs_auth
ALTER TABLE public."contratti_sub" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_cs" ON public."contratti_sub";
DROP POLICY IF EXISTS "cs_auth" ON public."contratti_sub";
DROP POLICY IF EXISTS "contratti_sub_azienda" ON public."contratti_sub";
CREATE POLICY "contratti_sub_azienda" ON public."contratti_sub" FOR ALL TO authenticated
  USING      (((contratti_sub.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = contratti_sub.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (contratti_sub.commessa_id IS NULL AND contratti_sub.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((contratti_sub.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = contratti_sub.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (contratti_sub.commessa_id IS NULL AND contratti_sub.azienda_id = (SELECT public.get_azienda_id()))));

-- ── costi_diretti ─────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."costi_diretti" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "costi_diretti_azienda" ON public."costi_diretti";
CREATE POLICY "costi_diretti_azienda" ON public."costi_diretti" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = costi_diretti.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = costi_diretti.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── dam ───────────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: allow_all_dam, dam_auth, dam_tenant, pol_dam
ALTER TABLE public."dam" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_dam" ON public."dam";
DROP POLICY IF EXISTS "dam_auth" ON public."dam";
DROP POLICY IF EXISTS "dam_tenant" ON public."dam";
DROP POLICY IF EXISTS "pol_dam" ON public."dam";
DROP POLICY IF EXISTS "dam_azienda" ON public."dam";
CREATE POLICY "dam_azienda" ON public."dam" FOR ALL TO authenticated
  USING      (((dam.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = dam.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (dam.commessa_id IS NULL AND dam.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((dam.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = dam.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (dam.commessa_id IS NULL AND dam.azienda_id = (SELECT public.get_azienda_id()))));

-- ── ddt ───────────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: ddt_tenant
ALTER TABLE public."ddt" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ddt_tenant" ON public."ddt";
DROP POLICY IF EXISTS "ddt_azienda" ON public."ddt";
CREATE POLICY "ddt_azienda" ON public."ddt" FOR ALL TO authenticated
  USING      (((ddt.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = ddt.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (ddt.commessa_id IS NULL AND ddt.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((ddt.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = ddt.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (ddt.commessa_id IS NULL AND ddt.azienda_id = (SELECT public.get_azienda_id()))));

-- ── documenti_commessa ────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."documenti_commessa" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documenti_commessa_azienda" ON public."documenti_commessa";
CREATE POLICY "documenti_commessa_azienda" ON public."documenti_commessa" FOR ALL TO authenticated
  USING      (((documenti_commessa.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = documenti_commessa.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (documenti_commessa.commessa_id IS NULL AND documenti_commessa.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((documenti_commessa.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = documenti_commessa.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (documenti_commessa.commessa_id IS NULL AND documenti_commessa.azienda_id = (SELECT public.get_azienda_id()))));

-- ── documenti_contratto_sub ───────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS attiva; regole: doc_sub_tenant
ALTER TABLE public."documenti_contratto_sub" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doc_sub_tenant" ON public."documenti_contratto_sub";
DROP POLICY IF EXISTS "documenti_contratto_sub_azienda" ON public."documenti_contratto_sub";
CREATE POLICY "documenti_contratto_sub_azienda" ON public."documenti_contratto_sub" FOR ALL TO authenticated
  USING      (documenti_contratto_sub.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (documenti_contratto_sub.azienda_id = (SELECT public.get_azienda_id()));

-- ── documenti_fornitore ───────────────────────────────────────────────────
-- Appartenenza: madre fornitori (tramite fornitore_id)
-- oggi: RLS attiva; regole: documenti_fornitore_azienda
ALTER TABLE public."documenti_fornitore" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documenti_fornitore_azienda" ON public."documenti_fornitore";
DROP POLICY IF EXISTS "documenti_fornitore_azienda" ON public."documenti_fornitore";
CREATE POLICY "documenti_fornitore_azienda" ON public."documenti_fornitore" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.fornitori p1 WHERE p1.id = documenti_fornitore.fornitore_id AND p1.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fornitori p1 WHERE p1.id = documenti_fornitore.fornitore_id AND p1.azienda_id = (SELECT public.get_azienda_id())));

-- ── documenti_progettista ─────────────────────────────────────────────────
-- Appartenenza: madre progettisti (tramite progettista_id)
-- oggi: RLS attiva; regole: documenti_progettista_azienda
ALTER TABLE public."documenti_progettista" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documenti_progettista_azienda" ON public."documenti_progettista";
DROP POLICY IF EXISTS "documenti_progettista_azienda" ON public."documenti_progettista";
CREATE POLICY "documenti_progettista_azienda" ON public."documenti_progettista" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.progettisti p1 WHERE p1.id = documenti_progettista.progettista_id AND p1.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.progettisti p1 WHERE p1.id = documenti_progettista.progettista_id AND p1.azienda_id = (SELECT public.get_azienda_id())));

-- ── documenti_sicurezza ───────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: documenti_sicurezza_azienda
ALTER TABLE public."documenti_sicurezza" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documenti_sicurezza_azienda" ON public."documenti_sicurezza";
DROP POLICY IF EXISTS "documenti_sicurezza_azienda" ON public."documenti_sicurezza";
CREATE POLICY "documenti_sicurezza_azienda" ON public."documenti_sicurezza" FOR ALL TO authenticated
  USING      (((documenti_sicurezza.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = documenti_sicurezza.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (documenti_sicurezza.commessa_id IS NULL AND documenti_sicurezza.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((documenti_sicurezza.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = documenti_sicurezza.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (documenti_sicurezza.commessa_id IS NULL AND documenti_sicurezza.azienda_id = (SELECT public.get_azienda_id()))));

-- ── elenco_prezzi ─────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: ep_tenant
ALTER TABLE public."elenco_prezzi" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ep_tenant" ON public."elenco_prezzi";
DROP POLICY IF EXISTS "elenco_prezzi_azienda" ON public."elenco_prezzi";
CREATE POLICY "elenco_prezzi_azienda" ON public."elenco_prezzi" FOR ALL TO authenticated
  USING      (((elenco_prezzi.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = elenco_prezzi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (elenco_prezzi.commessa_id IS NULL AND elenco_prezzi.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((elenco_prezzi.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = elenco_prezzi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (elenco_prezzi.commessa_id IS NULL AND elenco_prezzi.azienda_id = (SELECT public.get_azienda_id()))));

-- ── email_log ─────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: email_log_tenant
ALTER TABLE public."email_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_log_tenant" ON public."email_log";
DROP POLICY IF EXISTS "email_log_azienda" ON public."email_log";
CREATE POLICY "email_log_azienda" ON public."email_log" FOR ALL TO authenticated
  USING      (((email_log.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = email_log.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (email_log.commessa_id IS NULL AND email_log.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((email_log.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = email_log.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (email_log.commessa_id IS NULL AND email_log.azienda_id = (SELECT public.get_azienda_id()))));

-- ── fatture ───────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS SPENTA; regole: pol_fatture
ALTER TABLE public."fatture" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pol_fatture" ON public."fatture";
DROP POLICY IF EXISTS "fatture_azienda" ON public."fatture";
CREATE POLICY "fatture_azienda" ON public."fatture" FOR ALL TO authenticated
  USING      (((fatture.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = fatture.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (fatture.commessa_id IS NULL AND fatture.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((fatture.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = fatture.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (fatture.commessa_id IS NULL AND fatture.azienda_id = (SELECT public.get_azienda_id()))));

-- ── fatture_passive ───────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: allow_all_fp, fatture_passive_tenant
ALTER TABLE public."fatture_passive" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_fp" ON public."fatture_passive";
DROP POLICY IF EXISTS "fatture_passive_tenant" ON public."fatture_passive";
DROP POLICY IF EXISTS "fatture_passive_azienda" ON public."fatture_passive";
CREATE POLICY "fatture_passive_azienda" ON public."fatture_passive" FOR ALL TO authenticated
  USING      (((fatture_passive.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = fatture_passive.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (fatture_passive.commessa_id IS NULL AND fatture_passive.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((fatture_passive.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = fatture_passive.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (fatture_passive.commessa_id IS NULL AND fatture_passive.azienda_id = (SELECT public.get_azienda_id()))));

-- ── fornitori ─────────────────────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS SPENTA; regole: pol_fornitori
ALTER TABLE public."fornitori" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pol_fornitori" ON public."fornitori";
DROP POLICY IF EXISTS "fornitori_azienda" ON public."fornitori";
CREATE POLICY "fornitori_azienda" ON public."fornitori" FOR ALL TO authenticated
  USING      (fornitori.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (fornitori.azienda_id = (SELECT public.get_azienda_id()));

-- ── gare ──────────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: gare_tenant, pol_gare
ALTER TABLE public."gare" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gare_tenant" ON public."gare";
DROP POLICY IF EXISTS "pol_gare" ON public."gare";
DROP POLICY IF EXISTS "gare_azienda" ON public."gare";
CREATE POLICY "gare_azienda" ON public."gare" FOR ALL TO authenticated
  USING      (((gare.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = gare.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (gare.commessa_id IS NULL AND gare.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((gare.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = gare.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (gare.commessa_id IS NULL AND gare.azienda_id = (SELECT public.get_azienda_id()))));

-- ── giornale_lavori ───────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: giornale_lavori_azienda
ALTER TABLE public."giornale_lavori" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "giornale_lavori_azienda" ON public."giornale_lavori";
DROP POLICY IF EXISTS "giornale_lavori_azienda" ON public."giornale_lavori";
CREATE POLICY "giornale_lavori_azienda" ON public."giornale_lavori" FOR ALL TO authenticated
  USING      (((giornale_lavori.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = giornale_lavori.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (giornale_lavori.commessa_id IS NULL AND giornale_lavori.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((giornale_lavori.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = giornale_lavori.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (giornale_lavori.commessa_id IS NULL AND giornale_lavori.azienda_id = (SELECT public.get_azienda_id()))));

-- ── lavoratori_commessa ───────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: lavoratori_commessa_azienda
ALTER TABLE public."lavoratori_commessa" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lavoratori_commessa_azienda" ON public."lavoratori_commessa";
DROP POLICY IF EXISTS "lavoratori_commessa_azienda" ON public."lavoratori_commessa";
CREATE POLICY "lavoratori_commessa_azienda" ON public."lavoratori_commessa" FOR ALL TO authenticated
  USING      (((lavoratori_commessa.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = lavoratori_commessa.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (lavoratori_commessa.commessa_id IS NULL AND lavoratori_commessa.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((lavoratori_commessa.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = lavoratori_commessa.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (lavoratori_commessa.commessa_id IS NULL AND lavoratori_commessa.azienda_id = (SELECT public.get_azienda_id()))));

-- ── lavoratori_sub ────────────────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS attiva; regole: lav_sub_tenant
ALTER TABLE public."lavoratori_sub" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lav_sub_tenant" ON public."lavoratori_sub";
DROP POLICY IF EXISTS "lavoratori_sub_azienda" ON public."lavoratori_sub";
CREATE POLICY "lavoratori_sub_azienda" ON public."lavoratori_sub" FOR ALL TO authenticated
  USING      (lavoratori_sub.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (lavoratori_sub.azienda_id = (SELECT public.get_azienda_id()));

-- ── migliorie ─────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: migliorie_tenant
ALTER TABLE public."migliorie" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "migliorie_tenant" ON public."migliorie";
DROP POLICY IF EXISTS "migliorie_azienda" ON public."migliorie";
CREATE POLICY "migliorie_azienda" ON public."migliorie" FOR ALL TO authenticated
  USING      (((migliorie.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = migliorie.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (migliorie.commessa_id IS NULL AND migliorie.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((migliorie.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = migliorie.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (migliorie.commessa_id IS NULL AND migliorie.azienda_id = (SELECT public.get_azienda_id()))));

-- ── misure ────────────────────────────────────────────────────────────────
-- Appartenenza: madre voci_ep (tramite voce_id)
-- oggi: RLS attiva; regole: misure della mia azienda
ALTER TABLE public."misure" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "misure della mia azienda" ON public."misure";
DROP POLICY IF EXISTS "misure_azienda" ON public."misure";
CREATE POLICY "misure_azienda" ON public."misure" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.voci_ep p1 WHERE p1.id = misure.voce_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.voci_ep p1 WHERE p1.id = misure.voce_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))));

-- ── misure_voce ───────────────────────────────────────────────────────────
-- Appartenenza: madre voci_computo (tramite voce_id)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."misure_voce" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "misure_voce_azienda" ON public."misure_voce";
CREATE POLICY "misure_voce_azienda" ON public."misure_voce" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.voci_computo p1 WHERE p1.id = misure_voce.voce_id AND EXISTS (SELECT 1 FROM public.computo_metrico p2 WHERE p2.id = p1.computo_id AND ((p2.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c2 WHERE c2.id = p2.commessa_id AND c2.azienda_id = (SELECT public.get_azienda_id()))) OR (p2.commessa_id IS NULL AND p2.azienda_id = (SELECT public.get_azienda_id()))))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.voci_computo p1 WHERE p1.id = misure_voce.voce_id AND EXISTS (SELECT 1 FROM public.computo_metrico p2 WHERE p2.id = p1.computo_id AND ((p2.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c2 WHERE c2.id = p2.commessa_id AND c2.azienda_id = (SELECT public.get_azienda_id()))) OR (p2.commessa_id IS NULL AND p2.azienda_id = (SELECT public.get_azienda_id()))))));

-- ── nuovi_prezzi ──────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: np_auth
ALTER TABLE public."nuovi_prezzi" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "np_auth" ON public."nuovi_prezzi";
DROP POLICY IF EXISTS "nuovi_prezzi_azienda" ON public."nuovi_prezzi";
CREATE POLICY "nuovi_prezzi_azienda" ON public."nuovi_prezzi" FOR ALL TO authenticated
  USING      (((nuovi_prezzi.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = nuovi_prezzi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (nuovi_prezzi.commessa_id IS NULL AND nuovi_prezzi.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((nuovi_prezzi.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = nuovi_prezzi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (nuovi_prezzi.commessa_id IS NULL AND nuovi_prezzi.azienda_id = (SELECT public.get_azienda_id()))));

-- ── oda ───────────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: oda della mia azienda, oda_tenant
ALTER TABLE public."oda" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oda della mia azienda" ON public."oda";
DROP POLICY IF EXISTS "oda_tenant" ON public."oda";
DROP POLICY IF EXISTS "oda_azienda" ON public."oda";
CREATE POLICY "oda_azienda" ON public."oda" FOR ALL TO authenticated
  USING      (((oda.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = oda.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (oda.commessa_id IS NULL AND oda.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((oda.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = oda.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (oda.commessa_id IS NULL AND oda.azienda_id = (SELECT public.get_azienda_id()))));

-- ── oda_consegne ──────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: ddt_all
ALTER TABLE public."oda_consegne" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ddt_all" ON public."oda_consegne";
DROP POLICY IF EXISTS "oda_consegne_azienda" ON public."oda_consegne";
CREATE POLICY "oda_consegne_azienda" ON public."oda_consegne" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = oda_consegne.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = oda_consegne.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── offerte_rdo ───────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: offerte_all
ALTER TABLE public."offerte_rdo" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offerte_all" ON public."offerte_rdo";
DROP POLICY IF EXISTS "offerte_rdo_azienda" ON public."offerte_rdo";
CREATE POLICY "offerte_rdo_azienda" ON public."offerte_rdo" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = offerte_rdo.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = offerte_rdo.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── ordini_servizio ───────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: os della mia azienda, os_tenant
ALTER TABLE public."ordini_servizio" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "os della mia azienda" ON public."ordini_servizio";
DROP POLICY IF EXISTS "os_tenant" ON public."ordini_servizio";
DROP POLICY IF EXISTS "ordini_servizio_azienda" ON public."ordini_servizio";
CREATE POLICY "ordini_servizio_azienda" ON public."ordini_servizio" FOR ALL TO authenticated
  USING      (((ordini_servizio.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = ordini_servizio.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (ordini_servizio.commessa_id IS NULL AND ordini_servizio.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((ordini_servizio.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = ordini_servizio.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (ordini_servizio.commessa_id IS NULL AND ordini_servizio.azienda_id = (SELECT public.get_azienda_id()))));

-- ── pacchetti_lavoro ──────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: pacchetti_lavoro_azienda
ALTER TABLE public."pacchetti_lavoro" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pacchetti_lavoro_azienda" ON public."pacchetti_lavoro";
DROP POLICY IF EXISTS "pacchetti_lavoro_azienda" ON public."pacchetti_lavoro";
CREATE POLICY "pacchetti_lavoro_azienda" ON public."pacchetti_lavoro" FOR ALL TO authenticated
  USING      (((pacchetti_lavoro.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = pacchetti_lavoro.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (pacchetti_lavoro.commessa_id IS NULL AND pacchetti_lavoro.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((pacchetti_lavoro.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = pacchetti_lavoro.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (pacchetti_lavoro.commessa_id IS NULL AND pacchetti_lavoro.azienda_id = (SELECT public.get_azienda_id()))));

-- ── pagamenti_sub ─────────────────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS attiva; regole: pag_sub_tenant
ALTER TABLE public."pagamenti_sub" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pag_sub_tenant" ON public."pagamenti_sub";
DROP POLICY IF EXISTS "pagamenti_sub_azienda" ON public."pagamenti_sub";
CREATE POLICY "pagamenti_sub_azienda" ON public."pagamenti_sub" FOR ALL TO authenticated
  USING      (pagamenti_sub.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (pagamenti_sub.azienda_id = (SELECT public.get_azienda_id()));

-- ── presenze_cantiere ─────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: presenze_cantiere_azienda
ALTER TABLE public."presenze_cantiere" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "presenze_cantiere_azienda" ON public."presenze_cantiere";
DROP POLICY IF EXISTS "presenze_cantiere_azienda" ON public."presenze_cantiere";
CREATE POLICY "presenze_cantiere_azienda" ON public."presenze_cantiere" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = presenze_cantiere.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = presenze_cantiere.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── preventivi ────────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."preventivi" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "preventivi_azienda" ON public."preventivi";
CREATE POLICY "preventivi_azienda" ON public."preventivi" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = preventivi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = preventivi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── preventivi_fornitori ──────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: preventivi_fornitori_azienda
ALTER TABLE public."preventivi_fornitori" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "preventivi_fornitori_azienda" ON public."preventivi_fornitori";
DROP POLICY IF EXISTS "preventivi_fornitori_azienda" ON public."preventivi_fornitori";
CREATE POLICY "preventivi_fornitori_azienda" ON public."preventivi_fornitori" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = preventivi_fornitori.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = preventivi_fornitori.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── preventivo_voci ───────────────────────────────────────────────────────
-- Appartenenza: madre preventivi (tramite preventivo_id)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."preventivo_voci" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "preventivo_voci_azienda" ON public."preventivo_voci";
CREATE POLICY "preventivo_voci_azienda" ON public."preventivo_voci" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.preventivi p1 WHERE p1.id = preventivo_voci.preventivo_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.preventivi p1 WHERE p1.id = preventivo_voci.preventivo_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))));

-- ── professionisti_fornitori ──────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS attiva; regole: auth_all_pf, auth_read_professionisti, auth_write_professionisti, fornitori_tenant
ALTER TABLE public."professionisti_fornitori" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_pf" ON public."professionisti_fornitori";
DROP POLICY IF EXISTS "auth_read_professionisti" ON public."professionisti_fornitori";
DROP POLICY IF EXISTS "auth_write_professionisti" ON public."professionisti_fornitori";
DROP POLICY IF EXISTS "fornitori_tenant" ON public."professionisti_fornitori";
DROP POLICY IF EXISTS "professionisti_fornitori_azienda" ON public."professionisti_fornitori";
CREATE POLICY "professionisti_fornitori_azienda" ON public."professionisti_fornitori" FOR ALL TO authenticated
  USING      (professionisti_fornitori.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (professionisti_fornitori.azienda_id = (SELECT public.get_azienda_id()));

-- ── progettisti ───────────────────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS attiva; regole: progettisti_azienda
ALTER TABLE public."progettisti" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progettisti_azienda" ON public."progettisti";
DROP POLICY IF EXISTS "progettisti_azienda" ON public."progettisti";
CREATE POLICY "progettisti_azienda" ON public."progettisti" FOR ALL TO authenticated
  USING      (progettisti.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (progettisti.azienda_id = (SELECT public.get_azienda_id()));

-- ── rapportini ────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."rapportini" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rapportini_azienda" ON public."rapportini";
CREATE POLICY "rapportini_azienda" ON public."rapportini" FOR ALL TO authenticated
  USING      (((rapportini.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = rapportini.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (rapportini.commessa_id IS NULL AND rapportini.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((rapportini.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = rapportini.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (rapportini.commessa_id IS NULL AND rapportini.azienda_id = (SELECT public.get_azienda_id()))));

-- ── rda ───────────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: rda della mia azienda, rda_tenant
ALTER TABLE public."rda" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rda della mia azienda" ON public."rda";
DROP POLICY IF EXISTS "rda_tenant" ON public."rda";
DROP POLICY IF EXISTS "rda_azienda" ON public."rda";
CREATE POLICY "rda_azienda" ON public."rda" FOR ALL TO authenticated
  USING      (((rda.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = rda.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (rda.commessa_id IS NULL AND rda.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((rda.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = rda.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (rda.commessa_id IS NULL AND rda.azienda_id = (SELECT public.get_azienda_id()))));

-- ── rda_voci ──────────────────────────────────────────────────────────────
-- Appartenenza: madre rda (tramite rda_id)
-- oggi: RLS attiva; regole: rda_voci della mia azienda
ALTER TABLE public."rda_voci" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rda_voci della mia azienda" ON public."rda_voci";
DROP POLICY IF EXISTS "rda_voci_azienda" ON public."rda_voci";
CREATE POLICY "rda_voci_azienda" ON public."rda_voci" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.rda p1 WHERE p1.id = rda_voci.rda_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rda p1 WHERE p1.id = rda_voci.rda_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))));

-- ── rdo ───────────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: rdo della mia azienda, rdo_tenant
ALTER TABLE public."rdo" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdo della mia azienda" ON public."rdo";
DROP POLICY IF EXISTS "rdo_tenant" ON public."rdo";
DROP POLICY IF EXISTS "rdo_azienda" ON public."rdo";
CREATE POLICY "rdo_azienda" ON public."rdo" FOR ALL TO authenticated
  USING      (((rdo.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = rdo.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (rdo.commessa_id IS NULL AND rdo.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((rdo.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = rdo.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (rdo.commessa_id IS NULL AND rdo.azienda_id = (SELECT public.get_azienda_id()))));

-- ── rdo_fornitori ─────────────────────────────────────────────────────────
-- Appartenenza: madre fornitori (tramite fornitore_id)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."rdo_fornitori" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdo_fornitori_azienda" ON public."rdo_fornitori";
CREATE POLICY "rdo_fornitori_azienda" ON public."rdo_fornitori" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.fornitori p1 WHERE p1.id = rdo_fornitori.fornitore_id AND p1.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fornitori p1 WHERE p1.id = rdo_fornitori.fornitore_id AND p1.azienda_id = (SELECT public.get_azienda_id())));

-- ── rdo_offerte ───────────────────────────────────────────────────────────
-- Appartenenza: nessuna regola: dal browser nessuno legge né scrive
-- oggi: RLS attiva; regole: allow_all_ro, rdooff_all
ALTER TABLE public."rdo_offerte" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_ro" ON public."rdo_offerte";
DROP POLICY IF EXISTS "rdooff_all" ON public."rdo_offerte";
-- (nessuna nuova regola: tabella bloccata per gli utenti; il server con service role non è toccato)

-- ── rdo_voci ──────────────────────────────────────────────────────────────
-- Appartenenza: madre richieste_offerta (tramite rdo_id)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."rdo_voci" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdo_voci_azienda" ON public."rdo_voci";
CREATE POLICY "rdo_voci_azienda" ON public."rdo_voci" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.richieste_offerta p1 WHERE p1.id = rdo_voci.rdo_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.richieste_offerta p1 WHERE p1.id = rdo_voci.rdo_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))));

-- ── registro_contabilita ──────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: registro_tenant
ALTER TABLE public."registro_contabilita" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "registro_tenant" ON public."registro_contabilita";
DROP POLICY IF EXISTS "registro_contabilita_azienda" ON public."registro_contabilita";
CREATE POLICY "registro_contabilita_azienda" ON public."registro_contabilita" FOR ALL TO authenticated
  USING      (((registro_contabilita.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = registro_contabilita.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (registro_contabilita.commessa_id IS NULL AND registro_contabilita.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((registro_contabilita.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = registro_contabilita.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (registro_contabilita.commessa_id IS NULL AND registro_contabilita.azienda_id = (SELECT public.get_azienda_id()))));

-- ── richieste_offerta ─────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."richieste_offerta" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "richieste_offerta_azienda" ON public."richieste_offerta";
CREATE POLICY "richieste_offerta_azienda" ON public."richieste_offerta" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = richieste_offerta.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = richieste_offerta.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── riserve ───────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: riserve_auth
ALTER TABLE public."riserve" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "riserve_auth" ON public."riserve";
DROP POLICY IF EXISTS "riserve_azienda" ON public."riserve";
CREATE POLICY "riserve_azienda" ON public."riserve" FOR ALL TO authenticated
  USING      (((riserve.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = riserve.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (riserve.commessa_id IS NULL AND riserve.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((riserve.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = riserve.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (riserve.commessa_id IS NULL AND riserve.azienda_id = (SELECT public.get_azienda_id()))));

-- ── sal ───────────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: pol_sal, sal_tenant
ALTER TABLE public."sal" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pol_sal" ON public."sal";
DROP POLICY IF EXISTS "sal_tenant" ON public."sal";
DROP POLICY IF EXISTS "sal_azienda" ON public."sal";
CREATE POLICY "sal_azienda" ON public."sal" FOR ALL TO authenticated
  USING      (((sal.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = sal.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (sal.commessa_id IS NULL AND sal.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((sal.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = sal.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (sal.commessa_id IS NULL AND sal.azienda_id = (SELECT public.get_azienda_id()))));

-- ── sal_attivi ────────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."sal_attivi" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sal_attivi_azienda" ON public."sal_attivi";
CREATE POLICY "sal_attivi_azienda" ON public."sal_attivi" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = sal_attivi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = sal_attivi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── sal_attivo_voci ───────────────────────────────────────────────────────
-- Appartenenza: madre sal_attivi (tramite sal_id)
-- oggi: RLS attiva; regole: sal_attivo_voci_azienda
ALTER TABLE public."sal_attivo_voci" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sal_attivo_voci_azienda" ON public."sal_attivo_voci";
DROP POLICY IF EXISTS "sal_attivo_voci_azienda" ON public."sal_attivo_voci";
CREATE POLICY "sal_attivo_voci_azienda" ON public."sal_attivo_voci" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sal_attivi p1 WHERE p1.id = sal_attivo_voci.sal_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sal_attivi p1 WHERE p1.id = sal_attivo_voci.sal_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))));

-- ── sal_passivi ───────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: sal_passivi_tenant, salp_all
ALTER TABLE public."sal_passivi" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sal_passivi_tenant" ON public."sal_passivi";
DROP POLICY IF EXISTS "salp_all" ON public."sal_passivi";
DROP POLICY IF EXISTS "sal_passivi_azienda" ON public."sal_passivi";
CREATE POLICY "sal_passivi_azienda" ON public."sal_passivi" FOR ALL TO authenticated
  USING      (((sal_passivi.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = sal_passivi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (sal_passivi.commessa_id IS NULL AND sal_passivi.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((sal_passivi.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = sal_passivi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (sal_passivi.commessa_id IS NULL AND sal_passivi.azienda_id = (SELECT public.get_azienda_id()))));

-- ── sal_passivo_voci ──────────────────────────────────────────────────────
-- Appartenenza: madre sal_passivi (tramite sal_passivo_id)
-- oggi: RLS attiva; regole: sal_passivo_voci_azienda
ALTER TABLE public."sal_passivo_voci" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sal_passivo_voci_azienda" ON public."sal_passivo_voci";
DROP POLICY IF EXISTS "sal_passivo_voci_azienda" ON public."sal_passivo_voci";
CREATE POLICY "sal_passivo_voci_azienda" ON public."sal_passivo_voci" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sal_passivi p1 WHERE p1.id = sal_passivo_voci.sal_passivo_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sal_passivi p1 WHERE p1.id = sal_passivo_voci.sal_passivo_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))));

-- ── sal_righe ─────────────────────────────────────────────────────────────
-- Appartenenza: madre sals (tramite sal_id)
-- oggi: RLS attiva; regole: sal_righe della mia azienda
ALTER TABLE public."sal_righe" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sal_righe della mia azienda" ON public."sal_righe";
DROP POLICY IF EXISTS "sal_righe_azienda" ON public."sal_righe";
CREATE POLICY "sal_righe_azienda" ON public."sal_righe" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sals p1 WHERE p1.id = sal_righe.sal_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sals p1 WHERE p1.id = sal_righe.sal_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))));

-- ── sal_voci ──────────────────────────────────────────────────────────────
-- Appartenenza: madre sal (tramite sal_id)
-- oggi: RLS attiva; regole: sal_voci_azienda
ALTER TABLE public."sal_voci" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sal_voci_azienda" ON public."sal_voci";
DROP POLICY IF EXISTS "sal_voci_azienda" ON public."sal_voci";
CREATE POLICY "sal_voci_azienda" ON public."sal_voci" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sal p1 WHERE p1.id = sal_voci.sal_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sal p1 WHERE p1.id = sal_voci.sal_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))));

-- ── sals ──────────────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: sals della mia azienda
ALTER TABLE public."sals" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sals della mia azienda" ON public."sals";
DROP POLICY IF EXISTS "sals_azienda" ON public."sals";
CREATE POLICY "sals_azienda" ON public."sals" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = sals.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = sals.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── scadenzario ───────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS SPENTA; regole: pol_scadenzario
ALTER TABLE public."scadenzario" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pol_scadenzario" ON public."scadenzario";
DROP POLICY IF EXISTS "scadenzario_azienda" ON public."scadenzario";
CREATE POLICY "scadenzario_azienda" ON public."scadenzario" FOR ALL TO authenticated
  USING      (((scadenzario.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = scadenzario.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (scadenzario.commessa_id IS NULL AND scadenzario.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((scadenzario.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = scadenzario.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (scadenzario.commessa_id IS NULL AND scadenzario.azienda_id = (SELECT public.get_azienda_id()))));

-- ── soggetto_referenti ────────────────────────────────────────────────────
-- Appartenenza: madre professionisti_fornitori (tramite soggetto_id)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."soggetto_referenti" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soggetto_referenti_azienda" ON public."soggetto_referenti";
CREATE POLICY "soggetto_referenti_azienda" ON public."soggetto_referenti" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.professionisti_fornitori p1 WHERE p1.id = soggetto_referenti.soggetto_id AND p1.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.professionisti_fornitori p1 WHERE p1.id = soggetto_referenti.soggetto_id AND p1.azienda_id = (SELECT public.get_azienda_id())));

-- ── spese_cantiere ────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS SPENTA; regole: allow_all_sc, spese_auth
ALTER TABLE public."spese_cantiere" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_sc" ON public."spese_cantiere";
DROP POLICY IF EXISTS "spese_auth" ON public."spese_cantiere";
DROP POLICY IF EXISTS "spese_cantiere_azienda" ON public."spese_cantiere";
CREATE POLICY "spese_cantiere_azienda" ON public."spese_cantiere" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = spese_cantiere.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = spese_cantiere.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── tariffa_componenti ────────────────────────────────────────────────────
-- Appartenenza: madre tariffe (tramite tariffa_id)
-- oggi: RLS attiva; regole: tariffa_componenti_azienda
ALTER TABLE public."tariffa_componenti" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tariffa_componenti_azienda" ON public."tariffa_componenti";
DROP POLICY IF EXISTS "tariffa_componenti_azienda" ON public."tariffa_componenti";
CREATE POLICY "tariffa_componenti_azienda" ON public."tariffa_componenti" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.tariffe p1 WHERE p1.id = tariffa_componenti.tariffa_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tariffe p1 WHERE p1.id = tariffa_componenti.tariffa_id AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))));

-- ── tariffe ───────────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."tariffe" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tariffe_azienda" ON public."tariffe";
CREATE POLICY "tariffe_azienda" ON public."tariffe" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = tariffe.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = tariffe.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── task_pianificazione ───────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: task_pianificazione_azienda
ALTER TABLE public."task_pianificazione" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_pianificazione_azienda" ON public."task_pianificazione";
DROP POLICY IF EXISTS "task_pianificazione_azienda" ON public."task_pianificazione";
CREATE POLICY "task_pianificazione_azienda" ON public."task_pianificazione" FOR ALL TO authenticated
  USING      (((task_pianificazione.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = task_pianificazione.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (task_pianificazione.commessa_id IS NULL AND task_pianificazione.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((task_pianificazione.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = task_pianificazione.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (task_pianificazione.commessa_id IS NULL AND task_pianificazione.azienda_id = (SELECT public.get_azienda_id()))));

-- ── utenti ────────────────────────────────────────────────────────────────
-- Appartenenza: utenti della propria azienda; modifica solo admin; azienda_id non modificabile
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."utenti" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "utenti_lettura" ON public.utenti;
DROP POLICY IF EXISTS "utenti_modifica_admin" ON public.utenti;
CREATE POLICY "utenti_lettura" ON public.utenti FOR SELECT TO authenticated
  USING (azienda_id = (SELECT public.get_azienda_id()));
CREATE POLICY "utenti_modifica_admin" ON public.utenti FOR UPDATE TO authenticated
  USING      (azienda_id = (SELECT public.get_azienda_id()) AND (SELECT public.sono_admin()))
  WITH CHECK (azienda_id = (SELECT public.get_azienda_id()));
-- Nessuna regola INSERT/DELETE: utenti creati solo dal server (/api/register, /api/invite-user con service role).

-- ── variante_diff ─────────────────────────────────────────────────────────
-- Appartenenza: madre varianti (tramite variante_id)
-- oggi: RLS attiva; regole: variante_diff della mia azienda
ALTER TABLE public."variante_diff" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "variante_diff della mia azienda" ON public."variante_diff";
DROP POLICY IF EXISTS "variante_diff_azienda" ON public."variante_diff";
CREATE POLICY "variante_diff_azienda" ON public."variante_diff" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.varianti p1 WHERE p1.id = variante_diff.variante_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.varianti p1 WHERE p1.id = variante_diff.variante_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))));

-- ── varianti ──────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: varianti della mia azienda, varianti_tenant
ALTER TABLE public."varianti" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "varianti della mia azienda" ON public."varianti";
DROP POLICY IF EXISTS "varianti_tenant" ON public."varianti";
DROP POLICY IF EXISTS "varianti_azienda" ON public."varianti";
CREATE POLICY "varianti_azienda" ON public."varianti" FOR ALL TO authenticated
  USING      (((varianti.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = varianti.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (varianti.commessa_id IS NULL AND varianti.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((varianti.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = varianti.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (varianti.commessa_id IS NULL AND varianti.azienda_id = (SELECT public.get_azienda_id()))));

-- ── voce_assegnazione ─────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: allow_all_va
ALTER TABLE public."voce_assegnazione" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_va" ON public."voce_assegnazione";
DROP POLICY IF EXISTS "voce_assegnazione_azienda" ON public."voce_assegnazione";
CREATE POLICY "voce_assegnazione_azienda" ON public."voce_assegnazione" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = voce_assegnazione.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = voce_assegnazione.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── voci_assegnazione ─────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: voci_assegnazione_azienda
ALTER TABLE public."voci_assegnazione" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "voci_assegnazione_azienda" ON public."voci_assegnazione";
DROP POLICY IF EXISTS "voci_assegnazione_azienda" ON public."voci_assegnazione";
CREATE POLICY "voci_assegnazione_azienda" ON public."voci_assegnazione" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = voci_assegnazione.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = voci_assegnazione.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── voci_computo ──────────────────────────────────────────────────────────
-- Appartenenza: madre computo_metrico (tramite computo_id)
-- oggi: RLS SPENTA; regole: nessuna
ALTER TABLE public."voci_computo" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "voci_computo_azienda" ON public."voci_computo";
CREATE POLICY "voci_computo_azienda" ON public."voci_computo" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.computo_metrico p1 WHERE p1.id = voci_computo.computo_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.computo_metrico p1 WHERE p1.id = voci_computo.computo_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))));

-- ── voci_computo_misurazioni ──────────────────────────────────────────────
-- Appartenenza: madre voci_computo (tramite voce_computo_id)
-- oggi: RLS attiva; regole: vcm_all
ALTER TABLE public."voci_computo_misurazioni" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vcm_all" ON public."voci_computo_misurazioni";
DROP POLICY IF EXISTS "voci_computo_misurazioni_azienda" ON public."voci_computo_misurazioni";
CREATE POLICY "voci_computo_misurazioni_azienda" ON public."voci_computo_misurazioni" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.voci_computo p1 WHERE p1.id = voci_computo_misurazioni.voce_computo_id AND EXISTS (SELECT 1 FROM public.computo_metrico p2 WHERE p2.id = p1.computo_id AND ((p2.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c2 WHERE c2.id = p2.commessa_id AND c2.azienda_id = (SELECT public.get_azienda_id()))) OR (p2.commessa_id IS NULL AND p2.azienda_id = (SELECT public.get_azienda_id()))))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.voci_computo p1 WHERE p1.id = voci_computo_misurazioni.voce_computo_id AND EXISTS (SELECT 1 FROM public.computo_metrico p2 WHERE p2.id = p1.computo_id AND ((p2.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c2 WHERE c2.id = p2.commessa_id AND c2.azienda_id = (SELECT public.get_azienda_id()))) OR (p2.commessa_id IS NULL AND p2.azienda_id = (SELECT public.get_azienda_id()))))));

-- ── voci_contratto ────────────────────────────────────────────────────────
-- Appartenenza: madre contratti (tramite contratto_id)
-- oggi: RLS attiva; regole: voci_contratto_azienda
ALTER TABLE public."voci_contratto" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "voci_contratto_azienda" ON public."voci_contratto";
DROP POLICY IF EXISTS "voci_contratto_azienda" ON public."voci_contratto";
CREATE POLICY "voci_contratto_azienda" ON public."voci_contratto" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.contratti p1 WHERE p1.id = voci_contratto.contratto_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contratti p1 WHERE p1.id = voci_contratto.contratto_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))));

-- ── voci_ep ───────────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: voci della mia azienda
ALTER TABLE public."voci_ep" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "voci della mia azienda" ON public."voci_ep";
DROP POLICY IF EXISTS "voci_ep_azienda" ON public."voci_ep";
CREATE POLICY "voci_ep_azienda" ON public."voci_ep" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = voci_ep.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = voci_ep.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── voci_sal ──────────────────────────────────────────────────────────────
-- Appartenenza: madre sal (tramite sal_id)
-- oggi: RLS attiva; regole: voci_sal_azienda
ALTER TABLE public."voci_sal" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "voci_sal_azienda" ON public."voci_sal";
DROP POLICY IF EXISTS "voci_sal_azienda" ON public."voci_sal";
CREATE POLICY "voci_sal_azienda" ON public."voci_sal" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.sal p1 WHERE p1.id = voci_sal.sal_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sal p1 WHERE p1.id = voci_sal.sal_id AND ((p1.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c1 WHERE c1.id = p1.commessa_id AND c1.azienda_id = (SELECT public.get_azienda_id()))) OR (p1.commessa_id IS NULL AND p1.azienda_id = (SELECT public.get_azienda_id())))));

-- ── voci_variante ─────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: voci_variante_azienda
ALTER TABLE public."voci_variante" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "voci_variante_azienda" ON public."voci_variante";
DROP POLICY IF EXISTS "voci_variante_azienda" ON public."voci_variante";
CREATE POLICY "voci_variante_azienda" ON public."voci_variante" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = voci_variante.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = voci_variante.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── wbs_commessa ──────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS attiva; regole: wbs_commessa_rls
ALTER TABLE public."wbs_commessa" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wbs_commessa_rls" ON public."wbs_commessa";
DROP POLICY IF EXISTS "wbs_commessa_azienda" ON public."wbs_commessa";
CREATE POLICY "wbs_commessa_azienda" ON public."wbs_commessa" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = wbs_commessa.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = wbs_commessa.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── wbs_nodes ─────────────────────────────────────────────────────────────
-- Appartenenza: azienda della commessa (azienda_id solo se commessa_id è vuota)
-- oggi: RLS attiva; regole: wbs della mia azienda, wbs_nodes_auth
ALTER TABLE public."wbs_nodes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wbs della mia azienda" ON public."wbs_nodes";
DROP POLICY IF EXISTS "wbs_nodes_auth" ON public."wbs_nodes";
DROP POLICY IF EXISTS "wbs_nodes_azienda" ON public."wbs_nodes";
CREATE POLICY "wbs_nodes_azienda" ON public."wbs_nodes" FOR ALL TO authenticated
  USING      (((wbs_nodes.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = wbs_nodes.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (wbs_nodes.commessa_id IS NULL AND wbs_nodes.azienda_id = (SELECT public.get_azienda_id()))))
  WITH CHECK (((wbs_nodes.commessa_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = wbs_nodes.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id()))) OR (wbs_nodes.commessa_id IS NULL AND wbs_nodes.azienda_id = (SELECT public.get_azienda_id()))));

-- ── wbs_nodi ──────────────────────────────────────────────────────────────
-- Appartenenza: commessa_id → commesse.azienda_id
-- oggi: RLS SPENTA; regole: wbs_auth
ALTER TABLE public."wbs_nodi" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wbs_auth" ON public."wbs_nodi";
DROP POLICY IF EXISTS "wbs_nodi_azienda" ON public."wbs_nodi";
CREATE POLICY "wbs_nodi_azienda" ON public."wbs_nodi" FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = wbs_nodi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commesse c0 WHERE c0.id = wbs_nodi.commessa_id AND c0.azienda_id = (SELECT public.get_azienda_id())));

-- ── wbs_template ──────────────────────────────────────────────────────────
-- Appartenenza: tabella globale: sola lettura per gli utenti collegati
-- oggi: RLS attiva; regole: wbs_template_rls
ALTER TABLE public."wbs_template" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wbs_template_rls" ON public."wbs_template";
DROP POLICY IF EXISTS "wbs_template_lettura" ON public."wbs_template";
CREATE POLICY "wbs_template_lettura" ON public."wbs_template" FOR SELECT TO authenticated USING (true);

-- ── wbs_templates ─────────────────────────────────────────────────────────
-- Appartenenza: azienda_id della riga
-- oggi: RLS attiva; regole: wbs_templates_auth
ALTER TABLE public."wbs_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wbs_templates_auth" ON public."wbs_templates";
DROP POLICY IF EXISTS "wbs_templates_azienda" ON public."wbs_templates";
CREATE POLICY "wbs_templates_azienda" ON public."wbs_templates" FOR ALL TO authenticated
  USING      (wbs_templates.azienda_id = (SELECT public.get_azienda_id()))
  WITH CHECK (wbs_templates.azienda_id = (SELECT public.get_azienda_id()));

-- ── Viste: rispettano le RLS di chi le interroga ────────────────────────────
ALTER VIEW public."v_commesse_kpi" SET (security_invoker = true);
ALTER VIEW public."v_sal_delta" SET (security_invoker = true);
ALTER VIEW public."v_sal_totale" SET (security_invoker = true);
ALTER VIEW public."v_voce_avanzamento" SET (security_invoker = true);
ALTER VIEW public."v_voci_importo" SET (security_invoker = true);
ALTER VIEW public."v_voci_importo_3strati" SET (security_invoker = true);
ALTER VIEW public."v_wbs_budget" SET (security_invoker = true);

COMMIT;

-- ── CONTROLLO DOPO L'APPLICAZIONE (sola lettura, da eseguire a parte) ────────
/*
-- (a) tabelle public con RLS spenta — atteso: nessuna riga
SELECT c.relname AS tabella
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
ORDER BY 1;

-- (b) regole public con USING true, WITH CHECK true o auth.role()
--     atteso: solo le tabelle globali in sola lettura volute (categorie_c, categorie_sb,
--     categorie_sc: SELECT pubbliche, non toccate; wbs_template: wbs_template_lettura)
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true'
       OR coalesce(qual, '') ~ 'auth\.role\(\)' OR coalesce(with_check, '') ~ 'auth\.role\(\)')
ORDER BY 1, 2;
*/
