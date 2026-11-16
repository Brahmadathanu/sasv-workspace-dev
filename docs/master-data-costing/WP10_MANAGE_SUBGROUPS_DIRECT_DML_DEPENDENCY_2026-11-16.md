# WP10 — Confirmed Manage Sub-Groups direct-DML dependency (2026-11-16)

## Verified code path
On default branch `js/subgroups.js`, the **Manage Sub-Groups** screen directly uses Supabase PostgREST `public.sub_groups` for:
- `.insert([{ product_group_id: groupId, sub_group_name: name }])` in Add form;
- `.update({ sub_group_name: newName }).eq('id', id)` in inline Save;
- `.delete().eq('id', id)` in Delete;
- SELECT for listing.

The screen's inline edit changes **name only**. It does not expose changing `product_group_id`, but existing broad authenticated UPDATE grants and RLS allow that column to be targeted through direct requests, subject to other server controls.

## Implication
The review-only REVOKE candidate **would break three legitimate UI operations** if applied without client/server replacement. Keep unapplied. The route-manager subgroup mapping RPCs are NOT substitutes for CRUD of `public.sub_groups`.

## Required implementation order
1. Establish the intended Manage Sub-Groups module permission (View vs Edit) and server enforcement; do not infer permission merely from authenticated session.
2. Implement governed SECURITY DEFINER RPCs for create/rename/delete, with explicit module Edit check, validation, and safe deletion/dependency handling. Restrict group reassignment by default; add an explicit route-impact-aware workflow only if needed.
3. Update `js/subgroups.js` to call the governed RPCs; show errors instead of ignoring Supabase errors; verify authorized Editor and View-only/No-access behavior.
4. Only after deployment/acceptance, independently review and apply the authenticated DML REVOKE. Preserve SELECT and independently validate permission matrix, route invariants, and rollback.

No production change or approval. WP10 OPEN.
