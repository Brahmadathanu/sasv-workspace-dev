-- RM / PEQ single-source-of-truth patch
-- Date: 2026-05-01
--
-- Goal:
-- 1) Define one server predicate for actionable RM issue allocation.
-- 2) Use it in RM status snapshot semantics.
-- 3) Use the same semantics in RM allocation console batch LIST mode.
-- 4) Make PEQ snapshot consume normalized RM status semantics.
--
-- Apply in order on the server.

begin;

-- ---------------------------------------------------------------------------
-- A. Canonical predicate: actionable RM issue allocation exists
-- ---------------------------------------------------------------------------
create or replace function public.rm_issue_actionable_exists(
  p_horizon_start date,
  p_product_id bigint,
  p_batch_number text,
  p_rm_stock_item_id bigint
)
returns boolean
language sql
stable
as $function$
  select exists (
    select 1
    from public.mrp_rm_issue_lines l
    where date_trunc('month', l.issue_date)::date = p_horizon_start
      and l.rm_stock_item_id = p_rm_stock_item_id
      and coalesce(l.qty_issued, 0) > 0
      and (
        -- unresolved lines already targeting this batch/product
        (
          l.product_id = p_product_id
          and l.batch_number = p_batch_number
          and coalesce(l.allocation_status, 'unassigned') in (
            'unassigned', 'by_batch', 'by_product', 'by_sku'
          )
        )
        or
        -- clean unmapped pool that can be assigned safely
        (
          l.product_id is null
          and coalesce(l.batch_number, '') = ''
          and coalesce(l.allocation_status, 'unassigned') = 'unassigned'
        )
      )
  );
$function$;

comment on function public.rm_issue_actionable_exists(date, bigint, text, bigint)
is 'Canonical RM issue actionability predicate used by both PEQ and RM allocation. True only when clean or target-resolvable issue lines exist for the month/batch/RM item.';

-- ---------------------------------------------------------------------------
-- B. RM status snapshot refresh: use canonical actionability predicate
-- ---------------------------------------------------------------------------
create or replace function public.refresh_rm_status_from_reservation_current_month()
returns void
language plpgsql
as $function$
declare
  v_month_start date := date_trunc('month', current_date)::date;
