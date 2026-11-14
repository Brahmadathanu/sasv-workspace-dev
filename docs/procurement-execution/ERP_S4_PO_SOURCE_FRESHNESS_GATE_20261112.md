> **SUPERSEDED AS A DEPENDENCY — OWNER DECISION, 12 NOV 2026.** Tally purchase-order snapshots are **not used in the current SASV workflow and must not be used for S4 calculation, eligibility, gating, or reconciliation**. This document is retained as historical investigation only, not as a work request to restore or integrate PO feeds. The governing S4 commitment input is the existing approved/issued indent lifecycle and unfulfilled quantities from `v_proc_indent_line_balance`. Do not block S4 PR calculations on missing PO, ETA or vendor acknowledgment. See the owner decision appended below.

# PEC S4 — Purchase-order freshness and actionable-indent evidence gate

**Investigation:** 2026-11-12 IST · master #284 · S4 #305. Read-only Supabase evidence, no production writes.

## Existing authoritative-source discovery

The live database contains `public.tally_purchase_orders_snapshot`, with columns:
`as_of_date`, `order_date_text`, `order_no`, `tally_item_name`, `pending_qty_value`, `estimate_value`, `source_key`, `inserted_at`.

Read-only counts:
- 12,753 historical snapshot rows overall.
- **Latest `as_of_date` = 2025-11-04; 227 rows at latest watermark.**
- Current investigation = 2026-11-12; the source is more than one year old and not sufficiently fresh to establish current undelivered orders or ETA.
- Two Panchasara (item 733) aliases mapped by `inv_stock_item_alias` at that *historical* latest snapshot: PO `25-26/069` dated 2025-05-27, pending 3,750 Kg; PO `25-26/175` dated 2025-08-22, pending 3,350 Kg. **Do NOT interpret these quantities as current outstanding commitment**. This table does not expose expected-delivery date or a confirmed link to `proc_indent_line`; matching by item alone would be unjustified.

Separately verified:
- `v_proc_indent_line_balance` for Panchasara has three old approved indents #118/#156/#191, outstanding **61,250 Kg** across three lines. These are real current *recorded* open-indent accounting balances, not guaranteed incoming goods.
- `v_proc_indent_line_buylist_base` currently publishes all three lines. Do not hide existing execution backlog merely because a new PR's quantity is zero.
- `v_proc_indent_fifo_allocation` links purchases to indents by matching material/item/UOM/date FIFO, **not** by verified supplier PO-to-indent commitment.
- New `proc_indent_create_from_pr_pec_internal` copies only PR lines whose effective requested plus manual delta is positive, so a zero new PR line does not create another indent line.

## S4 planning implications

**Do not immediately subtract all open indents as certain receipts.** Need two distinct credits:
1. `active_old_indent_commitment`: a validated *procurement commitment* from prior indents (must reduce unnecessary duplicate **new requisitioning** when actionable), with evidence of owner/vendor status and coverage date; this remains visible in buying list.
2. `confirmed_firm_inbound`: verified undelivered *purchase order or vendor acceptance* due within target dates (can reduce projected shortage/availability), with ETA and receipt accounting. An approved indent may qualify for (1) without qualifying for (2). Never count the same lineage twice.

**Source freshness gate:** current `tally_purchase_orders_snapshot` cannot support either confirmed 2026 PO credit or ETA. No values from this table may be passed into November 2026 hybrid PR deduction as verified current commitments. The preview should show `PO_SNAPSHOT_STALE` and `INDENT_ACTIONABILITY_UNVERIFIED`, preserve old indent references and amounts, and hold `approved_new_pr_qty=NULL`.

**Minimum next action:** find a truly current Tally open-PO feed / trusted order acceptance workflow with source IDs and promised delivery; if unavailable, define an authorised operator reconciliation operation with documented actionability, expected date, reason, and audit trail, while retaining existing balance rather than silently deleting/cancelling old indents. This is a proposed workstream requiring owner policy and role decisions.

**Panchasara control fixture:** 61,250 Kg old indent balance vs 11,800 Kg illustrative consumption coverage, MRP 10,200 Kg; old POs 7,100 Kg in the 2025-11-04 snapshot are **not additive credit** (also possibly part of earlier indents); never conclude that all 61,250 Kg is arriving nor that 11,800 Kg should be ordered.

No production data writes, new RPC, PR, indent, snapshot refresh or merge. G0, 0/6 formal gates.

## Superseding owner direction — no Tally purchase-order dependency

The owner expressly rejected reliance on Tally purchase orders because they are not dependable and are not used in the current process. **Do not integrate, refresh, require, compare or subtract `tally_purchase_orders_snapshot` for S4.** Its age is irrelevant to the new PR calculation; `PO_SNAPSHOT_STALE` is **not** an S4 blocker. Prior proposals in this document about finding a live PO feed and requiring PO/ETA evidence are withdrawn.

**Governing pre-PR principle:** use outstanding balances of approved/issued indents from `v_proc_indent_line_balance` as the procurement-commitment deduction, by stock item/material class/UOM, without treating it as physical stock or re-deducting it in MRP opening stock. Existing FIFO purchase allocations already reduce those balances. Preserve all older unfulfilled indents in Vendor-wise Buying List. Explicitly exclude draft, cancelled and closed indents according to existing lifecycle rules. If an apparently active indent is no longer valid, its status/balance must be corrected in its existing governed indent workflow rather than silently excluded by an unapproved PO or age criterion.

**Remaining separate risks (not PO dependencies):** stock as-of anchor consistency; PR→indent source link de-duplication; multiple horizons/overlap; owner-approved treatment of aged but still approved indents; UOM and MOQ rounding; any supplier commitments recorded exclusively outside the indent process must not be invented or credited.

This directive supersedes all incompatible prospective wording above. No production changes made.
