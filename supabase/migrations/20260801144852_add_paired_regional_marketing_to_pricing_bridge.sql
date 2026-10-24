-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table costing.sku_pricing_bridge_snapshot
    add column if not exists regional_marketing_allocation_snapshot_id_ik bigint,
    add column if not exists regional_marketing_allocation_snapshot_id_ok bigint,
    add column if not exists marketing_expense_cost_per_sku_ik numeric,
    add column if not exists marketing_expense_cost_per_sku_ok numeric,
    add column if not exists pricing_cost_per_sku_ik numeric,
    add column if not exists pricing_cost_per_sku_ok numeric,
    add column if not exists marketing_expense_allocation_status_ik text,
    add column if not exists marketing_expense_allocation_status_ok text,
    add column if not exists pricing_bridge_status_ik text,
    add column if not exists pricing_bridge_status_ok text,
    add column if not exists pricing_bridge_note_ik text,
    add column if not exists pricing_bridge_note_ok text;

alter table costing.sku_pricing_bridge_snapshot
    drop constraint if exists sku_pricing_bridge_regional_marketing_ik_fk,
    add constraint sku_pricing_bridge_regional_marketing_ik_fk
        foreign key (regional_marketing_allocation_snapshot_id_ik)
        references costing.sku_regional_marketing_expense_allocation_snapshot(id),
    drop constraint if exists sku_pricing_bridge_regional_marketing_ok_fk,
    add constraint sku_pricing_bridge_regional_marketing_ok_fk
        foreign key (regional_marketing_allocation_snapshot_id_ok)
        references costing.sku_regional_marketing_expense_allocation_snapshot(id),
    drop constraint if exists sku_pricing_bridge_status_ik_chk,
    add constraint sku_pricing_bridge_status_ik_chk
        check (pricing_bridge_status_ik is null or pricing_bridge_status_ik in ('READY','REVIEW_REQUIRED','BLOCKED')),
    drop constraint if exists sku_pricing_bridge_status_ok_chk,
    add constraint sku_pricing_bridge_status_ok_chk
        check (pricing_bridge_status_ok is null or pricing_bridge_status_ok in ('READY','REVIEW_REQUIRED','BLOCKED')),
    drop constraint if exists sku_pricing_bridge_marketing_status_ik_chk,
    add constraint sku_pricing_bridge_marketing_status_ik_chk
        check (marketing_expense_allocation_status_ik is null or marketing_expense_allocation_status_ik in ('READY','REVIEW_REQUIRED','BLOCKED')),
    drop constraint if exists sku_pricing_bridge_marketing_status_ok_chk,
    add constraint sku_pricing_bridge_marketing_status_ok_chk
        check (marketing_expense_allocation_status_ok is null or marketing_expense_allocation_status_ok in ('READY','REVIEW_REQUIRED','BLOCKED'));

create index if not exists idx_sku_pricing_bridge_regional_marketing_ik
on costing.sku_pricing_bridge_snapshot (regional_marketing_allocation_snapshot_id_ik);

create index if not exists idx_sku_pricing_bridge_regional_marketing_ok
on costing.sku_pricing_bridge_snapshot (regional_marketing_allocation_snapshot_id_ok);

