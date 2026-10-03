# WP04-G4-S0 — Cursor on Windows test-runner plan

Status: PLAN PREPARED FOR CHATGPT REVIEW; NOT IMPLEMENTATION OR LIVE EXECUTION APPROVED.
Date: 2026-10-03. Durable gate authority: [WP04](WP-04-READINESS-CONTROL-CENTRE.md). Main at entry: `b162d4932ec2bbe9ca665aadedf1827e5117de5a`. Source audit tip: `e1d4f6a2651bb292c5579a00ab9eea499be162a8` on `docs/wp04-g0-readiness-control-centre-audit`.

## Purpose and ownership

Prepare a small test tool which Cursor can build and help operate on the user's Windows computer. Prove native test-user authentication, exact baseline/candidate read assertions and module permissions on a separately authorized isolated Supabase target. It is not a client screen or readiness implementation. No production call is permitted. The user confirmed Cursor on Windows, not Python availability or a secure secret channel.

ChatGPT owns target provisioning, server/schema/permission/fixture/candidate plans and direct Supabase application, independent review and live verification under DEC-014. Cursor's package is offline test-tool development; later synthetic Auth/API execution needs separate explicit target-bound approval. Cursor must not apply SQL or invent server rules/permissions. Ordinary client implementation remains later.

## Current evidence and limits

The accepted Python standard-library harness is committed on the audit branch, not main. A feature branch based only on main would omit it. No supported target or live launcher exists. Native operations remain NOT_RUN. Reviewed component hashes:

| File under supabase/tests/wp04 | SHA-256 |
| --- | --- |
| auth_api_harness.py | 3fad74acdbf82ea14c6aa05027c9e43f566e46588ceca905daa904857f7a5eed |
| test_auth_api_harness.py | 8957cb5ef8cc4e30422b7a4a0a9f1b3fca6a5b34569e3bd2efa26fcb23adbc76 |
| README.md | efbbb3fc1415fb4315d24e6ceedd47ccc685291f864df333f66d3e403b3a9e7e |

32 prior offline checks passed; that acceptance is component-level only. Caller-supplied target fields do not prove independent identity. Target credentials, actor fixtures, exact live assertions and source-scale performance remain unestablished. Do not fill those gaps with arbitrary sample values or simulated claims.

## Proposed exact offline implementation scope after review

- Add `supabase/tests/wp04/test_runner.py`: reviewed harness wrapper, default OFF, local-only fake-input preflight, strict spec validation, staged in-memory orchestration and sanitized output.
- Add `supabase/tests/wp04/test_test_runner.py`: meaningful offline boundary tests using injected fake transport/prompt/fixture acknowledgement; no endpoint calls.
- Add `supabase/tests/wp04/test_runner_spec.example.json`: explicitly non-executable example with execution OFF and unresolved target/cases. It cannot become a live spec by changing one flag.
- Update `supabase/tests/wp04/README.md`: precise Windows launch/preflight instructions, staged credential/fixture handoff and limitations. Mark historical component acceptance separately from wrapper/native verification.
- No accepted harness/test source changes without a demonstrated wrapper incompatibility and a consolidated reviewed correction. No application client, SQL, migrations, package dependency, shell secret loader, CI workflow, controller endpoint/table, global ignore/security setting or installer change.

Future branch proposal: `test/wp04-s0-cursor-runner`, created from the exact independently reviewed audit tip containing this plan/harness. Fetch main and audit branch first, inspect movement under governance; do not work on main, cherry-pick an assumed subset, silently rebase or merge main. No branch creation/implementation authorized by this document's present status. Repository evidence is traceability, not a server delivery prerequisite.

## Runtime and private-input plan

