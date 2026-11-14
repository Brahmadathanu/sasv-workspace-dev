# WP08 G2 — Owner-approved shared Electron/PWA architecture and guarded implementation contract (14 November 2026)

**Status:** The owner explicitly approved making **Manage Products, RM BOM, PM BOM and SP BOM available to both Electron and PWA**, with **one canonical shared implementation**. This is approval of the platform scope and source-sharing architectural direction, **not** blanket approval of new permissions, production registry writes, globally visible links, pricing-policy semantics, server changes, or deployment. Programme **8/13 formally closed**; WP08 OPEN; WP12 final-build checks OPEN.

## 1. Live read-only registry proof (14 November)

The existing `public.app_modules`, `public.app_module_clients` and `public.v_app_module_registry` were queried **SELECT only** in Supabase project `qhmoqtxpeasamtlxaoak`, with no permission or navigation updates. Four existing active/show-in-navigation modules have `min_nav_mode='view'`, `nav_enabled=true` on **Electron only**, and no `pwa` rows:

| Registered module_key | Permission target_key | Current Electron label | section_key | sort_order | Electron route_path |
|---|---|---|---|---:|---|
| `manage-products` | `module:manage-products` | Products | `product-reference-master` | 10 | `manage-products.html` |
| `manage-rm-bom` | `module:manage-rm-bom` | Manage RM BOM | `inventory-sales` | 40 | `manage-rm-bom.html` |
| `manage-sp-bom` | `module:manage-sp-bom` | Manage SP BOM | `inventory-sales` | 50 | `manage-sp-bom.html` |
| `pm-templates` | `module:pm-templates` | PM Templates | `inventory-sales` | 60 | `manage-pm-bom.html` |

**Critical:** PM BOM canonical module key is **`pm-templates`**, and the existing client/server permission key is **`module:pm-templates`**. Do not introduce `manage-pm-bom` as a new registry/permission key and do not rename an existing key. Live registry configuration is now **OBSERVED** for these entries, superseding the G1 report's earlier **NOT OBSERVED** limitation **only for this bounded SELECT**; actual PWA functionality and role gates remain NOT TESTED.

Other existing Costing modules have PWA and Electron rows. No duplicate or surplus entries are inferred from these four module rows; broader launcher consolidation still requires WP09 audit.

## 2. Current source baseline and migration implication

The four existing HTML files are at repository root and link to `public/shared/css/style.css`; BOM pages also use `css/shared-ui.css`, `public/shared/css/sasv-bom.css` and root `js/manage-*-bom.js`; Products uses root `js/products.js`. Their JS imports shared modules using paths such as `../public/shared/js/supabaseClient.js`. Netlify publishes `public/` only; Electron serves repository root. Therefore a simple move of only the HTML, or a copy of the pages to `public/`, would violate parity/one-source ownership.

**Design:** relocate each HTML and its canonical module JS as necessary into `public/shared/` and `public/shared/js/`, rebase relative CSS/JS/import URLs and HOME routing for both clients, and migrate or share any truly module-owned dependencies (including shared-ui CSS and season-profiles links) without duplicating the production implementation. Existing Electron launches must resolve through the new paths; the PWA must load the same bytes with session/auth lifecycle intact.

## 3. G2 execution order and safety gates

### G2-0 — Shared-source migration + platform parity (first mandatory slice)

1. Inventory all four root HTML/JS dependency graphs (imports, CSS, inline references, print/export dependencies, session bootstrap, `mountModuleHome`, CSS assets, images, dynamic URL construction, reader/writer RPC names, managed DOM ids, and module registry route consumers). Explicitly identify all root-relative paths before editing.
2. **Move rather than copy** the four pages and canonical JS to shared tree (or use a demonstrably equivalent single-source arrangement). No duplicated Electron/PWA HTML or JS and no platform fork; preserve semantic and permission ownership.
3. Preserve all existing Product/SKU/BOM, revision/approval, activation, effective-dated, and write operation semantics. No RPC names/args, database schemas, grants, role assignments, or server policies changed.
4. Establish platform-neutral HOME link and auth bootstrap. Ensure BOM PDF/print, stylesheets, season-profiles link and module toolbar actions remain correct; keep existing authorisation fail-closed in both clients.
5. In an isolated branch, demonstrate mock/isolated browser parity at least 1280 and 390 pixels for all four pages, Electron-root route resolution and PWA `/shared/` resolution, role-view vs edit controls, loader/asset errors, and actual non-mutating read paths. Existing source-pinned tests must be updated with evidence, not weakened to hide behavioural regression.
6. **Do not insert/enable PWA registry rows while the files have not passed page/asset/permission verification.** Prepare an exact, idempotent, reviewed registry patch, but keep it unapplied pending the separate owner production-mutation gate. Preserve original Electron module keys, target keys, labels, sections and `min_nav_mode`; change only proven route paths required by the move.
7. Submit implementation PR with exact SHA, before/after source ownership table, LF/CRLF and Chromium regression matrix, PWA/Electron deep-link/asset parity, legacy root URL risk and redirect/compatibility plan. No merge or deploy by implementer.

### G2-1 — Remediation and navigation bridges (subsequent separately reviewed package)

- Extend the **existing** Costing route resolver for individually proven destination codes only, using role/permission-safe links and correct destination semantics. Do not equate a migration literal with live current server output.
- Retain text-only `recommended_ui_route` where a target is unverified, permission-forbidden or lacks a selection consumer. Missing permission must never turn into a navigation-based access bypass.
- Add explicit **selection-only** URL contracts for Product/BOM only after source migration and owner review of Product vs SKU identity and route/back-forward rules. Never invoke writers merely from query params.
- PPM `product_id`/`sku_id` consumption and canonical workspace choices require a separate confirmed contract; `MRP_GOVERNANCE` and `SELLING_SCHEME_POLICIES` cannot be guessed. Preserve existing `module:pm-templates` naming.
- Unresolved `BATCH_SIZES` and `REGIONAL_MARKETING_REVIEW` destination owners remain **UNMAPPED**, not fabricated.
- A future top-level consolidation is not part of these gates; WP09 owns launcher IA.

## 4. Owner approvals vs items reserved

**Approved here:** shared availability for all four modules, one canonical shared source, preservation of current permission keys and creation governance as non-regression constraints, and a bounded implementation preparation/PR workflow.

**Not approved here:** production database registry INSERT/UPDATE, grants or RLS changes, global feature activation, new RPCs, privilege tests using writers, PWA/Electron release, server migrations, changed BOM policies, new Pricing Policy workspace semantics, or mandatory UI layout redesign. Actual release/registry activation and G2-1 business mappings remain separately gated.

## 5. Acceptance / next decision

The first deliverable is a source-migration PR with self-contained testing and exact route/registry activation runbook. ChatGPT independently reviews changed files and regression evidence. The owner separately approves any production registry mutation after binaries/static assets are confirmed available. WP12 owns subsequent integrated 11-flag, PWA/Electron/Windows and security release acceptance. WP08 remains OPEN (8/13); do not mark G2-0 PASS from documentation alone.
