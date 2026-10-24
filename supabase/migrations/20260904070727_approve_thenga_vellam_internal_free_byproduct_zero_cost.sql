-- backfilled from live schema_migrations on 2026-10-24, CI-016
insert into costing.material_zero_cost_rule (
  stock_item_id, classification_code, effective_from, effective_to, status,
  reason, approval_reference, approved_by, approved_at, created_by
)
select
  si.id,
  'INTERNAL_FREE_BYPRODUCT',
  date '2026-09-04',
  null,
  'APPROVED',
  'Thenga Vellam (F) is coconut water received without purchase cost as an internal by-product from Ashram kitchen coconut opening; governed material acquisition cost is zero.',
  'GATE6C-MATERIAL-ZERO-COST-2026-09-04',
  'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid,
  now(),
  'dff17104-c02a-4bca-95b1-e8ddff46a9b6'::uuid
from public.inv_stock_item si
where si.name='Thenga Vellam (F)'
  and not exists (
    select 1 from costing.material_zero_cost_rule z
    where z.stock_item_id=si.id
      and z.status='APPROVED'
      and z.effective_from<=date '2026-09-04'
      and (z.effective_to is null or z.effective_to>=date '2026-09-04')
  );