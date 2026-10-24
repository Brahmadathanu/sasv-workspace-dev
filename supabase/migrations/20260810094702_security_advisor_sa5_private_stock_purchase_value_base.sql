-- backfilled from live schema_migrations on 2026-10-24, CI-016
ALTER MATERIALIZED VIEW public.mv_stock_purchase_value_base SET SCHEMA app_private;
REVOKE ALL ON TABLE app_private.mv_stock_purchase_value_base FROM PUBLIC, anon;
GRANT SELECT ON TABLE app_private.mv_stock_purchase_value_base TO authenticated, service_role;

CREATE VIEW public.mv_stock_purchase_value_base
WITH (security_invoker = true)
AS SELECT * FROM app_private.mv_stock_purchase_value_base;
REVOKE ALL ON TABLE public.mv_stock_purchase_value_base FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.mv_stock_purchase_value_base TO authenticated, service_role;

SELECT cron.alter_job(48,
  command := 'refresh materialized view concurrently app_private.mv_stock_purchase_value_base;',
  active := true
);