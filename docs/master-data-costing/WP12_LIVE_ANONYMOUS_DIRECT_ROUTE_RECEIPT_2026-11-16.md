# WP12 — Live anonymous Costing direct-route denial receipt (16 Nov 2026)

## Verified outcome
**PASS, six of six hosted Costing modules, actual Chromium browser, no authenticated identity.** [GitHub Actions run 43904501309](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43904501309) completed SUCCESS (test 1/1, fail 0, skipped 0). Exact tested source PR [#459](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/459), subsequently squash-merged to `main` as `1010d09735863565caff553959176e652013a9d2`.

An entirely new empty Chromium browser context was used per module, at 390px wide, with service workers blocked, no cookies or localStorage. Each tested URL was an actual public Netlify page (`https://sasv-utilities-hub.netlify.app/shared/<module>.html`) and loaded HTTP 200, then redirected to `/login.html` without operator interaction. All non-GET/HEAD requests were intercepted and aborted before reaching their destination; the test asserted **zero attempted write methods**, zero Supabase protected `rest/v1` or `functions/v1` business-data reads and zero activated COSTING_*_V1 localStorage flags. It did not inspect, log, export or return confidential values.

| Hosted page | No-session login redirect | Protected business reads | Attempted write methods | Local Costing flags |
|---|---|---|---|---|
| Costing Control Center | PASS | 0 | 0 | 0 |
| Cost Build Manager | PASS | 0 | 0 | 0 |
| Cost Sheet Review | PASS | 0 | 0 | 0 |
| Material Cost Manager | PASS | 0 | 0 | 0 |
| Pricing Policy Manager | PASS | 0 | 0 | 0 |
| Production Route Manager | PASS | 0 | 0 | 0 |

## What this proves and does not prove
This is a **genuine logged-out hosted direct-route test**, not merely synthetic server fixtures. It proves the observed six login redirections, lack of initiated protected REST/function reads, absence of write attempts, and default-OFF local flags for fresh browser contexts *at the tested build*. It does **not** prove that a user signed in with View-only or No-access roles is denied all restricted endpoints, that an authenticated Editor sees appropriate controls, that RLS/sensitive seven-view direct GET policies reject specific genuine accounts, that installed PWA/SW behaves identically, or that Electron on Windows has been packaged or deployed.

All pre-existing WP05 R61/R63 owner-accepted positive Cost Comparison responses, independent 74/74 Costing static bundle provenance and mocked eleven-flag 21/21 acceptance remain separately credited, not replaced.

## Remaining conditions
- WP12 B1-T3 actual existing Editor/View-only/No-access authenticated accounts, seven direct-view negative HTTP GETs: **NOT TESTED** unless specifically recorded elsewhere; no role changes or synthetic impersonation permitted.
- WP12 B1-T2 final signed-in eleven-flag cross-module and rollback: **NOT TESTED**; mock 21/21 PASS is not a substitute.
- Live Cost Comparison 4-second p95 and October matched performance: **NOT PROVEN**; functional recovery previously accepted.
- Installed PWA/SW lifecycle and combined Windows Electron package: **NOT TESTED** (Electron packaging intentionally deferred until Costing release).
- Master-data programme WP10, WP11, WP12 remain OPEN; no final owner release sign-off or extra production authority is conferred by this result.

No Supabase SQL writes, account changes, production flags, deployments or privileged browser actions were performed.
