-- Documenti azienda: logo e carta intestata per PDF
ALTER TABLE aziende
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS carta_intestata_header_url text,
  ADD COLUMN IF NOT EXISTS carta_intestata_footer_url text;
