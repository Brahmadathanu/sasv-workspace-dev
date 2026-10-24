# Governed actual-monthly regional scaling deployment — 21 October 2026

Owner endorsed routine recalculation with new governed actual sales and monthly common basis, while maintaining review on default/new-SKU estimates.

Implementation v1 prepared commit 1b05b92fc1576d20d4bf08363a0bd562e511a7ee failed PostgreSQL compilation due to duplicate product_region_actual_evidence_row_count projection (function not replaced). Corrected prepared v2 `closure/prepared/PREPARED_20261021_GOVERNED_ACTUAL_MONTHLY_REGIONAL_SCALING_v2.sql` committed `2720201784c2e854d41680c1198d992e4e0ec3df`; live migration `costing_governed_actual_monthly_regional_scaling_v2_20261021` returned SUCCESS.

Only `costing.fn_regional_marketing_review_status(bigint)` modified. Permits earlier within-period ACTIVE acceptance of same SKU/product/region for existing governed `REGION_SCALED_COMMON_BASIS` method with `ACTUAL_SIGNED_BILLED_SALES`, no active regional assumption/default policy, READY `ACTUAL_MONTHLY_MAX` common source, positive monthly basis, regional physical sales evidence, positive company denominator and regional share <= 1, valid positive billed-sales numerator, positive recomputed output and no direct regional SKU actual units. Refreshed actual physical inputs and billed-sales amounts may vary. Original exact-fingerprint same-date acceptance and prior unchanged-evidence continuity preserved. No raw amount, status, label, selection hierarchy, or pool arithmetic altered.

Frozen run134 regional review source rows still 200 raw REVIEW_REQUIRED. Live effective status: **165 READY / 35 REVIEW_REQUIRED**, exact intended 48 additional READY from previously verified 117. Residual 35 region rows derive from `DEFAULT_NEW_SKU_EXISTING_PRODUCT` (18 IK,17 OK). No broad default auto-clear. No new costing refresh, no amendment to frozen run134, no approval or Sheets publication.

Follow-ups before final run: inspect the 35 default cases for better actual evidence and existing governed manual acceptance; run deeper negative/future-date regressions, and assess downstream pricing-stage final closure before G6. G6 OPEN, Google Sheets BLOCKED.
