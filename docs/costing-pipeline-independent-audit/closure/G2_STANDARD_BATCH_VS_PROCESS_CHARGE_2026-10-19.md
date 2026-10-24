# G2 authoritative clarification — standard batch versus process charge
Date 2026-10-19 IST | User correction; read-only architecture audit.

## Binding user clarification
**public.production_batch_size_ref is the authoritative, already enforced standard manufacturing batch reference for each product.** Do not reinterpret, remove, bypass, rederive from monthly sales, or replace it merely to reduce a costing charge. Its use by the engine is correct and is not itself a G2 defect. Existing BMR evidence corroborates selected values; BMR and standard batch data are separate concepts.

## Distinct physical objects
1. **Standard manufacturing batch**: product-level production output standard selected from production_batch_size_ref; governs production batch-based cost calculation and batch-count denominator.
2. **Step input charge**: material mass or process liquid volume entering an individual manufacturing activity; can be before/after extraction, filtration, drying, concentration, grinding, etc. May differ from finished batch output.
3. **Equipment working charge**: effective physically usable machine-specific batch capacity, or governed activity/class fallback where permitted.
4. **Number of loads per step**: step-specific input charge / effective capacity with suitable integer rounding, conditional on whether the step actually repeats per charge.
5. **Occurrence/cycle intensity**: repeat count from route/BMR standard. It must not be conflated with equipment load count or multiplied twice.

## Verified existing run128 facts and outstanding tests
- Dhanyamlam product51: standard batch 1155 L (8 BMRs consistent); charge snapshot lists 122.9375 kg solid material and 1155 L output. Loads x3 at MANUAL, GRINDER, processing-vessel steps. Step-specific feed/output basis must be checked; never use 1155 L output as grinder charge.
- Thippili Rasayanam product957: standard batch 770 kg (39 BMRs span 385–770). x16 at manual, grinder and dryer operations, x4 at mixer. Validate capacities, charge per step and whether the route actually uses the machines indicated.
- Karkkidaka Kanji product695: standard batch 50,000 Nos (historical SP718 corroborates), approved unit mass 0.5 kg per kit. Conversion yields 25,000 kg batch-equivalent material mass. Legacy class 50kg produces x500 for seven different activity types. **This does not independently prove 500 physical equipment loads for every distinct activity.** Investigate wet/dry-stage input quantity, process yield, charge unit and per-step class mapping. Do NOT change batch_size_ref or the approved kit mass on this evidence.
- Current frozen route-load evidence `costing.route_load_scaling_snapshot` and step snapshots are the authoritative diagnostic references. No October run128 write.
- Product route step master `costing.production_route_family_route_step` includes `plant_id`, `resource_class_code`, `expected_occurrence_count`, `standard_cycle_count`, scope fields. A G2 audit must check source step factors vs scaled factors, loads, expected occurrences, selected machine and capacity profile, provenance, and duplication.
- A detailed query to `costing.product_direct_labour_step_snapshot` was blocked by tool execution safety controls in this session; cannot independently claim step-weight validation. Continue via approved repository evidence/test SQL; log any inaccessible evidence as NOT VERIFIED.

## Explicit design invariant and regression tests
- Batch reference is chosen once from governed effective-dated source. Demonstrate equality to frozen standard_batch_count / manufacturing output for representative products.
- Test step-specific input charge against actual route/BMR input and unit; prohibit using finished output mass across all process stages unless genuinely appropriate.
- Confirm `load_count = ceil(step_charge / effective_working_capacity)` for discrete-load steps and separate throughput-only planning equipment.
- Test multiplicative dimensions once each: step factor × occurrence × cycle × physically valid loads, avoiding duplicate scaling and preserving fixed per-batch operations.
- Distinguish manual handling (labour activity) from machinery capacity; manual work may require operation-specific standard drivers instead of automatic 50kg batch loads.
- For every major labour concentration, generate comparison `raw route factor / scaled factor / step provenance / cost delta / source proof` without modifying frozen data.
- Check G4 named machine > step rule > class fallback > fail closed. Missing 15 priority machine values remain unresolved.
- Capture golden test products 51,957,695 and residual negative-margin SKU42; no policy activation until verified.

## Status
CI-032 HIGH still OPEN: physical driver validation, not batch_size_ref correction. This document supersedes any phrasing in earlier G2 reports that suggested the standard batch reference should be corrected on the current evidence.
