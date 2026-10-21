# Run 134 regional marketing review — 21 October 2026

Read-only live review; no new costing refresh, database mutation, or pricing release.

## Regional evidence (IK/OK rows, not distinct SKU counts)
Of 1,254 region-SKU rows, exactly 200 regional marketing allocation rows remain REVIEW_REQUIRED:
- 131 rows (72 OK, 59 IK): marketing monetary numerator ACTUAL_SIGNED_BILLED_SALES with positive actual product-region billed value, but SKU-level regional actual units unavailable. Denominator REGION_SCALED_COMMON_BASIS, positive scaled units. This is an *estimate*, not an actual SKU sales denominator; the current REVIEW flag is evidence-faithful.
- 68 rows (40 OK, 28 IK): GOVERNED_REGIONAL_DEFAULT value and REGIONAL_DEFAULT_POLICY_UNITS, positive governed 10-planning-unit denominator; no positive actual region billed value.
- 1 OK row: ACTUAL_SIGNED_BILLED_SALES numerator with REGIONAL_DEFAULT_POLICY_UNITS denominator, despite the positive actual numerator. Preserve actual evidence and label assumed denominator.
- Remaining 1,054 region rows are ACTUAL_SIGNED_BILLED_SALES/REGIONAL_ACTUAL_UNITS with READY status (540 IK, 514 OK).

All 200 currently reviewed rows are eligible under existing `costing.fn_regional_marketing_review_status(bigint)` for explicit evidence-specific approval, yet none has an active matching approval (effective_status remains REVIEW_REQUIRED for 200/200). Function fingerprints individual evidence and limits an acceptance to its valuation date; historical frozen rows must not be overwritten. There is already a governed evidence-acceptance mechanism; do NOT add another architecture or globally flip assumed rows to READY.

The final SKU control snapshot distinguishes 131 first-control PRICING_BRIDGE_REVIEW_REQUIRED and 16 MATERIAL_REVIEW_REQUIRED (total 147); pricing bridge has 147 reviewed SKUs including those 16. The latest valid purchase-rate age advisory deployed after frozen run134 produces 627/627 READY in *live material calculation*, but run134 remains immutable. These 200 regional review rows span overlapping SKUs and must not be added to 147 as unique items.

## Proposed review principles for owner discussion
1. Actual regional signed billed value with missing regional SKU units: retain traceable estimated denominator and review, unless a better eligible SKU-unit source can be recovered. Do not label estimates actual.
2. Governed default value/units: retain as explicit estimate, require a documented conscious exception policy or supplied reliable sales evidence, not blanket automatic pass.
3. Existing fingerprint-bound evidence acceptance can handle genuine exceptions. Use it instead of new tables, but review actual client workflow availability and the business meaning of the estimates.
4. No changes to sales value or cost allocation mathematics without tracing pool conservation and SKU differences.
5. No G6 approval, new refresh, or Google Sheets publication until reviewed decisions and final verification.
