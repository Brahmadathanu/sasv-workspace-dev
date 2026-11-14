# WP08 G1 — Source-pinned Product / Master Data navigation audit report (14 November 2026)

**Gate:** WP08 G1 current-state audit — **evidence delivered for independent review**. This is **not** a G2 design approval, not an implementation authorisation, and **does not close WP08**. Programme remains **8/13 closed** (WP00–WP07); WP08–WP12 open. WP07 stays closed; WP12 keeps final 11-flag and PWA/Electron/Windows acceptance.
**Assigned issue:** [#405](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/405).
**Nature:** documentation only. No application code, SQL, permission, flag, production, deployment or release action was taken. The only added files are this report and `WP08_G1_evidence/` (a read-only extraction script and its captured output).

---

## 0. Source pin and method

| Item | Value |
|---|---|
| Repository | `Brahmadathanu/sasv-workspace-dev` |
| Baseline `main` (exact) | `06397d7b3075c055f3e03679b8765f9a45edea1d` (`docs(wp08): open G1 Product/master-data navigation audit (#404)`, 2026-11-14) — equals `origin/main` at audit time |
| Clone depth | Cloned shallow (51 commits). **Unshallowed to 1355 commits** (`git fetch --unshallow`) so the historical ownership guards in the existing nav tests could run (§9). |
| Source sharing | **One repository, two clients.** Electron serves the **repo root** through an embedded Express static server (`main.js:288`, `http://localhost:3000`, login at `main.js:334`). The PWA publishes **`public/` only** (`public/netlify.toml`: `publish = "public"`; `public/_redirects`: `/ → /utilities-hub/`). Shared Costing pages live in `public/shared/`; Product/BOM pages live at the **root** (§1, F02). |
| Method | Static source reading + deterministic extraction. No browser session, no authenticated identity, no live database, no registry-table read. |
| Reproducibility | `node docs/master-data-costing/WP08_G1_evidence/extract-nav-evidence.mjs` (run from repo root); captured output in `WP08_G1_evidence/extract-nav-evidence.output.txt`. |

**Evidence labels used throughout:** `SOURCE` (read in this SHA), `TEST` (existing deterministic test run here), `NOT OBSERVED` (needs live data/registry), `NOT TESTED`, `BLOCKED`.

---

## 1. Executive findings (ranked)

| ID | Finding | Class | Evidence |
|---|---|---|---|
| **F01** | **Manage Products has no outbound navigation** to BOM, Route, Pricing Policy or Costing. Its only links are HOME and a `_blank` link to `manage-season-profiles.html`. The Product → SKU step is an in-page tab switch; everything downstream is MISSING. | Missing handoff | `manage-products.html:855-857,1145`; `js/products.js:874-888,2305-2313` |
| **F02** | **PWA/Electron asymmetry in source:** `manage-products.html`, `manage-rm-bom.html`, `manage-pm-bom.html`, `manage-sp-bom.html` exist **only at repo root** (not under `public/`). The PWA publish directory therefore contains **no** Product Master or BOM page; the six Costing modules are shared. Whether the *live* PWA serves them from another pipeline is **NOT OBSERVED**. | Platform risk | Extraction §F; `public/netlify.toml` |
| **F03** | **No inbound deep-link contract** on Manage Products or the three BOM pages: none reads `URLSearchParams`/`location.search`. They cannot receive a Product/SKU identity from any caller. | Missing contract | Extraction §G |
| **F04** | **NAV-P02:** the WP01 readiness server contract emits **11** distinct `recommended_ui_route` codes; the shared client resolver handles **6** codes, of which only **`PRODUCTION_ROUTE_MANAGER`** overlaps. **10 of 11** server codes fall through to `navigable:false / unmapped`. | Defect (remediable) + decisions | Extraction §A–C; `costing-suite-recommended-ui-route.js:255-340` |
| **F05** | **Manage Products' Readiness tab does not use the resolver at all.** It prints `Resolve in: <CODE>` as text and offers only two in-page actions (`Open Product` / `Open SKU`) for `MANAGE_PRODUCTS`, writers only. Even the one proven mapping (`PRODUCTION_ROUTE_MANAGER`) is not offered there. The Costing Control Center *Readiness* lens does use the resolver. | Gap between two surfaces | `js/products.js:1908-1925,1962-1969,2026-2028`; `costing-suite-readiness.js:644-700` |
| **F06** | **Pricing Policy Manager reads `product_id`/`sku_id` from the URL but does not consume them.** The shell only applies them for Material Cost Manager lenses. The resolver nevertheless emits `productId`/`skuId` for `SELLING_PRICE_POLICY_REVIEW`/`PRICING_POLICY_REVIEW`; identity is silently dropped at the PPM boundary. | Broken identity handoff | `costing-suite-shell.js:2247-2253,10041-10066`; `costing-suite-recommended-ui-route.js:210-230` |
| **F07** | **Permission-key / label mismatch for the PM BOM:** page `manage-pm-bom.html`, client gate **`module:pm-templates`**, server BOM-revision RPCs gate on **`module:pm-templates`**, readiness code **`PM_BOM_MANAGER`**, owner-module text "PM BOM". A mapping layer would have to translate between three vocabularies. RM BOM (`manage-rm-bom`) and SP BOM (`manage-sp-bom`) use filename-style keys. | Naming/permission ambiguity | `js/manage-pm-bom.js:149`; `20260913093738_plm_bom_revision_governance_gate_a.sql:557`; `js/manage-rm-bom.js:53`; `js/manage-sp-bom.js:56` |
| **F08** | **No destination-permission pre-check on remediation buttons.** `isConfiguredRemediationTarget` only checks route config and allowed lens; a user can be shown "Open …" for a module they cannot open and will land on that module's own denied state. | Role-dependent risk | `costing-suite-readiness.js:619-627` |
| **F09** | **Readiness RPC read gate is wider than the page gate:** the per-SKU readiness read allows `module:manage-products` view **or** `module:costing-control-center` view, but the Manage Products page itself requires `module:manage-products` view. A Costing-only user can legitimately obtain readiness data (in Costing) yet has no Manage Products entry to act on `MANAGE_PRODUCTS` items. | Role-dependent risk | `20260930073040_wp02_manage_products_readiness_read_access.sql:15-18,67-70`; `js/products.js:2332-2335` |
| **F10** | **Electron application menu contains no module navigation** (File/Edit/View/Window roles, "Check for updates", "Learn More"). The launcher (`index.html`) is the only menu; PWA equivalent is `utilities-hub` (`hub-auth.js`). Both are **registry-driven** from `v_app_module_registry`; the repository seeds only the Production Route Manager row (backfilled migration). Labels, sections and sort order for Manage Products, the BOM pages and the other Costing modules are **NOT OBSERVED**. | Evidence limit | `main.js:474-560`; `index.html:1097`; `hub-auth.js:202`; `20260802150233_register_production_route_manager_app_module.sql` |
| **F11** | **Browser Back/Forward:** Manage Products tab state is not in the URL (no `history.*` use); PRM is URL-authoritative with `popstate`; PPM canonicalises with `replaceState` (never `pushState`). There is no common contract. | Contract gap | `js/products.js` (no `history.`); `costing-suite-production-route.js:1500-1530`; `costing-suite-shell.js:1512-1536` |
| **F12** | Four "readiness" surfaces exist with **different data bases** and no cross-links (§5.2). They are legitimately distinct; the defect is absence of handoffs, not duplication. | IA | `costing-nav-groups.js` `COSTING_LENS_BASIS` |

**Net assessment:** the Costing side already owns a working, tested navigation engine (route config, resolver, query builder, PRM deep link and nav-context, PPM workspace canonicalisation). The Master-Data side (Products, SKUs, BOMs) is an island: no inbound params, no outbound links, Electron-only in source. **WP08 should therefore build bridges using the existing Costing engine and shared sources, not a new navigation system.**

---

## 2. Entry-point inventory (PWA vs Electron)

### 2.1 Launchers

| Client | Launcher source | Item discovery | Visibility gate | Click action |
|---|---|---|---|---|
| **Electron** | `index.html` (root) | `loadClientModuleRegistry("electron")` + `loadNavigationSections()` (`index.html:1097`); local fallback injection of only *Product Shelf Life* and *Staff Directory* (`:834,864`) | `getModuleAccessLevel` against `get_user_permissions`: `use` = can_edit; `read`/`view` per row `min_nav_mode`; `none` hides (`index.html:~1452-1510`; `module-registry.js:100`) | anchor `data-href` → `window.location.href` (`:265,389,443`); route normalised for Electron (`module-registry.js:normalizeClientRoute`) |
| **PWA** | `public/utilities-hub/index.html` + `js/hub-auth.js` | `loadClientModuleRegistry("pwa")` (`hub-auth.js:202`) | same `getModuleAccessLevel` (`hub-auth.js:loadAccessMap`) | `href` = registry `route_path` (normalised `../shared/…` or `/shared/…`) |
| **Electron native menu** | `main.js:474-560` | static template | none | roles only; **no module items** |
| **Electron command palette / quick access** | `index.html:260-300, 370-395` | index of the rendered launcher anchors | inherits anchor visibility | `window.location.href = item.href` |

The registry rows are database data (`app_modules`, `app_module_clients`). **Their live content is NOT OBSERVED.** Only `production-route-manager` is seeded in repo migrations (both clients, section `product-reference-master`, `sort_order 95`, `min_nav_mode view`, `route_path public/shared/production-route-manager.html`).

### 2.2 Module routes, permissions and platform presence

| # | Module (user-facing) | File (source) | Permission target (client) | Server gate | Electron | PWA (source) |
|---|---|---|---|---|---|---|
| 1 | **Manage Products** (Products / SKUs / Readiness tabs) | `manage-products.html` + `js/products.js` | `module:manage-products` (`products.js:6`); view required to open; `can_edit` for writes | `module:manage-products` for governed product/SKU writers and `rpc_set_product_sku_active` (`20261026022352…:92,156`) | **Yes** (root, via static server) | **Not in `public/`** |
| 2 | **Manage RM BOM** | `manage-rm-bom.html` + `js/manage-rm-bom.js` | `module:manage-rm-bom` | not audited (G1 scope = navigation) | Yes | Not in `public/` |
| 3 | **Manage PM BOM** | `manage-pm-bom.html` + `js/manage-pm-bom.js` | `module:pm-templates` | `module:pm-templates` (BOM revision governance, `20260913093738…:557,662,705`) | Yes | Not in `public/` |
| 4 | **Manage Semi-finished BOM** | `manage-sp-bom.html` + `js/manage-sp-bom.js` | `module:manage-sp-bom` | not audited | Yes | Not in `public/` |
| 5 | Costing Control Center (incl. *Readiness*, *SKU Control Status*) | `public/shared/costing-control-center.html` | `module:costing-control-center` | readiness RPC accepts this **or** `manage-products` | Yes (`public/shared/…`) | Yes |
| 6 | Production Route Manager (13 lenses) | `public/shared/production-route-manager.html` | `module:production-route-manager` | per RPC | Yes | Yes |
| 7 | Pricing Policy Manager (workspaces) | `public/shared/pricing-policy-manager.html` | `module:pricing-policy-manager` | per RPC | Yes | Yes |
| 8 | Material Cost Manager / Cost Build Manager / Cost Sheet Review | `public/shared/…` | `module:<key>` | per RPC | Yes | Yes |

Source for rows 5–8: `costing-route-config.js` (`COSTING_ROUTE_CONFIG`); extraction §D.

### 2.3 In-module entry points relevant to the journey

| Surface | Control / handler | Destination | Notes |
|---|---|---|---|
| Manage Products | `tabProducts`/`tabSkus`/`tabReadiness` → `setWorkspaceTab` (`products.js:888`, bound `:1406-1408`) | in-page panels | SKUs/Readiness tabs hidden until a saved Product is selected (`:874-875`). State not in URL. |
| Manage Products | `selectProductRow` (`:894`), `openSelectedProductDialog` (`:904`) | Product dialog | In-page |
| Manage Products | `selectSku` (`:1829`), `openReadinessDetail` (`:1858`) | SKU detail / readiness modal | In-page |
| Manage Products | `homeBtn` → `window.location.href = "index.html"` (`:2312`) | launcher | Confirms unsaved changes first. |
| Manage Products | `Open Product` / `Open SKU` (`manageProductsRemediationAction`, `:1908-1925`) | same page | Only when `recommended_ui_route === "MANAGE_PRODUCTS"` **and** `canWriteModule()`. View-only users get no action (safe). |
| RM / PM / SP BOM | `homeBtn` → `index.html` (`manage-rm-bom.js:1639`, `manage-pm-bom.js:4753`, `manage-sp-bom.js:2080`) | launcher | Only outward navigation. `window.open(blob…)` at `…:3135 / 3576 / 2577` is a print/export, not navigation. |
| RM BOM / SP BOM | `productPicker` (Product-level selection, `v_picker_products`) | in-page | Product-keyed |
| PM BOM | in-page SKU catalogue select (`SKU_CATALOGUE`) | in-page | SKU-keyed |
| Costing Readiness lens | `buildReadinessRemediationActions` (`costing-suite-readiness.js:644-700`) → shell `navigateToCostingRoute(…, {newTab:true})` | PRM / MCM / CCC / PPM | Only for the codes the resolver maps |
| PRM / PPM / CCC | shell tabs, `drillToCostingTarget` (`costing-suite-shell.js:2326`) | other Costing modules | Costing-internal; shared query builder (`:1593-1665`) |

---

## 3. Deep-link parameter contracts

### 3.1 Costing shell query builder (`buildCostingRouteQuery`, `costing-suite-shell.js:1593-1665`)

Emits: `lens`, `workspace`, `status`, `issue`, `source`, `manager_tab`, `trace_component`, `material_area`, `period_start`, `valuation_date`, `refresh_run_id`, `product_id`, `sku_id`, `stock_item_id`, plus PRM keys `product_group_id`, `product_subgroup_id`, `route_family_id`, `family_route_id`, `product_route_id`, `mapping_id`, `as_of_date`, `candidate_kind`, `entity_type`. For PPM, `toCanonicalPricingPolicyRouteParams` converts `lens/policyTab/mrpTab` into `workspace`.

### 3.2 Consumption by destination (who actually *uses* `product_id` / `sku_id`)

| Destination | Reads from URL | **Consumes** `product_id` | **Consumes** `sku_id` | Evidence |
|---|---|---|---|---|
| Manage Products | nothing | **No** | **No** | no `URLSearchParams` |
| RM / PM / SP BOM | nothing | **No** | **No** | extraction §G |
| **Production Route Manager** | `product_id`, `product_group_id`, `product_subgroup_id`, `route_family_id`, `family_route_id`, `product_route_id`, `mapping_id`, `as_of_date`, `candidate_kind`, `entity_type`, `lens` (`applyDeepLinkFromUrl`, `costing-suite-production-route.js:12261-12290`) | **Yes** (identity lenses: `product-route-assignments`, `product-route-editor`, `effective-route-viewer`, `historical-candidate-review`) | n/a | `costing-suite-production-route-nav-context.js:49-53`; `:1500-1530` |
| **Pricing Policy Manager** | `workspace` (+ legacy `lens/policyTab/mrpTab`, canonicalised away), `status`, `issue`, `source`, `period_start` | **No** (read into `LAUNCH_DRILL_CONTEXT`, never applied on this module) | **No** | `costing-suite-shell.js:2247-2253,10041-10066`; `replacePricingPolicyUrl` keeps other params but ignores them (`:1512-1536`) |
| Material Cost Manager (`manual-rate-manager`) | `product_id`, `sku_id`, `manager_tab`, `period_start`, … | Yes (remediation launch context) | Yes | `costing-suite-shell.js:10049-10052` |
| Costing Control Center (`portfolio-readiness`, `sku-control-status`) | `lens`, filters | **No auto-focus consumers** (asserted by existing smoke) | **No** | `scripts/recommended-ui-route-smoke.mjs` (final assertion) |

**Conclusion:** the only module that retains Product identity from a URL is **PRM** (and MCM for material remediation). The Product → SKU → BOM → **Pricing** chain cannot carry identity today.

### 3.3 Remembered versus explicit identity

- **Explicit wins:** PRM nav-context rule 4 — an id present in the URL is an explicit selection and is never overwritten by stored context; if any explicit id differs, nothing is injected from storage (`costing-suite-production-route-nav-context.js` header comment, rule 4).
- **Remembered:** PRM nav-context is behind `COSTING_PRM_NAV_CONTEXT_V1` (localStorage, default OFF, exact value `"1"`). Only identity lenses receive stored context; register/evidence lenses never receive hidden filters (rule 5). Flag state in any live profile is **NOT OBSERVED**; no flag was touched.
- **Display:** `costingNavContext` chips are display-only (`costing-nav-context.js`).
- **Cross-tab:** remediation targets open with `newTab: true` (`window.open(href,"_blank","noopener,noreferrer")`, `costing-suite-shell.js:1679-1681`); the new tab sees only the URL (explicit) plus origin-scoped localStorage. `noopener` removes any parent handle.
- **Governed period:** `period_start` is forwarded for period-scoped Costing lenses only; PPM and PRM are `periodScoped:false` in the registry (`costing-suite-registry.js`; WP06-C9 in the parked backlog records the PPM picker divergence). Effective-dating on Product/SKU/BOM pages is not part of any URL contract.

### 3.4 PWA vs Electron navigation differences (SOURCE)

| Aspect | Electron | PWA |
|---|---|---|
| Client key | `electron` (`Platform.isElectron`) | `pwa` (`costing-suite-shell.js:1553`) |
| Route normalisation | `public/shared/x.html` stays rooted at repo; `../shared/…` → `public/shared/…`; `./admin.html` → `public/utilities-hub/admin.html` | `../shared/…`, `/shared/…`, `public/…` → `/…` (`module-registry.js:24-61`) |
| Same-folder shortcut | On a shared Costing page the shell navigates by bare file name (`resolveCostingRouteHref`, `:1572-1579`) — identical both clients | same |
| New-window behaviour | `window.open` inside Electron: **no `setWindowOpenHandler`/`will-navigate`** in `main.js` (extraction §H) → Electron default child window; preload/context inheritance **NOT TESTED**. The `open-module-url` IPC exists but only the log modules use it | native browser tab |
| Product/BOM pages | Served | **Absent from `public/`** |
| Launcher HOME target | `index.html` (root launcher exists) | `/` → `/utilities-hub/` redirect; `index.html` relative HOME from a Costing page is **NOT TESTED** |
| Cache | n/a | `public/sw.js` lists specific Costing assets (`:94-97`); WP05 freshness guard exists |

---

## 4. Product → SKU → BOM → Route → Pricing journey matrix

Legend — **EXISTS** functional handoff in source; **PARTIAL** link exists but loses identity/permission safety; **MISSING** no path; **AMBIG** more than one defensible destination; **N/A**.

| # | From → To | Mechanism today | Identity retained? | Gate on arrival | PWA | Electron | Status |
|---|---|---|---|---|---|---|---|
| J1 | Launcher → Manage Products | registry anchor | – | `module:manage-products` view | not in source | yes | EXISTS (Electron); PWA NOT OBSERVED |
| J2 | Product → SKU | in-page tab `tabSkus` (selected product) | **Yes** (in-page `selectedId`) | same page | – | yes | **EXISTS** (no URL state; Back leaves module) |
| J3 | SKU → Readiness | in-page `tabReadiness` / `openReadinessDetail` | Yes (in-page) | readiness RPC (manage-products **or** costing-control-center view) | – | yes | **EXISTS** |
| J4 | SKU → RM BOM | none | – | – | – | – | **MISSING** (BOM page takes no params; Product-keyed `productPicker`) |
| J5 | SKU → PM BOM | none; readiness shows text "PM_BOM_MANAGER" | – | `module:pm-templates` | – | – | **MISSING** (SKU-keyed page, no params) |
| J6 | SKU → SP BOM | none | – | `module:manage-sp-bom` | – | – | **MISSING** |
| J7 | SKU/Product → Production Route (assignments / editor / effective) | not from Manage Products. From Costing Readiness lens: resolver → PRM `product-route-assignments?product_id=` (new tab) | **Yes** (PRM consumes `product_id`) | `module:production-route-manager` | yes | yes | **EXISTS from Costing; MISSING from Manage Products** |
| J8 | SKU/Product → Pricing Policy Manager | not from Manage Products. From Costing Readiness lens for `SELLING_PRICE_POLICY_REVIEW`/`PRICING_POLICY_REVIEW`: `?workspace=sku-overview&product_id&sku_id&status` | **No** (PPM ignores ids) | `module:pricing-policy-manager` | yes | yes | **PARTIAL** (destination yes; identity dropped) |
| J9 | Costing Readiness → Manage Products (`MANAGE_PRODUCTS`) | none (resolver: unmapped) | – | `module:manage-products` | – | – | **MISSING** (+ no params to receive) |
| J10 | Readiness (Manage Products) → Route / Pricing / BOM | text `Resolve in: CODE` | – | – | – | yes | **MISSING** (NAV-P02) |
| J11 | PRM → Product master | none | – | – | – | – | **MISSING** |
| J12 | PPM → Product/SKU master | none | – | – | – | – | **MISSING** |
| J13 | BOM → Product/SKU master or Route/Pricing | none (only HOME) | – | – | – | – | **MISSING** |
| J14 | Route → Pricing (and reverse) | Costing shell module tabs / `drillToCostingTarget`; PRM Cost-centre/readiness lenses | partial (shell params) | per module | yes | yes | EXISTS (Costing-internal); identity per J8 |
| J15 | Forbidden destination (any) | module's own denied state; no pre-check (F08) | – | – | – | – | **AMBIG** UX (dead end) |
| J16 | Absent destination (e.g. PWA Product page) | not designed | – | – | – | – | **NOT OBSERVED** |
| J17 | Back/Forward within a leg | Manage Products: none; PRM: `popstate` URL-authoritative; PPM: `replaceState` only | see §3.3 | – | – | – | **AMBIG** (no shared contract) |

Backward direction (Pricing → Route → BOM → SKU → Product) has **no** link anywhere.

---

## 5. NAV-P01 and NAV-P02 findings

### 5.1 NAV-P02 — `recommended_ui_route` code audit

Server codes come from the WP01 readiness composition migrations (`20260929073632…`, `…091014`, `…091036`, `…091118`, `…091329`, `…135243`, plus later WP02/WP04 redefinitions that introduce no new literals; extraction §A). The client resolver is `resolveRecommendedUiRouteTarget` (`costing-suite-recommended-ui-route.js:255`). Classification vocabulary is the brief's.

| Code | Emitted for (dependency) | Existing destination in source | Params supported by destination | Permission target | Class | Notes |
|---|---|---|---|---|---|---|
| `PRODUCTION_ROUTE_MANAGER` | `MANUFACTURING_ROUTE`, `DIRECT_LABOUR`, `PRODUCTION_OVERHEAD` | PRM lens `product-route-assignments` (with `product_id`) else `route-readiness` | `product_id`, `lens` consumed | `module:production-route-manager` | **PROVEN** (Costing Readiness lens) / **UNMAPPED** in Manage Products (F05) | Without product → `route-readiness`, flagged `reason: missing-product` (a fallback, not an implicit selection) |
| `MANAGE_PRODUCTS` | `PRODUCT_MASTER`, `SKU_MASTER`, `SKU_PACK_IDENTITY` | Same module (Manage Products, root page) | **None** (no inbound params) | `module:manage-products` | **UNMAPPED** (cross-module); in-page action exists for writers | Needs an inbound contract (G2) before any link is honest. Electron-only in source |
| `PM_BOM_MANAGER` | `PM_BOM_REVISION` | `manage-pm-bom.html` | **None** | `module:pm-templates` | **AMBIGUOUS** | Code name ≠ permission key; page is SKU-keyed but takes no SKU param; PWA absent |
| `BATCH_SIZES` | `BATCH_SIZE_REFERENCE` | none proven (`supply-batch-size-references.js` is a shared helper; no module page identified) | – | – | **UNMAPPED** | Owner decision: which module owns batch-size references |
| `MRP_GOVERNANCE` | `MRP_POLICY` | PPM workspaces `sku-mrp-policies`, `product-derivation-policies`, `mrp-proposals` … | `workspace`, `status`; ids **ignored** | `module:pricing-policy-manager` | **AMBIGUOUS** | Several defensible workspaces; PPM ignores `sku_id` |
| `SELLING_SCHEME_POLICIES` | `SELLING_PRICE_POLICY`, `SELECTED_SCHEME_POLICY` | PPM `sku-overview` / `scheme-master` / `scheme-rule-register` | as above | same | **AMBIGUOUS** | Server uses this code; resolver instead knows `SELLING_PRICE_POLICY_REVIEW` / `PRICING_POLICY_REVIEW` (different spelling, same destination family) |
| `COMMERCIAL_SALES_ASSUMPTIONS` | `COMMON_COMMERCIAL_BASIS` | PPM workspace `commercial-sales-assumptions` (exists in nav contract) | `workspace` | same | **AMBIGUOUS→near-PROVEN** | Destination is single and exact; not in resolver; id still ignored |
| `DRIVER_GOVERNANCE` | `ADMIN_OVERHEAD`, `FINANCE_ADMIN_OVERHEAD`, `MARKETING_EXPENSE`, global driver issues | Cost Build Manager lens `driver-governance` | `lens` | `module:cost-build-manager` | **PROVEN destination, UNMAPPED in resolver** | Product/SKU identity not applicable (global policy) |
| `QC_ACTION_QUEUE` | `QUALITY_CONTROL_OVERHEAD` | Cost Sheet Review lens `qc-action-queue` | `lens`, filters, `period_start` | `module:cost-sheet-review` | **PROVEN destination, UNMAPPED in resolver** | Period-scoped |
| `MATERIALS_STORES_ACTION_QUEUE` | `MATERIALS_STORES_OVERHEAD` | Cost Sheet Review lens `materials-stores-action-queue` | as above | same | **PROVEN destination, UNMAPPED in resolver** | |
| `REGIONAL_MARKETING_REVIEW` | `REGIONAL_MARKETING_EVIDENCE` | none identified in registry or route config | – | – | **UNMAPPED** | Owner decision |
| `MATERIAL_RATE_MANAGER` | (costing 11Y control; no literal pair in migrations) | Material Cost Manager `manual-rate-manager` action-queue | `manager_tab`, `issue`, `source`, `product_id`, `sku_id`, `period_start` | `module:material-cost-manager` | **RESTRICTED** | Navigable **only if** RM/PM blocking-line counts supplied; readiness contract does not supply them, so deliberately non-navigable (`costing-suite-readiness.js:629-641`) |
| `MATERIAL_RATE_REVIEW` | costing control views (literal in 8 migrations) | CCC lens `costing-review-workbench` | `issue`, `status`, ids, `period_start` | `module:costing-control-center` | **PROVEN** (Costing context) / not emitted by WP01 readiness | |
| `SELLING_PRICE_POLICY_REVIEW`, `PRICING_POLICY_REVIEW` | resolver-side only | PPM `sku-overview` | `workspace`, `status`; ids ignored | `module:pricing-policy-manager` | **NOT OBSERVED** in repo SQL; destination PROVEN, identity not honoured | Live server value cannot be confirmed from repo (no live read) |
| `COST_APPROVAL_WORKBENCH` | resolver-side only | none (explicit `unmapped`) | – | – | **UNMAPPED / NOT OBSERVED** | |

Totals from extraction: **11** server-literal codes; **6** resolver codes; **1** overlap. Note: `PRICING_POLICY_MANAGER`, `COST_BUILD_MANAGER`, `COST_SHEET_REVIEW`, `COSTING_CONTROL_CENTER` appear in migrations as `owner_module` values, not as `recommended_ui_route`; they are not NAV-P02 codes.

**Disposition:** NAV-P02 is **partly a remediable defect** (3 destination-proven codes — `DRIVER_GOVERNANCE`, `QC_ACTION_QUEUE`, `MATERIALS_STORES_ACTION_QUEUE` — plus `COMMERCIAL_SALES_ASSUMPTIONS` have exact existing destinations) and **partly unresolved owner decisions** (`BATCH_SIZES`, `REGIONAL_MARKETING_REVIEW`, ambiguous PPM workspace choice, and any link into Manage Products/BOM pages, which lack an inbound contract). No fallback or implicit Product/SKU selection is proposed.

### 5.2 NAV-P01 — Product / Master Data navigation rationalisation

| Question | Finding |
|---|---|
| Is there *genuine duplication*? | **Not proven.** Alternate access (Costing lens ↔ module; PRM's three Product-keyed lenses; PPM workspaces vs the `mrp-governance`/`policy-manager` lens aliases) is legitimate and already governed by WP05/WP06/WP07 contracts. |
| Unnecessary top-level entries? | **NOT OBSERVED.** Candidate entries (Manage Products, three BOM pages, ~20 root-level reference masters — product groups/subgroups, categories, UOM, stock items, season profiles, etc.; extraction §E) are registry rows whose labels/sections are not in the repo. A reduction proposal would be a guess. |
| Real defects | Missing handoffs (J4–J13), identity dropped at PPM (F06), no inbound contracts (F03), Electron-only Product/BOM pages in source (F02), unmapped readiness codes (F04/F05), no destination pre-check (F08). |
| Readiness surfaces | Manage Products *Readiness tab* (per-SKU composition RPC); CCC `portfolio-readiness` (LIVE_AS_OF portfolio); CCC `sku-control-status` (RUN_SCOPED); PRM `route-readiness` (guarded route readiness). Different bases (`COSTING_LENS_BASIS`); should stay separate but cross-link. |
| Existing grouping to reuse | `COSTING_NAV_GROUP_CONTRACT` (WP05-A3) and `COSTING_PPM_NAV_GROUP_CONTRACT`; `costingNavContext` breadcrumb/chips. WP07 nav-group package is flag-gated (`COSTING_NAV_GROUPS_V1`). |

**Disposition:** NAV-P01 should be reframed from "reduce top-level proliferation" (not evidenced) to **"connect the Master-Data island to the Costing navigation engine"** — a handoff/identity problem. Top-level consolidation is deferred until the live registry is read (owner-approved read).

---

## 6. Role-dependent navigation risks

| Risk | Detail | Severity |
|---|---|---|
| R1 Destination denied after click | Remediation buttons show without checking the user's grant on the destination (F08). | Medium |
| R2 Costing-only user vs `MANAGE_PRODUCTS` | Can read readiness (F09) but cannot open Manage Products; today shows text only — acceptable, but a future link must be permission-aware. | Medium |
| R3 View-only on Manage Products | Remediation actions require `canWriteModule()` (`products.js:1909`); view-only users see text only — correct and must be preserved. | Info |
| R4 `read` vs `view` launcher modes | `min_nav_mode` decides clickable read-only versus locked; rows' modes **NOT OBSERVED** for Product/BOM modules. | Unknown |
| R5 PM BOM key mismatch | Granting `module:manage-pm-bom` would not open the page (`module:pm-templates` required); mapping layer must use the real key (F07). | Medium |
| R6 PWA parity | A PWA user could hold grants for modules whose page is absent from the PWA build. | Medium (NOT OBSERVED live) |
| R7 Flag-dependent navigation | Several Costing nav features are localStorage flags default OFF (`COSTING_NAV_GROUPS_V1`, `COSTING_PRM_NAV_CONTEXT_V1`…); different staff may see different navigation. Not touched here; WP12 owns the 11-flag matrix. | Info |

---

## 7. Scope separation

| Item | Belongs to |
|---|---|
| Inbound deep-link contract for Manage Products/BOM; outbound handoff buttons; `recommended_ui_route` map; identity retention in PPM; pre-click permission awareness; Back/Forward contract; breadcrumb/context on Product module | **WP08 (G2)** |
| Launcher inventory beyond Product/Costing, section ownership, duplicate launcher tiles, command palette/quick-access design, registry content review | **WP09** |
| Creation/activation safeguards, completeness monitoring, activation guard behaviour | **WP10** (preserve fail-closed guards; `rpc_set_product_sku_active`) |
| Visual density, narrow-width (390 px) layout, dialog ergonomics, terminology polish, `UX-P02` | **WP11** |
| 11-flag cross-module matrix, PWA/Electron/Windows release acceptance, cache provenance | **WP12** |
| Parked: `WP06-C9` PPM period-picker authority | WP08/WP12 coordination (not decided here) |

---

## 8. Recommended G2 architecture

### 8.1 Principles (all options)

1. **Reuse, don't add:** Costing's route config, `buildCostingRouteQuery`, resolver, PRM deep-link/nav-context and PPM canonical workspace logic stay the single source for Costing destinations.
2. **Honest links only:** a button appears only when destination, params and permission are proven; otherwise keep the existing text.
3. **Explicit identity:** always `product_id` / `sku_id` in the URL; no implicit selection; remembered context never overrides explicit.
4. **No new top-level module** and no change to permissions, RPCs or flags in G2 unless separately approved.
5. **Backwards compatible:** existing URLs without params behave exactly as today.

### 8.2 Options

| | Option A — Contract-first bridges (**recommended**) | Option B — Resolver-only | Option C — New "Master Data hub" |
|---|---|---|---|
| What | (1) Add a small **inbound contract** to Manage Products (`?product_id=&sku_id=&tab=`) and BOM pages (`?product_id=` / `?sku_id=`) that **selects only; never writes**. (2) Extend the **shared resolver** with the proven codes (`DRIVER_GOVERNANCE`, `QC_ACTION_QUEUE`, `MATERIALS_STORES_ACTION_QUEUE`, `COMMERCIAL_SALES_ASSUMPTIONS`) and the cross-module `MANAGE_PRODUCTS`/`PM_BOM_MANAGER` once (1) exists. (3) Give PPM an optional **identity consumer** (pre-filter/search by `sku_id`/`product_id`) reusing its existing `findRowBySkuId`. (4) Wire the Manage Products Readiness tab to the same resolver. (5) Add a permission-aware gate on remediation buttons. | Only extend the resolver for destinations that already work (no page changes) | Build a new landing/hub module |
| Reuses | everything in §8.1 | resolver only | nothing |
| Risk | Touches 4–6 files incl. shared PPM controller; needs mock tests | Leaves the Master-Data island disconnected; fixes ~4 codes only | Adds top-level proliferation; duplicates sources; contradicts the brief |
| Owner decisions needed | Yes (§10) | few | many |
| Verdict | **Recommended** | Acceptable as G2-slice-1 | **Not recommended** |

### 8.3 Recommended sequencing inside G2 (no dates)

- **G2-1 (lowest risk, shared-source only):** extend resolver mapping for the four exact-destination codes; add destination-permission awareness to the Costing Readiness remediation list; source-contract tests + existing nav suites.
- **G2-2:** PPM identity consumer (selection only) + resolver `SELLING_*`/`MRP_*` workspace decisions (needs owner choice, §10).
- **G2-3:** inbound read-only selection contract on Manage Products and BOM pages (decide PWA presence first, §10-1); then Product-module outbound handoffs and the `MANAGE_PRODUCTS`/`PM_BOM_MANAGER` resolver entries.
- **G2-4:** breadcrumb/context bar and Back/Forward contract on the Product module (reuse `costing-nav-context`).
- WP11/WP12 receive UX and release validation afterwards.

### 8.4 Candidate navigation grouping (only after §4 is accepted)

No new top-level entry. Within existing modules: Product module gains "Related" handoffs (BOM, Route, Pricing, Readiness) per selected SKU; Costing keeps its groups. Top-level consolidation of reference masters is **deferred** until the live registry is read.

---

## 9. Tests and extraction results

Environment: Node `v22.23.4`, no browser session, no network database. All commands read-only.

| Check | Result |
|---|---|
| `node docs/master-data-costing/WP08_G1_evidence/extract-nav-evidence.mjs` | **PASS** (output committed) |
| `scripts/recommended-ui-route-smoke.mjs` | **PASS** (all checks passed) |
| `scripts/costing-cross-links/cross-links.test.mjs` | **PASS 8/8** *(failed 7/8 on the shallow clone — historical ownership guard needs full history; passed after `git fetch --unshallow`)* |
| `scripts/costing-w6-pricing-nav/w6.test.mjs` | **PASS 13/13** *(same shallow-clone caveat; 9 pass/4 fail before unshallow)* |
| `scripts/costing-prm-nav-context/prm-nav-context.test.mjs` | **PASS 26/26** *(shallow caveat)* |
| `scripts/costing-nav-groups/nav-groups.test.mjs` | **PASS 24/24** *(shallow caveat)* |
| `scripts/costing-nav-groups/nav-groups-prm-integration.test.mjs` | **PASS 4/4** |
| `scripts/costing-nav-groups/nav-groups-browser.test.mjs` | **NOT COMPLETED** (exceeded 120 s timeout; no verdict) |
| `scripts/ppm-n6-nav-resolver-smoke.mjs` | **FAIL** — resolver/metadata/F3/F4/F5/SC5 sections 0 failures; **PRM section 2 failures** ("no-context family editor load stays on editor lens", "stale callback cannot override active lens"). These are source-string assertions in a legacy smoke; **pre-existing, unrelated to navigation inventory, not triaged here** (record for WP12 test-debt review). |

### Link / audience status

| Link | Audience | Status |
|---|---|---|
| Launcher → Manage Products | Electron | **NOT TESTED** (needs live registry + identity) |
| Launcher → Manage Products | PWA | **BLOCKED** (page not in `public/`; live registry NOT OBSERVED) |
| Product → SKU → Readiness (in-page) | Electron | **NOT TESTED** (SOURCE: exists) |
| Readiness → PRM `product_id` | Electron/PWA | SOURCE: exists; resolver **TEST PASS**; browser **NOT TESTED** |
| Readiness → PPM | Electron/PWA | SOURCE: partial (ids dropped); **NOT TESTED** |
| Any → BOM pages | any | **MISSING** (no link) |
| Forbidden-destination UX, live role denial | any | **NOT TESTED** — mock-backed tests do not prove live denial |
| 390 / 1280 px | any | **NOT TESTED** (bounded follow-up checklist in §11) |

---

## 10. Outstanding decisions (owner, highest risk first)

1. **PWA scope for master data:** should Manage Products and the three BOM pages be available in the PWA? Today they are Electron-only in source. This determines every downstream choice. (Also: confirm what the live `pwa` registry rows contain — requires an owner-authorised read-only registry query.)
2. **Inbound contract authority:** approve a **selection-only** deep link on Manage Products/BOM (no writes, identity explicit, `product_id`/`sku_id`), and confirm Product-level (RM/SP BOM) vs SKU-level (PM BOM) keys.
3. **PM BOM key vocabulary:** keep `module:pm-templates` as the permission key and map `PM_BOM_MANAGER` to it, or rename (rename touches permissions — out of G2 unless separately approved).
4. **PPM identity behaviour:** should PPM pre-filter/focus by `sku_id`/`product_id` on arrival (selection only)? Choose canonical PPM workspace per code (`MRP_GOVERNANCE`, `SELLING_SCHEME_POLICIES`).
5. **Owner for `BATCH_SIZES` and `REGIONAL_MARKETING_REVIEW`:** no destination exists in source.
6. **Permission-aware buttons:** approve showing a disabled/explained control (vs hiding) when the user lacks the destination grant.
7. **Live registry read** for top-level proliferation evidence (labels, sections, `min_nav_mode`, per-client rows).

## 11. Limitations and bounded follow-ups

- Registry tables, live permissions, flags and the deployed PWA source were **not** read; statements about them are marked NOT OBSERVED.
- No authenticated browser journey was run; no writer or activation control was pressed; no new identity or grant was created.
- Server code literals were derived from migration text; a live `recommended_ui_route` value set (e.g. `SELLING_PRICE_POLICY_REVIEW`) cannot be confirmed from the repo.
- Existing nav test suites include historical diff guards that require full git history (documented above).
- **Bounded follow-up checklist after G2 design** (not performed): 390 and 1280 px for the Product module tabs and handoff buttons; Back/Forward on each leg; new-tab behaviour in an Electron build; a view-only and a Costing-only identity for forbidden-destination handling; PWA launcher entry for any master-data module the owner approves.

## 12. Recommended G2 decision for independent review

**Approve G2 design for Option A (contract-first bridges), starting with G2-1 (shared resolver + permission-aware remediation) as a standalone slice, subject to owner decisions 1–4.** Do not proceed with top-level consolidation until the live registry is read. This report authorises nothing.

*Programme state unchanged: 8/13 closed; WP08 G1 evidence submitted; WP08 not closed; no G2 work started.*
