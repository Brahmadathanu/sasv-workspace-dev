import hashlib
sch=open('out/dvs1_schema.sql').read(); fn=open('out/dvs1_fn.sql').read(); rpc=open('out/patched_rpc.sql').read()
labels=['MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK','MAX_POSITIVE_COMPANY_WIDE_NET_SKU_MONTH_IN_12M_LOOKBACK','SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH','GOVERNED_SKU_ASSUMPTION','GOVERNED_NEW_PRODUCT_PLAN','GOVERNED_SCENARIO_DEFAULT','UNRESOLVED',
 'DVS1_OVERRIDE','DVS1_LAUNCH_AVERAGE_SINCE_FIRST_SALE','DVS1_IN_STOCK_MONTH_AVERAGE','DVS1_MAX_MONTH_EXCLUDING_CONFIRMED_EVENTS','DVS1_DEMAND_SEASONAL_12M_AVERAGE']
arr=", ".join(f"'{l}'::text" for l in labels)
out=f"""-- PREPARED_DVS1_demand_volume_selection.sql
-- PREPARED ONLY. NOT APPLIED. Apply only after explicit user approval, via Supabase MCP apply_migration (name dvs1_demand_volume_selection).
-- Effect at install: NONE on costs. Policy v1 is seeded as DRAFT, which keeps DVS-1 OFF; the refresh RPC then runs the
-- unchanged SALES-01 logic (proved byte-identical to the live RPC on the run-128 replay in the isolated test bed).
-- Activation (later, separate approval): update costing.demand_volume_selection_policy set status='APPROVED',
--   effective_from='<first period, >= 2026-11-01>', approval_reference='<ref>' where policy_code='DVS-1' and version=1;
-- Changes: 5 new tables (empty except the DRAFT policy + Kanji seed), 1 new function, the refresh RPC replaced
-- (patched from the live definition md5 09c3d22c6154d8eacf099ada57f60007), and the monthly_driver_method CHECK widened
-- with 5 DVS1_* labels (no existing row changes; the basis snapshot gets no new columns, so approved run hashes are unaffected).
-- Not attached: the WP04 readiness-epoch trigger on the new lineage table (not registered as a readiness source).

-- PRE-GUARDS
do $$ begin
  if md5(pg_get_functiondef('costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint)'::regprocedure)) <> '09c3d22c6154d8eacf099ada57f60007'
    then raise exception 'DVS1 GUARD: live refresh RPC differs from the tested definition'; end if;
  if to_regclass('costing.demand_volume_selection_policy') is not null then raise exception 'DVS1 GUARD: already installed'; end if;
  if not exists (select 1 from public.product_skus where id = 878) then raise exception 'DVS1 GUARD: SKU 878 missing'; end if;
end $$;

{sch}
{fn}
alter table costing.sku_sales_allocation_basis_snapshot drop constraint sku_sales_allocation_basis_monthly_method_chk;
alter table costing.sku_sales_allocation_basis_snapshot add constraint sku_sales_allocation_basis_monthly_method_chk
  CHECK (((monthly_driver_method IS NULL) OR (monthly_driver_method = ANY (ARRAY[{arr}]))));

{rpc};

-- POST-GUARDS
do $$ begin
  if (select count(*) from costing.demand_volume_selection_policy where status = 'APPROVED') <> 0 then raise exception 'DVS1 GUARD: policy must start DRAFT (OFF)'; end if;
  if (select count(*) from costing.sku_demand_volume_selection_snapshot) <> 0 then raise exception 'DVS1 GUARD: lineage must start empty'; end if;
  if (select count(*) from costing.demand_event_register) + (select count(*) from costing.sku_demand_volume_override) <> 0 then raise exception 'DVS1 GUARD: registers must start empty'; end if;
end $$;
"""
open('out/PREPARED_DVS1_demand_volume_selection.sql','w').write(out)
print(len(out), hashlib.md5(out.encode()).hexdigest())
