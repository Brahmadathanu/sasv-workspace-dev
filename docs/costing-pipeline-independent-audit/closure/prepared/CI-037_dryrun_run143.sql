-- CI-037 read-only dry run on approved run 143 (SELECT only). IK region.
-- Run 143 has no live free-quantity scheme (every SKU's selected scheme is "No Scheme 1+0"),
-- so a 5+1 scheme is SIMULATED on three SKUs to show the scheme step.
with d as (
  select d.sku_id, d.product_name||' '||d.pack_size||' '||d.pack_uom nm, d.mrp_ik mrp, d.ik_basic_price basic,
         d.ik_discount_percent disc, d.ik_selling_price sell, d.ik_contingency_value cont,
         pb.marketing_expense_cost_per_sku_ik mkt, d.internal_loaded_cost_per_sku ilc,
         d.ik_margin_amount_before_scheme legacy, s.paid_qty pq, s.free_qty fq
  from costing.v_sku_detailed_cost_sheet d
  join costing.sku_pricing_bridge_snapshot pb on pb.refresh_run_id=d.refresh_run_id and pb.sku_id=d.sku_id
  join costing.sku_selected_scheme_policy_context_snapshot s on s.refresh_run_id=d.refresh_run_id and s.sku_id=d.sku_id and s.region_code='IK'
  where d.refresh_run_id=143),
cases as (
  select 'live' k, d.* from d where sku_id in (975,1264,45,51) or sku_id=(select min(sku_id) from d where disc=40)
  union all
  select 'sim 5+1', sku_id,nm,mrp,basic,disc,sell,cont,mkt,ilc,legacy,5,1 from d where sku_id in (975,45,51))
select k, sku_id, nm, mrp, disc, pq||'+'||fq scheme, round(basic,2) basic, round(sell,2) selling,
       round(cont,2) cont_on_selling, round(0.02*basic,2) cont_on_basic_sheets, round(0.02*basic-cont,2) sheets_extra,
       round(sell*pq/(pq+fq),2) scheme_price, round(mkt,2) mkt,
       round(sell*pq/(pq+fq)-cont-mkt,2) realization, round(ilc,2) ilc,
       round(sell*pq/(pq+fq)-cont-mkt-ilc,2) est_profit,
       round((sell*pq/(pq+fq)-cont-mkt-ilc)/nullif(mrp,0)*100,1) pct_mrp,
       round((sell*pq/(pq+fq)-cont-mkt-ilc)/nullif(sell,0)*100,1) pct_sell,
       round(legacy,2) legacy_margin
from cases order by k, sku_id;
