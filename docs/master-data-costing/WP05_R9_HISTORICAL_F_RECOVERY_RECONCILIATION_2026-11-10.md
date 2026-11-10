# WP05 R9 — Four historical failing lens recoveries: current evidence and next proof

**Date:** 10 November 2026. **Status: HISTORICAL FAILURE LEDGER RECONCILED, NO WHOLE-LENS PASS PROMOTION.** The five Q-PRM/Q-ID/Q-VIEW/Q-F1/Q-D3 policy directions are **owner-approved in [R9 policy decision](WP05_R9_OWNER_POLICY_DIRECTIONS_ACCEPTED_2026-11-10.md)**. This reconciliation does not authorise a production test or data/permission modification. WP05 OPEN, formal 6/13.

Source of historical truth: [AE1 40-lens reconciliation](WP05_AE1_AUTHENTICATED_EVIDENCE_RECONCILIATION_2026-11-08.md) §1 and §3, [40-row R1](WP05_R1_FORTY_LENS_EVIDENCE_RECONCILIATION_2026-11-10.md), [Scheme Master log correlation](SCHEME_MASTER_LOG_CORRELATION_AND_CLOSURE_PATH_2026-11-08.md), [isolated index candidate](scheme-master-perf-candidate-227/REPORT.md), [CSR timeout diagnosis](CSR_PLAN_RECHECK_AND_FIRST_CLOSURE_GATE_2026-11-08.md), and [owner-reported CSR post-maintenance reads](CSR_OWNER_READ_RETEST_ACCEPTANCE_2026-11-05.md).

## Four historically failed lens IDs, no retroactive rewriting

| AE1 lens | Original verified failure | Subsequent evidence | Current disposition |
|---|---|---|---|
| **#19 Scheme Master** | 1280 px HTTP 500/PostgreSQL 57014 at flag OFF/ON on v391/v392; 390 px 7 rows. Two real PostgREST cancellations on **8 Nov 05:39:31 and 12:49:56 UTC**, distinct from manual mgmt-api diagnostic. | Owner later observed 7 schemes and 3/3 desktop refresh PASS after index/statistics work; **not a timed clean cold-path series**. Isolated synthetic ~231k-row index experiment improved warm P50 ~95→35 ms, **not production proof**. | **HISTORICAL F**, current source/catalogue still needs bounded no-side-effect desktop timing / recurrence decision; issue #224 MONITOR. |
| **#23 Printable Cost Sheet summary** | PWA HTTP 500 / 57014 on 5 Nov 04:50:16 UTC, November 2026 period. | Owner later saw November printable product summary load after ANALYZE; November real-data functional recovery captured in prior doc, **no independently timed ID-V cold-path replay**. | **HISTORICAL F**, later functional recovery **SCOPED**; do not claim performance cured. |
| **#24 Cost Comparison** | PWA HTTP 500 / 57014 on 5 Nov 04:59:50 UTC, November governed monthly comparison. | Owner later saw Nov+Oct comparison functional load after ANALYZE; source still wide cross-period/period-pivot view and estimated plan expense. | **HISTORICAL F**, later functional recovery **SCOPED**; pending performance/non-regression risk disposition. |
| **#35 Production Cost Centres** | Earlier genuine ID-V browser “Unknown RPC error.” | Owner reported PASS after PR #178 client invoke correction. Current `costing-suite-production-route-cost-centres.js` maps list/detail to `rpc_get_production_cost_centres` / `rpc_get_production_cost_centre_detail`; both exist as live public SECURITY DEFINER authenticated-executable wrappers, metadata read-only confirmed. | **HISTORICAL F**, later reported functional recovery and current source/client contract consistent; **no new signed-in browser replay** this turn. |

## Independent 10 Nov catalogue recheck and NEW observation

Read-only `pg_get_viewdef` MD5s of the live public views are unchanged relative to the earlier named records:
- `v_costing_scheme_master_register` — `8fdc0306bd2f1efbe0638c7c13ba4dda`
- `v_costing_pricing_printable_cost_sheet_product_summary` — `441bbc06003345b0b68d3468a2bfbec2`
- `v_cost_sheet_snapshot_sku_monthly_comparison_governed` — `6ee1648b65833cff0d2f66eeda078ed4`

**Important correction to dated Scheme Master index runbook:** `costing.idx_sku_scheme_viability_snapshot_scheme_period` (B-tree on `scheme_id,period_start`) is **PRESENT, VALID and READY** on 10 Nov, despite the **8 Nov prepared gate** describing it as absent/not executed at that earlier readback. Its current size was **1,752 kB (1,794,048 bytes)**. `pg_stat_user_indexes` currently shows `idx_scan=0, idx_tup_read=0, idx_tup_fetch=0`; stats may reset and do not prove the index has never been used, but there is **no measured production usage recorded in these counters** at readback. This evidence does **not** establish when/by whom the index was created, whether planner chooses it, or that cold-path 57014 is fixed. **Do not create the index again** and do not treat the original UNAPPLIED proposal as a current execution instruction. Current source defines 34 Scheme Master fields; do not change the view simply to force index use.

Public Production Cost Centres catalogue also confirms:
- `rpc_get_production_cost_centres(date,text,text,text)`, MD5(pg_get_functiondef)=`02c0953e01c23c2dc00aebb566e5c99f`.
- `rpc_get_production_cost_centre_detail(bigint)`, MD5(pg_get_functiondef)=`b47dbd1a224ab62c79031d1c4070ea5c`.
- Both `SECURITY DEFINER`, `authenticated` EXECUTE true; **not called**.

## Minimal retained test strategy

**P1 — likely material:** Scheme Master one current genuine authorised ID-V read-only 1280 desktop first/cold-ish network capture and up to a few bounded repeats across realistic conditions, if a verified identity/session exists; record 57014/HTTP status, latency and query path without sensitive data exports. Avoid broad full suite or concurrent refresh. Existing historical timeouts remain F even after successful replay; record new recovery evidence separately. Do not raise `statement_timeout` merely to mask the symptom.

**P2 — conditional:** Printable + Cost Comparison known Nov/Oct safe GET/SELECT-only views, 1280 and 390 only if owner considers recurring timeout risk material. Existing owner's post-ANALYZE observation is real scoped functional evidence, but not cold reliability/latency proof. Full 63-column alternative query/migration is a distinct design not approved by these decisions.

**P3 — conditional:** Production Cost Centres list/detail authenticated read-only smoke if the current built source and role are verified and no prior post-#178 signed-in evidence can be credited. Never click Create/Update/Validate/Approve/Close actions; preserve #178's later reported success.

**STOP conditions:** unknown RPC or unreviewed preview/writer request, missing authenticated identity, source/build mismatch, missing read-only route allowlist, non-redacted staff/business values, unexpected flagged release state. Do not create test users or replay deleted tokens. Use existing WP05 R8 source guards and Q-ID owner-approved *direction* only; the actual signed-in test plan still needs its own exact authorisation.

## Gate effect

Historical AE1 **13 P / 4 historical F / 2 restricted NA / 21 NT** remains frozen. Later recovery evidence is credited with explicit **kind** (owner functional, catalogue/static, isolated synthetic, or genuine prior authenticated). Nothing here claims four fresh PASS, closes all W5-04, authorises a Scheme Master index, or increments 6/13. WP12 B1-T2/T3 integrated flag/navigation/Windows acceptance remains its own final-release gate.
