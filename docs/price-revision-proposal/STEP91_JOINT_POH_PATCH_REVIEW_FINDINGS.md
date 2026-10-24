# Step 91 — POH joint integration audit (2026-10-22)
Status: **HOLD on Step90 SQL deployment**. Read-only live verification.

## Verified
Active joint policy ID1 effective 2026-10-23, 2 members and 4 stages. Frozen run136 POH factors per cycle 1.0 for both products at all stages. Resource classes shared by both members by stage: 1389 EXTRACTION_SYSTEM, 1390 PROCESSING_VESSEL, 1391 MANUAL, 1392 FILTRATION_SYSTEM.

## Specific flaw requiring correction before deployment
Step90 projection computes `per_cycle_factor` independently per product using `fn_au9_g4_route_step_loads` and each product-specific `tmp_po_charge`. Those two capacities may differ despite a **single physical joint batch**. Then the allocated sum can differ from 101 cycles times the **actual shared-stage load**, violating company pool and physical stage conservation. The common/continuing workload must have **one validated physical-stage factor per joint manufacturing stage**, derived from the joint manufacturing reference and equipment allocation, not two product-specific proxy capacities. Also Step90 `operations` needs explicit eligible/policy member completeness, positive batch references, controlled response to no matching stage, and no default-volume cap double manipulation. Current 'found_steps=4' check alone is insufficient.

## Release gate
1. Resolve one physical joint-batch load driver per shared stage for prospective AU9. Specifically MANUAL stage1391 oil cloth filtration must not inherit arbitrary solid-charge 50kg convention. Keep machine recollection stage1392 separate.
2. Prove stage-level factor same for all beneficiary outputs; if not, block instead of inventing a blended factor.
3. Compute `B=max(member monthly_qty/member_reference_output_qty)` and shared step monetary driver with stage-factor applied **once**. Output-weight allocation of 41 common, continuation60 entirely183. Nonjoint and independently attributable route stages unaffected.
4. Build exact function replacement patch from full Step88 baseline, run staged labour/POH and pool equality tests, then deploy forward-only.
5. Existing run136 remains immutable.

No refresh functions were altered in Step91.
