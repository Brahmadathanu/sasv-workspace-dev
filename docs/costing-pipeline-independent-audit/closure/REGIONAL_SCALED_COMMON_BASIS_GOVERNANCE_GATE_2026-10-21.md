# Regional scaled common-basis governance gate — 21 October 2026

Owner endorsed automatically recalculating approved scaling methods with new actual sales quantities **only if** method and input sources are independently verified as governed. Read-only stage; no SQL migration or final refresh.

Current residual run134 83 reviewed regional rows, 57 distinct SKUs, after continuity reuse of 117 approved rows. Examined actual source formula in costing.rpc_refresh_sku_regional_marketing_allocation_basis_snapshot(date,date,bigint): resolved regional base qty = common_resolved_base_qty * regional_positive_actual_share, when positive regional evidence and positive common basis, with no usable regional SKU actual or regional assumption. Pricing bridge already consumes effective acceptance status.

Source decomposition for 83 residual:
- 48 rows with common_basis_source ACTUAL_MONTHLY_MAX, common_basis_status READY. Candidate for governed routine recalculation; must verify frozen monthly quantity source and regional share lineage, input eligibility and denominator accuracy before changing automatic review status.
- 35 rows with common_basis_source DEFAULT_NEW_SKU_EXISTING_PRODUCT, common_basis_status REVIEW_REQUIRED. These **must retain review**, because the underlying common SKU volume is a default rather than verified actual quantity, regardless of observed region share.

Thus do not waive entire 83. Proposed minimum implementation gate: when scaling source is ACTUAL_MONTHLY_MAX and independently proven physical evidence governed, and region share is sourced from eligible signed actual sales within cutoff, treat recalculated quantity as governed by method, preserve explicit estimated-source label and value provenance. Do not grandfather a default, ambiguous or unsupported input; preserve changed billed-value validation separately. Investigate whether sales numerator changes are independently governed changes rather than exceptions. Negative tests for default, missing denominator, missing actual region evidence, invalid/unapproved policy, stale period, and unrelated source switches mandatory.

G6 and Sheets blocked; no refresh or approval initiated.
