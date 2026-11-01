#!/usr/bin/env node
// ─── Smoke test (scripts/smoke-test.mjs, sola lettura) sull'app locale di PROVA ─
// Uso: node tests/seed/seed.mjs && node tests/isolamento/smoke-prova.mjs
// Accede come admin di A (credenziali di prova da tests/.state/seed.json) alla commessa di A.
// Il report della produzione (scripts/report-smoke.md + screenshot) viene messo da parte e
// ripristinato; l'esito della prova finisce in tests/report/smoke-prova.md.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, leggiStato, REPORT_DIR } from '../lib/ambiente.mjs'
import { avviaApp } from '../lib/app.mjs'

const stato = leggiStato()
const REP = path.join(ROOT, 'scripts', 'report-smoke.md'), SHOT = path.join(ROOT, 'scripts', 'smoke-screenshots')
const parte = p => (fs.existsSync(p) ? (fs.renameSync(p, p + '.produzione-bak'), true) : false)
const riprendi = (p, c) => { if (c) { fs.rmSync(p, { recursive: true, force: true }); fs.renameSync(p + '.produzione-bak', p) } }
const avevaRep = parte(REP), avevaShot = parte(SHOT)
const app = await avviaApp()
let status = 1
try {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'smoke-test.mjs')], {
    cwd: ROOT, stdio: 'inherit',
    env: { ...process.env, SMOKE_BASE_URL: app.base, SMOKE_EMAIL: stato.credenziali.A_admin.email, SMOKE_PASSWORD: stato.credenziali.A_admin.password, SMOKE_COMMESSA_ID: stato.aziende.A.commessa },
  })
  status = r.status
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  if (fs.existsSync(REP)) fs.copyFileSync(REP, path.join(REPORT_DIR, 'smoke-prova.md'))
} finally {
  await app.ferma()
  fs.rmSync(SHOT, { recursive: true, force: true }); fs.rmSync(REP, { force: true })
  riprendi(REP, avevaRep); riprendi(SHOT, avevaShot)
}
console.log(`Smoke test sulla prova: exit ${status} · report tests/report/smoke-prova.md`)
process.exit(status ?? 1)
