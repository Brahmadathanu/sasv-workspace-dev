# G2 machine assignment forensics — 2026-10-19
Read-only direct live DB verification; no policy or data changes.

## Route sources
From frozen `costing.product_direct_labour_workload_snapshot` run128:
- product 51 Dhanyamlam: ROUTE_FAMILY_INHERITED, family_route_id144, product_route_id NULL.
- product 695 Karkkidaka Kanji: ROUTE_FAMILY_INHERITED, family_route_id154, product_route_id NULL.
- product 957 Thippili Rasayanam: PRODUCT_ROUTE approved route_id73/version2, family_route_id41; version1 superseded.

## Named machine dependencies
- Family route144 (Dhanyamlam) step20 GRINDER activity161 plant_id2 Disintegrator. `costing.v_plant_capacity_readiness`: READY_PROVISIONAL, 28.3333 **kg/h throughput** user-declared. This is expressly P28 planning only, **not a kg/charge denominator**. Before G4 use, validate how resolver handles a named throughput-only machine on a load-scaled production step; should not silently divide kg by kg/h and treat quotient as physical charges.
- Family route154 (Karkkidaka Kanji) steps30 and70 DRYER_OR_OVEN activity162 plant_id119 Firewood Dryer1, `BLOCKED_NEEDS_CAPACITY`, no working kg/charge. Other route steps (manual/grinder) have no named plant.
- Thippili Rasayanam approved route73 overrides family route41 with five ADD_STEP and five BYPASS_STEP records. Added step90 MIXING_EQUIPMENT activity170 plant_id125 Planetary Mixing Machine, `BLOCKED_NEEDS_CAPACITY`. Added grinder steps70/75 have no named plant; selected family route default machines also null.
- Do not conflate duplicate named Firewood Dryer1 machine119 vs146, nor two separate 24-tray electric dryers.

## Verified occurrences and cycles
- Dhanyamlam family route144 seq40/50/60/70/80/90 have expected_occurrence_count=8 AND standard_cycle_count=8; frozen labour factors include these recurrences. Need production validation that each dimension is independently multiplicative.
- Kanji route154 all occurrences and cycles=1; its 500-load multipliers arose from uniform 50kg class scaling, **not** multi-cycle route steps.
- Thippili family route41 all occurrences/cycles1, override added steps also1. Route73 must be resolved with its BYPASS/ADD semantics; family route alone is not the effective route.

## Engineering regression requirements
1. Distinguish physical charge (kg/load or L/load) from throughput (kg/hour, packs/minute) at SQL type/semantics boundary; require dimensionally valid conversion. For planned throughput use a separate time-and-shift planning domain; under current user P28 do not allocate costs by time.
2. G4 precedence: named machine capacity when usable and valid for activity > specific step rule > class fallback if permitted > fail-closed. Decide explicit policy for named machine with missing/throughput-only charge (not automatic fallback hiding missing data). Record which source chosen for each step.
3. Resolve product overrides before machine selection, including both bypassed and inserted steps, with deterministic trace. Test Thippili route73 vs superseded route72.
4. For machine119 and125, never create values from analogy; require actual kg/charge and approval.
5. Maintain standard `production_batch_size_ref` unchanged; physical step charges are distinct from output batch.
6. Verify the query against actual route-step assembly and the as-of valuation date, not merely today's master. Run128 frozen values remain untouched.

## Read-only queries
```sql
select product_id,route_family_id,family_route_id,product_route_id,effective_route_source
from costing.product_direct_labour_workload_snapshot
where refresh_run_id=128 and product_id in (51,695,957);
select family_route_id,sequence_no,activity_id,resource_class_code,plant_id,
 expected_occurrence_count,standard_cycle_count
from costing.production_route_family_route_step
where family_route_id in (144,154,41) order by family_route_id,sequence_no;
select operation_type,sequence_no,activity_id,plant_id,resource_class_code
from costing.product_process_route_override
where product_route_id=73 order by sequence_no;
select plant_id,plant_name,readiness,effective_capacity,physical_unit,evidence_type
from costing.v_plant_capacity_readiness where plant_id in (2,119,125);
```

Status: CI-011 and CI-032 remain HIGH OPEN; G2 NOT CLOSED, G4 OFF. No current live change authorised.
