# MC07 — extreme SKU shadow sensitivity from live standard-batch evidence (15 Oct 2026)
Read-only live source queries (not migrated runtime tests), frozen run119 untouched. Rates here are historical-first-transfer **unapproved sensitivities**: labour 729.5548/workload, fixed OH 342.7151/OH workload, variable OH 620.3135/OH workload. Cost per pack = workload per preferred batch × illustrative rate × governed base_quantity_per_pack / expected net batch output.

| Evidence | SKU 193 Ksheerabala 41 Avarthi 10 mL | SKU 988 Thampira Chendooram 5 g |
| --- | ---: | ---: |
| product ID | 184 | 783 |
| standard batch labour units | 152.7 | 111.1 |
| standard batch OH units | 169.25 | 69 |
| expected net batch output | 4.95 Kg | 48.5 Kg |
| governed pack base equivalent | 0.00910 Kg | 0.005 Kg |
| equivalent pack count | 543.956 | 9700 |
| run119 labour + OH per pack | ₹5156.70755 | ₹4546.34679 |
| indicative labour per pack | ₹204.80151 | ₹8.35603 |
| indicative fixed OH per pack | ₹106.63459 | ₹2.43787 |
| indicative variable OH per pack | ₹193.00835 | ₹4.41254 |
| illustrative combined conversion per pack | **₹504.44445** | **₹15.20644** |

Source status: `fn_preview_standard_batch_workload(119)` foundation STANDARD_BATCH_REFERENCE_READY both; `fn_preview_standard_batch_net_output(119)` READY_EXPECTED_NET_OUTPUT both; `fn_resolve_standard_sku_base_quantity(193/988)` conversion READY both. Historical run119 material/pk/QC and downstream OH/administration costs **remain separate**; these are not complete COPs and no pricing recommendation is valid. The sensitivity rates must not be approved from this arithmetic alone; budget normalisation, genuine completed-manufacturing workload and cost conservation remain unverified. Critically the resulting contrast means Ksheerabala still merits high-workload/small-batch review, whereas Thampira has large output and old per-pack labour/OH is out of scale. Require isolated runtime shadow parity and later certified cost-consumer test before cutover. No automatic Google Sheet write or client refresh.
