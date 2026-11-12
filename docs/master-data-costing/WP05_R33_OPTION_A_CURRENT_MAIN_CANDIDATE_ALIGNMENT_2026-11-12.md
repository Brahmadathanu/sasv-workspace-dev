# WP05 R33 — Option A candidate reconciled to current main (12 November 2026)

**Governance checkpoint, not production execution.** Owner-approved R28 Option A states PPM View may access Scheme Master audit history; CCC/CBM/CSR/MCM View alone must not. This **does not** authorise applying SQL to live Supabase. Formal WP05 remains OPEN **6/13**, W5-06 OPEN.

## Source alignment and evidence

The original review-only draft [#311](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/311) had diverged from `main` after the R30/R31/R32 documentation merges. A new clean review branch `review/wp05-r28-ppm-audit-current-main-20261112` was created from main commit `013e2bac874396fc471e5ef4eb7dd5cac398432e`. Its **six candidate files were replayed byte-for-byte unchanged** from the original draft: the workflow, R29 document, guarded view replacement SQL, guarded rollback SQL, PostgreSQL 17 isolated integration suite and offline structural suite. No new SQL, privilege, view, application or test-model changes were introduced in this replay.

- New **DRAFT, UNMERGED** review: [PR #315](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/315). GitHub comparison at review time: `status=ahead`, **behind 0**, exactly **six added files**, with no changes to existing operational files or production migration scripts.
- Original PR #311 was **closed unmerged as superseded** with an explicit cross-reference to #315. Closure of an obsolete draft does not mark a security gate complete.
- Exact-head GitHub Actions [run 43172483197](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43172483197): PostgreSQL **17.11** synthetic role/ACL/apply/rollback suite **10/10 PASS**, offline structural contract **PASS**. This check includes correct live-parity `service_role` SQL SELECT denial and the fail-closed drift/rollback scenarios from R31.
- Earlier R32 read-only production preflight: original view MD5 `001024540bdeab9f2e5aa4ec2a6f6c53`; postgres owner; 20 columns; exact `relacl={postgres=arwdDxtm/postgres,authenticated=r/postgres}`; anon and service_role SELECT false; PPM target active/assignable; permission helper source MD5 values unchanged. No view rows, JWT logins or permission records for named users were retrieved.

## Authority and next gate

**Approved:** R28 business-policy Option A, offline fixture/metadata review. **Not approved:** production migration/DDL, grants, direct view row reads, staff role provisioning, service-role elevation, production writer invocation, preview calls or active PWA changes.

Before production execution, obtain a **separate and explicit owner approval** for the one-view SQL in draft #315; immediately before running it, recheck the exact original production view definition, owner, full 20 names/types, ACL including service-role denial, view comment, exact helper/function and permission target metadata. Stop on drift. If separately approved, only the reviewed guarded one-view SQL could be considered; run catalogue-only postchecks and then separately authorised authenticated read-only positive/negative role acceptance without exporting sensitive row payloads. Guarded rollback requires its own operational review on any failure.

**Do not merge #315 or deploy any candidate as a side effect of governance documentation approval.** Five other D-2 view owner policy decisions and effective signed-in behaviour remain open; W5-06 OPEN, W5-10 OPEN, D-1 writer denial NOT TESTED (governed acceptance) and D-4 p95 4s HOLD. Historical AE1 evidence unchanged. WP05 **6/13**.
