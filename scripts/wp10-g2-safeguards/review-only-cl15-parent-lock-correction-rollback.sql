-- WP10 CL15 correction-only rollback candidate — UNAPPLIED and requires separate owner approval.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$ begin
 if to_regprocedure('public.fn_wp10_activation_parent_lock_recheck()') is null then raise exception 'Expected CL15 function missing'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.product_skus'::regclass and tgname='zz_wp10_activation_parent_lock_recheck') then raise exception 'Expected CL15 trigger missing'; end if;
end $preflight$;
drop trigger zz_wp10_activation_parent_lock_recheck on public.product_skus;
drop function public.fn_wp10_activation_parent_lock_recheck();
commit;
