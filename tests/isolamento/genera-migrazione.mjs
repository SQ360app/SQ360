#!/usr/bin/env node
// ─── Genera supabase/migrations/20261101_isolamento_aziende.sql ──────────────
// Uso: node tests/isolamento/genera-migrazione.mjs
// Legge regole e stato RLS ATTUALI dal database di PROVA (identico alla produzione,
// verificato con tests/ambiente-prova/confronta-schema.mjs) e la mappa delle
// appartenenze (tests/lib/classificazione.mjs). Scrive SQL leggibile, tabella per
// tabella, con in testa una verifica preliminare di sola lettura e in fondo il
// ritorno indietro (commentato) che ricrea esattamente le regole di oggi.
import fs from 'node:fs'
import path from 'node:path'
import { apriDb, ROOT } from '../lib/ambiente.mjs'
import { leggiCatalogo } from '../lib/catalogo.mjs'
import { condizione, proprietario, FIGLIE } from '../lib/classificazione.mjs'

const FILE = path.join(ROOT, 'supabase', 'migrations', '20261101_isolamento_aziende.sql')
const db = await apriDb()
// la migrazione va generata dalle regole di OGGI (prova identica alla produzione):
// se la prova ha già la correzione, rigenerarla produrrebbe un file sbagliato
if ((await db.query(`SELECT 1 FROM pg_proc WHERE proname = 'sono_admin' AND pronamespace = 'public'::regnamespace`)).rowCount) {
  console.error('Fermato: la prova ha già la migrazione applicata. Prima: node tests/ambiente-prova/applica-schema.mjs --reset')
  process.exit(1)
}
const { tabelle, cls, viste } = await leggiCatalogo(db)
const { rows: [fn] } = await db.query(`SELECT pg_get_functiondef('public.get_azienda_id()'::regprocedure) d`)
await db.end()

const ME = '(SELECT public.get_azienda_id())'
const qi = s => `"${s.replace(/"/g, '""')}"`
const NON_TOCCATE = Object.entries(cls).filter(([, c]) => ['globale_invariata', 'audit'].includes(c.tipo) || (c.tocca === false)).map(([t]) => t).sort()
const toccate = Object.keys(tabelle).filter(t => !NON_TOCCATE.includes(t)).sort()
const vistePerFix = viste.filter(v => !/security_invoker=(true|on)/.test(v.opz)).map(v => v.t).sort()

const descr = (t) => {
  const c = cls[t]
  switch (c.tipo) {
    case 'azienda': return 'azienda_id della riga'
    case 'commessa': return 'commessa_id → commesse.azienda_id'
    case 'commessa_o_azienda': return 'azienda della commessa (azienda_id solo se commessa_id è vuota)'
    case 'figlia': return `madre ${c.padre} (tramite ${c.col})`
    case 'utenti': return 'utenti della propria azienda; modifica solo admin; azienda_id non modificabile'
    case 'riga_azienda': return 'la propria azienda (lettura e modifica)'
    case 'globale_lettura': return 'tabella globale: sola lettura per gli utenti collegati'
    case 'bloccata': return 'nessuna regola: dal browser nessuno legge né scrive'
    default: return c.tipo
  }
}
const statoOggi = t => {
  const T = tabelle[t]
  const r = T.regole.map(p => p.nome)
  return `oggi: RLS ${T.rls ? 'attiva' : 'SPENTA'}; regole: ${r.length ? r.join(', ') : 'nessuna'}`
}

