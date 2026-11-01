#!/usr/bin/env node
// ─── Applica lo schema di produzione al database di PROVA ────────────────────
// Uso: node tests/ambiente-prova/applica-schema.mjs [cartella-dump] [--reset]
//   cartella-dump: default = la più recente in backup-schema-produzione/
//   --reset: svuota prima lo schema public della PROVA (DROP SCHEMA public CASCADE).
//            Senza --reset si rifiuta di procedere se la prova contiene già tabelle.
// Costruisce schema-baseline.sql (nella cartella del dump) da:
//   1. estensioni usate in public (pg_trgm, unaccent)
//   2. schema-public.sql ripulito (senza CREATE SCHEMA public e grant di supabase_admin)
//   3. regole RLS di storage.objects (da schema-completo.sql)
//   4. event trigger non di sistema (es. ensure_rls) — DOPO le tabelle, come in produzione
// e lo esegue con psql --single-transaction ON_ERROR_STOP: o tutto o niente.
// Poi crea i bucket (stesse impostazioni di produzione) con la service role di PROVA.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { caricaAmbienti, connessione, PG_BIN, BACKUP_DIR, ripulisci, maschera } from './env.mjs'

const args = process.argv.slice(2)
const reset = args.includes('--reset')
const { test, refTest, refProd, problemi } = caricaAmbienti()
if (problemi.length) { console.error('Fermato:\n- ' + problemi.join('\n- ')); process.exit(1) }
const db = connessione(test.TEST_DB_URL, refTest)
if (!db || db.ref !== refTest || db.ref === refProd) { console.error('Fermato: TEST_DB_URL non è del progetto di prova'); process.exit(1) }
const segreti = [db.password, test.TEST_DB_URL, test.SUPABASE_SERVICE_ROLE_KEY]

const dir = args.find(a => !a.startsWith('--')) || path.join(BACKUP_DIR, fs.readdirSync(BACKUP_DIR).filter(d => fs.existsSync(path.join(BACKUP_DIR, d, 'schema-public.sql'))).sort().pop())
const pub = fs.readFileSync(path.join(dir, 'schema-public.sql'), 'utf8')
const completo = fs.readFileSync(path.join(dir, 'schema-completo.sql'), 'utf8')

function psql(sqlOFile, { file = false, unica = false } = {}) {
  const a = ['-X', '-At', '-v', 'ON_ERROR_STOP=1', ...(unica ? ['--single-transaction'] : []), file ? '-f' : '-c', sqlOFile, '-d', db.conn]
  const r = spawnSync(path.join(PG_BIN, 'psql.exe'), a, { encoding: 'utf8', env: { ...process.env, PGPASSWORD: db.password }, maxBuffer: 64 * 1024 * 1024 })
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: ripulisci(r.stderr || '', segreti) }
}

// ── 1. Stato della prova ─────────────────────────────────────────────────────
const n = psql("select count(*) from information_schema.tables where table_schema='public'")
if (!n.ok) { console.error(n.err); process.exit(1) }
console.log(`Prova ${maschera(refTest)}: ${n.out} tabelle in public`)
if (Number(n.out) > 0 && !reset) { console.error('Fermato: la prova non è vuota. Rilancia con --reset per ricrearla da zero.'); process.exit(1) }

// ── 2. Costruzione baseline ──────────────────────────────────────────────────
const estensioni = [...completo.matchAll(/^CREATE EXTENSION IF NOT EXISTS "([^"]+)" WITH SCHEMA "public";$/gm)].map(m => m[0])
const pulito = pub.split(/\r?\n/).filter(r =>
  !/^CREATE SCHEMA "public";$/.test(r) &&
  !/^COMMENT ON SCHEMA "public"/.test(r) &&
  !/^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"/.test(r)
).join('\n')
const policyStorage = [...completo.matchAll(/^CREATE POLICY [^\n]*ON "storage"\."objects"[^\n]*$/gm)].map(m => m[0])
const SISTEMA = /^(issue_|pgrst_)/
const eventTrigger = [...completo.matchAll(/^CREATE EVENT TRIGGER "([^"]+)"[\s\S]*?;$/gm)].filter(m => !SISTEMA.test(m[1])).map(m => m[0])

