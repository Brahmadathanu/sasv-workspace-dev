-- CI-037 PREPARED, NOT APPLIED. Forward-only profit chain on the pricing bridge.
-- Apply only after owner approval, via Supabase MCP apply_migration (never supabase db push). Notify Jarvis first.
-- Definitions (each region ik_/ok_), owner policy 24 Oct 2026:
--   basic = MRP/(1+GST); selling = basic - discount; contingency = 2% x selling (post-discount, ex-GST; unchanged live basis)
--   scheme_effective_selling_price = selling x paid/(paid+free)   (per delivered unit; free-unit cost is NOT added again)
--   net_sales_realization_per_sku = scheme price - contingency - REGIONAL marketing (marketing is not in internal loaded cost)
--   estimated_profit_per_sku = realization - internal_loaded_cost_per_sku
-- Why the work sits in a helper called from the chain and not inside rpc_refresh_sku_pricing_bridge_snapshot:
--   the chain runs pricing bridge -> selling price bridge -> scheme context -> selected scheme -> scheme viability,
--   so discount, contingency and the selected scheme do not exist yet when the pricing-bridge RPC runs.
--   The helper fills the new pricing-bridge columns right after the selected-scheme step, in the same transaction.
-- Run 143 and every designated (approved/superseded) run are untouched: their new columns stay NULL;
-- the designated-run guard trigger blocks updates and the helper refuses them too.
-- Fingerprints hash the column list captured at fingerprint time, so added columns do not change them (see verify).

begin;

alter table costing.sku_pricing_bridge_snapshot
  add column if not exists ik_scheme_paid_qty numeric,
  add column if not exists ik_scheme_free_qty numeric,
  add column if not exists ik_scheme_effective_selling_price numeric,
  add column if not exists ik_net_sales_realization_per_sku numeric,
  add column if not exists ik_estimated_profit_per_sku numeric,
  add column if not exists ik_estimated_profit_on_mrp_percent numeric,
  add column if not exists ik_estimated_profit_on_selling_price_percent numeric,
  add column if not exists ik_estimated_profit_on_realization_percent numeric,
  add column if not exists ik_profit_calculation_status text,
  add column if not exists ok_scheme_paid_qty numeric,
  add column if not exists ok_scheme_free_qty numeric,
  add column if not exists ok_scheme_effective_selling_price numeric,
  add column if not exists ok_net_sales_realization_per_sku numeric,
  add column if not exists ok_estimated_profit_per_sku numeric,
  add column if not exists ok_estimated_profit_on_mrp_percent numeric,
  add column if not exists ok_estimated_profit_on_selling_price_percent numeric,
  add column if not exists ok_estimated_profit_on_realization_percent numeric,
  add column if not exists ok_profit_calculation_status text,
  add column if not exists profit_calculation_basis text;

comment on column costing.sku_pricing_bridge_snapshot.ik_margin_amount_before_scheme is 'Legacy MRP-based cost difference — not profit';
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_amount_before_scheme is 'Legacy MRP-based cost difference — not profit';
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_percent_before_scheme is 'Legacy MRP-based cost difference — not profit (% of GST-inclusive MRP)';
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_percent_before_scheme is 'Legacy MRP-based cost difference — not profit (% of GST-inclusive MRP)';
comment on column costing.sku_pricing_bridge_snapshot.ik_estimated_profit_per_sku is 'CI-037: IK net sales realization minus internal loaded cost, per delivered unit. Contingency is an allowance, not an incurred cost.';
comment on column costing.sku_pricing_bridge_snapshot.ok_estimated_profit_per_sku is 'CI-037: OK net sales realization minus internal loaded cost, per delivered unit. Contingency is an allowance, not an incurred cost.';

