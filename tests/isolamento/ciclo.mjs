#!/usr/bin/env node
// ─── Ciclo completo del test di isolamento (SOLO progetto di prova) ──────────
// Uso: npm run test:isolamento
//   1. riporta la prova alla struttura di produzione (schema salvato, nessun accesso alla produzione)
//   2. rigenera supabase/migrations/20261101_isolamento_aziende.sql dalle regole di oggi
//      e i 3 file separati 20261101_0_verifica_preliminare / _1_applica / _2_ritorno_indietro
//   3. seed → test "prima"
//   4. applica la migrazione alla PROVA → seed (import XPWE con le nuove regole) → test "dopo"
// Report: tests/report/ISOLAMENTO.md · exit 1 se "dopo" non è tutto bloccato o una funzione legittima non va.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const passo = (titolo, args) => {
  console.log(`\n━━ ${titolo}`)
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' })
  if (r.status !== 0) { console.error(`✗ Fallito: ${titolo}`); process.exit(1) }
}
passo('1. Prova = struttura di produzione (reset)', ['tests/ambiente-prova/applica-schema.mjs', '--reset'])
passo('2. Generazione migrazione', ['tests/isolamento/genera-migrazione.mjs'])
passo('2b. Divisione in 0_verifica / 1_applica / 2_ritorno_indietro', ['tests/isolamento/dividi-migrazione.mjs'])
passo('3a. Seed', ['tests/seed/seed.mjs'])
passo('3b. Test isolamento PRIMA', ['tests/isolamento/isolamento.mjs', 'prima'])
passo('4a. Migrazione sulla PROVA', ['tests/ambiente-prova/applica-migrazione.mjs', 'supabase/migrations/20261101_1_applica.sql'])
passo('4b. Seed con le nuove regole', ['tests/seed/seed.mjs'])
passo('4c. Test isolamento DOPO', ['tests/isolamento/isolamento.mjs', 'dopo'])

const dopo = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'report', 'isolamento-dopo.json'), 'utf8'))
const fughe = Object.entries(dopo.tabelle).filter(([, r]) => ['letto', 'modificato', 'inserito', 'eliminato'].some(o => r.attacco[o]?.esito === true)).map(([t]) => t)
const fugheViste = Object.entries(dopo.viste).filter(([, v]) => v.esito).map(([v]) => v)
const md = fs.readFileSync(path.join(ROOT, 'tests', 'report', 'ISOLAMENTO.md'), 'utf8')
const legit = /DOPO[\s\S]*?Funzioni legittime di A[^*]*\*\*(\d+)\*\*/.exec(md)?.[1]
const u = dopo.tabelle.utenti
const utentiOk = u.tecnico.modifica_collega.esito !== true && u.tecnico.modifica_se_stesso.esito !== true && u.spostamento_in_B.esito !== true
const ok = !fughe.length && !fugheViste.length && legit === '0' && utentiOk
console.log(`\n${ok ? '✅' : '❌'} DOPO: tabelle con fughe ${fughe.length}, viste ${fugheViste.length}, funzioni legittime fuori attesa ${legit}, utenti ${utentiOk ? 'ok' : 'KO'}`)
console.log('Report: tests/report/ISOLAMENTO.md')
process.exit(ok ? 0 : 1)
