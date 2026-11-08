# WP05-AE1 — Authenticated acceptance-evidence reconciliation (8 November 2026)

**Status: WP05 OPEN. Programme 6/13 (46.2%) unchanged. WP06 remains formally closed.** Documentation-only, repository-evidence-only reconciliation for issue #234 (WP05-AE1 handoff). It does **not** run any test, close WP05, approve scope amendment B1, or record any owner decision. Every "proposal" below is for owner/independent review and is **not approved**.

**No production interaction.** No Supabase/SQL, authenticated browser, crawler, RPC, flag, permission, migration, deployment, service-worker/cache, PWA or Electron action was performed. Method: `git` and file reading only, against `main` `68612c9af49a0ca2581001e314013f0de9e1d8e6`.

## 0. Provenance, limits and source terms

| Item | Result |
|---|---|
| Local D: evidence (`D:\claude-sessions\acceptance-out\run-20261108`, `run-selector-20261108`) | **SOURCE_NOT_ACCESSIBLE.** This session is a Linux cloud container; no D: drive exists. Those reports were **not inspected, recreated or approximated**. Every statement about them below is a *secondary repository statement* quoted from the documents named, not an observation by AE1. |
| Per-lens table of the 119-observation run | **NOT RECORDED in the repository.** Only the 14 flagged lenses (ACCEPTANCE_14_LENS_EVIDENCE_MATRIX §2), the PPM tally (WP06_IDV_NAV_GROUPS §5) and aggregate statements exist. |
| Issues #211/#220/#222/#224 | Not re-read by AE1; their content is used only as already transcribed into the repository documents cited. Issue comments are not treated as independently timed network proof. |
| Contractual lens list | `WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md` §4. |

**Contractual count check (acceptance check 1).** §4 lists CCC 4 + MCM 3 + CBM 4 + PPM 10 + CSR 6 + PRM 13 = **40 distinct rows**. All 40 ids below were matched to `costing-route-config.js` `allowedLensIds` (CCC, MCM, CBM, CSR, PRM: 30 ids) and to the ten `PRICING_POLICY_WORKSPACES` ids in WP05-A1 §3. **Mapping note (kept, not hidden):** the registry holds **32** top-level lens ids because PPM registers 2 internal loader ids (`mrp-governance`, `policy-manager`) over 10 nested workspaces (A1 §0). 40 = 30 non-PPM lenses + 10 PPM workspaces, i.e. the shared package metric, not the 32-id registry metric. Gate audit §1 uses both; neither is wrong, they must not be mixed.

### Build and source identity of each evidence set

