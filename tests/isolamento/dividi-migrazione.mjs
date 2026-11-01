#!/usr/bin/env node
// ─── Divide 20261101_isolamento_aziende.sql in 3 file eseguibili separatamente ─
// Uso: node tests/isolamento/dividi-migrazione.mjs
// Estrae le parti PAROLA PER PAROLA (nessuna modifica alla logica):
//   20261101_0_verifica_preliminare.sql  → la query di verifica (sola lettura), non commentata
//   20261101_1_applica.sql               → il blocco BEGIN…COMMIT + query di controllo (commentate)
//   20261101_2_ritorno_indietro.sql      → il ritorno indietro, non commentato, BEGIN…COMMIT
// Si ferma se la struttura del file di origine non è quella attesa.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = path.join(ROOT, 'supabase', 'migrations')
const ORIGINE = '20261101_isolamento_aziende.sql'
const righe = fs.readFileSync(path.join(DIR, ORIGINE), 'utf8').replace(/\r\n/g, '\n').split('\n')

const trova = (cond, da = 0, cosa = '') => { const i = righe.findIndex((r, k) => k >= da && cond(r)); if (i < 0) throw new Error(`Struttura inattesa: manca ${cosa}`); return i }
const conta = re => righe.filter(r => re.test(r)).length
if (conta(/^BEGIN;$/) !== 2 || conta(/^COMMIT;$/) !== 2 || conta(/^\/\*$/) !== 2 || conta(/^\*\/$/) !== 2) throw new Error('Struttura inattesa: attesi 2 BEGIN, 2 COMMIT e 2 commenti /* */')

const vTit = trova(r => r.startsWith('-- ── VERIFICA PRELIMINARE'), 0, 'titolo verifica')
const vDa = trova(r => r === '/*', vTit, 'inizio verifica') + 1
const vA = trova(r => r === '*/', vDa, 'fine verifica')
const aDa = trova(r => r === 'BEGIN;', vA, 'BEGIN applica')
const aA = trova(r => r === 'COMMIT;', aDa, 'COMMIT applica')
const rTit = trova(r => r.includes('TORNARE INDIETRO'), aA, 'titolo ritorno')
const rDa = trova(r => r === '/*', rTit, 'inizio ritorno') + 1
const rA = trova(r => r === '*/', rDa, 'fine ritorno')
const verifica = righe.slice(vDa, vA)
const applica = righe.slice(aDa, aA + 1)
const ritorno = righe.slice(rDa, rA)
if (ritorno[0] !== 'BEGIN;' || ritorno.at(-1) !== 'COMMIT;') throw new Error('Il ritorno indietro non è un blocco BEGIN…COMMIT')
if (!/^SELECT /.test(verifica[0]) || !/;$/.test(verifica.at(-1)) || verifica.some(r => /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|TRUNCATE)\b/.test(r)))
  throw new Error('La verifica non è una sola query di lettura')

const testa = (titolo, righeDesc) => [
  '-- ═══════════════════════════════════════════════════════════════════════════',
  `-- SQ360 — Isolamento tra aziende (01/11/2026) · ${titolo}`,
  `-- Estratto parola per parola da ${ORIGINE} con tests/isolamento/dividi-migrazione.mjs`,
  '-- (non modificare a mano: rigenerare). Ordine: 0 → 1 (→ 2 solo per tornare indietro).',
  ...righeDesc.map(r => `-- ${r}`),
  '-- ═══════════════════════════════════════════════════════════════════════════', '',
]
const controlli = [
  '', '-- ── CONTROLLO DOPO L\'APPLICAZIONE (sola lettura, da eseguire a parte) ────────',
  '/*',
  '-- (a) tabelle public con RLS spenta — atteso: nessuna riga',
  'SELECT c.relname AS tabella',
  'FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace',
  "WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity",
  'ORDER BY 1;',
  '',
  '-- (b) regole public con USING true, WITH CHECK true o auth.role()',
  '--     atteso: solo le tabelle globali in sola lettura volute (categorie_c, categorie_sb,',
  '--     categorie_sc: SELECT pubbliche, non toccate; wbs_template: wbs_template_lettura)',
  'SELECT tablename, policyname, cmd, roles, qual, with_check',
  'FROM pg_policies',
  "WHERE schemaname = 'public'",
  "  AND (qual = 'true' OR with_check = 'true'",
  "       OR coalesce(qual, '') ~ 'auth\\.role\\(\\)' OR coalesce(with_check, '') ~ 'auth\\.role\\(\\)')",
  'ORDER BY 1, 2;',
  '*/', '',
]
const file = {
  '20261101_0_verifica_preliminare.sql': [...testa('0. VERIFICA PRELIMINARE', ['Sola lettura: nessuna modifica al database. Da eseguire PRIMA di 1_applica.', 'Atteso: righe_senza_azienda = 0 ovunque (altrimenti quelle righe diventerebbero invisibili).']), ...verifica, ''],
  '20261101_1_applica.sql': [...testa('1. APPLICA', ['Transazione unica: o tutto o niente. Eseguire solo dopo 0_verifica_preliminare.']), ...applica, ...controlli],
  '20261101_2_ritorno_indietro.sql': [...testa('2. RITORNO INDIETRO', ['Ricrea esattamente regole, RLS, funzioni e viste di prima di 1_applica.', 'Da eseguire SOLO per annullare 1_applica.']), ...ritorno, ''],
}
for (const [nome, r] of Object.entries(file)) fs.writeFileSync(path.join(DIR, nome), r.join('\n'))
console.log(`Divisa ${ORIGINE}: verifica ${verifica.length} righe, applica ${applica.length}, ritorno ${ritorno.length}`)
