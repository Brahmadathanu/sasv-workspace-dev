# MIS G7 S3 — Privileged immutable report writer gate

**23 November 2026 IST | REVIEW ONLY, no database install authority.** Owner direction: zero-cost validation; preserve Costing Suite v6.4.2, live cost runs, ETL jobs, operational worktrees and draft PRs. **G7 remains OPEN 6/11 (~55%)**.

## 1. Bounded interface and authority

The signed report writer is a **separate** operation from the read-only `public.get_mis_production_value_summary` S1/S2 and from Tally `finalize_fg_transfer_snapshot`.

**Proposed interface (not installed):**
`finalize_mis_report(p_report_month date, p_as_of_date date, p_expected_predecessor_id bigint, p_idempotency_key text, p_reason text)` returns `{receipt_id,version,sha256,status}`.

Client may submit only an **intent and expected predecessor**, **never a monetary amount, chosen cost run, source digest, signed role flag, or arbitrary JSON payload**. Server derives all amounts and source lineage under authenticated execution. `auth.uid()` must be nonnull and the canonical MIS **View and Edit** permission must pass `public.app_has_permission('module:executive-mis-dashboard','view')` and `('module:executive-mis-dashboard','edit')`. An additional explicitly granted **MIS finalizer/owner** role is required; Edit alone is *not* authorization to sign. Identity and permission checks must be in the trusted function, not client UI or argument flags. The exact finalizer role source is a policy decision and **not assumed from existing staff roles**.

**Crucial source rule:** until C1–C3 product-route completion, privileged excess bulk ledger, source reconciliation and independent completeness certification are proven, `FINALIZED_VERIFIED` is forbidden. With owner authorization, a signed *snapshot of presently displayed information with disclosed gaps* may be written as `FINALIZED_WITH_DISCLOSED_LIMITATIONS`, retaining NULL for unknown metrics (never invented zero).

## 2. Server-side transaction sequence — review algorithm, not executable function

1. Verify input month-first/cutoff-in-month, nonblank reason and safe bounded idempotency key. Reject future report cutoff where required.
2. Validate JWT identity, MIS View+Edit and separate finalizer authority. Authorize read as well as write; never trust caller-supplied finalization status, numbers or user ID.
3. Serialize per `(report_kind,month,cutoff)` using PostgreSQL transaction-scoped advisory lock **with a stable, explicitly versioned key scheme** or a dedicated unique row-level gate; test actual parallel callers later. Lock **before** reading current predecessor and constructing payload. Avoid global lock.
4. Resolve exact latest current effectively APPROVED+SUCCESS costing run (no drafts). Read signed/verified C1 FG bulk, C2 packaging and exception ledger, Tally transfer rows applying the publisher's latest voucher alteration precedence, and the two store finalizer jobs and source evidence. **All source reads must form one consistent transaction snapshot.** A typical `READ COMMITTED` transaction can observe multiple snapshots; choose and verify an appropriate isolation level in the final authorized migration.
5. Build canonical frozen report payload and a minimal valuation projection sufficient to reconstruct money after old costing snapshots are pruned. Store exact totals, rates/units used, coverage counts, source store/job IDs, expected-key/source-line digests, schema version, policy version and explicit limitation codes. `NOT_VERIFIED` and missing approved rate remain visible. Do not persist full source trace tables by default.
6. Normalize canonical encoding before SHA-256: stable field set, numeric precision/scales, ordering and UTF-8 bytes. Avoid `now()`, browser-formatted strings and unordered source aggregation within digest input. Payload hash is an **integrity checksum**, not proof against privileged database administrator tampering or a legal electronic signature.
7. Check existing `(kind,month,cutoff,idempotency_key)`. Same request and same frozen payload digest returns the **existing** receipt unchanged; same key with changed payload is a conflict (never mutate prior). Check supplied predecessor equals current latest ID. Initial version requires NULL predecessor; revision needs matching existing receipt and increments version atomically. Revision preserves older receipts permanently.
8. Insert only into private append-only receipt storage. Never UPDATE or DELETE signed monetary JSON; previous version remains queryable. Return receipt ID/version/status/digest only after successful single transaction commit.
9. On later source correction or cost revaluation, require a fresh reason, fresh idempotency token and explicit revision; immutable previous version persists. No silent automatic revaluation of a signed report.
10. Read verified version from stored payload and its digest, not by rerunning today's dynamic costing. Inspect source projection hash independently for revision recommendation, without rewriting the frozen report.

