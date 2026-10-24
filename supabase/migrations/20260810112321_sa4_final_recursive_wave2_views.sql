-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_batch_canonical_in_process set (security_invoker = true);
alter view public.v_tally_fg_transfer_event set (security_invoker = true);
alter view public.v_tally_fg_transfer_event_core set (security_invoker = true);