# WP04 native Auth/API harness and offline test runner

Status: accepted harness/wrapper unchanged; operator launcher added for offline review. Native Auth/API execution remains NOT_RUN and is not approved by this README. ChatGPT owns server delivery under DEC-014.

## Component acceptance versus wrapper verification

| Layer | Evidence | Meaning |
| --- | --- | --- |
| `auth_api_harness.py` + `test_auth_api_harness.py` | 32 offline tests | Component-level acceptance only |
| `test_runner.py` + `test_test_runner.py` | offline wrapper boundary tests | Wrapper defaults OFF; no native proof |
| `operator_launcher.py` + `test_operator_launcher.py` | offline launcher boundary tests | Launcher defaults OFF; no native proof |
| Live Auth/API / fixtures / performance | NOT_RUN | Requires later ChatGPT target, cost, spec and phase approval |

Reviewed harness SHA-256 values (unchanged):

| File | SHA-256 |
| --- | --- |
| `auth_api_harness.py` | `3fad74acdbf82ea14c6aa05027c9e43f566e46588ceca905daa904857f7a5eed` |
| `test_auth_api_harness.py` | `8957cb5ef8cc4e30422b7a4a0a9f1b3fca6a5b34569e3bd2efa26fcb23adbc76` |

Accepted wrapper LF SHA-256 (unchanged): `test_runner.py` = `36b897a0d1f2596a99c19631bb0bf6117f7757a658de28f3b45cc1d40386abdb`.

## Windows offline launch

Use the verified interpreter on this machine when available:

```powershell
& "C:\Users\BRAHMADATHAN U\anaconda3\python.exe" --version
```

Expect Python 3.12.x. Do not use the WindowsApps `python3` stub. The `py` launcher may be absent.

From the repository root of this branch/worktree:

```powershell
& "C:\Users\BRAHMADATHAN U\anaconda3\python.exe" supabase/tests/wp04/auth_api_harness.py
& "C:\Users\BRAHMADATHAN U\anaconda3\python.exe" supabase/tests/wp04/test_runner.py
& "C:\Users\BRAHMADATHAN U\anaconda3\python.exe" supabase/tests/wp04/test_runner.py preflight
& "C:\Users\BRAHMADATHAN U\anaconda3\python.exe" supabase/tests/wp04/operator_launcher.py
& "C:\Users\BRAHMADATHAN U\anaconda3\python.exe" -m unittest discover -s supabase/tests/wp04 -p "test_*.py" -v
```

Harness, runner and operator launcher default commands emit OFF/NOT_RUN JSON and make zero network requests. There is intentionally no credential argument. A future live launcher invocation requires separately reviewed absolute spec/approval paths plus an independently supplied approval-file LF SHA-256; it is not authorized by this README alone.

`test_runner_spec.example.json` is non-executable. It stays OFF while unresolved placeholders remain, even if `execution` is edited to `REVIEWED_LIVE`.

## Operator-launcher phases (later authorization only)

Not enabled for real keys/network by this offline package.

1. ChatGPT supplies a reviewed target-bound spec file and a separate external approval JSON (spec/harness/wrapper/launcher LF hashes, expiry, both `live_orchestrate` and `real_https`, all three actions). The launch instruction independently names the expected approval-file LF digest; that digest is never taken from the approval body.
2. Default `operator_launcher.py` remains OFF. A later live run uses a trusted separate Windows console, validates files/hashes before any prompt, then hidden `getpass` for the two target-only modern keys.
3. After bind/create, the launcher exports only UUID handoff JSON (`target_ref`, `spec_sha256`, `fixture_revision`, four label→UUID entries) under the reviewed outside-worktree handoff directory and prints that path as an operator instruction (not a report field).
4. Operator attaches the UUID JSON in project chat. ChatGPT applies fixtures on the server and returns a nonsecret ack file. Operator copies the fully written ack to the frozen watched path `wp04-fixture-ack.json` under the same handoff directory. Process must stay alive; wait is bounded by `max_fixture_wait_seconds` (≤3600) and cannot be extended or resumed after exit.
5. Proof reads require exact expected case coverage. Only full MATCH yields `PASS_REVIEWED_ASSERTIONS_ONLY`. UNVERIFIED/mismatch/missing coverage/setup failure cannot proof-pass.

## Staged credential and fixture handoff (wrapper notes)

1. ChatGPT supplies a reviewed target-bound spec and external approval digest (spec/harness/wrapper hashes, expiry, phases). The approval digest is outside the hashed spec bytes.
2. In a separately opened trusted local console (not the Cursor agent terminal), hidden `getpass` entry may later collect the two target-only modern keys. Redirected/agent terminals are refused. `GetPassWarning` fails closed.
3. After separately authorized native actor creation, the wrapper may export only target ref, spec hash, fixture revision and four label-to-UUID mappings to an explicit directory outside the worktree (exclusive create, no overwrite).
4. The user relays that nonsecret mapping to ChatGPT. ChatGPT applies fixtures and returns a nonsecret acknowledgement. The runner uses a bounded monotonic pause; it does not save passwords or sessions.
5. Proof reads require exact expectations. UNVERIFIED is never a proof pass. MATCH means only reviewed assertions matched.

## Limits

- No environment-variable credential loading, secret files, clipboard automation or chat secret collection.
- No production target `qhmoqtxpeasamtlxaoak`.
- No permission SQL writer, actor cleanup, revoke, delete or merge/tag/release from this package.
- `forget()` drops local references only; it is not memory zeroization or remote revocation.
- Offline tests use injected `TrustedFakeTransport` / fake prompts / synthetic identities only.
- Spec/wrapper/harness/launcher approval compares LF-normalized file bytes to external reviewed digests; launch instructions also bind the approval file by LF digest while retaining exact approval/spec bytes for drift checks. Spec content binds by LF digest so CRLF-equivalent reviewed files match; exact on-disk bytes remain for drift. Approval/ack reads use binary mode. Ack basename is frozen to `wp04-fixture-ack.json` only.
- Live/simulated reports use closed execution/phase enums (`OFF` / `SIMULATED_OFFLINE` / `REVIEWED_LIVE`); assertion-only PASS is not full readiness/CSE/performance proof.
- Guarded live stages require an explicit one-way fixture sequence; proof before acknowledgement is refused.
- After client binding, source/artifact/handoff operational failures enter terminal `FAILED`, forget local credential/session references, and expose only fixed safe failure codes; continuation is refused.
- Reviewed case/phase identifiers are allowlisted nonsecret metadata. Regex allowlisting is not content-level secret detection.
- Real Windows hidden-input demonstration, native Auth/API calls, provisioning and performance proof remain separately authorized.
- Path confinement is fail-closed where supported; it is not claimed race-proof against a hostile local filesystem.
- Local code cannot cryptographically authenticate ChatGPT; trust is reviewed operator-selected approval/ack files plus source hashes.

Sources consulted earlier remain dated evidence, not a new runtime proof of this machine's private-input or network behavior.
