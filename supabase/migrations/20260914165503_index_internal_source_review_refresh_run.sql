-- backfilled from live schema_migrations on 2026-10-24, CI-016
create index if not exists ix_internal_source_material_review_queue_refresh_run
on costing.internal_source_material_review_queue_snapshot(refresh_run_id);