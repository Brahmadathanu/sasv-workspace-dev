-- G1 upstream lineage (material): runs 122 and 128. Read-only.
with runs as (select id run_id, period_start, valuation_date from costing.costing_refresh_run where id in (122,128)),
sm as (select s.* from costing.sku_material_cost_snapshot s join runs r on r.run_id=s.refresh_run_id),
rl as (select l.* from costing.sku_rm_material_cost_line_snapshot l join runs r on r.run_id=l.refresh_run_id),
pl as (select l.* from costing.product_rm_material_cost_line_snapshot l join runs r on r.run_id=l.refresh_run_id),
pm as (select l.* from costing.sku_pm_material_cost_line_snapshot l join runs r on r.run_id=l.refresh_run_id),
units as (select b.refresh_run_id, b.sku_id, b.monthly_allocation_units u from costing.sku_sales_allocation_basis_snapshot b join runs r on r.run_id=b.refresh_run_id),
a_rm_sum as (
  select sm.refresh_run_id, count(*) skus, count(*) filter(where sm.rm_costing_status<>'BLOCKED') rm_unblocked,
   count(*) filter(where sm.rm_costing_status<>'BLOCKED' and abs(sm.rm_cost_per_sku-coalesce(x.s,0))>1e-9) rm_sum_mismatch,
   max(abs(sm.rm_cost_per_sku-coalesce(x.s,0))) filter(where sm.rm_costing_status<>'BLOCKED') rm_sum_maxdiff,
   count(*) filter(where sm.pm_costing_status<>'BLOCKED' and abs(sm.pm_cost_per_sku-coalesce(y.s,0))>1e-9) pm_sum_mismatch,
   max(abs(sm.pm_cost_per_sku-coalesce(y.s,0))) filter(where sm.pm_costing_status<>'BLOCKED') pm_sum_maxdiff,
   count(*) filter(where abs(sm.material_cost_per_sku-(sm.rm_cost_per_sku+sm.pm_cost_per_sku))>1e-9) mat_identity_mismatch,
   count(*) filter(where sm.material_costing_status='BLOCKED') mat_blocked,
   count(*) filter(where sm.material_costing_status='REVIEW_REQUIRED') mat_review
  from sm
  left join (select refresh_run_id, sku_id, sum(rm_cost_per_sku_line) s from rl group by 1,2) x on x.refresh_run_id=sm.refresh_run_id and x.sku_id=sm.sku_id
  left join (select refresh_run_id, sku_id, sum(pm_cost_per_sku_line) s from pm group by 1,2) y on y.refresh_run_id=sm.refresh_run_id and y.sku_id=sm.sku_id
  group by 1),
a_rm_arith as (
  select pl.refresh_run_id, count(*) product_lines,
   count(*) filter(where pl.rm_cost_per_base_unit_line is not null and abs(pl.rm_cost_per_base_unit_line-pl.qty_purchase_form_per_base_unit*pl.selected_rate)>1e-12) line_rate_x_qty_mismatch,
   count(*) filter(where pl.qty_purchase_form_per_base_unit is not null and pl.form_conversion_factor is not null and abs(pl.qty_purchase_form_per_base_unit-pl.qty_consume_form_per_base_unit*pl.form_conversion_factor)>1e-12) uom_conversion_mismatch,
   count(*) filter(where pl.form_conversion_applied) form_conversion_applied_lines,
   count(*) filter(where pl.calculation_warning_flag) calc_warning_lines,
   count(*) filter(where pl.approval_block_flag) blocking_lines,
   count(*) filter(where pl.rate_date>pl.valuation_date) rate_after_valuation,
   count(distinct pl.product_id) products,
   count(distinct pl.product_id) filter(where pl.process_loss_pct>0) products_with_process_loss,
   count(distinct pl.product_id) filter(where pl.process_loss_pct>=1) products_loss_ge_1,
   max(pl.process_loss_pct) max_process_loss
  from pl group by 1),
a_sku_line as (
  select rl.refresh_run_id, count(*) sku_lines,
   count(*) filter(where rl.rm_cost_per_sku_line is not null and abs(rl.rm_cost_per_sku_line-rl.rm_cost_per_base_unit_line*rl.pack_size*rl.conversion_to_base)>1e-12) sku_line_scale_mismatch
  from rl group by 1),
