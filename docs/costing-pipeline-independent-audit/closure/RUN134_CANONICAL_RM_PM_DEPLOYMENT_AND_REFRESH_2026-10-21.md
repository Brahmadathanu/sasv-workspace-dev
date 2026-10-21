# Run 134 — post-deployment governed verification (21 Oct 2026)

Owner instructed deploy, test, then execute one fresh refresh.

## Deployment
Prepared RM/PM canonical acceptance migration v1 commit 896c2928 was initially rejected at SQL statement boundary (missing semicolons), with no database change. Syntax-corrected complete file committed as docs/costing-pipeline-independent-audit/closure/prepared/PREPARED_20261021_run_scoped_rm_pm_canonical_acceptance_v2.sql, commit dbaa1f03631c16bcd582de40b6a4927d4ae76538. Supabase apply_migration costing_run_scoped_rm_pm_canonical_acceptance_v2_20261021 SUCCESS. Both run-scoped fn_build_product_rm_cost_as_of(date,date,bigint) and fn_build_sku_pm_cost_as_of(date,date,bigint) now call fn_material_review_acceptance_matches, no longer contain obsolete ar.source_valuation_date=p_valuation_date predicates. Material rate selection and manufacturing formula unchanged.

## Pre-run read-only test
costing.fn_build_sku_material_cost_as_of('2026-10-01','2026-10-20',133): 627 SKUs = READY 611, REVIEW_REQUIRED 16, BLOCKED 0; accepted material-review lines 3418 and unaccepted 16.

## Governed fresh run
October period OPEN, valuation date 2026-10-20 DRAFT. Owner-authorised supersession record id4. New run134 source ADMIN_VERIFICATION. All six stages returned SUCCESS; final run SUCCESS, BLOCKED 0, REVIEW_REQUIRED 147, READY 480 out of 627. Baseline run133 final 612 REVIEW and 15 READY, so 465 fewer final SKU reviews. Run134 material snapshots: 611 READY, 16 REVIEW, 0 BLOCKED. Frozen run133 material status 22 READY, 605 REVIEW. Run134 material accepted lines 3418 vs run133 accepted 0. Original approved run128 and frozen 131/133 unchanged; run134 remains unapproved; no pricing publication or Google Sheets.

## Important financial follow-up
627/627 material SKU rows paired run133 vs run134: material_cost_per_sku is unchanged for 624, changed for 3 (all RM side):
- SKU623 Saraswatha Ghritham +INR 1.03409090909091 per SKU.
- SKU634 Amara Ghritham +INR 2.58522727272727 per SKU.
- SKU658 Manasamithra Vatakam +INR 0.75 per SKU.
PM cost differences are zero. Product RM frozen line counts unchanged across runs (28,36,59 respectively), while summed product RM line amounts differ. Exact source-line-key matched rows showed no numeric difference; remaining difference is not yet explained (potential source-line identity replacement). Do not infer this is a new rate, policy, or bug without stronger attribution. Do not designate G6 or publish costs until reconciliation. Also inspect 147 final reviews: 16 material-review SKUs can propagate downstream; remaining reviews include regional marketing/evidence and other controls.

G2 preventive-route attestation HELD, G6 OPEN, Sheets BLOCKED.
