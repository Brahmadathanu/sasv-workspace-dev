## 2026-10-16 08:50 IST — 7 staff classifications applied to LIVE (user-authorised)
- Script: proposals/AU4_staff_classification_7_active.sql (insert body only, via execute_sql). Local PG17 test passed first (apply, idempotent re-apply, rollback).
- Result: 7 rows (remarks tag AU4-7STAFF-20261016); UNCLASSIFIED active staff now 0.
- Sept pools: FINANCE_ADMIN 41,000→75,525; PACKING_LABOUR 6,21,599→6,63,449; others unchanged (DL 7,06,203; ADMIN 2,14,890; STORES 1,87,165; PROD_SUP 41,055; QC 90,950).
- Cron 60/61 remain paused. No other change. Rollback: delete by remarks tag (see script).
- Takes effect in costing outputs at the next refresh run (frozen snapshots for runs 118/119 unchanged).