a_pm_arith as (
  select pm.refresh_run_id, count(*) pm_lines,
   count(*) filter(where pm.pm_cost_per_sku_line is not null and abs(pm.pm_cost_per_sku_line-pm.qty_required_unit_final*pm.selected_rate)>1e-9) pm_rate_x_qty_mismatch,
   count(*) filter(where pm.rate_date>pm.valuation_date) pm_rate_after_valuation,
   count(*) filter(where coalesce(pm.wastage_pct,0)<>0) pm_lines_with_wastage
  from pm group by 1),
mix as (
  select refresh_run_id, kind, coalesce(rate_source,'NONE') rate_source, coalesce(rate_warning_code,'-') warning, count(*) lines,
         round(sum(v),2) monthly_value_rs
  from (
    select rl.refresh_run_id,'RM' kind, rl.rate_source, rl.rate_warning_code, rl.rm_cost_per_sku_line*u.u v from rl join units u on u.refresh_run_id=rl.refresh_run_id and u.sku_id=rl.sku_id
    union all
    select pm.refresh_run_id,'PM', pm.rate_source, pm.rate_warning_code, pm.pm_cost_per_sku_line*u.u from pm join units u on u.refresh_run_id=pm.refresh_run_id and u.sku_id=pm.sku_id
  ) z group by 1,2,3,4),
purch as (
  select x.refresh_run_id, x.kind, count(*) distinct_rate_picks,
    count(*) filter(where p.purchase_fact_id is null) fact_missing_now,
    count(*) filter(where p.purchase_fact_id is not null and p.avg_rate_value is distinct from x.selected_rate) rate_changed_now,
    count(*) filter(where p.purchase_fact_id is not null and p.voucher_date is distinct from x.rate_date) date_changed_now,
    count(*) filter(where exists(select 1 from public.v_purchases_by_item q where q.inv_stock_item_id=x.item and q.avg_rate_value>0 and q.canonical_qty_value>0
         and q.voucher_date<=x.valuation_date and (q.voucher_date>x.rate_date or (q.voucher_date=x.rate_date and q.purchase_fact_id>x.fact)))) newer_fact_now_qualifies
  from (
    select distinct refresh_run_id,'RM' kind,purchase_stock_item_id item,selected_purchase_fact_id fact,selected_rate,rate_date,valuation_date from pl where rate_source='LAST_PURCHASE'
    union
    select distinct refresh_run_id,'PM',stock_item_id,selected_purchase_fact_id,selected_rate,rate_date,valuation_date from pm where rate_source='LAST_PURCHASE'
  ) x left join public.v_purchases_by_item p on p.purchase_fact_id=x.fact and p.inv_stock_item_id=x.item
  group by 1,2),
manual as (
  select x.refresh_run_id, count(*) manual_picks,
    count(*) filter(where m.id is null) manual_missing_now,
    count(*) filter(where m.id is not null and m.rate_value is distinct from x.selected_rate) manual_value_changed,
    count(*) filter(where m.id is not null and m.status<>'ACTIVE') manual_now_inactive
  from (select distinct refresh_run_id,selected_manual_rate_id id,selected_rate from pl where selected_manual_rate_id is not null
        union select distinct refresh_run_id,selected_manual_rate_id,selected_rate from pm where selected_manual_rate_id is not null) x
  left join costing.material_manual_rates m on m.id=x.id group by 1)
select jsonb_build_object(
 'sums',(select jsonb_agg(to_jsonb(a)) from a_rm_sum a),
 'rm_arith',(select jsonb_agg(to_jsonb(a)) from a_rm_arith a),
 'sku_line',(select jsonb_agg(to_jsonb(a)) from a_sku_line a),
 'pm_arith',(select jsonb_agg(to_jsonb(a)) from a_pm_arith a),
 'mix',(select jsonb_agg(to_jsonb(a) order by refresh_run_id,kind,monthly_value_rs desc) from mix a),
 'purchase_trace',(select jsonb_agg(to_jsonb(a)) from purch a),
 'manual_trace',(select jsonb_agg(to_jsonb(a)) from manual a),
 'bom_wastage_now',(select jsonb_build_object('rm_bom_lines',count(*),'rm_lines_wastage_nonzero',count(*) filter(where coalesce(wastage_pct,0)<>0)) from public.rm_bom_line),
 'sp_wastage_now',(select jsonb_build_object('sp_bom_lines',count(*),'sp_lines_wastage_nonzero',count(*) filter(where coalesce(wastage_pct,0)<>0)) from public.sp_bom_line)
) r;
