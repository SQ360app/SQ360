-- ============================================================
-- Flusso acquisti: RDO → SAM → ODA
-- Idempotente — eseguibile più volte senza errori
-- ============================================================

ALTER TABLE rdo
  ADD COLUMN IF NOT EXISTS tipo_affidamento TEXT,
  ADD COLUMN IF NOT EXISTS pct_manodopera   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS richiede_sam     BOOLEAN DEFAULT FALSE;

ALTER TABLE oda
  ADD COLUMN IF NOT EXISTS tipo_affidamento TEXT,
  ADD COLUMN IF NOT EXISTS pct_manodopera   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS is_subappalto    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS compliance_ok    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS compliance_note  JSONB,
  ADD COLUMN IF NOT EXISTS dam_id           UUID REFERENCES dam(id),
  ADD COLUMN IF NOT EXISTS richiede_sam     BOOLEAN DEFAULT FALSE;

ALTER TABLE commesse
  ADD COLUMN IF NOT EXISTS sam_obbligatoria BOOLEAN DEFAULT FALSE;
