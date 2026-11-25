# Executive MIS — reporting-only completion package (24 Nov 2026; reconciled 25 Nov 2026)

> **Reconciliation notice (25 Nov 2026).** This document is reconciled with the authoritative `MIS_REPORTING_OWNER_DECISIONS_LIVE_RECEIPT_20261125.md`. Where this document and that receipt differ, the receipt wins. Changes: (1) owner decisions D1–D5 are **approved**; (2) D1 is **applied and verified in production** — do not replay; (3) latest `main` is **v6.5.1** (not 6.5.0); the branch was merged with it; (4) live window figures are now reconciled live and are kept visibly separate from dated reference figures (§2A); (5) §3 rows 4, 5, 11–14, 16, 17, 25 and §§5–8 are updated below. Text below that still says "v6.5.0 / not applied / owner decides D1–D5" is superseded by this notice.
>
> **Still open (not silently closed):** D2 management alerts (MIS work package), D3 frozen production planning (MIS work package), C1–C3 / T1–T3 immutable, as-of transfer and comparable-SKU-cost reporting, formal G7 acceptance (**OPEN 7/11**), G8 (**parked**), PWL **0/7**. D4 verified completed-production value is **deferred to Production Work Log**. D5 route stewardship is assigned to Production Route Manager / PWL.

## 2A. Live window evidence vs dated reference (distinction rule)
| Kind | Figure | Basis |
|---|---|---|
| **LIVE, window-dependent** (read-only, 26 Oct–24 Nov 2026; recompute for any other window) | 121 product-batches, 173 packing lines, 41 lines without depletion; states NOT_VERIFIED 121 / UNSIGNED 28 / MISSING_ROUTE 78 / MISSING_RECEIPT 28; 255 findings | Independent SQL = deployed RPC, exact |
| LIVE, window-dependent | 92-day window 25 Aug–24 Nov: 309 batches, 541 lines, 143 without depletion, 669 findings, server-paged (50 rows), ≈4.8 s incl. connector | SQL-level view-permission context; not a browser/auth-role end-to-end test; no load benchmark |
| LIVE, all-time validator | FG receipt validator over all positive FG logs: 1,671 OK, 9 NO_SOURCE_LEDGER, 1,680 total | live |
| **DATED REFERENCE** (24 Nov snapshot, shown as "not live") | 29 missing-depletion lines; route-master deficiencies (52 / 17 / 1 / 10 for 1–21 Nov) | Historical; **29 is not this window's live count (41)** |
| LIVE, reference-cost basis (partial) | Nov 1–24 bulk receipt reference value INR 3,230,986.84; 81 events, 2 unvalued; approved costing run 143, valuation 2026-10-22 | Covered reference value only — **not** certified completed-production value |
| LIVE, Tally book basis | Nov 1–24 FG transfer book value INR 3,726,189.40; 228 lines; 0 missing amounts | Accounting book total. **Not** reconciled completed-production value and not comparable to the reference-cost figure |
| LIVE, view evidence (not an immutable as-of report) | `v_fg_transfer_reconciliation` Nov 1–24: MATCHED 106 groups INR 3,668,354.77; MISSING_LOG 6 groups INR 57,834.63; sum = INR 3,726,189.40 | The existing monetary RPC does **not** contain this split; no source corrections authorised; not proof of C1–C3 |
| **Unavailable labels (must remain)** | Frozen plan `UNAVAILABLE_PENDING_FROZEN_PLAN`; plan achievement % N/A; completed-production value null / `NOT_VERIFIED` / `NOT_COMPARABLE`; transfer `NOT_CHECKED_BY_BOOK_TOTAL` | Pending D3 (plan) and D4→PWL (completion value) |
| Permissions | Both public reporting functions STABLE; authenticated EXECUTE true; anon false (anonymous execution denied) | live |

Do not repeat these live checks without fresh evidence of drift.


