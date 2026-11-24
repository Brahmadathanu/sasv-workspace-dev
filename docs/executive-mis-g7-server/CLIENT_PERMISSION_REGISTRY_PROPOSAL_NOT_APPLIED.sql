-- MIS G7 client: permission-registry preparation. PROPOSAL ONLY — NOT APPLIED, NOT A MIGRATION.
-- Needs explicit owner authorization. Deliberately kept outside supabase/migrations.
--
-- Mechanism (existing, canonical): public.app_modules rows (target_key = 'module:<module_key>') make a target
-- assignable in the permission admin; user_permissions_canonical(user_id, target, can_view, can_edit) holds assignments;
-- public.require_permission(target, true) needs BOTH can_view and can_edit; the client only reflects app_has_permission().
--
-- This file registers targets so the owner CAN assign them later. It assigns NOTHING to any user and grants no role.
-- Verify first (read-only):
--   select module_key, target_key, is_assignable, show_in_navigation, section_key, min_nav_mode
--     from public.app_modules
--    where module_key in ('mis-batch-stage-signer','mis-fg-bulk-packing','mis-fg-excess-adjustment',
--                         'mis-g7-enforcement-admin','mis-g7-core-migration-signoff','mis-batch-governance','executive-mis-dashboard');
--   select count(*) from public.user_permissions_canonical where target in (
--     'module:mis-batch-stage-signer','module:mis-fg-bulk-packing','module:mis-fg-excess-adjustment',
--     'module:mis-g7-enforcement-admin','module:mis-g7-core-migration-signoff');          -- expected 0 before AND after
--
-- Rollback only before any assignment or live use, after owner approval:
--   delete from public.app_module_clients where module_key = 'mis-batch-governance';
--   delete from public.app_modules where module_key in ('mis-batch-stage-signer','mis-fg-bulk-packing',
--     'mis-fg-excess-adjustment','mis-g7-enforcement-admin','mis-g7-core-migration-signoff','mis-batch-governance');

begin;

-- Fail closed: no overwrite of an existing registry or assignment.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.app_modules WHERE module_key IN ('mis-batch-governance','mis-batch-stage-signer','mis-fg-bulk-packing','mis-fg-excess-adjustment','mis-g7-enforcement-admin','mis-g7-core-migration-signoff'))
     OR EXISTS (SELECT 1 FROM public.permission_targets WHERE key IN ('module:mis-batch-governance','module:mis-batch-stage-signer','module:mis-fg-bulk-packing','module:mis-fg-excess-adjustment','module:mis-g7-enforcement-admin','module:mis-g7-core-migration-signoff'))
     OR EXISTS (SELECT 1 FROM public.user_permissions_canonical WHERE target IN ('module:mis-batch-governance','module:mis-batch-stage-signer','module:mis-fg-bulk-packing','module:mis-fg-excess-adjustment','module:mis-g7-enforcement-admin','module:mis-g7-core-migration-signoff'))
     OR NOT EXISTS (SELECT 1 FROM public.app_modules WHERE module_key='executive-mis-dashboard' AND section_key IS NOT NULL) THEN
    RAISE EXCEPTION 'MIS_G7_REGISTRY_PRECONDITION';
  END IF;
END $guard$;

-- Live FK fk_app_modules_target requires the canonical targets FIRST.
INSERT INTO public.permission_targets (key,kind,label,sort_order,is_assignable)
VALUES
 ('module:mis-batch-governance','module','Batch Governance',1071,true),
 ('module:mis-batch-stage-signer','module','MIS: Batch stage signer',1072,true),
 ('module:mis-fg-bulk-packing','module','MIS: FG bulk packing',1073,true),
 ('module:mis-fg-excess-adjustment','module','MIS: FG excess adjustment',1074,true),
 ('module:mis-g7-enforcement-admin','module','MIS: G7 enforcement admin',1075,true),
 ('module:mis-g7-core-migration-signoff','module','MIS: G7 core migration sign-off',1076,true);


-- Rollback also deletes the six newly created permission_targets after deleting app_modules.
-- Section reuse: same navigation section as the Executive MIS dashboard (no new section).
with sec as (select section_key from public.app_modules where module_key = 'executive-mis-dashboard')
insert into public.app_modules
  (module_key, target_key, label, description, section_key, sort_order, icon_key, is_active, is_assignable, show_in_navigation, min_nav_mode, updated_at)
select v.module_key, 'module:' || v.module_key, v.label, v.description, (select section_key from sec), v.sort_order, null, true, true, v.nav, 'view', now()
from (values
  ('mis-batch-governance',          'Batch Governance',             'Route-based stage signing, governed FG packing, corrections and exception visibility.', 71, true),
  ('mis-batch-stage-signer',        'MIS: Batch stage signer',      'Sign and correct batch route-stage evidence (view + edit).',                               72, false),
  ('mis-fg-bulk-packing',           'MIS: FG bulk packing',         'Governed FG bulk packing and pack-line correction (view + edit).',                         73, false),
  ('mis-fg-excess-adjustment',      'MIS: FG excess adjustment',    'Record physically measured excess inside a governed packing (view + edit; additional to packing).', 74, false),
  ('mis-g7-enforcement-admin',      'MIS: G7 enforcement admin',    'View enforcement readiness; edit switches AUDIT/ENFORCE (owner governed).',                 75, false),
  ('mis-g7-core-migration-signoff', 'MIS: G7 core migration sign-off','Record owner sign-off of the patched legacy DWL editor core SHA (owner governed).',        76, false)
) as v(module_key, label, description, sort_order, nav)
;

-- Only the page is launchable; the five permission targets are not navigation entries.
insert into public.app_module_clients (module_key, client_key, route_path, nav_enabled, launch_mode, updated_at)
values
  ('mis-batch-governance', 'electron', 'public/shared/mis-batch-governance.html', true, 'direct', now()),
  ('mis-batch-governance', 'pwa',      'public/shared/mis-batch-governance.html', true, 'direct', now())
;

commit;
-- Not included, by design: any insert/update on user_permissions_canonical; any change to executive-mis-dashboard;
-- any change to min_nav_mode of an existing module.
