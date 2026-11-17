-- WP10 RM1 REVIEW ONLY: restore exact client <-> server subgroup-inactivation reason contract.
-- Existing UI always supplies p_inactivation_reason, but live PostgreSQL has only (bigint,date).
-- This proposed 3-arg overload PRESERVES existing 2-arg RPC, records the reason in a private
-- immutable event register and delegates the lifecycle transition to the existing governed RPC.
-- Requires full route-integrity constraint review; is NOT A PRODUCTION MIGRATION.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
 if to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date)') is null
   then raise exception 'Two-arg governed base RPC missing'; end if;
 if to_regprocedure('public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text)') is not null
   then raise exception 'Three-arg reason RPC already exists'; end if;
 if to_regclass('costing.production_route_family_product_subgroup_inactivation_audit') is not null
   then raise exception 'Inactivation audit register already exists'; end if;
end $preflight$;

create table costing.production_route_family_product_subgroup_inactivation_audit (
 id bigint generated always as identity primary key,
 mapping_id bigint not null references costing.production_route_family_product_subgroup_map(id),
 requested_effective_to date not null,
 inactivation_reason text not null check(length(btrim(inactivation_reason)) between 5 and 2000),
 performed_by uuid,
 performed_at timestamptz not null default clock_timestamp()
);
alter table costing.production_route_family_product_subgroup_inactivation_audit enable row level security;
revoke all on costing.production_route_family_product_subgroup_inactivation_audit from public,anon,authenticated;

create function public.rpc_inactivate_product_subgroup_route_family_mapping(
 p_mapping_id bigint, p_effective_to date, p_inactivation_reason text
) returns jsonb language plpgsql security definer
set search_path='public','costing','pg_temp'
as $body$
declare v_reason text:=nullif(btrim(p_inactivation_reason),''); v_result jsonb;
begin
 perform public.require_permission('module:production-route-manager',true);
 if v_reason is null or length(v_reason) < 5 or length(v_reason)>2000
 then raise exception using errcode='22023',message='A meaningful inactivation reason (5 to 2000 characters) is required'; end if;
 if p_mapping_id is null or p_effective_to is null
 then raise exception using errcode='22023',message='Mapping ID and effective-to date are required'; end if;
 -- Defer all existing immutable-history and lifecycle checks to the live governed RPC.
 -- The separately reviewed mapping-impact guard vetoes unsafe state in the SAME transaction.
 v_result:=public.rpc_inactivate_product_subgroup_route_family_mapping(p_mapping_id,p_effective_to);
 insert into costing.production_route_family_product_subgroup_inactivation_audit
 (mapping_id,requested_effective_to,inactivation_reason,performed_by)
 values (p_mapping_id,p_effective_to,v_reason,auth.uid());
 return v_result||jsonb_build_object('reason_recorded',true);
end $body$;
revoke all on function public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text) from public,anon,authenticated;
grant execute on function public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date,text) to authenticated,service_role;
commit;
