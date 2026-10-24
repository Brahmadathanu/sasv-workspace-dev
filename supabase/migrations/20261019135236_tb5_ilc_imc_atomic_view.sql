-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- PREPARED (not applied). CI-002: sku_internal_loaded_cost_snapshot carries prime cost (= material + direct labour + IMC)
-- but not the internal-material-conversion (IMC) column, so its components do not add up on 9 SKUs per run
-- (sum ₹14.27 run 122, ₹2.55 run 128). COP and prime snapshots already carry IMC.
-- Design: NO table change. Adding a column to a fingerprint-scoped snapshot table would drift the legacy
-- (whole-row) fingerprint captures (e.g. run 119 REFERENCE). A read view joins IMC from COP of the same run.
-- Guards: required columns exist; target view absent.
do $g$
begin
  if (select count(*) from information_schema.columns where table_schema='costing' and table_name='sku_manufacturing_cop_snapshot'
        and column_name in ('internal_material_conversion_cost_per_sku','internal_material_conversion_status','refresh_run_id','sku_id')) <> 4
  then raise exception 'TB5_GUARD: COP snapshot columns missing'; end if;
  if exists (select 1 from information_schema.columns where table_schema='costing' and table_name='sku_internal_loaded_cost_snapshot'
        and column_name='internal_material_conversion_cost_per_sku') then raise exception 'TB5_GUARD: ILC already has IMC column'; end if;
  if to_regclass('costing.v_sku_internal_loaded_cost_atomic') is not null then raise exception 'TB5_GUARD: view already exists'; end if;
end $g$;

create view costing.v_sku_internal_loaded_cost_atomic with (security_invoker = true) as
select i.*,
       c.internal_material_conversion_cost_per_sku,
       c.internal_material_conversion_status,
       round(i.prime_cost_per_sku - (coalesce(i.material_cost_per_sku,0) + coalesce(i.direct_labour_cost_per_sku,0)
             + coalesce(c.internal_material_conversion_cost_per_sku,0)), 6) as prime_identity_gap,
       round(i.internal_loaded_cost_per_sku - (coalesce(i.manufacturing_cop_per_sku,0) + coalesce(i.admin_overhead_cost_per_sku,0)
             + coalesce(i.finance_admin_overhead_cost_per_sku,0)), 6) as ilc_identity_gap
  from costing.sku_internal_loaded_cost_snapshot i
  left join costing.sku_manufacturing_cop_snapshot c on c.refresh_run_id = i.refresh_run_id and c.sku_id = i.sku_id;
comment on view costing.v_sku_internal_loaded_cost_atomic is 'CI-002 (closure 2026-10): ILC rows with the IMC element from COP of the same run; gaps must be 0';
revoke all on costing.v_sku_internal_loaded_cost_atomic from public, anon, authenticated;
grant select on costing.v_sku_internal_loaded_cost_atomic to service_role;

do $p$
declare n int;
begin
  select count(*) into n from costing.v_sku_internal_loaded_cost_atomic where refresh_run_id in (122,128) and (abs(prime_identity_gap) > 0.000001 or abs(ilc_identity_gap) > 0.000001);
  if n <> 0 then raise exception 'TB5_POST: % rows of runs 122/128 break the identity', n; end if;
end $p$;
