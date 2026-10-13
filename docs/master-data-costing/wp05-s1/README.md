# WP05 S1 — KPI view rebuild (DRAFT, NOT APPLIED)

Files: `01_forward.sql` (CREATE OR REPLACE), `02_value_match_proof.sql` (read-only), `03_rollback.sql` (exact pre-S1 definition captured live 2026-10-13).

Design: the KPI view's `dashboard` CTE no longer reads `public.v_costing_pricing_dashboard_summary`; it reads the same five sources (`costing.cost_periods`, `costing_refresh_run`, `sku_pricing_bridge_snapshot`, `sku_selling_price_bridge_snapshot`, `sku_scheme_viability_snapshot`) filtered to `costing.v_current_successful_costing_refresh_run`, with the same permission gate (`module:costing-control-center` view; service_role/postgres bypass). Columns unused by the KPI view (ready counts, started_at, error, valuation_date, refresh_run_id) are no longer computed. `workbench` and `policy` CTEs unchanged (schema-qualified only).

## Read-only proof result — 2026-10-13 ~22:55 IST, run as `postgres`
| old_rows | new_rows | only_in_old | only_in_new | periods |
|---|---|---|---|---|
| 3 | 3 | 0 | 0 | 2026-07-01, 2026-08-01, 2026-09-01 |
**PASS** — all 19 columns identical for every period (EXCEPT ALL both directions).

## Not yet proven (move to apply-time acceptance on a Supabase branch or post-apply)
- Role-based check (permitted vs non-permitted `authenticated` user): not provable read-only, because an inlined query runs with the caller's privileges (`authenticated` has no grant on `costing.*`), whereas the real view runs with owner (`postgres`) privileges. The gate expression is copied verbatim from the legacy view.
- Timing (EXPLAIN ANALYZE old vs new): blocked by the safety reviewer as a production execution; not escalated. Do it on a Supabase branch or at apply time.

## Observation (no change in S1)
KPI view ACL includes `anon=m` and `authenticated=rm` (MAINTAIN privilege, PostgreSQL 17 default). Preserved by CREATE OR REPLACE. Candidate for WP10/security review.
