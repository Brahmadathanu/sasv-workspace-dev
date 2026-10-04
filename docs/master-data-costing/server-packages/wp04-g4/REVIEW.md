# WP04-G4 — Concrete atomic server package (unapplied review draft)

This is the exact SQL proposal requested by the current gate, not implementation approval. Server application remains ChatGPT-owned under DEC-014. These Git files are optional review/rollback traceability, not a Git merge prerequisite. No target, service, identity, writer, client feature or production SQL operation was created. The withdrawn harness/launcher/environment programme stays withdrawn.

## Scope and inputs

Captured directly from `qhmoqtxpeasamtlxaoak` on 2026-10-04 using READ ONLY / 10-second timeout / ROLLBACK. Entry main `6e5d11ea2b7503931dbe4dcb840ec753ce8f986f`, audit tip `759ad64c3ff0ebf2d10118a281ded9efb616d896`. Source bodies/owners/ACLs in source-before.json are authoritative captured input. Two existing functions are replaced: public.rpc_get_product_sku_readiness and costing.fn_product_sku_readiness_enrich. Two new private helpers and three new public readers implement the G3 proposed signatures. No other function body/table/view/index/RLS/permission assignment is changed.

## Files

- `source-before.json`: captured canonical/enrich/run-evidence/shared source definitions, owners, ACLs and MD5s; no business rows or credentials.
- `forward-draft.sql`: one transaction, precondition definition/ACL guards and candidate-name collision guards, complete function package, closed new ACLs before commit. Existing EXACT_RUN branch retained; live/enrich rules factored into private helpers; all three readers included. **Only the complete atomic package is a future application candidate**.
- `rollback-draft.sql`: one transaction, rejects missing/drifted package bodies, drops only three new public readers, restores exact prior wrappers, drops private core then shared composition, verifies original definitions/ACLs. No CASCADE or business/snapshot/history cleanup.
- `package-manifest.json`: static extraction facts, exact signatures/body/file digests and honest NOT_RUN statuses.

## Composition and compatibility

Canonical public signature, authentication, Manage Products OR Control Center view, context validation and selection remain. EXACT_RUN branch stays verbatim. LIVE_AS_OF selects route evidence and shared issues before calling the common core; the core keeps current Product/SKU foundation predicates, BOM/batch/MRP/selling lookups, exact commercial point lookup with unordered LIMIT1, base dependencies, five dimension statuses and downstream controls. A second set of portfolio severity rules does not exist. Shared enrichment, caught policy exceptions, no-success-run behavior and existing internal ACLs stay authoritative.

Portfolio evaluates the route function once, refuses duplicate Product rows, evaluates shared issues once only with a successful run, and materializes canonical assessment once per member before search/filter/page/statistics. The full materialization and JSON memory/runtime cost are NOT proven. A MATERIALIZED statement establishes intended execution structure, not a measured SLA. No per-SKU public RPC fan-out or commercial broad scan/order/index change.

Filter options are literal metadata extracted from current canonical/run/shared definitions and accepted G3 vocabulary. OR within arrays; AND across categories with a same-incidence witness. Counts cover full population before filters; owner/route/dependency buckets count distinct affected SKUs and are not additive population totals. Regional counts preserve SKU+region+raw/effective status. Product gaps use separate membership-only semantics and no invented readiness. Period catalog includes missing valuations. Input/cardinality/search/page/null validation follows G3; invalid auth/context/assessment aborts instead of zero or fake UNKNOWN.

## Security and payload review

New public readers require auth.uid and existing `module:costing-control-center` view. New internal helpers revoke PUBLIC/anon/authenticated/service_role; only owner can invoke. New public readers revoke default PUBLIC/anon and grant authenticated EXECUTE; permission checks still required. No service-role actor bypass, new table/schema SELECT or permission assignment. Existing wrappers' captured ACLs checked before/after; owner postgres; fixed search_path ends pg_temp; no dynamic SQL/user_metadata authorization.

The portfolio preserves exact canonical JSON, including free-text notes. Static source review finds structured status/identity/evidence metadata rather than monetary columns, but arbitrary note content is not certified nonmonetary. Bounded latest-run control/QC note screening found zero money-marker matches among 636 notes in each area; **that is only a triage observation, not a complete nested payload audit**. G3 explicitly prohibits silently masking/removing fields if exact canonical JSON conflicts with the nonmonetary contract. Independent review must settle this before apply authorization; no new projection decision is made here.

