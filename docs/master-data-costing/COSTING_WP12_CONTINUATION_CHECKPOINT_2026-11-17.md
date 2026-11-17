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

## Follow-up exact-source verification — 17 November 2026
- Compared each changed client source line-for-line against pinned baseline `8c7648fab72f2cf2e40bacc74e8fe59bedca2777`: `public/shared/js/costing-feature-flags.js` differs at **line 99 only**, a `//` comment; `public/shared/js/costing-cost-comparison-read.js` differs at **line 9 only**, another `//` comment. **No executable line changes detected in these two files.**
- Corrected a literal backslash-n/backslash-n formatting error in the draft `MASTER_PROGRAMME.md` opening banner. No programme state or acceptance decision changed.
- GitHub Actions PEC integrated browser workflow run [44102021037](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44102021037) was **IN PROGRESS** at last explicit job inspection, with no failed steps yet observed; it was **not** counted as a passing workflow. Do not infer project-wide CI completion from this single workflow.
- This follow-up does not establish signed-in restricted-role browser access, seven sensitive-view real JWT negative GETs, normal Cost Comparison HTTP timing, or any other WP12 operational PASS. Programme **11/13 closed**, WP10/WP12 OPEN, Electron HOLD.

## CI reconciliation after source-comment change — 17 November 2026
- GitHub Actions [PEC Integrated Browser Acceptance run 44102021037](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44102021037) **SUCCESS** for the earlier PR head `b59af955620f6014ef75c1265154b0649a300ddf`. Verified all job steps success, including mutation-sensitive SQL/SW guard, negative RPC safety harness, integrated browser and contract checks. This proves this workflow only, not completed WP12 signed-in security or release acceptance.
- A later documentation-only commit triggered [run 44102595032](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44102595032), **IN PROGRESS** when last checked. Do not promote latest head to all-CI PASS until its own relevant checks have completed.
- `main` remained the branch base `8c7648fab72f2cf2e40bacc74e8fe59bedca2777`; reviewed PR branch was ahead and not behind `main`. Diff limited to checkpoint document, opening programme banner, and two verified comment-only JS line changes; no SQL/SW/runtime source logic changes.
- Existing `WP12_MINIMAL_FINAL_READ_ONLY_OWNER_WITNESS_2026-11-16.md` already defines a bounded non-writer human-browser protocol. Do not create a duplicate harness or reclassify a tool-access limitation as PASS. Real authenticated HTTP negative tests, normal default-OFF Cost Comparison status/duration, and exact Windows package acceptance remain outstanding.

## Operator receiving package prepared — 17 November 2026
- [Focused authenticated browser receiving handoff](WP12_AUTHENTICATED_BROWSER_RECEIVING_HANDOFF_2026-11-17.md) now documents the smallest read-only genuine-role/Cost Comparison and V1–V7 sensitive-view negative receiving cases, safe redacted status/timing receipt format and fail-closed NOT TESTED handling.
- This is **prepared procedure only**. No authenticated browser session was obtained and no live view GET, Cost Comparison UI request, flag change or role impersonation was executed here.
- At review, earlier integrated PEC workflow run 44102021037 was SUCCESS; later runs 44102595032 and 44103104138 were still IN PROGRESS (no failures reported at that observation). Every new documentation head requires independent relevant CI status; no claim of current-head all-CI PASS.

## WP12 browser-access attempt (built-in Claude desktop browser) — 17 Nov 2026
**Provenance:** automated assistant session using the Claude desktop in-app browser pane against `https://sasv-utilities-hub.netlify.app`. The pane already held a signed-in session (hub shows "Signed in"). Identity and role were **not** disclosed or independently proved (no grant evidence; no credentials/JWT/cookies read). Claude-in-Chrome had no connected browser.

| Case | Result | Notes / limitations |
| --- | --- | --- |
| Authenticated browser access to production | **PARTIAL** | Signed-in session of unproven role category; no second/restricted account available |
| Editor / View-only / No-access matrix | **NOT TESTED** | No independently identified accounts; role not fabricated |
| Seven sensitive-view negative GETs (V1–V7) | **NOT TESTED** | No proven No-access session and no approved safe GET method; no probes sent |
| Default-OFF Cost Comparison (one load, Nov 2026 period) | **FAIL (UI-observed) — release risk** | Panel showed "Failed to load selected lens: canceling statement due to statement timeout" (PostgreSQL statement timeout) while the lens header showed 829 rows / page 1/26. Browser-local flag keys absent = default OFF. The pane's network tool did not list the Supabase REST call, so **HTTP status and elapsed ms are NOT captured**. Not repeated per handoff stop rule; the 2,000-row governed view is the OFF path. Owner decision needed re scoped-RPC mode. |
| Installed PWA controller/cache | **PASS (observed)** | `navigator.serviceWorker.controller` = `/sw.js`; cache `hub-cache-v394` |
| Browser-local default-OFF flags | **PASS (limited)** | No COSTING/flag keys in localStorage for this origin; flag values not modified |
| Source/CI regressions | **NOT RUN here** | Local clone could not fully check out (Windows long paths); prior CI run 44102021037 SUCCESS only |

