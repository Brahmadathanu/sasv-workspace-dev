# WP05 S1 — KPI view rebuild — APPLIED LIVE 2026-10-14, VERIFIED

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

## Live application — 2026-10-14 ~00:05 IST (owner-approved, applied directly, no test branch)
Pre-checks (read-only): latest prior migration `20261013155440 wp07_b5_1_qc_labname` (~2 h 40 min earlier, other programme); no locks on the KPI/legacy views; no client transactions older than 2 min. Live definition md5 `f5128e39eb7e3b7ae1ef15947986ce56` = `03_rollback.sql` capture; ACL/owner unchanged since capture.
Applied: `apply_migration` → version `20261013183522`, name `wp05_s1_kpi_view_rebuild` (content = `01_forward.sql` body without BEGIN/COMMIT).

Post-apply verification:
| Check | Result |
|---|---|
| Value match: captured old definition (inline) vs live new view, EXCEPT ALL both ways, all 19 columns | 3 vs 3 rows (2026-07/08/09), 0 / 0 diffs — PASS |
| Columns/types/order | 19 columns identical (CREATE OR REPLACE would refuse a change) — PASS |
| ACL / owner / options / comment | `{postgres=arwdDxtm,anon=m,authenticated=rm,service_role=arwdDxtm}`, owner postgres, no options, no comment — unchanged — PASS |
| pg_depend: KPI → legacy views | none — PASS. `public.v_costing_pricing_dashboard_summary` now has **0 dependent views** (S2 precondition met) |
| Permitted authenticated user (rolled-back txn) | KPI 3 rows = legacy 3 rows, has_perm true — PASS |
| Unpermitted authenticated user (rolled-back txn) | KPI 0 rows = legacy 0 rows — PASS (fail-closed preserved) |
| anon (rolled-back txn) | permission denied — PASS (no data exposed) |
| EXPLAIN ANALYZE (single run each, as postgres) | old definition 1 427 ms exec + 19 ms plan; new view 206 ms exec + 29 ms plan — ~6× faster |
Rollback not needed. `03_rollback.sql` remains the restore path.
