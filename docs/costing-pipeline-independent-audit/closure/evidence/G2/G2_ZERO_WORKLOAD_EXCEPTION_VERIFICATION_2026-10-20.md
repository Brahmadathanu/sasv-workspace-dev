# G2 zero workload exceptions: independently verified 20 October 2026

Status: READ-ONLY LIVE VERIFICATION; no schema/data changes.

The earlier full-cohort sensitivity showed 453 DL workload records, 445 positive candidate rows and eight zero candidates. Separate read-only queries of `costing.product_direct_labour_workload_snapshot` (run128) resolved the eight: all are `READY_ZERO_MANUFACTURING_LABOUR`, frozen workload zero, financial allocation zero. They are not missing calculation data. Product IDs: 102 Balasarvangam Soft Gel Capsule; 103 Chathilinga Thailam Soft Gel Capsule; 106 Ksheerabala Thailam 101 Avarthi Soft Gel Capsule; 108 Nirgundyadi Erandam Soft Gel Capsule; 686 Sudhi Avanakkenna; 687 Sudhi Veppenna; 724 Mailanchi Podi; 725 Neelayamari Podi.

Current DL status distribution: READY=444, allocation 706156.5503846977; READY_ZERO_MANUFACTURING_LABOUR=8, allocation 0; REVIEW_REQUIRED_FOUNDATION=1, allocation 46.4496153023. Sum=706203 (frozen eligible manufacturing labour). **Eight zero-workload rows must remain distinguishable from broken or absent positive workloads, not counted as unclassified exceptions.** Their underlying route/exclusion policy merits verification before changing logic.

Production-overhead snapshot run128 has 453 rows; workload sum 4171.5454088574345; route factor sum 13134.75. Status: READY=444; READY_ZERO_PRODUCTION_OVERHEAD=8; REVIEW_REQUIRED_MONTHLY_DRIVER=1. The identity match of eight zero-OH and zero-DL records was NOT yet verified; no POH monetary sensitivity computed.

Read-only SQL:
```sql
SELECT workload_status,count(*) AS n,sum(product_direct_labour_allocation) AS allocated
FROM costing.product_direct_labour_workload_snapshot
WHERE refresh_run_id=128 GROUP BY workload_status ORDER BY workload_status;

SELECT product_id,product_name,workload_status,direct_labour_workload_units
FROM costing.product_direct_labour_workload_snapshot
WHERE refresh_run_id=128 AND workload_status='READY_ZERO_MANUFACTURING_LABOUR' ORDER BY product_id;

SELECT workload_status,count(*) AS n FROM costing.product_production_overhead_workload_snapshot
WHERE refresh_run_id=128 GROUP BY workload_status ORDER BY workload_status;
```

G2 remains IN PROGRESS. Retain a legitimate ZERO_SCOPE category in any replacement calculation, separate from ERROR/MISSING. Recalculate complete alternate expense pool only after eligibility and route validity test. No approved run changes, cron, switch, migration or merge.
