# PEC G0 — Approved-indent reduction and snapshot-refresh chain (2026-11-12)

**Scope:** user-authorized, rollback-only live Supabase verification of the legacy internal-material reduction path. No fake JWT, no impersonated user, no permanent procurement records, no MRP rebuild, no Tally PO dependency.

## Test fixture and result

- Historical approved indent **#84**, `indent_id=1`, `indent_line_id=137`, item **#427 Kasturikalpa Rasayanam 114 ML**, classified `finished_bulk_material`, `material_class_id=1`, `uom_id=5 (Nos)`.
- Starting `proc_indent_line.requested_qty=260` Nos. In a `BEGIN; ... ROLLBACK;` transaction, called `proc_indent_add_line_pec_internal(1,1,427,5,259,'Rollback-only legacy reduction acceptance')`.
- The call proceeded through the internal-item guard, line update, and into `proc_request_snapshot_refresh('indent_line_changed')`. It then raised **`Not authenticated`** from `require_permission('module:procurement-execution-console',true)` because the SQL administrative session has no authorized signed-in `auth.uid()`.
- The failed transaction did not publish the change. **Post-check:** requested quantity still **260 Nos**, no lifecycle audit event with that test reason, snapshot control `requested_revision=120,completed_revision=120,published_revision=120` at check time. Thus no pending refresh was created by this test.
- This is evidence that a decrease is not rejected by the new quantity guard. It is **NOT** a successful authorized decrease test or snapshot-refresh completion test.

## Security/access implication

The public wrapper `proc_indent_add_line` and downstream refresh helper `proc_request_snapshot_refresh` both require PEC edit permission. A signed-in, permitted editor should satisfy those checks, but the complete path must be exercised with a real authorized account in an isolated acceptance session. **Do not** falsify `request.jwt.claim.sub`, alter `user_permissions_canonical`, or disable permission checks in production to make this test pass.

A separate read-only grant check shows `has_table_privilege('authenticated','public.proc_pr_line','update')=false`, whereas service_role has UPDATE. The legacy direct `proc_pr_set_requested_qty` invoker-function pathway therefore does not currently provide ordinary authenticated users a table write bypass. Retest if grants or RLS change.

## Open checks and guardrails

1. Authenticated editor positive-path reduction + snapshot request/publish integration; record actual session result and ledger revisions.
2. PR revision create/activate integration with historical excluded lines using safe separate staging, not a synthetic approved record on live database.
3. PR/indent UI acceptance, source-view RLS parity and migration branch review.
4. Full MRP rebase remains held because stored November–January production driver sets diverge substantially from current plan.
5. Verify seven historical open internal indent balances under owner-governed lifecycle review rather than deleting or hiding them.

**PEC G0 active; 0/6 formal gates verified.**
