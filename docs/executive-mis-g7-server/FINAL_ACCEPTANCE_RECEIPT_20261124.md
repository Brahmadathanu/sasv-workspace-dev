# MIS G7 — final server acceptance receipt (24 Nov 2026 IST) — PRODUCTION-EQUIVALENT PARTS NOT EXECUTED (see §1)

Branch `claude/elegant-mccarthy-uunr4q`, PR #522 (draft), Issue #521. Base `main` 62b1f12c51eee3c3e3d06990f1577ec7981da0f4. Nothing in this package touched production, merged, activated ENFORCE, back-filled history, changed Costing/PEC or released Electron. **G7 OPEN 6/11 (~55%); G8 parked.**

## 1. What could and could not be done in this session (genuine blockers)
| Requirement | Result |
|---|---|
| A. Capture live definitions/ACLs/RLS/triggers from production (read-only) | **NOT EXECUTED — BLOCKER.** This automation has no Supabase connector, no database credential and no route to the database host (HTTPS probe to the project and DB hosts failed; no `ListConnectors` Supabase entry). Delivered instead: committed read-only capture tooling (`prod_equivalent/capture_live_baseline_READONLY.sh` + `capture_queries.sql`: schema-only `pg_dump` + catalog JSON, no row data/identities/credentials, output git-ignored under `.local/`), a loader that builds an isolated database from the packet (S2 taken from the packet as the *installed* baseline, never replayed; S3→S5b applied with the **real literal pins, no seeding**) and a round-trip test. **ChatGPT/owner must run the capture with read-only access (pg_dump major = server major, production 17.x) and then run `MIS_G7_BASELINE_DIR=… npm run test:mis-g7:prod-equivalent`.** Business-flow fixtures against the real schema are authored after the first real capture (placeholder fails loudly in that mode; labelled BLOCKED in self-test).|
| PostgreSQL 17.4 | **NOT RUN.** Free 17.4 server binaries exist on the npm registry (`@embedded-postgres/linux-x64@17.4.0-beta.15`) and were downloaded to a scratch directory, but executing the downloaded third-party binary was refused by this environment's safety policy and was not worked around. All results below are **PostgreSQL 16.15**. Version-dependent uncertainty: `pg_get_functiondef` text formatting (mitigated: the three exact live editor functions installed from the committed production source hash identically to the production SHA-256 values, which were produced by 17.x), planner/lock timing, `acldefault` output. |
| B. Integration acceptance on the real catalog | Executed only against the production-shaped **shim** (exact live source for wrapper/core/parser; every other function/table/ACL still reconstructed). Not equivalent to production parity. |
| C. Migration tracking | **Done:** `MIGRATION_DEPLOYMENT_MAP.md`, `MIGRATION_IDENTITIES.json` (checked by test), S2-preserving staged rollback (tested). |

## 2. Migration identities (all seven; files unchanged except S3, which gained the helper-ACL baseline — S2 is byte-identical to the installed blob)
| # | File | SHA-256 | git blob SHA-1 | bytes | Registered version |
|---|---|---|---|---|---|
| 1 | `20261123140000_mis_g7_s2_signed_batch_stage_events.sql` | `a70ae4a41bf9063803e50496e76b5ccb922251dc3fd8b551a0f041f8a95c0131` | `055b1cdfa1c8be970939f57e7e866f126ec55f03` | 21644 | 20261124055734 |
| 2 | `20261123141000_mis_g7_s3_fg_ledger_shared_batch_lock.sql` | `ac8813aaef7b0621bc9f1a28127e11f3cf62d04abeae297402a0eac1020c9b33` | `3f2ce1bc3dae699956f6c000c68d854c492d1418` | 3946 | assigned at apply |
| 3 | `20261123142000_mis_g7_s4_atomic_pack_with_measured_excess.sql` | `c1f4648a5921203f8a28aaa5708d0f25af41aa01b8903d82c7e8675ee25d38de` | `f0d3bef001c3d8e38d3e16bdf5c64f7f1f15f89b` | 14737 | assigned at apply |
| 4 | `20261123143000_mis_g7_s3b_protected_stock_write_boundary.sql` | `7c4cd12b9bdb5703d8023750d506387f6e8e259040309d284119ef14b65cefde` | `df014d2ab2c7e7652bcde26bffb0b93057ef2823` | 23077 | assigned at apply |
| 5 | `20261123144000_mis_g7_s4b_ticketed_pack_corrections_and_enforcement_control.sql` | `dc0c97b0afd4aeae77cd1c40ec3dc7637d7628a39db4e56a2391202b9af87a3c` | `4866c3db314ba0702485a8244e071828015e6a9d` | 18631 | assigned at apply |
| 6 | `20261123145000_mis_g7_s5_legacy_dwl_editor_chain_protection.sql` | `e38615b25f20a41a643b2670a1d3df46e1c2e99185f87241c07d8a0a762173a0` | `0c437af48514f4f191e25037614360a1376c7935` | 26673 | assigned at apply |
| 7 | `20261123150000_mis_g7_s5b_legacy_dwl_editor_core_integration.sql` | `4dee96b7784e7196132db47f2bfaf0bff44e595645e9c5e676b79a48d727e56d` | `642126f850a264f992c266f286e87c9bcce910cc` | 13668 | assigned at apply |

