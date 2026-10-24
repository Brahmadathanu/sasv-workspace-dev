# G2 architecture decision — governed repetition approval evidence

**Decision:** Select an append-only, purpose-specific repetition confirmation register over route-header JSON blobs or generic approval references. This reverses the earlier provisional preference for header fields. Reason: a single mutable JSON field loses independent review events and makes reconstruction after route edits difficult. Auditability and route-version traceability outweigh avoiding one narrowly scoped table.

## Grounded concurrency finding

Read-only live inspection confirmed both `public.rpc_upsert_route_family_route_step` and `public.rpc_upsert_product_route_override` lock their parent route header `FOR UPDATE` before editing. Both approval RPCs likewise lock the route header. This provides a practical serialisation boundary for edits *to the same route*, subject to checking deletion and other mutation paths and product base-family changes. No live mutations made.

## Target design (implementation gate, not deployed)

1. Single `costing.production_route_repetition_attestation` register for either FAMILY or PRODUCT route. Store target type, route ID, immutable route_version, canonical effective-step digest (covering all relevant step identities/values and base family version), per-dual-positive-step occurrences, cycles and **computed** executions, explicit reviewer affirmation, actor, timestamp and approval transaction reference. Each new confirmation is INSERT-only; never overwrite/delete its record. Use a constraint enforcing valid target scope; avoid a polymorphic foreign key without integrity checks.
2. Approval must match one exact digest of the current effective route and step composition, not merely the current counts, checked inside the locked approval transaction. All dual-positive steps must be acknowledged; a plain note is inadequate. Reject if stale, missing or inconsistent.
3. Keep attestation roles and insert/approve permissions server-side; use `auth.uid()` actor identity and explicit permission checks, with database RLS/GRANT following current conventions. The SQL migration must include grants, RLS, read restrictions, and immutable mutation policy. Do not accept user-controlled actor or digest as authoritative.
4. Audit acceptance: no new dual-positive route can be approved without a fresh confirmation; 8×1/1×8 unchanged; obsolete attestation rejected; historical approved family route 144 unchanged; protected runs 122/128 immutable; confirm replay cannot approve different route revision. Do not modify generic route validators used for historical reads.
5. Check deletion RPC locking, product effective-step composition and cross-route base-family version lock before applying the migration. No destructive cleanup or legacy architecture remnants; consolidate existing relevant code instead of adding parallel pipelines.

## Current status

ARCHITECTURE SELECTED, SERVER IMPLEMENTATION NOT YET VERIFIED OR DEPLOYED. Pending exact migration and transactional tests. No live DB writes. G2/CI-032 OPEN.
