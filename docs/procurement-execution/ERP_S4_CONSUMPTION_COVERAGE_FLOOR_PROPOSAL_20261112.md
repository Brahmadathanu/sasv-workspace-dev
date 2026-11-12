# PEC S4 — Hybrid Replenishment: Consumption Coverage Floor (Owner proposal)

**Date:** 2026-11-12 IST. Parent issue #305, master #284. **DRAFT G1, not owner-approved policy and not executable production logic.** This refines the user's proposed average-consumption + MOQ-normalised PR floor while preserving current MRP, PR edits and stock governance.

## Objective and scope

Prevent an RM/PM/eligible nonproduction stock item being excluded or underprovided in a PR merely because its production MRP has no corresponding demand in the selected PR horizon. Implement a **Consumption Coverage Floor (CCF)** for each canonical `(stock_item_id, UOM, PR planning horizon)`. If an existing PR line's effective quantity is below the required floor, propose increasing the final quantity; if absent and floor > 0, propose a new line. The coverage floor is **a maximum with existing MRP final quantity, never a sum**. The user's idea is preserved, but stock and firm receipts are considered to avoid procuring material that is already available. First build **read-only preview**, then owner approval; no automatic PR insertion.

## Definitions and calculation

1. **C (governed monthly consumption)** = trailing fixed calendar-month total divided by exactly N months, **including zero-use months**. Source: `v_item_consumption_monthly_by_item` plus complete calendar. Present 3/6/12-month alternatives, latest month, nonzero-month count, outliers and data-quality label; recommended default rate remains **unapproved**. The existing `v_proc_item_consumption_rate` averages only months with records, so cannot be silently treated as calendar monthly averages.
2. **H (coverage horizon)** = selected PR months (inclusive, e.g. Sept–Nov = 3 months). If partial months are allowed later, use explicitly defined day weights, not arbitrary rounding. A lead-time/safety target may extend coverage beyond H under a separately governed policy.
3. **D = C × H** = forecast consumption over horizon, *total* requirements, not a nonproduction-only additive quantity. This is the key way to avoid double counting production demand that may also appear in material issue history. Existing production MRP requirements are not added to D.
4. **A (usable on-hand)** = current authoritative stock available at the planning anchor, with recorded snapshot as-of timestamp, UOM conversion, quality/hold/expiry restrictions and reservation semantics. The 2026-11-11 Tally stock snapshot watermark is available in source snapshots but omitted by aggregated `v_stock_current_by_item`; rejoin it. If freshness or usable-stock definition is not proven, mark `REVIEW_REQUIRED`, do not silently use zero.
5. **I (qualifying firm receipts)** = independently evidenced inbound purchase order/accepted indent lines for the same item/UOM and eligible ETA that are **not** already represented by the candidate PR; de-duplicate PR → indent → purchase receipts and exclude cancelled, fulfilled and unverifiable commitments. A PR by itself is *not* firm inbound. Missing lineage/ETA results in `REVIEW_REQUIRED`, not a fabricated quantity.
6. **S (safety target)** = separately approved units/days. In initial governance proposal set safety target 0 only for a *clearly labelled diagnostic without approved safety policy*; do not imply the operational safety policy is zero. If S is not approved, flag the numeric floor as illustrative, not an executable recommendation.
7. **Net coverage deficit** `N = max(0, D + S - A - I)`. With sufficient approved inputs, compute `F = MOQ_round_up(N)`, where `MOQ_round_up(x)=0` when x≤0 or `ceil(x/MOQ)*MOQ` when MOQ>0, otherwise follow governed UOM pack/integer-ceiling rule. MOQ applies **once to period net quantity**, not to C before multiplying. Show `C_normalised_equivalent=F/H` for display, explicitly noting this is a horizon-dependent monthly equivalent rather than a permanent per-item monthly rate.
8. **B (existing effective PR baseline)** = `max(0,requested_qty + manual_delta_qty)` for the exact PR line and UOM, preserving line-by-line link, note and reason. For an item not present in the PR, B=0. Active PRs/indents outside this candidate require separate coverage/commitment accounting, not assumed paid inbound.
9. **`Q_proposed = max(B,F)`; `Q_increment = max(0,Q_proposed-B)`**. In a *new* PR-generation preview, B is baseline `sum(v_mrp_procurement_plan.procure_qty)` over horizon (not current production gross), plus permitted governed draft adjustments if applicable. In an *existing* PR, B is its actual current effective quantity, even when reduced to zero by manual adjustment. **Never silently overwrite a deliberate negative manual delta**: classify this case `MANUAL_OVERRIDE_REVIEW`; show the proposed floor but require explicit human approval and a reason before the user changes the line.
10. **Statuses**: `COVERED`, `TOP_UP_SUGGESTED`, `MISSING_LINE_SUGGESTED`, `MANUAL_OVERRIDE_REVIEW`, `INCOMPLETE_EVIDENCE`, `STALE_STOCK`, `UNIT_CONVERSION_REQUIRED`, `OVERLAP_REVIEW`. Only the first three can be shown as numerically determined in preview with complete eligible data; all outputs remain non-writing until owner approval.

