# WP12 — Cost Comparison keyset-first optimisation: repository-only PROPOSAL (17 November 2026)

**NOT APPLIED. NOT A MIGRATION. NOT BENCHMARKED.** No SQL in this document is to be executed against production. Flag `COSTING_CSR_SCOPED_COMPARISON_RPC_V1` stays **OFF**; no browser-local pilot is authorised. WP10/WP12 OPEN, WP11 CLOSED, Electron HOLD. Context: [investigation report](WP12_REGRESSION_AND_COST_COMPARISON_TIMEOUT_INVESTIGATION_2026-11-17.md), issue #273, [WP05 R18](WP05_R18_CSR_PLANNER_OPTIMIZATION_SCREEN_2026-11-11.md).

> **Update 17 Nov 2026 (later):** candidate implemented and parity-tested **offline only** — see [offline results](WP12_COST_COMPARISON_KEYSET_FIRST_CANDIDATE_OFFLINE_RESULTS_2026-11-17.md). Correct on all fixtures; risk (a) resolved by construction and tested; **benefit unproven and possibly negligible when production SKUs/period are well below the 2000 cap**. Still NOT APPLIED / NOT BENCHMARKED on production.

## 1. Problem recap
Default-OFF read `v_cost_sheet_snapshot_sku_monthly_comparison_governed` pivots `costing.cost_sheet_line_monthly_snapshot` (~1.4 M rows) across **all** governed periods, then filters the requested period; observed 57014 timeouts (5 Nov, 11 Nov, 17 Nov UI). The installed scoped RPC (`rpc_get_cost_sheet_sku_monthly_comparison_scoped`, source `supabase/migrations/20261111133505_csr_scoped_comparison_rpc_additive_20261111.sql`) already limits `line_pivot` to `{p, p-1 month, p-1 year}` but still pivots **every SKU of three periods** (Oct requests include Sep) before applying `WHERE snapshot_period_start = p ORDER BY product_name, sku_column_label, sku_id LIMIT p_limit`. R18: naive `NOT MATERIALIZED` and three-CTE rewrites were worse.

## 2. Proposed shape (hypothesis from R18, not yet authored as SQL)
1. **`cur` pivot first, period `p` only**, joined to `costing.v_current_successful_costing_refresh_run` exactly as today (same run/period equality, same grouping columns, same `FILTER` expressions).
2. Compute the **ordered, limited key set** from `cur`: `ORDER BY product_name, sku_column_label, sku_id LIMIT p_limit` (keeping the existing sort keys), materialised once (`MATERIALIZED` CTE `keys`).
3. Pivot **prev-month** and **prev-year** periods **only for `sku_id IN (SELECT sku_id FROM keys)`** (join on `idx_cost_sheet_snapshot_period_sku (snapshot_period_start, sku_id)`), same run join and expressions.
4. LEFT JOIN `keys`→prev/yoy on `sku_id` and period equality; project the same 63 columns in the same order and types; final `ORDER BY`/`LIMIT` unchanged.
- **Expected benefit (to be proven):** historical aggregation shrinks from 2 full periods of all SKUs to at most 2 x p_limit SKUs; for Oct (previously +1.7% in planner cost vs view) the Sep side is no longer fully pivoted. No benefit is claimed until measured; R18 shows planner-cost intuition has been wrong before.
- **Risks:** (a) `LIMIT` applied before the prev/yoy joins is only equivalent if `cur` yields at most one row per `sku_id` and prev/yoy likewise — the current view groups by period + product/category/group names + SKU, so name changes between runs could create duplicate rows per SKU; parity tests must include such a case or the proposal must keep the current bag semantics by joining before limiting only on the keyed subset. (b) planner may still scan the snapshot period index for each CTE; verify by plain `EXPLAIN`. (c) A materialised `keys` CTE can mis-estimate; do not trust cost units.

## 3. Alternative (heavier): period/run-keyed precomputed comparison table
Populate a comparison snapshot at governed refresh completion, read it through a thin governed view/RPC. Removes read-time aggregation entirely but changes write/refresh paths, retention, immutability and approval semantics; larger blast radius, needs a separate design gate. Not recommended until the keyset-first result is known.

## 4. Parity requirements (all must pass before any apply request)
- Use the existing harness `scripts/csr-comparison-verifier/` (`parity.test.mjs`, `sql/baseline-view-read.sql`, `sql/candidate-installed-rpc.sql`, mutants). Candidate vs **both** the installed RPC and the baseline view read: bidirectional `EXCEPT ALL`, strict text comparison, row order, 63 column names/types/order, 2000 cap boundary.
- Periods: Sep, Oct, Nov 2026 (read-only/isolated fixture, never an unbounded production run), empty period, cap month, missing previous month, missing previous year, 7 synthetic periods already in the fixture, plus new fixtures: duplicate-SKU-by-name-change, NULL values, run-selection change (`selection_basis`), draft vs approved run.
- Existing mutants (null-flip, prev-COP-shift, scale-drift) must still be detected.
- Security: `SECURITY DEFINER`, `search_path=pg_catalog, pg_temp`, `require_permission('module:costing-control-center', false)` retained, `authenticated` EXECUTE true, `anon` false; ID-V allowed, ID-N/X/O denied; no new grants.
- `scripts/wp12-readonly-comparison-rpc-release-preflight.sql` catalogue assertion must still PASS.

## 5. Performance acceptance
- Plain `EXPLAIN (FORMAT JSON)` (no ANALYZE) Sep/Oct/Nov before and after, under `BEGIN READ ONLY`; no regression for October vs the installed RPC.
- Measured, unit-labelled timings (`bench.mjs ingest`, schema `csr-timing-samples/v1`, ms or s mandatory) from genuine authorised sessions: **p95 <= 4000 ms** on a sample large enough to support a percentile (owner to set N), Oct non-regression, zero 57014/500 across the sample. A single duration is never a p95.
- Edge-log correlation of status and duration; do not retain bodies or identifiers.

## 6. Rollback
- Apply (if ever approved) as a **new function name or `CREATE OR REPLACE` of the scoped RPC with the exact prior body kept as `..._rollback.sql`**; function-only, additive, no table/view/index/policy/data/timeout change.
- Client rollback first: flag OFF (browser-local) — nothing else changes.
- Server rollback: restore previous function body from the repository migration `20261111133505...` (hash-guarded) or drop the new function; verify catalogue preflight and parity again.

## 7. Gates and approvals (all separate, none granted)
1. Owner approval of this proposal as a design (this document).
2. Read-only metadata/plain EXPLAIN session (needs an approved database connection; **none was available** in the session that wrote this).
3. Isolated PostgreSQL parity run (repo harness; local PG 16 is available in WSL, runs only synthetic fixtures).
4. Reviewed migration PR with rollback; owner SQL-apply approval; then separate flag-pilot and default-promotion decisions.
