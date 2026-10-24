-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke execute on function public.deactivate_forecast_override(bigint,integer,integer,date) from anon;
revoke execute on function public.deactivate_forecast_override(bigint,integer,integer,date) from public;
grant execute on function public.deactivate_forecast_override(bigint,integer,integer,date) to authenticated, service_role;