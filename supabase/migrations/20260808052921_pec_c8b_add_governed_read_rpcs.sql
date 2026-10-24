-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.proc_pec_pr_headers()
returns setof public.v_proc_pr_header
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  return query select * from public.v_proc_pr_header order by updated_at desc nulls last, pr_id desc;
end;
$$;

create or replace function public.proc_pec_pr_lines(p_pr_id bigint)
returns setof public.v_proc_pr_lines_ordered
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  if p_pr_id is null then raise exception 'p_pr_id is required'; end if;
  return query select * from public.v_proc_pr_lines_ordered where pr_id = p_pr_id order by line_sort_no, pr_line_id;
end;
$$;

create or replace function public.proc_pec_indent_headers()
returns setof public.v_proc_indent_console
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  return query select * from public.v_proc_indent_console order by updated_at desc nulls last, indent_id desc;
end;
$$;

create or replace function public.proc_pec_indent_lines(p_indent_id bigint)
returns setof public.v_proc_indent_lines_console_ordered
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;
  return query select * from public.v_proc_indent_lines_console_ordered where indent_id = p_indent_id order by indent_line_sort_no, indent_line_id;
end;
$$;

create or replace function public.proc_pec_purchase_excess()
returns setof public.v_proc_purchase_excess_console
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  return query select * from public.v_proc_purchase_excess_console order by voucher_date desc nulls last, purchase_fact_id desc;
end;
$$;

create or replace function public.proc_pec_excess_acceptance_audit()
returns setof public.v_proc_excess_acceptance_audit_console
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  return query select * from public.v_proc_excess_acceptance_audit_console order by accepted_at desc nulls last, acceptance_id desc;
end;
$$;

create or replace function public.proc_pec_buylist_material_class_options()
returns setof public.v_proc_vendorwise_buylist_material_class_options
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  return query select * from public.v_proc_vendorwise_buylist_material_class_options;
end;
$$;

create or replace function public.proc_pec_buylist_rm_scope_options()
returns setof public.v_proc_vendorwise_buylist_rm_scope_options
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  return query select * from public.v_proc_vendorwise_buylist_rm_scope_options;
end;
$$;

create or replace function public.proc_pec_sourcing_decisions(p_indent_id bigint default null)
returns setof public.proc_indent_line_sourcing_decision
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  return query
  select d.*
  from public.proc_indent_line_sourcing_decision d
  join public.proc_indent_line l on l.indent_line_id = d.indent_line_id
  where p_indent_id is null or l.indent_id = p_indent_id
  order by d.indent_line_id;
end;
$$;

create or replace function public.proc_pec_vendor_details(p_vendor_ids bigint[] default null)
returns setof public.proc_vendor
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('module:procurement-execution-console', false);
  return query
  select v.*
  from public.proc_vendor v
  where p_vendor_ids is null or v.vendor_id = any(p_vendor_ids)
  order by lower(v.display_name), v.vendor_id;
end;
$$;

revoke all on function public.proc_pec_pr_headers() from public, anon;
revoke all on function public.proc_pec_pr_lines(bigint) from public, anon;
revoke all on function public.proc_pec_indent_headers() from public, anon;
revoke all on function public.proc_pec_indent_lines(bigint) from public, anon;
revoke all on function public.proc_pec_purchase_excess() from public, anon;
revoke all on function public.proc_pec_excess_acceptance_audit() from public, anon;
revoke all on function public.proc_pec_buylist_material_class_options() from public, anon;
revoke all on function public.proc_pec_buylist_rm_scope_options() from public, anon;
revoke all on function public.proc_pec_sourcing_decisions(bigint) from public, anon;
revoke all on function public.proc_pec_vendor_details(bigint[]) from public, anon;

grant execute on function public.proc_pec_pr_headers() to authenticated, service_role;
grant execute on function public.proc_pec_pr_lines(bigint) to authenticated, service_role;
grant execute on function public.proc_pec_indent_headers() to authenticated, service_role;
grant execute on function public.proc_pec_indent_lines(bigint) to authenticated, service_role;
grant execute on function public.proc_pec_purchase_excess() to authenticated, service_role;
grant execute on function public.proc_pec_excess_acceptance_audit() to authenticated, service_role;
grant execute on function public.proc_pec_buylist_material_class_options() to authenticated, service_role;
grant execute on function public.proc_pec_buylist_rm_scope_options() to authenticated, service_role;
grant execute on function public.proc_pec_sourcing_decisions(bigint) to authenticated, service_role;
grant execute on function public.proc_pec_vendor_details(bigint[]) to authenticated, service_role;