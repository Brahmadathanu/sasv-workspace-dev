# G2/G4 resolver code audit — 2026-10-20 IST
Status: READ-ONLY INVESTIGATION, **G2 OPEN, NO LIVE CHANGE**.

## Live functions inspected
- `costing.fn_au9_g4_resolve_step_load(text,numeric,numeric,text,date,bigint,bigint,integer)`
- `costing.fn_au9_g4_route_step_loads(...)` (returns legacy loads while `fn_au9_g4_load_mode` OFF).
Functions read via `pg_get_functiondef`; not inferred from client code.

## Verified executable behaviour
1. Hard-coded gate: resolver rejects `valuation_date < DATE '2026-11-01'` even if later policy dates are authorised. This conflicts with the user's desired prospectively effective current-month valuation. **Do not remove date guard alone:** effective-dated machine profiles and step rules still start 1 Nov; activation requires fully governed, independently tested coherent prospective dates and separate approval.
2. Machine link comes from product override first (`coalesce(o.plant_id,b.plant_id)`), then base family step. Rejects missing lineage/activity mismatches.
3. If named machine `capacity_mode = THROUGHPUT`, selects `THROUGHPUT_MACHINE_T1_CLASS_LOT` and a class fallback; does NOT divide solid kilograms by kg/hour. This honours P28's planning-only separation but may mask an unavailable physical charge value and must carry transparent review evidence.
4. Named machine with CHARGE + nonnull effective_capacity uses `EXPLICIT_MACHINE`. Other named machines can fall through via `LINKED_MACHINE_CAPACITY_PENDING`, step rule or class fallback if permitted. Need business-policy choice between *hard blocker* for named machine requiring capacity vs explicit flagged temporary fallback. Never represent class fallback as actual measured machine capacity.
5. Step-rule equipment-class candidate is required to have one homogeneous effective capacity/charge basis/unit across operational matching machinery; heterogeneous candidates raise exception requesting named machine. This is deliberate ambiguity fail-closed.
6. For named/step capacity `SOLID_CHARGE_KG`, resolver uses **product-level** `p_solid_kg`. For `OUTPUT_VOLUME_L`, uses **product-level batch output** `p_output_qty`, requires UOM 'L'. These are not stage-specific quantities and may be materially wrong for stages before/after pressing, drying, filtering, concentration, etc. This is the principal physical workload data-model gap (CI-032): add governed step-specific charge source or physically validated transformation, with deterministic fallback/unsupported case; protect standard batch_size_ref.
7. Fallback lookup is effective dated and checks permitted source and pinned legacy capacity. A `NO_CAPACITY_ROW_SINGLE_LOAD` explicitly resolves one load; requires proof that fixed per-batch logic applies to each selected activity.
8. Code uses `v_link := v_link || '_NOT_USABLE'`; when v_link IS NULL, result remains NULL (minor lost provenance trace). Use `coalesce(v_link,'NO_MACHINE_LINK') || '_NOT_USABLE'` if semantic tests approve.
9. `v_loads := greatest(1,ceil(v_qty/v_cap))` in charge branch: validation of strictly positive capacities and non-null/positive stage quantities should be demonstrated independently; no assumption that stored values are always sensible.
10. `fn_au9_g4_route_step_loads` calls legacy `costing.fn_route_step_loads` when switch OFF, explaining why approved run128 remains unaffected.

## Mandatory regression scenarios (isolated, not live)
- Named disintegrator machine2 declared 28.3333 kg/hour: never divide kg by kg/h; flag planning-throughput fallback.
- Named machine119 dryer and125 mixer missing kg/charge: flag or fail closed explicitly, never hide unknowns.
- Thippili product route73 with bypass+add precedence, named mixer125; reject route72 superseded.
- Kanji batch50000 Nos and unit mass0.5kg/kit: preserve valid standard batch, test distinct processing stage masses.
- Dhanyamlam occurrence=8, cycle=8, load=3: test multiplication exactly once, avoid duplicating 8x8.
- Fully populated named machine, mismatched resource class, unavailable plant, ambiguous class rule, missing fallback, zero/negative/NULL capacity, incompatible kg/L/throughput units, absent activity/step lineage, effective-date edges.
- Compare G4-OFF byte-for-byte against frozen run128; new active model only for explicitly authorised successor valuation.

## Decision status
No production correction proposed for activation yet; request policy decision about named capacity missing/fallback only after examining actual operational consequences. Prepare a staged migration with tests and diff, but do not deploy. G2 remains open; G4 switch OFF. No pricing or Sheets.
