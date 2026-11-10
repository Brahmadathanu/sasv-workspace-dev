# WP05 R2 — live PRM F1 body parity and shared-view authority readback

**Date:** 10 November 2026. **Status: LIVE SELECT-ONLY METADATA VERIFIED; FUNCTION EXECUTION NOT AUTHORISED.** Workpack WP05 OPEN, formal programme 6/13. Approved B1 moves only WP12 integrated flag/compatibility tests; the security and functional concerns below remain WP05. No production function invocation, identity impersonation, writer RPC, user record read, browser session, grants, deployment or flags.

## 1. F1 exact live definition-to-repository body comparison — PASS, narrowly

Read `pg_proc.prosrc`, `pg_get_functiondef` MD5, `pg_get_function_identity_arguments`, `provolatile`, `prosecdef`, owner and role EXECUTE ACL from live production, **without executing** the preview. Compared body contents in-process with exact owning repository files fetched from current `main`:

| Function | Repository owning definition | Live signature / traits | Live function-definition MD5 | Normalised body parity |
|---|---|---|---|---|
| `public.rpc_preview_route_family_route_steps` | `supabase/migrations/20260803111630_create_kashayam_route_step_candidate_preview.sql` | `(p_family_route_id bigint, p_date_from date, p_date_to date)`; PL/pgSQL; VOLATILE; SECURITY DEFINER; owner postgres | `4ff8d1f4e17520de59ab744196d83ba7` | **MATCH** (185 character body) |
| `costing.fn_preview_route_family_route_steps` | `supabase/migrations/20260812172712_restore_route_family_route_step_preview_semantics_archive_guard.sql` | Same signature; STABLE; SECURITY DEFINER; owner postgres | `3f694a889c1d69d4a2dd563b28419356` | **MATCH** (10,742 character body) |

The comparisons trim leading/trailing whitespace and normalize CRLF to LF. They establish **live body-text parity with these repository definitions**, not that headers/defaults, helper chains, data access, return values, source mappings or permissions have undergone a complete independent no-side-effect review. `authenticated` currently has EXECUTE on both; `anon` has EXECUTE on neither (live metadata). Wrapper body calls `public.require_permission('module:production-route-manager', false)` then the internal function; this is **PRM View**, not Edit. Do not reinterpret the function name `preview` as a safety guarantee.

## 2. Limited live code-token inspection

The production `prosrc` bodies of the two F1 functions and `rpc_preview_route_family_candidate` / `fn_preview_route_family_candidate` were scanned for common DML/dynamic execution tokens (`INSERT INTO`, `UPDATE ... SET`, `DELETE FROM`, `TRUNCATE`, `CREATE TABLE/TEMP`, dynamic `EXECUTE`, `nextval`, `pg_notify`, `dblink`). **No token matched**. This is a narrow textual signal, not a PostgreSQL parser, full dependency graph, dynamic SQL proof, ACL review, or authorisation to call any preview. Repository CLD3 has a broader static transitive analysis; the latest live call-tree **has not** been independently proven end-to-end.

Additional live metadata: `public.require_permission(text,boolean)` is VOLATILE SECURITY DEFINER, callable by authenticated but not anon; its live body requires `auth.uid()` and exact canonical `can_view`, plus `can_edit` only when requested. `costing.fn_resolve_production_route_candidate_policy` and `costing.fn_product_process_route_readiness` are STABLE SECURITY DEFINER and not directly executable by authenticated or anon according to the checked ACL. Their indirect behaviour through privileged wrappers remains subject to definer-level review.

**F1 disposition:** `LIVE_F1_BODY_PARITY_PASS`; `LIVE_FULL_SIDE_EFFECT_AND_PERMISSION_SCOPE_NOT_PROVEN`; `PREVIEW_ALLOWLIST_BLOCKED`. Any actual F1 invocation requires a separately documented and authorised no-side-effect procedure.

## 3. Shared costing-reader permission — precise live confirmation

Of 63 public costing-name-filter views (`v_costing_%`, `v_cost_sheet_%`), **49 definitions reference `public.fn_costing_view_allowed`**. Live helper is SQL STABLE SECURITY INVOKER (not SECURITY DEFINER), MD5 `a5c51f50421d35a7207878c237fff273`. Its live definition allows privileged postgres/service_role **or any one** of four module View grants: CCC, CBM, CSR, MCM. Therefore an identity holding **only CSR View** might be permitted on shared views using the helper; a blanket expectation that CSR-only must receive denial across every CCC-named view is **incorrect**. Specific view definition/RLS/security_invoker/table privileges are still required to determine actual row reachability.

**Owner policy remains pending:** whether the one-of-four helper intentionally establishes a broad Costing-wide reader role or each sensitive view should instead require its owning module's View plus an explicitly authorised aggregate cross-module reader. The 10 Nov W5-06 **staff personnel** release acceptance imposed an additional narrow View+Edit gate and **does not** settle all 49 views. No grants or policies changed in this readback.

## 4. Safe next action

1. Prepare a 49-view **catalogue-only** classification by view ownership and column sensitivity from the existing [49-view inventory](WP05_W506_49_VIEW_COLUMN_SENSITIVITY_CONSUMER_INVENTORY_2026-11-09.md); seek owner classification before ANY blanket permission modification. Distinguish actual validated client consumers from proposals.
2. Scope ID-N and ID-X negative identity checks only to ordinary read-only surfaces whose exact deny oracle and identity are sound. No new production identity, grant manipulation, JWT replay or writer-denial RPC.
3. Keep PRM F1 restricted to source/catalogue analysis. If business context requires actual preview, independently review direct and transitive SQL plus data exposure, then obtain a new owner-approved execution procedure (prefer isolated environment).
4. Resolve PRM run-82 historical recipients versus current as-of semantics as a business decision separately; no source or SQL query change implied here.

**No operational code, SQL migration, permission, flag, deployment or Electron change.**
