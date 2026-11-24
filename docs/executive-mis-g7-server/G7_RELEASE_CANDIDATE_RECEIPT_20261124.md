> **SUPERSEDED SCOPE (24 Nov 2026, later the same day):** the owner restricted Executive MIS to reporting only. The operational Batch Governance page, the Add/Edit hand-offs and the five-line service-worker block described below were separated from the release candidate and preserved on `preserve/pwl-operational-g7-client-20261124` (commit `4d292fe9`) for the Production Work Log. Current candidate, results and requirement classification: `MIS_REPORTING_ONLY_CLOSURE_PACKAGE_20261124.md`. The migration reconciliation in §1 stands. The text below is the contemporaneous record and is not rewritten.

# MIS G7 — client integration, deployment reconciliation and release candidate (24 Nov 2026)

Branch `claude/executive-mis-g7-client-dmijyz` (started at `6ee9553401e675e78f8393215ac002b84a0727fe`; `origin/main` at `171d84e3`). G7 OPEN 7/11, G8 parked. No production write, permission assignment, core sign-off, ENFORCE switch, Electron publication or release tag was performed by this work. Governed logging activation is **default-disabled** (`GOVERNED_LOGGING_HANDOFF = false` in `public/shared/js/mis-governed-handoff.js`).

## 1. Eleven-migration reconciliation
All eleven migrations are LIVE with real registered versions (S2–S6 as before; S7a `20261124125626`, S7b `20261124125644`, S7c `20261124125704`). `MIGRATION_IDENTITIES.json` has 11 LIVE rows, `pending_migrations: []`, regeneration (`gen_migration_identities.mjs`) is byte-identical. Tests that expected 8 LIVE + 3 pending were updated (`mis_g7_acceptance_pg.test.mjs`, `scripts/mis-g7-client/static.test.mjs`). The deployment map §6 and the S7/continuation/README docs carry status notices; historical receipts are preserved. The permission registry is recorded as APPLIED (banner on `CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql`, file name kept; its own guard refuses a replay). No installed migration SQL was edited or renamed. Production prosrc fingerprints of the patched signer/packer match the repository pins (`acf75601…d194`, `e663eeaa…aef2`).

## 2. Add / Edit Log Entry governed hand-off
Module `public/shared/js/mis-governed-handoff.js`, hooked into `js/log-add.js` (hand-off after save, `mis_sign` link parameter) and `js/log-edit.js` (`mountEditGovernance` before the modal opens; `governedBlocksChainWrite` before the delete confirmation).
- Add and Edit both show product, exact batch/BMR, effective route context (`mis_get_batch_route_context_v1`), persistent stage status from the committed log (`mis_get_batch_stage_status_v1`: UNSIGNED / SIGNED / SOURCE_CHANGED / NOT_VERIFIED), signing with evidence reference (IntentRegistry key), void/correction for SOURCE_CHANGED, and a deep link into Batch Governance (product, batch, tab, event, log).
- FG receipt validation is the server's (exact ledger evidence); transfer-only logs are refused by the server and shown with the receipt reason text. The client never writes tables or the ledger.
- Legacy editor destructive chain replacement: while the flag is ON and the viewer has signer/packing view rights, Save and Delete are blocked for logs whose packaging chain is SIGNED or SOURCE_CHANGED, with an explanation that saving would destructively bypass governed packing. S5/S5b server protection is unchanged and still authoritative.
- Legacy batches / AUDIT: history is NOT_VERIFIED (shown, not hidden); flag OFF → both pages behave exactly as before.
- **Missing server contracts (not invented, documented):** (a) creating the packaging-event header and its lines is still performed by the legacy editor's own RPC path; there is no governed "create packaging event" RPC, so Add cannot take over packing, it only hands off; (b) there is no non-destructive "field-only save" for a Done packaging log, so Edit is blocked rather than rerouted. Both need a new server migration if the owner wants them; neither is required for governed operation because packing/corrections go through `mis_pack_fg_bulk_v1` / `mis_correct_pack_line_v1` from Batch Governance.
- Batch Governance remains the supervisory console.

## 3. Service worker (`public/sw.js`)
Inspection: cache-first static assets, network-first for a pathname allowlist, navigation network-first, activate purges every other cache, `CACHE_NAME = hub-cache-v394` (identical on main). The MIS dashboard script is requested with `?mis-c1=` queries and the governance assets were cache-first, so a baseline test proves stale copies are served after a server-contract change.
Change: **five added lines** (3 comment + 2 pathname rules): network-first (offline cache fallback) for `/shared/js/(mis-batch-governance|mis-g7-contract|mis-governed-handoff|executive-mis-dashboard).js` and `/shared/css/sasv-mis-batch-governance.css`. `CACHE_NAME` is deliberately not bumped (about 50 unrelated tests pin v394 and the network-first rules need no new cache generation). If the owner prefers a bump, it is a single constant plus those pins and is not part of this candidate. Guards: `REVIEWED_MIS_G7_PINS` (content sha256, branch-scoped) in `scripts/lib/pec-protected-path-guard.mjs`; WP11 approved-delta strip for the pinned MIS block. Tests: `scripts/mis-g7-client/sw.test.mjs` (baseline stale, fresh serve, cache refresh, offline fallback, navigation fallback, unrelated assets still cache-first, earlier network-first rules intact, activate purge, five-line diff, CRLF). Nothing was published.

