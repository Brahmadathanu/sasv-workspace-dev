# SASV Costing Suite — Database Growth and Retention Governance (3 Nov 2026)

**Status:** Stage A read-only evidence collected; Stage B policy decision NOT approved. This is a **sub-workstream of the existing Master Data / Costing Suite programme**, not a separate programme. Source: production Supabase project `qhmoqtxpeasamtlxaoak`, GitHub main `85a163f2bc36476953939bfb637b81f632d6b9b9`. No retention writes, migrations, maintenance, costing runs or flags performed.

## Priority, resource vs billing

Production project reported **ACTIVE_HEALTHY**. Database query timestamp 2026-11-03 05:57 UTC: `pg_database_size` = **18,456,898,707 bytes (~17.19 GiB)**; costing heap/index/TOAST totals **14,691,287,040 bytes (~13.68 GiB)**, public **3,419,922,432 bytes (~3.19 GiB)**. These are PostgreSQL database/relation measurements, **not provisioned disk, WAL, capacity %, current invoice, allowance balance, or the triggering warning category**. The actual Supabase dashboard warning and project-specific billing/usage must be inspected in the organization's Usage and Billing dashboards. The subscription was previously reported as Pro; `get_project` does not return subscription/billing details.

Current Supabase platform documentation (checked 3 Nov 2026): Pro gp3 provisioned disk includes 8 GB, excess provisioned GB-month charged at $0.125/GB-month; the provisioned disk rather than database table bytes is the billing basis. Paid disks autoscale and provisioned disk does not automatically shrink after logical deletes; a reduction in relation size is **not itself proof of immediate invoice reduction**. Sources: https://supabase.com/docs/guides/platform/manage-your-usage/disk-size and https://supabase.com/docs/guides/platform/database-size. Do **not** calculate a project charge until provisioned disk and disk type are confirmed.

## Largest physical relations (pg_total_relation_size, approximate MiB)

| Schema/table | Total | Heap | Index | TOAST / other |
| --- | ---: | ---: | ---: | ---: |
| costing.cost_sheet_line_traceability_snapshot | 3412 MB | 2482 MB | 404 MB | 525 MB |
| costing.marketing_regional_sales_evidence_snapshot | 3001 MB | 2474 MB | 526 MB | <1 MB |
| costing.marketing_signed_billed_sales_evidence_snapshot | 2635 MB | 2098 MB | 536 MB | <1 MB |
| costing.cost_sheet_line_monthly_snapshot | 1264 MB | 987 MB | 276 MB | <1 MB |
| public.tally_group_outstanding_snapshot | 869 MB | 429 MB | 440 MB | <1 MB |
| costing.sku_rm_material_cost_line_snapshot | 660 MB | 454 MB | 205 MB | <1 MB |
| costing.cost_sheet_rm_line_traceability_snapshot | 630 MB | 538 MB | 91 MB | <1 MB |
| public.tally_fg_transfer_voucher_lines | 570 MB | 283 MB | 287 MB | <1 MB |

The four largest costing relations are ~10.1 GiB of table+index space (~10.3 GB if MB labels summed); **no recoverable saving is proven** from their size alone. PostgreSQL statistics on 3 Nov: estimated dead rows 0 in both cost-sheet tables and signed/billed table, and ~115,162 in regional evidence (versus ~5.78m live), so mass bloat is not established as the dominant cause; normal autovacuum has run.

## Run-multiplication evidence (live SELECT; no content-equivalence conclusion)

- Marketing **signed/billed** and **regional** evidence each contain **109,162 rows per successful October run** for runs 124, 125, 126, 127, 128, 130, 131, 133, 134, 135, 136, 138, 139, 140, 143 and 148. Their source voucher range is 2025-10-01 to 2026-09-30 for these October runs.
- Earlier September runs each contain **108,982 rows per run** in those two evidence tables; November run 149 contains **111,012** rows per table.
- Cost-sheet line traceability shows roughly **27,588 rows per October run** (run 148 has 27,632); several September runs show ~27,896–29,568.
- The *identical per-run counts* establish repeated full-sized materialisation, **not identical contents** or safe deduplication. Data fingerprints, source cutoff, differing run statuses, capture times, and downstream consumers must be compared before a policy decision.
- Run ledger counts: October 18 runs (16 SUCCESS, 2 FAILED); September 38 (28 SUCCESS, 10 FAILED); July 59 (56 SUCCESS, 3 FAILED); November 1 SUCCESS (run 149).
- Latest designations: run 122 (September) **APPROVED**, run 143 (October) **APPROVED**, run 119 **REFERENCE**; run 140, 136 and 128 **REVOKED** (must retain audit explanation); runs 148 and 149 **SUCCESS but currently no explicit designation**; run 147 **FAILED**. **UNCLASSIFIED does not mean disposable.**

