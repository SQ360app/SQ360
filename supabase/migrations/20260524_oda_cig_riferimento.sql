-- Aggiunge colonna CIG di riferimento su ODA per tracciabilità L. 136/2010
ALTER TABLE oda ADD COLUMN IF NOT EXISTS cig_riferimento text;
