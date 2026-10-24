-- backfilled from live schema_migrations on 2026-10-24, CI-016
create index if not exists ix_bmr_admin_correction_header
  on public.bmr_administrative_corrections(batch_plan_header_id, executed_at desc);