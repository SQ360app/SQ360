#!/usr/bin/env node
// ─── npm run test:piattaforma — test e2e sull'app locale collegata alla PROVA ─
//   1. seed della prova + preparazione e2e   2. avvio app locale (porta TEST_PORT)
//   3. Playwright (tests/e2e/*.spec.mjs)      4. report tests/report/RISULTATI.md
// Usa lo stato attuale della prova (con o senza la migrazione di isolamento: è scritto nel report).
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { ROOT, apriDb } from '../lib/ambiente.mjs'
import { avviaApp } from '../lib/app.mjs'
import { scriviRisultati } from './report.mjs'

const passo = (titolo, args, env = {}) => {
  console.log(`\n━━ ${titolo}`)
  return spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } }).status
}
if (passo('1a. Seed della prova', ['tests/seed/seed.mjs']) !== 0) process.exit(1)
if (passo('1b. Preparazione dati e2e', ['tests/e2e/prepara.mjs']) !== 0) process.exit(1)

const db = await apriDb()
const regole = (await db.query(`SELECT 1 FROM pg_proc WHERE proname = 'sono_admin' AND pronamespace = 'public'::regnamespace`)).rowCount > 0
await db.end()

console.log('\n━━ 2. Avvio app locale collegata alla prova')
const app = await avviaApp()
let esito
try {
  esito = passo('3. Playwright', [path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '-c', 'tests/e2e/playwright.config.mjs'], { E2E_BASE_URL: app.base })
} finally { await app.ferma() }

const r = scriviRisultati({ regoleIsolamento: regole })
console.log(`\n${r.falliti ? '❌' : '✅'} ${r.passati}/${r.totale} test superati · ${r.falliti} falliti · ${r.saltati} non eseguibili nella prova · ${r.bug} bug annotati`)
console.log('Report: tests/report/RISULTATI.md')
process.exit(esito === 0 ? 0 : 1)
