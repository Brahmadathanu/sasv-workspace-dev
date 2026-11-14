# PEC operator acceptance — test sheet (Editor · View-only · No-access)

Authority: `PEC_OPERATOR_EXECUTION_RUNBOOK_20261113.md` (this sheet adds R10 and a fill-in result column; it does not replace the runbook). Issue #388. Date prepared: 14 November 2026.
Server state under test: R10 installed in production (history 697 rows; registered 170715 / 172424 / 013211). Verified in `PEC_R10_PRODUCTION_EXECUTION_REPORT_20261114.md`.
Client build under test: Netlify deploy preview `https://deploy-preview-347--sasv-utilities-hub.netlify.app` (PR #347). Client code is unchanged since staging `a429679a`; later commits are docs/scripts only.

**Rules for the operator.** Sign in yourself, only inside the browser window the tool opens. Never paste a password, user ID, token or business data into a terminal, issue or this sheet. Record only: PASS / FAIL / BLOCKED / NOT TESTED, HTTP status, SQLSTATE, UTC time. Do not change anyone's role. Do not create, edit or approve any procurement record. If an account's role must be temporarily changed to test, the owner restores it and notes only the role *category* before and after.
Result codes: **PASS** = ran and matched expected · **FAIL** = ran and differed · **BLOCKED** = could not run (no session, wrong host, tool missing) · **NOT TESTED** = not attempted. Anything not run stays NOT TESTED.

## 0. Pin the build (automatic — anyone, no sign-in)
```
git fetch origin
git checkout --detach <staging commit being tested>      # record the full SHA here: ______________________
node scripts/pec-release-provenance-check.mjs --url=https://deploy-preview-347--sasv-utilities-hub.netlify.app
```
Expected: exit `0`, all four files `PASS` (PEC html, js, css, `/sw.js`), JSON shows `netlifyPreviewInjectionStripped: true` (fixed by #399 — the checker removes only Netlify's exact 4-line preview block, only on preview hosts, only in the HTML; any other difference still FAILs). Exit `1` = wrong/stale build → **STOP**. Exit `2` = host unreachable → BLOCKED.
Expected asset hashes (SHA-256, line endings normalised): html `fff5848fd5108d6eb9cfac1ea9faee64ba0674fb9a3ae961a88d9a59e1e071d0` · js `522f43fb84a963a2019152d99ffed1fa642eeb21f00cb16e6952f0311fba3dbb` · css `c104d4eabb5134619a4af408c34a6345499d010fee8948ae3f199652f43e4314` · sw `9b59cbc61c0702862572b0d07d0d99a40e7aaf858a1d38b07ce73ca71525377f` (`CACHE_NAME` = `hub-cache-v393`). Do not test against the production host: staging is not promoted there (provenance FAIL, expected).
Self-test the tool first: `node --test scripts/pec-operator-probe-contract.test.mjs scripts/pec-real-role-negative-rpc-smoke.mjs` → expect `pass 17, fail 0`.

## 1. One-time setup (Windows PowerShell)
```
npm install --prefix $env:TEMP\pec-browser-acceptance playwright@1.62.1
& "$env:TEMP\pec-browser-acceptance\node_modules\.bin\playwright.cmd" install chromium
$env:PEC_PLAYWRIGHT_MODULE = "$env:TEMP\pec-browser-acceptance\node_modules\playwright"
```
The three identities must be **existing** accounts with the grants they already have (3 accounts hold Edit and 2 hold View-only on the module today; the no-access account must hold no PEC grant). Run one identity at a time in an interactive terminal; the tool opens the hub, you sign in, then press Enter:
```
node scripts/pec-phase-a-operator-browser-check.mjs --role=editor    --url=https://deploy-preview-347--sasv-utilities-hub.netlify.app
node scripts/pec-phase-a-operator-browser-check.mjs --role=view-only --url=https://deploy-preview-347--sasv-utilities-hub.netlify.app
node scripts/pec-phase-a-operator-browser-check.mjs --role=no-access --url=https://deploy-preview-347--sasv-utilities-hub.netlify.app
```
Exit codes: 0 all PASS · 1 any FAIL · 2 any BLOCKED. Copy only the printed "Safe summary" JSON. (Opening the PEC page directly while signed out lands on `/login.html`, which does not exist on the web build — sign in via the hub root, as the tool does. Noted, not a blocker.)

## 2. Test grid (copy the tool's status into the Result column)
Tool ids in brackets are what the tool prints. Server probes use a nonexistent indent id (0): they cannot read or change a record.

### A. Editor
| ID | Test | Expected | Result | Evidence |
|---|---|---|---|---|
| E1 | PEC panel opens [A01_A02_module_access] | panel visible | NOT TESTED | |
| E2 | Five lenses: PR, Indents, Vendor buy-list, Action, Excess [lens_*] | all five tabs visible and activate | NOT TESTED | |
| E3 | No read-only banner [view_only_banner] | banner absent | NOT TESTED | |
| E4 | Edit controls available [A01_editor_controls] | ≥1 marked edit control located (no write attempted) | NOT TESTED | |
| E5 | R10 preview permitted [r10_preview_editor] | passes the permission gate; ends with "Indent not found" (HTTP ≥400, SQLSTATE P0001) and no data returned → tool prints PASS | NOT TESTED | HTTP / SQLSTATE |
| E6 | Functional writer (Add Line, resync, reassign) | **NOT TESTED** unless a separately approved disposable draft fixture exists; never on a real indent (none of the 48 live indents is draft) | NOT TESTED | fixture id if approved |
| E7 | On-screen collision preview for a draft with a collision | needs the same fixture | NOT TESTED | |

### B. View-only
| ID | Test | Expected | Result | Evidence |
|---|---|---|---|---|
| V1 | PEC panel opens [A01_A02_module_access] | visible | NOT TESTED | |
| V2 | Five lenses [lens_*] | all five visible | NOT TESTED | |
| V3 | Read-only banner [view_only_banner] | banner visible | NOT TESTED | |
| V4 | Edit controls disabled [A02_edit_controls] | every marked edit control disabled and `aria-disabled=true` | NOT TESTED | count |
| V5 | Writer denied [direct_rpc_permission_view-only] | `proc_indent_add_line` (id 0): HTTP ≥400, permission error ("Permission denied … edit=true", SQLSTATE P0001) — "Indent not found" or `PGRST202` is FAIL | NOT TESTED | HTTP / SQLSTATE |
| V6 | R10 preview permitted [r10_preview_view-only] | passes gate; "Indent not found" (HTTP ≥400, P0001); never a permission error | NOT TESTED | HTTP / SQLSTATE |

### C. No-access
| ID | Test | Expected | Result | Evidence |
|---|---|---|---|---|
| N1 | PEC denied [A03_no_pec_access] | main panel hidden; "You do not have permission to open Procurement Execution Console." shown | NOT TESTED | |
| N2 | Read RPC denied [direct_rpc_permission_no-access] | `proc_pec_pr_headers_paged` (limit 1): HTTP ≥400, permission denial | NOT TESTED | HTTP / SQLSTATE |
| N3 | R10 preview denied [r10_preview_no-access] | "Permission denied for module:procurement-execution-console (edit=false)", HTTP ≥400, no data | NOT TESTED | HTTP / SQLSTATE |

### D. Already recorded (not operator work)
| ID | Test | Result | Evidence |
|---|---|---|---|
| D1 | Served assets == staging build (preview) | PASS (14 Nov 2026) | checker exit 0, four files byte-identical, injection stripped |
| D2 | Anonymous call to the preview RPC | PASS | HTTP 401, SQLSTATE 42501 (see R10 execution report §5) |
| D3 | Operator harness self-tests | PASS | 17/17 |

### E. Installed PWA freshness (human, device with the installed app)
Install/refresh the PWA **from the preview host** (the production host does not carry this build).
| ID | Step | Expected | Result |
|---|---|---|---|
| P1 | Note `CACHE_NAME` | `hub-cache-v393` | NOT TESTED |
| P2 | Online: DevTools → Application → Cache Storage; PEC js/css fetched from network | cache present; status 200, not stale | NOT TESTED |
| P3 | Offline: reopen PEC | opens from cache | NOT TESTED |
| P4 | Online + reload | hashes match section 0 | NOT TESTED |

### F. Windows packaged Electron (human, Windows machine)
Build from the exact commit under test, **no publish**: `npm ci` then `npm run build`. Extract `resources\app.asar` (`npx @electron/asar extract resources\app.asar .\asar-out`) and compare `Get-FileHash -Algorithm SHA256` of the PEC html, js and css in `asar-out\public\shared` against section 0 (line endings normalised); confirm no second copy of PEC files; then repeat the role checks (E1–E5, V1–V6, N1–N3) inside the packaged app with real sessions.
| ID | Step | Expected | Result |
|---|---|---|---|
| X1 | Asar PEC html/js/css hashes | equal section 0 | NOT TESTED |
| X2 | No duplicate PEC files in the package | none | NOT TESTED |
| X3 | Role checks in packaged app | as sections A–C | NOT TESTED |

## 3. Sign-off block (operator fills)
Operator role category only: ________ · UTC date/time: ________ · tool versions (node / playwright): ________ · commit SHA tested: ________ · any temporary role change and who restored it: ________
Any FAIL on V5, V6-as-denied, N1–N3 (an unauthorised role getting access) is a **release blocker**. G0–G5 stay unsigned until the owner reviews the returned summaries. This sheet does not authorise any production write, role change, deployment, `main` merge or Electron release.
