-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
  v_sql text;
  v_old_sql text;
begin
  select pg_get_functiondef(p.oid)
  into v_sql
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='rpc_admin_correct_bmr_plan_mapping'
    and pg_get_function_identity_arguments(p.oid)='p_operation_type text, p_batch_plan_batch_id bigint, p_target_bmr_id integer, p_new_bn text, p_new_batch_size numeric, p_reason text, p_supporting_reference text, p_impact_acknowledged boolean, p_client_request_id uuid';

  if v_sql is null then
    raise exception 'Canonical BMR administrative correction RPC not found';
  end if;

  v_old_sql := v_sql;
  v_sql := replace(v_sql, '  v_old_bmr record;', '  v_old_bmr public.bmr_details%rowtype;');
  v_sql := replace(v_sql, '  v_target_bmr record;', '  v_target_bmr public.bmr_details%rowtype;');

  if v_sql = v_old_sql then
    raise exception 'Expected untyped BMR record declarations were not found';
  end if;

  execute v_sql;
end;
$migration$;

revoke all on function public.rpc_admin_correct_bmr_plan_mapping(text,bigint,integer,text,numeric,text,text,boolean,uuid) from public, anon;
grant execute on function public.rpc_admin_correct_bmr_plan_mapping(text,bigint,integer,text,numeric,text,text,boolean,uuid) to authenticated, service_role;