> **SUPERSEDING OWNER DECISION — 10 NOV 2026:** All five R8 recommendations **Q-PRM/Q-ID/Q-VIEW/Q-F1/Q-D3 were expressly APPROVED AS POLICY DIRECTIONS**. Their precise scope and non-authorisations are in [R9 approved policy record](WP05_R9_OWNER_POLICY_DIRECTIONS_ACCEPTED_2026-11-10.md). Older “pending” language below is historical. No production privilege/flag change, preview execution or authenticated negative-user test is authorised by this policy approval. WP05 OPEN, 6/13. [Four historical F reconciliation](WP05_R9_HISTORICAL_F_RECOVERY_RECONCILIATION_2026-11-10.md).

# WP05 R8 — SEC-A1/A2 live boundary, PRM F1 and closure decision

**Date:** 10 November 2026. **Status: READ-ONLY CATALOGUE + CLIENT SOURCE RECONCILIATION; OWNER POLICY DECISIONS PENDING.** Workpack WP05 OPEN; programme 6/13. The 10 November Q-L1 server fix remains verified; do not reopen it. Staff Governance W5-06 confidentiality release was owner-accepted with bounded residuals; other WP05 negative identity/security work remains a separate gate.

## A. Live SEC-A1/A2 post-deployment source and ACL parity

All queries inspected `pg_proc`, function definitions, effective SQL role ACLs and client code; **no function/RPC was executed**. Match the **correct hash kind**: 4 Nov SEC-A1/A2 acceptance fingerprints were **MD5(`prosrc`)**, not MD5(`pg_get_functiondef`). On 10 Nov, the exact live body hashes **match** the 4 Nov expected post-change values:

| Control | Live body MD5 | Authenticated direct EXECUTE | Anon EXECUTE | Static guard |
|---|---|---|---|---|
| SEC-A1 `costing.rpc_accept_material_review_action` ten-argument | `50712d2cbbf09b1be0764966d604f092` | No | No | `require_permission('module:costing-control-center',true)` |
| SEC-A1 `costing.rpc_accept_material_review_action` seven-argument | `326211fd5e811bdab52aa6ce421d56b7` | No | No | same |
| SEC-A1 `costing.rpc_close_material_review_acceptance` | `32077cdd5599de73d7d8867211820f24` | No | No | same |
| SEC-A2 `public.rpc_costing_preview_approval_impact(bigint)` | `9911a0c6f2b9c40f762059757e44560e` | Yes | No | CCC View **AND** Edit before acknowledgment INSERT |
| Adjacent `costing.rpc_accept_internal_source_material_review_action` | `md5(pg_get_functiondef)=5172a1dcceeef4fec54278988b7bb612` | Yes | No | CCC View **AND** Edit |

SEC-A1 **public** overload wrappers delegate to the guarded internal routines; they themselves do not contain a second guard and have authenticated EXECUTE but not anon EXECUTE. In the observed source, the SEC-A1 internal guards appear before the original operational checks, and SEC-A2's check precedes the acknowledgement write. All inspected routines were SECURITY DEFINER owned by postgres. The SQL role EXECUTE flag alone is **not** successful business-authorization proof; `public.require_permission(text,boolean)` requires `auth.uid()`, matching target, `can_view=true`, and `can_edit=true` when edit is requested.

**Current client affordance:** inspected `public/shared/js/costing-approval-screen.js`. `Review for approval` renders only when `draft && canEdit() === true`; otherwise an explanatory view-only message is used. `openPreviewForRun()` immediately refuses when `canEdit() !== true`. This is a client-source guard, **not** a signed-in role/UI behavioural run.

**Disposition:** SEC-A1/A2 code/catalogue guard **VERIFIED CURRENT**, real user view-only writer denial **NOT TESTED** and deliberately excluded from production acceptance; editor invocation with live records **NOT TESTED**. No new grant, session or account was created.

## B. PRM F1 — one-name boundary sharper, not allowlisted

Read-only `pg_proc.prosrc` inspection for `public.rpc_preview_route_family_route_steps(bigint,date,date)` and `costing.fn_preview_route_family_route_steps(bigint,date,date)` reconfirms the exact R2 live definition MD5s:
- Wrapper `4ff8d1f4e17520de59ab744196d83ba7`, VOLATILE SECURITY DEFINER, 185-character body; calls `public.require_permission(PRM,false)` and the internal function.
- Internal `3f694a889c1d69d4a2dd563b28419356`, STABLE SECURITY DEFINER, 10,742-character body.
- Simple source call-token extraction found **no additional schema-qualified function call** within the internal body and no obvious DML/dynamic-execution token. `FROM/JOIN` references resolved by a bounded text scan: `costing.production_route_family`, `costing.production_route_family_product_group_map`, `costing.production_route_family_route`, `public.daily_work_log`, `public.products`, `public.sub_groups`. The list is **textual** and may not capture indirect view/operator calls, SQL planner privileges or every data dependency.
- **Important sensitivity:** daily work log and historical route/workload material are broad operational data under a SECURITY DEFINER PRM View-level check, not evidence of permission to expose every returned row to another role.

