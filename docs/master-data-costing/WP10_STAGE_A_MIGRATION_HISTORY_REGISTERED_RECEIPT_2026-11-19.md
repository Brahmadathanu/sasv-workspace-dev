# WP10 Stage A — production migration-history reconciliation receipt (19 Nov 2026 IST)

**FINAL RESULT: SUCCESS / INDEPENDENT R1 POSTCHECK PASS.** This receipt completes the **Stage A migration-history registration requirement only**, not WP10/WP12 formal closure. Project `qhmoqtxpeasamtlxaoak` / PostgreSQL 17.4.

## Provenance and execution
- Reviewed migration source: `supabase/migrations/20261118161406_wp10_four_master_stage_a_state_reconciliation.sql`, LF SHA-256 `c0e4cdbd4908d43f865e22e7c805464292d7d8387482003ee6674baba9fbbf2d`, at PR #477 branch.
- Stage A policies were already owner-authorised and applied once on 18 Nov. The migration reconciliation was separately reviewed and given a successful production PostgreSQL 17.4 transaction that ended ROLLBACK, without changing production policies or history.
- A local Claude Code CLI session linked explicitly to `qhmoqtxpeasamtlxaoak`. The first `supabase migration repair` attempt failed before remote change because the local migration file was absent (remote history remained 705). Owner authorised a single retry with a temporary reviewed file.
- Claude placed the exact hash-verified untracked file in `supabase/migrations`, verified project and prior history (705, target unused), ran `supabase migration repair --status applied 20261118161406 --linked` with CLI 2.48.3 **once** and received exit code 0 / `Repaired migration history: [20261118161406] => applied`. It independently listed remote migrations: 706, target present once. Claude deleted only the untracked byte-identical temporary file; no change to five unrelated PEC migrations or local branch.
- **No migration SQL was executed as part of the history repair**, no `db push`, no manual database-history INSERT, no Stage B, no Electron release or PR merge.

## ChatGPT's independent production R1 verification
Executed the exact committed `docs/master-data-costing/WP10_STAGE_A_RECONCILIATION_SQL/R1_reconciliation_verify_readonly.sql` on project `qhmoqtxpeasamtlxaoak` with a read-only SQL transaction. All **28** returned rows were inspected; **0 mismatches** versus the captured pre-registration baseline and documented expected history-only changes.

| Check | Before | After |
| --- | --- | --- |
| History rows | 705 | **706** |
| Max version | `20261116143310` | **`20261118161406`** |
| Target version unused | true | **false** |
| Target name row count | 0 | **1** |
| Registered version/name | (none) | **`20261118161406 wp10_four_master_stage_a_state_reconciliation`** |
| Duplicate versions | 0 | **0** |
| Target later than all other versions | true | **true** |
| Four table policy count | 16 | **16** |
| Policy fingerprint | `843d07be72834695e842bc34f2d5a014` | **unchanged** |
| Table ACL fingerprint | `49e7845bfd4c951d9f22b8649e7bb87f` | **unchanged** |
| Governed RPC count | 12 | **12** |
| Governed RPC definition fingerprint | `91445b2f994293d74e906a37ce90228e` | **unchanged** |
| RPC ACL fingerprint | `2a9fda475baf0be09e762efff97e8ed6` | **unchanged** |
| Permission helper definition fingerprint | `18a902556b22202b6d867f5da63e8e39` | **unchanged** |
| RLS enabled, FORCE off | all four | **unchanged** |
| Authenticated table privileges | DELETE,INSERT,SELECT,UPDATE each | **unchanged** |
| `categories` / `product_groups` / `sub_categories` / `sub_groups` row counts | 5 / 100 / 24 / 146 | **unchanged** |
| PostgreSQL version | 17.4 | **17.4** |

## Closure classification and boundaries
- **Stage A production RLS application: COMPLETE** (previous postflight 58/58).
- **Stage A migration-history reconciliation: COMPLETE** (this receipt, 706 entries and no policy/ACL/data-count drift).
- **Client/role negative-access receiving: NOT TESTED**. Actual Editor, View-only and No-access JWT status checks are required; no forged sessions or writes have been used.
- **Stage B removal of authenticated direct DML: NOT APPLIED**. It remains gated on verified staff-installed Electron upgrade and separately approved cutover; authorised legacy Editors still retain direct DML grants but are now subject to View+Edit RLS.
- **WP10 and WP12: OPEN** pending proper scope/acceptance decisions; **11/13 programme workpacks CLOSED**. Electron release HOLD remains intact. PR #476/#477 remain draft/unmerged until separate owner approval.
