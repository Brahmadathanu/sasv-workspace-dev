> **AUTHORITATIVE OWNER CLOSURE — 8 NOVEMBER 2026:** WP06 **FORMALLY CLOSED**, final owner sign-off explicitly received after PR #231 reconciliation. Formal Costing Suite workpacks **6/13 (46.2%)**. Acceptance is restricted to WP06 ten PPM workspaces by A1. Historical 57014 and all deferrals are preserved; WP05/WP12 security, full flag matrix and rollout remain OPEN. Earlier date-stamped status statements below are historical, not the current gate.

> **Current WP06 acceptance checkpoint — 4 Nov 2026:** W6/G1/G1b/G1c/G1d/F-7/F-8/F-9 integration and mock regressions are merged; WP06 remains **OPEN**. The planned owner read-only test still needs authenticated six-module view-only credentials and server safety clearance; the client local origin is not a database sandbox. See [PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md), [OWNER_ACCEPTANCE_RECORD_2026-11-04.md](OWNER_ACCEPTANCE_RECORD_2026-11-04.md) and [PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md](PRODUCTION_READ_ONLY_ACCEPTANCE_SECURITY_AUDIT_2026-11-04.md). No formal approval of D7/C9/F-4 or flag rollout is implied.

> **Reconciled 4 Nov 2026 (newer than every banner below):** see [PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md) for the progress indicator, the doc-versus-`main` reconciliation (N1–N4/W6/U11, CL1, G1/G1b/G1c/G1d, F-7, F-9, WP12 sweep are merged) and the shortest path to formally close WP05 and WP06. Formal count is unchanged: 5 of 13 accepted; nothing is closed by documentation alone.

> **Authoritative post-merge checkpoint — 3 Nov 2026 (newer than historical status entries below).** GitHub `main` = `d395d7e8031a28e56ea1b0997424932997a36636`. The Costing Tier-1 navigation feature wave is **fully integrated**: N1 #133 (`85a163f`), N3 #134 (`55acfcf`), N2 #136 (`7f46f37`), N4 #135 (`2ce8af0`), W6 #139 (`d395d7e`); N2/N3 guard repair #138 (`026c646`) also merged. Final W6 head `5c3869a`: LF 605/605 and CRLF 605/605, 0 failed/skipped/cancelled/TODO, 61 Chromium tests per run, **pre-merge**. Verified **exact Git blob/tree equivalence** between final-tested W6 head and squash-merged `main` (2,271 matching entries, 0 mismatches); a fresh post-merge execution is not claimed. All new flags remain default OFF; no deployment, cache bump, Supabase write or activation. **This completes the N1/N2/N3/N4/W6 client navigation wave only**, not WP05, WP06, MDC-07 or the wider programme: U11, signed-in populated-data acceptance, production/flag rollout and later work packs remain open. Electron repository version remains `6.1.0`; latest GitHub published release is `v6.1.0` (18 Aug 2026); release candidate/build/Windows smoke/version bump are not yet approved or performed. PWA service-worker cache remains `hub-cache-v390`. e-Aushadhi WP-07 and storage-retention work remain paused/parked respectively. Historical draft/not-started statements below are superseded by this checkpoint, not retroactively rewritten.

# WP-06 — Pricing Policy Manager Simplification

## Objective
Audit every pricing tab and redesign around user tasks only after dependencies are understood.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Scope
As defined by the approved programme handoff; refine only from audited live architecture and explicit decisions.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes.

## Current-state findings
W6 design audit completed 3 Nov 2026. The existing Pricing Policy Manager controller presents 10 workspaces in 3 groups, while the N1 `COSTING_PPM_NAV_GROUP_CONTRACT` defines 5 groups. See `WP06_W6_DESIGN_GATE_REPORT_2026-11-03.md` for the evidence and compatibility constraints. This approval starts the bounded W6 presentation package; it does not close the wider WP06 simplification work pack.

## Approved design / contract
**Owner-approved 3 Nov 2026 — W6 five-group navigation design.** Adopt the existing N1 `COSTING_PPM_NAV_GROUP_CONTRACT` verbatim, without editing the shared contract or registry:
1. **SKU policies:** `sku-overview`.
2. **MRP:** `sku-mrp-policies`, `product-derivation-policies`.
3. **MRP change workflow:** `mrp-proposals`, `proposal-decisions`, `approved-for-application`, `applied-proposal-history`.
4. **Schemes:** `scheme-master`, `scheme-rule-register`.
5. **Costing inputs:** `commercial-sales-assumptions`.

