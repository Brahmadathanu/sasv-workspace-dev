# WP08 G2-1 — Bulk implementation and gate report (14 November 2026)

**Status:** IMPLEMENTED IN SOURCE, DRAFT PR, **NOT MERGED, NOT DEPLOYED, NOT LIVE-VERIFIED.** WP08 remains **OPEN**; programme **8/13**. Issue #425. Owner approves merge and any rollout separately.

Starting `main`: `26e3f9f29f5a22bdc6cdd82b66ba19918047ad51` (the issue named `df66ca9…`; `main` had advanced, the refreshed SHA is pinned and was not overwritten). Branch `claude/blissful-thompson-lv1ekb`. Head SHA, PR link and the final test matrix are in §10 and in the PR description.

No SQL, grant, RLS, permission key, registry row, RPC, migration, global flag, writer/approval action, deployment, Electron release or merge was performed or changed. G2-0 activation receipt, `master-data-write-guard.js`, `master-data-platform.js`, the four page HTML files and the Electron redirects are untouched.

## 1. What changed (stages A–E)

| Stage | Change | Files |
|---|---|---|
| A | Resolver now maps four **destination-proven** server codes; every navigable target is gated by the destination module's own view permission using the rows the shell already receives from `get_user_permissions`; denied / unknown / failed resolution degrades to non-link text with a reason. `MATERIAL_RATE_MANAGER` blocking-count requirement and existing PRM/PPM/MCM behaviour preserved. | `costing-suite-recommended-ui-route.js`, new `costing-destination-access.js`, shell/readiness/control-center wiring |
| B | Selection-only inbound URL contract on Manage Products, RM BOM, SP BOM, PM BOM (§4). | new `master-data-selection.js`, `products.js`, `manage-{rm,sp,pm}-bom.js` |
| C | Permission-gated **Related / Open in** links from Manage Products SKU + Readiness surfaces; Readiness `recommended_ui_route` resolved through the **same** resolver; RM BOM → Product backlink. | `products.js`, `manage-rm-bom.js`, resolver helpers |
| D | PPM identity research → **no single canonical workspace + tested consumer** for `MRP_GOVERNANCE` / `SELLING_SCHEME_POLICIES`; kept text-only; owner-decision matrix §6. | tests only |
| E | Tests (§9), this report, WP-08 header refresh, service-worker network-first guards. | `scripts/wp08-g2-1-navigation/**`, `sw.js`, docs |

## 2. Route-code matrix (server `recommended_ui_route` codes; re-inventoried from current source)

| Code | Class after G2-1 | Destination / parameters | Permission gate | Evidence |
|---|---|---|---|---|
| `DRIVER_GOVERNANCE` | **PROVEN → navigable (new)** | Cost Build Manager lens `driver-governance`; no identity (global policy) | `module:cost-build-manager` view | `costing-route-config.js` allowedLensIds; `resolver.test.mjs` |
| `QC_ACTION_QUEUE` | **PROVEN → navigable (new)** | Cost Sheet Review lens `qc-action-queue`; `period_start` only (queue ignores ids) | `module:cost-sheet-review` view | route-config; registry `periodScoped:true` |
| `MATERIALS_STORES_ACTION_QUEUE` | **PROVEN → navigable (new)** | Cost Sheet Review lens `materials-stores-action-queue`; `period_start` only | `module:cost-sheet-review` view | same |
| `COMMERCIAL_SALES_ASSUMPTIONS` | **PROVEN → navigable (new)** | PPM workspace `commercial-sales-assumptions` (validated against `PRICING_POLICY_WORKSPACES`); `period_start` (the sole period-scoped PPM workspace); **no ids** (PPM ignores them) | `module:pricing-policy-manager` view | `selection.test.mjs` registry assertion; existing QC-queue code already navigates to the same workspace |
| `PRODUCTION_ROUTE_MANAGER` | unchanged (PROVEN, `product_id` consumed) | PRM `product-route-assignments` / `route-readiness` | `module:production-route-manager` | existing |
| `MATERIAL_RATE_MANAGER` | unchanged (RESTRICTED: needs RM/PM blocking counts) | MCM `manual-rate-manager` | `module:material-cost-manager` | existing |
| `MATERIAL_RATE_REVIEW`, `SELLING_PRICE_POLICY_REVIEW`, `PRICING_POLICY_REVIEW` | unchanged (destination proven; PPM identity **not** carried) | CCC review workbench / PPM `sku-overview` | respective module | existing; Products UI labels PPM links "Opens the workspace only; this Product/SKU is not carried over." |
| `MRP_GOVERNANCE`, `SELLING_SCHEME_POLICIES` | **AMBIGUOUS — text only** | several plausible PPM workspaces; PPM consumes no ids | — | §6 |
| `BATCH_SIZES`, `REGIONAL_MARKETING_REVIEW` | **UNMAPPED — text only** | no proven destination | — | unchanged |
| `MANAGE_PRODUCTS`, `PM_BOM_MANAGER` | unchanged text in Costing shell | now have inbound contracts (§4); a Costing→Master-Data mapping is a follow-up, **not** implemented (not in route-config; Issue scope) | — | see §8 |
| `COST_APPROVAL_WORKBENCH`, unknown codes | unmapped, never invented | — | — | existing |

