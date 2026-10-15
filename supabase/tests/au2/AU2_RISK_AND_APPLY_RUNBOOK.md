# PR #68 (AU-2/2b): production-risk assessment, current-run rule, apply runbook, rollback

Status: DRAFT. Nothing applied live. All live evidence was gathered read-only on 2026-10-15 (IST). D-019: deploy separately from #69.

## Verdict
**Low risk, with two conditions:**
- Apply only between costing runs. The migration's preflight enforces this.
- The user must know that designating run 119 REFERENCE switches September's *current* run to 118. See the rule section below.

No scheduled, API or client path writes to a finished run in the normal flow, so the new guards break nothing that runs today.

## 1. Runtime writer inventory (live)
| Path | What it writes | After a run finishes? | Effect of AU-2 |
|---|---|---|---|
| 40 SECURITY DEFINER refresh functions (`costing.rpc_refresh_*`, chains) | 52 run-scoped snapshot tables | No. Every delete, update and insert in the 15 newly guarded tables is scoped `refresh_run_id = p_refresh_run_id`. | None for active runs. A call aimed at a finished run is refused, which is the intent (the A6 finding). |
| `rpc_refresh_exact_costing_control_dashboard` / `_integrity_audit` | dashboard and integrity tables, deleted **by period** | The live guard `a_stage05_exact_write_guard` fires first and silently skips other runs' rows. | None. Test T15b shows a later run's period-wide delete succeeds and leaves 119's row untouched. |
| `fn_process_next_costing_refresh_stage_internal` (cron 61, every 5 min; `public.rpc_process_next_costing_refresh_stage` for UI) | run header and stages | No. It exits unless the run is QUEUED or RUNNING, and every header update is `where r.id = v_run.id`. | The final SUCCESS update also captures a fingerprint (non-fatal, about 4 s). |
| `fn_request_costing_refresh_internal` (cron 60 daily, UI `rpc_request_costing_refresh`) | inserts a run header | n/a | Refused only if the period holds an **APPROVED** run and has no recorded single-use authorisation. REFERENCE never blocks. Cron 60 requests only the current open month. |
| `fn_reprice_regional_marketing_after_insert` (trigger) | regional marketing rows of the inserting run | No (scoped by the run inserting rows) | None |
| `public.rpc_refresh_costing_control_summary_snapshots` / `_maintenance_chain` (callable by `authenticated`, any run id) | control and review snapshots | Possible manually. No client code calls them. The maintenance chain already fails today on finished runs because of an existing guard. | Calls on a designated or finished run for the guarded tables are refused (intended). |
| `costing.rpc_refresh_*` executable by `authenticated` (prime, admin/finance OH, sales basis, DL allocation, marketing, internal loaded, cost sheet monthly) | the corresponding snapshot | Possible manually against any run id **today**, which is the A6 risk | Refused for finished and designated runs (intended) |
| Direct table DML | — | Only `postgres` holds INSERT, UPDATE, DELETE or TRUNCATE; anon, authenticated and service_role have none. | — |
| Edge functions (cleanup-raw, lookup-reference-doi, eaushadhi-qc-report-verify) | none in costing (source read) | — | None |
| Client JS (`public/`) | calls only `rpc_request_costing_refresh` | — | Unchanged unless the period is APPROVED |

**Data evidence:** across 1.3M+ finished-run rows in the 15 tables, rows stamped after their run finished occur only twice, both one-off owner-level operations that are no longer in any scheduled or API path:
- Run 108 (15 Sep): 12,385 RM traceability rows, 25 s after finish.
- Run 59 (24 Jul): 5 scheme-context rows, about 8 h after finish.

AU-2 deliberately blocks repeats of this; the correct path is a new run.

**Performance:**
- Per-row guard overhead is about 10 µs per row locally (100k rows: 2.58 s vs 1.56 s), about +3.5 s for a full run of about 354k rows.
- The SUCCESS fingerprint over run 119 took 4.1 s on live (read-only timing).

