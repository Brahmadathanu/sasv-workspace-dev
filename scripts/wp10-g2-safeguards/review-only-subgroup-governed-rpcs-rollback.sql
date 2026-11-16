-- WP10 REVIEW-ONLY rollback for review-only-subgroup-governed-rpcs.sql.
-- Do not execute without separate owner approval and dependency verification.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
 if to_regprocedure('public.rpc_wp10_create_subgroup(integer,text)') is null or to_regprocedure('public.rpc_wp10_rename_subgroup(integer,text)') is null or to_regprocedure('public.rpc_wp10_delete_subgroup(integer)') is null then raise exception 'WP10 rollback preflight: expected RPC missing'; end if;
end $preflight$;
drop function public.rpc_wp10_create_subgroup(integer,text);
drop function public.rpc_wp10_rename_subgroup(integer,text);
drop function public.rpc_wp10_delete_subgroup(integer);
commit;