## 3. Permission-aware resolution (Stage A contract)

* One authority: `resolveRecommendedUiRouteTarget` (wrapper over the unchanged mapping logic). A navigable target survives only if `get_user_permissions` returned a row for the destination's `permissionTarget` with **boolean `can_view === true`**. Strings, `false`, missing rows, a not-yet-resolved load and a failed/ non-array load all → non-navigable with `reason` `permission-denied` / `permission-unknown` and the text from `describeRecommendedRouteUnavailable`. No `navigateParams` leak for a denied target.
* The gate is **armed by the shell at module load** (fail closed before any permission load). Unarmed (pure unit tests, non-shell hosts) it is a pass-through so the pure mapping stays testable.
* Applies automatically to every consumer of the resolver: Costing Readiness, Control Center SKU control, review worklist, draft-run evidence.
* The destination keeps its own gate on arrival; the link never bypasses it. View-only users can navigate to read-only destinations; no link invokes a writer.
* Manage Products (no shell) arms the same gate from its own single `get_user_permissions` read; the canonical-table fallback or any failure leaves all outbound links as text.

## 4. Selection-only URL contract (Stage B)

All parsing is in `master-data-selection.js` (no data access, no imports). Pages call it only **after** session + permission verification and only select an object the page's already-loaded, permission-filtered data proves exists.

| Page | Parameters | Identity (verified in source) | Rules |
|---|---|---|---|
| Manage Products | `product_id`, optional `sku_id`, `tab=products\|skus\|readiness` | Product id; SKU must be in the Product's own SKU list (`product_skus.product_id`) | `sku_id` alone, mismatched SKU, unknown product → no selection + status; bad tab ignored; `tab=readiness`+`sku_id` opens the readiness detail |
| RM BOM | `product_id` | picker `v_picker_products.id` == `rm_bom_header.product_id` | picker hydrated before apply; unknown id ignored; no fallback |
| SP BOM | `owner_item_id` | picker `v_picker_sp_owners.id` == `sp_bom_header.owner_item_id` — **a stock item, not a Product** | `product_id` is explicitly ignored with a status; a product id is never reinterpreted as an owner; **no Product→SP link exists anywhere** |
| PM BOM (`pm-templates`) | `sku_id` | SKU catalogue `v_sku_catalog_enriched.sku_id`; Overrides-tab SKU picker | selects only the Overrides SKU picker (reads `rpc_pm_ovr_list`); the preview picker stays empty so **no `rpc_pm_preview_effective` call**; template ids are not part of the contract |

* Ids are strict positive integers (`^[1-9]\d{0,15}$`, safe-integer); duplicates are ambiguous → ignored. Explicit URL beats remembered state; no-param URLs are byte-for-byte baseline (no status, no rewrite).
* History: pages **never `pushState`**. Once entered via, or carrying, selection params the URL is kept truthful with `replaceState` (no history growth; verified). `popstate` re-applies the URL; while unsaved/edit state exists (Products `unsaved`/`skuDirty`/`editing`/new mode; BOM edit modes or dirty rows) Back/Forward is **blocked** and the URL is restored — existing dirty protection is preserved, not bypassed. A re-entrancy guard prevents loops.
* Hrefs are same-folder relative (`manage-rm-bom.html?product_id=11`): Costing and Master Data pages share `public/shared/`, served at `/public/shared/` (Electron root) and `/shared/` (PWA) → platform-neutral. HOME logic untouched.

