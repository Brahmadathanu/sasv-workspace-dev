# AU-6Q QC per-batch allocation: build + test (NOT applied), 2026-10-18
Named AU-6Q because AU-7 is already the price-proposal workstream.
Prepared migration: proposals/au6q_qc_batch_true/PREPARED_au6q_qc_batch_true.sql (outside supabase/migrations).

## Today (kept)
Pool: QUALITY_CONTROL_OVERHEAD Rs 142,241.67 (run 126).
Driver: AU-4 independent Method-3 effective-spec workload per product (product_qc_workload_snapshot).
Demand: fn_total_manufacturing_product_demand_as_of (commercial + internal).
Defect: product Rs = pool x units / sum(units), the same every month regardless of output, then divided by monthly qty. Tiny volumes therefore explode.

## Change (per-unit derivation only, INSERT path, no snapshot UPDATEs)
- Product QC workload = Method-3 units x qty / batch_size_ref. The batch size comes from the run's POH workload snapshot, which is date-resolved. Its quantity equals the QC demand qty for all 455 products.
- Rate = Rs 100.62 per workload unit per batch (run 126).
- QC per base unit = rate x units / batch size, independent of volume.
- Products with no batch size keep their current share (fallback). The full pool is absorbed, and the variance row is written to batch_true_absorption_variance (QUALITY_CONTROL_OVERHEAD).
- Statuses and reason codes are unchanged. The note carries the batch-true basis.
- Separate gate costing.qc_batch_true_switch, effective 2026-10-01. Sep run 122 is unaffected. Rollback = switch off.

## Local test (PG17, live DDL/constraints, live trigger functions verbatim, run-126 data): all PASS
| test | result |
|---|---|
| T0 live function on fixture == live run-126 rows | max diff 3e-13 |
| T1 no switch / T2 switch off / T3 on but valuation < effective (Sep-equivalent) | byte-identical to current, no variance row |
| T4 on | 455 products batch-true; absorbed 142,241.67, variance ~0; shares sum 1; statuses unchanged; all CHECKs pass |
| T5 called twice in one transaction | identical |
| T6 product without batch size | keeps current amount; full absorption |
| T7 SUCCESS run / T8 APPROVED run / truncate | rejected by live guards; rows intact |

## Read-only replay on live run 126 (equals local T4)
| SKU | QC old -> new | COP old -> new |
|---|---|---|
| 1792 Abhraka Bhasmam 1 kg | 1,120.79 -> 18.11 | 10,439.66 -> 9,336.99 |
| 1769 Chiruvilwadi Kvatha Choornam 200 g | 653.42 -> 133.33 | 1,097.18 -> 577.08 |
| 1770 Gandharvahasthadi Kvatha Choornam 200 g | 653.42 -> 133.33 | 1,070.22 -> 550.13 |
| 879 Mehasamani 20 g | 20.55 -> 0.31 | 29.37 -> 9.14 |
| 988 Thampira Chendooram 5 g | 61.64 -> 0.09 | 91.78 -> 30.22 |
| 1797 Special Medicine 2 5 g | 0.31 -> 0.09 | 23.40 -> 23.18 |
| 937 Abhraka Chendooram 5 g | 5.60 -> 0.09 | 59.53 -> 54.02 |
Distribution of COP change (629 SKUs): <-10% 91; -10..-2% 84; ±2% 429; +2..10% 24; +10..25% 1. Median x0.998 (min 0.291, max 1.228).
Negative-margin SKUs: 37 -> 24 (approximate: QC delta only).

## Data flags surfaced (no action taken)
- Kvatha Choornams (products 468, 1340): batch_size_ref = 2 kg. QC is still Rs 666/kg, and DL/POH are similarly inflated. A 2 kg batch looks wrong, like the Abhraka case. Confirm the true batch size.
- SKU 865 Kashaya Vasthi Kit: QC 4.85 -> 735. The product is in Nos (batch 160) but the SKU conversion looks like 275 Nos per pack (pack 275 g), which suggests a conversion error. It also inflates DL/POH (COP 3,207).
