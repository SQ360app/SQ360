// ─── SQ360 ambiente di prova — lettura .env e blocchi di sicurezza ───────────
// Non stampa MAI valori: solo riferimenti mascherati (prime 4 lettere del ref).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PG_BIN = 'C:\\Program Files\\PostgreSQL\\17\\bin'
export const BACKUP_DIR = path.join(ROOT, 'backup-schema-produzione')

export function leggiEnv(nome) {
  const file = path.join(ROOT, nome)
  const out = {}
  if (!fs.existsSync(file)) throw new Error(`${nome} non trovato`)
  for (const r of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(r)
    if (m && !r.trim().startsWith('#')) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

/** ref del progetto da URL https://<ref>.supabase.co */
export const refDaUrl = u => (/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(u || '') || [])[1] || null
/** ref del progetto da stringa postgres (utente postgres.<ref> del pooler, o host db.<ref>.supabase.co) */
export function refDaDbUrl(u) {
  try {
    const x = new URL(u)
    const user = decodeURIComponent(x.username)
    return (/^postgres\.([a-z0-9]+)$/.exec(user) || /^db\.([a-z0-9]+)\.supabase\.co$/.exec(x.hostname) || [])[1] || null
  } catch { return null }
}
export const maschera = ref => (ref ? ref.slice(0, 4) + '****' : '(?)')
/** Rimuove eventuali password/URL da un messaggio d'errore prima di mostrarlo */
export const ripulisci = (s, segreti) => {
  let t = String(s)
  for (const v of segreti.filter(Boolean)) t = t.split(v).join('***')
  return t.replace(/postgres(ql)?:\/\/[^\s'"]+/g, 'postgresql://***')
}

/** Carica tutto e verifica che PROVA ≠ PRODUZIONE. Lancia errore se qualcosa non va. */
export function caricaAmbienti({ servonoProd = false } = {}) {
  const prodApp = leggiEnv('.env.local')
  const test = leggiEnv('.env.test.local')
  const schema = servonoProd ? leggiEnv('.env.schema.local') : {}
  const problemi = []
  const segnaposto = (nome, obj) => Object.entries(obj).filter(([, v]) => /SEGNAPOSTO|\[YOUR-PASSWORD\]/.test(v)).map(([k]) => `${nome}: ${k}`)
  problemi.push(...segnaposto('.env.test.local', test))
  if (servonoProd) problemi.push(...segnaposto('.env.schema.local', schema))

  const refProd = refDaUrl(prodApp.NEXT_PUBLIC_SUPABASE_URL)
  let refTest = refDaUrl(test.NEXT_PUBLIC_SUPABASE_URL)
  const avvisi = []
  if (!refTest) {
    const m = /^https:\/\/([a-z0-9]+)\.supabase\.co\/rest\/v1\/?$/.exec(test.NEXT_PUBLIC_SUPABASE_URL || '')
    if (m) { refTest = m[1]; avvisi.push('.env.test.local: NEXT_PUBLIC_SUPABASE_URL termina con /rest/v1/ — togliere quella parte (l\'app vuole https://<ref>.supabase.co)') }
  }
  const refTestDb = refDaDbUrl(test.TEST_DB_URL)
  const refProdDb = servonoProd ? (/^postgres(ql)?:\/\//.test(schema.PROD_DB_URL || '') ? refDaDbUrl(schema.PROD_DB_URL) : (schema.PROD_DB_URL ? refProd : null)) : null

  for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'TEST_DB_URL'])
    if (!test[k]) problemi.push(`.env.test.local: ${k} vuota`)
  if (!refProd) problemi.push('.env.local: URL produzione non riconosciuto')
  if (!refTest) problemi.push('.env.test.local: NEXT_PUBLIC_SUPABASE_URL non nel formato https://<ref>.supabase.co')
  if (!refTestDb) problemi.push('.env.test.local: TEST_DB_URL non riconosciuta (serve utente postgres.<ref> o host db.<ref>.supabase.co)')
  if (refTest && refProd && refTest === refProd) problemi.push('BLOCCO: il progetto di PROVA coincide con la PRODUZIONE')
  if (refTestDb && refProd && refTestDb === refProd) problemi.push('BLOCCO: TEST_DB_URL punta alla PRODUZIONE')
  if (refTest && refTestDb && refTest !== refTestDb) problemi.push('TEST_DB_URL e NEXT_PUBLIC_SUPABASE_URL di prova sono di progetti diversi')
  if (test.SUPABASE_SERVICE_ROLE_KEY && test.SUPABASE_SERVICE_ROLE_KEY === prodApp.SUPABASE_SERVICE_ROLE_KEY) problemi.push('BLOCCO: service role di PROVA uguale a quella di PRODUZIONE')
  if (test.NEXT_PUBLIC_SUPABASE_ANON_KEY && test.NEXT_PUBLIC_SUPABASE_ANON_KEY === prodApp.NEXT_PUBLIC_SUPABASE_ANON_KEY) problemi.push('BLOCCO: anon key di PROVA uguale a quella di PRODUZIONE')
  if (servonoProd) {
    if (!refProdDb) problemi.push('.env.schema.local: PROD_DB_URL non riconosciuta')
    else if (refProdDb !== refProd) problemi.push('.env.schema.local: PROD_DB_URL non è del progetto di produzione di .env.local')
  }
  // chiavi JWT: il campo "ref" dentro la chiave deve essere quello di prova
  for (const k of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const v = test[k] || ''
    if (v.startsWith('eyJ')) {
      try {
        const p = JSON.parse(Buffer.from(v.split('.')[1], 'base64url').toString())
        if (p.ref && p.ref !== refTest) problemi.push(`.env.test.local: ${k} appartiene a un altro progetto (${maschera(p.ref)})`)
        const ruolo = k.includes('ANON') ? 'anon' : 'service_role'
        if (p.role && p.role !== ruolo) problemi.push(`.env.test.local: ${k} ha ruolo "${p.role}", atteso "${ruolo}"`)
      } catch { problemi.push(`.env.test.local: ${k} non leggibile`) }
    }
  }
  return { prodApp, test, schema, refProd, refTest, problemi, avvisi }
}

/** Host del pooler (Session pooler, porta 5432) usato se PROD_DB_URL contiene solo la password */
export const POOLER_HOST_PREDEFINITO = 'aws-1-eu-central-1.pooler.supabase.com'

/** Stringa di connessione SENZA password + password separata (da passare in PGPASSWORD).
 *  Accetta sia la stringa completa postgresql://… sia la sola password. */
export function connessione(valore, ref, host = POOLER_HOST_PREDEFINITO) {
  if (/^postgres(ql)?:\/\//.test(valore || '')) {
    const u = new URL(valore)
    const password = decodeURIComponent(u.password)
    u.password = ''
    return { conn: u.toString(), password, ref: refDaDbUrl(valore) }
  }
  if (!valore || !ref) return null
  return { conn: `postgresql://postgres.${ref}@${host}:5432/postgres`, password: valore, ref }
}
