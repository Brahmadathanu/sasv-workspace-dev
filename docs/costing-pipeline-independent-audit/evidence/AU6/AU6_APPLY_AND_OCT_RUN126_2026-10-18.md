# AU-6 live apply + October rerun 126 (user approved 2026-10-18 05:26 IST)
Executor: Aryabhatta via Supabase MCP (apply_migration / execute_sql only; no db push). Jarvis notified by the parent beforehand.

## Applied
| # | Change | Live id |
|---|---|---|
| 1 | Default-volume v2 (policy ids 1/2 closed 2026-09-30; v2 ids 6/7 from 2026-10-01; plan table; cap log; basis fn v2; POH/DL cap hook) | migration 20261017235758 au6_default_volume_v2 (repo file renamed to match) |
| 2a | Abhraka Bhasmam batch ref 501 (100 kg) superseded by ref 554 = 50 kg from 2026-10-01 (governed rpc_revise_supply_batch_size_reference) | ref 554, approval USER-APPROVAL-AU6-ABHRAKA-BATCH50-20261018 |
| 2b | new_product_volume_plan id 1: product 54, 0.33 kg/month, owner user, 2026-10-01 to 2027-09-30 | USER-APPROVAL-AU6-ABHRAKA-PLAN-20261018 |
| 3 | recurring_cost_pool_provision + view union; HO_ADMIN_ALLOCATION Rs 5,00,000/month ADMIN_OVERHEAD from 2026-10-01, review 2027-03-31 | migration 20261018000020 au6_recurring_cost_pool_provision |
| 5 | Qty-driver acceptances: 59 (ids 72-130); regional marketing acceptances: 204 rows / 135 SKUs (ids 369-572), reason 'User approved Oct defaults/regional 2026-10-18' | governed RPCs as user |

## Run 122 proof (run122_fingerprint.sql: md5 over all 56 refresh_run_id tables, rows where run=122)
Baseline ccb9c7072fc386ed13fbbbe6e4d8ab6b (353,819 rows) and run row md5 547983c7. Identical after each step: migration 1, Abhraka, HO admin, rerun and acceptances.
Migration 1 added a nullable column (monthly_driver_plan_id) to sku_sales_allocation_basis_snapshot. The fingerprint strips that trailing null; 0 non-null values for run 122.

## Run 126
Queued 00:00:50 UTC; ran 00:05 to 00:30 UTC (05:35-06:00 IST). SUCCESS, valuation 2026-10-16. Job 61 paused afterwards; jobs 60 and 61 inactive. NOT approved, NOT locked.
| pool | pool Rs | absorbed | variance | rate 125 -> 126 |
|---|---|---|---|---|
| Labour | 706,203 | 706,203 | ~0 | 505.005 -> 561.360 |
| POH | 670,935.04 | 670,935.04 | ~0 | 423.865 -> 467.157 |
| ADMIN pool | 1,171,360 -> 1,671,360 (manual 0 -> 500,000) | | | |
Rates rise because the default workload shrank: smart default replaced flat 10 packs; 5 SKUs inactivated; Abhraka moved to the plan. The default share is 0.9% of workload, below the 2% cap (scale 1.0).
Control (125 -> 126): blocked 0 -> 0; review 189 -> 184 (prime-cost 118 -> 112, pricing-bridge 71 -> 72); ready 445 -> 445.
Basis: ACTUAL 569; NEW_PRODUCT_ESTIMATE 1 (Abhraka); default review 65 -> 59.
Acceptance harness: all PASS except 6 VALUATION_DATE_LOCKED_OR_FINAL (DRAFT, by instruction). EVIDENCE md5 da427ece.

## Key SKU COP (125 -> 126)
| SKU | 125 | 126 | note |
|---|---|---|---|
| 879 Mehasamani 20 g | 28.75 | 29.37 | rate |
| 988 Thampira Chendooram 5 g | 89.65 | 91.78 | rate |
| 1792 Abhraka Bhasmam 1 kg | 6,105.62 | 10,439.66 | DL 1,811 -> 4,023, POH 862 -> 1,899 (batch 50 + rate); QC 36 -> 1,121 (plan 0.33 kg) |
| 937 Abhraka Chendooram 5 g | 56.53 | 59.53 | rate |
| 1769 Chiruvilwadi Kvatha Choornam 200 g | 462.79 | 1,097.18 | QC 53 -> 653 |
| 1770 Gandharvahasthadi Kvatha Choornam 200 g | 435.84 | 1,070.22 | QC 53 -> 653 |
| 1797 Special Medicine 2 5 g | 23.30 | 23.40 | |
Movement over 629 SKUs: 30 up by more than 5%, 0 down; median COP x1.012; median pricing cost x1.041 (HO admin); max x2.46.
Negative-margin SKUs: 35 -> 37.

## Finding: QC is volume-divided (not batch-true)
QC gives each product a fixed monthly Rs share (Method 3 workload, about Rs 540 for Kvatha). It then divides that by monthly volume. Smaller governed volumes (Kvatha 2 kg -> 0.167 kg, i.e. 1 batch/yr; Abhraka 10 -> 0.33 kg) therefore make QC per kg explode.
Low-volume products should absorb QC per batch tested, not per month. Proposal: make QC batch-true like DL/POH, i.e. QC Rs per batch / batch size, with tests per batch from the spec. Not applied; this is AU-6Q scope. Abhraka QC alone is Rs 1,121/kg.

## Acceptances take effect only in a new run
Live queues for run 126 now show READY (qty 59/59, regional 204/204). The run-126 control snapshot is frozen (184 review). The flags clear only in a new run at valuation 2026-10-16. No rerun done; awaiting user.
