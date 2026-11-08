# Costing Suite issue #211 — staff pool 7/42 and family-route preview RPC contract audit

**Date:** 8 November 2026. **Scope:** read-only production catalog/source examination and documentation; no RPC preview invocation, production data writes, permissions, flag, deployment, migration or cache change. **Formal programme closure: 5/13 unchanged.**

## A. Staff Pool Summary — previously open 7 displayed vs 42 source rows: RESOLVED

- Client: `public/shared/js/costing-suite-cost-build.js`, Staff Governance sub-tab `staff-pool-summary`, reads `public.v_costing_staff_cost_pool_summary` via `costingFrom(...).select('*').eq('period_start', activePeriodStart).order('allocation_pool', {ascending:true})`.
- Independent live SQL `SELECT period_start,count(*) FROM public.v_costing_staff_cost_pool_summary GROUP BY period_start ORDER BY period_start DESC` returned **exactly 7** rows per month for **June, July, August, September, October and November 2026**, totalling **42** source rows.
- Genuine ID-V browser at default `2026-11-01` displayed **7**, matching the live filtered source. Hence **PASS** for the observed period, **not a data loss or UI defect**. The unfiltered 42 figure counted six distinct periods. This finding supersedes the previous `UNRESOLVED` notation in [IDV_SELECTOR_SUBTAB_ACCEPTANCE_2026-11-08.md](IDV_SELECTOR_SUBTAB_ACCEPTANCE_2026-11-08.md), which remains as historical evidence.

## B. Blocked `rpc_preview_route_family_route_steps` — read-path contract, not a confirmed mutation

**Trigger confirmed in client** `public/shared/js/costing-suite-production-route-editor.js`: `loadFamilyDetail` invokes `loadFamilyEvidencePreview` as secondary evidence; that routine calls `costingRpc(RPC.previewFamilySteps, ...)` where `RPC.previewFamilySteps` is `rpc_preview_route_family_route_steps`. In the ID-V supervised run, opening an approved Route Family caused this request, which the acceptance network guard **aborted before server delivery**. The displayed route details came from the separately allowed route detail read RPC.

**Independently inspected live Postgres catalog; nothing executed:**

| Layer | Signature | Properties | Read/write and authorisation findings |
|---|---|---|---|
| Public wrapper | `public.rpc_preview_route_family_route_steps(bigint,date,date)` | PL/pgSQL, VOLATILE, SECURITY DEFINER, postgres owner | Calls `public.require_permission('module:production-route-manager',false)`; returns `costing.fn_preview_route_family_route_steps(...)`; no DML in wrapper |
| Permission helper | `public.require_permission(text,boolean)` | PL/pgSQL, VOLATILE, SECURITY DEFINER | Requires `auth.uid()` non-null and matching canonical permission target with `can_view=true`; `p_need_edit=false` means edit grant not needed; no DML in inspected body |
| Internal preview | `costing.fn_preview_route_family_route_steps(bigint,date,date)` | PL/pgSQL, **STABLE**, SECURITY DEFINER | Reads approved route, family/group mapping, active products and `daily_work_log`; aggregates historical batch evidence; assembles route step JSON, gap findings, and returns `preview_only=true`, `approvable=false`, `requires_manual_review=true`, `records_created=0`. **No DML or state-mutating call is present in inspected body** |

**Assessment:** In the three inspected function bodies, the direct invocation path is read-only and view-authorised; the name-prefix-based acceptance policy blocked a legitimate supplementary read **by its conservative definition**. The wrapper being marked VOLATILE does not itself imply side effects. This review does not certify all `rpc_preview_*` functions as safe and does not grant permission to exercise this one. There was no actual server-side execution in ID-V acceptance, so do not record an authenticated end-to-end preview PASS.

**Potential follow-up (independent client worker):** propose a **one-name, exact-signature** allowance to the read-only acceptance harness for `rpc_preview_route_family_route_steps`, accompanied by a static regression asserting the wrapper, permission check and direct internal body remain nonmutating. Keep other previews denied. Review regression and obtain explicit owner approval *before* any authenticated browser retest that would send this RPC. No changes to the runtime PRM UI or Supabase functions are necessary based on evidence so far.

## C. Remaining items

- Product Route handoff: sampled product had no Product-specific route version; use a source-count-guided existing version for a future view-only retest, no new draft creation.
- Historical preview functions `rpc_preview_route_family_candidate`, `rpc_preview_product_process_route_candidate`, `rpc_preview_product_route_delta_candidate` remain **separately unaudited** for safe runner allowance; do not expand the policy.
- Mapping/foundation exact-run candidate response counts need independently confirmed parameter-level read checks.
- Cost Sheet Review: two independent 57014 timeouts in printable summary and SKU monthly comparison lenses need a bounded SELECT-only diagnosis.
- Keep the local C: disk-full warning and ID-V credential-rotation recommendation. No user file deletion authorised.

**Evidence trail:** GitHub issue [#211](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/211), PR [#217](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/217) and this repository checkpoint.
