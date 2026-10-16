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