begin
  insert into public.rm_status_snapshot_current_month (
    month_start,
    product_id,
    batch_number,
    rm_stock_item_id,
    rm_name,
    rm_uom,
    planned_rm_qty,
    issued_rm_qty,
    stock_qty,
    required_from_stock_qty,
    higher_priority_required_qty,
    available_before_reservation,
    reserved_qty,
    uncovered_qty,
    is_optional_rm,
    rm_procurement_mode,
    has_unassigned_issues,
    is_blocking_line,
    rm_status_class,
    rm_status_reason,
    refreshed_at
  )
  with reservation_dedup as (
    select
      r.month_start,
      r.product_id,
      r.batch_number,
      r.rm_stock_item_id,
      max(r.rm_name) as rm_name,
      max(r.rm_uom) as rm_uom,
      max(coalesce(r.planned_rm_qty, 0)) as planned_rm_qty,
      max(coalesce(r.issued_rm_qty, 0)) as issued_rm_qty,
      max(coalesce(r.stock_qty_current, 0)) as stock_qty,
      max(coalesce(r.required_from_stock_qty, 0)) as required_from_stock_qty,
      max(coalesce(r.higher_priority_required_qty, 0)) as higher_priority_required_qty,
      max(coalesce(r.available_before_reservation, 0)) as available_before_reservation,
      max(coalesce(r.reserved_qty, 0)) as reserved_qty,
      max(coalesce(r.uncovered_qty, 0)) as uncovered_qty,
      bool_or(coalesce(r.is_blocking_after_reservation, false)) as is_blocking_after_reservation
    from public.rm_reservation_snapshot_current_month r
    where r.month_start = v_month_start
    group by
      r.month_start,
      r.product_id,
      r.batch_number,
      r.rm_stock_item_id
  ),
  base as (
    select
      r.month_start,
      r.product_id,
      r.batch_number,
      r.rm_stock_item_id,
      r.rm_name,
      r.rm_uom,
      r.planned_rm_qty,
      coalesce(r.issued_rm_qty, 0) as issued_rm_qty,
      coalesce(r.stock_qty_current, 0) as stock_qty,
      coalesce(r.required_from_stock_qty, 0) as required_from_stock_qty,
      coalesce(r.higher_priority_required_qty, 0) as higher_priority_required_qty,
      coalesce(r.available_before_reservation, 0) as available_before_reservation,
      coalesce(r.reserved_qty, 0) as reserved_qty,
      coalesce(r.uncovered_qty, 0) as uncovered_qty,
      false::boolean as is_optional_rm,
      'stock_required'::text as rm_procurement_mode,
      coalesce(r.is_blocking_after_reservation, false) as is_blocking_after_reservation,
      public.rm_issue_actionable_exists(
        r.month_start,
        r.product_id,
        r.batch_number,
        r.rm_stock_item_id
      ) as has_actionable_issue
    from reservation_dedup r
  )
  select
    b.month_start,
    b.product_id,
    b.batch_number,
    b.rm_stock_item_id,
    b.rm_name,
    b.rm_uom,
    b.planned_rm_qty,
    b.issued_rm_qty,
    b.stock_qty,
    b.required_from_stock_qty,
    b.higher_priority_required_qty,
    b.available_before_reservation,
    b.reserved_qty,
    b.uncovered_qty,
    b.is_optional_rm,
    b.rm_procurement_mode,
    b.has_actionable_issue as has_unassigned_issues,
    (b.has_actionable_issue or b.is_blocking_after_reservation) as is_blocking_line,
    case
      when b.has_actionable_issue then 'UNASSIGNED_ISSUE'
      when b.is_blocking_after_reservation then 'BLOCKING_SHORTAGE'
      else 'SUFFICIENT_STOCK_REQUIRED'
    end as rm_status_class,
    case
      when b.has_actionable_issue then 'Actionable issue lines exist for this batch/RM item.'
      when b.is_blocking_after_reservation then 'Stock shortage after reservation.'
      else 'Not blocking.'
    end as rm_status_reason,
    now() as refreshed_at
  from base b
  on conflict (month_start, product_id, batch_number, rm_stock_item_id)
  do update set
    rm_name = excluded.rm_name,
    rm_uom = excluded.rm_uom,
    planned_rm_qty = excluded.planned_rm_qty,
    issued_rm_qty = excluded.issued_rm_qty,
    stock_qty = excluded.stock_qty,
    required_from_stock_qty = excluded.required_from_stock_qty,
    higher_priority_required_qty = excluded.higher_priority_required_qty,
    available_before_reservation = excluded.available_before_reservation,
    reserved_qty = excluded.reserved_qty,
    uncovered_qty = excluded.uncovered_qty,
    is_optional_rm = excluded.is_optional_rm,
    rm_procurement_mode = excluded.rm_procurement_mode,
    has_unassigned_issues = excluded.has_unassigned_issues,
    is_blocking_line = excluded.is_blocking_line,
    rm_status_class = excluded.rm_status_class,
    rm_status_reason = excluded.rm_status_reason,
    refreshed_at = excluded.refreshed_at;

  -- Remove stale rows for current month that are no longer present in reservation source.
  delete from public.rm_status_snapshot_current_month s
  where s.month_start = v_month_start
    and not exists (
      select 1
      from (
        select
          r.month_start,
          r.product_id,
          r.batch_number,
          r.rm_stock_item_id
        from public.rm_reservation_snapshot_current_month r
        where r.month_start = v_month_start
        group by
          r.month_start,
          r.product_id,
          r.batch_number,
          r.rm_stock_item_id
      ) r
      where r.month_start = s.month_start
        and r.product_id = s.product_id
        and r.batch_number = s.batch_number
        and r.rm_stock_item_id = s.rm_stock_item_id
    );
end;
$function$;

-- ---------------------------------------------------------------------------
-- C. RM allocation console: batch LIST mode uses actionable semantics
-- ---------------------------------------------------------------------------
create or replace function public.mrp_rm_allocation_console(
  p_horizon_start date,
  p_stock_item_id bigint default null,
  p_q text default null,
  p_offset integer default 0,
  p_limit integer default 200,
  p_only_unassigned boolean default false,
  p_only_approx boolean default false,
  p_product_id bigint default null,
  p_batch_number text default null,
  p_mode text default 'auto'
)
returns jsonb
language plpgsql
as $function$
declare
  v_result jsonb;
  v_mode text := lower(coalesce(p_mode, 'auto'));
  v_is_batch_ctx boolean := (p_product_id is not null and p_batch_number is not null);