function blocco(t) {
  const c = cls[t], T = tabelle[t]
  const out = [`-- ── ${t} ${'─'.repeat(Math.max(3, 70 - t.length))}`, `-- Appartenenza: ${descr(t)}`, `-- ${statoOggi(t)}`]
  out.push(`ALTER TABLE public.${qi(t)} ENABLE ROW LEVEL SECURITY;`)
  for (const p of T.regole) out.push(`DROP POLICY IF EXISTS ${qi(p.nome)} ON public.${qi(t)};`)
  const cond = ['azienda', 'commessa', 'commessa_o_azienda', 'figlia'].includes(c.tipo) ? condizione(cls, t) : null
  if (cond) {
    out.push(`DROP POLICY IF EXISTS ${qi(t + '_azienda')} ON public.${qi(t)};`)
    out.push(`CREATE POLICY ${qi(t + '_azienda')} ON public.${qi(t)} FOR ALL TO authenticated\n  USING      (${cond})\n  WITH CHECK (${cond});`)
  } else if (c.tipo === 'utenti') {
    out.push(`DROP POLICY IF EXISTS "utenti_lettura" ON public.utenti;`, `DROP POLICY IF EXISTS "utenti_modifica_admin" ON public.utenti;`)
    out.push(`CREATE POLICY "utenti_lettura" ON public.utenti FOR SELECT TO authenticated\n  USING (azienda_id = ${ME});`)
    out.push(`CREATE POLICY "utenti_modifica_admin" ON public.utenti FOR UPDATE TO authenticated\n  USING      (azienda_id = ${ME} AND (SELECT public.sono_admin()))\n  WITH CHECK (azienda_id = ${ME});`)
    out.push('-- Nessuna regola INSERT/DELETE: utenti creati solo dal server (/api/register, /api/invite-user con service role).')
  } else if (c.tipo === 'riga_azienda') {
    out.push(`DROP POLICY IF EXISTS ${qi(t + '_lettura')} ON public.${qi(t)};`, `DROP POLICY IF EXISTS ${qi(t + '_modifica')} ON public.${qi(t)};`)
    out.push(`CREATE POLICY ${qi(t + '_lettura')} ON public.${qi(t)} FOR SELECT TO authenticated\n  USING (id = ${ME});`)
    out.push(`CREATE POLICY ${qi(t + '_modifica')} ON public.${qi(t)} FOR UPDATE TO authenticated\n  USING (id = ${ME}) WITH CHECK (id = ${ME});`)
    out.push('-- Nessuna regola INSERT/DELETE: aziende create solo dal server (/api/register).')
  } else if (c.tipo === 'globale_lettura') {
    out.push(`DROP POLICY IF EXISTS ${qi(t + '_lettura')} ON public.${qi(t)};`)
    out.push(`CREATE POLICY ${qi(t + '_lettura')} ON public.${qi(t)} FOR SELECT TO authenticated USING (true);`)
  } else if (c.tipo === 'bloccata') {
    out.push('-- (nessuna nuova regola: tabella bloccata per gli utenti; il server con service role non è toccato)')
  } else throw new Error(`tipo non gestito: ${t} ${c.tipo}`)
  return out.join('\n')
}

// verifica preliminare: righe che, con le nuove regole, non apparterrebbero a nessuna azienda
const verifiche = toccate.filter(t => ['azienda', 'commessa', 'commessa_o_azienda', 'figlia', 'utenti'].includes(cls[t].tipo))
  .map(t => `SELECT '${t}' AS tabella, count(*) AS righe_totali, count(*) FILTER (WHERE ${proprietario(cls, t, 'x')} IS NULL) AS righe_senza_azienda FROM public.${qi(t)} x`)

// ritorno indietro: ricrea le regole di oggi esattamente come sono
const rb = ['BEGIN;']
rb.push(fn.d.trim().replace(/\r/g, '') + ';')
for (const t of toccate) {
  const T = tabelle[t], c = cls[t]
  const nuove = ['azienda', 'commessa', 'commessa_o_azienda', 'figlia'].includes(c.tipo) ? [t + '_azienda']
    : c.tipo === 'utenti' ? ['utenti_lettura', 'utenti_modifica_admin'] : c.tipo === 'riga_azienda' ? [t + '_lettura', t + '_modifica'] : c.tipo === 'globale_lettura' ? [t + '_lettura'] : []
  for (const n of nuove) rb.push(`DROP POLICY IF EXISTS ${qi(n)} ON public.${qi(t)};`)
  for (const p of T.regole) {
    const ruoli = p.ruoli.replace(/[{}]/g, '').split(',').map(r => (r === 'public' ? 'public' : qi(r))).join(', ')
    rb.push(`CREATE POLICY ${qi(p.nome)} ON public.${qi(t)} FOR ${p.cmd} TO ${ruoli}${p.qual ? ` USING (${p.qual.replace(/\s+/g, ' ')})` : ''}${p.with_check ? ` WITH CHECK (${p.with_check.replace(/\s+/g, ' ')})` : ''};`)
  }
  if (!T.rls) rb.push(`ALTER TABLE public.${qi(t)} DISABLE ROW LEVEL SECURITY;`)
}
for (const v of vistePerFix) rb.push(`ALTER VIEW public.${qi(v)} SET (security_invoker = false);`)
// la funzione si elimina per ultima: prima vanno tolte le regole che la usano (utenti_modifica_admin)
rb.push('DROP FUNCTION IF EXISTS public.sono_admin();')
rb.push('COMMIT;')

