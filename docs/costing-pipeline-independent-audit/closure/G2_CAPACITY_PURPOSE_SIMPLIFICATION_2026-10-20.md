# G2 capacity purpose and simplification decision analysis — 20 Oct 2026

Status: read-only finding and recommendation; **not a change of approved policy**. Server implementation and G2 sign-off pending.

## Why capacity matters
Equipment working charge is an intermediate *load count* driver, not the denominator for total costs. Shared manufacturing labour/production overhead pool is allocated proportionally to product workload across eligible products. A process step with repeatable charge-dependent labour may be assigned batch input / equipment working charge loads. The cost denominator is aggregate eligible workload, not rated capacity itself. Product `production_batch_size_ref` stays authoritative; BMR references corroborate and do not replace it.

## Independently verified live fallback defaults
Read-only `costing.route_equipment_load_capacity` currently defines GRINDER 50 kg, DRYER_OR_OVEN 50 kg, MANUAL **50 kg**, MIXING_EQUIPMENT 200 kg, PROCESSING_VESSEL 500 L (or 220 kg depending on output), STORAGE_OCCUPANCY FIXED, GENERAL_AREA FIXED. Thus legacy manual 50 kg load assumption is real, not speculative. Every one of the 17 future-dated G4 fallback policies currently permits fallback. This creates the possibility of perpetuating questionable class-load multipliers even after individual capacities are collected.

## Simplification recommendation subject to approval
Use three load-driver modes, selected per governed route activity rather than assuming every activity is charge-based:
1. FIXED_PER_BATCH_OR_OCCURRENCE: one activity per true occurrence/cycle; appropriate for some inspections, transfers, passive handling and administrative operations, with explicitly validated recurrence logic.
2. PHYSICAL_CHARGE_LOADS: input quantity at that particular step (kg or L) / real equipment working charge, rounded to physical whole loads, only where processing happens in repeatable charges. Prefer named plant; fail closed or explicitly approved temporary fallback if missing.
3. PLANNING_THROUGHPUT_ONLY: kg/hour, pieces/hour and packs/minute remain scheduling/capacity planning evidence, never used as kg per charge or time-based cost under P28.
Do not conflate charge loads and repetition/standard cycles or multiply a manual step by the grinder's number of charges unless physical evidence supports it. Keep manual charge scaling only if evidence confirms an actual per-lot process.

## High risk example
Karkkidaka Kanji product695: standard 50,000 Nos and 0.5kg/kit approved; manual/grinding/drying legacy class 50kg produces 500 loads for several steps, while individual step input mass and actual physical repetitions have not been validated. Dhanyamlam product51 has cycles=8 and occurrences=8 on several steps, with ×3 class loads. Thippili product957 has five grinder steps ×16, mixer ×4. These are allocation driver plausibility checks, not source batch size errors.

## Acceptance tests prior to production change
- Freeze current approved 122/128 fingerprints; switches OFF unchanged.
- Ensure each step explicitly resolves its mode and dimensions, reason and evidence; prohibit silent fallback as if measured.
- Distinct pre/post drying stage quantities, applicable process loss and yields.
- Prove regression for 51,695,957 and all high-concentration/negative-margin products.
- Recalculate total eligible workload and confirm complete shared pool absorption without double counting, with before/after product-share diagnostics.
- Preserve P28 and approved run/supersession governance; no live switch until approved.

## Decision
G2 OPEN. Recommend **simplify route-level modes and stop requiring machinery capacities for activities where they add no valid costing information**. Evaluate necessity of each of the 74 missing records by whether any *approved charge-dependent step* actually requires it. Capacity master can remain relevant to production planning independently.
