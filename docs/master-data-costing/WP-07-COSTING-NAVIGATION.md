> **Renamed 25 Oct 2026: this work pack is now MDC-07** (master-data-costing). It is unrelated to the e-Aushadhi WP-07 programme. File name kept so old links still work.

# WP-07 — Costing Suite Navigation and Information Architecture

## Objective
Rationalise Costing navigation after module responsibilities are settled.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

*3 Nov 2026:* the WP05 Tier 1 design (A3, accepted by the owner 2 Nov 2026) and the P01/P02 packages (#132, #131) are on `main` `86f1c18`; N1 was started on the owner's written brief. MDC-07 is the Costing navigation work pack and is unrelated to the paused e-Aushadhi WP-07.

## Scope
As defined by the approved programme handoff; refine only from audited live architecture and explicit decisions.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes.

## Current-state findings
**Gate A — combined post-merge regression (3 Nov 2026, pristine `main` `86f1c18c538eea224fd3ad8198e5527413892474`).** Cloud container, Linux 6.18, Node v22.23.4, Playwright 1.63.0 / Chromium (`/opt/pw-browsers`), no Supabase access.
| Run | tests | pass | fail | skipped | cancelled |
|---|---|---|---|---|---|
| LF worktree | 471 | 471 | 0 | 0 | 0 |
| CRLF worktree (`core.autocrlf=true`, `core.eol=crlf` persisted per worktree; `git status` clean) | 471 | 471 | 0 | 0 | 0 |

Command: `node --test $(find scripts -name "*.test.*" | sort)` (29 files). Chromium tests ran (0 skipped): responsive suite, route dialogs, WP05-P02 browser acceptance. 471 is the first combined figure; it is **not** 408 + P01 + P02 arithmetic (the earlier 393/408 totals belong to earlier heads). Legacy smokes: `wp04-readiness-client-contract-smoke.mjs` passes; of the 63 `production-route-*-smoke.mjs` scripts, **51 fail on pristine main** (examples: stale `hub-cache-v299` pins, archived-routes subgroup pin) and 13 pass. These are known legacy failures, not regressions: the identical 51 fail on the N1 branch (`diff` of the failing sets is empty). Other smokes (about 95, mostly e-Aushadhi/unrelated) were not run.

## MDC-07 package N1 — shared navigation contract (implemented 3 Nov 2026; merged to `main` as #133, `85a163f`)
**Flag:** `COSTING_NAV_GROUPS_V1` in `costing-feature-flags.js`; default OFF; enabled only by the exact browser `localStorage` value `1`; independent of `COSTING_PRM_CORRECTIONS_V1`. Not activated for any user.

**Architecture (presentation only; no permission, route, lens id, controller, RPC or payload changed):**
* `costing-nav-groups.js` — the single reusable contract `COSTING_NAV_GROUP_CONTRACT` (suite id → ordered groups with stable `id`, `label`, `contextLabel`, ordered `lensIds`), the resolver `resolveNavGroups(suiteId, allowedLensIds)` (derives from the route's allowed lens ids; drops unknown ids; any lens the contract does not name falls into a trailing "More" group so no destination can disappear), `validateNavGroupContract()`, the string renderers (`role="group"` pill groups, narrow-screen `<optgroup>` select) and the static data-basis table (`LIVE_AS_OF`, `RUN_SCOPED`, `FIXED_HISTORICAL`). Groups follow WP05-A3: CCC Overview / Workbench / SKU Review; MCM Rates / Traces; CBM Mapping & classification / Provisions / Policy approval; CSR Review / Documents / Action Queues; **PRM Readiness / Assign & Map / Build / Review / History**. Pricing Policy: the compatible workspace contract `COSTING_PPM_NAV_GROUP_CONTRACT` (5 groups covering all 10 workspaces) is defined but `controllerManaged`; the shell does not render it — the PPM controller keeps its own navigation until W6, so there is no competing second navigation system.
* `costing-nav-context.js` — display-only context store/model: chips for Product, Family, Route, governed Period and Run, a basis chip, and the breadcrumb Module › Group › Lens. A chip exists only for a value that was supplied (no defaults, no inference, no lifecycle or costing calculation, no RPC). A run on a fixed-historical lens is labelled "Run (fixed historical)"; the basis text for those lenses states "not the current costing run"; no fixed run number (80/82) is embedded in N1. `costingNavContext.set(...)` is the interface N4 will use; N1 does not implement Product Route context persistence.
* `costing-suite-shell.js` (navigation-specific parts only): `isNavGroupsActive()` gates three small branches in `renderLensPills` (grouped pills, grouped select) plus `refreshNavContextBar()`. The pill buttons keep `class="pill"`, `data-lens` and the existing `switchLens` click handler, so deep links, `?lens=`, URL sync and permission handling are untouched. The shell period is shown only for period-scoped lenses.
* `sasv-costing.css`: one appended block, all selectors `body.sasv-costing …`, no `!important`, no hidden overflow. At ≤520 px the existing responsive rule still swaps pills for the select (now with option groups); at 521–900 px the group strip scrolls horizontally inside its own container.
* `registry` and `route-config` are consumed, not edited (their invariants are pinned by tests).

**Flag-OFF parity evidence:** `scripts/costing-nav-groups/off-parity-snapshot.mjs` snapshots the navigation chrome (suite label, `#lensPills`, `#lensSelect`, active lens, URL) and page title for every deep link of all six pages at 390 and 1280 px (PPM workspaces and legacy lens ids included) with the flag absent; run against pristine main and the branch the JSON outputs are **byte-identical (96 snapshots, 240 KB, 0 page errors)**. Source tests additionally pin the original flat-pill and select branches verbatim, and the OFF path of `refreshNavContextBar()` does nothing unless a bar was inserted.

**Tests added (`scripts/costing-nav-groups/`):** `nav-groups.test.mjs` (21; flag exact-`1` and independence, 6 modules / 32 lens ids / route-config snapshot, contract soundness, PRM five groups, renderers and escaping, context never invents values, basis distinctness, source: no RPC/Supabase/storage/date maths in new modules, shell data-access names equal the pre-N1 baseline, CSS scoping, PPM contract covers 10 workspaces), `nav-groups-browser.test.mjs` (12 genuine Chromium interaction tests: all 6 pages ON, PPM unchanged, OFF markup, all 30 non-PPM `?lens=` deep links plus PPM legacy lens/workspace URLs, ON/OFF deep-link parity, SC5 redirect, click-through navigation, narrow select, six pages × 390/520/768/900/1280 overflow, horizontal scrolling at 768/900, ARIA/keyboard/focus ring, chips and Historical-vs-LIVE_AS_OF), `nav-groups-prm-integration.test.mjs` (4; identical RPC name+payload sequence ON vs OFF over a 13-lens click-through, zero writes, P02 candidate controls and P01 Readiness unaffected). Additive optional `storage` parameter on the P02 test harness `openPage`. Historical pin tests (`uxf1`, `cost-sheet-terminology`, `responsive`, `review-worklist`, `table-tools*`) ignore exactly the flag-gated N1 additions via an explicit `scripts/lib/n1-nav-strip.mjs` call in each test (the shared reader is unchanged) (append-only flags file; shell must otherwise equal its base). After the 3 Nov review correction (`readSourceLf` restored to LF-only; the N1 strip is applied explicitly in the historical tests; 3 reader/strip/mutation regression tests added) **totals on the branch (tested head `9971ebb`): 511 tests, 511 pass, 0 fail, 0 skipped on LF and on CRLF** (471 baseline + 40 new), Chromium ran; flag-OFF parity re-run byte-identical.

**Limitations / not done by N1 (by design):** no controller changes (N2 role-aware trace tabs, N3 cross-links, N4 selected Product/Family/Route persistence and chip feeding, W6 PPM grouping); the "Evidence & Review" sub-grouping inside the PRM Review group is deferred to N4; the shell does not yet feed Product/Family/Route/Run chips (only the governed period and the static basis); mock-backend browser tests only — signed-in populated-data acceptance is outstanding and required before the flag is considered for activation.

## MDC-07 package N2 — Material Cost and Cost Build navigation refinement (implemented 3 Nov 2026; merged to `main` as #136, `7f46f37`)
**Flag:** the existing N1 flag `COSTING_NAV_GROUPS_V1` (default OFF, exact `1`). No new flag. Flag OFF: both controllers behave byte-for-byte as before (pinned by tests that strip exactly the N2 additions and compare with the N1 text).

**Files changed:** `costing-suite-material-cost.js`, `costing-suite-cost-build.js` only (plus tests). Shell, registry, route config, N1 contract/context modules, feature flags, CSS, HTML, `sw.js` and Driver Governance's own controller are untouched.

* **Role-aware trace navigation (MCM):** `syncTraceNavVisibility()` (called from the existing `syncRmTraceChrome`, re-applied by a `MutationObserver` after each shell pill re-render) hides the RM / PM trace pill, select option and, when neither is allowed, the whole Traces group. It only *reads* the unchanged `canAccessRmTrace()` / `canAccessPmTrace()`; RM and PM are decided independently, fail closed (unresolved permissions, or any `can_view` that is not exactly `true`, hide the entry). Entries are hidden with `hidden` (+ `disabled` on options), never removed from the DOM or the contract, so no lens id, route or deep link changes. The lens the user is currently on is never hidden: a deep link to an unauthorised trace keeps its active entry and its existing in-page restricted message, and still issues no trace RPC.
* **Scope notes (flag ON):** a one-line note, labelled with the N1 group (`getNavGroupForLens`, read-only), above the existing tab strip of Manual Rate Manager (Rates), Cost Governance and Staff Governance (Mapping & classification) and Manual Provisions (Provisions). They keep Materials Rate functions, trace evidence, expense-head mapping, staff governance, manual provisions and driver-policy approval distinct. Existing `cp-muted-text` class; no CSS added.
* **Unchanged:** every RPC, workflow, export, permission function and export role (verified: identical read/RPC sequence flag ON vs OFF for the same destinations; no write RPC).

**Tests added (`scripts/costing-nav-mcm-cbm/`):** `n2.test.mjs` (9; visibility function for all role combinations, fail-closed, current-lens rule, contract ids, scope notes, strip reproduces N1 controllers exactly, permission functions and RPC names byte-identical, file-scope guard) and `n2-browser.test.mjs` (9 Chromium tests with per-test permissions: four role combinations at 1280/390, non-boolean grants, flag OFF parity, re-render persistence, unauthorised deep link, authorised trace still loads, backend parity, Cost Build and Material Cost notes). Five historical "controller unchanged" pin tests now compare after `scripts/lib/n2-nav-strip.mjs`.

**Results (tested head `3cf48b2`):** 530 tests, 530 pass, 0 fail, 0 skipped on LF and on CRLF (511 N1 baseline + 19 new), Chromium ran; flag-OFF parity snapshot (96 pages/deep links) byte-identical to N1 main `85a163f`.

**Limitations:** Driver Governance (own controller file) and the trace lenses carry no scope note; the shell still shows its own context bar for them. Because the pills are rendered by the shell (not editable in N2), hiding is applied by the controller to the shell's markup after each render (a `MutationObserver` started when the controller is created, flag ON only; the shell renders no pills before permissions resolve, and after that the filter is fail-closed). A shell-side filter hook would be the cleaner long-term design (shared-contract change, reported separately, not made). Mock-backend browser tests only; signed-in populated-data acceptance outstanding.

## MDC-07 package N4 — Production Route context persistence (implemented 3 Nov 2026; merged to `main` as #135, `2ce8af0`)
**Base:** originally `main` `85a163f` (N1 merged as #133); reconciled on 3 Nov 2026 with `main` `7f46f37` (N3 #134 and N2 #136 merged) and then with `main` `026c646` (#138, the repaired N2/N3 historical ownership guards). The integrations changed only this document and the merged guard tests: the N4 code files do not overlap with N2/N3/#138 files. N4's own scope guard keeps its fixed baseline `7f46f37`. **Flag:** `COSTING_PRM_NAV_CONTEXT_V1` (defined in `costing-suite-production-route-nav-context.js`, not in the shared flags file); default OFF; only the exact `localStorage` value `1` enables it; independent of `COSTING_NAV_GROUPS_V1` (chips are only *shown* when N1 is on) and of `COSTING_PRM_CORRECTIONS_V1`. Not activated for any user.

**What it does (controller side only):**
* `costing-suite-production-route-nav-context.js` (new, pure: no RPC, DOM, storage writes, dates or run numbers) remembers `product_id`, `product_route_id`, `route_family_id`, `family_route_id` and feeds the N1 store `costingNavContext.set({product, family, route})`. It never sets `run` or `period`.
* `costing-suite-production-route.js`: `load()` becomes a thin wrapper around the unchanged loader (`loadPrmLens`). Flag OFF = direct pass-through. Flag ON: (1) URL/pill/back-forward loads of **identity lenses only** (Product Assignments, Product Route Editor, Effective Route Viewer, Family Route Editor, Historical Evidence Review) have missing ids filled from the stored context; (2) only an **accepted** load (not stale, not disposed, not failed) commits, using the loaded header ids as authority; (3) opening a Family summary selects that Family. `navigate()` loads are marked `explicit` and are never hydrated (e.g. "create a route for this Family" stays a create).
* **Validity rules:** a new Product drops the route version and (unless a Family is supplied) the Family/Family route; a new Family drops the Family route and (unless a Product is supplied) the Product/route; an explicit id in the URL is never overwritten and, if it differs from the stored one, nothing else is injected; a route version is only restored together with its Product (Family route with its Family); a hydrated id whose load fails is forgotten (only if the load was not stale).
* The Effective Route Viewer's own Product picker bypasses `load()`; with the flag ON it commits the chosen Product (and the server-derived Family) and keeps the URL's `product_id` in step via `replaceState` (otherwise the stale URL id would win on the next pill switch). Emptying that picker clears the stored Product/Family.
* **Not hydrated by design:** Readiness, Workload Preview, Mapping Review, Foundation Review, Cost Centres, Subgroup Mappings, Archived Routes, Families register. Those lenses get no hidden filters or run; their own sticky filters stay as before. Mapping Review, Foundation Review and Historical Candidate Review remain three separate lenses/pills in the N1 Review group (A6 "tabbed Evidence & Review" stays deferred). The fixed historical contexts (run 80 / 82) are untouched; there is no current-run resolver and the module contains no run number.
* Shell, registry, route config, nav-groups/nav-context helpers, shared flags file, CSS, HTML, SQL, cache: **unchanged**. The 24 read / 38 write RPC names in the controller are unchanged (baseline file test).

**Tests (`scripts/costing-prm-nav-context/`):** `prm-nav-context.test.mjs` (25: flag, reconcile/hydrate rules, tracker ON/OFF, source/scope guards) and `prm-nav-context-browser.test.mjs` (12 Chromium journeys on the mock backend: version restored across groups, OFF parity, evidence lenses independent with identical requests and no run chip, Product switch drops the version, Family switch drops the Product, slow/abandoned responses, rapid clicking, all 13 lens deep links ON = OFF, RPC sequence ON(empty)=OFF and read-only, Effective Viewer picker commit + URL sync, abandoned hydrated load). Mutation-checked: disabling hydration and removing the stale guard each fail the intended tests.

**Limitations:** URL is not rewritten with hydrated ids except the Effective Viewer picker's `product_id` (a reload of a pill-navigated page restores only what the URL carries); a URL-origin load cannot be told apart from a pill switch, so the stored version is re-applied to a URL that names the same Product; no dedicated 'clear selection' control (selection clears by choosing another Product/Family, emptying the Effective Viewer picker, or on page reload); Effective Route Viewer contributes only `route_family_id` from the server payload; mock-backend only — signed-in populated-data acceptance outstanding; flag must not be activated before that.

## Approved design / contract
Not yet approved.

## Milestones
- [x] Current-state/audit gate (WP05 A1–A7, merged #130)
- [x] Design/contract gate where applicable (A3 Tier 1, owner-accepted 2 Nov 2026)
- [~] Implementation gate where applicable — N1 (#133), N3 (#134), N2 (#136) and N4 (#135) merged to `main`; W6 implemented on draft PR #139 awaiting independent review; U11 not started
- [ ] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
### MDC-07 / N3 — Cost Sheet Review cross-links and Action Queues (merged to `main` as #134, `55acfcf`)

* **Scheme Comparison → Pricing Policy Manager › SKU Policy Overview:** each row with its own `period_start` and `sku_id` gets a "SKU policy overview ↗" anchor (inside the existing Product / SKU cell; headers, alignments, CSV export and the row-click drawer are unchanged) to `pricing-policy-manager.html?workspace=sku-overview&period_start=…&product_id=…&sku_id=…` in a new tab. `product_id` is added only when the row carries it. A row without its own period or SKU gets no link (nothing is inferred). Pure navigation: no new RPC, no write, no flag read.
* **Action Queues:** QC and Materials & Stores remain two lenses, two controllers, two unchanged RPCs (`rpc_get_qc_action_queue`, `rpc_get_materials_stores_action_queue`; param shapes untouched) in the N1 "Action Queues" group. Each queue's detail panel gains an "Open … Action Queue" link to the sibling lens (new tab, governed period only). Existing remediation links are unchanged.
* **Limitations:** the shell's PPM launch consumes `workspace` and `period_start`; it does not preselect a Product or SKU in SKU Policy Overview, and the queue lenses have no launch-time product filter, so `product_id`/`sku_id` are carried on the Scheme Comparison link only as the existing contract allows and the queue sibling link carries the period only. The reverse PPM → Scheme Comparison link lives in the Pricing Policy Manager controller (W6, out of N3 scope). The shell-injected `navigateToCostingRoute` is used for queue links; the Scheme Comparison anchor uses the same relative page link the shell resolves on shared pages because the shell does not inject navigation into that controller. No flag was activated, no cache bump.
* **Tests:** `scripts/costing-cross-links/` (`cross-links.test.mjs`, `cross-links-browser.test.mjs`).

`MDC-07-W6 — implemented on draft PR #139 (reconciled with main 2ce8af0); awaiting independent review and owner acceptance. N1, N2, N3 and N4 are merged. No merge, flag activation or further package is implied.`

## Gate Status
[~] IN PROGRESS — N1, N2, N3, N4 merged; W6 delivered for review (draft PR #139); U11 outstanding

## Required to close
Entry criteria must be satisfied and the work pack explicitly started.

## Next gate
Independent review of the W6 draft PR (#139); owner decision; then the U11 brief (A6 §2; N1, N2, N3, N4 already merged). Each later package consumes the N1 contract and must not edit the registry, route config, shell navigation or the shared CSS block.

## Server changes
None.

## Client changes
N1 (merged): `costing-nav-groups.js`, `costing-nav-context.js`, flag in `costing-feature-flags.js`, flag-gated navigation branches in `costing-suite-shell.js`, appended CSS block. No HTML, registry, route-config, controller, Supabase or migration change. N2/N3 (merged): controller-side changes listed in their sections. N4 (draft PR #135): `costing-suite-production-route-nav-context.js` (new) and thin hooks in `costing-suite-production-route.js`, behind `COSTING_PRM_NAV_CONTEXT_V1`.

## Tests / verification
See Gate A and the N1 section above. Not performed: signed-in populated-data acceptance, live PWA/cache check, global smoke run.

**Git history requirement (N2/N3 historical ownership guards):** the guards `File ownership: only the three controllers…` (`scripts/costing-cross-links/cross-links.test.mjs`) and `source: N2 touches only the two controller files…` (`scripts/costing-nav-mcm-cbm/n2.test.mjs`) compare permanent squash-merge commits on `main`: N3 #134 `85a163f` → `55acfce`, N2 #136 `55acfce` → `7f46f37`. They need full history (at least back to `85a163f`). A shallow or partial checkout fails them **explicitly** with the message "needs commit … Run: git fetch --unshallow"; they never skip. The repository currently has no CI workflow that runs these tests (only `public/netlify.toml`, a deploy config); any future CI job must check out with `fetch-depth: 0` (or unshallow). They no longer depend on the original feature branches.

## Decisions created
None.

## Risks
Premature assumptions; scope drift; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
None.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not started.

## MDC-07 package W6 — Pricing Policy Manager five-group navigation (draft PR #139; status 3 Nov 2026)
W6 consumes the merged N1 `COSTING_PPM_NAV_GROUP_CONTRACT` (SKU policies / MRP / MRP change workflow / Schemes / Costing inputs) inside the PPM controller (`costing-suite-pricing-policy.js` only) behind the existing exact-`1` flag `COSTING_NAV_GROUPS_V1` (default OFF; no new flag, no second navigation engine). OFF returns the original three-group metadata unmodified; ON derives the five groups and the display order of all ten unchanged workspaces, keeping a `legacyGroupId` so Area aliases, internal MRP/selling classifications and default-workspace resolution are unchanged. Legacy `?lens=`/`?workspace=` URLs resolve identically ON and OFF; the only period-scoped workspace remains Commercial Sales Assumptions. C9 (shared registry `periodScoped`) is deferred. Full detail and verification: `WP-06-PRICING-POLICY-MANAGER.md` and PR #139. N4 (#135) is merged; W6 was reconciled with `main` `2ce8af0` and does not touch any N4 file except this document. **Historical pins:** four historical package tests (`costing-ccc-uxf1`, `costing-review-worklist`, `costing-table-tools` pkg3/pkg4) pin the PPM controller to its pre-W6 text; they now apply `scripts/lib/w6-nav-strip.mjs`, which reverses exactly the W6 edits (proven to reproduce the pre-W6 file byte-for-byte and not to hide any other change), following the N1/N2 strip precedent. These four failed on the first full-suite run of the W6 branch and were corrected without weakening them.
