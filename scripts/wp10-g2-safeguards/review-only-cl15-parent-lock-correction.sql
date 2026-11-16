-- WP10 CL15 correction-only REVIEW CANDIDATE — UNAPPLIED. Owner authorization required.
-- Transactional fail-closed preflight for existing activation guard and no name collisions.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
 if to_regprocedure('public.fn_wp10_activation_parent_lock_recheck()') is not null then raise exception 'WP10 CL15 function already exists'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.product_skus'::regclass and tgname='zz_wp10_activation_parent_lock_recheck') then raise exception 'WP10 CL15 trigger already exists'; end if;
 if to_regprocedure('costing.fn_sku_activation_missing_items(bigint,bigint)') is null then raise exception 'Missing live activation recheck contract'; end if;
 if to_regprocedure('public.fn_wp10_product_route_impact_before()') is null or to_regprocedure('public.fn_wp10_product_route_impact_after()') is null then raise exception 'CL15 requires proposal 05 route impact guards'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.products'::regclass and tgname='trg_wp10_product_route_impact_after' and tgenabled='O') then raise exception 'CL15 requires enabled proposal 05 route impact trigger'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.product_skus'::regclass and tgname='trg_sku_activation_completeness_guard' and not tgisinternal and tgenabled='O') then raise exception 'Activation completeness guard missing or disabled'; end if;
end $preflight$;
create function public.fn_wp10_activation_parent_lock_recheck()
returns trigger language plpgsql security definer
set search_path = public, costing, pg_temp
as $wp10$
declare
  v_parent_id integer;
  v_parent_active boolean;
  v_check jsonb;
begin
  if new.is_active is not true then return new; end if;
  if tg_op = 'UPDATE' and old.is_active is true and old.product_id is not distinct from new.product_id then return new; end if;
  if new.product_id is null then
    raise exception using errcode='P0001', message='WP10_ACTIVATION_PARENT_MISSING: product_id is required';
  end if;
  -- FOR UPDATE conflicts with the product writer's row UPDATE lock.
  -- On READ COMMITTED, the subsequent statement sees the newly committed subgroup.
  select p.id, p.status = 'Active' into v_parent_id, v_parent_active
    from public.products p where p.id = new.product_id for update;
  if v_parent_id is null or v_parent_active is not true then
    raise exception using errcode='P0001', message='WP10_ACTIVATION_PARENT_INVALID: parent missing or inactive';
  end if;
  v_check := costing.fn_sku_activation_missing_items(new.id, new.product_id);
  if coalesce(jsonb_typeof(v_check->'missing'), '') <> 'array'
     or jsonb_array_length(v_check->'missing') > 0 then
    raise exception using errcode='P0001',
      message='WP10_ACTIVATION_RECHECK_FAILED: activation essentials changed while acquiring the parent lock',
      detail=coalesce(v_check::text, 'missing validation result');
  end if;
  return new;
end
$wp10$;
revoke all on function public.fn_wp10_activation_parent_lock_recheck() from public, anon, authenticated;
create trigger zz_wp10_activation_parent_lock_recheck
  before insert or update of is_active, product_id on public.product_skus
  for each row execute function public.fn_wp10_activation_parent_lock_recheck();
do $postflight$
begin
 if to_regprocedure('public.fn_wp10_activation_parent_lock_recheck()') is null then raise exception 'New lock recheck function missing'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.product_skus'::regclass and tgname='zz_wp10_activation_parent_lock_recheck' and tgenabled='O') then raise exception 'New lock recheck trigger missing or disabled'; end if;
end $postflight$;
commit;