Status: **candidate prepared, not merged, not released.** G7 stays **OPEN 7/11 (64%)** until the owner accepts the revised closure criteria in §5. G8 stays **parked**. No production write, permission assignment, governed-logging activation, ENFORCE switch, core sign-off, merge or publication was performed. The five protected PEC migration files in the primary checkout were not touched (all work happened in a separate git worktree).

Authority: owner boundary decision (`PRODUCTION_WORK_LOG_MODULE_BOUNDARY_DECISION.md`), PWL charter (`docs/production-work-log/PRODUCTION_WORK_LOG_WORKFLOW.md` §7) and canonical MIS workflow §85.

## 1. What this candidate is
| Item | Value |
|---|---|
| PR | draft [#526](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/526), branch `claude/executive-mis-g7-client-dmijyz` (head SHA is reported in the PR/hand-off message, a document cannot contain its own SHA) |
| Previous head (operational + reporting) | `4d292fe9a68c0478e37a8686d0eacfc08cfb3a22`, preserved as branch `preserve/pwl-operational-g7-client-20261124` |
| Base | `origin/main` = `2cd26e62` = SASV Workspace **v6.5.1** (PEC Purchase Allocations mobile patch, `hub-cache-v396`), merged into the branch on 25 Nov 2026 (earlier base `a72af1e4` = v6.5.0). The only merge conflict was the additive PEC protected-path guard pin list; both the v6.5.1 pin and the MIS pins are kept. |
| Recommended MIS release | **6.6.0** (minor: user-visible Production-evidence drilldown) from actual current stable **6.5.1**. Version/lock bump is the separate release commit after owner approval (same pattern as #531). The service worker is **not** changed, so no cache-name bump is needed. Owner decides. |

### Client changes (net vs. main)
- `executive-mis-dashboard.html` / `.js` + new `js/mis-evidence-report.js`: Production tab "Production evidence status" is a **read-only report**: state definitions, window (7/30/92 days), live counts with units/cut-over, a **server-paged findings drilldown** (product, batch, evidence state, finding), explicit read-only statement, **no link or control that leaves reporting**, dated reference snapshot clearly labelled *not live*, receipt-validator limitation (1,671 of 1,680 exact, 9 none). Denied / unavailable / error / loading states; latest-request-wins; HTML-escaped.
- Reads only `mis_get_governance_exception_summary_v1` (permission: executive-mis-dashboard view — no new target, nothing assigned).
- Dashboard script cache keys bumped (`?mis-c1=g7r-evidence-report-1`, `?mis-g7r=1` on the module import) so installed PWAs cannot pair new HTML with a cached old script. `public/sw.js`, `js/log-add.js`, `js/log-edit.js` are byte-identical to main; Add/Edit/Update Log Status are unchanged.
- Removed from the candidate (preserved on the PWL reference, see `docs/production-work-log/PWL_REUSE_MANIFEST_20261124.md`): Batch Governance page/JS/CSS, governed hand-off module, operational contract layer, Add/Edit hooks, SW block and its guard pins, operational client tests.

### Server / governance retained unchanged
All **eleven** installed migrations (S2–S6, S7a/b/c) with registered versions, `MIGRATION_IDENTITIES.json` (11 LIVE, none pending, sha256 verified against the files by a test), deployment map/receipts, rollback guides, AUDIT mode, core gate `CORE_MIGRATION_NOT_ACCEPTED`. None edited, renamed, replayed or reversed.

### WP10 S4/S6 — narrow reviewed approved delta
`scripts/wp10-g2-safeguards/mis-g7-reporting-approved-delta.mjs` + `REVIEWED_MIS_G7_FILES` in the PEC protected-path guard. Exactly: the 3 reporting client paths on this branch only (S4); the 11 installed migrations and the 25-file isolated PG harness, each content-pinned by LF-SHA256 and head-branch-scoped (S6/guard). Mutation tests prove: a one-byte edit, another branch, a renamed copy, no context and `public/sw.js` are all still rejected. No unrelated protection was weakened; S5 (SW byte identity) now passes without any exemption because the SW is untouched.

## 2. Test results (this environment: Linux, PostgreSQL 16, Playwright Chromium)
| Suite | Result |
|---|---|
| Reporting client (`scripts/mis-g7-reporting`) | report 7/7, static boundary 8/8, browser dashboard 4/4 (drilldown paging, window change, denied/unavailable/error, 320/390/520/768/1280 overflow), reconciliation vs real S2–S7c in isolated PG 1/1 |
| Server isolated PG16 | policy 3/3; core 64 pass + 1 skip; acceptance 21/21; live-editor 21/21; prod-equivalent 5 + 1 skip; **S7 36/36** |
| Server real-catalog replay | **0 run / 41 skipped — BLOCKED**: private production packets are git-ignored and absent here (owner accepted this limitation) |
| WP10 safeguards + PEC protected-path guard | **202/202** |
| Full `scripts/**/*.test.mjs` (1,926 tests) | 1,877 pass / 23 fail / 25 skip — **the identical 23 failures and the same totals on untouched `origin/main`; zero failures unique to this branch** (compared by test name) |
| MIS-C1 dashboard, FG-BIT-UX-1, Electron security-hardening | 121/124; the 3 failures (`mis-launcher-route` #120, fg-bit-ux-1 #22 #42) are identical on `main` |
| Not run | Electron packaged smoke / updater tests (Electron binary and artifacts unavailable here — the same tests fail/skip on `main`); real authenticated sessions; live DB |

## 3. Requirement classification (nothing silently closed)
R = reporting, done in this package · L = reporting, code complete, **needs live read-only/authenticated verification I cannot perform** · T = operational, **explicitly transferred to Production Work Log** · D = **genuine dependency, owner decision**.

| # | Requirement | Class | Status / evidence |
|---|---|---|---|
| 1 | Executive MIS strictly read-only; no operational UI/navigation in MIS | R | Done; static test forbids operational RPC/route/link in the report client |
| 2 | Status/exception drilldown without operational links | R | Done; paged findings table, tested |
| 3 | Historical records classified, no fabricated signatures/values/movements; limitations stated | R | Done: NOT_VERIFIED label, dated reference snapshot, 29 missing-depletion lines, 9 no-receipt logs, route-master deficiencies shown as limitations, never backfilled |
| 4 | Report accuracy of the evidence counts | R + **live verified 25 Nov** | Isolated PG: S7 36/36 and independent packet 1/1. **Live: independent SQL and deployed RPC agree exactly** (121 / 173 / 41; §2A). Do not repeat without drift evidence |
| 5 | Permission boundary (view only, anon denied) | R + L (SQL-level verified) | Live SQL-level check passed (view target works, anon denied). Genuine signed-in no-view/view browser sessions remain owner checklist A1–A3 |
| 6 | Desktop/mobile usability | R | 320–1280 px no page overflow, table scrolls in its own wrapper, theme tokens only |
| 7 | Electron/PWA compatibility | R (static/PWA) + L (packaged) | Relative asset paths, platform-aware HOME unchanged, PWA freshness by cache keys. Packaged Electron smoke is a candidate-build step |
| 8 | Migration identity reconciliation, deployment evidence, security protections | R | Retained, hash-verified |
| 9 | WP10 S4/S6 | R | Fixed narrowly (§1) |
| 10 | Reconcile with post-PEC main, choose version | R | Merged v6.5.0; recommend 6.6.0 |
| 11 | Monetary production value (merged #493, `get_mis_production_value_summary`): reference-cost bulk value, null plan/achievement, labels | **Live verified 25 Nov** | INR 3,230,986.84 / 81 events / 2 unvalued matches independent arithmetic (run 143); Tally 3,726,189.40 / 228 lines matches. Labels unchanged: reference value is partial, Tally is a book basis, neither is completed-production value |
| 12 | Transfer-exception treatment T1–T3 and comparable finished-SKU cost C1–C3 | **OPEN (MIS work package)** | Live view reconciliation exists (106 matched / 6 missing-log groups) but the installed RPC has no detailed split, no immutable as-of report and no comparable-SKU cost policy. Not implemented; not closed |
| 13 | Plan value / achievement % (frozen plan) | **D3 approved — OPEN MIS work package** | Owner retains frozen production planning as an independent MIS requirement. Not implemented; planned value stays NULL (`UNAVAILABLE_PENDING_FROZEN_PLAN`), achievement N/A. Needs a server plan-freeze mechanism and policy |
| 14 | Completed-production value and full-batch closure | **D4 approved — deferred to PWL** | Stays NULL / `NOT_VERIFIED` / `NOT_COMPARABLE` until the canonical Production Work Log supplies reliable completion evidence. No interim source |
| 15 | Route-master deficiencies (dated reference: 52 no product route / 17 no mandatory FG stage / 1 overlap / 10 unsigned in 1–21 Nov) | D5 approved | Data stewardship in Production Route Manager (the existing authority, no second master); MIS only reports |
| 16 | Authenticated current-production PWA checks; security/performance proof on production | L (SQL-level done) | 92-day evidence RPC live: 309 batches, ≈4.8 s incl. connector, server-paged. Browser/authenticated-role checks remain owner A1–A6 |
| 17 | G8 Alerts (catalogue, thresholds, owner action, severity, dedup) | **D2 approved — OPEN MIS work package; G8 parked** | Management alerts continue as reporting-only MIS functionality. Not started/implemented; thresholds/ownership to be specified under G8 |
| 18 | G9 cross-tab hardening / G10 independent release | pending | Applies to changed surface only: new panel meets paging, latest-wins, empty/error/loading, responsive. Cross-tab hardening and G10 remain future gates |
| 19 | Governed stage signing, packing, measured-excess, pack-line correction UI | T | Preserved reference; PWL P3 |
| 20 | Add/Edit/Update Log Status hand-offs; non-destructive field-only save; governed packaging-event creation contract | T | PWL P1–P3 (absorbs the three modules) |
| 21 | Mandatory FG receipt before packaging; authorised measured excess in the same interaction | T | Accepted requirement carried to PWL; server objects stay installed |
| 22 | Permission assignment, governed-logging activation, ENFORCE, core sign-off | T | Separate owner authorisation; not done |
| 23 | Evidence-first repair of 29 missing-depletion lines / 9 no-receipt logs | T | Operational ledger correction under PWL/FG Bulk; MIS keeps showing them as exceptions |
| 24 | Operator acceptance sequences B and C (real production logging, governed signing/packing) | T | Moved to PWL P5 pilot |
| 25 | Registry: `mis-batch-governance` module launchable with a page no longer shipped | **D1 APPLIED and verified in production (25 Nov)** | Exact approved proposal applied once: navigation disabled for both clients, all six MIS targets preserved, zero assignments, AUDIT unchanged. **Do not replay.** Registry is dormant pending independent PWL cutover. See the receipt and the notice in `REGISTRY_BATCH_GOVERNANCE_DORMANCY_PROPOSAL_NOT_APPLIED.sql` |

## 4. Reporting limitations to keep visible
1. Historical (pre cut-over) evidence is `NOT_VERIFIED` — absence of a signature is not a defect of the batch and is never converted to SIGNED.
2. The exception summary reads `daily_work_log`; PWL must re-point it before that table is retired (parity test required).
3. Counts are per distinct product/batch per state; states overlap by design; findings can list a batch more than once.
4. Window ≤ 92 days (server bound). Reference snapshot figures are dated 24 Nov 2026 and never recomputed client-side.
5. Planned value, achievement % and completed-production value remain unavailable (rows 13–14).

## 5. Reporting closure criteria (status 25 Nov; G7 stays OPEN 7/11 until formally accepted)
Status: criterion 3 live reconciliation **done** (§2A); criterion 5 D1–D5 **answered**; criteria 1, 2, 4 pending merge/release/A1–A6; D2/D3 remain MIS obligations and are not part of closing this reporting release.

1. This reporting-only PR merged and released as 6.6.0 with operational UI absent and legacy logging unchanged.
2. Owner acceptance checklist A1–A6 (§6) passed on the candidate build.
3. Live reconciliation packet run read-only; dashboard figures equal the independent SQL for the same window; validator distribution recorded; value-summary totals/labels re-verified against the approved cost run.
4. Every MIS metric is either live-sourced with its evidence label or explicitly shown as unavailable/NOT_COMPARABLE, with the owner accepting rows 13–14 (D3, D4) as limitations or deferring them to PWL.
5. Rows classified T acknowledged as transferred (PWL traceability), D1–D5 answered (**done**; D2/D3 stay open MIS packages, D4 deferred to PWL, D5 to PRM/PWL).
6. G8 re-opened only after items 1–5 under its own scope decision.

## 6. Owner acceptance checklist (candidate build)
- **A1** User without MIS view: Executive MIS gate shows no data; no evidence RPC result.
- **A2** User with MIS view: Production tab → open "Production evidence status": counts load, window switch works, Next/Previous page, no link/button to any operational page.
- **A3** Old batch findings read *Not verified* (historical), never *Unsigned*; section shows the dated "not live" snapshot.
- **A4** Dashboard figures equal `MIS_REPORTING_LIVE_RECONCILIATION_READONLY.sql` Q1–Q3 for the same window (read-only; replace the dates).
- **A5** PWA hard refresh and airplane mode on an installed PWA; Electron candidate opens the dashboard; Add/Edit Log Entry behave exactly as before.
- **A6** Phone width (≤ 390 px): no sideways page scroll, table scrolls inside its box.
- Decisions D1–D5 are approved (see notice). Remaining owner authorisations: version **6.6.0** release commit, merge, publication.
- A2/A3 wording check (25 Nov): the live panel shows live counts for the selected window; the Historical block is labelled "reference snapshot, 24 Nov 2026 … not live" and its 29-line figure must not be compared with the live 41-line count.

## 7. Candidate build plan (do not execute without owner authorisation)
0. (25 Nov) Unpublished Windows candidate is produced by the existing `electron-release-candidate.yml` (`workflow_dispatch`, `--publish never`, artifact only) from the PR head, version 6.5.1 (unbumped). The 6.6.0 bump remains a separate post-merge release commit.
1. Owner approves; merge the PR to `main` (governed activation does not exist in this candidate).
2. Release commit from `main`: version 6.6.0 in `package.json`/`package-lock.json` and release notes; no service-worker change.
3. Windows candidate with the normal electron-builder script as an unpublished artifact; run `scripts/electron-smoke/*` (needs the Electron binary), `scripts/pec-electron-acceptance.mjs`, the reporting suite; confirm the packaged app opens the dashboard.
4. Do not publish the GitHub release/updater feed until A1–A6 pass on the candidate.

## 8. Outstanding reporting blockers and shortest route
**Blockers (25 Nov):** (a) owner A1–A6 on the candidate with genuine signed-in sessions; (b) merge, 6.6.0 release commit and publication authorisations; (c) packaged Windows smoke result from the hosted build (not runnable on Linux here). Live read-only reconciliation and owner decisions D1–D5 are **no longer blockers**.
**Shortest route:** owner runs the reconciliation packet and A1–A6 on the candidate PWA/Electron build → answers D1–D5 → authorises merge → release commit 6.6.0 → publish → owner accepts revised closure (G7 moves only then). PWL P0 can start in parallel (discovery only, no schema writes).
