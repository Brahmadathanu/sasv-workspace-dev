# WP08 G2-1 Post-Merge Hosted Acceptance Report (Issue #425)

Date: 15 Nov 2026. Repository `Brahmadathanu/sasv-workspace-dev`. Merged main: `63b536f3712b91d63aff55ece1990844309f91dd` (PR #427, squash). Target: `https://sasv-utilities-hub.netlify.app`.
Scope: G2-1 only. No SQL, permission, flag, deployment or application-code change. No writer, preview, rebuild or activation operation was run. Existing authorised session used (the user signed in on the built-in browser pane; positive-role identity). **WP08 remains OPEN; programme 8/13.**

## 1. Production provenance
`node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs verify https://sasv-utilities-hub.netlify.app` from a checkout pinned at the SHA above: **GATE PASS**, token `g2-0-23f194af7e8fbdf8277a36946e370cd0`.
The four HTML pages matched only after the Netlify banner rule (`NETLIFY_INJECTED_BANNER_V1`, HTML only; each normalised hash equals the reviewed hash). JS, CSS and `sw.js` are not normalised.

Exact deployed bytes of every `public/` file changed by the G2-1 commit (LF-normalised SHA-256, no banner rule), including files outside the G2-0 manifest:

| File | HTTP | Result |
|---|---|---|
| shared/js/master-data-selection.js (new) | 200 | PASS |
| shared/js/costing-destination-access.js (new) | 200 | PASS |
| shared/js/costing-suite-recommended-ui-route.js | 200 | PASS |
| shared/js/costing-suite-shell.js | 200 | PASS |
| shared/js/costing-suite-readiness.js | 200 | PASS |
| shared/js/costing-suite-control-center.js | 200 | PASS |
| shared/js/products.js | 200 | PASS |
| shared/js/manage-rm-bom.js | 200 | PASS |
| shared/js/manage-pm-bom.js | 200 | PASS |
| shared/js/manage-sp-bom.js | 200 | PASS |
| sw.js | 200 | PASS |

No mismatches (no FAIL).

## 2. Authenticated acceptance (positive-role identity)
| # | Check | Observation | Result |
|---|---|---|---|
| 1 | Products `?product_id=1&sku_id=1&tab=skus` | Product 1 = Abhayarishtam; SKUs tab active; SKU 1 = 450 mL, Active, Ready; SKU dialog opened on SKU 1 | PASS |
| 2 | Products Readiness `...&tab=readiness` | Readiness tab active; SKU 1 / 450 mL; all foundations RESOLVED, outcome Ready; recommended route text shown | PASS |
| 3 | RM BOM `?product_id=1` | Picker = Abhayarishtam; header ref 3000, loss 5.00%; 18 lines | PASS |
| 4 | PM BOM `?sku_id=1` | Overrides tab; SKU = Abhayarishtam 450 mL | PASS |
| 5 | SP BOM `?owner_item_id=1100` | Owner = Pramehakalpam Podimarunnu; 37 lines; ref 7.5 Kg | PASS |
| 6 | Product → RM BOM link | Offered (SKUs and Readiness views): `manage-rm-bom.html?product_id=1`, `_blank`, `noopener noreferrer`; destination = check 3 | PASS |
| 7 | Product/SKU → PM BOM link | `manage-pm-bom.html?sku_id=1`; destination = check 4 | PASS |
| 8 | Product → Production Route link | `production-route-manager.html?lens=product-route-assignments&product_id=1`; destination opened on Product Assignments lens, "Focused Product ID: 1" (0 assignment records) | PASS |
| 9 | RM BOM → Product backlink | In the More actions menu: `manage-products.html?product_id=1`, `_blank`; destination selected Abhayarishtam | PASS |
| 10 | New-tab behaviour | Click on a Related link attempted a new tab (built-in pane blocks tabs opened from automation); destinations verified by direct navigation | **PARTIAL** — link intent and destination verified; actual opened-tab behaviour NOT TESTED |
| 11 | Invalid identifiers | Product 999999: "was not found; no Product was selected". SKU 999999 and SKU 2 with Product 1: "does not belong to Product 1; no SKU was selected" (Product kept). `abc`, `-5`, `tab=bogus`: each ignored with a message. RM BOM 999999 / `abc`, PM BOM sku 999999, SP BOM owner 1 / `zzz`: no selection, explanatory message, no error | PASS |
| 12 | Back/Forward | The URL is kept truthful with replaceState only (by design), so in-page tab switches create no history entries. A synthetic history entry and Back/Forward re-applied the correct tab (skus then readiness). Cross-page Back from RM BOM returned to the previous page | PASS |
| 13 | Console | No console errors on any page | PASS |
| 14 | 1280 px | Products (both tabs), RM BOM, PM BOM, SP BOM: no horizontal page overflow | PASS |
| 15 | 390 px | Products (both tabs), RM BOM, SP BOM: no page-level overflow (RM/SP line tables scroll inside their container; SP selection pills bar is wider than the viewport inside its container). **PM BOM: page scroll width 563 px at 390 px** | PASS except PM BOM: **FAIL, WP11 UX-P05 (pre-existing, deferred)** |
| 16 | Permission-aware visibility (positive role) | All three Product links and the backlink are offered to this identity. Visibility gating for lesser identities is not demonstrated | PARTIAL |
| 17 | Denied / view-only identities | No authorised identity available in this session; no grants changed | **NOT TESTED** |

Notes:
- Check 10: the click produced the page's `target=_blank` attempt; the pane blocks automation-opened tabs.
- Observation (not a G2-1 regression; not investigated): in the SKU dialog the "Deactivate" button renders with text colour equal to its background (`rgb(185,28,28)`), so its label is not visible. Not clicked. Recommend a WP11 UX ticket.
- The Costing recommended-route resolver was verified at byte level and by the readiness panel text on Products; its Costing-suite entry points and the four destination-proven codes were not exercised in this run: **NOT TESTED** here.

## 3. Open items, deliberately not marked PASS
- Pricing Policy mappings: `MRP_GOVERNANCE` and `SELLING_SCHEME_POLICIES` remain text-only pending an owner decision; `BATCH_SIZES` and `REGIONAL_MARKETING_REVIEW` remain UNMAPPED.
- WP11 UX-P05: PM BOM 390 px overflow FAIL/deferred (re-observed above).
- Electron-specific acceptance (Step B legacy-route repoint included): NOT TESTED.
- Denied and view-only identity acceptance for G2-1 links: NOT TESTED.
- WP12 integrated release obligations: unchanged and open.
- WP09 launcher IA, independent audit, final handover: open.

## 4. Documentation reconciliation
`WP-08-MASTER-DATA-NAVIGATION.md`: the CURRENT STATE heading (which said G2-1 was in draft-PR review, not merged) and the milestone, gate, next-gate and client-change lines now state G2-1 is merged (#427, `63b536f3`) with bytes verified and hosted acceptance recorded here. Open items above are preserved.
