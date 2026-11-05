# Costing Suite WP12 — Disconnected Loopback Preview Security Proof

**Date:** 5 November 2026 · **Result:** local-only transport controls **7/7 PASS**, existing six-module inert-browser regression **29/29 PASS**, **zero skips**.  
**Gate:** disconnected static preview transport and mock-browser regression **verified**. Real authenticated populated-data acceptance, preview deployment and formal work-pack closure **OPEN** (5/13, 38%).

## Exact source and CI evidence

- Dedicated preview branch: `preview/costing-wp05-wp06-wp12-20261105`.
- Verified workflow commit: `278484e9eabd50c4a5093ef91911df31fbc0d26f`.
- GitHub Actions run: [#42042694501](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42042694501), completed **SUCCESS**. Job ID `127297783872`.
- Local server security suite: `node --test scripts/costing-preview/read-only-loopback-server.test.mjs`, **7 tests / 7 pass / 0 fail / 0 skipped**.
- Chromium mock suites: `node --test scripts/costing-wp12-flag-sweep/flag-sweep-browser.test.mjs scripts/costing-wp12-flag-sweep/console-rpc-allowlist.test.mjs`, **29 tests / 29 pass / 0 fail / 0 skipped**. The workflow explicitly fails if this suite reports any skips.
- Exact-source verifier, Node 22 dependency install, temporary pinned Playwright 1.62.1 and Chromium setup completed successfully. No production credentials supplied.
- New code exists **on preview branch only**: `scripts/costing-preview/read-only-loopback-server.mjs`, `scripts/costing-preview/read-only-loopback-server.test.mjs` and updated branch-only workflow `.github/workflows/costing-preview-mock.yml`. None of these are merged into `main`.

## Local-only transport design, not an authenticated production backend

The server binds to `127.0.0.1` with a random port, serves allowlisted file types from the repository `public/` folder, verifies canonical realpaths to block symlink escape and does not implement a Supabase proxy. Tests show:
1. A status endpoint `/__preview/status` explicitly reports `backend: DISCONNECTED`, `realAuthentication: false`, `signedInAcceptance: NOT_TESTED`.
2. All six module HTML files are available as local static files.
3. POST, PUT, PATCH and DELETE return HTTP **405** on ordinary pages and backend-looking paths.
4. GET to backend/auth/RPC/function/storage/realtime/API paths returns HTTP **403**.
5. Absolute-form proxy requests and non-loopback Host headers are rejected.
6. Traversal attempts, NUL encodings and unsupported files cannot return successful content.
7. Static responses are no-store with a Content-Security-Policy including `connect-src 'none'`, which prevents browser network access to real Supabase endpoints.

**Critical qualification:** With this restrictive CSP, this is a **safe static transport**, not a complete working authenticated UI preview. The actual Chromium functional matrix currently uses the separate established in-memory stub harness, not the loopback server. Passing a local transport test does not prove server-side `authenticated` role enforcement against live Supabase or prove an operational human-browsable preview.

## Security decisions and next gate

- Keep all production sites, Supabase project configuration, policies, data, run approvals, feature-flag storage, cache and Electron release untouched.
- Do **not** enter live credentials into the disconnected static server or put secrets into the GitHub branch/workflow.
- A future **populated-data signed-in** preview must either use a separately controlled isolated database or a purpose-built **server-enforced read-only** gateway with positive/negative RPC and table access tests. A client-only hidden action does not protect refresh/approval mutations; accidental run #150 is the retained example.
- For an interactive offline demonstration, a separate mock-browser launcher with all external requests blocked and synthetic auth may be considered; clearly label it `MOCK`, not live acceptance.
- Only after backend isolation and served asset provenance are demonstrated should owner-authorised WP05/WP06/WP12 eleven-flag ON/OFF and ten Pricing Policy workspace acceptance begin.
- Windows Electron installer/updater/rollback (WP12 A14) is an independent final gate.

**Programme formal closure stays 5/13 (38%).** This record adds verified mock and transport evidence only.
