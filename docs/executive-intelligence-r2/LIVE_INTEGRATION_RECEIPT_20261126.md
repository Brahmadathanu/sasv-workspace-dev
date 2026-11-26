# Executive Intelligence client — live-contract integration receipt (2026-11-26)

Client-only implementation on PR #541 (branch `claude/upbeat-lovelace-tdc1jm`) against the **installed** R3/R4 production contracts (registered migrations `20261126102211`, `20261126103241`, `20261126103624`). **This is not an acceptance record.** All verification here is against synthetic fixtures; genuine signed-in PWA/Electron acceptance, executive / sales-only / denied account checks, concurrency and final fixture CI remain open. Formal G7 7/11; R0–R7 0/8; G8 parked.

## Commit identity
| Item | Value |
|---|---|
| Starting client head | `a2c9373a17600870f51aa6c94c9c6674cd998c0d` |
| Server checkpoint merged (no rebase, no history rewrite) | `ddcd7c636512d461743cdc843c41a8b2ab9b14aa` (`fix/executive-intelligence-r1-server`) → merge commit `26598896…` |
| Implementation commit | `ebff7e4b9e9ac73e4c439e1e2c1524f683df890b` |
| This receipt | the commit that follows `ebff7e4b` on the same branch |

No database migration was applied or replayed, no grant or registry row changed, `main` not merged, Electron not published, Sales Viewer retained.

## What changed (client files only)
| File | Change |
|---|---|
| `public/shared/js/module-registry.js` | One narrow exception in `getModuleAccessLevel` (see Launcher). |
| `public/shared/js/executive-mis-dashboard.js` | MTD contract swap, hierarchy filters, facility view, refresh view, phone filter sheet, export parity, executive-only loader guards, request-key additions. |
| `public/shared/js/executive-intelligence-model.js` | Pure model: hierarchy cascade, export scope line, refresh job + freshness models, facility model, 17 groupings. |
| `public/shared/executive-mis-dashboard.html` | Typography token ladder, filter sheet + facility/refresh CSS, cache key `ei-r5-1`. |
| `scripts/mis-c1/*`, `scripts/mis-g7-reporting/*` | Fixtures for the installed contracts, updated pins, new `executive-intelligence-live.test.mjs` (24 tests), screenshot script. |
| `docs/executive-intelligence-r2/*` | Parity matrix, README, this receipt, 83 synthetic screenshots. |

## Requirement-by-requirement
**Launcher / sales-only.** `getModuleAccessLevel` offers the existing stable key `executive-mis-dashboard` to a holder of `module:sales-data-viewer` (can_view) who has *no* executive permission: `view` (or `read` when `min_nav_mode` is `read`), never `use`, and `min_nav_mode=edit` still hides it. Every executive branch is unchanged; no other module, key, route, permission target or registry row is touched; no duplicate key. The page discovers capability via `ei_sales_access` (only an explicit `{sales:true}` opens anything; null/malformed/error fail closed). A sales-only session lands on Sales Performance and never requests an executive contract; this is enforced in the client twice (navigation + a refusal at the top of every executive loader) but is *not* the security boundary — each RPC enforces authorization server-side. The legacy Sales Viewer is untouched.

**MTD.** Sales Month-to-date now uses `v_ei_sales_mtd_summary` and `ei_sales_mtd_product_page(p_search, p_limit, p_offset)` for both authorized roles; the legacy executive-only `v_mis_sales_tab_summary` / `get_mis_sales_product_page` calls are gone from this page (a static test forbids them). Other executive contracts are unchanged.

**Hierarchy filters.** `ei_sales_dimensions` returns categories → subcategories (`category_id`) → groups (`subcategory_id`) → subgroups (`group_id`). Four cascading selects: options follow the selected parent, choosing a level clears everything below it (with a visible notice), a remembered choice the server no longer lists is dropped and the view reloaded, pagination resets on every change. Sent as `p_category`, `p_subcategory`, `p_group_id`, `p_subgroup` (NULL when empty, never 0 or "") on comparison, window totals, history and exceptions — the exact installed 10/16/10/10-argument signatures. `p_group` remains the history *grouping*; `group_month` and `subgroup_month` are offered (17 groupings). Region, godown, active, product and SKU filters, signed quantities and true-zero-vs-missing handling are preserved.

**Export parity.** History and exceptions export the returned page only; the file's first line states `PAGE ONLY`, rows on page, page size, total matching rows, `has_more`, anchor, every active filter (including hierarchy names) and "import completeness not certified". Formula injection is neutralised. MTD, facility and coverage offer no export; nothing exports the whole dataset.

