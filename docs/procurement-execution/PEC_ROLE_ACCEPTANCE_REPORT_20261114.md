# PEC genuine-role acceptance report — Claude Desktop browser run

Date: 14 November 2026 | Issue #388 | Base: staging `5cfce87d8c77d4f0ace2e175c78cc729a0e523c6` | Host: `https://deploy-preview-347--sasv-utilities-hub.netlify.app` (PR #347)
Authority: `PEC_OPERATOR_ACCEPTANCE_TEST_SHEET_20261114.md`, `PEC_OPERATOR_EXECUTION_RUNBOOK_20261113.md`. No gate is closed by this document; **G0–G5 remain unsigned pending owner review.**

## 1. Method and limits (read first)
- Server state: R10 installed in production (history 697) — `PEC_R10_PRODUCTION_EXECUTION_REPORT_20261114.md`.
- Three **existing** identities signed in **personally by the owner** in the app's built-in browser pane, one at a time (sign-out between each). Claude never saw or handled credentials, tokens or recovery codes, and changed no roles. Only role categories are recorded; no identity, token or business row was captured.
- Checks ran through the pane's JavaScript against the page's own Supabase client, using the **same probes as the Playwright operator harness** (same RPCs, same classification, only HTTP status / SQLSTATE / booleans leave the page). The Playwright harness itself was **not** run (it requires an interactive terminal and a Chromium download); this is therefore equivalent probe logic, not the harness binary. Probes use the nonexistent indent id `0`: nothing can be read or changed.
- Beyond the harness's minimum, the Editor and No-access runs also executed `proc_indent_add_line(0,…)`, to prove each account's actual permission level rather than assume it.
- Role of each account is shown by behaviour (below), not by reading grants.

## 2. Pre-checks
| Check | Result | Evidence |
|---|---|---|
| Staging head | PASS | `5cfce87d`; Netlify preview "ready", all CI on the base green |
| Served-asset provenance (preview) | PASS | checker exit 0: html, js, css, sw byte-identical; `netlifyPreviewInjectionStripped: true`; `CACHE_NAME` `hub-cache-v393` |
| Harness self-tests | PASS | `node --test` 17 pass / 0 fail, run on the extracted pushed commit |
| Existing authorized browser session | none at start | pane showed the hub sign-in page; owner then signed in per identity |

## 3. Results by identity (actual evidence)
### Editor
| ID | Check | Result | Evidence |
|---|---|---|---|
| E1 | PEC panel opens | **PASS** | panel visible |
| E2 | Five lenses | **PASS** | PR, Indents, Vendor buy-list, Action, Excess all visible and activate |
| E3 | No read-only banner | **PASS** | banner absent |
| E4 | Edit controls available | **PASS** | 49 marked controls located; 3 disabled (context-dependent, cause not investigated), 46 enabled; no write attempted |
| E5 | R10 preview permitted | **PASS** | HTTP 400, SQLSTATE `P0001`, "Indent not found" (past the permission gate), no data returned |
| E5b | Edit permission proven (extra) | **PASS** | `proc_indent_add_line(0)`: HTTP 400, `P0001`, past gate ("Indent not found"), not a permission error |
| E6 | Functional writer on a draft | **NOT TESTED** | no approved disposable draft fixture; 0 draft indents; approved indents never used |
| E7 | On-screen collision preview with a real collision | **NOT TESTED** | needs the same fixture |
### View-only
| ID | Check | Result | Evidence |
|---|---|---|---|
| V1 | PEC panel opens | **PASS** | visible |
| V2 | Five lenses | **PASS** | all five visible and activate |
| V3 | Read-only banner | **PASS** | banner visible |
| V4 | Edit controls disabled | **PASS** | 49 of 49 marked controls `disabled` and `aria-disabled=true` |
| V5 | Writer denied | **PASS** | `proc_indent_add_line(0)`: HTTP 400, SQLSTATE `P0001`, permission denial; no row written |
| V6 | R10 preview permitted | **PASS** | HTTP 400, `P0001`, passed gate ("Indent not found"), no data returned |
### No-access
| ID | Check | Result | Evidence |
|---|---|---|---|
| N1 | PEC denied | **PASS** | main panel hidden; permission-denied status text shown |
| N2 | Read RPC denied | **PASS** | `proc_pec_pr_headers_paged(limit 1)`: HTTP 400, `P0001`, permission denial, no data |
| N3 | R10 preview denied | **PASS** | HTTP 400, `P0001`, permission denial, no data |
| N3b | Writer denied (extra) | **PASS** | `proc_indent_add_line(0)`: HTTP 400, `P0001`, permission denial |
### Anonymous (earlier, R10 execution report)
Preview RPC with the public anon key: HTTP 401, SQLSTATE `42501`.
**Observation:** denials surface as HTTP 400 with `P0001` ("Permission denied for …"), because `require_permission` raises a plain exception; the harness classifier accepts exactly this (`P0001` + permission wording). HTTP 401/403 appears only for roles lacking EXECUTE (anonymous).

