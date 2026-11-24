# MIS G7 server acceptance package (S2–S5, draft PR #522)

Status: **review/acceptance package. Nothing here is applied to any database.** Owner remains production authority.
Scope kept: stage-first accounting (`product_id + exact batch_number`, BMR link, versioned route, mandatory signed FG bulk stage before packing, SKU pack-size → base-UOM), atomic separately-authorized measured excess, location NOT a gate. Not touched: `get_mis_production_value_summary`, PRs #485/#517, the five PEC migrations.

## 1. Apply order (owner-authorized, separately per step)
| # | Migration | What it does | Reversible by |
|---|---|---|---|
| 1 | `20261123140000_…s2_signed_batch_stage_events` | append-only signed stage events + corrections, route/BMR resolver, lock primitives, `mis_sign_batch_stage_v1`, `mis_correct_batch_stage_v1` | rollback §S2–S4 |
| 2 | `20261123141000_…s3_fg_ledger_shared_batch_lock` | `00_mis_g7_fg_batch_lock` ledger trigger (batch advisory lock for every writer) | rollback §S2–S4 |
| 3 | `20261123142000_…s4_atomic_pack_with_measured_excess` | `mis_pack_fg_bulk_v1`, excess/request/ticket tables | rollback §S2–S4 |
| 4 | `20261123143000_…s3b_protected_stock_write_boundary` | **fail-closed** pre-checks (11 pinned SHAs, resolved caller graph), 11-function chain → SECURITY DEFINER, helper EXECUTE closed, `fn_fg_mark_done_if_zero` → closed legacy body + wrapper, ledger DML revoked, AUDIT/ENFORCE gate | rollback §S3B (baseline-driven) |
| 5 | `20261123144000_…s4b_ticketed_pack_corrections_and_enforcement_control` | `mis_correct_pack_line_v1` (ticketed correction), logged `mis_g7_set_enforcement_v1`, `mis_g7_enforcement_readiness_v1` | rollback §S4B |

| 6 | `20261123145000_…s5_legacy_dwl_editor_chain_protection` | private begin/finish primitives for the governed legacy DWL editor core (work-log-scoped ticket, stage + conservation verification, deferred must-finish trigger), ENFORCE readiness gate (`LEGACY_DWL_EDITOR_NOT_MIGRATED` / `CORE_MIGRATION_NOT_ACCEPTED`), owner sign-off RPC bound to the core's exact SHA | rollback §S5 |

Rollback order: **S5 → S4B → S3B → S2–S4** (`ROLLBACK_NOT_A_MIGRATION.sql`, marker-delimited, each section independently executable; signed history and all logs are retained).

## 2. Live baselines (exact)
`LIVE_BASELINE_MANIFEST.json` pins the SHA-256 of `pg_get_functiondef` for 11 live functions (the six writers, `fn_fg_reconcile_batch`, three reconcile statement triggers, `fn_fg_mark_done_if_zero`). The same values are pinned (a) in migration 4, (b) in `S3B_PREINSTALL_LIVE_CHECK_READONLY.sql` (17 rows; independently executed against production: **17/17 TRUE** at head `9788a95`), (c) asserted equal by a test. Live facts used: `event_type` citext, `event_type_lkp.label` text, bigint packaging/SKU ids, ledger `source_id` integer, `fn_fg_eps_default()` = 0.01, force-close wrapper permission `module:fg-bulk-stock`, `affects_bulk_stock` −1 = depletion. Migration 4 also persists full original source + SHA + ACL/secdef/config of all 11 into `app_private.mis_g7_s3b_baseline`.
**Deployment prerequisite:** retain full original function sources and ACL/RLS snapshots in an owner-governed immutable packet *before* install.

## 3. What ENFORCE needs, and what this package adds
ENFORCE denies direct bulk-affecting `event_skus` INSERT/UPDATE/DELETE and header reassign/retype/delete unless made by a ticketed RPC in the same transaction. Governed alternatives now exist for both write paths: `mis_pack_fg_bulk_v1` (new lines, with measured excess) and `mis_correct_pack_line_v1` (change count / remove a line, with measured excess when a correction increases consumption beyond stock). A correction never fabricates stock: a line without its original depletion (e.g. the historical 29 missing-depletion lines) or with a tampered ledger is refused (`CORRECTION_NO_DEPLETION_BASIS` / `CORRECTION_LEDGER_MISMATCH`); batches without a signed, un-drifted FG stage are refused (`FG_STAGE_NOT_SIGNED` / `STAGE_SOURCE_CHANGED`, `historical_state: NOT_VERIFIED`). Mode changes go through `mis_g7_set_enforcement_v1` (separate admin permission, reason required, append-only log; ENFORCE refused if the correction path is missing); `mis_g7_enforcement_readiness_v1` reports direct legacy writes captured by AUDIT logging so the owner can see whether old clients still write directly. Default remains **AUDIT** (old clients unchanged, direct writes logged with actor/op/txid).

