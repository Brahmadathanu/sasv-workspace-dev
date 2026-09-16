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
    and p.proname='rpc_refresh_materials_stores_workload_snapshot'
    and pg_get_function_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then raise exception 'Target Materials/Stores writer not found'; end if;
  v_def := pg_get_functiondef(v_oid);

  v_old := $$    from costing.sku_sales_allocation_basis_snapshot b
    join costing.product_rm_stores_workload_snapshot rm$$;
  v_new := $$    from costing.sku_sales_allocation_basis_snapshot b
    left join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) q on true
    join costing.product_rm_stores_workload_snapshot rm$$;
  if (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old) <> 1 then
    raise exception 'Expected one Materials/Stores SKU source join anchor';
  end if;
  v_def := replace(v_def,v_old,v_new);

  v_def := replace(v_def, $$when b.monthly_driver_status = 'BLOCKED' then 'BLOCKED'$$, $$when coalesce(q.effective_status,b.monthly_driver_status) = 'BLOCKED' then 'BLOCKED'$$);
  v_def := replace(v_def, $$or b.monthly_driver_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED'$$, $$or coalesce(q.effective_status,b.monthly_driver_status) = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED'$$);
  v_def := replace(v_def, $$when b.monthly_driver_status = 'BLOCKED' then 'BLOCKED_MONTHLY_ALLOCATION_BASIS'$$, $$when coalesce(q.effective_status,b.monthly_driver_status) = 'BLOCKED' then 'BLOCKED_MONTHLY_ALLOCATION_BASIS'$$);
  v_def := replace(v_def, $$when b.monthly_driver_status = 'REVIEW_REQUIRED' then 'REVIEW_MONTHLY_ALLOCATION_BASIS'$$, $$when coalesce(q.effective_status,b.monthly_driver_status) = 'REVIEW_REQUIRED' then 'REVIEW_MONTHLY_ALLOCATION_BASIS'$$);
  v_def := replace(v_def, $$when b.monthly_driver_status = 'BLOCKED' then 'Materials / Stores workload is blocked because the governed monthly allocation basis is blocked.'$$, $$when coalesce(q.effective_status,b.monthly_driver_status) = 'BLOCKED' then 'Materials / Stores workload is blocked because the governed monthly allocation basis is blocked.'$$);
  v_def := replace(v_def, $$when b.monthly_driver_status = 'REVIEW_REQUIRED' then 'Materials / Stores workload is calculated using a governed assumed or default monthly quantity and requires review.'$$, $$when coalesce(q.effective_status,b.monthly_driver_status) = 'REVIEW_REQUIRED' then 'Materials / Stores workload is calculated using a governed assumed or default monthly quantity and requires review.'$$);

  if position('fn_sales_allocation_quantity_driver_review_status(b.id)' in v_def)=0 then
    raise exception 'Acceptance-aware review-status join not installed';
  end if;
  execute v_def;
end
$mig$;