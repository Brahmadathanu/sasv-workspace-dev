# G2 frozen route-step forensics — independently queried
Date: 2026-10-19 IST. Read-only on run128; no live mutation or approved-run change.
Sources: costing.product_direct_labour_workload_snapshot, costing.route_load_scaling_snapshot, costing.route_batch_charge_unit_mass; exact SQL in this report.

## Frozen comparisons
| Product ID | Name | base UOM | Monthly qty | Standard batch count | Recorded preferred batch | Solid charge | Raw labour route factor | Scaled factor | Manufacturing labour/month |
|51|Dhanyamlam|L|1154|1|1155 L|122.9375 kg|174.8|511.6|₹93,475.19|
|957|Thippili Rasayanam|Kg|2665.25|4|770 kg|770 kg|7.6|109.6|₹69,374.49|
|695|Karkkidaka Kanji|Nos|4943.5833|1|50000 Nos|25000 kg|5.2|2600|₹47,009.67|

## Actual route load multipliers
- Dhanyamlam: seq 10 MANUAL,20 GRINDER,30/40/60 PROCESSING_VESSEL,50 MANUAL each ×3; 70 STORAGE_OCCUPANCY,80/90 GENERAL_AREA ×1. Check handling of solid charge (122.9375 kg) vs output liquid (1155 L), physical vessel working charge and stage repetitions.
- Thippili Rasayanam: MANUAL 10/20/65/80 and GRINDER 40/50/60/70/75, DRYER 30 each ×16; MIXER 90 ×4; GENERAL_AREA 120/130 ×1. Check grinder, dryer and mixer named capacities and whether repeated operation weights represent separate physically necessary lots.
- Karkkidaka Kanji: MANUAL 20/60/80, DRYER 30/70, GRINDER 40/50 each ×500; GENERAL_AREA 10/90/100 ×1. The ×500 is from a 25,000 kg solid charge divided by a 50 kg class load assumption (not verified physical lot). Unit mass `costing.route_batch_charge_unit_mass` product695 = 0.500 kg/kit effective 2026-10-01 with user approval `USER-APPROVAL-20261018-AU6-V2`, source note `1 kit = 500 g; BOM 2686 per gram`. Therefore unit mass itself is legitimate; the 50,000-Nos preferred batch as one physical processing lot and homogeneous scaling of seven steps are NOT validated by this fact.
- For three products, run128 manufacturing allocations total approx ₹209,859/month. This is driven by route intensity plus monthly volume and pool normalization; DO NOT treat all as overcharges automatically, as allocations are relative.

## High-risk hypothesis requiring physical evidence
The Karkkidaka Kanji 50,000-Nos batch implies 25,000 kg raw/output mass, which is suspiciously high for one manufacturing batch. It may represent a planning/forecast/minimum batch quantity rather than one actual physical factory campaign, or could be a deliberate standard lot. Verify *source provenance of preferred_batch_size*, BMRs, feasible dryer/grinder charges, multi-stage line process and true minimum manufacturing batch. **Do not alter the stored run 128 or change the approved 0.5 kg per-kit conversion.**

## Read-only SQL reproduction
```sql
select product_id,product_name,product_base_uom,monthly_product_base_qty,
 standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
 product_workload_share,product_direct_labour_allocation
from costing.product_direct_labour_workload_snapshot
where refresh_run_id=128 and product_id in (51,957,695);
select product_id,preferred_batch_size,solid_charge_kg,output_charge,output_charge_uom,
 raw_factor,scaled_factor,step_detail
from costing.route_load_scaling_snapshot
where refresh_run_id=128 and allocation_pool='MANUFACTURING_LABOUR' and product_id in (51,957,695);
select * from costing.route_batch_charge_unit_mass where product_id=695;
```

## Status and next gate
CI-032 remains HIGH OPEN. Trace the authoritative minimum batch provenance and cross-check against actual BMR / daily work log before proposing a revised unit or route driver. G2 remains OPEN. Do not enable G4 until machine-specific lot values and production-validation checks are resolved.
