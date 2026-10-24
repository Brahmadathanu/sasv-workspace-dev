# G2 — Preferred batch size provenance versus actual BMR
Date: 2026-10-19 IST | READ ONLY | No live policy/run/write changes.

## Direct verification
`costing.route_load_scaling_snapshot` run 128 names its `charge_source`:
- product 51 Dhanyamlam: 1155 L, BATCH_SIZE_REF_AND_RM_BOM
- product 957 Thippili Rasayanam: 770 kg, BATCH_SIZE_REF_AND_RM_BOM
- product 695 Karkkidaka Kanji: 50000 Nos, UNIT_MASS_OVERRIDE, approved reference AU6-V2 (500 g/kit).

`public.production_batch_size_ref` currently records:
- 51: preferred/min/max 1155 L, effective 2000-01-01
- 957: preferred/min/max 770 kg, effective 2025-10-24
- 695: preferred/max 50000 Nos, min 30000 Nos, effective 2025-10-24.

`public.bmr_details` directly corroborates:
- product 51: 8 BMRs, every batch 1155 L, including bn 0149 created 2026-10-01.
- product 957: 39 BMRs, min 385 kg max 770 kg, including bn 5348 recorded 2026-10-01 at 770 kg.
- product 695: 3 BMRs — SP718 50000 Nos (recorded 2025-07-05); SP838 40000 Nos (recorded 2026-05-20); SP839 20000 Nos (recorded 2026-05-26). Recorded timestamps are BMR record creation, not independently validated production execution dates.

## Correction to earlier G2 concern
**Do not assume Kanji's preferred 50000 Nos was invented or a mistaken forecast quantity.** It is documented as a real BMR batch size and matches the production batch master. The 0.5 kg per kit unit mass also has its own approved source. However BMR quantity cannot justify individual route-step loads of 500 for drying, manual handling or grinding. Test production-operation segmentation and charge basis separately.

## Residual G2 blocker
Route step loads are from recorded factors applied against equipment class capacity assumptions, not independently verified actual operating charges. For product695, 500 loads at 50 kg across seven steps; product51 six ×3 steps; product957 ten ×16 steps and mixer ×4. Require distinct activity-level capacities, physical stage input mass/volume and suitable production evidence. Preserve approved run128; proposed later rule must be governed and effective dated.

## Reproducible SQL
```sql
select product_id,preferred_batch_size,charge_source,approval_reference
from costing.route_load_scaling_snapshot
where refresh_run_id=128 and allocation_pool='MANUFACTURING_LABOUR'
and product_id in (51,695,957);
select product_id,preferred_batch_size,min_batch_size,max_batch_size,effective_from,effective_to,is_active
from public.production_batch_size_ref where product_id in (51,695,957);
select product_id,uom,count(*) batches,min(batch_size),max(batch_size)
from public.bmr_details where product_id in (51,695,957) group by product_id,uom;
select product_id,bn,batch_size,uom,created_at from public.bmr_details
where product_id in (51,695,957) order by product_id,created_at desc;
```
G2 remains OPEN (CI-032 physical workload appropriateness, CI-011 capacities). Do not modify master batch sizes merely to improve calculated cost.
