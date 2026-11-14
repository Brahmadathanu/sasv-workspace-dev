# WP08 G1 — Product / Master Data navigation inventory brief (14 November 2026)

**Gate:** WP08 G1 CURRENT-STATE AUDIT **OPEN / EVIDENCE COLLECTION**, not a design approval or implementation gate. Formal programme **8/13 CLOSED** (WP00–WP07); WP08–WP12 OPEN. WP07 owner-conditionally closed in `MDC07_WP07_OWNER_AUTHORISED_CONDITIONAL_CLOSURE_2026-11-14.md`.

## Source authority and established starting point

- Canonical: `WP-08-MASTER-DATA-NAVIGATION.md`: objective **audit Product/SKU/BOM/route/policy setup hierarchy and reduce top-level proliferation based on evidence**. G0 had not started before this kickoff; no approved IA redesign exists.
- `WP08_WP11_REPOSITORY_ONLY_ENTRY_TRIAGE_2026-11-10.md` confirms `manage-products.html` includes **Products**, **SKUs** and **Readiness** role tabs with `tabProducts` / `productMasterPanel`, `tabSkus` / `skuLifecycleSection`, `tabReadiness` / `readinessPanel`. Governed SKU/Product operations live in `js/products.js` under `module:manage-products` permission. Prior WP02 lifecycle and WP03 creation guidance are closed. This **does not establish** Product→BOM→Route→Policy click-path correctness.
- `PARKED_BACKLOG.md`: **NAV-P01** broader Product/master data navigation; **NAV-P02** server-supplied `recommended_ui_route` codes lack a proven Manage Products client-URL map. WP03 deliberately displays text rather than inventing a link. **UX-P02** is reserved for WP11 visual-density/narrow-screen/dialog work; do not fold it into WP08.
- WP07's Costing navigation contracts and protected shared-source ownership remain binding. WP12 retains final 11-flag cross-module and PWA/Electron/Windows acceptance; do not duplicate or prematurely certify those release gates.

## G1 evidence work — exact-main, repository-only, read-only

1. **Pin source.** Record current `main` SHA, worktree history depth, file/path ownership and whether the PWA/Electron source is shared or platform-specific. Inventory the actual Product/SKU/master-data menu from `index.html`, `manage-products.html`, `js/products.js`, the authoritative app registry and Electron menu; do not infer visibility solely from filenames. Separate PWA and Electron entries and compare role-dependent links.
2. **Build a verifiable route map** for Product list/detail, SKU list/detail and activation/readiness, RM/PM BOM and formulation, manufacturing Product/Family routes, Pricing Policy/PPM and supporting readiness/costing decision views. For every entry: exact source file and selector/handler, displayed label, URL or controller navigation action, query parameter contract, module permission/view gate, PWA/Electron support, and whether real clickable navigation is implemented. Mark a missing path as **MISSING**, not assumed.
3. **Follow the complete handoff** Product → SKU → relevant BOM/route → pricing policy and backwards. Document role selection, Product/SKU ID retention, governed period and effective dating, explicit versus remembered identity, browser Back/Forward contract, cross-tab/new-tab semantics, and handling when a destination is forbidden or absent. No writer/activation presses.
4. **NAV-P02 route-code audit.** Enumerate actual `recommended_ui_route` codes from source and authorised read-only contract evidence; map each code only if an **existing** exact destination, supported params and permission-safe link can be demonstrated. Classify `PROVEN`, `UNMAPPED`, `AMBIGUOUS`, `RESTRICTED`, or `NOT OBSERVED`. Propose no invented URL, fallback or implicit Product/SKU selection.
5. **Duplication/IA findings.** Distinguish legitimate alternate access from unnecessary top-level proliferation. Propose the minimal navigation grouping and breadcrumb/handoff contracts **only after** completing the map; no new top-level module without proof. Record WP09 wider launcher dependencies and WP11 UX-only issues separately.
6. **Evidence and tests.** Add reproducible extraction scripts and deterministic source-contract checks if needed, without mutating `public/shared`, existing flags or permission rules. A mock-backed browser journey is useful if already supported but does not prove live role denial. Report `PASS / FAIL / NOT TESTED / BLOCKED` by link and audience, with bounded 390/1280 browser follow-up checklist after G1.
7. **Security/non-regression:** No production SQL, grants, new accounts, privilege testing with writer requests, new RPCs, global flag use, PWA/Electron deploy or release; no code restructuring during G1. Keep WP07 closed and WP12 open.

## G1 required deliverables and decision gate

- A **source-pinned link/route/permission matrix** for PWA and Electron, with evidence references.
- A **Product→SKU→BOM→Route→Pricing** journey table showing the current paths, missing handoffs and safe deep-link contracts.
- A **NAV-P01/NAV-P02 disposition table** distinguishing remediable navigation defects from unresolved business destination/permission decisions.
- Minimal **G2 design options** with explicit module ownership, no duplicated source, role safety and backwards compatibility; identify any high-risk owner decisions first.
- An isolated, reviewable **documentation-only PR** and exact test/extraction results for independent review. This G1 kickoff does **not** approve G2, implement a redesign, activate a flag or close WP08.

**Review gate:** Present the completed G1 inventory to the owner for an explicit G2 design choice; leave unobserved outcomes NOT TESTED. No chronological estimate or automatic implementation authorisation is implied.