## 4. Test results
Pass/total (skipped), run on the branch before merging main; after merging `origin/main` (`171d84e3`, clean merge, `public/sw.js` unchanged) the SW, static, guard, WP11-delta and acceptance suites were re-run and pass.
- Server (real PG16): policy 3/3; core 64 pass + 1 skip of 65; acceptance 21/21; live-editor 21/21; S7 36/36. **S7 real-catalog 0/7 — all 7 skipped: BLOCKED**, the private production packets are git-ignored and absent from this checkout (the owner accepted the replay limitation).
- Client: contract 24/24; static 15/15; dashboard 2/2; page 20/20 (desktop, 320/390/768 px, Electron/PWA HOME); real-server bridge 19/19 (includes network-loss replay with one key, excess replay, transfer-only refusal, receipt update, deep link); edit-page 9/9 (real Add/Edit pages against real PG); SW 15/15.
- Guards: pec-protected-path-guard 152/152 assertions (1 test); WP11 approved-delta 5/5.
- Regression: MIS-C1 dashboard 48/48; FG-BIT-UX-1 navigation 3/3, static 10/10, sw-freshness 11/11; WP08 resolver 8/8, selection 8/8, browser 44/44; Electron security-hardening 8/8; WP10 safeguards all pass except the two below.
- **Failures identical on main (pre-existing, unrelated):** `mis-launcher-route` #1; `fg-bit-ux-1/page` #11 and #31; `wp08 source` #6; `electron-main-smoke` (needs the Electron binary). Skipped for lack of binaries/artifacts: electron-updater-compat 4, updater-artifact-verify 3.
- **Failures that appear only on this branch:** WP10 `source.test.mjs` S4 ("no new permission target, registry entry, launcher entry or route in the client package") and S6 ("proposal sources stay outside supabase/"). They assert that the client package adds no MIS registry/proposal artefacts, which G7 intentionally introduces; they pass on main. They need an owner-reviewed pin update or a decision, which I did not make.

## 5. Electron candidate build plan (do not execute from this branch)
1. Merge the PR to `main` only after the owner approves; keep governed activation disabled.
2. From `main` run the existing release workflow for the next version; recommended **6.5.0** (minor: new user-visible page, nav registry, hand-off module; main is 6.4.2) — the owner decides.
3. Build the Windows candidate with the repository's normal electron-builder script as an unpublished artifact; run `scripts/electron-smoke/*` and `scripts/pec-electron-acceptance.mjs`; verify the packaged app opens `public/shared/mis-batch-governance.html` and Add/Edit Log Entry load the hand-off module.
4. Do not publish the GitHub release/updater feed until the operator acceptance below (A and B) passes on the candidate.

## 6. Operator acceptance sequence (authenticated, real production)
**A — non-mutating / permission-denial (safe anytime)**
1. User with no MIS targets: Batch Governance opens the permission gate, no RPC beyond `app_has_permission` runs.
2. Executive MIS dashboard still loads; Batch Governance appears in navigation (Electron and PWA).
3. User with view-only on a target: lists and previews load, action buttons are disabled with the permission reason.
4. Open an old batch: statuses show NOT_VERIFIED (historical), not UNSIGNED; open a post-cutover batch: UNSIGNED.
5. Hard-refresh on PWA: MIS assets are fresh (network-first); airplane mode: page shell/scripts come from cache.
**B — ordinary genuine production logging (governed activation OFF)**
6. Add and Edit Log Entry behave as before (no panel, no blocking). Log only real work; do not log anything for the test.
**C — governed signing / packing / correction (requires the owner's explicit authorization, assignments and a real batch)**
7. Owner assigns signer/packing/excess targets to named users and sets the flag ON in a reviewed change (not part of this PR).
8. On a real current batch: sign the stage from Add/Edit hand-off, refresh (status persists), pack through Batch Governance, check preview equals posting, check one ledger movement; repeat the same click after a network drop (idempotent replay). Use measured excess only if a real scale reading exists; never invent excess, stock movements or signatures.
9. Correct a pack line and confirm the signed stage turns SOURCE_CHANGED after an upstream change, then closes without re-signing when Done.

## 7. Blockers / residual items
- Governed activation, ENFORCE and core sign-off remain owner decisions (core gate `CORE_MIGRATION_NOT_ACCEPTED`).
- Missing server contracts in §2 (a), (b).
- 9 FG logs report `NO_SOURCE_LEDGER` (historical, validator-reported, not changed).
