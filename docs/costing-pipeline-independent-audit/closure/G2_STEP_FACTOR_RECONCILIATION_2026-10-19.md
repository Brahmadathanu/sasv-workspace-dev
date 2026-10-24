# G2 — Step factors, cycles and loads: read-only forensic verification
2026-10-19 IST. Source: run128 frozen `costing.product_direct_labour_step_snapshot` + `costing.route_load_scaling_snapshot`. All changes prohibited without separate approval.

## Critical results
* Provenance snapshot `costing.route_step_load_provenance_snapshot` currently has **zero rows**, because G4 plant-aware switch remains OFF. This is a coverage gap for the current run's fine-grained source explanations, not evidence that the legacy run had no routing. Existing `route_load_scaling_snapshot.step_detail` does contain resource class and selected load multipliers.
* Product51 Dhanyamlam: step40 PROCESSING_VESSEL factor38.4, occurrence8, cycles8, load3; step50 MANUAL factor64, occurrence8, cycles8, load3; step60 PROCESSING_VESSEL factor64 occurrence8 cycles8 load3. Step70 STORAGE_OCCUPANCY factor6.4 occurrence8 cycles8 loads1. Sum of raw factors174.8, scaled factor511.6. Factors embed 8×8 recurrence for several activities: verify whether *both* dimensions represent distinct real operations; if not, there is a multiplication risk. Never silently zero either.
* Product695 Karkkidaka Kanji: all 10 steps occurrence=1, cycles=1; step20 MANUAL factor1, 30 DRYER .6, 40 GRINDER 1, 50 GRINDER 1, 60 MANUAL **factor0**, 70 DRYER .6, 80 MANUAL1; zero-weight general activities. Seven class-based steps show ×500 load markers, but only **six carry a nonzero labour factor**. Raw factor=5.2; scaled=2600. Earlier phrasing seven steps contributed to labour was imprecise: seven are assigned loads, six contribute. Governing standard batch of 50,000 Nos and approved 0.5kg unit mass remain unchanged.
* Product957 Thippili Rasayanam: all step occurrences and cycles1; MANUAL step20 factor1, DRYER30 .6, five GRINDER steps40/50/60/70/75 at1 each and MIXER90 at1; ×16 at 10 step markers (some are zero-weight), mixing ×4, resulting raw7.6 and scaled109.6. Must check named machine working charges and whether sequential process stages handle the same dry/wet mass.
* Frozen totals from source: Dhanyamlam product labour ₹93,475.19; Thippili ₹69,374.49; Kanji ₹47,009.67; sum ₹209,859.35/month, with high share driven by relative workload.

## Interpretive boundary
The effect of step factor × occurrences × cycles × load is **not automatically defective**: multiple occurrence and cycle counts may be legitimate. The existing snapshot's factor includes these counts. Question is physical validation and **double-counting prevention**. Manual labour cannot automatically be treated as interchangeable with 50 kg grinder capacity.
Run 128 remains an immutable comparison reference. Neither `production_batch_size_ref` nor real recorded BMR sizes are subject to correction on this evidence.

## Read-only reproduction
```sql
select product_id,sequence_no,resource_class_code,step_labour_factor,
expected_occurrence_count,standard_cycle_count
from costing.product_direct_labour_step_snapshot
where refresh_run_id=128 and product_id in (51,695,957)
order by product_id,sequence_no;
select product_id,preferred_batch_size,solid_charge_kg,output_charge,
raw_factor,scaled_factor,step_detail
from costing.route_load_scaling_snapshot
where refresh_run_id=128 and allocation_pool='MANUFACTURING_LABOUR'
and product_id in (51,695,957);
select refresh_run_id,count(*) from costing.route_step_load_provenance_snapshot
group by refresh_run_id;
```

## Next engineering work
1. Verify actual source step-level `activity_id, plant_id`, basis and charge-source selection against family route and override for the three products.
2. Isolated resolution simulation for G4 named plant > step capacity > class fallback > fail closed; keep throughput planning-only.
3. Create tests that assert independent recurrence vs cycle semantics and no duplicate multiplicative scaling. Capture physical proof requirements by stage.
4. Maintain CI-032 HIGH; no live policy/migration action without approval.