**Facility classification and reconciliation.** New read-only sub-view over `ei_facility_sales_scope(p_anchor, p_months)` (1–12 months): per-scope rows, missing-amount rows, billed vs source-reported value (never substituted), the unresolved-godown diagnostic (separate column, not a scope), review counts for `UNCLASSIFIED` and `CLASSIFICATION_CONFLICT`, and an explicit statement that facility sales and product sales are different measures (facility includes unresolved godowns; product analytics needs a resolved SKU and godown) — no difference between them is derived. No classification admin UI, no `sales_item_scope_*` call, no permission assignment.

**Refresh intelligence.** Reports the pinned job's *latest run* as the server states it (`succeeded`/`failed`/`running`, `DISABLED`, `NO_RECORDED_RUN`, `UNAVAILABLE_JOB_IDENTITY`, active flag, last started / finished) plus daily-vs-monthly freshness (load order, last daily date, reported amounts, difference). A placeholder or unknown status is shown as unavailable, never success; there is no "up to date" or all-clear badge, and the page states a finished run is not a completeness certificate.

**Management alerts.** Executive-only; fails closed to unavailable / denied / expired / error; never requested by a sales-only session.

**Typography.** Owner-reported oversized text came from ~70 hardcoded sizes (9–19 px, ten different steps), `font: inherit` buttons falling back to the 16 px browser default, a 20 px page title and 16 px phone labels. All font sizes now resolve to one ladder: `--ei-fs-2xs 11 / xs 12 / sm 13 / md 14 / lg 16 / title 18`, with 16 px kept only for hero figures and phone form controls (the iOS focus-zoom floor). Body default is 13 px so nothing inherits an unspecified 16 px. Only this page's own inline CSS changed — no shared stylesheet, no palette value, no global selector. HOME is icon + label on desktop, icon only ≤ 520 px.

**Responsive ERP presentation.** ≤ 640 px the sales filters collapse to a compact "Filters (n)" button that opens a full-page sheet (touch-sized controls, 16 px inputs, Done/Escape close it and restore focus, Tab trapped, sheet closes if the window widens). Sub-view tabs scroll horizontally; tables scroll inside their own wrapper; no page-level overflow at 320/375/390/430/520/768/1280/1440.

