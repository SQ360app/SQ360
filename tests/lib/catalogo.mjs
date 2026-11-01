// ─── Lettura del catalogo della PROVA (struttura tabelle, chiavi, vincoli) ───
import { classifica } from './classificazione.mjs'

export async function leggiCatalogo(db) {
  const { rows: col } = await db.query(`
    SELECT c.relname t, a.attname n, format_type(a.atttypid, a.atttypmod) tipo, t2.typtype, t2.typname,
           a.attnotnull nn, (d.adbin IS NOT NULL) haDefault, a.attidentity <> '' OR a.attgenerated <> '' generata, a.attnum,
           CASE WHEN a.atttypmod > 4 AND format_type(a.atttypid, a.atttypmod) LIKE 'character%' THEN a.atttypmod - 4 END lung
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t2 ON t2.oid = a.atttypid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum`)
  const { rows: fk } = await db.query(`
    SELECT c.relname t, a.attname n, rn.nspname || '.' || r.relname rif, ra.attname rcol
    FROM pg_constraint co JOIN pg_class c ON c.oid = co.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class r ON r.oid = co.confrelid JOIN pg_namespace rn ON rn.oid = r.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = co.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = r.oid AND ra.attnum = co.confkey[1]
    WHERE co.contype = 'f' AND n.nspname = 'public' AND array_length(co.conkey, 1) = 1`)
  const { rows: vinc } = await db.query(`
    SELECT c.relname t, co.contype tipo, pg_get_constraintdef(co.oid) def,
           ARRAY(SELECT a.attname::text FROM unnest(co.conkey) k JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k) cols
    FROM pg_constraint co JOIN pg_class c ON c.oid = co.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND co.contype IN ('p','u','c')`)
  const { rows: enums } = await db.query(`
    SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) v FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY 1`)
  const { rows: rls } = await db.query(`
    SELECT c.relname t, c.relrowsecurity rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`)
  const { rows: pol } = await db.query(`SELECT tablename t, policyname nome, cmd, roles::text ruoli, qual, with_check FROM pg_policies WHERE schemaname = 'public'`)
  const { rows: viste } = await db.query(`
    SELECT c.relname t, coalesce(array_to_string(c.reloptions, ','), '') opz,
           ARRAY(SELECT a.attname::text FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0) cols
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('v','m')`)

  const tabelle = {}
  for (const r of rls) tabelle[r.t] = { nome: r.t, rls: r.rls, colonne: [], fk: {}, pk: [], unici: [], check: [], regole: [] }
  for (const c of col) tabelle[c.t]?.colonne.push(c)
  for (const f of fk) if (tabelle[f.t]) tabelle[f.t].fk[f.n] = { rif: f.rif, col: f.rcol }
  for (const v of vinc) {
    const t = tabelle[v.t]; if (!t) continue
    if (v.tipo === 'p') t.pk = v.cols
    else if (v.tipo === 'u') t.unici.push(v.cols)
    else t.check.push(v.def)
  }
  for (const p of pol) tabelle[p.t]?.regole.push(p)
  const enumMap = Object.fromEntries(enums.map(e => [e.typname, e.v]))
  const cls = classifica(Object.fromEntries(Object.values(tabelle).map(t => [t.nome, new Set(t.colonne.map(c => c.n))])))
  return { tabelle, enumMap, cls, viste }
}

/** Ordine topologico (madri prima delle figlie): FK verso public + collegamenti logici senza FK
 *  (commessa_id → commesse, azienda_id → azienda, madri della classificazione) */
export function ordineTopologico(tabelle, cls = {}) {
  const madri = t => {
    const m = Object.values(tabelle[t].fk).filter(f => f.rif.startsWith('public.')).map(f => f.rif.replace(/^public\./, ''))
    const cols = new Set(tabelle[t].colonne.map(c => c.n))
    if (cols.has('commessa_id')) m.push('commesse')
    if (cols.has('azienda_id')) m.push('azienda')
    const c = cls[t]
    if (c?.padre) m.push(c.padre)
    if (c?.proprietario?.padre) m.push(c.proprietario.padre)
    return m.filter(r => r !== t && tabelle[r])
  }
  const visti = new Set(), out = []
  const visita = (t, pila = new Set()) => {
    if (visti.has(t) || pila.has(t)) return
    pila.add(t)
    for (const r of madri(t)) visita(r, pila)
    pila.delete(t); visti.add(t); out.push(t)
  }
  for (const t of Object.keys(tabelle).sort()) visita(t)
  return out
}
