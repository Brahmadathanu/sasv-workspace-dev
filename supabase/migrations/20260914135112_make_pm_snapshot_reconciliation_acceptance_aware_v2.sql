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
    'count\(\*\) filter \(\s*where pl\.review_required_flag = true\s*and pl\.approval_block_flag is not true\s*\)::bigint as review_nonblock_count',
    $rep$count(*) filter (
                where pl.review_required_flag = true
                  and pl.approval_block_flag is not true
                  and not costing.fn_material_review_acceptance_matches(
                      v_period_start,
                      p_valuation_date,
                      pl.stock_item_id,
                      'PM',
                      pl.acceptance_issue_codes,
                      pl.acceptance_warning_codes,
                      pl.acceptance_action_required_summary,
                      pl.selected_rate,
                      pl.rate_source,
                      pl.rate_date,
                      pl.selected_manual_rate_id,
                      pl.selected_purchase_fact_id,
                      pl.selected_stock_valuation_source
                  )
            )::bigint as review_nonblock_count$rep$,
    'n'
  );

  if v_new = v_def then
    raise exception 'Expected PM reconciliation block not found; migration aborted';
  end if;

  execute v_new;
end $$;