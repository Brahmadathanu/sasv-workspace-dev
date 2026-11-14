# WP08 G2-0 — Shared-source migration: Manage Products, RM BOM, PM BOM, SP BOM (implementation PR candidate, 14 Nov 2026)

**Issue:** [#408](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/408). **Contract:** `WP08_G2_OWNER_APPROVED_SHARED_PLATFORM_CONTRACT_2026-11-14.md`. **Base:** `main` `3f47b11517c0592c71d6c27bf3601ec5e3c51658`.
**Status:** implementation candidate for independent review. **Not merged, not deployed, registry SQL not applied, no permission or flag change.** G2-0 is **not** claimed PASS from this document; the evidence is the test matrix below. WP08 remains **OPEN (8/13)**. G2-1 bridges and PPM identity changes are **not** in this package.

## 1. Before / after source ownership

| Asset | Before (base) | After | How |
|---|---|---|---|
| Manage Products page | `manage-products.html` (root) | `public/shared/manage-products.html` | `git mv` (99 % similar) |
| RM BOM page | `manage-rm-bom.html` | `public/shared/manage-rm-bom.html` | `git mv` |
| PM BOM page | `manage-pm-bom.html` | `public/shared/manage-pm-bom.html` | `git mv` (registry key stays `pm-templates`) |
| SP BOM page | `manage-sp-bom.html` | `public/shared/manage-sp-bom.html` | `git mv` |
| Module scripts | `js/products.js`, `js/manage-{rm,pm,sp}-bom.js` | `public/shared/js/…` (same names) | `git mv` |
| `shared-ui.css` (BOM pages + 4 other root pages + MRP console) | `css/shared-ui.css` | `public/shared/css/shared-ui.css` | `git mv`; all 8 consumers repointed |
| Platform-neutral nav helper | – | `public/shared/js/master-data-platform.js` (new, no data access) | new |
| Legacy root URLs | real pages | 4 tiny redirect stubs (`manage-*.html`) forwarding with query + hash | compatibility only; no module code |
| Existing smokes | read root paths | read canonical paths (path strings only; one assertion updated, see §4) | evidence-preserving |

One-source assertion (tested): each canonical file exists once; no byte-identical copy anywhere; legacy `js/*` and `css/shared-ui.css` are gone; stubs are < 900 bytes with no module/Supabase code.

## 2. Dependency audit (what was inspected and how each was resolved)

| Dependency | Finding | Resolution |
|---|---|---|
| HTML CSS links | `public/shared/css/style.css`, `css/shared-ui.css`, `public/shared/css/sasv-bom.css` (page-relative from root) | rebased to `../shared/css/…` (valid under `/public/shared/` and `/shared/`) |
| `css/shared-ui.css` | root-only; also used by 4 other root pages and by `public/shared/mrp-master-data-console.html` via `../../css/…` (worked only in Electron) | moved to `public/shared/css`; all consumers repointed (side-effect: the MRP console reference now also resolves in the PWA) |
| Module scripts | `js/…` page-relative; imported `../public/shared/js/*` | moved beside their shared imports; imports are now `./…` |
| Auth/bootstrap | `bootstrapApp({ loginPage: "login.html" })` page-relative | `resolveMasterDataLoginPage()` → Electron `/login.html`, PWA `/utilities-hub/index.html` (hub renders its sign-in); permission logic untouched |
| HOME / navigation | `window.location.href = "index.html"` (PM BOM tried a never-set `window.Platform`) | `goMasterDataHome()` → Electron `/index.html`, PWA `/utilities-hub/index.html` (same targets as `Platform.goHome`) |
| Season Profiles link | root-only `manage-season-profiles.html` (separate Master Data page, not in scope) | Electron: `../../manage-season-profiles.html` (same page as before); PWA: link hidden (no dead 404). **Residual:** Season Profiles is not available in the PWA |
| PDF / print | jsPDF + autotable from jsDelivr CDN; print HTML is built in memory and opened as a blob; `window.open(blob)` | unchanged and client-neutral; stubbed in tests; **needs network** (same as today) |
| Images / fonts | none referenced by the four pages | – |
| Dynamic URL construction | only blob URLs for export | unchanged |
| Reader/writer RPCs | extracted `.rpc(...)`, `.from(...)`, `module:*` multisets | **identical to base** (tested) |
| Registry route consumers | `index.html` launcher (Electron) and `hub-auth.js` (PWA) read `v_app_module_registry.route_path` | unchanged code; route plan in the registry proposal |
| Service worker | `public/sw.js` cache-first for JS/CSS | **not changed** (see risk R3) |

## 3. Safety properties preserved

- Permission targets unchanged: `module:manage-products`, `module:manage-rm-bom`, `module:manage-sp-bom`, **`module:pm-templates`** (no `manage-pm-bom` key introduced; tested including a wrong-key identity staying denied on both clients).
- Writer safeguards, BOM revision governance, activation guards, effective-dating: **no logic touched**. Diff vs base is limited to an allow-list of import/path/nav lines (tested), and the RPC/table/permission token multiset is identical.
- No new RPC, no schema, grant, RLS, flag, or `localStorage` use.

## 4. Test evidence (this branch)

Environment: Node 22, Playwright Chromium (stubbed Supabase + jsPDF; no network, no live data, no writer pressed). LF checkout on Linux; CRLF not exercised on this host (the files are byte-moved, so line endings are identical to base).

| Suite | Result |
|---|---|
| `scripts/wp08-g2-0-shared-master-data/source.test.mjs` | **11/11 PASS** – one-source, stubs, Electron+PWA transitive resolution, no page-relative home/login, permission keys, moved-not-rewritten, RPC/table surface identical, shared-ui consumers, helper targets, scope guard, registry-proposal safety |
| `scripts/wp08-g2-0-shared-master-data/browser.test.mjs` | **44/44 PASS** – 4 modules × {Electron-root, PWA-public} × {390, 1280 px}: assets 200, no errors, no horizontal overflow; denied/view/edit guards; non-mutating boot; HOME and no-session targets per client; PM BOM wrong-key denied; Season Profiles; jsPDF; legacy-root forwarding (query+hash) and PWA 404 for root names |
| Existing PM/BOM/Product smokes (7 scripts, paths updated) | pass except `product-sku-lifecycle-smoke` which fails on **both base and branch** with the same stale assertion `service worker generation is hub-cache-v332` (pre-existing, unrelated) |
| `bom-reg-4-pm-tabs-smoke` | one assertion pinned the literal `bootstrapApp({ loginPage: "login.html" })`; **updated** to the platform-neutral call (not weakened: it still proves bootstrapApp is used) |
| Before/after sweep of 45 existing scripts (nav, PWA/SW freshness, scope guards, BOM/PM/Product, acceptance, FG-BIT, activities, MRP) | **identical exit codes on base and branch** – see §4.1 |

**Known baseline, not a regression:** PM BOM page overflows horizontally at 390 px (scrollWidth 567) on the **base** commit as well (measured on a clean base worktree). The test pins that value as an upper bound so G2-0 cannot worsen it; fixing it is WP11 (UX-P02).

### 4.1 Before/after regression sweep
Run against a clean base worktree (`3f47b115`) and this branch, 45 scripts selected by area (file-name patterns for costing nav/acceptance/PWA freshness, scope guards, BOM/PM/Product, MRP, BMR, activities), 40 s timeout, parallel 6: **exit codes identical for all 45** (`diff` empty).
Non-zero in **both** runs (pre-existing, not caused by G2-0): `costing-acceptance/acceptance-runner.test.mjs`, `costing-acceptance/verify-served-assets.test.mjs`, `manage-activities/page.test.mjs` (exit 124 = exceeded 40 s, browser-driven, **no verdict**), `fg-bit-ux-1/page.test.mjs` (exit 1), `product-sku-lifecycle-smoke.mjs` (exit 1, stale `hub-cache-v332` pin).
Not run: the remaining ~176 scripts (a full sweep was started and abandoned because the browser-driven ones exceed practical time); those that read the moved files were found by grep and updated (§1). `ppm-n6-nav-resolver-smoke` (2 pre-existing PRM failures from WP08 G1) and `eaushadhi-worker` suites were excluded from the sweep as unrelated.

## 5. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | **Older Electron builds** have no `public/shared/manage-*.html`. | Do **not** repoint Electron registry rows (step B) until all installed builds are updated; root stubs keep the legacy route working. |
| R2 | **PWA registry not enabled yet** – nothing is user-visible in the PWA until step A is applied by the owner. | By design; step A is gated on deployment verification. |
| R3 | **Service-worker staleness:** JS/CSS are cache-first; a future change to these modules could pair new HTML with stale cached JS in an installed PWA. First load is unaffected (new URLs). | Not changed here because ~40 existing scripts pin `hub-cache-v393`; recommend adding the four module scripts to the network-first list with the next cache bump (WP12 / release). |
| R4 | **Season Profiles not in PWA** – the Products page hides "Manage profiles" there. | Owner decision: migrate Season Profiles (needs its own registry/permission review) or accept. |
| R5 | **PDF/print needs jsDelivr** (unchanged); offline PWA cannot export. | Existing behaviour; consider vendoring under WP12. |
| R6 | **PWA sign-in target**: missing session sends users to the hub sign-in (`/utilities-hub/index.html`), not a per-page login. | Matches how the hub is the PWA's only sign-in; verify in authenticated PWA acceptance (NOT TESTED live). |
| R7 | PM BOM 390 px overflow (pre-existing). | WP11. |
| R8 | Live behaviour (real roles, real data, real PWA host) **NOT TESTED**; all browser evidence uses stubs. | WP12 integrated PWA/Electron/Windows acceptance + owner authenticated check before step A. |

## 6. Legacy root URL compatibility
Electron registry rows still say `manage-*.html`; those root URLs forward to the canonical page preserving query and hash. The PWA never served root pages (verified 404), so there is nothing to redirect there. Stubs can be removed only after step B is applied **and** all Electron builds contain the new path.

## 7. Rollout plan (nothing below has been performed)

1. Independent review of this PR (ChatGPT) and owner approval; merge by the owner.
2. Deploy the PWA from `public/`; verify `/shared/manage-{products,rm-bom,pm-bom,sp-bom}.html` and CSS/JS return 200 and render for a real view-only and an editor identity (owner-authorised, no writers pressed).
3. Run `01_preflight_and_before_select.sql` (read-only), then, with the separate production-mutation approval, `02_apply_pwa_client_rows.sql`; verify the PWA launcher shows the four modules per existing grants.
4. Release Electron (contains the same files); after adoption, optionally apply `03_optional_repoint_electron_routes.sql`; stubs may then be retired.
5. Rollback: `99_rollback.sql`; code rollback by reverting the PR (stubs make an Electron-side revert safe because registry rows were never changed unless step B ran).

## 8. Files in this package
See the PR file list: 9 moved files + `master-data-platform.js`, 4 root stubs, 6 HTML/CSS reference edits (4 root pages, MRP console, plus the moved pages), 7 smoke path updates (1 assertion updated), the test directory `scripts/wp08-g2-0-shared-master-data/`, and `WP08_G2_0_REGISTRY_PROPOSAL_UNAPPLIED/`.
