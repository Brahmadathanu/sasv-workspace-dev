-- WP08 G2-0 registry proposal — UNAPPLIED. STEP A: enable the four modules for the PWA client.
-- DO NOT RUN until (1) the PR is merged, (2) the PWA deployment serves /shared/<page>.html and its assets (verified),
-- and (3) the owner gives the separate production-mutation approval.
--
-- Scope: public.app_module_clients ONLY, four PWA rows. Does not touch public.app_modules (keys, target_keys, labels,
-- sections, sort_order, min_nav_mode), permissions, grants or RLS. Idempotent: re-running changes nothing further.
-- launch_mode / nav_enabled are copied from each module's existing Electron row so the PWA row mirrors it.
begin;

insert into public.app_module_clients (module_key, client_key, route_path, nav_enabled, launch_mode, updated_at)
select e.module_key, 'pwa', v.pwa_route, e.nav_enabled, e.launch_mode, now()
from public.app_module_clients e
join (values
  ('manage-products', 'public/shared/manage-products.html'),
  ('manage-rm-bom',   'public/shared/manage-rm-bom.html'),
  ('manage-sp-bom',   'public/shared/manage-sp-bom.html'),
  ('pm-templates',    'public/shared/manage-pm-bom.html')   -- registry key stays pm-templates (module:pm-templates)
) as v(module_key, pwa_route) on v.module_key = e.module_key
where e.client_key = 'electron'
on conflict (module_key, client_key) do update
set route_path = excluded.route_path,
    nav_enabled = excluded.nav_enabled,
    launch_mode = excluded.launch_mode,
    updated_at = now()
where public.app_module_clients.route_path is distinct from excluded.route_path
   or public.app_module_clients.nav_enabled is distinct from excluded.nav_enabled
   or public.app_module_clients.launch_mode is distinct from excluded.launch_mode;

-- AFTER select (PWA rows must now exist; Electron rows unchanged).
select module_key, client_key, route_path, nav_enabled, launch_mode
from public.app_module_clients
where module_key in ('manage-products', 'manage-rm-bom', 'manage-sp-bom', 'pm-templates')
order by module_key, client_key;

commit;
