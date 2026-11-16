-- REVIEW ONLY — rollback of nine parent classification RPCs; requires explicit approval.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $check$ begin
 if to_regprocedure('public.rpc_wp10_create_category(text)') is null then raise exception 'Missing expected create category RPC'; end if;
 if to_regprocedure('public.rpc_wp10_rename_category(integer,text)') is null then raise exception 'Missing expected rename category RPC'; end if;
 if to_regprocedure('public.rpc_wp10_delete_category(integer)') is null then raise exception 'Missing expected delete category RPC'; end if;
 if to_regprocedure('public.rpc_wp10_create_subcategory(integer,text)') is null then raise exception 'Missing expected create subcategory RPC'; end if;
 if to_regprocedure('public.rpc_wp10_rename_subcategory(integer,text)') is null then raise exception 'Missing expected rename subcategory RPC'; end if;
 if to_regprocedure('public.rpc_wp10_delete_subcategory(integer)') is null then raise exception 'Missing expected delete subcategory RPC'; end if;
 if to_regprocedure('public.rpc_wp10_create_product_group(integer,text,integer)') is null then raise exception 'Missing expected create product_group RPC'; end if;
 if to_regprocedure('public.rpc_wp10_rename_product_group(integer,text)') is null then raise exception 'Missing expected rename product_group RPC'; end if;
 if to_regprocedure('public.rpc_wp10_delete_product_group(integer)') is null then raise exception 'Missing expected delete product_group RPC'; end if;
end $check$;
drop function public.rpc_wp10_create_category(text);
drop function public.rpc_wp10_rename_category(integer,text);
drop function public.rpc_wp10_delete_category(integer);
drop function public.rpc_wp10_create_subcategory(integer,text);
drop function public.rpc_wp10_rename_subcategory(integer,text);
drop function public.rpc_wp10_delete_subcategory(integer);
drop function public.rpc_wp10_create_product_group(integer,text,integer);
drop function public.rpc_wp10_rename_product_group(integer,text);
drop function public.rpc_wp10_delete_product_group(integer);
commit;
