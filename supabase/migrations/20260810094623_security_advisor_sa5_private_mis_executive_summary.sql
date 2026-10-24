-- backfilled from live schema_migrations on 2026-10-24, CI-016
ALTER MATERIALIZED VIEW public.mv_mis_executive_summary SET SCHEMA app_private;
REVOKE ALL ON TABLE app_private.mv_mis_executive_summary FROM PUBLIC, anon;
GRANT SELECT ON TABLE app_private.mv_mis_executive_summary TO authenticated, service_role;

CREATE VIEW public.mv_mis_executive_summary
WITH (security_invoker = true)
AS SELECT * FROM app_private.mv_mis_executive_summary;
REVOKE ALL ON TABLE public.mv_mis_executive_summary FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.mv_mis_executive_summary TO authenticated, service_role;

SELECT cron.alter_job(52,
  command := 'refresh materialized view concurrently app_private.mv_mis_executive_summary;',
  active := true
);
SELECT cron.alter_job(53,
  command := 'refresh materialized view concurrently app_private.mv_mis_executive_summary;',
  active := true
);