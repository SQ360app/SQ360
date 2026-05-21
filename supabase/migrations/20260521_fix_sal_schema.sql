-- Fix schema SAL: aggiungi colonne mancanti richieste da sal-attivi/page.tsx
ALTER TABLE sal ADD COLUMN IF NOT EXISTS metodo text DEFAULT 'manuale';
ALTER TABLE sal ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE sal ADD COLUMN IF NOT EXISTS fattura_numero text;
ALTER TABLE sal ADD COLUMN IF NOT EXISTS fattura_data date;
ALTER TABLE sal ADD COLUMN IF NOT EXISTS fattura_importo numeric;
ALTER TABLE sal ADD COLUMN IF NOT EXISTS pagamento_ricevuto boolean DEFAULT false;
ALTER TABLE sal ADD COLUMN IF NOT EXISTS pagamento_data date;
ALTER TABLE sal ADD COLUMN IF NOT EXISTS netto_pagare numeric DEFAULT 0;

-- Fix schema sal_voci: aggiungi wbs_id
ALTER TABLE sal_voci ADD COLUMN IF NOT EXISTS wbs_id text;

-- Indici performance (colonne verificate via OpenAPI schema)
CREATE INDEX IF NOT EXISTS idx_sal_commessa ON sal(commessa_id);
CREATE INDEX IF NOT EXISTS idx_sal_voci_sal ON sal_voci(sal_id);
CREATE INDEX IF NOT EXISTS idx_oda_commessa ON oda(commessa_id);
CREATE INDEX IF NOT EXISTS idx_commesse_azienda ON commesse(azienda_id);
CREATE INDEX IF NOT EXISTS idx_rda_commessa ON rda(commessa_id);
CREATE INDEX IF NOT EXISTS idx_voci_computo_computo ON voci_computo(computo_id);
