-- WP08 G2-0 registry proposal — UNAPPLIED. STEP B (OPTIONAL, LAST): repoint Electron rows to the canonical path.
-- NOT REQUIRED for correctness: the root files manage-*.html remain as redirect stubs, so the existing Electron route
-- values keep working. DO NOT RUN until every installed Electron client is on a release that contains
-- public/shared/manage-*.html — an older build has no such file and would 404. Guarded by the legacy value, idempotent.
begin;

update public.app_module_clients c
set route_path = v.new_route, updated_at = now()
from (values
  ('manage-products', 'manage-products.html',  'public/shared/manage-products.html'),
  ('manage-rm-bom',   'manage-rm-bom.html',    'public/shared/manage-rm-bom.html'),
  ('manage-sp-bom',   'manage-sp-bom.html',    'public/shared/manage-sp-bom.html'),
  ('pm-templates',    'manage-pm-bom.html',    'public/shared/manage-pm-bom.html')
) as v(module_key, legacy_route, new_route)
where c.module_key = v.module_key
  and c.client_key = 'electron'
  and c.route_path = v.legacy_route;  -- guarded by the legacy value (route_path = 'manage-…html')

select module_key, client_key, route_path from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates') order by module_key, client_key;

commit;
