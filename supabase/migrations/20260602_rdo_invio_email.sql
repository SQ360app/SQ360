-- RDO: colonne per tracciamento invio email al fornitore
-- token_offerta aggiunto in sprint 2 ma incluso con IF NOT EXISTS per sicurezza

ALTER TABLE rdo
  ADD COLUMN IF NOT EXISTS token_offerta      UUID,
  ADD COLUMN IF NOT EXISTS email_inviata      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_inviata_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_destinatario TEXT;
