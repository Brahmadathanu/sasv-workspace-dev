# WP10 — Governed subgroup CRUD implementation review (2026-11-16)

## Draft branch implementation
- `scripts/wp10-g2-safeguards/review-only-subgroup-governed-rpcs.sql` creates guarded `rpc_wp10_create_subgroup`, `rpc_wp10_rename_subgroup`, `rpc_wp10_delete_subgroup`. All require `public.require_permission('module:manage-subgroups',true)`; explicit EXECUTE authenticated only, revoked from public/anon. No group reassignment RPC.
- `js/subgroups.js` now calls these RPCs for add/rename/delete, with visible error messages; SELECT remains direct.
- `scripts/wp10-g2-safeguards/review-only-subgroup-governed-rpcs-rollback.sql` drops only the three newly created functions after preflight.

## Not yet accepted
- No isolated PG role/security tests or UI acceptance have run for this implementation; **NOT TESTED**.
- SQL is a review-only proposal, not a production migration. Independent review must verify FK dependencies for delete, function ownership/SECURITY DEFINER exposure, schema and constraints, race safety, and exact deployed route. SQL rollback must not run while any deployed client still calls the RPCs.
- Required deployment order: independent SQL review and tests -> owner authorizes RPC installation -> verify server RPCs and negative roles -> deploy client -> verify Editor/View-only/No-access and Electron packaging -> only then owner-approved authenticated direct DML revoke. Old Electron versions may still require compatibility planning before revoke.
- No production SQL, merge, deployment, or flags changed. WP10 OPEN.
