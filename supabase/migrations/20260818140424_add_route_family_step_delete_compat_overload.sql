-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_delete_route_family_route_step(
  p_family_route_id bigint,
  p_route_step_id bigint default null,
  p_step_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $function$
declare
  v_step_id bigint := coalesce(p_route_step_id, p_step_id);
begin
  if p_family_route_id is null then
    raise exception 'family_route_id is required';
  end if;
  if v_step_id is null then
    raise exception 'route step id is required';
  end if;

  return public.rpc_delete_route_family_route_step(
    p_family_route_id => p_family_route_id,
    p_step_id => v_step_id
  );
end
$function$;

revoke all on function public.rpc_delete_route_family_route_step(bigint,bigint,bigint) from public;
revoke all on function public.rpc_delete_route_family_route_step(bigint,bigint,bigint) from anon;
grant execute on function public.rpc_delete_route_family_route_step(bigint,bigint,bigint) to authenticated;
grant execute on function public.rpc_delete_route_family_route_step(bigint,bigint,bigint) to service_role;

notify pgrst, 'reload schema';