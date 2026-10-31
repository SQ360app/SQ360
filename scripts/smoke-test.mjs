#!/usr/bin/env node
// ─── SQ360 — Smoke test in SOLA LETTURA (Playwright) ─────────────────────────
//
// Uso:   node scripts/smoke-test.mjs
//
// Credenziali: SOLO da .env.local (mai nel codice, mai committate)
//   SMOKE_EMAIL=...        utente di prova, admin dell'azienda della commessa
//   SMOKE_PASSWORD=...
// Opzionali:
//   SMOKE_BASE_URL=https://sq-360-8ek9.vercel.app
//   SMOKE_COMMESSA_ID=<uuid>   (default: commessa 26.26.GE.001)
//
// Sola lettura garantita a livello di rete: ogni richiesta POST/PATCH/PUT/DELETE
// verso Supabase o /api viene BLOCCATA (alcune pagine scrivono da sole al mount,
// es. Elenco Prezzi). Unica eccezione: il login (/auth/v1/token).
// Le scritture bloccate sono elencate a parte nel report, non contano come errori.
//
// Output (esclusi da git): scripts/report-smoke.md, scripts/smoke-screenshots/

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = path.join(ROOT, 'scripts', 'smoke-screenshots')
const REPORT = path.join(ROOT, 'scripts', 'report-smoke.md')

// ─── .env.local (parser minimale: tollera spazi iniziali e virgolette) ───────
function leggiEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const riga of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(riga)
    if (!m || riga.trim().startsWith('#')) continue
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}
const ENV = { ...leggiEnv(path.join(ROOT, '.env.local')), ...process.env }
const EMAIL = ENV.SMOKE_EMAIL
const PASSWORD = ENV.SMOKE_PASSWORD
const BASE = (ENV.SMOKE_BASE_URL || 'https://sq-360-8ek9.vercel.app').replace(/\/$/, '')
const COMMESSA = ENV.SMOKE_COMMESSA_ID || '478bd1a1-bd29-4a9a-ab76-8fa2fee787c0'

if (!EMAIL || !PASSWORD) {
  console.error('✗ SMOKE_EMAIL e/o SMOKE_PASSWORD mancanti in .env.local')
  process.exit(1)
}

// La password non deve MAI comparire in output, report o screenshot-name
const oscura = (s) => String(s ?? '').split(PASSWORD).join('***')
const log = (...a) => console.log(...a.map(oscura))

// ─── Pagine ──────────────────────────────────────────────────────────────────
const GRUPPI = {
  Contratto: ['anagrafica', 'documenti', 'elenco-prezzi', 'computo', 'sal-attivi', 'sal-passivi', 'varianti', 'ordini-servizio', 'nuovi-prezzi', 'riserve'],
  Acquisti:  ['rda', 'rdo', 'dam', 'oda', 'comunicazioni', 'contratti'],
  Cantiere:  ['cantiere', 'sicurezza', 'persone', 'ddt', 'spese'],
  Economico: ['fatturazione', 'fatture', 'conto-economico', 'marginalita'],
  Extra:     ['migliorie'],
  Archivio:  ['archivio'],
}
const DASHBOARD = ['', 'commesse', 'gare', 'fornitori', 'mappa', 'impostazioni', 'scadenzario', 'report',
  'marginalita', 'sal', 'contratti', 'dam', 'amministrazione', 'cantiere', 'pianificazione', 'preventivazione', 'import-computo']

const PAGINE = [
  ...DASHBOARD.map(p => ({ gruppo: 'Dashboard', nome: p || 'home', url: `/dashboard${p ? '/' + p : ''}` })),
  ...Object.entries(GRUPPI).flatMap(([g, tabs]) =>
    tabs.map(t => ({ gruppo: `Commessa · ${g}`, nome: t, url: `/dashboard/commesse/${COMMESSA}/${t}` }))),
]

