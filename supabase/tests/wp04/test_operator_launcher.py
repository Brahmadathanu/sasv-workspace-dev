"""Offline boundary tests for WP04 operator launcher. No endpoint/console calls."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import operator_launcher as ol

PACKAGE = Path(__file__).resolve().parent
REF = "abcdefghijabcdefghij"
USER = {
    "ccc_edit": "00000000-0000-4000-8000-000000000002",
    "ccc_view": "00000000-0000-4000-8000-000000000001",
    "no_module": "00000000-0000-4000-8000-000000000004",
    "product_view": "00000000-0000-4000-8000-000000000003",
}
TOKEN = "native-test-token-canary"
CANARY = "secret-password-native-test-token"


def future_iso():
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)).isoformat().replace("+00:00", "Z")


def lf_sha(data: bytes) -> str:
    return hashlib.sha256(data.replace(b"\r\n", b"\n") if b"\r\n" in data else data).hexdigest()


def launcher_sha() -> str:
    return lf_sha((PACKAGE / "operator_launcher.py").read_bytes())


class BoundFakeHandler:
    def __init__(self):
        self._by_email = {}
        self._sessions = {}

    def __call__(self, host, method, path, headers, body):
        if path == "/auth/v1/admin/users":
            import auth_api_harness as h
            label = sorted(h.ACTORS)[len(self._by_email)]
            user_id = USER[label]
            email = body["email"]
            self._by_email[email] = (label, user_id)
            return 201, {"id": user_id, "email": email, "notes": CANARY}
        if path.startswith("/auth/v1/token"):
            label, user_id = self._by_email[body["email"]]
            token = TOKEN + "-" + label
            self._sessions[token] = user_id
            return 200, {"access_token": token, "user": {"id": user_id}, "notes": CANARY}
        if path == "/auth/v1/user":
            auth = headers.get("Authorization", "")
            token = auth.removeprefix("Bearer ").strip()
            return 200, {"id": self._sessions[token]}
        return 200, {"period_start": "2026-09-01", "notes": CANARY}


class OperatorLauncherTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.worktree = self.root / "wt"
        self.handoff = self.root / "handoff"
        self.worktree.mkdir()
        self.handoff.mkdir()
        self._now = 100.0
        self.prompt_calls = []

    def tearDown(self):
        self.tmp.cleanup()

    def _clock(self):
        return self._now

    def _sleep(self, seconds):
        self._now += float(seconds)

    def _prompt(self, label):
        self.prompt_calls.append(label)
        return "sb_publishable_fake" if "publishable" in label else "sb_secret_fake"

    def _cases(self):
        import auth_api_harness as h
        cases = []
        for label in sorted(h.ACTORS):
            cases.append({
                "case_id": f"actor-{label}",
                "mode": "actor",
                "actor": label,
                "qualified_name": "public.rpc_get_latest_governed_cost_period_start",
                "params": {},
                "expectation": {
                    "http_status": 200,
                    "body_checks": [{"path": ["period_start"], "expected": "2026-09-01"}],
                },
            })
        cases.append({
            "case_id": "anon-period",
            "mode": "anonymous",
            "qualified_name": "public.rpc_get_latest_governed_cost_period_start",
            "params": {},
            "expectation": {
                "http_status": 200,
                "body_checks": [{"path": ["period_start"], "expected": "2026-09-01"}],
            },
        })
        return cases

    def _spec(self, **changes):
        import auth_api_harness as h
        data = {
            "schema_version": 1,
            "execution": "REVIEWED_LIVE",
            "target": {
                "project_ref": REF,
                "host": REF + ".supabase.co",
                "provider_verified_ref": REF,
                "database_verified_ref": REF,
                "approval_id": "offline-launcher-test",
                "expires_at": future_iso(),
            },
            "fixture_revision": "fix-rev-1",
            "marker": "marker-1",
            "approved_actions": ["auth_create", "auth_signin", "rpc_read"],
            "reviewed_reads": sorted(h.BASELINE_READS),
            "actors": sorted(h.ACTORS),
            "cases": self._cases(),
            "max_fixture_wait_seconds": 30,
            "handoff_directory": str(self.handoff),
            "phase_limits": {"max_cases": 10, "max_create_actors": 4},
        }
        data.update(changes)
        return data

    def _write_json(self, path: Path, data: dict) -> bytes:
        raw = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
        path.write_bytes(raw)
        return raw

    def _approval_doc(self, spec_sha: str, **changes):
        data = {
            "expected_spec_sha256": spec_sha,
            "expected_harness_sha256": ol.EXPECTED_HARNESS_SHA256,
            "expected_wrapper_sha256": ol.EXPECTED_WRAPPER_SHA256,
            "expected_launcher_sha256": launcher_sha(),
            "approval_id": "offline-launcher-test",
            "expires_at": future_iso(),
            "approved_phases": ["live_orchestrate", "real_https"],
            "approved_actions": ["auth_create", "auth_signin", "rpc_read"],
        }
        data.update(changes)
        return data

    def _prepare(self, spec_data=None, approval_changes=None):
        spec_data = spec_data or self._spec()
        spec_path = self.root / "spec.json"
        spec_bytes = self._write_json(spec_path, spec_data)
        spec_sha = hashlib.sha256(spec_bytes).hexdigest()
        approval = self._approval_doc(spec_sha, **(approval_changes or {}))
        approval_path = self.root / "approval.json"
        approval_bytes = self._write_json(approval_path, approval)
        return spec_path, approval_path, lf_sha(approval_bytes), spec_sha

    def _launcher(self, handler=None):
        handler = handler or BoundFakeHandler()

        def factory():
            import sys
            mod = sys.modules["test_runner"]
            return mod.TrustedFakeTransport(handler=handler)

        import sys
        # Ensure ConsoleCredentialAdapter class is available; bind may reload modules.
        import test_runner as runner
        adapter = runner.ConsoleCredentialAdapter(
            prompt_fn=self._prompt,
            stream_probe=lambda: {
                "stdin_isatty": True, "stdout_isatty": True, "stderr_isatty": True,
                "stdin_redirected": False, "stdout_redirected": False, "stderr_redirected": False,
            },
        )
        return ol.OperatorLauncher(
            package_dir=PACKAGE,
            worktree_root=self.worktree,
            clock=self._clock,
            sleep=self._sleep,
            prompt=adapter,
            transport_factory=factory,
        )

    def _write_ack(self, launcher, **overrides):
        payload = {
            "target_ref": REF,
            "spec_sha256": launcher.authority.spec_sha_raw,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
            "verified": True,
        }
        payload.update(overrides)
        path = launcher.authority.ack_path
        path.write_bytes(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode())
        return path

    # --- default / import ---
    def test_default_cli_off_zero_network(self):
        report = ol.main([])
        self.assertEqual(report, 0)
        # main prints; invoke default_report directly too
        launcher = ol.OperatorLauncher(package_dir=PACKAGE, worktree_root=self.worktree)
        rep = launcher.default_report()
        self.assertEqual(rep["execution"], "OFF")
        self.assertEqual(rep["overall"], "NOT_RUN")
        self.assertEqual(rep["network_calls"], 0)
        self.assertEqual(self.prompt_calls, [])

    def test_import_does_not_open_sockets(self):
        with patch("socket.socket") as sock:
            import importlib
            importlib.reload(ol)
            sock.assert_not_called()

    # --- before-prompt refusals ---
    def test_approval_hash_mismatch_before_prompt(self):
        spec_path, approval_path, _sha, _ = self._prepare()
        launcher = self._launcher()
        with self.assertRaisesRegex(ol.LauncherError, "approval_hash_mismatch"):
            launcher.bind_launch_files(
                spec_path=spec_path,
                approval_path=approval_path,
                expected_approval_sha_lf="0" * 64,
            )
        self.assertEqual(self.prompt_calls, [])

    def test_approval_phase_incomplete_before_prompt(self):
        spec_path, approval_path, sha, _ = self._prepare(
            approval_changes={"approved_phases": ["live_orchestrate"]}
        )
        launcher = self._launcher()
        with self.assertRaisesRegex(ol.LauncherError, "approval_phase_incomplete"):
            launcher.bind_launch_files(
                spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
            )
        self.assertEqual(self.prompt_calls, [])

    def test_approval_action_incomplete_before_prompt(self):
        spec_path, approval_path, sha, _ = self._prepare(
            approval_changes={"approved_actions": ["auth_create", "auth_signin"]}
        )
        launcher = self._launcher()
        with self.assertRaisesRegex(ol.LauncherError, "approval_action_incomplete"):
            launcher.bind_launch_files(
                spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
            )
        self.assertEqual(self.prompt_calls, [])

    def test_approval_file_mutation_detected(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        approval_path.write_bytes(b'{"tampered":true}')
        with self.assertRaisesRegex(ol.LauncherError, "approval_binding_changed|approval_"):
            launcher._assert_authority()
        self.assertEqual(self.prompt_calls, [])

    def test_launcher_hash_mismatch_in_approval(self):
        spec_path, approval_path, sha, _ = self._prepare(
            approval_changes={"expected_launcher_sha256": "a" * 64}
        )
        # sha was computed before change — rewrite approval and sha
        data = json.loads(approval_path.read_text(encoding="utf-8"))
        data["expected_launcher_sha256"] = "a" * 64
        raw = self._write_json(approval_path, data)
        launcher = self._launcher()
        with self.assertRaisesRegex(ol.LauncherError, "launcher_hash_mismatch"):
            launcher.bind_launch_files(
                spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=lf_sha(raw),
            )

    def test_preexisting_ack_refused_before_prompt(self):
        spec_path, approval_path, sha, _ = self._prepare()
        (self.handoff / ol.ACK_BASENAME).write_text("{}", encoding="utf-8")
        launcher = self._launcher()
        with self.assertRaisesRegex(ol.LauncherError, "ack_preexisting"):
            launcher.bind_launch_files(
                spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
            )
        self.assertEqual(self.prompt_calls, [])

    def test_redirected_console_refused(self):
        import test_runner as runner
        spec_path, approval_path, sha, _ = self._prepare()
        adapter = runner.ConsoleCredentialAdapter(
            prompt_fn=self._prompt,
            stream_probe=lambda: {
                "stdin_isatty": True, "stdout_isatty": False, "stderr_isatty": True,
                "stdin_redirected": False, "stdout_redirected": True, "stderr_redirected": False,
            },
        )

        def factory():
            return runner.TrustedFakeTransport(handler=BoundFakeHandler())

        launcher = ol.OperatorLauncher(
            package_dir=PACKAGE,
            worktree_root=self.worktree,
            clock=self._clock,
            sleep=self._sleep,
            prompt=adapter,
            transport_factory=factory,
        )
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        with self.assertRaisesRegex(ol.LauncherError, "console_not_private"):
            launcher.prompt_keys()

    # --- ack / timeout / full sequence ---
    def test_full_sequence_positive(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )

        # Write ack after pause starts: intercept begin_fixture_pause
        real_begin = launcher.orch.begin_fixture_pause

        def begin_and_ack():
            deadline = real_begin()
            self._write_ack(launcher)
            return deadline

        launcher.orch.begin_fixture_pause = begin_and_ack
        report = launcher.run_reviewed_sequence()
        self.assertEqual(report["overall"], "PASS_REVIEWED_ASSERTIONS_ONLY")
        self.assertGreaterEqual(report["network_calls"], 1)
        self.assertNotIn(CANARY, json.dumps(report))
        self.assertEqual(len(report["cases"]), 5)

    def test_ack_identity_mismatch_terminal(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        real_begin = launcher.orch.begin_fixture_pause

        def begin_and_bad_ack():
            deadline = real_begin()
            self._write_ack(launcher, fixture_revision="wrong")
            return deadline

        launcher.orch.begin_fixture_pause = begin_and_bad_ack
        with self.assertRaisesRegex(ol.LauncherError, "ack_identity_mismatch|ack_"):
            launcher.run_reviewed_sequence()
        self.assertIsNone(launcher._publishable)
        self.assertIsNone(launcher._secret)

    def test_ack_timeout(self):
        spec_path, approval_path, sha, _ = self._prepare()
        # short wait
        data = self._spec(max_fixture_wait_seconds=2)
        spec_path, approval_path, sha, _ = self._prepare(spec_data=data)
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        # No ack written; sleep advances clock
        with self.assertRaisesRegex(ol.LauncherError, "fixture_wait_expired"):
            launcher.run_reviewed_sequence()

    def test_ack_oversized_terminal(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        real_begin = launcher.orch.begin_fixture_pause

        def begin_and_huge():
            deadline = real_begin()
            launcher.authority.ack_path.write_bytes(b"x" * (ol.MAX_AUTHORITY_BYTES + 8))
            return deadline

        launcher.orch.begin_fixture_pause = begin_and_huge
        with self.assertRaisesRegex(ol.LauncherError, "ack_too_large"):
            launcher.run_reviewed_sequence()

    def test_ack_malformed_json_terminal(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        real_begin = launcher.orch.begin_fixture_pause

        def begin_and_partial():
            deadline = real_begin()
            launcher.authority.ack_path.write_bytes(b'{"verified": true')
            return deadline

        launcher.orch.begin_fixture_pause = begin_and_partial
        with self.assertRaisesRegex(ol.LauncherError, "ack_json_invalid"):
            launcher.run_reviewed_sequence()

    def test_uncertain_create_no_retry(self):
        import test_runner as runner
        handler = BoundFakeHandler()
        fail = {"n": 0}
        original = handler

        def flaky(host, method, path, headers, body):
            if path == "/auth/v1/admin/users":
                fail["n"] += 1
                if fail["n"] == 1:
                    return 500, {"message": CANARY}
            return original(host, method, path, headers, body)

        def factory():
            import sys
            mod = sys.modules["test_runner"]
            return mod.TrustedFakeTransport(handler=flaky)

        adapter = runner.ConsoleCredentialAdapter(
            prompt_fn=self._prompt,
            stream_probe=lambda: {
                "stdin_isatty": True, "stdout_isatty": True, "stderr_isatty": True,
                "stdin_redirected": False, "stdout_redirected": False, "stderr_redirected": False,
            },
        )
        launcher = ol.OperatorLauncher(
            package_dir=PACKAGE,
            worktree_root=self.worktree,
            clock=self._clock,
            sleep=self._sleep,
            prompt=adapter,
            transport_factory=factory,
        )
        spec_path, approval_path, sha, _ = self._prepare()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        with self.assertRaisesRegex(ol.LauncherError, "create_uncertain_stop"):
            launcher.run_reviewed_sequence()
        with self.assertRaisesRegex(ol.LauncherError, "setup_failure_terminal"):
            launcher._assert_authority()

    def test_cancel_during_wait_disposes(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )

        def boom(_seconds):
            raise KeyboardInterrupt

        launcher.sleep = boom
        with self.assertRaises(KeyboardInterrupt):
            launcher.run_reviewed_sequence()
        self.assertIsNone(launcher._publishable)
        self.assertIsNone(launcher._secret)

    def test_second_prompt_failure_clears_first_key(self):
        import test_runner as runner
        calls = {"n": 0}

        def flaky_prompt(label):
            calls["n"] += 1
            if calls["n"] == 1:
                return "sb_publishable_fake"
            raise runner.RunnerError("secret_prompt_failed")

        adapter = runner.ConsoleCredentialAdapter(
            prompt_fn=flaky_prompt,
            stream_probe=lambda: {
                "stdin_isatty": True, "stdout_isatty": True, "stderr_isatty": True,
                "stdin_redirected": False, "stdout_redirected": False, "stderr_redirected": False,
            },
        )

        def factory():
            import sys
            return sys.modules["test_runner"].TrustedFakeTransport(handler=BoundFakeHandler())

        launcher = ol.OperatorLauncher(
            package_dir=PACKAGE,
            worktree_root=self.worktree,
            clock=self._clock,
            sleep=self._sleep,
            prompt=adapter,
            transport_factory=factory,
        )
        spec_path, approval_path, sha, _ = self._prepare()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        with self.assertRaisesRegex(ol.LauncherError, "secret_prompt_failed"):
            launcher.prompt_keys()
        self.assertIsNone(launcher._publishable)
        self.assertIsNone(launcher._secret)

    def test_report_rejects_canary_notes(self):
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.launcher_report(notes=CANARY)

    def test_https_blocked_in_tests(self):
        import http.client
        with patch.object(http.client, "HTTPSConnection", side_effect=AssertionError("blocked")):
            # default path must not touch HTTPS
            ol.OperatorLauncher(package_dir=PACKAGE, worktree_root=self.worktree).default_report()

    def test_ack_symlink_refused_when_supported(self):
        if os.name == "nt":
            # Creating symlinks often needs elevation; skip honestly if unavailable.
            link = self.root / "link-handoff"
            try:
                os.symlink(self.handoff, link, target_is_directory=True)
            except OSError:
                self.skipTest("symlink creation requires privileges")
            data = self._spec(handoff_directory=str(link))
            spec_path, approval_path, sha, _ = self._prepare(spec_data=data)
            launcher = self._launcher()
            with self.assertRaisesRegex(ol.LauncherError, "ack_symlink_refused|handoff_symlink"):
                launcher.bind_launch_files(
                    spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
                )
        else:
            link = self.root / "link-handoff"
            os.symlink(self.handoff, link, target_is_directory=True)
            data = self._spec(handoff_directory=str(link))
            spec_path, approval_path, sha, _ = self._prepare(spec_data=data)
            launcher = self._launcher()
            with self.assertRaisesRegex(ol.LauncherError, "ack_symlink_refused|handoff_symlink"):
                launcher.bind_launch_files(
                    spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
                )


if __name__ == "__main__":
    unittest.main()
