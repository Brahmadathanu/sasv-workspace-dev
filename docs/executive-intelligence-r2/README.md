# Executive Intelligence client — owner-approved design baseline (R2–R5)

Initial client PR #541 was stacked on server PR #540; subsequent R5 PRs #542, #543 and #544 are merged. Module key, route and permission target `executive-mis-dashboard` are unchanged. The only launcher change is one narrow exception in `public/shared/js/module-registry.js` (sales-only entry). The final R5 cosmetic delta contains no migration, registry data, grant, service-worker or Electron version change.

- `R5_PRODUCTION_UX_RECEIPT_20261126.md`: R5 production UX harmonisation receipt (HOME parity, freshness, canonical controls, strips, before/after evidence, guard decision, acceptance checklist).
- `r5-before/`, `r5-after/`: synthetic before/after renders (390 and 1280, every lens and sales sub-view).
- `LIVE_INTEGRATION_RECEIPT_20261126.md`: consolidated receipt for the live-contract integration (commit identity, tests, screenshots, owner acceptance checklist).
- `R3_PARITY_MATRIX.md`: Sales Viewer functional parity against the installed contracts, gaps and the sales-only entry.
- `R3_R4_CLIENT_RECEIPT.md`: earlier R3/R4 package receipt (against the then-uninstalled review candidates; superseded where it conflicts with the live receipt).
- `screenshots/`: synthetic-fixture renders from `scripts/mis-g7-reporting/capture-ei-screenshots.mjs` at 320/375/390/430/520/768/1280/1440 (not production, not acceptance).

Architecture: `public/shared/js/executive-intelligence-model.js` is a pure, DOM-free model (analysis, labels, hierarchy cascade, export scope, refresh/facility view-models, CSV, pivot, error classes); `executive-mis-dashboard.js` renders lenses with per-slot latest-wins request guards. The server objects the page may touch are pinned by a static test.

## Owner design approval — 26 November 2026

Owner explicitly approved the module design following production inspection and final cosmetic corrections (conversation: “Now i approve the module design.”). Approved visual/interaction baseline: main 0a602ff8dc1cb0acb1fd439d92e56fe9feaf77a4, merged PR #544; preceding R5 PRs #542 and #543. Scope includes HOME parity, dashboard presentation, compact summaries and record cards, detail dialogs, infinite scrolling, Finance three-row signed currency summary and historical line charts. Visual-design gate CLOSED. No further redesign required unless specific operational defect or new approved requirement arises.

Evidence: final #544 EI reporting/C1, WP10 and PEC workflows all successful (runs 45859253875, 45859253980, 45859253947). Prior #543 complete reporting suite 183/183, no skips. Synthetic browser tests are not authenticated production acceptance. Owner design approval is not blanket approval of data accuracy, permissions, release or destructive retirement.

Remaining execution: verify hosted build/cache and authenticated executive/sales-only/denied role boundaries, reporting/data integrity and operational interactions; reconcile remaining formal G7 gates (last recorded 7/11), then controlled Electron release. Audit Sales Viewer exclusive vs shared dependencies and permission compatibility; retire obsolete client and database elements only following replacement acceptance and explicit reviewed destructive scope. No blanket DROP CASCADE or raw/normalized shared sales removal. Preserve shared ETL, aliases, dimensions, monthly/daily evidence and job 17. G8/PWL remain parked. Continue in bulk packages; ChatGPT owns server/guards/merge, Claude only if necessary for substantial client work. Progress reported in each substantive continuation. Indicative A 100%, B 100%, C 95% (design approved; operational acceptance and release open), D 0%; overall 73.75% before remaining gate evidence.

## R6 live authorization and merged client — 27 November 2026

Owner overrode legacy permission continuity: no copying, relabeling, repurposing or assignment of Sales Viewer permissions. Independent authorization correction registered LIVE as `20261127044401_ei_r6_independent_authorization` (PG17.4), exact reviewed SQL blob `0a6e74b00761eae042430bcfc479a7a932a6d829`. Rehearsal completed in rollback transaction, installed once, do not replay. Post-install legacy permission references across functions/views/policies 0/0/0; assignment fingerprint unchanged `a7b39bff5059367e918d9937a8f10e90`. Actual JWT role simulation legacy-only false/false, sales and executive summary 0 rows; executive true/true, both summaries one row. No user assignment changes. PR #545 merged at 2f0f8ea8138e4c83a1c030309df9d0d03009cb19; tested head 608cdd743c0adfe6e56234bd742031e546081c2f, EI 186/186, WP10, PEC, Windows candidate all pass. The prior R3 launcher exception is removed; sales-only legacy access is no longer accepted. All earlier contradictory wording is historical. PWA hosting and supported Electron client acceptance remain open. No obsolete database objects dropped. Eight-object DROP RESTRICT candidate requires final acceptance and exact-scope approval. Five shared v_sdv views and cron17 retain unchanged. G7 formal 7/11 remains independent; G8/PWL parked.

## R7 owner direction — 27 November 2026
Visual parity gate REOPENED, functional layout approval retained. Stable publication held pending R7. Claude owns consolidated client parity, validation, merge, exact-main candidate and guarded stable publication under owner instruction. See [R7 assignment](R7_CLAUDE_DESIGN_PARITY_RELEASE_ASSIGNMENT.md). Earlier candidate builds superseded. R6 database retirement remains separate and blocked on updated client acceptance. No permission changes.

## R7 outcome — 27 November 2026
Design-language parity merged (PR #546, main `6babbdd9`) and stable **v6.6.0** published from that exact commit (build run 45993005118, publish run 45993646580): see [R7 receipt](R7_DESIGN_PARITY_RECEIPT_20261127.md). Owner production visual acceptance, hosted PWA check and supported-client update acceptance remain open; R6 database retirement remains separate.
