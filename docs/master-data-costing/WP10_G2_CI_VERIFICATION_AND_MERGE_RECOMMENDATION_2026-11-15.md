# WP10 G2 — Independent CI verification and bounded merge recommendation

**15 November 2026. WP10 OPEN; programme 10/13. Owner source-merge decision pending. SQL unapplied; flag default-off.**

The [corrected-source review](WP10_G2_CORRECTED_SOURCE_REVIEW_2026-11-15.md) found and fixed the client/SQL continuation-cursor mismatch in `587df95b38329c377a43cb697ef4a029aaa48831`. The remaining reviewer environment limitations were resolved by a dedicated offline GitHub Actions job, rather than relabelling the author's previous passes.

## Verified source and evidence

- Verified PR head: `9f28f05bc8cfaa8b9f0b4eeaa03f7eeae586ea94`, base main `6b7eb45f9aaab89a8916740f70caa7375499570d`.
- [Successful workflow run 43730545693](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43730545693), job `132861786839` (`wp10-offline`). Standard PR merge checkout, Node 22, Playwright 1.62.1, Ubuntu 24.04 and isolated PostgreSQL 16.
- [Logs, fixture JSON and mocked screenshots artifact](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43730545693/artifacts/14167374868), artifact id `14167374868` (approximately 1.28 MB).
- [Machine-readable verification summary](WP10_G2_EVIDENCE/results/independent-ci-verification.json).

| Suite | Fresh CI result |
|---|---|
| Client units, including SQL03 continuation equality and detected mutant | PASS 14/14 |
| Service-worker delivery VM | PASS 7/7 |
| Source/safety | PASS 9/9 |
| Draft-SQL static | PASS 19; 0 NOT PROVEN within this suite |
| Horizon fixture and mutations | PASS 43 |
| Guard fixture, concurrency and mutations | PASS 37 |
| Provenance/preflight/rollback fixture and mutations | PASS 19 |
| Mocked Chromium Products + Readiness, 390/1280 | PASS 51/51 (24 Products + 27 Readiness) |
| Total | **199 PASS; 0 FAIL; 0 SKIPPED** across these G2 checks |

The browser log explicitly confirms updated R4.2: cursor equals the last displayed SKU, then an empty scanned page and final page, with ordered continuation requests. The fixture also confirms SQL03's flagged-row limit returns the last scanned SKU, matching the corrected client contract.

`integrated-pec` at the verified head also completed successfully. Netlify header and redirect checks succeeded; Pages changed was neutral. The verification workflow uses only repository sources, captured definitions, synthetic rows, mocked browser requests and a disposable Unix-socket PostgreSQL cluster. No Supabase credentials, live roles, production writer, production preview or builder are used. The first CI-workflow commit failed validation before any test ran because runner context was used at job-env scope; the next commit moved path initialization into a step and produced the successful run above. This was a workflow setup error, not a runtime test failure.

## Review verdict and exact proposed next action

R1–R7 corrections and the additional reviewer cursor correction are accepted for this **source package**, with the captured-definition and synthetic-data limits stated in the reviews. The new content-hash helper imports, storage getter fix, serialised activation flow, horizon paging/disposal and SQL preflight/receipt protections are now supported by fresh independent offline execution, including browser and PostgreSQL checks.

**Recommend the owner approve a normal, non-force merge of PR #441 into main with `WP10_SAFEGUARDS_V1` remaining OFF and all SQL proposals remaining unapplied.** The final documentation-only commit adds this evidence and the preview contract; it changes none of the verified runtime, SQL proposal, test or workflow content. Recheck current-head CI before merging. The recorded authority so far covers draft implementation, not an automatic source merge.

This is explicitly a bounded source merge recommendation, **not G2 completion, rollout or WP10 closure**. It does not authorize SQL execution, grants/permissions/RLS, flag activation, scheduling/builders, registry changes, deployment or Electron repointing. It preserves the five historical CRLF-only migration differences. An automatic hosting system may react to a future owner-approved merge; this review does not initiate a deploy or activate the flag.

## Incomplete preview and retained release gates

The read-only counterfactual subgroup-impact preview is still **NOT IMPLEMENTED**. A [concrete draft contract](WP10_G2_COUNTERFACTUAL_PREVIEW_CONTRACT_DRAFT_2026-11-15.md) now identifies every place proposed-subgroup context must propagate, including the nested product-route validator's family resolution at the route's own effective-from date. It specifies response states, access checks, client race handling and fixtures/mutants. No endpoint or proposal 06 is introduced by the contract document. Transactional proposal 05 does not satisfy pre-submit preview acceptance.

Source merging with this item open must not be presented as completing the impact-review flow. Its implementation remains a tracked G2 item; SQL application still needs exact separate authority, fresh dependency/absence checks and appropriate performance/security review. Existing amount-policy and override decisions are not reopened.

Real-role behaviour, installed PWA controller/activation/offline operation, production-scale performance, hosted resolver, packaged Electron and Windows remain NOT TESTED. G1's five NOT PROVEN bounds and known lifecycle/WP08 baseline failures retain their prior classification. WP08/PEC are not reopened; WP09 closure, both WP11 defects and all WP12 obligations remain intact.
