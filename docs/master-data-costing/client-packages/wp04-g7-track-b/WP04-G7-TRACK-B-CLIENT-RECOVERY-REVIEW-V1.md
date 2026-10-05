# WP04 G7 Track B — Independent Review of Client Recovery Package V1

2026-10-05. **PASS FOR IMPLEMENTATION AUTHORIZATION — NOT IMPLEMENTED.**

## Exact reviewed package

- Package blob: `1afe3cca9d5e7c31a2b04dea35c16d44dd8f964c`
- Package path:
  `docs/master-data-costing/client-packages/wp04-g7-track-b/WP04-G7-TRACK-B-CLIENT-RECOVERY-PACKAGE-V1.md`

Any package-content change invalidates this review.

## Accepted implementation base

Independent repository comparison confirms:

- `feat/wp04-g5-portfolio-readiness`
- exact head/base: `db7544f2ebdf30f515f249ade9e12a660a364476`
- comparison against that SHA: identical, 0 ahead / 0 behind
- comparison against current main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`: 2 ahead / 0 behind

Therefore the package is correctly anchored to the accepted G5 implementation, not to a moving client baseline.

## Track A preservation

PASS.

The package explicitly treats Track A as closed and does not authorize any server work.

Preserved server facts include:
- Build ID 4;
- ALL_EXISTING 1793/1793;
- OPERATIONAL 611/611;
- full OPERATIONAL parity mismatch 0;
- indexed public portfolio active;
- CSE-P01 unchanged;
- fail-closed behavior proven;
- indexed performance safely under the real native ceiling.

The only G7 restart interaction with Track A is a future read-only freshness/current check. No rebuild or server mutation is implied.

## Source inspection findings reconciled

The existing G5 source was independently inspected.

Confirmed:

1. Readiness already uses shell `#search`; no local `readinessSearch` exists.
2. Existing raw filter UX uses native permanent `multiple size="3"` selectors for Dependency/Owner/Route.
3. Existing `renderGaps()` expands returned gap rows into long `cp-readiness-gap-list` lists.
4. Existing Readiness row selection already calls shell `openDetails(assessment)`.
5. Existing shell details flow already routes Readiness through:
   - `portfolioReadinessCtrl.getDrawerConfig(...)`
   - `portfolioReadinessCtrl.renderDrawerTab(...)`
   - existing `#detailsModal`.
6. Existing shell hides `#kpiStripWrap` in the Readiness render path, but fresh G7 visual evidence showed snapshot chrome still competing; the package therefore correctly requires a dedicated symmetric Readiness shell synchronizer including freshness/valuation chrome and restoration.
7. Existing G5 already hides `#costingPeriodSelect` while Readiness is active; package preserves this authority.
8. Existing generic table shell remains structurally present beside the Readiness host, so assigning a stable wrapper ID and explicitly hiding it during Readiness is a bounded way to remove blank/competing chrome.
9. Existing <=900px CSS already switches Readiness table to card list; package preserves and refines that behavior.
10. Existing Costing/PEQ and shared primitive CSS contains established `.peq-filter-btn` / `.peq-filter-drawer` patterns, so no new global visual system is needed.

## UX scope review

PASS.

The package addresses exactly the fresh G7 defects:

- compact governed controls;
- compact filter button/drawer/chips;
- single live summary strip;
- bounded Product-gap preview/drill-in;
- snapshot KPI/freshness suppression only while Readiness is active;
- full-width register;
- existing details modal/drawer;
- loading/unavailable/empty states;
- single shell search;
- narrow-window usability.

It does not broaden into:
- Dashboard redesign;
- other costing lenses;
- Manage Products;
- route/registry redesign;
- server contract changes;
- readiness business logic.

## Filter authority review

PASS.

The proposed drawer is presentation-only.

The package explicitly requires:
- server `filter_options` as the sole selectable-option source;
- existing request fields unchanged;
- no new readiness calculations;
- chips/badges only representing selected client filter state.

This preserves G5 fail-closed semantics.

## Product-gap scope review

PASS.

