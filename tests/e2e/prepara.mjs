#!/usr/bin/env node
// ─── Preparazione dati per i test e2e (SOLO prova, dopo tests/seed/seed.mjs) ──
// Uso: node tests/e2e/prepara.mjs
//   • WBS pulita per la commessa di A: 1 STRUTTURE / 1.1 Fondazioni (wbs_nodes)
//   • 2 voci del computo di A (codice univoco) con WBS 1.1 → usate per la RDA da computo
//   • contratto di subappalto di A con il fornitore dal DURC SCADUTO (SAL passivi)
// Scrive tests/.state/e2e.json (escluso da git).
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { apriDb, leggiStato, STATO_DIR } from '../lib/ambiente.mjs'

const stato = leggiStato()
for (const f of fs.readdirSync(STATO_DIR)) if (/^e2e-ctx-.*.json$/.test(f)) fs.rmSync(path.join(STATO_DIR, f))   // contesti del giro precedente
const A = stato.aziende.A
const db = await apriDb()

// WBS della commessa di A (il riempitivo del seed vi aveva messo righe sintetiche)
const { rows: rif } = await db.query(`
  SELECT c.relname t, a.attname col FROM pg_constraint co JOIN pg_class c ON c.oid = co.conrelid
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = co.conkey[1]
  WHERE co.contype = 'f' AND co.confrelid = 'public.wbs_nodes'::regclass AND c.relname <> 'wbs_nodes'`)
for (const { t, col } of rif)
  await db.query(`UPDATE public."${t}" SET "${col}" = NULL WHERE "${col}" IN (SELECT id FROM public.wbs_nodes WHERE commessa_id = $1)`, [A.commessa])
await db.query('UPDATE public.wbs_nodes SET parent_id = NULL WHERE commessa_id = $1', [A.commessa])
await db.query('DELETE FROM public.wbs_nodes WHERE commessa_id = $1', [A.commessa])
const radice = randomUUID()
await db.query(`INSERT INTO public.wbs_nodes (id, commessa_id, azienda_id, codice, descrizione, parent_id, ordine) VALUES
  ($1, $2, $3, '1', 'STRUTTURE', NULL, 0), ($4, $2, $3, '1.1', 'Fondazioni', $1, 0)`, [radice, A.commessa, A.id, randomUUID()])

// due voci con codice univoco e non contenuto in altri codici o descrizioni
const { rows: voci } = await db.query(`
  WITH v AS (SELECT v.* FROM public.voci_computo v JOIN public.computo_metrico c ON c.id = v.computo_id WHERE c.commessa_id = $1)
  SELECT v.id, v.codice, v.quantita::float8 quantita, v.prezzo_unitario::float8 pu, v.um
  FROM v WHERE v.quantita > 1 AND v.prezzo_unitario > 1 AND length(v.codice) >= 5
    AND (SELECT count(*) FROM v w WHERE strpos(w.codice, v.codice) > 0 OR strpos(coalesce(w.descrizione, ''), v.codice) > 0) = 1
  ORDER BY v.importo DESC LIMIT 2`, [A.commessa])
if (voci.length < 2) throw new Error('Nel computo di A non ci sono 2 voci adatte')
await db.query(`UPDATE public.voci_computo SET wbs_id = '1.1', wbs_label = 'Fondazioni' WHERE id = ANY($1)`, [voci.map(v => v.id)])

// fornitori di A
const { rows: forn } = await db.query(`SELECT id, nome, ragione_sociale, durc_scadenza FROM public.professionisti_fornitori WHERE azienda_id = $1 ORDER BY durc_scadenza DESC`, [A.id])
const [valido, inScadenza, scaduto] = forn
if (!scaduto || new Date(scaduto.durc_scadenza) >= new Date()) throw new Error('Manca il fornitore di A con DURC scaduto')

// contratto di subappalto di A con il fornitore dal DURC scaduto
const { rows: [cs] } = await db.query(`SELECT id FROM public.contratti_sub WHERE commessa_id = $1 LIMIT 1`, [A.commessa])
if (!cs) throw new Error('Manca un contratto_sub di A (seed)')
await db.query(`UPDATE public.contratti_sub SET fornitore_id = $1, importo_netto = 50000 WHERE id = $2`, [scaduto.id, cs.id])
await db.query('DELETE FROM public.sal_passivi WHERE contratto_id = $1', [cs.id])

const out = { voci, wbs: { codice: '1.1', label: 'Fondazioni' }, fornitori: { valido, inScadenza, scaduto }, contrattoSub: cs.id }
fs.writeFileSync(path.join(STATO_DIR, 'e2e.json'), JSON.stringify(out, null, 2))
console.log(`Preparazione e2e: voci ${voci.map(v => v.codice).join(', ')} · fornitori ${forn.length} · contratto sub con DURC scaduto`)
await db.end()
