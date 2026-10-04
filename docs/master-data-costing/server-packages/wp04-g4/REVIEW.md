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

## Independent plan review at 2adcbfd (2026-10-04)

**Disposition: CORRECTIONS REQUIRED / HOLD application.** Review is complete at source/contract/security-plan level. It does not certify runtime or authorize DDL. Main remains 6e5d11ea; live six authority definition hashes/owners/ACLs/configuration match captured expectations; no candidate-name collisions. Source capture and draft hashes match; seven function body/rollback fingerprints independently checked. The proposed reuse of existing Control Center, canonical composition, separated membership gaps and bounded readers fits the approved scope. Public auth plus existing Control Center view, atomic ACL closure and no writer/module/lifecycle change are appropriate proposed boundaries, not live access proof.

One consolidated correction/review list follows; do not implement a new tool programme.

| ID | Finding | Exact bounded closure |
| --- | --- | --- |
| G4-R01 | `shared_counts` groups only by issue_code and outputs that code/count. G3 requires actual shared issue identity, scope/context/authority/evidence and affected-SKU references. Those fields are present in canonical rows but lost in this summary. Current registry has one row per each of seven codes, so no live conflation is demonstrated; the contract omission is still real | Preserve the complete canonical shared issue object as bucket identity, associate response context and distinct actually assessed affected SKU IDs/count. Do not infer business applicability or mutate severity. Handle empty membership explicitly; do not manufacture affected SKUs. Freeze the corrected response shape for later client package review |
| G4-R02 | Rollback guards only `prosrc`; the same AS body could have changed SECURITY DEFINER, search_path, owner, defaults or grants. Forward guards exact old attributes/ACLs, but new postconditions check only selected roles and attributes, not complete approved ACL/argument identity | Bind forward postconditions and rollback preconditions to the exact reviewed seven-function signature/default/return/volatility/security/owner/search_path/ACL identities as well as bodies. Reject drift; no broad revoke/default-privilege or role changes. Preserve exact old restoration text |
| G4-R03 | Runtime compilation, canonical/CSE parity, full-population statistics and performance, native/API access, payload certification and rollback rehearsal remain absent. Existing SQL-claim samples/source text cannot satisfy them | Keep application HOLD. Correct the draft first, then disposition a concrete proportional verification sequence against existing capabilities. No default paid resource, provisioning, fixture/Auth writer, generic harness or speculative production DDL. Where required proof cannot be obtained within authorized capabilities, identify that exact blocked operation instead of inventing PASS |

Payload review maps all current free-text sources: downstream control note; Direct Labour/Production/QC/Materials/Admin/Finance/Marketing allocation notes; scheme resolution notes; commercial warning; identity text. Latest governed SUCCESS Run115 bounded screening covered 636 rows in each of eight note areas and 1,272 scheme rows. No screened note contained digits. A broader word-marker pattern matched 636 QC notes and one control note; these are lexical hits, not a finding of monetary disclosure. Neither absence of digits nor regex screening certifies arbitrary/future notes, older/no-run contexts, commercial warnings or a nested payload. Do not silently strip canonical fields or redesign its authority. The exact nonmonetary contract conflict must be explicitly resolved in package review before application.

Live default function ACLs for postgres/public grant anon/authenticated/service_role; the atomic new-reader revokes are necessary. No current default function ACL for costing was reported. Anonymous/authenticated/service_role cannot CREATE in public. Existing app_has_permission obtains auth.uid and delegates the existing permission core; no user_metadata-based rule is introduced. These observations are source/security evidence, not signed-in API coverage or a general SEC-P01/02 closure.

Verification remains staged: (1) source and draft corrections, (2) explicitly reviewed compile/parity/rollback/access/payload/performance proof approach with honest capability limits, (3) only then separate authorized server application and bounded live checks, (4) later client package. No gate renumbering or business/architecture lock was approved. Forward/rollback SQL bytes remain unchanged by this review and **must not be executed as accepted packages**.

Current: WP04-G4 — Independent exact package review completed, bounded corrections required; application HOLD. Next: WP04-G4 — Corrected package and concrete verification disposition review. G0–G3 retained; G4 not completed; programme4/13; WP03closed. Parked/locked/DEC-014 unchanged; no production mutation/spend/merge/tag/release.