create or replace function costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id bigint)
returns bigint
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $fn$
declare v_n bigint;
begin
  if p_refresh_run_id is null then raise exception 'CI-037: refresh run id is required'; end if;
  if exists (select 1 from costing.v_costing_run_effective_designation e where e.refresh_run_id = p_refresh_run_id) then
    raise exception 'CI-037: run % is designated; approved history is immutable', p_refresh_run_id;
  end if;
  with c as (
    select pb.id, s_ik.paid_qty as s_ik_paid_qty, s_ik.free_qty as s_ik_free_qty, s_ok.paid_qty as s_ok_paid_qty, s_ok.free_qty as s_ok_free_qty, 
         d.mrp_ik as ik_mrp, d.ik_selling_price as ik_sell,
         case when s_ik.paid_qty > 0 and s_ik.free_qty >= 0 and d.ik_selling_price is not null
              then d.ik_selling_price * s_ik.paid_qty / (s_ik.paid_qty + s_ik.free_qty) end as ik_sch,
         d.ik_contingency_value as ik_cont, pb.marketing_expense_cost_per_sku_ik as ik_mkt,
         case
           when d.gst_percent is null or d.ik_basic_price is null then 'MISSING_GST_OR_BASIC_PRICE'
           when d.ik_discount_percent is null or d.ik_selling_price is null then 'MISSING_DISCOUNT_OR_SELLING_PRICE'
           when s_ik.sku_id is null or s_ik.paid_qty is null or s_ik.free_qty is null then 'MISSING_SCHEME'
           when s_ik.paid_qty <= 0 or s_ik.free_qty < 0 then 'INVALID_SCHEME_QUANTITY'
           when d.ik_contingency_value is null then 'MISSING_CONTINGENCY'
           when pb.marketing_expense_cost_per_sku_ik is null then 'MISSING_REGIONAL_MARKETING'
           when pb.internal_loaded_cost_per_sku is null or pb.internal_loaded_cost_per_sku <= 0 then 'MISSING_OR_ZERO_COST'
           else 'CALCULATED' end as ik_status,
         
         d.mrp_ok as ok_mrp, d.ok_selling_price as ok_sell,
         case when s_ok.paid_qty > 0 and s_ok.free_qty >= 0 and d.ok_selling_price is not null
              then d.ok_selling_price * s_ok.paid_qty / (s_ok.paid_qty + s_ok.free_qty) end as ok_sch,
         d.ok_contingency_value as ok_cont, pb.marketing_expense_cost_per_sku_ok as ok_mkt,
         case
           when d.gst_percent is null or d.ok_basic_price is null then 'MISSING_GST_OR_BASIC_PRICE'
           when d.ok_discount_percent is null or d.ok_selling_price is null then 'MISSING_DISCOUNT_OR_SELLING_PRICE'
           when s_ok.sku_id is null or s_ok.paid_qty is null or s_ok.free_qty is null then 'MISSING_SCHEME'
           when s_ok.paid_qty <= 0 or s_ok.free_qty < 0 then 'INVALID_SCHEME_QUANTITY'
           when d.ok_contingency_value is null then 'MISSING_CONTINGENCY'
           when pb.marketing_expense_cost_per_sku_ok is null then 'MISSING_REGIONAL_MARKETING'
           when pb.internal_loaded_cost_per_sku is null or pb.internal_loaded_cost_per_sku <= 0 then 'MISSING_OR_ZERO_COST'
           else 'CALCULATED' end as ok_status
    from costing.sku_pricing_bridge_snapshot pb
    join costing.v_sku_detailed_cost_sheet d on d.refresh_run_id = pb.refresh_run_id and d.sku_id = pb.sku_id
    left join costing.sku_selected_scheme_policy_context_snapshot s_ik on s_ik.refresh_run_id = pb.refresh_run_id and s_ik.sku_id = pb.sku_id and s_ik.region_code = 'IK'
    left join costing.sku_selected_scheme_policy_context_snapshot s_ok on s_ok.refresh_run_id = pb.refresh_run_id and s_ok.sku_id = pb.sku_id and s_ok.region_code = 'OK'
    where pb.refresh_run_id = p_refresh_run_id
  ), c2 as (
    select c.*,
      case when ik_status = 'CALCULATED' then ik_sch - ik_cont - ik_mkt end as ik_nsr,
      case when ok_status = 'CALCULATED' then ok_sch - ok_cont - ok_mkt end as ok_nsr
    from c
  ), c3 as (
    select c2.*, c2.ik_nsr - pb.internal_loaded_cost_per_sku as ik_prof, c2.ok_nsr - pb.internal_loaded_cost_per_sku as ok_prof
    from c2 join costing.sku_pricing_bridge_snapshot pb on pb.id = c2.id
  )
  update costing.sku_pricing_bridge_snapshot pb set
    ik_scheme_paid_qty = c.s_ik_paid_qty,
    ik_scheme_free_qty = c.s_ik_free_qty,
    ik_scheme_effective_selling_price = c.ik_sch,
    ik_net_sales_realization_per_sku = c.ik_nsr,
    ik_estimated_profit_per_sku = c.ik_prof,
    ik_estimated_profit_on_mrp_percent = case when c.ik_mrp > 0 then c.ik_prof / c.ik_mrp * 100 end,
    ik_estimated_profit_on_selling_price_percent = case when c.ik_sell > 0 then c.ik_prof / c.ik_sell * 100 end,
    ik_estimated_profit_on_realization_percent = case when c.ik_nsr > 0 then c.ik_prof / c.ik_nsr * 100 end,
    ik_profit_calculation_status = c.ik_status,
    ok_scheme_paid_qty = c.s_ok_paid_qty,
    ok_scheme_free_qty = c.s_ok_free_qty,
    ok_scheme_effective_selling_price = c.ok_sch,
    ok_net_sales_realization_per_sku = c.ok_nsr,
    ok_estimated_profit_per_sku = c.ok_prof,
    ok_estimated_profit_on_mrp_percent = case when c.ok_mrp > 0 then c.ok_prof / c.ok_mrp * 100 end,
    ok_estimated_profit_on_selling_price_percent = case when c.ok_sell > 0 then c.ok_prof / c.ok_sell * 100 end,
    ok_estimated_profit_on_realization_percent = case when c.ok_nsr > 0 then c.ok_prof / c.ok_nsr * 100 end,
    ok_profit_calculation_status = c.ok_status,
    profit_calculation_basis = 'CI-037 v1: contingency 2% of post-discount ex-GST selling price; scheme per delivered unit; regional marketing; internal loaded cost'
  from c3 c
  where pb.id = c.id;
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;
revoke all on function costing.fn_ci037_fill_pricing_bridge_profit(bigint) from public, anon, authenticated;

