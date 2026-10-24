-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('costing.rpc_refresh_sku_pm_material_cost_line_snapshot(date,date,bigint)'::regprocedure)
    into v_def;

  v_new := regexp_replace(
    v_def,
    'count\(\*\) filter \(\s*where pl\.review_required_flag = true\s*and pl\.approval_block_flag is not true\s*and not costing\.fn_material_review_acceptance_matches\([\s\S]*?pl\.selected_stock_valuation_source\s*\)\s*\)::bigint as review_nonblock_count',
    $rep$count(*) filter (
                where pl.review_required_flag = true
                  and pl.approval_block_flag is not true
            )::bigint as review_nonblock_count$rep$,
    'n'
  );

  v_new := replace(
    v_new,
    'when coalesce(\r\n                    lt.review_nonblock_count,\r\n                    0\r\n                ) > 0',
    'when coalesce(\r\n                    sm.pm_unaccepted_review_rate_line_count,\r\n                    0\r\n                ) > 0'
  );

  if v_new = v_def then
    raise exception 'PM reconciliation optimization patterns not found; migration aborted';
  end if;

  execute v_new;
end $$;