**Disposition:** `F1_LIVE_WRAPPER_INTERNAL_SOURCE_PARITY_PASS`, `NO_OBVIOUS_INLINE_WRITE_TOKEN`, `SENSITIVE_READ_GRAIN_REVIEW_OPEN`, `F1_PREVIEW_EXECUTION_NOT_AUTHORISED`. No actual preview call, no allowance to run other `rpc_preview_*` endpoints.

## C. PRM run 82 review — exact client contract and owner choice

The current `public/shared/js/costing-suite-production-route.js` calls `RPC.mappingReview` using fixed `PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT` `period_start,valuation_date,refresh_run_id` plus independent `as_of_date:getAsOfDate()`. Foundation similarly uses a fixed historical source run and selected as-of date. UI code contains a fixed historical-context note (behind its governed feature condition) and a general `Route as-of date (not Costing period)` input tooltip.

[R6 aggregate](WP05_R6_RUN82_MAPPING_FUNNEL_LIVE_COMPARISON_2026-11-10.md) verified 495 run-82 recipients; 454 currently active; approved effective mapping predicate **0/454 at 7 Aug** and **454/454 at 10 Nov**. This strongly explains **mapping** review empty at current as-of; it does **not** execute the review RPC, verify its result set, or establish Foundation's extra exception predicates.

**Recommendation Q-PRM (OWNER CHOICE):** retain existing **historical workload recipient run + separately selected route-mapping as-of date** as intentional comparative semantics, with prominent *two-context* labels in Mapping and Foundation views; a frozen-as-of historical replay can be proposed separately if actually needed. Do not change server date defaults, selections, run 82 or user-controlled date automatically.

## D. Focused negative-identity outcome matrix

| Identity | Exact expected CCC writer guard (source) | Shared 49-view helper (source) | Behavioural result |
|---|---|---|---|
| ID-V six-costing View, zero Edit | DENY | ALLOW if own module read and underlying permissions permit | **NOT TESTED for direct SEC writer denial**; Staff Governance genuine view-only tests were separate |
| ID-N no costing grants | DENY | DENY | **NOT TESTED** |
| ID-X CCC Edit true, View false; no other costing view | DENY (both bits needed) | DENY absent other module View | **NOT TESTED** |
| ID-O CSR View only | DENY | potentially ALLOW under current any-one-of-four helper | **NOT TESTED**; blanket CCC shared-view deny would be a false oracle |

**Proposed Q-ID security evidence route:** Accept source/ACL/isolated proof as static evidence; use only existing eligible genuine identities for a narrowly allowlisted **read-only** role-behaviour test after a separate, precise owner authorisation; preserve NT for unavailable roles. All production writer-denial behavioural tests remain prohibited; if necessary use a disposable non-production fixture with later approval.

**Proposed Q-VIEW design direction:** hybrid shared aggregate access with module-specific sensitive detail and explicit business exceptions, rather than global `fn_costing_view_allowed` rewrite. No grant changes unless row-specific mapping and compatibility tests are approved.

## E. Closure lanes and exact next decision

1. **Already resolved:** L1 historical selling/scheme KPI server correction; W5-06 Staff Governance confidentiality subgate; WP06 A1/B1 receiving scope (B1 integrated tests now WP12-owned, not passed).
2. **Ready for owner policy disposition:** Q-PRM historical run vs as-of semantics; Q-ID bounded negative identities and acceptance-deferral policy; Q-VIEW hybrid design direction only; Q-F1 no production preview, F1 only static proof; Q-D3 keep CCC Edit and MCM Edit distinct, no silent AND/OR.
3. **Still actual WP05 gate evidence:** four historical F recoveries with dated observed scope, the remaining AE1 NT cases not transferred by B1, critical C5/D5 and route-family UI/authority read paths, W5-03 build identity delta, risk-deferral owner/milestones, final workpack owner signature. Do **not** label WP05 7/13 now.

**No production SQL, GRANT, view or function modification, staff read, browser login, writer or preview execution, feature flag change, application deployment or Electron release performed in R8.**
