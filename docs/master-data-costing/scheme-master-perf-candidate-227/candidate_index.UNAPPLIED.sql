-- REVIEW-ONLY CANDIDATE (issue #227). NOT APPLIED. NOT a Supabase migration (deliberately outside supabase/migrations).
-- Requires explicit owner approval. Run OUTSIDE a transaction block (CREATE INDEX CONCURRENTLY cannot run inside one, so apply_migration/DO-wrapped runners will fail).
-- The view v_costing_scheme_master_register, grants, security_invoker, fn_costing_view_allowed(), flags and timeouts are NOT touched.
-- Pre-flight (read-only): confirm the index is absent and view md5 is still 8fdc0306bd2f1efbe0638c7c13ba4dda.
create index concurrently if not exists idx_sku_scheme_viability_snapshot_scheme_period
  on costing.sku_scheme_viability_snapshot (scheme_id, period_start);
-- Post: select indisvalid from pg_index where indexrelid = 'costing.idx_sku_scheme_viability_snapshot_scheme_period'::regclass;  -- must be true
-- Then (owner-approved window, once): analyze costing.sku_scheme_viability_snapshot;  -- plain VACUUM/ANALYZE also refreshes the visibility map that index-only scans rely on
-- The existing idx_sku_scheme_viability_snapshot_scheme is intentionally KEPT (not dropped) in this candidate.
