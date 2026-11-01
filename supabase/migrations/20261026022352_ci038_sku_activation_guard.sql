-- Applied live on 2026-10-26 via Supabase MCP apply_migration; recorded here for the repo
-- APPLIED live via Supabase MCP apply_migration, version 20261026022352 (26 Oct 2026 07:53 IST), name ci038_sku_activation_guard. Body identical to 20261026090000_ci038_sku_activation_guard.sql
-- CI-038  SKU activation guard + SKU change log  (PREPARED, NOT APPLIED)
-- Decision basis: Dr. Brahmadathan U, 26 Oct 2026 (chat t155u/t157u):
--   * A SKU may only be created active / switched inactive->active when ALL five
--     costing essentials resolve: approved PM-BOM revision, batch-size reference,
--     production route (READY), MRP policy, selling-price/GST policy.
--   * Evaluated as of the CURRENT governed costing period's valuation date.
--   * NO exemptions (no sample / urgent override). Missing sales basis does NOT block.
--   * Existing active SKUs untouched; inactive SKUs may stay incomplete.
--   * Direct table edits are caught (trigger) and every SKU row change is logged.
-- Logic mirrors costing.fn_wp04_c_live_core (same resolvers, same as-of rules)
-- but for one SKU only, so it stays fast enough for a trigger.

begin;

