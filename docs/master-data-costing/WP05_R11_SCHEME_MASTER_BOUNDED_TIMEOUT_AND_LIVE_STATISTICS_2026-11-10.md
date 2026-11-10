# WP05 R11 — Current bounded 57014 reproduction and PostgREST latency dispersion

**Date:** 10 November 2026. **Status: CURRENT SERVER 5-SECOND TIMEOUT REPRODUCED; GENUINE AUTHENTICATED BROWSER TEST NOT PERFORMED.** Historical Scheme Master lens AE1 #19 remains historical F, #224 issue active, WP05 OPEN and formal programme **6/13**. This report follows [R10 planner-only readback](WP05_R10_SCHEME_MASTER_LIVE_PLANNER_INDEX_CHOICE_2026-11-10.md).

## Test method, strict boundary

The user asked to proceed with the focused read-only performance investigation. **No existing authenticated ID-V browser was accessible through the available connected tools**, so no login, user role or HTTP network timing is claimed. Used a single connected Supabase management SQL session, not PostgREST; its default `statement_timeout` reported separately as `2min`.

A single bounded **read-only transaction**, `SET LOCAL statement_timeout='5000ms'`, `SET LOCAL lock_timeout='1500ms'`, attempted the full-column ordering path:

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='5000ms';
SET LOCAL lock_timeout='1500ms';
WITH started AS MATERIALIZED (SELECT clock_timestamp() started_at),
     page AS MATERIALIZED (
       SELECT * FROM public.v_costing_scheme_master_register
       ORDER BY scheme_name ASC LIMIT 1000
     ),
     measured AS (
       SELECT count(*)::integer row_count,
              coalesce(sum(octet_length(to_jsonb(page)::text)),0)::bigint estimated_json_payload_bytes
       FROM page
     )
SELECT measured.row_count, measured.estimated_json_payload_bytes,
       round((extract(epoch FROM (clock_timestamp() - started.started_at))*1000)::numeric,1) server_elapsed_ms
FROM started CROSS JOIN measured;
COMMIT;
```

**Observed server outcome:** PostgreSQL **`57014 canceling statement due to statement timeout`**. The tool surfaced the error and returned **no user business rows or elapsed-ms result**. This was only one query attempt; there was **no repeat retry**. Because the statement failed, the transaction did not commit. Since SQL was read-only, no business-data writes, view/index DDL or changes to SQL role permissions were possible in this test.

**What it proves:** The full Scheme Master view in the connected database role can exceed a deliberately strict 5-second read window today; the historical 57014 problem is not purely an obsolete story. **What it does NOT prove:** that the authenticated browser/normal PostgREST timeout is 5 seconds; that every ordinary REST `select('*')` call fails; that `to_jsonb` aggregation exactly mirrors PostgREST encoding/ordering; that an index is the root cause; or that an ID-V desktop browser acceptance result occurred.

## Independent accumulated query telemetry

`extensions.pg_stat_statements` filtered only for `v_costing_scheme_master_register`. For the *actual PostgREST list query shape* (`WITH pgrst_source ... ORDER BY scheme_name ASC LIMIT $1 OFFSET $2 ... json_agg`), normalized **query ID `3050687451330475886`**, it reports:

| Statistic | Value at readback |
|---|---:|
| Recorded calls | **22** |
| Total execution time | **16,574.4 ms** |
| Mean execution time | **753.4 ms** |
| Maximum execution time | **7,210.9 ms** |
| Returned rows (pg_stat aggregate counter) | **22** |

`extensions.pg_stat_statements_info.stats_reset` was **2026-08-11 16:32:43 UTC**; the aggregate spans time since that reset and is **not a 10 Nov-only sample, not P50/P95, not an authenticated-ID-V session subset**. Canceled/timed-out calls may not be represented in successful-call statistics consistently; do not infer complete incident counts. Query ID matches the two logged true PostgREST 57014 incidents at 8 Nov 05:39:31 / 12:49:56 UTC identified in [Scheme Master production log correlation](SCHEME_MASTER_LOG_CORRELATION_AND_CLOSURE_PATH_2026-11-08.md).

The accumulated mean < 1s but max > 7s is compatible with a **variable-latency/cold-path** symptom, not proof of root cause. Other diagnostic SQL results in the stat table must not be mixed into the actual PostgREST query-shape metrics.

## Current EXPLAIN and index status

- [R10](WP05_R10_SCHEME_MASTER_LIVE_PLANNER_INDEX_CHOICE_2026-11-10.md) showed the existing new valid/ready covering B-tree `idx_sku_scheme_viability_snapshot_scheme_period` was **not chosen** in the current EXPLAIN plan (main view total estimated cost 44,021.28; older `idx_sku_scheme_snapshot_period_status` chosen). New index at that time had recorded **0 scans**.
- Current table stats ~236,134 estimated live and ~45,487 estimated dead tuples; last manual ANALYZE 8 Nov; no statistics maintenance or VACUUM was run as part of this review.
- Do **not** recreate the index, globally force a planner preference, increase `statement_timeout`, rewrite the 34-column view or run EXPLAIN ANALYZE automatically.

## Correct next gate (critical, not paperwork)

**#224 should remain OPEN as a current performance problem.** A newly measured server timeout means no need for repeated browser failure reproduction simply to prove that risk exists. Next:

1. Prepare one **isolated candidate investigation**: determine why the PostgreSQL planner chooses the old period/status index instead of the smaller covering `scheme_id,period_start` index. Reuse [issue #227 synthetic fixture](scheme-master-perf-candidate-227/REPORT.md), inspect statistics visibility and hint-free query rewrite alternatives with full 34-column semantics and all-seven-scheme parity, without changing production objects.
2. On owner approval of a **specific** minimal correction, apply through guarded reviewed migration and verify planner/index use, exact output/grants and complete business rows. An index's existence alone is not sufficient.
3. After correction, perform **one supervised actual signed-in desktop read-only GET**, recording build, authenticated role, HTTP code, timing, any 57014, and redacted evidence. That browser test remains **NOT TESTED**, not silently waived by the management SQL query.
4. Complete owner bounded risk disposition for the other three historic Fail lenses and downstream WP05 gate—no broad suite rerun unless required by a new defect.

**No app, SQL schema/index, role, feature flag or release change in R11.** The one production SQL read attempt returned a genuine 57014 under the 5s limit, after which the test stopped. Root-cause correction and authenticated UI acceptance remain OPEN.
