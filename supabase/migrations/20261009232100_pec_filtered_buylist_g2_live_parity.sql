-- PEC G2 verified live function snapshot as of 2026-10-09.
-- Already applied to production via connected Supabase migration
-- pec_filtered_buylist_canonical_indent_line_sort_no.
-- Historical repository parity record; do NOT reapply in production.
-- The original owner, grants, SECURITY DEFINER and search_path must remain intact.
-- Validate the base and ordered views before applying to any fresh environment.

CREATE OR REPLACE FUNCTION public.proc_vendorwise_buylist_filtered_pec_internal(p_material_class_id bigint DEFAULT NULL::bigint, p_rm_scope text DEFAULT NULL::text, p_rate_status text DEFAULT NULL::text, p_assignment_status text DEFAULT NULL::text, p_q text DEFAULT NULL::text)
 RETURNS SETOF v_proc_vendorwise_buylist
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  with filtered as (
    select b.*, ordered.indent_line_sort_no
    from public.v_proc_indent_line_buylist_base b JOIN public.v_proc_indent_lines_console_ordered ordered ON ordered.indent_line_id = b.indent_line_id
    where
      (
        p_material_class_id is null
        or b.material_class_id = p_material_class_id
      )
      and (
        p_rm_scope is null
        or nullif(trim(p_rm_scope), '') is null
        or b.rm_scope = p_rm_scope
      )
      and (
        p_rate_status is null
        or nullif(trim(p_rate_status), '') is null
        or (
          p_rate_status = 'missing_rate'
          and b.rate_status in (
            'rate_pending',
            'not_applicable'
          )
        )
        or (
          p_rate_status <> 'missing_rate'
          and b.rate_status = p_rate_status
        )
      )
      and (
        p_assignment_status is null
        or nullif(trim(p_assignment_status), '') is null
        or b.assignment_status = p_assignment_status
      )
      and (
        p_q is null
        or nullif(trim(p_q), '') is null
        or b.stock_item_name ilike
             '%' || trim(p_q) || '%'
        or coalesce(b.vendor_name, 'UNASSIGNED') ilike
             '%' || trim(p_q) || '%'
        or b.vendor_bucket_name ilike
             '%' || trim(p_q) || '%'
        or b.indent_number ilike
             '%' || trim(p_q) || '%'
        or coalesce(b.material_class_display, '') ilike
             '%' || trim(p_q) || '%'
      )
  ),

  grouped as (
    select
      case
        when count(distinct f.vendor_id) filter (
          where f.vendor_id is not null
        ) = 1
          then max(f.vendor_id)
        else null::bigint
      end as vendor_id,

      case
        when count(distinct f.vendor_id) filter (
          where f.vendor_id is not null
        ) = 1
          then max(f.vendor_name)
        else null::text
      end as vendor_name,

      f.material_class_id,
      f.stock_item_id,
      f.stock_item_name,
      f.uom_id,
      f.uom_code,

      sum(f.qty_to_buy) as total_qty_to_buy,

      case
        when f.vendor_bucket_key = 'UNASSIGNED'
          then null::numeric

        when count(*) filter (
          where f.rate_value is null
             or f.rate_value <= 0
        ) > 0
          then null::numeric

        when count(distinct f.rate_value) = 1
          then max(f.rate_value)

        else null::numeric
      end as rate_value,

      case
        when f.vendor_bucket_key = 'UNASSIGNED'
          then null::numeric

        when count(*) filter (
          where f.rate_value is null
             or f.rate_value <= 0
        ) > 0
          then null::numeric

        else sum(f.line_amount)
      end as total_amount,

      jsonb_agg(
        jsonb_build_object(
          'indent_number', f.indent_number,
          'indent_id', f.indent_id,
          'indent_line_id', f.indent_line_id,
          'indent_line_sort_no', f.indent_line_sort_no,
          'qty_to_buy', f.qty_to_buy,
          'uom_code', f.uom_code,

          'actual_vendor_id', f.vendor_id,
          'actual_vendor_name', f.vendor_name,
          'actual_vendor_type', f.actual_vendor_type,

          'vendor_bucket_key', f.vendor_bucket_key,
          'vendor_bucket_name', f.vendor_bucket_name,
          'vendor_bucket_type', f.vendor_bucket_type,

          'rate_value', f.rate_value,
          'line_amount', f.line_amount,
          'rate_status', f.rate_status,
          'assignment_status', f.assignment_status,
          'rm_scope', f.rm_scope,
          'rm_scope_label', f.rm_scope_label
        )
        order by
          f.indent_number,
          f.indent_line_id
      ) as indent_breakdown,

      f.material_class_code,
      f.material_class_label,
      f.material_class_display,

      case
        when count(distinct f.rm_scope) filter (
          where f.rm_scope is not null
        ) = 0
          then null::text

        when count(distinct f.rm_scope) filter (
          where f.rm_scope is not null
        ) = 1
          then max(f.rm_scope) filter (
            where f.rm_scope is not null
          )

        else 'mixed'::text
      end as rm_scope,

      case
        when count(distinct f.rm_scope) filter (
          where f.rm_scope is not null
        ) = 0
          then null::text

        when count(distinct f.rm_scope) filter (
          where f.rm_scope is not null
        ) = 1
          then max(f.rm_scope_label) filter (
            where f.rm_scope is not null
          )

        else 'Multiple RM scopes'::text
      end as rm_scope_label,

      case
        when f.vendor_bucket_key = 'UNASSIGNED'
          then false

        when count(*) filter (
          where f.rate_value is null
             or f.rate_value <= 0
        ) > 0
          then false

        else true
      end as has_rate,

      case
        when f.vendor_bucket_key = 'UNASSIGNED'
          then 'not_applicable'::text

        when count(*) filter (
          where f.rate_value is null
             or f.rate_value <= 0
        ) > 0
          then 'rate_pending'::text

        when count(distinct f.rate_value) = 1
          then 'with_rate'::text

        else 'mixed_rate'::text
      end as rate_status,

      f.vendor_bucket_key <> 'UNASSIGNED' as has_vendor,

      case
        when f.vendor_bucket_key = 'UNASSIGNED'
          then 'unassigned'::text
        else 'assigned'::text
      end as assignment_status,

      count(distinct f.vendor_id) filter (
        where f.vendor_id is not null
      )::bigint as actual_vendor_count,

      string_agg(
        distinct f.vendor_name,
        ', '
        order by f.vendor_name
      ) filter (
        where f.vendor_id is not null
      ) as actual_vendor_summary,

      f.vendor_bucket_key,
      f.vendor_bucket_name,
      f.vendor_bucket_type

    from filtered f

    group by
      f.vendor_bucket_key,
      f.vendor_bucket_name,
      f.vendor_bucket_type,

      f.material_class_id,
      f.material_class_code,
      f.material_class_label,
      f.material_class_display,

      f.stock_item_id,
      f.stock_item_name,

      f.uom_id,
      f.uom_code
  )

  select
    g.vendor_id,
    g.vendor_name,
    g.material_class_id,
    g.stock_item_id,
    g.stock_item_name,
    g.uom_id,
    g.uom_code,
    g.total_qty_to_buy,
    g.rate_value,
    g.total_amount,
    g.indent_breakdown,
    g.material_class_code,
    g.material_class_label,
    g.material_class_display,
    g.rm_scope,
    g.rm_scope_label,
    g.has_rate,
    g.rate_status,
    g.has_vendor,
    g.assignment_status,
    g.actual_vendor_count,
    g.actual_vendor_summary,
    g.vendor_bucket_key,
    g.vendor_bucket_name,
    g.vendor_bucket_type

  from grouped g

  order by
    case
      when g.vendor_bucket_key = 'UNASSIGNED' then 1
      else 0
    end,
    g.vendor_bucket_name,
    g.stock_item_name,
    g.uom_code;

$function$;

-- No GRANT for authenticated on the private _pec_internal function.
REVOKE ALL ON FUNCTION public.proc_vendorwise_buylist_filtered_pec_internal(bigint,text,text,text,text) FROM PUBLIC, anon, authenticated;
