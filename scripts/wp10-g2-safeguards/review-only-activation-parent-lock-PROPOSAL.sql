-- REVIEW ONLY — WP10/CL15 candidate shared-product serialization lock.
-- NEVER APPLY TO PRODUCTION without a new independent SQL/role/lock audit and explicit owner authority.
-- Must be installed ATOMICALLY with a reviewed route-impact guard 05; original 05 alone is unsafe.
-- Detached source is only used by the disposable isolated PostgreSQL test, not a registered migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $preflight$
begin
 if to_regprocedure('public.fn_wp10_activation_parent_lock()') is not null
   or exists (select 1 from pg_trigger where tgname='trg_aa_wp10_activation_parent_lock' and not tgisinternal)
 then raise exception 'WP10 candidate parent lock already exists; no replacement';
 end if;
 if to_regprocedure('public.fn_wp10_product_route_impact_before()') is null
   or to_regprocedure('public.fn_wp10_product_route_impact_after()') is null
 then raise exception 'WP10 original guard 05 must be present in the same atomic installation';
 end if;
end
$preflight$;

create function public.fn_wp10_activation_parent_lock()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $body$
begin
  if new.is_active is not true then return new; end if;
  if tg_op = 'UPDATE' and old.is_active is true and
     new.product_id is not distinct from old.product_id then return new; end if;
  -- Parent row SHARE locks conflict with product writer's SELECT FOR UPDATE,
  -- and are held through commit. This forces both directions to see a fresh committed route.
  perform 1 from public.products p where p.id=new.product_id for share;
  if not found then
    raise exception using errcode='P0001',message='WP10_PARENT_MISSING_DURING_ACTIVATION';
  end if;
  return new;
end
$body$;
revoke all on function public.fn_wp10_activation_parent_lock() from public,anon,authenticated;
create trigger trg_aa_wp10_activation_parent_lock
  before insert or update of is_active,product_id on public.product_skus
  for each row execute function public.fn_wp10_activation_parent_lock();

do $wp10_cl15_receipt$
declare v oid; t oid;
begin
  v:=to_regprocedure('public.fn_wp10_activation_parent_lock()');
  select oid into t from pg_trigger where tgname='trg_aa_wp10_activation_parent_lock' and tgrelid='public.product_skus'::regclass and not tgisinternal;
  if v is null or t is null then raise exception 'CL15 receipt objects missing'; end if;
  execute format('comment on function %s is %L',v::regprocedure,'WP10-CL15 activation-parent-lock md5:'||md5(pg_get_functiondef(v)));
  execute format('comment on trigger %I on public.product_skus is %L','trg_aa_wp10_activation_parent_lock','WP10-CL15 activation-parent-lock md5:'||md5(pg_get_triggerdef(t)));
end $wp10_cl15_receipt$;
commit;
