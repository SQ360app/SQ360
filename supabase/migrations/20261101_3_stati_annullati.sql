-- ═══════════════════════════════════════════════════════════════════════════
-- SQ360 — Stati "annullato" per RDO e ODA (01/11/2026)
--
-- Aggiunge un solo valore a ciascun vincolo, lasciando tutti quelli attuali:
--   rdo_stato_check  + 'annullata'   (pulsante "✕ Annulla" della RDO)
--   oda_stato_check  + 'annullato'   (pulsante "Annulla" dell'ODA)
-- Decisioni (passo 6): aggiudicazione RDO → vincente 'accettata', altre 'rifiutata'
-- (valori già ammessi); pulsanti ODA → firmato / in_esecuzione / completato / annullato.
--
-- Provata SOLO sul progetto di prova sq360-test. In produzione: eseguire dopo revisione.
-- Ordine: 1) VERIFICA (sola lettura, qui sotto)  2) blocco BEGIN…COMMIT
-- In fondo: ritorno indietro (commentato).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── VERIFICA PRELIMINARE (sola lettura) ──────────────────────────────────────
-- Vincoli attuali: atteso rdo_stato_check = bozza, inviata, ricevuta, accettata, rifiutata
--                  e oda_stato_check = bozza, firmato, in_esecuzione, completato, contestato
/*
SELECT conrelid::regclass AS tabella, conname, pg_get_constraintdef(oid) AS definizione
FROM pg_constraint WHERE conname IN ('rdo_stato_check', 'oda_stato_check') ORDER BY 1;
*/

BEGIN;

ALTER TABLE public.rdo DROP CONSTRAINT IF EXISTS rdo_stato_check;
ALTER TABLE public.rdo ADD CONSTRAINT rdo_stato_check
  CHECK (stato = ANY (ARRAY['bozza'::text, 'inviata'::text, 'ricevuta'::text, 'accettata'::text, 'rifiutata'::text, 'annullata'::text]));

ALTER TABLE public.oda DROP CONSTRAINT IF EXISTS oda_stato_check;
ALTER TABLE public.oda ADD CONSTRAINT oda_stato_check
  CHECK (stato = ANY (ARRAY['bozza'::text, 'firmato'::text, 'in_esecuzione'::text, 'completato'::text, 'contestato'::text, 'annullato'::text]));

COMMIT;

-- ── CONTROLLO DOPO L'APPLICAZIONE (sola lettura) ────────────────────────────
/*
SELECT conrelid::regclass AS tabella, conname, pg_get_constraintdef(oid) AS definizione
FROM pg_constraint WHERE conname IN ('rdo_stato_check', 'oda_stato_check') ORDER BY 1;
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- TORNARE INDIETRO (commentato)
-- Prima riportare le righe con i nuovi valori a uno stato ammesso dal vincolo
-- originale, altrimenti l'ADD CONSTRAINT fallisce (scelta da fare caso per caso:
-- qui 'rifiutata' per le RDO annullate e 'contestato' per gli ODA annullati).
-- ═══════════════════════════════════════════════════════════════════════════
/*
BEGIN;
UPDATE public.rdo SET stato = 'rifiutata'  WHERE stato = 'annullata';
UPDATE public.oda SET stato = 'contestato' WHERE stato = 'annullato';
ALTER TABLE public.rdo DROP CONSTRAINT IF EXISTS rdo_stato_check;
ALTER TABLE public.rdo ADD CONSTRAINT rdo_stato_check
  CHECK (stato = ANY (ARRAY['bozza'::text, 'inviata'::text, 'ricevuta'::text, 'accettata'::text, 'rifiutata'::text]));
ALTER TABLE public.oda DROP CONSTRAINT IF EXISTS oda_stato_check;
ALTER TABLE public.oda ADD CONSTRAINT oda_stato_check
  CHECK (stato = ANY (ARRAY['bozza'::text, 'firmato'::text, 'in_esecuzione'::text, 'completato'::text, 'contestato'::text]));
COMMIT;
*/
