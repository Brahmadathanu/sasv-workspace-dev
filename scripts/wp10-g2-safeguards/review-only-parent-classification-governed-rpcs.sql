-- REVIEW ONLY — WP10 four-level master governance; parent three levels.
-- Must run before client migration. Never combine with direct-table REVOKE without compatibility acceptance.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $preflight$ begin
 if to_regprocedure('public.require_permission(text,boolean)') is null then raise exception 'Missing canonical permission guard'; end if;
 if to_regprocedure('public.rpc_wp10_create_category(text)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
 if to_regprocedure('public.rpc_wp10_rename_category(integer,text)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
 if to_regprocedure('public.rpc_wp10_delete_category(integer)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
 if to_regprocedure('public.rpc_wp10_create_subcategory(integer,text)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
 if to_regprocedure('public.rpc_wp10_rename_subcategory(integer,text)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
 if to_regprocedure('public.rpc_wp10_delete_subcategory(integer)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
 if to_regprocedure('public.rpc_wp10_create_product_group(integer,text,integer)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
 if to_regprocedure('public.rpc_wp10_rename_product_group(integer,text)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
 if to_regprocedure('public.rpc_wp10_delete_product_group(integer)') is not null then raise exception 'Existing WP10 RPC; refuse overwrite'; end if;
end $preflight$;

create function public.rpc_wp10_create_category(p_name text) returns integer
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
declare v_id integer;
begin
 perform public.require_permission('module:manage-categories',true);
 if p_name is null or length(btrim(p_name))=0 or length(btrim(p_name))>200 then raise exception 'Invalid name'; end if;
 insert into public.categories(category_name) values(btrim(p_name)) returning id into v_id;
 return v_id;
end $fn$;

create function public.rpc_wp10_rename_category(p_id integer,p_name text) returns void
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
begin
 perform public.require_permission('module:manage-categories',true);
 if p_name is null or length(btrim(p_name))=0 or length(btrim(p_name))>200 then raise exception 'Invalid name'; end if;
 if p_id is null then raise exception 'Missing ID'; end if;
 update public.categories set category_name=btrim(p_name) where id=p_id;
 if not found then raise exception 'Record not found'; end if;
end $fn$;

create function public.rpc_wp10_delete_category(p_id integer) returns void
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
begin
 perform public.require_permission('module:manage-categories',true);
 if p_id is null then raise exception 'Missing ID'; end if;
 perform 1 from public.categories where id=p_id for update;
 if not found then raise exception 'Record not found'; end if;
 if exists(select 1 from public.sub_categories where category_id=p_id) then raise exception 'Deletion blocked: subordinate classification records exist'; end if;
 -- Other dependencies are enforced by their existing foreign keys.
 delete from public.categories where id=p_id;
end $fn$;

create function public.rpc_wp10_create_subcategory(p_parent_id integer, p_name text) returns integer
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
declare v_id integer;
begin
 perform public.require_permission('module:manage-subcategories',true);
 if p_name is null or length(btrim(p_name))=0 or length(btrim(p_name))>200 then raise exception 'Invalid name'; end if;
 if p_parent_id is null or not exists(select 1 from public.categories where id=p_parent_id) then raise exception 'Parent not found'; end if;
 insert into public.sub_categories(category_id,subcategory_name) values(p_parent_id,btrim(p_name)) returning id into v_id;
 return v_id;
end $fn$;

create function public.rpc_wp10_rename_subcategory(p_id integer,p_name text) returns void
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
begin
 perform public.require_permission('module:manage-subcategories',true);
 if p_name is null or length(btrim(p_name))=0 or length(btrim(p_name))>200 then raise exception 'Invalid name'; end if;
 if p_id is null then raise exception 'Missing ID'; end if;
 update public.sub_categories set subcategory_name=btrim(p_name) where id=p_id;
 if not found then raise exception 'Record not found'; end if;
end $fn$;

create function public.rpc_wp10_delete_subcategory(p_id integer) returns void
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
begin
 perform public.require_permission('module:manage-subcategories',true);
 if p_id is null then raise exception 'Missing ID'; end if;
 perform 1 from public.sub_categories where id=p_id for update;
 if not found then raise exception 'Record not found'; end if;
 if exists(select 1 from public.product_groups where sub_category_id=p_id) then raise exception 'Deletion blocked: subordinate classification records exist'; end if;
 -- Other dependencies are enforced by their existing foreign keys.
 delete from public.sub_categories where id=p_id;
end $fn$;

create function public.rpc_wp10_create_product_group(p_parent_id integer, p_name text, p_kind_id integer) returns integer
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
declare v_id integer;
begin
 perform public.require_permission('module:manage-product-groups',true);
 if p_name is null or length(btrim(p_name))=0 or length(btrim(p_name))>200 then raise exception 'Invalid name'; end if;
 if p_parent_id is null or not exists(select 1 from public.sub_categories where id=p_parent_id) then raise exception 'Parent not found'; end if;
 if p_kind_id is null or not exists(select 1 from public.product_group_kinds where id=p_kind_id) then raise exception 'Invalid product group kind'; end if;
 insert into public.product_groups(sub_category_id,group_name,kind_id) values(p_parent_id,btrim(p_name),p_kind_id) returning id into v_id;
 return v_id;
end $fn$;

create function public.rpc_wp10_rename_product_group(p_id integer,p_name text) returns void
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
begin
 perform public.require_permission('module:manage-product-groups',true);
 if p_name is null or length(btrim(p_name))=0 or length(btrim(p_name))>200 then raise exception 'Invalid name'; end if;
 if p_id is null then raise exception 'Missing ID'; end if;
 update public.product_groups set group_name=btrim(p_name) where id=p_id;
 if not found then raise exception 'Record not found'; end if;
end $fn$;

create function public.rpc_wp10_delete_product_group(p_id integer) returns void
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $fn$
begin
 perform public.require_permission('module:manage-product-groups',true);
 if p_id is null then raise exception 'Missing ID'; end if;
 perform 1 from public.product_groups where id=p_id for update;
 if not found then raise exception 'Record not found'; end if;
 if exists(select 1 from public.sub_groups where product_group_id=p_id) then raise exception 'Deletion blocked: subordinate classification records exist'; end if;
 -- Other dependencies are enforced by their existing foreign keys.
 delete from public.product_groups where id=p_id;
end $fn$;

revoke all on function public.rpc_wp10_create_category(text) from public, anon, authenticated;
grant execute on function public.rpc_wp10_create_category(text) to authenticated;
revoke all on function public.rpc_wp10_rename_category(integer,text) from public, anon, authenticated;
grant execute on function public.rpc_wp10_rename_category(integer,text) to authenticated;
revoke all on function public.rpc_wp10_delete_category(integer) from public, anon, authenticated;
grant execute on function public.rpc_wp10_delete_category(integer) to authenticated;
revoke all on function public.rpc_wp10_create_subcategory(integer,text) from public, anon, authenticated;
grant execute on function public.rpc_wp10_create_subcategory(integer,text) to authenticated;
revoke all on function public.rpc_wp10_rename_subcategory(integer,text) from public, anon, authenticated;
grant execute on function public.rpc_wp10_rename_subcategory(integer,text) to authenticated;
revoke all on function public.rpc_wp10_delete_subcategory(integer) from public, anon, authenticated;
grant execute on function public.rpc_wp10_delete_subcategory(integer) to authenticated;
revoke all on function public.rpc_wp10_create_product_group(integer,text,integer) from public, anon, authenticated;
grant execute on function public.rpc_wp10_create_product_group(integer,text,integer) to authenticated;
revoke all on function public.rpc_wp10_rename_product_group(integer,text) from public, anon, authenticated;
grant execute on function public.rpc_wp10_rename_product_group(integer,text) to authenticated;
revoke all on function public.rpc_wp10_delete_product_group(integer) from public, anon, authenticated;
grant execute on function public.rpc_wp10_delete_product_group(integer) to authenticated;
commit;