## 3. Storage/security boundaries validated and outstanding

Review-only SQL in `MIS_G7_S3_APPEND_ONLY_RECEIPT_STORAGE_REVIEW_ONLY_20261123.sql` defines the compact private table, versioned unique keys, predecessor, original payload/source and SHA-256, plus update/delete-blocking trigger. **Updated safety requirement:** actual `app_private` schema grants `authenticated` USAGE (live read-only confirmation); schema name alone is **not** isolation. Review-only candidate now explicitly enables/FORCEs RLS, REVOKEs table and identity sequence DML from PUBLIC/anon/authenticated and REVOKEs trigger-function EXECUTE. It grants no direct DML or public wrapper. **FORCE RLS requires an explicitly audited privileged writer path**, not merely a SECURITY DEFINER label. Before install independently review function owner, schema search_path, PostgREST exposed schemas, GRANT/REVOKE/role matrix, and real RLS/permissions under signed-in tokens.

Read-only live function `public.app_has_permission(text,text)` exists and calls canonical permission core for `auth.uid()`; this is **not itself proof** of a separate MIS finalizer/owner permission. Do not invent it.

A single table record is not automatically tamper-proof against superusers or privileged DDL, and a source digest cannot substitute for freezing the numbers in the report. No automated historical report pruning is authorized. Consider retention and backup before deleting any old approved costing runs.

## 4. Executed free PostgreSQL READ ONLY evidence

- `MIS_G7_S3_IMMUTABLE_RECEIPT_SYNTHETIC_READONLY_20261123.sql`: **3/3 PASS**, repeated canonical payload digest stability, revision digest difference and 64-character SHA-256 representation.
- `MIS_G7_S3_WRITER_POLICY_NEGATIVE_FIXTURES_READONLY_20261123.sql`: **10/10 PASS** synthetic decision precedence cases: anonymous denial, view-only denial, editor-not-owner denial, draft costing denial, falsely verified completion denial, signed-with-gaps decision, idempotent retry, same-key/different-payload rejection, stale predecessor and new revision. This is a test of **decision semantics**, not of installed SQL, cryptographic signing, real JWT role enforcement, transactional locks or concurrent requests.
- `MIS_G7_OPERATIONAL_PROVENANCE_EVALUATOR_READONLY_20261123.sql`: **2/2 IK/OK PASS**, eight declared finalizer chunks matching fetch, parse, row evidence (2,471 IK / 631 OK), as-of Nov23. Source status remains `NOT_CERTIFIED` pending external planner/immutability proof.
- Corrected full S1/S2 reporting SELECT and voucher latest-wins edge-case fixture passed previously; full PL/pgSQL CREATE FUNCTION was **not** compiled in isolation.

## 5. Hard blockers before exact production installation proposal

- **No complete writer code yet.** The table skeleton is **not** a deployable migration; cannot install it alone. Implementation must include a narrow authorization wrapper, stable encoding and digest verification, correct frozen SQL source projection, real transactional concurrency/idempotency and full restore/rollback plan.
- Determine authoritative *separate* owner/finalizer permission and who may sign with limitations. Never infer permission from owning a report or being an ETL administrator.
- True C1–C3 route/FG bulk completion governance and Tally reconciliation must support verified status; until then limited status only with disclosed facts. Do not mark financially complete from one COP reference.
- Free isolated PostgreSQL compilation, full signed-in MIS view-only / edit-only / finalizer / anonymous test matrix, Netlify/PWA cache behavior and p95/full function performance are not yet executed.
- Confirm external Tally source-file planner independence, mutable job params and source publication after cutoff. Source as-of source may be revised later; report must bind finalizer-job UUID(s) and source digest.
- Restore/rollback must preserve frozen receipts, never silently drop an installed table with signed versions, and consider cost-run three-month retention.

**Disposition:** Design and synthetic proof advanced; **G7 S3 installation review NOT PASS**. No production changes, merges, paid branch, client work or Electron release. Exact next bounded work: complete writer SQL source projection and frozen payload algorithm in review branch, then real parser/permission/concurrency tests before owner installation decision.