## Review and required proof matrix

| Required proof | Concrete check | Current evidence |
| --- | --- | --- |
| Static source extraction | Compare verbatim EXACT_RUN branch, base/live rules except private route binding, enrich body except supplied shared issues, unchanged commercial expression | Checked locally; runtime equivalence NOT_RUN |
| Compilation | PostgreSQL17 compilation and actual first invocation of all bodies; all function signatures/types/defaults | NOT_RUN; no server or local DB installation authorized in this preparation |
| Canonical parity | Existing baseline vs extracted candidate in one consistent observation for SKU10/11/42/114/1795; LIVE_AS_OF and EXACT_RUN run114/run115; full JSON equality, including missing route/inactive lifecycle | NOT_RUN; no speculative DDL/fixtures allowed by this draft |
| No-run/caught exceptions | No-success canonical 8 dependencies/no enrichment; missing valuation error; caught global issues remain BLOCKED rather than transport errors | Source preservation only; required isolated edge-case proof unresolved |
| CSE-P01 | Enumerate all SKU+period candidates, compare baseline/candidate consumed status/source/warning in same observation and query plans; stop on changed consumption | NOT_RUN; retaining unordered helper is necessary, insufficient; no authority choice approved |
| Membership/filter/count/page | OPERATIONAL611 and ALL_EXISTING1793 current membership; gap516/179 overlapping counts; matching across one incidence, literal wildcard search, null/invalid/max inputs, empty page still counts; pagination union | NOT_RUN for new readers; existing source inventory only |
| Auth/permissions | Anonymous denied; Product-only denied on new readers yet existing canonical succeeds; view-only allowed reads and no writes; authenticated no-module denied; direct helpers denied | Source/ACL review only; actual native/API coverage unresolved, SQL claim simulation not sufficient |
| Payload | All nested keys/arrays/free-text and source fields reviewed; no rates/prices/margins/payroll/amounts; retain canonical payload or review explicit projection conflict | NOT CERTIFIED; limited note pattern check is not proof |
| Performance | Full statistics+page work at both memberships with bounded timeout/buffers/loops, route/shared once, canonical once per member; one measured query then expand only if safe | NOT_RUN; no full-catalog production load test from this preparation |
| Atomic forward/rollback | Captured source/ACLs exact before, all package objects together, rollback after forward, existing consumers unchanged, no cascade | Draft guards/static ordering only; rehearsal NOT_RUN |

The remaining proof items are apply prerequisites under the existing MD. This document does not substitute production experimentation for them or revive paid/offline tooling by default. The independent package review must explicitly disposition the concrete verification approach and unresolved prerequisites before authorizing any server operation. No package is to be applied simply because the user says proceed with preparation.

## Stop and rollback boundaries

Before any future approved operation: fetch/reconcile main; bind project/ref from independent server evidence; re-read relevant source/ACLs; reject source or name drift; verify exact package digest and reviewed operation; no guessing environment settings. Forward uses one transaction, lock_timeout2s/statement_timeout15s; any error aborts package and requires explicit rollback of failed transaction, never continue statements or retry uncertain commit. Timeout does not prove no committed operation; reconcile catalogs before retry. After future verified apply, unexpected regression means stop and use the exact separately reviewed rollback, only if all candidate bodies match. Client is not delivered until server proof passes. Migration/operation-history handling belongs to the supported direct Supabase operation, not manual history edits.

Rollback source text is exact captured pg_get_functiondef output. Body guards use exact AS-body MD5, because CREATE formatting can differ from pg_get_functiondef formatting; old restoration guard uses captured definition MD5 and ACL. Signature/body match is not a proof that unrelated dependencies are healthy; live/source verification remains required.

## Current gate and next

WP04-G4 — Concrete atomic server-package draft prepared, independent plan review pending. Preparation does not mark server implementation/proof complete. Next: WP04-G4 — Independent exact package/rollback/security/verification review. If proof is absent or contract conflict found, HOLD the affected apply stage and propose a concrete correction; never fake success. Programme4/13; WP03closed; DEC-014/parked/locks unchanged; no mutation/spend/merge/tag/release.
