# Cost Sheet Review — printable summary completed-call statistics and maintenance decision
**Date:** 5 November 2026  
**Status:** READ-ONLY RUNTIME EVIDENCE CHECKPOINT COMPLETE; maintenance NOT authorised or executed; formal Costing closure 5/13 (38%).

Within the [unified Costing Suite workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md), following [the original timeout diagnosis](CSR_READ_TIMEOUT_DIAGNOSIS_2026-11-05.md) and [EXPLAIN gate](CSR_EXPLAIN_PLAN_GATE_2026-11-05.md).

## Evidence and limits

The authenticated PWA encountered PostgreSQL `57014` statement timeout when requesting `public.v_costing_pricing_printable_cost_sheet_product_summary` on 2026-11-05 at 04:50:16 UTC. This is a recorded cancelled request, not a client edit-permission failure.

Read-only `pg_stat_statements` inspection of the corresponding PostgREST query fingerprint `-4236838929701548615` returned:
- `calls=16` completed executions;
- `mean_exec_time=2094.2` ms, `max_exec_time=7846.6` ms;
- `rows=16` aggregated across the recorded completed executions.

**Interpretation boundary:** these are cumulative extension statistics for a normalized SQL fingerprint, not a per-November cohort, a latency percentile, or a direct timing of the cancelled `57014` request. Times can include different periods, resource pressure and query parameterizations. `rows=16` is total rows across logged executions and does not independently confirm row count per production period. These metrics do establish meaningful latency variation in completed requests.

Live `pg_stats` for `costing.cost_sheet_line_monthly_snapshot.snapshot_period_start` still lists June, July, August, September and October 2026 among most-common values, **not November**. At earlier inspection, `pg_stat_all_tables.last_autoanalyze` was `2026-10-24 07:20:21 UTC`; a keyed `LIMIT 1` scan confirmed live November run 149 records existed. The November printable-summary `EXPLAIN` uses `idx_cost_sheet_snapshot_period_product` but predicts one root output row (total cost ~88.42). It is unsafe to equate that estimate with actual runtime.

`pg_stat_statements` extension **1.11** is installed. The analogous monthly-SKU-comparison lookup returned only this investigation's `EXPLAIN` fingerprints, not enough completed-query timing evidence for a baseline. The independent [three-period comparison report](CSR_THREE_PERIOD_PLANNER_VARIANCE_AND_ISOLATION_GATE_2026-11-05.md) continues to show potential October plan regression for the proposed period-scoped approach.

## Feasibility of isolated database compilation

In the available local container, `psql`, `postgres`, `initdb`, `pg_ctl`, Docker and Podman were not found, the apt package indexes were empty, and an `apt-get update` attempt exceeded a bounded 15-second limit. No isolated PostgreSQL was started. The Supabase-connected account exposed only the live project. **Do not use production DDL or a paid Supabase branch as a substitute for staging without separate owner approval.**

## Decision: separate maintenance plan, not a production instruction

**Candidate action (not executed):** Owner-reviewed, off-peak `ANALYZE costing.cost_sheet_line_monthly_snapshot;` after assessing load, maintenance permissions and the process/approval window. This changes planner statistics and may affect unrelated cost, pricing and review queries, even though it does not modify business rows. It is **not a safe read-only test**, and this record does **not** authorise execution.

**Before approval:** capture the current `pg_stats` period distribution, `last_autoanalyze`, current selected costing runs, affected read-view EXPLAIN plans, and production workload. Schedule suitably; define post-action acceptance and comparison of both printable and monthly comparison plans, including October and November. Have an operator observe database latency and stop/rollback follow-on rollout if adverse. Planning statistics are not equivalent to versioned business data and have no ordinary transactionally reversible “restore the prior plan” guarantee.

**After separately authorised maintenance:** verify that November appears in refreshed statistics (where justified by distribution), check plan estimates/selectivity and indexed paths, and use bounded, authenticated PWA reads and error logs to determine whether statement timeouts actually improve. If not, evaluate a run-tuple-first product aggregate as a second candidate, retaining exact fields, status precedence, source-fingerprint, approved/draft selection and confidentiality grants. Do not increase statement timeout or add duplicate indexes merely to conceal slow query shape.

## Other open gates

- Proposed CSR scoped monthly RPC is **not installed**; its PL/pgSQL compilation, 63-field result parity, authenticated role-denial tests, and real Sep/Oct/Nov performance remain open.
- November Readiness build absent in the governed snapshot remains a separate workflow dependency.
- Formal Costing Suite closure **5/13 (38%)** unchanged.

**Changes during this checkpoint:** read-only SQL metadata, nonexecuting environment probe, repository documentation only. **No Supabase data/schema/statistics write, client, flag, cache, PWA or Electron release.**
