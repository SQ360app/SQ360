-- Aggiunge colonna responsabile_id alla tabella commesse
ALTER TABLE commesse
  ADD COLUMN IF NOT EXISTS responsabile_id UUID REFERENCES utenti(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commesse_responsabile
  ON commesse(responsabile_id);
