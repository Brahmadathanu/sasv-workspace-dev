# Executive MIS G7 — Tally provenance and immutable report finalization contract

**Status:** DESIGN/REVIEW ONLY, 23-Nov-2026 IST. **NOT a migration, production approval or source certification.** Formal G7 OPEN, programme 6/11 (~55%); preserve Costing Suite release and protected operational worktree. No paid development branch. Owner decides any privileged production write separately.

## A. Verified source authority, without a new ETL ledger

Installed:
- `public.fg_transfer_all_chunks_present(text,date,jsonb)` checks expected FETCH_XML and PARSE_FG_TRANSFER_CHUNK success and rejects the known Tally 234-byte error response.
- `public.finalize_fg_transfer_snapshot(text,date,jsonb)` is a **writer**: independent supplied expected keys, valid parsed counts/size/hash/timestamp, one company, continuous parse scope to as-of, then scoped rebuild.
- `public.rebuild_fg_transfer_snapshot_window(text,date,date)` ranks voucher revisions (store/GUID/inventory line/batch line/godown; latest alter ID, as-of, ID) before excluding cancelled/optional; deletes/rebuilds only the facing snapshot for one store and bounded date window, validates quantity/book amount.
- `public.etl_jobs` contains **existing** `FINALIZE_FG_TRANSFER_SNAPSHOT` jobs, with `params.expected_keys`, `store`, `as_of_date`, `company`, `fetch_start_date`, `validation_status`, `created_at`, `finished_at` and job ID. `public.etl_job_status_history` records queued/in_progress/done transitions.

**New bounded read-only evidence** from existing jobs:
- For 21, 22 and 23 Nov as-of, IK and OK each have a most recently completed/ACCEPTED finalizer job. Each contains **8 declared expected keys**; the 8 correspond exactly to the 8 observed voucher source keys for that store/as-of. Six of six inspected store/day cohorts agree.
- On 23 Nov as-of, IK finalizer job ID `964d03f6-a75f-425f-86a7-770639a531f6`, OK `069384a3-4d70-4e51-869b-51b20f96f20a`. For both, the finalizer **queued before the latest matching parse completed**, then transitioned to done/ACCEPTED. This supports a plan present before last parse finished but **does not prove** how the external Tally agent generated keys or that job params cannot be changed.
- Each store had 8 successfully fetched, parsed, documented and scoped chunks, April 1–Nov 23, zero gaps/overlap, per-chunk parsed vs published counts matching (IK 2471, OK 631 raw voucher rows). November 1–21 original voucher cohort 226 lines, Tally book ₹37,11,850.56, approved Oct143 COP reference 224 covered, two no rates, ₹39,84,998.88 partial COP reference. Neither this subtotal nor parse success is verified manufacturing completion.
- `MIS_G7_EXISTING_FINALIZER_PROVENANCE_READONLY_20261123.sql` is a repeatable READ ONLY proof. Never invoke finalizer or rebuild in a query.

**Most conservative operational state (already evidenced): `ETL_FINALIZER_DONE_AND_MATCHED`**, for a specific (company, store, as-of date, finalizer job ID). Do not label `SNAPSHOT_CERTIFIED_COMPLETE` until the agent's independent plan-generation/locking authority and exact publication-immutability contract are verified. All MIS values must continue disclosing `snapshot_completeness_status=NOT_CERTIFIED` meanwhile. In particular, `expected_keys` derived from the published voucher rows are insufficient to verify an independently expected zero-row chunk; validate the finalizer job's manifest, not only row-derived keys.

## B. Minimal future private read-only provenance evaluator (NOT installed)

Use existing `etl_jobs`, `etl_job_status_history` and voucher tables rather than inventing a parallel tracking ledger.

Inputs: `(company, transfer_store, as_of_date)`; default to one most recent **eligible** done/ACCEPTED finalization job only if no later in-progress, error or revised manifest invalidates the as-of cohort. Check:
1. finalization `done` and `validation_status='ACCEPTED'`, terminal history transition and job UUID/timestamps consistent;
2. nonempty `expected_keys` captured as job params; all declared chunks have matching valid fetch and successful parse with same store/company/as-of, valid hash/size/count/timestamp and contiguous fiscal scopes, no known Tally error fingerprint;
3. declaration equals source-chunk keys including any **declared zero-row chunks**; do **not** infer expected keys solely from rows. Where zero-row chunks exist, only job manifest/parse records can represent them;
4. published original source per chunk matches parsed count; latest revision, cancellation/optional logic matches authoritative rebuild; source row digest can detect post-finalization corrections;
5. identify evidence of the *actual publication* (successful finalizer execution job and source/facing snapshot coherence), without claiming two-store atomic publication, locking or independent manifest-generation proof from timing alone;
6. return structured `status`, `reasons`, declared/observed counts, each store's `finalizer_job_id`, `finished_at`, expected-key digest and original-source digest, **not** private source paths or personnel information to unauthorized users.

