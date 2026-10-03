# WP04-G4-S0 — Windows private-input proof package

Status: COMMAND HANDOFF VERIFIED; FAKE-ONLY USER HIDDEN/CANCEL OBSERVATION RELEASED; REAL CREDENTIALS/LIVE OPERATIONS WITHHELD.
Date: 2026-10-03. Authority: [WP04](WP-04-READINESS-CONTROL-CENTRE.md).

## Purpose and frozen evidence

Determine whether the accepted input adapter works with hidden input in an actual separate Windows console. This is a fake-only local environment check, not credential entry, native Auth/API testing or target readiness. Preparation main was b162d4932ec2bbe9ca665aadedf1827e5117de5a; reconciled review main is 768992a3a59a7b6809b327f6e75023e535a4bf79; preparation source docs 2ebdc0cf5193070b82754b310a6ff893d5d4b6bc; accepted feature test/wp04-s0-cursor-runner at 0c6276192d6dfa05f311325d50cc4dac66826d2b. The accepted 76-test suite is unchanged. No further wrapper correction is requested.

The only entered text will be `WP04-FAKE-ONLY`. Physical echo must be observed by the user; a mock or automated result cannot establish that observation. An isatty check is a necessary adapter condition, not proof that a terminal is confidential or unrecorded. Use a trusted local console without transcript, screen recording, remote sharing or output capture. No real keys at this gate.

## Approved Cursor preparation brief — hidden/cancel execution withheld

Package review below approves only these local preparation steps:

1. Fetch main, feature and current docs. Verify the full expected main/feature SHAs and the reviewed docs tip. On unexpected movement, stop and report commits/overlap; no silent rebase/merge.
2. Preserve the dirty original checkout. Use the existing isolated feature worktree at the exact accepted head; report its absolute path. Do not switch/reset/clean the original checkout or create a revised feature commit.
3. Materialize the exact Python block below into a new local temporary file outside all worktrees, named wp04_fake_console_check.py, without overwriting an existing file. Report its SHA-256 and the accepted source hashes. This temporary demonstration is not a new live runner or repository implementation. Do not install packages, load .env, inspect stored credentials, build a spec, create approval/Auth/transport/client objects or call an endpoint.
4. Prepare three exact commands with the real isolated tests directory substituted, using C:\Users\BRAHMADATHAN U\anaconda3\python.exe. Do not launch the hidden-input commands in the agent's captured terminal. Return commands and evidence for review/handoff; the user later launches a separate local PowerShell window. No Start-Process hidden automation or simulated human echo observation.

## Exact demonstration source

The snippet imports only hash-checked accepted local modules and calls ConsoleCredentialAdapter. Python -I ignores environment/PYTHONPATH and excludes the working directory; the script executes the exact verified module bytes and avoids local bytecode caches. Socket/subprocess audit events are refused before importing accepted code. This guard is defense in depth for trusted reviewed code, not an OS sandbox or independent network-monitoring proof. No persistence of entered text; finally drops its local reference, which is not guaranteed memory erasure.

```python
import hashlib
import types
import pathlib
import sys

EXPECTED = {
    "test_runner.py": "36b897a0d1f2596a99c19631bb0bf6117f7757a658de28f3b45cc1d40386abdb",
    "auth_api_harness.py": "3fad74acdbf82ea14c6aa05027c9e43f566e46588ceca905daa904857f7a5eed",
}

def deny_external(event, args):
    if event.startswith("socket.") or event.startswith("subprocess.") or event in {"os.system", "os.spawn"}:
        raise RuntimeError("external_operation_refused")

sys.addaudithook(deny_external)
value = None
try:
    if len(sys.argv) != 3 or sys.argv[2] not in {"hidden", "cancel", "refusal"}:
        raise ValueError()
    source = pathlib.Path(sys.argv[1]).resolve(strict=True)
    mode = sys.argv[2]
    verified = {}
    for name, expected in EXPECTED.items():
        raw = (source / name).read_bytes().replace(b"\r\n", b"\n")
        if hashlib.sha256(raw).hexdigest() != expected:
            print("SOURCE_MISMATCH; NOT_RUN")
            raise SystemExit(2)
        verified[name] = raw
    for name in ("auth_api_harness", "test_runner"):
        module = types.ModuleType(name)
        module.__file__ = str(source / (name + ".py"))
        sys.modules[name] = module
        exec(compile(verified[name + ".py"], module.__file__, "exec"), module.__dict__)
    runner = sys.modules["test_runner"]
    adapter = runner.ConsoleCredentialAdapter()
    flags = adapter._default_probe()
    print("STREAM_FLAGS", flags)
    print("FAKE_ONLY; NO AUTH/API TARGET; MODE", mode)
    if mode == "refusal":
        try:
            adapter.assert_private_console()
        except runner.RunnerError:
            print("NONINTERACTIVE_REFUSED; NO PROMPT")
        else:
            print("EXPECTED_REDIRECTION_MISSING; NOT_RUN")
            raise SystemExit(2)
    else:
        try:
            value = adapter.prompt_secret("Type WP04-FAKE-ONLY, or Ctrl+C for cancel check")
        except KeyboardInterrupt:
            print("CANCELLED; LOCAL_REFERENCE_DROPPED")
            if mode != "cancel":
                raise SystemExit(2)
        except runner.RunnerError:
            print("ADAPTER_REFUSED; NO INPUT PROOF")
            raise SystemExit(2)
        else:
            if mode == "cancel":
                print("CANCEL_NOT_OBSERVED")
                raise SystemExit(2)
            print("FAKE_MATCH" if value == "WP04-FAKE-ONLY" else "FAKE_MISMATCH")
            if value != "WP04-FAKE-ONLY":
                raise SystemExit(2)
except Exception:
    print("LOCAL_CHECK_FAILED; NOT_RUN")
    raise SystemExit(2) from None
finally:
    value = None
```

