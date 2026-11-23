# MIS G7 — Tally FG-transfer ETL provenance offline audit (REVIEW ONLY)

**G7 remains OPEN at 6/11 gates.** Offline repo research and fixtures only. No production SQL, no write RPC (the finalizer was never called), no migration/client/grant/cache/release change. Base: `main` @ `62b1f12` (v6.4.2). Candidate/handoff docs read from `docs/executive-mis-workflow-20261119` @ `59b74d4` (draft PR #485, untouched).

## 1. Source and writer authority (what the repo proves)

| Item | Repo evidence | Finding |
|---|---|---|
| `fg_transfer_all_chunks_present(text,date,jsonb)` | `supabase/migrations/20260806085429_harden_etl_source_validation_and_status_audit.sql` (SQL, stable, invoker) | Reader. Per expected key requires a `done` FETCH_XML (`params.save_key`) and a `done` PARSE_FG_TRANSFER_CHUNK (`params.source_key`, `as_of_date`, `store`, `parse_status=SUCCESS`), both excluding the 234-byte/hash fingerprint. It does **not** check count parity, parse timestamp, company, scope contiguity, or that the key list is complete. |
| `finalize_fg_transfer_snapshot(text,date,jsonb)` | Only its signature (`public/shared/js/types/supabase.ts:37506`) and EXECUTE-grant loop (`20260811144451_security_advisor_close_etl_orchestration_anonymous_execute.sql`, pattern `finalize_fg_transfer_snapshot`, authenticated + service_role) | **REVIEW REQUIRED: body is not in any repo migration.** The stronger checks (hash/size/count/timestamp/company/scope, rebuild) are known only from the live definition; this audit cannot verify them from source. Same for `rebuild_fg_transfer_snapshot_window` (type signature only). It is a writer and must not be called. |
| Terminal-state guard | `20260806085429…` `etl_jobs_validate_terminal_state` (+ later `20260807122916_fix_etl_terminal_validation_state_recovery.sql`) | A `done` FETCH_*/PARSE_* job with the 234-byte fingerprint is rewritten to `error` (`SOURCE_ERROR_RESPONSE`). |
| Process history | `etl_job_status_history` (same migration; RLS on, all client grants revoked) | Status transitions per job. A process log, **not** a completeness receipt. |
| Expected source-key generation, FETCH_XML / PARSE job creation, finalizer caller | **Not in repo.** Only `public/shared/operations-control.html:539` (a job-type filter label) and recovery helper `20260808070701_etl_template_path_incident_recovery_helper.sql` (requeues failed FETCH_XML / PARSE_FG_TRANSFER_CHUNK; service_role only) | The Tally agent/worker/orchestrator that plans chunks and calls the finalizer lives outside this repository. Provenance of "which chunks were planned" cannot be traced here. |
| Snapshot tables | `tally_fg_transfer_snapshot`, `tally_fg_transfer_voucher_lines`: write lockdown `20261019134806_tb1_tally_snapshot_write_lockdown.sql` (ACL assertion for the snapshot table) | Table DDL itself is not in repo migrations either (live-only). Transaction atomicity of the snapshot rebuild is **unverifiable from repo**; needs a live read-only `pg_get_functiondef` review. |
| Related contract | `docs/costing/AU3B_TALLY_EXPORT_CONTRACT.md` | Draft explicit-window contract for *expense* exports; shows the repo precedent (requested vs returned window, violation log) but nothing equivalent exists for FG transfers. |
| Daily work log | not an ETL source | Separate evidence; not a voucher completion certificate. |

## 2. Independent manifest / durable receipt: none found

- No table, view or function in the repo stores a planned-chunk manifest or a per-store/as-of finalizer success receipt.
- `etl_jobs.params` (+ `etl_job_status_history`) is the only durable trace. Expected keys passed to the finalizer are caller-supplied jsonb.
- Consequence (already noted live): if the key list is derived from published rows, a zero-row chunk omitted by the producer cannot be detected. The offline test `omitted zero-row chunk evades row-derived keys…` models exactly this.

## 3. Proposed eligibility states (design only; not installed)

| State | Condition |
|---|---|
| `NOT_CERTIFIED` | any per-chunk/scope/company/count check fails, or no keys |
| `SOURCE_PARSED_AND_PUBLISHED` | all checks pass but expected keys are derived from published rows or other non-independent input |
| `SNAPSHOT_CERTIFIED_COMPLETE` | all checks pass **and** expected keys come from an independent manifest; declared empty chunks explicit |

Candidate `MIS_G7_S1_S2_CANONICAL_RPC_REPLACEMENT_REVIEW_ONLY_20261122.sql` correctly keeps `snapshot_completeness_status = NOT_CERTIFIED`; nothing here changes it.

**Smallest interface (no new tracking table, nothing installed):** use the existing finalizer inputs. Require the *caller* (Tally agent/orchestrator, outside repo) to compute `expected_keys` from the request plan (FY start → as-of, month chunks) **before** fetching and to pass it, and have a private (service_role/postgres only) read function derive status from `etl_jobs.params` for that key list. Whether the finalizer can persist the plan inside an existing job `params` (e.g. on the finalizing job) is a server-governance decision. Introducing any persisted receipt needs owner authorization.

## 4. Candidate regression audit

- `main` client `public/shared/js/executive-mis-dashboard.js:1980,2004,2100` handles `NO_PREVIOUS_MONTH_APPROVED_COST`.
- The candidate retains `NO_PREVIOUS_MONTH_APPROVED_COST` (line 60), `snapshot_completeness_status=NOT_CERTIFIED` (231), `transfer_reconciliation=NOT_VERIFIED` (247), `completed_status=NOT_VERIFIED` (271), and selects the newest **effectively APPROVED** run from `v_costing_run_effective_designation` with `SUCCESS` status and `CAPTURED_AT_REQUEST`, excluding drafts (revocation is handled by the effective-designation view). Reference fields remain additive. Not modified.
- Book value (Tally voucher) and manufacturing COP stay separate: `summarizeLines` exposes only `book_value_basis=TALLY_BOOK_VALUE` and tests assert no production/COP field.

## 5. Offline fixtures

`scripts/mis-g7-etl/provenance-model.mjs` (pure model) and `provenance-model.test.mjs` (`node --test`, built-ins only). Covers: eight monthly chunks; row-derived keys never certify; omitted zero-row chunk; extra expected chunk; empty-but-parsed chunk (needs explicit declaration); missing FETCH/PARSE; 234-byte fingerprint (fetch and parse, even marked done); parse failure; invalid hash/size/count/timestamp; parsed≠published count; scope gap/overlap/start/end; mixed company; unexpected published key; store/as-of mismatch; retroactive correction on same GUID; cancelled/optional/negative lines. **Caveat:** the model encodes the finalizer checks as described in the handoff, not from source; it is a spec fixture, not proof of the live function.

Run: `node --test scripts/mis-g7-etl/*.test.mjs`

## 6. Blockers and recommendation

1. Finalizer / rebuild-window bodies and transaction atomicity are not in repo → **REVIEW REQUIRED** (live read-only definition capture, committed as a baseline doc).
2. Planner of expected chunks (Tally agent) is outside the repo → needs owner-side evidence of how keys are generated.
3. No receipt exists; do not claim `SNAPSHOT_CERTIFIED_COMPLETE`.

**Next server governance gate:** a read-only review of `finalize_fg_transfer_snapshot` and `rebuild_fg_transfer_snapshot_window` definitions (atomicity, locking, what is deleted/rebuilt) plus an owner decision on where the independent expected-chunk plan originates; only then a design for private status derivation.
