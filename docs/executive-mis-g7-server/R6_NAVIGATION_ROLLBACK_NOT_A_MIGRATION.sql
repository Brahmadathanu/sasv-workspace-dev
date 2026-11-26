-- Recovery only. Restores the captured legacy navigation and permission label; never modifies user assignments.
BEGIN;
UPDATE public.permission_targets SET label='Sales Data Viewer' WHERE key='module:sales-data-viewer';
UPDATE public.app_modules SET is_active=true,show_in_navigation=true,is_assignable=true,updated_at=now() WHERE module_key='sales-data-viewer';
UPDATE public.app_module_clients SET nav_enabled=true,updated_at=now() WHERE module_key='sales-data-viewer' AND client_key IN ('pwa','electron');
COMMIT;