create or replace function costing.rpc_refresh_sku_pricing_bridge_snapshot(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table (
    refreshed_period_start date,
    inserted_row_count bigint,
    blocked_count bigint,
    review_required_count bigint,
    ready_count bigint
)
language plpgsql
security definer
set search_path = costing, public, pg_temp
as $function$
declare
    v_period_start date := date_trunc('month',p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_ilc_count bigint;
    v_ilc_distinct_sku_count bigint;
    v_marketing_count bigint;
    v_marketing_distinct_sku_count bigint;
    v_regional_count bigint;
    v_regional_distinct_key_count bigint;
    v_regional_distinct_sku_count bigint;
    v_missing_marketing_sku_count bigint;
    v_extra_marketing_sku_count bigint;
    v_missing_regional_sku_count bigint;
    v_lineage_mismatch_count bigint;
begin
    if p_period_start is null then raise exception 'Costing period is required'; end if;
    if p_valuation_date is null then raise exception 'Valuation date is required'; end if;
    if p_refresh_run_id is null then raise exception 'Refresh run ID is required'; end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id=p_refresh_run_id;

    if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;
    if v_run.period_start is distinct from v_period_start then
        raise exception 'Pricing period % does not match refresh run % period %',v_period_start,p_refresh_run_id,v_run.period_start;
    end if;
    if v_run.valuation_date is distinct from p_valuation_date then
        raise exception 'Pricing valuation date % does not match refresh run % valuation date %',p_valuation_date,p_refresh_run_id,v_run.valuation_date;
    end if;
    if v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Refresh run % is not based on captured-at-request valuation context',p_refresh_run_id;
    end if;
    if p_valuation_date < v_period_start or p_valuation_date >= (v_period_start+interval '1 month')::date then
        raise exception 'Valuation date % is outside costing period %',p_valuation_date,v_period_start;
    end if;

    perform * from costing.rpc_ensure_cost_period(v_period_start);

    select count(*)::bigint,count(distinct ilc.sku_id)::bigint
    into v_ilc_count,v_ilc_distinct_sku_count
    from costing.sku_internal_loaded_cost_snapshot ilc
    where ilc.period_start=v_period_start and ilc.valuation_date=p_valuation_date and ilc.refresh_run_id=p_refresh_run_id;

    if v_ilc_count=0 or v_ilc_count<>v_ilc_distinct_sku_count then
        raise exception 'Internal-loaded-cost snapshot is missing or contains duplicate SKU rows for refresh run %',p_refresh_run_id;
    end if;

    select count(*)::bigint,count(distinct m.sku_id)::bigint
    into v_marketing_count,v_marketing_distinct_sku_count
    from costing.sku_marketing_expense_allocation_snapshot m
    where m.period_start=v_period_start and m.valuation_date=p_valuation_date and m.refresh_run_id=p_refresh_run_id;

    if v_marketing_count=0 or v_marketing_count<>v_marketing_distinct_sku_count then
        raise exception 'Common Marketing snapshot is missing or contains duplicate SKU rows for refresh run %',p_refresh_run_id;
    end if;

    select count(*)::bigint,
           count(distinct (m.sku_id,m.region_code))::bigint,
           count(distinct m.sku_id)::bigint
    into v_regional_count,v_regional_distinct_key_count,v_regional_distinct_sku_count
    from costing.sku_regional_marketing_expense_allocation_snapshot m
    where m.period_start=v_period_start and m.valuation_date=p_valuation_date and m.refresh_run_id=p_refresh_run_id;

    if v_regional_count=0
       or v_regional_count<>v_regional_distinct_key_count
       or v_regional_count<>v_regional_distinct_sku_count*2 then
        raise exception 'Regional Marketing snapshot is missing or does not contain exactly one IK and one OK row per SKU for refresh run %',p_refresh_run_id;
    end if;

    select count(*)::bigint into v_missing_marketing_sku_count
    from (
        select sku_id from costing.sku_internal_loaded_cost_snapshot where refresh_run_id=p_refresh_run_id
        except
        select sku_id from costing.sku_marketing_expense_allocation_snapshot where refresh_run_id=p_refresh_run_id
    ) x;

    select count(*)::bigint into v_extra_marketing_sku_count
    from (
        select sku_id from costing.sku_marketing_expense_allocation_snapshot where refresh_run_id=p_refresh_run_id
        except
        select sku_id from costing.sku_internal_loaded_cost_snapshot where refresh_run_id=p_refresh_run_id
    ) x;

    select count(*)::bigint into v_missing_regional_sku_count
    from (
        select sku_id from costing.sku_internal_loaded_cost_snapshot where refresh_run_id=p_refresh_run_id
        except
        select sku_id from costing.sku_regional_marketing_expense_allocation_snapshot where refresh_run_id=p_refresh_run_id group by sku_id having count(*)=2
    ) x;

    if v_missing_marketing_sku_count>0 or v_extra_marketing_sku_count>0 or v_missing_regional_sku_count>0 then
        raise exception 'Pricing Bridge upstream SKU sets differ for refresh run %: common missing %, common extra %, regional missing %',p_refresh_run_id,v_missing_marketing_sku_count,v_extra_marketing_sku_count,v_missing_regional_sku_count;
    end if;

    select count(*)::bigint into v_lineage_mismatch_count
    from costing.sku_internal_loaded_cost_snapshot ilc
    join costing.sku_marketing_expense_allocation_snapshot m
      on m.refresh_run_id=ilc.refresh_run_id and m.sku_id=ilc.sku_id
    where ilc.refresh_run_id=p_refresh_run_id
      and (ilc.allocation_basis_snapshot_id is null
        or m.allocation_basis_snapshot_id is null
        or ilc.allocation_basis_snapshot_id is distinct from m.allocation_basis_snapshot_id
        or ilc.allocation_basis_source is distinct from m.allocation_basis_source
        or ilc.allocation_resolution_status is distinct from m.allocation_resolution_status);

    if v_lineage_mismatch_count>0 then
        raise exception '% Pricing Bridge upstream rows have inconsistent common allocation lineage for refresh run %',v_lineage_mismatch_count,p_refresh_run_id;
    end if;

    delete from costing.sku_pricing_bridge_snapshot s where s.refresh_run_id=p_refresh_run_id;

    insert into costing.sku_pricing_bridge_snapshot (
        period_start,valuation_date,refresh_run_id,
        internal_loaded_cost_snapshot_id,marketing_expense_allocation_snapshot_id,
        regional_marketing_allocation_snapshot_id_ik,regional_marketing_allocation_snapshot_id_ok,
        allocation_basis_snapshot_id,allocation_basis_source,allocation_resolution_status,allocation_resolution_note,
        sku_id,product_id,product_name,pack_size,pack_uom,
        mrp_ik,mrp_ok,
        mrp_policy_id,mrp_policy_effective_from,mrp_policy_effective_to,
        mrp_resolution_status,mrp_qualifying_policy_count,mrp_resolution_note,
        manufacturing_cop_per_sku,internal_loaded_cost_per_sku,
        marketing_expense_cost_per_sku,
        marketing_expense_cost_per_sku_ik,marketing_expense_cost_per_sku_ok,
        pricing_cost_per_sku,
        pricing_cost_per_sku_ik,pricing_cost_per_sku_ok,
        ik_margin_amount_before_scheme,ok_margin_amount_before_scheme,
        ik_margin_percent_before_scheme,ok_margin_percent_before_scheme,
        internal_loaded_cost_status,marketing_expense_allocation_status,
        marketing_expense_allocation_status_ik,marketing_expense_allocation_status_ok,
        pricing_bridge_status_ik,pricing_bridge_status_ok,
        pricing_bridge_note_ik,pricing_bridge_note_ok,
        pricing_bridge_status,pricing_bridge_note,refreshed_at
    )
    with regional as materialized (
        select
            r.sku_id,
            max(r.id) filter (where r.region_code='IK') as ik_id,
            max(r.id) filter (where r.region_code='OK') as ok_id,
            max(r.marketing_expense_cost_per_sku_region) filter (where r.region_code='IK') as ik_cost,
            max(r.marketing_expense_cost_per_sku_region) filter (where r.region_code='OK') as ok_cost,
            max(r.marketing_expense_allocation_status) filter (where r.region_code='IK') as ik_status,
            max(r.marketing_expense_allocation_status) filter (where r.region_code='OK') as ok_status,
            max(r.marketing_expense_allocation_note) filter (where r.region_code='IK') as ik_note,
            max(r.marketing_expense_allocation_note) filter (where r.region_code='OK') as ok_note
        from costing.sku_regional_marketing_expense_allocation_snapshot r
        where r.period_start=v_period_start and r.valuation_date=p_valuation_date and r.refresh_run_id=p_refresh_run_id
        group by r.sku_id
    )
    select
        ilc.period_start,ilc.valuation_date,ilc.refresh_run_id,
        ilc.id,m.id,
        r.ik_id,r.ok_id,
        ilc.allocation_basis_snapshot_id,ilc.allocation_basis_source,ilc.allocation_resolution_status,
        coalesce(ilc.allocation_resolution_note,m.allocation_resolution_note),
        ilc.sku_id,ilc.product_id,ilc.product_name,ilc.pack_size,ilc.pack_uom,
        mrp.mrp_ik,mrp.mrp_ok,
        mrp.policy_id,mrp.effective_from,mrp.effective_to,
        mrp.resolution_status,mrp.qualifying_policy_count,mrp.resolution_note,
        ilc.manufacturing_cop_per_sku,ilc.internal_loaded_cost_per_sku,
        m.marketing_expense_cost_per_sku,
        r.ik_cost,r.ok_cost,
        case when ilc.internal_loaded_cost_per_sku is null or m.marketing_expense_cost_per_sku is null then null::numeric
             else ilc.internal_loaded_cost_per_sku+m.marketing_expense_cost_per_sku end,
        case when ilc.internal_loaded_cost_per_sku is null or r.ik_cost is null then null::numeric
             else ilc.internal_loaded_cost_per_sku+r.ik_cost end,
        case when ilc.internal_loaded_cost_per_sku is null or r.ok_cost is null then null::numeric
             else ilc.internal_loaded_cost_per_sku+r.ok_cost end,
        case when mrp.mrp_ik is null or ilc.internal_loaded_cost_per_sku is null or r.ik_cost is null then null::numeric
             else mrp.mrp_ik-(ilc.internal_loaded_cost_per_sku+r.ik_cost) end,
        case when mrp.mrp_ok is null or ilc.internal_loaded_cost_per_sku is null or r.ok_cost is null then null::numeric
             else mrp.mrp_ok-(ilc.internal_loaded_cost_per_sku+r.ok_cost) end,
        case when mrp.mrp_ik is null or mrp.mrp_ik<=0 or ilc.internal_loaded_cost_per_sku is null or r.ik_cost is null then null::numeric
             else (mrp.mrp_ik-(ilc.internal_loaded_cost_per_sku+r.ik_cost))/mrp.mrp_ik*100 end,
        case when mrp.mrp_ok is null or mrp.mrp_ok<=0 or ilc.internal_loaded_cost_per_sku is null or r.ok_cost is null then null::numeric
             else (mrp.mrp_ok-(ilc.internal_loaded_cost_per_sku+r.ok_cost))/mrp.mrp_ok*100 end,
        ilc.internal_loaded_cost_status,m.marketing_expense_allocation_status,
        r.ik_status,r.ok_status,
        case
            when ilc.internal_loaded_cost_status='BLOCKED' or ilc.internal_loaded_cost_per_sku is null then 'BLOCKED'
            when r.ik_status='BLOCKED' or r.ik_cost is null then 'BLOCKED'
            when mrp.resolution_status in ('MISSING','AMBIGUOUS') then 'BLOCKED'
            when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' or r.ik_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
            else 'READY'
        end,
        case
            when ilc.internal_loaded_cost_status='BLOCKED' or ilc.internal_loaded_cost_per_sku is null then 'BLOCKED'
            when r.ok_status='BLOCKED' or r.ok_cost is null then 'BLOCKED'
            when mrp.resolution_status in ('MISSING','AMBIGUOUS') then 'BLOCKED'
            when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' or r.ok_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
            else 'READY'
        end,
        case
            when ilc.internal_loaded_cost_status='BLOCKED' or ilc.internal_loaded_cost_per_sku is null then 'IK pricing is blocked because internal loaded cost is blocked or missing.'
            when r.ik_status='BLOCKED' or r.ik_cost is null then concat('IK pricing is blocked because regional Marketing cost is blocked or missing. ',coalesce(r.ik_note,''))
            when mrp.resolution_status='MISSING' then 'IK pricing is blocked because no approved SKU MRP policy is effective on the frozen valuation date.'
            when mrp.resolution_status='AMBIGUOUS' then 'IK pricing is blocked because multiple approved SKU MRP policies overlap on the frozen valuation date.'
            when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' or r.ik_status='REVIEW_REQUIRED' then 'IK pricing is calculable but requires review because one or more regional cost components require review.'
            else 'IK pricing bridge is ready.'
        end,
        case
            when ilc.internal_loaded_cost_status='BLOCKED' or ilc.internal_loaded_cost_per_sku is null then 'OK pricing is blocked because internal loaded cost is blocked or missing.'
            when r.ok_status='BLOCKED' or r.ok_cost is null then concat('OK pricing is blocked because regional Marketing cost is blocked or missing. ',coalesce(r.ok_note,''))
            when mrp.resolution_status='MISSING' then 'OK pricing is blocked because no approved SKU MRP policy is effective on the frozen valuation date.'
            when mrp.resolution_status='AMBIGUOUS' then 'OK pricing is blocked because multiple approved SKU MRP policies overlap on the frozen valuation date.'
            when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' or r.ok_status='REVIEW_REQUIRED' then 'OK pricing is calculable but requires review because one or more regional cost components require review.'
            else 'OK pricing bridge is ready.'
        end,
        case
            when (case when ilc.internal_loaded_cost_status='BLOCKED' or ilc.internal_loaded_cost_per_sku is null or r.ik_status='BLOCKED' or r.ik_cost is null or mrp.resolution_status in ('MISSING','AMBIGUOUS') then 'BLOCKED' when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' or r.ik_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' else 'READY' end)='BLOCKED'
              or (case when ilc.internal_loaded_cost_status='BLOCKED' or ilc.internal_loaded_cost_per_sku is null or r.ok_status='BLOCKED' or r.ok_cost is null or mrp.resolution_status in ('MISSING','AMBIGUOUS') then 'BLOCKED' when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' or r.ok_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' else 'READY' end)='BLOCKED'
                then 'BLOCKED'
            when ilc.internal_loaded_cost_status='REVIEW_REQUIRED' or r.ik_status='REVIEW_REQUIRED' or r.ok_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
            else 'READY'
        end,
        'Pricing Bridge now uses paired canonical regional Marketing costs for IK and OK. The legacy common Marketing and pricing-cost fields are retained as compatibility projections.',
        clock_timestamp()
    from costing.sku_internal_loaded_cost_snapshot ilc
    join costing.sku_marketing_expense_allocation_snapshot m
      on m.period_start=ilc.period_start and m.valuation_date=ilc.valuation_date and m.refresh_run_id=ilc.refresh_run_id and m.sku_id=ilc.sku_id
    join regional r on r.sku_id=ilc.sku_id
    cross join lateral costing.fn_resolve_sku_mrp_as_of(ilc.sku_id,p_valuation_date) mrp
    where ilc.period_start=v_period_start and ilc.valuation_date=p_valuation_date and ilc.refresh_run_id=p_refresh_run_id;

    return query
    select v_period_start,
           count(*)::bigint,
           count(*) filter (where s.pricing_bridge_status='BLOCKED')::bigint,
           count(*) filter (where s.pricing_bridge_status='REVIEW_REQUIRED')::bigint,
           count(*) filter (where s.pricing_bridge_status='READY')::bigint
    from costing.sku_pricing_bridge_snapshot s
    where s.period_start=v_period_start and s.valuation_date=p_valuation_date and s.refresh_run_id=p_refresh_run_id;
end;
$function$;

alter function costing.rpc_refresh_sku_pricing_bridge_snapshot(date,date,bigint) owner to postgres;
revoke all on function costing.rpc_refresh_sku_pricing_bridge_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_pricing_bridge_snapshot(date,date,bigint) to postgres;

comment on column costing.sku_pricing_bridge_snapshot.marketing_expense_cost_per_sku_ik is 'Canonical IK regional Marketing cost per SKU.';
comment on column costing.sku_pricing_bridge_snapshot.marketing_expense_cost_per_sku_ok is 'Canonical OK regional Marketing cost per SKU.';
comment on column costing.sku_pricing_bridge_snapshot.pricing_cost_per_sku_ik is 'Canonical IK pricing cost: internal loaded cost plus IK regional Marketing cost.';
comment on column costing.sku_pricing_bridge_snapshot.pricing_cost_per_sku_ok is 'Canonical OK pricing cost: internal loaded cost plus OK regional Marketing cost.';
comment on column costing.sku_pricing_bridge_snapshot.pricing_cost_per_sku is 'Legacy compatibility projection using the company-common Marketing allocation. Regional pricing must use pricing_cost_per_sku_ik or pricing_cost_per_sku_ok.';

commit;