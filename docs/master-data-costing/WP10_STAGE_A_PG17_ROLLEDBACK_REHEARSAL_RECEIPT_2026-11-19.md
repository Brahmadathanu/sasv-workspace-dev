# WP10 Stage A reconciliation — live PG17.4 rolled-back rehearsal receipt (19 Nov 2026 IST)

**Status:** REHEARSAL PASSED; **MIGRATION HISTORY REGISTRATION STILL PENDING**. Project `qhmoqtxpeasamtlxaoak`.

## Source and authority
- Owner instruction: "Okay go ahead we need to finish the costing suite workflow end to end in no time without compromising quality", following the explicit proposal for a rolled-back controlled rehearsal.
- Exact reviewed source: `supabase/migrations/20261118161406_wp10_four_master_stage_a_state_reconciliation.sql`, branch head `488f97f884f23958712339d288189c0ac585e14f`, GitHub blob SHA `a508840a09c524f8f6f233e5dc85a5ade3a0110b`. Package-reported pinned LF SHA-256: `c0e4cdbd4908d43f865e22e7c805464292d7d8387482003ee6674baba9fbbf2d`.
- Exact read-only R1: `docs/master-data-costing/WP10_STAGE_A_RECONCILIATION_SQL/R1_reconciliation_verify_readonly.sql`, GitHub blob SHA `83781c2e67bce9420f5d65493e28bc801e4238d3`.

## What was actually executed
1. Ran R1 via connected Supabase SQL interface: pre-state was 705 migrations, latest version `20261116143310`, target version unused, 16 live hardened policies, 12 governed RPCs, RLS enabled/unforced, intact ACL and helper fingerprints.
2. Executed the exact reviewed migration body on production PG17.4, **replacing only its final `commit;` with** a diagnostic SELECT and `ROLLBACK;`. The SQL completed successfully and returned `REHEARSAL_COMPLETED_INSIDE_TRANSACTION`, `policy_count = 16`. It did not return a reliable tool-exposed NOTICE with the State B label, so this receipt **does not quote an observed NOTICE**. Since baseline was already 16 hardened policies and the migration's State A path requires four original policies, successful execution is consistent with its intended State B already-hardened branch.
3. Immediately reran exact R1: 28 rows returned. Compared 15 independent expected values, all matched the pre-rehearsal baseline: `history_count=705`, `history_max_version=20261116143310`, `target_version_unused=true`, `target_name_registered_rows=0`, `policy_count_on_four_tables=16`, policy fingerprint `843d07be72834695e842bc34f2d5a014`, table-ACL fingerprint `49e7845bfd4c951d9f22b8649e7bb87f`, RPC-definition fingerprint `91445b2f994293d74e906a37ce90228e`, RPC-ACL fingerprint `2a9fda475baf0be09e762efff97e8ed6`, helper-definition fingerprint `18a902556b22202b6d867f5da63e8e39`, row counts 5/100/24/146 and governed RPC count 12. RLS `true,false` for each table.

## Why migration history was not registered
The connected Supabase tool provides `apply_migration(name,query)` (assigns its own migration version), `execute_sql` and `list_migrations`, **but no explicit-version migration-history repair tool**. The reviewed version is `20261118161406`. Applying through the version-generating migration tool would create a different version and contradict the reviewed path, protected-registry pin and expected 705→706 receipt. Direct SQL insertion into `supabase_migrations.schema_migrations` was expressly excluded by the runbook, and there is no authenticated linked Supabase CLI repair channel established in this session. **No registration action was attempted**; do not reapply or silently register under a changed version.

**Next exact action, with separately confirmed authenticated CLI access:** from a linked/authorised Supabase CLI environment, run the package runbook's `supabase migration repair --status applied --remote 20261118161406`, after a fresh R1 pre-state and hash/pin verification; immediately run R1 post-state and require 705→706 with identical fingerprints. Never use `db push`, insert directly into history, or run the Stage A apply script again.

## Other gates
Real independently signed-in Editor/View-only/No-access JWT receiving is **NOT TESTED**; no user impersonation or production master-data writes. Stage B direct-DML revocation requires verified managed Electron fleet migration. No PR merge, installer or Electron release executed. WP10/WP12 OPEN, 11/13 workpacks CLOSED; release HOLD.
