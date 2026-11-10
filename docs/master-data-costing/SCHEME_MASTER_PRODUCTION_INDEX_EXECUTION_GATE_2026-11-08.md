> **R10 LIVE PLANNER EVIDENCE — 10 NOV 2026:** Beyond the valid/ready *already present* covering index, the production query planner **currently chooses the OLD period/status index** in both whole Scheme Master list EXPLAIN and standalone count/distinct/max aggregate EXPLAIN, without running the queries. Top plan cost 44,021.28 vs earlier 45,043.50; new covering index `idx_scan=0` at readback. [R10 bounded evidence](WP05_R10_SCHEME_MASTER_LIVE_PLANNER_INDEX_CHOICE_2026-11-10.md). **Do not rerun index creation, force an index, raise timeout or claim 57014 fixed** on this evidence. The old dated execution plan below remains historical.

> **SUPERSEDING LIVE CATALOGUE STATUS — 10 NOVEMBER 2026, IMPORTANT:** The proposed index `costing.idx_sku_scheme_viability_snapshot_scheme_period` **NOW EXISTS, VALID AND READY** in production (exact B-tree `scheme_id,period_start`, size **1,752 kB**). Its SQL catalogue `pg_stat_user_indexes` counters at review read `idx_scan=0, idx_tup_read=0, idx_tup_fetch=0` (counters subject to reset, not lifetime proof). This reverses the **8 Nov ABSENT** preflight observation below; the current date of its creation/operator is **not independently known**. **DO NOT RUN THE UNAPPLIED CREATE INDEX SCRIPT AGAIN**, and do not call this a demonstrated performance fix: historical PostgREST 57014 failures and cold-path behavioural proof remain separate. Before any future performance action, verify planner choice/real requests, index identity and permission/maintenance authority. [10 Nov reconciliation](WP05_R9_HISTORICAL_F_RECOVERY_RECONCILIATION_2026-11-10.md). The original dated preflight/runbook below is retained for audit history and **IS NOT A CURRENT EXECUTION REQUEST**.

# Scheme Master covering index — production execution decision and rollback runbook

**Prepared 8 November 2026. Status: PLANNED / NOT AUTHORISED / NOT EXECUTED.** Work package: issue #224 and isolated candidate #227. Production target: Supabase project `qhmoqtxpeasamtlxaoak`, `costing.sku_scheme_viability_snapshot`. This document does **not** authorise index creation, VACUUM, ANALYZE, privilege or schema changes, or a costing refresh. Costing Suite remains **5/13**.

## 1. Candidate and rationale

Exact additive candidate lives in [scheme-master-perf-candidate-227/candidate_index.UNAPPLIED.sql](scheme-master-perf-candidate-227/candidate_index.UNAPPLIED.sql):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sku_scheme_viability_snapshot_scheme_period
  ON costing.sku_scheme_viability_snapshot (scheme_id, period_start);
