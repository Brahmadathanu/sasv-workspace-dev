-- read-only: CI-037 v3 status logic on run 143 (governed rate substituted as 2)
  with src as (
    select pb.period_start, pb.valuation_date, pb.refresh_run_id, pb.id pb_id, sp.id sp_id, s.id ss_id, pb.sku_id, rg.r,
      case rg.r when 'IK' then pb.mrp_ik else pb.mrp_ok end mrp,
      sp.gst_percent gst,
      case rg.r when 'IK' then sp.ik_basic_price else sp.ok_basic_price end basic,
      case rg.r when 'IK' then sp.ik_discount_percent else sp.ok_discount_percent end disc,
      case rg.r when 'IK' then sp.ik_selling_price else sp.ok_selling_price end sell,
      sp.contingency_percent cpct, spp.id spp_id, spp.contingency_percent spp_cpct,
      case rg.r when 'IK' then sp.ik_contingency_value else sp.ok_contingency_value end cont,
      s.scheme_id, s.paid_qty pq, s.free_qty fq, s.total_qty tq, s.resolution_status ss_status,
      case rg.r when 'IK' then pb.marketing_expense_cost_per_sku_ik else pb.marketing_expense_cost_per_sku_ok end mkt,
      pb.internal_loaded_cost_per_sku ilc,
      case rg.r when 'IK' then pb.pricing_bridge_status_ik else pb.pricing_bridge_status_ok end pb_status,
      case rg.r when 'IK' then sp.selling_price_bridge_status_ik else sp.selling_price_bridge_status_ok end sp_status
    from costing.sku_pricing_bridge_snapshot pb
    cross join (values ('IK'),('OK')) rg(r)
    join costing.sku_selling_price_bridge_snapshot sp on sp.pricing_bridge_snapshot_id = pb.id and sp.refresh_run_id = pb.refresh_run_id and sp.sku_id = pb.sku_id
    join costing.sku_selected_scheme_policy_context_snapshot s on s.refresh_run_id = pb.refresh_run_id and s.sku_id = pb.sku_id and s.region_code = rg.r
    left join costing.sku_selling_price_policy spp on spp.id = sp.selling_price_policy_id
    where pb.refresh_run_id = 143
  ), st as (
    select src.*,
      case
        when pb_status is null or sp_status is null then 'MISSING_UPSTREAM_STATUS'
        when pb_status = 'BLOCKED' or sp_status = 'BLOCKED' then 'UPSTREAM_BLOCKED'
        when pb_status not in ('READY','REVIEW_REQUIRED') or sp_status not in ('READY','REVIEW_REQUIRED') then 'UNKNOWN_UPSTREAM_STATUS'
        -- Live CHECK on sku_selected_scheme_policy_context_snapshot allows only RESOLVED_POLICY, DEFAULT_NO_SCHEME, BLOCKED.
        -- There is no REVIEW_REQUIRED (or equivalent) scheme status; anything else is treated as an error.
        when ss_status is null then 'SCHEME_STATUS_MISSING'
        when ss_status = 'BLOCKED' then 'SCHEME_BLOCKED'
        when ss_status not in ('RESOLVED_POLICY','DEFAULT_NO_SCHEME') then 'UNKNOWN_SCHEME_STATUS'
        when mrp is null then 'MISSING_MRP'
        when mrp <= 0 then 'INVALID_MRP'
        when gst is null then 'MISSING_GST'
        when gst < 0 or gst > 100 then 'INVALID_GST'
        when basic is null then 'MISSING_BASIC_PRICE'
        when basic <= 0 or abs(basic - mrp / (1 + gst / 100)) > 0.01 then 'INVALID_BASIC_PRICE'
        when disc is null then 'MISSING_DISCOUNT'
        when disc < 0 or disc >= 100 then 'INVALID_DISCOUNT'
        when sell is null then 'MISSING_SELLING_PRICE'
        when sell <= 0 or sell > basic + 0.01 or abs(sell - basic * (1 - disc / 100)) > 0.01 then 'INVALID_SELLING_PRICE'
        when pq is null or fq is null or tq is null then 'MISSING_SCHEME_QUANTITY'
        when pq <= 0 or fq < 0 or tq <> pq + fq or pq <> trunc(pq) or fq <> trunc(fq) then 'INVALID_SCHEME_QUANTITY'
        when cpct is null or cont is null then 'MISSING_CONTINGENCY'
        when spp_id is null then 'MISSING_CONTINGENCY_POLICY_SOURCE'
        when spp_cpct is distinct from cpct then 'CONTINGENCY_POLICY_SOURCE_MISMATCH'
        when cpct <> 2 then 'CONTINGENCY_RATE_NOT_POLICY'
        when abs(cont - sell * 2 / 100) > 0.01 then 'CONTINGENCY_NOT_ON_SELLING_PRICE'
        when mkt is null then 'MISSING_REGIONAL_MARKETING'
        when mkt < 0 then 'INVALID_REGIONAL_MARKETING'
        when ilc is null then 'MISSING_COST'
        when ilc <= 0 then 'INVALID_COST'
        when pb_status = 'REVIEW_REQUIRED' or sp_status = 'REVIEW_REQUIRED' then 'CALCULATED_UPSTREAM_REVIEW'
        else 'CALCULATED'
      end status
    from src
  ), v as (
    select st.*,
      case when status like 'CALCULATED%' then sell * pq / (pq + fq) end sch
    from st
  ), v2 as (
    select v.*, sch - cont - mkt nsr from v
  ), v3 as (
    select v2.*, nsr - ilc prof from v2
  )
select status, r, count(*) n, count(*) filter (where prof<0) neg, round(sum(prof),2) sum_prof from v3 group by 1,2 order by 1,2