-- WP08 G2-0 registry proposal — UNAPPLIED. ROLLBACK for steps A and B. Idempotent; touches route rows only.
begin;

-- Undo step B (only rows still holding the new canonical Electron path).
update public.app_module_clients c
set route_path = v.legacy_route, updated_at = now()
from (values
  ('manage-products', 'manage-products.html',  'public/shared/manage-products.html'),
  ('manage-rm-bom',   'manage-rm-bom.html',    'public/shared/manage-rm-bom.html'),
  ('manage-sp-bom',   'manage-sp-bom.html',    'public/shared/manage-sp-bom.html'),
  ('pm-templates',    'manage-pm-bom.html',    'public/shared/manage-pm-bom.html')
) as v(module_key, legacy_route, new_route)
where c.module_key = v.module_key and c.client_key = 'electron' and c.route_path = v.new_route;

-- Undo step A (only the four PWA rows this proposal created, identified by key + exact route).
delete from public.app_module_clients c
using (values
  ('manage-products', 'public/shared/manage-products.html'),
  ('manage-rm-bom',   'public/shared/manage-rm-bom.html'),
  ('manage-sp-bom',   'public/shared/manage-sp-bom.html'),
  ('pm-templates',    'public/shared/manage-pm-bom.html')
) as v(module_key, pwa_route)
where c.module_key = v.module_key and c.client_key = 'pwa' and c.route_path = v.pwa_route;

select module_key, client_key, route_path, nav_enabled, launch_mode from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates') order by module_key, client_key;

commit;
