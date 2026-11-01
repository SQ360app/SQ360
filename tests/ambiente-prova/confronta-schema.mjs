#!/usr/bin/env node
// ─── Confronto struttura PRODUZIONE ↔ PROVA ──────────────────────────────────
// Uso: node tests/ambiente-prova/confronta-schema.mjs
// Esegue catalogo.sql (solo SELECT in transazione READ ONLY) su entrambi i
// database e confronta oggetto per oggetto. Exit code 1 se ci sono differenze.
// Report: backup-schema-produzione/confronto-ultimo.md (escluso da git)
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { caricaAmbienti, connessione, PG_BIN, BACKUP_DIR, ROOT, ripulisci, maschera } from './env.mjs'

const { test, schema, refTest, refProd, problemi } = caricaAmbienti({ servonoProd: true })
if (problemi.length) { console.error('Fermato:\n- ' + problemi.join('\n- ')); process.exit(1) }
const prod = connessione(schema.PROD_DB_URL, refProd)
const prova = connessione(test.TEST_DB_URL, refTest)
const segreti = [prod.password, prova.password, schema.PROD_DB_URL, test.TEST_DB_URL]
const SQL = path.join(ROOT, 'tests', 'ambiente-prova', 'catalogo.sql')

function catalogo(db, nome) {
  const r = spawnSync(path.join(PG_BIN, 'psql.exe'), ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-f', SQL, '-d', db.conn],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: db.password, PGOPTIONS: '-c default_transaction_read_only=on' }, maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) { console.error(`${nome}: errore\n` + ripulisci(r.stderr, segreti)); process.exit(1) }
  const m = new Map()
  for (const riga of r.stdout.split(/\r?\n/)) {
    const [tipo, chiave, ...def] = riga.split('\t')
    if (!chiave || tipo === 'BEGIN' || tipo === 'ROLLBACK') continue
    m.set(`${tipo}\t${chiave}`, def.join('\t'))
  }
  return m
}

const P = catalogo(prod, 'produzione'), T = catalogo(prova, 'prova')
// Le CHECK ricreate vengono riscritte da Postgres con cast diversi ma equivalenti:
// confronto i vincoli togliendo cast, parentesi e spazi.
const normVincolo = s => s.replace(/::(character varying|text)(\[\])?/g, '').replace(/[()\s]/g, '')
const uguali = (k, a, b) => a === b || (k.startsWith('vincolo\t') && normVincolo(a) === normVincolo(b))
const soloProd = [], soloProva = [], diversi = []
for (const [k, v] of P) { if (!T.has(k)) soloProd.push(k); else if (!uguali(k, v, T.get(k))) diversi.push([k, v, T.get(k)]) }
for (const k of T.keys()) if (!P.has(k)) soloProva.push(k)

const perTipo = m => [...m.keys()].reduce((a, k) => (a[k.split('\t')[0]] = (a[k.split('\t')[0]] || 0) + 1, a), {})
const cP = perTipo(P), cT = perTipo(T)
let md = `# Confronto struttura produzione ↔ prova\n\nData: ${new Date().toISOString()} · produzione ${maschera(refProd)} · prova ${maschera(refTest)}\n\n`
md += `| oggetto | produzione | prova |\n|---|---|---|\n` + Object.keys({ ...cP, ...cT }).sort().map(t => `| ${t} | ${cP[t] || 0} | ${cT[t] || 0} |`).join('\n') + '\n\n'
const tot = soloProd.length + soloProva.length + diversi.length
md += tot === 0 ? '## ✅ Nessuna differenza\n' : `## ❌ ${tot} differenze\n`
if (soloProd.length) md += `\n### Solo in produzione (${soloProd.length})\n` + soloProd.map(k => `- ${k.replace('\t', ' · ')}`).join('\n') + '\n'
if (soloProva.length) md += `\n### Solo in prova (${soloProva.length})\n` + soloProva.map(k => `- ${k.replace('\t', ' · ')}`).join('\n') + '\n'
if (diversi.length) md += `\n### Diversi (${diversi.length})\n` + diversi.map(([k, a, b]) => `- **${k.replace('\t', ' · ')}**\n  - produzione: \`${a}\`\n  - prova: \`${b}\``).join('\n') + '\n'
const file = path.join(BACKUP_DIR, 'confronto-ultimo.md')
fs.writeFileSync(file, md)
console.log(md.split('\n').slice(0, 40).join('\n'))
console.log(`\nReport completo: ${path.relative(process.cwd(), file)}`)
process.exit(tot ? 1 : 0)
