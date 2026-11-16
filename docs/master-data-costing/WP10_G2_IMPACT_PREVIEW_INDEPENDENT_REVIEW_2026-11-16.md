> **SUBSEQUENT OWNER DECISION:** preview source #442 merged normally at `d20a8991` under explicit approval. [Receipt and SQL stage](WP10_OWNER_G2_PREVIEW_MERGE_AND_SQL_STAGE_2026-11-16.md) supersede earlier source-merge-pending status below. No SQL applied or flag activated; exact Phase 1 application decision remains open. WP10 OPEN, 10/13.

# WP10 G2 impact preview — Independent review (16 November 2026 IST)

**INDEPENDENT SOURCE REVIEW COMPLETE — bounded default-off source merge recommended for owner approval. PR #442 stays draft. WP10 OPEN; programme 10/13. No source merge, SQL application or flag activation authority is inferred.**

Reviewed author head `af2070014a8bcc218e86e248f8ee08370da0bfba`, base main `38f61c34c39df9ca7dd4b2697ddeaf21f84d262b`. All author-head checks were green. The independent correction below is on the same PR branch, not a new client assignment.

## Fresh corrected-code CI evidence

Verified head `fbe86562d159a44bd9c3e11b7c2a7e7f13564555`, base `38f61c34`. [Successful run 43761775553](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43761775553), job `132957937860`, produced **286 PASS, 0 FAIL, 0 SKIPPED**: client 14, delivery 7, source 11, static 25, horizon 43, guards 37, provenance 26, preview fixture 42, existing Chromium 51 and preview Chromium 30. All corrected real-controller regressions and detected mutants passed. PostgreSQL is isolated/synthetic; Chromium is mocked at 390/1280.

[Artifact 14180832129](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43761775553/artifacts/14180832129) preserves fixture JSON, logs and screenshots; [machine-readable reviewer summary](WP10_G2_EVIDENCE/results/independent-preview-review-2026-11-16.json). Exact-head integrated-pec and Netlify header/redirect checks succeeded; Pages changed was neutral. The final evidence/status commit changes documentation only after this verified source; recheck current-head CI before merging.

## Source/SQL review

Proposal 06 is mechanically derived from the committed captured functions. Named/count-checked substitutions propagate proposed-subgroup context through both outer selectors and the product validator's family lookup at the route's effective-from date. Product-map precedence, proposed subgroup's group, effective windows, route-version ordering, product-route ambiguity, inherited routes, overrides and fixed per-route validation dates remain canonical. The three reused callees are fingerprinted, and generator/parity/static checks cover the derivation. The RPC checks identity/Manage Products View, uses a statement-stable read snapshot and returns non-authoritative structured states; no business write/dry run is used. All SQL remains unapplied.

Absence checks, prerequisite/live-definition fingerprints, receipts and fail-closed rollback include 06. The generated application manifest matches committed SQL hashes. It is an application proposal, not execution permission or proof of production performance/security/real-role acceptance.

Fresh local reviewer checks before/after the bounded client correction: client units 14 PASS, source/safety 11 PASS, SQL static/generator/manifest 25 PASS. Browser and PostgreSQL execution will be taken from exact-head CI, not fabricated from this environment's unavailable binaries.

## Additional client findings and corrections

| ID | Finding | Correction / regression |
|---|---|---|
| IR1 | `wp10ProductAttemptValid` checked selected product/subgroup/access but did not compare the full product draft or loaded state. Changing name/status/PTO while import/confirmation was pending could silently replace the displayed save summary with a different payload. The draft was rebuilt from the form immediately before the write. | Capture canonical draft and loaded-snapshot signatures plus editing state. Revalidate these after import, on preview rendering and before the writer. New IR1a/IR1b tests cover import-time changes, name/status/PTO changes and a fresh retry. IR-M1 removes only draft validation and demonstrates the unconfirmed replacement reaching the writer. |
| IR2 | The reservation check was inside the changed-subgroup branch. While a preview was pending/open, changing back to the stored subgroup and submitting again took the non-preview branch and could attach another listener to the shared confirmation controls. | Check a pending product attempt at entry, before classifying a new submission. The flag-ON governance dialog also refuses a second owner of its shared controls, covering ordinary saves and other governance callers. IR2a/IR2b cover pending/open reclassification; IR3 covers repeated ordinary saves. IR-M2 removes the two relevant protections and demonstrates the second save writing. |

