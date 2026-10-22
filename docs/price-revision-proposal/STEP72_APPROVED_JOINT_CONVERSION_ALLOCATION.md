# G0 Step 72 — Approved joint-manufacturing conversion cost allocation
Date: 2026-10-22. Status: **USER-APPROVED POLICY; NOT YET DEPLOYED**.

## Decision
The authorised user explicitly approved the common conversion-cost allocation in the Price Revision Proposal workflow:
- One physical joint reference operation yields **105 kg Ksheerabala Thailam 101 Avarthi (product183)** and **5 kg Ksheerabala Thailam 41 Avarthi (product184)**.
- The first **41 cycles** across the four shared Avarthi stages are performed once. Allocate each stage's **common conversion cost** according to physical reference output: product183 = **105/110 = 21/22**, product184 = **5/110 = 1/22**.
- The remaining **60 cycles** (42–101) are attributable **exclusively to product183**.
- Independent RM/BOM, separately attributable preparation/finishing/QC and packaging must remain appropriately charged, not swept into the common pool.
- Approval applies to **common conversion-cost attribution**, not changes to prices, approved run136, physical batch-size references, stock ledger, or deployment.

## Derived conservation invariant
For any shared stage with cycle-cost intensity `C`:
`common_total = 41*C`;
`183_work = (41*21/22 + 60)*C = (2181/22)*C = 99.136363636...*C`;
`184_work = (41/22)*C = 1.863636363...*C`.
Sum = `101*C` without second charging 41 common cycles.
These are **stage-equivalent work weights**, not proof all stage monetary factors are equal. Preserve resource/attendance and machine-specific load provenance before monetary allocation.

## Mandatory implementation controls
1. Encode the approved method in a **generic effective-dated joint-manufacturing policy**, not product-id conditionals scattered in functions.
2. Keep AU-5 batch-true scaling and conserve both company labour and overhead pools; monthly demand is commercial+internal costing proxy, not stock-netted actual production.
3. Preserve manual cloth filtration activity197 as distinct from machine-assisted hydraulic recollection activity169; do not use solid-charge kg denominators without approved basis.
4. No mutation of approved run136/valuation2026-10-20; prospective migration only after AU9 coordinated cutover review, journal and regression checks.
5. Verify result at physical stage, batch-equivalent, product, SKU and company monetary-pool levels. Fail closed on missing yield or allocation lineage.

## Deployment state
No Supabase SQL executed or costing run created by this policy approval. G0 remains open. Next: translate approved policy into a source-controlled implementation and executable regression suite.
