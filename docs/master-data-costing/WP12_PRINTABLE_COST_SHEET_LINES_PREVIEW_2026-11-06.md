# WP12 — line-level printable Cost Sheet in the synthetic preview — 6 Nov 2026

**Scope: preview tooling, tests and CI only. No `public/` source, Supabase, flag, PWA, Electron or e-Aushadhi change. SYNTHETIC data. Not owner acceptance, not real-auth proof, formal closure still 5/13.**

Closes the handback caveat "per-line printable sheet not fixtured" (handback §R.6, §R.3 row *Cost Sheet (printable)*).

## What changed
- `synthetic-fixtures.mjs`: fixture for `v_costing_pricing_printable_cost_sheet_lines` (columns per `types/supabase.ts`; sections A_COP, B_INTERNAL_COST, C_IK_PRICING, D_OK_PRICING, Z_STATUS as the client renders them). Every line is derived from the same per-SKU numbers as the SKU detail fixture. Product-summary `line_count` / ready / review / blocked counts are now **derived from the lines** (previously hard-coded 20).
- Deliberately not fixtured: net realisation, scheme deductions, profit (IK/OK price semantics remain an open source-contract question); pricing sections carry policy MRP only and say so.
- `printable-cost-sheet-lines.test.mjs` (6 tests): fixture reconciliation to SKU detail; honesty (blocked SKU null, never zero); real Chromium A4 modal for READY / REVIEW / BLOCKED; 1280/768/390 + Close/Escape; sheet identical with flags OFF / Navigation-only / four flags ON, and the Export-PDF sign dialog opens and cancels without a write. Zero unsupported reads, zero denied writes, no console error other than the preview CSP blocking the jsPDF CDN script (expected).
- Mutation check: perturbing RM cost or the PM label fails 2 tests.
- Screenshots (desktop and 390px, three SKUs): `assets/cost-sheet-lines-2026-11-06/`.

## Defects found by looking at the screenshots (not caught by text assertions)
1. **CS-A4-LEFT-CLIP — real product defect (CSS in `public/shared/cost-sheet-review.html`).** `.cost-sheet-a4-wrap` is `display:flex; justify-content:center` and the sheet is `width:210mm` (794px). When the container is narrower, the sheet overflows to the left, which cannot be scrolled to: at 390px `a4.left = −202px`, at 768px `−13px`; the component-label column is unreachable. Fix is a separate PR to `main` (needs a production CSS change and its own regression test).
2. Observation, not fixed: with the long synthetic label, the SKU column header ("SYNTHETIC SAMPLE POWDER 100G") extends past the right edge of the sheet at 1280px. Real `sku_column_label` values are unverified; check on real data.
3. Preview-only: the red synthetic banner overlaps the top of the modal header.

## Not covered (never counted as a pass)
Line traceability / Explain drawer, multi-SKU columns, PDF generation (jsPDF blocked by preview CSP), real authenticated data. Real printable summary reads hit 57014 timeouts on 5 Nov (before the ANALYZE); line-level reads on real data are NOT TESTED.
