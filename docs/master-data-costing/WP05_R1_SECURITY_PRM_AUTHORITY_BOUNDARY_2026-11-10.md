# WP05 R1 — retained security and PRM authority boundary, post B1

**Dated:** 10 November 2026. **Status: SOURCE-DOCUMENT RECONCILIATION, NO NEW SECURITY TEST EXECUTED.** WP05 remains OPEN, 6/13. This consolidates [CLD1](WP05_CLD1_SECURITY_RPC_STATIC_AUDIT_2026-11-08.md), [CLD3](WP05_CLD3_STATIC_TRACE_2026-11-09.md), [view/identity matrix](WP05_W506_SHARED_VIEW_AUTHORITY_AND_IDENTITY_MATRIX_2026-11-09.md), [no-side-effect plan](WP05_NO_SIDE_EFFECT_SECURITY_PLAN_DRAFT_2026-11-09.md), and [W5-06 confidentiality owner acceptance](WP05_W506_CONF_01_OWNER_RESIDUAL_DISPOSITION_2026-11-10.md). Older documents' B1-pending text is historical: owner approved B1 on 10 Nov, moving **only** cross-module eleven-flag and release-compatibility repetitions to WP12. The concerns below **remain WP05-owned**.

## Security matrix — what is / is not proven

| Subject | Evidence already present | Remaining WP05 obligation | Safe next action |
|---|---|---|---|
| Staff Governance personnel views | Live role simulation, genuine two view-only+editor PostgREST/browser tests, restricted 11/11 DOM inspection; owner accepted CSR-only as NOT TESTED | Preserve that narrow acceptance; neither broaden to all 49 shared views nor claim production writer-denial tests occurred | No retest of W5-06 as prerequisite; watch #262 UX hardening separately |
| ID-N (no costing grant) | Contracted expected deny; no genuine authenticated evidence | Actual deny of selected safe views/route, using a legitimate eligible identity if available | Owner-approved phase B plan required; no account changes now |
| ID-X (CCC Edit=true, View=false) | Guard definitions require both rights; no actual authenticated session | Actual denial for chosen CCC surface under that unusual grant shape | Do not create an unnatural production identity just for coverage; isolated or owner-approved alternative |
| ID-O (CSR View only) | Shared `fn_costing_view_allowed()` allows one-of-four module readers; CCC writer should still deny | **Do not expect universal CCC shared-view deny** under current helper: sensitive view-by-view least-privilege policy is a business decision | Classify existing 49 views and enforce least-privilege only after separate owner policy; no blanket revoke |
| SEC-A1 / SEC-A2 | Repo and live catalogue show expected writer guards; static/isolated tests present | Negative-role direct writer behaviour not proven in production (deliberately out-of-scope) | Use no-side-effect catalogue/source; writer invocation only in separately approved disposable environment |
| Internal-source review direct EXECUTE | `authenticated` USAGE on `costing` and function EXECUTE observed; body starts with `require_permission('module:costing-control-center',true)` | Decide defense-in-depth direct EXECUTE policy after mapping real callers | No GRANT/REVOKE automatically |
| F1 PRM preview `rpc_preview_route_family_route_steps` | CLD3 repo-static trace: wrapper VOLATILE SECURITY DEFINER delegates to STABLE SECURITY DEFINER read-only internal source; static scanner found no DML | Live wrapper + internal body parity, permission scope/definer, resolved indirect dependencies; **source-static pass is not live safe allowlist** | SELECT-only catalogue `pg_get_functiondef` / hash read, independent review before any RPC execution |
| Three candidate preview RPCs | Repo-static scan reports no DML in described call chains but privileged wrappers and indirect dependencies exist | Live body/call graph, volatility, permission and side-effect review | No browser preview click nor arbitrary RPC allowlisting |

## PRM historical run-82 zero-row classification

The existing CLD3 source trace identifies PRM Mapping/Foundation displays as using **run 82, valuation 2026-08-07, period 2026-08-01**, while `p_as_of_date` defaults to the browser's current date, **not** a frozen run-82 date. Run-82 workload recipients were read-only counted as 495 in earlier CLD2. The source predicate intersects those historical recipients with **currently active products** and **as-of-date effective/approved route mappings**, then only blocked/no-approved-family cases. Foundation imposes an additional no-ready-same-group condition. Therefore zero rows **may be legitimate under the mixed historical/current semantics**, but neither source trace nor zero UI alone proves correct business behaviour. Do not relabel #33/#34 PASS or automatically move to latest-run semantics.

**Next decision:** owner must choose whether those tabs intentionally represent the run-82 historical recipient population evaluated against a live as-of date (and label this unambiguously), or should offer a separately governed fixed historical as-of and run selector. A change to query semantics is not authorised by B1.

## Execution sequencing and stop rules

1. **R1 source-only:** reconcile signatures/call trees, historical failure recovery paths and view classification, without running any preview or writer endpoint.
2. **Read-only live metadata if separately authorised:** select catalogue metadata for the exact named RPCs, compare wrapper + internal hashes, function privileges, and verify ownership/definer. Source/metadata findings are not authenticated behavioural denial.
3. **Optional narrowly targeted signed-in browser phase:** existing legitimate identities, source-verified build, GET/HEAD and independently accepted SELECT-only views, no staff exports; zero mutation/preview calls. Stop on unknown/writer request.
4. **Owner policy:** decide P-W506-VIEW one-of-four broad view helper vs per-module sensitivity gates, PRM historical-vs-live as-of, and any need for isolated negative writer tests; do not infer approval from completion of Staff Governance confidentiality release.

**No production access, browser login, test session, SQL operation, flag, permission or code change was performed to prepare this record.**
