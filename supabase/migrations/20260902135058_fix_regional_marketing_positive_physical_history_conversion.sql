-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $mig$
declare
  v_def text;
  v_old text := E'    product_region_positive_qty as materialized (\n        select\n            u.product_id,\n            u.region_id,\n            u.region_code,\n\n            coalesce(\n                sum(\n                    case\n                        when e.signed_actual_units > 0\n                            then\n                                e.signed_actual_units\n                                * u.sku_base_qty_per_unit\n                        else 0::numeric\n                    end\n                ),\n                0::numeric\n            ) as positive_actual_base_qty\n\n        from recipient_region_universe u\n\n        left join costing.marketing_regional_sales_evidence_snapshot e\n          on e.refresh_run_id = u.refresh_run_id\n         and e.sku_id = u.sku_id\n         and e.product_id = u.product_id\n         and e.region_code = u.region_code\n         and e.eligibility_status = ''ELIGIBLE_RECIPIENT_LINKED''\n\n        group by\n            u.product_id,\n            u.region_id,\n            u.region_code\n    ),';
  v_new text := E'    evidence_sku_base_context as materialized (\n        select distinct\n            e.sku_id,\n            c.sku_base_qty_per_unit\n        from costing.marketing_regional_sales_evidence_snapshot e\n        cross join lateral costing.fn_resolve_sku_commercial_base_context(e.sku_id) c\n        where e.period_start = v_period_start\n          and e.valuation_date = p_valuation_date\n          and e.refresh_run_id = p_refresh_run_id\n          and e.eligibility_status = ''ELIGIBLE_RECIPIENT_LINKED''\n          and c.sku_base_qty_per_unit > 0\n    ),\n\n    product_region_positive_qty as materialized (\n        select\n            e.product_id,\n            e.region_id,\n            e.region_code,\n\n            coalesce(\n                sum(\n                    case\n                        when e.signed_actual_units > 0\n                            then\n                                e.signed_actual_units\n                                * c.sku_base_qty_per_unit\n                        else 0::numeric\n                    end\n                ),\n                0::numeric\n            ) as positive_actual_base_qty\n\n        from costing.marketing_regional_sales_evidence_snapshot e\n\n        join evidence_sku_base_context c\n          on c.sku_id = e.sku_id\n\n        where e.period_start = v_period_start\n          and e.valuation_date = p_valuation_date\n          and e.refresh_run_id = p_refresh_run_id\n          and e.eligibility_status = ''ELIGIBLE_RECIPIENT_LINKED''\n\n        group by\n            e.product_id,\n            e.region_id,\n            e.region_code\n    ),';
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_sku_regional_marketing_allocation_basis_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_def is null then
    raise exception 'Target regional Marketing basis writer not found';
  end if;

  if strpos(v_def,v_old)=0 then
    raise exception 'Expected regional positive-quantity CTE not found; migration aborted';
  end if;

  if strpos(substr(v_def,strpos(v_def,v_old)+length(v_old)),v_old)>0 then
    raise exception 'Expected regional positive-quantity CTE occurs more than once; migration aborted';
  end if;

  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end
$mig$;