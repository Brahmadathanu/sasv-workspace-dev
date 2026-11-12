# PEC S4 — Broad item coverage and PR-to-indent lineage verification (2026-11-12)

**Source:** live Supabase SELECT-only queries. **Status:** G0/G1 evidence only, no migrations, no PR/indent writes, no Tally PO dependency.

## Bounded current-horizon overlap

For production MRP horizon **2026-11-01 through 2027-01-01**, group by `(material_class_id,stock_item_id,uom_id)`, compare `sum(v_mrp_procurement_plan.procure_qty)` with current positive `sum(v_proc_indent_line_balance.remaining_qty)` of approved/issued indents.

| Class | MRP tuples | With prior active indent | Prior balance >= positive MRP qty |
|---|---:|---:|---:|
| RM | 683 | 479 | 368 |
| PM | 629 | 175 | 71 |
| Total | 1312 | 654 | 439 |

The 439 is an **MRP-only comparator**, not the CCF comparison. Do not sum quantities across different material items or UOMs. MRP may be zero for some tuples; the comparator explicitly restricts MRP qty > 0. These numbers demonstrate substantial duplicate-requisition risk but are **not equivalent to 439 approved zero-quantity new PR recommendations**.

## PR→indent lineage trace

From live `proc_pr_to_indent_map`: **7** historical mapping rows spanning **7 PRs and 6 indents**, **6 active** mapping rows. From `proc_pr_indent_line_map`: **1023** line mapping rows (1023 unique PR lines; 1023 unique indent lines).

From `proc_indent_line` joined to header: total **1586** indent lines. **1025** are under headers with `source_pr_id IS NOT NULL`, whereas **1023** have explicit line mapping. The **two remaining lines were inspected**, not assumed corrupt:
- Indent #158, ID 9, approved, source PR ID 3, indent_line_id **1700**, item 1338 **2 L P30 PET Jar - Natural**, Nos, 500; `manual_reason='Additional Requirement'`.
- Same indent #158, indent_line_id **1701**, item 1473 **Cap - 2 L P30 PET Jar Natural**, Nos, 500; same reason.

They appear to be **legitimate manually added indent-only lines**, not a source-link failure. The PR header source alone must never imply every line belongs to a PR line. This is important for the S4 carry-forward rule: BOTH lines are real approved-indent commitments if outstanding and should not be omitted merely because `proc_pr_indent_line_map` lacks them. Preserve indent identity and UOM as authoritative for outstanding commitments.

## Design requirements exposed

1. **Canonical balance source** = `v_proc_indent_line_balance` for approved/issued open positive lines; count manual, unlinked approved-indent lines too. Do NOT infer their source from `source_pr_id` alone.
2. Maintain source provenance using line-level `proc_pr_indent_line_map` where available, and direct `proc_indent_line` ID for manually added lines. Avoid double counting a PR and its generated indent if both appear as commitment sources; S4 approved-indent balance is the single existing-commitment source.
3. **New PR** cannot be debited against its *own future indent*; use a consistent planning cut-off and filter to prior approved/issued indents. In existing-PR recalculation, filter/reconcile own linked indent explicitly, with separate review.
4. Continue to differentiate **outstanding procurement commitment** from delivered usable physical stock. FIFO-allocated purchases are already deducted by the indent balance view; do not manually subtract them again.
5. New candidate PR lines should be generated only from **positive net incremental requirements** and must not create empty indent headers; manual adjustment protection remains.
6. Broader coverage beyond MRP-only tuples requires the union with consumption-bearing stock items, including those entirely absent from the MRP plan. UOM/class eligibility and conversion must be verified before synthesising candidate lines.
7. This check **does not** validate that current on-hand stock source as-of equals the recursive MRP anchor. No automatic writer until stock anchor, consumption policy, eligibility and permissions pass.

## Next acceptance boundary

Prepare a bounded, multi-item *read-only* comparison of MRP tuples UNION eligible historical consumption tuples; verify class/UOM joins, missing-stock handling, lead/seasonality policy, MOQ-integer quantum, zero usage months, negative overrides, and deduplication. Create a synthetic read-only calculation oracle before any server deployment.

No production writes, DDL, PR/indent creation, snapshot refresh or merge. Overall PEC gates 0/6, G0 active.
