-- Converte stato da enum a text per supportare valori bozza/emesso usati dal frontend
-- I valori uppercase esistenti (BOZZA, INVIATO, ecc.) rimangono invariati
ALTER TABLE sal ALTER COLUMN stato TYPE text USING stato::text;
ALTER TABLE sal ALTER COLUMN stato SET DEFAULT 'bozza';
