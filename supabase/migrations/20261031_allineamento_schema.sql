-- ═══════════════════════════════════════════════════════════════════════════
-- SQ360 — Allineamento schema DB al codice
-- Data: 31/10/2026
--
-- Scopo: aggiungere al database le colonne, i valori enum e le chiavi esterne
-- che il codice dell'app usa ma che non esistono nello schema reale (emersi
-- dallo smoke test del 31/10/2026: errori 400/404 PostgREST e INSERT falliti
-- su oda, fatture_passive, gare, varianti, sal_passivi).
--
-- Caratteristiche:
--   - idempotente: ogni istruzione usa IF NOT EXISTS / controlli su pg_constraint,
--     può essere rieseguito senza effetti;
--   - non cancella righe né colonne;
--   - gli UPDATE riempiono solo campi oggi vuoti (COALESCE / IS NULL);
--   - unici rilassamenti: oda.rdo_id e wbs_nodes.label diventano facoltativi;
--   - ALTER TYPE ... ADD VALUE su stato_gara non è annullabile (solo aggiunta).
--
-- Dopo l'esecuzione vanno fatte le correzioni di codice corrispondenti
-- (nomi colonna già esistenti: oda.codice, ddt.numero_ddt,
-- fatture_passive.numero_fattura, sal_passivi.contratto_id, ecc.).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. fatture_passive
ALTER TABLE fatture_passive
  ADD COLUMN IF NOT EXISTS codice         text,
  ADD COLUMN IF NOT EXISTS fornitore_nome text,
  ADD COLUMN IF NOT EXISTS iva_pct        numeric,
  ADD COLUMN IF NOT EXISTS totale         numeric;

-- 2. oda
ALTER TABLE oda
  ADD COLUMN IF NOT EXISTS tipo                   text,
  ADD COLUMN IF NOT EXISTS oggetto                text,
  ADD COLUMN IF NOT EXISTS fornitore_id           uuid,
  ADD COLUMN IF NOT EXISTS iva_pct                numeric,
  ADD COLUMN IF NOT EXISTS ritenuta_pct           numeric,
  ADD COLUMN IF NOT EXISTS condizioni_pagamento   text,
  ADD COLUMN IF NOT EXISTS data_consegna_prevista date,
  ADD COLUMN IF NOT EXISTS contratto_sub_id       uuid;
ALTER TABLE oda ALTER COLUMN rdo_id DROP NOT NULL;   -- ODA extra-computo senza RDO

-- 3. documenti_commessa
ALTER TABLE documenti_commessa
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS tipo_mime text;

-- 4. gare
ALTER TABLE gare
  ADD COLUMN IF NOT EXISTS criterio_aggiudicazione text,
  ADD COLUMN IF NOT EXISTS tipo_committente        text,
  ADD COLUMN IF NOT EXISTS data_pubblicazione      date,
  ADD COLUMN IF NOT EXISTS link_bando              text;
ALTER TYPE stato_gara ADD VALUE IF NOT EXISTS 'IN_ANALISI';
ALTER TYPE stato_gara ADD VALUE IF NOT EXISTS 'DA_PRESENTARE';
ALTER TYPE stato_gara ADD VALUE IF NOT EXISTS 'RINUNCIATA';

-- 5. varianti / voci_variante
ALTER TABLE varianti
  ADD COLUMN IF NOT EXISTS tipo             text,
  ADD COLUMN IF NOT EXISTS descrizione      text,
  ADD COLUMN IF NOT EXISTS importo_variante numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importo_perizia  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_proposta    date;
ALTER TABLE voci_variante
  ADD COLUMN IF NOT EXISTS commessa_id uuid REFERENCES commesse(id) ON DELETE CASCADE;

-- 6. sal_passivi
ALTER TABLE sal_passivi
  ADD COLUMN IF NOT EXISTS fornitore_id            uuid,
  ADD COLUMN IF NOT EXISTS data_emissione          date,
  ADD COLUMN IF NOT EXISTS al_giorno               date,
  ADD COLUMN IF NOT EXISTS percentuale_avanzamento numeric,
  ADD COLUMN IF NOT EXISTS importo_contratto       numeric,
  ADD COLUMN IF NOT EXISTS ritenuta_garanzia_pct   numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS durc_ok                 boolean,
  ADD COLUMN IF NOT EXISTS stato                   text DEFAULT 'ricevuto';

-- 7. contratti_sub
ALTER TABLE contratti_sub
  ADD COLUMN IF NOT EXISTS durc_ok       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_approvato boolean DEFAULT false;

-- 8. azienda: carta intestata (oggi esiste solo su "aziende")
ALTER TABLE azienda
  ADD COLUMN IF NOT EXISTS carta_intestata_header_url text,
  ADD COLUMN IF NOT EXISTS carta_intestata_footer_url text;
UPDATE azienda a SET
  logo_url                   = COALESCE(a.logo_url, z.logo_url),
  carta_intestata_header_url = COALESCE(a.carta_intestata_header_url, z.carta_intestata_header_url),
  carta_intestata_footer_url = COALESCE(a.carta_intestata_footer_url, z.carta_intestata_footer_url)
FROM aziende z WHERE z.id = a.id;

-- 9. wbs_nodes (struttura attesa dal codice; "label" resta)
ALTER TABLE wbs_nodes
  ADD COLUMN IF NOT EXISTS descrizione text,
  ADD COLUMN IF NOT EXISTS azienda_id  uuid,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES wbs_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS colore      varchar(7);
ALTER TABLE wbs_nodes ALTER COLUMN label DROP NOT NULL;
UPDATE wbs_nodes SET descrizione = label WHERE descrizione IS NULL;
UPDATE wbs_nodes n SET azienda_id = c.azienda_id
  FROM commesse c WHERE c.id = n.commessa_id AND n.azienda_id IS NULL;

-- 10. Chiavi esterne (servono ai join PostgREST)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oda_fornitore_id_fkey') THEN
    ALTER TABLE oda ADD CONSTRAINT oda_fornitore_id_fkey
      FOREIGN KEY (fornitore_id) REFERENCES professionisti_fornitori(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oda_contratto_sub_id_fkey') THEN
    ALTER TABLE oda ADD CONSTRAINT oda_contratto_sub_id_fkey
      FOREIGN KEY (contratto_sub_id) REFERENCES contratti_sub(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fatture_passive_fornitore_id_fkey') THEN
    ALTER TABLE fatture_passive ADD CONSTRAINT fatture_passive_fornitore_id_fkey
      FOREIGN KEY (fornitore_id) REFERENCES professionisti_fornitori(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sal_passivi_fornitore_id_fkey') THEN
    ALTER TABLE sal_passivi ADD CONSTRAINT sal_passivi_fornitore_id_fkey
      FOREIGN KEY (fornitore_id) REFERENCES professionisti_fornitori(id);
  END IF;
  -- NOT VALID: la riga esistente punta alla tabella legacy "fornitori" e non viene controllata
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contratti_sub_fornitore_id_fkey') THEN
    ALTER TABLE contratti_sub ADD CONSTRAINT contratti_sub_fornitore_id_fkey
      FOREIGN KEY (fornitore_id) REFERENCES professionisti_fornitori(id) NOT VALID;
  END IF;
END $$;

-- 11. PostgREST rilegge lo schema (nuove colonne e relazioni subito visibili)
NOTIFY pgrst, 'reload schema';
