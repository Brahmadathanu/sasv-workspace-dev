> **SEC-A1 follow-through (4 Nov):** A [prepared, unexecuted permission-gate correction package](SEC_A1_MATERIAL_REVIEW_PERMISSION_REMEDIATION_PLAN_2026-11-04.md) includes baseline source fingerprints, three exact-body CCC-edit changes, guarded apply/rollback SQL and isolated role-test requirements. Separate owner approval is required before any live migration; SEC-A2 remains unresolved and production-backed signed-in acceptance stays HOLD.

# Production-backed view-only acceptance — server permission audit (4 Nov 2026)

> **Status: HOLD for signed-in production-backed acceptance, especially all-ON testing.** This is a read-only, source-and-catalogue audit record, **not** a migration, security fix, test account approval, or WP closure. Source baseline: GitHub `main` `1e7766031bf3cf229ae2578f3944352baa89ec3c` after #169/#170. Live target: SASV Supabase project `qhmoqtxpeasamtlxaoak`. All catalogue and `prosrc` inspections were SELECT-only. No application RPC was invoked, no auth or grants changed, and no production/test data was modified.

## 1. Programme and acceptance progress

- **Formal ledger:** WP00–WP04 closed; **5/13 = 38%**. WP05, WP06, MDC-07, WP12 remain formally open. No formal closure from this audit.
- **Recent WP06/WP12 integration wave:** 3/3 already merged. **Additional test-maintenance wave:** #170 scope guard and #169 console/RPC allowlist both squash-merged. Claude's final tested #169 head `36b47daf`: LF and CRLF **873/873**, no failures/skips; latest `main` merge `1e776603` was verified but a separate post-merge suite is *not* claimed.
- Local source client against full `main` is possible on localhost, but `public/shared/js/supabaseClient.js` targets **production**, not a staging backend. Mock Chromium runs are safe offline; a local origin isolates frontend flags, **not backend authorisation**.
- Full owner signed-in six-module view-only ON/OFF acceptance: **NOT TESTED**. Do not mark a module or flag PASS until server clearance, authorised credentials and proven served asset/source SHA.

## 2. Read-only live database evidence

### 2.1 Identity and permission model

- `public.require_permission(p_target, p_need_edit)` is SECURITY DEFINER and tests `auth.uid()` against `public.user_permissions_canonical`. It requires `can_view=true` and, only when `p_need_edit=true`, `can_edit=true`.
- Aggregate permission inventory for the **six** Costing module targets (without retrieving user identities): accounts with view permissions on all six and no edit among those grants = **0**; accounts with view permission on all six and edit on one or more = **1**; view-only partial matches = **0** at audit time. This is *not* a global check of all grants on all modules.
- An authenticated role's PostgREST EXECUTE privileges on SECURITY DEFINER functions are **not themselves an edit-permission gate**. Owner/admin clients must not be used to claim view-only acceptance.

### 2.2 Load-time readers

| Function | Live behaviour inspected | Disposition |
|---|---|---|
| `public.rpc_costing_health_check()` | SECURITY DEFINER, STABLE, authenticated EXECUTE; calls `require_permission('module:costing-control-center', false)`, then `costing.fn_costing_health_check(null)`. | Read-oriented; possible expensive full snapshot fingerprint verification. No repeated/all-ON live calls without performance review. |
| `costing.fn_costing_health_check` | SECURITY DEFINER, STABLE, reads governance, cron, refresh, fingerprints; inspected source for write-oriented statements, none found. | No explicit write observed in source inspection. |
| `public.rpc_get_cost_period_valuation_context` | STABLE; requires CCC view; selects period and running-run context. | Read-oriented. |
| `public.rpc_get_production_route_master_options` | VOLATILE; requires PRM view; populates options by SELECT/JSON. | Read-oriented from inspected body; volatility alone is not proof. |
| `public.rpc_get_production_route_manager_readiness` | VOLATILE; requires PRM view; calls route-readiness function, returns JSON. | Read-oriented from inspected body; dependents need eventual role-level verification. |

These observations are **not** a certification of every downstream function, RLS policy, RPC, or user role. Do not execute functions against production merely to test denial.

### 2.3 Write-RPC permission findings — high priority

