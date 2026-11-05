> **Test identity enabled — 5 Nov 2026 (latest):** The owner-approved existing SASV test login now has **all six Costing Suite permissions `can_view=true`, `can_edit=false`**, verified in canonical and effective views. Six rows added transactionally; account permission totals **73→79**, existing edit grants **52→52**. The account **is not globally read-only**, because 52 unrelated edit grants remain; no broader rights were changed. See [VIEW_ONLY_TEST_IDENTITY_GRANTS_2026-11-05.md](VIEW_ONLY_TEST_IDENTITY_GRANTS_2026-11-05.md). Genuine signed-in browser/navigation, server deny-path and all-eleven-flags acceptance remain **NOT TESTED**, pending a controlled login on a verified integrated client. Formal programme **5/13 (38%)**; no flag activation, deploy, approval run, cache or Electron release.

# Costing Suite — Authenticated role acceptance readiness (5 November 2026)

> **Gate status: BLOCKED on a genuine six-module view-only account and verified signed-in client. This is a SELECT-only live investigation, not signed-in acceptance.** No users, grants, permission flags, database rows, migrations, costing runs, app deployments or feature flags were changed. Formal programme closure remains **5/13 (38%)**.

## 1. Authority and baseline

- **One programme:** [COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md) and [MASTER_PROGRAMME.md](MASTER_PROGRAMME.md) remain the coordinating workflow. [PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md](PROGRAMME_PROGRESS_AND_CLOSURE_PATH_2026-11-04.md) is the formal closure ledger; [OWNER_ACCEPTANCE_RECORD_2026-11-04.md](OWNER_ACCEPTANCE_RECORD_2026-11-04.md) is the matrix.
- **Merged client:** PR #174 squash-merged to `main` at `2e8a74b17dd35795ea76ce6e89d35047b1c39e16`. Claude reported final *code-head* LF and CRLF each **969 pass, 0 fail, 18 inherited Electron skips, 987 total**; Chromium executed; independent code review passed. This is mock-backed client proof, **not an authenticated live role test**.
- **Applied server gates:** SEC-A1 migration `20261104155525` protects both acceptance overloads and close; SEC-A2 migration `20261104160256` protects preview-ack creation. Read-only live `pg_proc` source checks 5 Nov still match expected SEC-A1 internal MD5s `326211fd5e811bdab52aa6ce421d56b7`, `50712d2cbbf09b1be0764966d604f092`, `32077cdd5599de73d7d8867211820f24` and SEC-A2 preview MD5 `9911a0c6f2b9c40f762059757e44560e`.
- The database connector's current session is `postgres` with `auth.uid() is null`; this is **not** a substitute for a signed-in application role.

## 2. Current canonical account availability (SELECT-only, aggregate)

Permission inventory across exactly these six canonical targets:
`module:costing-control-center`, `module:material-cost-manager`, `module:cost-build-manager`, `module:pricing-policy-manager`, `module:cost-sheet-review`, `module:production-route-manager`.

| Account-level coverage (among those six targets) | Count |
|---|---:|
| All six can_view=true, none can_edit=true | **0** |
| All six can_view=true, one or more can_edit=true | 1 |
| One–five can_view=true, no can_edit=true on those targets | 0 |
| One–five can_view=true, one or more can_edit=true | 1 |

These are aggregate counts, not user identifiers. The result does **not** examine every other permission key that a user might have. Therefore even a future apparent view-only candidate needs a check of **all grants and inherited roles** before acceptance.

**Decision:** do not test view-only behavior with the all-six editor account. Do not generate fake JWTs, replace `auth.uid()`, impersonate another person via SQL, or invoke write-capable production RPCs simply to prove denial. No paid Supabase development branch is contemplated.

## 3. Required identity preparation (not performed)

