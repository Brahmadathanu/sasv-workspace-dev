do $mig$
declare
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='fn_total_manufacturing_product_demand_as_of'
    and pg_get_function_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then raise exception 'Target total manufacturing demand function not found'; end if;
  v_def := pg_get_functiondef(v_oid);

  v_old := $$        case when bool_or(b.monthly_driver_status='BLOCKED') then 'BLOCKED'
             when bool_or(b.monthly_driver_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'READY' end commercial_status,$$;
  v_new := $$        case when bool_or(coalesce(q.effective_status,b.monthly_driver_status)='BLOCKED') then 'BLOCKED'
             when bool_or(coalesce(q.effective_status,b.monthly_driver_status)='REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'READY' end commercial_status,$$;
  if (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old) <> 1 then
    raise exception 'Expected one commercial status aggregation anchor';
  end if;
  v_def := replace(v_def,v_old,v_new);

  v_old := $$ from costing.sku_sales_allocation_basis_snapshot b
 where b.period_start=date_trunc('month',p_period_start)::date$$;
  v_new := $$ from costing.sku_sales_allocation_basis_snapshot b
 left join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) q on true
 where b.period_start=date_trunc('month',p_period_start)::date$$;
  if (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old) <> 1 then
    raise exception 'Expected one commercial source anchor';
  end if;
  v_def := replace(v_def,v_old,v_new);

  if position('fn_sales_allocation_quantity_driver_review_status(b.id)' in v_def)=0 then
    raise exception 'Acceptance-aware status join not installed';
  end if;
  execute v_def;
end
$mig$;