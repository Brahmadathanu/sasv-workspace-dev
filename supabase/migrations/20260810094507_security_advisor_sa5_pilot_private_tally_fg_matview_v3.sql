-- backfilled from live schema_migrations on 2026-10-24, CI-016
CREATE SCHEMA IF NOT EXISTS app_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

ALTER MATERIALIZED VIEW public.mv_tally_fg_transfer_snapshot_latest SET SCHEMA app_private;
REVOKE ALL ON TABLE app_private.mv_tally_fg_transfer_snapshot_latest FROM PUBLIC, anon;
GRANT SELECT ON TABLE app_private.mv_tally_fg_transfer_snapshot_latest TO authenticated, service_role;

SELECT cron.alter_job(
  27,
  schedule := '35 2,22 * * *',
  command := 'refresh materialized view app_private.mv_tally_fg_transfer_snapshot_latest;',
  active := true
);

ALTER VIEW public.v_tally_fg_transfer_normalized SET (security_invoker = true);