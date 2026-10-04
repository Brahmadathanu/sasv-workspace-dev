# WP04-G4 — One rollback-only rehearsal proposal (NOT AUTHORIZED)

## Plain-language purpose
Use the existing Supabase database to test a small part of the proposed package inside a transaction that is rolled back. This is a production operation even though no package change is committed. It requires one explicit approval. No paid project/branch, installation, private console, harness, identity or fixture is proposed.

## Exact operation
- Target: qhmoqtxpeasamtlxaoak / sasv-workspace, verified through the connected project operation.
- Main reference: 01ce609df1ca7dc2082a6ecc81e877b1cb15c1d0; intervening commits b1416800/4f14852 and6ce0afad/01ce609 touch only e-Aushadhi Composition guard/client and its own programme docs; no Master Data/Costing, Product/SKU lifecycle or WP04 overlap. Audit base5f6711d. No rebase/merge of main.
- Exact script: [rehearsal-proposal.sql](rehearsal-proposal.sql). SHA256 `7d85ee676a6e6df358069a9406b0e26685b1b1efe4342a1aa68e337a6e46e11f`.
- One execute_sql call containing one REPEATABLE READ transaction, no COMMIT, final ROLLBACK. The exact forward/rollback inner SQL is included, with their transaction wrappers removed. Do not execute snippets independently.
- Existing definitions/ACLs/source and candidate-name collision guards run before changes; enabled DDL event-trigger fingerprint must match `4e2c16f8333e51161dc11c5376fb3296`.
- Baseline context fixed to September2026, governed valuation2026-09-10, latest SUCCESS Run115; reject drift. Existing actor dff17104-c02a-4bca-95b1-e8ddff46a9b6 is represented using transaction-local SQL claim settings; this is explicitly NOT native Auth/API proof. No token/password is requested or stored.
- Capture old canonical JSON for SKU11 and SKU1795 LIVE_AS_OF and SKU11 EXACT_RUN115. Store comparisons only in transaction-local configuration; no business payload printed or persisted.
- Define the seven package functions atomically, including proposed function grants/revokes; execute complete catalog identity checks.
- Repeat the three canonical cases and require exact JSON equality. Invoke governed-period and Product-gap readers once each with limit1; verify envelope and same-observation no-SKU membership count.
- Do NOT invoke portfolio: page limit1 still assesses the full population. No full-catalog/concurrency experiment.
- Execute exact guarded restore/drop package; verify old definitions/ACL/settings and absence of five candidate names, then ROLLBACK the entire transaction. This tests the proposed restore path inside one transaction, not a committed deployment rollback.
- Afterwards, fresh READ ONLY source/ACL/candidate-absence readback is required. A reported in-transaction success alone is insufficient.

## Safeguards and limits
lock_timeout2s, statement_timeout15s per statement, idle_in_transaction_session_timeout30s. These are not a strict whole-operation wall-clock limit. Locks/load are possible; run once in a low-traffic period, stop on source/context/identity drift, lock failure, timeout or mismatch. No automatic retries, no continuation of failed statements. An error before final ROLLBACK may leave a failed transaction until the connector closes it or idle timeout terminates it; reconcile catalogs and active transaction state before any follow-up. Do not send COMMIT to recover. SQL/source errors may be logged; the script emits only metadata assertions, not secret or business payload values. PostgreSQL statistics/logs/OID consumption are not reversed by pretending the operation was read-only.

Inspected current enabled event triggers are Supabase extension-access guards plus PostgREST DDL/drop notification watchers. No extensions are created/dropped here. Notifications queued by DDL are transaction-bound; no committed schema change is intended. Fresh drift guard remains required. Ordinary function definitions/grants are temporary to this transaction; external sessions cannot use the uncommitted new endpoints. This does not promise zero interference with concurrent database work.

## What this can and cannot establish
If approved and successful, record limited evidence of function creation checks, six invoked package paths, three canonical JSON comparisons, small period/gap reads and in-transaction restore. PL/pgSQL creation does not resolve every lazy SQL branch. Portfolio is created but not invoked, therefore its runtime is unproved. No no-success-run fixture, all-SKU/CSE parity, full statistics/performance, native/API actor matrix, arbitrary-note monetary certification, client regression or real committed rollback claim. These remain required/unresolved; this proposal does not waive them.

## Review disposition and authorization request
Corrected G4-R01/R02 source review accepted at bounded draft scope; G4-R03 stays blocked. The current WP04 authority states: “A production rollback-only rehearsal remains unauthorized.” User approval of **this exact target/digest/operation only** would grant a narrow exception for obtaining the limited rehearsal evidence above. It would not authorize deployment, COMMIT, client implementation, additional operations, spending, new infrastructure or a general change to verification requirements. No programme/architecture/security/business decision is locked by this pending proposal. IMPLEMENTATION_RULES and DEC-014 remain unchanged.

Current: WP04-G4 — Corrected package reviewed; exact limited rehearsal awaiting explicit authorization. Next: approval decision; if approved, fresh source/main reconciliation, execute once and independently read back, then stop to assess evidence. If not approved, keep execution proof BLOCKED. Programme4/13; WP03closed; parked/locked unchanged.