Patched core (S5b) SHA-256: `dfa5a5e9aa31b48cf41fe9d03800fff2e35e5a3825ca458b5ccb6ca6c4471bcc` — produced by S5b and asserted by test (ENFORCE still refused until sign-off).

## 3. Exact-source parity evidence (against production-produced SHA-256 values)
Installed verbatim from `LIVE_DWL_EDITOR_REFERENCE_ONLY_20261124.md` and asserted equal: wrapper `4c82b4a3263f3f868e8ac4dc696f5b68efd58e593fe4adb4d92a7ec7fb1bd7b4`, core `df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec`, parser `ec5fe3ead3e839d4ccad6c9f7e37c5775e1299c0b46ad71cc9a6b9eb7c5b29db`. Pinned (fail-closed in S3b) but **reconstructed in the shim, so not source-parity-tested**: the other eight of the eleven pins (`fn_fg_auto_zero 705fecd3…`, `fn_fg_force_close c48578e7…`, `fn_fg_ledger_add 9b9a1a49…`, `trg_fg_bulk_internal_transfer_to_ledger 6adab6d8…`, `trg_fg_ledger_from_dwl ffe12985…`, `trg_fg_ledger_from_es cc32357d…`, reconcile triggers `d4cdfe3d…/a298bcff…/d09789ba…`, `fn_fg_reconcile_batch b229faad…`, `fn_fg_mark_done_if_zero 278f4fdc…`). Their live definitions, the negative-balance guard, force-close wrapper, epsilon function, permission resolver, table structures/RLS/trigger order remain **unverified until the capture in §1 is run**.

## 4. Test receipts (PostgreSQL 16.15, free ephemeral cluster) — `npm run test:mis-g7`
| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `mis_g7_pg` (main, S2–S5 on shim) + `g7_policy` (offline) | 68 | 67 | 0 | 1 (BLOCKED: live compile / live role run / early-lock force-close wrappers) |
| `mis_g7_acceptance_pg` | 21 | 21 | 0 | 0 |
| `mis_g7_live_editor_pg` (exact live wrapper/core/parser) | 21 | 21 | 0 | 0 |
| `prod_equivalent` (PIPELINE SELF-TEST, stand-in) | 5 | 4 | 0 | 1 (BLOCKED: real-schema business-flow fixtures) |
| **Total** | **115** | **113** | **0** | **2** |
New in this package: S3 helper-ACL baseline; **S3 removes authenticated/anon/PUBLIC EXECUTE on both S2 advisory-lock helpers** (verified before/after; S3 refuses without S2; S2 sign/correct RPCs, the ledger trigger and the correction RPC keep working as owner/definer); staged rollback in production order **preserving installed S2** (S2 RPCs still sign afterwards, signed history and all evidence tables retained, helper ACL restored exactly); isolation-only S2 section; migration identity test; pipeline self-test.

## 5. Acceptance matrices (shim; see the suites for the individual cases)
- **Roles/permissions** (`PERMISSION MATRIX` test: 9 RPCs × 10 identities — anon, no-permission, signer, packer, pack+excess, admin, view-only admin, view-only editor, core sign-off, service_role; live `can_view`/`can_edit` semantics modelled): each RPC executes only for its intended authority; view-only users read readiness but cannot switch/edit; anon/no-subject denied; client authorization flags ignored; core, primitives and tickets unreachable by clients.
- **AUDIT compatibility**: old-client DWL/packaging/transfer writes proceed unchanged and are logged (actor/op/txid); the exact live editor behaves identically on the original and patched core for the same edit script; violations of S5 rules are recorded, never blocking, in AUDIT.
- **Stock conservation / concurrency**: concurrent packers, pack vs force-close, pack vs transfer, corrections vs corrections/packs, editor replacement vs pack, identical request ids, opposite-order batch moves (canonical lock order, no deadlock), mixed cross-batch workload; documented limitation: opposite-order multi-row ledger statements can deadlock (PostgreSQL aborts one fully; bounded retry on 40P01/40001 tested).
- **Rollback**: S5B→S5→S4B→S3B→S4→S3 restores the pre-S3 catalog exactly (SHA, ACL, security attribute, config, ledger ACL) and keeps S2 working.

## 6. Unresolved production blockers (all owner/ChatGPT-side)
1. Run the read-only capture (§1) and the production-equivalent test; author real-schema fixtures; port the business flows; fix any defect it exposes. Until then S3/S3b/S5b remain **not production-equivalent accepted**.
2. Rerun `S3B_PREINSTALL_LIVE_CHECK_READONLY.sql` (17/17) and `CORE_PREINSTALL_LIVE_CHECK_READONLY.sql` (7/7) immediately before S3b/S5b; retain the immutable source/ACL/RLS/trigger packet.
3. Owner decision on S5b semantics (live default `plpgsql.variable_conflict = error`: replacing/removing an existing chain raises today; works after the function-local directive).
4. Permission targets (five new) unregistered; core sign-off; re-sign workflow after FG receipt revisions; handling of the 29 missing-depletion lines and unsigned batches; ENFORCE stays blocked; S1 route gaps; client package after server acceptance.
