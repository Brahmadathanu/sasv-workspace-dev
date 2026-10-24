-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $$
DECLARE
  r record;
  v_changed integer;
BEGIN
  LOOP
    v_changed := 0;
    FOR r IN
      WITH client_views AS (
        SELECT c.oid,c.relname,coalesce(c.reloptions,'{}'::text[]) @> ARRAY['security_invoker=true']::text[] AS invoker
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='v' AND has_table_privilege('authenticated',c.oid,'SELECT')
      ), deps AS (
        SELECT DISTINCT v.oid view_oid,b.oid base_oid,b.relkind,
          CASE WHEN b.relkind='v' THEN coalesce(b.reloptions,'{}'::text[]) @> ARRAY['security_invoker=true']::text[] ELSE false END base_invoker,
          CASE WHEN b.relkind IN ('r','p') THEN b.relrowsecurity ELSE false END base_rls,
          has_table_privilege('authenticated',b.oid,'SELECT') base_auth_select
        FROM client_views v
        JOIN pg_rewrite rw ON rw.ev_class=v.oid
        JOIN pg_depend d ON d.objid=rw.oid AND d.classid='pg_rewrite'::regclass AND d.refclassid='pg_class'::regclass
        JOIN pg_class b ON b.oid=d.refobjid AND b.oid<>v.oid
        WHERE b.relkind IN ('r','p','v','m','f')
      ), agg AS (
        SELECT v.oid,v.relname,
          bool_and(CASE WHEN d.relkind IN ('r','p') THEN d.base_rls AND d.base_auth_select
                        WHEN d.relkind='v' THEN d.base_auth_select AND d.base_invoker
                        ELSE false END) direct_safe
        FROM client_views v JOIN deps d ON d.view_oid=v.oid
        WHERE NOT v.invoker
        GROUP BY v.oid,v.relname
      )
      SELECT relname FROM agg WHERE direct_safe ORDER BY relname
    LOOP
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', r.relname);
      v_changed := v_changed + 1;
    END LOOP;
    EXIT WHEN v_changed = 0;
  END LOOP;
END $$;