-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_price_revision_joint_stage_load(
 p_class text,p_solid numeric,p_output numeric,p_uom text,p_date date,
 p_stage bigint,p_override bigint,p_activity integer
) returns numeric language plpgsql stable security invoker
set search_path=costing,pg_temp as $$
begin
 if p_stage=1391 and p_activity=197 and p_class='MANUAL'
 and exists(select 1 from costing.joint_process_policy p
 join costing.joint_process_stage s on s.policy_id=p.id
 where s.base_step_id=p_stage and p.effective_from<=p_date
 and (p.effective_to is null or p.effective_to>p_date)) then
   return 1::numeric;
 end if;
 return costing.fn_au9_g4_route_step_loads(
 p_class,p_solid,p_output,p_uom,p_date,p_stage,p_override,p_activity);
end $$;
revoke all on function costing.fn_price_revision_joint_stage_load(text,numeric,numeric,text,date,bigint,bigint,integer) from public,anon,authenticated;