-- Gate C — PM costing as-of BOM identity behavioral smoke
-- Safe to run against current live helper/as-of state BEFORE Gate-C apply.
-- Sections marked POST-APPLY require the Gate-C migration to be live.
-- No lasting mutations. Fail-closed fixture uses transaction rollback.

-- =====================================================================
-- A. Pre-apply / always-safe: active costing population + governed coverage
-- =====================================================================

with costing_skus as (
  select ps.id as sku_id
  from public.product_skus ps
  join public.products p on p.id = ps.product_id
  where ps.is_active = true
    and coalesce(p.status, '') ilike 'active'
)
select count(*)::int as active_costing_sku_count
from costing_skus;
-- expected: 673

with costing_skus as (
  select ps.id as sku_id
  from public.product_skus ps
  join public.products p on p.id = ps.product_id
  where ps.is_active = true
    and coalesce(p.status, '') ilike 'active'
),
coverage as (
  select
    c.sku_id,
    (
      select count(*)::int
      from public.plm_bom_revision r
      where r.sku_id = c.sku_id
        and r.status in ('APPROVED', 'SUPERSEDED')
        and r.effective_from <= date '2026-09-10'
        and (r.effective_to is null or r.effective_to >= date '2026-09-10')
    ) as rev_count
  from costing_skus c
)
select
  count(*) filter (where rev_count = 1)::int as covered_exactly_one,
  count(*) filter (where rev_count = 0)::int as missing,
  count(*) filter (where rev_count > 1)::int as ambiguous
from coverage;
-- expected: covered_exactly_one=673, missing=0, ambiguous=0

select
  count(distinct sku_id)::int as req_skus_10,
  count(*)::int as req_lines_10
from public.plm_sku_requirement_unit_as_of(date '2026-09-10');
-- expected: 673 / 2478

-- SKU 853 Matt/Glossy boundary
select
  (select count(*)::int from public.plm_sku_bom_lines_as_of(853, date '2026-09-10') l where l.stock_item_id = 1369) as matt_on_10,
  (select count(*)::int from public.plm_sku_bom_lines_as_of(853, date '2026-09-10') l where l.stock_item_id = 2702) as glossy_on_10,
  (select count(*)::int from public.plm_sku_bom_lines_as_of(853, date '2026-09-12') l where l.stock_item_id = 2702) as glossy_on_12,
  (select count(*)::int from public.plm_sku_bom_lines_as_of(853, date '2026-09-12') l where l.stock_item_id = 1369) as matt_on_12;
-- expected: matt_on_10=1, glossy_on_10=0, glossy_on_12=1, matt_on_12=0

-- SKU 1365 confirmed four lines
select array_agg(l.stock_item_id order by l.stock_item_id) as sku1365_items_10
from public.plm_sku_bom_lines_as_of(1365, date '2026-09-10') l;
-- expected: {1260,1363,1367,1676}

select count(*)::int as hash_failures
from public.plm_bom_revision r
where r.status in ('APPROVED', 'SUPERSEDED')
  and (
    r.content_hash is null
    or public.fn_plm_bom_revision_verify_content_hash(r.id) is distinct from true
  );
-- expected: 0

-- Current operational MRP / PLM identity unchanged
select
  to_regclass('public.v_sku_plm_requirement_unit') is not null as requirement_view_exists,
  pg_get_functiondef('costing.fn_build_sku_pm_cost_lines_as_of'::regproc)
    like '%v_sku_plm_requirement_unit%' as costing_still_current_pre_apply,
  pg_get_functiondef('costing.fn_build_sku_pm_cost_lines_as_of'::regproc)
    like '%plm_sku_requirement_unit_as_of%' as costing_already_asof,
  pg_get_functiondef('costing.fn_build_sku_pm_cost_lines_as_of'::regproc)
    like '%NO_EFFECTIVE_PM_BOM_REVISION%' as costing_has_coverage_guard;

