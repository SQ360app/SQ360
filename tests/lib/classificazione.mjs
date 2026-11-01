// ─── Mappa delle appartenenze: come ogni tabella risale alla sua azienda ─────
// Unica fonte per seed, test di isolamento e generazione della migrazione.
//
// Tipi:
//   azienda              colonna azienda_id
//   commessa             colonna commessa_id → commesse.azienda_id
//   commessa_o_azienda   entrambe: vale l'azienda della commessa; azienda_id solo se commessa_id è vuota
//                        (alcune scritture del codice, es. computo_metrico, non impostano azienda_id)
//   figlia               risale alla tabella madre tramite una chiave esterna
//   utenti / riga_azienda / audit   regole dedicate
//   globale_lettura      tabella di riferimento senza azienda: sola lettura per gli utenti collegati
//   globale_invariata    tabella di riferimento già in sola lettura: non toccata
//   bloccata             nessuna regola: dal browser nessuno legge né scrive (non toccata, o regole tolte)

/** Tabelle senza azienda_id/commessa_id: madre da cui ereditano (decisioni 01/11/2026) */
export const FIGLIE = {
  certificazioni_dam:       { col: 'dam_id', padre: 'dam' },
  computo_wbs_link:         { col: 'voce_computo_id', padre: 'voci_computo' },
  documenti_fornitore:      { col: 'fornitore_id', padre: 'fornitori' },
  documenti_progettista:    { col: 'progettista_id', padre: 'progettisti' },
  misure:                   { col: 'voce_id', padre: 'voci_ep' },
  misure_voce:              { col: 'voce_id', padre: 'voci_computo' },
  preventivo_voci:          { col: 'preventivo_id', padre: 'preventivi' },
  rda_voci:                 { col: 'rda_id', padre: 'rda' },
  rdo_fornitori:            { col: 'fornitore_id', padre: 'fornitori' },
  rdo_voci:                 { col: 'rdo_id', padre: 'richieste_offerta' },
  sal_attivo_voci:          { col: 'sal_id', padre: 'sal_attivi' },
  sal_passivo_voci:         { col: 'sal_passivo_id', padre: 'sal_passivi' },
  sal_righe:                { col: 'sal_id', padre: 'sals' },
  sal_voci:                 { col: 'sal_id', padre: 'sal' },
  soggetto_referenti:       { col: 'soggetto_id', padre: 'professionisti_fornitori' },
  tariffa_componenti:       { col: 'tariffa_id', padre: 'tariffe' },
  variante_diff:            { col: 'variante_id', padre: 'varianti' },
  voci_computo:             { col: 'computo_id', padre: 'computo_metrico' },
  voci_computo_misurazioni: { col: 'voce_computo_id', padre: 'voci_computo' },
  voci_contratto:           { col: 'contratto_id', padre: 'contratti' },
  voci_sal:                 { col: 'sal_id', padre: 'sal' },
}

export const SPECIALI = {
  utenti:                     { tipo: 'utenti' },
  azienda:                    { tipo: 'riga_azienda', tocca: false },   // regole attuali già corrette (SELECT + UPDATE propria)
  aziende:                    { tipo: 'riga_azienda', tocca: true },    // oggi usa mia_azienda_id() → NULL: corretta
  audit_trail:                { tipo: 'audit' },                        // regole attuali corrette, non toccata
  categorie_c:                { tipo: 'globale_invariata' },
  categorie_sb:               { tipo: 'globale_invariata' },
  categorie_sc:               { tipo: 'globale_invariata' },
  wbs_template:               { tipo: 'globale_lettura' },
  config_soglie_approvazione: { tipo: 'bloccata', tocca: false },
  user_aziende:               { tipo: 'bloccata', tocca: false, proprietario: { col: 'azienda_id' } },
  contratto_voci:             { tipo: 'bloccata', tocca: false, proprietario: { col: 'tariffa_id', padre: 'tariffe' } },
  rdo_offerte:                { tipo: 'bloccata', tocca: true,  proprietario: { col: 'rdo_id', padre: 'rdo' } },
}

