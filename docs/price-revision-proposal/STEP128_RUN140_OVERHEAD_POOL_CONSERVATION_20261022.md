# Step 128 — Run140 double-counting / overhead-pool conservation check (2026-10-22)

Scope: read-only Supabase live evidence; continuation of STEP127_INTERNAL_CONVERSION_SKU54_RUN140_VERIFIED_20261022.md. Approved run 140 preserved unchanged.

## Verified pool conservation (exact-run amounts in INR)
| Common pool | Frozen pool | Allocated in run 140 | Result |
| Production overhead | 670935.04 | 670935.04 across 453 distinct product allocations (grouped by product_id, max of repeated product-level allocation in SKU snapshot) | Conserved |
| QC overhead | 142241.67 | 142241.67 summed once across product_qc_allocation_snapshot recipients | Conserved |
| Materials/stores | 260508.53 | 260508.246680292663 from regular SKU monthly allocations + 0.283319707337 internal-source incremental product allocations = 260508.53 | Conserved |

Important: Never sum `sku_production_overhead_allocation_snapshot.product_production_overhead_allocation` without grouping by product: it repeats the product allocation on each related SKU. The group-by product check confirms reconciliation. QC pool is allocated once on the product snapshot then transformed to SKU amounts for cost-sheet presentation. The special internal-source stores amounts participate in the *same* frozen stores pool and are subtracted from the amount going to ordinary SKU allocations, not added as a second pool.

## SKU 54 downstream vs earlier stages
Finished SKU54 Product102: production overhead 0, reason `READY_ZERO_PRODUCTION_OVERHEAD`, explicitly excluded from production overhead pool due to approved route; finished own manufacturing and packing direct labour 0 under outsourced rule. Own QC overhead 1.8755589426408066 per pack, from Product102 QC pool share 21.256334683262477 per month / 1133.3333333333333 Nos *100; Product102 QC demand is `COMMERCIAL_DEMAND`, distinct from upstream Product277/275 QC pool shares. Own stores overhead 1.3313776139805755 per pack; monthly ordinary allocation 15.088946291779857 for 11.333333333333334 packs from same stores pool. Upstream Product277 and 275 carry own product QC and production shares, plus explicitly incremental internal-source stores shares; those are passed along only in internal conversion.

Approved SKU54 COP check: 86.22630904808767 prime + 0 production OH + 1.8755589426408066 QC + 1.3313776139805755 stores = **89.43324560470906**, equals frozen manufacturing COP.

## Conclusion and limits
**PASS: No computational duplication of frozen production, QC or materials/stores pools in run140 recipient allocations; SKU54's own production OH is zero and distinct product-level QC shares are assigned once.** This eliminates the earlier concrete double-absorption concern within the implemented governed allocation mechanisms. The source-product costs correctly flow to the finished SKU as internal conversion; intermediate RM prices use RM-standard-cost layer, not source manufacturing conversion burden. Because this is a costing allocation verification rather than transaction-level forensic audit, it does not assert that every originally booked expense was classified correctly in the underlying accounting systems. No evidence from this audit warrants changing approved run140.

## Programme gate
Stage02c technical cost-component investigation and pool-conservation check completed PASS. Next: confirm user's preferred concise costing column nomenclature as part of Stage03 master design (without inventing new heads); then inspect existing price revision views and dependency graph (Stage03a). Do not proceed to Sheets until Stage03 verified.
