# S3J — Privileged retention disposal pathway: implementation contract

**Status:** design specification + live-verified S3I classifier. No trigger replacement, credentials, role provisioning, live DDL, cleanup DML or automation installed.

## Non-negotiable invariants

1. `costing.fn_enforce_mutable_refresh_run_snapshot()` currently rejects DELETE on SUCCESS and CANCELLED and `costing.fn_guard_designated_run_rows()` protects all REFERENCE/APPROVED/REVOKED decisions. Preserve these rules for every normal writer, including `anon`, `authenticated`, `service_role`, Costing Suite UI and scheduled refresh functions.
2. Historical-designation history is permanent, even if the owner treats July–October detail as pre-completion transitional. The 6 designated IDs (119,122,128,136,140,143) may be considered for archival later but **never** through the default unapproved-run path. Run 143 remains official costing/pricing until a duly approved successor exists.
3. A dedicated **direct PostgreSQL login role** (for example `sasv_retention_executor`) distinct from the API `service_role` and `authenticator` is necessary. No membership grants to broad roles; strong credential in isolated scheduler secrets only; verify owner, CONNECT/schema/function privileges. A role name is a proposed placeholder, not an installed database role.
4. Authorization is not a `current_setting(...)` flag alone. A private, immutable retention-authorization record must bind a single run ID, specific table(s), exact expected row counts, archive receipt hash, operator approval, expiration, and intended transaction ID. Only a locked privileged workflow can create/consume this record.
5. In trigger context, `current_user` inside the existing SECURITY DEFINER functions is the function **owner** (`postgres`), not the caller; it is unsafe to treat `current_user=postgres` as a cleanup authorisation. A reviewed design can use a private role-specific *session identity* plus a database-owned transaction-scoped authorization ledger, but connection pooling/role-switch behaviour and spoofing resistance must be tested before deployment.
6. An authorization exception (if approved at all) is permitted on **DELETE only**, for exact designated *undesignated* historical run rows and exact allowlisted snapshot relations; it must remain impossible to INSERT/UPDATE completed snapshots or DELETE accepted/designated/current-period data.
7. No `ALTER TABLE ... DISABLE TRIGGER`, `session_replication_role=replica`, `SET ROLE postgres`, status mutation, `TRUNCATE` or blanket `DELETE ... CASCADE` in a retention cleanup.
8. Audit receipts must include run, table, exact count, PK range, archived sha256, authorising actor, finalisation gate, starting/finishing times, pre/post count, rollback/recovery proof, permissions used, and success/failure. The receipt must be durable in its own controlled table and not silently disappear if run headers are later compacted.

## Phased server implementation

**G1: private control schema and maintenance role (NOT yet applied)**

- Create an unexposed private `costing_retention` namespace owned by privileged DBA. Reject direct Data API use; revoke `USAGE` and EXECUTE on all helper functions from PUBLIC, anon, authenticated and service_role, including any implicit default EXECUTE privilege.
- Record per-run preflight approval in a private table with status `SEALED` and immutable authorisation hash, explicit expiry and terminal status. Only a named DBA-approved identity may write this ledger. Add immutable append-only execution receipt table.
- Ordinary users may see only safe aggregated metrics through an explicitly authorised read-only view.

**G2: guarded trigger exception (NOT yet applied)**

- Review each existing snapshot guard definition and keep its entire original mutation path unchanged except a strictly scoped `DELETE` branch.
- The branch must independently verify that the row's run matches the locked, unexpired and same-transaction authorisation; it belongs to the allowable historical period; has no designation history; is neither the displayed nor approved period run; no acceptance/source exception; table is in the explicit batch allowlist; and the session comes from the dedicated maintenance login. Any missing condition raises and rolls back.
- Implement the exception consistently in every affected trigger. The currently existing `fn_guard_designated_run_rows()` should still prohibit all designated rows **unconditionally**. Never turn a revoked designation into an unapproved draft.
- Add a migration-time guard verifying the SHA-256/definition signature of each existing trigger function so a deployment fails if its source drifted. Review default PUBLIC EXECUTE and SECURITY DEFINER search_path.

**G3: staging-only deletion engine (NOT yet applied)**

- Use an independent, restored fixture (local PostgreSQL 17 if preferred), not a billable cloud branch. No credentials or PII in the repo.
- Refuse to run unless a verified external durable archive and exact restored row digest exist, plus a signed/approved manifest and finalisation gate.
- Start with two FK-leaf run-87 evidence tables. Delete in bounded batches via indexed `refresh_run_id`, in transactions that lock the run and authorization row. With each batch, verify deletion counts and append a tamper-resistant receipt. After the pilot, rehearse recovery from archive and check parity of the original source sales ledger.
- This is not yet sufficient for the **full run**: enumerate direct 64 FKs, nested 62 relationships, 3 selected-scheme FKs and external report references first. Preserve immutable approval and other acceptance data.

**G4: approval and release (NOT yet authorised)**

- Before production: positive/negative privilege tests, full restore proof, signed owner approval of the exact run IDs/tables, impact assessment, controlled release and no concurrent costing refresh. No implicit owner approval from a generic 'go ahead' to disable immutability protections.
- After acceptance, schedule cleanup *after* monthly finalisation, preserving latest approved active costing and official pricing. Retain November onward approved detail for current + 3 previous periods.

## Required negative-access/functional test cases

| Case | Expected |
| --- | --- |
| anon/authenticated/service_role invokes maintenance writer | DENY |
| direct SQL DELETE of run 87 from ordinary context | DENY (terminal guard) |
| dedicated role without SEALED authorisation | DENY |
| dedicated role with expired or wrong-run receipt | DENY |
| dedicated role with mismatched table or expected count | DENY |
| any INSERT/UPDATE to SUCCESS run | DENY |
| any deletion of REFERENCE/APPROVED/REVOKED (119/122/128/136/140/143) | DENY |
| deletion of October official run 143 | DENY |
| deletion of November run 152/153 or current-month data | DENY |
| deleted row linked to accepted financial/material evidence | DENY |
| missing or failed archive/restore proof | DENY |
| same transaction, correct credential, signed run-87 authorization, verified archive, allowlisted leaf table | ALLOW in **isolated staging only**, then independently restore |
| after-run report and pricing parity | PASS required before any production approval |

**Read-only code already available:** S3I fixture query returns 9/9 expected classifications in production. S3H verified both immutable snapshot triggers. **Nothing in this contract changes existing access controls or data.**