1. Cursor may inspect only nonsecret interpreter/platform facts on the user's selected Windows environment: Python executable/version via known launcher, standard-library imports and terminal mode. Prefer existing Python 3.12 or a compatible version demonstrated by offline tests. Missing interpreter is a runtime prerequisite; no automatic install. Do not enumerate environment variables, credential stores, Supabase config, browser sessions or saved secrets.
2. Offline preflight uses conspicuously fake values, an injected transport that records zero requests, and a separately opened local interactive terminal to verify hidden input. Cursor can prepare a launcher/command; it must not collect real keys in agent chat/tool arguments. No claim that Cursor's captured command terminal is a private credential channel. No endpoint/DNS probe or native actor creation in preflight.
3. Proposed live input is `getpass` in a separate trusted local terminal. Refuse noninteractive input and treat `GetPassWarning` as failure before entering/accepting secrets: Python can fall back to echoed stdin otherwise. Never request secrets through redirected stdin, CLI args, files, environment scans, clipboard automation, agent terminal transcript or chat. Default hidden input; no echo_char dependency. Verify the actual Windows terminal's behavior with fake input first.
4. After target/cost/setup and exact wrapper authorization, the user may still need to enter the two target-only modern keys once through the hidden prompt. Cursor can perform coding and orchestrate nonsecret stages, but cannot supply secrets that have no supported private channel. This limited human step must be explained honestly; it is not a coding task or a manual test suite. It is not already accepted by selecting Cursor.
5. Keep keys, generated passwords and access tokens in process memory only. No debug/HTTP body output, credential file, telemetry, crash dump deliberately written, background process, environment inheritance carrying keys, or automatic process restart. Trusted local host/code is an assumption; hidden input is not protection against hostile code or OS access. Forgetting references is not zeroization or remote revocation.

A usable route is established only after actual offline runtime/hidden-input behavior is evidenced and the user agrees to that limited private entry step, or a different supported mechanism is separately reviewed. Do not create a paid target merely because Cursor is installed.

## Exact nonsecret live spec and approval binding

Later ChatGPT supplies a reviewed target-bound spec, never the executor. Require exact project ref/standard API host; independently verified provider/database refs; production exclusion; marker/fixture revision; canonical source and wrapper/harness hashes; expiry with timezone; approved actions; immutable read allowlist; actor matrix; exact RPC parameters and assertion definitions; phase limits and approved handoff directory. Reject unknown fields, duplicate cases/actors, unsupported actions/functions, unresolved example placeholders, null expiry, identity mismatch, altered hashes or expired approval before credentials or requests.

Canonical baseline reads are only the accepted readiness/latest-governed-period/valuation-context functions. Candidate/helper names enter the allowlist only through a separately reviewed spec after server setup. Exact HTTP/error/body expectations come from the actual reviewed fixture/contract, not generic 200/403 guesses. Missing expectations cannot yield a proof pass. No readiness computation, commercial-row selection, Product READY rollup or permission inferred from actor label.

Freeze spec identity and content; revalidate before every stage and after any fixture pause. Changes require stop/new instance/new approval. No generic user-controlled URL, arbitrary RPC/function, arbitrary SQL, dynamic script execution or live flag in the accepted harness itself. Default runner invocation must emit OFF/NOT_RUN and make zero requests. A later live entry requires explicit phase-bound reviewed authorization; syntax is to be fixed in offline implementation review, not supplied as a runnable instruction here.

## Native sequence and private fixture handoff