## 3b. Legacy governed editor (`rpc_update_daily_work_log_with_packaging` + `__core`) — S5
Live facts (independent review): the wrapper is SECURITY DEFINER (`module:edit-log-entry`, edit); `__core` (SECURITY DEFINER, not executable by authenticated, live SHA-256 `df7290df…6aec`) **deletes the work log's `event_skus` and `packaging_events` header(s), recreates them from `sku_breakdown`, deletes the whole chain when the row stops being Done/packaging**, applies governed FG source-quantity deltas and reconciles. Its source is **not** in this branch, so **PR #522 does not modify either function**. Consequences and handling:
- **AUDIT (default): unchanged.** The editor works exactly as today (tested end-to-end on the shim reconstruction: create / replace / add / remove / retype / delete-chain, rollback on insufficient stock, FG delta). Direct writes are logged. Documented hazard (tested): the legacy delete of a line that was never depleted returns stock that was never consumed.
- **ENFORCE fails closed.** `mis_g7_set_enforcement_v1('ENFORCE')` is refused with `LEGACY_DWL_EDITOR_NOT_FOUND` / `LEGACY_DWL_EDITOR_NOT_MIGRATED` unless the live core calls both S5 primitives, and `CORE_MIGRATION_NOT_ACCEPTED` unless an owner sign-off (`mis_g7_record_core_migration_acceptance_v1`, separate permission, bound to the core's exact current SHA-256) exists. Any later change to the core re-blocks (readiness shows `core_gate`).
- **How a reviewed core is migrated (after its source is reviewed):** call `app_private.mis_g7_chain_replace_begin(work_log_id)` right after the row lock and `app_private.mis_g7_chain_replace_finish(work_log_id)` after the last write. Begin takes the batch lock and opens a ticket scoped to that work log and transaction (no general bypass; tested that it does not authorize another work log, and that clients cannot call/forge it). Finish verifies, atomically with the edit: signed + un-drifted FG stage when any bulk-affecting line exists before/after (`MIS_G7_CHAIN_STAGE_NOT_SIGNED` / `…_SOURCE_CHANGED`), **FG stock conservation** (ledger movements of all old+new lines net to exactly the new depletion; a never-depleted historical line cannot manufacture stock: `MIS_G7_CHAIN_CONSERVATION_MISMATCH`), balance ≥ 0. A deferred constraint trigger refuses to commit a ticket that was never finished (`MIS_G7_CHAIN_REPLACE_NOT_FINISHED`). `tests/02_reference_migrated_core.sql` is the reference shape used by the tests.
- Verify before any core review: `CORE_PREINSTALL_LIVE_CHECK_READONLY.sql` (core SHA, ACLs, delete/recreate present, not yet migrated).

## 4. Permission targets (none registered or granted by any migration)
| Target | Used by |
|---|---|
| `module:mis-batch-stage-signer` | sign / correct stage |
| `module:mis-fg-bulk-packing` | pack, correct line |
| `module:mis-fg-excess-adjustment` | measured excess (separate authority) |
| `module:fg-bulk-stock` | `fn_fg_mark_done_if_zero` wrapper (same as installed force-close wrapper); `service_role` DB role also allowed |
| `module:mis-g7-enforcement-admin` | mode switch (edit), readiness (view) |
| `module:mis-g7-core-migration-signoff` | owner sign-off of a migrated legacy DWL editor core (bound to its SHA) |
| `module:edit-log-entry` (existing) | legacy DWL editor wrapper (unchanged) |
Registration/assignment in `user_permissions_canonical` (`user_id, target, can_view, can_edit, meta`) is an owner action; live `require_permission` semantics (can_view, plus can_edit when edit is required) are now modelled by the shim and tested (view-only admin reads readiness but cannot switch; view-only editor cannot use the DWL editor).

## 5. Test receipts (local PostgreSQL 16, ephemeral cluster, production-shaped shim — NOT the live catalog)
`npm run test:mis-g7` → main suite 68 tests (67 pass, 1 BLOCKED-skip) + acceptance suite 27/27 pass = 94 pass, 0 fail, 1 BLOCKED. Coverage added in this round: ticketed corrections (decrease/increase/remove, insufficient + excess, atomic rollback, refusals, concurrency), ENFORCE end-to-end with logged switch, legacy AUDIT logging compatibility + readiness report, a 7-RPC × 7-role permission matrix, client-contract ↔ catalog bidirectional check, baseline manifest ↔ migration ↔ read-only script consistency, fresh-chain install, and full reverse rollback proving exact restoration of the 11 chain functions' definitions/ACLs. Earlier rounds' tests (S2 signer, pack, S3 locks/races, S3b chain, mark-done wrapper) are retained unchanged.
**BLOCKED / not proven:** live compile and live role/JWT run; the shim wrapper/core are reconstructions of the described behavior (argument list and `sku_breakdown` format assumed; live wrapper SHA not yet captured); external (non-DB) callers of `fn_fg_mark_done_if_zero`; the real core has not been migrated or tested.

## 6. Deployment blockers (owner/live)
1. Retain the full live source/ACL/RLS packet of the 11 functions; rerun the exact read-only precheck immediately before install (must be 17/17).
2. **ENFORCE blocker (now machine-enforced):** the live editor core must be reviewed from its actual source and migrated to the S5 primitives, then signed off by the owner for its exact SHA; until then ENFORCE is refused (`LEGACY_DWL_EDITOR_NOT_MIGRATED`). Also capture the live wrapper's SHA and the exact `sku_breakdown` grammar. Readiness data should show no direct writes outside the editor first. A server AUDIT release can be considered separately from any ENFORCE release.
3. Register and assign the five permission targets (owner governance); verify `require_permission` edit/view semantics against the live function.
4. Client work (separate package, after server acceptance): excess modal and correction UI against the contract below; PWA/Electron versioned release; old clients keep working in AUDIT.
5. Opposite-order multi-row ledger statements can deadlock: retry on 40P01/40001 (max 3). Headers created by the legacy path are not gated until they carry lines.
6. Historical unsigned/uncovered batches (S1: 34 products / 11 FG-stage gaps) stay NOT_VERIFIED and cannot use the new RPCs; route-master correction remains a separate governed queue. The 29 missing-depletion lines remain a separate evidence-first repair (no backfill here).
7. Formal G7 gate status is the owner's; this package does not close it.

## 7. Client RPC contract
Authoritative machine-readable form: `client_rpc_contract.json` (verified against the catalog by test). Summary:

| RPC | Arguments | Success keys | Refusal codes (HTTP 200, nothing written) |
|---|---|---|---|
| `mis_sign_batch_stage_v1` | idempotency key uuid, product, batch, work log, route step, occurrence, measured qty (base), evidence | `event_id, stage_role, route_id, bmr_id, source_fingerprint` | route/BMR resolver codes, `STAGE_ALREADY_SIGNED`, `MEASURED_QTY_REQUIRED/MISMATCH`, `FG_UOM_MISMATCH`, `FG_RECEIPT_EVIDENCE_MISSING`, `IDEMPOTENCY_KEY_REUSED`, `INVALID_INPUT` |
| `mis_correct_batch_stage_v1` | key, event id, reason | `event_id, corrects_event_id` | `EVENT_NOT_FOUND, ALREADY_CORRECTED, ONLY_SIGN_CAN_BE_CORRECTED, …` |
| `mis_pack_fg_bulk_v1` | request id, packaging event id, `[{sku_id,count}]`, optional excess `{qty_base,evidence_ref,reason}` | `required_base, available_before_base, excess_base, excess_id, balance_after_base, event_sku_ids` | stage/receipt/SKU/event codes, `INSUFFICIENT_BULK{required,available,shortfall,base_uom,excess_permitted}`, `EXCESS_*`, `INSUFFICIENT_AFTER_EXCESS` |
| `mis_correct_pack_line_v1` | request id, event_sku id, new count (≥0; 0 removes), reason, optional excess | `old_count, new_count, line_removed, stock_delta_base, excess_base, balance_after_base` | as pack plus `CORRECTION_LINE_NOT_FOUND/CHANGED, CORRECTION_NO_CHANGE, CORRECTION_NO_DEPLETION_BASIS, CORRECTION_LEDGER_MISMATCH` |
| `fn_fg_mark_done_if_zero` | product, batch, eps (≤ `fn_fg_eps_default()`, NULL passthrough) | void | raises `MIS_G7_EPS_OUT_OF_RANGE`, `MIS_G7_INVALID_INPUT` |
| `mis_g7_set_enforcement_v1` | mode `AUDIT`\|`ENFORCE`, reason | `from_mode, mode` | `INVALID_INPUT, MODE_UNCHANGED, CORRECTION_PATH_NOT_INSTALLED, LEGACY_DWL_EDITOR_NOT_FOUND, LEGACY_DWL_EDITOR_NOT_MIGRATED, CORE_MIGRATION_NOT_ACCEPTED` |
| `mis_g7_enforcement_readiness_v1` | days (1–365) | `mode, core_gate, direct_writes[], ticketed_*, chain_replacements` | — |
| `mis_g7_record_core_migration_acceptance_v1` | core SHA-256, evidence ref | `core_sha` | `INVALID_INPUT, LEGACY_DWL_EDITOR_NOT_FOUND, CORE_SHA_MISMATCH, LEGACY_DWL_EDITOR_NOT_MIGRATED, ALREADY_ACCEPTED` |

Rules for clients: one UUID per user intent; show the excess modal only after `INSUFFICIENT_BULK` with `excess_permitted:true`; never send authorization flags; treat `idempotent_replay:true` as success; retry only on SQLSTATE `40P01`/`40001`; raised errors (`42501`, `MIS_G7_*`) mean the whole transaction rolled back; no hard-coded theme palette is implied.
