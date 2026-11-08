# WP05-AE2 — Local D: evidence-credit proposal (8 November 2026)

**Status: PROPOSAL ONLY — UNAPPROVED. WP05 OPEN. Programme 6/13 (46.2%) unchanged. WP06 remains formally closed.** Documentation-only extraction for issue #234 (WP05-AE2 handoff). It records what the owner's already-generated local run report contains for the 15 AE1 "C-D" NT rows, and **proposes** delta classifications. **Vocabulary (review R2):** the classification used below, `RD-v391/OFF`, is a *limited render/data-presence sub-evidence label at v391 with flags OFF*. It is **not** a full WP05 acceptance `P`. The AE1 counts **13 P / 4 F / 2 NA / 21 NT remain authoritative.** It changes no AE1 fact, approves nothing, records no owner decision, makes no B1 decision and does not edit the WP05 gate status.

**No production interaction.** No SQL, Supabase, browser/Playwright, RPC, network call to the application, flag, permission, deployment, code, script or test was run. Method: read-only file reads on the local Windows D: drive plus `git` against `origin/main` `2d6e69bc74f1587b96a539530d4accde688a5128` (AE1 merged, PR #235).

## 0. Source access, method and limits

| Item | Result |
|---|---|
| Precondition | Met. Session ran on the owner's Windows machine; `D:\claude-sessions\acceptance-out\run-20261108` was readable. |
| Files whose contents were read | `run-20261108/report.json` (153,616 B), `run-20261108/report.md` (2,554 B), `acceptance-out/WP05_WP06_WP12_CONSOLIDATED_ACCEPTANCE_REPORT_2026-11-08.md` (7,282 B, owner-side summary Markdown). Plus the top-level **key names only** (no values) of `run-selector-20261108/inventory.json`. |
| Fields extracted from `report.json` | `module`, `lens`, `flag_state`, `flags_on`, `width`, `ready`, `rows`, count of `banners`, `period`, `run_labels` (run numbers only), `overflow_px`, `write_controls` (counts of enabled+visible), count of `console_errors`, count of `flags_read_back`, `claims`; run header (`started_at`, `finished_at`, `verdict`, `git_sha`, build cache name/bundle digest, identity row counts, `flags_restored`, `summary`). |
| Fields deliberately **not** read or reproduced | `identity.user_ref`, `h1` page headings (may carry product text), `screenshot` file contents, any request headers/URLs/payloads, the per-route request tallies beyond key names. No product, person or SKU names, costs or tokens appear in this document. |
| Secret / sensitive material | **No authentication, session, cookie, token or credential file was opened. No screenshot (PNG) was opened, viewed or copied; `shots/` was listed by filename and size only.** The `acceptance-secrets` folder was not opened or listed. Nothing was copied out of D: (only derived numbers are quoted here). |
| Reproducibility | `report.json` is **not in Git**. File/line/key references below point to the pretty-printed local file (7,374 lines); an independent reviewer needs the owner's copy to re-verify them. `L<n>` = line of the observation's `"lens"` key; `obs[i]` = index in `observations[]` (0–118). |
| Other run folders | `run-selector-20261108`, `run-navgroups-20261108`, `run-readiness-nov2026-20261108`, `run-scheme-master-*`, `run-lock-p01-20261108`: inventoried by name only. They cover AE1's already-credited rows (selector/PPM/readiness/lock) and were not needed for the 15 C-D rows. |
| Runner definition used | `scripts/costing-acceptance/acceptance-runner.mjs` on `origin/main`, read via git. **Provenance (repository-only check, nothing executed):** the consolidated report names runner source commit `0d30610` (secondhand; `report.json` itself records only the deployment SHA `9661c169`). `git log 0d30610..origin/main -- scripts/costing-acceptance/acceptance-runner.mjs` is empty and `git diff --stat` for that file is empty, so the committed file on `main` is identical to the file at `0d30610`. This does **not** prove the executed runner equalled the committed file (uncommitted local edits or patched copies cannot be excluded; D: holds several patch scripts, not read). |

### 0.1 What the recorded fields actually mean (so nothing is over-read)

> **Provenance qualifier (R3).** Claim semantics below come from the committed runner (identical to `0d30610` in the repository, but not confirmed as what actually executed). Until the runner-at-execution is confirmed, every `claims.* = PASS` is a **recorded claim with partial interpretation**, not an independently validated acceptance criterion. `claims.render` in particular is **not** a substitute for measured per-lens HTTP health.

- **`rows`** = number of `table tbody tr` elements with more than one cell, excluding rows starting "No …/0 rows/Loading". It proves *a table with data rows rendered*; it is **not** a total count, not a source-count match, and values such as 25 or 50 may be page-size caps (not determined).
- **`claims.data = PASS`** = `rows > 0` only. It is **not** a correctness check. Empty tables are `NOT TESTED (no rows)` and are not passes.
- **`claims.render = PASS`** = module chrome became ready, no horizontal overflow (≤1 px), **and no `console.error`/page error** during the observation. It is an indirect indicator only (a failing resource load appeared as a console error for readiness and scheme-master), not measured HTTP health. **A per-lens HTTP status is NOT RECORDED.**
- **`claims.security = PASS`** = no new guard violation for that observation **and no enabled+visible control matching the forbidden-verb pattern**. Per-lens request attribution is **NOT RECORDED**; the request guard result is run-wide: `violations 0`, `blocked 0`.
- **`period`** is the value of the period selector on the page. Where the runner log says the requested period was "not selectable", that observation shows the default period, **not** a period switch.

### 0.2 Run identity (common to every row below)

| Dimension | Recorded value |
|---|---|
| Report | `run-20261108/report.json`, `started_at` 2026-11-08T05:35:53Z, `finished_at` 05:47:45Z; verdict `COMPLETED_WITH_FINDINGS`; evidence class HOSTED; hosted claims EXERCISED |
| Build | Commit `9661c169`, **cache `hub-cache-v391`**, bundle digest `bfc9143f…a9de` (prefix/suffix), build verification VERIFIED. 72/72 files and "2 normalisations" are from the consolidated report (not re-counted here) |
| Identity (redacted) | `ID-V` proven; session rows 6 = canonical rows 6; costing view grants 6; **edit grants 0**; `ok = true` |
| Flags | Per-observation `flag_state`; cells below refer to **OFF (0 flags)** unless stated; `flags_restored = true` at run end |
| Request guard (run-wide) | `violations 0`, `blocked 0`; run summary: 119 observations, 5 claim failures, 29 no-data, 0 restricted, 3 findings |
| Widths | 1280 and 390 px for every row |
| v391 vs v392 | AE1 §0: served `public/` differs between `9661c169` and `main` in `costing-lock-screen.js`, `costing-suite-shell.js`, `sw.js`. **This run is v391 and is not claimed to equal v392.** |

## 1. Audit table — the 15 AE1 C-D NT rows

The 15 rows are exactly AE1 §1 rows 1, 2, 3, 5, 8, 11, 22, 25, 26, 27, 29, 30, 31, 32, 40 (AE1 §1.7: C-D = 3+1+2+4+5 = 15). All 15 have OFF observations at both widths.

| AE1 row | Module · lens id | Source (OFF obs: `report.json` L/obs) | Rows 1280 / 390 | Console errors · overflow | Enabled write controls | Banners | Period / run label (as logged) |
|---:|---|---|---|---|---|---|---|
| 1 | `costing-control-center` · `dashboard` | L44 obs0 (1280), L52 obs1 (390); period obs: L4778 obs81, **L4845 obs82 (1280 only, Oct)** | 1 / 1 | 0 · 0 px | 0 (7 matched, all disabled/hidden) | 0 | Nov: `DRAFT run 149 - not approved`; Oct (obs82): `Approved run 143 (newer DRAFT run 148 - not approved)` |
| 2 | `costing-control-center` · `costing-review-workbench` | L265 obs2, L328 obs3 | 50 / 50 | 0 · 0 | 0 (7 matched) | 0 | `2026-11-01`; no run label logged |
| 3 | `costing-control-center` · `sku-control-status` | L391 obs4, L456 obs5 | 50 / 50 | 0 · 0 | 0 (7 matched) | 0 | `2026-11-01`; `DRAFT run 149 - not approved` |
| 5 | `material-cost-manager` · `manual-rate-manager` | L659 obs8, L707 obs9 | 25 / 25 | 0 · 0 | 0 (4 matched) | 0 | `2026-11-01`; period switch **not selectable** (obs83/84 show default only) |
| 8 | `cost-build-manager` · `cost-governance` | L947 obs14, L1005 obs15 | 1 / 1 | 0 · 0 | 0 (6 matched) | 0 | `2026-11-01`; period switch **not selectable** (obs85/86 default only) |
| 11 | `cost-build-manager` · `driver-governance` | L1295 obs20, L1353 obs21 | 7 / 7 | 0 · 0 | 0 (6 matched) | 0 | `2026-11-01` |
| 22 | `cost-sheet-review` · `sku-cost-sheet` | L3472 obs43, L3522 obs44; period obs L5332 obs89, **L5384 obs90 (1280, Oct)** | 25 / 25 | 0 · 0 | 0 (4 matched) | 0 | Nov: `DRAFT run 149 - not approved`; Oct (obs90): `Approved run 143 (newer DRAFT run 148 - not approved)` |
| 25 | `cost-sheet-review` · `scheme-comparison` | L3772 obs49, L3822 obs50 | 25 / 25 | 0 · 0 | 0 (4 matched) | 0 | `2026-11-01`; `DRAFT run 149 - not approved` |
| 26 | `cost-sheet-review` · `qc-action-queue` | L3872 obs51, L3920 obs52 | 25 / 25 | 0 · 0 | 0 (4 matched) | 0 | `2026-11-01`; no run label |
| 27 | `cost-sheet-review` · `materials-stores-action-queue` | L3968 obs53, L4016 obs54 | 25 / 25 | 0 · 0 | 0 (4 matched) | 0 | `2026-11-01`; no run label |
| 29 | `production-route-manager` · `product-route-assignments` | L4118 obs57, L4145 obs58 | 25 / 25 | 0 · 0 | 0 (0 matched) | 0 | `2026-11-01` (PRM not period-scoped) |
| 30 | `production-route-manager` · `product-subgroup-mappings` | L4172 obs59, L4199 obs60 | 16 / 16 | 0 · 0 | 0 | 0 | as row 29 |
| 31 | `production-route-manager` · `shared-workload-preview` | L4226 obs61, L4253 obs62 | 50 / 50 | 0 · 0 | 0 | 0 | as row 29 |
| 32 | `production-route-manager` · `route-families` | L4280 obs63, L4307 obs64 | 87 / 87 | 0 · 0 | 0 | 0 | as row 29 |
| 40 | `production-route-manager` · `archived-routes` | L4724 obs79, L4751 obs80 | 25 / 25 | 0 · 0 | 0 | 0 | as row 29 |

Common to all 15 OFF observations: `flags_on 0`, `flags_read_back []` (no `COSTING_*_V1` key present), `ready true`, all six `claims` = PASS (`host, flag, module, render, data, security`), HTTP status per lens **NOT RECORDED**, request-guard blocks attributable to the lens **NOT RECORDED** (run-wide 0).

Observation counts, for traceability: 30 OFF observations (15 lenses × 2 widths) are the primary evidence; the extra OFF period-switch observations (obs81–90) and the non-OFF states in §3 are listed separately and are **not** counted as additional lens passes. The aggregate 119 observations are **not** treated as per-lens proof; only the listed per-lens records are.

## 2. Proposed delta classification (UNAPPROVED)

Proposed label: **`RD-v391/OFF`** = *limited render/data-presence sub-evidence*: an ID-V observation at **v391, flags OFF, 1280+390 px** with data rows, no console error, no overflow and no enabled write control. It is **not** a full WP05 acceptance `P`: this run has no per-lens HTTP status, no per-lens request attribution, no correctness/source-count comparison and no v392 parity. Whether any `RD` row is ever counted as `P` is an owner decision; AE1's 13/4/2/21 stands.

| AE1 row | Lens | Proposed | Basis | Exact remaining gap (not closed by this evidence) |
|---:|---|---|---|---|
| 1 | `dashboard` | **RD-v391/OFF** | Both widths ready, 1 data row, 0 errors, 0 overflow, 0 enabled write controls. Run labels observed for Nov (149) and Oct (143, with newer draft 148); the Nov label is not run 150. | **S9 KPI ↔ SKU Control Status parity: NOT tested** (a label is not a KPI value). Oct period-switch observed at 1280 only. v392 not observed. Note: the same lens at `ALL_ON` produced a security FAIL (§3) — separate flag-state history, retained, not erased by this row. |
| 2 | `costing-review-workbench` | **RD-v391/OFF** | 50 rows both widths, clean. | v392; correctness of rows unverified; no run label logged; period switch for this lens not recorded. |
| 3 | `sku-control-status` | **RD-v391/OFF** | 50 rows both widths, clean; run label draft 149. | S9 parity; v392; correctness. |
| 5 | `manual-rate-manager` | **RD-v391/OFF** | 25 rows both widths, clean. | Period not selectable (AE1: picker disabled by design; not a test). Rows may be a cap. v392. |
| 8 | `cost-governance` | **RD-v391/OFF** | Single data row both widths, clean. | Period switch not recorded (not selectable); pool-summary period switch (AE1 row 8 gap) untested; 1 row means a minimal table, correctness unverified. v392. |
| 11 | `driver-governance` | **RD-v391/OFF** | 7 rows both widths, clean. | Correctness unverified; v392. |
| 22 | `sku-cost-sheet` | **RD-v391/OFF** | 25 rows both widths, clean; Nov draft 149 and Oct approved 143 labels observed (Oct at 1280 only). | **S2 printable ↔ SKU detail parity for three real SKUs: NOT tested.** v392. |
| 25 | `scheme-comparison` | **RD-v391/OFF** | 25 rows both widths, clean. | v392; correctness; no ID-V recheck at v392. |
| 26 | `qc-action-queue` | **RD-v391/OFF** | 25 rows both widths, clean. | as row 25 |
| 27 | `materials-stores-action-queue` | **RD-v391/OFF** | 25 rows both widths, clean. | as row 25 |
| 29 | `product-route-assignments` | **RD-v391/OFF** | 25 rows both widths, clean, no write controls found. | v392; correctness. |
| 30 | `product-subgroup-mappings` | **RD-v391/OFF** | 16 rows both widths, clean. | as row 29 |
| 31 | `shared-workload-preview` | **NT retained — pending RPC classification** (render observation is sub-evidence only) | 50 rows both widths, 0 console errors, 0 overflow. Run-wide guard 0 violations / 0 blocked shows only that the crawler delivered no *known disallowed* request, not that every RPC or callee this lens reaches is side-effect-free. | **Exact RPCs and callees used by this lens are unaudited and per-lens request attribution is NOT RECORDED.** Stays NT for clean read-only acceptance until they are audited (AE1 row 31 gap). No credit proposed. |
| 32 | `route-families` | **RD-v391/OFF** | 87 rows both widths, clean. | v392; correctness. |
| 40 | `archived-routes` | **RD-v391/OFF** | 25 rows both widths, clean. | v392; correctness. |

**Local evidence adequacy:** 15 of 15 have a complete OFF pair (1280 + 390) with data rows, no console errors, no overflow and no enabled write control. **14 are proposed as limited `RD-v391/OFF` sub-evidence; 1 (`shared-workload-preview`) stays NT** pending RPC classification. So **1 of the 15 remains NT**, plus the 6 other NT rows untouched (§4). None of the 14 is proposed as a full `P`.

### 2.1 What was explicitly **not** concluded

- No row is treated as P merely because it has `rows > 0` at v392 — no v392 observation exists in this run for any of the 15.
- The 119-observation aggregate is not used as a per-lens PASS.
- Restricted/empty/guard-blocked cases: none of the 15 was restricted, empty or guard-blocked (all `rows > 0`, `restricted 0`); "guard-blocked 0" is run-wide and is not per-lens request proof. The ones that **were** empty in this run (rm/pm trace, staff-governance, manual-provisions, route-family review lenses, product/historical route editors, effective-route-viewer, etc.) are **not** touched by this proposal and keep their AE1 status.
- No actual product/SKU/person names, costs, headers, authorisation payloads or raw URLs were read or are quoted.

## 3. Additional observed states (flag-matrix input; separate from lens credit)

These are **newly found, historically limited v391 records** from D: that AE1 could not see (it marked D: `SOURCE_NOT_ACCESSIBLE`). They **supplement, and do not supersede, the v392 flag matrix** in AE1 §2; AE1's "none"/"not run" wording reflects only the evidence AE1 could read, not an absolute absence. They cover indicated lenses only (default lens per module; `sku-control-status` for the worklist flag). **Nothing here changes any AE1 flag row.**

| State | Observed (v391, ID-V, 1280+390) | Scope limit |
|---|---|---|
| `NAV_ONLY` (`COSTING_NAV_GROUPS_V1` alone, obs93–104) | 12 observations = **default lens of all six modules** × 2 widths; each `flags_read_back` = 1; all claims PASS; 0 console errors; 0 overflow. | Default lens of each module only; grouped-markup behaviour of other lenses and v392 not observed. AE1 row 9 listed CCC/MCM/CBM/CSR/PRM as missing; this run would add **default-lens render/data-presence** observations for them at v391 only. PPM already has a stronger v392 record. |
| `ALL_ON` (all eleven flags, obs105–116) | 12 observations = default lens of the six modules × 2 widths; `flags_read_back` = 11 in each. **Corrected count (R1, re-verified against `report.json` obs105–116): 10 of 12 have all six claims PASS; 2 of 12 failed — obs105 (`costing-control-center · dashboard`, 1280) and obs106 (same, 390), each with `claims.security = FAIL` only.** The other ten (MCM, CBM, PPM default, CSR, PRM `route-readiness`, each at both widths) have no failing claim. Per failing observation: 16 write-verb control matches, of which **8 were enabled and visible**; those 8 are **2 distinct labels** — "Lock a single month (authorised exception)" **7 times** and "Close quarter (lock months)" **1 time** — i.e. repeated matches, not 8 different controls. The `findings` list holds 2 `WRITE_CONTROL_ENABLED` entries (one per width) whose `controls` array is truncated to the first 5 matches, which is why the run report text shows five. Controls were observed, never clicked; run-wide guard violations 0. | This is the **LOCK-P01 history** at v391 (AE1 §2 row 3). It is kept **separate from the later fix**: #212 and a focused v392 ID-V run (AE1 §2 row 3) are a different build and evidence set; they do not erase this v391 failure, and this failure does not describe v392. Default lens only; all other lenses stayed OFF. Combination (d) "all eleven ON" gains a **v391 default-lens-only** record containing that FAIL; it proves nothing for any other lens under all flags ON. |
| `WORKLIST_ONLY` (`COSTING_REVIEW_WORKLIST_V1` alone, obs117–118) | `costing-control-center · sku-control-status` at 1280 and 390: 50 rows, `flags_read_back` 1, all claims PASS, 0 errors. | AE1 §2 flag 8 / combination (c) said "not run". This is a v391 render/data-presence observation of (c) on that one lens; **S9 interplay is still untested**; REVIEW_WORKLIST ON proof elsewhere none. |

Flag restoration: `flags_restored = true` is a **run-wide** header value only (read-back at run end). There is no per-state restoration capture and no separate screenshot of restoration; the 15-row data adds none.

## 4. Hypothetical scoped-credit arithmetic — **UNAPPROVED**

> This section is **arithmetic only**. It is not an owner-ready choice to approve rows as full `P`, and not a recommendation. "P" in scenarios A/B means *hypothetically counting `RD-v391/OFF` rows as P*; that equivalence is exactly what the owner would have to decide, and it has **not** been decided. AE1's **13/4/2/21 is authoritative**.

Preserved AE1 baseline (unchanged, authoritative until the owner decides): **13 P / 4 F / 2 NA / 21 NT = 40**; NT = 15 C-D + 6 genuinely missing/blocked.

| Scenario | P | F | NA | NT | Σ | Remark |
|---|---:|---:|---:|---:|---:|---|
| **AE1 baseline (accepted)** | 13 | 4 | 2 | 21 | 40 | unchanged |
| **A — hypothetical: all 15 counted** (upper bound only; conflicts with §2 row 31) | 28 | 4 | 2 | 6 | 40 | 13+15 = 28; NT 21−15 = 6 |
| **B — hypothetical: 14 counted, `shared-workload-preview` held NT** (consistent with §2) | 27 | 4 | 2 | 7 | 40 | 13+14 = 27; NT 21−14 = 7 |
| **C — owner requires v392 evidence for the three shell-differing files** | 13 | 4 | 2 | 21 | 40 | v391 not accepted for any row; baseline stands |

Check: A 28+4+2+6 = 40; B 27+4+2+7 = 40; C 13+4+2+21 = 40. In B, 13 of the 27 are AE1's P rows and **14 would be limited v391/OFF sub-evidence only**. The 7 NT in B are `shared-workload-preview` plus the six unchanged AE1 rows (the only NT rows in A): `staff-governance` (7 vs 42 reconciliation), `route-family-route-editor` (F1 unaudited), `product-route-editor`, `historical-candidate-review`, `route-family-mapping-review`, `route-family-foundation-review`. The 4 F (`scheme-master`, `printable-cost-sheet`, `cost-comparison`, `production-cost-centres`) and the 2 NA (`rm-cost-trace`, `pm-cost-trace`) are untouched. These totals are arithmetic only: they are not a recommendation, are not approved, and **do not change the programme total (6/13) or WP05's OPEN status**; a hypothetical total of 27 or 28 of 40 is not the 40-lens/11-flag contract being met (11-flag, negative-identity, S2/S9 and server-denial obligations remain open).

## 5. Exact remaining gaps (unchanged by this evidence)

1. **S2** printable Cost Sheet ↔ SKU detail for three real SKUs (READY/REVIEW/BLOCKED) — not tested (D: report has no such record).
2. **S9** CCC KPI ↔ SKU Control Status parity after Nov/Oct switch — not tested. Only run labels were logged (Nov draft 149, Oct approved 143); the dashboard Oct switch is at 1280 only; the failed run 150 label did not appear in these records.
3. **v392** observation of any of the 15 rows — none in this run (v391).
4. **Period switch** for MCM/CBM/PPM/PRM: 8 recorded skips ("not selectable"); not a pass or failure.
5. **Negative identities / SEC-A1/A2 server denial**, flag combinations beyond default-lens, LOCK_SCREEN restoration record — unchanged AE1 gaps.
6. **Per-lens HTTP status and per-lens request attribution** — NOT RECORDED in `report.json`.
7. The six genuinely missing/blocked NT rows (AE1 §1.7).

## 6. Statement

- For this revision only the ALL_ON obs105–116 control/claim fields were re-read from `report.json`; no screenshot or secret file was opened.
- **No secret file, session/auth file, cookie, token or screenshot was inspected, opened, copied or committed.** Screenshots were listed by filename and size only. `identity.user_ref` and page headings were not read.
- No SQL, Supabase, browser, RPC, network call to the application, feature flag, permission, deployment, code, script, test execution, cleanup of C: or D:, or dependency installation was performed.
- Nothing here is owner-approved; `RD-v391/OFF` is limited sub-evidence, not full acceptance. No B1 decision, no edit to the WP05 gate status, no change to AE1's accepted facts. **WP05 remains OPEN; programme remains 6/13.**