The package avoids the prior unbounded visual dump without inventing a new data contract.

It allows:
- collapsed preview <=3 rows;
- drill-in bounded to the already returned page <=25;
- explicit “showing first N of matched” when `has_more`;
- no automatic traversal;
- no gap-local search.

This is appropriately narrow.

## Shell integration review

PASS with one implementation requirement.

A dedicated `syncReadinessShellChrome()` (or equivalent single authority) should be preferred over scattered style mutations.

It must be invoked:
- after lens change;
- during shared shell render/chrome sync;
- on Readiness exit.

Restoration must call existing shell visibility authorities where they exist rather than assuming Dashboard is always the destination.

No other lens may inherit Readiness-hidden state.

## Details/register review

PASS.

No new detail pane is warranted.

The existing shell modal/drawer is already the correct pattern. Package correctly requires:
- full-width register;
- row click -> existing `openDetails`;
- no permanent second pane;
- no Action column.

## Allowed file review

PASS.

Exact maximum changed-file allowlist:

1. `public/shared/js/costing-suite-readiness.js`
2. `public/shared/js/costing-suite-shell.js`
3. `public/shared/costing-control-center.html`
4. `public/shared/css/sasv-costing.css`
5. `scripts/wp04-readiness-client-contract-smoke.mjs`
6. `public/sw.js`

Accepted base blobs were independently pinned:

- readiness JS `157dd03443565813d00663d8d102f56384aa8ff1`
- shell JS `43ce3f6e0ac216be4bc187651f4a9f18db74bdef`
- Control Center HTML `70704d54ef3ce30435d677276d3d67850cbd5ad9`
- costing CSS `ed275edee5c95650c812ab3f98a917ea834d1ff5`
- smoke `d87a8d7ab6a703e72b1c6ac0357a1f28233e84fa`
- service worker `f28ab585a523904172abed3ef15b8efc9993b04c`

Registry and route-config are explicitly out of scope and must remain byte-identical.

## Service-worker review

PASS.

Accepted branch uses `hub-cache-v333`.

If cached client assets change, a one-step monotonic bump to `hub-cache-v334` is appropriate.

No other SW behavior is authorized.

## Smoke proof review

PASS.

The required structural assertions cover:
- read-only RPC boundaries;
- single search authority;
- server-owned filter options;
- removal of visible raw multi-selects;
- shell hide/restore symmetry;
- bounded gap preview;
- existing detail path;
- state distinction;
- no client readiness authority;
- SW cache bump;
- unchanged route/registry.

The exact required commands are appropriate and bounded.

## Visual proof review

PASS.

The seven-view matrix is sufficient to prove the actual defects are corrected rather than merely unit-tested:

- desktop success;
- desktop filter;
- desktop detail;
- desktop unavailable;
- portrait success;
- portrait filter/detail;
- lens-exit restoration.

The package correctly permits a temporary uncommitted failure harness solely for unavailable-state screenshots.

## Rollback review

PASS.

Before merge/release, rollback is correctly client-only:
- revert Track B implementation commits on the recovery branch to `db7544...`;
- no server rollback;
- no Track A mutation;
- no destructive reset/clean requirement.

No production release rollback is needed because merge/release is outside this gate.

## G7 restart review

PASS.

G7 must restart from the beginning only after:
- implementation + smoke + visual proof;
- independent actual-diff audit;
- no scope drift;
- read-only confirmation Track A is still current/fresh;
- explicit user authorization.

This preserves the existing blocked G7 evidence rather than pretending the old partial run can continue.

## Independent disposition

**PASS — Track B package is sufficiently exact, bounded and testable for client implementation under DEC-011.**

Recommended next boundary:

- create `fix/wp04-g7-track-b-readiness-ux` from exact `db7544f2ebdf30f515f249ade9e12a660a364476`;
- hand the frozen package to Cursor/Codex for implementation;
- do not merge;
- return with final feature SHA, changed files, command results and visual proof for independent audit.

No client implementation has been performed by this review.
No Track A/server change.
No G7 rerun.
No merge/release/publish.
G8 remains closed.
