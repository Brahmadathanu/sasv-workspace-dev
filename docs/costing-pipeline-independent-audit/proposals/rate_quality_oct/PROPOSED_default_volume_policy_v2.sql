-- PROPOSED, NOT APPLIED. Governed default-volume policy v2 for SKUs with no sales history.
-- Policy constraints: no Tally issue register; no time-based spreading; batch_size_ref is the standard reference.
-- 1. Governed new-product volume plan (hierarchy step 2b), with owner, approval and forced expiry.
create table if not exists costing.new_product_volume_plan (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id),
  sku_id bigint references public.product_skus(id),            -- null = product level, split by pack
  planned_batches_per_year numeric not null check (planned_batches_per_year>0), -- in batch_size_ref units
  owner_user_id uuid not null,
  approval_reference text not null,
  effective_from date not null,
  expires_on date not null,
  status text not null default 'APPROVED' check (status in ('APPROVED','CLOSED','CANCELLED')),
  created_at timestamptz not null default now(),
  check (expires_on > effective_from and expires_on <= effective_from + interval '12 months')
);
-- 2. Default-policy parameters (were a flat 10 packs/month per scenario).
alter table costing.sales_allocation_default_policy
  add column if not exists default_basis text default 'PACK_UNITS' check (default_basis in ('PACK_UNITS','MIN_PACK_UNITS_OR_BATCH_INTERVAL')),
  add column if not exists batch_interval_months numeric,          -- new product: at most one batch_size_ref per N months
  add column if not exists new_sku_max_share_of_product numeric,   -- new SKU of existing product: at most x of the product's actual monthly base qty
  add column if not exists pool_cap_share numeric,                 -- default-driven workload capped at x of company workload (scaled down pro rata)
  add column if not exists default_max_age_months integer;         -- SKU on default longer than this -> BLOCKED until a plan or inactivation
-- 3. Successor policies (effective 2026-11-01 unless the user wants Oct and a rerun).
-- update costing.sales_allocation_default_policy set effective_to='2026-10-31' where id in (1,2);
-- insert into costing.sales_allocation_default_policy(scenario_code,default_sales_units,default_basis,batch_interval_months,new_sku_max_share_of_product,pool_cap_share,default_max_age_months,status,effective_from,approval_reference,reason,previous_policy_id)
-- values ('NEW_PRODUCT_NO_HISTORY',10,'MIN_PACK_UNITS_OR_BATCH_INTERVAL',12,null,0.02,12,'APPROVED','2026-11-01','<USER-APPROVAL>','Default v2: min(10 packs, 1 batch/12 mo), 2% cap, 12-mo expiry',2),
--        ('NEW_SKU_EXISTING_PRODUCT',10,'MIN_PACK_UNITS_OR_BATCH_INTERVAL',null,0.10,0.02,12,'APPROVED','2026-11-01','<USER-APPROVAL>','Default v2: min(10 packs, 10% of product actual), 2% cap, 12-mo expiry',1);
-- 4. Resolver changes (migration to write after approval):
--    rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint) step 3:
--      NEW_PRODUCT: base_qty = least(10*sku_base_qty_per_unit, batch_size_ref/batch_interval_months / active_sku_count)
--      NEW_SKU:     base_qty = least(10*sku_base_qty_per_unit, new_sku_max_share_of_product * product actual monthly base qty)
--      step 2b (new_product_volume_plan, expiry-checked) sits between the manual assumption and the default.
--    POH/DL insert-path writers: if sum(default-driven workload) > pool_cap_share * company workload, scale those workloads pro rata.
--      The full pool stays allocated, so variance is still 0.
