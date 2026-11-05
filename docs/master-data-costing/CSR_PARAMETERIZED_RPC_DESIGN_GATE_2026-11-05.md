# CSR governed monthly SKU comparison — parameterised secure read design (5 November 2026)

**Status: ISOLATED NONDEPLOYABLE DESIGN; source transformations checked statically, but not SQL-compiled, parity-tested, benchmarked, role-tested or deployed. Formal Costing closure remains 5/13 (38%).**

This follows [the fixed November period-scoped feasibility prototype](CSR_PERIOD_SCOPED_PROTOTYPE_GATE_2026-11-05.md). This is a single unified Costing Suite workflow checkpoint, not a new work pack.

## Candidate and provenance

The evidence-only draft at [CSR_PARAMETERIZED_SCOPED_RPC_DESIGN_NOT_FOR_DEPLOY.sql](evidence/CSR_PARAMETERIZED_SCOPED_RPC_DESIGN_NOT_FOR_DEPLOY.sql) is derived from exactly the existing governed monthly view's SELECT as retained in `supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql`. Source live view MD5 was independently checked as `63adf7946b8d7f99a01a05e5e54d00be` and is a fail-closed precondition of the draft. It does not replace or alter the existing public comparison view or its data.

**Proposed interface (not installed):**
`public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(p_period_start date, p_limit integer default 2000)`

The function is proposed to return the *full exact row type* of `costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed`. It validates a nonnull first-of-month requested period and a limit between 1 and 2000, reads only the requested month / prior month / prior year **inside** `line_pivot`, then selects the requested period. Existing filtered max pivot expressions, effective-run designation logic, nullable prior periods, status/numeric comparisons, and selection-basis/run-label fields are retained from the source.

**Read contract:** one period, sorted by product name, SKU label, SKU ID with capped results; this introduces a deterministic SKU-ID tiebreaker compared with the old client's `ORDER BY product_name,sku_column_label`. Strict complete parity must compare **sets and field values** separately from presentation order, and determine whether a tiebreaker can change the first 2000 returned rows on real datasets.

## Security-first design

The draft proposes `SECURITY DEFINER` with a pinned, explicit search path `pg_catalog, public, costing, pg_temp`, plus **both** `auth.uid() IS NOT NULL` and `public.require_permission('module:costing-control-center', false)`, which reads canonical view grants. It rejects unauthenticated users, users without CCC view access, malformed period and invalid limit. Explicit `REVOKE ... FROM PUBLIC` and `anon`, `GRANT EXECUTE TO authenticated` are proposed *inside the same guarded transaction as CREATE*, to prevent a temporary PUBLIC exposure. Server permission enforcement remains required even if client UI is hidden; the proposed function cannot assume client permission correctness.

**Critical review:** a `SECURITY DEFINER` function can bypass RLS, and a public schema function needs explicit ownership, grants, secure search path and security testing. Do **not** deploy merely because explicit guards appear in source. Verify `auth.uid()` and `require_permission` resolve under the installed owner, review object ownership and `SET ROLE` implications and ensure no alternate unrestricted executable signature. Confirm no confidential line-level RM/PM trace information is newly exposed; output is limited to existing Cost Sheet Review cost summary fields. If definer is unnecessary with the actual table RLS and grants, prefer a reviewed invoker-based design.

**Scope containment:** this is a new read endpoint only. No accept, approve, refresh, run-generation, cost manipulation or other operational RPC. PWA and Electron source remains unchanged; keep all feature flags OFF pending independent acceptance.

## Evidence completed

- Nov 2026 fixed-period source variant parsed by production Postgres in **EXPLAIN without ANALYZE**.
- Compared six-field identical-projection plan: current view **8097.18** vs period-scoped source **2562.75** estimated cost; pivot estimated groups 5459 vs 1642. **These are planner estimates, not runtime figures.**
- The parameterised function text was constructed from the same approved-run governed view SELECT, with static checks confirming the added p_period conditions, retained select body, explicit read permission guard, atomic grants and absence of mutations in the SELECT. **The function has not been compiled or executed in PostgreSQL.**

## Pending validation before an implementation decision

1. Independent SQL parser/type review and compile in isolated staging transaction, comparing output column order/types to the existing governed view, no production DDL.
2. Exact row-set + field-by-field parity for September, October, November 2026, absent-history years, no current period, approved and latest-success branches; no accidental multiplication on SKU joins.
3. Complete-result counts and pagination semantics: a 2000-row cap is consistent with current client request only if that request is known to fit or a separately reviewed paged protocol is implemented. Compare tie handling at cap boundary.
4. Authenticated session tests for anonymous, signed-out, Costing view-only, unrelated-module editor, and authorised Costing editor; verify RPC EXECUTE privileges and no unintended RLS bypass or sensitive trace disclosure.
5. Safe staging performance timing and query plans for **full** output, including plan caching across period changes and stale statistics; baseline vs candidate actual p50/p95, memory, timeouts and CPU/buffers where safe. No blanket production statement timeout increases.
6. Separate owner review of final DDL/migration history, complete rollback procedure, client adapter and feature-flag default-OFF canary, followed by signed-in PWA/Electron retesting.

## Status

**Design preparation advanced**; no further formal work-pack closure. Open November readiness build, printable product-summary statistics/timeout issue and historic PRM smoke-suite debt remain separate. No production database writes, migrations, client changes, PWA deployments, cache bump or Electron release.
