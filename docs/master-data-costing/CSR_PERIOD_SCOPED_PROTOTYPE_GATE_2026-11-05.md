> **CSR parameterised read RPC design — 5 Nov 2026 (newest):** A full-column, parameterised **design-only** SQL RPC based on the unchanged governed monthly SKU comparison view is drafted with first-of-month validation, 1..2000 result cap, current/prior-month/prior-year pivot prefilter and explicit signed-in CCC view permission. Transactional DDL/REVOKE/GRANT and source hash guard are included for security review. **NOT compiled, deployed, permission-tested, parity-tested or benchmarked**; no Supabase or client changes. See [security/contract design](CSR_PARAMETERIZED_RPC_DESIGN_GATE_2026-11-05.md). Planner-only fixed-period evidence remains 8097.18→2562.75 cost units, not runtime. Formal work-pack closure **5/13 (38%)**.

# Cost Sheet Review — period-scoped comparison prototype gate (5 November 2026)

**STATUS: SQL SELECT CANDIDATE + EXPLAIN-ONLY PLAN EVIDENCE COMPLETE; semantic parity, runtime and security gates OPEN. Formal Costing work-pack closure remains 5/13 (38%).**

This document is part of the [Costing Suite unified workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md), following [the non-executing planning gate](CSR_EXPLAIN_PLAN_GATE_2026-11-05.md). It is not a separate work pack, production migration or deployed fix.

## Candidate artifact and derivation

Evidence-only SQL file: [CSR_PERIOD_SCOPED_NOV2026_SELECT_CANDIDATE.sql](evidence/CSR_PERIOD_SCOPED_NOV2026_SELECT_CANDIDATE.sql).

The SELECT is derived from the repository's approved-run governed view definition in `supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql`. Live definition identity `md5(pg_get_viewdef('costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'))` was independently read from production as `63adf7946b8d7f99a01a05e5e54d00be`, matching recorded view provenance. The source view is **NOT changed**.

The derived SELECT retains the source's existing `line_pivot`, same `max(value_numeric) FILTER (WHERE line_label=...)` expressions, current/prior-month/prior-year self-joins, output columns, percentage calculation, run selection and draft/approved label logic. It adds one inner snapshot restriction **before** pivot grouping:
```sql
snapshot_period_start IN (DATE '2026-11-01', DATE '2026-10-01', DATE '2025-11-01')
```
and requires current `snapshot_period_start = DATE '2026-11-01'` in the final SELECT. Historical comparison remains nullable for missing periods. This is a **fixed November-2026 feasibility prototype**, not a generic API; the future generic version must take a validated period parameter, compute dates using PostgreSQL calendar semantics and carry an explicit CCC view-permission gate. The direct evidence SELECT is DBA-only and **must not** be exposed to PWA clients; it inherits no guaranteed permission boundary.

## Apples-to-apples non-executing EXPLAIN evidence

Two queries were planned with `EXPLAIN (FORMAT JSON, COSTS TRUE)` (without `ANALYZE`) using **the same six selected output fields**, November filter, `ORDER BY product_name,sku_column_label`, and `LIMIT 2000`:

| Estimated metric | Original live governed public view | Inlined period-scoped SELECT |
|---|---:|---:|
| Root total planner cost | **8097.18** | **2562.75** |
| Grouped `line_pivot` estimated rows | **5459** | **1642** |
| Pivot implementation | Sorted aggregate | Hashed aggregate |
| Source index | `idx_cost_sheet_monthly_exact_tuple` | Same index, with period IN restriction |

Estimated cost reduction is **~68.3% in PostgreSQL cost units**, **not** a 68.3% measured runtime speedup. Candidate query was plan-parsed by Postgres successfully. The candidate performs a narrower six-column projection for this matched test; an all-column production client request and authenticated RLS/permission context may have different planning and runtime characteristics.

The plan's underlying scan includes both selected governed run tuple and the requested-period set in `Index Cond`, demonstrating the intended input restriction is planner-visible. This is evidence of plan feasibility **only**.

## Selection provenance and pending parity

At this inspection point `costing.v_current_successful_costing_refresh_run` selects:
- **November 2026:** run **149**, valuation **2026-11-02**, `LATEST_SUCCESS`, UI should label draft/not approved.
- **October 2026:** run **143**, valuation **2026-10-22**, `APPROVED`.
- **November 2025:** no governed run returned, so previous-year fields must be null, not fabricated.

The existing monthly view remains authoritative until a separately reviewed implementation proves **complete parity**, including:
1. **Full output fields** and column types; no projected-field loss or unexpected null, join duplication, missing SKU or changed arithmetic.
2. Governed run selection for *each* period and historical dependencies, including no prior month/year; changing effective approved run must not leak a draft into an approved snapshot.
3. November, October and September 2026 plus alternate historic/absent periods, SKU key alignment and cross-period percent null/zero handling.
4. PWA and Electron client contract and chronology, view-only authenticated permissions, no bypass via security definer or exposed ad hoc SELECT.
5. Bounded runtime performance evidence after the candidate is safely benchmarked, before any live DB object alteration or client switch.

## Important remaining technical distinction

The existing public view is an arbitrary-period SELECT interface with an explicit `app_has_permission('module:costing-control-center','view')` condition. The evidence SELECT is a **fixed-period internal feasibility artifact with no permission guard** and must not be installed as a public view or treated as a drop-in client replacement. A parameterized, permission-checked read-only RPC / scoped query provider is one candidate architecture, but needs full auth/EXECUTE/ownership/RLS review and compatibility with current public consumer queries. Do not silently replace the public view or rewrite approved-run governance.

## Actions/not actions

**Done:** repository source review, non-executing base and inlined candidate EXPLAIN, identical-projection planner cost comparison, live view-definition hash and governed tuple checks, evidence SELECT and unified documentation.

**NOT done:** `EXPLAIN ANALYZE`, real-result parity scan, production `ANALYZE`, performance timing, RPC create/deploy, new index, materialized view, data retention, Supabase DDL/DML, permission grant, flag, PWA/Electron release, production source change, work-pack closure.

**Next engineering gate:** independent review of the SQL transformation and its arbitrary-period/permission design, then a safe and specifically approved isolated full-field semantic-parity test (preferably a nonproduction representative dataset) before any live change. Formal closure **5/13 (38%)**.
