-- REVIEW CANDIDATE ONLY. Owner override 27 Nov: no permission target or assignment changes. Run after independent EI access policy and supported client acceptance.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $guard$
BEGIN
  IF (SELECT count(*) FROM public.app_module_clients WHERE module_key='sales-data-viewer' AND nav_enabled AND client_key IN ('electron','pwa'))<>2 THEN RAISE EXCEPTION 'Legacy registry drift'; END IF;
  IF (SELECT count(*) FROM public.app_module_clients WHERE module_key='executive-mis-dashboard' AND nav_enabled AND client_key IN ('electron','pwa'))<>2 THEN RAISE EXCEPTION 'Replacement registry unavailable'; END IF;
END $guard$;
UPDATE public.app_module_clients SET nav_enabled=false,updated_at=now() WHERE module_key='sales-data-viewer';
UPDATE public.app_modules SET is_active=false,show_in_navigation=false,updated_at=now() WHERE module_key='sales-data-viewer';
COMMIT;
