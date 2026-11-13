# PEC Phase A — Authenticated acceptance operator packet

**13 November 2026 | For owner-authorized real-session test execution only | NOT YET EXECUTED**

## Scope

This package converts the independently verified staging/static/database evidence into a bounded genuine-identity acceptance. It **does not** grant permission to create test records, change approved indents, call writer RPCs, impersonate roles, alter ACLs or capture credentials. All tests below remain **NOT TESTED** until the actual authorized operators run and record them.

### Verified prerequisites

- PEC staging PR #347; source at time of packet preparation `bc63b6398f3e8201923b1e43579e265285d2c3aa`, with 8/8 GitHub CI SUCCESS, Netlify preview SUCCESS. Resolve current staging head at test time and confirm served asset provenance; do not assume this pinned head remains latest.
- Owner has accepted R2c mobile visual UI. Production Add Line wrapper MD5 `a19fabfd29ffba4d937df1bbf09453c2`; source-body parity 21/21 normalized matches.
- Supabase eleven PEC migration versions **0/11 registered**. This does not authorize history repair.
- Genuine-session non-mutating script: `scripts/pec-phase-a-operator-browser-check.mjs`. Its current coverage is **UI / read-only RPC response metadata only**, and it **does not** prove direct API denied-role or writer security. It uses an interactive fresh browser with manual sign-in, does not capture passwords/JWT, denies downloads, and does not invoke mutations.

## Safe operator sequence

1. Confirm actual host is the authorized HTTPS deploy-preview `https://deploy-preview-347--sasv-utilities-hub.netlify.app` and served JS/CSS commit/network cache match the expected staging source. If freshness uncertain, BLOCKED.
2. An authorized operator signs in **personally** with one existing identity at a time: (A) PEC View+Edit, (B) PEC View-only, (C) no PEC View/Edit. Do not create/alter roles for testing without distinct owner approval.
3. Run the existing genuine-session harness in an isolated local terminal with the correct `--role` category; never paste or print credentials. It produces UI checks and counts of RPC names/HTTP statuses, without response bodies. Retain only a redacted summary. If an interactive local terminal/browser is unavailable, record BLOCKED rather than synthetic PASS.
4. **View+Edit:** five lenses load, navigation works, read-only filter/export verification where authorized. The harness does not click Save/Add/Submit and does not assert successful privileged writes. Record Writer functional gate as NOT TESTED.
5. **View-only:** five lenses load; edit affordances must be inaccessible. Confirm actual read RPCs are successful where expected and not merely mock rows. Mark direct attempted writer denial NOT TESTED unless a separately approved, non-mutating, authenticated negative RPC challenge has been executed.
6. **No access:** PEC main panel must be denied. **Independently validate server API denial** for at least one relevant read RPC using the genuine no-access session and a deliberately non-disclosing request, through a security-reviewed procedure. Do **not** infer server denial from the hidden UI alone. Current harness does not perform this direct request, so label NOT TESTED until authorized evidence is captured.
7. **Anonymous:** pg_proc read-only privilege inspection shows no EXECUTE on PEC read RPCs/Add Line wrapper. End-to-end anonymous RPC HTTP denial remains NOT TESTED.
8. Record tablet/phone native behaviour and installed PWA offline→online freshness separately. This Chromium operator harness does not substitute for an actual iPhone/Safari session or packaged Windows Electron.

### Outcome ledger

| Test | Editor | View-only | No-access | Evidence requirement |
|---|---|---|---|---|
| Sign-in & served build freshness | NOT TESTED | NOT TESTED | NOT TESTED | trusted origin, build/hash, cache freshness |
| Five-lens navigation | NOT TESTED | NOT TESTED | expected denied | real UI no synthetic rows |
| Read RPC success within role | NOT TESTED | NOT TESTED | expected deny | server HTTP status and RPC name |
| Writer controls inaccessible when not Editor | n/a | NOT TESTED | NOT TESTED | disabled/hidden UI plus server negative proof |
| Direct writer denied by server | n/a | NOT TESTED | NOT TESTED | SQLSTATE/HTTP response without writes |
| Add Line positive draft manual | NOT TESTED | n/a | n/a | separately approved disposable fixture/real business draft |
| Approved new line denied | NOT TESTED | n/a | n/a | genuine Edit JWT and verified no-row side effects |
| Installed PWA cache recovery | NOT TESTED | NOT TESTED | NOT TESTED | trusted device, SW/cache provenance |
| Packaged Windows Electron | NOT TESTED | NOT TESTED | NOT TESTED | release artifact build and source parity |

## Safety and evidence constraints

- A test user's declared role is not proof of their actual backend grants. Check server response behavior with a genuine session. Never use a service-role key to simulate a denied role.
- Never send or log bearer tokens, cookies, emails, business row contents or raw API responses in the handover. Record RPC name, sanitized status/category, timestamp, test identity category and source SHA only.
- Do not run a real production approved-line modification to demonstrate existing correction eligibility. As of the preceding live inventory 45/45 indent headers were approved; no draft manual exists for safe positive fixture use.
- Mark PASS only on actual observed behavior; FAIL on demonstrated contract deviation; BLOCKED on missing access/device or necessary permission to run a test; NOT TESTED for any deliberately deferred check.
- Formal G0–G5 remain **0/6 closed**. The accepted visual R2c UX and 21/21 source-body parity are separate evidence, not substitutes for this packet.

## Explicit handoff

A person with legitimate existing Editor, View-only and denied-role identities must conduct this acceptance using the existing interactive harness and an independently reviewed direct RPC negative-test method. This assistant cannot claim that execution occurred without those authenticated observations. Keep production write probes and migration-history repair out of scope until independently authorized.

## Direct server negative-RPC harness extension — proposed, not yet accepted

An isolated draft change on `test/pec-real-role-rpc-negative-20261113` extends `scripts/pec-phase-a-operator-browser-check.mjs` to use the **actual browser-held signed-in Supabase client**, never exporting JWT or business rows to Node. Under `--role=no-access`, it directly calls `proc_pec_pr_headers_paged(p_limit=1,p_offset=0)` and expects a permission-specific denial. Under `--role=view-only`, it invokes `proc_indent_add_line` with the deliberately nonexistent `p_indent_id=0` and all other identity/quantity parameters zero, expecting the PEC Edit permission denial *before* indent lookup. A missing-indent error or any other arbitrary error is **FAIL**, not a permission PASS. No genuine procurement record can be targeted by the sentinel key; the probe must still run only with an operator's real authorized View-only account.

The harness requires a verified authenticated session and returns only RPC name, HTTP status, SQLSTATE and a boolean permission-denied result. It does not print token/header/body/user identifiers. An absent session is **BLOCKED**. Editor mode continues to avoid write tests. Regression smoke `scripts/pec-real-role-negative-rpc-smoke.mjs` and CI syntax/safety checks are proposed in the same draft PR.

**Status: proposed harness — no real Editor, View-only or denied-role execution has occurred by adding this code.** No release gate may be marked PASS until an operator's actual session outcomes and exact build provenance have been inspected. Preserve the current owner-approved R2c UI and do not alter production user permissions, database records, migration history, PWA service worker or production deployment.
