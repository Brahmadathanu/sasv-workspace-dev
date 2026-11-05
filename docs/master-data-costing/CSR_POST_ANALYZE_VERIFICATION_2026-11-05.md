# Cost Sheet Review — Approved Snapshot Statistics Maintenance and Verification

**Date:** 5 November 2026 (IST)  
**Status:** Single-table PostgreSQL ANALYZE **COMPLETED** and planner/statistics verification **PASSED**. Actual authenticated PWA read-latency / historical timeout resolution **NOT YET VERIFIED**. Formal programme work-pack closure remains **5/13 (38%)**.

## Approval and scope

After the prior documented [printable runtime-statistics investigation](CSR_PRINTABLE_RUNTIME_STATS_AND_MAINTENANCE_DECISION_2026-11-05.md), the owner instructed **“proceed”** with the workflow. The maintenance action was limited to:

```sql
ANALYZE costing.cost_sheet_line_monthly_snapshot;
```

This operation refreshes PostgreSQL planner statistics. It **does not** rewrite valuation data or snapshot rows, designate/approve runs, modify views, create indexes, grant permissions, update costing policy, deploy the client, activate flags or create an Electron release.

## Preflight (production; read-only)

- Database time during preflight: **2026-11-05 10:17:26 UTC** (~15:47 IST). This was afternoon rather than the preferred off-peak maintenance window; it was undertaken on owner instruction after checking low observed activity.
- `pg_stat_activity` observed **5 idle client sessions**, **2 extension sessions with no state**, and **1 active session** at the sampling moment.
- `pg_locks` showed **no recorded locks** on the target snapshot relation at the sampling moment.
- `pg_stat_all_tables.last_autoanalyze = 2026-10-24 07:20:21 UTC`; `last_analyze IS NULL`.
- `n_mod_since_analyze = 55,264`, `n_live_tup` estimated **1,430,296**, `pg_class.reltuples` estimated **1,375,032**. Relation had no custom reloptions.
- Global autovacuum analyze parameters observed: scale factor **0.1**, base threshold **50** (these are configuration observations, not a per-table tuning change). Current session `statement_timeout` was **120000 ms**.
- Existing selected governed costing runs: **Sep 122 APPROVED**, **Oct 143 APPROVED**, **Nov 149 LATEST_SUCCESS**.
- Existing `pg_stats.snapshot_period_start` most-common values: Jun–Oct 2026 (5 distinct); **November absent**.
- Baseline `EXPLAIN (FORMAT JSON)` (no ANALYZE) on *identical filtered, sorted, limited request shapes*:
  - Printable product summary, November: total planner cost **88.42**, root estimated rows **1**.
  - Governed monthly SKU comparison, October: total cost **8097.81**, root estimated rows **9**.
  - Governed monthly SKU comparison, November: total cost **8097.81**, root estimated rows **9**.

## Action (production)

Supabase SQL execution returned success for exactly **`ANALYZE costing.cost_sheet_line_monthly_snapshot`**. No other maintenance SQL was executed.

## Post-action verification

- `last_analyze = 2026-11-05 10:19:13.459091 UTC` (**15:49:13 IST**).
- `analyze_count=1`; `n_mod_since_analyze=0` at verification; `n_live_tup` estimate **1,428,937**.
- `pg_stats.snapshot_period_start.n_distinct` now **6**. November 2026 now appears in most-common values along with Jun–Oct 2026.
- Governed run selection remains exactly **Sep 122 APPROVED / Oct 143 APPROVED / Nov 149 LATEST_SUCCESS**. No approval/designation changes.
- Post-maintenance `EXPLAIN` on the identical shapes:

| Query | Pre-ANALYZE planner cost | Post-ANALYZE planner cost | Root estimated rows pre → post |
|---|---:|---:|---|
| Printable Product Summary — Nov 2026 | 88.42 | **137.34** | **1 → 91** |
| Monthly SKU Comparison — Oct 2026 | 8097.81 | **6893.40** | 9 → 9 |
| Monthly SKU Comparison — Nov 2026 | 8097.81 | **6893.40** | 9 → 9 |

**Interpretation:** these are **planner cost units/estimates, not measured execution times**. The higher printable plan cost does not demonstrate slower runtime; the lower monthly comparison plan cost does not prove a user-visible speedup. The November printable planner now recognises much more data; its new plan accesses the selected period, valuation and refresh run via the existing unique `uq_cost_sheet_monthly_snapshot_line` index. Other index and query definitions were untouched. The available activity snapshot after maintenance again showed 5 idle client, 2 extension and 1 active session.

## Unverified outcome and next acceptance gate

The original error was a **signed-in PWA read timeout** (`57014`) for the printable summary and also a separate monthly comparison query. This maintenance addressed demonstrated statistics staleness; **it does not establish that either authenticated request now completes within the relevant PostgREST timeout**. No authenticated post-maintenance browser request, observed PWA network timings or new cancelled-query log reconciliation was performed in this checkpoint. Do **not** close the CSR performance acceptance gate.

**Next:** using the established Costing view-only test identity, retest Cost Sheet Review → Printable Cost Sheet and Monthly Comparison for **November 2026**, record browser success/failure and timing (plus October comparison); corroborate with fresh PostgREST logs. Avoid write controls. If either query still times out, retain a separate bounded SQL optimisation path and design review—do not auto-increase statement timeouts or change permissions. The proposed period-scoped RPC remains **non-deployed**, and its SQL compilation, full 63-column parity, role-denial and measured multi-period performance remain open; the earlier October candidate planner regression must be re-evaluated after ANALYZE, not assumed resolved.

## Governance

**Completed:** owner-approved one-table statistics maintenance; before/after statistics, planner and governed run selection checks; repository evidence update.  
**Not changed:** business data, approval status, costing computations, migration history, SQL view/function/index definitions, grants, flags, client source, PWA/cache or Electron.  
**Not closed:** authenticated Cost Sheet Review performance acceptance and all outstanding work-pack closure gates. Formal programme closure remains **5/13 (38%)**.