-- 1. Helper: which essentials are missing? (empty array = complete)
create or replace function costing.fn_sku_activation_missing_items(p_sku_id bigint, p_product_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = costing, public, pg_temp
as $fn$
declare
  v_product_id bigint;
  v_period date;
  v_val date;
  v_missing jsonb := '[]'::jsonb;
  v_family bigint;
  v_valid jsonb;
begin
  v_product_id := coalesce(p_product_id, (select s.product_id from public.product_skus s where s.id = p_sku_id));
  if v_product_id is null then
    raise exception 'SKU % not found', p_sku_id;
  end if;

  -- Current governed costing period = latest period; its valuation date is the as-of date.
  select cp.period_start, cp.valuation_date into v_period, v_val
  from costing.cost_periods cp order by cp.period_start desc limit 1;
  v_val := coalesce(v_val, current_date);   -- documented fallback if valuation date not yet set

  -- (1) Approved PM-BOM revision (SKU level)
  if not exists (select 1 from public.plm_sku_bom_revision_as_of(p_sku_id, v_val) b where b.id is not null) then
    v_missing := v_missing || jsonb_build_object('code','PM_BOM_REVISION','label','Approved packing-material BOM','where','PM BOM Manager');
  end if;

  -- (2) Batch-size reference (product level)
  if not exists (select 1 from public.production_batch_size_ref b
                 where b.product_id = v_product_id and b.is_active
                   and b.effective_from <= v_val and (b.effective_to is null or b.effective_to >= v_val)) then
    v_missing := v_missing || jsonb_build_object('code','BATCH_SIZE_REFERENCE','label','Batch size reference','where','Batch Sizes (Supply / Batch Plan)');
  end if;

  -- (3) Production route READY (single-product version of costing.fn_product_process_route_readiness)
  v_family := costing.fn_resolve_route_family_for_product(v_product_id::int, v_val);
  v_valid  := costing.fn_validate_effective_product_process_route(v_product_id::int, v_val);
  if v_family is null
     or not exists (select 1 from costing.production_route_family_route r
                    where r.route_family_id = v_family and r.archived_at is null and r.status = 'APPROVED'
                      and r.effective_from <= v_val and (r.effective_to is null or r.effective_to >= v_val))
     or not coalesce((v_valid->>'valid')::boolean, false) then
    v_missing := v_missing || jsonb_build_object('code','MANUFACTURING_ROUTE','label','Production route','where','Production Route Manager');
  end if;

  -- (4) MRP policy
  if coalesce((select m.resolution_status from costing.fn_resolve_sku_mrp_as_of(p_sku_id, v_val) m limit 1), '') <> 'RESOLVED' then
    v_missing := v_missing || jsonb_build_object('code','MRP_POLICY','label','MRP policy','where','Pricing Policy Manager > MRP');
  end if;

  -- (5) Selling-price / GST policy
  if coalesce((select x.resolution_status from costing.fn_resolve_sku_selling_price_policy_as_of(p_sku_id, v_val) x limit 1), '') <> 'RESOLVED' then
    v_missing := v_missing || jsonb_build_object('code','SELLING_PRICE_POLICY','label','Selling price / GST policy','where','Pricing Policy Manager > Selling & scheme policies');
  end if;

  return jsonb_build_object('sku_id', p_sku_id, 'period_start', v_period, 'as_of_date', v_val, 'missing', v_missing);
end
$fn$;

revoke all on function costing.fn_sku_activation_missing_items(bigint, bigint) from public, anon, authenticated;

-- 2. Public read-only pre-check for the Manage Products screen
create or replace function public.rpc_get_sku_activation_check(p_sku_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, costing, pg_temp
as $fn$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.app_has_permission('module:manage-products', 'view') then
    raise exception 'Permission denied for module:manage-products';
  end if;
  return costing.fn_sku_activation_missing_items(p_sku_id);
end
$fn$;
revoke all on function public.rpc_get_sku_activation_check(bigint) from public, anon;
grant execute on function public.rpc_get_sku_activation_check(bigint) to authenticated;

-- 3. Guard trigger (catches RPCs, SQL editor, service role, imports)
create or replace function public.fn_guard_sku_activation_completeness()
returns trigger
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $fn$
declare
  v_chk jsonb;
  v_list text;
begin
  if new.is_active is not true then return new; end if;
  if tg_op = 'UPDATE' and old.is_active is true then return new; end if;  -- already active: untouched

  v_chk := costing.fn_sku_activation_missing_items(new.id, new.product_id);
  if jsonb_array_length(v_chk->'missing') > 0 then
    select string_agg((m->>'label') || ' (' || (m->>'where') || ')', '; ')
      into v_list from jsonb_array_elements(v_chk->'missing') m;
    raise exception using
      errcode = 'P0001',
      message = format('Cannot activate SKU %s: missing %s. Fill these in, then activate again.', new.id, v_list),
      detail  = v_chk::text,
      hint    = 'Save the SKU as inactive until all five costing essentials are approved.';
  end if;
  return new;
end
$fn$;
revoke all on function public.fn_guard_sku_activation_completeness() from public, anon, authenticated;

drop trigger if exists trg_sku_activation_completeness_guard on public.product_skus;
create trigger trg_sku_activation_completeness_guard
  before insert or update of is_active, product_id on public.product_skus
  for each row execute function public.fn_guard_sku_activation_completeness();
-- Note: on INSERT new.id comes from the sequence default, so the SKU-level checks
-- (PM-BOM, MRP, selling policy) can never pass for a brand-new row => a SKU can
-- never be CREATED active; it must be created inactive, completed, then activated.
-- This matches the current client (js/products.js always creates p_is_active=false).

-- 4. Friendly pre-check in rpc_set_product_sku_active (same body + check before update)
create or replace function public.rpc_set_product_sku_active(p_sku_id bigint, p_is_active boolean, p_reason text, p_approval_reference text default null::text)
 returns table(sku_id bigint, product_id bigint, pack_size numeric, uom text, is_active boolean, is_sample boolean, audit_event_type text)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_actor uuid;
    v_reason text;
    v_approval_reference text;
    v_event_type text;
    v_old public.product_skus%rowtype;
    v_new public.product_skus%rowtype;
    v_chk jsonb;
    v_list text;
begin
    perform public.require_permission('module:manage-products', true);
    v_actor := auth.uid();
    if v_actor is null then raise exception 'Not authenticated'; end if;
    if p_sku_id is null then raise exception 'SKU ID is required'; end if;
    if p_is_active is null then raise exception 'Target SKU active state is required'; end if;
    v_reason := btrim(coalesce(p_reason, ''));
    v_approval_reference := nullif(btrim(coalesce(p_approval_reference, '')), '');
    if v_reason = '' then raise exception 'SKU lifecycle reason is required'; end if;

    select * into v_old from public.product_skus ps where ps.id = p_sku_id for update;
    if not found then raise exception 'SKU % does not exist', p_sku_id; end if;
    if v_old.is_active is not distinct from p_is_active then
        raise exception 'SKU % is already %', p_sku_id, case when p_is_active then 'active' else 'inactive' end;
    end if;

    if p_is_active then
        v_chk := costing.fn_sku_activation_missing_items(p_sku_id, v_old.product_id);
        if jsonb_array_length(v_chk->'missing') > 0 then
            select string_agg(m->>'label', ', ') into v_list from jsonb_array_elements(v_chk->'missing') m;
            raise exception using errcode = 'P0001',
              message = format('This SKU cannot be made active yet. Missing: %s.', v_list),
              detail = v_chk::text;
        end if;
    end if;

    v_event_type := case when p_is_active then 'ACTIVATE' else 'DEACTIVATE' end;

    update public.product_skus ps set is_active = p_is_active where ps.id = p_sku_id returning * into v_new;

    insert into public.product_sku_master_audit (sku_id, product_id, event_type, old_snapshot, new_snapshot, reason, approval_reference, actor_user_id)
    values (v_new.id, v_new.product_id, v_event_type, to_jsonb(v_old), to_jsonb(v_new), v_reason, v_approval_reference, v_actor);

    return query select v_new.id, v_new.product_id, v_new.pack_size, v_new.uom, v_new.is_active, v_new.is_sample, v_event_type;
end;
$function$;
-- grants on rpc_set_product_sku_active are preserved by CREATE OR REPLACE

-- 5. Change log for EVERY row change (so direct SQL edits are visible)
create table if not exists public.product_sku_change_log (
  id bigint generated always as identity primary key,
  sku_id bigint not null,
  op text not null check (op in ('INSERT','UPDATE','DELETE')),
  old_row jsonb,
  new_row jsonb,
  changed_columns text[],
  actor_user_id uuid,              -- null => not an app user (SQL editor / service role / cron)
  db_role text not null default current_user,
  session_role text not null default session_user,
  application_name text default current_setting('application_name', true),
  txid bigint not null default txid_current(),  -- join to product_sku_master_audit by time/txn
  changed_at timestamptz not null default now()
);
create index if not exists product_sku_change_log_sku_idx on public.product_sku_change_log (sku_id, changed_at desc);
alter table public.product_sku_change_log enable row level security;
revoke all on public.product_sku_change_log from public, anon, authenticated;
-- (no policies: readable only by owner/service role; a governed view can be added later)

create or replace function public.fn_log_product_sku_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_cols text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k) into v_cols from jsonb_object_keys(v_new) k where v_new->k is distinct from v_old->k;
    if v_cols is null then return null; end if;   -- no-op update
  end if;
  insert into public.product_sku_change_log (sku_id, op, old_row, new_row, changed_columns, actor_user_id)
  values (coalesce((v_new->>'id')::bigint, (v_old->>'id')::bigint), tg_op, v_old, v_new, v_cols, auth.uid());
  return null;
end
$fn$;
revoke all on function public.fn_log_product_sku_change() from public, anon, authenticated;

drop trigger if exists trg_product_sku_change_log on public.product_skus;
create trigger trg_product_sku_change_log
  after insert or update or delete on public.product_skus
  for each row execute function public.fn_log_product_sku_change();

commit;
