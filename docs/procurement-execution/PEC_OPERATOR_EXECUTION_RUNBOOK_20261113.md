# PEC genuine-role acceptance — single operator runbook (issue #388, Batch C)

**Status: NOT EXECUTED. Every result below is `NOT TESTED` until a human operator with their own existing authorized sessions performs it.** Claude/CI cannot sign in, never handles credentials/JWTs, never creates or edits role grants, and cannot mark any line PASS. This runbook supersedes the sequence in `PEC_PHASE_A_AUTHENTICATED_ACCEPTANCE_OPERATOR_PACKET_20261113.md` (that packet remains as background).

## 0. Who does what
| Part | Actor | Credentials |
|---|---|---|
| A build provenance (served assets) | automatic script, any machine | none (anonymous GET) |
| B harness contract self-check | automatic, CI/any machine | none |
| C three role sessions | **human operator**, one identity at a time | their own, typed only into the opened browser |
| D PWA cache freshness | human, installed PWA device | their own |
| E Windows packaged Electron | human, Windows machine | their own |
Never paste passwords, user IDs, JWTs, response bodies or business rows into a terminal, issue or this file. Record only: role category, RPC name, HTTP status, SQLSTATE, UTC time, source SHA.

## A. Verify what is deployed (automatic)
```
git fetch origin && git rev-parse origin/integration/pec-erp-staging-20261112     # record the head SHA being tested
node scripts/pec-release-provenance-check.mjs --local                              # repo hashes + SW cache name
node scripts/pec-release-provenance-check.mjs --url=https://deploy-preview-347--sasv-utilities-hub.netlify.app
```
Exit `0` = all four served files (PEC html/js/css + `/sw.js`) byte-identical to the checkout and same `CACHE_NAME`; `1` = mismatch/HTTP error (STOP, wrong or stale build); `2` = host unreachable or not allow-listed (**BLOCKED, never PASS**). The Netlify check-run on the PR must also be `success` for the same commit. Allow-list: `deploy-preview-<n>--sasv-utilities-hub.netlify.app` and `sasv-utilities-hub.netlify.app`.
Observed by this session on 13 Nov 2026: the preview host was not resolvable from the Claude cloud sandbox (BLOCKED); the production host answered but did **not** match staging (CSS 404, other hashes differ) — consistent with staging not being promoted. Re-run from the operator machine; do not reuse these observations as evidence.

## B. Self-check the harness (automatic)
```
node --check scripts/pec-phase-a-operator-browser-check.mjs
node --test scripts/pec-operator-probe-contract.test.mjs scripts/pec-real-role-negative-rpc-smoke.mjs
```
Verified by the contract test: probe argument names equal the server signatures (`proc_pec_pr_headers_paged(p_limit,p_offset)`, `proc_indent_add_line(p_indent_id,p_material_class_id,p_stock_item_id,p_uom_id,p_requested_qty,p_reason)`); a denial counts only if HTTP ≥ 400 **and** SQLSTATE `42501` / (`P0001|PGRST301` + permission wording) — "Indent not found", `PGRST202` signature drift, `23514` etc. are FAIL; no token/storage/row emission; `FAIL`→exit 1, `BLOCKED`→exit 2. Known unverifiable-from-repo item: `require_permission` is not defined in repo migrations, so its exact denial wording is checked only against the regex (`permission|access denied|not authorized`); if the live message differs the probe reports FAIL, not PASS.

## C. Role sessions (human)
Setup once (outside the repo): `npm install --prefix /tmp/pec-browser-acceptance playwright@1.62.1 && /tmp/pec-browser-acceptance/node_modules/.bin/playwright install chromium`.
Run **one identity at a time**, in an interactive terminal (the harness refuses non-TTY), signing in only inside the opened browser:
```
export PEC_PLAYWRIGHT_MODULE=/tmp/pec-browser-acceptance/node_modules/playwright
node scripts/pec-phase-a-operator-browser-check.mjs --role=editor    --url=<host verified in A>
node scripts/pec-phase-a-operator-browser-check.mjs --role=view-only --url=<host verified in A>
node scripts/pec-phase-a-operator-browser-check.mjs --role=no-access --url=<host verified in A>
```
Expected: editor – panel visible, 5 lenses, edit controls present, `A04_A08` stays NOT_TESTED (harness never writes); view-only – banner, all marked edit controls disabled, **writer probe `proc_indent_add_line(p_indent_id=0…)` denied (HTTP≥400, permission error)**; no-access – panel hidden with the permission message **and** `proc_pec_pr_headers_paged` denied. Exit codes: 0 all PASS, 1 any FAIL, 2 any BLOCKED. Copy only the printed "Safe summary" JSON into the template below.
Out of scope for the harness (separate, owner-approved fixtures only): positive Add Line on a draft manual indent; approved-indent new-line denial with a genuine Edit session (expect `23514`, verify no row side effects). Never target a real approved record; none of the 45 live headers are draft.
**Restoration:** the three identities must be existing accounts with the grants they already have. If an owner temporarily reduces an account's role to test, they restore it and record the before/after role *category* (not identity). Claude changes no grants.

## D. Installed PWA freshness (human)
On a device with the installed PWA: (1) note `CACHE_NAME` from step A; (2) online: open PEC, DevTools → Application → Cache Storage shows that cache name and PEC js/css fetched from network (status 200, not "from ServiceWorker" stale); (3) go offline: PEC still opens from cache; (4) back online + reload: new hashes match step A. Record PASS/FAIL per sub-step.

## E. Windows packaged Electron (human)
Build from the exact commit under test (`npm ci && npm run build`, **no publish**). Then on the unpacked/installed app: `npx @electron/asar extract resources\app.asar .\asar-out` and compare `Get-FileHash -Algorithm SHA256` of `asar-out\public\shared\procurement-execution-console.html`, `js\procurement-execution-console.js`, `css\sasv-procurement-execution-console.css` against the repo files (line endings normalised as in the provenance script); confirm there is no second copy of PEC files. Then repeat C's visual checks in the packaged app with a real session. The existing Linux-only `scripts/pec-electron-acceptance.mjs` proves source/served parity on a fixture stub and is **not** a substitute for this.

## F. Evidence template (fill; leave NOT TESTED if not done)
| id | check | Editor | View-only | No-access | evidence (sanitised) |
|---|---|---|---|---|---|
| F1 | served build == tested SHA (A) | NOT TESTED | NOT TESTED | NOT TESTED | sha / exit code |
| F2 | 5-lens navigation | NOT TESTED | NOT TESTED | n/a (denied) | harness JSON |
| F3 | edit controls enabled/disabled per role | NOT TESTED | NOT TESTED | n/a | harness JSON |
| F4 | direct server denial (RPC, HTTP, SQLSTATE) | n/a | NOT TESTED | NOT TESTED | status+code only |
| F5 | writer functional (draft fixture) | NOT TESTED | n/a | n/a | owner-approved fixture id |
| F6 | installed PWA freshness (D) | NOT TESTED | | | steps 1–4 |
| F7 | Windows packaged Electron (E) | NOT TESTED | NOT TESTED | NOT TESTED | hashes + visual |
Operator: role category only · UTC time · tool versions · who restored grants (if any).
