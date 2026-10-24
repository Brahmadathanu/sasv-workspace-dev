-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_batch_transfer_out_agg set (security_invoker = true);
alter view public.v_tally_fg_transfer_event_valuation set (security_invoker = true);