-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

create or replace view costing.v_regional_marketing_action_queue_current
as
with current_run as (
    select refresh_run_id, period_start, valuation_date
    from costing.v_current_successful_costing_refresh_run
), persisted as (
    select q.*
    from costing.regional_marketing_action_queue_snapshot q
    join current_run r on r.refresh_run_id = q.refresh_run_id
), fallback as (
    select
        null::bigint as id,
        b.period_start,
        b.valuation_date,
        b.refresh_run_id,
        b.id as regional_basis_snapshot_id,
        b.sku_id,
        b.product_id,
        b.product_name,
        b.pack_size,
        b.pack_uom,
        b.region_id,
        b.region_code,
        'BLOCKER'::text as action_severity,
        case
            when b.regional_basis_source in ('NO_POSITIVE_PRODUCT_REGION_PHYSICAL_SHARE','AMBIGUOUS_REGIONAL_ASSUMPTION') then 1
            when b.regional_basis_source = 'NO_PRODUCT_REGION_MONETARY_SOURCE' then 2
            else 3
        end as action_priority,
        case
            when b.regional_basis_source = 'NO_POSITIVE_PRODUCT_REGION_PHYSICAL_SHARE' then 'CREATE_REGIONAL_PHYSICAL_ASSUMPTION'
            when b.regional_basis_source = 'AMBIGUOUS_REGIONAL_ASSUMPTION' then 'RESOLVE_AMBIGUOUS_REGIONAL_ASSUMPTION'
            when b.regional_basis_source = 'NO_PRODUCT_REGION_MONETARY_SOURCE' then 'CREATE_REGIONAL_COMMERCIAL_ASSUMPTION'
            when b.regional_basis_source = 'INVALID_COMMON_BASIS' then 'CORRECT_COMMON_ALLOCATION_BASIS'
            else 'REVIEW_REGIONAL_MARKETING_BASIS'
        end as action_code,
        'PRICING_POLICY_MANAGER_REGIONAL_ASSUMPTION'::text as recommended_ui_route,
        case
            when b.regional_basis_source = 'NO_POSITIVE_PRODUCT_REGION_PHYSICAL_SHARE'
                then 'Create or approve a region-specific SKU commercial-sales assumption to provide a positive physical allocation quantity. Actual monetary evidence remains authoritative.'
            when b.regional_basis_source = 'AMBIGUOUS_REGIONAL_ASSUMPTION'
                then 'Close or supersede competing regional assumption revisions so exactly one revision is visible at the next refresh cutoff.'
            when b.regional_basis_source = 'NO_PRODUCT_REGION_MONETARY_SOURCE'
                then 'Create and approve a region-specific commercial-sales assumption with paid quantity and governed commercial value, then request a new costing refresh.'
            when b.regional_basis_source = 'INVALID_COMMON_BASIS'
                then 'Correct the governed common SKU allocation basis before requesting another costing refresh.'
            else 'Review and resolve the regional Marketing basis blocker before requesting another costing refresh.'
        end as recommended_action,
        case
            when b.regional_basis_source = 'NO_POSITIVE_PRODUCT_REGION_PHYSICAL_SHARE'
                then concat('The product has eligible ', b.region_code, ' commercial evidence but no positive current-recipient physical quantity. ', b.regional_basis_note)
            when b.regional_basis_source = 'NO_PRODUCT_REGION_MONETARY_SOURCE'
                then concat('The product has no eligible ', b.region_code, ' commercial evidence and no visible governed regional assumption. ', b.regional_basis_note)
            else b.regional_basis_note
        end as action_note,
        b.regional_basis_source,
        b.regional_basis_status,
        b.regional_basis_note,
        b.assumption_resolution_status,
        b.assumption_resolution_note,
        b.regional_assumption_id,
        b.common_resolved_units,
        b.common_resolved_base_qty,
        b.regional_actual_evidence_row_count,
        b.regional_actual_units,
        b.regional_billed_units,
        b.regional_billed_value,
        b.product_region_actual_evidence_row_count,
        b.product_region_actual_signed_billed_value,
        b.product_regional_positive_actual_share,
        m.marketing_expense_allocation_status as current_marketing_allocation_status,
        m.marketing_expense_cost_per_sku_region as current_marketing_cost_per_sku_region,
        case when b.region_code='IK' then pb.pricing_bridge_status_ik else pb.pricing_bridge_status_ok end as current_pricing_bridge_status,
        case when b.region_code='IK' then sp.selling_price_bridge_status_ik else sp.selling_price_bridge_status_ok end as current_selling_price_bridge_status,
        greatest(b.refreshed_at, coalesce(m.refreshed_at,b.refreshed_at)) as snapshot_refreshed_at
    from costing.sku_regional_marketing_allocation_basis_snapshot b
    join current_run r on r.refresh_run_id = b.refresh_run_id
    left join costing.sku_regional_marketing_expense_allocation_snapshot m
      on m.refresh_run_id=b.refresh_run_id and m.sku_id=b.sku_id and m.region_code=b.region_code
    left join costing.sku_pricing_bridge_snapshot pb
      on pb.refresh_run_id=b.refresh_run_id and pb.sku_id=b.sku_id
    left join costing.sku_selling_price_bridge_snapshot sp
      on sp.refresh_run_id=b.refresh_run_id and sp.sku_id=b.sku_id
    where b.regional_basis_status='BLOCKED'
      and not exists (
          select 1
          from persisted p
          where p.refresh_run_id=b.refresh_run_id
      )
)
select * from persisted
union all
select * from fallback;

comment on view costing.v_regional_marketing_action_queue_current is
'Current successful regional Marketing blocker queue. Uses the immutable Stage 05 queue snapshot when available; for the pre-integration current run only, derives an equivalent projection from immutable current-run regional basis and downstream snapshots. The next governed refresh persists the queue.';

commit;