-- =====================================================================
-- B. POST-APPLY expectations (run after Gate-C migration is live)
-- =====================================================================
-- After apply, expect:
--   costing_still_current_pre_apply = false
--   costing_already_asof = true
--   costing_has_coverage_guard = true
--   fn_build_sku_pm_cost_lines_as_of('2026-09-01','2026-09-10')
--     -> distinct sku_id = 673, line count = 2478
--   SKU 853 / 1365 composition assertions identical to section A
--   v_sku_plm_requirement_unit still present and MRP objects unaltered

-- Optional POST-APPLY composition probe (commented until live apply):
-- select count(distinct sku_id)::int as pm_skus, count(*)::int as pm_lines
-- from costing.fn_build_sku_pm_cost_lines_as_of(date '2026-09-01', date '2026-09-10');

-- =====================================================================
-- C. Missing-revision fail-closed fixture (POST-APPLY only)
-- =====================================================================
-- Safe transactional gap without weakening immutability:
-- supersede one open APPROVED revision to close before valuation date,
-- invoke builder, expect NO_EFFECTIVE_PM_BOM_REVISION, then ROLLBACK.
--
-- do $fail_closed$
-- declare
--   v_sku bigint;
--   v_raised boolean := false;
--   v_msg text;
-- begin
--   if pg_get_functiondef('costing.fn_build_sku_pm_cost_lines_as_of'::regproc)
--        not like '%NO_EFFECTIVE_PM_BOM_REVISION%' then
--     raise notice 'Gate C not applied yet — skip fail-closed fixture';
--     return;
--   end if;
--
--   select r.sku_id into v_sku
--   from public.plm_bom_revision r
--   where r.status = 'APPROVED'
--     and r.effective_to is null
--     and r.sku_id not in (853, 1365)
--   order by r.sku_id
--   limit 1;
--
--   if v_sku is null then
--     raise exception 'Fail-closed fixture abort: no open APPROVED revision available';
--   end if;
--
--   perform set_config('app.plm_bom_revision_mutate_context', 'GOVERNED', true);
--   update public.plm_bom_revision r
--   set status = 'SUPERSEDED',
--       effective_to = date '2026-09-09',
--       superseded_at = clock_timestamp(),
--       superseded_by = null
--   where r.sku_id = v_sku
--     and r.status = 'APPROVED'
--     and r.effective_to is null;
--   perform set_config('app.plm_bom_revision_mutate_context', '', true);
--
--   begin
--     perform 1
--     from costing.fn_build_sku_pm_cost_lines_as_of(date '2026-09-01', date '2026-09-10')
--     limit 1;
--   exception
--     when others then
--       v_msg := sqlerrm;
--       if v_msg like 'NO_EFFECTIVE_PM_BOM_REVISION%' then
--         v_raised := true;
--       else
--         raise;
--       end if;
--   end;
--
--   if not v_raised then
--     raise exception 'Fail-closed fixture abort: expected NO_EFFECTIVE_PM_BOM_REVISION';
--   end if;
--
--   raise exception 'Gate C fail-closed fixture OK (forced rollback)';
-- end;
-- $fail_closed$;
--
-- Equivalent isolated assertion when Gate C is not yet live:
-- the coverage-guard SQL in section A already proves missing_count semantics;
-- Gate-C static smoke asserts the exception prefix is present in source.

select
  count(*) filter (where rev_count = 0)::int as equivalent_missing_guard_count
from (
  select
    c.sku_id,
    (
      select count(*)::int
      from public.plm_bom_revision r
      where r.sku_id = c.sku_id
        and r.status in ('APPROVED', 'SUPERSEDED')
        and r.effective_from <= date '2026-09-10'
        and (r.effective_to is null or r.effective_to >= date '2026-09-10')
    ) as rev_count
  from (
    select ps.id as sku_id
    from public.product_skus ps
    join public.products p on p.id = ps.product_id
    where ps.is_active = true
      and coalesce(p.status, '') ilike 'active'
  ) c
) x;
-- expected: 0 today; after intentional gap fixture (rolled back) would be 1
