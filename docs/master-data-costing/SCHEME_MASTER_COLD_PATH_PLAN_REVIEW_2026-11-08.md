# Scheme Master cold-path recurrence: independent planner review (8 November 2026)

**Scope:** read-only catalog, `pg_get_viewdef`, index metadata and `EXPLAIN` WITHOUT ANALYZE, reviewed against live authenticated ID-V evidence in issue #224 and merged PR #223. No preview/writer RPC call, data modification, DDL, index/statistics maintenance, permission, flag or deployment change. No claim of actual cold-path latency benchmark.

## Evidence

- Hosted ID-V NAV_GROUPS ON test at 1280 px: `public.v_costing_scheme_master_register` HTTP 500, PostgreSQL `57014 canceling statement due to statement timeout`, 0 displayed rows; 390 px loaded 7. Earlier flag-OFF desktop run also failed: **not evidence navigation flag causes timeout**.
- Live view MD5 **`8fdc0306bd2f1efbe0638c7c13ba4dda`**, corresponding to the previously applied `20261108082334_costing_scheme_master_register_viability_lateral` migration; 34 exposed columns; 7 rows returned in a separate DB query. The migration remains installed; the previously measured warm path was not a cold reliability proof.
- View definition: 7 scheme master rows; six policy/rule count correlated subqueries and three viability metrics through `LEFT JOIN LATERAL`. The viability subquery performs `count(*)`, `count(DISTINCT s.period_start)` and `max(s.period_start)` with `s.scheme_id=sm.id`, backed by `idx_sku_scheme_snapshot_period_status` on `(period_start, scheme_viability_status, sku_id, scheme_id)`, and also an `idx_sku_scheme_viability_snapshot_scheme` on `(scheme_id)`. Other snapshot indexes mainly lead with period or refresh run.
- **Actual read-only EXPLAIN (no execution):** `SELECT * FROM public.v_costing_scheme_master_register ORDER BY scheme_name ASC LIMIT 1000` has top estimated plan **45,043.50** cost units, 5 estimated rows. Inner `Nested Loop Left Join` has repeated Aggregate planned at **8,843.59 cost**, with estimated **38,557 matching snapshot rows per scheme** from an Index Only Scan. These are estimates, not elapsed milliseconds or proven cache misses.
- **Candidate planning check, not equivalent output:** a grouped-once version of *the three viability metrics alone*, joined to scheme master, has estimated top cost **45,390.86**, estimated 5 rows, grouping approximately **231,340** snapshot rows. This does **not** demonstrate a clear planner advantage versus LATERAL and cannot be substituted into production without full 34-column exact-row parity and actual runtime tests. No proposed index or grouped rewrite is approved merely by these plans.

## Interpretation and discriminating next checks

**Working hypothesis:** periodic cold-start timeouts may arise from repeated viability snapshot scans and count-distinct aggregation against a relatively large history, combined with cold I/O or concurrency. Unproven: actual buffer reads, slow node, cache temperature, concurrent demand, HTTP request-shape differences, and whether a saturated PostgREST connection was present. Avoid asserting definitive root cause.

1. From already retained local D: evidence, correlate failing Scheme Master request headers/filters/ordered parameters, ordering of concurrent page RPCs and exact 500 timestamps against successful 390 requests. Do not share session tokens.
2. Query permissible Supabase request and DB logs over the exact observed time window to correlate actual `57014` duration/concurrency and verify whether cancellation is server-side `statement_timeout`; distinguish separate `auth/v1/token` 400 session replay rejections.
3. In an isolated PostgreSQL dataset, test alternative safe plans and **full 34-column output parity**, including zero/disabled/system schemes and permissions, plus cold/warm timing. Candidate families: schema/aggregation redesign or a governed summary with retention/refresh consistency. Do not add an index just because one snapshot index isn't leading on scheme.
4. Only with measured performance, audited contracts and a reviewed rollback should a production migration proposal be presented to the owner. No silent increase of timeouts, migration replay, data pruning or refresh-run rewrite.

**Disposition:** issue #224 remains **OPEN** and WP06 Scheme Master desktop cannot yet be marked PASS. Formal completion remains **5/13**.
