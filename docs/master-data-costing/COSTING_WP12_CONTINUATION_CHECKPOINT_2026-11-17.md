# Costing Suite — WP12 continuation and repository handover (17 November 2026)

**Authority:** programme owner requested the Costing Suite workflow resume and repository documentation stay up to date as work progresses. This is a read-only continuation/checkpoint, not a release, migration, permission-change, or formal closure approval.

## Current programme state
- **11/13 CLOSED (84.6%):** WP00–WP09 and WP11 owner-closed. WP10 and WP12 OPEN. Electron release / publication **HOLD**.
- Preserve owner-accepted WP05–WP09 and WP11 evidence; avoid repeating populated six-module reads, actual production 390px PM BOM acceptance, SKU Deactivate visual witness and v393→v394 PWA upgrade absent a material build/session change.
- The accepted 17 Nov deployed WP11 witness established 390px page width/no page overflow, visible QA/Reload/Save controls, internal line-grid horizontal scrolling, 74/74 hosted byte parity, and active v394 worker. WP11 formal closure is documented in `WP11_OWNER_APPROVED_FORMAL_CLOSURE_2026-11-17.md`.
- Existing functional scoped Cost Comparison RPC acceptance remains credited. The **ordinary default-OFF Cost Comparison route HTTP status/duration and any 4 s p95** have **not** been demonstrated for this handover.

## New read-only Supabase continuation observation
- Project `qhmoqtxpeasamtlxaoak` returned `ACTIVE_HEALTHY`; PostgreSQL 17.4, 17 Nov 2026.
- Executed only a bounded `BEGIN READ ONLY` PostgreSQL catalog query, `statement_timeout=6000ms`, using `has_table_privilege`. For each of `public.categories`, `public.sub_categories`, `public.product_groups`, `public.sub_groups`, `authenticated` still has **INSERT=true, UPDATE=true, DELETE=true**.
- This **confirms continued exposure**, not that unauthorised DML was exercised. The prior pinned RLS identity-only policy finding remains the authority for the broader security assessment; it was not re-proven via live JWT or direct HTTP tests in this continuation.
- No DML, policy, grant, schema, role, feature-flag, costing period/run or business-record change. No JWT impersonation, production writer, view-body disclosure or unbounded cost/comparison request was run.
- A separate count expression in the same SQL batch was not surfaced by the connector's result (last-result-only); do **not** credit it as a fresh 12/12 RPC count. Prior 12/12 accepted catalog evidence is retained.

## Accepted revised operating order (small staff installation group)
1. **WP12 first:** independently authorised existing-role View-only/Editor/No-access signed-in acceptance; seven sensitive-view negative HTTP GET cases; read-only normal Cost Comparison request metadata and Scheme Master observations; browser-local default-OFF flags and final integrated permissions. Preserve original outcomes without recreating role identities, switching production flags ON, clicking writers, or probing response bodies.
2. Keep source and hosted provenance pinned; test actual installed PWA/controller/cache only in an environment that permits the observation. If DevTools/network or session evidence is inaccessible, mark NOT TESTED rather than bypassing organisational restrictions.
3. Review residual WP10 controls without adding optional SQL PR #463 to the release scope. The four-table authenticated direct-DML weakness is **CONFIRMED OPEN**, not a theoretical concern and not closed by the governed client RPCs alone.
4. Once acceptance supports a release candidate and the owner separately approves candidate packaging, build NSIS/ZIP **without publishing**. Install on the owner's development PC for Windows login, Costing, classification, permission, updater/restart/rollback tests; no live database writes for testing.
5. Following exact-version owner publication approval, rollout to fewer than 10 staff machines using a simple private version/checklist and restart acknowledgement. **PR #471** (offline read-only Windows inventory) is optional, not mandatory per-machine telemetry. Do not install the app on development PC prematurely; `npm start` is sufficient for development.
6. **After compatible installed fleet is confirmed**, separately review and authorise four-table ACL/RLS hardening, real role/JWT negative results and rollback support. No unconditional early REVOKE that would break older shipped direct-DML clients.

