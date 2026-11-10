> **SUPERSEDING MERGE STATUS — 10 NOVEMBER 2026:** Owner explicitly requested proceeding with the Scheme Master correction. **PR #263 was squash-merged to `main` at commit `cf41740ec054dac7cabd1df343eb4b0b67d5bd60`.** Verified subsequent `main` source: exactly **31** unique Scheme Master list fields, all three costly viability aggregates excluded, original ascending `scheme_name` order preserved, and focused test file present. Branch-vs-prior-main byte restoration showed the JavaScript production edit was precisely the one list projection + constant; no other client read/write path changed. **Important evidence limit:** GitHub connector returned no completed workflow run for the PR head, so executable Node suite/CI was **not independently confirmed**. No genuine signed-in browser acceptance or deployed-host client asset verification was performed. Do not infer that `main` being updated means the hosted PWA or Electron installer already includes the change. Database view remains 34 columns; new covering index remains present but no database action was part of this merge. Historical #19 F stays historically F; targeted runtime recovery check still OPEN. WP05 OPEN, formal 6/13. Older DRAFT status in this document below describes pre-merge evidence.

# WP05 R12 — Scheme Master narrow client projection candidate

**Date:** 10 November 2026. **Status:** DRAFT BRANCH REVIEW CANDIDATE, NOT MERGED OR DEPLOYED. Workstream WP05, Scheme Master historical F #19, performance issue #224. All production checks in this investigation are SELECT-only or EXPLAIN WITHOUT ANALYZE; no schema, view, index, grants, service worker, flags or business records changed.

## Actual source mismatch and minimal hypothesis

Current `public/shared/js/costing-suite-pricing-policy.js` loads the Scheme Master list through `costingFrom("v_costing_scheme_master_register").select("*")`, ordered by `scheme_name`. The live view has **34 columns**, with three expensive snapshot viability metrics computed by a LATERAL aggregate over `costing.sku_scheme_viability_snapshot` per scheme:

- `viability_snapshot_count`
- `viability_snapshot_period_count`
- `latest_viability_snapshot_period`

The client renderer's "Viability Periods" list/detail display currently looks up `viability_periods` or `viability_period_count`, **neither of which is a field in this live view**. The exact server `viability_snapshot_period_count` is not consumed by the current client source. Thus the current UI fetches the expensive aggregates without using their actual field names; the original field-display mismatch is **not fixed by this performance candidate**. Do not call omitted data feature parity achieved, and do not invent a value to fill the column.

## Exact live planner and bounded-read evidence

| Read shape | Live EXPLAIN estimated total cost | Viability snapshot aggregate scan |
|---|---:|---|
| Existing `select("*")` 34 fields, order+limit | **44,021.28** | Yes; old period/status index chosen |
| Explicit 31 fields, same order+limit | **825.48** | **No; pruned entirely** |

That is a **98.1% reduction in planner estimated cost**, not a measured runtime speedup.

One full-column materialization with **5s strict local timeout** produced PostgreSQL `57014` (see [R11](WP05_R11_SCHEME_MASTER_BOUNDED_TIMEOUT_AND_LIVE_STATISTICS_2026-11-10.md)). A separate single **31-field payload materialization** under `BEGIN READ ONLY; SET LOCAL statement_timeout='3000ms'; SET LOCAL lock_timeout='1000ms'` **succeeded**, returning **7 scheme rows** and **6,603 serialized JSON bytes**. The SQL `elapsed_ms=0.0` instrument readback is **not reliable** for actual latency due to evaluation order, so no measured duration is asserted. Both were management-role SQL, **not** authenticated PostgREST/ID-V browser response tests. No repeated production query load.

## Draft client change

On branch `fix/wp05-scheme-master-list-projection-r12` only:
- Replace Scheme Master list `select("*")` with `select(SCHEME_MASTER_LIST_SELECT)` containing **exactly 31 named fields** from the existing 34-column view.
- Preserve the existing view, access gate, role authorization, scheme policy edits, source ordering, page size (1000), list row identity and metadata needed by list and edit drawers.
- No SQL/DB, no client service worker or Electron shipping modification. No change to the pre-existing viability-period display placeholder in this draft. That field should receive a separate business/UI design if required (e.g. on-demand authorised detail retrieval or governed pre-aggregated summary), rather than forcing the expensive all-scheme view scan at list load.
- Add `scripts/scheme-master-list-projection.test.mjs` static tests asserting the exact source projection, exclusion of three snapshot aggregate fields, fixed order/pagination and explicit capture of the historical renderer field mismatch.

**Review caution:** This is a targeted *first-load performance correction candidate*, not a complete fix of "Viability Periods" functionality. A later UX agreement is needed if that column must be populated. Do not silently replace displayed missing information with a fabricated count.

## Required next evidence before merging

1. **Local CI / Node test:** run `node --test scripts/scheme-master-list-projection.test.mjs` and existing Scheme Master/PPM regression tests at the PR head. Source-text preflight confirmed projection 31 unique fields and list unchanged ordering; full local Node test was **not run** in this review environment.
2. **Client correctness:** check the 31-column list and relevant scheme detail/create/edit/disable/reactivate/historical drawer flows against current server contract, plus 390 px and 1280 px layout. Assert read-only ID-V never sees edit controls.
3. **Authenticated runtime:** after approval and deployment under an authorised release path, one supervised signed-in desktop read-only GET with actual HTTP response and network timing. The live 31-column SQL success is supportive, **not a replacement** for PWA verification.
4. **Index disposition:** keep the existing valid/ready `(scheme_id, period_start)` covering index unchanged until separately governed usage/maintenance decision. Its stats showed `idx_scan=0` and the old index was chosen for the full-view plan; narrowing the projection prunes viability metrics and removes that choice from the primary list path.
5. **Rollback:** restore the prior client Scheme Master list `.select("*")` on the specific revision, or revert the isolated client commit, **not** database schema/history; rollback may reintroduce the 57014 risk. Do not merge or release without owner-approved gate.

## Status

**DRAFT, not deployed; Scheme Master original 1280 px F remains historic F, broader WP05 OPEN and formal 6/13.** No production change was performed. Owner approved R9 SEC/PRM *policy directions*, not an unconditional new Scheme Master release. This PR requires code review, smoke testing and final merge/release authority.

## PR #263 review update — focused CI gate added (10 Nov)

After source audit, the client-only change remains limited to one Scheme Master list read. Latest branch review via GitHub source extraction independently confirmed:
- exactly **31 unique** projected columns, equal to the expected list in the test;
- no included viability snapshot aggregate columns;
- preserved `scheme_name ASC` and `fetchAllRows(...,1000)`;
- original client `Viability Periods` alias mismatch still documented, not treated as a passing functional feature.
- a regression test that would permanently *require the pre-existing alias bug* was removed, so future correction will not be blocked by the test.

Added `.github/workflows/wp05-scheme-master-list.yml` on the **PR branch**: Node 22, `node --test scripts/scheme-master-list-projection.test.mjs`, then `node --test scripts/costing-w6-pricing-nav/w6.test.mjs`. The GitHub workflow check **has not returned a completed run** at this readback. V8 source assertions are static code review, **not Node test execution**. Do not merge, deploy or call the visual/role tests PASS until actual CI and/or operator evidence arrives. Branch contains only client projection, its test, this doc and narrow CI workflow.

**Post-CI gate:** verify action logs, any Netlify preview as applicable, and preserve 34-column server view/7-scheme semantics. The owner requested to proceed with the fix, but that is not evidence that an unexecuted CI test passed. No production SQL change, feature flag, cache bump or Electron release was made.