## 4. Installed PWA and Windows Electron
| ID | Check | Result | Evidence |
|---|---|---|---|
| P1 | `CACHE_NAME` | **PASS** (browser service worker, not an installed PWA) | `hub-cache-v393`; worker active, scope `/`, controlling the page |
| P2 | Cached PEC assets current | **PASS** (same scope) | cached js `522f43fb…` and css `c104d4ea…` equal expected; cached html equals expected `fff5848f…` after removing the one Netlify preview block |
| P3 | Offline open | **NOT TESTED** | the pane cannot toggle the network |
| P4 | Online reload after offline | **NOT TESTED** | depends on P3 |
| P5 | Installed PWA on a device | **NOT TESTED** | no installed PWA reachable from this session |
| X1 | Packaged `app.asar` PEC hashes | **PASS** | unpacked package built from `5cfce87d` (electron-builder 26.0.12, Electron 36.8.1, `--win dir --publish never`, nothing published); extracted html `fff5848f…`, js `522f43fb…`, css `c104d4ea…` equal the repo |
| X2 | No second copy of PEC files | **PASS** | exactly three PEC files in the package; `sw.js` present |
| X3 | Role checks inside the packaged app | **NOT TESTED** | packaged app not launched with real sessions |
Note: X1/X2 are for a package built here from the exact commit, not for an installed or distributed build. The scratch package was not kept or distributed.

## 5. Consolidated view for G0–G5 review
| Gate | What this run adds | Still open |
|---|---|---|
| G0 baseline | none | owner signature |
| G1 contract/policy | preview contract verified against the live function by real role sessions (permitted for View/Edit, denied without View) | owner sign-off |
| G2 server | R10 installed earlier; role gating of the preview and writers confirmed live | owner sign-off; R-1/R-2/R-3 residual-risk disposition |
| G3 client | five lenses, banner and control states behave per role on the staging preview | owner formal close; collision UX on a real draft collision NOT TESTED |
| G4 independent acceptance | Editor, View-only, No-access genuine-session results above (all PASS); PWA/Electron partially evidenced | installed PWA offline (P3–P5), packaged app sessions (X3), functional writer and on-screen collision (E6/E7); acceptance by an independent operator rather than the same owner session |
| G5 owner final release | none | ordered merge approval; Netlify/Electron release decision; #400 |
No unauthorized access was found. No FAIL was recorded. Nothing here modified production records, roles, SQL, `main`, or released anything.

## 6. Unresolved / follow-ups
1. E6/E7: functional writer and real collision display need a separately approved disposable draft fixture.
2. P3–P5 and X3: need an installed PWA device and a run of the packaged Windows app with real sessions.
3. Playwright harness not executed here; if the owner wants the exact harness artefact, run the sheet's section 2 commands in an interactive terminal.
4. Open items unchanged: #400 (read/ACL exposure and grant hardening), R-1/R-2/R-3, synthetic-only concurrency evidence, small follow-up for the unpublished `/login.html` redirect on the web build.
5. #388 not commented on (`gh` not authenticated here); this report plus its commit is the update.
