# Step 73 — Joint process implementation gate (2026-10-22)

Status: SOURCE-CONTROLLED DESIGN, not deployed. Approved financial split: common 41-cycle conversion expense is 105/110 to product183 and 5/110 to product184; 60 continuation cycles only product183. Frozen run136 untouched.

## Minimal schema candidate
Three private costing relations, all keyed by an effective-dated, approved joint-process policy:
1. joint_process_policy: process_code, effective_from/to, reference_output_qty=110 kg, output_uom, allocation_method=OUTPUT_MASS, approval_reference, immutable audit identity.
2. joint_process_output: policy_id, product_id, output_qty (product183=105kg; product184=5kg).
3. joint_process_stage: policy_id, base_step_id, common_cycles=41, continuation_cycles=60, continuation_product_id=183. Four stage keys: 1389,1390,1391,1392.

Derive beneficiary shares from output quantities/reference output to avoid redundant share table and drift. Require sum output_qty = reference_output_qty, unique members/stages, effective approved route lineage, all shared stage cycles identical and no overlapping process policies. Use database foreign keys to public.products(id) and costing.production_route_family_route_step(id). Restrict exposure/grants; require immutable journal and forward-only approvals. Do not copy approved 2026-11 AU9 profiles into this new scheme.

## Workload integration
Use one shared governed helper for direct labour and overhead. With joint reference standard batch equivalents B = max(D183/105,D184/5), physical common operation workload = B * 41 * per-cycle factor, continuation = B * 60 * per-cycle factor. Beneficiary common allocation 21/22 and 1/22. Every shared stage sum of beneficiary workload equals 101 * B * factor. Preserve the AU-5 method for independent products and downstream sales allocation. Disallow double multiplication by each product's own route cycles; preserve independent RM, packing, QC and finishing.

## Not yet deployment-ready
Must implement a forward-date audited approval function and complete the exact replacement bodies for both labour and overhead workload functions; check activity197 manual cloth filtration basis and cost-pool conservation. No deployment or new run until gated verification. Existing AU9 October coordinated bridge remains separate.

## Next
Commit actual executable staged migration and regression harness after audit and code review. Maintain main handover index and document production/live status precisely.
