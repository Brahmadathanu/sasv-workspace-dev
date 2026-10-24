-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter function public.proc_indent_set_priority_override(bigint,text,text) rename to proc_indent_set_priority_override_pec_internal;
alter function public.proc_indent_clear_priority_override(bigint) rename to proc_indent_clear_priority_override_pec_internal;

revoke all on function public.proc_indent_set_priority_override_pec_internal(bigint,text,text) from public,anon,authenticated;
revoke all on function public.proc_indent_clear_priority_override_pec_internal(bigint) from public,anon,authenticated;
grant execute on function public.proc_indent_set_priority_override_pec_internal(bigint,text,text) to service_role;
grant execute on function public.proc_indent_clear_priority_override_pec_internal(bigint) to service_role;

create function public.proc_indent_set_priority_override(p_indent_line_id bigint,p_override_band text,p_reason text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.require_permission('module:procurement-execution-console','t');
  perform public.proc_indent_set_priority_override_pec_internal(p_indent_line_id,p_override_band,p_reason);
end;
$$;

create function public.proc_indent_clear_priority_override(p_indent_line_id bigint)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.require_permission('module:procurement-execution-console','t');
  perform public.proc_indent_clear_priority_override_pec_internal(p_indent_line_id);
end;
$$;

revoke all on function public.proc_indent_set_priority_override(bigint,text,text) from public,anon;
revoke all on function public.proc_indent_clear_priority_override(bigint) from public,anon;
grant execute on function public.proc_indent_set_priority_override(bigint,text,text) to authenticated,service_role;
grant execute on function public.proc_indent_clear_priority_override(bigint) to authenticated,service_role;