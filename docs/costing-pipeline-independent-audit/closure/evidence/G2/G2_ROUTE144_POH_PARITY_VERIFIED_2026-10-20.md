# G2 route144 and production overhead parity — verified 20 October 2026

Status: **VERIFIED read-only** against approved run128; calculations diagnostic only. No live mutation.

`costing.product_direct_labour_workload_snapshot WHERE refresh_run_id=128 AND family_route_id=144` returns only product51 Dhanyamlam, `product_route_id IS NULL`. Other products are not evidenced as recipients of route144 in the frozen run. Future effective master assignments still require validation before a prospective patch.

`costing.product_production_overhead_step_snapshot WHERE refresh_run_id=128 AND expected_occurrence_count>1 AND standard_cycle_count>1 GROUP BY product_id` yields product51, six rows. Product51 nine POH steps: seq10 factor0, seq20 1, seq30 1; seq40/50/60 each 64 at occurrence8/cycle8; seq70 16 at 8/8; seq80/90 zero at 8/8. Current raw POH total 210; with user-confirmed eight total repetitions, illustrative normalized factors seq40/50/60 = 8 each, seq70=2, unscaled total **28**. The comparison is not a deployed route intensity or pool share and does not validate equipment charges or POH workload cap.

This independently confirms the duplicate-count problem exists in BOTH financial pool step snapshots, not merely DL. Separate prospectively governed route source correction shall be tested across both writers. Preserve original approved 122/128 snapshots and audit lineage; do not use these figures to revise financial prices.

Reproduce using read-only SQL:
```sql
SELECT product_id,product_name,family_route_id,product_route_id FROM costing.product_direct_labour_workload_snapshot WHERE refresh_run_id=128 AND family_route_id=144 ORDER BY product_id;
SELECT product_id,count(*) n FROM costing.product_production_overhead_step_snapshot WHERE refresh_run_id=128 AND expected_occurrence_count>1 AND standard_cycle_count>1 GROUP BY product_id;
SELECT product_id,sequence_no,expected_occurrence_count,standard_cycle_count,step_factor FROM costing.product_production_overhead_step_snapshot WHERE refresh_run_id=128 AND product_id=51 ORDER BY sequence_no;
```

Next: prospective source route and active assignment check, two-pool sensitivity with complete eligible workloads, immutable fingerprint guards, physically justified equipment charges and consolidated user approval. G2/CI-032 OPEN; no live changes.
