## 2026-10-16 08:50 IST — 7 staff classifications applied to LIVE (user-authorised)
- Script: proposals/AU4_staff_classification_7_active.sql (insert body only, via execute_sql). Local PG17 test passed first (apply, idempotent re-apply, rollback).
- Result: 7 rows (remarks tag AU4-7STAFF-20261016); UNCLASSIFIED active staff now 0.
- Sept pools: FINANCE_ADMIN 41,000→75,525; PACKING_LABOUR 6,21,599→6,63,449; others unchanged (DL 7,06,203; ADMIN 2,14,890; STORES 1,87,165; PROD_SUP 41,055; QC 90,950).
- Cron 60/61 remain paused. No other change. Rollback: delete by remarks tag (see script).
- Takes effect in costing outputs at the next refresh run (frozen snapshots for runs 118/119 unchanged).
## 2026-10-16 11:53 IST — AU-2c master-data fixes applied to LIVE (user-authorised)
678 BOM 28039→55; 1038 BOM 2697→5.44 and factor 0.00127→0.000704; 696 BOM 320→32 and factor 0.02→0.001. Guarded single transaction, verified. Rollback in PR #70 `AU2C_APPLIED_2026-10-16.md`. Cron 60/61 still paused; takes effect at the next run.
## 2026-10-16 12:34 IST — Step 2 applied to LIVE (user-authorised), migration 20261016070413_au4_cost_head_policy_ledger_engine_link
Pre-check: 0 runs in flight. Result: 52 ledger rows, reconciliation 0 non-OK, switch OFF. Pool view md5 before/after identical (1d435c30…); policy overlay md5 = engine provision md5 (943ceab8…). Cron 60/61 still paused. Same-version file added in supabase/migrations. Rollback: proposals/cost_head_policy_engine_link_ROLLBACK.sql, then drop view v_cost_head_policy_reconciliation and table cost_head_policy_ledger.
## 2026-10-16 14:53 IST — Run-plan items (a)+(b) applied to LIVE (user-approved)
Pre-check 0 runs in flight. Ledger Registration Charges 0→2,400; ledger switch ON (changed_by Dr. Brahmadathan U); cron 61 active=true, 60 still false. September pools now: FIN_ADMIN 2,05,450; PROD_OH 6,70,935; STORES 2,60,509; DL 13,69,652; ADMIN 11,71,360; QC 1,42,242; MKT 29,64,501 (all match the runbook estimate). Refresh NOT triggered; valuation NOT locked; run NOT approved. After the run: pause 61 (`select cron.alter_job(61, active:=false)`). Rollback: switch off.
## 2026-10-16 15:42 IST — Run 120 (Sept 2026, UI_TOOLBAR, requested 15:15 IST) FAILED
Stage 01 SUCCESS; 02_MATERIAL_SNAPSHOT FAILED: NO_EFFECTIVE_PM_BOM_REVISION (valuation 2026-09-10, SKU 1797 = "Special Medicine 2" 5 g, product 824, active, has no plm_bom_header/revision at all). Stages run one per job-61 tick (5 min), so expect about 30 min per run. Per the runbook: cron 61 paused (60 and 61 both false), ledger switch OFF. Run non-designated; runs 118/119 intact. Acceptance not run (no outputs). Fix options: create a PM BOM for SKU 1797 effective ≤ 2026-09-10, or deactivate or exclude the SKU if it is not sold. Then repeat items (a) switch on and (b) job 61 window.
## 2026-10-16 17:25 IST — SKU 1797 fix applied to LIVE + second run window opened (user-authorised)
PR #70 916e301 script applied in one transaction:
- SKU 1797 mapped to tpl 2, with override label 2796.
- `role:pm-bom-revision-approve` granted to the user.
- Revision 684 APPROVED, effective 2026-09-01, approver = user; it resolves for 2026-09-10.
- Label 2796 manual rate 0.64 ACTIVE from 2026-09-01.

Pre-flight for all active SKUs as of 2026-09-10: PM revision missing or ambiguous = 0; product route resolution errors = 0; runs in flight = 0.

Then: ledger switch ON; cron 61 active, 60 paused. September pool total = ₹67,84,648. Refresh NOT triggered; valuation NOT locked; run NOT approved. After the run, pause 61.

