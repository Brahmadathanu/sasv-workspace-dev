> **CSR EXPLAIN-only planning checkpoint — 5 Nov 2026 (newest):** Both authenticated `57014` read timeouts now have non-executing PostgreSQL JSON EXPLAIN evidence. Printable summary pushes November period into existing period/product index, but estimates 1 row from statistics last autoanalysed **24 Oct**, before November run 149 rows; statistics freshness is an open maintenance proposal, not a completed fix. Monthly SKU comparison builds a shared all-governed-period `line_pivot` (~5,459 estimated grouped rows), then filters November in the `cur` CTE scan; a period-and-comparison-period-scoped redesign is the preferred **hypothesis**, subject to semantics and measured parity. See [EXPLAIN plan gate evidence](CSR_EXPLAIN_PLAN_GATE_2026-11-05.md). **No EXPLAIN ANALYZE, heavy scan, ANALYZE maintenance, SQL rewrite, index, timeout increase, deploy or work-pack closure. Formal closure still 5/13 (38%).**

# Cost Sheet Review authenticated read-query timeouts — diagnosis (5 November 2026)

> **Status: SELECT-only investigation complete, remediation design/benchmark OPEN, no formal closure gate passed.** This is a subordinate evidence checkpoint within the existing [unified Costing Suite workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md), not a new work pack. Formal programme closure remains **5/13 (38%)**.

## Evidence: two authenticated production PWA errors

Supabase PostgREST logs on **5 November 2026** (UTC) captured:

| UTC | Public view / request | Evidence |
|---|---|---|
| 04:50:16 | `v_costing_pricing_printable_cost_sheet_product_summary?select=*&period_start=eq.2026-11-01&order=product_name.asc,product_id.asc&offset=0&limit=1000` | HTTP **500**, PostgreSQL **57014**, `canceling statement due to statement timeout` |
| 04:59:50 | `v_cost_sheet_snapshot_sku_monthly_comparison_governed?select=*&snapshot_period_start=eq.2026-11-01&order=product_name.asc,sku_column_label.asc&limit=2000` | HTTP **500**, PostgreSQL **57014**, `canceling statement due to statement timeout` |

These failures are **not** permission-denied errors. The user's reported Cost Sheet Review tabs loaded overall, but these specific requests timed out. Do not replace that detailed evidence with an unqualified “Cost Sheet Review PASS”.

## Live metadata and dependency inspection

Both public views are ordinary SQL views (not materialised). `costing.cost_sheet_line_monthly_snapshot` has **~1,375,032 planner-estimated rows** and **1,264 MB total relation size** at the inspection checkpoint. These are estimates, not counts of each costing period. Existing indexes include:
- `idx_cost_sheet_monthly_exact_tuple (snapshot_period_start, valuation_date, refresh_run_id)`
- `idx_cost_sheet_snapshot_period_product (snapshot_period_start, product_id)`
- `idx_cost_sheet_snapshot_period_sku (snapshot_period_start, sku_id)`
- `idx_cost_sheet_monthly_run_sku (refresh_run_id, sku_id)`
- unique `uq_cost_sheet_monthly_snapshot_line` covering period, valuation, run, SKU, section, order, label.

**Printable product summary:** the public view computes two product-grain aggregates (`product_base` and `status_by_product`) over snapshot lines joined to `costing.v_current_successful_costing_refresh_run`, then combines them. It performs distinct SKU counts, conditional status counts, text aggregation and sorting. Its server-side view contract is already governed to the selected successful costing run; do **not** rewrite it to “latest” without approved run-selection parity.

**Monthly SKU comparison:** public wrapper delegates to `costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed` and checks CCC view permission. Its inner `line_pivot` groups snapshot lines by governed run and SKU using many `max(value_numeric) FILTER (WHERE line_label=...)` expressions, then self-joins pivoted rows for **previous month and previous year** comparisons. It includes `snapshot_refresh_run_id` and `selection_basis` to preserve which governed run was selected for every period.

**Why these are candidate bottlenecks:** substantial aggregates/joins over a large snapshot source; the selected November period filter, sort and row limits are present in the outer request, but whether/when Postgres pushes those constraints through groupings, windowed run designation and joined views is not yet established by a plan. The logs prove timeouts, **not a particular root query-plan node**. Existing period indexes mean an index addition is not automatically justified.

## Client contract, already implemented

- `public/shared/js/costing-suite-cost-sheet.js` fetches printable product summary **1000 rows/page**, filters period and sorts by product name/product ID; it already has `readWithPgStatementTimeoutRetry` for code `57014`, **one retry** after **300 ms**. That does not eliminate server bottlenecks. A successful retry or later table render must not erase evidence of the initial 500.
- `public/shared/js/costing-suite-shell.js` fetches cost-comparison by `snapshot_period_start = ACTIVE_PERIOD_START`, sorts product/SKU, `limit(2000)`. The underlying view aggregates more than a simple 2000-line table.
- Any redesign must protect PWA and Electron consumers, approved/draft run designation, valuation/period matching, missing historical comparisons, percent change semantics, confidentiality/view permission checks and strict read-only behaviour.

## Next technical gate — no production DDL or heavy scans yet

1. **Catalogue/plan check:** obtain safe `EXPLAIN` (no `ANALYZE`) for the *exact* filtered view requests using a bounded, approved SQL planning session. Inspect selection pushdown, row estimates, materialisation, sort/hash aggregate, joins, indexes and any costly run-designation expansion. Avoid executing full queries, adding `COUNT(*)` to aggregate views, or raising statement timeout to mask failures.
2. **Semantic benchmark:** design a bounded, non-production comparison using a representative dataset or an authorised isolated scratch implementation. Validate entire result shape and all line/period/run-selection contracts, including September, October and November 2026, no-matching-period case and historical cross-period comparisons.
3. **Choose a minimal implementation:** prefer improving predicate pushdown / prefilter to selected period-and-comparison periods and governed run tuple; alternatively a period/run-keyed read projection backed by approved immutable snapshots, only after examining freshness and retention implications. Preserve cost evidence and approved-run reproducibility.
4. **Regression gates:** strict row-by-row parity of fields and selection bases, permissions and authenticated view-only reads, LF/CRLF and Chromium suites, no Electron skips described as zero.
5. **Controlled owner decision:** no migration, index, materialized view, table retention change, timeout increase, production approval, feature flag or deployment until the plan and rollback are reviewed.

## Work-pack / release statement

The issue is a **Cost Sheet Review read-performance defect** evidenced during signed-in acceptance. It is **not** itself a completed WP05/WP06/MDC-07/WP12 acceptance or closure. Production Cost Centres view-only fix (#178) and owner retest (#179) remain separately recorded. November governed readiness build absence also remains a separate dependency. Formal closure **5/13 (38%)** unchanged.

**Actions in this checkpoint:** SQL metadata SELECTs, read-only logs, GitHub source review and documentation; **no** Supabase writes or application code changes.
