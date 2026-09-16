do $m$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing' and p.proname='rpc_refresh_sku_pricing_bridge_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
  if v_def is null then raise exception 'Pricing Bridge function not found'; end if;
  v_old := $o$            max(r.marketing_expense_allocation_status) filter (where r.region_code='IK') as ik_status,
            max(r.marketing_expense_allocation_status) filter (where r.region_code='OK') as ok_status,
            max(r.marketing_expense_allocation_note) filter (where r.region_code='IK') as ik_note,
            max(r.marketing_expense_allocation_note) filter (where r.region_code='OK') as ok_note
        from costing.sku_regional_marketing_expense_allocation_snapshot r
        where r.period_start=v_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id
        group by r.sku_id$o$;
  v_new := $n$            max(rs.effective_status) filter (where r.region_code='IK') as ik_status,
            max(rs.effective_status) filter (where r.region_code='OK') as ok_status,
            max(r.marketing_expense_allocation_note) filter (where r.region_code='IK') as ik_note,
            max(r.marketing_expense_allocation_note) filter (where r.region_code='OK') as ok_note
        from costing.sku_regional_marketing_expense_allocation_snapshot r
        cross join lateral costing.fn_regional_marketing_review_status(r.id) rs
        where r.period_start=v_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id
        group by r.sku_id$n$;
  if position(v_old in v_def)=0 then raise exception 'Expected regional status block not found; no change applied'; end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end $m$;