## 2026-10-16 ~17:55 IST — Run 121 (Sep 2026, client-triggered) monitored
- Run 121 requested 17:22:46 IST; all 6 stages SUCCESS. Job 61 paused ~17:55 IST after terminal state; verified 60=false, 61=false. Ledger switch left ON (run succeeded). No valuation lock, no designation.
- Pools vs run 118: FIN_ADMIN 15,60,520→2,05,450 (expected 2,03,050 + Registration 2,400 fix = match); PROD_OH 10,16,035→6,70,935 (match); MAT_STORES 2,64,869→2,60,509 (match); DIRECT_LABOUR 13,27,802→13,69,652 (match); ADMIN/QC/MKTG unchanged.
- Acceptance A: PASS 1,2,5,7,8,9,10,12; FAIL 3 (1 blocked: SKU1797 no MRP/selling policy), 4 (145 review: 140 pricing-bridge review), 6 (valuation DRAFT), 11 (MANUFACTURING_LABOUR approved normal rate missing; PROD_OH behaviour split unverified). Evidence md5=29de995fcd3ee0fe65e3cc3e11a4b2b0.
- Acceptance B: 13–23 PASS; 24 manual.
- SKU COP (118→121): 859 9.82→12.17 (mat 3.23→5.87); 1277 12.89→14.62 (mat 7.79→9.46); 1038 66.56→60.55; 879 136.10→113.37 (mat 4.73→2.97, REVIEW; COP > MRP 40); 1797 new, mat 16.90, COP 23.03, BLOCKED (MRP missing).

## 2026-10-16 ~18:55 IST — User-approved live changes after run 121
- SKU 1797: MRP ₹200 IK/OK (app RPC; policy 1829, effective 2026-09-01); default selling terms (policy 1322: GST 12, discount 0, contingency 2).
- Manufacturing labour normal rate APPROVED: costing.manufacturing_standard_rate_policy v2 'AU4_LABOUR_NORMAL_RATE_RUN121', FIXED, 706,203 / 5,516.35 = ₹128.02, approver Dr. Brahmadathan U. Draft v1 (id 6, 911.6 units) left as DRAFT.
- Rulings: POH split provisional, non-blocking; 145 review rows non-blocking; negative-margin list saved (74 SKUs in total, of which 33 flagged for pricing review, 39 READY, 2 prime-cost review); Mehasamani/slow movers are a known exception pending AU-5. Acceptance pass rule amended (checks 3, 4, 11).
- Feed analysis: the labour rate is read only by preview/gate functions (no effect on run costs). MRP feeds rpc_refresh_sku_pricing_bridge_snapshot, so run 121's 1797 pricing bridge stays BLOCKED until a rerun.

## 2026-10-16 ~19:25 IST — Rerun window 3 opened; valuation lock DEFERRED
- Lock NOT applied: no governed lock function exists (only rpc_close_cost_period → CLOSED/FINAL, which requires an APPROVED run). The check constraint ties valuation_date_status LOCKED to period status LOCKED, and fn_request_costing_refresh_internal refuses any period whose status is not OPEN. Locking now would block the rerun. Order: rerun → lock (needs a governed lock path or approved direct transition) → approve.
- Pre-flight: 0 in flight; 634 active SKUs; all have a PM revision effective on 10 Sep (853 via a superseded revision valid 10–11 Sep, costed READY in run 121); ledger switch ON.
- Job 61 enabled (60=false, 61=true). Keep it on until the run is terminal, then pause it.

## 2026-10-16 ~20:25 IST — Run 122 (Sep 2026 rerun) SUCCESS
- All 6 stages SUCCESS; blocked 0, review 146 (140 pricing, 4 prime cost, 2 material). Job 61 paused after the run finished; verified 60=false, 61=false. Ledger switch ON.
- Pools are identical to run 121 for all 7 pools. Key SKU COPs are unchanged. SKU 1797: no longer blocked; MATERIAL_REVIEW (manual PM rate); selling price 178.57; IK margin 82.1%.
- Acceptance A: 1–5 and 7–12 PASS; 6 FAIL (DRAFT, expected). B: 13–23 PASS; 24 manual.
- Lock method investigated: no lock RPC; the intended model is the PERIOD_LOCKED audit event plus a paired status move (OPEN/DRAFT → LOCKED/LOCKED) with the locked_* columns. Guarded SQL prepared (NOT applied): proposals/SEP2026_VALUATION_LOCK_PROPOSED.sql, with reopen rollback. After the lock, no further refresh is possible until the period is reopened.

## 2026-10-16 ~20:45 IST — Acceptance integrity fix + run 122 conservation
- Defect: check 21's detail text was hardcoded to "no run locally => SKIP" even when it really ran. Fixed: no SKIP state remains; a missing run gives BLOCKED; the manual review is now check 25, BLOCKED until an explicit user waiver (w CTE); an OVERALL row passes only if every check is PASS or WAIVED; NULL comparisons fail closed.
- New check 24 POOL_ABSORPTION_CONSERVATION (run 122): engine allocations equal the pool to within ₹1 for all 7 pools. Per-SKU cost × monthly allocation units gives residuals of DL −718 (0.05%), POH −733 (0.11%), QC −148 (0.10%), MS −2; admin, finance-admin and marketing are exact. The residual comes from mixing unit bases (per-SKU rates use each pool's own volume driver, while the check multiplies by sales-allocation units); tolerance 0.5%. PASS.
- Checks 21 and 22 genuinely PASS on run 122.
