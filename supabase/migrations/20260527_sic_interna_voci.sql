-- Sicurezza interna alle voci: formula 3 livelli (Primus-compatible)
ALTER TABLE voci_computo
  ADD COLUMN IF NOT EXISTS sic_interna_importo numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sic_interna_percentuale numeric DEFAULT 0;

-- sicurezza_interna_esclusa_ribasso già usata in anagrafica/page.tsx
-- DEFAULT true = quota sicurezza NON soggetta a ribasso (più tutelante)
ALTER TABLE commesse
  ADD COLUMN IF NOT EXISTS sicurezza_interna_esclusa_ribasso boolean DEFAULT true;
