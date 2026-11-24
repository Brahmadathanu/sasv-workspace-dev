# Production Work Log — preserved operational reference (reuse manifest)

Owner direction 24 Nov 2026: Executive MIS is reporting-only; route-based production logging becomes the independent Production Work Log (PWL). Nothing below is deleted from history. This file is documentation only; it implements nothing.

## Durable reference
- Branch **`preserve/pwl-operational-g7-client-20261124`** on `Brahmadathanu/sasv-workspace-dev`, pointing at commit **`4d292fe9a68c0478e37a8686d0eacfc08cfb3a22`** (PR #526 head before the reporting-only separation). A git tag was attempted but the remote refused tag pushes; the branch is the reference. It is also reachable as the first parent of the reporting-candidate merge commit on the PR #526 branch (`git show 4d292fe9`).
- Do not delete, rebase or force-push that branch. PWL P0–P3 should branch from it.

## Preserved assets and intended PWL use
| Asset (path on the preserved ref) | What it is | PWL disposition |
|---|---|---|
| `public/shared/mis-batch-governance.html`, `js/mis-batch-governance.js`, `css/sasv-mis-batch-governance.css` | Batch Governance console: route-stage signing, governed FG packing preview/post, measured-excess modal, pack-line correction, exceptions | Source material for the PWL production-book client (stage pages, in-page excess, corrections). Re-home, do not keep as a parallel writer. |
| `public/shared/js/mis-g7-contract.js` | Client contract layer: RPC wrapper, refusal catalogue/wording, idempotency (IntentRegistry), pack/correction receipts, capability model | Reuse for the PWL client; rename to unversioned business API naming when the canonical API exists. |
| `public/shared/js/mis-governed-handoff.js`, hooks in `js/log-add.js`, `js/log-edit.js` | Default-OFF (`GOVERNED_LOGGING_HANDOFF = false`) Add/Edit hand-off and destructive-chain-replacement guard | Superseded by PWL absorbing Add/Edit/Update Log Status. Keep only as design evidence. |
| `scripts/mis-g7-client/*` (contract 24, static 15, page 20, bridge 19 vs real PG, edit-page 9, SW 15, fake-server, pg-bridge) | Client acceptance harness incl. real-PG bridge and network-loss replay | Reuse as the PWL P3 acceptance skeleton. |
| `public/sw.js` five-line network-first block + guard pins (`REVIEWED_MIS_G7_PINS`, `MIS_G7_SW_BLOCK_SHA256`) | PWA freshness for the operational page | Re-apply only when the PWL page ships. |
| Permission-registry rows (`module:mis-batch-governance` page row with Electron+PWA `app_module_clients`, plus 5 permission targets) | Applied in production, **zero assignments** | See owner decision D1 in the closure package. |

## Server objects that stay installed (S2–S7c, AUDIT mode, unchanged)
Eleven migrations, registered versions in `docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json`. PWL refactors their dependency on `daily_work_log` onto canonical stage execution later (P2/P6); until then they are not modified, replayed or reversed. Known `daily_work_log` couplings found in the reporting package: `mis_get_governance_exception_summary_v1` (read, FG-bulk-storage logs and packaging events) and the S2–S7 signing/pack/receipt functions. P4 must re-point or retire them with parity checks.

## Transferred operational requirements (traceability)
See §3 of `docs/executive-mis-g7-server/MIS_REPORTING_ONLY_CLOSURE_PACKAGE_20261124.md` (rows classified T): governed stage signing UI, governed packing and measured-excess UI, pack-line correction UI, Add/Edit/Update Log Status hand-offs, missing server contracts (governed packaging-event creation; non-destructive field-only save), operator acceptance sequence C, permission assignment, governed-logging activation, ENFORCE, core sign-off, evidence-first repair of the 29 missing-depletion lines.
