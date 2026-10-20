# G2 manufacturing driver source audit — 20 October 2026

Read-only pg_proc examination, no live writes.

`costing.fn_preview_direct_labour_shadow_workload` step labour intensity = sum(scope_factor * attendance_factor * expected_occurrence_count * standard_cycle_count). Its frozen foundation carries standard_batch_count and production_batch_size_ref identity. Thus product51 duplicate 8x8 repetition remains a concrete issue; other genuine cycles cannot be indiscriminately removed.

`costing.fn_preview_production_overhead_workload` computes route_factor = sum(scope_factor * behaviour_factor * resource_factor * expected_occurrence_count * standard_cycle_count). Its recipients CTE explicitly aggregates `monthly_product_allocation_base_qty` from `costing.sku_sales_allocation_basis_snapshot`, then defines monthly_batch_equivalents = monthly_product_base_qty / preferred_batch_size and rounded_batch_count = ceil(monthly_product_base_qty / preferred_batch_size). **This establishes sales-allocation-derived quantities directly affect its preview batch-equivalent driver.** It does not by itself prove which snapshot final writer is active, which policy is effective, or whether an independent actual-production driver supersedes this calculation.

The agreed manufacturing principle is actual justified manufacturing batch work, not sales-based manufacturing allocation. `public.production_batch_size_ref` remains the authoritative standard batch reference; correcting quantity driver must not mutate it. Identify downstream workload calculation, production output data coverage, actual-vs-standard fallback, policy activation and both pool money conservation before proposing modification. This is a G2 implementation blocker, not just historical route research.

No live changes, G2/CI-032 OPEN. Next verify exact rows_with_workload expression and DL counterpart, then scope minimal aligned driver replacement and separate packing labour.