-- Hook into the chain right after the selected-scheme step (exact single-occurrence text replace, else abort).
do $do$
declare v_def text; v_old text := 'perform * from costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);';
begin
  v_def := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'CI-037: chain hook anchor not found exactly once'; end if;
  if v_def like '%fn_ci037_fill_pricing_bridge_profit%' then raise exception 'CI-037: hook already present'; end if;
  execute replace(v_def, v_old, v_old || E'\n        perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);');
end $do$;

create or replace view costing.v_price_revision_current_approved_master as
WITH approved_run AS (
         SELECT r.refresh_run_id,
            r.period_start,
            r.valuation_date
           FROM costing.v_current_successful_costing_refresh_run r
             JOIN costing.v_costing_run_effective_designation e ON e.refresh_run_id = r.refresh_run_id AND e.designation = 'APPROVED'::text
          WHERE r.selection_basis = 'APPROVED'::text
          ORDER BY r.period_start DESC, r.valuation_date DESC, r.refresh_run_id DESC
         LIMIT 1
        )
 SELECT a.refresh_run_id,
    a.period_start,
    a.valuation_date,
    d.sku_id,
    d.product_id,
    p.item,
    d.pack_size,
    d.pack_uom,
    pg.id AS product_group_id,
    pg.group_name AS product_group,
    sg.id AS product_subgroup_id,
    sg.sub_group_name AS product_subgroup,
    c.rm_cost_per_sku,
    c.pm_cost_per_sku,
    d.material_cost_per_sku,
    d.direct_labour_cost_per_sku,
    d.internal_material_conversion_cost_per_sku,
    d.prime_cost_per_sku,
    d.production_overhead_cost_per_sku,
    d.quality_control_overhead_cost_per_sku,
    d.materials_stores_overhead_cost_per_sku,
    d.manufacturing_cop_per_sku,
    d.admin_overhead_cost_per_sku,
    d.finance_admin_overhead_cost_per_sku,
    d.internal_loaded_cost_per_sku,
    pb.marketing_expense_cost_per_sku_ik,
    pb.marketing_expense_cost_per_sku_ok,
    pb.pricing_cost_per_sku_ik,
    pb.pricing_cost_per_sku_ok,
    d.mrp_ik,
    d.mrp_ok,
    d.gst_percent,
    d.ik_basic_price,
    d.ok_basic_price,
    d.ik_discount_percent,
    d.ok_discount_percent,
    d.ik_discount_amount,
    d.ok_discount_amount,
    d.ik_selling_price,
    d.ok_selling_price,
    d.contingency_percent,
    d.ik_contingency_value,
    d.ok_contingency_value,
    si.scheme_id AS ik_scheme_id,
    si.scheme_name AS ik_scheme_name,
    si.paid_qty AS ik_scheme_paid_qty,
    si.free_qty AS ik_scheme_free_qty,
    so.scheme_id AS ok_scheme_id,
    so.scheme_name AS ok_scheme_name,
    so.paid_qty AS ok_scheme_paid_qty,
    so.free_qty AS ok_scheme_free_qty,
    d.ik_margin_amount_before_scheme,
    d.ik_margin_percent_before_scheme,
    d.ok_margin_amount_before_scheme,
    d.ok_margin_percent_before_scheme,
    d.cost_sheet_status,
    d.refreshed_at,
    cat.id AS product_category_id,
    cat.category_name AS product_category,
    subcat.id AS product_subcategory_id,
    subcat.subcategory_name AS product_subcategory,
    sku.price_list_ik,
    sku.price_list_ok,
    to_char((d.refreshed_at AT TIME ZONE 'Asia/Kolkata'::text), 'DD Mon YYYY, FMHH12:MI AM'::text) || ' IST'::text AS refreshed_at_ist,
    pb.ik_scheme_effective_selling_price,
    pb.ok_scheme_effective_selling_price,
    pb.ik_net_sales_realization_per_sku,
    pb.ok_net_sales_realization_per_sku,
    pb.ik_estimated_profit_per_sku,
    pb.ok_estimated_profit_per_sku,
    pb.ik_estimated_profit_on_mrp_percent,
    pb.ok_estimated_profit_on_mrp_percent,
    pb.ik_estimated_profit_on_selling_price_percent,
    pb.ok_estimated_profit_on_selling_price_percent,
    pb.ik_estimated_profit_on_realization_percent,
    pb.ok_estimated_profit_on_realization_percent,
    pb.ik_profit_calculation_status,
    pb.ok_profit_calculation_status,
    pb.profit_calculation_basis
   FROM approved_run a
     JOIN costing.v_sku_detailed_cost_sheet d ON d.refresh_run_id = a.refresh_run_id AND d.period_start = a.period_start AND d.valuation_date = a.valuation_date
     JOIN costing.sku_manufacturing_cop_snapshot c ON c.refresh_run_id = a.refresh_run_id AND c.sku_id = d.sku_id
     JOIN costing.sku_pricing_bridge_snapshot pb ON pb.refresh_run_id = a.refresh_run_id AND pb.sku_id = d.sku_id
     JOIN products p ON p.id = d.product_id
     JOIN product_skus sku ON sku.id = d.sku_id AND sku.product_id = d.product_id
     JOIN sub_groups sg ON sg.id = p.sub_group_id
     JOIN product_groups pg ON pg.id = sg.product_group_id
     LEFT JOIN sub_categories subcat ON subcat.id = pg.sub_category_id
     LEFT JOIN categories cat ON cat.id = subcat.category_id
     JOIN costing.sku_selected_scheme_policy_context_snapshot si ON si.refresh_run_id = a.refresh_run_id AND si.sku_id = d.sku_id AND si.region_code = 'IK'::text
     JOIN costing.sku_selected_scheme_policy_context_snapshot so ON so.refresh_run_id = a.refresh_run_id AND so.sku_id = d.sku_id AND so.region_code = 'OK'::text;

commit;