**Finding A — material review acceptance/closure contract requires correction (SEC-A1, HOLD).**
- Both overloaded `public.rpc_accept_material_review_action` signatures and `public.rpc_close_material_review_acceptance` are SECURITY DEFINER and have EXECUTE available to `authenticated` (not `anon`). They delegate to corresponding `costing` SECURITY DEFINER routines.
- The inspected `costing.rpc_accept_material_review_action` overloads and `costing.rpc_close_material_review_acceptance` enforce authentication and workflow/data validation but have **no explicit `require_permission(..., true)` edit check** in their bodies. The public wrappers have none either. The internal `costing` routines have **no direct EXECUTE grant** to `authenticated`; this does not remove access through public wrappers.
- These routines insert/update material-review acceptance records. Do not assume UI view-only mode prevents invoking an exposed writer. **No real unauthorised call or data mutation was attempted; effective denial via triggers/other policies remains to be assessed.**
- Client evidence: `public/shared/js/costing-suite-material-cost.js` calls the acceptance/closure RPCs; existing `WP05_A4_RPC_AND_PERMISSION_INDEX_2026-11-02.md` identifies CCC edit as the shared Workbench accept/close gate, including when reached from Material Cost pages. This **supports CCC edit as a minimal parity-preserving server gate**, but the D3 question of also requiring MCM edit remains a separate owner policy choice.
- Recommended separate server package: examine dependent permissions/triggers and client authorisation contract; introduce an explicit fail-closed, consistent **server-side edit gate** (consider CCC/MCM business ownership with owner decision D3); preserve overload semantics, queue validation, audit attribution, hard-blocker rejection, run/period context and existing review functionality. Use isolated role tests and migration/rollback plan before any live update; owner approval mandatory. Do **not** automatically choose CCC vs MCM edit policy in this document.

**Finding B — approval preview has a write effect under view permission (SEC-A2, HOLD for read-only testing).**
- `public.rpc_costing_preview_approval_impact` calls `require_permission('module:costing-control-center', false)` then **inserts an acknowledgement** into `costing.costing_approval_preview_ack` before returning a preview ID.
- This is not a purely read-only preview despite its name. **Do not invoke during a live view-only acceptance run.** Decide whether preview entitlement should require edit, or whether it should remain available with explicit preview-ack write semantics, separately under owner approval. No function was invoked.

**Finding C — owner-governed closers must be treated separately (SEC-A3, verify).**
- `public.rpc_costing_close_period` lacks a direct `require_permission` call but uses `costing.fn_w2_owner_name()`, which checks that `auth.uid()` exists in `costing.costing_governance_owner`. It is owner-gated, not demonstrably unprotected by its absence of a module-edit check. Verify owner-only contract, do not include in view-only test.
- Retired `rpc_costing_approve_run`, `rpc_costing_finalize_monthend_run` and `rpc_costing_supersede_approved_run` reject use; current `*_with_preview` functions explicitly require CCC edit. Most examined pricing-policy and production-route mutations require their module's edit permission; **a complete 157-RPC inventory has not been certified**.
- `rpc_accept_internal_source_material_review_action` is a separate routine with CCC edit guard; do not confuse it with the material-review overloads above.

## 3. Controlled acceptance clearance sequence

1. **SEC-A1 server-first contract decision:** owner decides which edit permission governs material acceptance/closure (D3: CCC edit vs MCM edit or both). Independently review canonical call graph, direct grants, and relevant triggers/RLS. No migration yet.
2. **SEC-A2 governance:** approval-preview acknowledgement write is excluded from strictly read-only UI tests; decide longer-term entitlement separately.
3. **Read-only acceptance account:** provision via governed user administration only **after** server contract remediation/denial verification, with `can_view=true`, `can_edit=false` for the six Costing targets and no broader write-authorising entitlements; record account identity privately, not in public repo docs. Existing inventory has no suitable six-module view-only account.
4. **Test context:** clean local `main`, recorded git/source SHA and served JS/CSS hashes; fresh isolated origin/profile; all eleven flags OFF initially. Record role permissions, browser, date, loads and requests. No Hub/Fill Planner origin service-worker registration; CDN provenance recorded. Production data is still live.
5. **Owner signed-in matrix:** only non-mutating navigation/reads. No approval preview, preview ack, Accept, Close, Save, Approve, Lock, Recalculate, Validate or Export. Health-check all-ON only after operational read-cost clearance. Record FAIL/NOT TESTED, never fabricate PASS. Restore flags OFF and verify.
6. **Residual acceptance:** C5/D5 historical run selection (80/82); S2 cost-sheet parity, S9 KPI requery, C9, D3, D7, O-8 and CDE-2 remain explicitly tracked. Separate Windows/Electron release gate after formal work-pack closure.

## 4. Programme documentation relationship

Read this with [OWNER_ACCEPTANCE_RECORD_2026-11-04.md](OWNER_ACCEPTANCE_RECORD_2026-11-04.md), [PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md) and [CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md](CDE2_OWNER_REVIEW_PACKAGE_2026-11-04.md). This **does not** create a parallel workflow; the single control plane remains [MASTER_PROGRAMME.md](MASTER_PROGRAMME.md) and the unified Costing workflow. Report #169/#170 as merged; do not infer production flag activation, PWA cache change, Electron release or completed acceptance.

**Owner decisions pending:** SEC-A1 edit-policy choice/D3; SEC-A2 preview contract; authorisation for any future server change; view-only test account and production-backed read-only acceptance; broader O-1/O-5/O-7/O-8. No change to e-Aushadhi WP07, Manage Activities #164/#166, Tally or storage retention.
