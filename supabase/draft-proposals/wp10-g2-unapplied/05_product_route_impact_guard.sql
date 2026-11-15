-- WP10 G2 PROPOSAL 05 — UNAPPLIED. DO NOT RUN without separate, exact, owner-authorised operational approval.
-- Owner decision O4: supported route-changing product edits need an impact/remediation REVIEW; do NOT blanket-block subgroup edits.
-- Contract: a change of products.sub_group_id is REJECTED only when ALL hold —
--   (1) the product has at least one ACTIVE SKU, (2) its production route was VALID before the change, (3) it is NOT valid after it.
--   Validity is the LIVE canonical costing.fn_validate_effective_product_process_route(product, today IST) — no duplicated resolver logic.
-- Allowed (normal edits unaffected): any edit not touching sub_group_id; subgroup moves with no active SKU; moves after which the route is still valid;
--   moves where the route was already invalid (nothing newly lost); EVALUATION ERRORS (explicit decision: unknown never blocks master-data edits; the
--   detection layer — epoch -> STALE and the operational horizon — remains).
-- Error text names the remediation. Rollback of a rejected statement is automatic (AFTER-row trigger raises inside the writer's transaction), so
-- rpc_update_product's product row AND its product_master_audit row are not committed.
-- UNRESOLVED CONTRACT (returned, not invented): a read-only IMPACT PREVIEW before submit would need a date/subgroup-parameterised route resolver
-- (new logic) or a rollback-based dry run (a write); neither is authorised. An owner-approved override/exception workflow is likewise NOT defined here.
-- Out of scope: edits to sub_groups.product_group_id (affects many products) and route-mapping table edits themselves.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.fn_wp10_product_route_impact_before()
returns trigger
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $fn$
declare v_val text;
begin
  if new.sub_group_id is not distinct from old.sub_group_id then return new; end if;
  if not exists (select 1 from public.product_skus s where s.product_id = old.id and s.is_active) then return new; end if;
  begin
    v_val := coalesce(costing.fn_validate_effective_product_process_route(old.id, costing.fn_wp10_today_ist()) ->> 'valid', 'false');
  exception when others then v_val := 'unknown';
  end;
  perform set_config('wp10.rv_' || old.id::text, v_val, true);
  return new;
end
$fn$;

create or replace function public.fn_wp10_product_route_impact_after()
returns trigger
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $fn$
declare
  v_before text;
  v_after text;
  v_active integer;
begin
  if new.sub_group_id is not distinct from old.sub_group_id then return null; end if;
  v_before := current_setting('wp10.rv_' || new.id::text, true);
  perform set_config('wp10.rv_' || new.id::text, '', true);
  if v_before is distinct from 'true' then return null; end if;
  begin
    v_after := coalesce(costing.fn_validate_effective_product_process_route(new.id, costing.fn_wp10_today_ist()) ->> 'valid', 'false');
  exception when others then return null;
  end;
  if v_after = 'true' then return null; end if;
  select count(*) into v_active from public.product_skus s where s.product_id = new.id and s.is_active;
  if v_active = 0 then return null; end if;
  raise exception using
    errcode = 'P0001',
    message = format('WP10_PRODUCT_ROUTE_IMPACT: moving product %s to sub-group %s would remove its valid production route while %s active SKU(s) exist.', new.id, new.sub_group_id, v_active),
    hint = 'Map the new sub-group (or group) to an approved production route family first, or deactivate the active SKUs through rpc_set_product_sku_active, then repeat the edit.';
end
$fn$;
revoke all on function public.fn_wp10_product_route_impact_before() from public, anon, authenticated;
revoke all on function public.fn_wp10_product_route_impact_after() from public, anon, authenticated;

drop trigger if exists trg_wp10_product_route_impact_before on public.products;
create trigger trg_wp10_product_route_impact_before
  before update of sub_group_id on public.products
  for each row execute function public.fn_wp10_product_route_impact_before();
drop trigger if exists trg_wp10_product_route_impact_after on public.products;
create trigger trg_wp10_product_route_impact_after
  after update of sub_group_id on public.products
  for each row execute function public.fn_wp10_product_route_impact_after();
commit;
