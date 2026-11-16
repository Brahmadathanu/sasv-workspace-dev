# WP10 — Manage Sub-Groups permission contract verified (2026-11-16)

## Live read-only evidence
- `public.require_permission(p_target text,p_need_edit boolean)` is SECURITY DEFINER and requires `auth.uid()`, a matching `user_permissions_canonical.target`, `can_view=true` and `can_edit=true` when edit requested. It raises on denial.
- `public.app_has_permission('module:manage-subgroups','edit')` is a boolean wrapper of `app_has_permission_core`, which reads the canonical permission table.
- Canonical target **`module:manage-subgroups`** exists in the live permission view: **3 user permission rows, 1 editor** (aggregate only; no identities retrieved).
- The current `js/subgroups.js` direct create/rename/delete does not call this gate; current broad `sub_groups_authenticated_crud` RLS allows authenticated direct DML regardless of module Edit permission.

## Proposed server/client contract
Create three purpose-specific SECURITY DEFINER RPCs for subgroup create, rename, delete. Each must invoke `public.require_permission('module:manage-subgroups',true)` before writing; schema-qualify table names; use a pinned safe search_path, bound input validation, no `product_group_id` update entry point, and consistent error handling. Delete must fail safely if dependent products/mappings exist (FK/constraint review). Client `js/subgroups.js` calls these RPCs and visibly reports failures. Preserve existing SELECT access for view-only identities.

## Gate and ordering
No production SQL or client deploy until independent review of RPC privilege grants, FK dependencies, rollback, editor/view-only/no-access tests, and an agreed rollout that prevents an old client from breaking after authenticated DML revocation. The previously prepared REVOKE and rollback are review-only, not deployable by themselves.
