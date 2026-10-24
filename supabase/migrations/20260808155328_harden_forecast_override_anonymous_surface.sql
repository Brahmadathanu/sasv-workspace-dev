-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke all privileges on table public.forecast_demand_overrides from anon;
revoke execute on function public.promote_all_staging(date,date) from anon;
revoke execute on function public.upsert_forecast_override(bigint,integer,integer,date,numeric,text,text,boolean,uuid) from anon;