const nToccateSpente = toccate.filter(t => !tabelle[t].rls).length
const sql = `-- ═══════════════════════════════════════════════════════════════════════════
-- SQ360 — Isolamento tra aziende (01/11/2026)
--
-- GENERATA da tests/isolamento/genera-migrazione.mjs a partire dalle regole attuali
-- (database di prova identico alla produzione) — NON ancora eseguita in produzione.
-- Provata sul progetto di prova: tests/report/ISOLAMENTO.md (prima/dopo).
--
-- Problema: ${nToccateSpente} tabelle con RLS spenta e numerose regole "USING true" o
-- "auth.role() = 'authenticated'" permettono a qualsiasi utente collegato di
-- leggere/modificare/eliminare i dati di altre aziende; ${vistePerFix.length} viste senza
-- security_invoker saltano le RLS.
--
-- Criterio unico: (SELECT public.get_azienda_id()) — l'azienda dell'utente collegato.
--   • tabelle con azienda_id e commessa_id: vale l'azienda della COMMESSA
--     (azienda_id solo se commessa_id è vuota — alcune scritture, es. computo_metrico
--     dall'import XPWE, non impostano azienda_id)
--   • tabelle senza colonne di azienda: risalgono alla tabella madre
--   • una sola regola per tabella "<tabella>_azienda", solo per il ruolo authenticated
--     (anon oggi non ha permessi sulle tabelle; le pagine pubbliche /offerta e /scan
--     passano dal server con la service role, che salta le RLS: non cambiano)
-- Decisioni (01/11/2026): utenti → lettura colleghi, modifica solo admin, azienda_id
-- non modificabile, inserimento/eliminazione solo dal server; professionisti_fornitori
-- privata per azienda; wbs_template in sola lettura; rdo_offerte bloccata.
-- Funzioni: get_azienda_id() diventa SECURITY DEFINER (necessario: la regola su utenti
-- la richiama e altrimenti richiamerebbe sé stessa); nuova sono_admin().
--
-- NON toccate (regole attuali già corrette o decisione aperta in MASTER §4.1):
--   ${NON_TOCCATE.join(', ')}
-- Fuori da questa migrazione: storage (bucket pubblici), funzioni RPC SECURITY DEFINER
-- che accettano id dal chiamante (es. genera_codice_documento), permessi TRUNCATE.
--
-- Esecuzione: tutto in una transazione (o tutto o niente). Prima eseguire la
-- VERIFICA PRELIMINARE qui sotto (solo lettura): le righe "senza azienda" diventerebbero
-- invisibili agli utenti dopo la migrazione.
-- In fondo: SQL per tornare indietro (commentato), che ricrea le regole di oggi.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── VERIFICA PRELIMINARE (solo lettura, da eseguire PRIMA) ───────────────────
-- Copiare ed eseguire da sola; risultato atteso: righe_senza_azienda = 0 ovunque
/*
${verifiche.join('\nUNION ALL\n')}
ORDER BY righe_senza_azienda DESC, tabella;
*/

BEGIN;

-- ── Funzioni ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_azienda_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT azienda_id FROM public.utenti WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.sono_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.utenti WHERE id = auth.uid() AND ruolo = 'admin' AND coalesce(attivo, true)) $$;
REVOKE ALL ON FUNCTION public.sono_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sono_admin() TO authenticated, service_role;

-- ── Tabelle (${toccate.length}) ───────────────────────────────────────────────────────

${toccate.map(blocco).join('\n\n')}

-- ── Viste: rispettano le RLS di chi le interroga ────────────────────────────
${vistePerFix.map(v => `ALTER VIEW public.${qi(v)} SET (security_invoker = true);`).join('\n')}

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- TORNARE INDIETRO (commentato) — ricrea esattamente regole, RLS e viste di oggi
-- ═══════════════════════════════════════════════════════════════════════════
/*
${rb.join('\n')}
*/
`
fs.writeFileSync(FILE, sql)
console.log(`Scritta ${path.relative(ROOT, FILE)}: ${toccate.length} tabelle, ${vistePerFix.length} viste, ${sql.split('\n').length} righe`)
void FIGLIE