## Worked examples (synthetic, not actual PR proposals)

| Scenario | C × H | Usable stock A | Firm other inbound I | Existing effective PR B | MOQ | CCF F | Proposed | Increment |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Existing PR below floor | 200 × 3 = 600 | 100 | 0 | 200 | 100 | 500 | 500 | +300 |
| Production MRP above floor | 200 × 3 = 600 | 100 | 0 | 700 | 100 | 500 | 700 | 0 |
| Item completely absent | 200 × 3 = 600 | 150 | 0 | 0 | 100 | 500 | 500 | +500 |
| Sufficient current stock | 200 × 3 = 600 | 650 | 0 | 0 | 100 | 0 | 0 | 0 |
| Other firm inbound already covers | 200 × 3 = 600 | 100 | 500 | 0 | 100 | 0 | 0 | 0 |
| MOQ normalized **once** | 1,100 × 3 = 3,300 | 0 | 0 | 0 | 1000 | 4000 | 4000 | +4000 |

**Guard against the classic double count:** MRP baseline `B` is **not added to** coverage target `F`. And if a planned quantity already in B is later represented by an indent/PO, that lineage must not also be subtracted as unrelated I. A genuinely time-phased projection is required for unequal ETA, partial receipts, stock cut-off and safety cover. The above scalar expression is a review-screen model only under a consistent time anchor and fully audited commitments.

## Important case observed in the live database (do not auto-raise)

`Label - Punarnavasavam 450 ML`, stock item `1638`, is **MRP-COVERED** but November/December 2026 production MRP demand is zero while October Tally material issues equal 2837 Nos and recorded stock is zero. Fixed-calendar Oct-ending mean 3m=945.667, 6m=1214.500, 12m=1048.917 Nos/month. Existing view reports sparse-month averages 2837 / 2429 / 3146.75; these are NOT equivalent. PR-2026-03 current final line = `1666 + (-1666) = 0` (intentional prior adjustment). No item-specific lead-time or MOQ policy and no confirmed eligible firm-inbound ledger. **No quantity is operationally recommended at this stage**: CCF formula is a candidate illustration only, with provenance/override/stock-policy review.

## Governance and test requirements

- **S4-D1:** confirm the default average basis (3m, 6m, 12m, seasonally weighted / classification-specific), zero-month handling and whether to count raw Tally issue vouchers as representative consumption for RM/PM even if production-derived. Under CCF, historical issues are a total-demand reference, *not an extra additive demand source*.
- **S4-D2:** select calendar coverage (H), optional lead-time plus review-period and approved safety threshold; define stock quality/reservations and stale watermark. Do not make a 3-month PR imply a 3-month safety target *in addition* to a 3-month consumption coverage floor.
- **S4-D3:** verify supply ledger joins, partial receipts and firm ETA, active statuses, de-duplication across purchase requisition, indent, PO and purchase vouchers; define existing manually overridden PR quantity rule and how to signal conflicts.
- **S4-D4:** source item eligibility (RM, PM, consumable, fuel, JIT exclusions), approved MOQ and UOM/pack rounding; what to do when MOQ absent, item inactive or stock not mapped. Do not assume all products in MRP or all historical consumption are eligible.
- **S4-D5:** whether a validated CCF may be applied to an existing draft PR automatically after a human acceptance, or remains a suggestion line for explicit edit; never rewrite approved/closed PRs.

### Verification matrix

1. Synthetic golden examples above, with integer MOQ, no MOQ, UOM integer ceiling and fractional quantity.
2. PR line absent/exists; existing larger than floor; floor larger than existing; manual `-1666` style adjustment; duplicate item lines and PR revisions.
3. C average sparse vs zero-filled with 3/6/12 windows and seasonal spikes; no-history `INCOMPLETE_EVIDENCE`, not zero demand.
4. On-hand and supply reconciliation with PO/receipt partial deliveries and duplicate PR→indent lineage: exactly-once credits.
5. Missing stock watermark, stale snapshot, material hold, missing UOM conversion, lead time, MOQ and eligibility: fail-closed status.
6. Read-only actual-vs-proposed comparison for all PR items, including missing items outside PR. Snapshot month/horizon semantics must be pinned before scaling.
7. No change to `v_mrp_procurement_plan`, existing `create_pr_from_mrp_plan`, invoice/indent or production cost data.

**Implementation sequence:** owner reviews policy D1–D5 → build pure calculation oracle against synthetic inputs → read-only data extraction and classification → preview RPC with strict permissions → signed-in operator acceptance → separately approved writer integration, if ever.

**Programme:** G0 active, 0/6 gates formally verified. This is a *proposed decision contract*, not a policy approval or a production SQL migration.
