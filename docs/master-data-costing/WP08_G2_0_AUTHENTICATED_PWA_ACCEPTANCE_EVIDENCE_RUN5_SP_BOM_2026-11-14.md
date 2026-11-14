# WP08 G2-0 Authenticated PWA Acceptance - Run 5 addendum: SP BOM populated BOM (Issue #410)

Date: 14 Nov 2026. Main: `0a3eeb71a54bea676c52951dc4cd73ba493de987` (same build as Runs 3-4). Existing authenticated session (the same positive-role identity as Run 4). Earlier reports are unchanged: Runs 1-4 (`2d0c7b6`, `0578f82`, `c5f3a1b`, `70bb2e3`).

**Result: PASS.** The SP BOM page loaded a populated BOM read-only, closing the SP BOM gap left PARTIAL in Run 4. View-only authentication remains **NOT TESTED** (no authorised view-only identity was available; no permission was granted). WP08 remains OPEN; programme 8/13. No registry SQL, deployment, permission change or writer action. The controls used were the product search box and picker, plus viewport changes.

## Product
`Pramehakalpam Podimarunnu` (stock_item_id 1100) was present in the picker (187 entries; the other three fallbacks, Thanurakshini, Artiban and Vathamarmakan Podimarunnu, were also present and not needed). Selected through the search box and picker.

## Observations
| Check | Observation | Result |
|---|---|---|
| Header | Reference output 7.500 Kg (field value 7.5, UOM id 1), process loss 0.00% | PASS |
| Lines | 37 lines, equal to the 37 reported by the database | PASS |
| First line | 1 / I000000J / Adakkamaniyan (D) / 0.2 / Kg / 0.00% / No | PASS |
| Second line | 2 / I0000013 / Amukkuram - Gatta (D) / 0.2 / Kg / 0.00% / No | PASS |
| Last line | 37 / I00000VZ / Chittamrithin Nooru / 0.8 / Kg / 0.00% / No | PASS |
| Columns | SN, Stock item code, Stock item (RM), Qty per ref, UOM, Wastage, Optional, Remarks, Actions | PASS |
| Mode | The "View" segment was active (the page opened read-only); the lines badge showed 37 | PASS |
| Console errors | None, read after loading and again after the layout checks | PASS |
| Layout 1280px | Page width 1280, no horizontal overflow; all 37 rows rendered, table right edge at 1248px | PASS |
| Layout 390px | Page scroll width 390, no page-level overflow; header, pills and a 37-line table render; the table scrolls inside its own container (the Qty column is cut off at the right until scrolled). The script flagged `#selectionPills` as wider than the viewport, but the page did not overflow | PASS (see note) |

Note on 390px: the layout was resized without a reload after the BOM had loaded. Run 4 had already measured this page at 390px by reload in the empty state, with the same result. The wide-table-in-scroller behaviour is as designed here and is distinct from the PM BOM overflow (WP11 UX-P05), which was not rechecked in this run and is not marked PASS.

## Role matrix after this run
| Role state | Result |
|---|---|
| Denied | PASS (Run 3) |
| Edit-capable positive identity | PASS for read-only acceptance of all four modules (Runs 4-5); no writer path exercised |
| View-only | **NOT TESTED** |

## Not covered
View-only identity; writer behaviour; registry rows and Electron registrations (no registry access); PM BOM 390px overflow (UX-P05 stays FAIL/deferred to WP11).
