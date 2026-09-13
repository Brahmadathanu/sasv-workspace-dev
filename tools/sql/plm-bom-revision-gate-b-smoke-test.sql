-- Gate B — Run-94 evidence bootstrap acceptance smoke
-- Run AFTER applying Gate-B migration.
-- Read-mostly verification; no business mutations.

select count(*)::int as revision_rows from public.plm_bom_revision;
select count(*)::int as line_rows from public.plm_bom_revision_line;

select status, count(*)::int as n
from public.plm_bom_revision
group by status
order by status;

select count(*)::int as hash_failures
from public.plm_bom_revision r
where r.content_hash is null
   or r.frozen_at is null
   or public.fn_plm_bom_revision_verify_content_hash(r.id) is distinct from true;

-- SKU 853 boundary
select
  (public.plm_sku_bom_revision_as_of(853, date '2026-09-10')).revision_no as asof_10_rev,
  (public.plm_sku_bom_revision_as_of(853, date '2026-09-10')).status as asof_10_status,
  (public.plm_sku_bom_revision_as_of(853, date '2026-09-11')).revision_no as asof_11_rev,
  (public.plm_sku_bom_revision_as_of(853, date '2026-09-12')).revision_no as asof_12_rev,
  (public.plm_sku_bom_revision_as_of(853, date '2026-09-12')).status as asof_12_status;

select
  (select count(*)::int from public.plm_sku_bom_lines_as_of(853, date '2026-09-10') l where l.stock_item_id=1369) as matt_on_10,
  (select count(*)::int from public.plm_sku_bom_lines_as_of(853, date '2026-09-10') l where l.stock_item_id=2702) as glossy_on_10,
  (select count(*)::int from public.plm_sku_bom_lines_as_of(853, date '2026-09-12') l where l.stock_item_id=2702) as glossy_on_12,
  (select count(*)::int from public.plm_sku_bom_lines_as_of(853, date '2026-09-12') l where l.stock_item_id=1369) as matt_on_12;

-- Costing still current-state
select
  pg_get_functiondef('costing.fn_build_sku_pm_cost_lines_as_of'::regproc)
    like '%v_sku_plm_requirement_unit%' as costing_still_current,
  pg_get_functiondef('costing.fn_build_sku_pm_cost_lines_as_of'::regproc)
    like '%plm_sku_requirement_unit_as_of%' as costing_uses_asof;

select to_regclass('public.v_sku_plm_requirement_unit') is not null as requirement_view_ok;
