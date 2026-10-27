# MDC workflow status and closing plan (25 Oct 2026)

Read-only audit of the master-data-costing (MDC) programme against `main` and live Supabase (SELECT only). Status: **closing, not closed.** The programme closes after every item below has a recorded disposition and the "do now" items are finished.

> **Addendum 27 Oct 2026:** costing redesign v2 applied live (CI-040 v2.1, CI-041 v2.1, CI-045, CI-042 v2.2, CI-043 v2.2 rev B); migration record copies are in `supabase/migrations/`, records in `docs/costing-pipeline-independent-audit/redesign-v2/`. Master data is not changed by these. Still open: CI-044 (parked), health-check schedule/alerts, backdating cutoff warning, Cursor approval screen and refresh/date-label briefs. See `docs/costing-pipeline-independent-audit/COSTING_REDESIGN_V2_CURRENT_STATE.md`.

> **Addendum 26 Oct 2026:** CI-038 (SKU activation guard), CI-038a (activation as-of today) and CI-039 (scheduler fix) are applied live; migration files are now in `supabase/migrations/`. PRs #90 and #95 merged. SKUs 41 and 846 completed and activated (see CHANGELOG_DECISIONS.md, 2026-10-26). The per-run valuation-date redesign (CI-040 to CI-043) is pending owner decisions D1–D7.

## Done
| Item | Status | Evidence |
|---|---|---|
| WP-1 control plane | Done, verified | This folder |
| WP00 inventory | Done, verified | WP-00-CURRENT-STATE-INVENTORY.md |
| WP01 completeness contract | Done, verified | `rpc_get_product_sku_readiness` live |
| WP02 lifecycle | Done, merged `7948551` | manage-products.html, js/products.js |
| WP03 creation guidance | Done, merged `dd7da3a` | |
| WP04 readiness control centre | Done, merged `1ff8d13` | readiness lens + 3 live RPCs |
| SEC-P01 RLS on 5 tables | Done live | RLS on, no `authenticated` SELECT/INSERT (checked 25 Oct) |

## Remaining items and proposed disposition
"Do now" = finish inside this programme before closing. "Backlog" = move to the costing-suite client backlog (`docs/costing-pipeline-independent-audit/audit-2026-10-25/C_client_ux_audit_and_backlog.md`, CW-xx). "Owner" = needs a decision from Dr. Brahmadathan U.

| Item | What it is | Real status | Proposed disposition |
|---|---|---|---|
| WP05 suite rationalisation audit | Inventory of costing suite screens | Partly done: the 25 Oct client audit is the inventory | **Do now**: accept the 25 Oct audit as WP05 output; Cursor plan-mode UX audit refines it |
| WP06 Pricing Policy Manager simplification | 8,220-line JS, 223 KB page | Not started | **Backlog** (CW-09 split, incremental) |
| MDC-07 (was WP07) costing navigation | 37 lenses in 6 suites | Not started | **Backlog**, folded into the Cursor UX plan (navigation/consistency package) |
| WP08 master data navigation | Product/master data menus | Not started | **Backlog** (with NAV-P01/P02) |
| WP09 wider app launcher audit | Whole-app menus | Not started | **Backlog**, low priority |
| WP10 creation safeguards | Stop incomplete SKUs being created | Not started. Server today only blocks an active SKU under an inactive product and forces price-list flags off for inactive SKUs; nothing blocks an incomplete SKU (checked 25 Oct) | **Owner**: decide whether "incomplete" should block, or only warn (WP03 guidance already warns) |
| WP11 UX consistency | Labels, sorting, dialogs, layout | Not started | **Do now** via Cursor (CW-04, CW-05, CW-06, CW-13) |
| WP12 regression and docs | Regression proof + docs | Partly done (costing regression lives in closure G0–G6) | **Do now**: this docs PR + closing note |
| UX-P01 regional marketing screen | 3 live RPCs, no screen | Not started (server ready) | **Backlog** CW-11 |
| UX-P02 Manage Products polish | Density, dialogs, narrow layout | Not started | **Backlog** (with CW-13) |
| NAV-P01 master data navigation | | Not started | **Backlog** with WP08 |
| NAV-P02 readiness route link map | Server route codes have no Manage Products link | Partly done (costing side has a resolver) | **Backlog** with WP08 |
| CSE-P01 commercial-sales LIVE_AS_OF ambiguity | Which sales snapshot row counts when several exist | Unclear | **Owner** decision |
| PERF-P01 readiness performance | Speed of readiness lookups | Unclear; live stats show single-SKU readiness averaging ~4.9 s (max ~8 s) | **Owner** decision |
| CCC-P01 SKU Control Status vs Readiness | Two overlapping lenses | Not started | **Backlog** (Cursor UX plan) |
| CCC-P02 pricing duplication audit | | Not started; findings in the 25 Oct audit | **Backlog** (CW-08/CW-09) |
| CCC-P03 legacy dashboard summary views | Two old views still exist; one dead client reference | Partly done | **Backlog** CW-14 (client) then a separate gated server drop |

## Closing order
1. Merge this docs PR. 2. Owner decisions (CSE-P01, PERF-P01, WP10, open periods). 3. Cursor plan-mode UX audit, reviewed, then small client PRs. 4. Write the closing note pointing to the costing-suite backlog, and mark the programme CLOSED.
