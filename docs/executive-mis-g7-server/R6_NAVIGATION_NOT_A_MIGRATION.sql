-- REVIEW CANDIDATE ONLY. Run after supported Electron and PWA route acceptance; retain permission target and all assignments.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $guard$
BEGIN
  IF (SELECT count(*) FROM public.app_module_clients WHERE module_key='sales-data-viewer' AND nav_enabled AND client_key IN ('electron','pwa'))<>2 THEN RAISE EXCEPTION 'Legacy registry drift'; END IF;
  IF (SELECT count(*) FROM public.app_module_clients WHERE module_key='executive-mis-dashboard' AND nav_enabled AND client_key IN ('electron','pwa'))<>2 THEN RAISE EXCEPTION 'Replacement registry unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.permission_targets WHERE key='module:sales-data-viewer' AND label='Sales Data Viewer' AND is_assignable) THEN RAISE EXCEPTION 'Legacy permission target drift'; END IF;
END $guard$;
UPDATE public.app_module_clients SET nav_enabled=false,updated_at=now() WHERE module_key='sales-data-viewer';
UPDATE public.app_modules SET is_active=false,show_in_navigation=false,is_assignable=false,updated_at=now() WHERE module_key='sales-data-viewer';
UPDATE public.permission_targets SET label='Executive Intelligence — Sales only' WHERE key='module:sales-data-viewer';
COMMIT;
