-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- PREPARED_CI034_valuation_anchored_basis_status.sql
-- PREPARED ONLY. NOT APPLIED. Needs explicit user approval; apply via apply_migration (name ci034_valuation_anchored_basis_status).
-- CI-034: public.v_sales_monthly_clean anchors its 36-month outlier window on CURRENT_DATE. In the sales-basis refresh,
-- the only value that still came from that view (through costing.v_sku_sales_volume_allocation_basis) is the stored
-- diagnostic label allocation_basis_status. All quantities already come from the valuation-anchored functions.
-- Fix (costing-only path): the refresh RPC now derives allocation_basis_status from its own valuation-anchored 12-month
-- totals, using the same CASE rules as the view. public.v_sales_monthly_clean, v_fill_inputs (forecasting) and
-- costing.v_sku_sales_volume_allocation_basis are NOT changed. Only this one RPC expression changes.
-- Works on either RPC version (live pre-DVS 09c3d22c... or DVS-1 ea2b1cdd...); it refuses anything else.
do $ci034$
declare
  v_def text := pg_get_functiondef('costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint)'::regprocedure);
  v_old text := E'        r.allocation_basis_status,\n        r.resolved_source,';
  v_new text := E'        -- CI-034: valuation-anchored diagnostic status (same rules as v_sku_sales_volume_allocation_basis).\n'
             || E'        case\n'
             || E'            when ac.actual_company_sales_units_12m is null or ac.actual_company_sales_units_12m = 0 then ''NO_TOTAL_SALES_BASIS''\n'
             || E'            when ap.actual_product_sales_units_12m = 0 then ''NO_PRODUCT_SALES_IN_LOOKBACK''\n'
             || E'            when a.actual_sales_units_12m = 0 then ''NO_SKU_SALES_IN_LOOKBACK''\n'
             || E'            when ap.actual_product_sales_base_qty_12m = 0 then ''NO_PRODUCT_BASE_QTY''\n'
             || E'            else ''OK''\n'
             || E'        end,\n        r.resolved_source,';
begin
  if md5(v_def) not in ('09c3d22c6154d8eacf099ada57f60007', 'ea2b1cdd487abe50fed971d99e3b47b7') then
    raise exception 'CI034 GUARD: refresh RPC is not a tested version (md5 %)', md5(v_def);
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'CI034 GUARD: target expression not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
  if position('CI-034: valuation-anchored' in pg_get_functiondef('costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint)'::regprocedure)) = 0 then
    raise exception 'CI034 POST: patch not present';
  end if;
end $ci034$;
