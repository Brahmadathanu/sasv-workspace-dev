-- Hotfix: make batch-context LIST mode in mrp_rm_allocation_console
-- use actionable issue-line semantics instead of snapshot has_unassigned_issues.
--
-- Why:
-- The previous batch-context branch derived unassigned_qty from
-- rm_status_snapshot_current_month.has_unassigned_issues, which can be true
-- even when all issue lines are already mapped to other batches/products.
--
-- Impact:
-- - Deep-link batch list from PEQ no longer shows false actionable rows.
-- - p_only_unassigned=true now filters on clean actionable pool only.
--
-- Scope:
-- Only the batch-context LIST branch is changed.
-- DETAIL mode and non-batch LIST mode are preserved.

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

  ---------------------------------------------------------------------------
  -- DETAIL MODE (unchanged)
  ---------------------------------------------------------------------------
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

  ---------------------------------------------------------------------------
  -- LIST MODE: batch-context branch (actionable semantics)
  ---------------------------------------------------------------------------
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
        and (
          p_stock_item_id is null
          or l.rm_stock_item_id = p_stock_item_id
        )
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
        (
          coalesce(ir.clean_unassigned_qty, 0::numeric) > 0
          or coalesce(ir.target_assignable_qty, 0::numeric) > 0
        ) as has_unassigned_issues,
        (coalesce(ir.approx_qty, 0::numeric) > 0) as allocation_approx,
        (
          coalesce(ir.clean_unassigned_qty, 0::numeric) > 0
          or coalesce(ir.target_assignable_qty, 0::numeric) > 0
          or coalesce(ir.approx_qty, 0::numeric) > 0
        ) as needs_attention,
        null::int as max_age_days
      from batch_rows br
      left join issue_rollup ir
        on ir.rm_stock_item_id = br.rm_stock_item_id
      where (not p_only_unassigned or coalesce(ir.clean_unassigned_qty, 0::numeric) > 0)
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

  ---------------------------------------------------------------------------
  -- LIST MODE: existing non-batch path (unchanged)
  ---------------------------------------------------------------------------
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
      and (
        p_product_id is null
        or l.product_id = p_product_id
      )
      and (
        p_batch_number is null
        or l.batch_number = p_batch_number
      )
      and (
        p_stock_item_id is null
        or l.rm_stock_item_id = p_stock_item_id
      )
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
