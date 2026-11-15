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
--   the route SELECTOR inputs for this product: family maps (product / sub-group / group), route families, family routes (APPROVED and SUPERSEDED,
--   as the live resolver selects) and PRODUCT routes (APPROVED, non-archived).
--
-- ROUTE DEPENDENCY CLOSURE (R2, from the live definitions in the independent route-callee catalog): the route state at date D is
-- fn_validate_effective_product_process_route(product, D), which selects (1) the family via fn_resolve_route_family_for_product(.., D), (2) the family
-- route via fn_resolve_effective_route_family_route(.., D), (3) an optional product route via fn_resolve_effective_product_process_route(.., D) (raises
-- AMBIGUOUS_APPROVED_PRODUCT_ROUTE on overlap), then validates the SELECTED route with fn_validate_product_process_route / fn_validate_route_family_route.
-- Those validators read effective steps, overrides, locations, cost centres, behaviours and resource classes, but evaluate them at fixed per-route dates
-- (route.effective_from) or statically - none depends on D. Therefore the state can change between two dates ONLY when a selector window opens or
-- closes, and every selector window is a boundary below. Each boundary date is then evaluated with the REAL validator (not a re-implementation), so
-- gaps, overlaps, replacement coverage and temporary evaluation failures are observed, not assumed. No recursive dependency remains uncaptured.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PROVENANCE PREFLIGHT (R5): refuses to run when any object this file creates already exists (it never overwrites or adopts), when a live dependency
-- differs from the definition that was reviewed (md5 of pg_get_functiondef), or when a prerequisite proposal is missing or was modified after it was
-- applied. Re-running this file therefore FAILS at this block by design; a partial apply is impossible because the file is one transaction.
do $wp10_preflight$
declare t text; r record; v oid; c text;
begin
  foreach t in array array['costing.fn_wp10_essential_states_as_of(bigint, bigint, date)', 'costing.fn_wp10_boundary_dates(bigint, bigint, date, date)'] loop
    if to_regprocedure(t) is not null then
      raise exception 'WP10-G2 preflight: % already exists; refusing to overwrite or adopt it (review the existing definition separately).', t;
    end if;
  end loop;
  if to_regclass('public.plm_bom_revision') is null then raise exception 'WP10-G2 preflight: required table public.plm_bom_revision is missing.'; end if;
  if to_regclass('costing.product_process_route') is null then raise exception 'WP10-G2 preflight: required table costing.product_process_route is missing.'; end if;
  if to_regclass('costing.production_route_family_route') is null then raise exception 'WP10-G2 preflight: required table costing.production_route_family_route is missing.'; end if;
  if to_regclass('costing.production_route_family') is null then raise exception 'WP10-G2 preflight: required table costing.production_route_family is missing.'; end if;
  if to_regprocedure('public.plm_sku_bom_revision_as_of(bigint, date)') is null then raise exception 'WP10-G2 preflight: required function public.plm_sku_bom_revision_as_of(bigint, date) is missing.'; end if;
  for r in select * from (values
    ('costing.fn_resolve_sku_mrp_as_of(bigint, date)', '73b23adedd8b67814f9b1f944b772d53'),
    ('costing.fn_resolve_sku_selling_price_policy_as_of(bigint, date)', '23425275b1cb28f7e005bffdd5dc0388'),
    ('costing.fn_resolve_route_family_for_product(integer, date)', '641fd0f7eb7438eed53c1c6170deb0ec'),
    ('costing.fn_validate_effective_product_process_route(integer, date)', 'a9396f97a23cba5bbaceada07bc6448a'),
    ('costing.fn_resolve_effective_product_process_route(integer, date)', '3c5a292804748daf679605382e1691fb'),
    ('costing.fn_resolve_effective_route_family_route(integer, date)', '5d7ac1d9e0427eae90b590ead55fe58a'),
    ('costing.fn_validate_product_process_route(bigint)', 'cc6cef1fac171ce812c9dd6702e4efbc'),
    ('costing.fn_validate_route_family_route(bigint)', '09cd3572e36000095b8b1eb1833491c8'),
    ('costing.fn_effective_product_process_route_steps(bigint)', '0968054cfb097874f54239c1c2ce3ab5')
  ) as d(sig, expected_md5) loop
    v := to_regprocedure(r.sig);
    if v is null then raise exception 'WP10-G2 preflight: required live function % is missing.', r.sig; end if;
    if md5(pg_get_functiondef(v)) <> r.expected_md5 then
      raise exception 'WP10-G2 preflight: live function % differs from the reviewed definition (md5 %, reviewed %); re-review before applying.', r.sig, md5(pg_get_functiondef(v)), r.expected_md5;
    end if;
  end loop;
  foreach t in array array['costing.fn_wp10_today_ist()', 'costing.fn_wp10_batch_size_state_as_of(bigint, date)'] loop
    v := to_regprocedure(t);
    c := case when v is null then null else obj_description(v, 'pg_proc') end;
    if v is null or c is null or c not like 'WP10-G2 01\_%' or split_part(c, 'md5:', 2) <> md5(pg_get_functiondef(v)) then
      raise exception 'WP10-G2 preflight: prerequisite % (proposal 01) is missing, not applied by this procedure, or modified since.', t;
    end if;
  end loop;
end $wp10_preflight$;

create function costing.fn_wp10_essential_states_as_of(p_sku_id bigint, p_product_id bigint, p_as_of date)
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
  exception when others then
    s := case when sqlerrm like 'AMBIGUOUS_APPROVED_PRODUCT_ROUTE%' then 'AMBIGUOUS' else 'UNKNOWN' end;
  end;
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

create function costing.fn_wp10_boundary_dates(p_sku_id bigint, p_product_id bigint, p_from date, p_to date)
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
    union all select fr.effective_from, fr.effective_to from costing.production_route_family_route fr where fr.route_family_id in (select id from families) and fr.archived_at is null and fr.status in ('APPROVED', 'SUPERSEDED')
    union all select pr.effective_from, pr.effective_to from costing.product_process_route pr where pr.product_id = p_product_id and pr.archived_at is null and pr.status = 'APPROVED'
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

-- RECEIPT (R5): stamps each created object with this file name and the md5 of its definition as created. 99_rollback_all.sql removes ONLY objects
-- whose receipt is present and whose definition still matches; anything changed or unowned makes the rollback fail closed without dropping anything.
do $wp10_receipt$
declare t text; v oid; r record;
begin
  foreach t in array array['costing.fn_wp10_essential_states_as_of(bigint, bigint, date)', 'costing.fn_wp10_boundary_dates(bigint, bigint, date, date)'] loop
    v := to_regprocedure(t);
    execute format('comment on function %s is %L', v::regprocedure, 'WP10-G2 02_essential_states_and_boundaries.sql md5:' || md5(pg_get_functiondef(v)));
  end loop;
end $wp10_receipt$;
commit;
