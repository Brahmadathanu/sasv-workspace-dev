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
| Service worker | `public/sw.js` cache-first for JS/CSS | **minimal change (revision 2):** module scripts/styles added to the network-first branch; `CACHE_NAME` unchanged (see §3a, R3) |

## 3. Safety properties preserved

- Permission targets unchanged: `module:manage-products`, `module:manage-rm-bom`, `module:manage-sp-bom`, **`module:pm-templates`** (no `manage-pm-bom` key introduced; tested including a wrong-key identity staying denied on both clients).
- Writer safeguards, BOM revision governance, activation guards, effective-dating: **no logic touched**. Diff vs base is limited to an allow-list of import/path/nav lines (tested), and the RPC/table/permission token multiset is identical.
- No new RPC, no schema, grant, RLS, flag, or `localStorage` use.

## 3a. Revision 2 (independent-review corrections, same branch)

| # | Review point | Resolution |
|---|---|---|
| 1 | Step A overwrote existing PWA rows (`ON CONFLICT DO UPDATE`) | Removed. Step A now fails closed if any of the four PWA rows exists (identical, conflicting or partial) and writes nothing; no upsert anywhere |
| 2 | Rollback could delete a pre-existing registration | Rollbacks match exact key + route + the `updated_at` stamp of the apply transaction (receipt). Pre-existing rows cannot match because step A refuses to run when they exist. Missing receipt = refusal |
| 3 | Atomicity | one transaction, `lock_timeout`/`statement_timeout`, advisory lock, `SHARE ROW EXCLUSIVE` table lock, row-count assertions; error ⇒ no writes |
| 4 | SQL tests | `registry-sql.test.mjs`: 18 scenarios on an isolated throw-away PostgreSQL 16 (no Supabase) |
| 5 | Service-worker freshness | `public/sw.js`: the five module scripts and two stylesheets added to the existing network-first branch (6 added lines, `CACHE_NAME` **unchanged** at v393). No cache bump is needed because these URLs were never cached by any earlier generation and now never enter the cache-first path. Rollout gate: `deploy-gate.mjs verify` must pass on the deployed PWA (bytes + service worker) and its token is required by step A |
| 6 | PM BOM 390 px | recorded as parked **UX-P05** (WP11); the browser test no longer asserts a pass for that combination (a `todo` test records it) |
| 7 | Architecture | unchanged: single source, permission keys, legacy Electron stubs, RPC contracts |

## 4. Test evidence (this branch)

Environment: Node 22, Playwright Chromium (stubbed Supabase + jsPDF; no network, no live data, no writer pressed). LF checkout on Linux; CRLF not exercised on this host (the files are byte-moved, so line endings are identical to base).

| Suite (revision 2) | LF | CRLF |
|---|---|---|
| `source.test.mjs` (one-source, stubs, Electron+PWA transitive resolution, permission keys, moved-not-rewritten, RPC surface identical, minimal `sw.js` diff, scope guard, registry file hygiene) | **12/12 PASS** | **12/12 PASS** |
| `registry-sql.test.mjs` (isolated PostgreSQL 16, unix socket, temp dir; **no Supabase**): absent / identical / conflicting / partial / repeat / missing prerequisite / wrong target / no-`ON_ERROR_STOP` / gate token / rollback provenance / step B | **18/18 PASS** | **18/18 PASS** |
| `sw-freshness-and-gate.test.mjs` (mocked service worker incl. a negative control on the BASE `sw.js`; deployment gate pass/fail/CRLF) | **8/8 PASS** | **8/8 PASS** |
| `browser.test.mjs` (Chromium; 4 modules × Electron-root/PWA-public × 390/1280; roles; HOME/login; assets; non-mutating boot; PM key; Season Profiles; jsPDF; legacy forwarding) | **46 PASS, 0 fail, 2 TODO** | **46 PASS, 0 fail, 2 TODO** |
| `csr-pwa-freshness`, 106 other `sw.js`-referencing scripts | identical exit codes before/after the `sw.js` edit (pre-existing failures unchanged) | – |
| 45-script area sweep vs base | identical except `costing-acceptance/verify-served-assets.test.mjs`, which timed out (exit 124) on the base run and passed (0) on this run — timing-dependent, not a regression | – |
| 6 existing PM/BOM smokes | pass | – |

CRLF method: a detached worktree of the committed head with the canonical pages/scripts/styles, `sw.js`, root stubs, test directory and registry SQL converted to CRLF; tests normalise CRLF where they compare text, and the deployment gate hashes after CRLF→LF.
The two `todo` results are the **KNOWN ISSUE** PM BOM 390 px overflow (UX-P05, WP11): they record that the page overflows (scrollWidth 567, same as base) and are deliberately **not** counted as a pass. A separate non-regression bound (≤ 567) passes.