// I progetti nuovi danno in automatico permessi ad anon/authenticated/service_role sulle
// tabelle create da postgres. In produzione alcuni sono stati tolti: azzero i predefiniti
// PRIMA di creare gli oggetti, così valgono solo i GRANT espliciti del dump; le
// ALTER DEFAULT PRIVILEGES del dump (in fondo) ripristinano poi i predefiniti di produzione.
const azzeraPredefiniti = ['TABLES', 'SEQUENCES', 'FUNCTIONS'].map(o =>
  `ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON ${o} FROM "anon", "authenticated", "service_role", "postgres";`)
const baseline = [
  '-- SQ360 — schema base ricostruito dalla produzione (solo struttura, nessun dato)',
  `-- Generato: ${new Date().toISOString()} da ${path.basename(dir)}`,
  '', '-- 0. Azzeramento permessi predefiniti (vedi commento nello script)', ...azzeraPredefiniti,
  '', '-- 1. Estensioni nello schema public', ...estensioni,
  '', '-- 2. Schema public', pulito,
  '', '-- 3. Regole storage.objects', 'SET search_path = public, extensions;', ...policyStorage,
  '', '-- 4. Event trigger (dopo le tabelle)', ...eventTrigger, '',
].join('\n')
const fileBase = path.join(dir, 'schema-baseline.sql')
fs.writeFileSync(fileBase, baseline)
console.log(`Baseline: ${estensioni.length} estensioni, schema public, ${policyStorage.length} regole storage, ${eventTrigger.length} event trigger → ${path.relative(process.cwd(), fileBase)}`)

// ── 3. Reset (solo se richiesto) e applicazione ──────────────────────────────
if (reset) {
  const r = psql(`
    DROP EVENT TRIGGER IF EXISTS "ensure_rls";
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    COMMENT ON SCHEMA public IS 'standard public schema';
    GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
    ${policyStorage.map(p => `DROP POLICY IF EXISTS "${/CREATE POLICY "([^"]+)"/.exec(p)[1]}" ON storage.objects;`).join('\n')}
  `, { unica: true })
  if (!r.ok) { console.error('Reset fallito:\n' + r.err); process.exit(1) }
  console.log('Reset della prova eseguito')
}
const ap = psql(fileBase, { file: true, unica: true })
if (!ap.ok) { console.error('Applicazione fallita (nessuna modifica: transazione annullata):\n' + ap.err.split('\n').slice(0, 15).join('\n')); process.exit(1) }
console.log('Schema applicato')

// ── 4. Bucket ────────────────────────────────────────────────────────────────
const buckets = JSON.parse(fs.readFileSync(path.join(dir, 'storage-buckets.json'), 'utf8'))
const base = `https://${refTest}.supabase.co/storage/v1/bucket`
const H = { apikey: test.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${test.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
const esistenti = await (await fetch(base, { headers: H })).json()
for (const b of buckets) {
  const corpo = JSON.stringify({ id: b.id, name: b.name, public: b.public, file_size_limit: b.file_size_limit, allowed_mime_types: b.allowed_mime_types })
  const c = esistenti.some(e => e.id === b.id)
  const r = await fetch(c ? `${base}/${b.id}` : base, { method: c ? 'PUT' : 'POST', headers: H, body: corpo })
  console.log(`Bucket ${b.name} (${b.public ? 'pubblico' : 'privato'}): ${r.ok ? (c ? 'aggiornato' : 'creato') : 'ERRORE ' + r.status + ' ' + ripulisci(await r.text(), segreti)}`)
}
