-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS obj
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='m'
  LOOP
    EXECUTE format('REVOKE SELECT ON %s FROM PUBLIC, anon', r.obj);
  END LOOP;
END $$;