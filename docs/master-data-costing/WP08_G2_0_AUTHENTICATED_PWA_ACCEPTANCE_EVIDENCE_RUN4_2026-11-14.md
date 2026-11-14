# WP08 G2-0 Authenticated PWA Acceptance Evidence - Run 4, positive-role identity (Issue #410)

Date: 14 Nov 2026. Repository: Brahmadathanu/sasv-workspace-dev. Exact main: `0a3eeb71a54bea676c52951dc4cd73ba493de987` (same build as Run 3; gate token `g2-0-7508596128ccc98a6c8d54b695693352`, verified in Run 3, not re-run). PWA: https://sasv-utilities-hub.netlify.app/

Earlier reports are preserved unchanged: Run 1 BLOCKED (`2d0c7b6`), Run 2 (`0578f82`), Run 3 (`c5f3a1b`).

**Overall: PARTIAL.** The user signed in personally with a different identity that holds positive module access, so this is the first run with real data. Real read-only acceptance PASSES for Products, RM BOM and PM BOM. SP BOM loads but no populated BOM was seen. Only one positive-role identity was available (it appears Edit-capable), so the view-only state is NOT TESTED. PM BOM at 390px still fails (WP11 UX-P05). WP08 remains OPEN; programme 8/13.

Restrictions kept: no registry SQL (Step A not executed), database mutation, permission or flag change, deployment or writer action. No credentials were requested or handled. The only controls used were read actions: search boxes and pickers, HOME, and the viewport.

## Identity
Signed-in by the owner in the built-in browser. Name and role were not inspected. Its effective access, inferred from the UI only:
- Products page: 1,342 products listed; "New product" button (`newInlineBtn`) enabled and not marked as lacking permission.
- RM BOM and SP BOM: Save, View/Edit toggle and editable fields enabled.
- PM BOM: 135 templates listed; Mapping, Overrides, Preview and Rebuild tabs enabled.

This looks Edit-capable on all four modules, but it was not confirmed by any write, and no `get_user_permissions` result was read. No view-only identity was available.

## 1. Browser assets (same build as Run 3)
On every page the loaded `master-data-write-guard.js` (`6faa6fd2b9225f0e`), `master-data-platform.js` (`14a6cb9ddf9778ce`), module JS (`products.js` 69915597214d4973, `manage-rm-bom.js` f314987e6397f431, `manage-pm-bom.js` 60741c5451f7fd00, `manage-sp-bom.js` 6b0b2485e011187a) and the CSS (`shared-ui.css` ddd7693c6f91bd30, `sasv-bom.css` cbce6abe1446b038) hash-matched the gate manifest. Result: **PASS**. Service-worker observation from Run 3 (stale same-URL `/sw.js` copy) was not retested.

## 2. Real read-only acceptance
| Test | Products | RM BOM | PM BOM | SP BOM |
|---|---|---|---|---|
| 2.1 Page opens for the identity (no denied message) | PASS | PASS | PASS | PASS |
| 2.2 Real data loads | **PASS**: 1,342 products, first page of 50 rows ("Showing 1-50 of 1342"), Active/Inactive status shown | **PASS**: 593 products in the picker; selecting Abhayarishtam loaded 18 lines (first: I000002B Brewer's Yeast, 1.5 Kg), reference output 3000, process loss 5.00 | **PASS**: 135 templates; selecting "100 g_Regular" loaded its header (code, reference 1, loss 0.00, 3 line rows, "Has Overrides 0") | **PARTIAL**: 187 products in the picker; selecting two products (Abhraka Navaneetham, Aadalodakathila with Nallenna) selected them but the page showed an empty header (ref 1) and one blank line. No populated SP BOM was observed; this may mean no BOM exists for them, not a defect. |
| 2.3 Writer controls (visible, never pressed) | "New product" enabled | Save, Edit toggle enabled | Save area, Edit toggle, Preview and Rebuild tabs enabled | Save, Edit toggle enabled |
| 2.4 HOME navigation | PASS (landed on the Hub, `/utilities-hub/index.html`) | not clicked | PASS in Run 3 | PASS in Run 2 |
| 2.5 Console errors | PASS (none) | PASS | PASS | PASS |

The console was read as clean at three points (after the SP BOM selections, after the layout sweep, and after the HOME click). Pages were not individually logged, so a one-off error before a read could be missed.

2.3 describes visibility only. No Save, New product, Edit, Mode, Preview, Rebuild, Export or More actions control was pressed, and no field was edited.

## 3. Layout
| Test | Products | RM BOM | PM BOM | SP BOM |
|---|---|---|---|---|
| 3.1 1280px | PASS (50 rows, no overflow) | PASS | PASS | PASS |
| 3.2 390px | **PASS** (no overflow; 50 rows) | **PASS** (18-line BOM loaded; no overflow outside scroll containers) | **FAIL**: WP11 UX-P05 retained; page scroll width 565px at a 390px viewport, with pills bar, header actions and menu extending past the viewport | **PASS** (page width 390; table scrolls in its own container; empty BOM state only) |

RM BOM at 390px was measured with real data. SP BOM at 390px was measured without a populated BOM.

## 4. Role matrix
| Role state | Result |
|---|---|
| Denied | PASS (Run 3, all four modules, denied identity) |
| Edit (positive) | PARTIAL: read-only acceptance PASS for three modules, SP BOM data not seen; writer paths intentionally not exercised |
| View-only (positive) | **NOT TESTED** (no view-only identity available) |

## 5. Not covered
- View-only identity behaviour; writer behaviour for any role (out of scope).
- A populated SP BOM.
- PM BOM `module:pm-templates` as an explicit grant: the page opens and lists templates for this identity, which is consistent with it, but I did not read the permission rows.
- Registry rows and Electron registrations (no registry access; Step A not executed).
- HOME on RM BOM and SP BOM this run.