## 5. Before / after link matrix (Product → SKU → BOM → Route → Pricing and reverse)

| Leg | Before (G1) | After (this PR) |
|---|---|---|
| Product → SKU | in-page tab, no URL | + URL `product_id`[`&sku_id`][`&tab`] selection; URL kept truthful |
| SKU → Readiness | in-page | + `tab=readiness&sku_id` |
| Product → RM BOM | MISSING | **Related link** `manage-rm-bom.html?product_id=` (needs `module:manage-rm-bom` view) |
| SKU → PM BOM | MISSING (text `PM_BOM_MANAGER`) | **Related link** `manage-pm-bom.html?sku_id=` (needs `module:pm-templates` view) |
| Product → SP BOM | MISSING | **still none (by design):** SP BOM is keyed by owner stock item; no Product→owner association is verified |
| Product → Production Route | Costing only | **Related link** to PRM `product-route-assignments?product_id=` (needs `module:production-route-manager` view) |
| Readiness item → Route/Driver/QC/Materials/Commercial assumptions | text | **link** where proven + permitted; ambiguous/unmapped stay text |
| Readiness item → Pricing (`PRICING_POLICY_REVIEW`…) | text | link to PPM workspace, explicitly "Product/SKU not carried over" |
| RM BOM → Product | MISSING | **"Open Product in Manage Products"** in the existing More-actions menu (verified `module:manage-products` view; only with a resolved Product) |
| SP BOM → Product | MISSING | none (owner is a stock item) |
| PM BOM → Product/SKU master | MISSING | **not implemented:** catalogue select does not expose `product_id`; adding it is a data-shape assumption → not guessed |
| Route ↔ Pricing, Pricing → Product/SKU master | per G1 | unchanged; PPM→Product/SKU master not built (PPM has no identity consumer) |
| Forbidden destination | dead end | non-link text with the reason |

## 6. Pricing ambiguity — owner decision matrix (Stage D)

Research result (current source): PPM reads `product_id`/`sku_id` into `LAUNCH_DRILL_CONTEXT` and discards them; no workspace has a row-focus/identity consumer (`selection.test.mjs` tripwire fails if a workspace starts declaring one). Therefore **nothing was guessed** and no PPM link claims deep linking.

| Code | Candidate workspaces (ids exist in registry) | Recommended mapping | Implication of approving | Needed before it can be linked |
|---|---|---|---|---|
| `MRP_GOVERNANCE` | `sku-mrp-policies`, `product-derivation-policies`, `mrp-proposals`, `proposal-decisions` | `sku-mrp-policies` (current policy per SKU) | link lands on a list; no row focus | owner confirms workspace; optionally a separate PPM selection consumer package |
| `SELLING_SCHEME_POLICIES` | `sku-overview`, `scheme-master`, `scheme-rule-register` | `sku-overview` | same as existing `PRICING_POLICY_REVIEW` target | owner confirms; PPM id consumer for real SKU focus |
| PPM `product_id`/`sku_id` consumption | all | out of scope; needs its own contract (WP06 PPM picker divergence note) | would turn "workspace only" links into true deep links | separate confirmed contract |
| `BATCH_SIZES`, `REGIONAL_MARKETING_REVIEW` | none | remain UNMAPPED | — | owner names the owning module |

## 7. Writer / no-op proof

* Static: `source.test.mjs` — reader/writer surface (RPC names, tables, permission literals) of the four pages is **identical** to `main`; the selection and access modules contain no imports, `supabase`, `.rpc(`, `.from(`, `fetch`, storage; the apply functions contain no data call; resolver has no I/O; `module:pm-templates` literal count unchanged and no `module:manage-pm-bom`.
* Runtime (real Chromium, data-aware stub that records every table access and RPC with arguments): for every URL case on both platforms **zero** table writes, **zero** RPCs matching create/update/set/save/delete/approve/submit/activate/upsert/insert/clone/publish/supersede/rebuild/preview/map_set/map_clear, zero unexpected external requests. Allowed reads observed: existing Product/SKU/picker/BOM header+line selects, governed-period and readiness readers, `rpc_pm_ovr_list(p_sku_id)` only.
* Denied role: URL selection performs no Product/SKU/BOM/SKU-catalogue/overrides read.
* Residual: `rpc_pm_ovr_list` and the readiness readers are declared `volatile` SQL wrappers in the repo; their read-only behaviour is the page's existing, G2-0-accepted behaviour (same call as manual SKU selection) and is **not independently proven side-effect-free from source here**. Real-identity acceptance remains NOT TESTED.

