> **Printable summary runtime addendum (5 Nov):** `pg_stat_statements` now provides completed-call timing evidence (16 calls, mean 2094.2 ms, max 7846.6 ms), while snapshot statistics still omit November. This supports a separately reviewed statistics-maintenance evaluation; it does not prove a root-cause fix. See [runtime checkpoint](CSR_PRINTABLE_RUNTIME_STATS_AND_MAINTENANCE_DECISION_2026-11-05.md).

> **CSR period-scoped comparison SQL prototype — 5 Nov 2026 (newest):** A **November-2026 fixed-period, SELECT-only candidate** was derived from the governed monthly comparison view; only snapshot rows for Nov 2026, Oct 2026 and Nov 2025 enter its pivot. Its original view definition MD5 is unchanged (`63adf7946b8d7f99a01a05e5e54d00be`). **Apples-to-apples non-executing EXPLAIN** for the identical six-column request: original cost **8097.18** (~5459 grouped rows), candidate cost **2562.75** (~1642 grouped rows). These are planner costs, **not actual runtime**. The candidate is evidence-only, **not permission-gated, not parameterized and not installed**; full result parity, authenticated security and benchmarks remain open. See [prototype gate and evidence](CSR_PERIOD_SCOPED_PROTOTYPE_GATE_2026-11-05.md). Formal closure **5/13 (38%)**; no production writes, code deployments or new work-pack closure.

# Cost Sheet Review — non-executing query plan gate (5 November 2026)

**Status: EXPLAIN-only DIAGNOSTIC GATE COMPLETE. Production optimisation NOT implemented; measured performance and parity NOT established. Formal work-pack closure unchanged 5/13 (38%).**

This follows [CSR read timeout diagnosis](CSR_READ_TIMEOUT_DIAGNOSIS_2026-11-05.md), and is an evidence checkpoint in [the unified Costing Suite workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md), not a separate work pack.

## Scope and method

The authenticated PWA reported two `57014` PostgREST statement timeouts on 2026-11-05. The production database was inspected via read-only `pg_get_viewdef`, `pg_stats`, `pg_stat_all_tables`, `pg_indexes`, a few index-bounded existence queries (`LIMIT 1`), and `EXPLAIN (FORMAT JSON, VERBOSE FALSE, COSTS TRUE)` **without ANALYZE** on the exact filtered/sorted/limited SELECT shapes. EXPLAIN creates estimates/plans; **it does not execute the SELECT**. No SQL function, view, index, permissions, data, refresh run, service worker, deployment, flag or Electron change was made.

### Query P: printable product summary

```sql
EXPLAIN (FORMAT JSON, VERBOSE FALSE, COSTS TRUE)
SELECT *
FROM public.v_costing_pricing_printable_cost_sheet_product_summary
WHERE period_start = DATE '2026-11-01'
ORDER BY product_name ASC, product_id ASC
LIMIT 1000 OFFSET 0;
```

**Observed planner structure:** Limit → Sort → Result (view permission gate) → left join of two per-product grouped aggregates. Each aggregate accesses `costing.cost_sheet_line_monthly_snapshot` using **`idx_cost_sheet_snapshot_period_product`** with index condition `snapshot_period_start = '2026-11-01'`. Each joins to `costing.v_current_successful_costing_refresh_run` (ranked successful/designated run); the status branch filters to `Cost Sheet Status` / `Cost Sheet Note` labels. Both groups independently evaluate run selection.

**Estimate, not runtime:** root planner total cost about **88.42**, **1 estimated row**. This estimate is **not credible as a performance guarantee** given that the authenticated request actually timed out. Crucially, it is partially explained by statistical staleness (below). No `EXPLAIN ANALYZE` or large `COUNT(*)` was run.

### Query C: governed SKU month comparison

```sql
EXPLAIN (FORMAT JSON, VERBOSE FALSE, COSTS TRUE)
SELECT *
FROM public.v_cost_sheet_snapshot_sku_monthly_comparison_governed
WHERE snapshot_period_start = DATE '2026-11-01'
ORDER BY product_name ASC, sku_column_label ASC
LIMIT 2000;
```

