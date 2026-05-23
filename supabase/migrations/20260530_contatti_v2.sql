-- Estende tabella contatti con tutti i campi anagrafici, professionali e di rischio
-- Idempotente: tutti i campi usano ADD COLUMN IF NOT EXISTS

ALTER TABLE contatti
  ADD COLUMN IF NOT EXISTS tipo                    TEXT,           -- professionista | fornitore | subappaltatore | persona | altro
  ADD COLUMN IF NOT EXISTS cognome                 TEXT,
  ADD COLUMN IF NOT EXISTS ragione_sociale         TEXT,
  ADD COLUMN IF NOT EXISTS codice_fiscale          TEXT,
  ADD COLUMN IF NOT EXISTS partita_iva             TEXT,
  ADD COLUMN IF NOT EXISTS pec                     TEXT,
  ADD COLUMN IF NOT EXISTS iban                    TEXT,
  ADD COLUMN IF NOT EXISTS regime_fiscale          TEXT,           -- ordinario | forfettario | minimi | pa
  ADD COLUMN IF NOT EXISTS telefono_ufficio        TEXT,
  ADD COLUMN IF NOT EXISTS telefono_mobile         TEXT,
  ADD COLUMN IF NOT EXISTS email                   TEXT,
  ADD COLUMN IF NOT EXISTS website                 TEXT,
  ADD COLUMN IF NOT EXISTS indirizzo               TEXT,
  ADD COLUMN IF NOT EXISTS comune                  TEXT,
  ADD COLUMN IF NOT EXISTS cap                     TEXT,
  ADD COLUMN IF NOT EXISTS provincia               TEXT,
  ADD COLUMN IF NOT EXISTS lat                     NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS lng                     NUMERIC(10, 7),

  -- Dati professionali
  ADD COLUMN IF NOT EXISTS tipo_professione        TEXT,           -- architetto | ingegnere | geometra | geologo | ...
  ADD COLUMN IF NOT EXISTS ordine_professionale    TEXT,
  ADD COLUMN IF NOT EXISTS n_iscrizione_ordine     TEXT,
  ADD COLUMN IF NOT EXISTS provincia_ordine        TEXT,
  ADD COLUMN IF NOT EXISTS data_iscrizione_ordine  DATE,

  -- Polizza RC
  ADD COLUMN IF NOT EXISTS polizza_rc_numero       TEXT,
  ADD COLUMN IF NOT EXISTS polizza_rc_scadenza     DATE,
  ADD COLUMN IF NOT EXISTS polizza_rc_massimale    NUMERIC(14, 2),

  -- Inarcassa / previdenza
  ADD COLUMN IF NOT EXISTS inarcassa_regolare      BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS inarcassa_scadenza      DATE,

  -- SOA, DURC, certificazioni
  ADD COLUMN IF NOT EXISTS soa_categorie           JSONB,          -- [{ categoria, classifica, scadenza }]
  ADD COLUMN IF NOT EXISTS durc_scadenza           DATE,
  ADD COLUMN IF NOT EXISTS durc_regolare           BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS iso_certificazioni      TEXT[],         -- ['ISO9001', 'ISO14001', ...]

  -- Patente a crediti
  ADD COLUMN IF NOT EXISTS patente_cantieri        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS patente_punteggio       INTEGER,

  -- Relazioni e metadati
  ADD COLUMN IF NOT EXISTS studio_id               UUID REFERENCES contatti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specializzazioni        TEXT[],
  ADD COLUMN IF NOT EXISTS note                    TEXT,
  ADD COLUMN IF NOT EXISTS rating                  NUMERIC(2, 1), -- 0.0 – 5.0
  ADD COLUMN IF NOT EXISTS blacklist               BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blacklist_motivo        TEXT;

-- Indici utili per ricerche frequenti
CREATE INDEX IF NOT EXISTS idx_contatti_tipo       ON contatti(tipo);
CREATE INDEX IF NOT EXISTS idx_contatti_provincia  ON contatti(provincia);
CREATE INDEX IF NOT EXISTS idx_contatti_durc_scad  ON contatti(durc_scadenza);
CREATE INDEX IF NOT EXISTS idx_contatti_blacklist  ON contatti(blacklist) WHERE blacklist = TRUE;
CREATE INDEX IF NOT EXISTS idx_contatti_studio     ON contatti(studio_id);
