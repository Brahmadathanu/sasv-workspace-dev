# Abhraka Bhasmam batch 50 kg + HO admin provision (read-only, 2026-10-18)
## 1. Abhraka Bhasmam (54) vs Abhraka Chendooram (760)
| | Bhasmam 54 | Chendooram 760 |
|---|---|---|
| product uom / conversion | Kg / 0.001 | Kg / 0.001 |
| RM BOM header | 2821: ref output 100 kg, loss 0.1 | 2777: ref output 100 kg, loss 0.1 |
| RM BOM lines | 27 lines, identical item+qty (e.g. Brahmi 300, Abhram-Sudhi 100, Gandhakam 16 kg) | identical |
| SP BOM (Abhram - Sudhi, 114) | 97 kg out, loss 0: Abhram 100 kg, Gomoothram 250 L, Thavitu 9 kg | shared |
| batch_size_ref | 501 = 100 kg (2026-08-06, Gate 11Y.4E.5C) | 195 = 50 kg |
| route | family 78, factor 203.25 | same |
| active SKU | 1792 (1 kg) | 937 (5 g) |
| RM cost/kg (run 125) | 3,389.51 | 3,390 (16.95 / 5 g) |
| DL + POH /kg (run 125) | 1,811.30 + 861.51 = 2,672.81 | 4,192 + 1,724 = 5,916 |
Correction: batch_size_ref only (PREPARED_abhraka_batch50_20261018.sql). It uses the governed RPC rpc_revise_supply_batch_size_reference(501 -> 50 kg, effective 2026-10-01) inside an AU-2c-style guarded transaction (exact pre-values, ROLLBACK until approved).
No BOM change: the BOM is a ratio and already identical to Chendooram's, which runs on 50 kg. Sep resolves 100 kg by date, so run 122 is unchanged.
Impact (batch-true, Oct rates; estimate, QC not recomputed):
- Conversion/kg: POH 861.51 -> 1,723.02 (= Chendooram 1,724); DL 1,811.30 -> 3,622.60.
- COP/kg: 6,105.62 -> ~8,778 (+44%). Material unchanged.
- Rs/month absorbed from the pool: with the 0.33 kg plan ~881 -> ~1,764. With the smart default and no plan, min(10 kg, 50/12 = 4.17 kg) gives ~22,300. With the old flat 10 kg it would be ~53,450. Keep the plan.
## 2. HO admin manual allocation (Rs 5,00,000/month)
| item | value |
|---|---|
| table | costing.manual_cost_pool_provisions (period_start only; no effective dates, no recurrence) |
| rows | id 3 (Jun 2026) and id 5 (Jul 2026), HO_ADMIN_ALLOCATION, ADMIN_OVERHEAD, 500,000, 'HO Estimate', active |
| Aug / Sep / Oct | no row, so manual = 0 |
| ADMIN pool by run | 82 (Aug), 108/122 (Sep), 124/125 (Oct): staff 214,890 + expense 956,470 + manual 0 = 1,171,360 |
| included in 122/124/125? | NO |
Cause: the provision is per period and nobody entered Aug-Oct. There is no recurring mechanism.
Fix: PROPOSED_recurring_cost_pool_provision_HO_admin.sql (recurring effective-dated table, from 2026-10-01, review date; a period row overrides; view feeds the pool unchanged downstream).
Impact on run 125 basis (ADMIN pool +42.7%, to 1,671,360): median pricing cost per SKU +2.37% (max +16.1%); negative-margin SKUs 35 -> 37. Admin overhead affects internal loaded/pricing cost, not manufacturing COP.
Decision needed: ADMIN_OVERHEAD already includes the expense head "Central Office Charges" at Rs 8,71,973/mo (FY25-26 actual Rs 1.05 Cr; FY26-27 running Rs 1,26,290/mo to Aug; ledger 52). If the HO allocation is that same charge, adding Rs 5L double counts.
