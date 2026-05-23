-- Sistema email completo: log comunicazioni, codifica documentale, configurazione email

-- 1. Email di configurazione per area aziendale
ALTER TABLE azienda
  ADD COLUMN IF NOT EXISTS email_acquisti        TEXT,
  ADD COLUMN IF NOT EXISTS email_cantiere        TEXT,
  ADD COLUMN IF NOT EXISTS email_amministrazione TEXT;

-- 2. Log centralizzato email
CREATE TABLE IF NOT EXISTS email_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id     UUID NOT NULL REFERENCES azienda(id) ON DELETE CASCADE,
  commessa_id    UUID REFERENCES commesse(id) ON DELETE SET NULL,
  tipo_doc       TEXT,
  doc_id         UUID,
  doc_codice     TEXT,
  direzione      TEXT DEFAULT 'uscita',
  mittente       TEXT,
  destinatari    TEXT[],
  cc             TEXT[],
  oggetto        TEXT,
  html           TEXT,
  allegati       JSONB,
  stato          TEXT DEFAULT 'inviata',
  inviata_at     TIMESTAMPTZ,
  letta_at       TIMESTAMPTZ,
  risposta_at    TIMESTAMPTZ,
  resend_id      TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_log' AND policyname = 'email_log_tenant'
  ) THEN
    CREATE POLICY email_log_tenant ON email_log
      USING (azienda_id = (SELECT azienda_id FROM utenti WHERE id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- 3. Riferimento WBS su rdo e oda
ALTER TABLE rdo ADD COLUMN IF NOT EXISTS wbs_ref TEXT;
ALTER TABLE oda ADD COLUMN IF NOT EXISTS wbs_ref TEXT;

-- 4. Funzione codice documento {codice_commessa}/{TIPO}-{NNN}
CREATE OR REPLACE FUNCTION genera_codice_documento(p_commessa_id UUID, p_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_codice TEXT;
  v_count  INT;
BEGIN
  SELECT codice INTO v_codice FROM commesse WHERE id = p_commessa_id;
  IF v_codice IS NULL THEN RETURN NULL; END IF;
  CASE lower(p_tipo)
    WHEN 'rda' THEN SELECT count(*) INTO v_count FROM rda WHERE commessa_id = p_commessa_id;
    WHEN 'rdo' THEN SELECT count(*) INTO v_count FROM rdo WHERE commessa_id = p_commessa_id;
    WHEN 'oda' THEN SELECT count(*) INTO v_count FROM oda WHERE commessa_id = p_commessa_id;
    WHEN 'dam' THEN SELECT count(*) INTO v_count FROM dam WHERE commessa_id = p_commessa_id;
    ELSE v_count := 0;
  END CASE;
  RETURN v_codice || '/' || upper(p_tipo) || '-' || lpad((v_count + 1)::text, 3, '0');
END;
$$;
