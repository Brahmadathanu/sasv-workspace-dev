# PEC S4 — Generalised RM/PM Candidate Cohort, read-only execution (2026-11-12)

## Executed source

`docs/procurement-execution/ERP_S4_GENERAL_RM_PM_COHORT_SELECT_ONLY_20261112.sql`, commit `0635814` with qualified-join correction `f24a81a`, **executed successfully against live Supabase**. This is a SELECT-only *aggregate cohort screen*, not a complete calculated PR, no Tally PO use, no live changes.

Pinned periods: usage Nov 2025–Oct 2026, MRP Nov 2026–Jan 2027. Input population is UNION of existing RM/PM MRP item/UOM tuples and currently active RM/PM catalog items with positive historical consumption **absent from MRP**. Non-MRP item UOM uses the canonical `v_inv_stock_item_with_class.default_uom_id` for screening only. Potential UOM conversion to source issue UOM is unresolved and must be a blocking gate for numeric buying recommendations.

### Executed summary

| Class | In MRP | Flag | Tuples | With open approved/issued indent |
|---|---|---|---:|---:|
| PM | No | Calculation evidence present | 91 | 6 |
| PM | Yes | Calculation evidence present | 552 | 166 |
| PM | Yes | No usage history | 70 | 8 |
| PM | Yes | Stock source absent | 6 | 1 |
| RM | No | Calculation evidence present | 135 | 12 |
| RM | No | Stock source absent | 5 | 0 |
| RM | Yes | Calculation evidence present | 547 | 392 |
| RM | Yes | MRP UOM differs from item default | 13 | 0 |
| RM | Yes | No usage history | 43 | 28 |
| RM | Yes | Stock source absent | 77 | 59 |

**Screening totals:** 231 active RM/PM consumption items absent from MRP (140 RM, 91 PM); 226 have a matching RM/PLM stock-source row and 5 RM do not. `STOCK_SOURCE_ABSENT` is *not* a confirmed zero stock; source and physical-on-hand must be resolved before procurement quantity. MRP rows include 13 RM UOM mismatches, which may be valid alternative measure units; do not automatically convert or reject. The diagnostic displays a **single priority flag** per row; stock missing and no consumption can coexist under a more visible UOM warning, so individual flags are not exhaustive.

**Important source caveats:** the view `v_item_consumption_monthly_by_item` has no explicit UOM column in the inspected schema; its numeric quantity must not be directly combined with a different unit without source/stock-item evidence. The current filter `active` applies to the catalog, while MRP view itself has production scope. This screening is insufficient to claim that the full 231 are ready for automated purchase requisition.

### Acceptance work remaining

1. Resolve 5 absent-MRP RM source-stock gaps and material eligibility, 13 UOM differences, and other stock-missing MRP tuples. No blind zeros.
2. Verify a reliable issue-consumption quantity UOM contract and type of demand (production issue vs other issue).
3. Verify MRP opening stock planning anchor against current on-hand; do not double net.
4. Pin PR horizon and average windows; include months of zero usage; explicit treatment of seasonal outliers and insufficient history.
5. Use `v_proc_indent_line_balance` outstanding approved/issued indents once per class/item/UOM, including manually added lines; no purchase-order source.
6. After representative cohort fixture passes, build security-scoped preview and isolated tests; production PR writer requires owner approval.

**S4 status:** source-cohort and relevant exceptions verified, calculation policy and writer not approved; overall PEC gate G0, formal 0/6.
