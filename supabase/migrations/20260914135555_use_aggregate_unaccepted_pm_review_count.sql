-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('costing.rpc_refresh_sku_pm_material_cost_line_snapshot(date,date,bigint)'::regprocedure)
    into v_def;
  v_new := replace(v_def,'lt.review_nonblock_count','sm.pm_unaccepted_review_rate_line_count');
  if v_new = v_def then
    raise exception 'PM status reference not found; migration aborted';
  end if;
  execute v_new;
end $$;