# Step 110 — Release audit after corrected Step108/109 baselines

Verified exact Step104 source expressions:
- DL old_shared subtracts monthly_product_base_qty/preferred_batch_size * step_labour_factor * fn_au9_g4_route_step_loads. This properly includes existing stage equipment multiplier when mode falls back to legacy.
- POH old_shared subtracts monthly_product_base_qty/preferred_batch_size * scope*behaviour*resource*occurrence * fn_au9_g4_route_step_loads * standard_cycle_count. This also captures legacy step multiplier.
- New joint stage uses fn_price_revision_joint_stage_load, one factor for both, and fn_joint_stage_member_workload to avoid duplicate common cycles.
- Both replacement definitions have previously passed transaction rollback DDL parse. They have NOT run during an actual prospective refresh.
- Overhead and direct-labour source route step snapshots remain unmodified, and are therefore ROUTE EVIDENCE not joint attributable workload evidence. Need deliberate dual lineage (route evidence + joint allocation audit) before price approval.
- Activity197 manual cloth return=1 is a provisional stage policy assumption: it is not an independently measured manual processing time. Do not present as proven physical 1 load.
- As of latest verified, AU9 G4 cutover prospective date still not active, and no prospective run exists. No Step104 deployment.

**Release HOLD** until (a) inspect all pool caps/statuses and snapshot provenance using live data, (b) establish durable joint-stage attribution audit for later traceability, (c) approve and implement governed Oct AU9 mode and staged regression, (d) verify both full refreshes on an actual governed run, and (e) reconcile rupee pools + SKU costs. This is NOT a new user approval requirement for 105:5 policy.
