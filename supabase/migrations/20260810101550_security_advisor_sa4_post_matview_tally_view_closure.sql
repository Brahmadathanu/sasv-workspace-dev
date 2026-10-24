-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;
alter view public.v_tally_fg_transfer_normalized_valued set (security_invoker=true);
alter view public.v_tally_fg_transfer_daily_batch_agg set (security_invoker=true);
commit;