# Executive Intelligence client (R2 + R3/R4 + live-contract integration)

Client-only, on PR #541 (stacked on server PR #540). Module key, route and permission target `executive-mis-dashboard` are unchanged. The only launcher change is one narrow exception in `public/shared/js/module-registry.js` (sales-only entry). No migration, registry data, grant, service-worker or version change.

- `LIVE_INTEGRATION_RECEIPT_20261126.md`: consolidated receipt for the live-contract integration (commit identity, tests, screenshots, owner acceptance checklist).
- `R3_PARITY_MATRIX.md`: Sales Viewer functional parity against the installed contracts, gaps and the sales-only entry.
- `R3_R4_CLIENT_RECEIPT.md`: earlier R3/R4 package receipt (against the then-uninstalled review candidates; superseded where it conflicts with the live receipt).
- `screenshots/`: synthetic-fixture renders from `scripts/mis-g7-reporting/capture-ei-screenshots.mjs` at 320/375/390/430/520/768/1280/1440 (not production, not acceptance).

Architecture: `public/shared/js/executive-intelligence-model.js` is a pure, DOM-free model (analysis, labels, hierarchy cascade, export scope, refresh/facility view-models, CSV, pivot, error classes); `executive-mis-dashboard.js` renders lenses with per-slot latest-wins request guards. The server objects the page may touch are pinned by a static test.
