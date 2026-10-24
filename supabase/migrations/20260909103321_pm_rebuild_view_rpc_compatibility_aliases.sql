-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Stage 1B: canonical PM-named aliases for PM Rebuild Dashboard contracts.
-- Legacy mrp_plm_* implementations/views remain authoritative during compatibility.

create or replace view public.v_mrp_pm_issue_monthly_allocated
with (security_invoker = true)
as
select * from public.v_mrp_plm_issue_monthly_allocated;

create or replace view public.v_mrp_pm_issue_monthly_enriched
with (security_invoker = true)
as
select * from public.v_mrp_plm_issue_monthly_enriched;

create or replace view public.v_mrp_pm_planned_vs_issued_overview
with (security_invoker = true)
as
select * from public.v_mrp_plm_planned_vs_issued_overview;

revoke all on public.v_mrp_pm_issue_monthly_allocated from public, anon;
revoke all on public.v_mrp_pm_issue_monthly_enriched from public, anon;
revoke all on public.v_mrp_pm_planned_vs_issued_overview from public, anon;
grant select on public.v_mrp_pm_issue_monthly_allocated to authenticated;
grant select on public.v_mrp_pm_issue_monthly_enriched to authenticated;
grant select on public.v_mrp_pm_planned_vs_issued_overview to authenticated;
grant all on public.v_mrp_pm_issue_monthly_allocated to service_role;
grant all on public.v_mrp_pm_issue_monthly_enriched to service_role;
grant all on public.v_mrp_pm_planned_vs_issued_overview to service_role;

create or replace function public.mrp_pm_rebuild_all(p_horizon_start date)
returns table(
  horizon_start date,
  horizon_end date,
  items_seen integer,
  items_changed integer,
  issue_lines_total bigint,
  issue_lines_affected bigint,
  unassigned_before bigint,
  unassigned_after bigint,
  approx_before bigint,
  approx_after bigint
)
language sql
volatile
security invoker
set search_path = pg_catalog, public, public, pg_temp
as $$ select * from public.mrp_plm_rebuild_all(p_horizon_start); $$;

create or replace function public.mrp_pm_rebuild_dry_run_all(p_horizon_start date)
returns table(
  stock_item_id bigint,
  horizon_start date,
  horizon_end date,
  issue_lines_total integer,
  issue_lines_affected integer,
  unassigned_before integer,
  unassigned_after integer,
  approx_before integer,
  approx_after integer
)
language sql
volatile
security invoker
set search_path = pg_catalog, public, public, pg_temp
as $$ select * from public.mrp_plm_rebuild_dry_run_all(p_horizon_start); $$;

create or replace function public.mrp_pm_rebuild_for_item(
  p_horizon_start date,
  p_stock_item_id bigint,
  p_dry_run boolean default false
)
returns table(
  stock_item_id bigint,
  horizon_start date,
  horizon_end date,
  issue_lines_total integer,
  issue_lines_affected integer,
  unassigned_before integer,
  unassigned_after integer,
  approx_before integer,
  approx_after integer
)
language sql
volatile
security invoker
set search_path = pg_catalog, public, public, pg_temp
as $$ select * from public.mrp_plm_rebuild_for_item(p_horizon_start, p_stock_item_id, p_dry_run); $$;

revoke all on function public.mrp_pm_rebuild_all(date) from public, anon;
revoke all on function public.mrp_pm_rebuild_dry_run_all(date) from public, anon;
revoke all on function public.mrp_pm_rebuild_for_item(date,bigint,boolean) from public, anon;
grant execute on function public.mrp_pm_rebuild_all(date) to authenticated, service_role;
grant execute on function public.mrp_pm_rebuild_dry_run_all(date) to authenticated, service_role;
grant execute on function public.mrp_pm_rebuild_for_item(date,bigint,boolean) to authenticated, service_role;