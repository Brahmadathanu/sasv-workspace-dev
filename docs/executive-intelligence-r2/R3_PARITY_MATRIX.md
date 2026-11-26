# Executive Intelligence R3 — Sales Viewer functional parity matrix (client, fixture-backed)

Updated 2026-11-26 for the live-contract client integration on PR #541. Contracts consumed are the **installed production contracts** (registered migrations `20261126102211`, `20261126103241`, `20261126103624`; see `docs/executive-mis-g7-server/R3_R4_LIVE_INSTALLATION_RECEIPT_20261126.md`). Client behaviour is verified against synthetic fixtures only; genuine signed-in PWA/Electron acceptance is still open and no acceptance is claimed.

Status: **Implemented** = client built and fixture-tested · **Server gap** = contract does not provide it · **Deferred** = intentionally not built.

| Capability (legacy Sales Viewer) | Contract | Client status | Notes / gap |
|---|---|---|---|
| Anchor date, latest mapped day default | `ei_sales_dimensions` bounds, `p_anchor` | Implemented | Out-of-range anchor is never sent; notice shown |
| Region / godown filters | `ei_sales_dimensions` (dynamic) | Implemented | Godown list follows region; no hard-coded dimensions |
| Matched-day month / prior month / prior year | `ei_sales_comparison` | Implemented | Net package counts, weighted ASP with explicit denominator column; MoM/YoY from server only; NULL shown as unavailable |
| Quantity / value / ASP basis | same | Implemented | Actual vs billed packages and both ASPs; no physical-quantity or mixed-UOM aggregation |
| L3M / L12M windows | `ei_sales_window_totals` | Implemented | Excludes anchor month; unavailable when months missing or amounts ambiguous; reported amount in its own non-certified column |
| Monthly history 1–12 months | `ei_sales_history` | Implemented | Bounded pages (50), stable sort, search; ambiguous amounts not certified |
| Region / godown / product / SKU / category / subcategory / group / subgroup groupings and `*_month` | `ei_sales_history` `p_group` | Implemented | All 17 server groupings offered, including `group_month` and `subgroup_month` |
| Top / bottom ranking | `p_sort` value_desc / value_asc | Implemented | Server-side, per page |
| SKU x month grid | `sku_month` grouping | Implemented (page-bounded) | Pivots only the returned page; absent cell is a dash ("not returned"), never zero |
| Category/subcategory/group/subgroup **filters** | `ei_sales_dimensions` hierarchy + `p_category`, `p_subcategory`, `p_group_id`, `p_subgroup` on comparison, window totals, history and exceptions | Implemented | Cascading selects (options follow the parent; changing a level clears everything below; stale picks dropped; pagination resets); empty is NULL; `p_group` stays the grouping, never an id |
| Active-SKU filter | `p_active_only` | Implemented | Current master basis, labelled |
| Search / paging | `p_search`, `p_limit`, `p_offset` | Implemented | Server-side; out-of-range page resets once |
| Export | client, bounded | Implemented (page only) | History and exceptions: CSV of the returned page; scope line states filters (incl. hierarchy), page, total rows and `has_more`; formula injection neutralised; no whole-dataset export anywhere |
| Zero sellers / returns | `ei_sales_exceptions` | Implemented | Current-master eligibility separate from activity; no recorded rows, offset-by-returns and missing measures kept apart; never "certified zero seller" |
| Source freshness / coverage | `ei_sales_coverage`, `ei_sales_refresh_status` | Implemented | Per-day raw vs mapped counts, ETL status text, monthly vs daily source dates, load order and difference; **no green badge**; the pinned refresh job's latest run (status, last started/finished, active) is shown as-is and never read as completeness |
| Import completeness | all | Stated | "Not certified" everywhere the server says so |
| Facility sales classification and reconciliation | `ei_facility_sales_scope(p_anchor, p_months)` | Implemented (read-only) | Per-scope rows, missing amounts, billed vs reported value, unresolved-godown diagnostic and review counts (unclassified, conflict) exactly as the server supplies them; explicit statement that facility and product sales are different measures; no classification admin UI, no `sales_item_scope_*` call |
| Management alerts | `ei_management_alerts` | Implemented (executive only) | Fails closed to unavailable/denied/expired/error; never requested by a sales-only session |
| Month to date | `v_ei_sales_mtd_summary`, `ei_sales_mtd_product_page(p_search, p_limit, p_offset)` | Implemented (both roles) | Replaces the executive-only `v_mis_sales_tab_summary` / `get_mis_sales_product_page` calls in this page; those legacy objects are untouched server-side |
| Historical amount certification | n/a | Server gap | `source_reported_amount` shown as reported, never substituted for `sales_value` |
| Sales-only entry (no executive access) | `ei_sales_access` + launcher exception | Implemented | `module-registry.js` offers the stable `executive-mis-dashboard` key to `module:sales-data-viewer` holders without executive access (view/read only, never use); every executive check unchanged; client also refuses executive contracts without executive access |
| Legacy viewer retirement | R6 | Not started | Legacy Sales Viewer route and permission untouched |

## Sales-only entry (implemented)
The page discovers capability with `ei_sales_access` (only an explicit `{sales:true}` opens the Sales lens; error, null or malformed answers fail closed). `public/shared/js/module-registry.js` now contains one narrow exception in `getModuleAccessLevel`: for the existing module key `executive-mis-dashboard`, a user with **no** executive permission but `module:sales-data-viewer` view access gets the entry at `view`/`read` per `min_nav_mode` (never `use`; `edit` mode still hides it). No other module, key, route or permission target is touched; no registry data, grant or database object is changed. Hiding lenses is a convenience, not security: each RPC enforces its own authorization. The legacy Sales Viewer stays available until formal replacement acceptance.

## Remaining gaps (server / owner)
Certified historical amounts and ETL-backed completeness certification (import completeness remains NOT_CERTIFIED everywhere); classification assignment/approval UI (deliberately not built); genuine signed-in PWA and Electron acceptance for executive, sales-only and denied accounts; final fixture CI; release, Electron publication and Sales Viewer retirement (R5–R7).
