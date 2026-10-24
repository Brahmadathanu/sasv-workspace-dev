# AU-6 combined v2: live apply, Kvatha inactivation and October rerun 127 (2026-10-18)
User approval 2026-10-18 10:13 IST: "Yes: install the combined package, make Kvatha 468 and 1340 inactive, and rerun October". Jarvis was notified by the parent beforehand.
Executor: Aryabhatta, using Supabase MCP only (apply_migration / execute_sql). No db push or migration repair. The package file stays out of supabase/migrations.

## Steps (times IST)
| # | Step | Result |
|---|---|---|
| 1 | Run 122 fingerprint BEFORE (56 tables) | ccb9c7072fc386ed13fbbbe6e4d8ab6b, 353,819 rows, run row 547983c7 (= AU-6 baseline) |
| 2 | Filled 22 placeholders with USER-APPROVAL-20261018-AU6-V2; re-checked the 4 live writers (POH 6514…, DL 5b77…, QC 7a59…, sales 73ea…) | all matched |
| 3a | apply_migration attempt 1 | **rolled back by the package's own post-check**: resource class PACKING_MACHINE (4 family packing steps, section 6) has no capacity row. It has 0 rows in run-126 DL/POH step snapshots, i.e. it is not used by the writers. Nothing was left behind (verified). |
| 3b | Narrowed that post-check to skip PACKING_MACHINE (one-line change, comment in file; no costing logic changed); re-applied | **SUCCESS**, migration 20261018044644 `au6_combined_v2` (10:16 IST). New writer md5s equal the locally tested ones (POH 3087b71e, DL 3b68b6aa, QC 116b9739, sales 09c3d22c). Switches QC/loads/sales ON from 2026-10-01; 16 capacity rows (13 provisional); kit exceptions eff 2026-10-01; Sep gates closed. |
| 4 | Kvatha inactivation (ref USER-DECISION-20261018-KVATHA-INACTIVATE), acting as the user via governed RPCs | SKUs 1770 (Gandharvahasthadi 200 g) and 1769 (Chiruvilwadi 200 g) deactivated via rpc_set_product_sku_active (audit 51, 52). Products 468 and 1340 set Inactive via rpc_update_product (product_master_audit 14, 15). SKU 670 (468, 500 g) was already inactive. |
| 5 | Run 122 fingerprint AFTER | identical (ccb9c707…, 353,819, 547983c7). New lineage table has 0 rows for run 122. |
| 6 | Job 61 enabled; refresh requested | run 127 queued 10:18. Ran 10:20 to 10:45. **SUCCESS**. Job 61 paused again; jobs 60 and 61 both inactive. NOT approved, NOT locked (designations: 119 REFERENCE, 122 APPROVED only). |
| 7 | Run 122 fingerprint after the run | identical |

Applied file: `evidence/AU6L/live/APPLIED_au6_combined_v2_20261018044644.sql`; diff vs prepared: `live/prepared_vs_applied.diff` (22 placeholder lines + 1 post-check line).

## Run 127 results
| Item | Run 126 | Run 127 |
|---|---|---|
| SKUs | 629 | 627 (Kvatha gone) |
| Blocked / review / ready | 0 / 184 / 445 | **0 / 137 / 490** |
| of which prime-cost review | 112 | 8 |
| of which pricing-bridge review | 72 | 129 |
| Negative-margin SKUs | 37 | **9** (42, 43 Dhanyamlam; 159; 193; 975 Linga Chendooram; 1174; 1264; 1365; 1552) |

Pool absorption (full; variance ~1e-68):
| Pool | Rs/month | Rate per batch-true unit |
|---|---|---|
| Manufacturing labour | 706,203 | 182.87 |
| Production overhead | 670,935.04 | 160.84 |
| QC | 142,241.67 | 127.16 |
| Admin, incl. Rs 5,00,000 HO provision | 1,671,359.78 | absorbed exactly (sum of per-SKU × units) |
| Finance admin | 205,450.46 | absorbed exactly |

- Loads lineage: 445 DL + 453 POH products, 250 loads-scaled.
- Sales basis: 101 seasonal 12-month average, 468 max-month on the new net feed, 57 defaults, 1 plan.

Key SKUs (Rs per unit):
| SKU | Run 126 | Local replay | **Run 127** |
|---|---|---|---|
| 1769 / 1770 Kvatha | 1,097.18 / 1,070.22 | 375.83 / 348.88 | **inactive (not costed)** |
| 876 Dahasanthi 20 g | 5.62 | 5.44 | **5.40** |
| 637 Dhanwantharam Gulika 100 | 24.59 | 20.69 | **20.61** |
| 111 Rasnadi 50 g | 31.29 | 29.72 | **29.67** |
| 1792 Abhraka 1 kg | 10,439.66 | 5,531.96 | **5,532.41** |
| 879 Mehasamani 20 g | 29.37 | 7.51 | **7.47** |
| 988 Thampira 5 g | 91.78 | 23.95 | **23.85** |
| 1797 Special Medicine 2 | 23.40 | 22.42 | **22.34** |
| 865 kit | 3,206.57 | 55.45 | **57.20** |
| 878 Kanji | 141.01 | 93.90 | **95.65** |

- Kanji share of manufacturing labour + overhead: Rs 47,010 + 47,706 = **6.88%** (replay 6.88%).
- Live vs replay over 627 SKUs: median difference 0.12%; 616 within 1%; all within 5%.
- Reasons for the differences:
  - (a) Stores overhead was recomputed live on the new volumes. The replay held it, so most SKUs are about 1% lower.
  - (b) Kit/Kanji stores: the replay divided the per-gram stores by 275/500. Live recomputed them at Rs 1.75 / 1.76 per kit, so these two are +1.7 Rs.
  - (c) The Kvatha removal slightly changed rates (labour 182.83 → 182.87).

## Acceptances (the 263 from run 126)
- **Qty-driver (59):** 54 still match and are effective. 2 belonged to Kvatha.
  3 no longer match because their smart default moved with the new sales feed: 251 Karpasasthyadi Thailam (6.455 → 6.22/month), 1149 Hridayasudhi (7.75 → 8.35), 1771 Brihat Chagaladi Ghritham (8.70 → 0.725). These 3 products (8 SKUs) are the remaining prime-cost reviews.
- **Regional marketing (204 rows / 135 SKUs):** **0 match in run 127.** The acceptance fingerprint includes regional units and marketing cost per SKU, and SALES-01 changed both. So the 200 rows / 133 SKUs show as review again. That accounts for pricing-bridge review rising 72 → 129: SKUs freed from prime-cost review now surface their regional review.
  They need fresh acceptance against run 127 if the user agrees. This is a user decision; not done.

## Not done (by instruction)
No approval or lock of run 127. No Sheets, no merges. Cron 60 stays paused.
