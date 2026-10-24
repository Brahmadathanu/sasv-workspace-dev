# Step 127 — Internal Material Conversion Cost: Run 140, SKU 54 (22 October 2026)

## Scope and safety
Read-only inspection of live Supabase project qhmoqtxpeasamtlxaoak. No refresh, approval, migration, or snapshot mutation. Dedicated Price Revision Proposal workstream only. Parent checkpoint: STEP126_HANDOVER_INTERNAL_CONVERSION_INVESTIGATION_20261022.md.

## Verified implemented SQL
- `costing.rpc_refresh_sku_internal_material_conversion_snapshot(date,date,bigint)` reads run-frozen `product_rm_material_cost_line_snapshot`, approved/effective `internal_material_source_lineage`, and `sku_sales_allocation_basis_snapshot`; recursively invokes `costing.fn_resolve_product_internal_conversion_burden(source_product_id,run_id,visited_ids)`. For each nonoptional consumed internal material: `qty_purchase_form_per_base_unit * source_total_conversion_burden_per_base`; sum by finished product, multiply by `sku_base_qty_per_unit`.
- The recursive source resolver includes (1) manufacturing direct labour = product manufacturing labour allocation / total source manufacturing demand base qty; (2) production overhead = exact-run frozen production pool * source production workload / company ready production workload / source demand base qty; (3) QC overhead = run-specific product QC allocation per base; (4) materials/stores overhead = run-specific *incremental internal-source* stores allocation per base; plus child internal source conversion burden. No source RM purchase cost is part of this conversion calculation. It propagates upstream BLOCKED / REVIEW_REQUIRED and prevents source-product lineage cycles.
- Source manufacturing demand comes from `costing.fn_total_manufacturing_product_demand_as_of`, recorded source `COMMERCIAL_PLUS_INTERNAL_DEMAND`.

## Exact lineage and numbers
Run 140, valuation 2026-10-22, SKU54 finished Product 102 Balasarvangam Soft Gel Capsule, pack 100 Nos; RM line stock1080 Balasarvangam SG Cap, qty 0.00025 kg per finished base Nos; lineage ID3 APPROVED effective 2026-09-01 points to Product277 Balasarvangam Mukkoottu (Kg). Product277 RM line stock1083 points to child source Product275 Mahanarayana Thailam (Internal), 0.03529411764705882 kg per kg of Product277.

Product275: source manufacturing demand 4.4130617647058825 kg; labour 40.87036564108192, production OH 44.640897990135585, QC OH 15.894567310515312, stores OH 0.08182424919255621; total **101.48765519092537 INR/kg**. Source labour allocation 180.36344792020765 from manufacturing labour pool 706203, eligible units 3398.2223506313458; production workload 1.0664899264705883 / company 3632.1544137059195, pool 670935.04; QC allocation 70.14370726457913 / 4.4130617647058825; stores incremental amount 0.04464018178522484 / internal demand 0.5455617647058824; frozen stores pool 260508.53.

Product277: source manufacturing demand 15.457583333333334 kg; labour 17.274656663974245, production OH 16.644127914425553, QC OH 0.993410456907207, stores OH 0.21322844598907656; own subtotal **35.12542348129608 INR/kg**. Labour allocation 267.0244449381039, workload 1.2849116145833333 / company 3398.2223506313458, manufacturing labour pool 706203; production workload 1.3927926649305555 / company 3632.1544137059195, production pool 670935.04; QC allocation 15.355724921847893 / 15.457583333333334; incremental stores allocation 0.060414726363571696 / internal demand 0.2833333333333333.
Child conversion: 0.03529411764705882 * 101.48765519092537 = **3.5819172420326604 INR/kg**.
Product277 total conversion **38.70734072332874 INR/kg**.
Finished Product102 per base Nos conversion: 0.00025 * 38.70734072332874 = **0.009676835180832184 INR/Nos**.
SKU54 pack 100: **0.967683518083218486 INR/SKU** (stored approximately 0.9676835180832185).
Run140 SKU54 RM74.19696493000446, PM11.0616606, material85.25862553000445, finished own direct labour0, internal conversion0.9676835180832185, prime86.22630904808767, manufacturing COP89.4332456047. The zero own labour is explicitly `READY_ZERO_SASV_MANUFACTURING_AND_PACKING_LABOUR` for finished outsourced fully-packed product, not an absence of earlier SASV manufacture.

## Ksheerabala comparison
SKU191 Product183, SKU193 Product184: each `internal_source_line_count=0`, `NO_INTERNAL_MATERIAL_SOURCE`, evidence [], conversion READY and 0. Their own manufacturing labour and production/QC/stores overhead are distinct regular downstream components; zero here only means no approved separately converted internal input.

## Double counting assessment
- The implemented layer *intends* no internal-source RM double count: source intermediate RM lines carry `INTERNAL_SOURCE_PRODUCT_RM_STANDARD_COST` as material (SKU54 RM item1080 rate2967.8785972001783, 0.00025 kg per capsule; Product277 child item1083 rate574.6254208754209), while source manufacturing labour/overheads are separately added once through conversion lineage.
- Finished SKU54 own labour is zero. Its normal finished-product production/QC/stores overhead components (in manufacturing COP) are conceptually for the finished conversion/packing stage, not automatically another copy of Product277/275 source allocations. **However:** common company pools for production, QC and stores are shared by source and finished-product allocation processes; a full accounting audit of whether pool recipient populations and attribution avoid overlap/double absorption is NOT proven by this numerical reconciliation alone. Do not certify end-to-end absence of double-counting without inspecting COP allocation functions, recipient sets and frozen pool conservation across internal and final products. This is a targeted remaining assurance check before declaring stage 02c completely closed.
- The approved October costing figures are not challenged or modified solely by that outstanding methodological check.

## Workflow position
- [x] Internal source expense categories verified from live functions.
- [x] Recursive source lineage, denominator, intermediate expenses, calculation and exact amount reconciled; compare 191/193 done.
- [ ] Complete targeted pool conservation / double counting proof for production, QC and stores, and confirm any final-stage source/recipient overlap; if no defect, close Stage02c component understanding.
- [ ] Next Stage03a audit historical-contaminated price revision views and dependencies. No Google Sheet changes yet.