## Later user commands — templates, do not execute yet

Cursor must replace both absolute placeholders with verified local paths before handoff. Open PowerShell yourself, independently of Cursor's terminal, after package review and preparation. No coding is required. Quotes preserve paths with spaces.

```powershell
& 'C:\Users\BRAHMADATHAN U\anaconda3\python.exe' -I 'ABSOLUTE_TEMP_SCRIPT_PATH' 'ABSOLUTE_ISOLATED_TESTS_DIRECTORY' hidden
& 'C:\Users\BRAHMADATHAN U\anaconda3\python.exe' -I 'ABSOLUTE_TEMP_SCRIPT_PATH' 'ABSOLUTE_ISOLATED_TESTS_DIRECTORY' cancel
& 'C:\Users\BRAHMADATHAN U\anaconda3\python.exe' -I 'ABSOLUTE_TEMP_SCRIPT_PATH' 'ABSOLUTE_ISOLATED_TESTS_DIRECTORY' refusal | Out-Null
```

First command: all three isatty flags should be True and redirected flags False. Type only WP04-FAKE-ONLY and press Enter. Observe whether characters appear; report hidden YES/NO and FAKE_MATCH/other fixed result. If any characters appear, stop and report failure. Second command: press Ctrl+C at the prompt; report CANCELLED, without entering text. Third command intentionally redirects stdout; it must end without any prompt. Because output is discarded, the operator cannot infer a refusal result solely from silence: Cursor may separately run this fake-only refusal mode with redirected output capture to verify the exact fixed result; do not capture hidden/cancel mode. Do not use redirection for a real-input route later.

GetPassWarning must refuse via the accepted adapter, never fall back to echoing input. Existing offline tests cover this warning path; the real demonstration need not force an unsafe console failure. A naturally encountered warning/refusal is a failed environment proof, not a reason to bypass checks. Wrong fake text produces FAKE_MISMATCH and is not a passing hidden-input demonstration. Cancellation means local reference disposal, not remote revoke/delete or proof of memory erasure.

## Required evidence and stop

Report interpreter path/version, isolated feature SHA, wrapper/harness LF hashes, snippet hash, terminal type and stream flags, hidden observation, match result, cancellation result, redirected-mode fixed refusal result and any NOT_RUN. Do not include entered text, screenshots containing input, real keys, environment dumps or tracebacks. One actual hidden-input success plus cancellation and redirected refusal is the bounded proof sought. Hash/TTY PASS alone cannot establish hidden input or overall environment readiness. Report limitations honestly; no forced retries or code edits.

Current gate: WP04-G4-S0 — Windows private-input proof package review passed.
Exact next gate: WP04-G4-S0 — Cursor local fake-console materialization and command handoff.
Required to close review: inspect exact snippet, source/runtime binding, no-network boundaries, reporting and minimal operator handoff; freeze preparation/execution authorization explicitly. Console execution remains withheld in this prepared package. Later actual target/cost/default/bootstrap/fixtures/native/parity/performance packages remain separate. Paid target HOLD; programme 4 of 13; WP03 closed; DEC-014 preserved; no new parked finding or decision lock; all branches unmerged.


## Package review and moved-main reconciliation — 2026-10-03

Fetched main 768992a3a59a7b6809b327f6e75023e535a4bf79, docs 72dc0a9aeff2f09245102105ae59a3ee6b0c7872 and feature 0c6276192d6dfa05f311325d50cc4dac66826d2b. Intervening commits 687a00e, 0a3b961 and merge 768992a touch only e-Aushadhi Composition adapter fill order, its smoke tests and e-Aushadhi docs; no Product/SKU readiness, Costing/Master Data/control-centre or WP04 overlap. Reconciled without rebase/merge onto main. Verified own published documents byte-for-byte, then synchronized the docs checkout only by fast-forward to its existing remote tip.