## 8. Runtime limitations / not done

* Live authentication, role gating and the live PWA are **NOT TESTED** by this PR (isolated mock only). Existing real view-only acceptance remains NOT TESTED; no role was minted or granted.
* Electron `window.open`/`target=_blank` child-window preload/context behaviour is **NOT TESTED** (Electron binary not run); verified: href resolution under the Electron-root and PWA-public prefixes in Chromium, `noopener`.
* Costing shell → Manage Products / PM BOM links for `MANAGE_PRODUCTS` / `PM_BOM_MANAGER` are possible now that inbound contracts exist, but are outside the verified route-config and are left as a follow-up owner/scope decision (non-binding recommendation: Product-level `PRODUCT_MASTER`/`SKU_MASTER` → `manage-products.html?product_id=&sku_id=&tab=`; `PM_BOM_MANAGER` → `pm-templates` `sku_id`).
* Service worker: `CACHE_NAME` unchanged (`hub-cache-v393`, pinned by an existing gate test). Because the resolver and control-center script were previously cache-first, they and the two new modules were added to the network-first branch as separate patterns; the G2-0 pattern is byte-identical. An installed PWA picks this up when the new `sw.js` installs.
* Pre-existing, unrelated: see baseline in §9. PM BOM 390 px overflow is **WP11 UX-P05 — FAIL/deferred**, recorded as a TODO test, not masked, not a PASS.

## 9. Test matrix

Environment: Node 22, Playwright Chromium, isolated mock (data-aware Supabase stub + jsPDF stub; no network, no live data, no writer exercised). Command form: `node --test <file>`. Code revision tested: `bdeda88` (later commits are docs only). **LF** = Linux checkout; **CRLF** = detached worktree of the same revision with the changed/pinned text files converted to CRLF (method as in the G2-0 report). "Baseline" = the same file run once on untouched `main` `26e3f9f`.

