# PEC-PA-01 — Purchase Allocations reporting V1 — 2026-11-24

Production migration: `20261124134249_pec_purchase_allocations_reporting_v1.sql` (already applied to production; do not reapply). This is an additive, read-only reporting contract; no FIFO or business-data mutations. Client contract: PR #525.

## RPC contract

All five public RPCs are STABLE, SECURITY DEFINER, with pinned search path and the existing `require_permission('module:procurement-execution-console', false)` gate. Only authenticated and service_role have EXECUTE (a valid authorized identity remains necessary). The internal SECURITY INVOKER helper `_proc_pec_pa_report` is not callable by API roles. No new table grants, storage, snapshots or write paths.

Common args: p_date_from/date, p_date_to/date (required, inclusive), p_material_class_code/text, p_q/text (material name/code), p_indent_q/text (indent number), p_vendor_q/text (supplier name), p_status/text (all/allocated/partial/unallocated, default all); other filters default null. PLM aliases PM. Paged endpoints add p_limit/integer default 50 (1..200), p_offset/integer default 0 (0..100000). Trail additionally accepts p_indent_id, p_stock_item_id, p_uom_id, p_purchase_fact_id (bigint), p_vendor_key (text), all nullable. Summary returns a JSON object; four paged endpoints return row_data jsonb, total_count bigint. See exact migration for JSON keys and arguments.

Vendor keys: vendor:<mapped ID> or supplier:<source supplier name> for unmapped. Mapped suppliers are grouped by ID; representative supplier label is the minimum source label within the matching group. Unmapped names remain distinct. Receipt quantities are counted once per fact, and independently from matched allocation rows. Receipt status is based on whole-receipt allocation. A zero-effective positive receipt is included under all, not under unallocated. The trail uses row_kind=unallocated for zero-effective or unallocated receipt-only rows; clients label zero effective as returned. When indent filters apply, receipt-only rows are omitted; receipt-wide quantities remain on matching allocation rows. Accepted excess is read independently from acceptance records, including fully accepted excess.

Coverage: positive purchase facts (including fully returned receipts), with FIFO allocations for currently approved/issued indents. Return adjustment follows the existing supplier-specific FIFO effective receipt authority; negative voucher facts are not independent receipt rows. Opening/closing and period demand are reconstructed using present governed requirements, not immutable snapshots. Current balance is authoritative; period balance fields do not change with vendor/receipt filters.

## Production verification (2026-11-24)

- Historical case 169565, Kera Traders, 135 Kg: indent 84/107 = 5, 156/170 = 50, 191/198 = 80. Opening 5/50/100, closing and current 0/0/20.
- Date-wide totals: 39 positive facts, 10 affected indents, 40 affected indent lines, 55 trail rows, 34 material groups, 15 vendor groups. Kg gross/effective 9369.455, allocated 9086.463741, unallocated 282.991259; L 35/35/0; Nos 41066/30000/11066.
- Earlier 23 Nov acceptance had 9 indents, 38 lines, 8914.463741 Kg allocated. The additional 172 Kg is now allocated by the underlying FIFO authority to #247 (approved 23 Nov): serial 1 Koova Nooru: Grade 1 110 Kg, serial 2 Koduveli Kizhangu (D) 62 Kg. Both opening balances 0, new demand equals allocation, closing 0.
- Independent base FIFO query agrees. All modes and deduplicated trail reconciled per UOM, zero mismatches. Zero indent totals, balance-equation or receipt-equation mismatches.
- View-only PEC identity: all five public RPCs executed in a rolled-back transaction. Filtered Sathavari/156 summary returns whole receipt allocation 135, matched 50, excess 0. No-permission identity denied by all five. Catalog grants: no anon EXECUTE; helper no authenticated EXECUTE.
- EXPLAIN ANALYZE: 23 Nov trail 200-row limit ~1296 ms, 1–23 Nov summary ~876 ms (single observations; not a measured p95 or load test).
- Security advisor warning for authenticated SECURITY DEFINER RPCs is intentional under PEC's canonical permission gate. The gate and grants were tested. No general security audit of unrelated modules.

## Remaining gates

Client PR #525 remains draft until repository migration parity, live client contract acceptance and relevant regression checks. No authenticated browser or real Windows acceptance claimed. No release published by this migration. Synthetic isolated PG17 reporting fixture and full repeated/load performance testing were not run in this session; obtain them in integrated acceptance. Do not hard-code mutable date-wide acceptance counts into UI or fixtures.
