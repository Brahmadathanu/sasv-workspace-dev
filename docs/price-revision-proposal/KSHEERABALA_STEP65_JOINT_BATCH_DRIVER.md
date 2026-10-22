# G0 Step 65 — joint-production reference batch driver
Date 2026-10-22. Proposal only, not deployed. Run136 remains immutable.

Products 183 (Ksheerabala Thailam 101 Avarthi; standard reference output 105 kg) and 184 (41 Avarthi; 5 kg withdrawn). Mandatory joint 110 kg output. Each joint batch produces both outputs and executes common 41 cycles once, 60 continuing cycles only for product183.

## Governing formula — when fixed joint yields and no stock offset
Let D_i be the *net manufacturing requirement* (not necessarily unadjusted SKU sales demand) for each co-product and Y_i physical output per joint reference batch.
For this pair, B_joint = max(D_183 / 105kg, D_184 / 5kg) on AU-5 continuous standard-batch equivalents. Actual factory batch scheduling may round physical runs separately; do not replace costing AU-5 with full-batch ceiling.

Run136 illustrative demand from frozen overhead snapshots:
- product183 D=9.8007 kg => 0.09334 joint batch equivalents
- product184 D=0.091kg => 0.0182 joint batch equivalents.
=> proposed B_joint=0.09334 (101 drives); yielded product183 9.8007kg, product184 0.4667kg.
=> product184 yielded amount exceeds historical sales-based monthly driver 0.091kg by **0.3757kg**. It is co-product stock/inventory, NOT an extra 0.3757kg of sales and not a waste/disposal assumption. Never fake monthly SKU demand to force outputs equal.

Mandatory constraints: corroborate physical yields and whether 5kg byproduct is invariably recovered per 105kg 101 batch; model demand net of usable existing stock and planned disposition before interpreting B_joint as real operating schedule. Allocate common 41 cycles once across both outputs under approved beneficiary cost split; continuation 60 cycles to 101 only. Independent RM BOM, packing and downstream FG accounting remain separate. Do not automatically book future production or stock from this mathematical preview.

## Implementation
Build minimal generic governed joint-process membership/output-yield relation reusable by both labour and overhead workload producers. Joint reference batch equivalents drive *unique physical conversion workload* for linked operations; monetary output split is governed independently, preserve total company labour/overhead pool and SKU sales attribution. Record per-output quantity provenance including surplus/stock rather than hiding it. Allow fail-closed handling of missing co-product yield, demand, stock assumptions and share approval. Do not modify immutable 2026-10-20 run136.

Next: inspect existing net manufacturing/stock inputs and choose conservative v1 semantics, secure approval of shared conversion allocation and implement after AU9 activation checks. G0 OPEN.