| Suite | LF | CRLF | Baseline on `main` |
|---|---|---|---|
| `wp08-g2-1-navigation/resolver.test.mjs` (4 new codes, anti-guessing, permission gate: unknown/denied/view/edit/malformed/failed) | 8/8 PASS | 8/8 PASS | n/a (new) |
| `wp08-g2-1-navigation/selection.test.mjs` (strict ids, parse/build contracts, offer rules, PM key, PPM tripwire, hrefs) | 8/8 PASS | 8/8 PASS | n/a |
| `wp08-g2-1-navigation/source.test.mjs` (surface unchanged, data-free modules, SW, ownership) | 9/9 PASS | 9/9 PASS | n/a |
| `wp08-g2-1-navigation/browser.test.mjs` (Electron-root + PWA, 1280/390, view/edit/denied, selection, mismatch/invalid, legacy, Back/Forward + dirty block, replaceState, handoffs, backlink, zero writer RPC) | 44 PASS, 0 FAIL, **1 TODO** (PM BOM 390 px UX-P05) | 44 PASS, 1 TODO | n/a |
| `wp08-g2-0-shared-master-data/browser.test.mjs` | 46 PASS, **2 TODO** (UX-P05, unchanged) | 46 PASS, 2 TODO | 46 PASS, 2 TODO |
| `…/fail-closed.test.mjs` | 81/81 PASS | 81/81 PASS | n/a (run once; passes) |
| `…/sw-freshness-and-gate.test.mjs` | 15/15 PASS | 15/15 PASS | 15/15 PASS |
| `…/registry-sql.test.mjs` | 18/18 PASS | 18/18 PASS | 18/18 PASS (token now computed from the G2-0 reviewed revision — see §10 note) |
| `…/source.test.mjs` | 11 PASS, **2 FAIL (#11, #12)** | same | **same 2 FAIL (#11, #12)** — pre-existing |
| `costing-readiness-usability/readiness-usability.test.mjs` (Chromium on) | 21/21 PASS | 21/21 PASS | n/a |
| `recommended-ui-route-smoke.mjs`, `wp04-readiness-client-contract-smoke.mjs`, `costing-sw-freshness/pricing-policy-sw.test.mjs` | PASS | PASS | PASS |
| `costing-review-worklist/run-context`, `run-selection` | 10/10, 18/18 PASS | — | PASS |
| `costing-nav-groups/{browser,prm-integration}`, `costing-nav-mcm-cbm/n2-browser`, `costing-prm-nav-context/*browser/lens-presentation`, `costing-w6-pricing-nav/w6-browser`, `costing-scope-guard/*` | all PASS (12, 4, 10, 11, 12, 10, 5, 38) | — | PASS |
| **Pre-existing failures, identical on `main` (not caused by G2-1)** | `review-worklist` #1,2,6,7,10,11; `wp05-closure` #13; `ppm-n6-nav-resolver-smoke` #1; `nav-groups.test` #23,24; `n2.test` #7,8,9; `prm-nav-context.test` #25; `w6.test` #10–13; g2-0 `source` #11,12 | — | the same test numbers fail on `main` (baseline run, `lf-base` vs `lf-mine` diff: only `registry-sql` differed, then fixed) |

Reported honestly: those baseline failures are source-pinned tests comparing against older bases/immutable ranges and were **not** fixed or weakened here; they are not PASS.

## 10. Notes, deviations and handback

* **Existing tests updated (with evidence, not weakened):** (1) G2-0 `source.test.mjs` #7 (#416 bounded-change check) now excludes only lines that G2-1 added/removed relative to `main`@G2-1 start; every other line must still pass the #416 allow-list and the `.rpc(`/`.from(`/`module:` ban; the G2-1 additions are checked by `wp08-g2-1-navigation/source.test.mjs`. (2) G2-0 `registry-sql.test.mjs` computes the gate token from the G2-0 reviewed revision blobs instead of the working tree: step A was stamped for, and applied live against, those bytes; G2-1 intentionally changes the four page scripts. The proposal SQL/receipt files were **not** re-stamped or edited. Consequence for WP12: `deploy-gate.mjs verify`/`stamp` against the post-G2-1 bytes would yield a new token; step A is already applied, so no action is required unless the owner re-runs it.
* **Code revision tested:** `bdeda8808c7bc9216e2128916ef622c97a13892b`. The final PR head SHA (docs-only commits on top, if any) is stated in the PR description.
* **Changed-file inventory vs `26e3f9f`:** docs (WP-08 header, this report); `public/shared/js/` — new `costing-destination-access.js`, `master-data-selection.js`; modified `costing-suite-recommended-ui-route.js`, `costing-suite-readiness.js`, `costing-suite-control-center.js`, `costing-suite-shell.js`, `products.js`, `manage-rm-bom.js`, `manage-sp-bom.js`, `manage-pm-bom.js`; `public/sw.js`; tests `scripts/wp08-g2-1-navigation/*` (new) and the two G2-0 test files above. **No** SQL/migration, HTML page, permission, registry, Electron-root, flag or activation-receipt file changed. (The five `supabase/migrations/20261112*` files show CRLF-only modifications in the working copy of this session's container; they are not part of this PR.)
* **WP11 hand-back:** PM BOM 390 px page overflow (UX-P05) remains FAIL/deferred (recorded as a TODO test, not masked). Mobile/visual polish of the new Related block and status line is not designed beyond reuse of existing classes.
* **WP12 hand-back:** live authenticated PWA/Electron acceptance of the new links and URL selection (including a real view-only identity), Electron child-window behaviour, installed-PWA service-worker pickup, and Step B Electron legacy-route repoint remain open.
* **WP09 hand-back:** no launcher/IA change; no new hub/module.

## 11. Essential owner decisions

1. Approve or amend the Pricing mapping recommendation in §6 (`MRP_GOVERNANCE`→`sku-mrp-policies`, `SELLING_SCHEME_POLICIES`→`sku-overview`), and whether a separate PPM `product_id`/`sku_id` selection consumer package is wanted.
2. Optional scope: add Costing-shell mappings for `MANAGE_PRODUCTS` / `PM_BOM_MANAGER` to the new inbound contracts (§8), and name the owning module for `BATCH_SIZES` / `REGIONAL_MARKETING_REVIEW`.
3. Merge/rollout of this PR (separate owner gate). No other decision is needed to continue.
