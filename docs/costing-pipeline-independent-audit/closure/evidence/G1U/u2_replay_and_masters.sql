-- G1 upstream: as-of replay of the material builders vs frozen run 128 (and 122), plus master/feed facts. Read-only (STABLE functions).
with r128 as (select period_start p, valuation_date v from costing.costing_refresh_run where id=128),
r122 as (select period_start p, valuation_date v from costing.costing_refresh_run where id=122),
live128 as (select l.product_id, sum(l.rm_cost_per_base_unit_line) c, count(*) n from r128, costing.fn_build_product_rm_cost_lines_as_of(r128.p,r128.v) l group by 1),
fro128 as (select product_id, sum(rm_cost_per_base_unit_line) c, count(*) n from costing.product_rm_material_cost_line_snapshot where refresh_run_id=128 group by 1),
live122 as (select l.product_id, sum(l.rm_cost_per_base_unit_line) c, count(*) n from r122, costing.fn_build_product_rm_cost_lines_as_of(r122.p,r122.v) l group by 1),
fro122 as (select product_id, sum(rm_cost_per_base_unit_line) c, count(*) n from costing.product_rm_material_cost_line_snapshot where refresh_run_id=122 group by 1),
cmp as (
  select 128 run_id, coalesce(f.product_id,l.product_id) product_id, f.c frozen, l.c replay, f.n fn, l.n ln from fro128 f full join live128 l on l.product_id=f.product_id
  union all
  select 122, coalesce(f.product_id,l.product_id), f.c, l.c, f.n, l.n from fro122 f full join live122 l on l.product_id=f.product_id),
diff as (select * from cmp where frozen is distinct from replay or fn is distinct from ln)
select jsonb_build_object(
 'run_ctx',(select jsonb_agg(jsonb_build_object('id',id,'period',period_start,'valuation',valuation_date,'requested_at',requested_at,'finished_at',finished_at)) from costing.costing_refresh_run where id in (122,128)),
 'rm_replay_summary',(select jsonb_agg(jsonb_build_object('run',run_id,'products',n,'differ',d)) from (select run_id, count(*) n, count(*) filter(where frozen is distinct from replay or fn is distinct from ln) d from cmp group by 1) s),
 'rm_replay_diffs',(select jsonb_agg(to_jsonb(d) order by run_id, abs(coalesce(replay,0)-coalesce(frozen,0)) desc) from (select * from diff limit 60) d),
 'high_process_loss',(select jsonb_agg(jsonb_build_object('product_id',product_id,'name',product_name,'loss',process_loss_pct,'ref_qty',reference_output_qty,'uom',reference_output_uom_code) order by process_loss_pct desc)
     from (select distinct product_id,product_name,process_loss_pct,reference_output_qty,reference_output_uom_code from costing.product_rm_material_cost_line_snapshot where refresh_run_id=128 and process_loss_pct>=0.4) x),
 'process_loss_bands',(select jsonb_object_agg(b,n) from (select case when process_loss_pct=0 then '0' when process_loss_pct<0.05 then '<5%' when process_loss_pct<0.2 then '5-20%' when process_loss_pct<0.4 then '20-40%' else '>=40%' end b, count(*) n from (select distinct product_id,process_loss_pct from costing.product_rm_material_cost_line_snapshot where refresh_run_id=128) y group by 1) z),
 'missing_rate_lines',(select jsonb_agg(jsonb_build_object('run',refresh_run_id,'kind',k,'item',item,'optional',opt,'sku_count',n)) from (
     select refresh_run_id,'RM' k,purchase_stock_item_name item,is_optional opt,count(distinct product_id) n from costing.product_rm_material_cost_line_snapshot where refresh_run_id in (122,128) and selected_rate is null group by 1,2,3,4
     union all select refresh_run_id,'PM',stock_item_name,is_optional,count(distinct sku_id) from costing.sku_pm_material_cost_line_snapshot where refresh_run_id in (122,128) and selected_rate is null group by 1,2,3,4) m),
 'tally_purchase_feed',(select jsonb_build_object('rows',count(*),'max_voucher_date',max(voucher_date),'min_voucher_date',min(voucher_date)) from public.tally_purchases_vreg_snapshot),
 'rm_bom_header_cols',(select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='rm_bom_header'),
 'rm_bom_line_cols',(select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='rm_bom_line')
) r;
