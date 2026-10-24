-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Stage 1A: canonical PM-named compatibility RPCs for Manage PM BOM.
-- Existing rpc_plm_* functions remain the single implementation source.

create or replace function public.rpc_pm_map_clear(p_sku_id bigint)
returns void language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_map_clear(p_sku_id); $$;

create or replace function public.rpc_pm_map_set(p_sku_id bigint, p_tpl_id bigint)
returns void language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_map_set(p_sku_id, p_tpl_id); $$;

create or replace function public.rpc_pm_override_counts()
returns table(total_skus bigint, with_overrides bigint, without_overrides bigint)
language sql stable security invoker
set search_path = pg_catalog, public, public, pg_temp
as $$ select * from public.rpc_plm_override_counts(); $$;

create or replace function public.rpc_pm_ovr_delete(p_id bigint)
returns void language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_ovr_delete(p_id); $$;

create or replace function public.rpc_pm_ovr_list(p_sku_id bigint)
returns table(id bigint, op text, stock_item_id bigint, stock_item_name text,
  qty_per_reference_output numeric, uom_id bigint, uom_code text,
  wastage_pct numeric, is_optional boolean, remarks text)
language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select * from public.rpc_plm_ovr_list(p_sku_id); $$;

create or replace function public.rpc_pm_ovr_upsert(
  p_id bigint, p_sku_id bigint, p_op text, p_stock_item_id bigint,
  p_qty numeric, p_uom_code text,
  p_wastage_pct numeric default null::numeric,
  p_is_optional boolean default null::boolean,
  p_remarks text default null::text)
returns bigint language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_ovr_upsert(p_id, p_sku_id, p_op, p_stock_item_id, p_qty, p_uom_code, p_wastage_pct, p_is_optional, p_remarks); $$;

create or replace function public.rpc_pm_preview_effective(p_sku_id bigint)
returns table(stock_item_id bigint, stock_item_name text,
  qty_per_reference_output numeric, uom_id bigint, uom_code text,
  wastage_pct numeric, is_optional boolean)
language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select * from public.rpc_plm_preview_effective(p_sku_id); $$;

-- Canonical all-rows wrapper delegates to the legacy paged implementation
-- with max int limit to avoid ambiguity between the two defaulted legacy overloads.
create or replace function public.rpc_pm_rebuild_all(p_dry_run boolean default false)
returns table(sku_id bigint, action text)
language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select * from public.rpc_plm_rebuild_all(p_dry_run, 2147483647::integer, 0::integer); $$;

create or replace function public.rpc_pm_rebuild_all(
  p_dry_run boolean default false,
  p_limit integer default 100,
  p_offset integer default 0)
returns table(sku_id bigint, action text)
language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select * from public.rpc_plm_rebuild_all(p_dry_run, p_limit, p_offset); $$;

create or replace function public.rpc_pm_rebuild_skus_for_tpl(p_tpl_id bigint)
returns integer language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_rebuild_skus_for_tpl(p_tpl_id); $$;

create or replace function public.rpc_pm_tpl_delete_line(p_line_id bigint)
returns void language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_tpl_delete_line(p_line_id); $$;

create or replace function public.rpc_pm_tpl_list_lines(p_tpl_id bigint)
returns table(line_id bigint, line_no integer, stock_item_id bigint,
  stock_item_name text, qty_per_reference_output numeric,
  uom_id bigint, uom_code text, wastage_pct numeric,
  is_optional boolean, remarks text)
language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select * from public.rpc_plm_tpl_list_lines(p_tpl_id); $$;

create or replace function public.rpc_pm_tpl_renumber(p_tpl_id bigint)
returns void language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_tpl_renumber(p_tpl_id); $$;

create or replace function public.rpc_pm_tpl_upsert_header(
  p_code text, p_reference_output_qty numeric, p_ref_uom_code text,
  p_process_loss_pct numeric default 0)
returns bigint language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_tpl_upsert_header(p_code, p_reference_output_qty, p_ref_uom_code, p_process_loss_pct); $$;

create or replace function public.rpc_pm_tpl_upsert_line(
  p_tpl_id bigint, p_stock_item_id bigint, p_qty numeric, p_uom_code text,
  p_wastage_pct numeric default null::numeric,
  p_is_optional boolean default false,
  p_remarks text default null::text)
returns bigint language sql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$ select public.rpc_plm_tpl_upsert_line(p_tpl_id, p_stock_item_id, p_qty, p_uom_code, p_wastage_pct, p_is_optional, p_remarks); $$;

-- Match legacy ACL pattern exactly: no PUBLIC execute; authenticated + service_role only.
revoke all on function public.rpc_pm_map_clear(bigint) from public;
revoke all on function public.rpc_pm_map_set(bigint,bigint) from public;
revoke all on function public.rpc_pm_override_counts() from public;
revoke all on function public.rpc_pm_ovr_delete(bigint) from public;
revoke all on function public.rpc_pm_ovr_list(bigint) from public;
revoke all on function public.rpc_pm_ovr_upsert(bigint,bigint,text,bigint,numeric,text,numeric,boolean,text) from public;
revoke all on function public.rpc_pm_preview_effective(bigint) from public;
revoke all on function public.rpc_pm_rebuild_all(boolean) from public;
revoke all on function public.rpc_pm_rebuild_all(boolean,integer,integer) from public;
revoke all on function public.rpc_pm_rebuild_skus_for_tpl(bigint) from public;
revoke all on function public.rpc_pm_tpl_delete_line(bigint) from public;
revoke all on function public.rpc_pm_tpl_list_lines(bigint) from public;
revoke all on function public.rpc_pm_tpl_renumber(bigint) from public;
revoke all on function public.rpc_pm_tpl_upsert_header(text,numeric,text,numeric) from public;
revoke all on function public.rpc_pm_tpl_upsert_line(bigint,bigint,numeric,text,numeric,boolean,text) from public;

grant execute on function public.rpc_pm_map_clear(bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_map_set(bigint,bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_override_counts() to authenticated, service_role;
grant execute on function public.rpc_pm_ovr_delete(bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_ovr_list(bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_ovr_upsert(bigint,bigint,text,bigint,numeric,text,numeric,boolean,text) to authenticated, service_role;
grant execute on function public.rpc_pm_preview_effective(bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_rebuild_all(boolean) to authenticated, service_role;
grant execute on function public.rpc_pm_rebuild_all(boolean,integer,integer) to authenticated, service_role;
grant execute on function public.rpc_pm_rebuild_skus_for_tpl(bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_tpl_delete_line(bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_tpl_list_lines(bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_tpl_renumber(bigint) to authenticated, service_role;
grant execute on function public.rpc_pm_tpl_upsert_header(text,numeric,text,numeric) to authenticated, service_role;
grant execute on function public.rpc_pm_tpl_upsert_line(bigint,bigint,numeric,text,numeric,boolean,text) to authenticated, service_role;