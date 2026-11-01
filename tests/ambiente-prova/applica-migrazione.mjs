#!/usr/bin/env node
// ─── Applica una migrazione SQL al SOLO database di PROVA ────────────────────
// Uso: node tests/ambiente-prova/applica-migrazione.mjs supabase/migrations/<file>.sql
// psql con ON_ERROR_STOP: al primo errore si ferma (la migrazione ha BEGIN/COMMIT).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { caricaAmbienti, connessione, PG_BIN, ripulisci, maschera } from './env.mjs'

const file = process.argv[2]
if (!file || !fs.existsSync(file)) { console.error('Uso: applica-migrazione.mjs <file.sql>'); process.exit(1) }
const { test, refTest, refProd, problemi } = caricaAmbienti()
if (problemi.length) { console.error('Fermato:\n- ' + problemi.join('\n- ')); process.exit(1) }
const db = connessione(test.TEST_DB_URL, refTest)
if (!db || db.ref !== refTest || db.ref === refProd) { console.error('Fermato: TEST_DB_URL non è del progetto di prova'); process.exit(1) }
const r = spawnSync(path.join(PG_BIN, 'psql.exe'), ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path.resolve(file), '-d', db.conn],
  { encoding: 'utf8', env: { ...process.env, PGPASSWORD: db.password }, maxBuffer: 1 << 26 })
const err = ripulisci(r.stderr || '', [db.password, test.TEST_DB_URL])
if (r.status !== 0) { console.error(`Migrazione NON applicata alla prova ${maschera(refTest)}:\n${err}`); process.exit(1) }
console.log(`Migrazione ${path.basename(file)} applicata alla prova ${maschera(refTest)}${err.trim() ? '\n' + err.trim() : ''}`)