**Observed planner structure:** Limit → Sort → joined current/previous-month/previous-year row sets, beneath which an explicit **`CTE line_pivot`** is planned. The pivot's aggregate has **~5,459 estimated grouped rows**, and its input uses an index scan on **`idx_cost_sheet_monthly_exact_tuple`**, conditions `snapshot_period_start = ranked.period_start` and `refresh_run_id = ranked.refresh_run_id`. The ranked-governed-run input scans **all successful captured runs** in its own window-ranking subplan (not restricted to the requested period). The **November period filter appears at the `cur` CTE scan**, after the shared all-period `line_pivot` has been constructed, and that CTE is referenced by `cur`, `prev`, and `yoy`.

**Estimate, not runtime:** root estimated total cost about **8,097.81**, **9 result rows**, distinct from the much smaller printable-summary estimate. The planner's overall cost units cannot be interpreted as actual milliseconds. The shape supports a **specific optimisation hypothesis**: pre-constrain the pivot's base scan to exactly the requested period, its preceding month, and preceding year, with the governed run tuple for each period, before grouping. Preserve null prior-month/year columns when the comparison period is absent, and do not confuse an approved October run with the draft November run.

## Planner statistics freshness and governed tuple

`costing.cost_sheet_line_monthly_snapshot`:
- `pg_class.reltuples`: ~**1,375,032** estimated rows.
- `pg_stat_all_tables.n_live_tup`: ~**1,430,296** estimated rows; `n_dead_tup=0` at inspection.
- `last_autoanalyze`: **2026-10-24 07:20:21 UTC**; `last_analyze=NULL`.
- `pg_stats` most-common values for `snapshot_period_start`: **September, October, August, July, June 2026 only**; no November in that October 24 statistics sample.
- An **indexed `LIMIT 1` read** separately proved an actual November row with `snapshot_period_start=2026-11-01`, **run 149**, valuation **2026-11-02**. A corresponding October check verified **run 143**, valuation **2026-10-22**. The earlier September existence query was not restricted to the governed run.
- `costing.v_current_successful_costing_refresh_run` now selects **Nov run 149 / LATEST_SUCCESS** and **Oct run 143 / APPROVED**; no matching **November 2025** governed run appeared. This is a point-in-time observation, not an approval action.

**Interpretation:** recorded statistics predate November rows, so selectivity/row estimates for November and joined aggregates are likely unreliable. A controlled `ANALYZE` on this relation is a **candidate database maintenance action**, not yet owner-authorised or performed: `ANALYZE` reads data, updates planning statistics and can affect all dependent queries; it is not merely a SELECT-only test. The maintenance proposal must assess workload, schedule, planner effects and a before/after snapshot of relevant plans before approval. Do not increase timeouts to hide this issue.

## Design and acceptance path

**P — Printable product summary:**
1. Propose a separately approved off-peak statistics refresh or verified automatic-analyse configuration, followed by same exact EXPLAIN and authenticated read measurement. Do not assume success solely from refreshed estimates.
2. If timeouts persist, prototype a run-tuple-first product status aggregation that reads only the chosen period/valuation/run; avoid recomputing governed designation per product and investigate double aggregation. Preserve product grouping, labels, note precedence, status counting, pricing-use designation and every output field.
3. Reject a proposal that merely adds a duplicate period index or increases `statement_timeout` absent measured evidence.

**C — SKU comparison:**
1. Draft a period-scoped internal query/RPC prototype which accepts the **requested period** and joins only the governed tuples for **period / period - 1 month / period - 1 year**. Cross-period SKU joins must preserve the existing null and difference semantics and the `snapshot_selection_basis` and previous-period designation fields.
2. Avoid directly replacing a global view with a November-only view (the live public view is queried for arbitrary period values); a parameterized read-only function or other predicate-pushdown-safe design may be needed.
3. Plan parity checks for September 2026, October 2026, November 2026, prior-year absence, expected row counts and field-by-field numeric differences; compare independently against authoritative approved-run snapshots and draft labels.
4. Require view-only permission testing (RLS/security invoker or explicit server permission checks; no write RPC), LF/CRLF Chromium tests, and bounded execution timing in a nonproduction or separately authorised benchmark environment.

## Gates and non-actions

The **planning/triage evidence gate** is complete; the **implementation**, **semantic parity**, **performance**, **authenticated role/security**, and **formal programme closure** gates are all **OPEN**. The owner continues as final approval authority. No production data changes, `ANALYZE`, view rewrites, added indexes, new security grants, flag releases, cache, deployment or formal closure occurred.
