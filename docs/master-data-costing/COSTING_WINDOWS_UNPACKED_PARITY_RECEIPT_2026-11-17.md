# Costing Suite — non-publishing Windows unpacked Electron proof (17 November 2026)

**Verification classification:** CI **PASS**, unpacked Windows binary + `app.asar` source parity only; **NOT a published release, installer, installed-app smoke, or genuine user acceptance**.

## Exact evidence

- Workflow: [Costing Windows Unpacked Pre-Release Rehearsal, run 44033509328](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44033509328), Windows runner job **133870778151** — **SUCCESS**.
- Source checkout: synthetic PR merge SHA `0ed0eccc8e77de96f90645da76a2721dfc073e7d` from **draft PR #465**, not a published or tagged release commit.
- Package manifest app version: **6.1.0**. The package's rewritten `package.json` was compared semantically for the source application name/version; Electron Builder intentionally rewrites packaged dependency metadata.
- Build command: `npx electron-builder --win --dir --publish never`, on `windows-2022`, with lockfile dependencies `npm ci`.
- Receipt: `WINDOWS_UNPACKED_ASAR_PASS 30/30 exact source bytes; version=6.1.0`.
- GitHub artifact **14306750372**, named `costing-windows-unpacked-source-parity`: verification JSON, source checkout, app version and no-publish boundaries only, **no executable / installer / credentials**.
- Source verifier: `scripts/costing-release/windows-unpacked-asar-receipt.mjs`; Windows workflow `.github/workflows/costing-windows-unpacked-rehearsal.yml`.

## Files tested and supported inference

The checker extracted and SHA-256 compared **30 source paths** in packaged `app.asar`: ten classification management HTML/JS/access/escape files (four root pages, four JS clients, two shared helpers), six Costing module HTML pages, four shared master module HTML pages, the service worker source, eight shared JS module/guard files and `main.js`. It separately checked the mandatory `newGroupKind` chooser in the packaged Product Group management HTML, package identity/version, Windows unpacked executable and ASAR presence, and intended exclusion of docs/scripts. The exact file list and hashes are in the receipt JSON; these are source-inclusion checks, **not authenticated functionality**.

The **first** Windows rehearsal run [44033289368](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/44033289368) successfully built the unpacked binary but the initial *verifier* failed because nested ASAR paths were supplied with POSIX separators on Windows and `package.json` was incorrectly treated as immutable source bytes. The corrected verifier uses native filesystem separators and semantic packaged-manifest validation; run 44033509328 green. The first failure is retained as historical evidence, not rewritten.

## Non-substitutable gates remaining

1. **Live authenticated browser:** existing Editor, View-only and No-access accounts in six modules; seven sensitive-view forbidden GETs and protected personnel fields; Cost Comparison default-OFF normal request behavior; populated production PM BOM 390px and Deactivate button.
2. **Installed PWA:** active service worker and cache version, local/browser flags OFF/ON/OFF under approved scoped protocol, no stale dependencies.
3. **Installed Windows application:** actual local server/renderer launch and role-gated module behavior, update/rollback, genuine installation/uninstall and NSIS/ZIP receipts. `--dir` proves none of these.
4. **Formal owner release authority:** choose exact main-derived release SHA/version and approve final package creation/publication only after accepted residuals and rollback gate.

**Scope policy:** optional WP10 05/CL15/RM1 Route Manager hardening remains **draft/unapplied** in PR #463; no production SQL, grants, feature flags, module data or costing run approval was changed.

**Programme:** 10/13 formally closed; WP10–WP12 remain OPEN. No release, installer or updater was published.
