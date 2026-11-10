# WP05 — Overnight reconciliation, offline verification and daytime PC acceptance pack (10/11 November 2026)

**Status: DECISION-READY RECONCILIATION — NOT WP05 CLOSURE, NO GATE PROMOTED.** Prepared for issue [#267](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/267) (owner overnight bulk directive) from repository evidence only. Base `main` = `85eae297d668915aee68e1da4709f767e7d9a04d` (PR #266 merge; contains #263 `cf41740e` and #265 `ff2e79bb`). **WP05 OPEN; formal programme 6/13; AE1 baseline 13 P / 4 historical F / 2 restricted NA / 21 NT unchanged; #224 and #264 remain open.** Nothing here is production evidence: no Supabase call, no credentials, no browser against a hosted build, no Netlify/Electron/flag/cache action.

Authority read first: [B1 retained gate ledger](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md) (latest chronology, appended checkpoint below), [formal gate audit](WP05_FORMAL_CLOSURE_GATE_AUDIT_2026-11-08.md), [owner decisions D1–D3](WP05_OWNER_DECISIONS_2026-11-09.md), [R9 policy directions](WP05_R9_OWNER_POLICY_DIRECTIONS_ACCEPTED_2026-11-10.md), [B1 §11](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md), [PAR1](WP05_PAR1_S2_S9_REAL_DATA_PARITY_2026-11-08.md), [L1 gate](WP05_L1_SCOPED_KPI_CORRECTION_IMPLEMENTATION_GATE_2026-11-10.md), [PWA post-merge acceptance §G](WP05_SCHEME_MASTER_PWA_POST_MERGE_ACCEPTANCE_2026-11-10.md). Where older documents describe #263 as DRAFT or #266 as pending, the dated chronology and superseding banners govern; no historical text was rewritten.

**Delivery:** PR-A [#269](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/269) (this document + ledger checkpoint + workpack pointer, docs only), PR-B [#268](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/268) (tests/CI only), PR-C [#270](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/270) (Viability Periods proposal, docs only). Exact SHAs are in the issue #267 handover. **None is merged.**

---

## 1. W5-01 … W5-10 gate matrix

| Gate | Formal disposition (unchanged) | Latest exact proof | Residual technical / owner item | Next executable step | Source · issue |
|---|---|---|---|---|---|
| W5-01 inventory/design | **PASS** | A1–A7; Tier-1 design accepted 2 Nov | none absent drift | none | [formal audit §2](WP05_FORMAL_CLOSURE_GATE_AUDIT_2026-11-08.md) |
| W5-02 Tier-1 implementation | **PASS (code)** | #131/#132, N1–N4/W6. **This pass:** N1/W6 suites re-run on `85eae297` (§5): nav-groups 24/24 *after* a test-only repair of a pre-existing failure, W6 13/13 | none; keep version provenance | merge PR-B after review | §5 · #268 |
| W5-03 restricted ID + build identity | **PARTIAL** | v392 hosted 72/72 assets (8 Nov) accepted by owner for **WP06 A1 only**; v393 W5-06 live tests cover Staff Governance only | **Q-BUILD:** owner accepts a *scoped* WP05 build baseline (§3.A1) | daytime D-1/D-2 build identity; owner ruling | §3.A1 · #264 |
| W5-04 40-lens evidence | **OPEN** | AE1 13/4/2/21; AE2 15 render-only; later bounded recoveries | per-lens credit needs explicit policy (§3.A4); B1-T1 = 0 | optional targeted D-3…D-7 reads | §3.A4 |
| W5-05 run/SKU parity | **PARTIAL** | D2: S2 (2 PASS + SKU 105 PARTIAL-as-designed), S9 Nov 149 and Oct 143; L1 server fix verified live (Oct 143, Nov 151) | no further *textual* criterion beyond S2/S9 found (§3.A2); L1 browser/period-switch **NOT TESTED** | D-4 period switch; owner Q-W505 | §3.A2 |
| W5-06 read-only authz / negative IDs | **Staff Governance confidentiality subgate ACCEPTED (scoped); parent OPEN** | CBM×2 + editor acceptance; SEC-A1/A2/FIX-01/FIX-02/CONF-01 static + mock tests green | **ID-N/ID-X/ID-O and server-denial behaviour NT**; Q-ID, Q-VIEW | owner-approved identity list then D-8 (view-only) | §4.B5 |
| W5-07 flag control | **PARTIAL** | targeted NAV_GROUPS/Lock evidence; B1-T2 to WP12 | LOCK-P01: source fix #212 + regression test now green (§4.B1); live flag-ON view-only observation NT | D-9 optional | §3.A4 |
| W5-08 authority / routes | **PARTIAL** | L1 server defect CLOSED; WP06 deferrals C6/O-8, D3, C9, D7 | C5/D5, D3, F1, O-2, SEC residuals still WP05-owned (§3.A3) | owner rulings Q-1…Q-9 | §3.A3 |
| W5-09 risk/deferral metadata | **PARTIAL** | PARKED_BACKLOG + A5 | exact WP05 IDs/milestones/receivers (§3.A3 table is the proposed register) | owner acceptance of the register | §3.A3 |
| W5-10 Gate Status | **OPEN** | not signed | Q-SIGN | only after the above | — |

### Partition of remaining work

| Class | Items |
|---|---|
| **Autonomous technical sub-checks — done** | build-drift reconciliation; S2/S9/L1 reconciliation; decision register; 40-lens credit table; offline regression runs; three test/CI defects found and fixed in PR-B; pack; Viability proposal |
| **Blocked on browser / authorised identity / live host** | hosted asset SHA + SW state (#264 C2/C3); Scheme Master 1280 px GET and timing; L1 period-switch display; any ID-N/X/O behaviour; #19/#23/#24/#35 timed recovery |
| **Owner decision** | Q-BUILD, Q-W505, Q-ID, Q-VIEW(+VENDOR/AUDIT/TRACE rows), Q-F1, Q-PRM, Q-VP-1/2, Q-HIST, Q-SIGN (§3.A3) |
| **WP12 transfer (already effective)** | B1-T2-1/2 (11-flag, six-module interactions), B1-T3-1/2 (cross-module routes/responsive/Electron). **B1-T1 = ZERO — not taken back into WP05.** |

---

## 2. Method and honesty limits

Repository files, `git` history (full clone; `git rev-parse --is-shallow-repository` = false), GitHub issues/Actions metadata, and local Node tests. Original D: evidence, signed-in browser results, and every live-Supabase readback quoted below come from earlier dated records and are **cited, not re-observed**. Any claim that would need those is marked **BLOCKED / NOT TESTED**.

---

## 3. Wave A — reconciliations

### A1 · W5-03 build / identity provenance (v392 vs v393 vs now)

`git diff 883a9f1c..main -- public` (883a9f1c = 8 Nov v392-baseline docs commit; its `sw.js` pins `hub-cache-v392`) returns **five** served files and four commits — one more file and two more commits than the earlier R1 finding 01, because #263 and #265 merged afterwards:

| Commit (IST) | Served files | Content (by diff inspection) | Touches six-module Costing lenses? |
|---|---|---|---|
| `5ed0d6dc` 8 Nov | `procurement-execution-console.js` | PEC Vendor-wise search (#238) | **No** — outside Costing Suite |
| `47170b5d` 10 Nov | `costing-suite-cost-build.js`, `costing-suite-shell.js`, `sw.js` | W5-06 personnel gate: CBM view **and** edit fail-closed, explicit staff projections, export guard, sign-out purge; cache `v392→v393` | **Staff Governance (#9) and shared-shell *staff paths only***: all added shell code is guarded by `CURRENT_LENS === "staff-governance"`, a personnel permission helper, or a sign-out purge that acts only on that lens |
| `cf41740e` 10 Nov 20:46 | `costing-suite-pricing-policy.js` | Scheme Master list `select("*")` → 31 explicit columns | **Scheme Master (#19)** read path only |
| `ff2e79bb` 10 Nov 23:02 | `sw.js` only (+ mocked-SW test) | PPM module JS network-first with offline cache fallback; **`hub-cache-v393` unchanged** | caching strategy of the PPM module only |

**What legitimately applies to WP05.**

1. v392 hosted 72/72 and the 119-observation ID-V run are valid for the **then-tested v392 source**. By diff inspection the later source differs from it, for Costing, only in: Staff Governance/CBM+shell personnel paths, the Scheme Master list read, and SW cache strategy/version. This is an *inspection-based containment*, not a re-test: the shell is shared by all six modules, so "no other lens changed" rests on the diff, not on new evidence.
2. v393 W5-06 live evidence (two CBM view-only + one editor, 11/11 view-only action inspection) covers **only** Staff Governance confidentiality (#9) — see [CONF-01 acceptance](WP05_W506_CONF_01_PRODUCTION_ACCEPTANCE_2026-11-10.md), [owner residual disposition](WP05_W506_CONF_01_OWNER_RESIDUAL_DISPOSITION_2026-11-10.md).
3. v392 evidence **does not** transfer to: #9 (policy intentionally changed: older unrestricted staff register 164 vs view-only zero rows is not a conflict), #19 (read path changed), or to any hosted build after v393 until asset identity is proven (#264).
4. **WP06 accepted build baseline ≠ WP05 40-lens proof.** The 8 Nov owner acceptance of v392 is the WP06 A1 amendment; WP05 §8 still binds the 40-lens table (formal audit §1: "A1 narrows WP06 only").

**Residual for W5-03:** a single owner ruling **Q-BUILD** — accept "v392 for unaffected lenses (by diff containment) + v393 for #9 + asset-identity proof for the current hosted build" as the WP05 build baseline, or require a fresh identity run. Executable proof: daytime D-1/D-2.

### A2 · W5-05 factual parity

| Criterion | Authority (text) | Evidence | Status |
|---|---|---|---|
| S2 READY, Nov run 149 | [D2](WP05_OWNER_DECISIONS_2026-11-09.md); [PAR1 §8](WP05_PAR1_S2_S9_REAL_DATA_PARITY_2026-11-08.md) | printable vs SKU Cost Details MATCH | **Owner-accepted (bounded)** |
| S2 REVIEW_REQUIRED, Nov run 149 | same | MATCH | **Owner-accepted (bounded)** |
| S2 BLOCKER SKU 105, run 149 | same | NULL/NULL, status/MRP/run agree | **PARTIAL-as-designed, owner-accepted; not a calculated-cost PASS** |
| S9 Nov run 149 | same | READY/REVIEW/BLOCKER 121/506/1 of 628 | **Owner-accepted** |
| S9 Oct approved run 143 | same | 627/0/0 of 627 | **Owner-accepted** |
| L1 server correctness (run-pinned coverage) | [L1 gate](WP05_L1_SCOPED_KPI_CORRECTION_IMPLEMENTATION_GATE_2026-11-10.md), [R7](WP05_R7_L1_FROZEN_SCHEME_COVERAGE_LIVE_READBACK_2026-11-10.md) | live view: Oct 143 selling 627/627, scheme 600/627; Nov **151** selling 629/629, scheme 601/629; five rows complete+missing=total; 19 columns/owner/ACL unchanged | **Server defect CLOSED (live SQL proof)** |
| L1 signed-in display after period switch | — | **no browser capture after the fix** | **NOT TESTED** |

Run provenance preserved: D2 compared Nov **149** (historical) and Oct **143**; the successful November pointer has since advanced to **151**; 149 is not substituted by 151 anywhere.

**Residual W5-05 criteria.** The only textual W5-05 minimum-proof sentence in the audit ("S2: printable versus SKU Cost Details for three real READY/REVIEW/BLOCKED SKUs…; S9: CCC KPI versus SKU Control after period switch") is now satisfied as bounded by D2. No other W5-05 criterion has been located in the audit, ledger, A-series or workpack text. What remains is **not** a missing test but: (i) the PARTIAL on BLOCKER SKU 105 (accepted-as-designed), (ii) owner confirmation that the gate may be reconciled as "PASS-with-recorded-limits", and (iii) the optional post-fix L1 display observation (D-4). **Q-W505** asks the owner to choose between closing W5-05 with limits now, or requiring D-4 first. This report does **not** make that choice.

### A3 · W5-08 / W5-09 decision and risk queue

"Approved" = owner decision recorded; "open" = needs an owner ruling; **no WP06 deferral is treated as closing a WP05 server-authority question** (formal audit §4).

| ID | Item | Owner status | Owner of work | Source of the decision / fact | Ask / next |
|---|---|---|---|---|---|
| Q-ID / SEC-NEG | ID-N, ID-X, ID-O and server-denial behaviour | **Direction approved** (R9): honest NT, future scoped read-only procedure; no writer-denial probe | WP05 | [R9](WP05_R9_OWNER_POLICY_DIRECTIONS_ACCEPTED_2026-11-10.md), [plan](WP05_NO_SIDE_EFFECT_SECURITY_PLAN_DRAFT_2026-11-09.md) | **Open:** approve an exact identity list + SELECT/GET allowlist (Phase B) or accept NT with milestone |
| SEC-A1 | material-review accept/close internals require CCC view+edit | live MD5 of 3 internals matched 4 Nov expected; client suppresses actions | WP05 | [R8](WP05_R8_SEC_PRM_LIVE_BOUNDARY_AND_OWNER_DECISION_2026-11-10.md) | **Open:** accept static+catalogue+isolated evidence, or require isolated-cluster behavioural run |
| SEC-A2 | approval-preview acknowledgement requires CCC edit | live MD5 `9911a0c6`; 16 approval-controller mock tests green | WP05 | R8; §4.B5 | same |
| Q-VIEW (+VENDOR/AUDIT/TRACE) | 49 shared views: one-of-four helper; tiered hybrid | **Direction approved**; no row-specific implementation authority | WP05 policy → separate implementation | [R3 proposal](WP05_R3_49_VIEW_READER_AND_MINIMUM_COLUMN_POLICY_PROPOSAL_2026-11-10.md), R9 | **Open:** per-view approval before any GRANT/REVOKE/RLS; ID-O blanket CCC denial is *not* a valid expectation |
| Q-D3 / D3 | CCC-edit vs MCM-edit distinct authorities | **Approved** (R9): keep distinct, no silent merge | WP05 (WP06 deferral not authority) | R9; A5 D3 | none unless a workflow needs a cross-module permission |
| Q-F1 | PRM F1 preview RPC | **Approved:** stays blocked from read-only acceptance until separate review | WP05 | R2/R8 (wrapper+internal MD5 parity; SECURITY DEFINER; data grain sensitive) | **Open:** independent dependency/data-exposure review, then individually approved isolated execution |
| Q-PRM / C5·D5 | fixed run 80/82 + independent as-of date | **Direction approved**: keep model, label both contexts | WP05 (needs server contract for any selector) | R6: 495 recipients, 454 active; as-of 2026-08-07 → 0/454 mapped, as-of 2026-11-10 → 454/454 | **Open:** exact UI labels + safe read path; D5 selectable-run needs server review first; #33/#34 stay NT |
| O-2 | server route registry | **Open** (no decision recorded) | WP05 | formal audit W5-08 row | owner decision: register or defer with milestone |
| C6/O-8 | `COST_REVIEW_WORKBENCH`/`COST_APPROVAL_WORKBENCH` non-navigable | WP06 deferral accepted; WP05 IA ownership remains | WP05 (IA) | PARKED_BACKLOG `WP06-C6-O8` | milestone for a destination, or accept non-navigable |
| D7 / C9 | maker-checker policy; PPM `periodScoped` metadata | WP06 deferral accepted | WP06→WP05 governance | PARKED_BACKLOG | record WP05 acceptance or milestone |
| Sensitive-data exposure policy | Staff Governance personnel gate | **Scoped subgate ACCEPTED** (10 Nov) | WP05 | CONF-01 docs | wider 49-view exposure = Q-VIEW |
| LOCK-P01 | lock UI for view-only | source fixed #212; **regression guard now green in PR-B** | WP05 | §4.B1 | live flag-ON observation optional (D-9) |
| L1 | run-pinned KPI | **Approved + live-fixed** | — | L1 gate | display observation D-4 |
| Q-HIST | #19/#23/#24/#35 recoveries | **Open** | WP05 | R9 historical ledger | accept "F retained + dated recovery credit" wording, plus whether timed recovery reads are material |
| Q-VP-1/2 | Viability Periods semantics | **Open** | PPM | PR-C proposal | choose option A/B/C/D |
| Q-BUILD / Q-W505 / Q-SIGN | §3.A1, §3.A2, W5-10 | **Open** | WP05 | this report | rulings |
| A5 C1–C4, D9 | PRM defects fixed in P02 (#131) | historical | — | A5 register / P02 | not re-verified here |
| CDE-P02/P03, WP06-SEC-NEG, LOCK-P01 rows | parked backlog | recorded | WP12/WP05 | PARKED_BACKLOG | no change |

### A4 · AE1 40-lens table vs later bounded evidence — **potential credit only**

No P/F/NA/NT count is changed. A lens could be credited only with (a) per-lens proof at a named build/identity and (b) an explicit owner policy; the "needed" column states the smallest such proof. Full 40-row table: [R1 ledger](WP05_R1_FORTY_LENS_EVIDENCE_RECONCILIATION_2026-11-10.md).

| Lens | AE1 | Later evidence (link) | Potential credit | Needed to credit |
|---|---|---|---|---|
| #1 dashboard, #3 sku-control-status | NT | D2 S9 compared CCC readiness KPI with SKU Control Status, runs 149/143 ([PAR1](WP05_PAR1_S2_S9_REAL_DATA_PARITY_2026-11-08.md)) | functional parity of two lenses on bounded runs | owner rule that S9 parity counts as per-lens functional proof |
| #22 sku-cost-sheet | NT | S2 MATCH ×2 + SKU 105 PARTIAL | bounded | same; SKU 105 stays PARTIAL |
| #9 staff-governance | NT/PARTIAL | v393 live view-only PASS + editor PASS ([CONF-01](WP05_W506_CONF_01_PRODUCTION_ACCEPTANCE_2026-11-10.md)) | confidentiality aspect credited via the **accepted subgate**; lens stays NT/PARTIAL (Save/Close not exercised) | editor-workflow read evidence or owner acceptance |
| #19 scheme-master | **F** | owner 7 schemes + 3/3 refresh after index; owner PWA smoke 10 Nov (§F); 31-col projection merged | separately recorded post-fix recovery only | D-3 (timed 1280 px GET); **F stays F** |
| #23, #24 | **F** | owner post-ANALYZE functional loads ([R9](WP05_R9_HISTORICAL_F_RECOVERY_RECONCILIATION_2026-11-10.md)) | functional recovery, not performance | optional timed read |
| #35 production-cost-centres | **F** | #178 fix; list/detail wrappers exist live | functional recovery | optional signed-in read |
| #33, #34 | NT | R6 explains zeros (historical run vs current as-of) | classification of *why* empty | Q-PRM labels + safe read; not promotable |
| #31, #36 (preview), #38 | NT / NT-PARTIAL | none safe | **none — preview RPCs unallowlisted** | Q-F1 |
| #6, #7 | NA | correct restricted-identity result | none | an identity with trace roles |
| 15 AE2 rows | NT | v391/OFF render-only | none (render ≠ lens PASS) | per-lens functional proof |
| Flags: LOCK-P01 | partial | #212 + `acceptance-runner` regression (PR-B) | source-level only | D-9 |

### A5 · #264 / #224 / PR #266 classification

| Item | Closed technical test repair | Open runtime acceptance |
|---|---|---|
| PR #266 (`85eae297`) | W6 #10/#11/#13 shallow-clone artefacts + #12 pin drift repaired **test-only**; **re-run here with full history: W6 13/13** | the push run of `wp05-scheme-master-list.yml` on `85eae297` is a **zero-job failure** — see §4.B1 finding C: the workflow file was invalid YAML, so no hosted CI evidence exists for #263/#265/#266 |
| #264 | source verified (31 cols; SW v393 + PPM network-first; mocked SW 8/8 here) | **hosted Netlify bytes/deploy SHA BLOCKED** (earlier sandbox 403 + classifier; not re-attempted here, **no network access to the host was used**); old-PWA SW upgrade **NOT VERIFIED**; authenticated 1280/390 px GET **NOT TESTED** |
| #224 | covering index exists/valid; 31-col read | historical 57014 stays **F**; planner does not choose the new index (R10); cold-path timing **NOT TESTED** |

The issue text cites "W6 32/32 locally": that aggregate could not be reproduced from the named commands. This pass reports the per-suite counts in §4.B1 instead (W6 13, projection 3, SW 8 = 24 for those three).

---

## 4. Wave B — offline technical hardening

### B1 · Regression runs

Environment: Node **v22.23.4**, Linux container, repository at `85eae297` (full history) plus PR-B head; LF checkout (`git ls-files --eol` = `i/lf w/lf`); **ESLint NOT RUN** (no `node_modules`; `@eslint/js` unavailable — no lint success is claimed). Prettier 3.3.3 applied to the one new test file only.

| Command (`node --test …`) | Result on `main` | Result on PR-B head |
|---|---|---|
| `scripts/costing-nav-groups/nav-groups.test.mjs` | **23/24 — FAIL #20** | **24/24** |
| `…/nav-groups-prm-integration.test.mjs` | 4/4 | 4/4 |
| `scripts/costing-w6-pricing-nav/w6.test.mjs` | 13/13 | 13/13 |
| `scripts/scheme-master-list-projection.test.mjs` | 3/3 | 3/3 |
| `scripts/costing-sw-freshness/pricing-policy-sw.test.mjs` (mocked SW) | 8/8 | 8/8 |
| `scripts/costing-acceptance/acceptance-runner.test.mjs` (local Chromium + fake backend) | **11/12 — 1 FAIL (view-only test)** | **13/13, 0 skipped** (that test split in two) |
| `scripts/costing-wp05-overnight/scheme-master-contract.test.mjs` (new) | n/a | 6/6 |
| wp05-closure 13 · sec-fix-01 17 · sec-fix-02 13 · conf-server 15 · conf-client gate 22 + dynamic 11 · conf-acceptance 9 · approval-controller 16 · acceptance-lib 8 · cache-bump 6 · lens-evidence-matrix 6 · verify-served-assets 14 · evidence-table-scroll 3 · console-rpc-allowlist 8 | all pass | unchanged |

Skips: none in any suite. CRLF: not applicable (no CRLF files touched). All suites ran locally; **hosted GitHub runs for PR-B are not verified** at the time of writing.

**Findings (each fixed test-only/CI-only in PR-B, reviewer should confirm the reading):**

- **A — nav-groups #20** failed on unmodified `main`: the test sliced the CSS from the N1 marker to end-of-file, so a *later* comment (Issue #208) containing the words "overflow-x:hidden" matched the "no hidden overflow" rule. Bounded the slice at the next top-level comment; mutation check (adding `!important` inside N1) still fails it.
- **B — acceptance-runner view-only test** asserted the *pre-#212 defect* (an enabled "Close quarter" for a CCC view-only identity under the lock flag). #212 (`83b217be`) fixed it; the shipped source now yields zero `WRITE_CONTROL_ENABLED` findings. Replaced by a regression guard plus an injected-control detector test. **This is source-level/LOCAL_SELF_TEST evidence for LOCK-P01, not hosted evidence.**
- **C — `.github/workflows/wp05-scheme-master-list.yml` (from #263) was invalid YAML** (`mapping values are not allowed here`, an unquoted `: ` in a `run:` echo). GitHub shows every push of that workflow as a 0-job failure (e.g. run 42874252145 on `85eae297`); the Node tests it promises **never ran in CI**. This corrects the ledger line "no workflow runs found": runs existed but were startup failures. Fixed wording + `fetch-depth: 0` (W6 reads pinned history). All five workflow files now parse.

### B2 · Static routes, role guards, interfaces

Registry/route/permission-target consistency, 11-flag inventory/defaults, C8 trace-tab visibility, W6 and N1 are already covered by `wp05-closure` (13), `nav-groups` and `w6` tests; the six module permission targets and `can_edit` fail-closed behaviour are covered by approval-controller (16), lock-controller, and the W5-06 gate/dynamic tests. **No additional isolated guard test was added**: the realistic additional candidates (a SQL-model of `fn_costing_view_allowed`, or a mock "server denial") would assert the test's own fixture, not production behaviour, and the directive forbids presenting that as denial evidence. A runnable test *spec* instead: §4.B5.

### B5 · Security denial test matrix (reconciled with the [no-side-effect plan](WP05_NO_SIDE_EFFECT_SECURITY_PLAN_DRAFT_2026-11-09.md))

Evidence classes: **STATIC** = migration/source text test; **MOCK** = client controller with injected `canEdit`; **CATALOGUE** = earlier SELECT-only live metadata (MD5/ACL), cited; **ISOLATED** = disposable-PG-cluster runner on synthetic scaffolds; **BEHAVIOURAL-PROD** = a real denied call as a real identity.

| Subject | STATIC | MOCK | CATALOGUE | ISOLATED (repo-owned runner) | BEHAVIOURAL-PROD |
|---|---|---|---|---|---|
| SEC-A1 accept/close (CCC view+edit) | migration/source checks (`wp05-closure`) | action suppression in client tests | R8 MD5 ×3 | **none found in `supabase/tests`** (`au2`/`au3` are unrelated AU suites) | **NOT TESTED / not authorised** |
| SEC-A2 approval preview ack | source checks | 16 approval-controller tests | R8 MD5 `9911a0c6` | — | **NOT TESTED** |
| SEC-FIX-01 staff classification (Save) writer guard | 17 tests | — | exact live prefix/MD5 in tests | `w506_sec_fix_01/run_local.sh`, `run_live_equivalent.sh` — **not run here** | **NOT TESTED** |
| SEC-FIX-02 Close writer guard | 13 tests | — | live prefix 174 B | `w506_sec_fix_02/run_live_equivalent.sh` — **not run here** | **NOT TESTED** |
| CONF-01 personnel view gate | 15 tests (incl. identity matrix declared) | 22 + 11 | live fingerprints | `w506_conf/run_view_gate_test.sh` — **not run here** | accepted via the genuine 10 Nov CBM×2/CSR/editor acceptance (scoped) |
| Shared 49-view helper (one-of-four) | R3 proposal | — | 49/63 views; 48 authenticated SELECT | — | **ID-N/ID-X/ID-O NT**; ID-O blanket denial is **not** the expected result |
| ID-V six-module view-only | — | — | — | — | 8 Nov hosted run (v392) — historical |

**Why the isolated runners were not executed:** they refuse to run unless the server's data directory is named `w506-disposable-*`, on an absolute unix socket, as superuser. PostgreSQL 16 binaries exist in this container, but starting a cluster failed on sandbox path limits (socket path > 107 bytes; non-root data-dir permissions). That is a *tooling blocker*, not a result. Recommended: the owner/operator runs them on a disposable local cluster (checklist item D-0), which would upgrade the ISOLATED column from "available" to "executed" — still **not** production-denial evidence and still not a P for ID-N/X/O.

**Runnable test spec (not executed, not invented):** for each of ID-N (no costing grants), ID-X (CCC edit without view), ID-O (CSR view only) record, per approved read-only view/RPC, the expected result *from the actual helper* (`require_permission` = exact module view [+edit]; `fn_costing_view_allowed` = any one of four module views), UI availability, HTTP status, request *name* only — per plan Phase B. All expectations are subject to Q-ID/Q-VIEW.

### B3 · Offline browser acceptance pack — see §6 (daytime checklist).

### B4 · Viability Periods — see PR-C and [the proposal](WP05_SCHEME_MASTER_VIABILITY_PERIODS_DESIGN_PROPOSAL_2026-11-10.md) (on its own branch; link resolves after PR-C merges). Quantified: 2 numeric display sites + 2 label literals; 0 client references to the 3 real server names; 0 of the 31 requested columns match; pinned by `scheme-master-contract.test.mjs`. **Not restored to `select("*")`; no live query; no display change in this pass.**

---

## 5. Outstanding gates and blockers (honest state)

| Item | State |
|---|---|
| WP05 | **OPEN**; programme **6/13** |
| W5-03/05/07/08/09 | PARTIAL; W5-04/06(parent)/10 OPEN |
| Hosted asset identity (#264 C2) | **BLOCKED** (no authorised network path to Netlify from this environment; not retried) |
| Old-PWA SW upgrade (C3) | **NOT VERIFIED** |
| Authenticated 1280/390 Scheme Master GET + timing | **NOT TESTED** |
| L1 post-fix period-switch display | **NOT TESTED** |
| ID-N / ID-X / ID-O / server-denial behaviour | **NOT TESTED** |
| Four historical F | **retained**; later recoveries scoped, untimed |
| GitHub-hosted CI for PR-B/PR-C heads | verify on the PR checks tab (workflow was previously unparseable) |
| ESLint | **NOT RUN** (dependencies missing) |

---

## 6. Daytime operator PC acceptance checklist (READ-ONLY; nothing here has been run)

**Global stop rules.** Stop immediately and report (do not continue to fill the table) on: any request that is not `GET`/`HEAD` or a `rpc_get_*`/`get_user_permissions` read; any POST/PUT/PATCH/DELETE to a table or non-read RPC; any prompt for credentials in chat or GitHub; unknown/preview RPC (`rpc_preview_*`, `rpc_costing_preview_*`, F1); build identity mismatch; non-redactable staff/salary data on screen. **Never click** Save, Create, Edit, Deactivate, Reactivate, Close, Refresh, Request, Approve, Accept, Apply, Lock, Preview, or Export. **No-writer allowlist:** only the page loads below, tab/lens selection, the period selector, and DevTools Network *viewing*. Use only an **existing legitimate** view-only identity in an operator-controlled session; do not create accounts or change permissions; never paste tokens/cookies/storage-state into GitHub or chat.

**Evidence naming/redaction.** Keep raw files outside the repository. Name `wp05-d<N>-<yyyymmdd>-<w>px-<result>.txt|png`. Record: IST time, device/browser, width, build SHA / `sw.js` cache name, identity *class* (e.g. "ID-V"), period/run, request **names**, HTTP status, elapsed ms, row *counts*. Redact emails, UUIDs, staff/salary values, tokens. Post only the redacted summary table to #264/#267.

| # | Check | Steps | Expected | PASS / FAIL / stop |
|---|---|---|---|---|
| **D-0** (optional, no browser) | Run isolated SQL runners | On a **disposable local** PG cluster named `w506-disposable-*`, `PGHOST=<socket dir> bash supabase/tests/w506_conf/run_view_gate_test.sh` and the `w506_sec_fix_01/02` runners | each prints PASS lines, exit 0 | any FAIL → report, do not proceed to production steps. Labels the result ISOLATED, not production |
| **D-1** | Hosted asset identity | `git fetch origin main && git rev-parse origin/main`; `node scripts/costing-acceptance/verify-served-assets.mjs https://sasv-utilities-hub.netlify.app <that 40-hex SHA> --expect-cache hub-cache-v393 --json <out-of-repo>.json` (record Netlify **Deploys** production SHA too) | exit **0**, every Costing asset digest matches; `sw.js` cache `hub-cache-v393` | exit 1 = **MISMATCH** (report which file); exit 3 = **NOT VERIFIED** (network/inaccessible: no evidence either way — not a failure). If the published deploy predates `ff2e79bb`, mismatch on `sw.js`/PPM JS is expected → report, don't "fix" |
| **D-2** | Existing installed PWA update | Installed PWA that had old cached PPM JS: open online, reload twice; DevTools → Application → Service Workers: note active worker; Network: first load of `costing-suite-pricing-policy.js` | fresh script served (network-first), cache `hub-cache-v393`; offline reload still opens PPM (cache fallback) | stale/never-updating worker = FAIL (record only; no cache bump without owner) |
| **D-3** | Scheme Master read, **1280 px desktop**, view-only ID-V | DevTools Network (Preserve log) → Pricing Policy Manager → Scheme Master; filter `v_costing_scheme_master_register` | exactly **one GET**, query `select=` lists **31 fields** and **none** of `viability_snapshot_count`, `viability_snapshot_period_count`, `latest_viability_snapshot_period`; HTTP 200; **7 rows** (baseline); record duration (ms) and any `57014`; Viability Periods cell shows `--` (known); **zero** non-GET | `57014`/500 → record as **recurrence evidence for #224** (do not retry in a loop; at most 2 bounded repeats at different times); `select=*` or 34 fields → stale client (return to D-2) |
| **D-3b** (optional) | Same at **390 px** | DevTools device mode or phone | same request; 7 rows | — |
| **D-4** | L1 period switch (W5-05) | Costing Control Center at 1280 px; read Selling/Scheme coverage for **Oct 2026** and **Nov 2026** via the existing period selector (selector only) | Oct approved **run 143**: total 627, selling 627/0, scheme 600/627; Nov current **run 151**: total 629, selling 629/0, scheme 601/28; the two periods **differ** (no repeated 627/2 · 601/28) | identical numbers across periods = old view/mixed scope → report; if run ids differ from 143/151, record the actual run id and compare to the run list, not to these numbers |
| **D-5** | S2/S9 source parity (spot) | Same session: CCC readiness/review/blocked counts for Nov vs SKU Control Status summary | counts agree with each other; note run id (latest may be 151, tested was 149 — do not equate) | disagreement → report with run id |
| **D-6** | Viability Periods visual | Scheme Master list + one detail drawer | `--` in both places; no error; no extra request | different value → report (would mean unexpected source change) |
| **D-7** | Targeted still-NT lens reads (only if owner wants credit; priority order) | #35 Production Cost Centres list/detail; #23 Printable Cost Sheet product summary (Nov); #24 Cost Comparison (Nov+Oct) — record request name, status, ms | functional load, no `57014`, no "Unknown RPC" | recorded as **new dated evidence beside the historical F**, not a promotion |
| **D-8** | View-only negative evidence (only with an owner-approved identity list — Q-ID) | For each approved identity (ID-N/ID-X/ID-O): load each module page and record visible UI + status of the *view reads* only | outcome per the actual helper contract (§4.B5), **not** blanket denial for ID-O | any mutating attempt → stop |
| **D-9** (optional) | LOCK-P01 live | `localStorage.setItem("COSTING_LOCK_SCREEN_V1","1")` for the session, load Control Center as view-only, **observe** | no enabled "Close quarter" control; **remove the override afterwards** (restore OFF) | enabled control = FAIL → critical finding |

**Results to bring back (single redacted table):** D-1 exit code + deployed SHA; D-2 worker/cache observation; D-3 field count/status/rows/ms/57014; D-4 four coverage figures + run ids; D-5 counts; D-6 display; D-7/D-8/D-9 only if run. Anything not run stays **NOT TESTED**.

---

## 7. Smallest next bounded execution package

**D-1 + D-2 + D-3 + D-4** (about 30–45 minutes, one existing view-only session, one hosted build): they close the three open runtime acceptances (#264 C2/C3, desktop GET, L1 display) without touching any identity beyond the one already used, any writer, or any server object. Everything else in §6 is optional and each row is independently skippable.

## 8. Owner rulings requested (consolidated)

1. **Q-BUILD** (W5-03): accept scoped baseline (§3.A1).
2. **Q-W505**: close W5-05 as "PASS-with-recorded-limits" now, or require D-4 first (§3.A2).
3. **Q-ID / Q-VIEW / Q-F1**: exact approvals needed before any execution (§3.A3).
4. **Q-PRM** labels; **O-2**, **C6/O-8**, **D7/C9** milestones; **Q-HIST** wording.
5. **Q-VP-1/2** (PR-C): choose A/B/C/D.
6. **Q-SIGN** only after the above.

*No production SQL, Supabase, permission, flag, Netlify, cache-version, Electron or credential action was performed or requested in preparing this document.*
