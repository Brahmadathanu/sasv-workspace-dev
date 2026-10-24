-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists costing.internal_source_material_review_queue_snapshot (
    id bigint generated always as identity primary key,
    period_start date not null,
    valuation_date date not null,
    refresh_run_id bigint not null references costing.costing_refresh_run(id) on update restrict on delete restrict,
    snapshot_refreshed_at timestamptz not null default now(),
    stock_item_id bigint not null,
    stock_item_code text,
    stock_item_name text,
    material_area text not null default 'RM' check (material_area='RM'),
    action_severity text not null default 'REVIEW_REQUIRED' check (action_severity='REVIEW_REQUIRED'),
    recommended_ui_route text not null default 'MATERIAL_RATE_REVIEW',
    issue_codes text not null,
    warning_codes text,
    action_required_summary text,
    action_note_summary text,
    selected_rate numeric,
    rate_source text,
    rate_date date,
    selected_manual_rate_id bigint,
    selected_purchase_fact_id bigint,
    selected_stock_valuation_source text,
    source_evidence_fingerprint text not null,
    source_product_ids bigint[] not null default array[]::bigint[],
    root_lineage_ids bigint[] not null default array[]::bigint[],
    root_consume_stock_item_ids bigint[] not null default array[]::bigint[],
    affected_source_product_count bigint not null default 0,
    affected_root_lineage_count bigint not null default 0,
    created_at timestamptz not null default now()
);

create unique index if not exists uq_internal_source_material_review_queue_exact
on costing.internal_source_material_review_queue_snapshot (
    period_start, valuation_date, refresh_run_id, stock_item_id,
    issue_codes, coalesce(warning_codes,''), coalesce(action_required_summary,''), source_evidence_fingerprint
);

create index if not exists ix_internal_source_material_review_queue_lookup
on costing.internal_source_material_review_queue_snapshot (
    period_start, stock_item_id, material_area, recommended_ui_route, snapshot_refreshed_at desc
);