/** Costruisce la classificazione a partire dall'elenco colonne { tabella: Set(colonne) } */
export function classifica(colonnePerTabella) {
  const out = {}
  for (const [t, cols] of Object.entries(colonnePerTabella)) {
    if (SPECIALI[t]) out[t] = { ...SPECIALI[t] }
    else if (FIGLIE[t]) out[t] = { tipo: 'figlia', ...FIGLIE[t] }
    else if (cols.has('azienda_id') && cols.has('commessa_id')) out[t] = { tipo: 'commessa_o_azienda' }
    else if (cols.has('azienda_id')) out[t] = { tipo: 'azienda' }
    else if (cols.has('commessa_id')) out[t] = { tipo: 'commessa' }
    else out[t] = { tipo: 'sconosciuta' }
  }
  return out
}

const q = n => `public.${n}`

/** Espressione SQL booleana: la riga (alias a) appartiene all'azienda dell'utente collegato */
export function condizione(cls, t, a = t, prof = 0) {
  const ME = '(SELECT public.get_azienda_id())'
  const c = cls[t]
  const commessaMia = `EXISTS (SELECT 1 FROM public.commesse c${prof} WHERE c${prof}.id = ${a}.commessa_id AND c${prof}.azienda_id = ${ME})`
  switch (c.tipo) {
    case 'azienda': case 'utenti': return `${a}.azienda_id = ${ME}`
    case 'commessa': return commessaMia
    case 'commessa_o_azienda': return `((${a}.commessa_id IS NOT NULL AND ${commessaMia}) OR (${a}.commessa_id IS NULL AND ${a}.azienda_id = ${ME}))`
    case 'riga_azienda': return `${a}.id = ${ME}`
    case 'figlia': {
      const p = `p${prof + 1}`
      return `EXISTS (SELECT 1 FROM ${q(c.padre)} ${p} WHERE ${p}.id = ${a}.${c.col} AND ${condizione(cls, c.padre, p, prof + 1)})`
    }
    default: throw new Error(`condizione: tipo ${c.tipo} per ${t}`)
  }
}

/** Espressione SQL (eseguita come postgres) che restituisce l'azienda proprietaria della riga */
export function proprietario(cls, t, a = t, prof = 0) {
  const c = cls[t]
  const p = `o${prof + 1}`
  const viaCommessa = `(SELECT c${prof}.azienda_id FROM public.commesse c${prof} WHERE c${prof}.id = ${a}.commessa_id)`
  const viaPadre = (col, padre) => `(SELECT ${proprietario(cls, padre, p, prof + 1)} FROM ${q(padre)} ${p} WHERE ${p}.id = ${a}.${col})`
  switch (c.tipo) {
    case 'azienda': case 'utenti': return `${a}.azienda_id`
    case 'commessa': return viaCommessa
    case 'commessa_o_azienda': return `(CASE WHEN ${a}.commessa_id IS NOT NULL THEN ${viaCommessa} ELSE ${a}.azienda_id END)`
    case 'riga_azienda': return `${a}.id`
    case 'figlia': return viaPadre(c.col, c.padre)
    case 'audit': return `(SELECT u${prof}.azienda_id FROM public.utenti u${prof} WHERE u${prof}.id = ${a}.utente_id)`
    case 'bloccata':
      if (!c.proprietario) return 'NULL::uuid'
      return c.proprietario.padre ? viaPadre(c.proprietario.col, c.proprietario.padre) : `${a}.${c.proprietario.col}`
    default: return 'NULL::uuid'   // tabelle globali: nessuna azienda
  }
}

/** Le tabelle "di azienda" (quelle dove A non deve mai vedere B) */
export const diAzienda = c => !['globale_lettura', 'globale_invariata'].includes(c.tipo) && !(c.tipo === 'bloccata' && !c.proprietario)