**Compatibility and implementation boundaries:** W6 may make the Pricing Policy Manager controller consume the existing exact-`1` flag `COSTING_NAV_GROUPS_V1`; default/OFF must retain the existing three-group strip and current workspace behaviour without regression. The ON state may replace legacy *presentation group* ids/labels with the approved five N1 group ids; individual workspace ids, distinct existing workspace labels, default `sku-overview` landing, `?workspace=` URLs, legacy `?lens=` redirects, historical deep links, user permissions, maker-checker governance, effective dates, RPCs and export behaviour are unchanged. Do not add a second navigation engine or change N1 shell/contract, CSS, registry or backend without a separately approved scope change. Keep the 10 workspaces distinct within the five groups. **C9 shared-registry period-scoping mismatch is explicitly deferred** to a separate owner decision. No flag activation, deployment, cache bump or merge is implied.

## Milestones
- [x] W6 current-state/design audit (design-gate report, 3 Nov 2026)
- [x] W6 five-group design/contract gate (owner-approved 3 Nov 2026)
- [x] W6 client implementation completed and squash-merged (#139, `d395d7e`)
- [x] W6 focused verification (13 unit + 10 Chromium tests)
- [x] W6 independent review and owner merge approval
- [x] W6 squash merge and exact tested-tree equivalence proof; fresh post-merge execution not performed
- [x] Final handover — owner-approved bounded WP06 closure, 8 Nov 2026

## Current Gate
`WP06 — FORMALLY CLOSED 8 Nov 2026 by owner; bounded PPM acceptance per A1, deferrals retained`

## Gate Status
[x] WP06 FORMALLY CLOSED — owner final acceptance 8 Nov 2026; W6 NAVIGATION PACKAGE MERGED (#139, `d395d7e`); scope A1 and parked risks explicitly accepted

## Required to close
W6 must implement the approved five-group presentation without violating compatibility, pass LF/CRLF and Chromium regression, undergo independent audit and obtain explicit owner merge approval. The wider WP06 work pack is not automatically closed.

## Next gate
Signed-in populated-data verification before any flag activation; assess remaining WP06 requirements separately. U11 is a later WP11 package, not part of W6.

## Server changes
None.

## Client changes
W6 merged PR #139 changes only PPM-controller exports: an exact-flag-ON projection derives 5 groups and 10 workspace display assignments/order from the N1 contract, while OFF returns the original arrays and objects unmodified. An explicit `legacyGroupId` on the ON projection preserves former Area mapping and existing internal MRP/selling classifications. The existing shell consumes these metadata exports without a shell modification. No feature is activated.

## Tests / verification
**W6 verification (3 Nov 2026, draft PR #139; exact totals are in the PR description for the tested head).** `scripts/costing-w6-pricing-nav/w6.test.mjs` (metadata, legacy-resolution parity ON/OFF evaluated at module load in a child process, derived MRP/selling classifications, exact-flag handling, source/scope guards) and `w6-browser.test.mjs` (Chromium: desktop 1/2/4/2/1 vs 2/4/4 strips, narrow five-optgroup dropdown with selection, all ten deep links and twelve legacy URL shapes identical ON/OFF, click-through, back/forward across page loads, console hygiene) were **executed** in Chromium with zero skipped tests and run inside the complete LF and CRLF suites on the reconciled branch (full git history, as required by the N2/N3 historical guards). Defect found and fixed during verification: with the flag ON the module-load metadata validator still required the legacy workspace order and logged a `console.error` on every page load; its expected order now follows the active presentation (mutation-checked). Observed, preserved behaviour: workspace switching uses `replaceState`, so it adds no history entries in either mode. Historical pin tests that compare the PPM controller with its pre-W6 text (`costing-ccc-uxf1`, `costing-review-worklist`, `costing-table-tools` pkg3/pkg4) apply `scripts/lib/w6-nav-strip.mjs` (exact reversal of the W6 additions; tested to be exact and not blanket). Reconciled with `main` `2ce8af0` after N4 (#135) merged. Not performed: signed-in populated-data acceptance, live PWA/cache check. The flag is not activated. C9 stays deferred.

## Decisions created
3 Nov 2026: Owner approved the N1 five-group design for W6, required legacy navigation compatibility, and deferred C9 shared-registry changes.

## Risks
Premature assumptions; scope drift; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
C9 shared-registry `policy-manager.periodScoped:false` versus the period-scoped Commercial Sales Assumptions workspace. Out of W6 scope; revisit in a separate authorised shared-registry package.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
**COMPLETED — owner final WP06 formal acceptance, 8 November 2026.** Scope: ten PPM workspaces, verified ID-V v392 baseline and NAV_GROUPS OFF/ON; W6/G1/F7–F9 integrated. Historical 1280 Scheme Master 57014 remains recorded; owner accepted bounded residual after post-index seven-row load and 3/3 refresh passes; issue #224 stays monitored. CSA COMPANY/REGIONAL IK/OK Revise dialog 4/4 view-only open/cancel PASS. All deferred issues tracked in PARKED_BACKLOG (C9/D7/F-4/C6/O-8/D3/G-SCOPE/negative identities); shared §8 Amendment A1 carries non-PPM acceptance to WP05/WP12, not waived. No rollout, flag activation, new production writer test, cache bump or deployment. Formal programme advances from 5/13 to **6/13** solely by the owner's explicit final sign-off.


## Owner-approved WP06 acceptance reconciliation — 8 November 2026 (supersedes older unsatisfied-gate narration)

**Scope and build:** owner approved G-SCOPE A1 amendment to the shared acceptance contract §8 (bounded ten-workspace PPM-only, NAV_GROUPS OFF/ON, ID-V; wider 40-lens/11-flag and negative identity obligations retained for WP05/WP12). Owner accepted G-BUILD ID-V baseline: hosted `main@883a9f1c` / `hub-cache-v392`, asset parity **72/72** and documented source parity. Not a production flag-rollout decision.

**Evidence reconciliation:** earlier authenticated ID-V browser-local NAV_GROUPS ON passed **20/20 deep links** at 1280/390, **6/6 legacy/default links**, five-group labels/order, no delivered mutating requests, 9/10 workspaces clean at both widths. Historic Scheme Master **F at 1280 ON and OFF (HTTP500 57014)** is preserved, **P at 390 with seven schemes**. Subsequently, the owner authorised and manually applied `CREATE INDEX CONCURRENTLY` on `costing.sku_scheme_viability_snapshot(scheme_id,period_start)`; independent catalog verified valid/ready, 1624 kB, unchanged view fingerprint. Post-change owner desktop reported **seven schemes loaded** followed by **three consecutive refreshes PASS**. These are owner-reported smoke/recovery checks (no timed network captures), not a repeat of the complete 1280/390 restricted-ID-V automated matrix; optimizer still chose old period/status index in safe EXPLAIN. Historical F and issue #224 remain visible under monitoring, not rewritten as clean original tests.

**Commercial Sales Assumptions:** owner reported signed-in page PASS, existing-policy Revise dialog PASS, COMPANY/REGIONAL IK/OK scope controls visible PASS, Cancel without save PASS. No write attempted. Thus previous 'modals NT' is superseded for the visual/open/cancel scope; no independent network proof asserted.

**Decisions:** G-SCOPE/G-BUILD **APPROVED**; C9/D7/F-4/C6/O-8/D3 **OWNER-ACCEPTED DEFERRALS**; intermittent Scheme Master 57014 **accepted as bounded residual/monitoring**, not permanently resolved. Deferred behaviour, reason, risk, milestone and named responsible authority are registered in `PARKED_BACKLOG.md`. SEC-A1/A2 and negative identities remain UNTESTED, transferred to WP05/WP12 (not waived).

**Gate ledger at 8 Nov 2026:** client implementation/tests PASS; restricted identity/build PASS for pinned evidence; NAV_GROUPS ON/OFF+restoration PASS; 9/10 earlier clean automated desktop/narrow workspaces with Scheme Master later owner recovery PASS; CSA modal owner visual PASS; deferral decisions and amendment APPROVED/RECORDED. **The post-index intermittent reliability / historical 1280 F has a bounded risk-accepted disposition rather than an unqualified original P.** No unapproved live writer testing is implied.

**Superseded 8 November 2026 by the owner's separate explicit WP06 final sign-off.** Gate Status: **FORMALLY CLOSED** with documented Scheme Master monitoring risk and approved deferrals; programme now **6/13**. Server DDL above refers only to the previously authorised index build.
