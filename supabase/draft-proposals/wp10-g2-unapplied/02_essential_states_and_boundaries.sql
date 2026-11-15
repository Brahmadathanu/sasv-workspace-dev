-- WP10 G2 PROPOSAL 02 — UNAPPLIED. DO NOT RUN without separate, exact, owner-authorised operational approval. Read-only helpers.
-- Depends on: 01 (today / batch-size contract) and LIVE canonical objects (see README dependency closure):
--   public.plm_sku_bom_revision_as_of(sku, date)      costing.fn_resolve_sku_mrp_as_of(sku, date)
--   costing.fn_resolve_sku_selling_price_policy_as_of(sku, date)
--   costing.fn_resolve_route_family_for_product(product int, date)   costing.fn_validate_effective_product_process_route(product int, date)
--
-- costing.fn_wp10_essential_states_as_of(sku, product, as_of) -> jsonb { CODE: RESOLVED|MISSING|AMBIGUOUS|UNKNOWN }
--   Mirrors the five-essential contract of the LIVE activation helper at an EXPLICIT date. UNKNOWN is fail-closed (never RESOLVED):
--   any error other than the canonical AMBIGUOUS_PM_BOM_REVISION raise becomes UNKNOWN. Amounts (zero/negative) are NOT evaluated:
--   the live helper contract is resolution status only (unresolved contract O3-U1 in the implementation record).
--
-- costing.fn_wp10_boundary_dates(sku, product, from, to) -> date[]
--   Every effective-dated boundary inside (from, to] that can change a state: effective_from and effective_to + 1 (effective_to is INCLUSIVE,
--   so the first uncovered day is effective_to + 1). Sources: PM BOM revisions, batch-size references, MRP policies, selling policies, and the
--   CAPTURED route-family tables for the families that can map to this product. Route-validation callee tables are NOT captured, so route
--   boundary coverage is CAPTURED_TABLES_ONLY (reported to the caller, never hidden).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function costing.fn_wp10_essential_states_as_of(p_sku_id bigint, p_product_id bigint, p_as_of date)
returns jsonb
language plpgsql
stable
security definer
set search_path = costing, public, pg_temp
as $fn$
declare
  v jsonb := '{}'::jsonb;
  s text;
  v_family bigint;
  v_valid jsonb;
begin
  begin
    if exists (select 1 from public.plm_sku_bom_revision_as_of(p_sku_id, p_as_of) b where b.id is not null) then s := 'RESOLVED'; else s := 'MISSING'; end if;
  exception when others then
    s := case when sqlerrm like 'AMBIGUOUS_PM_BOM_REVISION%' then 'AMBIGUOUS' else 'UNKNOWN' end;
  end;
  v := v || jsonb_build_object('PM_BOM_REVISION', s);

  begin s := costing.fn_wp10_batch_size_state_as_of(p_product_id, p_as_of); exception when others then s := 'UNKNOWN'; end;
  v := v || jsonb_build_object('BATCH_SIZE_REFERENCE', s);

  begin
    v_family := costing.fn_resolve_route_family_for_product(p_product_id::int, p_as_of);
    v_valid := costing.fn_validate_effective_product_process_route(p_product_id::int, p_as_of);
    if v_family is not null
       and exists (select 1 from costing.production_route_family_route r
                   where r.route_family_id = v_family and r.archived_at is null and r.status = 'APPROVED'
                     and r.effective_from <= p_as_of and (r.effective_to is null or r.effective_to >= p_as_of))
       and coalesce((v_valid->>'valid')::boolean, false) then s := 'RESOLVED'; else s := 'MISSING'; end if;
  exception when others then s := 'UNKNOWN'; end;
  v := v || jsonb_build_object('MANUFACTURING_ROUTE', s);

  begin
    select m.resolution_status into s from costing.fn_resolve_sku_mrp_as_of(p_sku_id, p_as_of) m limit 1;
    s := case when s in ('RESOLVED', 'MISSING', 'AMBIGUOUS') then s else 'UNKNOWN' end;
  exception when others then s := 'UNKNOWN'; end;
  v := v || jsonb_build_object('MRP_POLICY', s);

  begin
    select x.resolution_status into s from costing.fn_resolve_sku_selling_price_policy_as_of(p_sku_id, p_as_of) x limit 1;
    s := case when s in ('RESOLVED', 'MISSING', 'AMBIGUOUS') then s else 'UNKNOWN' end;
  exception when others then s := 'UNKNOWN'; end;
  v := v || jsonb_build_object('SELLING_PRICE_POLICY', s);
  return v;
end
$fn$;

create or replace function costing.fn_wp10_boundary_dates(p_sku_id bigint, p_product_id bigint, p_from date, p_to date)
returns date[]
language sql
stable
security definer
set search_path = costing, public, pg_temp
as $fn$
  with product as (
    select p.id, p.sub_group_id, sg.product_group_id
    from public.products p left join public.sub_groups sg on sg.id = p.sub_group_id
    where p.id = p_product_id
  ),
  families as (
    select m.route_family_id as id from costing.production_route_family_product_map m where m.product_id = p_product_id
    union select sm.route_family_id from costing.production_route_family_product_subgroup_map sm join product pr on pr.sub_group_id = sm.product_subgroup_id
    union select gm.route_family_id from costing.production_route_family_product_group_map gm join product pr on pr.product_group_id = gm.product_group_id
  ),
  edges(d_from, d_to) as (
    select r.effective_from, r.effective_to from public.plm_bom_revision r where r.sku_id = p_sku_id and r.status in ('APPROVED', 'SUPERSEDED')
    union all select b.effective_from, b.effective_to from public.production_batch_size_ref b where b.product_id = p_product_id and b.is_active
    union all select p.effective_from, p.effective_to from costing.sku_mrp_policy p where p.sku_id = p_sku_id and p.status = 'APPROVED'
    union all select p.effective_from, p.effective_to from costing.sku_selling_price_policy p where p.sku_id = p_sku_id and p.is_active
    union all select f.effective_from, f.effective_to from costing.production_route_family f where f.id in (select id from families) and f.archived_at is null and f.status = 'APPROVED'
    union all select fr.effective_from, fr.effective_to from costing.production_route_family_route fr where fr.route_family_id in (select id from families) and fr.archived_at is null and fr.status = 'APPROVED'
    union all select m.effective_from, m.effective_to from costing.production_route_family_product_map m where m.product_id = p_product_id and m.archived_at is null and m.status = 'APPROVED'
    union all select sm.effective_from, sm.effective_to from costing.production_route_family_product_subgroup_map sm join product pr on pr.sub_group_id = sm.product_subgroup_id where sm.archived_at is null and sm.status = 'APPROVED'
    union all select gm.effective_from, gm.effective_to from costing.production_route_family_product_group_map gm join product pr on pr.product_group_id = gm.product_group_id where gm.archived_at is null and gm.status = 'APPROVED'
  ),
  dates as (
    select d_from as d from edges where d_from is not null
    union select d_to + 1 from edges where d_to is not null
  )
  select coalesce(array_agg(d order by d), '{}'::date[]) from dates where d > p_from and d <= p_to
$fn$;

revoke all on function costing.fn_wp10_essential_states_as_of(bigint, bigint, date) from public, anon, authenticated;
revoke all on function costing.fn_wp10_boundary_dates(bigint, bigint, date, date) from public, anon, authenticated;
commit;
