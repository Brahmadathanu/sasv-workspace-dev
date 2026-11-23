# MIS G7 — Tally FG-transfer ETL provenance offline audit (REVIEW ONLY)

**G7 remains OPEN at 6/11 gates.** Offline repo research and fixtures only, revised after the independent PR review (issue comment 7095223505) to include ChatGPT's completed live read-only finalizer / rebuild-window review. Live facts below are reported from that review, not re-verified here; the repo itself contains no DDL for these functions. No production SQL, no write RPC (the finalizer was never called), no migration/client/grant/cache/release change. Base: `main` @ `62b1f12` (v6.4.2). Candidate/handoff docs read from `docs/executive-mis-workflow-20261119` @ `59b74d4` (draft PR #485, untouched).

## 1. Source and writer authority (what the repo proves)

| Item | Repo evidence | Finding |
|---|---|---|
| `fg_transfer_all_chunks_present(text,date,jsonb)` | `supabase/migrations/20260806085429_harden_etl_source_validation_and_status_audit.sql` (SQL, stable, invoker) | Reader. Per expected key requires a `done` FETCH_XML (`params.save_key`) and a `done` PARSE_FG_TRANSFER_CHUNK (`params.source_key`, `as_of_date`, `store`, `parse_status=SUCCESS`), both excluding the 234-byte/hash fingerprint. It does **not** check count parity, parse timestamp, company, scope contiguity, or that the key list is complete. |
| `finalize_fg_transfer_snapshot(text,date,jsonb)` | Repo: only its signature (`public/shared/js/types/supabase.ts:37506`) and EXECUTE-grant loop (`20260811144451_…`, authenticated + service_role). Live: body reviewed read-only (see §1a) | **Repo has no DDL (drift).** Installed behavior is known only from the live review. It is a writer and must not be called. Same for `rebuild_fg_transfer_snapshot_window` (type signature only in repo). |
| Terminal-state guard | `20260806085429…` `etl_jobs_validate_terminal_state` (+ later `20260807122916_fix_etl_terminal_validation_state_recovery.sql`) | A `done` FETCH_*/PARSE_* job with the 234-byte fingerprint is rewritten to `error` (`SOURCE_ERROR_RESPONSE`). |
| Process history | `etl_job_status_history` (same migration; RLS on, all client grants revoked) | Status transitions per job. A process log, **not** a completeness receipt. |
| Expected source-key generation, FETCH_XML / PARSE job creation, finalizer caller | **Not in repo.** Only `public/shared/operations-control.html:539` (a job-type filter label) and recovery helper `20260808070701_etl_template_path_incident_recovery_helper.sql` (requeues failed FETCH_XML / PARSE_FG_TRANSFER_CHUNK; service_role only) | The Tally agent/worker/orchestrator that plans chunks and calls the finalizer lives outside this repository. Provenance of "which chunks were planned" cannot be traced here. |
| Snapshot tables | `tally_fg_transfer_snapshot`, `tally_fg_transfer_voucher_lines`: write lockdown `20261019134806_tb1_tally_snapshot_write_lockdown.sql` (ACL assertion for the snapshot table) | Table DDL itself is not in repo migrations either (live-only). Transaction atomicity of the snapshot rebuild is **unverifiable from repo**; needs a live read-only `pg_get_functiondef` review. |
| Related contract | `docs/costing/AU3B_TALLY_EXPORT_CONTRACT.md` | Draft explicit-window contract for *expense* exports; shows the repo precedent (requested vs returned window, violation log) but nothing equivalent exists for FG transfers. |
| Daily work log | not an ETL source | Separate evidence; not a voucher completion certificate. |

### 1a. Installed live behavior (from the completed read-only live review; not in repo)

- **Finalizer** checks: done FETCH/PARSE evidence for each expected key, `params.parsed_row_count`, source hash, source size (accepts `>= 0`), parse timestamp, a single company, and contiguous non-overlapping date scopes; then calls the 3-arg window rebuild. It does **not** (as reviewed) compare parsed rows to published rows per source; that is a proposed MIS check below.
- **Rebuild window** selects the **latest voucher alteration** per (store, GUID-or-fallback, `inventory_line_no`, `batch_line_no`, `raw_godown`), excludes cancelled/optional latest versions, deletes only the snapshot rows for the specified store/as-of window, inserts reconstructed rows and checks quantity and amount. Writes are scoped to one store and run inside the enclosing PostgreSQL transaction.
- **Atomicity limits:** no explicit advisory lock in the inspected bodies, and **no demonstrated cross-store (IK + OK) atomicity or joint receipt**; each store is finalized separately.
- **Data point:** at the 2026-11-23 as-of, 3102 original lines had no superseded/cancelled/optional versions, and the 226 Nov 1–21 lines match latest-wins semantics. Edge cases (alterations, cancellations, reversals) still need protection.
- **Still absent:** any independently verified finalization receipt, and the expected-file planner (Tally agent/orchestrator, outside the repo).