// ─── Regole ──────────────────────────────────────────────────────────────────
const METODI_SCRITTURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const eLogin = (u) => /\/auth\/v1\/token/.test(u)
const daBloccare = (req) => {
  if (!METODI_SCRITTURA.has(req.method())) return false
  const u = req.url()
  if (eLogin(u)) return false
  return /supabase\.co\//.test(u) || u.startsWith(BASE + '/api/')
}
const LENTA_MS = 10_000
const TESTI_ROTTURA = [
  'Application error', 'Unhandled Runtime Error', 'This page could not be found',
  'Internal Server Error', 'client-side exception',
]

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
const breve = (u) => { try { const x = new URL(u); return x.host === new URL(BASE).host ? x.pathname + x.search : x.host + x.pathname + (x.search ? '?…' : '') } catch { return u } }

// ─── Main ────────────────────────────────────────────────────────────────────
fs.mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })
const page = await context.newPage()

let corrente = null // raccoglitore della pagina in corso
const bloccate = []  // scritture tentate e bloccate (tutte le pagine)
const urlBloccati = new Set()

await context.route('**/*', async (route) => {
  const req = route.request()
  if (daBloccare(req)) {
    urlBloccati.add(req.url())
    bloccate.push({ pagina: corrente?.nome ?? '(login)', gruppo: corrente?.gruppo ?? '', metodo: req.method(), url: breve(req.url()) })
    return route.abort('blockedbyclient')
  }
  return route.continue()
})
page.on('console', (m) => { if (m.type() === 'error' && corrente) corrente.console.push(oscura(m.text()).slice(0, 300)) })
page.on('pageerror', (e) => { if (corrente) corrente.jsErrors.push(oscura(e.message).slice(0, 300)) })
page.on('response', async (r) => {
  if (!corrente || r.status() < 400) return
  const c = corrente
  let motivo = ''
  if (/supabase\.co\//.test(r.url())) {
    // PostgREST spiega il motivo (colonna/tabella mancante, relazione, RLS…)
    const j = await r.json().catch(() => null)
    if (j && (j.message || j.code)) motivo = ` → ${j.code ?? ''} ${j.message ?? ''}`.trimEnd()
  }
  c.rete.push(`${r.status()} ${r.request().method()} ${breve(r.url())}${motivo}`)
})
page.on('requestfailed', (r) => {
  if (!corrente || urlBloccati.has(r.url())) return
  const f = r.failure()?.errorText || 'fallita'
  if (/ERR_ABORTED/.test(f)) return // navigazioni/annullamenti normali
  corrente.rete.push(`ERR ${r.method()} ${breve(r.url())} (${f})`)
})

// ─── Login ───────────────────────────────────────────────────────────────────
log(`→ Login su ${BASE} come ${EMAIL}`)
try {
  // Il form di login è React: se si compila prima dell'idratazione, React
  // riporta i campi al valore iniziale e il clic fa un submit nativo (reload).
  // → si attende la rete ferma, si verifica il valore e si riprova.
  let entrato = false
  for (let tentativo = 1; tentativo <= 3 && !entrato; tentativo++) {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30_000 })
    const email = page.locator('input[type="email"]')
    const pass = page.locator('input[type="password"]')
    await email.fill(EMAIL)
    await pass.fill(PASSWORD)
    await page.waitForTimeout(300)
    if ((await email.inputValue()) !== EMAIL || (await pass.inputValue()) !== PASSWORD) continue
    await page.locator('button[type="submit"]').click()
    entrato = await page.waitForURL(/\/dashboard/, { timeout: 20_000 }).then(() => true).catch(() => false)
  }
  if (!entrato) throw new Error('dopo 3 tentativi non si arriva su /dashboard (credenziali o pagina di login)')
  // La dashboard aperta dal login sta ancora caricando: se il giro parte subito,
  // le sue richieste vengono interrotte e il browser registra un falso
  // "Failed to fetch" sulla prima pagina del giro (la home).
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  log('✓ Login riuscito')
} catch (e) {
  await page.screenshot({ path: path.join(SHOTS, '00-login-fallito.png') }).catch(() => {})
  const msg = oscura(e instanceof Error ? e.message.split('\n')[0] : e)
  fs.writeFileSync(REPORT, `# Smoke test SQ360\n\n**LOGIN FALLITO** su ${BASE} come ${EMAIL}: ${msg}\n\nScreenshot: smoke-screenshots/00-login-fallito.png\n`)
  log(`✗ Login fallito: ${msg}`)
  await browser.close()
  process.exit(1)
}

