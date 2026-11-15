# WP09 G1 — Launcher / section information-architecture audit (bulk package, issue #432)

**Status:** G1 audit + design OPTIONS delivered. WP09 remains **OPEN**; programme remains **9/13**. WP08/PEC closed and not reopened. Nothing in this package changes launcher source, registry data, permissions, flags, SQL, deployments or Electron routes.

## 0. Exact source pin and honesty statement

| Item | Value |
|---|---|
| Base (latest `origin/main` at start) | `5735321c4524a9f93947435bd1eccb0f7d7cf9ae` (#433, 15 Nov 2026) |
| Drift vs WP08 closure `1894157…` named in #432 | `git diff 1894157..5735321` = **one file, `WP-09-WIDER-APP-IA-AUDIT.md` (docs only)**. No launcher/source drift. |
| Branch | `claude/lucid-gates-6uwfvx` |
| History | Repository was a shallow clone; `git fetch --unshallow` run so history-based guards see full history (1587 commits). |
| Pre-existing worktree noise | Five `supabase/migrations/20261112*` files show CRLF-only differences in the container worktree. **Untouched and not staged** (hard stop in #432); commit uses explicit paths only. |

**What this session could NOT observe (BLOCKED, stated plainly):** this container has no Supabase connector, no credentials (`.env` is empty) and no SQL tool. **The live row-level registry capture (labels, sections, sort orders, nav modes, flags for each of the 85 modules / 79 Electron / 41 PWA rows) was therefore NOT performed by this session.** The G0 aggregates in #432 (85/6/79/41/38, section distributions, two sort-tie pairs, no duplicate routes, no orphans) are **cited, not re-verified**. Instead the package delivers:

* a **SELECT-only capture pack** (`WP09_G1_LIVE_REGISTRY_SELECT_PACK.sql`, `begin read only … rollback`, no permission/grant/customer data);
* a **verifier** (`registry-verify.mjs`) that, given the exported JSON, re-checks every G0 number, route existence in the static roots, duplicates, ties, orphan sections, and fails if any live `module_key` has no row in the G1 mapping (the **G2 design-freeze gate**);
* a **source-derived** inventory of all 92 HTML pages and a 77-row module mapping (§5) whose `module_key` is *source-proven* for 32 rows and *inferred from the file name* for 45 rows (marked; confirm with the export).

Everything below is therefore classified **SOURCE-PROVEN**, **SYNTHETIC-TESTED** (real launcher code, synthetic registry/grants in Chromium) or **NOT OBSERVED**.

## 1. How the launchers actually work (source-proven)

| Concern | Electron (`index.html`) | PWA (`public/utilities-hub`) |
|---|---|---|
| Data | `v_app_module_registry` (client `electron`, `nav_enabled`, ordered `sort_order`,`label`) + `app_nav_sections` (`is_active`) | same view, client `pwa` |
| Section grouping | by **section label text**, section order from catalog `sort_order` (**falls back to array index if the catalog row is missing**) | by section label; order = catalog sort (default 999) |
| Item order | `sort_order` then `label.localeCompare` (view *and* client) | section → order → label |
| Permission | `get_user_permissions` → `buildPermissionMap` → `getModuleAccessLevel`: `use` (can_edit) / `read` (can_view + min_nav_mode=read) / `view` (locked, href `#`) / `none` | same functions; `none` removed from DOM |
| Failure mode | RPC error / non-array → **all modules hidden (fail closed)** | null perms → all `none` (fail closed) |
| Search | header `#moduleSearch` datalist **and** Ctrl+K palette; both **label-substring only**; palette excludes locked, datalist includes them; empty palette = first 20 | **none** |
| Quick Access | personal pins (≤10) and recents (≤8) + usage-based suggestion in `localStorage` key `sasv-workspace:<user-id>:…`; shows only pins that are currently visible, enabled and routable; never prunes stale pins | **none** |
| Route handling | `normalizeClientRoute`: Electron keeps `public/…`, rewrites `../shared/`, `./admin.html`; PWA rewrites `public/shared/x` → `/shared/x` and **does not rewrite Electron-root routes** (they would 404 — correct, PWA publish root is `public/`) | |
| Local fallback | `injectLocalFallbackModules` adds **Product Shelf Life** and **Staff Directory** if the registry lacks them; section chosen by regex over live labels | — |
| Section-key coupling | colour map `SECTION_KEY_FAMILY` (index.html) and icon map `SECTION_KEY_ICONS` (ui-icons.js) are hard-coded for the 11 keys (+2 fallback keys) | no icons |

## 2. Ranked IA findings

| # | Sev | Finding | Evidence class |
|---|---|---|---|
| F1 | High | **Live row-level inventory not captured** (no DB access). All per-module section/label/order claims below are source-derived; G2 cannot be frozen until the SELECT pack is run and `registry-verify.mjs` passes L10/L11 (mapping complete). | BLOCKED |
| F2 | High | **Density / mixed concerns.** Product & Reference (15), Inventory & Sales (15), MRP (12). By source the "Product & Reference" family mixes ≥6 concerns: product+BOM (WP08 four + route manager), the **six-tile Costing suite**, product-classification masters, inventory masters, reference-library masters, seasonality. Measured launcher height with the G0 distribution (synthetic labels): Electron 79 tiles **2133 px @1280 / 5559 px @390**; PWA 41 tiles **3123 px @1280 / 6721 px @390** — no horizontal overflow in either. | G0 counts + SYNTHETIC-TESTED |
| F3 | High | **Genuine functional overlap (source-proven):** (a) **`season_profile` has two owners** — `manage-season-profiles` (create/edit/delete) and the MRP Master Data Console season tab (also deletes `season_profile` + `season_profile_month`); (b) **`production-overrides.html`** is a legacy shell titled "Supply Overrides" whose only script `js/production-overrides.js` and stylesheet `css/style.css` **do not exist** — it cannot function and duplicates `supply-overrides.html`; (c) `manage-stock-items` and `manage-category-map` both write `inv_stock_item_class_map` (single-item vs bulk path) — *related*, ownership to be stated, not necessarily redundant. Whether (b) is registered is NOT OBSERVED. | SOURCE-PROVEN |
| F4 | Med | **Legitimate specialised modules (do not merge):** RM vs PM issue-allocation and rebuild pairs (different RPCs; roughly 1,200 differing lines across ~3,600); `bottled-stock` / `fg-bulk-stock` / `wip-stock` (distinct data objects); `stock-checker` vs `stock-purchase-explorer` (SKU snapshot vs item stock/purchase); `operations-monitor` (read) vs `operations-control` (writes `etl_jobs`); six Costing tiles over one shared suite shell (multi-entry by design, WP05 A3); WP08 root redirect stubs (legacy URL compatibility, Step B not authorised). `analysis-workspace` vs `lab-analysis-entry/queue`: overlap **NOT DETERMINED** (needs workflow-owner input). | SOURCE-PROVEN / NOT DETERMINED |
| F5 | Med | **Search and Quick Access gaps.** Label-only matching (description, section, aliases such as `etl-monitor`, not searched); two Electron search surfaces behave differently for locked items; **PWA has neither search nor Quick Access** although it is the long (6.7k px @390) client; Quick Access is browser-local per user, so pins don't follow a user between Electron and PWA or devices; recents are written but never rendered. | SOURCE + SYNTHETIC-TESTED |
| F6 | Med | **Client-side fallback injection** places Product Shelf Life / Staff Directory by regex over live section labels and, when the catalog row is missing, orders the off-catalog section by array index → it renders **before every catalog section** (test F3). Any section rename (Option B) silently changes where these land. Whether the live registry already carries both rows is NOT OBSERVED. | SYNTHETIC-TESTED |
| F7 | Med | **Section keys are coupled to client code** (icons, colours) and Electron groups by *label*, so two sections sharing a label would merge. New section keys need a client change. | SOURCE-PROVEN |
| F8 | Med | **Naming.** (i) master pages "Manage Sections / Sub-sections" are plant-location masters but collide with the launcher's own word "section"; (ii) two "category" taxonomies (product `categories/sub_categories` vs inventory `inv_class_category`); (iii) 18 Electron-root masters all use "Manage …" while newer modules use nouns; (iv) key/label/page mismatches: `pm-templates`↔`manage-pm-bom`↔"Manage PM BOM", `lab-test-method-master`↔`test-method-master`, `sales-data-viewer`↔`sales-viewer`, ETL pages titled "ETL Control/Monitor" under `operations-*`. | SOURCE-PROVEN |
| F9 | Med | **Electron-root-only.** 26 launcher-candidate source pages exist only at the repo root and are **not reachable in the PWA publish root**: 18 reference/inventory/plant masters, `production-planning-workbench`, `procurement-planning-workbench`, `supply-batch-plan`, `supply-overrides`, `production-overrides`, `add-log-entry`, `update-log-status`, `sop-dashboard`. Intent (deliberate vs legacy layout) is NOT OBSERVED. Note the Costing suite references `supply-batch-plan` as a destination; PWA reachability of that link is NOT TESTED. | SOURCE-PROVEN |
| F10 | Low | **Sort ties** (G0: MRP 110, Product 95) are deterministic in the SQL view and both clients (label tiebreak, test O1/E2/H3) — not a defect; fragile only if a label is edited. | SOURCE + SYNTHETIC-TESTED |
| F11 | Low | `public/sw.js` precaches `/shared/etl-monitor.html` and `/shared/js/etl-control.js` (renamed to `operations-*`); install skips missing assets with a warning — harmless but stale. | SOURCE-PROVEN |
| F12 | Low | **Cross-links.** Static page-to-page links exist for the Costing suite, WP08 BOM family, Work Log trio, Lab analysis flow and MRP board → issue/allocation. **None found** for planning chain (forecast → workbench → batch plan), classification master hierarchies, plant masters, stock views (a static scan; JS-built navigation not detectable). | SOURCE-PROVEN (scan-limited) |

## 3. Duplicate vs specialised — classification summary

| Class | Modules |
|---|---|
| Confirmed overlap / defect → owner decision | season profiles (2 owners); `production-overrides` (broken duplicate shell) |
| Related, ownership statement needed | `manage-stock-items` / `manage-category-map`; `analysis-workspace` / `lab-analysis-*` (not determined) |
| Legitimate specialised or multi-entry | RM/PM pairs, stock views, ETL pair, Costing six, WP08 stubs, parent-child masters, workflow chains |

## 4. Design options (all unexecuted)

All options keep registry `module_key`s, `target_key`s, routes and permission targets intact; no new module, no duplicate HTML/JS.

| | **A. Hygiene + sub-headings** | **B. ERP lifecycle re-sectioning** | **C. Collapsible families (on top of A)** |
|---|---|---|---|
| Idea | Keep 11 sections. Add a presentation-only contract (`module_key → subgroup`), same pattern as `costing-nav-groups.js` (unmapped keys fall into "More", nothing can vanish). | Replace 11 sections by 9 ERP domains: Work Log & Daily Ops, Planning & Procurement, Inventory & Sales, Product & Costing, Master Data, Plant & Production, Quality (QA/QC & SOPs), Analytics & MIS, System & Administration. | Same contract; related modules fold into 18 collapsed "family" cards (e.g. Product classification, Inventory masters, Reference library, Plant locations & equipment, Rebuild & issue (RM / PM), Costing suite, Stock positions, Lab masters). 12 modules stay flat. |
| Top-level tiles (77 mapped pages) | 77 under 11 headings, 25 subheadings | 77 under 9 sections | **30** (18 families + 12 flat) |
| DB data change | **None** (optional: unique `sort_order` for the 2 tied pairs — separate approval) | **Yes** — `app_modules.section_key` for many rows, new/retired `app_nav_sections` rows | **None** |
| Client change | contract + both renderers + shared filter | icons/colour maps, fallback regexes, tests | accordion UI + a11y + 390px |
| Quick Access / palette | unchanged semantics; palette gains description/subgroup/alias match | unchanged | stays module-level and flat (families never hide a pin or search hit) |
| Role visibility | unchanged (gate is per module); empty subgroups hidden | unchanged per module; some roles lose a familiar section | a family is shown only if ≥1 child is visible; locked children shown inside |
| 390 / 1280 | adds ≈25 headings; PWA needs search | fewer, shorter sections | largest reduction at 390 (6.7k px PWA list collapses) |
| PWA/Electron asymmetry | contract keyed by `module_key` → keys absent in a client are ignored | PWA currently populates 7 of 11 sections; B yields ≈6–8 for PWA | same as A |
| Electron Step B | not needed | not needed | not needed |
| Migration cost | Low–Medium | **High** (DB + client + retraining) | Medium |
| Rollback | remove contract/flag → today's flat view | restore captured `section_key` values (before-SELECT) + revert maps | remove contract/flag |
| Main risk | subgroup spanning two live sections fragments | user retraining; fallback placement; hidden-section confusion | expand/collapse discoverability; keyboard/a11y |

**Recommendation: A, then C** (progressive, client-only, reversible, no registry mutation, reuses the shipped Costing grouping precedent). **B only if the owner wants renamed top-level domains after living with A/C.** In all options, first close F6 (fallback injection) and add shared search across both Electron surfaces and the PWA.

## 5. Module mapping

`WP09_G1_EVIDENCE/module-group-mapping.csv` — 77 launcher-candidate source pages, with candidate key (basis), Electron/PWA route and source reachability, **Option A subgroup**, **Option B section/subgroup**, **Option C family**, duplication class and the data objects each page touches. `live_current_section`/`live_sort_order` are literally `NOT OBSERVED`. Column `optA_domain_section_reference_only` is a *reference* domain only: Option A **does not move any module** from its live section. `non-launcher-pages.csv` explains the other 15 pages (shells, auth, child pages, five redirect stubs). At most 8 of the 85 registry modules (85 − 77) have no mapped source page; the verifier reports the exact unmapped keys.

## 6. Recommended G2 phasing (NOT EXECUTED)

1. **G2-0** Owner decisions (§8); run the SELECT pack; `registry-verify.mjs` must show L10/L11 resolved.
2. **G2-1 Hygiene (no IA change):** fix fallback-injection ordering/placement; one shared search filter for header datalist and palette (label + description + subgroup + alias); PWA search; decide `production-overrides` (retire vs repair) and season-profile ownership; stale SW precache; unique `sort_order` data pass (owner-gated SQL).
3. **G2-2 Option A contract** behind a new presentation flag proposed to the owner (no flag is touched here).
4. **G2-3 Option C families.**
5. **G2-4 Option B** only on explicit owner request.
6. Final roles/flags/PWA/Electron/Windows acceptance stays **WP12**; 390px defects stay **WP11**.

## 7. Tests and evidence (read-only; no writer, no network)

| Suite | Result |
|---|---|
| `scripts/wp09-g1-launcher-audit/source-contract.test.mjs` — route normalisation (9), keys/permission gate (10), ordering/behaviour contracts (16), icon coupling (2), mapping completeness (7), missing-asset and SW probes (2), writer guard (2), verifier self-test incl. mutation (4) | **PASS 50/50** |
| `launcher-browser.test.mjs` — real Chromium, real launcher code, **synthetic** registry/grants: ordering & tie, use/read/locked/hidden, alias grant, palette scope, pin/restore/revoke, fail-closed (2 modes), empty grants, fallback finding, Electron 79 and PWA 41 at 1280/390 | **PASS 33/33** (synthetic; **not** live-role acceptance) |
| Baselines at pinned SHA with full history: WP08 `registry-sql` 18/18, `g2-1/source` 13/13, `g2-1/resolver` 8/8, `sw-freshness-and-gate` 15/15 | PASS |
| WP08 `g2-0/source.test.mjs` | **FAIL 2/13 — pre-existing baseline**: test 11 ("sw.js diff is 18 lines") and test 12 ("forbidden file changed: costing-suite-recommended-ui-route.js") are PR-diff-scope guards for the already-merged G2-0 package and are now outdated by later merged work; not caused by this package |
| WP08 `g2-0/fail-closed.test.mjs` (browser, ~5 min) | PASS 81/81 |
| Live registry row capture / per-role live visibility / installed PWA / packaged Electron / usage analytics | **BLOCKED / NOT TESTED** |

Reproduce: `node scripts/wp09-g1-launcher-audit/source-contract.test.mjs`, `node scripts/wp09-g1-launcher-audit/launcher-browser.test.mjs`, `node scripts/wp09-g1-launcher-audit/build-evidence.mjs docs/master-data-costing/WP09_G1_EVIDENCE`.

## 8. Owner decision matrix

Defaults apply if unanswered; none authorises implementation.

| # | Decision | Options | Recommended default | Essential? |
|---|---|---|---|---|
| D1 | Provide live registry evidence | Run the SELECT-only pack (or authorise a follow-up read-only session with DB access) | Run it before G2-0 | **Yes** |
| D2 | IA direction | A / **A→C** / B | A→C | **Yes** |
| D3 | Season-profile ownership | Keep both / canonical = Manage Season Profiles / canonical = MRP Master Data Console | Decide one canonical writer, other read-only | **Yes** |
| D4 | `production-overrides.html` (missing JS/CSS, duplicate of Supply Overrides) | Retire registration / repair / keep | Retire after D1 confirms it is registered | **Yes** |
| D5 | Costing six tiles placement | Stay in Product & Reference / own "Costing" group (Option B) / one family (Option C) | One family (C) | Yes (business preference) |
| D6 | PWA gets search + Quick Access | Yes / search only / no | Search + Quick Access | No (default applied) |
| D7 | Electron-root-only pages needed on PWA | none / named list from the 26 | None for now | No |
| D8 | Rename plant "Sections/Sub-sections" masters and align the two "category" taxonomy labels | Rename / keep | Rename to "Plant Sections/Sub-sections" at G2-2 | No |

## 9. Hard-stop compliance

No DB or registry write, no permission/RLS/grant change, no SQL migration, no launcher UI/source change, no feature-flag change, no merge/deploy, no WP08/PEC reopening, no touch of the CRLF-only 20261112 migration differences. The launcher pages under test were exercised only against an in-page stub that **records** any writer attempt; the only recorded write is the existing `user_presence` heartbeat.