## 2. Current-run rule (decided; tests T00b, T03, T03b, T12, T12a, T12d)
1. Latest **APPROVED** run of the period.
2. Otherwise the latest SUCCESS run with captured context that is **not REFERENCE**.
3. Otherwise the REFERENCE run, labelled `REFERENCE_FALLBACK`, only when no other valid run exists.

The view keeps the live columns and appends `selection_basis`; its 21 dependent views keep working.

**Consequence the user must accept before designating 119 REFERENCE (D-017):** September's current run becomes **118**.
- Live comparison (read-only): 527 of 635 SKUs differ in manufacturing COP between 118 and 119. The total absolute difference is Rs 220.77; the largest is Rs 46.65 per SKU.
- This affects the pricing dashboards, cost sheets and control views that read the current run.
- To keep 119 as September's pricing source, it would have to be APPROVED (not the recorded decision), or a new September run made.
- Until any designation, behaviour is exactly as today (T00b).

## 3. Compatibility with live
- None of AU-2's new object names (tables, functions, views or triggers) exist in live. Dependencies are present: `auth.uid()`, `fn_enforce_mutable_refresh_run_snapshot`, the `cost_periods` close columns, `service_role`.
- `create or replace view` keeps the existing columns and grants; the new column is appended.
- The placeholder version 20261015200000 is later than the latest live version (20261015045233). If applied via MCP `apply_migration`, the server assigns the version; record it.
- **Do not use `supabase db push`**: repo and live history are not reconciled (see the audit's AU1_PR67_MERGE_READINESS.md).
- Fingerprints hash full row text. A later DDL change to a snapshot table will show as drift and block a period close until the run is re-designated, which captures a fresh fingerprint. This is intended.

## 4. Exact apply runbook (only after explicit user authorisation; never together with #69)
- P1. Confirm no active run: `select id, overall_status from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING');` must return 0 rows. Avoid the minutes just before :00 and :30 if a daily run is due (cron 60 at 02:00 IST).
- P2. Record pre-state: `select * from costing.v_current_successful_costing_refresh_run order by period_start;` (expected 80 / 82 / 119).
- A1. Apply the file exactly as reviewed, as one transaction (MCP `apply_migration` or the SQL editor). Preflight and `lock_timeout = 5s` make it fail safely rather than wait.
- V1. Expect 0 for `select count(*) from pg_trigger where tgname like 'trg_au2_%' and tgenabled <> 'O';` and about 90 total AU-2 triggers.
- V2. `select * from costing.v_current_successful_costing_refresh_run order by period_start;` must be identical to P2, with `selection_basis = LATEST_SUCCESS`.
- V3. Read-only probe: `select * from costing.fn_compute_run_fingerprint(119);` (about 4 s).
- V4. The next scheduled or UI run finishes SUCCESS and has a `RUN_SUCCESS` fingerprint row.
- D1. Only afterwards, and only as a separate explicit user action (D-017): `select costing.rpc_designate_costing_run(119,'REFERENCE','Dr. Brahmadathan U','<reason>');` executed as service_role or owner. Then September's current run becomes 118 (section 2).

## 5. Rollback (tested locally: apply, then rollback restores all 6,253 compared views, triggers, grants and owners, IDENTICAL)
- `supabase/tests/au2/au2_rollback.sql` (outside migrations/ on purpose).
- It drops every `trg_au2_*`, restores the live view byte-for-byte with its grants, owner and dependent views, and revokes the three RPCs.
- The append-only governance tables and their records are **kept**; dropping them is a separate explicit decision.
- Run it under the same preflight as A1.
- Proof: `supabase/tests/au2/rollback-test-local.sh` (seeds live-like grants first).

## 6. Tests (local PG17 parity DB)
- `run-local.sh`: **52/52 pass**. This includes the A6 attack set, the selection rule, REFERENCE-not-blocking, an APPROVED-only refusal plus single-use authorisation, revoke, governed close, the stage-05 interaction, the non-fatal fingerprint and fingerprint immutability.
- `rollback-test-local.sh`: IDENTICAL.
