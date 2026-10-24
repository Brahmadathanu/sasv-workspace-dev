-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table public.app_modules enable row level security;
alter table public.app_module_clients enable row level security;
alter table public.etl_presets enable row level security;
alter table public.inv_uom_conversion enable row level security;
alter table public.plm_pack_format enable row level security;

revoke all privileges on table public.app_modules from anon, authenticated;
revoke all privileges on table public.app_module_clients from anon, authenticated;
revoke all privileges on table public.etl_presets from anon, authenticated;
revoke all privileges on table public.inv_uom_conversion from anon, authenticated;
revoke all privileges on table public.plm_pack_format from anon, authenticated;

commit;