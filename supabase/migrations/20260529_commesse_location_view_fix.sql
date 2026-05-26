-- Aggiungi colonne localizzazione a commesse (se non esistono)
ALTER TABLE commesse ADD COLUMN IF NOT EXISTS lat               numeric;
ALTER TABLE commesse ADD COLUMN IF NOT EXISTS lng               numeric;
ALTER TABLE commesse ADD COLUMN IF NOT EXISTS indirizzo_cantiere text;
ALTER TABLE commesse ADD COLUMN IF NOT EXISTS comune_cantiere   text;
ALTER TABLE commesse ADD COLUMN IF NOT EXISTS cap_cantiere      text;
ALTER TABLE commesse ADD COLUMN IF NOT EXISTS provincia         text;

-- Fix v_commesse_kpi:
--   • sal_attivi → sal (nome tabella corretto)
--   • provincia_cantiere → provincia (nome colonna corretto)
--   • escludi SAL in bozza dall'avanzamento
CREATE OR REPLACE VIEW v_commesse_kpi AS
SELECT
  c.id,
  c.azienda_id,
  c.codice,
  c.nome,
  c.committente,
  c.indirizzo_cantiere,
  c.comune_cantiere,
  c.provincia,
  c.lat,
  c.lng,
  c.stato,
  c.tipo_commessa,
  c.categoria_lavoro,
  c.importo_contratto,
  c.importo_base,
  c.ribasso_pct,
  c.oneri_sicurezza,
  c.data_inizio_lavori,
  c.data_fine_contrattuale,
  c.data_proroga,
  c.giorni_contrattuali,
  c.tipo_giorni,
  c.cig,
  c.cup,
  COALESCE(sal_agg.importo_sal_totale, 0)  AS importo_sal_totale,
  COALESCE(sal_agg.n_sal, 0)               AS n_sal,
  sal_agg.ultimo_sal_data,
  CASE
    WHEN c.importo_contratto > 0
    THEN ROUND(
           (COALESCE(sal_agg.importo_sal_totale, 0) / c.importo_contratto * 100)::numeric,
           1
         )
    ELSE 0
  END                                      AS avanzamento_pct,
  c.importo_contratto - COALESCE(sal_agg.importo_sal_totale, 0) AS residuo,
  CASE
    WHEN COALESCE(c.data_proroga, c.data_fine_contrattuale) >= CURRENT_DATE
    THEN (COALESCE(c.data_proroga, c.data_fine_contrattuale) - CURRENT_DATE)
    ELSE 0
  END                                      AS giorni_rimanenti,
  CASE
    WHEN COALESCE(c.data_proroga, c.data_fine_contrattuale) < CURRENT_DATE
     AND c.stato NOT IN ('completata', 'collaudata')
    THEN true
    ELSE false
  END                                      AS in_ritardo
FROM commesse c
LEFT JOIN (
  SELECT
    commessa_id,
    SUM(importo_netto)   AS importo_sal_totale,
    COUNT(*)             AS n_sal,
    MAX(data_emissione)  AS ultimo_sal_data
  FROM sal
  WHERE tipo = 'ATTIVO'
    AND stato NOT IN ('bozza', 'annullato')
  GROUP BY commessa_id
) sal_agg ON sal_agg.commessa_id = c.id;
