-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_oid oid;
  v_def text;
  v_start int;
  v_end int;
  v_old text;
  v_new text := $frag$
    product_region_positive_qty as materialized (
        select
            u.product_id,
            u.region_id,
            u.region_code,

            coalesce(
                sum(
                    case
                        when e.signed_actual_units > 0
                            then
                                e.signed_actual_units
                                * u.sku_base_qty_per_unit
                        else 0::numeric
                    end
                ),
                0::numeric
            ) as positive_actual_base_qty

        from recipient_region_universe u

        left join costing.marketing_regional_sales_evidence_snapshot e
          on e.refresh_run_id = u.refresh_run_id
         and e.sku_id = u.sku_id
         and e.product_id = u.product_id
         and e.region_code = u.region_code
         and e.eligibility_status = 'ELIGIBLE_RECIPIENT_LINKED'

        group by
            u.product_id,
            u.region_id,
            u.region_code
    ),

$frag$;
begin
  select p.oid
  into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'costing'
    and p.proname = 'rpc_refresh_sku_regional_marketing_allocation_basis_snapshot'
    and pg_get_function_arguments(p.oid) = 'p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then
    raise exception 'Target regional Marketing basis function not found';
  end if;

  v_def := pg_get_functiondef(v_oid);
  v_start := strpos(v_def, '    product_region_positive_qty as materialized (');
  v_end := strpos(v_def, '    product_company_positive_qty as materialized (');

  if v_start = 0 or v_end = 0 or v_end <= v_start then
    raise exception 'Could not locate product_region_positive_qty CTE boundaries';
  end if;

  v_old := substr(v_def, v_start, v_end - v_start);
  if v_old not like '%left join sku_region_actual a%' then
    raise exception 'Unexpected existing regional positive-quantity implementation';
  end if;

  v_def := substr(v_def, 1, v_start - 1) || v_new || substr(v_def, v_end);
  execute v_def;
end $$;