// ─── Giro pagine ─────────────────────────────────────────────────────────────
const risultati = []
for (const [i, p] of PAGINE.entries()) {
  corrente = { ...p, console: [], jsErrors: [], rete: [], problemi: [], avvisi: [], ms: 0, http: null, finale: '' }
  const t0 = Date.now()
  try {
    const resp = await page.goto(BASE + p.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    corrente.http = resp?.status() ?? null
    try { await page.waitForLoadState('networkidle', { timeout: 20_000 }) }
    catch { corrente.avvisi.push('rete mai ferma entro 20 s') }
    await page.waitForTimeout(500)
  } catch (e) {
    corrente.problemi.push(`non caricata: ${oscura(e instanceof Error ? e.message.split('\n')[0] : e)}`)
  }
  corrente.ms = Date.now() - t0
  corrente.finale = breve(page.url())

  // Valutazione
  if (corrente.http && corrente.http >= 400) corrente.problemi.push(`HTTP ${corrente.http}`)
  if (/\/login/.test(page.url())) corrente.problemi.push('rimandata al login')
  else if (!page.url().includes(p.url.split('?')[0])) corrente.avvisi.push(`reindirizzata a ${corrente.finale}`)
  // Testo visibile senza innerText: innerText ricalcola il layout e su pagine con
  // migliaia di righe (computo, SAL) supera il timeout → falso "pagina vuota".
  // Nemmeno textContent va bene: include i <script> con i dati RSC di Next.js,
  // dove compare il modello "This page could not be found" → falso errore.
  // Si leggono quindi solo i nodi di testo fuori da script/style/template.
  const testo = await page.evaluate(() => {
    if (!document.body) return ''
    const salta = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement && !salta.has(n.parentElement.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    })
    let s = ''
    while (w.nextNode()) s += w.currentNode.nodeValue
    return s
  }).catch(() => null)
  if (testo === null) corrente.avvisi.push('testo della pagina non leggibile')
  else {
    for (const t of TESTI_ROTTURA) if (testo.includes(t)) corrente.problemi.push(`schermata di errore: "${t}"`)
    if (!testo.trim()) corrente.problemi.push('pagina vuota')
  }
  if (corrente.jsErrors.length) corrente.problemi.push(`${corrente.jsErrors.length} errori JavaScript`)
  if (corrente.console.length) corrente.avvisi.push(`${corrente.console.length} errori in console`)
  if (corrente.rete.length) corrente.avvisi.push(`${corrente.rete.length} richieste fallite`)
  if (corrente.ms > LENTA_MS) corrente.avvisi.push(`lenta (${(corrente.ms / 1000).toFixed(1)} s)`)

  corrente.screenshot = `smoke-screenshots/${String(i + 1).padStart(2, '0')}-${slug(p.gruppo + '-' + p.nome)}.png`
  await page.screenshot({ path: path.join(ROOT, 'scripts', corrente.screenshot) }).catch(() => { corrente.screenshot = null })

  corrente.stato = corrente.problemi.length ? 'ROTTA' : corrente.avvisi.length ? 'AVVISI' : 'OK'
  risultati.push(corrente)
  log(`${corrente.stato === 'OK' ? '✓' : corrente.stato === 'AVVISI' ? '⚠' : '✗'} ${(corrente.ms / 1000).toFixed(1).padStart(5)} s  ${p.gruppo} › ${p.nome}${corrente.problemi.length ? '  — ' + corrente.problemi.join('; ') : ''}`)
}
corrente = null
await browser.close()

