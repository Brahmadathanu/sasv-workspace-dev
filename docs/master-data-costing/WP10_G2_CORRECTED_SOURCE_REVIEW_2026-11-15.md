# WP10 G2 — Corrected-source independent review (15 November 2026)

**WP10 OPEN; programme 10/13. PR #441 remains draft. No merge, SQL application or flag activation authority is inferred.**

Reviewed author head `57d846a2abb4453f11d2bec46937e582898a9020`, against main `6b7eb45f9aaab89a8916740f70caa7375499570d`. This record accompanies one bounded reviewer correction on the same branch. The earlier [independent review](WP10_G2_INDEPENDENT_REVIEW_2026-11-15.md) remains historical evidence of the original defects.

## Source review dispositions

| Finding | Corrected-source disposition |
|---|---|
| R1 | Accepted at source level: harmful valid-to-invalid subgroup edits reject; unknown after-state or unknown before/invalid after rejects with a distinct review-required reason. A valid after-state is allowed even if the before-state was unknown. Invalid-to-invalid, ordinary edits and products without active SKUs remain allowed. This is transactional protection, not a pre-submit preview. |
| R2 | Accepted against the committed catalog: all date-dependent selector windows are scanned, including approved product routes and approved/superseded family routes. The captured downstream validators use fixed per-route dates or static inputs. COMPLETE describes effective-date boundary coverage for the captured definitions at evaluation time; it does not promise immutable data across page requests or production acceptance. |
| R3 | Accepted at source level: reservation precedes module import; SKU/product/rights/draft/state are revalidated before dialog/submission; stale pre-check and rejection rendering are identity-bound. Author browser evidence remains mocked. |
| R4 | Author fixes accepted except for the additional cursor-contract defect below, now corrected by this review. |
| R5 | Accepted for an unapplied proposal: no silent overwrite/adoption, prerequisite/live-definition checks, transactional receipts, and fail-closed rollback on missing/mismatched provenance for an existing object. These are definition receipts, not proof of production permissions, performance or operational approval. |
| R6 | Fresh throwing-getter regression passes: storage access is inside try and only exact string `1` enables the flag. |
| R7 | Fresh mocked service-worker tests pass. All helper imports carry current content hash `419f1603de`; `sw.js` remains unchanged. Actual installed-controller/activation/offline acceptance stays with WP12. |
| Lifecycle/mobile | Disposal/rebind and whole-page ON/OFF comparison tests are present. The author's 24/24 Products and 27/27 Readiness results are historical mocked evidence at the author head, not fresh reviewer Chromium results. |

Moving proposals to `WP10_G2_UNAPPLIED_SQL_PROPOSALS/` is accepted. It leaves the PEC protected-path guard intact and keeps SQL outside migrations. GitHub `integrated-pec` at the reviewed author head completed successfully; Netlify header/redirect checks succeeded, Pages changed was neutral. These checks must run again for the new head.

## Additional defect found and corrected directly

SQL proposal 03 sets `v_last := rec.sku_id`, exits when the flagged-row limit is reached, and returns `v_last` as `next_after_sku_id`. Therefore a valid continuation cursor can **equal the last displayed SKU**. The client required it to be strictly greater; its unit suite incorrectly asserted that equality was invalid. Real full flagged pages could stop with a malformed-response error despite a valid server result.

The client now requires the cursor to be at least the last displayed SKU and strictly greater than the **sent cursor**. Subsequent rows must also be beyond the sent scan cursor, including when the previous displayed SKU was earlier than that scan position. Null/nonpositive/stalled/backward cursors, duplicate rows and out-of-order rows still reject.

A SQL-shaped cross-contract regression and a mutation restoring the old strict comparison pass. Chromium case R4.2 now uses equality with the last displayed row, followed by an empty scanned page and a final page. No SQL text changed. The helper content hash and all three importers were restamped.

## Fresh reviewer verification and limits

| Suite | Fresh result after the reviewer correction |
|---|---|
| Client units, including SQL03 contract and detected cursor mutant | PASS 14/14 |
| Mocked service-worker delivery | PASS 7/7 |
| Source/safety | PASS 9/9 |
| Draft-SQL static | PASS 19; 0 NOT PROVEN within this static suite |
| Isolated PostgreSQL horizon/guards/provenance | SKIPPED: PostgreSQL binaries unavailable in this reviewer environment |
| Chromium Products/Readiness | BLOCKED by missing Playwright Chromium executable; launch errors occurred before assertions. Browser download was attempted but the proxy connection failed. No fresh browser PASS is claimed. |

Machine-readable fresh results: [reviewer checks](WP10_G2_EVIDENCE/results/independent-cursor-review.json). Author fixture counts 43/37/19, static 19, browser 24/27 and all existing baseline classifications remain attributed to the author head. They are neither overwritten nor relabelled as acceptance of this reviewer runtime correction. G1's five NOT PROVEN bounds and known lifecycle/WP08 baseline failures remain unchanged.

## Next gate and retained contract

Run both mocked Chromium suites on this branch after the cursor correction (expected Products 24 and Readiness 27, including updated R4.2), plus the 14-unit cursor regressions; keep screenshots/evidence classified as mocked. Recheck CI for that exact head. This is a bounded verification continuation on #441, not a new implementation handover. If these pass, the source package can be presented for the owner's explicit default-off merge decision.

The read-only counterfactual impact preview is still **NOT IMPLEMENTED**. Existing family resolution reads the stored subgroup, so preview needs a reviewed explicit proposed-subgroup resolver contract preserving product/subgroup/group precedence and a read-only permission-gated endpoint. It must report before/proposed route, validity/unknown and affected active-SKU count without updating the product, running a rollback-based dry run, granting an override or weakening the transactional writer guard. This design is not authorization to change a live function or apply SQL. The existing transactional rejection does not satisfy the pre-submit preview requirement; G2 is not complete on that basis.

All production SQL, grant/permission/RLS changes, builder/scheduler execution, flags and deployment remain outside this review. Production-scale performance, real roles, installed PWA, hosted routes, packaged Electron and Windows remain NOT TESTED. WP08/PEC are not reopened; WP09 closure, WP11 defects, all WP12 obligations and the five historical CRLF-only migration differences are preserved.
