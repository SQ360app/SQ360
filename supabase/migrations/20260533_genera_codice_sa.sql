-- Aggiorna genera_codice_commessa: aggiunge p_sa (Stazione Appaltante) opzionale
-- Nuovo formato con SA: YY-SA-PR-CAT-NNN (es. 26-COM-NA-OG1-001)
-- Vecchio formato senza SA: YY-CAT-PR-NNN (retrocompatibile)

CREATE OR REPLACE FUNCTION genera_codice_commessa(
  p_azienda_id UUID,
  p_categoria  TEXT,
  p_provincia  TEXT,
  p_sa         TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_anno   TEXT := TO_CHAR(NOW(), 'YY');
  v_cat    TEXT := UPPER(LEFT(COALESCE(p_categoria, 'GE'), 6));
  v_prov   TEXT := UPPER(LEFT(COALESCE(p_provincia, 'XX'), 2));
  v_sa     TEXT := UPPER(LEFT(COALESCE(p_sa, ''), 4));
  v_seq    INT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM commesse
  WHERE azienda_id = p_azienda_id
    AND LEFT(codice, 2) = v_anno;

  IF p_sa IS NOT NULL AND p_sa != '' THEN
    RETURN v_anno || '-' || v_sa || '-' || v_prov || '-' || v_cat || '-' || LPAD(v_seq::TEXT, 3, '0');
  ELSE
    RETURN v_anno || '-' || v_cat || '-' || v_prov || '-' || LPAD(v_seq::TEXT, 3, '0');
  END IF;
END;
$$;
