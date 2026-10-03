# WP04 native Auth/API harness preparation

Status: consolidated offline correction complete; corrected-package review pending. 32 offline checks pass; no live evidence. No target or live runner is approved. ChatGPT owns server delivery under DEC-014. Git retains traceability, not a server-apply prerequisite.

Python 3.12 standard library; no installation/dependency needed. Safe entry points from repository root:

```sh
python supabase/tests/wp04/auth_api_harness.py
python -m unittest discover -s supabase/tests/wp04 -p 'test_*.py' -v
```

The first command emits OFF/NOT_RUN with zero requests. There is intentionally no live CLI flag or credential argument. Later execution requires a separately reviewed wrapper calling these components with `execute=True`, a reviewed `Target` and controlled in-memory secret inputs. This package does not read environment variables, search for credentials, load permissions, provision resources or clean up actors.

## Exact future operations

1. Independently verify provider/database/API target identity, allowlisted ref/host, current approval scope/expiry and target Auth hooks/configuration. A caller-supplied Target records these checks; it cannot itself prove them. The harness copies/fixes that target record and binds all key/actor/session state to its fingerprint. Reassignment is refused; target/key/approval/read-allowlist drift refuses requests and clears sessions. Use a new instance with newly verified target-only inputs for another target. Refuse production `qhmoqtxpeasamtlxaoak`, custom/alternate hosts and unknown targets. Standard hosted target only in this version.
2. Supply a target-only modern secret (`sb_secret_...`) for admin creation and modern publishable key for sign-in/user reads. Keys cannot be verified as belonging to a project merely from their prefix: separately verify provenance. No secret appears in CLI arguments, committed files, reports or diagnostics. Never ask the user to paste keys into chat. Supported secure injection/execution capability remains unresolved; do not retrieve credentials now.
3. `create_actor(label)` calls POST `/auth/v1/admin/users`, with a fresh `wp04-<uuid>@example.invalid`, random password and email_confirm. It retains the returned user ID/email/password in memory. Target validation/hook review must precede creation. If that synthetic address is rejected, stop; do not substitute a real recipient or signup/invite/OTP flow.
4. Separately authorized exact canonical-permission fixture SQL must use the fresh IDs and reviewed target/marker. This package deliberately has no permission writer. Later wrapper must privately access the in-memory actor mapping; do not print it. Existing trigger or Auth hook effects need review, not disabling.
5. `sign_in(label)` uses POST `/auth/v1/token?grant_type=password` with publishable apikey; requires returned user ID to match, then GET `/auth/v1/user` with native user Bearer token. Every sign-in attempt first discards its prior local session; any failure leaves it absent. Native sessions come only from the Auth response. No claim simulation or JWT fabrication. Modern API keys go in apikey; no admin key in user Authorization.
6. `read_rpc` POSTs only reviewed qualified read functions, with Content-Profile, exact supplied params and publishable key/user session. Default allowlist contains canonical readiness, latest governed period and valuation context. Anonymous omits Authorization; invalid-session uses an intentionally invalid value. Missing requested actor session stops before the call. Reviewed candidate/helper reads may be supplied later in an exact read-only allowlist, never invented from route codes.
7. Supply a separately reviewed `ReadExpectation(http_status, error_code, body_checks)` for each exact case. Body checks are immutable paths and exact scalar values. The evaluator sees the response only in memory and returns MATCH/MISMATCH; absent expectations return UNVERIFIED. Reports contain status/body shape/controlled verdict only. Evaluator failures are sanitized. No response notes, error messages, credentials or readiness recomputation. HTTP status alone is not module-denial proof; review exact error code and payload checks against the fixture/contract. A MATCH means only the supplied checks matched; it cannot certify permissions or full payload equivalence by itself.

## Proof matrix to complete after isolated setup

| Actor/case | Existing baseline | Candidate/helper | Current result |
| --- | --- | --- | --- |
| CCC view | Canonical/latest/context allowed with exact fixtures | Reviewed CCC read; no mutation authority | NOT_RUN |
| CCC edit | Same read behavior; editor does not create bulk authority | Reviewed CCC read | NOT_RUN |
| Product view only | Canonical/latest allowed; CCC context denied | CCC-only candidate denied | NOT_RUN |
| Authenticated no module | Exact module guard denial | Exact reviewed denial | NOT_RUN |
| Anonymous / invalid session | Exact EXECUTE/Auth/guard failure | Exact reviewed denial | NOT_RUN |
| Direct helper | Preserve actual baseline exposure separately | Reviewed internal-helper restriction | NOT_RUN |

No candidate API is implemented/assumed. Governed period, SKU, refresh context, fixture IDs, exact denial assertions and the SQL marker/fixture scripts are later reviewed inputs. Test actor labels are not permissions; loading canonical permission fixtures is required. No Product-wide READY, activation gate or commercial-row authority change.

## Limits and disposal

Direct HTTPS uses TLS validation, ten-second timeout, no proxy/retry/redirect following and a 1 MiB response cap. Network/provider availability and secret-key compatibility must be proven later; offline mocks cannot establish them. Requests may create users even if parsing/sign-in subsequently fails: never retry blindly. Retain safe operation identifiers privately in the later execution wrapper for separately approved reconciliation.

`forget()` drops local references only, not memory zeroization, remote user deletion or session revocation. Cleanup is not implemented/authorized; review scoped sign-out/revocation and deletion separately. Access tokens can remain valid until expiry after deletion. No blanket cleanup, SQL rollback claim or branch merge/reset.

Sources checked 2026-10-03: official [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Auth users](https://supabase.com/docs/guides/auth/users). REST operation compatibility and no-outbound-hook behavior remain target-runtime proof. This preparation made no endpoint request.

## Correction verification

The 32 offline checks include stale-session rejection after HTTP/transport/malformed/native-user failures, target/host/key/approval drift refusal before requests, frozen allowlists and expectations, exact match/mismatch/unverified outcomes, 200 unexpected-body and 403 wrong-code cases, and sanitized assertion exceptions. Original source preparation and review findings remain in the WP document. Python object internals and injected evaluators/transports are trusted test code, not a sandbox against hostile code; review the later wrapper. Key provenance, native runtime behavior, fixtures and exact test expectations remain unverified.
