# CSR scoped comparison — three-period planner regression check and isolation gate
**Date:** 5 November 2026  
**Status:** MULTI-PERIOD EXPLAIN CHECK COMPLETE; ISOLATED PostgreSQL compilation unavailable; implementation/parity/role/performance gates OPEN. Formal Costing closure **5/13 (38%)**.

This is a continuation of [the governed RPC design](CSR_PARAMETERIZED_RPC_DESIGN_GATE_2026-11-05.md) and [the isolated contract-check record](CSR_SCOPED_RPC_ISOLATED_CONTRACT_CHECKS_2026-11-05.md). This is not a new formal work pack.

## Scope of checks

- Executed **EXPLAIN (FORMAT JSON, COSTS TRUE) only**, no ANALYZE, for the live public 63-column governed comparison and the extracted full-field SELECT body of the design-only scoped RPC. Both had `ORDER BY product_name,sku_column_label,sku_id`, `LIMIT 2000`, and the same requested period.
- For the candidate, literals were substituted for `p_period_start` and `p_limit` **only to plan the SELECT**; the proposed `CREATE FUNCTION` was not installed or compiled.
- Read-only inspection of `public.require_permission(text,boolean)` confirms it is `SECURITY DEFINER`, owned by `postgres`, checks `auth.uid()`, and requires `public.user_permissions_canonical.can_view` (and `can_edit` only when requested). The proposed read RPC uses `false`, preserving view-only access.
- Existing public governed comparison wrapper is owned by `postgres` and authenticated-selectable; the internal costing governed view is owned by `postgres` but not directly authenticated-selectable.
- Live `public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date,integer)` **does not exist**; no rights, function, schema or data were modified.

## Comparable plan estimates across periods

| Requested period | Current public view total cost | Scoped candidate total cost | Plan-cost delta | Outcome |
|---|---:|---:|---:|---|
| 2026-09-01 | 8097.81 | 5557.47 | **−31.4%** | promising estimate |
| 2026-10-01 | 8097.81 | 8236.48 | **+1.7%** | potential regression |
| 2026-11-01 | 8097.81 | 2563.31 | **−68.3%** | promising estimate |

These are **PostgreSQL planner cost units, not milliseconds or observed runtime**. Statistics for `costing.cost_sheet_line_monthly_snapshot` were last autoanalysed on 2026-10-24, before the November records. The estimated benefit is therefore neither a validated runtime speedup nor uniform across months.

**Key decision:** the draft must **not** be labelled a proven performance fix. A three-period predicate does narrow inputs for November, but an October comparison necessarily includes September; the large September snapshot population limits the likely gain. An adaptive or alternate aggregation strategy may be needed after safe measurement. Do not change global timeout settings or grant broad snapshot SELECT access merely to get a passing result.

## Isolation and compilation feasibility

- Connected Supabase project listing: **one project**, `sasv-workspace` (`qhmoqtxpeasamtlxaoak`), the production project. Do not create a **paid Supabase development branch** without owner direction.
- Local runtime inspection on 5 November found Node.js, but no `psql`, `postgres`, `initdb`, `pg_ctl` or Docker binary. Public GitHub could not be reached through the local command-line networking environment. No isolated PostgreSQL server was established.
- Consequently, the **full PL/pgSQL function, RETURN SETOF view column-type enforcement, actual function ownership and authentication execution remain NOT TESTED**. Neither a transaction rolled back in production nor a temporary production function is an acceptable substitute for the isolation requirement without distinct approval.

## Next engineering decision gate

1. Use a **no-additional-charge isolated PostgreSQL instance** with a relevant schema and auth/permission test fixture, or a separately reviewed test methodology; do not assume locally run JavaScript is a PostgreSQL compilation.
2. Before claiming readiness, verify exact 63-column SQL types and actual result parity under controlled workload for **Sep, Oct and Nov 2026**, absent historical periods, approved October run 143 and November latest-success run 149. Evaluate pagination cap and repeated labels.
3. Benchmark **all three periods** for latency/buffers and permission security under actual test sessions; October must not regress beyond an owner-approved tolerance.
4. Keep the candidate in evidence/docs and leave the production public comparison view, source snapshots and PWA client unchanged until an approved plan has compiled and passed.

## Control statement

No Supabase DDL/DML, migrations, `ANALYZE`, `EXPLAIN ANALYZE`, schema grants, PWA code/deploy/cache, Electron release or feature flag operation. **Formal programme closure remains 5/13 (38%).**
