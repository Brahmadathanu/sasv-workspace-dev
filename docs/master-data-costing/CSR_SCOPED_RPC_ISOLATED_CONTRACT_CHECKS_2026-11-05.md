# CSR scoped monthly comparison — isolated contract checks (5 November 2026)

**Status:** ISOLATED SOURCE/SECURITY-CONTRACT AND SYNTHETIC PERIOD TESTS PASS. True PL/pgSQL compilation, live-result parity, authenticated RPC execution and measured performance remain **OPEN**; no additional formal Costing work pack closed (5/13, 38%).

This is the next subordinate verification checkpoint after [PR #183's independent design review](CSR_PARAMETERIZED_RPC_INDEPENDENT_REVIEW_2026-11-05.md), inside [the unified Costing Suite workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md). It does **not** convert the draft SQL into a production migration.

## Environment feasibility and boundaries

Supabase project enumeration shows **one project** under the connected account: `sasv-workspace` (`qhmoqtxpeasamtlxaoak`), the live production project. No standalone staging project is available. We therefore deliberately **did not** create a production test RPC, schema, table, or paid development branch.

The available local execution environment has Node.js but does not contain the `psql`, `postgres`, `initdb`, `pg_ctl` or Docker executables. Consequently an isolated PostgreSQL compile-and-execute environment was **not established** in this checkpoint. Absence of a staging environment is a remaining validation blocker, not evidence that SQL compilation succeeds.

## Read-only live permission metadata

Authoritative SQL privilege metadata at this checkpoint:

| Object or role privilege | Authenticated role |
|---|---|
| `SELECT` on `costing.cost_sheet_line_monthly_snapshot` | **NO** |
| `USAGE` on `costing` schema | YES |
| `SELECT` on `costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed` | **NO** |
| `SELECT` on `public.v_cost_sheet_snapshot_sku_monthly_comparison_governed` | YES |
| `EXECUTE` on `public.require_permission(text,boolean)` | YES |
| `EXECUTE` on `public.require_permission(text,boolean)` for anon | **NO** |

**Design implication:** a naive `SECURITY INVOKER` function selecting the protected `costing` source would fail for normal authenticated users. Granting broad snapshot or internal-view `SELECT` to make it work is **not authorised** and could broaden access. The proposed `SECURITY DEFINER` approach with an explicit `auth.uid()` + `require_permission('module:costing-control-center',false)` gate is a legitimate candidate **subject to role-specific negative tests and owner/privilege review**, not yet an approved security result. Do not infer actual user permissions merely from the database `authenticated` role.

## New reproducible source-contract smoke

**File:** `scripts/csr-scoped-rpc-design-smoke.mjs`

Asserts:

1. Re-derives exactly the source governed comparison SELECT from `supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql`. Verifies the draft SQL retains the **entire original SELECT**, with just the inner three-period snapshot filter, outer period filter, stable sort and bounded limit; all pivots, valuation/run-selection joins, output fields and numerical formulas remain unchanged.
2. Verifies declared `auth.uid()`, CCC view permission, first-of-month validation and 1–2000 cap, pinned search path, source MD5 precondition and guard against replacing an existing function.
3. Verifies permission grants/revocations are inside a single transaction.
4. Confirms the `RETURN QUERY` body lacks snapshot write statements.
5. Uses a **synthetic in-memory fixture** containing two November current SKUs, October approved values, newer excluded draft rows, unrelated periods, absent prior-year values and a historical predecessor. Tests scoped versus all-period selection semantics across five requested months (Nov, Oct, Sep, a missing November 2025 and Aug).

**Execution:** the self-contained assertion body was executed in an isolated JavaScript harness fed the exact GitHub source files, once with LF and once with CRLF line endings. Both runs **PASS** without failures. These are *harness-verified JS assertions*; the actual Node command `node scripts/csr-scoped-rpc-design-smoke.mjs` and the repository-wide test suite were **not executed in this environment**. Re-run the script through the real repo Node runner before a source-code release.

## What the tests do NOT establish

- The draft `CREATE FUNCTION` was **not** submitted to any PostgreSQL environment, so no PL/pgSQL compilation, function return-row type enforcement, grants, ownership, or real session authorization has been proved.
- The synthetic fixture proves only the period-scope equivalence **for its chosen sample**, not all 63 SQL columns, every SKU, actual table cardinality or production numeric parity.
- Neither original nor proposed heavy data query was executed. The earlier **8097.81 vs 2563.31 EXPLAIN estimates** are still the only planner comparison, not measured runtime improvement.
- No genuine authenticated negative/positive RPC tests occurred, no cached client route was changed and the live PWA continues using the original view.
- 2000-row truncation and key tie-breaking remain unresolved. A generic API cannot silently drop results if a period eventually exceeds that cap.

## Further gates, in order

1. Peer review and independently run Node smoke in repository LF/CRLF environment, confirm no test harness drift.
2. Establish a user-approved no-additional-charge isolated PostgreSQL environment (local machine or other already available staging) matching the relevant live schema and `auth` helpers; **do not** use a paid Supabase dev branch merely for compilation.
3. Compile the full draft SQL, verify `RETURNS SETOF` 63-column type identity, grants, function owner, search_path and the rejection of unauthenticated/non-CCC viewers.
4. Full-result parity for September/October/November 2026 and missing prior periods, preserving approved October run **143** and November latest-success run **149** selections.
5. Bounded actual-query performance comparison and repeatability, then separate owner-approved production migration and client feature-flag plan.
6. Continue independent printable summary statistics/57014 investigation and November readiness-build governance.

**Production writes performed:** none. **New formal closure:** none. **Programme formal closure:** 5/13 (38%).
