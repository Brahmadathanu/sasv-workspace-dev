# MIS G7 C2 — Confirmed silent packaging depletion skip and bounded historical repair

**Date:** 23 November 2026 IST. **REVIEW ONLY**, not production authorization. Canonical workflow G7 OPEN 6/11. No direct repair/backfill from this document. Protect live cost runs, Electron release, draft PRs #485/#517 and unrelated dirty worktrees.

## 1. Root cause confirmed from live installed PostgreSQL

`public.event_skus` has `trg_fg_ledger_from_es` AFTER INSERT/UPDATE/DELETE, executing installed `public.trg_fg_ledger_from_es()`.

The installed trigger reads the parent packaging event, its work log and `public.event_type_lkp`. When an event is packaging and `affects_bulk_stock<>0`, it converts pack count to base UOM. **Step 6 intentionally exits without writing a bulk depletion when no `public.fg_bulk_stock_ledger` row exists for the same product and batch:**
```sql
IF NOT EXISTS (
  SELECT 1 FROM public.fg_bulk_stock_ledger
  WHERE product_id = v_prod.id AND batch_number = v_dwl.batch_number
) THEN
  RETURN COALESCE(NEW, OLD);
END IF;
```
This is the previous optional-FG-bulk-stage policy and is **incompatible with the now approved C1/C2 transition**, under which all batches must have an FG bulk stage, and packing must consume available bulk (or a separately authorized signed excess atomically). A route *master* being approved is not evidence of signed route execution. No live trigger was changed or executed during investigation.

**Reproducible live READ ONLY proof:** `MIS_G7_C2_29_SKU_SILENT_DEPLETION_ROOT_CAUSE_READONLY_20261123.sql` (commit `934d49531c3f260e4e2a9fece8ea094e2dc7c3b5`) yielded all **29 unlinked packing SKU lines** in two categories:

| Event type | Lines | Recorded SKU pack units | No product/batch ledger | Approved route master effective at log date |
|---|---:|---:|---:|---:|
| Bottling, labelling and cartoning | 26 | 12,929 | 26 | 6 |
| Capsule monocarton packing | 3 | 2,470 | 3 | 3 |
| **Total** | **29** | **15,399** | **29** | **9** |

All 29 refer to active lookup labels with `is_packaging=true`, `affects_bulk_stock=-1`; none is an exempt non-bulk event. All are `daily_work_log.status='Done'`, but **none has an exact product+batch bulk ledger row anywhere in the inspected source**. All have nonempty batch numbers. Across categories there are **20 distinct product+batch combinations** and 20 products (same product/batch can have more than one packing event). The affected packaging event dates are within Nov1–21 IST; four linked work logs have earlier log dates (including Oct/Sept), so do not collapse event chronology into log_date.

At the date of related work log, **9 of 29** SKU lines have an effective approved route master, **20 of 29** do not. Those nine belong to Vallarai Tablet (4), Rejuliv Forte Capsule (2), Vazhaipoo Vatakam (2) and Neerkovai Tablet (1). These are route master assignments only, not per-batch sign-off. No product/batch-level bulk stock is evidenced, even when another batch of the product has had a stock receipt.

**Important units:** 15,399 is a sum of SKU unit counts across different pack sizes and products, not 15,399 grams, litres, packs of uniform size, manufacturing output or cost. Do not automatically backfill 15,399 as base stock. A later source-backed calculation must use the exact SKU pack size, UOM conversion, physical evidence and prior signed receipt/stock history.

## 2. No blanket or inferred automatic historical backfill

