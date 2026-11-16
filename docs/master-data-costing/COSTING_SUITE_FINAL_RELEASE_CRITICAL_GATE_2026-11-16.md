# Costing Suite — final release-critical closure gate (16 November 2026)

## Objective and honest status
The owner requests acceleration toward finishing the Costing Suite workflow before the next combined Windows Electron release. **No unsupported overnight-completion promise or automatic final sign-off follows from this request.** Do not reopen the already owner-accepted WP05/06/07/08/09 gates merely because earlier dated reports retained historical FAIL/NOT TESTED outcomes. Maintain separate counters: **formal master-data programme 10/13 CLOSED (WP00–WP09)**, with **WP10/WP11/WP12 OPEN**; operational Costing Suite release readiness is a separately gated acceptance.

**Recommended release scope freeze:** Delivered Costing Tier-1 rationalisation/navigation with default-OFF flags and its independently reviewed backend corrections. The 12 WP10 classification RPCs are already live and guarded; four Electron-root classification clients are merged and will be packaged with the later Costing Suite Electron release (no interim installer). Optional WP10 proposal 04/05/CL15/Route Manager redesign, four-master DML REVOKE and WP11 noncritical aesthetic work are **NOT approved as release additions**. Any classification of their remaining risks as nonblocking needs an explicit bounded owner disposition; do not claim them completed.

## Read-only current live costing evidence
Read on 16 Nov 2026 from `public.v_costing_pricing_period_run_status`:
| Period | State | Approved run | Latest successful run | Important status |
|---|---|---:|---:|---|
| Sep 2026 | LOCKED | 122 | 122 | Approved and locked |
| Oct 2026 | OPEN | 143 | 148 | Approved 143 remains pricing source; newer 148 is draft |
| Nov 2026 | OPEN | none | 152 | 152 DRAFT, NOT approved |

Cron `cron.job_run_details` read-only: weekly job 66 most recent 2026-11-15 20:30 UTC **succeeded** (16 Nov 02:00 IST), and earlier 8 Nov/1 Nov succeeded; monthly job 67 last 31 Oct 20:30 UTC **succeeded**; stage processor job 68 was succeeding at the time of the same-day snapshot. **A cron “succeeded” record proves the scheduler invocation completed, not that every stage and every costing business output was validated.** No run was approved, finalised, re-priced or locked.

## What is already concluded
- WP05 final rationalisation conditionally CLOSED (R63, 12 Nov) with bounded functional, performance, authority and seven-view security residuals; B1-T2/T3 acceptance belongs to WP12. WP06, WP07, WP08 and WP09 also closed with owner-accepted bounded residuals.
- WP10 server-first 12 classification CRUD RPC installation completed (live catalogue 12/12, existing four-table privileges 4/4), client-only #445 merged, root Electron pages included by electron-builder `**/*` and local Express static server. **Installed Electron client not yet tested**, old direct-DML clients remain supported, 04/05/CL15 and route writer residual remain open.
- WP11 SKU Deactivate text contrast corrected under #448 and merged `a0222844c48d5638d22d3d16f534c62a60ddfe7c`. Genuine authenticated UX retest not yet recorded.
- WP11 PM BOM 390px overflow correction #449 **merged** to main as `448556cd7ac7b2991c2e1f580027b82e695f7533`. Its focused Chromium Electron/PWA mocked 390px and adjacent PEC integration checks PASSED. Real populated-data signed-in acceptance remains NOT TESTED; do not relabel the historical 563px observation as a live retest.

## Minimum closing evidence before owner can authorise a combined Costing Suite release

| Gate | Required, safest evidence | Current state / stop rule |
|---|---|---|
| C-F1 Final source/asset provenance | Exact main/Netlify-served build digest for six Costing modules and shared imports, installed SW freshness and default-off flags | **PASS for hosted static bytes:** 74/74 six-Costing-module bundle assets plus SW v393 VERIFIED from GitHub Actions on 16 Nov (run 43901062519); 12/12 shared Product/RM/PM/SP BOM assets also verified (run 43900444608); see [WP12 hosted witness](WP12_HOSTED_COSTING_MASTER_ASSET_PROVENANCE_2026-11-16.md). **Installed PWA controller activation, final signed-in role/flag acceptance and Windows package remain NOT TESTED** |
| C-F2 11 flags, six modules | WP12 B1-T2: default OFF, relevant narrow ON/OFF, cross-module/deep-link and restoration, 390/1280; no production writer/preview | **NOT TESTED for final build**, stop on stale dependency, console error or unauthorized action |
| C-F3 Genuine roles/security | Real approved Editor/View/No-access sessions for relevant Costing reads, sensitive fields and module visibility; preserve separate seven-view negative GETs as NOT TESTED until safely observed | **PARTIAL historical**, never test real writer-denial by pressing mutating RPC or fabricate roles |
| C-F4 Real costing parity | Current run/period context, 3-sample SKU cost sheet/print/status parity (previous WP05 S2/S9 acceptance preserved), no wrong pricing basis and live run-context regression | **Prior accepted with limits**; new erroneous financial results are immediate blocker |
| C-F5 Functional availability | Cost Comparison recurring HTTP 500/performance issue #273 and Scheme Master historical 57014: test/review final build with scoped real reader, record response statuses/timing; no wide expensive probe | **PERFORMANCE SLO UNPROVEN**; repeated HTTP 500 on normal user navigation is a release blocker |
| C-F6 Critical responsive UX | PM BOM 390px corrected in installed/current hosted client; SKU Deactivate text visible, content not clipped; no writers clicked | **MOCK/CI only** for corrections; hosted signed-in verification pending |
| C-F7 Windows/Electron | Electron NSIS/ZIP package from exact main descendant, module route/ASAR inventory, signed-in smoke, update/rollback, clear provenance | **NOT EXECUTED; intentionally deferred until Costing release** |
| C-F8 Owner publication and governance | Explicit accept/reject of each bounded residual and approval to publish an exact version | **NOT AUTHORISED**, no release until gate |

## Immediate shortest safe execution order
1. Verify merged #448/#449 asset provenance on the hosted/installed candidate and perform the pending real 390px signed-in PM BOM / SKU Deactivate visual acceptance; don't confuse mocked 390px PASS with hosted acceptance.
2. Freeze approved commit and run cheap read-only live inventory/provenance checks. No SQL writer or pricing policy/flag changes as a side effect.
3. Execute a **small real-identity, read-only** Costing browser witness for final build: six module boot, sensitive details, Cost Comparison error-free normal read, known Scheme Master list/history, PM BOM 390 and flags restored OFF; capture PASS/FAIL/NOT TESTED for each with no confidential values. Full WP12 matrix remains binding unless owner explicitly approves scoped release deferments with risk and destination.
4. Prepare combined Electron installer only when Costing acceptance supports a release candidate. Packaging must include classification screens (#445) and WP11 fixes (#448/#449 merged). Test installed package and update/rollback, then request exact-version publication approval.

**Release blocker rule:** Any demonstrated sensitive disclosure, wrong valuation/pricing basis, unapproved write, unresolved normal-user HTTP 500, build mismatch or blocked security/Windows acceptance prohibits an unconditional PASS. Approved conditional WP05–WP09 closures are not retroactive evidence for WP12.

This is an updated, decision-ready release gate and NOT an owner signature, a new acceptance pass, or an authorization for production changes. WP10/11/12 remain OPEN.
