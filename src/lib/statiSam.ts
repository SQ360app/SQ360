// ─── Stati SAM (tabella dam, colonna stato = testo libero) ───────────────────
// Valori canonici salvati nel DB (quelli della pagina SAM della commessa):
//   bozza → inviata_dl → approvata | rifiutata | integrazione
// I vecchi valori MAIUSCOLI dell'enum (BOZZA, INVIATO_DL, APPROVATO…) vengono
// convertiti in lettura, così pagina globale e pagina commessa vedono lo stesso stato.

export type StatoSam = 'bozza' | 'inviata_dl' | 'approvata' | 'rifiutata' | 'integrazione'

const DA_LEGACY: Record<string, StatoSam> = {
  BOZZA: 'bozza',
  INVIATO_DL: 'inviata_dl', INVIATA_A_DL: 'inviata_dl', DOCUMENTAZIONE_INVIATA: 'inviata_dl', IN_REVISIONE_DL: 'inviata_dl',
  APPROVATO: 'approvata', APPROVATO_NOTE: 'approvata', ACCETTATA: 'approvata', ACCETTATA_CON_RISERVA: 'approvata',
  RIFIUTATO: 'rifiutata', RIFIUTATA: 'rifiutata', SCADUTA: 'rifiutata',
  REV_1: 'integrazione', REV_2: 'integrazione', INTEGRAZIONE_RICHIESTA: 'integrazione',
  IN_ATTESA_INTEGRAZIONE: 'integrazione', DOCUMENTAZIONE_INCOMPLETA: 'integrazione',
}

export function normalizzaStatoSam(stato: string | null | undefined): StatoSam {
  const s = (stato || '').trim()
  if (['bozza', 'inviata_dl', 'approvata', 'rifiutata', 'integrazione'].includes(s)) return s as StatoSam
  return DA_LEGACY[s.toUpperCase()] ?? 'bozza'
}