**C3 bounded evidence-first sequence:**
1. Export a private *read-only* exception register with `event_sku_id`, `packaging_event_id`, `work_log_id`, product, batch, SKU, pack count, unit/pack-size and time; use source identity and fingerprint to guard against later edits. Restrict actor/personnel details.
2. For each affected product/batch, collect historical BMR/FG bulk completion, laboratory release, weighment/volume and physical FG stock evidence; verify product route relevant to that production date. Distinguish true missing bulk receipt, separate multi-stage packaging events, corrections, repacks and source timing.
3. Calculate base quantity per compatible product/batch/UOM **only when physical documentation supports it**. Preserve evidence reference, signoff actor/time, reason and original source IDs. Do not infer manufacturing amount from aggregated packaging counts or a Tally FG transfer.
4. With explicit owner authorization, insert a **governed historical FG bulk receipt/correction** only after source-backed acceptance, then reconcile packaging consumption using an idempotent replayer, never by blind UPDATE of event_skus (which could duplicate movements) or silently rewriting signed source.
5. Flag unresolved historic rows as `MISSING_FG_BULK_SOURCE_EVIDENCE`, not fabricated zero or completed production. Reconciliation must prove no duplicate events, correct UOM, same batch, and no negative stock outside controlled signed exceptions. Maintain old report versions and source fingerprints; corrected S3 yields an explicit new revision.
6. Pilot a very small approved set on a separately authorized install/test gate with reversibility and identity/amount ledger before expanding; no batch-wide autogeneration on this review.

## 3. Future C1/C2 enforcement and authorized excess modal

**New packing gate** replaces the current silent return. Every pack-affecting SKU line must reference an actual signed FG bulk stage/receipt, product+batch+location and physically available base quantity. If the batch has no FG bulk, fail with `MISSING_FG_BULK_STAGE`; do not silently skip depletion.

If requested packaging exceeds available base stock:
- For ordinary authorized pack operation, return bounded `INSUFFICIENT_BULK` and offer a controlled **in-page modal** only when the authenticated user has the separately governed excess-adjustment permission.
- In the modal record the **actual measured extra bulk quantity** and compatible UOM, reason, evidence, actor and batch identity. The server uses a single transaction with appropriate row locking and stale-balance checking: commit signed excess ledger entry **then** actual packing depletion as one atomic operation. On failed validation/depletion, roll back both.
- No unsigned override, negative or inferred excess; excess does not by itself mean manufactured output or a signed C1 production completion. No permission is derived from the client saying it is authorized. Physical validation/stock claims stay separate from package count and Tally money.
- Existing `fn_fg_force_close` and `fn_fg_auto_zero` ledger movements are never interpreted as authorized extra FG bulk.

**Synthetic enforcement proof:** `MIS_G7_C2_PACKING_BULK_ENFORCEMENT_NEGATIVE_FIXTURES_READONLY_20261123.sql` (commit `740c19249d86f564cd2249fe93f64d56d8785cfb`) passed **9/9** PostgreSQL READ ONLY cases: exempt activity, regular covered packing, missing signed FG bulk, insufficient stock, unsigned excess, signed atomic excess, still-insufficient after excess, excess without FG stage, and negative quantity. This is *decision policy testing*, NOT a compiled trigger, live client modal or true concurrent/permission test.

## 4. Source-specific installation constraints, still open

- Existing trigger's old/NEW delta logic must be independently audited for UPDATE/DELETE semantics, replayer idempotency and historic adjustments. The current installed step 6 only checks existence, **not sufficiency**, and silently skips on nonexistent batch. A future writer must not silently allow negative stock.
- Trigger needs permission-safe wrapper/transaction design; no partial packaging INSERT, excess receipt, or work-log Done state upon failure. Avoid breaking legitimate packaging stages (e.g., those marked `affects_bulk_stock=0`) and any queued in-progress records.
- Check composite batch identity and location; avoid cross-product batch collision and cross-unit arithmetic. Route master version/effective date alone is not signed batch execution.
- Preserve current Electron/PWA behavior until a separately released client supports the authorized in-page excess workflow and error/status semantics. Do not deploy server-only strict gate that breaks packaging entry UX.
- Before installation: exact live rollback body, isolated PostgreSQL compile, negative signed-in auth/RLS, concurrent stock-depletion tests, source-backed C3 backfill pilot signoff, p95, and explicit owner authorization. No paid Supabase branch.

**Status:** root-cause analysis **closed as evidence**; C1/C2/C3 actual implementation **OPEN**. Formal G7 OPEN 6/11, G8 parked, #485/#517 draft/unmerged. No production DDL/DML, ETL/costing modifications or Electron release.
