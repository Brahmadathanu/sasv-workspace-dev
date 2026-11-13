-- PEC R10 PROPOSED read-only SAFE/RESET collision preview. NOT applied anywhere.
-- Created with `supabase migration new`. NEW ACL (needs separate owner approval):
-- EXECUTE for authenticated + service_role only, mirroring the approved #323 read RPCs.
-- The function is STABLE/read-only and enforces the PEC *View* permission server-side;
-- it is advisory. The resync writer remains the only authority and re-checks everything.
-- Rollback: forward migration `DROP FUNCTION public.proc_indent_resync_collision_preview(bigint)`
-- (safe: nothing depends on it; the client degrades to "preview unavailable").
BEGIN;

CREATE OR REPLACE FUNCTION public.proc_indent_resync_collision_preview(p_indent_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_status text;
  v_src bigint;
  v_pr_status text;
  v_collisions jsonb;
  v_reset_delete int;
  v_reset_manual int;
begin
  perform public.require_permission('module:procurement-execution-console', false);
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;

  select h.status, h.source_pr_id into v_status, v_src
  from public.proc_indent_header h where h.indent_id = p_indent_id;
  if v_status is null then raise exception 'Indent not found'; end if;

  if v_status <> 'draft' or v_src is null then
    return jsonb_build_object('eligible', false,
      'reason', case when v_status <> 'draft' then 'not_draft' else 'no_source_pr' end,
      'blocked', false, 'collisions', '[]'::jsonb);
  end if;
  select status into v_pr_status from public.proc_pr_header where pr_id = v_src;
  if v_pr_status is distinct from 'active' then
    return jsonb_build_object('eligible', false, 'reason', 'source_pr_not_active',
      'blocked', false, 'collisions', '[]'::jsonb);
  end if;

  -- Same PR-final definition as proc_indent_resync_from_pr_pec_internal.
  with pfl as (
    select l.material_class_id, l.stock_item_id, l.uom_id,
           (coalesce(l.requested_qty,0) + coalesce(l.manual_delta_qty,0))::numeric(20,6) as final_qty,
           nullif(btrim(l.manual_reason),'') as manual_reason
    from public.proc_pr_line l
    join public.v_inv_stock_item_with_class sic on sic.stock_item_id = l.stock_item_id
    where sic.active = true
      and (l.material_class_id <> 1 or sic.subcategory_code not in ('finished_bulk_material','semifinished_goods'))
      and l.pr_id = v_src
      and (coalesce(l.requested_qty,0) + coalesce(l.manual_delta_qty,0)) > 0
  ), unmapped as (
    select il.* from public.proc_indent_line il
    where il.indent_id = p_indent_id
      and not exists (select 1 from public.proc_pr_indent_line_map m
                      where m.indent_id = p_indent_id and m.indent_line_id = il.indent_line_id)
  ), coll as (
    select il.indent_line_id, il.stock_item_id, il.uom_id,
           il.requested_qty as indent_qty, nullif(btrim(il.manual_reason),'') as indent_reason,
           pfl.final_qty as pr_qty, pfl.manual_reason as pr_reason,
           il.requested_qty is distinct from pfl.final_qty as differs_qty,
           nullif(btrim(il.manual_reason),'') is distinct from pfl.manual_reason as differs_reason
    from unmapped il
    join pfl on pfl.material_class_id = il.material_class_id
            and pfl.stock_item_id = il.stock_item_id and pfl.uom_id = il.uom_id
    where il.requested_qty is distinct from pfl.final_qty
       or nullif(btrim(il.manual_reason),'') is distinct from pfl.manual_reason
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'indent_line_id', c.indent_line_id, 'stock_item_id', c.stock_item_id,
           'item_name', (select v.stock_item_name from public.v_proc_indent_lines_console_ordered v
                         where v.indent_line_id = c.indent_line_id limit 1),
           'uom_code', (select v.uom_code from public.v_proc_indent_lines_console_ordered v
                        where v.indent_line_id = c.indent_line_id limit 1),
           'indent_qty', c.indent_qty, 'indent_reason', c.indent_reason,
           'pr_qty', c.pr_qty, 'pr_reason', c.pr_reason,
           'differs_qty', c.differs_qty, 'differs_reason', c.differs_reason)
         order by c.indent_line_id), '[]'::jsonb)
    into v_collisions from coll c;

  select count(*) into v_reset_delete from public.proc_indent_line where indent_id = p_indent_id;
  select count(*) into v_reset_manual from public.proc_indent_line il
   where il.indent_id = p_indent_id
     and not exists (select 1 from public.proc_pr_indent_line_map m
                     where m.indent_id = p_indent_id and m.indent_line_id = il.indent_line_id);

  return jsonb_build_object(
    'eligible', true, 'reason', null,
    'blocked', jsonb_array_length(v_collisions) > 0,
    'collisions', v_collisions,
    'safe_consequence', case when jsonb_array_length(v_collisions) > 0
        then 'SAFE will be rejected (no change) until each listed line is resolved.'
        else 'SAFE can proceed: mapped lines follow the PR; unmapped independent manual lines are kept.' end,
    'reset_consequence_delete_all_lines', v_reset_delete,
    'reset_consequence_manual_lines_lost', v_reset_manual);
end;
$function$;

REVOKE ALL ON FUNCTION public.proc_indent_resync_collision_preview(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_resync_collision_preview(bigint) TO authenticated, service_role;
COMMIT;
