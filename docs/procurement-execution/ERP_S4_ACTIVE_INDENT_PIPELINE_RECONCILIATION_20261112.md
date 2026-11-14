> **Owner clarification — 12 Nov 2026:** S4 must **not depend on Tally purchase orders**. The canonical source for deducting prior procurement commitments before new PR creation is the existing **approved/issued indent balance**, computed as requested minus FIFO-allocated purchases. A PO, ETA or supplier acknowledgment is **not** a prerequisite. Older indents still approved/issued should remain eligible according to the governed indent lifecycle; they should not be silently invalidated by age alone. See final appended owner decision.

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

## 2026-11-12 owner direction — pre-PR outstanding-indent adjustment

Owner endorsed the principle that **remaining actionable commitments from earlier approved/issued indents must reduce a subsequent PR proposal**, instead of each PR repeatedly requisitioning the same uncovered period demand. This is a design direction, **not approval of a specific age threshold, lifecycle reconciliation or automated write**.

**Proposed arithmetic for a fresh, stock-aligned PR period (not historical PR):**

- `G_MRP`: existing net MRP procurement, already stock-netted and MOQ-adjusted.
- `G_CCF`: net consumption-coverage requirement, already stock-netted with same anchor but **before** incremental purchasing MOQ rounding.
- `G = max(G_MRP, G_CCF)`, compare alternatives, do not add.
- `K`: **eligible, actionable and undelivered** old-indent commitment *attributable to the PR coverage interval* and NOT part of stock-on-hand, nor a second count of a linked PR/PO. Use `v_proc_indent_line_balance` as starting evidence; it is an accounting balance, not a supply promise.
- `N = max(0, G - K)`. The candidate `Q` for any **new** PR is `N` rounded once to the applicable **incremental** MOQ/pack quantum or integer Nos quantum. If the existing MRP `G_MRP` already contains MOQ excess and stock carry, verify this accounting through time-phased replay before accepting `max` as a final production formula.
- **Non-actionable/stale** indents are not assumed valid zero or valid incoming supply. They enter `INDENT_RECONCILIATION_REQUIRED` with `K_eligible` unresolved until designated operator confirms carry-forward/expiry/cancellation/reissue. Do not blindly treat their whole remaining balance as a guaranteed future delivery.

**Why subtract before rounding the new order:** Example fresh gross coverage `11,780.17 Kg`, active eligible old commitment `4,000 Kg`, MOQ `50 Kg` yields new incremental `ceil((11780.17-4000)/50)*50 = 7,800 Kg`, rather than rounding 11,780.17 first and then subtracting without validating the resulting order multiple. This is an arithmetic example, not a verified eligible existing indent.

**Panchasara caution:** the actual three old approved indents leave 61,250 Kg remaining in the FIFO accounting view. The hypothetical period's consumption diagnostic 11,800 Kg would yield a **zero new PR** only if the relevant 61,250 Kg really is actionable, available over the desired horizon and not cancelled, superseded, long-overdue or unreliable. As of this inspection, those conditions are **unverified**; do not assert new PR=0 as approved or ignore material shortage risk.

**Required ledger gate:** status; indent approval/effective/issue dates; explicit cancellation or supersession; amount already received and included in on-hand; undelivered amount; linkage PR→indent→PO→purchase (including invoices/purchase fact FIFO); supplier acknowledgment and projected ETA; UOM/class; overlap of multiple indents for a stock item; horizon coverage and stock snapshot. A deterministic stale threshold must be approved by owner and should raise a *reconciliation exception*, never silently cancel historic indents.

**User-interface proposal:** In new PR preview show MRP net, CCF gross/net, existing on-hand, current active-indent balance, eligible carry-forward commitment, excluded/uncertain balance, difference after commitments, final new-order rounding, and each indent reference with reason. Apply no automatic PR writer until preview evidence and owner policy are accepted.

## 2026-11-12 — independent confirmation of zero-new-PR vs previously open indents

Live read-only query against the **published** `v_proc_indent_line_buylist_base` for Panchasara item 733 returned exactly **3** buy-list lines, `qty_to_buy=61,250 Kg`, distinct indent numbers `118, 156, 191`. This equals the independently verified live `v_proc_indent_line_balance` accounting remainder for these same three approved indents. Thus previously approved and published indents remain in the Vendor-wise Buying List **independently of the quantity of a newly generated PR**. This is a verified current behaviour, not merely a proposed architecture.

Independent source inspection of `proc_indent_create_from_pr_pec_internal`: the function creates a *new draft indent* header mapped to the PR, and inserts indent lines only when `coalesce(proc_pr_line.requested_qty,0)+coalesce(proc_pr_line.manual_delta_qty,0) > 0`. **Zero/negative final-quantity PR lines do not become indent lines.** It does not remove previously approved indents or their positive open balances. If all lines of the new PR are zero, the function's current source would still create a header and PR mapping but no lines; a future UX/writer gate should avoid creating pointless empty indents, without altering current production behaviour before review.

**Two separate ledgers, not an either/or decision:** prior open indents are an outstanding procurement *execution* backlog. Newly generated PR/indent lines should represent only **incremental, not-already-committed demand**. A zero new PR line means zero *additional* indent lines for that item, not termination of older outstanding indent lines. An old indent only disappears from the buy-list after authoritative status/balance/publication changes; there can be a snapshot delay.

**Critical S4 policy boundary:** historical open balance is valid *buying-list evidence* and a candidate pre-PR commitment deduction; it is **not necessarily firm incoming stock**. Failed/lapsed or long-outstanding indents should be surfaced for operator resolution, neither silently double-procured nor silently credited as delivered. Never use fresh PR zero as an excuse to hide existing execution backlog.

