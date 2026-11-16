# WP12 — Minimal owner-operated live read-only acceptance witness (16 November 2026)

## Status and scope
**Procedure PREPARED; not executed from ChatGPT.** This conversation has source GitHub and read-only Supabase connections, but **no authenticated human PWA browser/session**; no role impersonation, production writer probe or screenshot fabrication permitted.

Credited evidence, **do not retest unnecessarily**:
- 16 Nov hosted-source provenance: **74/74** six Costing assets, service worker `hub-cache-v393`, `VERIFIED [HOSTED]`; and **12/12** Product/RM/PM/SP BOM static assets (runs 43901062519/43900444608).
- 16 Nov inert Chromium `wp12-final-flag-sweep`: **21/21 PASS, 0 FAIL/0 SKIP**. This spans 13 states (all 11 OFF, each individual ON, ALL ON) on six real pages, detects writer/base-table calls, checks 32 lens IDs/10 PPM workspaces and deep-link fallback. No actual production feature flag was changed. Evidence: [run 43902516696](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43902516696), source PR #456, `main` squash merge `f579bdee0615012108c7ac195a4ea58f1e26eb6d`.
- WP05 R61/R63 **already accepted** Cost Comparison functional recovery via genuine scoped RPC HTTP 200 and ID-N/X/O HTTP 400/P0001; 4s p95 and matched October timing remain NOT PROVEN. Historical base-view 500/57014 is not treated as proof that scoped UI is still universally broken.

## Very short read-only browser witness (existing identities only)
Use the normal installed/hosted SASV PWA. No account creation/permission editing. Record whether asset version matches the previously verified main bundle (if not, mark build freshness NOT VERIFIED). Preserve redaction.

1. **Existing Costing View-only account**: open the six Costing entrypoints (CCC, MCM, CBM, PPM, CSR, PRM); each should display an authorized read or explicit legitimate empty state; individual writer controls absent/disabled; no confidential personnel detail. **No click on Preview, Refresh, Approve, Apply, Save, Edit, Recalculate, Export of confidential rows or similar writer/privileged actions.**
2. **Only known, already accepted read surfaces**: in CSR, open Cost Comparison Nov/Oct/Sep as normal (read-only) and record HTTP status `200` or error plus elapsed time **without data payloads**; PPM Scheme Master list and History each `populated / legitimate empty / error`. This is a bounded normal-use observation, *not* a load/performance test or an invitation to retry many times.
3. **Normal existing Editor account, read-only observation only**: verify allowed modules show their editor controls and no-auth modules are not exposed; **do not execute an edit**. If a genuinely existing No-access account is already available, confirm the Costing module tile/direct route denies access; otherwise report NOT TESTED, not PASS.
4. **WP11 responsive correction witness**: at an actual 390px viewport, open a populated PM BOM page and record `document.documentElement.scrollWidth` and `document.documentElement.clientWidth`. PASS only if no page-level horizontal overflow; internal table scrollers are allowed. On Manage Products SKU dialog verify the *Deactivate* label is visible on its red danger button **without clicking it**.
5. **Feature flag safety**: only verify normal browser localStorage defaults OFF. **Do not turn any feature flag ON** from this procedure. The real 11-flag ON/ALL-ON acceptance needs its own explicit browser-local flag test approval, isolate/reset plan, and recognized current login/build.

## Evidence to return without confidential data
One row per item: `identity category | module/read surface | PASS/FAIL/NOT TESTED | HTTP status or visible outcome | build/cache identifier | date/time`. Avoid credentials/JWT, names, SKU values, vendor/employee details, cost amounts, response body or data-bearing screenshots. Record any actual leak or incorrect costing result as **MUST-FIX release blocker**; don't continue privileged probing.

## Additional gates before full programme and combined Electron release
- Actual final-build authenticated View/Edit/Denied roles and 11-flag cross-module B1-T2/T3: **PARTIAL/NOT TESTED**, not closed by 21/21 mocked checks.
- Performance 4-second p95 and matched October non-regression: **NOT PROVEN**; under issue #273 follow-up, not automatic failure of previously accepted functionality.
- Installed PWA service-worker activation/offline/stale dependency lifecycle: NOT TESTED.
- Electron combined build from exact release SHA, ASAR/route/module smoke, update and rollback on Windows: NOT TESTED by intentional owner deferral until Costing Suite is ready.
- Formal workpacks WP10/WP11/WP12 remain OPEN, programme at 10/13. WP10 pending 04/05/CL15/Route Manager and eventual Electron fleet dependent DML REVOKE need separate decisions.
- No new publication approval has been issued. This runbook is a **minimal immediate read-only witness**, not a waiver of the full WP12 acceptance contract.