No writers clicked, no flag/permission/SQL/data change, no response bodies captured. WP10/WP12 remain OPEN, 11/13, Electron HOLD.


## Regression run and Cost Comparison timeout investigation — 17 November 2026
See [WP12_REGRESSION_AND_COST_COMPARISON_TIMEOUT_INVESTIGATION_2026-11-17.md](WP12_REGRESSION_AND_COST_COMPARISON_TIMEOUT_INVESTIGATION_2026-11-17.md). Summary: 72/96 local non-browser tests PASS; 23 fail identically on pristine main (no PostgreSQL / Windows host / ref-based guards: NOT TESTED locally); 1 PR-induced guard failure (WP10 G2 S4 on the comment-only JS edits, not CI-visible because path-filtered); PEC integrated CI run 44104385612 SUCCESS on head 89c379c. Cost Comparison default-OFF timeout is treated as release-blocking pending owner decisions; live EXPLAIN NOT TESTED.


## R-1 revert and Linux re-verification — 17 November 2026 (later; supersedes the comment-edit entries above)
Owner approved R-1 option (a). The two comment-only JS edits were reverted: both JS files are byte-identical to `main` `8c7648f`; PR head `d181b5a` is docs-only vs main. WP10 G2 source guard **11/11 PASS**. Linux (WSL2) re-run of 96 files: **85 PASS / 11 FAIL** (3 need Chromium: NOT TESTED; 8 fail identically on pristine main: baseline). Live read-only metadata/plain EXPLAIN: **BLOCKED** (no approved DB connection). Keyset-first proposal prepared ([proposal](WP12_COST_COMPARISON_KEYSET_FIRST_PROPOSAL_2026-11-17.md)), unapplied. Details in [the investigation report §7](WP12_REGRESSION_AND_COST_COMPARISON_TIMEOUT_INVESTIGATION_2026-11-17.md). Flag OFF; no pilot authorised. WP10/WP12 OPEN, WP11 CLOSED, 11/13, Electron HOLD.

## Live read-only Cost Comparison plan follow-up — 17 November 2026
The prior Claude Desktop session's **BLOCKED** read-only database plan work was completed in a *separate connected Supabase session*, with SQL confined to `BEGIN READ ONLY` and plain `EXPLAIN` (no ANALYZE). See [investigation report §8](WP12_REGRESSION_AND_COST_COMPARISON_TIMEOUT_INVESTIGATION_2026-11-17.md): snapshot estimated rows 1,490,828; manual stats analysis Nov 5; modifications since analysis 55,352; `authenticated` statement timeout 8s; Sep/Oct/Nov default-OFF governed view identical planner top-level cost ~6,997 with shared `line_pivot` before current period filter. Scoped RPC outer `Function Scan` EXPLAIN is opaque and **cannot** substantiate an internal cost comparison. No query execution, live business read, SQL/flag change, or timing p95. Existing November UI timeout **FAIL** remains open; no release-readiness advance or owner promotion of scoped mode.

## WP10 direct-DML policy preflight — 17 Nov 2026 (late read-only recheck)
A separate connected Supabase session ran SELECT-only `pg_class`/privilege/`pg_policy` checks. For all four master tables `public.categories`, `public.sub_categories`, `public.product_groups`, `public.sub_groups`:
- `authenticated` has **SELECT, INSERT, UPDATE and DELETE** table privileges (4/4 tables, 12/12 direct writer privileges still true).
- RLS is enabled, `relforcerowsecurity=false`. Each table has one `*_authenticated_crud` policy for **all commands** with both `USING` and `WITH CHECK` equal to `(SELECT auth.uid()) IS NOT NULL`; no per-module canonical edit-permission predicate in those direct-DML policies. This is more precise than saying "RLS protects writes": RLS currently checks sign-in but not the intended master-governance editor permission. No actual writer request was attempted.
- This confirms the **WP10 live direct-DML security risk remains OPEN** independently of the newer client writer-guard paths. Do not remove grants or rewrite RLS before the existing Electron fleet compatibility check and owner-approved cutover; also do not waive the issue as harmless merely because new clients use governed RPCs.
- Recent PR #473 head `c26c4da494e482c1d2ea7a579a4261e4a425537a` has [WP05 CSR Offline Verifier run 44127032528](https://github.com/BrahmadathanU/sasv-workspace-dev/actions/runs/44127032528) SUCCESS. Only that workflow is credited for this head, not all role/browser/release acceptance. Owner's installed mobile PWA Cost Comparison visible November PASS is separately retained; HTTP duration, p95 and JWT role matrix still unproven.

**Release sequencing recommendation (not approval):** prepare/test an unpublished, exact-SHA compatible Electron candidate first, confirm staff installations migrated, then request owner approval for the four-table privilege hardening with rollback; do not distribute installer, merge, revoke or lift HOLD by inference from this note.
