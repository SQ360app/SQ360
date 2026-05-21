-- Aggiunge campi prezzario di riferimento a elenco_prezzi
-- Usati per tracciare l'origine del prezzo e abilitare future comparazioni automatiche
ALTER TABLE elenco_prezzi
  ADD COLUMN IF NOT EXISTS prezzario_riferimento text,
  ADD COLUMN IF NOT EXISTS prezzario_anno integer,
  ADD COLUMN IF NOT EXISTS prezzario_codice_originale text;
