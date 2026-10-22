# G0 Step 60 — Confirmed conversion-workload multiplication point
Read-only DB pg_proc.prosrc inspection, 2026-10-22.

Existing function costing.fn_preview_direct_labour_shadow_workload computes direct_labour_route_intensity as sum(scope_factor * attendance_factor * expected_occurrence_count * standard_cycle_count) per product. Its emitted step evidence uses equivalent per-step factor.

Existing costing.fn_preview_production_overhead_workload computes route_factor as sum(scope_factor * behaviour_factor * resource_factor * expected_occurrence_count * standard_cycle_count) per product and emits step_factor with that product-centric multiplication.

Refresh functions costing.rpc_refresh_sku_direct_labour_legacy_snapshot and costing.rpc_refresh_production_overhead_workload_snapshot consume route workload evidence for snapshots/expense distribution; overhead refresh also tests equipment load and uses fn_route_step_loads. Exact downstream shape and impact need separate tests; these formula identifications are not claims of already executed changes.

101 and 41 independently have 101 and 41 cycle counts for four matched repeated steps = 142 summed versus 101 actual manufacturing cycles (41 shared once + 60 continuation 101 only). Appropriate place to fix is governed workload construction before pool denomination and allocation, with common process expense once and an approved split to product outputs; preserve total allocation expense pools and independent RM BOM, QC, finishing and PM. Physical batch reference 110kg, outputs 5kg and105kg. Physical split 5/110,105/110 currently only candidate for COMMON portion, not yet approved policy.

Critical: AU9 capacity workload multiplication may apply additionally to manual cloth filtration; cannot globally disable MANUAL or equate liquid oil cloth filtration with SOLID_CHARGE_KG. Preserve machine-assisted recollection activity169.

Implementation must be generic reusable joint-process relationships, not a product-id patch and not post-hoc COP manipulation. Test historical run136 immutability and full expense pool conservation. No production DB changes. G0 open.
