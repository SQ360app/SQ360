-- View KPI commesse: avanzamento SAL, residuo, giorni rimanenti, ritardo
-- ATTENZIONE: referenzia sal_attivi — verificare se la tabella si chiama 'sal'
-- e se le colonne lat/lng/indirizzo_cantiere/etc. esistono su commesse

CREATE OR REPLACE VIEW v_commesse_kpi AS
SELECT
  c.id,
  c.azienda_id,
  c.codice,
  c.nome,
  c.committente,
  c.indirizzo_cantiere,
  c.comune_cantiere,
  c.provincia_cantiere,
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
  -- Avanzamento SAL attivi
  COALESCE(sal.importo_sal_totale, 0)        AS importo_sal_totale,
  COALESCE(sal.n_sal, 0)                     AS n_sal,
  COALESCE(sal.ultimo_sal_data, NULL)        AS ultimo_sal_data,
  -- % avanzamento su importo contratto
  CASE
    WHEN c.importo_contratto > 0
    THEN ROUND((COALESCE(sal.importo_sal_totale,0) / c.importo_contratto * 100)::numeric, 1)
    ELSE 0
  END                                        AS avanzamento_pct,
  -- Residuo da fatturare
  c.importo_contratto - COALESCE(sal.importo_sal_totale, 0) AS residuo,
  -- Giorni rimanenti
  CASE
    WHEN COALESCE(c.data_proroga, c.data_fine_contrattuale) >= CURRENT_DATE
    THEN (COALESCE(c.data_proroga, c.data_fine_contrattuale) - CURRENT_DATE)
    ELSE 0
  END                                        AS giorni_rimanenti,
  -- In ritardo?
  CASE
    WHEN COALESCE(c.data_proroga, c.data_fine_contrattuale) < CURRENT_DATE
     AND c.stato NOT IN ('completata', 'collaudata')
    THEN true ELSE false
  END                                        AS in_ritardo
FROM commesse c
LEFT JOIN (
  SELECT
    commessa_id,
    SUM(importo_netto)   AS importo_sal_totale,
    COUNT(*)             AS n_sal,
    MAX(data_emissione)  AS ultimo_sal_data
  FROM sal_attivi
  GROUP BY commessa_id
) sal ON sal.commessa_id = c.id;
