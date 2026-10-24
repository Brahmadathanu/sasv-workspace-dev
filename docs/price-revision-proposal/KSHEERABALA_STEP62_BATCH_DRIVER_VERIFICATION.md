# G0 Step 62 — monthly production denominator verification (read-only)

2026-10-22, authoritative costing run136 preserved.

Verified live costing.fn_preview_shared_standard_batch_route_foundation derives `raw_batch_requirement = monthly_product_base_qty/preferred_batch_size` and `standard_batch_count = ceil(monthly_product_base_qty/preferred_batch_size)` when both >0; each product uses independent driver. Direct labour preview independently has product-level `standard_batch_count * direct_labour_route_intensity` formula. BUT final historical snapshots can have additional scaling; do not conflate preview with recorded final expense workload.

Read-only costing.product_direct_labour_workload_snapshot run136:
- product183 101 Avarthi: monthly_product_base_qty 9.800700, standard_batch_count 1, direct_labour_route_intensity 580.7, final direct_labour_workload_units 54.202538.
- product184 41 Avarthi: monthly_product_base_qty 0.09100, standard_batch_count 1, direct_labour_route_intensity 152.7, final direct_labour_workload_units 2.779140.

The outputs are co-products of one 110kg standard joint process per operational model; independently ceiling to one production batch each is physically misleading and can distort allocations. Recorded final workload != simple batch_count * preview route intensity; trace exact later scaling before modifying costs, and avoid conflating different functions/policies.

Need upstream *joint production batch count* derived from governed process and compatible output requirements (5kg 41 /105kg 101 per run), with independent SKU sales attribution downstream and no false extra 41 production run. Reconcile co-product quantity planning with forecast demand and inventory/yield treatment; if insufficient co-product demand, not legitimate to arbitrarily write off or ignore its output. Preserve physical stages, source BOM and separate final finishing/QC/PM.

Next: inspect exact per-step snapshot scaling/eligible denominator derivation; define narrowly scoped general joint process scheme and approval tests, then implement fresh governed revision. AU9 October staging remains design only. No DB write. G0 open.
