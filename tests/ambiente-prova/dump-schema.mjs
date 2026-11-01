#!/usr/bin/env node
// ─── Dump della STRUTTURA di produzione (pg_dump --schema-only, sola lettura) ─
// Uso: node tests/ambiente-prova/dump-schema.mjs
// Output (escluso da git): backup-schema-produzione/<data>/
//   schema-public.sql    → schema public (tabelle, enum, FK, funzioni, RLS, grant, trigger)
//   schema-completo.sql  → tutti gli schemi (riferimento: storage, auth, event trigger, estensioni)
// pg_dump lavora in una transazione READ ONLY; in più chiediamo
// default_transaction_read_only=on alla connessione.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { caricaAmbienti, connessione, PG_BIN, BACKUP_DIR, ripulisci, maschera } from './env.mjs'

const { schema, refProd, problemi } = caricaAmbienti({ servonoProd: true })
if (problemi.length) { console.error('Fermato:\n- ' + problemi.join('\n- ')); process.exit(1) }

const { conn, password } = connessione(schema.PROD_DB_URL, refProd)
const oggi = new Date().toISOString().slice(0, 10)
const out = path.join(BACKUP_DIR, oggi)
fs.mkdirSync(out, { recursive: true })

function dump(file, extra) {
  const args = ['--schema-only', '--no-owner', '--quote-all-identifiers', '-f', path.join(out, file), ...extra, '-d', conn]
  const run = opts => spawnSync(path.join(PG_BIN, 'pg_dump.exe'), args, { encoding: 'utf8', env: { ...process.env, PGPASSWORD: password, ...opts } })
  let r = run({ PGOPTIONS: '-c default_transaction_read_only=on' })
  if (r.status !== 0 && /options|startup|unsupported/i.test(r.stderr)) r = run({}) // il pooler può rifiutare PGOPTIONS
  if (r.status !== 0) { console.error(`${file}: errore\n` + ripulisci(r.stderr, [password, schema.PROD_DB_URL])); process.exit(1) }
  const kb = Math.round(fs.statSync(path.join(out, file)).size / 1024)
  console.log(`${file}: ${kb} KB`)
}

console.log(`Produzione ${maschera(refProd)} → ${path.relative(process.cwd(), out)}`)
dump('schema-public.sql', ['--schema=public'])
dump('schema-completo.sql', [])
