-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.material_review_acceptance_register
    add column if not exists source_selected_rate numeric,
    add column if not exists source_rate_source text,
    add column if not exists source_rate_date date,
    add column if not exists source_selected_manual_rate_id bigint,
    add column if not exists source_selected_purchase_fact_id bigint,
    add column if not exists source_selected_stock_valuation_source text,
    add column if not exists source_evidence_fingerprint text;

create or replace function costing.fn_apply_material_acceptance_source_context()
returns trigger
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
    v_queue record;
    v_evidence record;
begin
    if new.acceptance_status <> 'ACTIVE' then
        return new;
    end if;

    select q.valuation_date,q.refresh_run_id,q.snapshot_refreshed_at
    into v_queue
    from costing.material_costing_action_queue_snapshot q
    where q.period_start = new.period_start
      and q.stock_item_id = new.stock_item_id
      and upper(q.material_area)=upper(new.material_area)
      and upper(q.recommended_ui_route)=upper(new.recommended_ui_route)
      and coalesce(q.issue_codes,'')=coalesce(new.issue_codes,'')
      and coalesce(q.warning_codes,'')=coalesce(new.warning_codes,'')
      and coalesce(q.action_required_summary,'')=coalesce(new.action_required_summary,'')
      and q.valuation_date is not null
      and q.refresh_run_id is not null
    order by q.snapshot_refreshed_at desc
    limit 1;

    if not found then
        raise exception 'Exact material action context was not found for acceptance';
    end if;

    select
      min(d.selected_rate) as selected_rate,
      min(d.rate_source) as rate_source,
      min(d.rate_date) as rate_date,
      min(case when d.material_area='RM' then r.selected_manual_rate_id else p.selected_manual_rate_id end) as selected_manual_rate_id,
      min(case when d.material_area='RM' then r.selected_purchase_fact_id else p.selected_purchase_fact_id end) as selected_purchase_fact_id,
      min(case when d.material_area='RM' then r.selected_stock_valuation_source else p.selected_stock_valuation_source end) as selected_stock_valuation_source,
      count(distinct concat_ws('|',
        coalesce(d.selected_rate::text,''),
        coalesce(d.rate_source,''),
        coalesce(d.rate_date::text,''),
        coalesce((case when d.material_area='RM' then r.selected_manual_rate_id else p.selected_manual_rate_id end)::text,''),
        coalesce((case when d.material_area='RM' then r.selected_purchase_fact_id else p.selected_purchase_fact_id end)::text,''),
        coalesce(case when d.material_area='RM' then r.selected_stock_valuation_source else p.selected_stock_valuation_source end,'')
      )) as evidence_variant_count
    into v_evidence
    from costing.material_costing_action_drilldown_snapshot d
    left join costing.sku_rm_material_cost_line_snapshot r
      on d.frozen_source_type='RM' and r.id=d.frozen_rm_line_snapshot_id
    left join costing.sku_pm_material_cost_line_snapshot p
      on d.frozen_source_type='PM' and p.id=d.frozen_pm_line_snapshot_id
    where d.period_start=new.period_start
      and d.valuation_date=v_queue.valuation_date
      and d.refresh_run_id=v_queue.refresh_run_id
      and d.stock_item_id=new.stock_item_id
      and upper(d.material_area)=upper(new.material_area)
      and upper(d.recommended_ui_route)=upper(new.recommended_ui_route)
      and coalesce(d.material_issue_code,'') = any(string_to_array(coalesce(new.issue_codes,''), ', '))
      and (new.warning_codes is null or coalesce(d.warning_code,'') = any(string_to_array(new.warning_codes, ', ')))
      and (new.action_required_summary is null or coalesce(d.action_required,'') = any(string_to_array(new.action_required_summary, ', ')));

    if coalesce(v_evidence.evidence_variant_count,0) <> 1 then
        raise exception 'Material review acceptance requires exactly one selected-rate evidence tuple; found % variants', coalesce(v_evidence.evidence_variant_count,0);
    end if;

    new.source_valuation_date := v_queue.valuation_date;
    new.source_refresh_run_id := v_queue.refresh_run_id;
    new.source_snapshot_refreshed_at := v_queue.snapshot_refreshed_at;
    new.source_selected_rate := v_evidence.selected_rate;
    new.source_rate_source := v_evidence.rate_source;
    new.source_rate_date := v_evidence.rate_date;
    new.source_selected_manual_rate_id := v_evidence.selected_manual_rate_id;
    new.source_selected_purchase_fact_id := v_evidence.selected_purchase_fact_id;
    new.source_selected_stock_valuation_source := v_evidence.selected_stock_valuation_source;
    new.source_evidence_fingerprint := md5(concat_ws('|',
        coalesce(v_evidence.selected_rate::text,''),
        coalesce(v_evidence.rate_source,''),
        coalesce(v_evidence.rate_date::text,''),
        coalesce(v_evidence.selected_manual_rate_id::text,''),
        coalesce(v_evidence.selected_purchase_fact_id::text,''),
        coalesce(v_evidence.selected_stock_valuation_source,'')
    ));
    return new;
