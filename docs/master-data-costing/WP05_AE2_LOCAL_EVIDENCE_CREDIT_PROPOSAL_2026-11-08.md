# WP05-AE2 — Local D: evidence-credit proposal (8 November 2026)

**Status: PROPOSAL ONLY — UNAPPROVED. WP05 OPEN. Programme 6/13 (46.2%) unchanged. WP06 remains formally closed.** Documentation-only extraction for issue #234 (WP05-AE2 handoff). It records what the owner's already-generated local run report contains for the 15 AE1 "C-D" NT rows, and **proposes** delta classifications. It changes no AE1 fact, approves nothing, records no owner decision, makes no B1 decision and does not edit the WP05 gate status.

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
| Runner definition used | `scripts/costing-acceptance/acceptance-runner.mjs` on `origin/main` (read via git). The report's runner commit is `0d30610` (per the consolidated report); **the file on `main` may differ from it**, so semantics below are "as in the `main` version", not verified against `0d30610`. |

### 0.1 What the recorded fields actually mean (so nothing is over-read)

- **`rows`** = number of `table tbody tr` elements with more than one cell, excluding rows starting "No …/0 rows/Loading". It proves *a table with data rows rendered*; it is **not** a total count, not a source-count match, and values such as 25 or 50 may be page-size caps (not determined).
- **`claims.data = PASS`** = `rows > 0` only. It is **not** a correctness check. Empty tables are `NOT TESTED (no rows)` and are not passes.
- **`claims.render = PASS`** = module chrome became ready, no horizontal overflow (≤1 px), **and no `console.error`/page error** during the observation. This is the only HTTP-health signal: a failing resource load would appear as a console error (as it did for readiness and scheme-master). **A per-lens HTTP status is NOT RECORDED.**
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

Proposed status vocabulary: **P-v391/OFF** = the lens met AE1's definition of P ("independently captured ID-V authenticated observation at the stated build") **at v391, flags OFF, 1280+390 px, render/data-presence scope only**. It is **not** a build-parity claim for v392, not a correctness/source-count match, and not a functional/interaction pass.

| AE1 row | Lens | Proposed | Basis | Exact remaining gap (not closed by this evidence) |
|---:|---|---|---|---|
| 1 | `dashboard` | **P-v391/OFF** | Both widths ready, 1 data row, 0 errors, 0 overflow, 0 enabled write controls. Run labels observed for Nov (149) and Oct (143, with newer draft 148); the Nov label is not run 150. | **S9 KPI ↔ SKU Control Status parity: NOT tested** (a label is not a KPI value). Oct period-switch observed at 1280 only. v392 not observed. Note: the same lens at `ALL_ON` produced a security FAIL (§3) — separate flag-state history, retained, not erased by this row. |
| 2 | `costing-review-workbench` | **P-v391/OFF** | 50 rows both widths, clean. | v392; correctness of rows unverified; no run label logged; period switch for this lens not recorded. |
| 3 | `sku-control-status` | **P-v391/OFF** | 50 rows both widths, clean; run label draft 149. | S9 parity; v392; correctness. |
| 5 | `manual-rate-manager` | **P-v391/OFF** | 25 rows both widths, clean. | Period not selectable (AE1: picker disabled by design; not a test). Rows may be a cap. v392. |
| 8 | `cost-governance` | **P-v391/OFF** | Single data row both widths, clean. | Period switch not recorded (not selectable); pool-summary period switch (AE1 row 8 gap) untested; 1 row means a minimal table, correctness unverified. v392. |
| 11 | `driver-governance` | **P-v391/OFF** | 7 rows both widths, clean. | Correctness unverified; v392. |
| 22 | `sku-cost-sheet` | **P-v391/OFF** | 25 rows both widths, clean; Nov draft 149 and Oct approved 143 labels observed (Oct at 1280 only). | **S2 printable ↔ SKU detail parity for three real SKUs: NOT tested.** v392. |
| 25 | `scheme-comparison` | **P-v391/OFF** | 25 rows both widths, clean. | v392; correctness; no ID-V recheck at v392. |
| 26 | `qc-action-queue` | **P-v391/OFF** | 25 rows both widths, clean. | as row 25 |
| 27 | `materials-stores-action-queue` | **P-v391/OFF** | 25 rows both widths, clean. | as row 25 |
| 29 | `product-route-assignments` | **P-v391/OFF** | 25 rows both widths, clean, no write controls found. | v392; correctness. |
| 30 | `product-subgroup-mappings` | **P-v391/OFF** | 16 rows both widths, clean. | as row 29 |
| 31 | `shared-workload-preview` | **P-v391/OFF — with an explicit caveat** | 50 rows, clean, run-wide guard 0 violations/0 blocked, so no non-read request reached the backend during the run. | **The lens name implies a preview.** Per-lens request attribution is not recorded, so the read-only status of the RPC set this lens uses is **unconfirmed** by this evidence (AE1 row 31 "RPC classification" gap stays open). The owner may prefer to keep this row NT until that is classified. |
| 32 | `route-families` | **P-v391/OFF** | 87 rows both widths, clean. | v392; correctness. |
| 40 | `archived-routes` | **P-v391/OFF** | 25 rows both widths, clean. | v392; correctness. |