create or replace function costing.fn_build_internal_source_material_review_actions_as_of(
    p_period_start date,
    p_valuation_date date
)
returns table(
    stock_item_id bigint,
    stock_item_code text,
    stock_item_name text,
    material_area text,
    action_severity text,
    recommended_ui_route text,
    issue_codes text,
    warning_codes text,
    action_required_summary text,
    action_note_summary text,
    selected_rate numeric,
    rate_source text,
    rate_date date,
    selected_manual_rate_id bigint,
    selected_purchase_fact_id bigint,
    selected_stock_valuation_source text,
    source_evidence_fingerprint text,
    source_product_ids bigint[],
    root_lineage_ids bigint[],
    root_consume_stock_item_ids bigint[],
    affected_source_product_count bigint,
    affected_root_lineage_count bigint
)
language sql
stable
security definer
set search_path='costing','public','pg_temp'
as $function$
with recursive
ctx as (
    select date_trunc('month',p_period_start)::date as period_start,
           p_valuation_date as valuation_date
),
lineage as materialized (
    select distinct on (l.consume_stock_item_id)
        l.id,l.consume_stock_item_id,l.source_product_id
    from costing.internal_material_source_lineage l
    where l.status='APPROVED'
      and l.effective_from<=p_valuation_date
      and (l.effective_to is null or l.effective_to>=p_valuation_date)
    order by l.consume_stock_item_id,l.effective_from desc,l.id desc
),
req as materialized (
    select * from costing.fn_build_product_rm_requirement_as_of(p_valuation_date)
),
walk as (
    select
        l.id as root_lineage_id,
        l.consume_stock_item_id as root_consume_stock_item_id,
        l.source_product_id as root_source_product_id,
        l.source_product_id as current_product_id,
        array[l.source_product_id]::bigint[] as product_path
    from lineage l
    union all
    select
        w.root_lineage_id,
        w.root_consume_stock_item_id,
        w.root_source_product_id,
        child.source_product_id,
        w.product_path||child.source_product_id
    from walk w
    join req r on r.product_id=w.current_product_id
    join lineage child on child.consume_stock_item_id=r.purchase_stock_item_id
    where not child.source_product_id=any(w.product_path)
      and r.qty_purchase_form_per_base_unit is not null
      and not coalesce(r.calculation_warning_flag,false)
),
terminal as materialized (
    select distinct
        w.root_lineage_id,
        w.root_consume_stock_item_id,
        w.current_product_id,
        r.purchase_stock_item_id,
        r.purchase_stock_item_name,
        coalesce(r.is_optional,false) as is_optional,
        coalesce(r.calculation_warning_flag,false) as calculation_warning_flag
    from walk w
    join req r on r.product_id=w.current_product_id
    where not exists (
        select 1 from lineage child
        where child.consume_stock_item_id=r.purchase_stock_item_id
    )
),
ids as (
    select array_agg(distinct t.purchase_stock_item_id order by t.purchase_stock_item_id)
      filter(where t.purchase_stock_item_id is not null) as stock_item_ids
    from terminal t
),
rates as materialized (
    select rr.*
    from ids
    cross join lateral costing.fn_resolve_material_rates_as_of(coalesce(ids.stock_item_ids,array[]::bigint[]),p_valuation_date) rr
),
classified as (
    select
        t.root_lineage_id,
        t.root_consume_stock_item_id,
        t.current_product_id,
        t.purchase_stock_item_id,
        t.purchase_stock_item_name,
        si.code as stock_item_code,
        r.selected_rate,r.rate_source,r.rate_date,
        r.selected_manual_rate_id,r.selected_purchase_fact_id,r.selected_stock_valuation_source,
        case
          when r.warning_code='STALE_PURCHASE_RATE' then 'STALE_RM_PURCHASE_RATE'
          when r.warning_code='STOCK_VALUATION_FALLBACK' then 'RM_STOCK_VALUATION_FALLBACK'
          when r.warning_code='MANUAL_RATE_USED' then 'RM_MANUAL_RATE_USED'
          when t.is_optional and r.selected_rate is null then 'OPTIONAL_RM_RATE_MISSING'
          else null::text
        end as issue_codes,
        case when r.warning_code is not null then r.warning_code end as warning_codes,
        case
          when t.is_optional and r.selected_rate is null then 'OPTIONAL_MISSING_RATE'
          when r.warning_code in ('STALE_PURCHASE_RATE','STOCK_VALUATION_FALLBACK','MANUAL_RATE_USED') then 'REVIEW_RATE'
          else null::text
        end as action_required_summary,
        case
          when t.is_optional and r.selected_rate is null then 'Optional source-product RM rate is missing.'
          when r.warning_code='STALE_PURCHASE_RATE' then format('Latest qualifying source-product RM purchase rate is dated %s, more than 180 days before valuation date %s.',r.rate_date,p_valuation_date)
          when r.warning_code='STOCK_VALUATION_FALLBACK' then format('Source-product RM stock valuation %s dated %s was used.',r.selected_stock_valuation_source,r.rate_date)
          when r.warning_code='MANUAL_RATE_USED' then format('Governed source-product RM manual rate %s effective from %s was used.',r.selected_rate,r.rate_date)
          else null::text
        end as action_note_summary
    from terminal t
    left join rates r on r.stock_item_id=t.purchase_stock_item_id
    left join public.inv_stock_item si on si.id=t.purchase_stock_item_id
    where not t.calculation_warning_flag
      and r.resolution_status is distinct from 'AMBIGUOUS'
      and (
        (t.is_optional and r.selected_rate is null)
        or (r.selected_rate is not null and coalesce(r.warning_flag,false))
      )
),
unaccepted as (
    select c.*
    from classified c
    cross join ctx
    where c.issue_codes is not null
      and not costing.fn_material_review_acceptance_matches(
        ctx.period_start,ctx.valuation_date,c.purchase_stock_item_id,'RM',
        c.issue_codes,c.warning_codes,c.action_required_summary,
        c.selected_rate,c.rate_source,c.rate_date,
        c.selected_manual_rate_id,c.selected_purchase_fact_id,c.selected_stock_valuation_source
      )
),
grouped as (
    select
        u.purchase_stock_item_id,
        max(u.stock_item_code) as stock_item_code,
        max(u.purchase_stock_item_name) as stock_item_name,
        u.issue_codes,u.warning_codes,u.action_required_summary,
        max(u.action_note_summary) as action_note_summary,
        u.selected_rate,u.rate_source,u.rate_date,
        u.selected_manual_rate_id,u.selected_purchase_fact_id,u.selected_stock_valuation_source,
        array_agg(distinct u.current_product_id order by u.current_product_id) as source_product_ids,
        array_agg(distinct u.root_lineage_id order by u.root_lineage_id) as root_lineage_ids,
        array_agg(distinct u.root_consume_stock_item_id order by u.root_consume_stock_item_id) as root_consume_stock_item_ids,
        count(distinct u.current_product_id)::bigint as affected_source_product_count,
        count(distinct u.root_lineage_id)::bigint as affected_root_lineage_count
    from unaccepted u
    group by
        u.purchase_stock_item_id,u.issue_codes,u.warning_codes,u.action_required_summary,
        u.selected_rate,u.rate_source,u.rate_date,
        u.selected_manual_rate_id,u.selected_purchase_fact_id,u.selected_stock_valuation_source
)
select
    g.purchase_stock_item_id,
    g.stock_item_code,
    g.stock_item_name,
    'RM'::text,
    'REVIEW_REQUIRED'::text,
    'MATERIAL_RATE_REVIEW'::text,
    g.issue_codes,
    g.warning_codes,
    g.action_required_summary,
    g.action_note_summary,
    g.selected_rate,g.rate_source,g.rate_date,
    g.selected_manual_rate_id,g.selected_purchase_fact_id,g.selected_stock_valuation_source,
    md5(concat_ws('|',
        coalesce(g.selected_rate::text,''),coalesce(g.rate_source,''),coalesce(g.rate_date::text,''),
        coalesce(g.selected_manual_rate_id::text,''),coalesce(g.selected_purchase_fact_id::text,''),
        coalesce(g.selected_stock_valuation_source,'')
    )) as source_evidence_fingerprint,
    g.source_product_ids,g.root_lineage_ids,g.root_consume_stock_item_ids,
    g.affected_source_product_count,g.affected_root_lineage_count
