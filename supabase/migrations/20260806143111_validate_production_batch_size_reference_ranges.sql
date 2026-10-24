-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table public.production_batch_size_ref
  validate constraint production_batch_size_ref_range_order_check;

alter table public.production_batch_size_ref
  validate constraint production_batch_size_ref_effective_range_check;