begin
  if p_horizon_start is null then
    return jsonb_build_object('mode','list','total_count',0,'rows','[]'::jsonb);
  end if;

  -- DETAIL MODE
  if v_mode = 'detail'
     or (
       v_mode = 'auto'
       and (
         p_stock_item_id is not null
         or (p_product_id is not null and p_batch_number is not null)
       )
     )
  then
    with lines_all as (
      select
        l.id,
        date_trunc('month', l.issue_date)::date as horizon_start,
        l.issue_date,
        l.voucher_id,
        l.voucher_type,
        l.voucher_number,
        l.voucher_ref,
        l.rm_stock_item_id,
        l.rm_name,
        l.rm_uom_id,
        l.rm_uom_code,
        l.qty_issued,
        l.raw_batch_number,
        l.raw_product_text,
        l.raw_remarks,
        l.product_id,
        l.fg_batch_id,
        l.batch_number,
        l.batch_number_key,
        l.sku_id,
        l.region_code,
        l.allocation_status,
        l.allocation_note,
        l.raw_material_text,
        l.raw_material_key
      from public.mrp_rm_issue_lines l
      where date_trunc('month', l.issue_date)::date = p_horizon_start
        and (
          (
            p_stock_item_id is not null
            and l.rm_stock_item_id = p_stock_item_id
          )
          or
          (
            p_stock_item_id is null
            and p_product_id is not null
            and p_batch_number is not null
            and l.product_id = p_product_id
            and l.batch_number = p_batch_number
          )
        )
        and (
          p_q is null
          or l.rm_name ilike '%' || p_q || '%'
          or coalesce(l.voucher_number,'') ilike '%' || p_q || '%'
          or coalesce(l.voucher_ref,'') ilike '%' || p_q || '%'
          or coalesce(l.batch_number,'') ilike '%' || p_q || '%'
          or coalesce(l.raw_batch_number,'') ilike '%' || p_q || '%'
          or coalesce(l.raw_product_text,'') ilike '%' || p_q || '%'
          or coalesce(l.region_code,'') ilike '%' || p_q || '%'
        )
    ),
    lines_paged as (
      select *
      from lines_all
      order by issue_date asc, id asc
      offset greatest(coalesce(p_offset, 0), 0)
      limit greatest(coalesce(p_limit, 200), 1)
    ),
    issues as (
      select
        p_horizon_start as horizon_start,
        p_stock_item_id as rm_stock_item_id,
        p_product_id as product_id,
        p_batch_number as batch_number,
        sum(qty_issued)::numeric as total_qty,
        sum(qty_issued) filter (
          where allocation_status = 'unassigned'
        )::numeric as unassigned_qty,
        sum(qty_issued) filter (
          where allocation_status in ('by_batch','by_product','by_sku')
        )::numeric as approx_qty,
        min(issue_date) filter (
          where allocation_status = 'unassigned'
             or allocation_status in ('by_batch','by_product','by_sku')
        ) as oldest_issue_date
      from lines_all
    ),
    meta as (
      select count(*)::int as total_count
      from lines_all
    )
    select jsonb_build_object(
      'mode','detail',
      'total_count', (select total_count from meta),
      'issued', (select coalesce(jsonb_agg(to_jsonb(lp)), '[]'::jsonb) from lines_paged lp),
      'issues', (select coalesce(to_jsonb(i), '{}'::jsonb) from issues i)
    )
    into v_result;

    return coalesce(
      v_result,
      jsonb_build_object(
        'mode','detail',
        'total_count',0,
        'issued','[]'::jsonb,
        'issues','{}'::jsonb
      )
    );
  end if;

  -- LIST MODE: batch-context branch
  if v_is_batch_ctx then
    with batch_rows as (
      select
        s.month_start as horizon_start,
        s.rm_stock_item_id,
        null::text as rm_code,
        max(s.rm_name) as rm_name,
        max(s.rm_uom) as rm_uom_code,
        s.product_id,
        s.batch_number,
        null::text as product_name,
        null::bigint as sku_id,
        null::text as sku_name,
        null::text as region_code,
        sum(coalesce(s.issued_rm_qty, 0))::numeric as issued_rm_qty
      from public.rm_status_snapshot_current_month s
      where s.month_start = p_horizon_start
        and s.product_id = p_product_id
        and s.batch_number = p_batch_number
        and (p_stock_item_id is null or s.rm_stock_item_id = p_stock_item_id)
        and (
          p_q is null
          or s.rm_name ilike '%' || p_q || '%'
          or coalesce(s.batch_number,'') ilike '%' || p_q || '%'
        )
      group by s.month_start, s.rm_stock_item_id, s.product_id, s.batch_number
    ),
    issue_rollup as (
      select
        l.rm_stock_item_id,
        sum(l.qty_issued) filter (
          where l.product_id = p_product_id
            and l.batch_number = p_batch_number
            and coalesce(l.allocation_status,'unassigned') in (
              'unassigned','by_batch','by_product','by_sku'
            )
        )::numeric as target_assignable_qty,
        sum(l.qty_issued) filter (
          where l.product_id is null
            and coalesce(l.batch_number,'') = ''
            and coalesce(l.allocation_status,'unassigned') = 'unassigned'
        )::numeric as clean_unassigned_qty,
        sum(l.qty_issued) filter (
          where l.product_id = p_product_id
            and l.batch_number = p_batch_number
            and coalesce(l.allocation_status,'unassigned') in ('by_batch','by_product','by_sku')
        )::numeric as approx_qty,
        min(l.issue_date) filter (
          where (
            l.product_id = p_product_id
            and l.batch_number = p_batch_number
            and coalesce(l.allocation_status,'unassigned') in (
              'unassigned','by_batch','by_product','by_sku'
            )
          )
          or (
            l.product_id is null
            and coalesce(l.batch_number,'') = ''
            and coalesce(l.allocation_status,'unassigned') = 'unassigned'
          )
        ) as oldest_issue_date
      from public.mrp_rm_issue_lines l
      where date_trunc('month', l.issue_date)::date = p_horizon_start
        and (p_stock_item_id is null or l.rm_stock_item_id = p_stock_item_id)
      group by l.rm_stock_item_id
    ),
    decorated as (
      select
        br.horizon_start,
        br.rm_stock_item_id,
        br.rm_code,
        br.rm_name,
        br.rm_uom_code,
        br.product_id,
        br.batch_number,
        br.product_name,
        br.sku_id,
        br.sku_name,
        br.region_code,
        br.issued_rm_qty,
        coalesce(ir.clean_unassigned_qty, 0::numeric) as unassigned_qty,
        coalesce(ir.approx_qty, 0::numeric) as approx_qty,
        ir.oldest_issue_date,
        public.rm_issue_actionable_exists(
          br.horizon_start,
          br.product_id,
          br.batch_number,
          br.rm_stock_item_id
        ) as has_unassigned_issues,
        (coalesce(ir.approx_qty, 0::numeric) > 0) as allocation_approx,
        (
          public.rm_issue_actionable_exists(
            br.horizon_start,
            br.product_id,
            br.batch_number,
            br.rm_stock_item_id
          )
          or coalesce(ir.approx_qty, 0::numeric) > 0
        ) as needs_attention,
        null::int as max_age_days
      from batch_rows br
      left join issue_rollup ir
        on ir.rm_stock_item_id = br.rm_stock_item_id
      where (
        not p_only_unassigned
        or public.rm_issue_actionable_exists(
          br.horizon_start,
          br.product_id,
          br.batch_number,
          br.rm_stock_item_id
        )
      )
      and (not p_only_approx or coalesce(ir.approx_qty, 0::numeric) > 0)
    ),
    counted as (
      select count(*)::int as total_count
      from decorated
    ),
    paged as (
      select *
      from decorated
      order by
        needs_attention desc,
        issued_rm_qty desc nulls last,
        rm_name asc nulls last
      offset greatest(coalesce(p_offset,0),0)
      limit greatest(coalesce(p_limit,200),1)
    )
    select jsonb_build_object(
      'mode','list',
      'total_count', (select total_count from counted),
      'rows', coalesce(jsonb_agg(to_jsonb(paged)), '[]'::jsonb)
    )
    into v_result
    from paged;

    return coalesce(
      v_result,
      jsonb_build_object('mode','list','total_count',0,'rows','[]'::jsonb)
    );
  end if;

  -- LIST MODE: existing non-batch path
  with base as (
    select
      date_trunc('month', l.issue_date)::date as horizon_start,
      l.rm_stock_item_id,
      l.rm_name,
      max(l.rm_uom_code) as rm_uom_code,
      l.product_id,
      l.batch_number,
      l.sku_id,
      l.region_code,
      sum(l.qty_issued)::numeric as issued_rm_qty,
      sum(l.qty_issued) filter (
        where l.allocation_status = 'unassigned'
      )::numeric as unassigned_qty,
      sum(l.qty_issued) filter (
        where l.allocation_status in ('by_batch','by_product','by_sku')
      )::numeric as approx_qty,
      min(l.issue_date) filter (
        where l.allocation_status = 'unassigned'
           or l.allocation_status in ('by_batch','by_product','by_sku')
      ) as oldest_issue_date
    from public.mrp_rm_issue_lines l
    where date_trunc('month', l.issue_date)::date = p_horizon_start
      and (p_product_id is null or l.product_id = p_product_id)
      and (p_batch_number is null or l.batch_number = p_batch_number)
      and (p_stock_item_id is null or l.rm_stock_item_id = p_stock_item_id)
      and (
        p_q is null
        or l.rm_name ilike '%' || p_q || '%'
        or coalesce(l.raw_product_text,'') ilike '%' || p_q || '%'
        or coalesce(l.batch_number,'') ilike '%' || p_q || '%'
        or coalesce(l.region_code,'') ilike '%' || p_q || '%'
      )
    group by
      date_trunc('month', l.issue_date)::date,
      l.rm_stock_item_id,
      l.rm_name,
      l.product_id,
      l.batch_number,
      l.sku_id,
      l.region_code
  ),
  decorated as (
    select
      horizon_start,
      rm_stock_item_id,
      null::text as rm_code,
      rm_name,
      rm_uom_code,
      product_id,
      batch_number,
      null::text as product_name,
      sku_id,
      null::text as sku_name,
      region_code,
      issued_rm_qty,
      unassigned_qty,
      approx_qty,
      oldest_issue_date,
      (coalesce(unassigned_qty,0) > 0) as has_unassigned_issues,
      (coalesce(approx_qty,0) > 0) as allocation_approx,
      (coalesce(unassigned_qty,0) > 0 or coalesce(approx_qty,0) > 0) as needs_attention,
      case
        when oldest_issue_date is null then null
        else (current_date - oldest_issue_date)::int
      end as max_age_days
    from base
    where
      (not p_only_unassigned or coalesce(unassigned_qty,0) > 0)
      and (not p_only_approx or coalesce(approx_qty,0) > 0)
  ),
  counted as (
    select count(*)::int as total_count
    from decorated
  ),
  paged as (
    select *
    from decorated
    order by
      needs_attention desc,
      issued_rm_qty desc nulls last,
      rm_name asc nulls last
    offset greatest(coalesce(p_offset,0),0)
    limit greatest(coalesce(p_limit,200),1)
  )
  select jsonb_build_object(
    'mode','list',
    'total_count', (select total_count from counted),
    'rows', coalesce(jsonb_agg(to_jsonb(paged)), '[]'::jsonb)
  )
  into v_result
  from paged;

  return coalesce(
    v_result,
    jsonb_build_object('mode','list','total_count',0,'rows','[]'::jsonb)
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- D. PEQ snapshot refresh: normalize RM gate fields from rm_status snapshot
-- ---------------------------------------------------------------------------
create or replace function public.refresh_priority_queue_snapshot()
returns void
language plpgsql
security definer
as $function$
declare
  v_month date := date_trunc('month', now())::date;
begin
  perform set_config('statement_timeout', '10min', true);

  delete from public.priority_queue_snapshot_current_month
  where month_start = v_month;

  insert into public.priority_queue_snapshot_current_month (
    month_start,
    product_id,
    product_name,
    batch_number,
    primary_state,
    expected_output_base_qty,
    transferred_out_base_qty,
    in_system_base_qty_est,
    pm_gate_status,
    pending_pm_lines,
    has_mandatory_pm_pending,
    has_label_or_override_pending,
    pm_issue_completion_ratio,
    rm_gate_status,
    rm_pending_lines,
    rm_issue_completion_ratio,
    has_unassigned_rm_issues,
    candidate_supply_base_qty,
    is_pm_ok,
    is_pm_blocked,
    is_rm_ok_for_stage,
    total_risk_reduction_units,
    top_region,
    top_sku_id,
    top_sku_label,
    top_risk_reduction_units,
    stage_rank,
    queue_lane,
    time_sensitivity_score,
    time_sensitivity_reason,
    supply_continuity_score,
    supply_continuity_reason,
    priority_rank_v3,
    priority_rank_v4,
    rm_gate_status_display,
    batch_size_declared,
    batch_uom,
    fg_bulk_on_hand_base_qty,
    bottled_on_hand_units,
    bottled_on_hand_base_qty
  )
  with src as (
    select *
    from public.mv_production_priority_queue_current_month
    where month_start = v_month
  ),
  rm_agg as (
    select
      s.month_start,
      s.product_id,
      s.batch_number,
      count(*) filter (where s.is_blocking_line) as rm_pending_lines_norm,
      bool_or(s.is_blocking_line) as has_rm_blocker,
      bool_or(s.is_blocking_line and s.rm_status_class = 'UNASSIGNED_ISSUE') as has_unassigned_rm_issues_norm
    from public.rm_status_snapshot_current_month s
    where s.month_start = v_month
    group by s.month_start, s.product_id, s.batch_number
  )
  select
    s.month_start,
    s.product_id,
    s.product_name,
    s.batch_number,
    s.primary_state,
    s.expected_output_base_qty,
    s.transferred_out_base_qty,
    s.in_system_base_qty_est,
    s.pm_gate_status,
    s.pending_pm_lines,
    s.has_mandatory_pm_pending,
    s.has_label_or_override_pending,
    s.pm_issue_completion_ratio,
    case
      when s.primary_state in ('FG_BULK', 'BOTTLED') then 'RM_OK'
      when coalesce(a.has_rm_blocker, false) then 'RM_BLOCKED'
      else 'RM_OK'
    end as rm_gate_status,
    coalesce(a.rm_pending_lines_norm, 0)::integer as rm_pending_lines,
    s.rm_issue_completion_ratio,
    coalesce(a.has_unassigned_rm_issues_norm, false) as has_unassigned_rm_issues,
    s.candidate_supply_base_qty,
    s.is_pm_ok,
    s.is_pm_blocked,
    case
      when s.primary_state in ('FG_BULK', 'BOTTLED') then true
      else not coalesce(a.has_rm_blocker, false)
    end as is_rm_ok_for_stage,
    s.total_risk_reduction_units,
    s.top_region,
    s.top_sku_id,
    s.top_sku_label,
    s.top_risk_reduction_units,
    s.stage_rank,
    s.queue_lane,
    s.time_sensitivity_score,
    s.time_sensitivity_reason,
    s.supply_continuity_score,
    s.supply_continuity_reason,
    s.priority_rank_v3,
    s.priority_rank_v4,
    case
      when s.primary_state in ('FG_BULK', 'BOTTLED') then 'N/A'
      when coalesce(a.has_rm_blocker, false) then 'RM_BLOCKED'
      else 'RM_OK'
    end as rm_gate_status_display,
    s.batch_size_declared,
    s.batch_uom,
    s.fg_bulk_on_hand_base_qty,
    s.bottled_on_hand_units,
    s.bottled_on_hand_base_qty
  from src s
  left join rm_agg a
    on a.month_start = s.month_start
   and a.product_id = s.product_id
   and a.batch_number = s.batch_number;
end;
$function$;

commit;

-- Post-deploy sequence
-- select public.refresh_after_rm_allocation();
-- verify SP763 / RM 294 on PEQ and RM allocation screen.
