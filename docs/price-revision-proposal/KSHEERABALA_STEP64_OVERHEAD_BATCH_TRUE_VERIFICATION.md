# G0 Step 64 — overhead AU-5 batch-true verified from source + frozen run136
2026-10-22; no mutation.

Costing.rpc_refresh_production_overhead_workload_snapshot uses `v_bt := costing.fn_batch_true_effective(p_valuation_date)`, and computes `workload_units = (CASE WHEN v_bt THEN monthly_product_base_qty/preferred_batch_size ELSE ceil(monthly_product_base_qty/preferred_batch_size) END)*route_factor`. Run136 read-only product_production_overhead_workload_snapshot values:
- product183 (101): standard batch105kg, monthly driver9.800700kg, monthly_batch_equivalents0.093340, route_factor621.25000000, workload_units57.987475.
- product184 (41): standard batch5kg, monthly driver0.09100kg, monthly_batch_equivalents0.018200, route_factor169.25000000, workload_units3.080350.
These exactly reproduce existing batch-true scaling. Direct labour Step63 corresponding run136: product183 580.7*9.8007/105=54.202538; product184 152.7*0.091/5=2.779140.

Thus both direct labour and production overhead use existing AU-5 proportional batch equivalents and MUST be retained for normal production. Double counting concern is upstream: independent product-specific Avarthi repeated operations 101+41 and independent monthly output drivers do not model one physical joint process. Generalized co-production physical joint batch driver/common+continuation beneficiary split must be integrated into both workload calculations before respective company-pool denominators, while preserving distinct materials, QC, finishing and packaging. Do NOT infer the monetary correction equals raw 41 repeated cycles without batch-equivalent/provenance adjustment.

Need validate objective operational batch frequency, yield handling, approved common share, complete company-wide pool invariants, October activation/manual cloth filtration corrections. G0 remains OPEN. Run136 unchanged.
