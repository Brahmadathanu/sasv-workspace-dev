# WP10 — Subgroup permission correction candidate and dependency gate (2026-11-16)

## Read-only live findings
- `public.sub_groups`: authenticated SELECT and INSERT/UPDATE/DELETE true; anon SELECT false; RLS enabled with `sub_groups_authenticated_crud` ALL policy `auth.uid() IS NOT NULL` for USING and WITH CHECK.
- `public.product_groups`: authenticated SELECT true, anon SELECT false, RLS enabled.
- Database contains SECURITY DEFINER route manager RPCs for subgroup mapping lifecycle and a WP10 subgroup impact preview; these are distinct from direct DML on `public.sub_groups`. EXECUTE grants alone do not establish module-level authorization; function body review is still necessary.

## New review-only files
- `scripts/wp10-g2-safeguards/review-only-subgroup-auth-dml-revoke.sql`: guarded transactional REVOKE INSERT/UPDATE/DELETE from authenticated on `public.sub_groups`, with fail-closed pre/postchecks and SELECT preservation.
- `scripts/wp10-g2-safeguards/review-only-subgroup-auth-dml-revoke-rollback.sql`: separate owner-gated restoration of baseline broad grants, not a safe permanent policy.

**Neither is production-approved, tested against production or applied.** A privilege REVOKE may break legitimate Manage Products or master-data client writes. Must first inventory all direct `sub_groups` writes, decide governed replacement RPC/editing policy, inspect SECURITY DEFINER authorization and test using isolated roles/fixtures. Role inheritance/other grants may make the candidate postcheck fail closed; do not bypass. Independently review SQL/rollback and obtain owner approval. Proposal 05 still does not protect group reassignment; preventing direct DML is not a substitute for privileged-writer governance.
