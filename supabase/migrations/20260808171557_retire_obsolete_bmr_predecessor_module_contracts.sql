-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

-- Retire dormant Electron deep-link registrations first.
delete from public.app_module_clients
where module_key in ('add-bmr-entry','edit-bmr-entry','view-bmr-entry');

-- Remove obsolete live canonical assignments. Historical evidence remains in
-- user_permissions_canonical_backup_20260126 and admin_audit.
delete from public.user_permissions_canonical
where target in ('module:add-bmr-entry','module:edit-bmr-entry','module:view-bmr-entry');

-- Retire inactive predecessor module registrations.
delete from public.app_modules
where module_key in ('add-bmr-entry','edit-bmr-entry','view-bmr-entry')
  and is_active = false
  and is_assignable = false;

-- Remove now-unreferenced obsolete permission targets.
delete from public.permission_targets
where key in ('module:add-bmr-entry','module:edit-bmr-entry','module:view-bmr-entry')
  and is_assignable = false;

commit;