-- ============================================================
-- Revisioni documentali semplici + WBS su RDA extra-computo
-- ============================================================

-- RDA
ALTER TABLE rda
  ADD COLUMN IF NOT EXISTS revisione    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doc_padre_id UUID REFERENCES rda(id),
  ADD COLUMN IF NOT EXISTS is_vigente   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS motivo_rev   TEXT,
  ADD COLUMN IF NOT EXISTS revised_by   UUID REFERENCES utenti(id),
  ADD COLUMN IF NOT EXISTS revised_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wbs_ref      TEXT;

-- RDO
ALTER TABLE rdo
  ADD COLUMN IF NOT EXISTS revisione    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doc_padre_id UUID REFERENCES rdo(id),
  ADD COLUMN IF NOT EXISTS is_vigente   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS motivo_rev   TEXT,
  ADD COLUMN IF NOT EXISTS revised_by   UUID REFERENCES utenti(id),
  ADD COLUMN IF NOT EXISTS revised_at   TIMESTAMPTZ;

-- DAM
ALTER TABLE dam
  ADD COLUMN IF NOT EXISTS doc_padre_id       UUID REFERENCES dam(id),
  ADD COLUMN IF NOT EXISTS is_vigente         BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS motivo_rev         TEXT,
  ADD COLUMN IF NOT EXISTS revised_by         UUID REFERENCES utenti(id),
  ADD COLUMN IF NOT EXISTS revised_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approvata_con_note BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS note_prescrittive  TEXT;

-- ODA
ALTER TABLE oda
  ADD COLUMN IF NOT EXISTS revisione    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doc_padre_id UUID REFERENCES oda(id),
  ADD COLUMN IF NOT EXISTS is_vigente   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS motivo_rev   TEXT,
  ADD COLUMN IF NOT EXISTS revised_by   UUID REFERENCES utenti(id),
  ADD COLUMN IF NOT EXISTS revised_at   TIMESTAMPTZ;

-- contratti_sub
ALTER TABLE contratti_sub
  ADD COLUMN IF NOT EXISTS revisione    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doc_padre_id UUID REFERENCES contratti_sub(id),
  ADD COLUMN IF NOT EXISTS is_vigente   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS motivo_rev   TEXT,
  ADD COLUMN IF NOT EXISTS revised_by   UUID REFERENCES utenti(id),
  ADD COLUMN IF NOT EXISTS revised_at   TIMESTAMPTZ;
