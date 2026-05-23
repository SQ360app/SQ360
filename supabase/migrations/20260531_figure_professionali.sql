-- Crea tabella commessa_figure (idempotente)
CREATE TABLE IF NOT EXISTS commessa_figure (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commessa_id       UUID NOT NULL REFERENCES commesse(id) ON DELETE CASCADE,
  ruolo             TEXT NOT NULL,
  professionista_id UUID NOT NULL REFERENCES professionisti_fornitori(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (commessa_id, ruolo)
);

CREATE INDEX IF NOT EXISTS idx_commessa_figure_commessa
  ON commessa_figure(commessa_id);

CREATE INDEX IF NOT EXISTS idx_commessa_figure_professionista
  ON commessa_figure(professionista_id);

ALTER TABLE commessa_figure ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commessa_figure' AND policyname = 'commessa_figure_isolamento'
  ) THEN
    CREATE POLICY commessa_figure_isolamento ON commessa_figure
      FOR ALL USING (
        commessa_id IN (
          SELECT id FROM commesse
          WHERE azienda_id = (
            SELECT azienda_id FROM utenti WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;