end;
$$;

create or replace function costing.fn_material_review_acceptance_matches(
    p_period_start date,
    p_valuation_date date,
    p_stock_item_id bigint,
    p_material_area text,
    p_issue_codes text,
    p_warning_codes text,
    p_action_required_summary text,
    p_selected_rate numeric,
    p_rate_source text,
    p_rate_date date,
    p_selected_manual_rate_id bigint,
    p_selected_purchase_fact_id bigint,
    p_selected_stock_valuation_source text
) returns boolean
language sql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $$
select exists (
    select 1
    from costing.material_review_acceptance_register ar
    where ar.acceptance_status='ACTIVE'
      and ar.period_start=date_trunc('month',p_period_start)::date
      and ar.source_valuation_date=p_valuation_date
      and ar.stock_item_id=p_stock_item_id
      and upper(ar.material_area)=upper(p_material_area)
      and upper(ar.recommended_ui_route)='MATERIAL_RATE_REVIEW'
      and coalesce(ar.issue_codes,'')=coalesce(p_issue_codes,'')
      and coalesce(ar.warning_codes,'')=coalesce(p_warning_codes,'')
      and coalesce(ar.action_required_summary,'')=coalesce(p_action_required_summary,'')
      and ar.source_selected_rate is not distinct from p_selected_rate
      and ar.source_rate_source is not distinct from p_rate_source
      and ar.source_rate_date is not distinct from p_rate_date
      and ar.source_selected_manual_rate_id is not distinct from p_selected_manual_rate_id
      and ar.source_selected_purchase_fact_id is not distinct from p_selected_purchase_fact_id
      and ar.source_selected_stock_valuation_source is not distinct from p_selected_stock_valuation_source
);
$$;

