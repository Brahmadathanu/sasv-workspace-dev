# G0 Step 79 — Direct integration points and acceptance contract
Date 2026-10-22. This is a source-controlled implementation handoff, NOT live deployment.

## Exact previously verified function entry points
1. costing.fn_preview_direct_labour_shadow_workload: constructs product route intensity from scope * attendance * expected occurrence * standard cycles. This function provides the base preview.
2. costing.rpc_refresh_sku_direct_labour_component_split_snapshot: calls preview, then applies AU-5 batch-true override: intensity * monthly product base quantity / preferred_batch_size for manufacturing labour.
3. costing.rpc_refresh_production_overhead_workload_snapshot: uses shared route foundation, step intensity, optional AU-6L/AU9 load resolution, then AU-5 unrounded batch equivalents * route_factor.
4. costing.fn_preview_shared_standard_batch_route_foundation: provides commercial plus internal monthly driver and standard batch reference.

## Minimal integration
Implement one independently tested joint-process workload projector consumed by BOTH labour and overhead, conditioned on approved, date-effective joint_process_policy. Do not replace the general AU-5 calculation for nonjoint products. For joint product members, calculate physical batch-equivalent B=max(D101/105,D41/5), each shared step stage-specific intensity (including accurate equipment/attendance basis), common 41*B once, continuation 60*B only 101, then common allocation to outputs 21/22 and1/22. Preserve separate independent stages, packing labour, QA and BOM. DO NOT multiply beneficiary output workload by its independent monthly driver again. Downstream product/SKU sales apportionment remains existing policy and should not turn surplus co-output into sales.

## Implementation changes required
- Harden STEP77 schema into deployable migration: forward-only configuration registration, no-overlap, guarded child write permissions, change journal, complete atomic approval and validation. STEP78 helper is a nondeployed cycle projector and must use a date-effective approved policy resolver.
- Add the joint projector at manufacturing workload construction, with an explicit source/trace field for common vs continuation and source policy ID; avoid editing frozen snapshot rows.
- Apply projected manufacturing workloads in both component split labour and POH refresh; ensure historic legacy refresh path and nonjoint path unchanged.
- Manual oil cloth filtration step1391 activity197 must not inherit unjustified 50kg solid-charge load multiplier; hydraulic recollection step1392 remains machine-assisted.
- AU9 prospective October switch and class/policy bridges must pass dated preflight before new run.

## Verification required
- Historical run136 and 2026-10-20 valuations immutable.
- Route 1389–1392: two effective members, 41+60=101 unique stage cycles; approved 21/22+1/22=1 common share.
- Joint monthly demand proxy: run136 quantities 9.8007kg and0.091kg, B=0.09334, not sum of independent batch equivalents.
- Both labour and POH product workload allocations and exact company pool totals reconcile; absorption variance remains explainable.
- Independent RM/BOM and final/packing/QC never double shifted.
- Broken beneficiary, unapproved policy, missing stage, wrong equipment class, or invalid provisional capacity fail closed.

## Current status and next task
Supabase SQL inspection retry was tool-blocked this turn, but the exact entry points above were independently verified in Steps60,63,64. No live change. Next author actual function replacement migration with full current bodies and test harness; do not call a review doc an implemented fix. Keep work in this project folder, G0 OPEN.
