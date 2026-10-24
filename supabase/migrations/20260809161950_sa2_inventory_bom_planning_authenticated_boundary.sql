-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  t text;
begin
  foreach t in array array[
    'inv_stock_item','inv_stock_item_alias','inv_stock_item_class_map',
    'inv_class_category','inv_class_subcategory','inv_class_group','inv_class_subgroup',
    'inv_uom','inv_uom_dimension','inv_rm_form_conversion','inv_stock_item_moq_policy',
    'rm_bom_header','rm_bom_line','sp_bom_header','sp_bom_line',
    'plm_tpl_header','plm_sku_pack_map',
    'batch_plan_headers','batch_plan_batches','batch_plan_lines',
    'manual_plan_sets','manual_plan_lines'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_crud', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',
      t || '_authenticated_crud', t
    );
  end loop;
end $$;

-- Read-only seasonal assignment table: client SELECT only; server writer is SECURITY DEFINER.
alter table public.inv_stock_item_season_profile enable row level security;
revoke all privileges on table public.inv_stock_item_season_profile from anon, authenticated;
grant select on table public.inv_stock_item_season_profile to authenticated;
drop policy if exists inv_stock_item_season_profile_authenticated_read on public.inv_stock_item_season_profile;
create policy inv_stock_item_season_profile_authenticated_read
on public.inv_stock_item_season_profile
for select to authenticated
using ((select auth.uid()) is not null);