-- exact-run RM builder: use evidence-bound acceptance, run id retained for context validation/provenance only
create or replace function costing.fn_build_product_rm_cost_as_of(p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
returns table(period_start date, valuation_date date, product_id bigint, product_name text, product_base_uom text, conversion_to_base numeric, rm_line_count bigint, direct_rm_line_count bigint, expanded_sp_line_count bigint, form_converted_line_count bigint, rm_cost_per_base_unit numeric, ok_line_count bigint, review_rate_line_count bigint, optional_missing_rate_line_count bigint, blocking_line_count bigint, blocking_stock_item_count bigint, stale_purchase_rate_line_count bigint, stock_valuation_fallback_line_count bigint, manual_rate_line_count bigint, calculation_warning_line_count bigint, rm_costing_status text, rm_costing_note text, accepted_review_rate_line_count bigint, unaccepted_review_rate_line_count bigint)
language sql stable security definer set search_path to 'costing','public','pg_temp'
as $$
with ctx as (
  select 1 from costing.costing_refresh_run r
  where r.id=p_refresh_run_id and r.period_start=date_trunc('month',p_period_start)::date and r.valuation_date=p_valuation_date and r.valuation_context_source='CAPTURED_AT_REQUEST'
), line_classified as (
 select l.*,
   case when l.rate_warning_code='STALE_PURCHASE_RATE' then 'STALE_RM_PURCHASE_RATE'
        when l.rate_warning_code='STOCK_VALUATION_FALLBACK' then 'RM_STOCK_VALUATION_FALLBACK'
        when l.rate_warning_code='MANUAL_RATE_USED' then 'RM_MANUAL_RATE_USED'
        when l.action_required='OPTIONAL_MISSING_RATE' then 'OPTIONAL_RM_RATE_MISSING'
        when l.calculation_warning_code is not null then l.calculation_warning_code
        when l.rate_warning_code is not null then l.rate_warning_code else l.action_required end acceptance_issue_codes,
   case when l.rate_warning_code is not null then l.rate_warning_code end acceptance_warning_codes,
   case when l.action_required in ('REVIEW_RATE','OPTIONAL_MISSING_RATE') then l.action_required end acceptance_action_required_summary,
   (l.approval_block_flag is not true and (l.action_required in ('REVIEW_RATE','OPTIONAL_MISSING_RATE') or l.rate_warning_code is not null)) non_blocking_review_flag
 from costing.fn_build_product_rm_cost_lines_as_of(p_period_start,p_valuation_date) l
 cross join ctx
), line_acceptance as (
 select lc.*, case when lc.non_blocking_review_flag and costing.fn_material_review_acceptance_matches(
   p_period_start,p_valuation_date,lc.purchase_stock_item_id,'RM',lc.acceptance_issue_codes,lc.acceptance_warning_codes,lc.acceptance_action_required_summary,
   lc.selected_rate,case when lc.rate_source='LAST_PURCHASE' then 'LATEST_PURCHASE_RATE' else lc.rate_source end,lc.rate_date,lc.selected_manual_rate_id,lc.selected_purchase_fact_id,lc.selected_stock_valuation_source
 ) then true else false end review_acceptance_active
 from line_classified lc
)
select date_trunc('month',p_period_start)::date,p_valuation_date,product_id,product_name,product_base_uom,max(conversion_to_base),count(*)::bigint,
 count(*) filter(where source='RM_BOM')::bigint,count(*) filter(where source='SP_BOM')::bigint,count(*) filter(where form_conversion_applied)::bigint,
 sum(coalesce(rm_cost_per_base_unit_line,0)),count(*) filter(where action_required='OK')::bigint,
 count(*) filter(where action_required='REVIEW_RATE' and approval_block_flag is not true)::bigint,
 count(*) filter(where action_required='OPTIONAL_MISSING_RATE' and approval_block_flag is not true)::bigint,
 count(*) filter(where approval_block_flag=true)::bigint,count(distinct purchase_stock_item_id) filter(where approval_block_flag=true)::bigint,
 count(*) filter(where rate_warning_code='STALE_PURCHASE_RATE' and approval_block_flag is not true)::bigint,
 count(*) filter(where rate_warning_code='STOCK_VALUATION_FALLBACK' and approval_block_flag is not true)::bigint,
 count(*) filter(where rate_warning_code='MANUAL_RATE_USED' and approval_block_flag is not true)::bigint,
 count(*) filter(where calculation_warning_flag)::bigint,
 case when count(*) filter(where approval_block_flag=true)>0 then 'BLOCKED' when count(*) filter(where non_blocking_review_flag and review_acceptance_active is not true)>0 then 'REVIEW_REQUIRED' else 'READY' end,
 case when count(*) filter(where approval_block_flag=true)>0 then 'Raw material cost is incomplete because required RM items have missing, ambiguous, or invalid calculation inputs.'
      when count(*) filter(where non_blocking_review_flag and review_acceptance_active is not true)>0 then 'Raw material cost can be calculated, but review is required because fallback, stale, manual, or optional-missing rates are present.'
      when count(*) filter(where non_blocking_review_flag and review_acceptance_active)>0 then 'Raw material cost is ready because all review-required RM rate issues are actively accepted for this frozen valuation evidence.'
      else 'Raw material cost is ready.' end,
 count(*) filter(where non_blocking_review_flag and review_acceptance_active)::bigint,
 count(*) filter(where non_blocking_review_flag and review_acceptance_active is not true)::bigint
from line_acceptance group by product_id,product_name,product_base_uom;
$$;

create or replace function costing.fn_build_sku_pm_cost_as_of(p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
returns table(period_start date, valuation_date date, sku_id bigint, product_id bigint, product_name text, pack_size numeric, pack_uom text, pm_line_count bigint, required_pm_line_count bigint, optional_pm_line_count bigint, pm_cost_per_sku numeric, blocking_missing_rate_line_count bigint, blocking_missing_rate_item_count bigint, optional_missing_rate_line_count bigint, stale_purchase_rate_line_count bigint, stock_valuation_fallback_line_count bigint, manual_rate_line_count bigint, review_rate_line_count bigint, pm_costing_status text, pm_costing_note text, accepted_review_rate_line_count bigint, unaccepted_review_rate_line_count bigint)
language sql stable security definer set search_path to 'costing','public','pg_temp'
as $$
with ctx as (
 select 1 from costing.costing_refresh_run r where r.id=p_refresh_run_id and r.period_start=date_trunc('month',p_period_start)::date and r.valuation_date=p_valuation_date and r.valuation_context_source='CAPTURED_AT_REQUEST'
), line_acceptance as (
 select l.*, case when l.review_required_flag and l.required_missing_rate_block_flag is not true and costing.fn_material_review_acceptance_matches(
   p_period_start,p_valuation_date,l.stock_item_id,'PM',l.acceptance_issue_codes,l.acceptance_warning_codes,l.acceptance_action_required_summary,
   l.selected_rate,case when l.rate_source='LAST_PURCHASE' then 'LATEST_PURCHASE_RATE' else l.rate_source end,l.rate_date,l.selected_manual_rate_id,l.selected_purchase_fact_id,l.selected_stock_valuation_source
 ) then true else false end review_acceptance_active
 from costing.fn_build_sku_pm_cost_lines_as_of(p_period_start,p_valuation_date) l cross join ctx
), a as (
 select date_trunc('month',p_period_start)::date period_start,p_valuation_date valuation_date,sku_id,product_id,product_name,pack_size,pack_uom,
 count(*)::bigint pm_line_count,count(*) filter(where is_optional=false)::bigint required_pm_line_count,count(*) filter(where is_optional=true)::bigint optional_pm_line_count,
 count(*) filter(where approval_block_flag=true)::bigint blocking_missing_rate_line_count,count(distinct stock_item_id) filter(where approval_block_flag=true)::bigint blocking_missing_rate_item_count,
 count(*) filter(where action_required='OPTIONAL_MISSING_RATE')::bigint optional_missing_rate_line_count,
 count(*) filter(where rate_warning_code='STALE_PURCHASE_RATE')::bigint stale_purchase_rate_line_count,
 count(*) filter(where rate_warning_code='STOCK_VALUATION_FALLBACK')::bigint stock_valuation_fallback_line_count,
 count(*) filter(where rate_warning_code='MANUAL_RATE_USED')::bigint manual_rate_line_count,
 count(*) filter(where review_required_flag)::bigint review_rate_line_count,
 count(*) filter(where review_required_flag and review_acceptance_active)::bigint accepted_review_rate_line_count,
 count(*) filter(where review_required_flag and review_acceptance_active is not true)::bigint unaccepted_review_rate_line_count,
 sum(pm_cost_per_sku_line) filter(where pm_cost_per_sku_line is not null) calculated_pm_cost
 from line_acceptance group by sku_id,product_id,product_name,pack_size,pack_uom
)
select period_start,valuation_date,sku_id,product_id,product_name,pack_size,pack_uom,pm_line_count,required_pm_line_count,optional_pm_line_count,
 case when blocking_missing_rate_line_count>0 then null::numeric else calculated_pm_cost end,blocking_missing_rate_line_count,blocking_missing_rate_item_count,optional_missing_rate_line_count,stale_purchase_rate_line_count,stock_valuation_fallback_line_count,manual_rate_line_count,review_rate_line_count,
 case when blocking_missing_rate_line_count>0 then 'BLOCKED' when unaccepted_review_rate_line_count>0 then 'REVIEW_REQUIRED' else 'READY' end,
 case when blocking_missing_rate_line_count>0 then 'Packing material cost is incomplete because required PM items have missing or ambiguous rates.' when unaccepted_review_rate_line_count>0 then 'Packing material cost can be calculated, but review is required because fallback, stale, manual, or optional-missing rates are present.' when accepted_review_rate_line_count>0 then 'Packing material cost is ready because all review-required PM rate issues are actively accepted for this frozen valuation evidence.' else 'Packing material cost is ready.' end,
 accepted_review_rate_line_count,unaccepted_review_rate_line_count from a;
$$;