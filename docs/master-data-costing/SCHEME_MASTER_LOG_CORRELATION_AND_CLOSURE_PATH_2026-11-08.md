# Scheme Master recurring 57014: live log correlation and shortest closure path — 8 Nov 2026

**Read-only production log and repository evidence.** No SQL write, schema/index change, data refresh, test-user session, permission/flag modification, cache update or deployment. Formal Costing Suite closure **5/13**.

## A. Direct server evidence

Queried Supabase unified logs for 2026-11-08 00:00–18:00 UTC. PostgreSQL log source shows **two distinct PostgREST-origin 57014 query cancellations** at:
- **05:39:31 UTC** — `postgrest` SELECT, `authenticator`, the public `v_costing_scheme_master_register` route ordered by `scheme_name ASC` with `LIMIT $1 OFFSET $2`.
- **12:49:56 UTC** — another `postgrest` SELECT, same query shape and query ID `3050687451330475886`, `authenticator`, error 57014.

The SQL recorded by server for both is a pagination wrapper `WITH pgrst_source AS (SELECT public.v_costing_scheme_master_register.* FROM public.v_costing_scheme_master_register ORDER BY scheme_name ASC LIMIT $1 OFFSET $2) SELECT … count(_postgrest_t), json_agg(_postgrest_t)…`; this is **server-side database cancellation**, not simply a client DOM failure. Request parameters and precise latency remain unproven. Browser report in [WP06 authenticated ON/OFF acceptance](WP06_IDV_NAV_GROUPS_ON_OFF_ACCEPTANCE_2026-11-08.md) documented one 1280 px 500/57014 and a successful 390 px 7-row view; prior 1280 flag-OFF failure means no evidence this is caused by `COSTING_NAV_GROUPS_V1`.

A **separate** 06:44:42 UTC `mgmt-api` 57014 is from a manually constructed diagnostic `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` with `statement_timeout=4500ms`, not a user-facing PWA request. Do not blend it into the two PostgREST failures. Other 42P01/42501 diagnostic errors in these logs are unrelated.

## B. Plan facts and minimal technical plan

Live view definition still has MD5 `8fdc0306bd2f1efbe0638c7c13ba4dda` (the applied #214 LATERAL migration) and 7 rows, verified independently. [Prior EXPLAIN-only review](SCHEME_MASTER_COLD_PATH_PLAN_REVIEW_2026-11-08.md) found estimated top cost ~45,043.50 and repeated LATERAL viability aggregates ~8,843.59 cost per scheme; planner estimates ~38,557 matching snapshots per scheme. Alternative aggregate-once subset did not improve estimated cost and is not equivalent to full 34-column view. Existing index `idx_sku_scheme_viability_snapshot_scheme` leads with `scheme_id`, and `idx_sku_scheme_snapshot_period_status` has `scheme_id` trailing; **index choice and cache/buffer use remain to be measured**.

Next Claude repo-only package should do the *smallest isolated performance proposal*, not another broad frontend regression:
1. Read the exact current view and snapshot indexes as frozen SQL contracts. Compare structurally equivalent candidate plans on an isolated PostgreSQL with representative historical viability cardinality, investigating a covering `(scheme_id, period_start)` access path **as a hypothesis**, not an approved index. Include index build/storage/write overhead discussion and revert plan.
2. Verify exact all-34-column and all-7-scheme output parity, including `count(DISTINCT period_start)`, disabled and system-defined schemes, effective-date/context semantics and `fn_costing_view_allowed()` permissions. No widening of authenticated/anon access.
3. Measure first-read/cold-ish and subsequent warm reads in isolation and report P50/P95 where repeatable; do not describe estimates as actual runtime or claim true physical cold cache without proof.
4. Prepare a *review-only* minimal migration and rollback package only if a candidate demonstrably helps, with a separately gated owner authorisation. No production `ANALYZE`, `EXPLAIN ANALYZE`, `CREATE INDEX`, timeout change, or materialised summary authorised by this document.
5. Separately, a short **single-context** ID-V authenticated recheck later can distinguish session-token replay 400s from actual 57014s and verify desktop/mobile; no credentials inside Git.

## C. First WP06 closure gate remains separate

The NAV_GROUPS flag ON/OFF UI itself passed 20/20 deep links; however Scheme Master desktop is a real FAIL, and signed-in CSA COMPANY/REGIONAL modal display remains NT. [WP06 owner-decision package](WP06_OWNER_DECISION_PACKAGE_2026-11-08.md) keeps G-SCOPE, G-BUILD, C6/C9/D3/D7/F-4, desktop-timeout disposition, deferral register fields and Gate Status **PENDING**; proposed WP06-only 10-workspace acceptance requires **explicit amendment** to the current shared 40-lens/11-flag §8 contract, not an assumed loophole. Issue #220 holds closure audit, #222 targeted UI, #224 performance diagnosis. No work-pack closes until signed off. Once the performance issue and minimal modal evidence are resolved, present one consolidated owner decision package—do not rerun the full 40-lens suite solely for WP06 unless owner retains the original broad scope.

**Status: confirmed repeated database timeouts; root performance fix still unproved; source and formal programme 5/13 unchanged.**
