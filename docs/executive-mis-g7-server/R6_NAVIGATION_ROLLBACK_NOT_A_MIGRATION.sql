-- Recovery only. Restores captured legacy navigation; never modifies permission targets or assignments.
BEGIN;
UPDATE public.app_modules SET is_active=true,show_in_navigation=true,updated_at=now() WHERE module_key='sales-data-viewer';
UPDATE public.app_module_clients SET nav_enabled=true,updated_at=now() WHERE module_key='sales-data-viewer' AND client_key IN ('pwa','electron');
COMMIT;
