# G2 minimum manufacturing operation-driver contract — analysis checkpoint
Date: 2026-10-20. Status: **PROPOSED / NOT APPROVED / NOT DEPLOYED**.

## Evidence basis
Read directly from repository on `costing/au4-normal-budget`:
- `G2_STEP_FACTOR_RECONCILIATION_2026-10-19.md`
- `G2_MACHINE_ASSIGNMENT_FORENSICS_2026-10-19.md`
- `G2_G4_RESOLVER_CODE_AUDIT_2026-10-20.md`
- `evidence/G2/G2_FULL_COHORT_SENSITIVITY_PHASE3_2026-10-20.md`
- `evidence/G2/G2_ZERO_WORKLOAD_EXCEPTION_VERIFICATION_2026-10-20.md`

Live detailed step queries attempted this checkpoint were blocked by connector safety controls. Consequently the named step facts in this document are previously verified evidence, not new live execution. **No new numerical physical charge, capacity or cost has been fabricated.**

## Smallest workable accounting contract to investigate
1. Resolve an effective governed product route first, preserving family inheritance and approved ADD/BYPASS overrides.
2. Source the manufacturing standard batch from `public.production_batch_size_ref` as of valuation. Do not reinterpret its batch output as every stage input.
3. Count only eligible activities under the applicable DL and POH scope/behaviour factor policies. Recognise a legitimate ZERO_SCOPE separately from missing route, unknown driver and invalid denominator.
4. A fixed operation can carry its independently verified step occurrence/cycle count. **Occurrences and cycles are separate physical concepts**; the same repetition cannot be represented in both.
5. A charge-dependent operation requires a supported physical stage quantity with compatible unit and verified charge size. Its charge multiplier is `ceil(stage_quantity / charge_size)`. Do not obtain stage quantity by blindly substituting final batch output, particularly after drying, pressing, filtering or concentration.
6. Where step-level stage mass is not justified, block that charge-based driver pending evidence or seek a simpler separately substantiated fixed-step count. Do not silently revert to an arbitrary class lot.
7. Recorded machine throughput (kg/hour, Nos/hour) remains planning-only and does not create financial charge multipliers.
8. Product workload numerator is `approved_batch_equivalents × sum(governed_eligible_step_workloads)` subject to the already governed demand/cap policy; allocation denominator is the sum across all eligible products. Scope differences between labour and POH remain explicit. Exact frozen expense pools conserve, and historical run snapshots are immutable.

These are **necessary properties**, not a request for a new comprehensive machinery-capacity subsystem. Prefer reusing effective routes and scoped factors. No additional policy/fallback table is justified on the evidence yet.

## Physically unresolved high-impact cases

| Product | Verified route evidence | Critical unresolved physical question | Unsafe shortcut |
|---|---|---|---|
| 51 Dhanyamlam | Family route 144; step 40/50/60 occurrence8, cycle8, charge3; step70 occurrence8/cycle8 fixed load1; machine2 is 28.3333 kg/h throughput | Are 8 occurrences and 8 cycles genuinely different repetitions, and do three loads occur separately in those steps? | 8×8×3 without operation record; kg/h as kg/charge |
| 695 Karkkidaka Kanji | Family route154; all occurrence/cycle1; 7 class-load markers ×500, 6 nonzero DL; firewood dryer119 missing working charge | Do 50,000 kits represent same actual charge mass at every grinder/manual/dryer stage, or do some activities happen once/at different materials? | 500 repeated charges across heterogeneous manual and equipment operations |
| 957 Thippili Rasayanam | Approved product route73 (5 ADD, 5 BYPASS); occurrences/cycles1; 10 ×16 markers (including zero-weight), mixer ×4; machine125 missing charge | Which dry/wet mass is processed at each successive grinding/drying step; how many actual mixer charges? | Uniform 16 charges for distinct stages; invented mixer size |

## Recommended minimisation gate
- **Retain** standard batch, effective approved routes, actual distinct occurrences/cycles, scope policies, frozen run evidence.
- **Evaluate**, not assume, physical charges on materially repeated equipment operations.
- **Keep planning equipment profiles as data** even if no longer required for financial costing.
- **Retire only after cutover proof:** legacy and G4 executable selectors/wrappers, fallback policy tables and switches *if no remaining financial or planning consumers*. No object scheduled for deletion yet. Preserve provenance and audit history.
- **No broad material-by-stage ledger** unless quantity uncertainty materially alters allocations and cannot be resolved with bounded approved process-step charge sources.

## Acceptance gates not yet discharged
Reproduce full 453-product DL and POH cases in isolated fixture; verify each included step's multiplication semantics; handle eight legitimate zero-scope products without treating them as missing; re-evaluate one review-required monthly driver; audit complete DB/trigger/ACL/cron/ETL/client dependency graph; rerun demand-cap function and demonstrate pool conservation and immutable snapshot regression. Obtain consolidated explicit approval before any deployment, retirement, switch or new run.

G2 OPEN, CI-032 HIGH OPEN; G4 plant-aware OFF; runs 122/128 unchanged.
