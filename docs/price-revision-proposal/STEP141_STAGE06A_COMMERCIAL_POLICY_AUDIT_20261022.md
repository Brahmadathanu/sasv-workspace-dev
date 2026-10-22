# Stage 06A — Read-only commercial baseline audit and next design gate (22 October 2026)

## Binding user architecture
The workbook is a standalone price-revision working model after controlled baseline import. Database -> MASTER DATA + MASTER DATA REFERENCE as snapshots only. Other tabs must never fetch directly from database. Marketing master is to show current discounts/schemes as read-only reference from in-workbook master; adjacent initialized static **working/input** value controls all downstream calculations. Refresh of reference/master must never overwrite working edits. No automatic writeback to Supabase.

## Read-only live findings
Canonical latest APPROVED run140 (627 unique active SKUs). Discount pairs IK and OK identical currently: 604 SKUs 0%, 20 SKUs 33%, 2 SKUs 32%, 1 SKU 40%. Zero IK/OK mismatches. Selected scheme for all 627 SKUs is `No Scheme`, paid 1/free 0, for both regions. Region list eligibility: 525 true IK, 525 true OK; 102 excluded per region (some overlap). Use regional list inclusion to scope proposals.

Current policy objects:
- `costing.sku_selling_price_policy`: 1,319 records (1,318 active, 1 inactive), active split 1292 zero, 23 at 33%, 2 at 32%, 1 at 40%. This is a live SKU policy, not identical row population to 627 current approved costing SKUs.
- `costing.sku_scheme_policy`: 1,326 active rows (663 IK, 663 OK), 5 inactive IK rows, all 1,326 active records resolve through `costing.scheme_master` to `No Scheme` 1+0.
- `costing.scheme_master`: six active choices: 1+0, 5+1, 8+1, 11+1, 16+2, 100+30. Available schemes are not assigned to currently active SKU policy rows.
- `costing.scheme_policy_rules`: no rows at time of audit; global/group/subgroup precedence is **not currently populated in database**. Working Sheet design must define independent rule hierarchy without assuming existing DB global policy.

## Safe design recommendation for Stage06B
Start with **one SKU-grain marketing promotions working tab** for all 627 current master SKUs to guarantee exact identity and easy verification; include source master SKU ID, Item, Pack, IK/OK eligible. Adjacent side-by-side per-region **Current Reference Discount %**, **Working Discount %**, **Current Reference Scheme Paid/Free**, **Working Scheme Paid/Free**. Initialize working columns once as values, not formulas referencing baseline. For scope-wide changes consider an optional slim policy override/control layer later, only if demonstrated needed, rather than duplicating global/subgroup values across manually edited rows. Working values for unlisted regions should not imply proposal eligibility. Distinguish 0 discount vs blank and default/no-scheme paid1/free0. Require explicit validation (discount bounds, paid>0, free>=0, dates if effective). No proposal formulas yet.

## Current checkpoint
Workflow 01–05 reconciled as completed in `WORKFLOW_MASTER_AND_PRIME_COST_AUDIT_20261022.md`. Stage06A audit completed; Stage06B working model construction **not yet implemented**. Do not skip model review/validation or overwrite working values on refresh.
