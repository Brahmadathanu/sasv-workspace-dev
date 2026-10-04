"""Offline boundary tests for WP04 operator launcher. No endpoint/console calls."""
from __future__ import annotations

import datetime as dt
import hashlib
import http.client
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
        self._https_guard = patch.object(
            http.client, "HTTPSConnection", side_effect=AssertionError("blocked")
        )
        self._https_guard.start()
        self._sock_guard = patch("socket.socket", side_effect=AssertionError("blocked"))
        self._sock_guard.start()

    def tearDown(self):
        self._https_guard.stop()
        self._sock_guard.stop()
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

    def _write_json(self, path: Path, data: dict, *, crlf: bool = False) -> bytes:
        text = json.dumps(data, sort_keys=True, separators=(",", ":"))
        raw = (text.replace("\n", "\r\n") if crlf else text).encode("utf-8")
        if crlf and b"\n" in raw and b"\r\n" not in raw:
            raw = text.encode("utf-8").replace(b"\n", b"\r\n")
        # Ensure CRLF form for single-line JSON by appending CRLF newline only when requested.
        if crlf:
            raw = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8") + b"\r\n"
        path.write_bytes(raw)
        return raw

    def _approval_doc(self, spec_sha_lf: str, **changes):
        data = {
            "expected_spec_sha256": spec_sha_lf,
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

    def _prepare(self, spec_data=None, approval_changes=None, *, spec_crlf: bool = False):
        spec_data = spec_data or self._spec()
        spec_path = self.root / "spec.json"
        spec_bytes = self._write_json(spec_path, spec_data, crlf=spec_crlf)
        spec_sha_lf = lf_sha(spec_bytes)
        approval = self._approval_doc(spec_sha_lf, **(approval_changes or {}))
        approval_path = self.root / "approval.json"
        approval_bytes = self._write_json(approval_path, approval)
        return spec_path, approval_path, lf_sha(approval_bytes), spec_sha_lf

    def _launcher(self, handler=None, **kwargs):
        handler = handler or BoundFakeHandler()

        def factory():
            import sys
            mod = sys.modules["test_runner"]
            return mod.TrustedFakeTransport(handler=handler)

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
            **kwargs,
        )

    def _write_ack(self, launcher, **overrides):
        payload = {
            "target_ref": REF,
            "spec_sha256": launcher.authority.spec_sha_lf,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
            "verified": True,
        }
        payload.update(overrides)
        path = launcher.authority.ack_path
        path.write_bytes(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode())
        return path

    def _run_with_ack(self, launcher, ack_writer=None):
        real_begin = launcher.orch.begin_fixture_pause

        def begin_and_ack():
            deadline = real_begin()
            (ack_writer or (lambda: self._write_ack(launcher)))()
            return deadline

        launcher.orch.begin_fixture_pause = begin_and_ack
        return launcher.run_reviewed_sequence()

    def test_default_cli_off_zero_network(self):
        self.assertEqual(ol.main([]), 0)
        rep = ol.OperatorLauncher(package_dir=PACKAGE, worktree_root=self.worktree).default_report()
        self.assertEqual(rep["execution"], "OFF")
        self.assertEqual(rep["overall"], "NOT_RUN")
        self.assertEqual(rep["network_calls"], 0)
        self.assertEqual(rep["transport_calls"], 0)
        self.assertEqual(self.prompt_calls, [])

    def test_import_does_not_open_sockets(self):
        import importlib
        importlib.reload(ol)

    def test_approval_hash_mismatch_before_prompt(self):
        spec_path, approval_path, _sha, _ = self._prepare()
        launcher = self._launcher()
        with self.assertRaisesRegex(ol.LauncherError, "approval_hash_mismatch"):
            launcher.bind_launch_files(
                spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf="0" * 64,
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

    def test_la01_authority_field_assignment_refused(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        with self.assertRaisesRegex(ol.LauncherError, "approval_binding_changed"):
            launcher.authority.launcher_sha_lf = "b" * 64
        self.assertEqual(self.prompt_calls, [])

    def test_la01_authority_object_replacement_refused(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        original = launcher.authority
        launcher.authority = ol.FrozenAuthority(
            approval_path=original.approval_path,
            approval_bytes=original.approval_bytes,
            approval_sha_raw=original.approval_sha_raw,
            approval_sha_lf=original.approval_sha_lf,
            expected_approval_sha_lf=original.expected_approval_sha_lf,
            launcher_path=original.launcher_path,
            launcher_sha_lf="b" * 64,
            spec_path=original.spec_path,
            spec_bytes=original.spec_bytes,
            spec_sha_lf=original.spec_sha_lf,
            spec_sha_raw=original.spec_sha_raw,
            ack_path=original.ack_path,
            approval_id=original.approval_id,
            expires_at=original.expires_at,
            approved_phases=original.approved_phases,
            approved_actions=original.approved_actions,
            expected_spec_sha256=original.expected_spec_sha256,
            approval_fingerprint=original.approval_fingerprint,
        )
        with self.assertRaisesRegex(ol.LauncherError, "approval_binding_changed"):
            launcher._assert_authority()
        self.assertEqual(self.prompt_calls, [])

    def test_launcher_hash_mismatch_in_approval(self):
        data = self._approval_doc("a" * 64)
        # rebuild properly
        spec_path, approval_path, sha, _ = self._prepare(
            approval_changes={"expected_launcher_sha256": "a" * 64}
        )
        launcher = self._launcher()
        with self.assertRaisesRegex(ol.LauncherError, "launcher_hash_mismatch"):
            launcher.bind_launch_files(
                spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
            )

    def test_missing_approval_file_before_prompt(self):
        spec_path, approval_path, sha, _ = self._prepare()
        approval_path.unlink()
        launcher = self._launcher()
        with self.assertRaisesRegex(ol.LauncherError, "approval_file_invalid"):
            launcher.bind_launch_files(
                spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
            )
        self.assertEqual(self.prompt_calls, [])

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
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        with self.assertRaisesRegex(ol.LauncherError, "console_not_private"):
            launcher.prompt_keys()

    def test_full_sequence_positive(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        report = self._run_with_ack(launcher)
        self.assertEqual(report["overall"], "PASS_REVIEWED_ASSERTIONS_ONLY")
        self.assertEqual(report["execution"], "SIMULATED_OFFLINE")
        self.assertEqual(report["native_auth"], "ATTEMPTED")
        self.assertEqual(report["api_permissions"], "ATTEMPTED")
        self.assertEqual(report["network_calls"], 0)
        self.assertGreaterEqual(report["transport_calls"], 1)
        self.assertEqual(list(report["phases"]), list(ol.REQUIRED_PASS_PHASES))
        self.assertTrue(all(c["assertion"] == "MATCH" for c in report["cases"]))
        self.assertNotIn(CANARY, json.dumps(report))
        self.assertEqual(len(report["cases"]), 5)

    def test_la04_crlf_spec_binds_via_lf_digest(self):
        spec_path, approval_path, sha, _ = self._prepare(spec_crlf=True)
        # Approval expected_spec is LF digest; raw file has trailing CRLF.
        self.assertNotEqual(hashlib.sha256(spec_path.read_bytes()).hexdigest(), lf_sha(spec_path.read_bytes()))
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        report = self._run_with_ack(launcher)
        self.assertEqual(report["overall"], "PASS_REVIEWED_ASSERTIONS_ONLY")

    def test_ack_identity_mismatch_terminal(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        with self.assertRaisesRegex(ol.LauncherError, "ack_identity_mismatch|ack_"):
            self._run_with_ack(launcher, ack_writer=lambda: self._write_ack(launcher, fixture_revision="wrong"))
        self.assertIsNone(launcher._publishable)
        self.assertIsNone(launcher._secret)

    def test_ack_timeout(self):
        data = self._spec(max_fixture_wait_seconds=2)
        spec_path, approval_path, sha, _ = self._prepare(spec_data=data)
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        with self.assertRaisesRegex(ol.LauncherError, "fixture_wait_expired"):
            launcher.run_reviewed_sequence()

    def test_ack_oversized_terminal(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )

        def huge():
            launcher.authority.ack_path.write_bytes(b"x" * (ol.MAX_AUTHORITY_BYTES + 8))

        with self.assertRaisesRegex(ol.LauncherError, "ack_too_large"):
            self._run_with_ack(launcher, ack_writer=huge)

    def test_ack_malformed_json_terminal(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )

        def partial():
            launcher.authority.ack_path.write_bytes(b'{"verified": true')

        with self.assertRaisesRegex(ol.LauncherError, "ack_json_invalid"):
            self._run_with_ack(launcher, ack_writer=partial)

    def test_ack_duplicate_key_refused(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )

        def dup():
            launcher.authority.ack_path.write_bytes(
                b'{"verified":true,"verified":false,"target_ref":"x","spec_sha256":"y",'
                b'"fixture_revision":"z","actor_uuids":{}}'
            )

        with self.assertRaisesRegex(ol.LauncherError, "ack_json_invalid"):
            self._run_with_ack(launcher, ack_writer=dup)

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
            return sys.modules["test_runner"].TrustedFakeTransport(handler=flaky)

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

    def test_la03_report_type_checks_before_membership(self):
        for bad in ([], {}, 1, True, None):
            with self.subTest(bad=bad):
                with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
                    ol.launcher_report(mode=bad)
                with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
                    ol.launcher_report(overall=bad)
                with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
                    ol.launcher_report(cases=[{"case_id": "anon-period", "assertion": bad}])

    def test_la03_contradictory_pass_refused(self):
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.launcher_report(
                overall="PASS_REVIEWED_ASSERTIONS_ONLY",
                notes="operator_complete",
                network_calls=0,
                transport_calls=0,
                execution="SIMULATED_OFFLINE",
                native_auth="ATTEMPTED",
                api_permissions="ATTEMPTED",
            )
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.launcher_report(
                overall="PASS_REVIEWED_ASSERTIONS_ONLY",
                notes="operator_complete",
                execution="REVIEWED_LIVE",
                native_auth="ATTEMPTED",
                api_permissions="ATTEMPTED",
                network_calls=1,
                transport_calls=0,
                phases=list(ol.REQUIRED_PASS_PHASES),
                cases=[],
            )
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.launcher_report(
                overall="PASS_REVIEWED_ASSERTIONS_ONLY",
                notes="operator_complete",
                execution="REVIEWED_LIVE",
                native_auth="ATTEMPTED",
                api_permissions="NOT_RUN",
                network_calls=1,
                transport_calls=0,
                phases=list(ol.REQUIRED_PASS_PHASES),
                cases=[{"case_id": "anon-period", "assertion": "MATCH"}],
            )
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.launcher_report(
                overall="PASS_REVIEWED_ASSERTIONS_ONLY",
                notes="operator_complete",
                execution="REVIEWED_LIVE",
                native_auth="ATTEMPTED",
                api_permissions="ATTEMPTED",
                network_calls=1,
                transport_calls=0,
                phases=list(ol.REQUIRED_PASS_PHASES),
                cases=[{"case_id": "anon-period", "assertion": "MISMATCH"}],
            )
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.launcher_report(
                execution="OFF",
                network_calls=1,
                transport_calls=0,
            )

    def test_public_pass_without_trusted_coverage_refused(self):
        """Public formatter cannot PASS on a caller-supplied MATCH subset."""
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.launcher_report(
                overall="PASS_REVIEWED_ASSERTIONS_ONLY",
                notes="operator_complete",
                execution="REVIEWED_LIVE",
                native_auth="ATTEMPTED",
                api_permissions="ATTEMPTED",
                network_calls=1,
                transport_calls=0,
                phases=list(ol.REQUIRED_PASS_PHASES),
                cases=[{"case_id": "anon-period", "assertion": "MATCH"}],
            )

    def test_bound_pass_rejects_absent_subset_extra_duplicate_reordered(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        expected = list(launcher._retained_expected_case_ids)
        self.assertGreaterEqual(len(expected), 2)
        base = {
            "execution": "SIMULATED_OFFLINE",
            "native_auth": "ATTEMPTED",
            "api_permissions": "ATTEMPTED",
            "network_calls": 0,
            "transport_calls": 1,
            "overall": "PASS_REVIEWED_ASSERTIONS_ONLY",
            "notes": "operator_complete",
            "phases": list(ol.REQUIRED_PASS_PHASES),
            "setup_failure": False,
        }
        # Absent coverage
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.build_bound_launcher_report(launcher, **base, cases=[])
        # Subset
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.build_bound_launcher_report(
                launcher,
                **base,
                cases=[{"case_id": expected[0], "assertion": "MATCH"}],
            )
        # Extra
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.build_bound_launcher_report(
                launcher,
                **base,
                cases=[{"case_id": c, "assertion": "MATCH"} for c in expected]
                + [{"case_id": "extra-case", "assertion": "MATCH"}],
            )
        # Duplicate
        dup = [{"case_id": c, "assertion": "MATCH"} for c in expected]
        dup[1] = {"case_id": expected[0], "assertion": "MATCH"}
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.build_bound_launcher_report(launcher, **base, cases=dup)
        # Reordered
        reordered = [{"case_id": c, "assertion": "MATCH"} for c in reversed(expected)]
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.build_bound_launcher_report(launcher, **base, cases=reordered)
        # Mismatched retained vs live offline binding
        launcher.offline._expected_case_ids = (expected[0],)
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.build_bound_launcher_report(
                launcher,
                **base,
                cases=[{"case_id": c, "assertion": "MATCH"} for c in expected],
            )
        # Full exact sequence still binds.
        launcher.offline._expected_case_ids = tuple(expected)
        ok = ol.build_bound_launcher_report(
            launcher,
            **base,
            cases=[{"case_id": c, "assertion": "MATCH"} for c in expected],
        )
        self.assertEqual(ok["overall"], "PASS_REVIEWED_ASSERTIONS_ONLY")
        self.assertEqual([c["case_id"] for c in ok["cases"]], expected)

    def test_report_rejects_canary_notes(self):
        with self.assertRaisesRegex(ol.LauncherError, "report_value_refused"):
            ol.launcher_report(notes=CANARY)

    def test_coverage_mismatch_not_pass(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        launcher.offline._expected_case_ids = ("anon-period",)
        with self.assertRaisesRegex(ol.LauncherError, "proof_incomplete|setup_failure"):
            self._run_with_ack(launcher)

    def test_la05_https_guard_branch_superclass_mocked(self):
        """HTTPS path always uses accepted superclass; tests mock it — no live delegate injection."""
        handler = BoundFakeHandler()

        import test_runner as runner
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
            # No transport_factory → GuardedHttps → superclass __call__.
        )
        spec_path, approval_path, sha, _ = self._prepare()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )

        def mocked_https(self, host, method, path, headers, body):
            return handler(host, method, path, headers, body)

        with patch.object(launcher.harness.HttpsTransport, "__call__", mocked_https):
            report = self._run_with_ack(launcher)
        self.assertEqual(report["overall"], "PASS_REVIEWED_ASSERTIONS_ONLY")
        self.assertEqual(report["execution"], "REVIEWED_LIVE")
        self.assertGreaterEqual(report["network_calls"], 1)
        self.assertEqual(report["transport_calls"], 0)

    def test_non_fake_transport_factory_refused(self):
        import test_runner as runner
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
            transport_factory=lambda: BoundFakeHandler(),
        )
        spec_path, approval_path, sha, _ = self._prepare()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        with self.assertRaisesRegex(ol.LauncherError, "transport_not_trusted"):
            launcher.run_reviewed_sequence()

    def test_fu_terminal_reporter_after_attempted_calls(self):
        launcher = ol.OperatorLauncher(package_dir=PACKAGE, worktree_root=self.worktree)
        launcher._used_fake_transport = True
        launcher._transport_calls = 2
        launcher._network_calls = 0
        launcher._phases = ["bound", "actors_created"]
        report = ol.build_terminal_report(
            launcher,
            failure_code="create_uncertain_stop",
            notes="operator_failure",
            overall="NOT_RUN",
        )
        self.assertEqual(report["execution"], "SIMULATED_OFFLINE")
        self.assertEqual(report["transport_calls"], 2)
        self.assertEqual(report["network_calls"], 0)
        self.assertEqual(report["overall"], "SETUP_FAILURE")
        self.assertEqual(report["failure_code"], "create_uncertain_stop")
        self.assertTrue(report["setup_failure"])

    def test_fu_main_failure_after_attempts_no_secondary_escape(self):
        import io
        spec_path, approval_path, sha, _ = self._prepare()
        outer = self
        base_prompt = outer._launcher().prompt
        base_factory = outer._launcher().transport_factory

        class Tracking(ol.OperatorLauncher):
            def __init__(self, **kwargs):
                kwargs.setdefault("package_dir", PACKAGE)
                kwargs.setdefault("worktree_root", outer.worktree)
                kwargs.setdefault("clock", outer._clock)
                kwargs.setdefault("sleep", outer._sleep)
                kwargs.setdefault("prompt", base_prompt)
                kwargs.setdefault("transport_factory", base_factory)
                super().__init__(**kwargs)

            def run_reviewed_sequence(self):
                self._used_fake_transport = True
                self._transport_calls = 1
                self._phases = ["bound"]
                raise ol.LauncherError("create_uncertain_stop")

        buf = io.StringIO()
        with patch.object(ol, "OperatorLauncher", Tracking), patch("sys.stdout", buf):
            code = ol.main(["run", str(spec_path), str(approval_path), sha])
        self.assertEqual(code, 2)
        report = json.loads(buf.getvalue().strip().splitlines()[-1])
        self.assertEqual(report["failure_code"], "create_uncertain_stop")
        self.assertEqual(report["execution"], "SIMULATED_OFFLINE")
        self.assertEqual(report["transport_calls"], 1)
        self.assertEqual(report["network_calls"], 0)
        self.assertTrue(report["setup_failure"])

    def test_fu_main_cancel_after_attempts_exit_130(self):
        import io
        spec_path, approval_path, sha, _ = self._prepare()
        outer = self
        base_prompt = outer._launcher().prompt
        base_factory = outer._launcher().transport_factory

        class Tracking(ol.OperatorLauncher):
            def __init__(self, **kwargs):
                kwargs.setdefault("package_dir", PACKAGE)
                kwargs.setdefault("worktree_root", outer.worktree)
                kwargs.setdefault("clock", outer._clock)
                kwargs.setdefault("sleep", outer._sleep)
                kwargs.setdefault("prompt", base_prompt)
                kwargs.setdefault("transport_factory", base_factory)
                super().__init__(**kwargs)

            def run_reviewed_sequence(self):
                self._used_fake_transport = True
                self._transport_calls = 1
                self._phases = ["bound"]
                raise KeyboardInterrupt

        buf = io.StringIO()
        with patch.object(ol, "OperatorLauncher", Tracking), patch("sys.stdout", buf):
            code = ol.main(["run", str(spec_path), str(approval_path), sha])
        self.assertEqual(code, 130)
        report = json.loads(buf.getvalue().strip().splitlines()[-1])
        self.assertEqual(report["failure_code"], "cancelled")
        self.assertEqual(report["notes"], "operator_cancelled")
        self.assertEqual(report["execution"], "SIMULATED_OFFLINE")
        self.assertEqual(report["transport_calls"], 1)

    def test_fu_source_unlink_prompt_disposes(self):
        import shutil
        pkg = self.root / "pkg"
        pkg.mkdir()
        for name in ("operator_launcher.py", "auth_api_harness.py", "test_runner.py"):
            shutil.copy2(PACKAGE / name, pkg / name)
        # Load from temp package so we can unlink the launcher file after bind.
        import importlib.util
        spec = importlib.util.spec_from_file_location("temp_operator_launcher", pkg / "operator_launcher.py")
        temp_ol = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(temp_ol)

        import test_runner as runner
        adapter = runner.ConsoleCredentialAdapter(
            prompt_fn=self._prompt,
            stream_probe=lambda: {
                "stdin_isatty": True, "stdout_isatty": True, "stderr_isatty": True,
                "stdin_redirected": False, "stdout_redirected": False, "stderr_redirected": False,
            },
        )

        def factory():
            import sys
            return sys.modules["test_runner"].TrustedFakeTransport(handler=BoundFakeHandler())

        launcher = temp_ol.OperatorLauncher(
            package_dir=pkg,
            worktree_root=self.worktree,
            clock=self._clock,
            sleep=self._sleep,
            prompt=adapter,
            transport_factory=factory,
        )
        # Approval must match temp package launcher digest.
        launcher_bytes = (pkg / "operator_launcher.py").read_bytes()
        spec_path = self.root / "spec-unlink.json"
        spec_bytes = self._write_json(spec_path, self._spec())
        approval = {
            "expected_spec_sha256": lf_sha(spec_bytes),
            "expected_harness_sha256": ol.EXPECTED_HARNESS_SHA256,
            "expected_wrapper_sha256": ol.EXPECTED_WRAPPER_SHA256,
            "expected_launcher_sha256": lf_sha(launcher_bytes),
            "approval_id": "offline-launcher-test",
            "expires_at": future_iso(),
            "approved_phases": ["live_orchestrate", "real_https"],
            "approved_actions": ["auth_create", "auth_signin", "rpc_read"],
        }
        approval_path = self.root / "approval-unlink.json"
        approval_bytes = self._write_json(approval_path, approval)
        sha = lf_sha(approval_bytes)
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        # Retain fake client + secret, then unlink launcher source.
        launcher._publishable = "sb_publishable_fake"
        launcher._secret = "sb_secret_fake"
        class FakeClient:
            def __init__(self):
                self.admin = {"kept": True}
                self.forgotten = False

            def forget(self):
                self.admin = None
                self.forgotten = True

        fake = FakeClient()
        launcher.offline.client = fake
        (pkg / "operator_launcher.py").unlink()
        with self.assertRaisesRegex(temp_ol.LauncherError, "source_load_failed|launcher_hash_mismatch"):
            launcher.prompt_keys()
        self.assertTrue(launcher._terminal)
        self.assertIsNone(launcher._publishable)
        self.assertIsNone(launcher._secret)
        self.assertTrue(fake.forgotten)
        # Continuation refused.
        with self.assertRaisesRegex(temp_ol.LauncherError, "setup_failure_terminal"):
            launcher._assert_authority()

    def test_la05_drift_between_transport_calls(self):
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        launcher.bind_launch_files(
            spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
        )
        calls = {"n": 0}
        real_assert = launcher._assert_authority

        def flaky_assert():
            calls["n"] += 1
            if calls["n"] > 3:
                # Mutate approval file mid-flight after some calls.
                approval_path.write_bytes(b'{"broken":true}')
            real_assert()

        launcher._assert_authority = flaky_assert
        with self.assertRaisesRegex(ol.LauncherError, "approval_binding_changed|approval_"):
            self._run_with_ack(launcher)

    def test_ack_symlink_refused_when_supported(self):
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

    def test_dangling_ack_symlink_refused(self):
        dangling = self.handoff / ol.ACK_BASENAME
        try:
            os.symlink(str(self.handoff / "missing-target.json"), dangling)
        except OSError:
            self.skipTest("symlink creation requires privileges")
        spec_path, approval_path, sha, _ = self._prepare()
        launcher = self._launcher()
        # Pre-existing dangling ack should be treated as preexisting/symlink refuse.
        with self.assertRaisesRegex(ol.LauncherError, "ack_preexisting|ack_symlink_refused"):
            launcher.bind_launch_files(
                spec_path=spec_path, approval_path=approval_path, expected_approval_sha_lf=sha,
            )


if __name__ == "__main__":
    unittest.main()
