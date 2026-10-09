-- PEC PWA registration recovery (from PR #46, registration ONLY).
-- The production registry already contains this mapping; guarded idempotent reconciliation.
-- No permission grants, vendor-wise views, serial data or functions changed.
INSERT INTO public.app_module_clients
  (module_key, client_key, route_path, nav_enabled, launch_mode)
VALUES
  ('procurement-execution-console','pwa','/shared/procurement-execution-console.html',true,'direct')
ON CONFLICT (module_key,client_key) DO UPDATE
SET route_path=EXCLUDED.route_path, nav_enabled=EXCLUDED.nav_enabled,
    launch_mode=EXCLUDED.launch_mode, updated_at=now()
WHERE public.app_module_clients.route_path IS DISTINCT FROM EXCLUDED.route_path
   OR public.app_module_clients.nav_enabled IS DISTINCT FROM EXCLUDED.nav_enabled
   OR public.app_module_clients.launch_mode IS DISTINCT FROM EXCLUDED.launch_mode;
