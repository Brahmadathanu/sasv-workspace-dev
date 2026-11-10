# WP05 R10 — Scheme Master live EXPLAIN and covering-index choice

**Date:** 10 November 2026. **Status: LIVE CATALOGUE AND EXPLAIN WITHOUT ANALYZE; NO BUSINESS QUERY EXECUTION, MAINTENANCE, DDL, GRANT, FLAG OR DEPLOY.** Issue #224 historical intermittent desktop 57014. WP05 OPEN, formal programme 6/13. Owner's R9 five policy directions are approved separately, not a blanket production performance-modification authority.

## Observed read-only result

The current live production `public.v_costing_scheme_master_register` definition MD5 remains `8fdc0306bd2f1efbe0638c7c13ba4dda`; earlier 8 Nov log correlation proves actual PostgREST 57014 timeouts and is **not** overwritten. The covering index `costing.idx_sku_scheme_viability_snapshot_scheme_period` is now present, valid/ready, B-tree on `(scheme_id, period_start)`, ~1,752 kB. **At this readback** its `pg_stat_user_indexes.idx_scan=0, idx_tup_read=0, idx_tup_fetch=0`; counters can reset and don't establish all-time non-use or creation chronology.

Executed **`EXPLAIN (FORMAT JSON, COSTS ON)` only, no `ANALYZE`**, on the exact Scheme Master list query `SELECT * FROM public.v_costing_scheme_master_register ORDER BY scheme_name ASC LIMIT 1000`:

| Planner fact | Earlier 8 Nov baseline | Live 10 Nov |
|---|---:|---:|
| Top estimated total cost | 45,043.50 | **44,021.28** |
| Planner rows matching the viability aggregate per scheme | 38,557 | **33,733** |
| Chosen viability scan | prior period/status index | **Index Only Scan on `idx_sku_scheme_snapshot_period_status`** |
| Viability `Index Only Scan` estimated cost | not reported as this exact measure | **8,386.14** |
| Nested inner aggregate total estimated cost | ~8,843.59 | **8,639.15** |
| New proposed covering `(scheme_id,period_start)` index selected? | index not present at earlier preflight | **No** |

A second **EXPLAIN WITHOUT ANALYZE** of the exact three viability aggregate expressions — `SELECT count(*),count(DISTINCT period_start),max(period_start) FROM costing.sku_scheme_viability_snapshot WHERE scheme_id=1` — *also* selects the **old** `idx_sku_scheme_snapshot_period_status` Index Only Scan, with estimated 40,111 matching rows, index scan cost 9,258.21 and total aggregate cost 9,559.05. The integer `1` was a query-planning constant; no rows were retrieved or scheme ID validated as a business object.

**Interpretation:** The new covering index's catalog validity does **not** equal query-plan adoption. The production planner presently favours a larger older period/status index for both a whole Scheme Master list and a standalone scheme aggregate. Estimated cost reduction ~2.3% in the full view is **not latency improvement evidence**. Neither scan was actually executed; no physical cold-start or production login test was carried out.

## Current table and index statistics

Read-only `pg_stat_user_tables` at the same checkpoint:
- `sku_scheme_viability_snapshot` estimated live tuples **236,134**, dead tuples **45,487**.
- Last explicit ANALYZE **2026-11-08 20:55:07.866451 UTC**, last autoanalyze **2026-09-15 02:37:09.88221 UTC**.
- Last autovacuum **2026-10-20 17:25:30.942554 UTC**; last manual VACUUM NULL in reported stats.
- `pg_class` heap `relpages=45,533`, `relallvisible=29,212` (approximately 64.2% of heap pages, not a measured index-only heap-fetch rate).
- The older chosen `idx_sku_scheme_snapshot_period_status` index is ~5,040 kB, current `idx_scan=590`; the newer covering index is ~1,752 kB, current `idx_scan=0`.

These counters are estimates / cumulative statistics subject to reset and concurrent changes. They are not root-cause confirmation. Stale stats, planner estimates, visibility, cache and query-shape may matter; none is proven the deciding reason.

## Retained action plan, smallest risk first

1. **Do not re-create the index.** The 8 Nov [production execution gate](SCHEME_MASTER_PRODUCTION_INDEX_EXECUTION_GATE_2026-11-08.md) is superseded; there is no second index deployment pending.
2. Before any live optimisation, compare **read-only planner options and actual index eligibility** in an isolated representative PostgreSQL fixture. The existing synthetic candidate demonstrated ~95 to ~35 ms warm P50 when the covering index was used, but that test does not explain why today's production planner avoids it. Do not force a plan or change global planner GUCs in production.
3. **Runtime/recurrence remains the material gate.** For #224 closure, use one owner-authorised legitimate signed-in read-only 1280 px Scheme Master request, with response status, elapsed time and safe request shape, optionally up to a few supervised repeats separated in time. Avoid concurrent cost refresh, body export, broad crawler and mutating RPCs. This is a new test requiring an exact supervised procedure, not authorised by the R9 policy approval.
4. A future manual `ANALYZE`/`VACUUM`, index replacement, covering index redefinition, view rewrite, or timeout increase requires a separate cause/effect review and owner approval. Do not infer that `idx_scan=0` means the current index should be deleted; cost of writes/retention and index usage should first be investigated.

**Gate statement:** Scheme Master AE1 #19 stays **historical F** with owner-reported later functional successes and an unresolved intermittent cold-path reliability question. WP05 W5-04 and W5-10 OPEN; programme 6/13. There was no 57014 in this EXPLAIN-only task because the actual user query never ran, not because the error is resolved.
