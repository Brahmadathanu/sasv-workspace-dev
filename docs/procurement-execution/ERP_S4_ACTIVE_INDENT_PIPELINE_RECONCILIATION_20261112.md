# PEC S4 — Existing Indent Balance vs Pre-PR MRP Reconciliation (2026-11-12)

**Status:** G0 read-only live source audit, not implementation or owner-approved supply recognition. Parent #305; programme #284.

## Verified position

The user's recollection that active indents are already considered is **correct for the downstream procurement execution balance**, but **not currently demonstrated inside the MRP-to-PR generation quantity**.

1. `v_mrp_procurement_plan`: recursive BOM gross → opening on-hand deduction → MOQ → closing-stock carry; **no indent balance input in inspected definition**.
2. `create_pr_from_mrp_plan_pec_internal`: `sum(v_mrp_procurement_plan.procure_qty)` by material class/item/UOM for horizon into `proc_pr_line`; **no reference to indent table, line balance or active commitment**. External `create_pr_from_mrp_plan` applies PEC Edit permission then delegates.
3. `proc_pr_rebuild_from_mrp_pec_internal`: rebuilds a draft from identical MRP `sum(procure_qty)`, preserves manual adjustment in safe mode; **no indent deduction**.
4. `v_proc_indent_open_lines`: approved/issued only, with nonnull approved_date. Draft, closed, cancelled excluded.
5. `v_proc_indent_fifo_allocation`: matches purchases by material-class/item/UOM and date, apportions via FIFO cumulative logic. Allocation is an **accounting attribution** based on material/item/date, *not* supplier PO confirmation. `v_proc_indent_line_balance` computes requested minus FIFO allocated = remaining.
6. `proc_build_indent_balance_generation_internal`: copies only positive remaining balances into a stage for an execution snapshot refresh.
7. `v_proc_indent_line_buylist_base`: reads published balance snapshot to display `qty_to_buy`; `v_proc_indent_excess_supply_net` is net unallocated *purchased* excess, **not open-indent inbound**.

**Implication:** existing execution balance and Buying List already prevent double-allocation *within their own operational tracking*, but a new PR can still be generated from MRP irrespective of outstanding approved indents. S4 should **reuse the live indent balance as an outstanding-commitment evidence source before PR finalisation**, without claiming every open indent will arrive.

## Live read-only audit

As inspected 2026-11-12, `proc_indent_header` has 41 approved indents, 1586 total lines. `v_proc_indent_line_balance` exposes 1189 lines with positive remaining balance among approved indents. **Do not sum remaining quantity across dissimilar UOMs/items.**

**Panchasara, item 733, Kg:** 3 approved indent lines, all with FIFO allocated quantity **0**:
- indent #118, approved 2026-02-17: requested/remaining **23,400 Kg**.
- indent #156, approved 2026-06-13: requested/remaining **20,000 Kg**.
- indent #191, approved 2026-09-17: requested/remaining **17,850 Kg**.
- total **61,250 Kg**. Source view classifies as open balances, **not guaranteed inbound**, confirmed PO or expected dated receipt. These are much older than the hypothetical Nov2026–Jan2027 PR horizon. The previous 11,800 Kg floor and 10,200 Kg MRP numbers are only illustrative. No top-up is operationally approved.

**Label – Punarnavasavam 450 ML, item 1638, Nos:** no outstanding approved indent line in the inspected live balance. This does **not** independently prove no live PO or undelivered purchase outside indent system.

## Proposed pre-PR S4 supply bridge

Proposed lines in a *new* PR preview should carry separate fields:
- `mrp_stock_netted_qty`: existing production net procurement result.
- `consumption_floor_stock_netted_qty`: CCF, from same planning stock snapshot, period and UOM, integer-unit/MOQ rounded once.
- `open_indent_remaining_qty`: live `v_proc_indent_line_balance.remaining_qty` grouped by item + canonical UOM (diagnostic **outstanding demand/commitment**, not counted as firm supply by default).
- `linked_pr_id`, `linked_indent_line_id` and explicit lineage to avoid counting PR and its indent separately.
- `qualifying_firm_inbound_qty`: only from reconciled PO/order/ETA/receipt evidence, net of previous arrivals and excluding candidate PR's own lineage.
- `unconfirmed_open_indent_qty`: display prominently, not `I` in `CCF = D + S - A - I`; stale-aged indents `REVIEW_REQUIRED`.
- `effective_coverage_by_item_uom`: accepted already-ordered supply, with arrival month, not open indent date alone.
- `review_state`: `OUTSTANDING_INDENT_REVIEW` whenever material outstanding balances exist but delivery/PO confirmation not evidenced. Conservatively **withhold approved quantity**, while still showing illustrative gap, rather than blindly discount every open indent or double-procure.
- A reconciled, genuinely firm, eligible order may be deducted exactly once from CCF *after* time/stock alignment, but not again through PR/indent/PO duplicate chain.

**Owner governance question:** should long-outstanding indent balances without traceable purchase order be considered zero firm inbound, or require operator reconciliation before new PR top-ups? Proposed default `REVIEW_REQUIRED`, no automatic credit or new order. Existing working FIFO balance remains unchanged.

**No mutations** were made to MRP, PRs, indents, purchase allocations, snapshots or service worker. No PR creation/rebuild or new RPC executed.
