-- REVIEW ONLY: phase-2 guarded revoke of direct classification master DML.
-- NEVER apply until new clients and older Electron compatibility have passed acceptance.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
declare t text; f text; a text;
begin
 foreach t in array array['categories','sub_categories','product_groups','sub_groups'] loop
  if not has_table_privilege('authenticated',format('public.%I',t),'SELECT') then raise exception 'SELECT missing on %',t; end if;
  if not has_table_privilege('authenticated',format('public.%I',t),'INSERT')
    or not has_table_privilege('authenticated',format('public.%I',t),'UPDATE')
    or not has_table_privilege('authenticated',format('public.%I',t),'DELETE') then
    raise exception 'Expected authenticated DML baseline absent on %',t;
  end if;
 end loop;
 if to_regprocedure('public.rpc_wp10_create_category(text)') is null then raise exception 'Missing governed RPC create_category'; end if;
 if to_regprocedure('public.rpc_wp10_rename_category(integer,text)') is null then raise exception 'Missing governed RPC rename_category'; end if;
 if to_regprocedure('public.rpc_wp10_delete_category(integer)') is null then raise exception 'Missing governed RPC delete_category'; end if;
 if to_regprocedure('public.rpc_wp10_create_subcategory(integer,text)') is null then raise exception 'Missing governed RPC create_subcategory'; end if;
 if to_regprocedure('public.rpc_wp10_rename_subcategory(integer,text)') is null then raise exception 'Missing governed RPC rename_subcategory'; end if;
 if to_regprocedure('public.rpc_wp10_delete_subcategory(integer)') is null then raise exception 'Missing governed RPC delete_subcategory'; end if;
 if to_regprocedure('public.rpc_wp10_create_product_group(integer,text,integer)') is null then raise exception 'Missing governed RPC create_product_group'; end if;
 if to_regprocedure('public.rpc_wp10_rename_product_group(integer,text)') is null then raise exception 'Missing governed RPC rename_product_group'; end if;
 if to_regprocedure('public.rpc_wp10_delete_product_group(integer)') is null then raise exception 'Missing governed RPC delete_product_group'; end if;
 if to_regprocedure('public.rpc_wp10_create_subgroup(integer,text)') is null then raise exception 'Missing governed RPC create_subgroup'; end if;
 if to_regprocedure('public.rpc_wp10_rename_subgroup(integer,text)') is null then raise exception 'Missing governed RPC rename_subgroup'; end if;
 if to_regprocedure('public.rpc_wp10_delete_subgroup(integer)') is null then raise exception 'Missing governed RPC delete_subgroup'; end if;
end $preflight$;
revoke insert,update,delete on table public.categories,public.sub_categories,public.product_groups,public.sub_groups from authenticated;
do $postflight$
declare t text;
begin
 foreach t in array array['categories','sub_categories','product_groups','sub_groups'] loop
  if not has_table_privilege('authenticated',format('public.%I',t),'SELECT')
     or has_table_privilege('authenticated',format('public.%I',t),'INSERT')
     or has_table_privilege('authenticated',format('public.%I',t),'UPDATE')
     or has_table_privilege('authenticated',format('public.%I',t),'DELETE')
  then raise exception 'Four-level DML revoke postflight failed on %',t; end if;
 end loop;
end $postflight$;
commit;
