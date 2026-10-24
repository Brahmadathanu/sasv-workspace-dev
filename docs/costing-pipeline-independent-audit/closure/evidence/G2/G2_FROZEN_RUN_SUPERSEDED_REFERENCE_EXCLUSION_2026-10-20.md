# G2 frozen-run superseded reference check — 20 October 2026

Verified with separate read-only SELECT statements over `costing.product_direct_labour_workload_snapshot` and `costing.product_production_overhead_workload_snapshot`. Each query counted matches against the full previously retrieved set of 18 non-archived superseded family-route IDs and nine superseded product-route IDs, restricted to refresh_run_id 122 and 128.

Results: run122 DL family 0/product 0; run128 DL family 0/product 0; run122 POH family 0/product 0; run128 POH family 0/product 0. This establishes that none of the identified predecessors is referenced by these two run snapshots, but does not prove non-use in other runs, historical production documents, or underlying activity logs. The 17 overlapping approved/superseded pairs remain unresolved for historical as-of calculation.

No live modifications. G2 OPEN; no change to protected snapshot data or route records.
