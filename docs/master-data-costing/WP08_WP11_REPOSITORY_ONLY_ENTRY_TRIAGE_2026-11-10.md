# WP08–WP11 — repository-only entry triage (10 Nov 2026)

**Purpose:** identify reusable existing implementation and honest remaining entry gates while WP05 closure proceeds. **Status:** PRE-KICKOFF AUDIT ONLY; **WP08, WP09, WP10, WP11 formal Gate Status remains G0 / NOT STARTED** in their canonical files. No approval for implementation, permission change, UI redesign, release or formal workpack start. Programme 6/13.

## Reusable evidence discovered

| Workpack | Verified repository evidence | What it does *not* prove | Suggested first focused gate |
|---|---|---|---|
| WP08 Product/Master Data navigation | Current `manage-products.html` already provides distinct role-tabbed **Products**, **SKUs** and **Readiness** panels; Products list, SKU lifecycle panel, readiness panel, and governed product/SKU dialogs. `js/products.js` has permissions target `module:manage-products` and governed `rpc_set_product_sku_active` integration. Prior WP02 lifecycle/WP03 creation-guidance work is completed. | Does not prove a coherent end-to-end Product→SKU→BOM→Route→Pricing Policy navigation hierarchy. Neither a current click-path inventory nor authenticated 390/1280 responsive checks were produced here. | **WP08 G1:** enumerate exact menu links, product/SKU handoffs, BOM, route and pricing-policy destinations (including roles and deep links); identify duplicate top-level links before proposing restructuring. Reuse existing modules; no premature redesign. |
| WP09 Wider app launcher/section audit | Current root `index.html` is a real app shell; modules maintain their own header/home navigation. Programme/canonical WP09 file explicitly requests a wider launcher duplication audit. | Search of a few files is not a complete launcher inventory or proof that sections are duplicated. | **WP09 G1:** read-only extract current launcher and module registry, role visibility, duplicate entry points and intended section ownership; follow WP08 navigation decisions before any change. |
| WP10 Future creation safeguards | `js/products.js` includes `rpc_set_product_sku_active` and governed product SKU writers; live activation guard migration `20261026022352_ci038_sku_activation_guard.sql` and `scripts/product-sku-lifecycle-smoke.mjs` exist. WP02/WP03 prerequisites were completed. | Existing activation guard is not proof of a systematic future completeness monitoring/detection service or an accepted WP10 contract. | **WP10 G1:** reuse WP01–WP04 completeness/readiness contracts; enumerate which creation/activation transitions enforce invariants vs merely warn, what happens on later BOM/price changes, and any unattended exceptions. |
| WP11 UX consistency | Current `manage-products.html` uses `sasv-core` theme, shared style tokens and module chrome; `js/products.js` uses `mountModuleHome`. Canonical WP11 retains parked **UX-P02** visual density, dialog ergonomics, narrow-width polish. | Shared styling alone is not end-to-end consistency; U11 terminology/label and 390 px acceptance remain separate. | **WP11 G1:** design acceptance checklist for terminology, panels, dialogs, keyboard and 390/1280 layout; resolve WP08/09 structural choices before implementation. |

## Exact immediate WP08 Product module entry points (from current source)

- `manage-products.html` tabs: `tabProducts` / `productMasterPanel`, `tabSkus` / `skuLifecycleSection`, `tabReadiness` / `readinessPanel`. SKU/Readiness tabs are initially hidden pending controller state/permissions.
- Governed product dialog controls include `productDialogClose`, and SKU dialog has `skuSaveBtn`, `skuCreateBtn`, `skuToggleActiveBtn`. This is not permission acceptance; buttons can be hidden or disabled based on live rights and readiness.
- Existing launcher navigation/deep-link mapping across Product, BOM, Route and Pricing has **not** been comprehensively extracted. Do not invent click paths from mere filenames.

## Sequencing / no duplicate work

1. WP05 remaining negative-identity authority, PRM run-82/F1, D3/L1 and historical F sign-off remain primary focus.
2. The WP08–WP11 early evidence can support a single architecture inventory wave, but **none** of those workpacks is retroactively labelled started/complete because another project has merged code.
3. When WP08/09 design changes are approved, do them before WP12 final B1 integrated responsive/deep-link/11-flag regression. WP12 remains the release-level receiver; avoid duplicating its final run in individual UX workpacks.
4. Keep WP10 critical creation/activation prevention separate from cosmetic UI or a pure navigation rewrite; preserve fail-closed activation guards and audit history.

**No source code, production data, live browser, security test identities, flags, deployment or workpack Gate Status was changed.**
