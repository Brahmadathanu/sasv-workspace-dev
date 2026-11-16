-- WP10 REVIEW ONLY: governed Manage Sub-Groups CRUD. NOT AUTHORISED FOR PRODUCTION.
-- Deliberately excludes product_group_id reassignment.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
 if to_regprocedure('public.require_permission(text,boolean)') is null then raise exception 'Missing permission guard'; end if;
 if to_regprocedure('public.rpc_wp10_create_subgroup(integer,text)') is not null or to_regprocedure('public.rpc_wp10_rename_subgroup(integer,text)') is not null or to_regprocedure('public.rpc_wp10_delete_subgroup(integer)') is not null then raise exception 'WP10 subgroup RPC already exists; refuse overwrite'; end if;
end $preflight$;
create function public.rpc_wp10_create_subgroup(p_group_id integer,p_name text) returns integer
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $fn$
declare v_id integer; v_name text:=btrim(p_name);
begin
 perform public.require_permission('module:manage-subgroups',true);
 if p_group_id is null or not exists(select 1 from public.product_groups where id=p_group_id) then raise exception 'Invalid product group'; end if;
 if v_name is null or length(v_name)=0 or length(v_name)>200 then raise exception 'Invalid subgroup name'; end if;
 insert into public.sub_groups(product_group_id,sub_group_name) values(p_group_id,v_name) returning id into v_id;
 return v_id;
end $fn$;
create function public.rpc_wp10_rename_subgroup(p_subgroup_id integer,p_name text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $fn$
declare v_name text:=btrim(p_name);
begin
 perform public.require_permission('module:manage-subgroups',true);
 if p_subgroup_id is null or v_name is null or length(v_name)=0 or length(v_name)>200 then raise exception 'Invalid subgroup rename'; end if;
 update public.sub_groups set sub_group_name=v_name where id=p_subgroup_id;
 if not found then raise exception 'Subgroup not found'; end if;
end $fn$;
create function public.rpc_wp10_delete_subgroup(p_subgroup_id integer) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $fn$
begin
 perform public.require_permission('module:manage-subgroups',true);
 if p_subgroup_id is null then raise exception 'Invalid subgroup id'; end if;
 -- Protect product dependencies; FK constraints protect any remaining mapping dependencies.
 perform 1 from public.sub_groups where id=p_subgroup_id for update;
 if not found then raise exception 'Subgroup not found'; end if;
 if exists(select 1 from public.products where sub_group_id=p_subgroup_id) then raise exception 'Cannot delete subgroup referenced by products'; end if;
 delete from public.sub_groups where id=p_subgroup_id;
end $fn$;
revoke all on function public.rpc_wp10_create_subgroup(integer,text),public.rpc_wp10_rename_subgroup(integer,text),public.rpc_wp10_delete_subgroup(integer) from public,anon,authenticated;
grant execute on function public.rpc_wp10_create_subgroup(integer,text),public.rpc_wp10_rename_subgroup(integer,text),public.rpc_wp10_delete_subgroup(integer) to authenticated;
commit;
