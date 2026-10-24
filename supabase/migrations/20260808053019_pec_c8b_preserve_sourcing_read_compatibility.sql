-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.proc_pec_sourcing_decisions(p_indent_id bigint default null)
returns setof public.proc_indent_line_sourcing_decision
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);

  if p_indent_id is null then
    return query
    select d.*
    from public.proc_indent_line_sourcing_decision d
    order by d.indent_line_id;
  else
    return query
    select d.*
    from public.proc_indent_line_sourcing_decision d
    join public.proc_indent_line l on l.indent_line_id = d.indent_line_id
    where l.indent_id = p_indent_id
    order by d.indent_line_id;
  end if;
end;
$$;