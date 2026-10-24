-- backfilled from live schema_migrations on 2026-10-24, CI-016
insert into public.app_modules (
  module_key,
  target_key,
  label,
  description,
  section_key,
  sort_order,
  icon_key,
  is_active,
  is_assignable,
  show_in_navigation,
  min_nav_mode,
  updated_at
)
values (
  'production-route-manager',
  'module:production-route-manager',
  'Production Route Manager',
  'Govern Product Group process routes, Product-specific route deviations, historical candidates, approvals, and effective manufacturing routes.',
  'product-reference-master',
  95,
  null,
  true,
  true,
  true,
  'view',
  now()
)
on conflict (module_key) do update
set target_key = excluded.target_key,
    label = excluded.label,
    description = excluded.description,
    section_key = excluded.section_key,
    sort_order = excluded.sort_order,
    icon_key = excluded.icon_key,
    is_active = excluded.is_active,
    is_assignable = excluded.is_assignable,
    show_in_navigation = excluded.show_in_navigation,
    min_nav_mode = excluded.min_nav_mode,
    updated_at = now();

insert into public.app_module_clients (
  module_key,
  client_key,
  route_path,
  nav_enabled,
  launch_mode,
  updated_at
)
values
  (
    'production-route-manager',
    'electron',
    'public/shared/production-route-manager.html',
    true,
    'direct',
    now()
  ),
  (
    'production-route-manager',
    'pwa',
    'public/shared/production-route-manager.html',
    true,
    'direct',
    now()
  )
on conflict (module_key, client_key) do update
set route_path = excluded.route_path,
    nav_enabled = excluded.nav_enabled,
    launch_mode = excluded.launch_mode,
    updated_at = now();