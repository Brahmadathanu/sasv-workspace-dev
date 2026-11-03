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
- [ ] Implementation gate where applicable
- [ ] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
`WP06-W6 — implementation on draft PR #139; full regression and independent review pending`

## Gate Status
[~] W6 DESIGN APPROVED; controller metadata implementation and focused unit tests committed on draft PR #139; Chromium/full-suite regression pending

## Required to close
W6 must implement the approved five-group presentation without violating compatibility, pass LF/CRLF and Chromium regression, undergo independent audit and obtain explicit owner merge approval. The wider WP06 work pack is not automatically closed.

## Next gate
W6 client implementation on its existing branch, focused regression and draft PR for independent review.

## Server changes
None.

## Client changes
W6 draft PR #139 changes only PPM-controller exports: an exact-flag-ON projection derives 5 groups and 10 workspace display assignments/order from the N1 contract, while OFF returns the original arrays and objects unmodified. An explicit `legacyGroupId` on the ON projection preserves former Area mapping and existing internal MRP/selling classifications. The existing shell consumes these metadata exports without a shell modification. No feature is activated.

## Tests / verification
**W6 verification (3 Nov 2026, draft PR #139; exact totals are in the PR description for the tested head).** `scripts/costing-w6-pricing-nav/w6.test.mjs` (metadata, legacy-resolution parity ON/OFF evaluated at module load in a child process, derived MRP/selling classifications, exact-flag handling, source/scope guards) and `w6-browser.test.mjs` (Chromium: desktop 1/2/4/2/1 vs 2/4/4 strips, narrow five-optgroup dropdown with selection, all ten deep links and twelve legacy URL shapes identical ON/OFF, click-through, back/forward across page loads, console hygiene) were **executed** in Chromium with zero skipped tests and run inside the complete LF and CRLF suites on the reconciled branch (full git history, as required by the N2/N3 historical guards). Defect found and fixed during verification: with the flag ON the module-load metadata validator still required the legacy workspace order and logged a `console.error` on every page load; its expected order now follows the active presentation (mutation-checked). Observed, preserved behaviour: workspace switching uses `replaceState`, so it adds no history entries in either mode. Not performed: signed-in populated-data acceptance, live PWA/cache check. The flag is not activated. C9 stays deferred.

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
