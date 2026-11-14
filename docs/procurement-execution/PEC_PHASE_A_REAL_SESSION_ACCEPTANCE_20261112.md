# PEC Phase A — Real-session acceptance worksheet (12 November 2026)

**Status:** READY FOR GENUINE OPERATOR EXECUTION; no case marked PASS until recorded by an actual signed-in operator. Owner approved phased release **scope only**. Candidate draft PR #347 is not deployed/merged by this document.

## Preflight (read-only verification)

- Candidate source: the exact integrated review branch `integration/pec-erp-staging-20261112`, PR #347; latest successful full 8/8 GitHub run on code-equivalent/preceding documentation head `26629c98`; freeze final candidate SHA and repeat before owner promotion.
- Live `public.user_permissions_canonical` aggregate for target `module:procurement-execution-console`: **3 editor grants, 2 view-only grants** at time of audit; no user IDs or identifying attributes included. This means editor and view-only category coverage is possible *without permission changes*, but does **not** prove the accounts are available to authenticate or that the candidate UI is already deployed.
- Ten expected read paging RPCs: 10/10 present with PEC module guard, authenticated EXECUTE and anon denied (read-only pg_proc inspection). **0/10** existing PEC migration versions registered in official history; owner-controlled reconciliation remains separate.
- This worksheet does not authorize modifying approved indents, financial/procurement records or resetting unrelated users' permissions.

## Operator acceptance matrix

Record **actual account role category, date/time, tested URL/build SHA, steps/screenshots or console evidence, result and issue reference**. Do not store passwords, JWTs, secret tokens or personal identifiers. Test only a disposable draft explicitly approved for modifications; no approved/issued/closed indent may be changed.

| ID | Session / surface | Minimum procedure and expected result | State |
|---|---|---|---|
| A01 | PEC Editor, hosted signed-in PWA | Five lenses visible and open; permitted controls enabled | NOT RUN |
| A02 | PEC View-only, hosted signed-in PWA | Five lenses visible; editor actions unavailable; direct unauthorized write attempts rejected by server | NOT RUN |
| A03 | Genuine signed-in account **without PEC View** | PEC navigation/access denied; no sensitive data or RPC rows exposed | NOT RUN |
| A04 | PEC Editor | PR filter/search/next page/total count and no stale response | NOT RUN |
| A05 | PEC Editor | Indents paging; canonical indent line number unchanged after filter/search; Jump to Indent resolves beyond page 1 | NOT RUN |
| A06 | PEC Editor | Vendor-wise operational options from all filtered rows; vendor:ID and unassigned bucket behavior; immediate vendor-selection workflow on approved safe draft fixture | NOT RUN |
| A07 | PEC Editor | Excess date/filter/page/total and Audit list behavior; sample rows compared with authoritative live read | NOT RUN |
| A08 | PEC Editor | Full Vendor-wise export with over-1000 items or stable equivalent fixture; no duplicates/missing identities, no total drift, PDF page continuity | NOT RUN |
| A09 | PEC Editor, installed PWA | Online canonical JS/CSS update received after deploy; offline previously cached content remains usable; reconnect gets fresh sources | NOT RUN |
| A10 | Packaged Electron | Same canonical PEC HTML/JS/CSS, five-lens navigation, narrow window layout, export and authorised reads | NOT RUN |
| A11 | Performance | Record server/network timings on representative Excess + Vendor-wise paged queries and full export; no claim without measured results | NOT RUN |
| A12 | Release gate | Exact green CI SHA, correct branch PR order, history-only repair separately authorized, postdeploy smoke, owner acceptance | NOT RUN |

## Evidence entry template (copy only when actually tested)

`ID | role category | date/time IST | preview/production URL or packaged Electron build | code SHA | exact step and fixture | expected | actual | PASS/FAIL/BLOCKED | evidence/issue`

## Fastest execution sequence

1. Technical maintainer: finalize source/branch-review and current 8/8 CI; do **not** replay already-applied PEC SQL.
2. Actual authenticated operators: Editor and View-only hosted PWA tests (A01–A08), then no-PEC access (A03). Do not simulate role claims with SQL `SET ROLE`; that is not a genuine JWT acceptance.
3. Install/refresh PWA and packaged Electron source parity (A09–A10), record real latency (A11).
4. Owner gives distinct SQL migration-history repair approval **after** preflight, and distinct source merge/production deployment approval **after** acceptance. Mark G0–G5 only when gate exits are proven.

