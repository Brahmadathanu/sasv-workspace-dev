-- Bulk-fix invalid RAISE usages that reference "CHECK_VIOLATION"
-- This will rewrite affected function definitions to use either
--   RAISE check_violation ...
-- or ERRCODE = '23514', depending on pattern.

DO $$
DECLARE
  r RECORD;
  ddl TEXT;
  ddl2 TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, n.nspname, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosrc ILIKE '%CHECK_VIOLATION%'
  LOOP
    ddl := pg_get_functiondef(r.oid);

    -- Replace quoted condition names with proper keyword
    ddl2 := replace(ddl, '"CHECK_VIOLATION"', 'check_violation');
    ddl2 := replace(ddl2, 'RAISE CHECK_VIOLATION', 'RAISE check_violation');

    -- Normalize ERRCODE assignments using invalid text to proper SQLSTATE
    ddl2 := regexp_replace(ddl2, '(?i)ERRCODE\s*=\s*''CHECK_VIOLATION''', 'ERRCODE = ''23514''', 'g');
    ddl2 := regexp_replace(ddl2, '(?i)SQLSTATE\s*''CHECK_VIOLATION''', 'SQLSTATE ''23514''', 'g');

    IF ddl2 = ddl THEN
      -- Nothing changed; skip
      CONTINUE;
    END IF;

    RAISE NOTICE 'Rewriting function %.% ...', r.nspname, r.proname;
    EXECUTE ddl2;
  END LOOP;
END$$;

-- Post-run checks (optional):
-- SELECT n.nspname, p.proname
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE p.prosrc ILIKE '%CHECK_VIOLATION%';
-- Expect: no rows.
