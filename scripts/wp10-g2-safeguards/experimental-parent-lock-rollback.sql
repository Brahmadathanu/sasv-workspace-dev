-- WP10 correction candidate rollback — DISPOSABLE FIXTURE ONLY.
-- NOT a production migration. This rollback targets ONLY the experimental
-- parent-lock trigger and function; it MUST NOT run proposal 99_rollback_all.sql
-- against an environment with previously applied Phase 1 functions.
-- Fail closed if either object is absent, renamed, or has unexpected definition.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $rollback$
declare
  v_trigger oid;
  v_function oid;
  v_definition text;
begin
  select oid into v_trigger from pg_trigger
    where tgrelid='public.product_skus'::regclass
      and tgname='zz_wp10_activation_parent_lock_recheck' and not tgisinternal;
  v_function := to_regprocedure('public.fn_wp10_activation_parent_lock_recheck()');
  if v_trigger is null or v_function is null then
    raise exception 'WP10 correction rollback refused: exact experimental objects absent';
  end if;
  select pg_get_triggerdef(v_trigger) into v_definition;
  if v_definition not like '%BEFORE INSERT OR UPDATE OF is_active, product_id ON public.product_skus%'
     or v_definition not like '%fn_wp10_activation_parent_lock_recheck()%'
     or pg_get_functiondef(v_function) not like '%WP10_ACTIVATION_RECHECK_FAILED%'
     or pg_get_functiondef(v_function) not like '%FOR UPDATE%' then
    raise exception 'WP10 correction rollback refused: experimental definition drift';
  end if;
  if exists (select 1 from pg_depend where refobjid=v_function and classid='pg_rewrite'::regclass) then
    raise exception 'WP10 correction rollback refused: unexpected dependent rewrite objects';
  end if;
  execute 'drop trigger zz_wp10_activation_parent_lock_recheck on public.product_skus';
  execute 'drop function public.fn_wp10_activation_parent_lock_recheck()';
end
$rollback$;
commit;
