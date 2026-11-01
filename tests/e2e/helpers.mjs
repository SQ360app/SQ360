// ─── Strumenti comuni dei test e2e (SOLO prova) ──────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'
import { apriDb, leggiStato, STATO_DIR, anon, refTest, admin } from '../lib/ambiente.mjs'
import { creaPdf } from '../seed/pdf.mjs'

export const stato = leggiStato()
export const e2e = JSON.parse(fs.readFileSync(path.join(STATO_DIR, 'e2e.json'), 'utf8'))
export const A = stato.aziende.A
export const BASE = `/dashboard/commesse/${A.commessa}`
export const oggi = () => new Date().toISOString().slice(0, 10)
export const tra = gg => new Date(Date.now() + gg * 86400000).toISOString().slice(0, 10)
export const r2 = n => Math.round(Number(n) * 100) / 100
/** "€ 12.345,67" → 12345.67 */
export const numIt = s => Number(String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
export const pdfFinto = titolo => ({ name: `${titolo.replace(/\W+/g, '-')}.pdf`, mimeType: 'application/pdf', buffer: creaPdf(titolo, ['Documento sintetico per test e2e']) })

let _db
export async function db() { if (!_db) _db = await apriDb(); return _db }
export async function q(sql, params = []) { return (await (await db()).query(sql, params)).rows }
export async function q1(sql, params = []) { return (await q(sql, params))[0] }

/** Attende che la funzione restituisca un valore "vero" (le scritture dell'app sono asincrone) */
export async function attendi(fn, { timeout = 15000, ogni = 400 } = {}) {
  const t0 = Date.now()
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() - t0 > timeout) return v
    await new Promise(r => setTimeout(r, ogni))
  }
}

/** Accesso come utente di prova: sessione Supabase scritta nel localStorage prima che l'app parta */
const sessioni = {}
export async function accedi(page, chi = 'A_admin') {
  if (!sessioni[chi]) {
    const c = stato.credenziali[chi]
    const { data, error } = await anon().auth.signInWithPassword({ email: c.email, password: c.password })
    if (error) throw new Error(`Login ${chi}: ${error.message}`)
    sessioni[chi] = data.session
  }
  const chiave = `sb-${refTest}-auth-token`
  await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch {} }, [chiave, JSON.stringify(sessioni[chi])])
}
/** Client Supabase come utente (stesse RLS dell'app) */
export async function clientDi(chi = 'A_admin') {
  const c = stato.credenziali[chi]
  const cl = anon()
  const { error } = await cl.auth.signInWithPassword({ email: c.email, password: c.password })
  if (error) throw new Error(error.message)
  return cl
}
export const supabaseAdmin = admin

// ── AI simulata: risposte fisse alle route /api/ai-* e /api/rdo-extract-offerta ──
export const chiamateAI = []
export async function mockAI(page, risposte = {}) {
  await page.route(/\/api\/(ai-[a-z-]+|rdo-extract-offerta)(\?|$)/, async route => {
    const nome = new URL(route.request().url()).pathname.split('/').pop()
    chiamateAI.push(nome)
    const r = risposte[nome]
    const corpo = typeof r === 'function' ? await r(route.request()) : r
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo ?? { ok: false, error: `AI simulata: risposta non prevista per ${nome}` }) })
  })
}

/** Campo del modulo accanto a un'etichetta (le etichette dell'app non hanno htmlFor) */
export function campo(scope, etichetta) {
  return scope.locator(`xpath=//label[normalize-space(.)=${JSON.stringify(etichetta)}]/..//*[self::input or self::select or self::textarea][1]`).first()
}

// ── Esiti con causa probabile (finiscono nel report) ─────────────────────────
export function annota(testInfo, tipo, testo) { testInfo.annotations.push({ type: tipo, description: testo }) }
/** Verifica bloccante: se fallisce, la causa probabile va nel report */
export function verifica(testInfo, condizione, messaggio, causa) {
  if (!condizione && causa) annota(testInfo, 'causa', causa)
  expect(condizione, messaggio).toBeTruthy()
}
export function verificaUguale(testInfo, attuale, atteso, messaggio, causa) {
  const ok = typeof atteso === 'number' ? Math.abs(Number(attuale) - atteso) < 0.011 : attuale === atteso
  if (!ok && causa) annota(testInfo, 'causa', `${causa} (atteso ${JSON.stringify(atteso)}, trovato ${JSON.stringify(attuale)})`)
  expect(ok, `${messaggio}: atteso ${JSON.stringify(atteso)}, trovato ${JSON.stringify(attuale)}`).toBeTruthy()
}
/** Ultimo messaggio a schermo (alert/confirm registrati, toast), utile come causa probabile */
const dialoghi = new WeakMap()
export function seguiDialoghi(page) {
  dialoghi.set(page, [])
  page.on('dialog', d => { dialoghi.get(page)?.push(`[${d.type()}] ${d.message()}`); d.accept().catch(() => {}) })
}
/** Messaggi alert/confirm mostrati dalla pagina finora */
export const dialoghiDi = page => [...(dialoghi.get(page) || [])]
export async function messaggioAschermo(page) {
  const t = await page.locator('[class*="toast"], [role="alert"], [style*="position: fixed"]').allInnerTexts().catch(() => [])
  const d = (dialoghi.get(page) || []).slice(-2)
  return [...d, ...t.map(x => x.trim()).filter(x => x && x.length < 300).slice(-3)].join(' | ') || 'nessun messaggio'
}

/** Apre una pagina e attende un elemento (la prima apertura in `next dev` compila la pagina: fino a 2 minuti) */
export async function apri(page, url, selettore) {
  await page.goto(url)
  if (selettore) await (typeof selettore === 'string' ? page.locator(selettore).first() : selettore).waitFor({ state: 'attached', timeout: 120000 })
}

/** Contesto condiviso tra i test di un file, salvato su disco: sopravvive al riavvio del worker dopo un fallimento */
export function contesto(nome) {
  const f = path.join(STATO_DIR, `e2e-ctx-${nome}.json`)
  const dati = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}
  return new Proxy(dati, { set(o, k, v) { o[k] = v; fs.writeFileSync(f, JSON.stringify(o, null, 2)); return true } })
}
export const INIZIO = new Date(Date.now() - 60000).toISOString()