## Verification (synthetic fixtures; exact heads above)
| Suite | Result |
|---|---|
| `scripts/mis-g7-reporting/*.test.mjs` + `scripts/mis-c1/*.test.mjs` (reporting, EI model/browser, live-contract, C1, launcher route, static, pipeline) | **150 / 150 pass, 0 fail, 0 skipped** (starting head: 126; +24 new live-contract tests) |
| New `executive-intelligence-live.test.mjs` | 24 tests: launcher sales-only / executive / denied matrix, one-key guard, hierarchy cascade (model + UI), exact request signatures and no executive leakage, MTD both roles, facility (both roles, all states), refresh job states, alerts, phone filter sheet + keyboard, typography ladder in every lens at 1280 and 390, responsive 8 widths × 6 sub-views, stale-response drops, export parity, protected-file path check |
| Launcher/guard suites (`wp09-g2`, `wp09-g1`, `wp08-g2-0`, `wp10-g2-safeguards`) | 232 tests: **224 pass / 8 fail. Starting head: 225 pass / 7 fail.** The 7 are identical before and after (branch-pinned diff-vs-`main` guards of other work packages, e.g. #416, G2-1 scope, S4, S6). The 1 additional failure is S5 "module-registry.js must be unchanged" — the mandated launcher exception. |
| `pec-protected-path-guard`, `wp09-protected-sw-pin`, `pec-pwa-cache-freshness`, `wp10-client-release-contract` | 27 / 28 pass; the 1 failure (`wp09-protected-sw-pin`, a WP09-branch-pinned `sw.js` hash) is identical at the starting head and `public/sw.js` is not modified |
| Not run | Server PostgreSQL suites (`supabase/tests/mis_g7/*`, need PG; server-owned) and any Electron build |

**Protected-file check.** Relative to the starting head the change set is: the four client files above, MIS test/harness files, `docs/executive-intelligence-r2/*`, and the server files that arrived through the merge. No change to PEC, PWL, Costing, e-Aushadhi, `public/sw.js`, Electron, `package.json`, workflows, or any migration (`supabase/migrations/*` differs from the starting head only by the three server-installed migrations that came in with the merge). A test pins this against the server checkpoint.

**Decision needed from the owner (not changed by me).** The WP10 safeguard guards (`scripts/wp10-g2-safeguards/*`, `scripts/lib/pec-protected-path-guard.mjs`) are branch-pinned to other work packages and flag the Executive Intelligence branch. I did not edit them because they are PEC/WP10 enforcement boundaries. Before this PR can merge, the owner must either approve an EI-branch approved-delta for `module-registry.js` and the three EI client files, or accept those guards as not applicable to this lane.

## Screenshots
`docs/executive-intelligence-r2/screenshots/` — 83 renders from `capture-ei-screenshots.mjs` against the in-page Supabase mock (**synthetic data, not production, not acceptance**; they replace the earlier 26, which predate the typography ladder). Widths 320, 375, 390, 430, 520, 768, 1280, 1440 for Overview and every Sales sub-view (Overview, Month to date, History, Exceptions, Facility reconciliation, Coverage & refresh); 1280/390/320 for Finance, Materials, Finished Goods, Production, Alerts; plus hierarchy filters, phone filter sheet (390/320), sales-only (1280/390), sales-only facility, month grid, finance filter sheet, canonical-inventory-unavailable, contract-not-installed, facility-unavailable and refresh-failed states.

## Known limitations (stated, not hidden)
- Import completeness is NOT_CERTIFIED everywhere; "no recorded rows" is never shown as a certified zero.
- Phone "details" are not a separate full-page route: tables scroll in place; only filters use a full-page sheet.
- The facility view shows the server's review *counts*; reviewing/approving classifications is deliberately not built.
- `ei_sales_access` is only consulted for users without the executive permission (executives skip capability discovery).
- Fixtures encode the installed signatures and the receipt's value shapes but not its real values; production values below must be checked by a person.

## Production acceptance checklist (owner; not yet performed)
Use real signed-in PWA sessions (and Electron only after a separate approved release) for three accounts: **executive**, **sales-only** (sales-data-viewer, no executive), **denied** (neither).

1. **Launcher.** Executive sees Executive Intelligence (unchanged). Sales-only sees the same entry (view-only) and it opens to Sales Performance with no other lens, no tabs bar, no HOME-adjacent executive chrome. Denied sees no entry and, by direct URL, a permission message with no data.
2. **Sales-only isolation.** In the browser network panel for the sales-only session confirm requests only to `ei_sales_access`, `ei_sales_dimensions`, `ei_sales_comparison`, `ei_sales_window_totals` (and the other `ei_*` sales contracts as you open sub-views) — never `ei_management_alerts`, `mv_mis_executive_summary`, `v_mis_*`, `get_mis_*`.
3. **MTD (both roles).** Sub-view *Month to date* uses `v_ei_sales_mtd_summary` / `ei_sales_mtd_product_page`; compare with the install receipt: 1–25 Nov, INR 11,965,232.40, actual packages 123,698, billed 114,996, 411 products, 521 SKUs, 22 observed days; paging shows 10 rows/page.
4. **Hierarchy.** Dimensions list 5 categories / 101 groups; choosing category → subcategory → group → subgroup narrows each list; changing a parent clears children with a notice and returns to page 1; History and Exceptions results change accordingly; Group-by `group_month`/`subgroup_month` work.
5. **History / comparison.** L3M INR 47,836,967.55; L12M INR 200,817,136.97; MoM −9.7926 %; YoY −8.7939 % (as returned by the server; the browser derives none of them). Zero vs missing: dash/Unavailable, never ₹0.
6. **Export.** History and Exceptions "Export this page": file starts with the `PAGE ONLY … has_more=…` line and lists your filters; exactly the visible rows; nothing larger.
7. **Facility.** Months = 12 (Nov-25 → Oct-26): 111,012 rows, INR 203,948,174.96, 0 missing amounts, 55 unclassified (INR 72,273.79), 63 unresolved-godown rows, no conflicts; confirm the page says facility and product sales are different measures (canonical non-sample 109,607 rows / INR 200,824,422.50 is the *product* basis, not expected to equal the facility total); no classification edit control exists.
8. **Refresh.** Coverage & refresh shows the monthly job's latest run (last receipt: succeeded 25 Nov 21:45 UTC), monthly aggregate vs daily source, a ₹640,245.62 daily-minus-monthly difference equal to the latest day; no all-clear badge; wording says a run is not a completeness certificate.
9. **Alerts (executive).** Management Alerts shows the partial catalogue with review-only states; a missing count reads Unavailable, never clear.
10. **Typography / responsive.** On a phone (≤ 520 px) and a desktop: no oversized headings, KPI values or table text; title 18 px; HOME icon-only on phone, icon + label on desktop; sales filters open as a full-page sheet that Escape/Done closes; no horizontal page scroll at 320–1440.
11. **Unavailable states.** (Optional, in a staging account) a revoked/absent contract shows "not available on this server yet" with no substituted figures.
12. **Legacy.** Sales Viewer still opens and is unchanged; no retirement is implied by this package.

Then: owner decision on the branch-pinned guard approved-delta (above), real-device/Electron acceptance, and R5 release / R6 Sales Viewer retirement / R7 closure remain separate gates.
