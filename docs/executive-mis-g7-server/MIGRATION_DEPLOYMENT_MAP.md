# MIS G7 — migration identity map, deployment sequence and staged rollback (S2 is LIVE and is never replayed)

Machine-readable identities (file SHA-256, git blob SHA-1, bytes, registered version): `MIGRATION_IDENTITIES.json` (regenerate with `node supabase/tests/mis_g7/gen_migration_identities.mjs` after any intended change; a test fails on drift and asserts the S2 file equals the blob installed in production, `055b1cdfa1c8be970939f57e7e866f126ec55f03`, 21,644 bytes).

## 1. Repository filename ↔ Supabase registered version
| # | Repository file | Supabase migration name | Registered version | Status |
|---|---|---|---|---|
| 1 | `20261123140000_mis_g7_s2_signed_batch_stage_events.sql` | `mis_g7_s2_signed_batch_stage_events` | **`20261124055734`** | **LIVE** — never replay, never edit |
| 2 | `20261123141000_mis_g7_s3_fg_ledger_shared_batch_lock.sql` | `mis_g7_s3_fg_ledger_shared_batch_lock` | assigned at apply | HELD |
| 3 | `20261123142000_mis_g7_s4_atomic_pack_with_measured_excess.sql` | `mis_g7_s4_atomic_pack_with_measured_excess` | assigned at apply | HELD |
| 4 | `20261123143000_mis_g7_s3b_protected_stock_write_boundary.sql` | `mis_g7_s3b_protected_stock_write_boundary` | assigned at apply | HELD |
| 5 | `20261123144000_mis_g7_s4b_ticketed_pack_corrections_and_enforcement_control.sql` | `mis_g7_s4b_ticketed_pack_corrections_and_enforcement_control` | assigned at apply | HELD |
| 6 | `20261123145000_mis_g7_s5_legacy_dwl_editor_chain_protection.sql` | `mis_g7_s5_legacy_dwl_editor_chain_protection` | assigned at apply | HELD |
| 7 | `20261123150000_mis_g7_s5b_legacy_dwl_editor_core_integration.sql` | `mis_g7_s5b_legacy_dwl_editor_core_integration` | assigned at apply | HELD, owner-gated, patched core SHA `dfa5a5e9…1bcc` |

**Tracking rules (no production history is modified):**
- The repo S2 prefix (`20261123140000`) differs from the registered version (`20261124055734`). Do **not** run `supabase db push` / `migration up` from this branch: the CLI would see S2 as unapplied (replay) and S3–S5b as older than the latest remote migration. Apply S3→S5b **one at a time with the Supabase migration tool by name** (the tool assigns the version), and record each registered version in `MIGRATION_IDENTITIES.json` and on PR #522.
- After the last controlled apply, a follow-up commit may `git mv` the seven files to their registered versions so CLI history matches (rename only; production history untouched). Until then the filename↔version table above is the source of truth.
- Every file is applied exactly once; none is idempotent-safe to replay except by design (S3b/S5b fail closed on a second run: fingerprints/baseline).

## 2. Deployment sequence (controlled; each step needs separate owner authorization; AUDIT only; ENFORCE is never activated here)
Pre-flight for the whole sequence: `S3B_PREINSTALL_LIVE_CHECK_READONLY.sql` (17/17) and `CORE_PREINSTALL_LIVE_CHECK_READONLY.sql` (7/7) immediately before S3b/S5b; immutable source+ACL+RLS+trigger packet of the 11 functions retained (S3b also persists it in `app_private.mis_g7_s3b_baseline`); confirm `app_private.mis_batch_stage_event` row count and the five permission targets' assignments (expected 0).
| Step | Apply | Read-only receipt required before the next step | Rollback section (in `ROLLBACK_NOT_A_MIGRATION.sql`) |
|---|---|---|---|
| S3 | `…141000` | trigger `00_mis_g7_fg_batch_lock` present on `fg_bulk_stock_ledger`; both S2 lock helpers **not** executable by authenticated/anon/PUBLIC; `mis_g7_s3_baseline` has 2 rows; S2 RPCs still callable; a legacy ledger insert still works | `S3 ROLLBACK` |
| S4 | `…142000` | `mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)` present, authenticated-only; private tables exist and are RLS-protected | `S4 ROLLBACK` |
| S3b | `…143000` | install does **not** raise (it is fail-closed); 11 pinned SHAs matched; `mis_g7_s3b_baseline` holds 11 functions + ledger ACL; the 10 chain functions SECURITY DEFINER with EXECUTE closed; `fn_fg_mark_done_if_zero` wrapper + `_legacy`; ledger DML revoked from authenticated/anon; gate triggers present; mode = AUDIT; old-client work-log/packaging/transfer smoke by an authorized user | `S3B ROLLBACK` (exact restore from the baseline) |
| S4b | `…144000` | `mis_correct_pack_line_v1`, `mis_g7_set_enforcement_v1`, `mis_g7_enforcement_readiness_v1` present | `S4B ROLLBACK` |
| S5 | `…145000` | primitives closed to clients; constraint trigger on the ticket table; `mis_g7_s5_baseline` 3 rows; readiness reports `core_gate = LEGACY_DWL_EDITOR_NOT_MIGRATED` | `S5 ROLLBACK` |
| S5b | `…150000` (owner-gated) | core SHA equals `dfa5a5e9aa31b48cf41fe9d03800fff2e35e5a3825ca458b5ccb6ca6c4471bcc`; wrapper `4c82b4a3…d7b4` and parser `ec5fe3ea…29db` unchanged; core still not client-executable; `mis_g7_s5b_baseline` holds the original core (`df7290df…6aec`); readiness `core_gate = CORE_MIGRATION_NOT_ACCEPTED` | `S5B ROLLBACK` |
Stop criteria at any step: any non-zero install error, any receipt mismatch, any daily logging failure reported by an operator → run that step's rollback section immediately (the install itself is transactional per migration).
Not part of this sequence: permission assignment/registration (owner governance), core sign-off (`mis_g7_record_core_migration_acceptance_v1`), ENFORCE, client release, historical backfill.

## 3. Staged rollback that PRESERVES installed S2
Production order: **S5B → S5 → S4B → S3B → S4 → S3** (six sections, each marker-delimited and independently executable; later sections refuse when an earlier one was skipped where it matters, e.g. S5 refuses while the core still calls its primitives). The sections never mention or drop `mis_sign_batch_stage_v1` / `mis_correct_batch_stage_v1`, the S2 tables, signed events, or the S2 lock helpers (S3's rollback restores their exact S2-installed ACL from `mis_g7_s3_baseline`). The `S2 ROLLBACK (ISOLATION / NEVER PRODUCTION)` section exists only for ephemeral test databases.
Tested (PostgreSQL 16, isolated): after the six sections the catalog equals the pre-S3 state (function definitions/SHA, ACL, security attributes, config, ledger ACL), S2 RPCs still sign, signed rows are retained, evidence/baseline/audit tables are retained, legacy writers behave as before.

## 4. Production-equivalent run (needs read access this repository's automation does not have)
See `supabase/tests/mis_g7/prod_equivalent/README_PROD_EQUIVALENT.md`: read-only capture of the real schema + function definitions into a LOCAL protected packet, load into an isolated database, S2 taken from the packet (installed baseline), S3→S5b applied with the real literal pins. The tooling is committed and round-trip tested; the real packet has not been captured.
