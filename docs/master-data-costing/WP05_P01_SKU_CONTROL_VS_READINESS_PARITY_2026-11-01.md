# WP05-P01 — SKU Control Status vs Portfolio Readiness: functional-parity matrix (audit input)

Date: 1 November 2026. Status: **evidence for review only. No tab, view, RPC, route or permission is removed or changed by this document or by the UX-F1 PR that carries it.** Revives parked item CCC-P01 as an active design dependency; it is not accepted until the owner reviews it.

Evidence is from source at `main` = `9c189d6` (file:line), not from production. Live-only database objects (not in `supabase/migrations/`) are marked as such.

## Matrix

| Capability | SKU Control Status (`sku-control-status`) | Portfolio Readiness (`portfolio-readiness`) | Parity |
|---|---|---|---|
| Data source | View `v_costing_pricing_sku_control_status_snapshot` (control-center.js `loadSkuControlStatusRows`, `fetchAllRows` pages of 1000); governed run only via `costing.v_current_successful_costing_refresh_run` (`20260917113016_…`) | RPCs `rpc_get_readiness_governed_periods`, `rpc_get_product_sku_readiness_portfolio`, `rpc_get_readiness_product_gaps` (readiness.js:30-34; `20261005123028_wp04_g7_track_a_v2_2.sql`) | Different contracts — **no parity** |
| Grain / meaning | One row per SKU of the governed run: costing control statuses, `first_control_status`, `control_severity`, `recommended_ui_route`, `control_note`, blocking/review line counts, MRP/selling price/margins | SKU readiness assessment across dimensions (product master, SKU master, costing foundation, evidence quality, costing outcome — readiness.js:36-42), dependency codes, owner modules | Overlapping, **not identical** |
| Paging | Client: all rows for the period loaded, then client filter/search/page | **Server keyset**: `p_after_sku_id`, `p_limit` (50) (readiness.js:13, 208-232; `next_after_sku_id` validated :510-513) | Readiness superior for scale; SKU tab relies on ≤ few thousand rows |
| Period selector | Shell period picker; governed run of that period | Governed periods RPC (24 periods, readiness.js:14) | Comparable |
| Frozen-run / historical run selection | **Yes (flag ON):** C1B run selector over server-advertised displayed/approved/newer-draft runs via `v_costing_pricing_sku_control_status_by_run` | **No** run selector; assessments follow the readiness snapshot fingerprint (`evidence_refresh_run_id`, migration line ~286) | **Gap in Readiness** (blocker for retirement) |
| Severity / status filter | Shell status/issue/source filters + search (`applyFilters`/`applySearch`) | `p_overall_severities`, `p_dependency_codes`, `p_owner_modules`, `p_route_codes`, `p_population_scope`, `p_search` (readiness.js:224-231) | Readiness richer server-side; SKU tab has shell filters |
| Grouped issue view | Review worklist groups by server codes with counts (flag ON) | Summary strip by dimension; no grouping by `first_control_status` found | Different |
| Row detail | Shell drawer (control-center drawer config, evidence tab from `v_costing_pricing_material_action_drilldown_snapshot` — governed run only) | Readiness detail via `openDetails(assessment)` (readiness.js:1608), detail disclosures (:1999-2125) | Both have detail; content differs |
| Fix-screen navigation | `resolveRecommendedUiRouteTarget` + `navigateToCostingRoute` (drawer button; worklist "Open fix screen") | Shows `recommended_ui_route` as **text only** (readiness.js:2033, 2113, 2125); no navigation call found in the module | **Gap in Readiness** (blocker) |
| CSV export | Shell `exportActiveViewCsv` on `VIEW` (+ CW-05 formula guard when flagged) | Shell clears `ALL_ROWS`/`VIEW` for this lens (shell.js:4578-4579), so the shared export has no rows | **Gap in Readiness** (blocker) |
| CW-05 sort / table tools | Generic header map (`sku-control-status`, incl. SKU/Pack) | Own host table; not wired to CW-05 | Gap |
| Permission boundary | View predicate `app_has_permission('module:costing-control-center','view')` | RPC checks the same permission (`20261005123028_…` line ~267) | Equivalent boundary |
| Deep links | `?lens=sku-control-status`; KPI drill-downs (`drillToLens("sku-control-status", …)`) | `?lens=portfolio-readiness` | Both must be preserved |

## Blockers before any retirement of the SKU Control Status tab

1. Readiness has no frozen-run selector (draft/approved run inspection exists only on SKU Control Status, C1B).
2. Readiness has no fix-screen navigation; the specialist routes would be lost.
3. Readiness has no CSV export through the shared path.
4. KPI drill-downs and deep links target `sku-control-status`; they need redirection, not removal.
5. The grouped server-code worklist (C1/C1B/UX-F1) is built on SKU Control Status rows.
6. Performance and usability parity have not been measured with real users; denied-role JWT acceptance is pending for both.

## Proposed safe migration steps (each a separate, owner-approved PR)

1. Add run-aware inspection to Readiness only through a server-authorised contract (no client-side reconstruction of historical runs).
2. Add fix-screen navigation in Readiness by reusing `resolveRecommendedUiRouteTarget` (no new route mappings in the same PR).
3. Add a Readiness export over its keyset pages (server-paged, bounded), with the CW-05 formula guard.
4. Redirect `sku-control-status` deep links and KPI drill-downs to the Readiness equivalent behind a flag; keep the old tab and views.
5. Real-user acceptance (desktop + 375 px), denied-role tests, then a separate release decision to hide the duplicate client tab. Never drop backing views/RPCs without a dependency analysis.