1. Independent target/provider/API/database/config/hook/default checks and exact baseline/permission scripts belong to ChatGPT. Native API reachability is proof, not a local preflight. Refuse production `qhmoqtxpeasamtlxaoak` and unknown/alternate hosts.
2. Only when separately authorized, create the four fresh synthetic actors through the existing harness: ccc_view, ccc_edit, product_view, no_module. No real recipient, invitation, recovery or fabricated token. Preserve returned IDs/passwords privately in the same running process. Any uncertain create response is a stop; never blindly retry or create a replacement.
3. Proposed noncredential handoff: one explicit local artifact outside the repository, containing only approved target ref/spec hash/fixture revision and four label-to-synthetic-UUID mappings. No email, password, token, API key, response body or production identity. Path is explicit, never a broad disk search. Native creation must be separately authorized to permit this narrowly scoped UUID export; current harness returns no IDs and current approval permits none.
4. The user relays only that small reviewed nonsecret mapping to ChatGPT (or an explicitly authorized connector does so). No automatic messaging mechanism is assumed. Cursor is forbidden to load permissions. ChatGPT reconciles mapping/target and applies the separately reviewed exact permission fixture via Supabase, then supplies a nonsecret fixture-verified acknowledgement bound to the same target/spec/UUID set. This acknowledgement is workflow evidence, not cryptographic proof generated by a user checkbox. Verify actual API cases afterwards.
5. Runner pauses in memory for that acknowledgement with a bounded deadline; no password/session serialization to resume later. Recheck target/spec/approval/hash on continuation. Crash/expiry or incomplete acknowledgement stops; reconcile existing remote actors separately. No silently restarted/new actor batch. Explain that small handoff/pause honestly; fully unattended execution is not established.
6. After fixture verification, native password sign-in and native user identity confirmation precede per-actor reads. Read exact approved baseline/candidate cases, including anonymous, invalid session, no module, Product-only and CCC view/edit. Preserve stale-session clearing and target/key binding guards. Reject absent session/expectation before requests where applicable.
7. Safe final report includes phase/case IDs, reviewed nonsecret target/spec revision, operation counts, controlled HTTP status/error assertion verdicts, MATCH/MISMATCH/UNVERIFIED/NOT_RUN and fixed failure codes. No body notes, URLs containing secrets, passwords, tokens or arbitrary exception text. MATCH proves its exact assertions only, not complete payload equivalence, pricing safety, CSE authority or production-scale performance.
8. Auth creation is a real test-target mutation and can persist despite a local failure. No automatic delete/revoke/sign-out, production transaction rollback claim or test-target pause/delete. Review cleanup/reconciliation and native token-expiry/revocation separately. Retain only explicitly approved safe actor IDs for that purpose.

## Required offline verification

Rerun accepted 32 tests once after any wrapper integration change, then verify wrapper boundaries: default/fake preflight zero calls; strict spec/production/expiry/hash/allowlist refusals; noninteractive/echo warning fails closed; secrets/canary bodies absent from reports/exceptions/files; fixture UUID export allowlist; pause/expiry/spec drift refusal; no create retry after uncertainty; no missing-session/expectation call; precise match/mismatch; cleanup absent. Windows fake-input terminal evidence is separate from injected prompt tests. No tests that assert only the wording of docs.

Do not claim hardware/network/private input proved by a mock. No network load test in this offline package. Full parity/performance/CSE/payload/permission proof remains the later ChatGPT-owned S0 package.

## Cursor PLAN brief, not implementation authorization

After ChatGPT review authorizes forwarding this brief, use Cursor PLAN mode. Fetch current main/audit tip first, report movement/overlap, read IMPLEMENTATION_RULES/MASTER_PROGRAMME/WP04/this plan and accepted harness. Produce one complete plan covering the exact file scope, actual nonsecret Windows/Python/terminal facts, spec validation, private input, staged memory/UUID/fixture handoff, output boundaries, offline tests and failure recovery. Do not implement, install, retrieve credentials, invoke Supabase/Auth, create resources, apply SQL, launch a cloud task, edit application clients, merge/tag/release or publish. Report source SHAs, runtime facts versus assumptions, exact changes/tests proposed, remaining human steps, risks and requested bounded offline implementation scope. Return the plan to ChatGPT for independent review; do not treat this draft as permission to implement or run live tests.

## Sources and classification

Official sources consulted 2026-10-03: [Cursor Agent](https://cursor.com/docs/agent/overview), [Terminal](https://cursor.com/docs/agent/tools/terminal), [Agent Security](https://cursor.com/docs/agent/security), [Python getpass](https://docs.python.org/3/library/getpass.html). Cursor documents code/terminal tools; it does not establish this user's Python/network/private input state. getpass documents the echo fallback warning; no API package or provider integration is being implemented here. Earlier approved Supabase capability evidence remains dated evidence, not a new runtime proof.

REQUIRED NOW: independent review of this bounded plan and exact Cursor PLAN handoff. FUTURE DEPENDENCY: actual local facts/private-input acceptance, wrapper review/implementation, organization/actual cost/setup consent, live fixture/native/parity/performance proof. HIGH-RISK: every target/Auth/SQL/permission/controller/candidate/production mutation remains withheld. PARKED unchanged. No decision lock or WP03 reopening. Next gate: `WP04-G4-S0 — Executor-assisted test-runner plan review`.
