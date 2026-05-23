-- Sedi e unità locali azienda
-- Tipi: operativa, amministrativa, magazzino, deposito, ufficio_tecnico, filiale, altro

CREATE TABLE IF NOT EXISTS azienda_sedi (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  azienda_id  UUID NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'operativa',
  nome        TEXT,
  indirizzo   TEXT,
  comune      TEXT,
  cap         TEXT,
  provincia   TEXT,
  lat         NUMERIC(10,7),
  lng         NUMERIC(10,7),
  telefono    TEXT,
  email       TEXT,
  referente   TEXT,
  note        TEXT,
  attiva      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE azienda_sedi ENABLE ROW LEVEL SECURITY;

CREATE POLICY azienda_sedi_rls ON azienda_sedi
  FOR ALL USING (
    azienda_id IN (
      SELECT azienda_id FROM utenti WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_azienda_sedi_azienda ON azienda_sedi(azienda_id);