// ─── Report ──────────────────────────────────────────────────────────────────
const rotte = risultati.filter(r => r.stato === 'ROTTA')
const avvisi = risultati.filter(r => r.stato === 'AVVISI')
const ok = risultati.filter(r => r.stato === 'OK')
const md = []
const esc = (s) => oscura(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
md.push('# Smoke test SQ360', '')
md.push(`- Data: ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`)
md.push(`- Ambiente: ${BASE}`, `- Utente: ${EMAIL}`, `- Commessa: \`${COMMESSA}\``)
md.push(`- Modalità: sola lettura (scritture bloccate a livello di rete)`, '')
md.push(`**Pagine: ${risultati.length} · ✗ rotte: ${rotte.length} · ⚠ con avvisi: ${avvisi.length} · ✓ ok: ${ok.length} · scritture bloccate: ${bloccate.length}**`, '')

const dettaglio = (r) => {
  md.push(`### ${r.stato === 'ROTTA' ? '✗' : '⚠'} ${r.gruppo} › ${r.nome}`, '')
  md.push(`- URL: \`${r.url}\` → \`${r.finale}\` · HTTP ${r.http ?? '—'} · ${(r.ms / 1000).toFixed(1)} s`)
  if (r.problemi.length) md.push(`- **Problemi:** ${esc(r.problemi.join('; '))}`)
  if (r.avvisi.length) md.push(`- Avvisi: ${esc(r.avvisi.join('; '))}`)
  for (const e of r.jsErrors.slice(0, 5)) md.push(`  - JS: \`${esc(e)}\``)
  for (const e of [...new Set(r.console)].slice(0, 5)) md.push(`  - console: \`${esc(e)}\``)
  for (const e of [...new Set(r.rete)].slice(0, 8)) md.push(`  - rete: \`${esc(e)}\``)
  if (r.screenshot) md.push(`- Screenshot: [${path.basename(r.screenshot)}](${r.screenshot})`)
  md.push('')
}
md.push('## ✗ Pagine rotte', '')
if (!rotte.length) md.push('Nessuna.', '')
rotte.forEach(dettaglio)
md.push('## ⚠ Pagine con avvisi', '')
if (!avvisi.length) md.push('Nessuna.', '')
avvisi.forEach(dettaglio)

md.push('## Riepilogo tutte le pagine', '')
md.push('| Stato | Gruppo | Pagina | HTTP | Tempo | Console | Rete KO | Screenshot |', '|---|---|---|---|---|---|---|---|')
for (const r of [...rotte, ...avvisi, ...ok]) {
  md.push(`| ${r.stato === 'OK' ? '✓' : r.stato === 'AVVISI' ? '⚠' : '✗'} | ${r.gruppo} | ${r.nome} | ${r.http ?? '—'} | ${(r.ms / 1000).toFixed(1)} s | ${r.console.length} | ${r.rete.length} | ${r.screenshot ? `[img](${r.screenshot})` : '—'} |`)
}
md.push('')
md.push('## Scritture tentate e bloccate', '', 'Richieste di scrittura partite da sole all\'apertura della pagina (nessun clic): bloccate dallo smoke test, non sono errori della pagina ma indicano che aprirla modifica dati.', '')
if (!bloccate.length) md.push('Nessuna.')
else {
  const agg = {}
  for (const b of bloccate) { const k = `${b.gruppo} › ${b.pagina}|${b.metodo} ${b.url}`; agg[k] = (agg[k] || 0) + 1 }
  md.push('| Pagina | Richiesta | Volte |', '|---|---|---|')
  for (const [k, n] of Object.entries(agg)) { const [pg, rq] = k.split('|'); md.push(`| ${esc(pg)} | \`${esc(rq)}\` | ${n} |`) }
}
md.push('')
fs.writeFileSync(REPORT, oscura(md.join('\n')))
log(`\nReport: ${path.relative(ROOT, REPORT)} · rotte ${rotte.length} · avvisi ${avvisi.length} · ok ${ok.length} · scritture bloccate ${bloccate.length}`)
process.exit(rotte.length ? 2 : 0)