from grouped g
order by g.purchase_stock_item_id;
$function$;

create or replace function costing.rpc_refresh_internal_source_material_review_snapshot(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(refreshed_period_start date, valuation_date date, refresh_run_id bigint, inserted_row_count bigint, refresh_status text)
language plpgsql
security definer
set search_path='costing','public','pg_temp'
as $function$
declare
    v_period_start date := date_trunc('month',p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_refreshed_at timestamptz := clock_timestamp();
    v_rows bigint := 0;
begin
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    select r.* into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;
    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Internal-source material review context does not match refresh run %',p_refresh_run_id;
    end if;

    perform pg_advisory_xact_lock(hashtext('internal_source_material_review|'||p_refresh_run_id::text)::bigint);

    delete from costing.internal_source_material_review_queue_snapshot
    where period_start=v_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id;

    insert into costing.internal_source_material_review_queue_snapshot(
        period_start,valuation_date,refresh_run_id,snapshot_refreshed_at,
        stock_item_id,stock_item_code,stock_item_name,material_area,action_severity,recommended_ui_route,
        issue_codes,warning_codes,action_required_summary,action_note_summary,
        selected_rate,rate_source,rate_date,selected_manual_rate_id,selected_purchase_fact_id,selected_stock_valuation_source,
        source_evidence_fingerprint,source_product_ids,root_lineage_ids,root_consume_stock_item_ids,
        affected_source_product_count,affected_root_lineage_count
    )
    select
        v_period_start,p_valuation_date,p_refresh_run_id,v_refreshed_at,
        a.stock_item_id,a.stock_item_code,a.stock_item_name,a.material_area,a.action_severity,a.recommended_ui_route,
        a.issue_codes,a.warning_codes,a.action_required_summary,a.action_note_summary,
        a.selected_rate,a.rate_source,a.rate_date,a.selected_manual_rate_id,a.selected_purchase_fact_id,a.selected_stock_valuation_source,
        a.source_evidence_fingerprint,a.source_product_ids,a.root_lineage_ids,a.root_consume_stock_item_ids,
        a.affected_source_product_count,a.affected_root_lineage_count
    from costing.fn_build_internal_source_material_review_actions_as_of(v_period_start,p_valuation_date) a;

    get diagnostics v_rows=row_count;
    return query select v_period_start,p_valuation_date,p_refresh_run_id,v_rows,'SUCCESS'::text;
end;
$function$;

create or replace function costing.fn_apply_material_acceptance_source_context()
returns trigger
language plpgsql
security definer
set search_path='costing','public','pg_temp'
as $function$
declare
    v_queue record;
    v_evidence record;
    v_source record;
begin
    if new.acceptance_status <> 'ACTIVE' then return new; end if;

    select q.valuation_date,q.refresh_run_id,q.snapshot_refreshed_at
    into v_queue
    from costing.material_costing_action_queue_snapshot q
    where q.period_start=new.period_start
      and q.stock_item_id=new.stock_item_id
      and upper(q.material_area)=upper(new.material_area)
      and upper(q.recommended_ui_route)=upper(new.recommended_ui_route)
      and coalesce(q.issue_codes,'')=coalesce(new.issue_codes,'')
      and coalesce(q.warning_codes,'')=coalesce(new.warning_codes,'')
      and coalesce(q.action_required_summary,'')=coalesce(new.action_required_summary,'')
      and q.valuation_date is not null and q.refresh_run_id is not null
    order by q.snapshot_refreshed_at desc
    limit 1;

    if found then
        select
          min(d.selected_rate) as selected_rate,
          min(d.rate_source) as rate_source,
          min(d.rate_date) as rate_date,
          min(case when d.material_area='RM' then r.selected_manual_rate_id else p.selected_manual_rate_id end) as selected_manual_rate_id,
          min(case when d.material_area='RM' then r.selected_purchase_fact_id else p.selected_purchase_fact_id end) as selected_purchase_fact_id,
          min(case when d.material_area='RM' then r.selected_stock_valuation_source else p.selected_stock_valuation_source end) as selected_stock_valuation_source,
          count(distinct concat_ws('|',
            coalesce(d.selected_rate::text,''),coalesce(d.rate_source,''),coalesce(d.rate_date::text,''),
            coalesce((case when d.material_area='RM' then r.selected_manual_rate_id else p.selected_manual_rate_id end)::text,''),
            coalesce((case when d.material_area='RM' then r.selected_purchase_fact_id else p.selected_purchase_fact_id end)::text,''),
            coalesce(case when d.material_area='RM' then r.selected_stock_valuation_source else p.selected_stock_valuation_source end,'')
          )) as evidence_variant_count
        into v_evidence
        from costing.material_costing_action_drilldown_snapshot d
        left join costing.sku_rm_material_cost_line_snapshot r on d.frozen_source_type='RM' and r.id=d.frozen_rm_line_snapshot_id
        left join costing.sku_pm_material_cost_line_snapshot p on d.frozen_source_type='PM' and p.id=d.frozen_pm_line_snapshot_id
        where d.period_start=new.period_start
          and d.valuation_date=v_queue.valuation_date
          and d.refresh_run_id=v_queue.refresh_run_id
          and d.stock_item_id=new.stock_item_id
          and upper(d.material_area)=upper(new.material_area)
          and upper(d.recommended_ui_route)=upper(new.recommended_ui_route)
          and coalesce(d.material_issue_code,'')=any(string_to_array(coalesce(new.issue_codes,''),', '))
          and (new.warning_codes is null or coalesce(d.warning_code,'')=any(string_to_array(new.warning_codes,', ')))
          and (new.action_required_summary is null or coalesce(d.action_required,'')=any(string_to_array(new.action_required_summary,', ')));

        if coalesce(v_evidence.evidence_variant_count,0)<>1 then
            raise exception 'Material review acceptance requires exactly one selected-rate evidence tuple; found % variants',coalesce(v_evidence.evidence_variant_count,0);
        end if;

        new.source_valuation_date:=v_queue.valuation_date;
        new.source_refresh_run_id:=v_queue.refresh_run_id;
        new.source_snapshot_refreshed_at:=v_queue.snapshot_refreshed_at;
        new.source_selected_rate:=v_evidence.selected_rate;
        new.source_rate_source:=v_evidence.rate_source;
        new.source_rate_date:=v_evidence.rate_date;
        new.source_selected_manual_rate_id:=v_evidence.selected_manual_rate_id;
        new.source_selected_purchase_fact_id:=v_evidence.selected_purchase_fact_id;
        new.source_selected_stock_valuation_source:=v_evidence.selected_stock_valuation_source;
    else
        select s.* into v_source
        from costing.internal_source_material_review_queue_snapshot s
        where s.period_start=new.period_start
          and s.stock_item_id=new.stock_item_id
          and upper(s.material_area)=upper(new.material_area)
          and upper(s.recommended_ui_route)=upper(new.recommended_ui_route)
          and coalesce(s.issue_codes,'')=coalesce(new.issue_codes,'')
          and coalesce(s.warning_codes,'')=coalesce(new.warning_codes,'')
          and coalesce(s.action_required_summary,'')=coalesce(new.action_required_summary,'')
        order by s.snapshot_refreshed_at desc
        limit 1;

        if not found then raise exception 'Exact material action context was not found for acceptance'; end if;

        new.source_valuation_date:=v_source.valuation_date;
        new.source_refresh_run_id:=v_source.refresh_run_id;
        new.source_snapshot_refreshed_at:=v_source.snapshot_refreshed_at;
        new.source_selected_rate:=v_source.selected_rate;
        new.source_rate_source:=v_source.rate_source;
        new.source_rate_date:=v_source.rate_date;
        new.source_selected_manual_rate_id:=v_source.selected_manual_rate_id;
        new.source_selected_purchase_fact_id:=v_source.selected_purchase_fact_id;
        new.source_selected_stock_valuation_source:=v_source.selected_stock_valuation_source;
    end if;

    new.source_evidence_fingerprint:=md5(concat_ws('|',
        coalesce(new.source_selected_rate::text,''),coalesce(new.source_rate_source,''),coalesce(new.source_rate_date::text,''),
        coalesce(new.source_selected_manual_rate_id::text,''),coalesce(new.source_selected_purchase_fact_id::text,''),
        coalesce(new.source_selected_stock_valuation_source,'')
    ));
    return new;
end;
$function$;

create or replace function costing.rpc_accept_internal_source_material_review_action(
    p_period_start date,
    p_stock_item_id bigint,
    p_issue_codes text,
    p_warning_codes text,
    p_action_required_summary text,
    p_acceptance_reason text,
    p_acceptance_note text default null
)
returns table(acceptance_id bigint,period_start date,stock_item_id bigint,stock_item_name text,acceptance_status text,accepted_by uuid,accepted_at timestamptz,action_result text)
language plpgsql
security definer
set search_path='costing','public','pg_temp'
as $function$
#variable_conflict use_column
declare
    v_user_id uuid:=auth.uid();
    v_period_start date:=date_trunc('month',p_period_start)::date;
    v_reason text:=nullif(trim(coalesce(p_acceptance_reason,'')),'');
    v_note text:=nullif(trim(coalesce(p_acceptance_note,'')),'');
    v_action record;
    v_acceptance_id bigint;
begin
    if v_user_id is null then raise exception 'Not authenticated'; end if;
    if p_stock_item_id is null then raise exception 'stock_item_id is required'; end if;
    if v_reason is null or length(v_reason)<5 then raise exception 'Acceptance reason must be at least 5 characters'; end if;

    select s.* into v_action
    from costing.internal_source_material_review_queue_snapshot s
    where s.period_start=v_period_start
      and s.stock_item_id=p_stock_item_id
      and coalesce(s.issue_codes,'')=coalesce(p_issue_codes,'')
      and coalesce(s.warning_codes,'')=coalesce(p_warning_codes,'')
      and coalesce(s.action_required_summary,'')=coalesce(p_action_required_summary,'')
      and s.action_severity='REVIEW_REQUIRED'
    order by s.snapshot_refreshed_at desc
    limit 1;
    if not found then raise exception 'Matching internal-source material review action was not found'; end if;

    insert into costing.material_review_acceptance_register(
        period_start,stock_item_id,stock_item_code,stock_item_name,material_area,material_issue_code,recommended_ui_route,
        action_severity,issue_codes,warning_codes,action_required_summary,action_note_summary,bom_sources,material_line_statuses,
        affected_line_count,affected_product_count,affected_sku_count,approval_blocking_line_count,approval_blocking_sku_count,
        review_line_count,review_sku_count,acceptance_scope,acceptance_status,accepted_by,accepted_at,effective_from,effective_to,
        source_snapshot_refreshed_at,acceptance_reason,acceptance_note,created_at,updated_at
    ) values (
        v_period_start,v_action.stock_item_id,v_action.stock_item_code,v_action.stock_item_name,'RM',v_action.issue_codes,'MATERIAL_RATE_REVIEW',
        'REVIEW_REQUIRED',v_action.issue_codes,v_action.warning_codes,v_action.action_required_summary,v_action.action_note_summary,
        'INTERNAL_SOURCE_RM','REVIEW_REQUIRED',v_action.affected_root_lineage_count,v_action.affected_source_product_count,0,0,0,
        v_action.affected_root_lineage_count,0,'MATERIAL_ACTION','ACTIVE',v_user_id,now(),v_period_start,null,
        v_action.snapshot_refreshed_at,v_reason,v_note,now(),now()
    )
    on conflict (
        period_start,stock_item_id,material_area,recommended_ui_route,
        coalesce(issue_codes,''),coalesce(warning_codes,''),coalesce(action_required_summary,'')
    ) where acceptance_status='ACTIVE'
    do update set
        stock_item_code=excluded.stock_item_code,
        stock_item_name=excluded.stock_item_name,
        accepted_by=excluded.accepted_by,
        accepted_at=excluded.accepted_at,
        source_snapshot_refreshed_at=excluded.source_snapshot_refreshed_at,
        acceptance_reason=excluded.acceptance_reason,
        acceptance_note=excluded.acceptance_note,
        updated_at=now()
    returning material_review_acceptance_register.acceptance_id into v_acceptance_id;

    return query
    select r.acceptance_id,r.period_start,r.stock_item_id,r.stock_item_name,r.acceptance_status,r.accepted_by,r.accepted_at,'ACCEPTED'::text
    from costing.material_review_acceptance_register r where r.acceptance_id=v_acceptance_id;
end;
$function$;

create or replace function costing.rpc_refresh_costing_control_summary_snapshots(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
returns table(refreshed_period_start date, dashboard_rows_inserted bigint, sku_rows_inserted bigint, queue_rows_inserted bigint, audit_rows_inserted bigint, blocked_count bigint, review_required_count bigint, ready_count bigint, refresh_status text)
language plpgsql
security definer
set search_path='costing','public','pg_temp'
as $function$
declare
    v_period_start date:=date_trunc('month',p_period_start)::date;
    v_sku record; v_action record; v_dashboard record; v_audit record;
begin
    select * into v_sku from costing.rpc_refresh_exact_sku_control_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
    select * into v_action from costing.rpc_refresh_exact_material_action_review_snapshots(v_period_start,p_valuation_date,p_refresh_run_id);
    perform * from costing.rpc_refresh_internal_source_material_review_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
    select * into v_dashboard from costing.rpc_refresh_exact_costing_control_dashboard(v_period_start,p_valuation_date,p_refresh_run_id);
    select * into v_audit from costing.rpc_refresh_exact_costing_control_integrity_audit(v_period_start,p_valuation_date,p_refresh_run_id);
    return query select v_period_start,v_dashboard.dashboard_rows_inserted,v_sku.inserted_row_count,v_action.material_queue_rows,v_audit.audit_rows_inserted,v_dashboard.blocked_sku_count,v_dashboard.review_required_sku_count,v_dashboard.ready_sku_count,'SUCCESS'::text;
end;
$function$;