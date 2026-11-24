# SASV Workspace v6.5.0 — PEC Purchase Allocations and dialog improvements: release record

Date prepared: 2026-11-24. Previous stable: v6.4.2 (`62b1f12`, published 2026-11-23). Service-worker cache
generation: `hub-cache-v394` -> `hub-cache-v395`. Both were re-checked against live state immediately before this
release PR (unchanged by concurrent work).

## Contents

| Item | Reference |
|---|---|
| FIFO chronological / return-adjusted receipts (server, already live) | PR #523, migration `20261124103114` |
| Modal stack Escape fix and compact secondary dialogs (client) | PR #524 (`171d84e`) |
| Purchase Allocations reporting V1 (server, already live; registered, not re-applied) | PR #527 (`80821cd`), migration `20261124134249` |
| Purchase Allocations lens (client) | PR #525 (`240e8fa`) |
| This release PR: version 6.5.0, `public/sw.js` network-first rules for `pec-modal-stack.js` and `pec-purchase-allocations.js` plus cache v395, release notes, tests, pin | consolidated release PR |

No database change ships in the installer; the reporting objects were deployed to production project
`qhmoqtxpeasamtlxaoak` before the client was merged.

## Service-worker treatment

`public/sw.js` is protected on client PRs. This release PR is the single reviewed change: the guard pin
`REVIEWED_PEC_V650_PINS` binds the exact path, head branch and SHA-256 of the final file. The change is the cache
generation advance plus two network-first rules. Copies of the two modules cached while they were cache-first
(imported with a `?v=` suffix) are retired by the new cache generation. `pec-pwa-cache-freshness.test.mjs` covers
both modules (online fresh, offline reuse, `/public` prefix, `?v=` imports, stale baseline without the rules).

## Evidence summary (what was and was not verified)

Automated, offline: unit tests (23), real-browser Purchase Allocations lens smoke (88+ checks) against a page-side
mock of the frozen V1 contract, modal-stack acceptance (every dialog pair, held keys, protected/busy dialogs,
drawers/menus, hidden-focus restore), isolated PostgreSQL fixture over the real repository SQL (110 checks in CI on
`postgres:17`), adapter contract parity against the real RPC output, PWA freshness tests, protected-path guard
(157 cases), full PEC suite identical to unmodified main. Fixture-scale repeated timing on PostgreSQL 17 (3,000 facts,
1,500 lines, 15 runs): summary median 792 ms / p95 799 ms; 200-row trail median 37 ms / p95 41 ms. Production
single observations by the server owner: 200-row 23 Nov trail ~1.3 s, 1-23 Nov summary ~0.88 s. These are not a
production p95 or load test.

Server owner's production verification (2026-11-24): five RPCs execute under view-only PEC permission, deny a
no-permission identity, anonymous execution revoked, helper not executable by API roles, all modes reconcile with
zero quantity discrepancies. Timestamped live observations for 23 Nov (mutable, not invariants): 39 purchase facts,
10 affected indents, 40 lines, 55 trail rows; Kg 9369.455 purchased / 9086.463741 allocated / 282.991259
unallocated; L 35; Nos 41066 / 30000 / 11066; indent #247 serial 1 (110 Kg) and serial 2 (62 Kg) with zero
reconstructed opening and closing; fact 169565 -> 84/107 = 5, 156/170 = 50, 191/198 = 80 Kg.

NOT performed by the assistant and therefore not claimed: authenticated browser acceptance on the deployed PWA,
real Windows installation / auto-update acceptance. Owner checklist: sign in with PEC view permission on the
deployed build; open Purchase Allocations for 2026-11-23; confirm the figures and the fact 169565 / indent #247
allocations above; use all three modes, a drill-down, "Open indent" and return, CSV export and the print statement;
press Escape in nested dialogs (Select Vendor from an indent line). On a Windows machine: install v6.5.0 from the
GitHub release and confirm the app reports 6.5.0 and an installed v6.4.2 offers the update.

## Publication procedure (established workflows)

1. Merge this PR to main (squash). 2. `electron-release-candidate.yml` runs on that exact main commit (push);
record the run id and the installer SHA-256 from its log. 3. `publish-sasv-release.yml` (manual dispatch, branch
`main`) with `version=6.5.0`, `build_run_id`, `installer_sha256`: it drafts, verifies identity, hashes and
`latest.yml`, then promotes to the stable Latest release. 4. Verify tag, assets (installer, ZIP, blockmap,
`latest.yml`, `SHA256SUMS.txt`), release status and the PWA host serving cache `hub-cache-v395`
(`node scripts/pec-release-provenance-check.mjs --url=https://sasv-utilities-hub.netlify.app`).

Rollback: the previous release v6.4.2 remains available; the client changes are read-only for allocations and do not
alter business data, so reverting the release PR and republishing is sufficient.
