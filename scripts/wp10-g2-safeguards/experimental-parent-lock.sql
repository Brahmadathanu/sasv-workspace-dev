-- WP10 PHASE 2 EXPERIMENTAL CORRECTION CANDIDATE — UNAPPLIED, NOT AN INSTALLABLE MIGRATION.
-- Isolated PostgreSQL fixture use ONLY. DO NOT APPLY TO SUPABASE.
-- The candidate serialises first activation with a concurrent product subgroup update
-- by acquiring the parent row lock and RECHECKING the five essentials AFTER that lock.
-- This is a trigger-level defence for RPC and privileged direct writes; not a substitute
-- for independent deadlock, performance, trigger-order and rollback review.
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
-- Name deliberately ordered after the existing trg_sku_activation_completeness_guard;
-- the existing early precheck remains, but the final recheck is authoritative.
create trigger zz_wp10_activation_parent_lock_recheck
  before insert or update of is_active, product_id on public.product_skus
  for each row execute function public.fn_wp10_activation_parent_lock_recheck();
