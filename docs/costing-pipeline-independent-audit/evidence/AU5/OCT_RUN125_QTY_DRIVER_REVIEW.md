# Run 125: 117 monthly-quantity review SKUs (read-only, 2026-10-17)
## Why 117 vs 5
- This is not AU-5. The status rule (monthly_driver_status REVIEW -> REVIEW_REQUIRED_MONTHLY_DRIVER) is unchanged in the insert path.
- This is not the Oct volume window. Lookback is Oct 2025 to Sep 2026; the latest source month is 2026-09. No partial-October data is used. Driver evidence for 62 of 64 default SKUs is identical to Sep.
- The cause is that quantity-driver acceptances are period-scoped. Sep had 70 ACTIVE in sales_allocation_quantity_driver_acceptance (from run 105, 15 Sep); Oct has 0. This is the same pattern as the material acceptances.
- Status is product-level, so 65 default SKUs (66 products) flag 117 SKUs. Product 275 Mahanarayana (Internal) inherits the flag from internal demand.
- Sep's 5 were the products whose acceptance fingerprint had changed (for example Mehasamani).
## Groups (POH+DL, Rs/month; QC excluded)
| grp | products/SKUs flagged | default SKUs | default-driven Rs/mo | handling |
|---|---|---|---|---|
| (a) genuine slow movers | 0 | 0 | 0 | none; actual-data SKUs are READY (ACTUAL_MONTHLY_MAX) |
| (b1) new SKU of existing product, low share | 21/56 | 21 | 430 | accept default |
| (b2) new product, no history, small | 25/25 | 25 | 11,168 | accept default |
| (c1) batch ref = 1-2 kg (one pack) | 7/7 | 7 | 94,327 | confirm batch size |
| (c2) Abhraka Bhasmam: 10 kg/mo default, route factor 203 | 1/1 | 1 | 26,699 | confirm expected volume |
| (c3) bulk 5000 mL/1000 g new-SKU default dominates product | 11/27 | 11 | 12,924 | confirm volume or accept |
| inherited (275) | 1/1 | 0 | 0 | clears with the others |
| total | 66/117 | 65 | 145,548 of 1,377,138 pool (10.6%) | |
c1: 1206 Karingali 25.8k; 1159 Thippili, 1127 Naruneendi, 1083 Chukku 16.6k each; 1253 Ramacham 12.4k; 1340, 468 kvatha 3.2k each. Each is 10 batches/month at default 10 units.
c3: 210 Eladi Enna (85% default) 4.0k; 772 Linga Chendooram (98%) 1.9k; 300, 323 1.3k; 196, 233 1.1k.
All 19 suspect SKUs were accepted in Sep with the same evidence, so approved Sep run 122 carries the same allocation.
## Proposal
P1 (PROPOSED_qty_driver_accept46_run125.sql): accept 46 low-impact SKUs. Status only; costs unchanged.
P2: user rules on the 19 suspect SKUs. Options: accept as Sep; correct the batch size or set a governed volume assumption (cost change); or mark inactive if not sold.
Rerun: needed only to clear the flags or to apply P2 corrections. Under the acceptance rule (check 4: review rows non-blocking), run 125 is approvable as-is.
