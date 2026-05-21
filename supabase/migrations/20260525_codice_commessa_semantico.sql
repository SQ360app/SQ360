-- Codifica commessa semantica [AA]-[CAT]-[PR]-[NNN]
ALTER TABLE aziende
  ADD COLUMN IF NOT EXISTS codice_separatore char(1) DEFAULT '-';

ALTER TABLE commesse
  ADD COLUMN IF NOT EXISTS categoria_lavoro text DEFAULT 'OG1',
  ADD COLUMN IF NOT EXISTS provincia_cantiere text DEFAULT '';

CREATE OR REPLACE FUNCTION genera_codice_commessa(
  p_azienda_id uuid,
  p_categoria text DEFAULT 'OG1',
  p_provincia text DEFAULT 'XX'
) RETURNS text AS $$
DECLARE
  v_anno text := to_char(NOW(), 'YY');
  v_sep char(1) := '-';
  v_prog integer;
BEGIN
  SELECT COALESCE(codice_separatore, '-')
  INTO v_sep
  FROM aziende WHERE id = p_azienda_id;

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(codice, v_sep, 4) AS integer)
  ), 0) + 1
  INTO v_prog
  FROM commesse
  WHERE azienda_id = p_azienda_id
    AND codice LIKE v_anno||v_sep||p_categoria||v_sep||p_provincia||v_sep||'%';

  RETURN v_anno||v_sep||p_categoria||v_sep||p_provincia
         ||v_sep||LPAD(v_prog::text, 3, '0');
END;
$$ LANGUAGE plpgsql;
