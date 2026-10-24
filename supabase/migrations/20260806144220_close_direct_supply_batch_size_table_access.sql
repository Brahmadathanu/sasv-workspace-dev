-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke all privileges on table public.production_batch_size_ref from anon;
revoke all privileges on table public.production_batch_size_ref from authenticated;

revoke execute on function public.get_latest_batch_rule(bigint,date) from public;
revoke execute on function public.get_latest_batch_rule(bigint,date) from anon;
revoke execute on function public.get_latest_batch_rule(bigint,date) from authenticated;

grant execute on function public.get_latest_batch_rule(bigint,date) to service_role;
grant execute on function public.get_latest_batch_rule(bigint,date) to postgres;