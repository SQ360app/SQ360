-- SQ360 — catalogo della struttura (solo SELECT, transazione READ ONLY)
-- Una riga per oggetto: tipo <TAB> chiave <TAB> definizione
-- Le impronte di funzioni e viste ignorano i ritorni a capo Windows (CR).
BEGIN READ ONLY;
WITH est AS (  -- oggetti che appartengono a un'estensione (pg_trgm, unaccent…): esclusi
  SELECT objid FROM pg_depend WHERE deptype = 'e'
)
SELECT tipo || E'\t' || chiave || E'\t' || coalesce(def, '') FROM (
  -- colonne
  SELECT 'colonna' tipo, c.relname || '.' || a.attname chiave,
         format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
         || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '') def
  FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m') AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL  -- tabelle e viste, con stato RLS
  SELECT 'tabella', c.relname, c.relkind::text || CASE WHEN c.relkind IN ('r','p') THEN ' rls=' || c.relrowsecurity || ' force=' || c.relforcerowsecurity ELSE '' END
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m') AND c.oid NOT IN (SELECT objid FROM est)
  UNION ALL  -- vincoli (PK, FK, UNIQUE, CHECK)
  SELECT 'vincolo', c.relname || '.' || co.conname, pg_get_constraintdef(co.oid)
  FROM pg_constraint co JOIN pg_class c ON c.oid = co.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  UNION ALL  -- indici
  SELECT 'indice', indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
  UNION ALL  -- regole RLS (public + storage)
  SELECT 'regola_rls', schemaname || '.' || tablename || '.' || policyname,
         permissive || ' ' || cmd || ' ' || roles::text || ' USING(' || coalesce(qual, '') || ') CHECK(' || coalesce(with_check, '') || ')'
  FROM pg_policies WHERE schemaname IN ('public', 'storage')
  UNION ALL  -- enum (valori in ordine)
  SELECT 'enum', t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' GROUP BY t.typname
  UNION ALL  -- funzioni (impronta del codice completo)
  SELECT 'funzione', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         md5(replace(pg_get_functiondef(p.oid), chr(13), '')) || ' security_definer=' || p.prosecdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f','p') AND p.oid NOT IN (SELECT objid FROM est)
  UNION ALL  -- trigger
  SELECT 'trigger', c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid)
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
  UNION ALL  -- viste (impronta della definizione)
  SELECT 'vista', c.relname, md5(replace(pg_get_viewdef(c.oid), chr(13), ''))
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('v','m')
  UNION ALL  -- grant su tabelle per i ruoli API
  SELECT 'grant_tabella', table_name || '.' || grantee, string_agg(privilege_type, ',' ORDER BY privilege_type)
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role')
  GROUP BY table_name, grantee
  UNION ALL  -- grant EXECUTE su funzioni per i ruoli API
  SELECT 'grant_funzione', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ').' || r.rolname,
         CASE WHEN has_function_privilege(r.oid, p.oid, 'EXECUTE') THEN 'EXECUTE' ELSE '-' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN pg_roles r
  WHERE n.nspname = 'public' AND r.rolname IN ('anon', 'authenticated', 'service_role') AND p.oid NOT IN (SELECT objid FROM est)
  UNION ALL  -- event trigger non di sistema
  SELECT 'event_trigger', evtname, evtevent || ' ' || evtfoid::regproc::text || ' ' || evtenabled::text
  FROM pg_event_trigger WHERE evtname !~ '^(issue_|pgrst_)'
  UNION ALL  -- estensioni (solo nome e schema: le versioni possono differire tra progetti)
  SELECT 'estensione', e.extname, n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname IN ('pg_trgm', 'unaccent', 'uuid-ossp', 'pgcrypto')
  UNION ALL  -- bucket storage
  SELECT 'bucket', id, 'public=' || public || ' limite=' || coalesce(file_size_limit::text, '-') || ' mime=' || coalesce(allowed_mime_types::text, '-')
  FROM storage.buckets
) x ORDER BY 1;
ROLLBACK;