**Known issue, no visual-overflow PASS claimed:** the PM BOM page overflows horizontally at 390 px (scrollWidth 567) on the **base** commit as well (clean base worktree). Parked as **UX-P05** for WP11; the 390 px overflow check is not applied to that combination, a `todo` test records it, and a ≤ 567 non-regression bound passes. All other module/viewport/platform combinations have no horizontal overflow (PASS).

### 4.1 Before/after regression sweep
Run against a clean base worktree (`3f47b115`) and this branch, 45 scripts selected by area (file-name patterns for costing nav/acceptance/PWA freshness, scope guards, BOM/PM/Product, MRP, BMR, activities), 40 s timeout, parallel 6: **exit codes identical for all 45** (`diff` empty).
Non-zero in **both** runs (pre-existing, not caused by G2-0): `costing-acceptance/acceptance-runner.test.mjs`, `costing-acceptance/verify-served-assets.test.mjs`, `manage-activities/page.test.mjs` (exit 124 = exceeded 40 s, browser-driven, **no verdict**), `fg-bit-ux-1/page.test.mjs` (exit 1), `product-sku-lifecycle-smoke.mjs` (exit 1, stale `hub-cache-v332` pin).
Not run: the remaining ~176 scripts (a full sweep was started and abandoned because the browser-driven ones exceed practical time); those that read the moved files were found by grep and updated (§1). `ppm-n6-nav-resolver-smoke` (2 pre-existing PRM failures from WP08 G1) and `eaushadhi-worker` suites were excluded from the sweep as unrelated.

## 5. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | **Older Electron builds** have no `public/shared/manage-*.html`. | Do **not** repoint Electron registry rows (step B) until all installed builds are updated; root stubs keep the legacy route working. |
| R2 | **PWA registry not enabled yet** – nothing is user-visible in the PWA until step A is applied by the owner. | By design; step A is gated on deployment verification. |
| R3 | **Service-worker staleness** (cache-first JS/CSS could pair new HTML with stale cached JS in an installed PWA). | **Mitigated:** five scripts + two stylesheets are network-first (mock-SW tested, with a negative control on the base `sw.js`); `CACHE_NAME` unchanged because these URLs were never cached before. **Rollout gate:** `deploy-gate.mjs verify` must pass on the deployed PWA (bytes + service worker) and its token is required by step A. Residual: clients still running an old service worker until it updates (`skipWaiting` + `claim` shorten this); the gate verifies the host, not each device. |
| R4 | **Season Profiles not in PWA** – the Products page hides "Manage profiles" there. | Owner decision: migrate Season Profiles (needs its own registry/permission review) or accept. |
| R5 | **PDF/print needs jsDelivr** (unchanged); offline PWA cannot export. | Existing behaviour; consider vendoring under WP12. |
| R6 | **PWA sign-in target**: missing session sends users to the hub sign-in (`/utilities-hub/index.html`), not a per-page login. | Matches how the hub is the PWA's only sign-in; verify in authenticated PWA acceptance (NOT TESTED live). |
| R7 | PM BOM 390 px overflow (pre-existing, UX-P05). | WP11; no overflow PASS claimed. |
| R8 | Live behaviour (real roles, real data, real PWA host) **NOT TESTED**; all browser evidence uses stubs. | WP12 integrated PWA/Electron/Windows acceptance + owner authenticated check before step A. |

## 6. Legacy root URL compatibility
Electron registry rows still say `manage-*.html`; those root URLs forward to the canonical page preserving query and hash. The PWA never served root pages (verified 404), so there is nothing to redirect there. Stubs can be removed only after step B is applied **and** all Electron builds contain the new path.

## 7. Rollout plan (nothing below has been performed)

1. Independent review of this PR (ChatGPT) and owner approval; merge by the owner.
2. Deploy the PWA from `public/`; verify `/shared/manage-{products,rm-bom,pm-bom,sp-bom}.html` and CSS/JS return 200 and render for a real view-only and an editor identity (owner-authorised, no writers pressed).
3. Run `deploy-gate.mjs verify <pwa-origin>` (must PASS), then `01_preflight_and_before_select.sql` (read-only; every `pwa_state` must be `ABSENT`), then, with the separate production-mutation approval, `02_apply_pwa_client_rows.sql` (fails closed on any existing PWA row; keep the APPLY RECEIPT); verify the PWA launcher shows the four modules per existing grants.
4. Release Electron (contains the same files); after adoption, optionally apply `03_optional_repoint_electron_routes.sql`; stubs may then be retired.
5. Rollback: `98_rollback_step_b_electron.sql` then `99_rollback_step_a_pwa.sql` with the saved receipts; code rollback by reverting the PR (stubs make an Electron-side revert safe because registry rows were never changed unless step B ran).

## 8. Files in this package
See the PR file list: 9 moved files + `master-data-platform.js`, 4 root stubs, 6 HTML/CSS reference edits (4 root pages, MRP console, plus the moved pages), 7 smoke path updates (1 assertion updated), the test directory `scripts/wp08-g2-0-shared-master-data/`, and `WP08_G2_0_REGISTRY_PROPOSAL_UNAPPLIED/`.
