-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.proc_procurement_action_queue_paged(
  p_indent_id bigint default null,
  p_priority_band text default null,
  p_material_class_id bigint default null,
  p_needs text default null,
  p_selected_state text default null,
  p_group_mode text default 'none',
  p_q text default null,
  p_limit integer default 75,
  p_offset integer default 0
)
returns table(row_data jsonb, total_count bigint)
language sql
security definer
set search_path = 'public'
as $function$
  with published as (
    select c.published_run_id as run_id
    from public.proc_snapshot_refresh_control c
    where c.refresh_name = 'procurement_execution_snapshots'
      and c.published_run_id is not null
  ),

  base as (
    select
      lb.indent_line_id,
      lb.indent_id,
      h.indent_number,
      h.status as indent_status,
      h.approved_date,

      lb.material_class_id,
      c.code as material_class_code,
      c.label as material_class_label,

      case
        when c.code is not null and c.label is not null
          then c.code || ' - ' || c.label
        when c.code is not null then c.code
        when c.label is not null then c.label
        else null
      end as material_class_display,

      lb.stock_item_id,
      si.code as stock_item_code,
      si.code as code,
      coalesce(si.name, 'Item #' || lb.stock_item_id::text) as stock_item_name,

      il.uom_id,
      u.code as uom_code,
      il.requested_qty,

      greatest(
        coalesce(il.requested_qty, 0) - coalesce(lb.remaining_qty, 0),
        0
      ) as allocated_qty,

      lb.remaining_qty,
      lb.remaining_qty > 0 as has_remaining,

      coalesce(
        ovr.override_band,
        p.priority_band_system,
        'NORMAL'
      ) as priority_band_final,

      coalesce(
        p.priority_band_system,
        'NORMAL'
      ) as priority_band_system,

      coalesce(p.priority_score_system, 0) as priority_score_system,

      coalesce(
        p.priority_why,
        jsonb_build_object(
          'source', 'priority generation missing',
          'message', 'Priority metrics were not available in the published procurement generation'
        )
      ) as priority_why,

      p.mos_months,
      p.stock_qty,
      p.avg_monthly_6m,
      p.lead_time_days,
      p.criticality_class,
      p.urgency_band,
      p.prod_pull_score,
      coalesce(p.net_excess_qty, 0) as net_excess_qty,

      coalesce(
        p.aging_days,
        case
          when h.approved_date is not null then current_date - h.approved_date
          else null
        end::integer
      ) as aging_days,

      p.missing_stock_record,
      p.missing_consumption_record,
      p.criticality_reason,
      p.urgency_score,
      p.urgency_reason,
      p.prod_pull_why,
      p.score_mos,
      p.score_lead_time,
      p.score_criticality,
      p.score_manual_urgency,
      p.score_prod_pull,
      p.score_aging,
      p.penalty_oversupply,

      ovr.override_band,
      ovr.override_reason,
      ovr.overridden_at,
      ovr.overridden_by,

      d.recommended_vendor_id,
      d.recommended_rate,
      d.recommended_source,
      coalesce(d.recommended_meta, '[]'::jsonb) as recommended_meta,
      d.selected_vendor_id,
      d.selected_rate,
      d.selection_reason,
      d.decided_at,
      d.decided_by,
      coalesce(d.vendor_assignment_cleared, false) as vendor_assignment_cleared

    from published pub
    join public.proc_indent_line_balance_generation lb
      on lb.run_id = pub.run_id
    join public.proc_indent_header h
      on h.indent_id = lb.indent_id
    join public.proc_indent_line il
      on il.indent_line_id = lb.indent_line_id
    left join public.inv_class_category c
      on c.id = lb.material_class_id
    left join public.v_inv_stock_item_with_class si
      on si.stock_item_id = lb.stock_item_id
    left join public.inv_uom u
      on u.id = il.uom_id
    left join public.proc_indent_line_priority_generation p
      on p.run_id = pub.run_id
     and p.indent_line_id = lb.indent_line_id
    left join public.proc_indent_priority_override ovr
      on ovr.indent_line_id = lb.indent_line_id
    left join public.proc_indent_line_sourcing_decision d
      on d.indent_line_id = lb.indent_line_id
    where lb.remaining_qty > 0
      and h.status in ('approved', 'issued')
      and (p_indent_id is null or lb.indent_id = p_indent_id)
      and (p_material_class_id is null or lb.material_class_id = p_material_class_id)
  ),

  candidate_ranked as (
    select
      b.indent_line_id,
      s.vendor_id,
      v.display_name as vendor_name,
      s.rate_value,
      coalesce(s.evidence, '[]'::jsonb) as evidence,
      row_number() over (
        partition by b.indent_line_id
        order by s.rate_value asc, s.vendor_id asc
      ) as rn
    from base b
    join published pub on true
    join public.proc_vendor_item_candidate_generation s
      on s.run_id = pub.run_id
     and s.material_class_id = b.material_class_id
     and s.stock_item_id = b.stock_item_id
    join public.proc_vendor v
      on v.vendor_id = s.vendor_id
     and coalesce(v.is_active, true) = true
    where s.rate_value is not null
      and s.rate_value > 0
  ),

  candidates as (
    select
      indent_line_id,
      max(vendor_id) filter (where rn = 1) as l1_vendor_id,
      max(vendor_name) filter (where rn = 1) as l1_vendor_name,
      max(rate_value) filter (where rn = 1) as l1_rate_value,
      coalesce((array_agg(evidence order by rn) filter (where rn = 1))[1], '[]'::jsonb) as l1_evidence,
      max(vendor_id) filter (where rn = 2) as l2_vendor_id,
      max(vendor_name) filter (where rn = 2) as l2_vendor_name,
      max(rate_value) filter (where rn = 2) as l2_rate_value,
      coalesce((array_agg(evidence order by rn) filter (where rn = 2))[1], '[]'::jsonb) as l2_evidence,
      max(vendor_id) filter (where rn = 3) as l3_vendor_id,
      max(vendor_name) filter (where rn = 3) as l3_vendor_name,
      max(rate_value) filter (where rn = 3) as l3_rate_value,
      coalesce((array_agg(evidence order by rn) filter (where rn = 3))[1], '[]'::jsonb) as l3_evidence
    from candidate_ranked
    where rn <= 3
    group by indent_line_id
  ),

  enriched as (
    select
      b.*,
      cnd.l1_vendor_id,
      cnd.l1_vendor_name,
      cnd.l1_rate_value,
      coalesce(cnd.l1_evidence, '[]'::jsonb) as l1_evidence,
      cnd.l2_vendor_id,
      cnd.l2_vendor_name,
      cnd.l2_rate_value,
      coalesce(cnd.l2_evidence, '[]'::jsonb) as l2_evidence,
      cnd.l3_vendor_id,
      cnd.l3_vendor_name,
      cnd.l3_rate_value,
      coalesce(cnd.l3_evidence, '[]'::jsonb) as l3_evidence,
      vs.display_name as selected_vendor_name,
      vr.display_name as recommended_vendor_name,

      case
        when b.vendor_assignment_cleared then null::bigint
        when b.selected_vendor_id is not null then b.selected_vendor_id
        when b.recommended_vendor_id is not null then b.recommended_vendor_id
        else cnd.l1_vendor_id
      end as resolved_vendor_id,

      case
        when b.vendor_assignment_cleared then null::text
        when b.selected_vendor_id is not null then vs.display_name
        when b.recommended_vendor_id is not null then vr.display_name
        else cnd.l1_vendor_name
      end as resolved_vendor_name,

      case
        when b.vendor_assignment_cleared then null::numeric
        when b.selected_vendor_id is not null then b.selected_rate
        when b.recommended_vendor_id is not null then b.recommended_rate
        else cnd.l1_rate_value
      end as resolved_rate,

      cnd.l1_vendor_id is not null as has_vendor_candidates,
      b.selected_vendor_id is not null as has_selected_vendor,
      false as has_net_excess
    from base b
    left join candidates cnd on cnd.indent_line_id = b.indent_line_id
    left join public.proc_vendor vs on vs.vendor_id = b.selected_vendor_id
    left join public.proc_vendor vr on vr.vendor_id = b.recommended_vendor_id
  ),

  filtered as (
    select e.*
    from enriched e
    where
      (p_priority_band is null or trim(p_priority_band) = '' or e.priority_band_final = trim(p_priority_band))
      and (
        p_needs is null or trim(p_needs) = ''
        or (p_needs = 'needs_vendor' and coalesce(e.has_vendor_candidates, false) = false)
        or (p_needs = 'needs_selection' and coalesce(e.has_selected_vendor, false) = false)
        or (p_needs = 'has_excess' and coalesce(e.has_net_excess, false) = true)
      )
      and (
        p_selected_state is null or trim(p_selected_state) = ''
        or (p_selected_state = 'selected' and coalesce(e.has_selected_vendor, false) = true)
        or (p_selected_state = 'unselected' and coalesce(e.has_selected_vendor, false) = false)
      )
      and (
        p_q is null or trim(p_q) = ''
        or e.stock_item_name ilike ('%' || trim(p_q) || '%')
        or e.indent_number::text ilike ('%' || trim(p_q) || '%')
        or coalesce(e.resolved_vendor_name, '') ilike ('%' || trim(p_q) || '%')
        or coalesce(e.stock_item_code, '') ilike ('%' || trim(p_q) || '%')
      )
  ),

  counted as (
    select count(*)::bigint as total_count
    from filtered
  ),

  page as (
    select f.*
    from filtered f
    order by
      case when coalesce(p_group_mode, 'none') = 'vendor' then coalesce(f.resolved_vendor_name, '') else '' end asc,
      f.approved_date asc nulls last,
      f.indent_number asc,
      f.priority_score_system desc nulls last,
      f.stock_item_name asc
    limit greatest(coalesce(p_limit, 75), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )

  select to_jsonb(page.*) as row_data, counted.total_count
  from page
  cross join counted;
$function$;