Permissions: provenance lookup should remain private, service-role/privileged server execution only, with narrow MIS view aggregates disclosed through the canonical permission-guarded RPC; no extra unguarded public RPC or public INSERT/UPDATE grants. Do not deploy without specific owner permission and actual role/security tests.

Status semantics:
- `NO_FINALIZER_RECEIPT`: no suitable done/ACCEPTED finalizer per store/as-of.
- `ETL_FINALIZER_DONE_AND_MATCHED`: matching job, manifest, parse and published source, but not independently certified manifest.
- `SOURCE_CHANGED_AFTER_FINALIZER`: same as-of snapshot differs from earlier pinned source digest, requiring governed revaluation.
- `SNAPSHOT_CERTIFIED_COMPLETE`: only after externally proven independent plan generation and durable publication/receipt authority, and explicit owner acceptance of certification criteria.

Do not silently treat latest snapshot `max(as_of_date)` as complete; an as-of snapshot created/finalized after its calendar date may become eligible later and must be distinguished from an as-known-at-report-date frozen version.

## C. S3 — Immutable report-finalization writer (separate authorization)

S1/S2 read RPC remains `STABLE`/read-only, dynamically prices transfers against the **latest currently approved** cost run, and labels it a *reference*, not historical original production cost. **A finalized report cannot rely solely on run ID pointers**, as costing run snapshots may be pruned. The writer must be a separate privileged, idempotent, auditable operation with its own owner acceptance.

**Minimal durable receipt (private schema, design only):**
- `report_kind`, `report_month`, `as_of_cutoff`, `report_version`, `status`, `finalized_at`, `finalized_by`/server identity and authorization decision, `predecessor_receipt_id`, revaluation reason;
- `report_payload_jsonb` freezes **all displayed monetary totals and their units/coverage**, including Tally book transfer value, covered manufacturing COP reference, missing-rate amount/count, FG bulk receipt and packaging metrics, pending correction and reconciliation/status flags, MRP notional if independently grounded; **do not store imaginary 0 values for missing data**;
- source run ID, costing period, approved valuation timestamp, effective-approval designation at finalization, relevant approved cost rows' aggregate/checksum or frozen per-SKU rates **as needed to reproduce this report**, source interpretation/valuation policy version; do not require keeping all bulky historical costing snapshots;
- transfer IK and OK finalizer job IDs, expected-key digest, as-of date, source row digest/row count and per-store scope, latest-wins/cancel policy version, where provenance is not certified; source-lineage digests should include original voucher identity, altered values, pack quantity/unit and mappings used;
- `payload_digest_sha256` computed over *canonical immutable report payload* with deterministic encoding and field order, and `source_digest_sha256` over a stable ordered and versioned source projection. Verify both during read; calculate outside mutable display text (not from volatile `evaluated_at`).
- a single latest active report version per (report_kind, month, cutoff); earlier versions remain frozen/readable. **Never UPDATE monetary JSON or DELETE prior finalized payloads.** Corrected data produces a *new explicit revision* linked to prior, with audit trail and prior approved version retained.

**Finalization guards:**
- privileged server writer and explicit MIS owner signoff; one transaction, concurrency-guarded unique key/idempotency and repeat requests yielding the same receipt or conflict; no client direct writes;
- reject or withhold a claim of `FULLY_VERIFIED_COMPLETED_PRODUCTION` without signed C1 product-route FG bulk completion, C2 pack-over-bulk exception ledger and reconciled Tally source; if finalizing with gaps, label `FINALIZED_WITH_DISCLOSED_LIMITATIONS` and store the exact missing/reconciliation counters;
- require valid approved cost reference (never draft); persist *actual numbers* and provenance, not only references; block deletion of unapproved or pruned runs from changing archived values;
- authenticate and authorize both finalize and read operations; verify against read-only and denied-role fixtures, and p95/browser caching after authorized installation;
- before full S3 approval, prepare exact SQL diff, rollback, data-retention impact, source digest fixture, idempotency/revision/concurrency/security fixtures, and a documented restore path that never silently deletes signed reports.

**Storage discipline:** favor compact JSON receipts + essential rate/provenance projection over duplicating entire costing trace tables or all Tally voucher rows. Do not add a redundant ETL ingestion ledger. Finalizer jobs are process evidence; immutable financial report receipts serve a different governance purpose.

## D. Decision and gate

Current findings justify **reusing the existing FINALIZE_FG_TRANSFER_SNAPSHOT job record as an operational ETL publication receipt**. There is no need to create a new ETL manifest table at this stage. Still OPEN: independently verify Tally agent expected-key generation before fetch, ensure job params/finalizer status cannot be retroactively rewritten without audit, prove publisher snapshot consistency and cross-store policies; design/authorize S3 writer separately. Source-completeness status should remain conservative until those proofs are met.

No production function was created/replaced. No ETL or Costing jobs were invoked or altered. No paid branch, client work, releases, or merges. Formal programme **6/11 ~55%**, G7 OPEN, G8 parked, PRs #485/#517 draft.
