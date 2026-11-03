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
- [ ] Final handover

## Current Gate
`WP06-W6 — integrated on main; wider WP06 business simplification and live acceptance remain open`

## Gate Status
[x] W6 NAVIGATION PACKAGE MERGED (#139, `d395d7e`); [~] wider WP06 work pack remains open

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
Not started.
