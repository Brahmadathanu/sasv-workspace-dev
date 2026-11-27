# MIS G7 C1/C2/C3 — stock-writer coverage and per-batch signed route authority audit

**Status:** REVIEW ONLY, 23 Nov 2026 IST; live SQL was READ ONLY; do not install. Formal G7 6/11 (~55%), G8 parked. Protect Electron v6.4.2; #485/#517 draft unmerged. No paid Supabase branch.

## Evidence-driven writer inventory

Live catalog audit: relevant SQL function bodies inspected using pg_get_functiondef, plus pg_trigger on source/ledger relations.

| Path | Installed trigger/function | Actual behavior / concurrency issue |
|---|---|---|
| Initial or corrected DWL FG stock | `trg_fg_ledger_from_dwl()` on `daily_work_log` | Inserts initial positive receipt or governed source correction; does not acquire shared transaction-scoped per-product/batch/location lock; identity and quantity changes have distinct safeguards. Do not rewrite these without understanding existing core write RPC. |
| Packaging SKU delta | `trg_fg_ledger_from_es()` on `event_skus` | Converts count × pack size × UOM conversion; silently returns when no product+batch FG ledger row; INSERT, UPDATE and DELETE all routed through same trigger. Must prevent identity/cancellation double counts and allow only trusted atomic excess. |
| Bulk-negative guard | `fn_fg_ledger_check_negative()` BEFORE ledger INSERT | Checks `SUM(qty_base)+NEW.qty_base >= 0` without shared locking; **not race-safe against concurrent commits by itself**. |
| Manual force-close | `fn_fg_force_close(integer,text,numeric)` and permission wrapper `fn_fg_force_close(integer,text)` | Locks `daily_work_log` row, not common batch/location stock identity; inserts `-current_balance` adjustment and reconciles. Must share lock with packing. No manufactured/excess source. |
| Auto-zero epsilon | `fn_fg_auto_zero(integer,text,numeric)` | Computes current batch balance then inserts correction without common shared lock. Must share lock; not an excess receipt. |
| Internal transfer | `trg_fg_bulk_internal_transfer_to_ledger()` on `fg_bulk_internal_transfer` | INSERT creates outgoing+incoming legs; UPDATE/DELETE delete and reconstruct or remove legs. No shared lock; original and destination stock identity must both be serialized in canonical order. Mutation could destroy provenance if left unconstrained. |
| Legacy helper | `fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)` | Inserts directly into FG ledger; inspect all callers and compatibility before revoking access or altering schemas. |
| DWL update RPC | `rpc_update_daily_work_log_with_packaging` + `__core` | Server writer with worklog row locking; can still lead to FG stock delta without a common batch lock; preserve legitimate identity checks. |
| Public ledger access | `fg_bulk_stock_ledger_authenticated_crud` RLS | Authenticated session permitted broad row CRUD subject to nonnull auth UID; table INSERT/UPDATE privileges exist. Must create protected path and narrow direct privilege only in coordinated authorization. |

**Common-lock requirement:** Any future stock guard must be honored by every writer above, including legacy direct DML either denied or routed through a common gate. Lock tuple must resolve product, batch and location (section, subsection, area, plant), and for a transfer lock source and destination in stable order. A row-level durable balance key (if available) is preferable to an ambiguous hash lock. If using PostgreSQL advisory lock, define collision/namespace, transaction scope, monotonic order, and replay behavior. Avoid checking cross-location batch total when packing must be at a particular location. Negative-balance sum is not an isolation mechanism. Do not install a strict packaging trigger without client and server recovery path.

## Source route authority

Inspected `costing.product_process_route`, `costing.production_route_family_route_step`, `public.bmr_details` (which has batch identity and `lifecycle_status`), and catalog table names for batch/route execution. **No separate per-batch signed product-route stage execution/completion ledger was established in the inspected schema.** This is a bounded negative discovery, not proof no information exists outside inspected tables (e.g. external documents). An approved route master, BMR existence/lifecycle status, and a generic `daily_work_log.status='Done'` **cannot be promoted** to evidence that a batch completed all required stages and signed FG bulk.

C1 candidate source contract: `product_id`, `batch_number`, route ID/version effective at execution, required stage identity (including FG bulk), event reference, measurement in compatible base UOM, actor UID, signed-at timestamp, accountable signature/approval status and immutable correction reference. Historical C3 must cite original BMR/FG weighment; no default signed-flag backfill. Final C1 schema and role authority must be approved before C2 enforcement. Approved product-route master can guide required stages but cannot itself sign execution.

## High-priority gaps / safe execution plan

1. Capture exact current writer function definitions and relevant DML grants/triggers as separate rollback baseline before any migration. Trigger rollback SHA `cc32357d...` and negative guard SHA `211a6e...` were already preserved in §76.
2. Define one trusted authoritative FG bulk stage/receipt signoff and a shared batch/location stock lock **spanning all writer paths**. Decide which existing batch signoff artifacts can be verified; do not invent per-batch completion from master.
3. Refactor legacy writer permission flow in one guarded package; test ordinary entries, force-close, auto-zero, transfer in/out update/delete, worklog corrections, pack UPDATE/DELETE and old client behavior.
4. Separate private source-backed signed-excess receipt, atomic pack/depletion and idempotent C3 historical replay. Source fingerprint and actor/evidence must be captured; NEVER simply UPDATE `event_skus` to retrigger a historical ledger row.
5. Run actual concurrent PostgreSQL session tests (two packers, packing vs force-close, same transfer source/destination, idempotent retry) and signed-in role tests before any owner deployment authorization.

**Decision:** This is a cross-writer architectural change, not a safe isolated packaging-trigger patch. No migration, database write, paid environment, PR merge or Electron release authorized. Formal G7 OPEN 6/11.
