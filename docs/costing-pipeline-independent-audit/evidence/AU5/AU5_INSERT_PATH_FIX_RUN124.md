# AU-5 insert-path fix + October run 124 (2026-10-16)
Run 123 failed at stage 03: post-step UPDATE hit trg_immutable_sku_production_overhead_allocation_snapshot.
Fix: migration 20261016170817 au5_insert_path_batch_true. The POH and Manufacturing-Labour writers use workload = route factor x UNROUNDED qty/batch_size_ref when fn_batch_true_effective(valuation_date) is true. Full pool is allocated over that workload, which equals the NORMAL_VOLUME_RATE standard. No UPDATEs; immutable, designated-run and lineage triggers unchanged (3 immutable triggers still present). The chain post-step call was removed and fn_apply_batch_true_standard retired (returns RETIRED_USE_INSERT_PATH).
Gate: Sep 10 -> false; Oct 16 -> true.
Tests: local (costing_local) compile and gate, rolled back. au5_local with the live immutable trigger: old applier reproduces "Production Overhead snapshots are immutable". Read-only simulation on live run 122 inputs: POH 670,935.04 absorbed, variance 0, rate 423.7112; labour 706,203 absorbed, variance 0, rate 504.7689; Mehasamani 20 g conversion 2.00 (POH 0.86 + labour 1.14); Thampira 5 g conversion 8.53 (2.92 + 5.61).
Run 122 fingerprints after the fix are identical (POH ef42f1b8, DL a9c98380, COP 26712633, prime 3b6909f4, pricing abeed46c).
## Run 124 (Oct 2026, valuation 2026-10-16): SUCCESS 17:35 UTC (23:05 IST); 0 blocked / 621 review / 13 ready
Variance: POH pool 670,935.04, absorbed 670,935.04, variance 0, rate 423.865 (460 batch-true); labour 706,203, absorbed 706,203, variance 0, rate 505.005 (452 batch-true, 8 zero-labour routes).
Mehasamani 20 g: conversion 2.00; manufacturing COP 113.37 -> 28.75. Thampira 5 g: conversion 8.54; COP 3,886.71 -> 89.65. SKU 1797: 23.03 -> 22.01.
COP vs run 122 (634 SKUs): 213 up >5%, 173 down >5%, 248 within 5%; median ratio 1.028; material cost moved >5% on 83 SKUs.
Acceptance harness: all PASS except 6 VALUATION_DATE_LOCKED_OR_FINAL (Oct is DRAFT; not locked by instruction), hence EVIDENCE row FAIL md5=a2c15d29. Check 25 manual sign-off pending.
Review jump 146 -> 621: 612 MATERIAL_REVIEW_REQUIRED (stale/fallback/manual rate lines broadly unchanged, 2,180 -> 2,345 stale). Material rate-issue acceptances in Sep do not appear to carry to Oct (16 Oct valuation). Not caused by AU-5.
Not approved, not locked. Jobs 60 and 61 paused.
