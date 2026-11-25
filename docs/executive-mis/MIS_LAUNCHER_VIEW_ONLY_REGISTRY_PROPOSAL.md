# Executive MIS launcher: View-only navigation — registry proposal (NOT APPLIED)

**Status:** proposal only. No SQL has been run and no migration file is added. Needs specific owner authorization.

## Finding
- Client code already supports a clickable read-only entry: `getModuleAccessLevel` returns `read` when the user has `can_view` and the module's `min_nav_mode` is `read`; the hub renders `view` as a locked `#` entry and `read` as a normal link. No client change is needed or proposed (`public/shared/js/module-registry.js` and the hub are unchanged).
- `min_nav_mode` is stored once per module in `public.app_modules` (the PWA and Electron registry rows share it). The 2026-11-15 registry snapshot has `executive-mis-dashboard` at `view`, so View-only users see a locked card.

## Proposed change (one row)
```sql
-- verify first
select module_key, min_nav_mode from public.app_modules where module_key = 'executive-mis-dashboard';
-- change
update public.app_modules
   set min_nav_mode = 'read', updated_at = now()
 where module_key = 'executive-mis-dashboard' and min_nav_mode = 'view';
-- rollback
update public.app_modules
   set min_nav_mode = 'view', updated_at = now()
 where module_key = 'executive-mis-dashboard';
```
Effects: View-only (`can_view=true, can_edit=false`) becomes clickable; no permission stays hidden; `can_edit` unchanged; no other module row changes. Data access remains enforced by the RPC (`module:executive-mis-dashboard` view check) and existing MIS views, not by the launcher.

## Owner decisions needed
1. Approve the row change.
2. Because the row is shared, it also affects the Electron launcher. Apply only outside the Costing Suite Electron release window, or confirm that is acceptable.