Independent package review: exact verified bytes are executed, avoiding bytecode-cache substitution; no input/spec/client/transport/Auth construction or remote operation. LF snippet SHA-256 **99cbecd224f9b87955cab357da810955f4ccbbe1e7949e26471c94e030d8e7c3**. Compile plus five bounded local checks passed: redirected refusal mode emits NONINTERACTIVE_REFUSED; hidden/cancel modes refuse under redirected streams; missing source emits LOCAL_CHECK_FAILED; modified source emits SOURCE_MISMATCH before execution. No stderr/traceback, input or console prompt in these checks. These are Linux noninteractive package checks, not actual Windows hidden/cancellation proof.

**Review PASSED.** Authorize Cursor materialization of the exact block only, with exclusive temporary-file creation outside worktrees, accepted feature/source hashes and CPython path/version verification. Cursor may run only refusal mode in its captured terminal and return the fixed result plus exit status; it must not run hidden/cancel mode. Return script absolute path, raw-file and LF snippet hashes (LF must match above), tests-directory path, unchanged feature head, runtime, main/docs refs and fully substituted commands. Do not alter line content, accepted repository files or interpreter settings. Stop for ChatGPT handoff verification before user console execution. No commit/push required for this temporary local file. If script creation fails or an existing name collides, use a new exclusive temporary directory rather than overwriting or escalating.

Next after Cursor response: WP04-G4-S0 — Prepared Windows command handoff verification. Actual user fake-input execution follows a verified handoff; real credentials/native/target/cost/bootstrap/server/client operations remain withheld. No new parked finding or lock. DEC-014 and WP03 closure unchanged.

## Cursor materialization report / handoff verification pending — 2026-10-03

Cursor reports temporary script `D:\ELECTRON PROJECTS\.tmp-wp04-fake-console-3996bec7a8e0431789e6529e5ea4f915\wp04_fake_console_check.py`, raw/LF SHA-256 99cbecd224f9b87955cab357da810955f4ccbbe1e7949e26471c94e030d8e7c3, Python 3.12.4, refusal NONINTERACTIVE_REFUSED; NO PROMPT with exit 0, hidden/cancel NOT_RUN. Hash matches the reviewed snippet. This is Cursor-reported Windows evidence; ChatGPT has no direct access to that local file/console. Current Git refs independently fetched unchanged: main 768992a3a59a7b6809b327f6e75023e535a4bf79, docs 8427f992348d0b5ad01db2116338a0131636e18d, feature 0c6276192d6dfa05f311325d50cc4dac66826d2b.

Handoff is incomplete: isolated accepted tests-directory absolute path, its checkout SHA and wrapper/harness hashes, exact interpreter path and fully substituted commands were not supplied. Request existing evidence only; no script recreation, code change, repeat suite or hidden/cancel execution. Current gate: WP04-G4-S0 — Prepared Windows command handoff verification, awaiting complete Cursor evidence. Next: complete this handoff, then release fake-only user console instructions after verification. No real credential/live/server/production operation or merge; programme 4 of 13, WP03 closed, DEC-014/parked/locks unchanged.


## Completed command handoff verified — 2026-10-03

Cursor supplied the existing tests directory `D:\ELECTRON PROJECTS\daily-worklog-app-wt-wp04-s0-cursor-runner\supabase\tests\wp04`, accepted feature SHA 0c6276192d6dfa05f311325d50cc4dac66826d2b, exact accepted wrapper/harness LF hashes, interpreter `C:\Users\BRAHMADATHAN U\anaconda3\python.exe` 3.12.4 and fully substituted hidden/cancel/refusal commands for the previously reported script. Compared with reviewed package: all bindings/arguments match. Windows local-file/runtime evidence is Cursor-reported, not independently observed by ChatGPT. Current main 768992a3a59a7b6809b327f6e75023e535a4bf79, docs entry 03e5695e3b24ca14cc525a5afd9ac60105ee3861 and feature independently fetched unchanged.

**Handoff verification PASSED.** Release only fake-only hidden and cancellation commands in a separate trusted user-opened PowerShell window. Previously reported captured refusal result exit 0 remains sufficient for this handoff; no user repeat of discarded-output refusal is needed. User observes physical echo and reports stream flags, FAKE_MATCH and CANCELLED. Stop immediately on echo, refusal, mismatch, source change or unexpected output; no guard bypass, code edit or real-key substitution. This release authorizes the fake-only local observation, not any real credentials, provider/target/cost/Auth/API/SQL/production operation. Windows proof remains NOT_RUN until user report. Branches unmerged; programme 4 of 13; WP03 closed; DEC-014 and parked/locked authority unchanged.

Current gate: WP04-G4-S0 — Windows fake-only private-input observation, awaiting user evidence.
Exact next: WP04-G4-S0 — Windows fake-only private-input proof audit.
Required evidence: three stream TTY flags True / redirects False, user hidden-input YES/NO observation, FAKE_MATCH, CANCELLED; retain prior refusal evidence and stop on any failure. Proof does not certify an unrecorded terminal, future real-key handling or complete environment readiness.
