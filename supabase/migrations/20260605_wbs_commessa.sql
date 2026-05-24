-- WBS personalizzabile: template aziendale + override per commessa

CREATE TABLE IF NOT EXISTS wbs_template (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id    uuid NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  codice        text NOT NULL,
  etichetta     text NOT NULL,
  ordine        integer NOT NULL DEFAULT 0,
  colore        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (azienda_id, codice)
);

CREATE INDEX IF NOT EXISTS idx_wbs_template_azienda ON wbs_template(azienda_id, ordine);

ALTER TABLE wbs_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wbs_template_azienda" ON wbs_template;
CREATE POLICY "wbs_template_azienda" ON wbs_template
  USING (azienda_id = (SELECT azienda_id FROM utenti WHERE id = auth.uid()))
  WITH CHECK (azienda_id = (SELECT azienda_id FROM utenti WHERE id = auth.uid()));


CREATE TABLE IF NOT EXISTS wbs_commessa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commessa_id   uuid NOT NULL REFERENCES commesse(id) ON DELETE CASCADE,
  azienda_id    uuid NOT NULL REFERENCES aziende(id) ON DELETE CASCADE,
  codice        text NOT NULL,
  etichetta     text NOT NULL,
  ordine        integer NOT NULL DEFAULT 0,
  colore        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commessa_id, codice)
);

CREATE INDEX IF NOT EXISTS idx_wbs_commessa_commessa ON wbs_commessa(commessa_id, ordine);

ALTER TABLE wbs_commessa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wbs_commessa_azienda" ON wbs_commessa;
CREATE POLICY "wbs_commessa_azienda" ON wbs_commessa
  USING (azienda_id = (SELECT azienda_id FROM utenti WHERE id = auth.uid()))
  WITH CHECK (azienda_id = (SELECT azienda_id FROM utenti WHERE id = auth.uid()));