## 2026-11-12 — executable pre-PR indent reconciliation fixture

Created **SELECT-only** `docs/procurement-execution/ERP_S4_PRE_PR_INDENT_RECON_SELECT_ONLY_20261112.sql` (commit `491ae93`) and **executed that exact committed SQL against live Supabase**. Bounded to item #733 Panchasara (Kg), item #1638 Label–Punarnavasavam 450 ML (Nos), hypothetical PR period Nov 2026–Jan 2027. Both results explicitly return `confirmed_eligible_old_indent_credit=NULL` and `approved_new_pr_qty=NULL` pending evidence.

- Panchasara: three existing outstanding indent lines #118/#156/#191, total **61,250 Kg**, Nov–Jan MRP net **10,200 Kg**, oldest approval 2026-02-17, newest 2026-09-17, `OUTSTANDING_INDENT_RECONCILIATION_REQUIRED`.
- Label: no older indent line in live balance, MRP net 0, `OTHER_COMMITMENTS_AND_STOCK_ANCHOR_REVIEW`. No open indent **does not** prove no other purchasing commitments.
- Verified no production changes. This is a supply **evidence readback**, not a purchase-order confirmation, an approved net PR calculation or a complete item-wide preview.

**Next technical steps:** obtain PO/receipt lineage and expected arrival, resolve old-indent actionability and data ageing, pin stock as-of time to the active MRP horizon, then make the complete `max(MRP_net,CCF_net)-eligible_prior_commitments` formula auditable. Require an explicit no-empty-indent guard in a separate writer approval package.

## Final owner clarification: indent-based deduction, no external PO gate

The owner states that Tally purchase orders are not dependable and are not in use. Therefore **remove every prior recommendation to require a current Tally PO, PO linkage, ETA or vendor confirmation to qualify the existing indent balance for the S4 *new PR duplication prevention* calculation.**

**Design decision to carry forward:** `outstanding_prior_indent_qty` comes from live `v_proc_indent_line_balance`, grouped by material class + stock item + UOM with `remaining_qty > 0` (the view already includes only approved/issued indents with nonnull approval date). That balance is the authoritative *unfulfilled indent commitment*, not a physical incoming-stock number. Existing purchase FIFO allocation is already reflected, so do not subtract it again. Deduct this balance from the *incremental new requisition deficit* once, after comparing the stock-netted MRP and consumption coverage alternatives, and before applying incremental MOQ / whole-Nos rounding.

**Actionability:** an indent still approved/issued in the current system remains an active procurement commitment until its status or balance is formally revised through established lifecycle governance. Age may generate a nonblocking reconciliation warning, but must not silently reduce eligible credit. The details of approved exceptions, status correction and any risk override require separate approval. Do not suspend all new PRs merely because no PO feed exists.

**Panchasara control:** 61,250 Kg in three approved indent lines remains in Vendor-wise Buying List. As a **commitment-based** calculation, that amount can cover a hypothetical 11,800 Kg new procurement requirement and yield a zero *incremental* PR line, without proving that 61,250 Kg is arriving or available as physical stock. Procurement execution continues against those open indents. A future shortage despite open commitments must be handled through indent review/correction or an explicit approved override, not invented incoming supply.

**Not yet implemented:** calculation source integration, stock anchor alignment, duplicate-PR/indent mapping prevention, server test, write permission controls and deployment remain gated.

## Executed no-PO hybrid incremental PR SELECT (12 Nov 2026)

The exact committed **read-only** SQL at `docs/procurement-execution/ERP_S4_HYBRID_INCREMENTAL_PR_SELECT_ONLY_20261112.sql`, commit `1a3d8a1`, executed successfully against live Supabase for the pinned hypothetical Nov 2026–Jan 2027 horizon and 12 complete usage months through Oct 2026.

| Item | MRP net | Net CCF prior to indent | Approved/issued open-indent remainder | New-PR need pre-rounding | One-time rounding | Diagnostic new-PR |
|---|---:|---:|---:|---:|---|---:|
| Panchasara #733, Kg | 10,200 | 11,780.170 | 61,250 (#118/#156/#191) | 0 | 50 Kg MOQ | **0 Kg** |
| Label–Punarnavasavam 450 ML #1638, Nos | 0 | 3,146.75 | 0 | 3,146.75 | Whole Nos | **3,147 Nos** |

Both rows explicitly return `approved_new_pr_qty=NULL`, with `INDENT_LIFECYCLE_AND_STOCK_ANCHOR_REVIEW` and `STOCK_ANCHOR_AND_USAGE_POLICY_REVIEW` diagnostic states respectively.

**Source logic:** compare existing MRP `sum(procure_qty)` and unrounded stock-netted calendar consumption floor (never sum), subtract live `v_proc_indent_line_balance` approved/issued remainder *once* by class/item/UOM, clamp to zero, then apply MOQ or Nos ceiling **once**. The calculation does **not** read Tally purchase orders or require PO/ETA evidence. Previously published indent lines remain in the buying list; no PR or indent created.

**Important limitation:** MRP's recursive period anchor and current Tally stock snapshot may not be identical; zero-filled 12m average and 3-month horizon are trial assumptions. Existing outstanding indents are intentionally credited based on owner direction, but lifecycle/exception treatment, already-linked PR/indent duplication, schema-wide units and performance remain to be verified. This is **not** a writer-ready or formally approved global procurement policy.

**Next bounded G0/G1 tasks:** generalise case-specific dates and items through reviewed inputs, verify non-MRP items' class/UOM eligibility, time-phased stock anchor, duplicate PR→indent linkage (especially after regenerations), and review proposed permissions and performance with isolated tests before any production write.