**How many of the 15 had adequate local evidence:** 15 of 15 have a complete OFF pair (1280 + 390) with data rows, no console errors, no overflow and no enabled write control. 14 are proposed without reservation; **1 (`shared-workload-preview`) carries a caveat** that the owner may decide keeps it NT. **How many would remain NT under the proposal:** 0 of the 15 (6 other NT rows are untouched; see §4).

### 2.1 What was explicitly **not** concluded

- No row is treated as P merely because it has `rows > 0` at v392 — no v392 observation exists in this run for any of the 15.
- The 119-observation aggregate is not used as a per-lens PASS.
- Restricted/empty/guard-blocked cases: none of the 15 was restricted, empty or guard-blocked (all `rows > 0`, `restricted 0`). The ones that **were** empty in this run (rm/pm trace, staff-governance, manual-provisions, route-family review lenses, product/historical route editors, effective-route-viewer, etc.) are **not** touched by this proposal and keep their AE1 status.
- No actual product/SKU/person names, costs, headers, authorisation payloads or raw URLs were read or are quoted.

## 3. Additional observed states (flag-matrix input; separate from lens credit)

These are D: observations at v391 that AE1 §2 treated as absent. They are listed for owner review; **nothing here changes any AE1 flag row**.

| State | Observed (v391, ID-V, 1280+390) | Scope limit |
|---|---|---|
| `NAV_ONLY` (`COSTING_NAV_GROUPS_V1` alone, obs93–104) | 12 observations = **default lens of all six modules** × 2 widths; each `flags_read_back` = 1; all claims PASS; 0 console errors; 0 overflow. | Default lens of each module only; grouped-markup behaviour of other lenses and v392 not observed. AE1 row 9 listed CCC/MCM/CBM/CSR/PRM as missing; this run would add **default-lens render/data-presence** observations for them at v391 only. PPM already has a stronger v392 record. |
| `ALL_ON` (all eleven flags, obs105–116) | 12 observations = default lens of the six modules × 2 widths; `flags_read_back` = 11. **11 of 12 all claims PASS. `costing-control-center · dashboard` at both widths: `claims.security = FAIL`** — 8 enabled+visible write-control matches (finding type `WRITE_CONTROL_ENABLED`, "Lock a single month (authorised exception)" ×5 recorded per width). Controls were observed, never clicked; guard violations 0. | This is the LOCK-P01 history (AE1 §2 row 3, fixed in #212 and re-observed in a focused v392 ID-V run). It is a **retained failure at v391**, not overwritten. Default lens only; all other lenses stayed OFF. Combination (d) "all eleven ON" would gain a **v391 default-lens-only** observation, with that FAIL. |
| `WORKLIST_ONLY` (`COSTING_REVIEW_WORKLIST_V1` alone, obs117–118) | `costing-control-center · sku-control-status` at 1280 and 390: 50 rows, `flags_read_back` 1, all claims PASS, 0 errors. | AE1 §2 flag 8 / combination (c) said "not run". This is a v391 render/data-presence observation of (c) on that one lens; **S9 interplay is still untested**; REVIEW_WORKLIST ON proof elsewhere none. |

Flag restoration: the run header records `flags_restored = true` (read-back). There is no separate all-eleven-OFF restoration capture in the 15-row data.

## 4. Reconciliation of aggregate totals — **UNAPPROVED**

Preserved AE1 baseline (unchanged, authoritative until the owner decides): **13 P / 4 F / 2 NA / 21 NT = 40**; NT = 15 C-D + 6 genuinely missing/blocked.

| Scenario | P | F | NA | NT | Σ | Remark |
|---|---:|---:|---:|---:|---:|---|
| **AE1 baseline (accepted)** | 13 | 4 | 2 | 21 | 40 | unchanged |
| **A — all 15 credited at P-v391/OFF** (proposal) | 28 | 4 | 2 | 6 | 40 | 13+15 = 28; NT 21−15 = 6 |
| **B — A, but `shared-workload-preview` held NT** | 27 | 4 | 2 | 7 | 40 | caveat in §2 row 31 |
| **C — owner requires v392 evidence for the three shell-differing files** | 13 | 4 | 2 | 21 | 40 | v391 not accepted for any row; baseline stands |

Check: A 28+4+2+6 = 40; B 27+4+2+7 = 40; C 13+4+2+21 = 40. Of the 28 P in A, 13 are as in AE1 (v392 or ID-V captured), **15 would be P at v391/OFF only**. The 6 remaining NT in A are unchanged AE1 rows: `staff-governance` (7 vs 42 reconciliation), `route-family-route-editor` (F1 unaudited), `product-route-editor`, `historical-candidate-review`, `route-family-mapping-review`, `route-family-foundation-review`. The 4 F (`scheme-master`, `printable-cost-sheet`, `cost-comparison`, `production-cost-centres`) and the 2 NA (`rm-cost-trace`, `pm-cost-trace`) are untouched. These totals are arithmetic only: they are not a recommendation, are not approved, and **do not change the programme total (6/13) or WP05's OPEN status**; a lens-ledger total of 28/40 is not the 40-lens/11-flag contract being met (11-flag, negative-identity, S2/S9 and server-denial obligations remain open).

## 5. Exact remaining gaps (unchanged by this evidence)

1. **S2** printable Cost Sheet ↔ SKU detail for three real SKUs (READY/REVIEW/BLOCKED) — not tested (D: report has no such record).
2. **S9** CCC KPI ↔ SKU Control Status parity after Nov/Oct switch — not tested. Only run labels were logged (Nov draft 149, Oct approved 143); the dashboard Oct switch is at 1280 only; the failed run 150 label did not appear in these records.
3. **v392** observation of any of the 15 rows — none in this run (v391).
4. **Period switch** for MCM/CBM/PPM/PRM: 8 recorded skips ("not selectable"); not a pass or failure.
5. **Negative identities / SEC-A1/A2 server denial**, flag combinations beyond default-lens, LOCK_SCREEN restoration record — unchanged AE1 gaps.
6. **Per-lens HTTP status and per-lens request attribution** — NOT RECORDED in `report.json`.
7. The six genuinely missing/blocked NT rows (AE1 §1.7).

## 6. Statement

- **No secret file, session/auth file, cookie, token or screenshot was inspected, opened, copied or committed.** Screenshots were listed by filename and size only. `identity.user_ref` and page headings were not read.
- No SQL, Supabase, browser, RPC, network call to the application, feature flag, permission, deployment, code, script, test execution, cleanup of C: or D:, or dependency installation was performed.
- Nothing here is owner-approved. No B1 decision, no edit to the WP05 gate status, no change to AE1's accepted facts. **WP05 remains OPEN; programme remains 6/13.**