## Retention classification — provisional, NOT a deletion list

1. **Protection class A (always preserve pending formal archival design):** APPROVED and locked run snapshots, fingerprints, source evidence, designations, approvals, and audit records (at least 122 and 143); REFERENCE 119 and historic fixed-run UI evidence 80/82; REVOKED or superseded runs 128/136/140 where comparisons/approval histories rely on them.
2. **Protection class B (consumer / audit review required):** successful runs without formal designation, especially 148/149 and intermediary runs; failed/abandoned runs and partial stage evidence; historical periods and source-cutoff records. No automatic delete or age-based expiry.
3. **Candidate for future design, not cleanup:** marketing evidence repeated within the same source-cutoff/period across runs. Evaluate content-key equivalence and an immutable, fingerprint-addressed evidence store **only after** establishing full run-to-evidence mapping, retrieval, backup, and byte-for-byte restoration. Retain run-specific metadata and immutable run identity.
4. **Non-costing public ETL storage:** assess separately with Tally/ETL owners; not automatically eligible for Costing retention changes.

## Stage A follow-up queries and contract audit

- Obtain exact Supabase warning screenshot or dashboard Usage > Disk size / Disk size distribution / Spend Cap / Billing overages, project selection, provisioned disk type+size, allocated and used %, current $ charge, growth by day. Account billing status is **not accessible** through current project-details SQL.
- Build table-by-run count/estimated byte attribution across `refresh_run_id` snapshot tables and match **every run** to `costing_refresh_run`, `costing_run_designation`, `costing_run_fingerprint` and period governance, including rejected and partial runs. Do not infer sizes per run by dividing whole-table bytes as a financial measurement.
- Query sampled content fingerprints using a stable canonical set excluding `id`, `refresh_run_id`, capture timestamps, and run-specific provenance **only after** reading the exact schemas and source contracts; compare source cutoffs, eligibility and population counts. Use read-only, bounded tests on production; avoid broad full-table hashes during operational hours.
- Trace dependencies through refresh SQL/stage writers, view definitions, RPCs, RLS/grants, pricing/viability source, cost sheet, evidence drilldowns, audit references and run-selection contracts. Do not assume replacement with an aggregate can preserve traceability.
- Review index inventory and actual access patterns before index changes; large indexes are not redundant by size alone.
- Baseline weekly `pg_database_size`, relation size and `pg_stat_user_tables` (estimates), plus true provisioned disk / WAL / billable usage; no unapproved recurring heavy collection.

## Proposed stages and gates

**A. Read-only diagnosis:** reproduce metrics, map physical + run costs and exact billing warning. **PASS only after** cost and run-to-consumer evidence is recorded.

**B. Owner-approved retention/archival contract:** explicit protected-run matrix; lawful governance retention; restored read-only evidence reconstruction; archive storage security, backup and integrity checks; measurable cost model. This is **not authorised** by this note.

**C. Future-growth prevention:** prefer immutable common-source evidence shared by reference across qualifying refresh runs, while preserving run-specific computations and evidence references; estimate on an isolated clone/fixture. This requires design and migration approval.

**D. Controlled migration:** separate PR and explicit owner approval; reversible backfill, hash/signature comparisons, staged opt-in readers, shadow-write/read parity, no production table drop, tested rollback and operational window. Prohibit blanket delete/TRUNCATE, VACUUM FULL, REINDEX, table rewrite or unreviewed retention jobs.

**E. Measure:** actual stored bytes and index bloat, data correctness across approved/ref/failed histories, query latency, and Supabase **provisioned disk** and invoice measurements. Reducing rows may not reduce provisioned disk or bill immediately.

## Programme coordination (3 Nov)

This audit is **infrastructure sustainability within the existing Costing programme** and should not alter MDC-07 N2/N3/N4/W6 client branches. At the audit time main is `85a163f`; draft PRs #134 (N3), #135 (N4), #136 (N2) open; W6 paused at WP06 design gate. Retention policy and any SQL implementation are separately approval-gated. The Electron release checkpoint should consider storage availability/billing risk and avoid coupling a client release to an unapproved database migration. Formal work-pack completion remains 5/13.

## Evidence boundaries

All SQL was SELECT-only. The provided live rows and PostgreSQL sizing are exact at the noted query time, within PostgreSQL's documented size/statistics semantics. No exact Supabase warning metric, duplicate byte content, archival recoverability, savings estimate, or safe deletion classification has been established. Revisit this document on evidence changes; do not treat an audit note as implementation authority.
