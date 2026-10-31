-- ═══════════════════════════════════════════════════════════════════════════
-- SQ360 — Allineamento schema per i salvataggi (31/10/2026)
-- Colonne e tipi richiesti dal codice dopo l'introduzione delle scritture
-- verificate (src/lib/scritture.ts) e del controllo scripts/check-scritture.mjs.
-- Ripetibile: IF NOT EXISTS / operazioni idempotenti. Non cancella dati.
-- Le sezioni 1–3 risultano già eseguite il 31/10/2026: sono incluse per
-- completezza (rieseguirle non ha effetti).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. DDT ───────────────────────────────────────────────────────────────────
-- Il salvataggio DDT scrive codice interno, data di ricezione, nome fornitore
-- (anche se non in anagrafica) e le righe del documento (voci). Senza queste
-- colonne l'insert falliva in silenzio.
ALTER TABLE public.ddt
  ADD COLUMN IF NOT EXISTS codice         text,
  ADD COLUMN IF NOT EXISTS data_ricezione date,
  ADD COLUMN IF NOT EXISTS fornitore_nome text,
  ADD COLUMN IF NOT EXISTS voci           jsonb DEFAULT '[]'::jsonb;


-- ── 2. Contratti di subappalto ───────────────────────────────────────────────
-- Modulo "Nuovo contratto sub": tipo (subappalto/subaffidamento/nolo a caldo),
-- percentuale di subappalto, categoria SOA.
ALTER TABLE public.contratti_sub
  ADD COLUMN IF NOT EXISTS tipo                   text,
  ADD COLUMN IF NOT EXISTS percentuale_subappalto numeric,
  ADD COLUMN IF NOT EXISTS cat_soa                text;


-- ── 3. Ordini di servizio ────────────────────────────────────────────────────
-- Tipo dell'ordine, collegamento alla variante generata, firma con riserva
-- (testo, importo, scadenza della riserva).
ALTER TABLE public.ordini_servizio
  ADD COLUMN IF NOT EXISTS tipo             text,
  ADD COLUMN IF NOT EXISTS variante_id      uuid REFERENCES public.varianti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS riserva          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS testo_riserva    text,
  ADD COLUMN IF NOT EXISTS importo_riserva  numeric,
  ADD COLUMN IF NOT EXISTS scadenza_riserva date;


-- ── 4. SAM (tabella dam): stato da enum a testo libero ───────────────────────
-- Stati canonici usati dal codice (src/lib/statiSam.ts):
--   bozza → inviata_dl → approvata | rifiutata | integrazione
-- Prima si toglie il DEFAULT legato all'enum, poi si converte, poi si imposta
-- il nuovo default. Rieseguibile anche se la colonna è già di tipo text.
-- Il tipo enum resta nel database (non più usato da questa colonna).
ALTER TABLE public.dam ALTER COLUMN stato DROP DEFAULT;
ALTER TABLE public.dam ALTER COLUMN stato TYPE text USING stato::text;
ALTER TABLE public.dam ALTER COLUMN stato SET DEFAULT 'bozza';


-- ── 5. Giornale lavori ───────────────────────────────────────────────────────
-- Campi del modulo senza colonna equivalente. Gli altri usano colonne esistenti:
-- operai → operai_propri / operai_sub, lavori eseguiti → descrizione,
-- direttore di cantiere → redatto_da.
ALTER TABLE public.giornale_lavori
  ADD COLUMN IF NOT EXISTS temperatura_min numeric,
  ADD COLUMN IF NOT EXISTS temperatura_max numeric,
  ADD COLUMN IF NOT EXISTS n_mezzi         integer,
  ADD COLUMN IF NOT EXISTS note            text;


-- ── 6. Documenti dei subappaltatori ──────────────────────────────────────────
-- Nome del file caricato, mostrato nella checklist documenti. SOA e IBAN usano
-- le colonne esistenti (categoria_soa, classifica_soa, iban); i pagamenti usano
-- ritenuta, netto_pagato, svincolata: nessuna colonna da aggiungere a pagamenti_sub.
ALTER TABLE public.documenti_contratto_sub
  ADD COLUMN IF NOT EXISTS nome_file text;


-- ── 7. Fatture attive (tabella fatture) ──────────────────────────────────────
-- Nessuna modifica di schema necessaria: il codice usa le colonne esistenti
-- (soggetto = committente della commessa, imponibile in importo_imponibile,
-- totale calcolato e non salvato). Sezione mantenuta come promemoria.


-- ── 8. Ricarica dello schema in PostgREST ────────────────────────────────────
-- Rende subito visibili all'API le colonne e i tipi modificati.
NOTIFY pgrst, 'reload schema';
