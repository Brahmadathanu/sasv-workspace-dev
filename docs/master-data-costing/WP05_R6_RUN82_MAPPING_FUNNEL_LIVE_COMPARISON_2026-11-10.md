# WP05 R6 — PRM Run-82 historical versus live-as-of mapping funnel

**Date:** 10 November 2026. **Evidence:** live Supabase SELECT-only aggregate with no identity/person data or write, preview, RPC, grant, feature flag, browser or release action. **Status: PREDICATE EXPLANATION STRONGLY SUPPORTED, NOT A COMPLETE PRM RPC/UI PASS.** WP05 OPEN; formal programme 6/13.

## Reproduction and exact scope

Source [CLD3 §3.3](WP05_CLD3_STATIC_TRACE_2026-11-09.md) proposed comparing August valuation to current as-of using SQL base tables, explicitly not invoking `fn_product_process_route_readiness` or the review RPCs. Checked column existence/types in `information_schema.columns` first. Executed a **count-only**, SELECT aggregate on:

- `costing.product_direct_labour_workload_snapshot`, fixed `refresh_run_id=82`, `period_start=2026-08-01`, `valuation_date=2026-08-07`;
- `public.products` active status and `sub_group_id`;
- three `costing.production_route_family_product_{map,subgroup_map,group_map}` mapping tables, requiring `status='APPROVED'`, not archived and effective for the given as-of date; group mapping joined via `public.sub_groups`;
- as-of dates **2026-08-07** (run 82 valuation) and **2026-11-10** (the SQL session's current date).

Only aggregate counts were returned. Mapping predicates are a *bounded approximation* of the authoritative resolver, do not check actual family-route approval/completeness, and do not compute the Foundation Review no-ready-in-group predicate.

## Observed live results

| Metric | 2026-08-07 | 2026-11-10 |
|---|---:|---:|
| Distinct historical run-82 recipients | 495 | 495 |
| Historical recipients currently ACTIVE (at query time) | 454 | 454 |
| With at least one approved/effective mapping (any level) | **0** | **454** |
| Without such mapping | **454** | **0** |
| With direct product mapping | 0 | 357 |
| With subgroup mapping | 0 | 97 |
| With group mapping | 0 | 0 |

**What this proves:** The August run-82 recipient set is not inherently empty; the current active population is 454/495. Every currently active member now has at least one qualifying approved/effective family mapping, whereas none does for the valuation as-of date under the tested criteria. This is strong evidence for **historical snapshot recipients + live as-of date** explaining the Mapping Review empty state. The snapshot population is historical; the product-active predicate is *current* in both columns.

**What is still NOT established:** Actual review RPC row count with exact browser-supplied `p_as_of_date` and source run; exact `fn_resolve_route_family_for_product` output grain/precedence and actual current route completeness; Foundation's additional no-ready-same-group predicate; correctness of UI labels and whether this mixed-time semantics is the owner's desired business policy. Do not mark AE1 #33/#34 PASS or adjust the run/as-of interpretation silently.

## Function/catalogue metadata reconciliation

Live SELECT-only `pg_proc` metadata found:

- `costing.fn_resolve_route_family_for_product(integer,date)`: STABLE SECURITY DEFINER, MD5 of `pg_get_functiondef` = `641fd0f7eb7438eed53c1c6170deb0ec`; first definition section selects product mapping, with subgroup/group fallback shown in the source-traced CLD3 report.
- `costing.fn_product_process_route_readiness(date)`: STABLE SECURITY DEFINER, MD5 `29835ce9be925dfe0afdea8133d8217a`, default parameter `CURRENT_DATE`.

Neither function was executed. Their metadata confirms that current as-of is a genuine default; it does not prove the precise review RPC path was invoked with that default.

## Recommended owner disposition

**Q-PRM proposal (decision pending):** Preserve the current mixed-time query semantics *provisionally* as a retrospective review of historical workload recipients against current approved route mapping, and label both **Workload run 82 (valuation 7 Aug 2026)** and **Route mapping as of [selected date]** prominently. If a genuinely frozen historical exception list is needed, design a separate historical-as-of mode after clear user/business requirements; do not automatically change existing review queries.

**Technical next step:** For the two review lenses, use the existing safe source definition to identify exact run and as-of controls and only if necessary perform one *approved read-only* UI check to compare as-of 7 Aug versus 10 Nov and confirm returning/empty rows; do not call preview, Save/Close or any mutation. No fresh browser test is authorised by this document.

**Status remains:** AE1 PRM Mapping Review #33 = NT, Foundation Review #34 = NT; WP05 open, 6/13; WP12 B1 owns cross-module release integration separately.
