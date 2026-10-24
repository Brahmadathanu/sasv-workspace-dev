-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke execute on function public.promote_all_staging(date,date) from public;
revoke execute on function public.upsert_forecast_override(bigint,integer,integer,date,numeric,text,text,boolean,uuid) from public;
grant execute on function public.promote_all_staging(date,date) to authenticated, service_role;
grant execute on function public.upsert_forecast_override(bigint,integer,integer,date,numeric,text,text,boolean,uuid) to authenticated, service_role;