Provision an **actual ordinary SASV application sign-in** through the existing governed user administration. Permission assignment must cover all six canonical targets: `can_view=true`, `can_edit=false`. Audit every other module permission, any superuser/service-role/owner entitlement and inherited grants; record the account identifier only in private acceptance evidence, **not in GitHub docs**. Use a different existing authorised CCC editor only for non-mutating editor UI evidence; do not approve or finalise actual runs. Credential creation and sign-in require user-controlled authorisation and access; do not solicit passwords in repository documents.

Before starting, capture a read-only canonical permission snapshot for each role with boolean types, then re-read after login. Any mismatch -> **STOP**.

## 4. Execution matrix and strict side-effect boundaries

1. **Proven code/source:** use an isolated frontend origin or owner-authorised test build that demonstrably serves merged `main` at or after `2e8a74b`. Capture page/JS/CSS asset digests and bundle provenance. Local origin still talks to live Supabase; it is **not** a staging database. The legacy Electron installer or PWA service worker must not be assumed to include merged changes.
2. **Flag OFF smoke:** for the six modules, check navigation, permissions, dashboard period and historical context, direct links, responsive 390/1280 widths. Observe console, network and health-check cost. Record all displayed errors. No write-capable RPCs, DML or background service worker activation.
3. **Scoped flag ON:** only in the explicitly authorised isolated browser profile, enable one flag at a time; test module behaviour and inspect network RPC allowlist. Restore every flag OFF. Eleven flags and 6 modules are tracked by [owner acceptance matrix](OWNER_ACCEPTANCE_RECORD_2026-11-04.md). Do not open approval preview: it writes an acknowledgement, even though now edit-restricted. Do not Approve, Finalise, Lock, Refresh/Recalculate, Validate, Save, Accept or Close.
4. **View-only role:** CCC draft-run list should show `View only — approval requires Costing Control Center edit permission.`, no `Review for approval` action and **zero preview-ack RPCs**. Similar no-write affordances across other five modules. Screens opening does not prove module feature correctness.
5. **Editor role:** on same verified code, confirm intended `Review for approval` affordance is *visible*. **Do not click it** in production without a separately approved synthetic-data plan; a click creates an acknowledgement record. No real approval/finalisation or permissions mutation.
6. **Denial proof:** actual server response from a safely provisioned view-only role is still necessary for full authenticated authorisation acceptance. Do not invoke production acceptance/close/preview writers merely for denial testing until a strictly controlled, owner-authorised negative test plan exists; keep these rows NOT TESTED meanwhile. Static server-source verification and browser mock permission wiring are distinct.
7. **After session:** restore all eleven flags OFF; record source SHA, roles (in private evidence), timestamp, browser/OS, network RPC calls, screenshots and cleanup. Distinguish verified PASS from BLOCKED/NOT TESTED.

## 5. Current explicit results

| Gate | Result |
|---|---|
| SEC-A1/SEC-A2 installed and expected SQL source hashes | **PASS — catalogue read** |
| PR #174 merged and source exists in `main` | **PASS — GitHub** |
| LF/CRLF mock-backend regression | **969/987 pass each; 18 baseline Electron skips** (reported final code-head) |
| Six-module view-only account | **BLOCKED — count 0** |
| Authenticated view-only RPC denials | **NOT TESTED** |
| Authenticated editor preview, approval and finalisation | **NOT TESTED**, avoid production writes |
| Six modules × eleven flags signed-in acceptance | **NOT TESTED** |
| Electron-capable Windows installer acceptance | **NOT TESTED** |
| Formal WP05/WP06/MDC-07/WP12 closures | **OPEN** |

## 6. Immediate next authority gate

An administrator must arrange a tightly restricted **real sign-in with all six Costing view permissions and no edit entitlements** through existing governed identity administration. Do not create one using production service credentials merely to evade this prerequisite. Once it exists, re-read permission state, verify isolated frontend source identity and then run only safe read-only UI checks. Any genuine production RPC denial test still requires a separately reviewed side-effect-free procedure.

No new work pack, workflow fork, client release, Supabase branch or formal closure is implied. Keep e-Aushadhi WP07 paused and Manage Activities test flake separate.
