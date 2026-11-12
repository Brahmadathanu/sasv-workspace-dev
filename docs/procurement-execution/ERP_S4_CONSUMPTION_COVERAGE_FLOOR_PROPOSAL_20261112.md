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

## Stock-on-hand deduction — precise stage and as-of gate (2026-11-12)

**Confirmed server workflow:** in `v_mrp_procurement_plan`, BOM gross monthly requirement is netted against `opening_qty_anchor` on the first horizon month, rounded to active MOQ, then the calculated `closing_qty` becomes the next month's opening stock. `create_pr_from_mrp_plan_pec_internal` subsequently copies and sums `procure_qty` over the PR horizon into PR lines. **Existing MRP stock deduction occurs before PR creation.** The draft CCF is a *parallel minimum-floor comparison after MRP's netting*, never a second subtraction from the MRP output.

For a **fresh PR proposal**, create one immutable read/preview context with:
- planning anchor date and chosen horizon; common inventory source watermarks and stock allocation/usable-stock rules;
- `B` = existing MRP **net** PR proposal (not gross BOM requirement);
- `F` = independently stock-netted whole-horizon consumption floor, same anchor and same stock basis;
- `Q = max(B,F)`, not `B + F`, `B + max(0,F-stock)` or `max(0,B-stock,F-stock)`.
- evaluate sources/units per item, and ensure a single stock pool is **not credited simultaneously to different demand groups** under an eventual time-phased extension.

For an **already-created PR**, do **not** compare its historical saved `B` (based on old opening stock and historical MRP) against `F` using today's live stock and claim exact parity. PR header currently exposes `effective_from_date`, `horizon_start_month`, `horizon_end_month`, `generation_filters`, and `updated_at`; there is no explicit frozen stock-watermark or opening-stock quantity field in the inspected PR header/line columns. An editable draft PR requires an **as-of reconciliation**: historic opening baseline if reproducible, physical receipts/issues since PR generation, remaining needs for remaining coverage months, already linked indent/PO commitments, and manual deltas. If that lineage is not provable, provide *advisory-only* output flagged `ANCHOR_MISMATCH_REVIEW`—not an automatic top-up.

**Example (synthetic, matching fresh planning anchors):** monthly consumption 1,000 × 3 months = 3,000; current usable stock 500; production gross BOM demand 2,000 and existing MRP net procurement `B=1500` (assuming no MOQ difference); CCF net `F=2500` (assuming no other firm inbound and no safety target); proposed PR `max(1500,2500)=2500`, not 4000. Stock 500 was considered once within each **alternative** calculation; these results were compared, not summed.

**Current risk boundary:** The source stock view selects latest source snapshots, while the PR generation implementation does not freeze that stock snapshot identity in an explicit, inspected PR header field. This is a lifecycle governance gap to document before authorizing repeat calculations; adding an audit envelope to a future preview does not change an existing historical PR's original provenance.

**Read-only source inspection:** `proc_pr_header` has `generation_filters` JSONB and horizon/effective dates, but inspection of the relevant PR header and line columns found **no dedicated immutable stock snapshot ID/date column**. `updated_at` is a change timestamp, not a reliable original stock reference. Do not infer stock snapshot date from PR number or effective date without source evidence.

**Release gate:** no new data writes/SQL deployment and no CCF addition to PRs until stock anchor, commitment de-duplication and selected owner policy are verified.

## 2026-11-12 — first executed read-only diagnostic checkpoint

Created `docs/procurement-execution/ERP_S4_PREVIEW_READBACK_SELECT_ONLY_20261112.sql` (commit `5079b48`), explicitly a *single-item bounded SELECT* for stock item 1638 with fixed hypothetical PR period 2026-11-01 through 2027-01-01 and a complete Oct-ending 12-month consumption calendar. This is a **diagnostic data extraction**, not a new RPC/PR generation/operational recommendation, and it contains no write or grant statements.

Executed the exact committed SELECT against production using read-only SQL access. Observed:
- item `1638` Label - Punarnavasavam 450 ML, `plm`, UOM `Nos` ID 5.
- 12 calendar months, 4 nonzero months; total usage 12,587 Nos, 12m monthly mean 1,048.917, 3m monthly mean 945.667.
- opening/recorded stock from stock view 0 Nos; underlying PLM source snapshot watermark 2026-11-11.
- MRP three-month gross and stock-netted procurement quantities both zero (3 MRP rows).
- illustrative 3-month usage `(12587 / 12) × 3 = 3146.75` Nos; **not rounded to an approved MOQ**.
- no eligible active MOQ policy for the item's UOM; `evidence_gate='MOQ_POLICY_REVIEW'`, `approved_incremental_pr_qty=NULL`. Missing verified other-firm-inbound, policy approval, stock quality/hold/UOM and historical PR lifecycle are still additional reasons for withholding a purchasing figure; gate label is only first-stop precedence, not a complete acceptance state.

