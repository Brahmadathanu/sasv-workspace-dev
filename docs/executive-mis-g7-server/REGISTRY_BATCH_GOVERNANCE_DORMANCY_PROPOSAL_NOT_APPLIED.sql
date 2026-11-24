-- ======================================================================================================================
-- PROPOSAL ONLY — NOT APPLIED, NOT A MIGRATION. Needs explicit owner authorization (decision D1 in MIS_REPORTING_ONLY_CLOSURE_PACKAGE_20261124.md).
-- Purpose: the reporting-only MIS release no longer ships public/shared/mis-batch-governance.html, but the production registry (applied earlier,
-- CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql) still holds a launchable 'mis-batch-governance' module whose Electron/PWA routes point at that page.
-- Zero users hold the target today, so nobody sees a dead link; this keeps it that way if an assignment is ever made before PWL ships.
-- Deliberately minimal and reversible: it only switches navigation/launch OFF. It deletes nothing and touches no assignment, no other module,
-- no permission_targets row (the FK from app_modules stays valid). The five signer/packing/excess/enforcement/core targets are unchanged.
-- ======================================================================================================================

-- 1) Read-only pre-check (run first; expected: one app_modules row, two app_module_clients rows, 0 assignments).
-- select module_key, is_active, show_in_navigation, is_assignable from public.app_modules where module_key = 'mis-batch-governance';
-- select client_key, route_path, nav_enabled, launch_mode from public.app_module_clients where module_key = 'mis-batch-governance';
-- select count(*) from public.user_permissions_canonical where target = 'module:mis-batch-governance';

begin;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_permissions_canonical WHERE target = 'module:mis-batch-governance')
     OR NOT EXISTS (SELECT 1 FROM public.app_modules WHERE module_key = 'mis-batch-governance') THEN
    RAISE EXCEPTION 'MIS_REGISTRY_DORMANCY_PRECONDITION';
  END IF;
END $guard$;

update public.app_module_clients set nav_enabled = false, updated_at = now() where module_key = 'mis-batch-governance';
update public.app_modules        set show_in_navigation = false, updated_at = now() where module_key = 'mis-batch-governance';
commit;

-- Rollback (restores the applied state):
--   update public.app_module_clients set nav_enabled = true, updated_at = now() where module_key = 'mis-batch-governance';
--   update public.app_modules        set show_in_navigation = true, updated_at = now() where module_key = 'mis-batch-governance';