**No change to formal G0–G5 count: 0/6 independently verified.** Phase B original manual draft-indent edit #356 and separate hybrid policy #305 remain outside Phase A.

## Phase A fast-progress ledger — 12 Nov, refreshed

**Technical preflight 4/5 checks verified (not 4/6 programme gates):**
1. **PASS** — consolidated PR #347 at `5012fb464e8687d5f99d8ef1d72e5d6540a1fa4d` **8/8 GitHub CI completed SUCCESS**, including integrated browser + FG-BIT; source remains draft/unmerged.
2. **PASS** — GitHub reports PR #347 **mergeable=true**. Main-side divergence inspected: 19 changed paths, all `docs/master-data-costing/WP05_*` documents, not PEC functional source; re-evaluate if main changes.
3. **PASS** — read-only live Supabase check found all **10/10** expected G1 paging functions; preceding metadata audit confirmed PEC module guard, authenticated EXECUTE, anonymous denial.
4. **PASS** — read-only permission aggregate: **3 PEC Editor grants / 2 PEC View-only grants**. This proves only eligible role grants exist; no authenticated PWA test is implied.
5. **BLOCKED — owner-governed** — all **10/10** already-live PEC migration versions remain missing from Supabase official migration history. Official CLI **history-only** repair requires separate owner authorization and a frozen-source/live parity preflight; do not replay SQL or insert into history manually.

**Outside the 4/5 technical preflight:** Actual signed-in A01–A12 acceptance remains NOT RUN; installed PWA, packaged Electron and measured Excess latency still NOT VERIFIED. Owner production merge/deploy decision also pending. Formal G0–G5 remains **0/6 closed**. Do not present this as 80% released; it is only 4 of 5 named technical preflight observations.

**Preview verification limit:** An unauthenticated external browser fetch could not access the Netlify deploy-preview URL from the available browsing environment, so no hosted preview or session claim was recorded. Existing CI/Netlify success is separate from an authenticated browser acceptance.

**Operator order to unblock immediately:** genuine Editor signed-in A01/A04–A08, existing View-only A02, genuine no-access A03, installed PWA A09, Electron A10, live latency A11. Capture role category, build SHA, screenshot/console evidence and actual PASS/FAIL in the table above. New accounts or permission mutations are not needed for the first two role categories.

## 12 Nov — Live read-only SQL performance sampling (A11 database subcheck ONLY)

Using connected Supabase `execute_sql` on project `qhmoqtxpeasamtlxaoak`, executed **read-only transactions** with `SET LOCAL statement_timeout='7000ms'` and `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` or `EXPLAIN (ANALYZE, FORMAT JSON)`. No DML, refresh, RPC impersonation, role permission change, schema write or background job triggered. Database executor measurements from one sample each:

| Query shape | Observed database execution | Interpretation |
|---|---:|---|
| `v_proc_purchase_excess_console` filtered to last 30 days, `count(*) OVER`, net-unallocated/date/ID ordering, `LIMIT 100 OFFSET 0` | **~1,236 ms** plan actual total; returned 100 rows from 177 filtered rows | Dominant view computation; no client/network time included |
| Direct `proc_vendorwise_buylist_filtered_pec_internal(NULL,NULL,NULL,NULL,NULL)` `LIMIT 100` | **~306 ms** execution | Baseline source-function scan; not full operational RPC |
| Full Vendor-wise operational paging-equivalent query (`count(*) OVER`, canonical bucket sort and `LIMIT 100`) | **~141 ms** execution; 834 source rows counted, 100 returned | Closely mirrors live `proc_vendorwise_buylist_operational_paged` query body but bypasses JWT/permission wrapper |