**Result interpretation:** demonstration that the read-only data sources can expose MRP/consumption gaps without changing MRP, and that missing policy prevents an artificial quantity from being stated as final. NOT a product-wide population study, SQL RPC installation, stock valuation or PR draft edit. The fixed 3m, 12m period and watermark are case-specific evidence fixtures; do not extrapolate these constants into the eventual API.

**Next gates:** comprehensive source and eligibility mapping across all RM/PM/consumables, cross-check true available stock and order commitments, owner-approved average/MOQ/safety rules, snapshot-consistency and UOM tests, then a permission-gated preview RPC in isolated PG17.4. Existing PRs require anchor mismatch reconciliation and manual override review; no auto-writer.

## 2026-11-12 owner clarification: count-based UOMs and RM trial

**Owner-confirmed requirement:** Quantities with indivisible count UOMs such as `Nos` must be rounded **up to the next whole number** at the final requirement stage. This is distinct from supplier minimum-order-quantity (MOQ). An item without a configured MOQ is **not automatically blocked solely for missing MOQ**: the count-unit quantum of 1 is intrinsic when the UOM is verified as indivisible. For Kg/L or other divisible dimensions, preserve quantitative precision until governed supplier MOQ/pack rounding (when present); do not impose whole-Kg or whole-L rounding by default.

Order of operations: compute fixed-calendar average unrounded → multiply by PR coverage period → subtract usable stock and independently reconciled qualifying inbound **once** → clamp to zero → round **once** to approved MOQ multiple if eligible positive MOQ exists, otherwise round to UOM integer quantum for verified `Nos` → compare against existing *stock-netted* MRP/PR quantity. If MOQ and count quantum both apply, the effective quantity must satisfy both, and exceptional noninteger MOQ for count UOM must be validated or rejected rather than blindly multiplying fractional packaging amounts.

**PLM label worked case:** item 1638, Label - Punarnavasavam 450 ML. 12-month calendar average 12,587/12=1,048.916667 Nos; 3-month raw coverage=3,146.75 Nos. With zero *reported* stock and **no configured MOQ**, the verified `Nos` integer equivalent is `ceil(3146.75)=3147 Nos`. This is **a diagnostic integer coverage quantity only**, not an approved PR recommendation: further firm inbound, snapshot consistency, stock quality, manual overrides and policy choices are unresolved. Prior `MOQ_POLICY_REVIEW` is refined: no MOQ alone need not block an indivisible UOM, but absent firm-inbound reconciliation still blocks the buying quantity.

**RM Panchasara worked case (read-only live evidence):** `stock_item_id=733`, `uom_id=1`, Kg. Oct-ending 12-month recorded issue total `49,105.380 Kg` across 12 completed calendar months, fixed-calendar monthly mean `4092.115 Kg`; Nov 2026–Jan 2027 3-month raw coverage `12,276.345 Kg`. Current reported RM stock `496.175 Kg` (source snapshot 2026-11-11); naive illustrative net coverage `11780.170 Kg`. Exactly one effective active item MOQ policy at the 2026-11-01 anchor: `50 Kg`, hence `ceil(11780.170/50)*50=11,800 Kg`. MRP same 3-month plan reports gross `10202.029018... Kg` and stock-netted planned procurement `10,200 Kg`; if all inputs were exactly comparable, illustrative floor would exceed MRP by `1,600 Kg`. Four historical indent lines and two PR lines exist for item 733; outstanding firm inbound and receipts are **not** reconciled. Do not treat this as an order recommendation.

**Critical as-of warning for both cases:** `v_mrp_procurement_plan` is a recursive *active horizon* model, with opening stock anchored at its first month and carried forward. Today's reported stock snapshot (2026-11-11) may not represent the same time anchor as the plan's November–January already-stock-netted procure quantities. Comparing 11,800 and 10,200 is a **diagnostic contrast**, not exact formula parity until an aligned forward projection or plan regeneration is developed. Independent historical PR lines could also already cover material. Do not auto-update PRs from these figures.

**Remaining gates:** explicit qualifying inbound ledger, snapshot/anchor alignment, class coverage, consumption basis, policy/rounding controls and signed-in acceptance. No production writing.
