-- REVIEW-ONLY CANDIDATE (issue #227). NOT APPLIED. NOT a Supabase migration (deliberately outside supabase/migrations).
-- Requires explicit owner approval. Run OUTSIDE a transaction block (CREATE INDEX CONCURRENTLY cannot run inside one, so apply_migration/DO-wrapped runners will fail).
-- The view v_costing_scheme_master_register, grants, security_invoker, fn_costing_view_allowed(), flags and timeouts are NOT touched.
-- Pre-flight (read-only): confirm the index name is entirely absent (including any INVALID residue), and view md5 is still 8fdc0306bd2f1efbe0638c7c13ba4dda.
-- IF NOT EXISTS checks only the name; it does NOT ensure an existing index is valid or equivalent. Never skip catalog validation.
create index concurrently if not exists idx_sku_scheme_viability_snapshot_scheme_period
  on costing.sku_scheme_viability_snapshot (scheme_id, period_start);
-- Post: select indisvalid from pg_index where indexrelid = 'costing.idx_sku_scheme_viability_snapshot_scheme_period'::regclass;  -- must be true
-- Following separately approved maintenance, ANALYZE updates planner statistics ONLY; it does not mark pages all-visible.
-- VACUUM (including VACUUM ANALYZE) can refresh visibility-map bits when safe, but involves different operational costs and must be independently planned/approved.
-- The existing idx_sku_scheme_viability_snapshot_scheme is intentionally KEPT (not dropped) in this candidate.
