# WP10 — Single owner production rollout decision packet (2026-11-16)

**Authority:** SASV owner. **Status:** REVIEW ONLY / NO APPROVAL REQUESTED BY THIS FILE. **Source:** draft PR #444, branch `review/wp10-crossflow-concurrency-20261116`, anchored to main `c5029409278445c89a1bc506c15824ec0fa91e63` at preparation. Revalidate exact PR head and main immediately before approval/execution.

## 1. Scope and test evidence
One integrated classification hierarchy security package, not four independent releases. Twelve `SECURITY DEFINER` permission-checked RPCs serve the four existing master screens. Explicit `product_groups.kind_id` selection; no arbitrary kind default. View/Edit control surfaces fail closed; backend `require_permission(...,true)` is authoritative. Parent/subgroup delete checks block hierarchy cascades and existing FK references. Guarded separate SQL revokes only authenticated INSERT/UPDATE/DELETE after compatible clients are installed, retaining SELECT.

Successful isolated CI verification:
- [run 43843464599](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43843464599): SUCCESS, guarded CL15 candidate schedules, reverse order, mutation witness, dedicated rollback, existing suites; 59/59 mocked Chromium and 30/30 preview browser tests.
- [run 43841866157](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43841866157): SUCCESS, 57/57 isolated PG security CRUD/revoke/rollback tests plus 59/59 mocked Chromium and 30/30 preview.
- [run 43840013584](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43840013584): SUCCESS, 40/40 four-level static source checks.

**These are offline fixtures/mocked accounts, not live role testing.** The PR includes later documentation-only changes; reread exact-head required checks before merge.

## 2. Read-only production preflight at preparation
As of 2026-11-16: none of the four representative `rpc_wp10_create_*` objects exist in the live public schema. Neither proposal 05's BEFORE/AFTER functions/AFTER trigger nor the CL15 parent-lock function/trigger exists. The phase-2 migration and CL15 fix are **unapplied**. This read-only check is NOT an authorization to install them.

## 3. Exact execution units; approvals are separate and bounded
| Phase | Operation | Dependency | Approval gate |
|---|---|---|---|
| A | Independent SQL/code/security review, CI green, exact live preflight and compatible-client release plan | No production writes | Non-production work permitted |
| B | Apply `review-only-parent-classification-governed-rpcs.sql` then `review-only-subgroup-governed-rpcs.sql` on live via reviewed, separately authorized mechanism; capture transactional receipts | Live schema and permissions match review | **Explicit owner authorization required** |
| C | Merge approved client source, deploy PWA and release compatible Electron build; test Editor/View-only/No-access, each of four modules, error messages, item creation/rename/deletion safeguards, narrow screens, cached assets | Phase B RPC availability | **Explicit owner authorization required** |
| D | Apply pending G2 proposal 04 (active SKU reparent guard), 05 (product-route impact guard), and guarded CL15 correction, subject to provenance/preflights and independent SQL review | Phase-1 G2 objects already applied; proposal 05 must precede CL15 | **Explicit owner authorization required** |
| E | REVOKE authenticated INSERT/UPDATE/DELETE on all four master tables using `review-only-four-level-auth-dml-revoke.sql` only AFTER installed older clients are compatible or an explicit support/cutover decision is made; verify SELECT preserved and all 12 authorized RPCs continue | Phase B/C, legacy Electron cutover approved | **Separate explicit owner authorization required** |
| F | Formal programme gate reconciliation, residual Route Manager writer disposition, evidence registry, deployed provenance, rollback readiness, docs and final closure | All gates verified or owner explicitly accepts defined exceptions | **Final owner sign-off required** |

This table is **proposed ordering**, not permission to operate. Phases C and D may need independent sequencing for product lifecycle; do not interleave without a deployment plan. Proposal 04 and 05 must pass their existing independent provenance checks; do not assume the CL15 candidate alone closes them.

## 4. Hard release blockers
1. **Legacy Electron:** packaged app serves its own older HTML/JS files, and updater is not an instantaneous forced migration. No known fleet-wide version adoption evidence. Old four screens use direct DML and will fail if Phase E occurs early. Preserve authenticated write grants until a verified compatible-client cutover.
2. **Route Manager mapping mutations:** authorized subgroup mapping approval/supersession and inactivation can alter the effective route without taking the CL15 product-parent lock. At latest snapshot, 16 effective approved subgroup mappings relate to 253 products and 109 active SKUs. This is a candidate impact population, NOT a list of known-invalid SKUs. Until a proof/mitigation or explicit bounded owner disposition exists, **do not claim global route concurrency protection or WP10 formal closure**.
3. **Privileged reparent:** service-role alterations of `sub_groups.product_group_id` are outside the four-level authenticated REVOKE and are not a supported governed RPC operation. A trusted operational governance policy is still required.
4. **Live role acceptance:** must verify canonical Editor, View-only and No-access credentials in the target production UI without writing to real master rows except bounded, independently approved test fixtures.
5. **Compatibility/restore:** do not invoke RPC-drop rollbacks while clients rely on them. Restore privileges only with separately approved rollback SQL. Keep exact SQL checksum, object inventory, run receipts and affected user cohorts.

## 5. Acceptance evidence ledger (not yet complete)
| Acceptance | Status |
|---|---|
| 12 RPC definitions compile and pass synthetic Edit/View-only/anonymous checks | PASS — isolated PG |
| Direct DML revoke + rollback works in disposable PG | PASS — isolated PG |
| CL15 candidate blocks reproduced race, negative mutation witnesses unsafe baseline | PASS — isolated PG |
| 4 client screens reference RPCs, not table writer calls | PASS — source-level |
| Browser control guard @390/1280 for Editor/View-only/No-access/error | PASS — mocked |
| Current live RPC objects and CL15 missing | VERIFIED — read-only preflight |
| Production owner-role CRUD, cache freshness, mobile UX, older Electron | NOT TESTED |
| Route mapping inactivation/replacement safety vs active SKUs | OPEN — NOT PROVEN |
| Final four-level authenticated privilege revoke | NOT APPLIED |
| Merge/PWA/Electron deployment | NOT PERFORMED |
| WP10 formal sign-off | OPEN |

## 6. Decision summary
Approve nothing implicitly. The next legitimate owner review should be for a **bounded RPC server-first installation** only, after independent source/security inspection and exact preflight. Client release and 4-table DML revoke are **separate** choices because installed Electron versions remain unknown. The Route Manager concurrency residual cannot be silently converted to PASS.

Relevant retained documents: `WP10_INTEGRATED_CLASSIFICATION_GOVERNANCE_GATE_2026-11-16.md`, `WP10_ROUTE_WRITER_RESIDUAL_AND_CLOSURE_DISPOSITION_2026-11-16.md`, `WP10_FOUR_LEVEL_DML_REVOKE_AND_ELECTRON_COMPATIBILITY_2026-11-16.md`, `WP10_CL15_GUARDED_CORRECTION_REVIEW_GATE_2026-11-16.md`.
