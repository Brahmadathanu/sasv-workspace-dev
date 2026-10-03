# WP04 native Auth/API harness and offline test runner

Status: accepted harness components unchanged; offline Cursor wrapper added for review. Native Auth/API execution remains NOT_RUN and is not approved by this README. ChatGPT owns server delivery under DEC-014.

## Component acceptance versus wrapper verification

| Layer | Evidence | Meaning |
| --- | --- | --- |
| `auth_api_harness.py` + `test_auth_api_harness.py` | 32 offline tests | Component-level acceptance only |
| `test_runner.py` + `test_test_runner.py` | offline wrapper boundary tests | Wrapper defaults OFF; no native proof |
| Live Auth/API / fixtures / performance | NOT_RUN | Requires later ChatGPT target, cost, spec and phase approval |

Reviewed harness SHA-256 values (unchanged):

| File | SHA-256 |
| --- | --- |
| `auth_api_harness.py` | `3fad74acdbf82ea14c6aa05027c9e43f566e46588ceca905daa904857f7a5eed` |
| `test_auth_api_harness.py` | `8957cb5ef8cc4e30422b7a4a0a9f1b3fca6a5b34569e3bd2efa26fcb23adbc76` |

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
& "C:\Users\BRAHMADATHAN U\anaconda3\python.exe" -m unittest discover -s supabase/tests/wp04 -p "test_*.py" -v
```

The harness and runner default commands emit OFF/NOT_RUN JSON and make zero network requests. There is intentionally no live CLI execution switch and no credential argument.

`test_runner_spec.example.json` is non-executable. It stays OFF while unresolved placeholders remain, even if `execution` is edited to `REVIEWED_LIVE`.

## Staged credential and fixture handoff (later authorization only)

Not enabled by this offline package.

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
- Spec/wrapper/harness approval compares LF-normalized file bytes to external reviewed digests.
- Guarded live stages require an explicit one-way fixture sequence; proof before acknowledgement is refused.
- Real Windows hidden-input demonstration, native Auth/API calls, provisioning and performance proof remain separately authorized.
- Path confinement is fail-closed where supported; it is not claimed race-proof against a hostile local filesystem.

Sources consulted earlier remain dated evidence, not a new runtime proof of this machine's private-input or network behavior.
