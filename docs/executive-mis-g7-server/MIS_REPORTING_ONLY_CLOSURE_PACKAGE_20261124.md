# Executive MIS — reporting-only completion package (24 Nov 2026)

Status: **candidate prepared, not merged, not released.** G7 stays **OPEN 7/11 (64%)** until the owner accepts the revised closure criteria in §5. G8 stays **parked**. No production write, permission assignment, governed-logging activation, ENFORCE switch, core sign-off, merge or publication was performed. The five protected PEC migration files in the primary checkout were not touched (all work happened in a separate git worktree).

Authority: owner boundary decision (`PRODUCTION_WORK_LOG_MODULE_BOUNDARY_DECISION.md`), PWL charter (`docs/production-work-log/PRODUCTION_WORK_LOG_WORKFLOW.md` §7) and canonical MIS workflow §85.

## 1. What this candidate is
| Item | Value |
|---|---|
| PR | draft [#526](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/526), branch `claude/executive-mis-g7-client-dmijyz` (head SHA is reported in the PR/hand-off message, a document cannot contain its own SHA) |
| Previous head (operational + reporting) | `4d292fe9a68c0478e37a8686d0eacfc08cfb3a22`, preserved as branch `preserve/pwl-operational-g7-client-20261124` |
| Base | `origin/main` = `a72af1e4` = SASV Workspace **v6.5.0** (PEC Purchase Allocations, `hub-cache-v395`), merged into the branch |
| Recommended MIS release | **6.6.0** (minor: user-visible Production-evidence drilldown) from actual current 6.5.0. Version/lock bump is the separate release commit after owner approval (same pattern as #531). The service worker is **not** changed, so no cache-name bump is needed. Owner decides. |

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
| 4 | Report accuracy of the evidence counts | R (isolated) + L (live) | Isolated PG: RPC counts/paging/validation/determinism (S7 36/36) and an independent SQL packet reproducing totals and receipt classification (1/1). **Live:** run `MIS_REPORTING_LIVE_RECONCILIATION_READONLY.sql` and compare to the dashboard window |
| 5 | Permission boundary (view only, anon denied) | R + L | Client: denial/unavailable states tested. Server: `executive-mis-dashboard` view, anon revoked (PG tests). Authenticated no-view/view sessions are owner checklist A1–A3 |
| 6 | Desktop/mobile usability | R | 320–1280 px no page overflow, table scrolls in its own wrapper, theme tokens only |
| 7 | Electron/PWA compatibility | R (static/PWA) + L (packaged) | Relative asset paths, platform-aware HOME unchanged, PWA freshness by cache keys. Packaged Electron smoke is a candidate-build step |
| 8 | Migration identity reconciliation, deployment evidence, security protections | R | Retained, hash-verified |
| 9 | WP10 S4/S6 | R | Fixed narrowly (§1) |
| 10 | Reconcile with post-PEC main, choose version | R | Merged v6.5.0; recommend 6.6.0 |
| 11 | Monetary production value (merged #493, `get_mis_production_value_summary`): reference-cost bulk value, null plan/achievement, labels | L | Unchanged by this package. Live re-verification of totals/labels against the approved cost run is an owner/server-lane read-only check |
| 12 | Transfer-exception treatment T1–T3 and comparable finished-SKU cost C1–C3 | L / D | Owner-approved policy exists in the workflow; frozen/immutable S3 report finalisation is not installed. Needs live verification of what the installed RPC does, then owner decision on D3 |
| 13 | Plan value / achievement % (frozen plan) | D3 | Live plan source too slow, removed; planned value stays NULL (`UNAVAILABLE_PENDING_FROZEN_PLAN`). Needs a server plan-freeze mechanism and policy — not independently executable |
| 14 | Completed-production value and full-batch closure | D4 | Stays NULL/`NOT_COMPARABLE`. Authoritative completion evidence is the future PWL batch book; owner decides: accept NULL until PWL, or define an interim source |
| 15 | Route-master deficiencies (52 no product route / 17 no mandatory FG stage / 1 overlap / 10 unsigned in 1–21 Nov) | D5 | Data stewardship in Production Route Manager (the existing authority, no second master); MIS only reports |
| 16 | Authenticated current-production PWA checks; security/performance proof on production | L | Owner checklist §6; production EXPLAIN/timing read-only run by server lane. Isolated 92-day/400-batch bound passes |
| 17 | G8 Alerts (catalogue, thresholds, owner action, severity, dedup) | D2 (parked) | Not started. Evidence exceptions are a candidate alert source; thresholds/ownership are owner policy |
| 18 | G9 cross-tab hardening / G10 independent release | pending | Applies to changed surface only: new panel meets paging, latest-wins, empty/error/loading, responsive. Cross-tab hardening and G10 remain future gates |
| 19 | Governed stage signing, packing, measured-excess, pack-line correction UI | T | Preserved reference; PWL P3 |
| 20 | Add/Edit/Update Log Status hand-offs; non-destructive field-only save; governed packaging-event creation contract | T | PWL P1–P3 (absorbs the three modules) |
| 21 | Mandatory FG receipt before packaging; authorised measured excess in the same interaction | T | Accepted requirement carried to PWL; server objects stay installed |
| 22 | Permission assignment, governed-logging activation, ENFORCE, core sign-off | T | Separate owner authorisation; not done |
| 23 | Evidence-first repair of 29 missing-depletion lines / 9 no-receipt logs | T | Operational ledger correction under PWL/FG Bulk; MIS keeps showing them as exceptions |
| 24 | Operator acceptance sequences B and C (real production logging, governed signing/packing) | T | Moved to PWL P5 pilot |
| 25 | Registry: applied `mis-batch-governance` module still launchable (Electron/PWA) with a page no longer shipped | D1 | Zero users hold the target, so nobody sees a dead link. Proposed reversible `REGISTRY_BATCH_GOVERNANCE_DORMANCY_PROPOSAL_NOT_APPLIED.sql` (navigation off only); applying it is a production data change needing owner authorisation |

## 4. Reporting limitations to keep visible
1. Historical (pre cut-over) evidence is `NOT_VERIFIED` — absence of a signature is not a defect of the batch and is never converted to SIGNED.
2. The exception summary reads `daily_work_log`; PWL must re-point it before that table is retired (parity test required).
3. Counts are per distinct product/batch per state; states overlap by design; findings can list a batch more than once.
4. Window ≤ 92 days (server bound). Reference snapshot figures are dated 24 Nov 2026 and never recomputed client-side.
5. Planned value, achievement % and completed-production value remain unavailable (rows 13–14).

## 5. Proposed reporting closure criteria (for owner acceptance; G7 stays 7/11 until accepted)
1. This reporting-only PR merged and released as 6.6.0 with operational UI absent and legacy logging unchanged.
2. Owner acceptance checklist A1–A6 (§6) passed on the candidate build.
3. Live reconciliation packet run read-only; dashboard figures equal the independent SQL for the same window; validator distribution recorded; value-summary totals/labels re-verified against the approved cost run.
4. Every MIS metric is either live-sourced with its evidence label or explicitly shown as unavailable/NOT_COMPARABLE, with the owner accepting rows 13–14 (D3, D4) as limitations or deferring them to PWL.
5. Rows classified T acknowledged as transferred (PWL traceability), D1–D5 answered.
6. G8 re-opened only after items 1–5 under its own scope decision.

## 6. Owner acceptance checklist (candidate build)
- **A1** User without MIS view: Executive MIS gate shows no data; no evidence RPC result.
- **A2** User with MIS view: Production tab → open "Production evidence status": counts load, window switch works, Next/Previous page, no link/button to any operational page.
- **A3** Old batch findings read *Not verified* (historical), never *Unsigned*; section shows the dated "not live" snapshot.
- **A4** Dashboard figures equal `MIS_REPORTING_LIVE_RECONCILIATION_READONLY.sql` Q1–Q3 for the same window (read-only; replace the dates).
- **A5** PWA hard refresh and airplane mode on an installed PWA; Electron candidate opens the dashboard; Add/Edit Log Entry behave exactly as before.
- **A6** Phone width (≤ 390 px): no sideways page scroll, table scrolls inside its box.
- Decisions: **D1** registry dormancy (apply the proposal or leave), **D2** G8 scope, **D3** plan-freeze mechanism, **D4** completed-production source, **D5** route-master clean-up owner, plus version **6.6.0** and merge authorisation.

## 7. Candidate build plan (do not execute without owner authorisation)
1. Owner approves; merge the PR to `main` (governed activation does not exist in this candidate).
2. Release commit from `main`: version 6.6.0 in `package.json`/`package-lock.json` and release notes; no service-worker change.
3. Windows candidate with the normal electron-builder script as an unpublished artifact; run `scripts/electron-smoke/*` (needs the Electron binary), `scripts/pec-electron-acceptance.mjs`, the reporting suite; confirm the packaged app opens the dashboard.
4. Do not publish the GitHub release/updater feed until A1–A6 pass on the candidate.

## 8. Outstanding reporting blockers and shortest route
**Blockers:** (a) live read-only verification (row 4, 11, 12, 16) — needs an authenticated owner/server-lane run, not possible from this environment; (b) owner decisions D1–D5; (c) Electron packaged smoke needs the binary.
**Shortest route:** owner runs the reconciliation packet and A1–A6 on the candidate PWA/Electron build → answers D1–D5 → authorises merge → release commit 6.6.0 → publish → owner accepts revised closure (G7 moves only then). PWL P0 can start in parallel (discovery only, no schema writes).
