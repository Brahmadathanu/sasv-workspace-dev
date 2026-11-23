# MIS G7 S2–S4 server package (draft; not applied, not deployed)

Issue #521. Base `62b1f12c` (= `origin/main`, v6.4.2). Workflow reference: PR #485 (`docs/executive-mis-workflow-20261119`, §83). #485/#517 untouched.
`public.get_mis_production_value_summary(date,date)` is not referenced or modified.

## Migrations (apply in order; new files only, no installed migration edited)
1. `20261123140000_mis_g7_s2_signed_batch_stage_events.sql` – append-only `app_private.mis_batch_stage_event` (SIGN + CORRECTION), route/BMR resolver, shared lock primitives, `mis_sign_batch_stage_v1`, `mis_correct_batch_stage_v1`.
2. `20261123141000_mis_g7_s3_fg_ledger_shared_batch_lock.sql` – common BEFORE trigger `00_mis_g7_fg_batch_lock` on `fg_bulk_stock_ledger` (every writer, INSERT/UPDATE/DELETE) taking `product_id + exact batch_number` advisory xact lock.
3. `20261123142000_mis_g7_s4_atomic_pack_with_measured_excess.sql` – excess receipt + request tables (append-only), `mis_pack_fg_bulk_v1`.
Dependencies not created here: legacy tables/triggers, `public.require_permission(text,boolean)`, `auth.uid()`, `costing.*` route tables (columns used: see resolver). Rollback: `ROLLBACK_NOT_A_MIGRATION.sql` (keeps signed history).

## Permissions (new targets; owner must register/assign — NOT granted by migrations)
`module:mis-batch-stage-signer`, `module:mis-fg-bulk-packing`, `module:mis-fg-excess-adjustment`. Checked with `require_permission(target,true)`; actor is always `auth.uid()`.

## Client integration contract (for the later single excess-modal package)
`public.mis_pack_fg_bulk_v1(p_request_id uuid, p_packaging_event_id int, p_lines jsonb, p_excess jsonb default null) -> jsonb`
- `p_lines`: `[{"sku_id":int,"count":int>0}]`, unique sku_id. `p_excess` (only after an `INSUFFICIENT_BULK` with `excess_permitted:true`): `{"qty_base":number>0,"evidence_ref":text,"reason":text}`; any other key (e.g. "authorized") is ignored.
- Retry with the same `p_request_id` and payload returns the stored result with `idempotent_replay:true`; same id, different payload → `IDEMPOTENCY_KEY_REUSED`. Generate a UUID per user intent.
- Success: `{ok:true, idempotent_replay, request_id, product_id, batch_number, packaging_event_id, required_base, available_before_base, excess_base, excess_id, balance_after_base, base_uom, event_sku_ids[]}`.
- Refusal (HTTP 200, `ok:false`, nothing written): `INVALID_INPUT, IDEMPOTENCY_KEY_REUSED, PACKAGING_EVENT_NOT_FOUND, BATCH_IDENTITY_MISSING, EVENT_NOT_BULK_AFFECTING, EVENT_NOT_DEPLETING, FG_STAGE_NOT_SIGNED (+historical_state NOT_VERIFIED), FG_RECEIPT_MISSING, SKU_NOT_FOUND, SKU_PRODUCT_MISMATCH, SKU_PACK_SIZE_INVALID, SKU_CONVERSION_INVALID, SKU_LINE_EXISTS, INSUFFICIENT_BULK {required_base, available_base, shortfall_base, base_uom, excess_permitted}, INSUFFICIENT_AFTER_EXCESS, EXCESS_INVALID, EXCESS_NOT_AUTHORIZED, EXCESS_NOT_NEEDED`.
- Raised errors: SQLSTATE `42501` permission denied / `MIS_G7_AUTH_REQUIRED`; `MIS_G7_DEPLETION_MISMATCH`, `MIS_G7_NEGATIVE_BALANCE` (whole transaction rolled back).
- Signer: `mis_sign_batch_stage_v1(p_idempotency_key uuid, p_product_id int, p_batch_number text, p_work_log_id int, p_route_step_id bigint, p_step_occurrence int, p_measured_qty_base numeric, p_evidence_ref text)`; codes `PRODUCT_ROUTE_COVERAGE, EFFECTIVE_DATE_ROUTE_GAP, APPROVED_ROUTE_OVERLAP, MANDATORY_FG_STAGE_GAP, BMR_IDENTITY_REVIEW, WORK_LOG_IDENTITY_MISMATCH, STEP_NOT_IN_EFFECTIVE_ROUTE, ACTIVITY_STEP_MISMATCH, MEASURED_QTY_REQUIRED, STAGE_ALREADY_SIGNED, IDEMPOTENCY_KEY_REUSED`. Correction: `mis_correct_batch_stage_v1(key, event_id, reason)`.
- UI: no theme palette dependency; legacy direct writes remain for old clients.

## Behavior notes / compatibility
- Old clients keep the legacy path unchanged (legacy trigger bodies not replaced; silent-skip still exists on the legacy path — only the new RPC defends against it). Historical unsigned/uncovered batches stay visible as NOT_VERIFIED and cannot use the new RPC until a route correction + real signature exist (S1 queue: 34 products / 11 FG-stage gaps stays a separate route-master governance task).
- Location is not used as a gate; excess/ledger rows written by the RPC leave location NULL.

## Tests (`node --test supabase/tests/mis_g7/*.test.mjs`)
Real local PostgreSQL 16 (ephemeral cluster, no Supabase): 21 DB tests pass incl. concurrent sessions; 3 offline policy tests pass. See PR body for the list and BLOCKED items.