**A11 remains NOT RUN / not closed** as an end-to-end hosted PWA measurement: no real user JWT or browser network response was measured, no warm/cold distribution or p95, and the full export remains a separate acceptance case. The difference between 306 ms and 141 ms should **not** be interpreted as a proven speed improvement (separate runs and cache conditions). 30-day Excess execution around 1.24 seconds merits real browser timing; no arbitrary pass threshold assumed. The 4/5 technical preflight indicator and formal G0–G5 **0/6** remain unchanged.

## 12 Nov — Exact committed read-only pagination verifier executed live

Added `scripts/pec-phase-a-readonly-paging-data-parity.sql` (commit `5b012526`) to make the data-level verification reproducible. Executed the exact file content through connected Supabase against live project `qhmoqtxpeasamtlxaoak`: `BEGIN TRANSACTION READ ONLY`, `SET LOCAL statement_timeout='12000ms'`, four lens identity/paging CTEs, `COMMIT`. **PASS**: PR 7 total / 7 first page / 0 second / 0 duplicate IDs; Indents 45 / 45 / 0 / 0; Excess last 30 days 177 / 100 / 77 / 0; Vendor-wise 834 / 100 / 100 / 0 operational composite-key duplicates, **68 distinct operational filter groups**. Independent Vendor-wise group split: **536 actual-vendor / 199 unassigned / 99 local-purchase**, all 834 assigned to a group, no null operational filters.

These checks are meaningful *source-data parity and paging identities only*. The SQL uses an administrative read context, not a signed-in PEC JWT. It does **not** invoke `SECURITY DEFINER` paging RPC under actual roles, verify export document content or prove rowset snapshot consistency under concurrent mutations. Do not advance A01–A12 or G0–G5 on this alone. Phase A technical preflight remains **4/5** (last item is official owner-authorized history-only repair); formal release gates remain **0/6**.

## 12 Nov — interactive genuine-session browser probe (no credentials transferred)

The integration branch now includes `scripts/pec-phase-a-operator-browser-check.mjs` (source commit `2da94a8c`). This is an **opt-in, local, headed Playwright probe**. A legitimate PEC Editor, View-only or no-PEC operator opens the approved Netlify preview in the visible temporary browser window, signs in **personally**, then presses Enter in the same terminal. The probe checks PEC panel accessibility, five tab navigation, the view-only banner, and disabled marked edit controls; records only role category, host, test outcome and RPC endpoint/status counts. It **never** clicks write/export controls, sends no request tokens to ChatGPT, saves no session/profile/screenshots, accesses no browser storage, and creates no business record. For security, it permits only the known PEC Netlify preview/production HTTPS hosts. It cannot assert A04–A08 export/completeness or genuine RPC write denial: those remain supervised/operator checks.

**Example on a trusted development desktop with a local repo checkout and Node 22** (do not paste any credentials into terminal):
```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
node scripts/pec-phase-a-operator-browser-check.mjs --role=view-only --url=https://deploy-preview-347--sasv-utilities-hub.netlify.app
```
Repeat in an independent fresh browser context for `--role=editor` and `--role=no-access` using the account appropriate to each role. This setup may modify the local checkout's ignored `node_modules` or package lock metadata, so use a disposable checkout or isolated dependencies; it **does not mutate the repo branch or Supabase**. Avoid saving console output containing any business identifiers; by design the probe does not print them. The script is syntactically validated by the PEC integrated CI workflow (`node --check`), but **real login/role tests must be performed by the operator and recorded separately**. A role test completed by this harness is partial UI evidence, never permission server-proof or full A01–A12 signoff.

**Execution owner:** a real credentialed operator on the candidate deployment. **Current state: NOT EXECUTED**; no user session is available through the connected tools and this agent cannot perform hosted sign-in without an interactive supported browser.


## 12 Nov — Claude client visual/Electron fixture evidence (does NOT change any row above)
See `PEC_PHASE_A_CLAUDE_VISUAL_ACCEPTANCE_20261112.md`: 124/124 fixture visual checks at 320/390/820/1440 px; four narrow-screen client defects fixed (draft PR into the integration branch); packaged **Linux** Electron 36.8.1 byte-parity and fixture run 33 PASS / 0 FAIL. **A01–A09, A11, A12 remain NOT RUN; A10 remains open for Windows and for real accounts.** The genuine-session probe was not run (no personally signed-in operator session was available to the assistant).
