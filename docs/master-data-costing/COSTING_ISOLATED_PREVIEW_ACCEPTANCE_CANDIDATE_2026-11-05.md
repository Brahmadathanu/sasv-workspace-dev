# Costing Suite — Isolated Preview Candidate & Signed-in Acceptance Gate
**Prepared:** 5 November 2026  
**Status:** Source-provenance preflight prepared; **no actual preview built/deployed or authenticated acceptance executed**. Existing formal closure **5/13 (38%)**.

This checkpoint advances the [unified Costing Suite workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md) and [owner acceptance record](OWNER_ACCEPTANCE_RECORD_2026-11-04.md), not a separate workstream. No production PWA, Electron version, SW cache, server permission or feature flag is changed.

## Verified from live repository

- Initial integrated baseline `main` SHA **d2af1f3f636f34623a73762b730e4ebb0d3326af** includes #191.
- `package.json` still declares Electron **6.1.0**; `public/sw.js` still declares **hub-cache-v390**. These are **repository values**, not evidence that a production PWA has those exact served assets.
- Eleven default-OFF Costing flags are declared in three client sources; independently checked 11/11 exported names, single declarations and exact `getItem(flag) === "1"` activation. Client flag tests were **static checks**, not signed-in functional checks.
- Existing `scripts/costing-wp12-flag-sweep/flag-sweep-browser.test.mjs` provides a mock six-page × 13-state sweep. `console-rpc-allowlist.test.mjs` supplies mock load-time RPC/console checks. Their historical suite evidence is retained; they were **not rerun by this checkpoint**.
- No Netlify preview/deployment trigger is exposed via the connected GitHub operations, and the local container cannot resolve github.com. A source branch or a GitHub PR is **not itself a built preview**. Do not invent a preview URL or mark a build deployed.

## Reproducible local isolated candidate

Use a separate Windows/Claude checkout rather than modifying the normal development workspace:

```powershell
git fetch origin main
git worktree add --detach ..\sasv-costing-preview <EXACT_REVIEWED_SHA>
cd ..\sasv-costing-preview
npm ci
node scripts/costing-preview/verify-source-and-flags.mjs <EXACT_REVIEWED_SHA>
node --test scripts/costing-wp12-flag-sweep/flag-sweep-browser.test.mjs scripts/costing-wp12-flag-sweep/console-rpc-allowlist.test.mjs
```

Use **the identical SHA in both places**, first verify it matches GitHub's latest reviewed source and the worktree is clean. Running npm or Chromium is a **client-worker action**, not claimed as completed by this record. If either test cannot run because of Chromium/dependencies, record environment error and test skips, never claim a green suite.

The new `scripts/costing-preview/verify-source-and-flags.mjs` emits a JSON manifest with the exact Git commit, Electron version, repository SW cache, eleven flags and explicit `authenticatedOnOffAcceptance: NOT_TESTED`, `deployedPreviewUrl: null` and `servedAssetDigest: null`. It rejects the wrong SHA or dirty checkout. It performs no network request, flag change or DB operation.

## Isolation and no-write acceptance discipline

1. **Mock stage first:** run existing browser tests with the inert backend. No Supabase credentials, actual logins, data mutations or external deployment required.
2. **Build provenance before real sign-in:** an approved isolated PWA test/preview deployment or distinct test server must expose exact served asset digests, Git SHA, environment URL and cache/bundle identity. **No preview is presently deployed.**
3. **Backend safety is mandatory:** do not give an acceptance browser unrestricted refresh/approve/lock/recalc/accept actions against the production Supabase project. The owner's accidental UI-triggered refresh run **#150** demonstrates the risk even during a purported read-only walkthrough. Prefer an isolated database or a demonstrably server-enforced read-only test identity plus a non-write preview endpoint; a localStorage flag or visually hidden button is **not an authorization boundary**. No fake test accounts or credentials may be committed to Git.
4. **Authenticated stage (only when isolation and owner authority are verified):** owner acceptance matrix §2–§3: 6 modules × ALL OFF / NAV alone / ALL ON, then all eleven flags individually ON→OFF, 10 Pricing Policy workspaces, deep links, period switching, proper view-only controls, no write RPC, console/network errors, and full source/bundle provenance. No save, refresh, approval, lock, supersede or recomputation.
5. **Restoration:** prove flags are OFF in the exact preview browser profile, close the session and retain logs/observations. Production site and existing Electron clients unchanged.

## Acceptance evidence record template

| Gate | Status now | Evidence required to promote |
|---|---|---|
| Source SHA/repository flag inventory | **Static PASS** (eleven flags) | Reviewed commit + clean worktree verifier stdout |
| Mock Chromium 13 × 6 sweep | **NOT RERUN** here | Full LF/CRLF/Chromium logs on pinned head including skips |
| Exact preview asset identity | **NOT BUILT** | Site URL/local preview identifier, served JS/CSS SHA-256, SW cache, Git SHA |
| Backend isolation/no-write control | **NOT PROVEN** | Identity role+explicit server privilege denial for write RPCs, or isolated test DB |
| Authenticated six-module ON/OFF | **NOT TESTED** | Owner/tester signed-in matrix; screenshots/logs; no write calls |
| WP05 / WP06 / WP12 formal closure | **OPEN** | All residual items verified or expressly owner-deferred; final A14 Windows installer/updater verification separately |

## Worker handoff (Claude or authorised Windows checkout)

Using the **reviewed immutable SHA**, establish a local, inert-backend preview first. Run source-preflight and the existing WP12 suites. Capture Node and Chromium versions, exact test commands, totals, failures and skips, SHA, bundle digests and any local-preview URL. Report blockers without publishing. Do not change `public/sw.js` or Netlify production settings; do not merge client changes or publish an Electron release. Before any genuine authenticated preview, propose a no-write backend boundary in a reviewed PR and show how it blocks the toolbar refresh RPC as well as other mutations. Stop at that gate for owner review.

**Formal closure remains 5/13 (38%).**
