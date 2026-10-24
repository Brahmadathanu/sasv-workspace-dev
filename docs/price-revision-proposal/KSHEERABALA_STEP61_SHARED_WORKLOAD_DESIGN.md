# G0 Step 61 — Shared-process workload contract (proposal, not deployed)
2026-10-22. Dedicated Price Revision Proposal programme. Run136 (2026-10-20) frozen.

## Verified inputs
Products 183 (101 Avarthi, 105kg standard output) and 184 (41 Avarthi, 5kg withdrawal) are two outcomes of a 110kg joint operation. Four common repeated steps are base-step IDs 1389,1390,1391,1392. Their independently modeled standard cycles are 101 and 41, respectively. Unique actual manufacturing cycles for each shared repeated activity are 101, not 142: common 1–41 and continuation 42–101. Current labour preview multiplies scope*attendance*occurrence*cycle; overhead preview scope*behaviour*resource*occurrence*cycle. Production overhead refresh distributes company pool via product workload units/company workload and product-to-SKU monthly allocation share, so simply subtracting 41 per product *after* product allocation would be incorrect.

## Smallest sustainable upstream treatment
A governed joint process must create one *physical-workload event* per common step and one per continuation step, then credit product beneficiaries through explicitly approved weights. Let C_j be true per-cycle conversion intensity of step j after applying activity attendance/resource basis (not blindly solid-kg manual loads). Define W_common_j = 41*C_j; W_continuation_j=60*C_j. Common beneficiary shares a41 + a101 =1 with 0<=a<=1. Then W_41,j=a41*W_common_j and W_101,j=a101*W_common_j + W_continuation_j. Identity W_41,j + W_101,j =101*C_j, versus legacy independently summed 142*C_j. Do not use these formulae as monetary values; after period/batch scaling, both direct-labour and overhead pools must still reconcile fully. Independent preparation, final transfer, QC, filling and packaging must remain scoped according to physical operation and not automatically moved into common cycles.

The previously discussed physical yield basis is CANDIDATE ONLY: a41=5/110=1/22, a101=105/110=21/22. Requires governance decision on whether physical volume, equivalent unit/value or another justified co-product split is appropriate. If approved, common share across repeated steps: 41 output receives 41/22=1.86363636 equivalent cycles per activity, 101 output receives 60+(41*21/22)=99.13636364, total101. These are workload shares, NOT altered route standard_cycle_count values or direct labour hours. Actual physical batch frequency must be common: do NOT multiply 41 output by its tiny independent monthly sales proxy if the 41 co-product is necessarily manufactured alongside the 101 batch; joint reference production quantity and SKU allocation driver compatibility need governed verification.

## Implementation boundaries
Use minimal generalized *joint manufacturing relationship + shared stage membership + allocation basis* within upstream workload producer (or one shared helper consumed by labour and overhead), rather than product-ID conditionals, arbitrary machine assignments, or post-cost sheet price edits. Preserve source route evidence (101 and41) as physical path description; attach allocated vs gross physical intensity provenance. Ensure no double scaling by AU9 equipment loads: capacity multipliers only where the physical activity uses valid equipment, manual cloth filtration base1391 activity197 requires explicit manual workload basis. Hydraulic recollection step1392 is machine-assisted separately.

## Required regression tests
1. Four steps: sum shared+continuation physical cycle workload = 101*C_j (not142); common beneficiary shares sum1; separately validate no division by zero/rounding loss.
2. Product41 retains output5kg, product101 105kg; no shared RM/BOM or duplicate final/QA/PM output. Preserve independent and joint process snapshots.
3. Company labour and overhead total allocations = respective frozen period pool totals, with all other products unchanged absent denominator rebalance effects; denominator changes must correctly rebalance shares company-wide.
4. Period demand/standard batch drivers must reflect mandatory co-production, no artificial 0.091kg 41-only production; test common batch basis and SKU-level apportionment.
5. 2026-10-20/run136 unchanged; prospective October run uses only approved switch date and traces all dated policy IDs. Fail closed when common split not approved, route divergence, unsuitable equipment or workload basis unavailable.
6. Price revision data output only after approved fresh run.

## Status
Design and algebra established; NOT approved financial split, NOT deployed. Next step inspect actual batch denominator and upstream snapshot equations then implement verifiable generalized relationship. G0 OPEN.
