# CSR scoped read RPC — independent design review (5 November 2026)

**Disposition:** DESIGN REVIEW PASSED WITH PREDEPLOY CONDITIONS. Do not deploy. SQL body parses/plans in a fixed-period full-field EXPLAIN; plpgsql function DDL, `RETURNS SETOF` compatibility, auth execution, row parity and actual performance are NOT tested. No additional formal Costing work-pack closed (5/13, 38%).

## Review basis
- Draft design PR #183 at source head `992cb3e44f8da1259e91448e53d6d877e7e84e83` initially reviewed, then amended after review.
- Live object MD5 verified: `costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed` = `63adf7946b8d7f99a01a05e5e54d00be`; public wrapper = `3382dc88e1db5589d5855ba858478c31`. No production RPC called `rpc_get_cost_sheet_sku_monthly_comparison_scoped` exists at review.
- `information_schema.columns` shows **63 output columns** in the existing internal governed view, including 57–63 run-selection and historical provenance columns; candidate retains their SELECT order.
- The draft has an explicit `auth.uid()` check and `require_permission('module:costing-control-center',false)`. The SELECT is read-only, and first-of-month and 1..2000 row cap are validated. Security-definer implementation is **not security-tested**, and requires isolated database owner/permission review.
- The design's transaction now fails closed if the target signature already exists, preventing accidental `CREATE OR REPLACE` overwrite of an unreviewed function. It also verifies the expected governed-view hash before deployment.

## Non-executing full-field planning proof

The draft function's **entire `RETURN QUERY` SELECT** was extracted, with `p_period_start` replaced by `DATE '2026-11-01'` and `p_limit` by 2000, then parsed by the live PostgreSQL planner using **EXPLAIN FORMAT JSON without ANALYZE**. This validates only the standalone SELECT parse/plan; it is **not** a PL/pgSQL `CREATE FUNCTION` compile or execution.

A matching exact 63-column `SELECT *` was EXPLAINed from the live public governed comparison view for November with identical sort keys (product_name, sku_column_label, sku_id) and limit 2000.

| Metric, planner estimate | Current public governed view | Scoped draft SELECT |
|---|---:|---:|
| Root total cost | **8097.81** | **2563.31** |
| Projected output | 63 columns | 63-column derived SELECT |
| Underlying grouped pivot estimate | ~5459 | ~1642 |
| Execution | Not executed | Not executed |

Approximate planner-cost reduction **68.3%** is **not measured speedup**, and cannot establish actual memory, buffers, latency, correct output, authenticated protection or SQL function return-column compatibility.

## Conditions before any live migration

1. Compile the proposed function in a genuine isolated staging database with matching view/table types. Fail if `RETURNS SETOF` output types, qualified names, parser or PL/pgSQL declarations mismatch. Do not execute candidate DDL against production for a test.
2. Compare **every field, row and null** with the governed view for 2026-09, 2026-10, 2026-11 and a period with missing history; explicitly confirm Oct 143 APPROVED versus Nov 149 LATEST_SUCCESS, no fabricated prior-year data, and handling of a period with no governed run.
3. Verify full result-set size vs 2000 cap and use an explicit paging contract if necessary; validate tie-breaking with `sku_id` and duplicate-label ordering. No silent truncation permitted.
4. On staging, execute authenticated test identities: signed out, anon, CCC viewer, editor of unrelated modules, CCC editor, and a user with confidential trace rights; verify exact ordinary costing-summary columns and no RM/PM trace leaks. Examine owner privileges and security-definer search_path/RLS bypass; prefer SECURITY INVOKER where feasible.
5. Measure representative full-result p50/p95 performance and statement timeouts against source view with controlled resource limits, after assessing planner stats freshness. Confirm reproducibility after a newly approved run changes run designation.
6. Review final migration history and rollback, new RPC grants, client adapter, disabled-by-default switch, PWA and Electron test coverage; owner approves each production integration separately.

## Nonactions

No `CREATE FUNCTION`, DDL, new rights, snapshot writes, EXPLAIN ANALYZE, query-data scan, client switch, flags, PWA deployment/cache or Electron release occurred. **Do not promote this design to “production ready.”**

Programme closure remains **5/13 (38%)**. The printable product-summary timeout/statistics and November Readiness build remain independent open items.
