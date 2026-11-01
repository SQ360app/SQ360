// ─── SQ360 test — accesso al SOLO progetto di prova ──────────────────────────
// Ogni script dei test passa da qui: se qualcosa punta alla produzione, si ferma.
// Non stampa mai chiavi o password.
import path from 'node:path'
import fs from 'node:fs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { caricaAmbienti, connessione, ripulisci, maschera, ROOT } from '../ambiente-prova/env.mjs'

export { ROOT, maschera }
export const STATO_DIR = path.join(ROOT, 'tests', '.state')
export const REPORT_DIR = path.join(ROOT, 'tests', 'report')

const amb = caricaAmbienti()
if (amb.problemi.length) { console.error('Fermato:\n- ' + amb.problemi.join('\n- ')); process.exit(1) }
if (amb.avvisi.length) { console.error('Fermato:\n- ' + amb.avvisi.join('\n- ')); process.exit(1) }
const db = connessione(amb.test.TEST_DB_URL, amb.refTest)
if (!db || db.ref !== amb.refTest || db.ref === amb.refProd) { console.error('Fermato: TEST_DB_URL non è del progetto di prova'); process.exit(1) }

export const env = amb.test
export const refTest = amb.refTest
export const SUPABASE_URL = `https://${amb.refTest}.supabase.co`
const SEGRETI = [db.password, amb.test.TEST_DB_URL, amb.test.SUPABASE_SERVICE_ROLE_KEY, amb.test.NEXT_PUBLIC_SUPABASE_ANON_KEY]
export const pulisci = s => ripulisci(s, SEGRETI)

/** Connessione Postgres alla PROVA (ruolo postgres: salta le RLS — solo per preparare e verificare) */
export async function apriDb() {
  const u = new URL(db.conn)
  const client = new pg.Client({
    host: u.hostname, port: Number(u.port || 5432), database: u.pathname.slice(1) || 'postgres',
    user: decodeURIComponent(u.username), password: db.password, ssl: { rejectUnauthorized: false },
    application_name: 'sq360-test',
  })
  await client.connect()
  // doppio controllo lato server: l'utente del pooler contiene il ref del progetto
  const { rows } = await client.query('select current_user u')
  if (!String(u.username).includes(amb.refTest)) { await client.end(); throw new Error('Connessione non riconosciuta come prova') }
  void rows
  return client
}

const opzioni = { auth: { persistSession: false, autoRefreshToken: false } }
/** Client con service role della PROVA (salta le RLS) */
export const admin = () => createClient(SUPABASE_URL, amb.test.SUPABASE_SERVICE_ROLE_KEY, opzioni)
/** Client anon della PROVA */
export const anon = () => createClient(SUPABASE_URL, amb.test.NEXT_PUBLIC_SUPABASE_ANON_KEY, opzioni)

/** Client collegato come utente (email/password) — le RLS valgono come nell'app */
export async function comeUtente(email, password) {
  const c = anon()
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login ${email} fallito: ${error.message}`)
  return { client: c, token: data.session.access_token, userId: data.user.id }
}

export function leggiStato() {
  const f = path.join(STATO_DIR, 'seed.json')
  if (!fs.existsSync(f)) throw new Error('Manca tests/.state/seed.json: lancia prima il seed')
  return JSON.parse(fs.readFileSync(f, 'utf8'))
}
export function scriviStato(s) {
  fs.mkdirSync(STATO_DIR, { recursive: true })
  fs.writeFileSync(path.join(STATO_DIR, 'seed.json'), JSON.stringify(s, null, 2))
}

/** Variabili d'ambiente per avviare l'app locale sulla PROVA (sovrascrivono .env.local) */
export function envApp() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: amb.test.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: amb.test.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '', RESEND_API_KEY: '', NEXT_PUBLIC_MAPBOX_TOKEN: '',
    CRON_SECRET: amb.test.CRON_SECRET || 'test-locale',
  }
}
export const PORTA = Number(amb.test.TEST_PORT || 3100)
export const XPWE = amb.test.SEED_XPWE_PATH