### 1b. Installed checks vs proposed MIS checks (the offline model keeps these apart)

| Check | Layer |
|---|---|
| done FETCH/PARSE jobs, parse_status SUCCESS, store/as-of match, 234-byte fingerprint rejection | INSTALLED |
| `params.parsed_row_count` present and integer ≥ 0, parse timestamp valid | INSTALLED |
| source size integer **≥ 0**, non-empty hash | INSTALLED (model aligned to live; earlier draft wrongly required > 0) |
| single company; contiguous scopes from fiscal start to as-of | INSTALLED |
| source size **> 0** and 64-hex hash | PROPOSED_MIS (stricter) |
| `parsed_row_count` == published rows per source | PROPOSED_MIS |
| undeclared empty chunk; unexpected published key | PROPOSED_MIS |
| expected keys from an independent manifest | PROPOSED_MIS (no real manifest exists) |

Model results expose `installed_reasons` and `proposed_mis_reasons` separately. The earlier draft's `parse_count` field was wrong; the model now uses the live `parsed_row_count`.

## 2. Independent manifest / durable receipt: none found

- No table, view or function in the repo stores a planned-chunk manifest or a per-store/as-of finalizer success receipt.
- `etl_jobs.params` (+ `etl_job_status_history`) is the only durable trace. Expected keys passed to the finalizer are caller-supplied jsonb.
- Fixture caveat: `expected.source = INDEPENDENT_MANIFEST_ASSERTED_SYNTHETIC` is only a flag the fixture sets. It proves nothing about a real manifest; `SNAPSHOT_CERTIFIED_COMPLETE` from the model is synthetic (`evidence_basis=SYNTHETIC_FIXTURE_ASSERTION`, `real_manifest_proven=false`) and must never be quoted as live evidence.
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

`scripts/mis-g7-etl/provenance-model.mjs` (pure model) and `provenance-model.test.mjs` (`node --test`, built-ins only). Covers: eight monthly chunks; row-derived keys never certify; omitted zero-row chunk; extra expected chunk; empty-but-parsed chunk (needs explicit declaration); missing FETCH/PARSE; 234-byte fingerprint (fetch and parse, even marked done); parse failure; invalid hash/size/count/timestamp; parsed≠published count; scope gap/overlap/start/end; mixed company; unexpected published key; store/as-of mismatch; retroactive correction on same GUID; cancelled/optional/negative lines. Added: `latestWinsLines` fixtures (alteration, cancelled-later, optional, reversal) as the *intended* parity target. **Caveat:** the model encodes the live behavior as reported by the live review, not from repo source; it is a spec fixture, not proof of the live function.

Run: `node --test scripts/mis-g7-etl/*.test.mjs` (19 tests)

## 5a. Server-side follow-up for the S1/S2 candidate (separate authorized review path; not in #517)

Per the independent review, the review-only S1/S2 candidate scans original voucher lines **without latest-alteration dedupe or cancelled-row precedence**. Before any promotion, design exact parity with the guarded rebuild and add duplicate / alteration / reversal fixtures on a separate server review path. #517 changes neither the candidate, client nor production.

## 6. Blockers and recommendation

1. Finalizer / rebuild-window DDL is not in the repo (drift): capture the reviewed live definitions as a committed baseline on the server-review path. Cross-store atomicity and locking are not demonstrated.
2. Planner of expected chunks (Tally agent) is outside the repo → needs owner-side evidence of how keys are generated.
3. No independently verified receipt or real manifest exists; do not claim `SNAPSHOT_CERTIFIED_COMPLETE`.

**Next server governance gate:** (a) owner decision on where the independent expected-chunk plan originates; (b) S1/S2 candidate parity with latest-alteration/cancelled precedence and its fixtures; (c) only then a private status-derivation design. Live read-only definition review is done.