| Evidence set | Build / cache | Identity | Source relation to current `main` |
|---|---|---|---|
| `run-20261108` (119 observations; 14-lens matrix) | `main@9661c169`, `hub-cache-v391` | ID-V (6 view / 0 edit) | **Different served source.** `git diff --name-only 9661c169 origin/main -- public` = `costing-lock-screen.js`, `costing-suite-shell.js`, `sw.js` (LOCK-P01 guard, #211/#212, v392). Asset-digest result for v391 is **NOT RECORDED** in the repository. Shell-level observations at v391 are therefore not automatically valid for v392. |
| Selector/sub-tab run (`IDV_SELECTOR_SUBTAB_ACCEPTANCE`) | `main@51cd26f3`, `hub-cache-v392`, **72/72 VERIFIED** | ID-V; permissions equal canonical extract | `git diff --name-only 51cd26f3 origin/main -- public` = empty. |
| PPM NAV_GROUPS ON/OFF run (`WP06_IDV_NAV_GROUPS_ON_OFF_ACCEPTANCE`) | `main@883a9f1c`, `hub-cache-v392`, **72/72 VERIFIED** (two HTML normalisations) | ID-V, proven | `git diff --name-only 883a9f1c origin/main -- public` = empty. |
| Readiness acceptance after build #6 (CHECKPOINT §1.2) | `main@9feffcc5`, v392 | ID-V, 1280/390 | `public/` identical to current `main`. |
| Lock Screen focused run (CHECKPOINT §1.4, PR #212) | v392 (post LOCK-P01 guard) | ID-V | as above |
| 5 Nov owner PWA checks (CCC/MCM/CBM/PPM/PRM/CSR) | PWA v390-era production; CSR retest after #178 (`756c8ccf`) | **Pre-existing Costing test account, not ID-V** (it holds 52 unrelated edit grants; package §0 rule 1 forbids it for acceptance) | Different build; owner-reported |

**Drift correction.** The WP06 ledger says `git diff --stat 51cd26f3 HEAD -- . ':!docs'` is empty. At current `main` it lists one file, `scripts/scheme-master-index-candidate/scheme-master-index-candidate.test.mjs` (+26, a test, not served). The **served** tree (`public/`) is identical from `51cd26f3`, `883a9f1c` and `9feffcc5` to `main`, so the v392 evidence still applies to current served source. Evidence from v391 does not carry that guarantee.

### Evidence-kind codes used in the ledger
- **A** = independently captured ID-V authenticated observation, repository-documented (raw report outside Git).
- **S** = SELECT-only source count by owner-side reviewer (supports interpretation; not a browser pass).
- **O** = owner-reported (no network trace/screenshot supplied to the repository).
- **L** = server log (independent, but of a non-ID-V session).
- **M** = mock/synthetic test (never counts as authenticated).
- **H** = historical result, retained, never overwritten.
- **C-D** = potentially creditable from the inaccessible D: report; **not credited here**.

Status meanings: **P** = proved by A (or A+S) for that lens at the stated build; **F** = last independently captured observation was a failure (history retained even if later recovered); **NA** = restricted by design, so neither a passed data path nor a failure; **NT** = not independently proved by evidence available to the repository; **NT / PARTIAL** = NT overall, with named sub-evidence that did pass (retained in the reason column, not counted as a lens pass). A generic aggregate such as the 119-observation run is not per-lens PASS evidence absent its per-lens record.

## 1. 40-lens P/F/NA/NT ledger

Common recorded dimensions unless a row says otherwise: ID-V rows were observed with **all `COSTING_*_V1` flags OFF** at **1280 and 390 px**, no write control observed, no mutating request delivered (network guard). Period/run is **NOT RECORDED** per lens except where stated.

### 1.1 Costing Control Center (`costing-control-center`)

| # | Lens id | Source evidence | Identity / build | Width · flags · period/run | Status | Reason | Unresolved |
|---|---|---|---|---|---|---|---|
| 1 | `dashboard` | O: AUTHENTICATED_PWA_SIX_MODULE (5 Nov): Nov draft run 149, 121/628 ready, 506 review, 1 blocked | non-ID-V test account; v390-era | width NOT RECORDED · OFF · Nov 2026 run 149 | **NT** | Only owner-reported functional load on a non-ID-V account. C-D: D: report may hold an ID-V v391 observation. | S9 KPI ↔ SKU Control parity after period switch; ID-V observation |
| 2 | `costing-review-workbench` | O: same (5 Nov, "reportedly loaded") | non-ID-V | as above | **NT** | Owner-reported only. | ID-V observation; C-D |
| 3 | `sku-control-status` | O: same (5 Nov) | non-ID-V | as above | **NT** | Owner-reported only. | ID-V observation; S9; C-D |
| 4 | `portfolio-readiness` | A/H: 14-lens matrix row 1 (v391: `READINESS_BUILD_ABSENT`, HTTP 400 by server design, runner "render FAIL" = harness class, not defect). A: CHECKPOINT §1.2 after owner-authorised build #6 | ID-V; v391 then `9feffcc5`/v392 | 1280+390 · OFF · Nov 2026 governed period, valuation 2 Nov, run 149 | **P** (current) | Later hosted ID-V pass: no `READINESS_BUILD_ABSENT`, 0 errors, no unauthorised writes; S: READY 121 / REVIEW_REQUIRED 479 / BLOCKER 3 / UNKNOWN 0 = 603. **Historical absence result is retained, not overwritten.** | Raw v392 report not in Git (CHECKPOINT prose only); Oct-2026 picker check not recorded |

### 1.2 Material Cost Manager (`material-cost-manager`)

| # | Lens id | Source evidence | Identity / build | Width · flags · period | Status | Reason | Unresolved |
|---|---|---|---|---|---|---|---|
| 5 | `manual-rate-manager` | O: 5 Nov (loaded); A: default lens exercised in `run-20261108` (14-lens matrix §3: period picker disabled by design) | non-ID-V / ID-V v391 | OFF · not period-scoped | **NT** | Per-lens result not in Git. C-D. | ID-V per-lens observation |
| 6 | `rm-cost-trace` | A: matrix row 2: restriction notice, no trace RPC | ID-V v391 | 1280+390 · OFF · Nov 2026 | **NA** | Restriction is the correct ID-V result (`role:material-cost-rm-trace` absent). Not a data-path pass, not a failure. | Data path needs an owner-approved identity holding the role (NOT TESTABLE as ID-V) |
| 7 | `pm-cost-trace` | A: matrix row 3 (same gate) | as row 6 | as row 6 | **NA** | as row 6 | as row 6 |

### 1.3 Cost Build Manager (`cost-build-manager`)

| # | Lens id | Source evidence | Identity / build | Width · flags · period | Status | Reason | Unresolved |
|---|---|---|---|---|---|---|---|
| 8 | `cost-governance` | O: 5 Nov ("tables loaded"); period switch skipped by design (matrix §3) | non-ID-V / v391 | OFF | **NT** | Default-lens result not in Git. C-D. | ID-V observation; pool-summary period switch |
| 9 | `staff-governance` | A: selector run rows 1–3 (default queue 0 rows; register 164; pool summary 7 rows); S: 0 / 164 / 42 | ID-V `51cd26f3`/v392, 72/72 | 1280+390 · OFF · default context 2026-11-01 | **NT / PARTIAL** (review R1) | Sub-tabs independently passed: default review queue 0 rows (S: 0) and classification register 164 rows (S: 164). **Staff pool summary: PASS for rendering only, UNRESOLVED** (selector report row 3 / §2A): 7 UI rows vs 42 source rows. Not counted as a fully accepted lens. No cause (pagination, period, filter or other) is inferred. | Bounded period/filter/source-count reconciliation of the pool summary |
| 10 | `manual-provisions` | A: selector rows 4–6, 8 (Nov 0, Oct 0, Jul 1, monthly impact 7); S: Nov/Oct 0, Jun 1, Jul 1 | as row 9 | 1280+390 · OFF · Nov/Oct/Jul 2026 | **P** | Observations match source. | June 2026 absent from the picker (NOT TESTABLE); whether intended is unasked |
| 11 | `driver-governance` | none specific (generic O: "tables loaded") | — | — | **NT** | No lens-specific evidence in Git. C-D. | ID-V observation |

### 1.4 Pricing Policy Manager (`pricing-policy-manager`, 10 workspaces)

OFF credited from `run-20261108` (v391) and selector run (v392) as stated in WP06_IDV_NAV_GROUPS §5 (secondary statement; C-D for raw). ON from `883a9f1c`/v392, 1280+390, `COSTING_NAV_GROUPS_V1="1"` browser-local only. Periods: not period-scoped except `commercial-sales-assumptions`.

| # | Workspace id | Source evidence | Width · flags | Status | Reason | Unresolved |
|---|---|---|---|---|---|---|
| 12 | `sku-overview` | A: OFF credited; ON 20/20 set, deep link active | 1280+390 · OFF and NAV_GROUPS ON | **P** | OFF raw is second-hand credit. | — |
| 13 | `sku-mrp-policies` | A: as above | as above | **P** | — | — |
| 14 | `product-derivation-policies` | A | as above | **P** | — | — |
| 15 | `mrp-proposals` | A (1 row in run) | as above | **P** | — | — |
| 16 | `proposal-decisions` | A + S (empty; register 1 APPLIED; default filter = "Pending decisions" only) | as above | **P** | Empty is benign and source-confirmed. | — |
| 17 | `approved-for-application` | A + S (empty; consistent) | as above | **P** | as row 16 | — |
| 18 | `applied-proposal-history` | A (1 row) | as above | **P** | — | — |
| 19 | `scheme-master` | H/A: 1280 px **FAIL** OFF (v391, 2 console errors, 0 rows) and ON (v392, HTTP 500 / `57014`, 0 rows); 390 px P (7 rows). O: after covering index (valid/ready 1624 kB) owner saw 7 schemes + 3/3 desktop refresh PASS | 1280 **F**, 390 P · OFF and ON | **F** (historical, retained) | **Never overwritten.** Owner-reported recovery (7 schemes + 3/3 desktop refresh, post-index) is a separate, non-captured entry; there is **no independently timed ID-V recovery claim for WP05**: no timed network trace; **no causal index speed gain claimed.** Issue #224 stays OPEN / MONITOR. | Representative time-stamped traces if recurrence is to be excluded |
| 20 | `scheme-rule-register` | A + S (0 rows; live count 0) | as above | **P** | Expected-empty, confirmed. | — |
| 21 | `commercial-sales-assumptions` | A: Nov→Oct period switch via Filters drawer, 628 rows, no error; O: Revise COMPANY/REGIONAL IK/OK open/cancel **4/4 PASS** | as above · Oct/Nov 2026 | **P** | Data/period captured; the modal check is owner-reported only (WP06 ledger: modals NT in capture). | Captured (non-owner) modal observation |

### 1.5 Cost Sheet Review (`cost-sheet-review`)

| # | Lens id | Source evidence | Identity / build | Status | Reason | Unresolved |
|---|---|---|---|---|---|---|
| 22 | `sku-cost-sheet` (SKU Cost Details) | O: 5 Nov "tables reportedly loaded" | non-ID-V | **NT** | Owner-reported; C-D. | S2 3-SKU parity |
| 23 | `printable-cost-sheet` | L/H: 2026-11-05 04:50:16 UTC `v_costing_pricing_printable_cost_sheet_product_summary` HTTP 500 / `57014`. O: after `ANALYZE` maintenance, Nov product-summary read **PASS** (functional, not timed) | non-ID-V PWA | **F** (historical, retained) | Owner recovery is a separate entry: no HTTP codes, timings, screenshots or trace supplied; no latency claim. | ID-V captured read; S2; 390 px component-column check |
| 24 | `cost-comparison` | L/H: 2026-11-05 04:59:50 UTC `v_cost_sheet_snapshot_sku_monthly_comparison_governed` HTTP 500 / `57014`. O: Nov and Oct monthly comparison **PASS** | non-ID-V PWA | **F** (historical, retained) | as row 23 | ID-V captured read |
| 25 | `scheme-comparison` | none | — | **NT** | No lens-specific evidence. C-D. | ID-V observation |
| 26 | `qc-action-queue` | none | — | **NT** | as row 25 | ID-V observation |
| 27 | `materials-stores-action-queue` | none | — | **NT** | as row 25 | ID-V observation |

### 1.6 Production Route Manager (`production-route-manager`, 13 lenses)

PRM has no period-scoped lens; the period-switch skips are "not applicable by design" (matrix §3). Exact-run lenses use the fixed historical run 80/82 fixtures (C5/D5).

| # | Lens id | Source evidence | Identity / build | Status | Reason | Unresolved |
|---|---|---|---|---|---|---|
| 28 | `route-readiness` | A: selector row 12 (592 products, detail panel, history reads) | ID-V `51cd26f3`/v392 | **P** | Read-only handoff observed; no action buttons used. | — |
| 29 | `product-route-assignments` | none specific | — | **NT** | C-D. | ID-V observation |
| 30 | `product-subgroup-mappings` | none specific | — | **NT** | C-D. | ID-V observation |
| 31 | `shared-workload-preview` | none specific | — | **NT** | C-D. Preview-named lens: confirm read-only RPC set before any test. | RPC classification |
| 32 | `route-families` | none specific | — | **NT** | C-D. | ID-V observation |
| 33 | `route-family-mapping-review` | A: matrix row 9 (explicit zeros; Frozen Run 82, Aug 2026) | ID-V v391 | **NT** | Rendered without error but empty display not confirmed against source; fixed run 80/82 context only (C5/D5). | Exact-run RPC confirmation by owner |
| 34 | `route-family-foundation-review` | A: matrix row 10 | ID-V v391 | **NT** | as row 33 | as row 33 |
| 35 | `production-cost-centres` | H/O: 5 Nov owner screenshot "Unknown RPC error" (client defect, `governed` on read RPCs). Fix #178 `756c8ccf`; O: owner Cost Centres screen test **PASS** | non-ID-V PWA | **F** (historical, retained) | Recovery is owner-reported with no trace/screenshot; not an ID-V or denial test. | ID-V list+detail observation at v392 |
| 36 | `route-family-route-editor` | A: selector row 11 (88 families, history, approved route detail 10 steps) | ID-V `51cd26f3`/v392 | **NT / PARTIAL** (review R2) | Nested evidence: **read-only history/detail PASS** (family selection loaded history via `rpc_get_route_family_route_history`; route detail with 10 steps via `rpc_get_route_family_route_detail`). **Finding F1 remains blocked/unaudited:** clicking "Open current approved route" attempted `rpc_preview_route_family_route_steps`, aborted by the request guard at both widths before reaching the backend; its side effects have not been audited. Recorded as "completed with 1 blocked non-read attempt", not a clean complete acceptance. | Independent audit of that RPC body. It must never be allow-listed or invoked on production to obtain a pass |
| 37 | `product-route-editor` | A: selector row 12 PARTIAL (handoff worked; no Product-specific version for sampled product) | ID-V v392 | **NT** | Opening an existing Product-specific version not reached. | Product with a version |
| 38 | `historical-candidate-review` | S: three `rpc_preview_*` functions VOLATILE SECURITY DEFINER; not in read-only allow-list | — | **NT** | Not testable under read-only rules until bodies are independently audited. | Owner-approved no-side-effect plan |
| 39 | `effective-route-viewer` | A: selector row 13 (593 options, 8-row route, histories) | ID-V v392 | **P** | — | — |
| 40 | `archived-routes` | none specific | — | **NT** | C-D. | ID-V observation |

### 1.7 Per-module totals (row count verified = 40)

| Module | Rows | P | F | NA | NT | of NT: C-D (may be creditable) | of NT: genuinely missing/blocked |
|---|---:|---:|---:|---:|---:|---:|---:|
| Costing Control Center | 4 | 1 | 0 | 0 | 3 | 3 | 0 |
| Material Cost Manager | 3 | 0 | 0 | 2 | 1 | 1 | 0 |
| Cost Build Manager | 4 | 1 | 0 | 0 | 3 | 2 | 1 |
| Pricing Policy Manager | 10 | 9 | 1 | 0 | 0 | 0 | 0 |
| Cost Sheet Review | 6 | 0 | 2 | 0 | 4 | 4 | 0 |
| Production Route Manager | 13 | 2 | 1 | 0 | 10 | 5 | 5 |
| **Total** | **40** | **13** | **4** | **2** | **21** | **15** | **6** |

Of the 4 F: all are **historical failures with owner-reported (non-captured) recovery**: `scheme-master`, `printable-cost-sheet`, `cost-comparison`, `production-cost-centres`. None has an independently captured later pass. The 6 genuinely missing/blocked NT rows are the four original ones (`product-route-editor`, `historical-candidate-review`, `route-family-mapping-review`, `route-family-foundation-review`) plus `staff-governance` (pool-summary reconciliation) and `route-family-route-editor` (F1 unaudited). Revised from 15 P / 4 F / 2 NA / 19 NT after review R1–R3; 15 + 6 = 21 NT; 13 + 4 + 2 + 21 = 40. Of the 13 P: all rest on captured ID-V evidence as transcribed in repository documents (the PPM OFF observations are second-hand credit via the WP06 ON/OFF record); `commercial-sales-assumptions` additionally carries an owner-only modal check. **C-D count is an upper bound of what the inaccessible report might credit, not a claim that it does.**

## 2. Eleven-flag matrix

Flags (package §3): `COSTING_RECALC_WITH_DATE_V1`, `COSTING_APPROVAL_SCREEN_V1`, `COSTING_LOCK_SCREEN_V1`, `COSTING_RUN_STATUS_V1`, `COSTING_UX_CONSISTENCY_V1`, `COSTING_DIALOGS_V1`, `COSTING_TABLE_TOOLS_V1`, `COSTING_REVIEW_WORKLIST_V1`, `COSTING_NAV_GROUPS_V1`, `COSTING_PRM_CORRECTIONS_V1`, `COSTING_PRM_NAV_CONTEXT_V1`. All are default OFF in production; none was activated globally.

| # | Flag | Authenticated ID-V ON evidence (proven scope only) | Mock evidence (M) | OFF / restoration evidence | Missing |
|---|---|---|---|---|---|
| 1 | `RECALC_WITH_DATE_V1` | none | 13-state sweep (4 Nov, 78 loads, inert backend) | OFF state observed incidentally | ON × all six modules; control presence/absence (never press) |
| 2 | `APPROVAL_SCREEN_V1` | none | sweep; SEC-A2 client parity merged | OFF as above | ON signed-in, all modules; server denial (SEC-A2) |
| 3 | `LOCK_SCREEN_V1` | **One focused ID-V hosted run**, 1280+390, v392, flag locally ON, no exposed lock controls, no writes (CHECKPOINT §1.4; PR #212). Prior finding LOCK-P01 (enabled "Close quarter" for view-only) is fixed in #212 and retained as history | sweep | Production OFF; **local restoration of this override NOT RECORDED** | Modules other than the one run (not recorded which); restoration evidence; server-side denial NT |
| 4 | `RUN_STATUS_V1` | none | sweep | OFF as above | ON signed-in |
| 5 | `UX_CONSISTENCY_V1` | none | sweep | OFF as above | ON signed-in |
| 6 | `DIALOGS_V1` | none | sweep | OFF as above | ON signed-in |
| 7 | `TABLE_TOOLS_V1` | none | sweep | OFF as above | ON signed-in |
| 8 | `REVIEW_WORKLIST_V1` | none (combination (c), CCC SKU Control Status, not run) | sweep + worklist suites | OFF as above | (c) ON alone on CCC; S9 interplay |
| 9 | `NAV_GROUPS_V1` | **PPM only** (`883a9f1c`/v392): 10 deep links × 2 widths = 20/20; legacy/default 6/6; five groups/4 separators/10 tabs; OFF = 3 groups/2 separators; scheme-master @1280 ON **F** (retained) | sweep (all six modules, grouped markup) | **Restoration verified** (fresh no-flag context legacy layout; session file byte-identical, no `COSTING_*_V1` key) | ON in CCC, MCM, CBM, CSR, PRM (flag changes their grouped markup) |
| 10 | `PRM_CORRECTIONS_V1` | none | sweep + `costing-prm-*` suites | OFF as above | ON signed-in (PRM) |
| 11 | `PRM_NAV_CONTEXT_V1` | none | sweep | OFF as above | ON signed-in (PRM) |

Combination status against package §3: **(a) all OFF** — evidenced ID-V six modules (v391 run; v392 selector run flags cleared); **(b) NAV_GROUPS alone** — PPM only (1 of 6 modules); **(c) REVIEW_WORKLIST alone** — NT; **(d) all eleven ON** — NT; **each remaining flag alone** — NT. No all-eleven OFF restoration screenshot is recorded. Credited at proven scope only: 20/20 PPM links, 6/6 legacy, 72/72 build assets (twice, `51cd26f3` and `883a9f1c`), ID-V 6 view/0 edit, Lock Screen one run. **It is not inferred that eleven flags were tested: 1 flag has meaningful authenticated ON evidence at one module (NAV_GROUPS/PPM), 1 at one run (LOCK_SCREEN), 9 have none.** "Hosted ID-V run observed with all flags OFF" is not ON evidence.

## 3. Historical failures and recoveries (kept separate)

| Record | Historical result | Later result | Kind of later evidence | Not claimed |
|---|---|---|---|---|
| Scheme Master 1280 | HTTP 500 / `57014` (OFF v391; ON v392); 390 px 7 rows | Index (valid/ready 1624 kB) then owner: 7 schemes + 3/3 refresh PASS | O, no timed capture | Causal index speed gain; permanent resolution (#224 MONITOR) |
| Printable Cost Sheet summary, monthly comparison | `57014` at 2026-11-05 04:50:16 / 04:59:50 UTC | Owner: Nov summary, Nov and Oct comparison PASS after `ANALYZE` | O (functional) | Latency reduction; ID-V replay |
| PRM Cost Centres | "Unknown RPC error" | Owner PASS after #178 | O | Server write-denial proof |
| Readiness Nov | `READINESS_BUILD_ABSENT` (data dependency) | Build #6, hosted ID-V pass | A | Any change to the run-150 failure (never selected) |
| `rpc_preview_route_family_route_steps` | Guard-aborted non-read call (F1) | — | — | Cleared; still unaudited |
| Auth `POST /auth/v1/token` HTTP 400 | Test-session refresh-token replay (F2) | — | — | Application defect; classified test limitation |

## 4. Delta-only action list (smallest missing proof; nothing here is authorised)

**Untested evidence (needs a separately approved brief — AE1 does not start them):**
1. **UI-read batch (ID-V, v392, no write controls):** only the **6 genuinely missing/blocked** lenses need new design (`product-route-editor` version open, `historical-candidate-review`, `route-family-mapping-review` / `route-family-foundation-review` exact-run confirmation, `staff-governance` pool-summary 7-vs-42 reconciliation, `route-family-route-editor` after the F1 RPC audit). Before any browser time, **owner copy of the D: per-lens table** could credit up to 15 NT rows for free; retrieve it first.
2. **Remaining ID-V reads without prior evidence if D: yields nothing:** the 15 C-D rows, one supervised pass at 1280/390.
3. **S2:** printable Cost Sheet ↔ SKU Cost Details for three real SKUs (READY, REVIEW, BLOCKED) — same run, loaded cost, status. Record actual values, not remembered ones. 5 Nov dashboard values (121/628 ready, 506 review, 1 blocked) and the 603-SKU operational readiness split (121/479/3) are **different surfaces and are not a parity result**.
4. **S9:** CCC dashboard KPI ↔ SKU Control Status after Nov↔Oct switch; confirm the run pointer is not failed run 150. *Terminology note:* WP05-A5 lists "S9" as KPI-strip reload performance; the gate audit/package use "S9" for KPI parity. AE1 follows the gate audit.
5. **Server denial / negative identity:** ID-N, ID-X, ID-O and SEC-A1/SEC-A2 server denial — no approved no-side-effect plan exists; no writer RPC may be called on production.
6. Flag combinations (b)–(d) beyond PPM; LOCK_SCREEN restoration record.
7. Open reconciliations: staff pool summary 7 vs 42; June provision data not reachable in picker; F1 RPC audit; the three `rpc_preview_*` bodies.

**Policy choices, not missing tests (owner):** C5/D5 selector for fixed runs 80/82 (status quo = labelled fixtures, no selector); D3; C6/O-8; O-2 server registry; CDE-2 dependency; whether to seek B1.

**WP06 A1 did not transfer any WP05 obligation.** Package §10 limits A1 to WP06 and states the 40-lens/11-flag/negative-identity/server-denial duties remain for WP05/WP12.

## 5. Proposed owner decision sheet (PROPOSAL ONLY — nothing approved)

### 5.1 Option 1 — Complete original §8 for WP05
Fill the gaps in §1–§2 (40 rows, 11 flags, S2/S9, negative identities, SEC denial, flag restoration). Cost: largest; cross-module risk is that every signed-in session is a production read and flag combinations multiply sessions.

### 5.2 Option 2 — Possible WP05 amendment **B1** (not requested, not approved)
A WP05-specific amendment would have to name transferred WP12 integration items exactly. Plausible candidates (for the owner to accept or reject):

| Could plausibly be named as WP12 integration items | Must stay WP05-specific (authority / read-only integrity) |
|---|---|
| Eleven-flag combinations (b) (c) (d) and per-flag ON across all six modules | Authority and role semantics: D3 CCC-edit vs MCM-edit; C6/O-8 route disposition; O-2 server registry |
| Cross-module ON/OFF navigation for CCC, MCM, CBM, CSR, PRM | Negative identities ID-N/ID-X/ID-O and SEC-A1/SEC-A2 server denial, with a no-side-effect plan |
| Remaining per-lens reads that only repeat render/width/overflow checks | Read-only integrity: zero mutating requests; F1 `rpc_preview_route_family_route_steps` audit; the three `rpc_preview_*` bodies |
| A14 Windows installer (already WP12 only) | S2 and S9 real-data parity (or explicit owner risk deferral with named milestone) |
| Final-head full regression | C5/D5 fixed-run labelling disposition |

**Cross-module dependency/risk if B1 is considered:** moving flag combinations to WP12 leaves WP05 unable to show that no flag changes authority UI; LOCK_SCREEN already exposed such a defect (LOCK-P01) which only a signed-in ID-V run found. CDE-2 (SQL unapplied, adapter unconnected) touches the REVIEW_WORKLIST surface that S9 reads. The scheme-master and CSR `57014` histories show data-volume-dependent reads that can recur and would then appear inside WP12 rather than WP05.

### 5.3 Dispositions awaiting the owner
D3 least-privilege semantics · C6/O-8 route · C5/D5 fixed run 80/82 · S2/S9 test or defer · SEC-A1/A2 server denial and negative-identity plan · acceptance of the v392 evidence baseline for WP05 (W5-03 PARTIAL) · parked risks (#224 monitoring, LOCK-P01 history, CDE-2) · final WP05 Gate Status (separate owner act).

## 6. Statement

AE1 is a reconciliation only. WP05 remains **OPEN**; programme remains **6/13**; no owner approval, B1 amendment, WP05 sign-off or progress increment is recorded or implied. No local evidence file was read, modified or deleted. No database, code, flag, permission, deployment, cache or Electron change was made.

**Addendum (2026-11-08, AE2):** a separate, UNAPPROVED proposal for crediting the 15 C-D rows from the local D: report is in `WP05_AE2_LOCAL_EVIDENCE_CREDIT_PROPOSAL_2026-11-08.md`. The AE1 facts and the 13/4/2/21 counts above are unchanged and remain authoritative; the proposal's `RD-v391/OFF` label is limited render/data-presence sub-evidence, not full P. That document's section 3 also records newly found, historically limited v391 NAV_ONLY, ALL_ON and WORKLIST_ONLY observations (default lenses only, including the LOCK-P01 failure at v391) that supplement, and do not supersede, the v392 flag matrix in section 2; `flags_restored=true` there is run-wide only, with no separate restoration screenshot.
