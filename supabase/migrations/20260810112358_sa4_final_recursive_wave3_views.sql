-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_batch_canonical_in_process_keyed set (security_invoker = true);
alter view public.v_fg_transfer_reconciliation set (security_invoker = true);