```

Purpose: support count/count-distinct/max of viability snapshot periods for each Scheme Master without fetching `period_start` from wide heap tuples. Existing scheme-only index remains. View, 34 columns, permissions and run selection remain unchanged. Isolated synthetic test 231k rows: warm P50 ~95 ms baseline → ~35 ms after new index; **not proof of production performance**. An aggregate-once rewrite had no independent advantage and was rejected.

## 2. Verified preflight snapshot (read-only, 8 November 2026)

| Parameter | Verified result |
|---|---|
| Proposed index name in catalog | **ABSENT** (zero catalog rows; includes invalid residue) |
| View definition MD5 | `8fdc0306bd2f1efbe0638c7c13ba4dda` |
| Scheme Master table | Seven schemes |
| Snapshot estimated live tuples | 231,340 |
| Snapshot heap and total sizes | 343 MB and 446 MB |
| relpages / relallvisible | 43,964 / 29,212 = **66.4% all-visible** |
| Estimated dead tuples | 41,550 |
| Autovacuum enabled | yes; latest autovacuum 20 Oct 2026 |
| Last ANALYZE | 1 Nov 2026 |
| Session snapshot | Four idle ClientRead sessions, two extension/background sessions, no open user transaction observed |
| pg_stat_replication | 0 streaming connections; **does not certify other replication/archival responsibilities absent** |

No SQL other than read-only inspection was used here.

## 3. Mandatory fresh GO/NO-GO controls (must rerun just before production maintenance)

1. **Owner authorisation:** identify a named execution operator, maintenance window, rollback owner and communication to dependent Costing Suite users. No execution without a specific owner instruction distinct from merging this doc.
2. **Stable catalog contract:** view fingerprint exactly matches value above; existing scheme-only index present; proposed index name absent (zero rows, including invalid); snapshot table columns `scheme_id, period_start` and B-tree compatibility unchanged. On drift, STOP, investigate, do not assume name-only `IF NOT EXISTS` succeeds safely.
3. **Space:** confirm actual free PostgreSQL/volume capacity, not just database size; allow headroom for index build, WAL, temporary work and concurrent writers. The 1.76 MB synthetic index is **not** a valid live capacity estimate. If storage headroom is unconfirmed, NO-GO.
4. **Activity, long transactions, locks and scheduled jobs:** check `pg_stat_activity`, `pg_locks`, `pg_stat_progress_create_index`, costing refresh/jobs, other migrations and Supabase health. Pause only through separately approved scheduling controls if needed. Any unexpected active maintenance, long-running reader or lock: postpone.
5. **Replication/backups:** check available Supabase dashboard metrics and WAL/replication status. `pg_stat_replication=0` alone is insufficient to conclude no replication impact. Confirm no elevated lag or backup/maintenance collision.
6. **Visibility:** 66.4% pages all-visible; do not assume full index-only scan performance. `ANALYZE` updates planner stats and **does not** update visibility-map bits; `VACUUM` has separate work and authorisation. Do **not** automatically VACUUM.
7. **Operator capability:** `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` must execute as single statements **outside any transaction**. Supabase `apply_migration` is not the permitted path. Do not use a tool that automatically wraps queries in a transaction. If no proven nontransactional SQL execution path exists, NO-GO.
8. **Operational limits:** approved operator must set bounded session/lock timeout, monitoring and abort criteria compatible with concurrent index build; no unsupported assumption that cancelling creates no invalid residue.

## 4. Proposed execution *only after explicit approval*

- Capture preflight audit (view MD5, source indexes and their validity, dimensions, live session/lock and storage status).
- Execute exactly the single additive `CREATE INDEX CONCURRENTLY` from the reviewed candidate. Do not drop/rewrite the old scheme-only index, view, grants or anything else.
- Watch for wait-on-old-snapshot/build progress, locks, storage/WAL growth, application errors and job interference. If outside approved limits, stop and inspect `pg_index` for possible INVALID/NOT READY index. **Do not use `IF NOT EXISTS` to mask such failure.**
- Perform the read-only verification script from the candidate, plus nonexecuting `EXPLAIN` for `SELECT * FROM public.v_costing_scheme_master_register ORDER BY scheme_name LIMIT 1000`. Require the intended index to be valid and ready, and view MD5 unchanged. If the planner does not choose the new index, treat outcome as UNPROVEN; do not force a view rewrite.
- Decide whether a **separate** bounded `ANALYZE` or `VACUUM` is justified from fresh stats/visibility and a further owner decision; no automatic secondary maintenance.
- Conduct one owner-authorised genuine ID-V authenticated desktop 1280px read-only test (and a 390px reference) once new index is verified, with a freshly obtained session, one browser context, clean network log and redacted evidence. **A successful single run proves that run passed, not intermittent timeouts permanently eliminated.** Prefer a few safe cold-ish repeats at different times before closing issue #224; no broad 40-lens rerun.
- Report actual latency observations and any 57014 failures, storage size/index stats, final status and remaining limitations. If previously reported timeout recurs, do not falsely close WP06.

## 5. Stop/rollback

Rollback SQL is in [candidate_index.ROLLBACK.sql](scheme-master-perf-candidate-227/candidate_index.ROLLBACK.sql): `DROP INDEX CONCURRENTLY IF EXISTS costing.idx_sku_scheme_viability_snapshot_scheme_period;` **outside transaction**, after index identity confirmation and explicit rollback authority. This drops only the added index; underlying data/view/grants remain. On failure/invalid residue, capture catalog evidence before any approved drop; concurrently built invalid indexes can consume resources and may affect writes. Do not issue a blind migration re-run.

**NO-GO:** unverified storage, unresolved locks/transaction, competing refresh/DDL, replication/backup concerns, invalid existing index, SQL execution path transaction-wrapping uncertainty, view contract drift, unauthorised maintenance or inability to monitor/rollback.

## 6. Acceptance and formal closure are distinct

Even if the index works, WP06 remains OPEN until Scheme Master desktop acceptance, CSA modal read-only evidence and owner decisions G-SCOPE/G-BUILD/C6/C9/D3/D7/F-4 are reconciled with [WP06 owner-decision package](WP06_OWNER_DECISION_PACKAGE_2026-11-08.md), the shared §8 acceptance contract and the work-pack Gate Status. No automatic 6/13 increment.
