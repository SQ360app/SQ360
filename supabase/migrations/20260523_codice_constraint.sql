-- Sostituisce il constraint UNIQUE(commessa_id, codice) con
-- UNIQUE(commessa_id, azienda_id, codice) per separare
-- lo spazio di codici per azienda ed evitare 409 cross-tenant.

ALTER TABLE rda
  DROP CONSTRAINT IF EXISTS rda_commessa_id_codice_key;
ALTER TABLE rda
  ADD CONSTRAINT rda_commessa_azienda_codice_key
  UNIQUE (commessa_id, azienda_id, codice);

ALTER TABLE rdo
  DROP CONSTRAINT IF EXISTS rdo_commessa_id_codice_key;
ALTER TABLE rdo
  ADD CONSTRAINT rdo_commessa_azienda_codice_key
  UNIQUE (commessa_id, azienda_id, codice);

ALTER TABLE dam
  DROP CONSTRAINT IF EXISTS dam_commessa_id_codice_key;
ALTER TABLE dam
  ADD CONSTRAINT dam_commessa_azienda_codice_key
  UNIQUE (commessa_id, azienda_id, codice);
