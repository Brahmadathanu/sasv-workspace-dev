-- WP10 classification masters - PWA registry routes. PROPOSED / UNAPPLIED.
--
-- STATUS: text only. Not a migration, not in supabase/migrations, never executed by this PR, CI or the agent.
-- The Utilities Hub lists a module for the PWA only when public.app_module_clients has an enabled client_key='pwa' row
-- (hub-auth.js -> loadClientModuleRegistry('pwa')). The live registry snapshot (WP09 G1, 15 Nov 2026) holds only
-- client_key='electron' rows for these four modules, so the code in this PR is reachable by URL but not yet listed.
--
-- Scope guard: registry route rows ONLY. No module, permission, grant, policy, RPC or ACL change. Visibility is still
-- filtered by the existing canonical View permission per user; a user without View sees nothing and the page itself
-- renders a permission-denied state without querying any rows.
--
-- Apply only after: (1) this PR is merged and the hosted build serves /shared/manage-*.html (verify served bytes),
-- (2) owner approves, (3) through the owner-controlled production SQL / migration lane with a read-only before/after
-- count of app_module_clients. Rollback: delete exactly these four ('pwa') rows.

insert into public.app_module_clients (module_key, client_key, route_path, nav_enabled, launch_mode, updated_at)
values
  ('manage-categories',     'pwa', 'public/shared/manage-categories.html',     true, 'direct', now()),
  ('manage-subcategories',  'pwa', 'public/shared/manage-subcategories.html',  true, 'direct', now()),
  ('manage-product-groups', 'pwa', 'public/shared/manage-product-groups.html', true, 'direct', now()),
  ('manage-subgroups',      'pwa', 'public/shared/manage-subgroups.html',      true, 'direct', now())
on conflict (module_key, client_key) do update
set route_path = excluded.route_path,
    nav_enabled = excluded.nav_enabled,
    launch_mode = excluded.launch_mode,
    updated_at = now();

-- Rollback (text only):
-- delete from public.app_module_clients
--  where client_key = 'pwa'
--    and module_key in ('manage-categories','manage-subcategories','manage-product-groups','manage-subgroups');
