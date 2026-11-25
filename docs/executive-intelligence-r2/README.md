# Executive Intelligence client (R2 + R3/R4 package)

Client-only, on PR #541 (stacked on server PR #540). Module key, route and permission target `executive-mis-dashboard` are unchanged; no registry, permission, migration, service-worker or version change.

- `R3_PARITY_MATRIX.md`: Sales Viewer functional parity, gaps and the sales-only registry requirement.
- `R3_R4_CLIENT_RECEIPT.md`: implementation receipt for the R3/R4 client package.
- `screenshots/`: synthetic-fixture renders from `scripts/mis-g7-reporting/capture-ei-screenshots.mjs` (not production, not acceptance).

Architecture: `public/shared/js/executive-intelligence-model.js` is a pure, DOM-free model (analysis, labels, CSV, pivot, error classes); `executive-mis-dashboard.js` renders lenses with per-slot latest-wins request guards. Server objects consumed are pinned by a static test (existing MIS views/RPCs, plus the review-candidate `ei_*` RPCs, which show an honest "not installed" state until installed).