## WP12 remaining evidence ledger (this continuation)
| Receiving gate | Current classification | Grounded reason / next action |
| --- | --- | --- |
| WP11 responsive/UI and deployed PWA v394 | **PASS — preserved** | Formal owner-closed receipt; no repeat without changed build/session |
| Six Costing modules populated, one existing account | **PASS — limited identity scope** | Prior genuine visual witness; not independently proven Editor/View-only/No-access matrix |
| Authenticated Editor / View-only / No-access confidentiality | **NOT TESTED as full independent matrix** | Requires separately identifiable legitimate existing signed-in sessions; no role fabrication |
| Seven sensitive-view negative GETs under real JWT | **NOT TESTED** | Prior 7/7 catalog parity is not a user-level denial test |
| Normal default-OFF Cost Comparison endpoint/status/duration | **NOT TESTED in current session** | Do not substitute scoped-RPC pilot or historical 500; bounded ordinary browser observation required |
| Installed PWA controller/cache and default-OFF flags | **PARTIAL** | Prior v394 activation observed, but final role/flag matrix and device-specific tests remain |
| Real eleven-flag combined/restore acceptance | **NOT TESTED** | 21/21 inert Chromium PASS is not authenticated live acceptance; no production flag toggles authorised here |
| Windows NSIS/ZIP signed-in install/update/rollback | **NOT TESTED** | Deliberately held until the release-candidate gate |
| Four-table direct DML permissions | **CONFIRMED OPEN RISK** | 17 Nov read-only catalog shows all 12 table-operation grants (4 tables × 3 types) still true |
| Optional WP10 guards PR #463 | **UNAPPLIED / DRAFT** | Separate owner SQL decision; not included by generic continuation |
| Optional fleet inventory PR #471 | **DRAFT / OPTIONAL** | Local-only Windows runtime not accepted; less than 10 staff computers, simple checklist preferred |

## Operating rule for future continuation
Maintain repo documentation **during each meaningful work step**: capture source/commit provenance, exact test context, PASS/FAIL/PARTIAL/NOT TESTED boundaries, residuals, owner decisions and explicit no-change assertions. Prepare reviewed documentation commits/PRs without assuming a general "go ahead" permits SQL migration, ACL change, writer activity, release publication, or closure. Keep the newest status banner at the top of `MASTER_PROGRAMME.md` only when merging an approved reviewed documentation update; draft branch documents must not be reported as already on `main`.

**This document records a resumed workflow and one catalog recheck, not WP10/WP12 completion.**

## Subsequent read-only WP12 scoped-comparison verification — 17 Nov 2026
- Re-executed the exact repository catalogue-only assertion from `scripts/wp12-readonly-comparison-rpc-release-preflight.sql` inside `BEGIN READ ONLY`, with 6-second statement timeout on the approved Supabase project. **PASS:** one `rpc_get_cost_sheet_sku_monthly_comparison_scoped(p_period_start date, p_limit integer)` signature, SECURITY DEFINER, fixed `search_path=pg_catalog, pg_temp`, `authenticated EXECUTE=true`, `anon EXECUTE=false`.
- Inspected current `main` source `public/shared/js/costing-feature-flags.js` and `public/shared/js/costing-cost-comparison-read.js`: `COSTING_CSR_SCOPED_COMPARISON_RPC_V1` remains browser-local and **default OFF**; OFF uses `v_cost_sheet_snapshot_sku_monthly_comparison_governed`, while ON uses the scoped RPC. No client flag was changed.
- **Documentation/source-comment drift identified:** comments in both files still say the scoped server function is PREPARED/NOT APPLIED, contradicting the current verified live catalogue and prior applied migration evidence. This is a comment-only accuracy defect; **no runtime change has been made**. Correct those comments in a separately reviewed or expressly scoped documentation change, avoiding any flag default or code-path modification.
- **Not tested:** ordinary browser Cost Comparison HTTP status, duration/p95, genuine View-only/No-access path or real seven-view denial. No business RPC was invoked, no 2,000-row governed view executed, no JWT/account change and no SQL writes. The previous real scoped-RPC HTTP acceptance remains credited separately.

## Scoped source-comment correction committed — 17 Nov 2026
- Updated two explanatory comments only in `public/shared/js/costing-feature-flags.js` and `public/shared/js/costing-cost-comparison-read.js`. Both now correctly describe the live scoped RPC as installed while explicitly preserving browser-local **default OFF** and the separate owner release-mode decision.
- This was a **source-comment-only correction**; no flag name/default, endpoint, function invocation, query selection, permission guard, feature flag value or runtime branch was edited. Commit `62bc03f1b5cebb031b860f81929236c3b304a6e7` includes both sequential file changes on the draft PR branch.
- GitHub Actions on this commit reported a queued PEC integrated browser workflow at first observation (run `44101932836`). Its final result was **NOT YET VERIFIED** at that checkpoint; never infer CI PASS from queue state.
- Claude delegation was considered but is not required for this two-comment maintenance. This conversation has no direct Claude Code execution channel; do not claim Claude ran tests or reviewed the diff.