These were source-level control-flow findings; the corrected mocked-controller tests and mutants have now executed successfully in the run above. Existing M2 now removes the added shared-dialog protection too; otherwise it no longer creates the duplicated-dialog fault it is intended to detect. This is a documented defence-in-depth mutation adjustment, not a runtime exemption. Flag-OFF behaviour is unchanged.

The correction changes only `products.js`, preview/activation browser regressions and documentation. Helper contents, content-hash token `6b42977628`, generated SQL, application hashes, grants-as-text, SW and migrations are unchanged.

First corrected CI run `43760654216` passed the pure/static and all PostgreSQL checks, then stopped with 50/51 passing in the existing Products/Readiness browser group. The sole failure was activation mutation M2: the new shared-dialog guard prevented the deliberately removed activation reservation from creating duplicates (one check/one writer). Its mutation now removes that shared protection too, matching its stated "without any serialization" fault. The new preview browser suite had not yet run because that earlier step failed. No missing-runtime-guard defect was inferred from this mutation setup failure; a full rerun is required.

WP12 PV-7's timeout description was corrected: the proposal file's 30-second `SET LOCAL statement_timeout` bounds installation only. Actual role/PostgREST request timeout and production-scale latency require separate verification; no persistent endpoint timeout was added.

Second corrected CI run `43761065457` passed all 51 existing browser checks and 29/30 preview checks, including IR1/IR2 and both new mutants. The sole failure was new IR3 before its first confirmation: its `changeSubgroup:false` harness setup left the required select unpopulated. Like existing B13, IR3 now explicitly selects the stored subgroup 1 before submitting. This is a fixture-input correction; the preceding validation modal correctly prevented opening a confirmation for an incomplete form. A fresh exact-head pass is still required.

## Live catalog-only application preflight

An independently authorised, read-only SELECT on project `qhmoqtxpeasamtlxaoak` at `2026-11-15T21:07:45Z` (16 November IST) found **9/9 fingerprinted dependency definitions matching**, **0 WP10 proposal functions**, and **0 WP10 triggers**. Live server reports PostgreSQL 17.4. [Exact query and metadata](WP10_G2_EVIDENCE/independent-application-preflight-2026-11-16.json) are retained; no validator, preview, build or business writer was invoked.

The catalog lists statement timeouts of 8 seconds for authenticated/authenticator and 3 seconds for anon, with authenticator lock timeout 8 seconds. These are role/database configuration observations, not proof of the actual PostgREST session limit or production-scale performance. Schema-specific public default-function ACLs are also captured for the eventual exact grant review. The nine matching hashes do not prove existence-only auth/PM-BOM dependency semantics, all privileges/constraints or live-role acceptance. SQL remains unapplied and separate exact owner execution authority is still required.

## Remaining gates (current)

Recommend the owner approve a normal merge of #442 into main with WP10_SAFEGUARDS_V1 default-off and proposals 01–06/99 unapplied, after checking current-head CI. This accepts source corrections and bounded synthetic evidence, not production SQL, rollout or WP10 closure. No source approval for #441 is reused as approval for #442. After source acceptance, prepare the exact application/ACL/existence-only dependency and performance review for a separate owner SQL decision.

Production-scale performance, real identities, installed PWA/cache activation/offline, hosted resolver and packaged Electron/Windows remain NOT TESTED. The SQL manifest is not production authority; no query against the production project was needed to repeat completed catalog work. WP08/PEC stay closed, WP09 closure/flag unchanged, WP11 defects and all WP12 receiving cases retained. G1 bounds and known baseline failures remain; five historical CRLF-only migration differences untouched and unstaged.
