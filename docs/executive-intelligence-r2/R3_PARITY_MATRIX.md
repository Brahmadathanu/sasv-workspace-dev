# Executive Intelligence R3 — Sales Viewer functional parity matrix (client, fixture-backed)

Updated for R3/R4 client package on PR #541. Contracts consumed are the **review candidates** in `docs/executive-mis-g7-server/` (`R3_R4_SERVER_CANDIDATE.sql`, `R3_R4_COVERAGE_EXTENSION.sql`); none is installed in production yet, so every sales view shows an honest "not installed yet" state until the server package is installed and accepted. Synthetic fixtures only; no acceptance is claimed.

Status: **Implemented** = client built and fixture-tested · **Server gap** = contract does not provide it · **Deferred** = intentionally not built.

| Capability (legacy Sales Viewer) | Contract | Client status | Notes / gap |
|---|---|---|---|
| Anchor date, latest mapped day default | `ei_sales_dimensions` bounds, `p_anchor` | Implemented | Out-of-range anchor is never sent; notice shown |
| Region / godown filters | `ei_sales_dimensions` (dynamic) | Implemented | Godown list follows region; no hard-coded dimensions |
| Matched-day month / prior month / prior year | `ei_sales_comparison` | Implemented | Net package counts, weighted ASP with explicit denominator column; MoM/YoY from server only; NULL shown as unavailable |
| Quantity / value / ASP basis | same | Implemented | Actual vs billed packages and both ASPs; no physical-quantity or mixed-UOM aggregation |
| L3M / L12M windows | `ei_sales_window_totals` | Implemented | Excludes anchor month; unavailable when months missing or amounts ambiguous; reported amount in its own non-certified column |
| Monthly history 1–12 months | `ei_sales_history` | Implemented | Bounded pages (50), stable sort, search; ambiguous amounts not certified |
| Region / godown / product / SKU / category / subcategory / group / subgroup groupings and `*_month` | `ei_sales_history` `p_group` | Implemented | All 15 server groupings offered |
| Top / bottom ranking | `p_sort` value_desc / value_asc | Implemented | Server-side, per page |
| SKU x month grid | `sku_month` grouping | Implemented (page-bounded) | Pivots only the returned page; absent cell is a dash ("not returned"), never zero |
| Category/subcategory/group/subgroup **filters** | not in contract | Server gap | Only region, godown, product, SKU, active-only filters exist; product → SKU drill implemented |
| Active-SKU filter | `p_active_only` | Implemented | Current master basis, labelled |
| Search / paging | `p_search`, `p_limit`, `p_offset` | Implemented | Server-side; out-of-range page resets once |
| Export | client, bounded | Implemented (page only) | CSV of the returned history page; scope line in file and UI; spreadsheet formula injection neutralised; no whole-dataset export |
| Zero sellers / returns | `ei_sales_exceptions` | Implemented | Current-master eligibility separate from activity; no recorded rows, offset-by-returns and missing measures kept apart; never "certified zero seller" |
| Source freshness / coverage | `ei_sales_coverage`, `ei_sales_refresh_status` | Implemented | Per-day raw vs mapped counts, ETL status text, monthly vs daily source dates and difference; **no green badge**; refresh job status stated as not exposed |
| Import completeness | all | Stated | "Not certified" everywhere the server says so |
| Current-month legacy product table | `v_mis_sales_tab_summary`, `get_mis_sales_product_page` | Preserved (executive only) | "Month to date" sub-view; unchanged contracts |
| Historical amount certification | n/a | Server gap | `source_reported_amount` shown as reported, never substituted for `sales_value` |
| Sales-only entry (no executive access) | `ei_sales_access` | Implemented (client) | Needs registry/navigation change, see below |
| Legacy viewer retirement | R6 | Not started | Legacy Sales Viewer route and permission untouched |

## Sales-only entry: required registry / navigation change (not applied)
The page discovers capability with `ei_sales_access` (only an explicit `{sales:true}` opens the Sales lens; error, null or malformed answers fail closed). A Sales Viewer holder without the executive permission can only *reach* this page if the launcher/registry offers the `executive-mis-dashboard` route to holders of `module:sales-data-viewer` (a `module_registry` / `min_nav_mode` data change, server-owned). The client does not grant permissions, edit the registry or bypass launcher authorization; hiding lenses is a convenience, not security — each RPC enforces its own authorization. Until that registry change is authorized, sales-only users keep using the legacy Sales Viewer.

## Remaining gaps (server / owner)
Full hierarchy filters, certified historical amounts, ETL-backed coverage certification, actual refresh-job status, installation + acceptance of the candidates, and access remediation for existing executive-only views (`R3_MIS_ACCESS_CANDIDATE.sql`).
