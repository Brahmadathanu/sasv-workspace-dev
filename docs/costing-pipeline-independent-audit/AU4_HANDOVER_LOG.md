## 2026-10-16 08:50 IST — 7 staff classifications applied to LIVE (user-authorised)
- Script: proposals/AU4_staff_classification_7_active.sql (insert body only, via execute_sql). Local PG17 test passed first (apply, idempotent re-apply, rollback).
- Result: 7 rows (remarks tag AU4-7STAFF-20261016); UNCLASSIFIED active staff now 0.
- Sept pools: FINANCE_ADMIN 41,000→75,525; PACKING_LABOUR 6,21,599→6,63,449; others unchanged (DL 7,06,203; ADMIN 2,14,890; STORES 1,87,165; PROD_SUP 41,055; QC 90,950).
- Cron 60/61 remain paused. No other change. Rollback: delete by remarks tag (see script).
- Takes effect in costing outputs at the next refresh run (frozen snapshots for runs 118/119 unchanged).
## 2026-10-16 11:53 IST — AU-2c master-data fixes applied to LIVE (user-authorised)
678 BOM 28039→55; 1038 BOM 2697→5.44 and factor 0.00127→0.000704; 696 BOM 320→32 and factor 0.02→0.001. Guarded single transaction, verified. Rollback in PR #70 `AU2C_APPLIED_2026-10-16.md`. Cron 60/61 still paused; takes effect at the next run.
