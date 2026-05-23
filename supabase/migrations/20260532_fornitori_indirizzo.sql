-- Aggiunge campi indirizzo a professionisti_fornitori
ALTER TABLE professionisti_fornitori
  ADD COLUMN IF NOT EXISTS indirizzo TEXT,
  ADD COLUMN IF NOT EXISTS comune    TEXT,
  ADD COLUMN IF NOT EXISTS provincia TEXT;
